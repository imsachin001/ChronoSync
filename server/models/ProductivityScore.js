import mongoose from 'mongoose';

const productivityScoreSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true
  },
  weekStart: {
    type: Date,
    required: true
  },
  weekEnd: {
    type: Date,
    required: true
  },
  dailyScores: {
    Monday: {
      completed: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    Tuesday: {
      completed: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    Wednesday: {
      completed: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    Thursday: {
      completed: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    Friday: {
      completed: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    Saturday: {
      completed: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    Sunday: {
      completed: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    }
  }
}, {
  timestamps: true
});

// Create compound index to ensure one record per user per week
productivityScoreSchema.index({ user: 1, weekStart: 1 }, { unique: true });

const ProductivityScore = mongoose.model('ProductivityScore', productivityScoreSchema);

export default ProductivityScore; 