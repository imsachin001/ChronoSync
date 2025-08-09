import UserStats from '../models/UserStats.js';

// Get or create user stats
export const getUserStats = async (userId) => {
  let userStats = await UserStats.findOne({ user: userId });
  
  if (!userStats) {
    userStats = new UserStats({
      user: userId,
      totalTasksAssigned: 0,
      totalTasksCompleted: 0,
      totalTasksOverdue: 0,
      dailyStats: [],
      categoryCompletions: new Map() // Initialize categoryCompletions
    });
    await userStats.save();
  }
  
  return userStats;
};

// Update stats when a task is created
export const updateStatsOnTaskCreate = async (userId, task) => {
  try {
    const userStats = await getUserStats(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Update total assigned
    userStats.totalTasksAssigned += 1;
    
    // Update daily stats
    let dailyStat = userStats.dailyStats.find(stat => 
      stat.date.getTime() === today.getTime()
    );
    
    if (!dailyStat) {
      dailyStat = {
        date: today,
        tasksAssigned: 0,
        tasksCompleted: 0,
        tasksOverdue: 0,
        categoryStats: new Map()
      };
      userStats.dailyStats.push(dailyStat);
    }
    
    dailyStat.tasksAssigned += 1;
    
    // Track category in daily stats
    if (task.category) {
      const currentCount = dailyStat.categoryStats.get(task.category) || 0;
      dailyStat.categoryStats.set(task.category, currentCount + 1);
    }
    
    userStats.lastUpdated = new Date();
    
    await userStats.save();
    console.log(`Updated stats for user ${userId}: task created`);
  } catch (error) {
    console.error('Error updating stats on task create:', error);
  }
};

// Update stats when a task is completed
export const updateStatsOnTaskComplete = async (userId, task, wasCompleted) => {
  try {
    const userStats = await getUserStats(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const category = task.category;

    if (wasCompleted) {
      // Task was completed
      userStats.totalTasksCompleted += 1;

      // Update daily stats
      let dailyStat = userStats.dailyStats.find(stat => 
        stat.date.getTime() === today.getTime()
      );

      if (!dailyStat) {
        dailyStat = {
          date: today,
          tasksAssigned: 0,
          tasksCompleted: 0,
          tasksOverdue: 0
        };
        userStats.dailyStats.push(dailyStat);
      }

      dailyStat.tasksCompleted += 1;

      // Increment category completion count
      if (category) {
        const prev = userStats.categoryCompletions.get(category) || 0;
        userStats.categoryCompletions.set(category, prev + 1);
      }
    } else {
      // Task was uncompleted
      userStats.totalTasksCompleted = Math.max(0, userStats.totalTasksCompleted - 1);

      // Update daily stats for current day tracking
      let dailyStat = userStats.dailyStats.find(stat => 
        stat.date.getTime() === today.getTime()
      );

      if (dailyStat) {
        dailyStat.tasksCompleted = Math.max(0, dailyStat.tasksCompleted - 1);
      }

      // Decrement category completion count
      if (category) {
        const prev = userStats.categoryCompletions.get(category) || 0;
        userStats.categoryCompletions.set(category, Math.max(0, prev - 1));
      }
    }

    userStats.lastUpdated = new Date();
    await userStats.save();
    console.log(`Updated stats for user ${userId}: task ${wasCompleted ? 'completed' : 'uncompleted'}`);
  } catch (error) {
    console.error('Error updating stats on task complete:', error);
  }
};

// Update stats when a task is deleted
export const updateStatsOnTaskDelete = async (userId, task) => {
  try {
    const userStats = await getUserStats(userId);
    
    // For cumulative stats, we DON'T decrease assigned or completed counts
    // These should remain as total historical counts
    // Only overdue count needs to be recalculated based on current tasks
    
    // Update overdue count based on current active tasks
    await updateOverdueStats(userId);
    
    userStats.lastUpdated = new Date();
    await userStats.save();
    console.log(`Updated stats for user ${userId}: task deleted (cumulative counts preserved)`);
  } catch (error) {
    console.error('Error updating stats on task delete:', error);
  }
};

// Calculate current overdue tasks and update stats
export const updateOverdueStats = async (userId) => {
  try {
    const Task = (await import('../models/Task.js')).default;
    const now = new Date();
    
    // Get all active (non-deleted) overdue tasks
    const overdueTasks = await Task.find({
      user: userId,
      completed: false,
      dueDate: { $lt: now }
    });
    
    const userStats = await getUserStats(userId);
    userStats.totalTasksOverdue = overdueTasks.length;
    userStats.lastUpdated = new Date();
    
    await userStats.save();
    console.log(`Updated overdue stats for user ${userId}: ${overdueTasks.length} overdue tasks`);
  } catch (error) {
    console.error('Error updating overdue stats:', error);
  }
};

// Get comprehensive stats for analytics
export const getComprehensiveStats = async (userId) => {
  try {
    const userStats = await getUserStats(userId);
    
    // Update overdue count based on current tasks
    await updateOverdueStats(userId);
    
    // Get fresh stats after overdue update
    const updatedStats = await UserStats.findOne({ user: userId });
    
    return {
      assigned: updatedStats.totalTasksAssigned,
      completed: updatedStats.totalTasksCompleted,
      overdue: updatedStats.totalTasksOverdue
    };
  } catch (error) {
    console.error('Error getting comprehensive stats:', error);
    return {
      assigned: 0,
      completed: 0,
      overdue: 0
    };
  }
}; 