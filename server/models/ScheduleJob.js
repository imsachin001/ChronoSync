import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// models/ScheduleJob.js
//
// Stores the result (or error) of every schedule job so the API can serve
// polling requests from the frontend without keeping a long-lived HTTP
// connection open.
//
// Lifecycle of a document:
//   1. Created with status "pending" when the API enqueues the BullMQ job.
//   2. Updated to "processing" when the worker picks it up.
//   3. Updated to "completed" (with `response`) or "failed" (with `errorMessage`)
//      when the worker finishes.
//
// TTL index: documents are automatically deleted after 1 hour so old results
// don't accumulate in the collection.
// ─────────────────────────────────────────────────────────────────────────────

const scheduleJobSchema = new mongoose.Schema(
  {
    // The BullMQ job ID — used as the lookup key for the polling endpoint.
    bullJobId: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
    },

    // The Clerk userId so the API can authorise GET requests.
    userId: {
      type:     String,
      required: true,
      index:    true,
    },

    // The original user prompt (stored for context / debugging).
    prompt: {
      type: String,
    },

    // Job lifecycle status.
    status: {
      type:    String,
      enum:    ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },

    // Populated when status === 'completed'.
    response: {
      type: String,
    },

    // Which AI model produced the response ('gemini' | 'fallback').
    source: {
      type: String,
    },

    // Specific model name, e.g. 'gemini-2.5-flash'.
    model: {
      type: String,
    },

    // Populated when status === 'failed'.
    errorMessage: {
      type: String,
    },

    // Auto-expire after 1 hour (3600 seconds).
    // MongoDB TTL index fires approximately once per minute.
    expiresAt: {
      type:    Date,
      default: () => new Date(Date.now() + 60 * 60 * 1000),
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// TTL index — MongoDB automatically removes documents after `expiresAt`.
scheduleJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ScheduleJob = mongoose.model('ScheduleJob', scheduleJobSchema);

export default ScheduleJob;
