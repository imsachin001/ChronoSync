import mongoose from 'mongoose';

const completionStreakSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  longestStreak: {
    type: Number,
    default: 0
  },
  lastCompletedDate: {
    type: Date,
    default: null
  },
  completedDates: [{
    type: Date,
    required: true
  }]
}, {
  timestamps: true
});

//index to ensure one record per user
completionStreakSchema.index({ user: 1 }, { unique: true });

const CompletionStreak = mongoose.model('CompletionStreak', completionStreakSchema);

export default CompletionStreak; 