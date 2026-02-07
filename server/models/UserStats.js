import mongoose from 'mongoose';

const userStatsSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    unique: true
  },
  totalTasksAssigned: {
    type: Number,
    default: 0
  },
  totalTasksCompleted: {
    type: Number,
    default: 0
  },
  totalTasksOverdue: {
    type: Number,
    default: 0
  },
  // statistics for more detailed analytics
  dailyStats: [{
    date: {
      type: Date,
      required: true
    },
    tasksAssigned: {
      type: Number,
      default: 0
    },
    tasksCompleted: {
      type: Number,
      default: 0
    },
    tasksOverdue: {
      type: Number,
      default: 0
    },
    categoryStats: {
      type: Map,
      of: Number,
      default: {}
    }
  }],
  categoryCompletions: {
    type: Map,
    of: Number,
    default: {}
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// index for efficient queries
userStatsSchema.index({ user: 1 });
userStatsSchema.index({ 'dailyStats.date': 1 });

const UserStats = mongoose.model('UserStats', userStatsSchema);

export default UserStats; 