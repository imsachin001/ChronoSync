import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  dueTime: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  category: {
    type: String,
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  estimatedTime: {
    type: String,
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  user: {
    type: String,
    required: true
  },
  overdueNotificationSent: {
    type: Boolean,
    default: false
  },
  lastNotificationSent: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// ============================================
// SECTION 20 & 21: MongoDB INDEXES
// ============================================
// Indexes optimized for actual query patterns found in the codebase:

// Index 1: Get all tasks for user sorted by dueDate (most common query)
// Query: Task.find({ user: userId }).sort({ dueDate: 1 })
// Found in: taskRoutes.js:494 (GET all tasks)
taskSchema.index({ user: 1, dueDate: 1 });

// Index 2: Find overdue/upcoming tasks by user and date
// Query: Task.find({ user: userId, dueDate: { $lte: today } })
// Found in: notificationScheduler.js, statsManager.js, taskRoutes.js:251
taskSchema.index({ user: 1, dueDate: 1, completed: 1 });

// Index 3: Find completed tasks for user (analytics)
// Query: Task.find({ user: userId, completed: true, completedAt: {...} })
// Found in: analyticsManager.js:213
taskSchema.index({ user: 1, completed: 1, completedAt: 1 });

// Index 4: Find tasks by user and completion status (week-over-week queries)
// Query: Task.find({ user: userId, completed: boolean })
// Query: Task.countDocuments({ user: userId, completed: false, ... })
// Found in: taskRoutes.js:251, 361, 421
taskSchema.index({ user: 1, completed: 1, createdAt: -1 });

// Index 5: Single-field index on user (used in all queries)
// Query: Task.find({ user: userId, ... })
// Found in: multiple routes and utilities
taskSchema.index({ user: 1 });

const Task = mongoose.model('Task', taskSchema);

export default Task; 