import { calculateTaskScore } from './scheduleScoring.js';

const now = new Date(2026, 0, 1, 12, 0, 0, 0);

function deadlineInDays(days) {
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}

describe('calculateTaskScore', () => {
  test('urgent task should rank higher', () => {
    const taskA = {
      importance: 10,
      dueDate: deadlineInDays(1),
      dueTime: '12:00',
    };
    const taskB = {
      importance: 3,
      dueDate: deadlineInDays(30),
      dueTime: '12:00',
    };

    expect(calculateTaskScore(taskA, now)).toBeGreaterThan(calculateTaskScore(taskB, now));
  });

  test.each([
    ['deadline tomorrow', { dueDate: deadlineInDays(1), dueTime: '12:00' }, 67],
    ['deadline next month', { dueDate: deadlineInDays(30), dueTime: '12:00' }, 14],
    ['past deadline', { dueDate: deadlineInDays(-1), dueTime: '12:00' }, 84],
    ['no deadline', {}, 14],
  ])('%s receives the expected deterministic score', (_, task, expectedScore) => {
    expect(calculateTaskScore(task, now)).toBe(expectedScore);
  });

  test.each([
    [1, 57],
    [10, 75],
  ])('importance %s receives the expected score', (importance, expectedScore) => {
    expect(calculateTaskScore({ importance, dueDate: deadlineInDays(1), dueTime: '12:00' }, now))
      .toBe(expectedScore);
  });
});