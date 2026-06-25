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

  if (dueTime && typeof dueTime === 'string') {
    // Support both "14:30" and "2:30 PM"
    const t24 = dueTime.match(/^(\d{1,2}):(\d{2})$/);
    const t12 = dueTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

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
 * Returns a numeric urgency score for a task using its combined due datetime.
 */
function getUrgencyScore(dueDate, dueTime) {
  const deadline = combineDueDateAndTime(dueDate, dueTime);
  if (!deadline) return URGENCY_SCORE.later;

  const now      = new Date();
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

/** Maps priority string to an emoji label for fallback output. */
function priorityLabel(p) {
  if (!p) return '🟡 Medium';
  const map = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
  return map[p.toLowerCase()] ?? '🟡 Medium';
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — FALLBACK PRIORITY SCHEDULER
// Only runs when Gemini is unavailable or returns a bad response.
//
// Algorithm — Weighted Priority + Urgency:
//   score = PRIORITY_SCORE[priority] + URGENCY_SCORE[urgencyBracket]
//   Sort tasks descending by score; ties broken by earliest combined deadline.
//   Assign sequential time blocks from WORKDAY_START_HOUR.
//   Inject a break every BREAK_THRESHOLD_MINS of continuous work.
//   Tasks that don't fit in the workday are flagged as overflow.
// ─────────────────────────────────────────────────────────────────────────────
function buildFallbackSchedule(tasks, prompt) {
  // Only schedule pending tasks.
  const pending = (tasks || []).filter(t => !t.completed);

  if (pending.length === 0) {
    return (
      `📋 Priority Scheduler  ·  AI unavailable\n\n` +
      `You have no pending tasks right now — great work! ` +
      `Add tasks and I'll build a priority schedule for you.`
    );
  }

  // Score and enrich each task.
  const scored = pending.map(task => ({
    ...task,
    _score:    (PRIORITY_SCORE[task.priority?.toLowerCase()] ?? PRIORITY_SCORE.medium)
             + getUrgencyScore(task.dueDate, task.dueTime),
    _duration: parseEstimatedTime(task.estimatedTime),   // uses real schema field
    _deadline: combineDueDateAndTime(task.dueDate, task.dueTime),
  }));

  // Sort: highest score first → then earliest deadline.
  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    if (!a._deadline && !b._deadline) return 0;
    if (!a._deadline) return 1;
    if (!b._deadline) return -1;
    return a._deadline - b._deadline;
  });

  // Build time blocks from start of workday.
  const today = new Date();
  let cursor = new Date(today);
  cursor.setHours(WORKDAY_START_HOUR, 0, 0, 0);

  const workdayEnd = new Date(today);
  workdayEnd.setHours(WORKDAY_END_HOUR, 0, 0, 0);

  let workedMins = 0;
  const blocks   = [];

  for (const task of scored) {
    if (cursor >= workdayEnd) {
      blocks.push({ overflow: true, task });
      continue;
    }

    // Insert a break before the next task if threshold crossed.
    if (workedMins >= BREAK_THRESHOLD_MINS && blocks.length > 0) {
      const breakEnd = addMinutes(cursor, BREAK_DURATION_MINS);
      blocks.push({ isBreak: true, start: new Date(cursor), end: breakEnd });
      cursor    = breakEnd;
      workedMins = 0;
    }

    const end = addMinutes(cursor, task._duration);
    blocks.push({ task, start: new Date(cursor), end, overflow: false });
    cursor     = end;
    workedMins += task._duration;
  }

  // Render plain text (matches the frontend's whiteSpace: pre-wrap renderer).
  const lines = [
    `📋 Priority Schedule  ·  AI unavailable — using built-in scheduler`,
    `Request: "${prompt}"`,
    `Date: ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
    `─────────────────────────────────────────`,
  ];

  let slot = 1;
  for (const block of blocks) {
    if (block.isBreak) {
      lines.push(`\n☕  ${formatTime(block.start)} – ${formatTime(block.end)}   Break`);
      continue;
    }
    if (block.overflow) {
      lines.push(
        `\n⚠️  "${block.task.title}" couldn't fit today's workday.` +
        `\n   Consider moving it to tomorrow or reducing other task durations.`
      );
      continue;
    }

    const { task, start, end } = block;
    const dueStr  = task.dueDate
      ? `${formatDate(task.dueDate)}${task.dueTime ? ' at ' + task.dueTime : ''}`
      : 'No due date';
    const tagStr  = task.tags?.length ? `  #${task.tags.join(' #')}` : '';
    const catStr  = task.category ? `[${task.category}]` : '';

    lines.push(
      `\n${slot}. ${formatTime(start)} – ${formatTime(end)}` +
      `\n   ${task.title}  ${catStr}${tagStr}` +
      `\n   ${priorityLabel(task.priority)}  ·  Due: ${dueStr}` +
      (task.description ? `\n   Note: ${task.description.substring(0, 100)}` : '')
    );
    slot++;
  }

  lines.push(`\n─────────────────────────────────────────`);
  lines.push(
    `\n💡 Tip: Tasks ordered by priority + urgency score. ` +
    `Set "estimatedTime" on your tasks (e.g. "45 min") for accurate time blocks.`
  );

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — GEMINI CONTEXT BUILDER
// Converts the task array into a rich, unambiguous string for the prompt.
// The more precise the context, the fewer hallucinations Gemini produces.
// ─────────────────────────────────────────────────────────────────────────────
function buildTasksContext(tasks) {
  if (!tasks || tasks.length === 0) {
    return '\n\nNo tasks available. Provide general scheduling advice only.';
  }

  const pending   = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t =>  t.completed);

  const formatTask = (task, idx) => {
    // Combine dueDate + dueTime into one readable string so Gemini
    // doesn't have to infer or guess the deadline.
    const deadline = combineDueDateAndTime(task.dueDate, task.dueTime);
    const deadlineStr = deadline
      ? deadline.toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true,
        })
      : 'No deadline';

    const rows = [
      `${idx + 1}. "${task.title}"`,
      `   Priority:  ${task.priority || 'medium'}`,
      `   Deadline:  ${deadlineStr}`,
      `   Category:  ${task.category || 'General'}`,
    ];

    if (task.estimatedTime) {
      // Pass the raw string AND the parsed minutes so Gemini has both.
      rows.push(`   Est. time: ${task.estimatedTime} (≈${parseEstimatedTime(task.estimatedTime)} min)`);
    }
    if (task.tags?.length) {
      rows.push(`   Tags:      ${task.tags.join(', ')}`);
    }
    if (task.description) {
      // Truncate to prevent prompt bloat.
      rows.push(`   Notes:     ${task.description.substring(0, 150)}`);
    }

    return rows.join('\n');
  };

  let ctx = '\n\n── PENDING TASKS ──\n';
  if (pending.length > 0) {
    ctx += pending.map((t, i) => formatTask(t, i)).join('\n\n');
  } else {
    ctx += 'None.';
  }

  if (completed.length > 0) {
    ctx += `\n\n── COMPLETED TODAY (${completed.length}) ──\n`;
    ctx += completed
      .map(t => `✓ ${t.title}` + (t.completedAt ? ` (done at ${new Date(t.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})` : ''))
      .join('\n');
  }

  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — GEMINI PROMPT BUILDER
// Explicit, opinionated instructions to minimise hallucination:
//   - Gemini is told exactly what fields exist (so it can't invent others).
//   - Markdown is forbidden (the frontend renders plain text).
//   - Hard rule: never mention tasks not in the list.
// ─────────────────────────────────────────────────────────────────────────────
function buildGeminiPrompt(userPrompt, tasksContext) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  return `You are ChronoSync's AI scheduling assistant.
Today is ${dateStr}. Current time: ${timeStr}.

USER REQUEST:
${userPrompt}
${tasksContext}

STRICT RULES — follow all of them, no exceptions:
1. Only reference tasks from the PENDING TASKS list above. Never invent tasks.
2. Never schedule or suggest working on completed tasks.
3. Overdue tasks (deadline already past) must be addressed first and flagged clearly.
4. When building a schedule, use the task's "Est. time" for block length.
   If no estimate exists, default to 45 minutes per task.
5. Recommend a 10–15 minute break every 90 minutes of continuous work.
6. If the user's request is conversational (a question, not a schedule request),
   answer it concisely — do not generate a full schedule unless asked.
7. Do NOT use markdown: no ##, no **bold**, no _italic_, no backticks.
   This is a plain-text chat. Use numbered lists and plain dashes only.
8. Separate each schedule block or section with a blank line.
9. Keep the response under 450 words unless a full daily schedule genuinely needs more.
10. If no tasks exist, give practical general scheduling advice only.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — ROUTE HANDLER
// Flow:
//   validate input
//   → try Gemini (if key present)
//       → sanity-check response (non-empty, no refusal)
//       → return { response, source: 'gemini' }
//   → on any failure, fall through to local scheduler
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

  // ── Attempt Gemini ──────────────────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      // Initialise inside the try block so a bad key doesn't crash the module.
      const genAI  = new GoogleGenerativeAI(apiKey);
      const model  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const tasksContext = buildTasksContext(safeTasks);
      const fullPrompt   = buildGeminiPrompt(prompt, tasksContext);

      const result   = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text     = response.text()?.trim();

      // Sanity-check: reject empty or refusal-style responses.
      // Gemini sometimes returns "I can't help with that." on scheduling prompts
      // due to safety filters — we catch that here and fall through to fallback.
      const isUsable =
        text &&
        text.length >= 30 &&
        !text.toLowerCase().startsWith("i'm sorry") &&
        !text.toLowerCase().startsWith("i cannot") &&
        !text.toLowerCase().startsWith("i can't");

      if (!isUsable) {
        throw new Error(`Gemini response rejected: "${text?.substring(0, 60)}"`);
      }

      return res.json({
        response: text,
        source: 'gemini',            // frontend can optionally badge "AI" vs "Fallback"
        tasksAnalyzed: safeTasks.length,
      });

    } catch (err) {
      // Don't expose Gemini's internal error to the user.
      // Log it server-side only, then fall through to local scheduler.
      console.error('[aiRoutes] Gemini error — falling back to priority scheduler:', err.message);
    }
  } else {
    console.warn('[aiRoutes] GEMINI_API_KEY not set — using fallback scheduler.');
  }

  // ── Fallback: local priority scheduler ─────────────────────────────────────
  // Reached only when: key missing | Gemini throws | response unusable.
  const fallbackText = buildFallbackSchedule(safeTasks, prompt.trim());

  return res.json({
    response: fallbackText,
    source: 'fallback',
    tasksAnalyzed: safeTasks.length,
  });
});

export default router;