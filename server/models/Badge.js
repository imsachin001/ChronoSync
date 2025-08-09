import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true
  },
  taskCompletionBadge: {
    currentLevel: {
      type: Number,
      default: 0
    },
    currentProgress: {
      type: Number,
      default: 0
    },
    nextMilestone: {
      type: Number,
      default: 5
    },
    badgeName: {
      type: String,
      default: 'Task Initiate'
    },
    badgeEmoji: {
      type: String,
      default: '🐣'
    },
    earned: {
      type: Boolean,
      default: false
    }
  },
  streakBadge: {
    currentLevel: {
      type: Number,
      default: 0
    },
    currentProgress: {
      type: Number,
      default: 0
    },
    nextMilestone: {
      type: Number,
      default: 7
    },
    badgeName: {
      type: String,
      default: 'Focus Streak'
    },
    badgeEmoji: {
      type: String,
      default: '🔥'
    },
    earned: {
      type: Boolean,
      default: false
    }
  },
  totalTasksCompleted: {
    type: Number,
    default: 0
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  badgesEarned: [{
    name: String,
    emoji: String,
    level: Number,
    type: {
      type: String,
      enum: ['task', 'streak'],
      default: 'task'
    },
    earnedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Create index to ensure one record per user
badgeSchema.index({ user: 1 }, { unique: true });

// Badge milestones configuration
badgeSchema.statics.BADGE_MILESTONES = [
  { level: 1, milestone: 5, name: 'Task Initiate', emoji: '🐣' },
  { level: 2, milestone: 10, name: 'Getting Things Done', emoji: '📌' },
  { level: 3, milestone: 20, name: 'Workflow Warrior', emoji: '⚙️' },
  { level: 4, milestone: 50, name: 'Task Commander', emoji: '🚀' },
  { level: 5, milestone: 100, name: 'Task Master', emoji: '👑' },
  { level: 6, milestone: 250, name: 'Productivity Guru', emoji: '🧠' },
  { level: 7, milestone: 500, name: 'Legend of Discipline', emoji: '🏆' },
  { level: 8, milestone: 1000, name: 'Mythical Pull', emoji: '🌟' }
];

// Streak milestones configuration
badgeSchema.statics.STREAK_MILESTONES = [
  { level: 1, milestone: 7, name: 'Focus Streak', emoji: '🔥' },
  { level: 2, milestone: 30, name: 'Momentum Builder', emoji: '⚡' },
  { level: 3, milestone: 100, name: 'Discipline Monk', emoji: '🧠' },
  { level: 4, milestone: 200, name: 'Zen Master', emoji: '🐉' },
  { level: 5, milestone: 365, name: 'One-Year Warrior', emoji: '🌍' },
  { level: 6, milestone: 1000, name: 'Final Boss', emoji: '🏆' }
];

const Badge = mongoose.model('Badge', badgeSchema);

export default Badge; 