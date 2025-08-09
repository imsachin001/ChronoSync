import Task from '../models/Task.js';
import CompletionStreak from '../models/CompletionStreak.js';
import CompletionTime from '../models/CompletionTime.js';
import { updateStreakBadge } from './badgeManager.js';

// Get or create completion streak record for user
export const getOrCreateCompletionStreak = async (userId) => {
  let streak = await CompletionStreak.findOne({ user: userId });
  
  if (!streak) {
    streak = new CompletionStreak({
      user: userId,
      currentStreak: 0,
      longestStreak: 0,
      lastCompletedDate: null,
      completedDates: []
    });
    await streak.save();
  }
  
  return streak;
};

// Update completion streak when a task is completed
export const updateCompletionStreak = async (userId, task, wasCompleted) => {
  try {
    const streak = await getOrCreateCompletionStreak(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    if (wasCompleted) {
      // Task was completed
      const completionDate = new Date(task.completedAt);
      completionDate.setHours(0, 0, 0, 0); // Start of completion day
      
      // Check if this date is already recorded
      const dateExists = streak.completedDates.some(date => {
        const existingDate = new Date(date);
        existingDate.setHours(0, 0, 0, 0);
        return existingDate.getTime() === completionDate.getTime();
      });
      
      if (!dateExists) {
        streak.completedDates.push(completionDate);
        streak.lastCompletedDate = completionDate;
        
        // Calculate current streak
        const sortedDates = streak.completedDates
          .map(date => new Date(date))
          .sort((a, b) => b - a); // Sort descending (most recent first)
        
        let currentStreak = 0;
        let checkDate = today;
        
        for (let i = 0; i < sortedDates.length; i++) {
          const completedDate = new Date(sortedDates[i]);
          completedDate.setHours(0, 0, 0, 0);
          
          const diffTime = checkDate.getTime() - completedDate.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 1) {
            currentStreak++;
            checkDate = completedDate;
          } else {
            break;
          }
        }
        
        streak.currentStreak = currentStreak;
        streak.longestStreak = Math.max(streak.longestStreak, currentStreak);
        
        await streak.save();
        console.log(`Updated completion streak: ${currentStreak} days`);
        
        // Update streak badge
        const badgeResult = await updateStreakBadge(userId, currentStreak);
        return badgeResult.newlyEarnedBadge;
      }
    } else {
      // Task was uncompleted - we don't remove from streak as it's historical data
      console.log('Task uncompleted - streak remains unchanged');
      return null;
    }
  } catch (error) {
    console.error('Error updating completion streak:', error);
    return null;
  }
};

// Store completion time when a task is completed
export const storeCompletionTime = async (userId, task) => {
  try {
    const createdTime = new Date(task.createdAt);
    const completedTime = new Date(task.completedAt);
    
    // Calculate time difference in hours
    const timeDiff = completedTime.getTime() - createdTime.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    // Only store if completion time is after creation time
    if (hoursDiff > 0) {
      // Check if completion time already exists for this task
      const existingRecord = await CompletionTime.findOne({
        user: userId,
        taskId: task._id
      });
      
      if (!existingRecord) {
        const completionTimeRecord = new CompletionTime({
          user: userId,
          taskId: task._id,
          taskTitle: task.title,
          createdAt: createdTime,
          completedAt: completedTime,
          completionTimeHours: hoursDiff
        });
        
        await completionTimeRecord.save();
        console.log(`Stored completion time for task "${task.title}": ${hoursDiff.toFixed(1)} hours`);
      }
    }
  } catch (error) {
    console.error('Error storing completion time:', error);
  }
};

// Calculate average task completion time from stored data
export const calculateAverageCompletionTime = async (userId) => {
  try {
    // Get all stored completion times
    const completionTimes = await CompletionTime.find({ user: userId });
    
    if (completionTimes.length === 0) {
      return 0; // No completion times stored
    }
    
    let totalCompletionTime = 0;
    
    completionTimes.forEach(record => {
      totalCompletionTime += record.completionTimeHours;
    });
    
    const averageHours = totalCompletionTime / completionTimes.length;
    return Math.round(averageHours * 10) / 10; // Round to 1 decimal place
  } catch (error) {
    console.error('Error calculating average completion time:', error);
    return 0;
  }
};

// Get completion streak data
export const getCompletionStreakData = async (userId) => {
  try {
    const streak = await getOrCreateCompletionStreak(userId);
    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak
    };
  } catch (error) {
    console.error('Error getting completion streak data:', error);
    return { currentStreak: 0, longestStreak: 0 };
  }
}; 