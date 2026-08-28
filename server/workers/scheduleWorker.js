#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// workers/scheduleWorker.js
//
// Standalone BullMQ worker process for the "schedule" queue.
// Run it separately from the API server:
//
//   node workers/scheduleWorker.js        (production)
//   nodemon workers/scheduleWorker.js     (development)
//
// Or it is started automatically in-process by server.js via startWorker().
//
// Responsibilities:
//   1. Pull job payload { userId, taskIds, prompt } from Redis.
//   2. Fetch the authoritative task documents from MongoDB by their IDs.
//   3. Run the Gemini prompt-builder + retry logic (same code the old route used).
//   4. Write the result (or error) into the ScheduleJob document.
//
// The API layer polls GET /api/ai/schedule/:jobId → reads ScheduleJob → responds.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Worker }  from 'bullmq';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { redisConnection }  from '../config/redis.js';
import { SCHEDULE_QUEUE_NAME } from '../queues/scheduleQueue.js';
import Task        from '../models/Task.js';
import ScheduleJob from '../models/ScheduleJob.js';
import {
  calculateTaskScore,
  compareScoredTasks,
  scoreTask,
} from '../utils/scheduleScoring.js';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — CONSTANTS  (mirrors aiRoutes.js — keep in sync)
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_SCORE = { high: 100, medium: 50, low: 10 };

const URGENCY_SCORE = {
  overdue:  80,
  today:    60,
  tomorrow: 40,
  week:     20,
  later:     0,
};

const WORKDAY_START_HOUR    = 9;
const WORKDAY_END_HOUR      = 18;
const DEFAULT_DURATION_MINS = 45;
const BREAK_THRESHOLD_MINS  = 90;
const BREAK_DURATION_MINS   = 15;

const GEMINI_MODELS        = ['gemini-2.5-flash-lite'];
const GEMINI_MAX_ATTEMPTS  = 3;
const GEMINI_BASE_DELAY_MS = 600;
const GEMINI_MAX_DELAY_MS  = 4000;
const GEMINI_TIMEOUT_MS    = 20000;

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — PURE HELPERS  (identical to aiRoutes.js)
// ─────────────────────────────────────────────────────────────────────────────

function parseEstimatedTime(raw) {
  if (!raw || typeof raw !== 'string') return DEFAULT_DURATION_MINS;
  const s = raw.trim().toLowerCase();
  const hhmm = s.match(/(\d+(?:\.\d+)?)\s*h(?:r|ours?)?\s*(\d+)?\s*m?/);
  if (hhmm) {
    const total = Math.round((parseFloat(hhmm[1]) || 0) * 60 + (parseInt(hhmm[2], 10) || 0));
    return total > 0 ? total : DEFAULT_DURATION_MINS;
  }
  const minOnly = s.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?/);
  if (minOnly) {
    const total = Math.round(parseFloat(minOnly[1]));
    return total > 0 ? total : DEFAULT_DURATION_MINS;
  }
  const hrOnly = s.match(/(\d+(?:\.\d+)?)\s*h(?:ours?|r)?/);
  if (hrOnly) {
    const total = Math.round(parseFloat(hrOnly[1]) * 60);
    return total > 0 ? total : DEFAULT_DURATION_MINS;
  }
  const bare = s.match(/^(\d+)$/);
  if (bare) return parseInt(bare[1], 10) || DEFAULT_DURATION_MINS;
  return DEFAULT_DURATION_MINS;
}

function combineDueDateAndTime(dueDate, dueTime) {
  if (!dueDate) return null;
  const base = new Date(dueDate);
  if (isNaN(base.getTime())) return null;
  if (dueTime && typeof dueTime === 'string') {
    const t24 = dueTime.trim().match(/^(\d{1,2}):(\d{2})$/);
    const t12 = dueTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (t24) {
      base.setHours(parseInt(t24[1], 10), parseInt(t24[2], 10), 0, 0);
    } else if (t12) {
      let h = parseInt(t12[1], 10);
      const m = parseInt(t12[2], 10);
      const mer = t12[3].toUpperCase();
      if (mer === 'PM' && h !== 12) h += 12;
      if (mer === 'AM' && h === 12) h = 0;
      base.setHours(h, m, 0, 0);
    }
  }
  return base;
}

function isCompleted(task) {
  if (!task) return false;
  const c = task.completed;
  if (c === true || c === 1) return true;
  if (typeof c === 'string' && ['true', '1', 'yes', 'done'].includes(c.trim().toLowerCase())) return true;
  if (task.completedAt) {
    const d = new Date(task.completedAt);
    if (!isNaN(d.getTime())) return true;
  }
  return false;
}

function isOverdue(task, now = new Date()) {
  if (isCompleted(task)) return false;
  const deadline = combineDueDateAndTime(task.dueDate, task.dueTime);
  return deadline ? deadline.getTime() < now.getTime() : false;
}

function getUrgencyScore(dueDate, dueTime, now = new Date()) {
  const deadline = combineDueDateAndTime(dueDate, dueTime);
  if (!deadline) return URGENCY_SCORE.later;
  const diffMins = (deadline - now) / (1000 * 60);
  if (diffMins < 0)        return URGENCY_SCORE.overdue;
  if (diffMins < 60 * 24)  return URGENCY_SCORE.today;
  if (diffMins < 60 * 48)  return URGENCY_SCORE.tomorrow;
  if (diffMins < 60 * 168) return URGENCY_SCORE.week;
  return URGENCY_SCORE.later;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function roundUpToFiveMins(date) {
  const d = new Date(date);
  const r = d.getMinutes() % 5;
  if (r !== 0) d.setMinutes(d.getMinutes() + (5 - r), 0, 0);
  else d.setSeconds(0, 0);
  return d;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(dateStr) {
  if (!dateStr) return 'No due date';
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDuration(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function priorityLabel(p) {
  if (!p) return '🟡 Medium';
  return ({ high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' })[p.toLowerCase()] ?? '🟡 Medium';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getScheduleWindow(now = new Date()) {
  const start = new Date(now);
  start.setHours(WORKDAY_START_HOUR, 0, 0, 0);
  const end = new Date(now);
  end.setHours(WORKDAY_END_HOUR, 0, 0, 0);

  let cursor;
  let rolledToTomorrow = false;

  if (now < start) {
    cursor = new Date(start);
  } else if (now >= end) {
    start.setDate(start.getDate() + 1);
    end.setDate(end.getDate() + 1);
    cursor = new Date(start);
    rolledToTomorrow = true;
  } else {
    cursor = roundUpToFiveMins(now);
    if (cursor > end) cursor = new Date(end);
  }

  return {
    start: cursor,
    end,
    availableMins: Math.max(0, Math.round((end - cursor) / (1000 * 60))),
    isToday: !rolledToTomorrow,
    rolledToTomorrow,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — FALLBACK SCHEDULER
// ─────────────────────────────────────────────────────────────────────────────

function buildFallbackSchedule(tasks, prompt) {
  const now     = new Date();
  const pending = (tasks || []).filter(t => !isCompleted(t));

  if (pending.length === 0) {
    return (
      `📋 Priority Scheduler  ·  AI unavailable\n\n` +
      `You have no pending tasks right now — great work! ` +
      `Add tasks and I'll build a priority schedule for you.`
    );
  }

  const win = getScheduleWindow(now);

  const scored = pending.map(task => scoreTask(task, now));

  scored.sort(compareScoredTasks);

  let cursor = new Date(win.start);
  const workdayEnd = win.end;
  let workedMins = 0;
  let plannedMins = 0;
  const blocks = [];

  for (const task of scored) {
    if (cursor >= workdayEnd) { blocks.push({ overflow: true, task }); continue; }
    if (workedMins >= BREAK_THRESHOLD_MINS && blocks.some(b => b.task)) {
      const breakEnd = addMinutes(cursor, BREAK_DURATION_MINS);
      if (breakEnd <= workdayEnd) {
        blocks.push({ isBreak: true, start: new Date(cursor), end: breakEnd });
        cursor = breakEnd;
        workedMins = 0;
      }
    }
    const end = addMinutes(cursor, task._duration);
    if (end > workdayEnd) { blocks.push({ overflow: true, task }); continue; }
    blocks.push({ task, start: new Date(cursor), end, overflow: false });
    cursor = end;
    workedMins  += task._duration;
    plannedMins += task._duration;
  }

  const overdueTasks   = scored.filter(t => t._overdue);
  const scheduledCount = blocks.filter(b => b.task && !b.overflow).length;
  const overflowCount  = blocks.filter(b => b.overflow).length;
  const dayLabel = win.rolledToTomorrow ? 'tomorrow' : 'today';
  const windowStr = `${formatTime(win.start)} – ${formatTime(win.end)} (${formatDuration(win.availableMins)} free)`;

  const lines = [
    `📋 Priority Schedule  ·  AI unavailable — using built-in scheduler`,
    `Request: "${prompt}"`,
    `Now: ${now.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}`,
    `Working window (${dayLabel}): ${windowStr}`,
    `────────────────────────────────────────`,
  ];

  if (overdueTasks.length > 0) {
    lines.push(`\n⚠️  OVERDUE — handle these first (${overdueTasks.length}):`);
    overdueTasks.forEach(t => {
      const dueStr = t._deadline
        ? `${formatDate(t.dueDate)}${t.dueTime ? ' at ' + t.dueTime : ''}`
        : 'No due date';
      lines.push(`   • ${t.title}  (${priorityLabel(t.priority)} · was due ${dueStr})`);
    });
    lines.push(`────────────────────────────────────────`);
  }

  let slot = 1;
  for (const block of blocks) {
    if (block.isBreak) { lines.push(`\n☕  ${formatTime(block.start)} – ${formatTime(block.end)}   Break`); continue; }
    if (block.overflow) continue;
    const { task, start, end } = block;
    const dueStr  = task.dueDate ? `${formatDate(task.dueDate)}${task.dueTime ? ' at ' + task.dueTime : ''}` : 'No due date';
    const tagStr  = task.tags?.length ? `  #${task.tags.join(' #')}` : '';
    const catStr  = task.category ? `[${task.category}]` : '';
    const overdueFlag = task._overdue ? '  ⚠️ OVERDUE' : '';
    lines.push(
      `\n${slot}. ${formatTime(start)} – ${formatTime(end)}  (${formatDuration(task._duration)})` +
      `\n   ${task.title}  ${catStr}${tagStr}${overdueFlag}` +
      `\n   ${priorityLabel(task.priority)}  ·  Due: ${dueStr}` +
      (task.description ? `\n   Note: ${task.description.substring(0, 100)}` : '')
    );
    slot++;
  }

  const overflowBlocks = blocks.filter(b => b.overflow);
  if (overflowBlocks.length > 0) {
    lines.push(`\n────────────────────────────────────────`);
    lines.push(`\n⏭️  Didn't fit ${dayLabel}'s window (${overflowBlocks.length}):`);
    overflowBlocks.forEach(b => {
      lines.push(`   • ${b.task.title}  (${priorityLabel(b.task.priority)} · ${formatDuration(parseEstimatedTime(b.task.estimatedTime))})`);
    });
    lines.push(`   Move these to the next working block or trim other durations.`);
  }

  lines.push(`\n────────────────────────────────────────`);
  lines.push(
    `\n📊 ${scheduledCount} scheduled · ${overflowCount} overflow · ${formatDuration(plannedMins)} planned of ${formatDuration(win.availableMins)} free` +
    `\n💡 Tip: Set "estimatedTime" on tasks (e.g. "45 min") for accurate time blocks.`
  );

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — GEMINI CONTEXT + PROMPT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildTasksContext(tasks, now = new Date()) {
  if (!tasks || tasks.length === 0) return '\n\nNo tasks available. Provide general scheduling advice only.';

  const pending   = tasks.filter(t => !isCompleted(t));
  const completed = tasks.filter(t =>  isCompleted(t));

  const formatTask = (task, idx) => {
    const deadline = combineDueDateAndTime(task.dueDate, task.dueTime);
    const deadlineStr = deadline
      ? deadline.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
      : 'No deadline';
    const overdueStr = isOverdue(task, now) ? '  [OVERDUE]' : '';
    const rows = [
      `${idx + 1}. "${task.title}"${overdueStr}`,
      `   Priority:  ${task.priority || 'medium'}`,
      `   Deadline:  ${deadlineStr}`,
      `   Category:  ${task.category || 'General'}`,
    ];
    if (task.estimatedTime) rows.push(`   Est. time: ${task.estimatedTime} (≈${parseEstimatedTime(task.estimatedTime)} min)`);
    if (task.tags?.length)  rows.push(`   Tags:      ${task.tags.join(', ')}`);
    if (task.description)   rows.push(`   Notes:     ${task.description.substring(0, 150)}`);
    return rows.join('\n');
  };

  let ctx = `\n\n── PENDING TASKS (${pending.length}) — these are the ONLY tasks you may schedule ──\n`;
  ctx += pending.length > 0
    ? pending.map((t, i) => formatTask(t, i)).join('\n\n')
    : 'None. All tasks are completed — do not invent or reschedule anything.';

  if (completed.length > 0) {
    ctx += `\n\n── ALREADY COMPLETED (${completed.length}) — DO NOT SCHEDULE OR MENTION THESE AS TODO ──\n`;
    ctx += completed
      .map(t => `✓ ${t.title} [DONE]` + (t.completedAt ? ` (done at ${new Date(t.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})` : ''))
      .join('\n');
    ctx += `\nThe ${completed.length} task(s) above are finished. They must NOT appear in the schedule.`;
  }

  return ctx;
}

function buildGeminiPrompt(userPrompt, tasksContext, now = new Date(), conversationHistory = []) {
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Detect if the user mentioned specific working hours or a sleep/blocked window.
  const userMentionedHours = /\b(\d{1,2}(:\d{2})?\s*(am|pm)|work(ing)?\s*(hour|from|until|till)|sleep|wake|bed|available)/i.test(userPrompt);

  const windowLine = userMentionedHours
    ? ''  // user stated their own constraints — Gemini reads them from the request
    : 'Working hours: not specified. If you need a timed schedule, ask the user for their available hours, OR produce a clean priority-ordered task list without specific times.';

  // Build the conversation history section (last N messages for context).
  let historySection = '';
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const historyLines = conversationHistory.map(m => {
      const role = m.type === 'user' ? 'User' : 'Assistant';
      return `${role}: ${m.content}`;
    });
    historySection = `\nCONVERSATION HISTORY (most recent messages, for context only):\n${historyLines.join('\n')}\n`;
  }

  return `You are ChronoSync's AI scheduling assistant.
Today is ${dateStr}. Current time: ${timeStr}.
${windowLine}
${historySection}
CURRENT USER REQUEST:
${userPrompt}
${tasksContext}

STRICT RULES — follow ALL of them without exception:
1. SCHEDULE ONLY tasks listed under "PENDING TASKS". Never invent or add tasks.
2. Tasks listed under "ALREADY COMPLETED" are finished by default and should NOT appear
   in a general schedule. EXCEPTION: if the user explicitly asks to redo, repeat, or
   re-schedule a specific completed task (e.g. "I need to redo task X"), you MAY include
   it in the schedule and treat it as if it were pending. Acknowledge briefly that it was
   completed and that you are re-scheduling it per their request.
3. Overdue tasks (marked [OVERDUE]) must be prioritised first, clearly labelled.
4. SLEEP / UNAVAILABILITY WINDOWS — ABSOLUTE HARD CONSTRAINT:
   If the user mentions a sleep time, bedtime, unavailable period, or any blocked
   window (e.g. "sleep at 2 AM, wake at 8 AM"), you MUST NOT schedule ANY task
   inside that window. Split the schedule into pre-sleep and post-wake blocks.
   Any tasks that cannot fit before the blocked window go into the post-wake block.
   Never suggest doing work during a sleep or rest period.
5. If the user specified working hours, schedule ONLY within those hours.
   If they did not specify hours AND there is no sleep window, ask for their
   available hours OR give a priority-ordered list without specific times.
6. Use each task's "Est. time" for block length. Default to 45 minutes if missing.
7. Order by priority then deadline urgency (high priority / closest deadline first).
8. Add a 10–15 minute break after every 90 minutes of continuous work.
9. If tasks cannot all fit, schedule the most important ones first and clearly list
   which tasks overflow and when they could be done instead.
10. ALWAYS honour what the user asks. If the user's request conflicts with a default
    rule (like re-doing a completed task), follow the user's explicit intent.
    Do NOT refuse or ignore a reasonable user request.
11. If the user's message is a question (not a schedule request), answer concisely.
    Do NOT generate a full timed schedule unless explicitly asked.
12. Do NOT use markdown: no ##, no **bold**, no _italic_, no backticks, no tables.
    Plain text only. Use numbered lists and plain dashes.
13. Do NOT show internal scores, percentages, or system metadata to the user.
14. Blank line between each schedule block or section.
15. Keep response under 450 words unless a full daily schedule genuinely needs more.
16. If no tasks exist, give practical general scheduling advice only.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — GEMINI CALL WITH RETRIES  (mirrors aiRoutes.js)
// ─────────────────────────────────────────────────────────────────────────────

function extractStatus(err) {
  if (!err) return null;
  if (typeof err.status === 'number') return err.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  const m = String(err.message || '').match(/\[?(\d{3})\b/);
  return m ? parseInt(m[1], 10) : null;
}

function isRetryableError(err) {
  const status = extractStatus(err);
  if (status !== null) return RETRYABLE_STATUS.has(status);
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('timeout')      ||
    msg.includes('timed out')    ||
    msg.includes('network')      ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset')   ||
    msg.includes('socket hang up') ||
    msg.includes('aborted')      ||
    msg.includes('overloaded')   ||
    msg.includes('unavailable')
  );
}

function validateGeminiText(text) {
  const t = text?.trim();
  const isUsable =
    t &&
    t.length >= 30 &&
    !t.toLowerCase().startsWith("i'm sorry") &&
    !t.toLowerCase().startsWith("i am sorry") &&
    !t.toLowerCase().startsWith("i cannot") &&
    !t.toLowerCase().startsWith("i can't");
  if (!isUsable) throw new Error(`Gemini response rejected: "${t?.substring(0, 60) ?? '(empty)'}"`);
  return t;
}

async function generateOnce(model, fullPrompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const result   = await model.generateContent(
      { contents: [{ role: 'user', parts: [{ text: fullPrompt }] }] },
      { signal: controller.signal },
    );
    const response = await result.response;
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiModel(genAI, modelName, fullPrompt) {
  const model = genAI.getGenerativeModel({ model: modelName });
  let lastErr;
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    try {
      return validateGeminiText(await generateOnce(model, fullPrompt));
    } catch (err) {
      lastErr = err;
      const retryable   = isRetryableError(err);
      const hasMoreTries = attempt < GEMINI_MAX_ATTEMPTS;
      const isRejection  = String(err.message || '').startsWith('Gemini response rejected');
      console.error(`[worker] ${modelName} attempt ${attempt}/${GEMINI_MAX_ATTEMPTS} failed (retryable=${retryable}): ${err.message}`);
      if (!retryable || isRejection || !hasMoreTries) break;
      const backoff = Math.min(GEMINI_BASE_DELAY_MS * 2 ** (attempt - 1), GEMINI_MAX_DELAY_MS);
      await sleep(backoff + Math.floor(Math.random() * 250));
    }
  }
  throw lastErr ?? new Error(`${modelName} failed for an unknown reason.`);
}

async function callGeminiWithRetry(apiKey, fullPrompt) {
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastErr;
  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const modelName = GEMINI_MODELS[i];
    try {
      const text = await callGeminiModel(genAI, modelName, fullPrompt);
      if (i > 0) console.warn(`[worker] Recovered using backup model "${modelName}".`);
      return { text, model: modelName };
    } catch (err) {
      lastErr = err;
      const status = extractStatus(err);
      if (status === 401 || status === 403) { console.error(`[worker] Auth error (${status}) — skipping remaining models.`); break; }
      const next = GEMINI_MODELS[i + 1];
      if (next) console.warn(`[worker] "${modelName}" unavailable — falling back to "${next}".`);
      else       console.error(`[worker] All Gemini models exhausted — using local scheduler.`);
    }
  }
  throw lastErr ?? new Error('All Gemini models failed.');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — WORKER PROCESSOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Core job handler. Receives job.data = { userId, taskIds, prompt }.
 * Uses job.id (always available) as the bullJobId key — never reads bullJobId
 * from job.data to avoid the race condition where the worker starts before
 * the API route has had a chance to call job.updateData({ bullJobId }).
 */
async function processScheduleJob(job) {
  const { userId, taskIds, prompt, conversationHistory = [] } = job.data;
  // Use job.id directly — this is always set by BullMQ before the processor runs.
  const bullJobId = String(job.id);

  console.log(`[worker] Processing job ${bullJobId} for user ${userId} — ${taskIds.length} task IDs, ${conversationHistory.length} history msgs`);

  // 1. Mark job as processing in MongoDB.
  //    upsert:true so if the API hasn't created the doc yet we still have a record.
  await ScheduleJob.findOneAndUpdate(
    { bullJobId },
    { $set: { bullJobId, userId, status: 'processing' } },
    { upsert: true },
  );

  // 2. Fetch tasks from MongoDB (authoritative source — not Redis).
  //    Only fetch tasks that belong to this user (safety check).
  const tasks = taskIds.length > 0
    ? await Task.find({ _id: { $in: taskIds }, user: userId }).lean()
    : [];

  console.log(`[worker] Fetched ${tasks.length}/${taskIds.length} tasks from MongoDB`);

  // 3. Try Gemini, fall back to local scheduler.
  const apiKey = process.env.GEMINI_API_KEY;
  let response, source, model;

  if (apiKey) {
    try {
      const now          = new Date();
      const tasksContext = buildTasksContext(tasks, now);
      const fullPrompt   = buildGeminiPrompt(prompt, tasksContext, now, conversationHistory);
      const result       = await callGeminiWithRetry(apiKey, fullPrompt);
      response = result.text;
      source   = 'gemini';
      model    = result.model;
    } catch (err) {
      console.error('[worker] Gemini unavailable after retries — using fallback:', err.message);
    }
  } else {
    console.warn('[worker] GEMINI_API_KEY not set — using fallback scheduler.');
  }

  if (!response) {
    response = buildFallbackSchedule(tasks, prompt);
    source   = 'fallback';
    model    = null;
  }

  // 4. Write result to MongoDB.
  await ScheduleJob.findOneAndUpdate(
    { bullJobId },
    { $set: { status: 'completed', response, source, model } },
  );

  console.log(`[worker] Job ${bullJobId} completed (source=${source})`);
  return { response, source, model };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — BOOTSTRAP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates and starts the BullMQ Worker, attaching event listeners.
 * MongoDB must already be connected before calling this.
 *
 * Call this from server.js to run the worker in-process (no second terminal
 * needed), or let start() below call it when the file is run standalone.
 *
 * Returns the Worker instance so the caller can close it on shutdown.
 */
export function startWorker() {
  const worker = new Worker(
    SCHEDULE_QUEUE_NAME,
    async (job) => {
      try {
        return await processScheduleJob(job);
      } catch (err) {
        // Mark the job as failed in MongoDB so the polling endpoint can return an error.
        // Use job.id directly — never job.data.bullJobId (race condition).
        await ScheduleJob.findOneAndUpdate(
          { bullJobId: String(job.id) },
          { $set: { status: 'failed', errorMessage: err.message || 'Unknown worker error' } },
        ).catch(() => {});  // swallow — don't mask the real error
        throw err;  // re-throw so BullMQ records the failure + handles retries
      }
    },
    {
      connection: redisConnection,
      concurrency: 5, // process up to 5 schedule jobs at once
    },
  );

  worker.on('completed', (job, result) => {
    console.log(`[worker] ✓ Job ${job.id} finished — source: ${result?.source}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[worker] ✗ Job ${job?.id} failed — ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('[worker] Worker error:', err.message);
  });

  console.log(`[worker] 🚀 Schedule worker started, listening on queue "${SCHEDULE_QUEUE_NAME}"`);
  return worker;
}

// ── Standalone entry-point (node workers/scheduleWorker.js) ──────────────────
// Only runs when this file is executed directly, not when imported by server.js.
async function start() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/chronosyncDB';
  await mongoose.connect(mongoUri);
  console.log('[worker] MongoDB connected');

  const worker = startWorker();

  // Graceful shutdown (standalone only — server.js handles its own shutdown).
  const shutdown = async (signal) => {
    console.log(`[worker] ${signal} received — shutting down gracefully…`);
    await worker.close();
    await mongoose.connection.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

// Detect if this file is the entry-point (ES module equivalent of require.main === module).
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  start().catch(err => {
    console.error('[worker] Fatal startup error:', err);
    process.exit(1);
  });
}
