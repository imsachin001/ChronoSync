import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — CONSTANTS
// Tune these weights to change how the fallback scheduler orders tasks.
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_SCORE = { high: 100, medium: 50, low: 10 };

// Urgency brackets — how many points to add based on how close the due date is.
const URGENCY_SCORE = {
  overdue:   80,  // past due date+time
  today:     60,  // due later today
  tomorrow:  40,  // due within 24–48 h
  week:      20,  // due within 7 days
  later:      0,  // due beyond 7 days
};

const WORKDAY_START_HOUR      = 9;   // 09:00
const WORKDAY_END_HOUR        = 18;  // 18:00
const DEFAULT_DURATION_MINS   = 45;  // used when estimatedTime cannot be parsed
const BREAK_THRESHOLD_MINS    = 90;  // insert a break after this many work-minutes
const BREAK_DURATION_MINS     = 15;

// ── Gemini retry tuning ──────────────────────────────────────────────────────
// Model fallback chain — tried in order until one succeeds. flash-lite is the
// cheaper/faster backup used when flash errors out or is unavailable.
const GEMINI_MODELS           = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const GEMINI_MAX_ATTEMPTS     = 3;     // total tries (1 initial + 2 retries)
const GEMINI_BASE_DELAY_MS    = 600;   // first backoff delay; doubles each retry
const GEMINI_MAX_DELAY_MS     = 4000;  // cap on a single backoff delay
const GEMINI_TIMEOUT_MS       = 20000; // abort a single attempt after this long

// HTTP status codes worth retrying (transient). Everything else fails fast.
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses Task.estimatedTime (free-text string) into an integer number of minutes.
 * Handles formats like: "45 min", "1 hour", "1.5 hours", "90", "2h 30m", etc.
 * Returns DEFAULT_DURATION_MINS if parsing fails.
 */
function parseEstimatedTime(raw) {
  if (!raw || typeof raw !== 'string') return DEFAULT_DURATION_MINS;

  const s = raw.trim().toLowerCase();

  // "2h 30m" or "2hr 30min" style
  const hhmm = s.match(/(\d+(?:\.\d+)?)\s*h(?:r|ours?)?\s*(\d+)?\s*m?/);
  if (hhmm) {
    const hours = parseFloat(hhmm[1]) || 0;
    const mins  = parseInt(hhmm[2], 10) || 0;
    const total = Math.round(hours * 60 + mins);
    return total > 0 ? total : DEFAULT_DURATION_MINS;
  }

  // "45 min" or "45 minutes"
  const minOnly = s.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?/);
  if (minOnly) {
    const total = Math.round(parseFloat(minOnly[1]));
    return total > 0 ? total : DEFAULT_DURATION_MINS;
  }

  // "1.5 hours" or "2 hours"
  const hrOnly = s.match(/(\d+(?:\.\d+)?)\s*h(?:ours?|r)?/);
  if (hrOnly) {
    const total = Math.round(parseFloat(hrOnly[1]) * 60);
    return total > 0 ? total : DEFAULT_DURATION_MINS;
  }

  // bare number — assume minutes
  const bare = s.match(/^(\d+)$/);
  if (bare) return parseInt(bare[1], 10) || DEFAULT_DURATION_MINS;

  return DEFAULT_DURATION_MINS;
}

/**
 * Combines Task.dueDate (Date) and Task.dueTime (string "HH:MM" or "HH:MM AM/PM")
 * into one JavaScript Date for precise urgency calculation.
 */
function combineDueDateAndTime(dueDate, dueTime) {
  if (!dueDate) return null;

  const base = new Date(dueDate);
  if (isNaN(base.getTime())) return null;

  if (dueTime && typeof dueTime === 'string') {
    // Support both "14:30" and "2:30 PM"
    const t24 = dueTime.trim().match(/^(\d{1,2}):(\d{2})$/);
    const t12 = dueTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

    if (t24) {
      base.setHours(parseInt(t24[1], 10), parseInt(t24[2], 10), 0, 0);
    } else if (t12) {
      let h = parseInt(t12[1], 10);
      const m = parseInt(t12[2], 10);
      const meridian = t12[3].toUpperCase();
      if (meridian === 'PM' && h !== 12) h += 12;
      if (meridian === 'AM' && h === 12) h = 0;
      base.setHours(h, m, 0, 0);
    }
    // If dueTime is some other format, just use midnight of dueDate — safe default.
  }

  return base;
}

/**
 * Robustly decides whether a task is completed.
 * The client may send `completed` as a boolean, the string "true"/"false",
 * 0/1, or omit it while still setting `completedAt`. Trusting a single raw
 * boolean is what let completed tasks leak back into reschedules — so we
 * normalise every possible shape here and use this everywhere.
 */
function isCompleted(task) {
  if (!task) return false;
  const c = task.completed;
  if (c === true || c === 1) return true;
  if (typeof c === 'string' && ['true', '1', 'yes', 'done'].includes(c.trim().toLowerCase())) return true;
  // A real completion timestamp also means done, even if the flag is missing/false.
  if (task.completedAt) {
    const d = new Date(task.completedAt);
    if (!isNaN(d.getTime())) return true;
  }
  return false;
}

/** Returns true when a task's combined deadline is in the past (and it's pending). */
function isOverdue(task, now = new Date()) {
  if (isCompleted(task)) return false;
  const deadline = combineDueDateAndTime(task.dueDate, task.dueTime);
  return deadline ? deadline.getTime() < now.getTime() : false;
}

/**
 * Returns a numeric urgency score for a task using its combined due datetime.
 */
function getUrgencyScore(dueDate, dueTime, now = new Date()) {
  const deadline = combineDueDateAndTime(dueDate, dueTime);
  if (!deadline) return URGENCY_SCORE.later;

  const diffMins = (deadline - now) / (1000 * 60);

  if (diffMins < 0)       return URGENCY_SCORE.overdue;
  if (diffMins < 60 * 24) return URGENCY_SCORE.today;
  if (diffMins < 60 * 48) return URGENCY_SCORE.tomorrow;
  if (diffMins < 60 * 168)return URGENCY_SCORE.week;
  return URGENCY_SCORE.later;
}

/** Adds `minutes` to a Date and returns a new Date. */
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/** Rounds a Date UP to the next 5-minute boundary for tidy start times. */
function roundUpToFiveMins(date) {
  const d = new Date(date);
  const r = d.getMinutes() % 5;
  if (r !== 0) d.setMinutes(d.getMinutes() + (5 - r), 0, 0);
  else d.setSeconds(0, 0);
  return d;
}

/** Formats a Date to "HH:MM AM/PM". */
function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/** Formats a Date to short readable date like "Mon, Jun 24". */
function formatDate(dateStr) {
  if (!dateStr) return 'No due date';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

/** Human-friendly duration: 90 -> "1h 30m", 45 -> "45m". */
function formatDuration(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Maps priority string to an emoji label for fallback output. */
function priorityLabel(p) {
  if (!p) return '🟡 Medium';
  const map = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
  return map[p.toLowerCase()] ?? '🟡 Medium';
}

/** Sleep helper for retry backoff. */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determines the schedulable time window starting from "now".
 *
 * Recognises the time range we actually have left today:
 *   - If now is before the workday start  -> window = [workdayStart, workdayEnd]
 *   - If now is within the workday         -> window = [now(rounded), workdayEnd]
 *   - If now is at/after the workday end    -> window = tomorrow [start, end]
 *
 * Returns { start, end, availableMins, isToday, rolledToTomorrow }.
 */
function getScheduleWindow(now = new Date()) {
  const start = new Date(now);
  start.setHours(WORKDAY_START_HOUR, 0, 0, 0);

  const end = new Date(now);
  end.setHours(WORKDAY_END_HOUR, 0, 0, 0);

  let cursor;
  let rolledToTomorrow = false;

  if (now < start) {
    // Before work hours — full day available.
    cursor = new Date(start);
  } else if (now >= end) {
    // Day is over — roll to tomorrow morning.
    start.setDate(start.getDate() + 1);
    end.setDate(end.getDate() + 1);
    cursor = new Date(start);
    rolledToTomorrow = true;
  } else {
    // Mid-day — start from now (rounded up to the next 5 mins).
    cursor = roundUpToFiveMins(now);
    if (cursor > end) cursor = new Date(end);
  }

  const availableMins = Math.max(0, Math.round((end - cursor) / (1000 * 60)));

  return {
    start: cursor,
    end,
    availableMins,
    isToday: !rolledToTomorrow,
    rolledToTomorrow,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — FALLBACK PRIORITY SCHEDULER
// Runs when Gemini is unavailable, errors out (after retries), or returns junk.
//
// Algorithm — Weighted Priority + Urgency, time-window aware:
//   score = PRIORITY_SCORE[priority] + URGENCY_SCORE[urgencyBracket]
//   Sort tasks descending by score; ties broken by earliest combined deadline.
//   Detect the real time range left in the workday (from NOW, not a fixed 9am).
//   Assign sequential time blocks inside that window.
//   Inject a break every BREAK_THRESHOLD_MINS of continuous work.
//   Tasks that don't fit in the remaining window are flagged as overflow.
// ─────────────────────────────────────────────────────────────────────────────
function buildFallbackSchedule(tasks, prompt) {
  const now = new Date();

  // Only schedule pending (not completed) tasks — uses the robust check so a
  // just-completed task can never sneak back into a reschedule.
  const pending = (tasks || []).filter(t => !isCompleted(t));

  if (pending.length === 0) {
    return (
      `📋 Priority Scheduler  ·  AI unavailable\n\n` +
      `You have no pending tasks right now — great work! ` +
      `Add tasks and I'll build a priority schedule for you.`
    );
  }

  // Recognise the time range we have to work with.
  const win = getScheduleWindow(now);

  // Score and enrich each task.
  const scored = pending.map(task => ({
    ...task,
    _score:    (PRIORITY_SCORE[task.priority?.toLowerCase()] ?? PRIORITY_SCORE.medium)
             + getUrgencyScore(task.dueDate, task.dueTime, now),
    _duration: parseEstimatedTime(task.estimatedTime),
    _deadline: combineDueDateAndTime(task.dueDate, task.dueTime),
    _overdue:  isOverdue(task, now),
  }));

  // Sort: overdue first → highest score → earliest deadline.
  scored.sort((a, b) => {
    if (a._overdue !== b._overdue) return a._overdue ? -1 : 1;
    if (b._score !== a._score) return b._score - a._score;
    if (!a._deadline && !b._deadline) return 0;
    if (!a._deadline) return 1;
    if (!b._deadline) return -1;
    return a._deadline - b._deadline;
  });

  // Build time blocks inside the available window.
  let cursor = new Date(win.start);
  const workdayEnd = win.end;

  let workedMins = 0;
  let plannedMins = 0;
  const blocks   = [];

  for (const task of scored) {
    if (cursor >= workdayEnd) {
      blocks.push({ overflow: true, task });
      continue;
    }

    // Insert a break before the next task if the work threshold is crossed.
    if (workedMins >= BREAK_THRESHOLD_MINS && blocks.some(b => b.task)) {
      const breakEnd = addMinutes(cursor, BREAK_DURATION_MINS);
      if (breakEnd <= workdayEnd) {
        blocks.push({ isBreak: true, start: new Date(cursor), end: breakEnd });
        cursor     = breakEnd;
        workedMins = 0;
      }
    }

    const end = addMinutes(cursor, task._duration);

    // If the task would spill past the end of the window, flag as overflow.
    if (end > workdayEnd) {
      blocks.push({ overflow: true, task });
      continue;
    }

    blocks.push({ task, start: new Date(cursor), end, overflow: false });
    cursor      = end;
    workedMins += task._duration;
    plannedMins += task._duration;
  }

  // ── Render plain text (matches the frontend's whiteSpace: pre-wrap renderer) ──
  const overdueTasks = scored.filter(t => t._overdue);
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

  // Overdue callout up top.
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
    if (block.isBreak) {
      lines.push(`\n☕  ${formatTime(block.start)} – ${formatTime(block.end)}   Break`);
      continue;
    }
    if (block.overflow) continue; // overflow summarised below

    const { task, start, end } = block;
    const dueStr  = task.dueDate
      ? `${formatDate(task.dueDate)}${task.dueTime ? ' at ' + task.dueTime : ''}`
      : 'No due date';
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

  // Overflow summary — tasks that didn't fit the remaining window.
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
// SECTION 4 — GEMINI CONTEXT BUILDER
// Converts the task array into a rich, unambiguous string for the prompt.
// ─────────────────────────────────────────────────────────────────────────────
function buildTasksContext(tasks, now = new Date()) {
  if (!tasks || tasks.length === 0) {
    return '\n\nNo tasks available. Provide general scheduling advice only.';
  }

  const pending   = tasks.filter(t => !isCompleted(t));
  const completed = tasks.filter(t =>  isCompleted(t));

  const formatTask = (task, idx) => {
    const deadline = combineDueDateAndTime(task.dueDate, task.dueTime);
    const deadlineStr = deadline
      ? deadline.toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true,
        })
      : 'No deadline';

    const overdueStr = isOverdue(task, now) ? '  [OVERDUE]' : '';

    const rows = [
      `${idx + 1}. "${task.title}"${overdueStr}`,
      `   Priority:  ${task.priority || 'medium'}`,
      `   Deadline:  ${deadlineStr}`,
      `   Category:  ${task.category || 'General'}`,
    ];

    if (task.estimatedTime) {
      rows.push(`   Est. time: ${task.estimatedTime} (≈${parseEstimatedTime(task.estimatedTime)} min)`);
    }
    if (task.tags?.length) {
      rows.push(`   Tags:      ${task.tags.join(', ')}`);
    }
    if (task.description) {
      rows.push(`   Notes:     ${task.description.substring(0, 150)}`);
    }

    return rows.join('\n');
  };

  let ctx = `\n\n── PENDING TASKS (${pending.length}) — these are the ONLY tasks you may schedule ──\n`;
  if (pending.length > 0) {
    ctx += pending.map((t, i) => formatTask(t, i)).join('\n\n');
  } else {
    ctx += 'None. All tasks are completed — do not invent or reschedule anything.';
  }

  if (completed.length > 0) {
    ctx += `\n\n── ALREADY COMPLETED (${completed.length}) — DO NOT SCHEDULE OR MENTION THESE AS TODO ──\n`;
    ctx += completed
      .map(t => `✓ ${t.title} [DONE]` + (t.completedAt ? ` (done at ${new Date(t.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})` : ''))
      .join('\n');
    ctx += `\nThe ${completed.length} task(s) above are finished. They must NOT appear in the schedule.`;
  }

  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — GEMINI PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
function buildGeminiPrompt(userPrompt, tasksContext, now = new Date()) {
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  // Give Gemini the same time-window awareness the fallback uses.
  const win = getScheduleWindow(now);
  const windowDay = win.rolledToTomorrow ? 'tomorrow' : 'today';
  const windowStr =
    `${formatTime(win.start)}–${formatTime(win.end)} ${windowDay} ` +
    `(~${formatDuration(win.availableMins)} of free working time left)`;

  return `You are ChronoSync's AI scheduling assistant.
Today is ${dateStr}. Current time: ${timeStr}.
Available working window: ${windowStr}.
Standard work hours are ${WORKDAY_START_HOUR}:00–${WORKDAY_END_HOUR}:00.

USER REQUEST:
${userPrompt}
${tasksContext}

STRICT RULES — follow all of them, no exceptions:
1. SCHEDULE ONLY the tasks under "PENDING TASKS". These are the only valid tasks.
2. NEVER include, schedule, mention, or reference any task under "ALREADY COMPLETED".
   Those tasks are finished. If the user asks to reschedule, rebuild the schedule
   using the PENDING TASKS only — silently drop anything now completed.
3. Never invent tasks that are not in the PENDING TASKS list.
5. Overdue tasks (marked [OVERDUE]) must be addressed first and flagged clearly.
6. Schedule tasks INSIDE the available working window above. Start the first block
   at the current time (or the window start), not at an arbitrary hour.
7. Use each task's "Est. time" for block length. If none exists, default to 45 minutes.
8. Order tasks by priority and urgency (closest deadline / highest priority first).
9. Recommend a 10–15 minute break every 90 minutes of continuous work.
10. If tasks cannot all fit in the remaining window, schedule the most important ones
    and clearly list which tasks overflow to the next working block.
11. If the user's request is conversational (a question, not a schedule request),
    answer it concisely — do not generate a full schedule unless asked.
12. Do NOT use markdown: no ##, no **bold**, no _italic_, no backticks.
    This is a plain-text chat. Use numbered lists and plain dashes only.
13. Separate each schedule block or section with a blank line.
14. Keep the response under 450 words unless a full daily schedule genuinely needs more.
15. If no tasks exist, give practical general scheduling advice only.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — GEMINI CALL WITH RETRIES
// Tries Gemini up to GEMINI_MAX_ATTEMPTS times with exponential backoff + jitter.
// Only transient errors (rate limits, 5xx, timeouts, network) are retried;
// permanent errors (bad key, 400/401/403) fail fast straight to the fallback.
// Returns the validated text on success, or throws after exhausting retries.
// ─────────────────────────────────────────────────────────────────────────────

/** Extracts an HTTP-ish status code from a Gemini SDK error, if present. */
function extractStatus(err) {
  if (!err) return null;
  if (typeof err.status === 'number') return err.status;
  if (typeof err.statusCode === 'number') return err.statusCode;
  // The SDK often embeds the code in the message, e.g. "[429 Too Many Requests]".
  const m = String(err.message || '').match(/\[?(\d{3})\b/);
  return m ? parseInt(m[1], 10) : null;
}

/** Decides whether an error is worth retrying. */
function isRetryableError(err) {
  const status = extractStatus(err);
  if (status !== null) return RETRYABLE_STATUS.has(status);

  // No status — treat network/timeout/abort style errors as transient.
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('socket hang up') ||
    msg.includes('aborted') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable')
  );
}

/** Validates a Gemini text response; throws if it's empty or a refusal. */
function validateGeminiText(text) {
  const t = text?.trim();
  const isUsable =
    t &&
    t.length >= 30 &&
    !t.toLowerCase().startsWith("i'm sorry") &&
    !t.toLowerCase().startsWith("i am sorry") &&
    !t.toLowerCase().startsWith("i cannot") &&
    !t.toLowerCase().startsWith("i can't");

  if (!isUsable) {
    throw new Error(`Gemini response rejected: "${t?.substring(0, 60) ?? '(empty)'}"`);
  }
  return t;
}

/** Runs a single generateContent call with a hard timeout. */
async function generateOnce(model, fullPrompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const result = await model.generateContent(
      { contents: [{ role: 'user', parts: [{ text: fullPrompt }] }] },
      { signal: controller.signal },
    );
    const response = await result.response;
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs the retry loop for ONE model. Resolves to validated text or throws the
 * last error. Transient errors are retried with exponential backoff; refusals
 * and permanent errors break out early.
 */
async function callGeminiModel(genAI, modelName, fullPrompt) {
  const model = genAI.getGenerativeModel({ model: modelName });

  let lastErr;

  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    try {
      const text = await generateOnce(model, fullPrompt);
      return validateGeminiText(text);
    } catch (err) {
      lastErr = err;
      const retryable = isRetryableError(err);
      const hasMoreTries = attempt < GEMINI_MAX_ATTEMPTS;

      console.error(
        `[aiRoutes] ${modelName} attempt ${attempt}/${GEMINI_MAX_ATTEMPTS} failed ` +
        `(retryable=${retryable}): ${err.message}`
      );

      // A rejected/refusal response (validateGeminiText) is NOT worth retrying
      // on the same model — bail so we can try the next model / fallback.
      const isRejection = String(err.message || '').startsWith('Gemini response rejected');

      if (!retryable || isRejection || !hasMoreTries) break;

      // Exponential backoff with jitter, capped at GEMINI_MAX_DELAY_MS.
      const backoff = Math.min(
        GEMINI_BASE_DELAY_MS * 2 ** (attempt - 1),
        GEMINI_MAX_DELAY_MS,
      );
      const jitter = Math.floor(Math.random() * 250);
      const delay = backoff + jitter;
      console.warn(`[aiRoutes] Retrying ${modelName} in ${delay}ms…`);
      await sleep(delay);
    }
  }

  throw lastErr ?? new Error(`${modelName} failed for an unknown reason.`);
}

/**
 * Calls Gemini across the model fallback chain (GEMINI_MODELS), each with its
 * own retry loop. Returns { text, model } on success, or throws after every
 * model is exhausted so the caller can drop to the local fallback scheduler.
 *
 * Order of attempts (per request):
 *   gemini-2.5-flash      → up to GEMINI_MAX_ATTEMPTS tries
 *   gemini-2.5-flash-lite → up to GEMINI_MAX_ATTEMPTS tries   (only if flash fails)
 *   → throw → manual priority scheduler
 */
async function callGeminiWithRetry(apiKey, fullPrompt) {
  const genAI = new GoogleGenerativeAI(apiKey);

  let lastErr;

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const modelName = GEMINI_MODELS[i];
    try {
      const text = await callGeminiModel(genAI, modelName, fullPrompt);
      if (i > 0) {
        console.warn(`[aiRoutes] Recovered using backup model "${modelName}".`);
      }
      return { text, model: modelName };
    } catch (err) {
      lastErr = err;
      const status = extractStatus(err);

      // Auth/permission failures are identical across models — switching won't
      // help, so stop and go straight to the local fallback scheduler.
      if (status === 401 || status === 403) {
        console.error(`[aiRoutes] Auth error (${status}) — skipping remaining models.`);
        break;
      }

      const nextModel = GEMINI_MODELS[i + 1];
      if (nextModel) {
        console.warn(`[aiRoutes] "${modelName}" unavailable — falling back to "${nextModel}".`);
      } else {
        console.error(`[aiRoutes] All Gemini models exhausted — using local scheduler.`);
      }
    }
  }

  throw lastErr ?? new Error('All Gemini models failed.');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — ROUTE HANDLER
// Flow:
//   validate input
//   → try Gemini with up to GEMINI_MAX_ATTEMPTS attempts (if key present)
//       → return { response, source: 'gemini', attempts }
//   → on exhaustion / missing key / bad response, fall through to local scheduler
//       → return { response, source: 'fallback' }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/schedule', async (req, res) => {
  const { prompt, tasks } = req.body;

  // Basic validation.
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ message: 'Prompt is required.' });
  }

  // Normalise tasks — guard against undefined / non-array values from the client.
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const now = new Date();

  // ── Attempt Gemini (with retries) ──────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const tasksContext = buildTasksContext(safeTasks, now);
      const fullPrompt   = buildGeminiPrompt(prompt, tasksContext, now);

      const { text, model } = await callGeminiWithRetry(apiKey, fullPrompt);

      return res.json({
        response: text,
        source: 'gemini',           // frontend can badge "AI" vs "Fallback"
        model,                      // which model produced it (flash | flash-lite)
        tasksAnalyzed: safeTasks.length,
      });
    } catch (err) {
      // All retries exhausted (or permanent error). Log server-side only and
      // fall through to the deterministic local scheduler.
      console.error('[aiRoutes] Gemini unavailable after retries — using fallback:', err.message);
    }
  } else {
    console.warn('[aiRoutes] GEMINI_API_KEY not set — using fallback scheduler.');
  }

  // ── Fallback: local priority scheduler ─────────────────────────────────────
  // Reached only when: key missing | Gemini exhausts retries | response unusable.
  const fallbackText = buildFallbackSchedule(safeTasks, prompt.trim());

  return res.json({
    response: fallbackText,
    source: 'fallback',
    tasksAnalyzed: safeTasks.length,
  });
});

export default router;
