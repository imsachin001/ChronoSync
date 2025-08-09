import mongoose from 'mongoose';

const completionTimeSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  taskTitle: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    required: true
  },
  completedAt: {
    type: Date,
    required: true
  },
  completionTimeHours: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

// Create compound index to ensure one record per task
completionTimeSchema.index({ user: 1, taskId: 1 }, { unique: true });

const CompletionTime = mongoose.model('CompletionTime', completionTimeSchema);

export default CompletionTime; 