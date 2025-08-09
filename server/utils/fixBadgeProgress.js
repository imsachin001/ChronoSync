import Badge from '../models/Badge.js';

// Fix badge progress for existing users
export const fixBadgeProgress = async () => {
  try {
    console.log('Starting badge progress fix...');
    
    const badges = await Badge.find({});
    console.log(`Found ${badges.length} badge records to check`);
    
    for (const badge of badges) {
      const taskMilestones = Badge.BADGE_MILESTONES;
      
      // Find the highest milestone the user has actually reached
      const highestReachedTaskMilestone = taskMilestones
        .filter(m => m.milestone <= badge.totalTasksCompleted)
        .sort((a, b) => b.level - a.level)[0];
      
      if (highestReachedTaskMilestone && highestReachedTaskMilestone.level > badge.taskCompletionBadge.currentLevel) {
        console.log(`Fixing badge for user ${badge.user}: ${badge.totalTasksCompleted} tasks completed, should have level ${highestReachedTaskMilestone.level} (${highestReachedTaskMilestone.name})`);
        
        // Update to the correct badge level
        badge.taskCompletionBadge.earned = true;
        badge.taskCompletionBadge.currentLevel = highestReachedTaskMilestone.level;
        badge.taskCompletionBadge.badgeName = highestReachedTaskMilestone.name;
        badge.taskCompletionBadge.badgeEmoji = highestReachedTaskMilestone.emoji;
        
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
        
        await badge.save();
        console.log(`Fixed badge for user ${badge.user}`);
      }
    }
    
    console.log('Badge progress fix completed!');
  } catch (error) {
    console.error('Error fixing badge progress:', error);
  }
}; 