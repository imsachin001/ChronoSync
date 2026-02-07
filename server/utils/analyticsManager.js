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
    console.log(`Updating streak for user ${userId}, task completed: ${wasCompleted}`);
    const streak = await getOrCreateCompletionStreak(userId);
    console.log('Current streak before update:', streak);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    if (wasCompleted) {
      // Task was completed
      const completionDate = new Date(task.completedAt);
      completionDate.setHours(0, 0, 0, 0); // Start of completion day
      
      console.log('Completion date:', completionDate);
      
      // Check if this date is already recorded
      const dateExists = streak.completedDates.some(date => {
        const existingDate = new Date(date);
        existingDate.setHours(0, 0, 0, 0);
        return existingDate.getTime() === completionDate.getTime();
      });
      
      console.log('Date already exists in streak:', dateExists);
      
      if (!dateExists) {
        streak.completedDates.push(completionDate);
        streak.lastCompletedDate = completionDate;
        
        // Calculate current streak
        const sortedDates = streak.completedDates
          .map(date => new Date(date))
          .sort((a, b) => b - a); // Sort descending (most recent first)
        
        console.log('Sorted dates:', sortedDates);
        
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
        console.log(`Updated completion streak: ${currentStreak} days (longest: ${streak.longestStreak})`);
        
        // Update streak badge
        const badgeResult = await updateStreakBadge(userId, currentStreak);
        return badgeResult.newlyEarnedBadge;
      } else {
        console.log('Date already recorded, no streak update needed');
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
    console.log('Getting streak data for user:', userId);
    const streak = await getOrCreateCompletionStreak(userId);
    console.log('Found streak record:', streak);
    
    // Get task completion counts per day for heatmap
    const completedTasks = await Task.find({
      user: userId,
      completed: true,
      completedAt: { $exists: true }
    }).select('completedAt');
    
    console.log(`Found ${completedTasks.length} completed tasks`);
    
    // Group tasks by date
    const dateMap = new Map();
    completedTasks.forEach(task => {
      const date = new Date(task.completedAt);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split('T')[0];
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
    });
    
    console.log('Date map entries:', dateMap.size);
    
    // Convert to array format
    const activityData = Array.from(dateMap.entries()).map(([date, count]) => ({
      date,
      count
    }));
    
    console.log('Activity data:', activityData);
    
    const result = {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      completedDates: streak.completedDates,
      activityData
    };
    
    console.log('Returning streak data:', result);
    return result;
  } catch (error) {
    console.error('Error getting completion streak data:', error);
    return { currentStreak: 0, longestStreak: 0, completedDates: [], activityData: [] };
  }
}; 