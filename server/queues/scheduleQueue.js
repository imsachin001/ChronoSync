// ─────────────────────────────────────────────────────────────────────────────
// queues/scheduleQueue.js
//
// Defines (and exports) the single BullMQ Queue used by both the API layer
// (to enqueue jobs) and the worker (to process them).
//
// Keeping the Queue definition in one shared module avoids creating multiple
// Queue instances that would compete over the same Redis connection.
// ─────────────────────────────────────────────────────────────────────────────

import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export const SCHEDULE_QUEUE_NAME = 'schedule';

// A single Queue instance — the API calls queue.add(); the worker calls
// new Worker(SCHEDULE_QUEUE_NAME, ...) with the same connection config.
export const scheduleQueue = new Queue(SCHEDULE_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    // Keep the last 100 completed and 50 failed jobs for debugging.
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 50  },

    // Attempt each job up to 3 times with exponential back-off before giving up.
    attempts: 3,
    backoff: {
      type:  'exponential',
      delay: 1000, // 1 s → 2 s → 4 s
    },
  },
});

export default scheduleQueue;
