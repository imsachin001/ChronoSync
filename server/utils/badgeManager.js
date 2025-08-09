import Badge from '../models/Badge.js';

// Get or create badge record for user
export const getOrCreateBadge = async (userId) => {
  let badge = await Badge.findOne({ user: userId });
  
  if (!badge) {
    badge = new Badge({
      user: userId,
      taskCompletionBadge: {
        currentLevel: 0,
        currentProgress: 0,
        nextMilestone: 5,
        badgeName: 'Task Initiate',
        badgeEmoji: '🐣',
        earned: false
      },
      streakBadge: {
        currentLevel: 0,
        currentProgress: 0,
        nextMilestone: 7,
        badgeName: 'Focus Streak',
        badgeEmoji: '🔥',
        earned: false
      },
      totalTasksCompleted: 0,
      currentStreak: 0,
      badgesEarned: []
    });
    await badge.save();
  }
  
  return badge;
};

// Update badge progress when a task is completed
export const updateBadgeOnTaskComplete = async (userId, wasCompleted) => {
  try {
    const badge = await getOrCreateBadge(userId);
    let newlyEarnedBadge = null;
    
    if (wasCompleted) {
      // Task was completed
      badge.totalTasksCompleted += 1;
      badge.taskCompletionBadge.currentProgress += 1;
    } else {
      // Task was uncompleted
      badge.totalTasksCompleted = Math.max(0, badge.totalTasksCompleted - 1);
      badge.taskCompletionBadge.currentProgress = Math.max(0, badge.taskCompletionBadge.currentProgress - 1);
    }
    
    // Check if task completion milestone is reached
    const taskMilestones = Badge.BADGE_MILESTONES;
    
    // Find the highest milestone the user has actually reached
    const highestReachedTaskMilestone = taskMilestones
      .filter(m => m.milestone <= badge.totalTasksCompleted)
      .sort((a, b) => b.level - a.level)[0];
    
    if (highestReachedTaskMilestone) {
      // Check if we need to award a new badge
      if (highestReachedTaskMilestone.level > badge.taskCompletionBadge.currentLevel) {
        // Award the new badge
        badge.taskCompletionBadge.earned = true;
        badge.taskCompletionBadge.currentLevel = highestReachedTaskMilestone.level;
        badge.taskCompletionBadge.badgeName = highestReachedTaskMilestone.name;
        badge.taskCompletionBadge.badgeEmoji = highestReachedTaskMilestone.emoji;
        
        // Add to earned badges
        badge.badgesEarned.push({
          name: highestReachedTaskMilestone.name,
          emoji: highestReachedTaskMilestone.emoji,
          level: highestReachedTaskMilestone.level,
          type: 'task',
          earnedAt: new Date()
        });
        
        // Set newly earned badge for notification
        newlyEarnedBadge = {
          name: highestReachedTaskMilestone.name,
          emoji: highestReachedTaskMilestone.emoji,
          type: 'task'
        };
        
        console.log(`Task badge earned: ${highestReachedTaskMilestone.name} (${highestReachedTaskMilestone.emoji})`);
      }
      
      // Find next milestone
      const nextTaskMilestone = taskMilestones.find(m => m.level === highestReachedTaskMilestone.level + 1);
      if (nextTaskMilestone) {
        badge.taskCompletionBadge.nextMilestone = nextTaskMilestone.milestone;
        badge.taskCompletionBadge.currentProgress = badge.totalTasksCompleted - highestReachedTaskMilestone.milestone;
      } else {
        // Max level reached
        badge.taskCompletionBadge.nextMilestone = highestReachedTaskMilestone.milestone;
        badge.taskCompletionBadge.currentProgress = 0;
      }
    } else {
      // No milestones reached, reset to initial state
      badge.taskCompletionBadge.currentLevel = 0;
      badge.taskCompletionBadge.badgeName = 'Task Initiate';
      badge.taskCompletionBadge.badgeEmoji = '🐣';
      badge.taskCompletionBadge.earned = false;
      badge.taskCompletionBadge.nextMilestone = 5;
      badge.taskCompletionBadge.currentProgress = badge.totalTasksCompleted;
    }
    
    await badge.save();
    return { badge, newlyEarnedBadge };
  } catch (error) {
    console.error('Error updating badge on task complete:', error);
    throw error;
  }
};

// Update streak badge when completion streak changes
export const updateStreakBadge = async (userId, currentStreak) => {
  try {
    const badge = await getOrCreateBadge(userId);
    let newlyEarnedBadge = null;
    
    // Update current streak
    badge.currentStreak = currentStreak;
    badge.streakBadge.currentProgress = currentStreak;
    
    // Check if streak milestone is reached
    const streakMilestones = Badge.STREAK_MILESTONES;
    const currentStreakMilestone = streakMilestones.find(m => m.milestone === badge.streakBadge.nextMilestone);
    
    if (currentStreakMilestone && badge.streakBadge.currentProgress >= currentStreakMilestone.milestone) {
      // Streak milestone reached - earn badge
      badge.streakBadge.earned = true;
      badge.streakBadge.currentLevel = currentStreakMilestone.level;
      badge.streakBadge.badgeName = currentStreakMilestone.name;
      badge.streakBadge.badgeEmoji = currentStreakMilestone.emoji;
      
      // Add to earned badges
      badge.badgesEarned.push({
        name: currentStreakMilestone.name,
        emoji: currentStreakMilestone.emoji,
        level: currentStreakMilestone.level,
        type: 'streak',
        earnedAt: new Date()
      });
      
      // Set newly earned badge for notification
      newlyEarnedBadge = {
        name: currentStreakMilestone.name,
        emoji: currentStreakMilestone.emoji,
        type: 'streak'
      };
      
      // Find next milestone
      const nextStreakMilestone = streakMilestones.find(m => m.level === currentStreakMilestone.level + 1);
      if (nextStreakMilestone) {
        badge.streakBadge.nextMilestone = nextStreakMilestone.milestone;
        badge.streakBadge.currentProgress = 0; // Reset progress for next level
      } else {
        // Max level reached
        badge.streakBadge.nextMilestone = currentStreakMilestone.milestone;
        badge.streakBadge.currentProgress = currentStreakMilestone.milestone;
      }
      
      console.log(`Streak badge earned: ${currentStreakMilestone.name} (${currentStreakMilestone.emoji})`);
    } else {
      // Check if we need to adjust the current streak badge (streak decreased)
      // Find the highest milestone the user has actually reached
      const highestReachedStreakMilestone = streakMilestones
        .filter(m => m.milestone <= badge.currentStreak)
        .sort((a, b) => b.level - a.level)[0];
      
      if (highestReachedStreakMilestone) {
        // Update to the highest milestone reached
        badge.streakBadge.currentLevel = highestReachedStreakMilestone.level;
        badge.streakBadge.badgeName = highestReachedStreakMilestone.name;
        badge.streakBadge.badgeEmoji = highestReachedStreakMilestone.emoji;
        badge.streakBadge.earned = true;
        
        // Find next milestone
        const nextStreakMilestone = streakMilestones.find(m => m.level === highestReachedStreakMilestone.level + 1);
        if (nextStreakMilestone) {
          badge.streakBadge.nextMilestone = nextStreakMilestone.milestone;
          badge.streakBadge.currentProgress = badge.currentStreak - highestReachedStreakMilestone.milestone;
        } else {
          // Max level reached
          badge.streakBadge.nextMilestone = highestReachedStreakMilestone.milestone;
          badge.streakBadge.currentProgress = 0;
        }
      } else {
        // No milestones reached, reset to initial state
        badge.streakBadge.currentLevel = 0;
        badge.streakBadge.badgeName = 'Focus Streak';
        badge.streakBadge.badgeEmoji = '🔥';
        badge.streakBadge.earned = false;
        badge.streakBadge.nextMilestone = 7;
        badge.streakBadge.currentProgress = badge.currentStreak;
      }
    }
    
    await badge.save();
    return { badge, newlyEarnedBadge };
  } catch (error) {
    console.error('Error updating streak badge:', error);
    throw error;
  }
};

// Get badge data for display
export const getBadgeData = async (userId) => {
  try {
    const badge = await getOrCreateBadge(userId);
    const taskMilestones = Badge.BADGE_MILESTONES;
    const streakMilestones = Badge.STREAK_MILESTONES;
    
    // Calculate task completion progress
    const currentTaskMilestone = taskMilestones.find(m => m.milestone === badge.taskCompletionBadge.nextMilestone);
    const previousTaskMilestone = taskMilestones.find(m => m.level === (currentTaskMilestone?.level || 1) - 1);
    
    let taskProgressPercentage = 0;
    if (currentTaskMilestone) {
      const progressStart = previousTaskMilestone ? previousTaskMilestone.milestone : 0;
      const progressEnd = currentTaskMilestone.milestone;
      const currentProgress = badge.totalTasksCompleted;
      
      if (progressEnd > progressStart) {
        taskProgressPercentage = Math.min(100, Math.round(((currentProgress - progressStart) / (progressEnd - progressStart)) * 100));
      }
    }
    
    // Calculate streak progress
    const currentStreakMilestone = streakMilestones.find(m => m.milestone === badge.streakBadge.nextMilestone);
    const previousStreakMilestone = streakMilestones.find(m => m.level === (currentStreakMilestone?.level || 1) - 1);
    
    let streakProgressPercentage = 0;
    if (currentStreakMilestone) {
      const progressStart = previousStreakMilestone ? previousStreakMilestone.milestone : 0;
      const progressEnd = currentStreakMilestone.milestone;
      const currentProgress = badge.currentStreak;
      
      if (progressEnd > progressStart) {
        streakProgressPercentage = Math.min(100, Math.round(((currentProgress - progressStart) / (progressEnd - progressStart)) * 100));
      }
    }
    
    return {
      taskBadge: {
        name: badge.taskCompletionBadge.badgeName,
        emoji: badge.taskCompletionBadge.badgeEmoji,
        level: badge.taskCompletionBadge.currentLevel,
        earned: badge.taskCompletionBadge.earned
      },
      taskProgress: {
        current: badge.totalTasksCompleted,
        nextMilestone: badge.taskCompletionBadge.nextMilestone,
        percentage: taskProgressPercentage
      },
      streakBadge: {
        name: badge.streakBadge.badgeName,
        emoji: badge.streakBadge.badgeEmoji,
        level: badge.streakBadge.currentLevel,
        earned: badge.streakBadge.earned
      },
      streakProgress: {
        current: badge.currentStreak,
        nextMilestone: badge.streakBadge.nextMilestone,
        percentage: streakProgressPercentage
      },
      totalCompleted: badge.totalTasksCompleted,
      currentStreak: badge.currentStreak,
      badgesEarned: badge.badgesEarned
    };
  } catch (error) {
    console.error('Error getting badge data:', error);
    throw error;
  }
}; 