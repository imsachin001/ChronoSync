const PRIORITY_IMPORTANCE = {
  high: 100,
  medium: 60,
  low: 20,
};

const URGENCY_SCORE = {
  overdue: 100,
  today: 80,
  tomorrow: 60,
  week: 35,
  later: 0,
};

const DEFAULT_DURATION_MINS = 45;
const MINUTES_PER_DAY = 24 * 60;

function parseEstimatedTime(raw) {
  if (!raw || typeof raw !== 'string') return DEFAULT_DURATION_MINS;

  const value = raw.trim().toLowerCase();
  const hoursAndMinutes = value.match(/(\d+(?:\.\d+)?)\s*h(?:r|ours?)?\s*(\d+)?\s*m?/);
  if (hoursAndMinutes) {
    const total = Math.round(
      (parseFloat(hoursAndMinutes[1]) || 0) * 60 +
      (parseInt(hoursAndMinutes[2], 10) || 0),
    );
    return total > 0 ? total : DEFAULT_DURATION_MINS;
  }

  const minutes = value.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:utes?)?)?/);
  if (minutes) return Math.max(1, Math.round(parseFloat(minutes[1])));

  const hours = value.match(/(\d+(?:\.\d+)?)\s*h(?:ours?|r)?/);
  if (hours) return Math.max(1, Math.round(parseFloat(hours[1]) * 60));

  const bare = value.match(/^(\d+)$/);
  return bare ? Math.max(1, parseInt(bare[1], 10)) : DEFAULT_DURATION_MINS;
}

function combineDueDateAndTime(dueDate, dueTime) {
  if (!dueDate) return null;

  const deadline = new Date(dueDate);
  if (Number.isNaN(deadline.getTime())) return null;

  if (typeof dueTime === 'string') {
    const match24Hour = dueTime.trim().match(/^(\d{1,2}):(\d{2})$/);
    const match12Hour = dueTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

    if (match24Hour) {
      deadline.setHours(parseInt(match24Hour[1], 10), parseInt(match24Hour[2], 10), 0, 0);
    } else if (match12Hour) {
      let hours = parseInt(match12Hour[1], 10);
      const minutes = parseInt(match12Hour[2], 10);
      const meridian = match12Hour[3].toUpperCase();
      if (meridian === 'PM' && hours !== 12) hours += 12;
      if (meridian === 'AM' && hours === 12) hours = 0;
      deadline.setHours(hours, minutes, 0, 0);
    }
  }

  return deadline;
}

function getUrgencyBracket(deadline, now) {
  if (!deadline) return 'later';

  const differenceInMinutes = (deadline.getTime() - now.getTime()) / (1000 * 60);
  if (differenceInMinutes < 0) return 'overdue';
  if (differenceInMinutes < MINUTES_PER_DAY) return 'today';
  if (differenceInMinutes < MINUTES_PER_DAY * 2) return 'tomorrow';
  if (differenceInMinutes < MINUTES_PER_DAY * 7) return 'week';
  return 'later';
}

function calculateDeadlineScore(deadline, now) {
  if (!deadline) return 0;

  const daysUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilDeadline <= 0) return 100;
  return Math.max(0, Math.round(100 - (daysUntilDeadline / 30) * 100));
}

function calculateTaskScore(task, now = new Date()) {
  const deadline = combineDueDateAndTime(task?.dueDate, task?.dueTime);
  const urgency = URGENCY_SCORE[getUrgencyBracket(deadline, now)];
  const deadlineScore = calculateDeadlineScore(deadline, now);
  const importance = PRIORITY_IMPORTANCE[String(task?.priority || 'medium').toLowerCase()] ?? 60;
  const effort = Math.min(100, Math.round((parseEstimatedTime(task?.estimatedTime) / 240) * 100));

  return Math.round(
    0.40 * urgency +
    0.30 * deadlineScore +
    0.20 * importance +
    0.10 * effort,
  );
}

function scoreTask(task, now = new Date()) {
  const deadline = combineDueDateAndTime(task?.dueDate, task?.dueTime);
  return {
    ...task,
    _score: calculateTaskScore(task, now),
    _duration: parseEstimatedTime(task?.estimatedTime),
    _deadline: deadline,
    _overdue: getUrgencyBracket(deadline, now) === 'overdue',
  };
}

function compareScoredTasks(first, second) {
  if (first._overdue !== second._overdue) return first._overdue ? -1 : 1;
  if (second._score !== first._score) return second._score - first._score;
  if (!first._deadline && second._deadline) return 1;
  if (first._deadline && !second._deadline) return -1;
  if (first._deadline && second._deadline && first._deadline.getTime() !== second._deadline.getTime()) {
    return first._deadline.getTime() - second._deadline.getTime();
  }
  return String(first._id || first.id || first.title || '').localeCompare(
    String(second._id || second.id || second.title || ''),
  );
}

export {
  calculateTaskScore,
  compareScoredTasks,
  combineDueDateAndTime,
  parseEstimatedTime,
  scoreTask,
};
