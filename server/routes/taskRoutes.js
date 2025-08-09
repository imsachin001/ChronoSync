import express from 'express';
import Task from '../models/Task.js';
import dotenv from 'dotenv';
import { verifyToken } from '@clerk/backend';

import {
  updateStatsOnTaskCreate,
  updateStatsOnTaskComplete,
  updateStatsOnTaskDelete,
  getComprehensiveStats,
} from '../utils/statsManager.js';

import {
  updateProductivityOnTaskCreate,
  updateProductivityOnTaskComplete,
  getProductivityScoreData,
} from '../utils/productivityManager.js';

import {
  updateCompletionStreak,
  storeCompletionTime,
  calculateAverageCompletionTime,
  getCompletionStreakData,
} from '../utils/analyticsManager.js';

import {
  updateBadgeOnTaskComplete,
  updateStreakBadge,
  getBadgeData,
} from '../utils/badgeManager.js';

dotenv.config();

const router = express.Router();

// ✅ Middleware to verify Clerk token
const verifyClerkToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
    if (!CLERK_SECRET_KEY) {
      console.error('CLERK_SECRET_KEY is not set');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const payload = await verifyToken(token, {
      secretKey: CLERK_SECRET_KEY,
    });

    req.userId = payload.sub;
    next();
  } catch (error) {
    console.error('Clerk token validation failed:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Use Clerk auth middleware instead of the old verifyToken
const verifyTokenMiddleware = verifyClerkToken;

// Create a new task
router.post('/', verifyTokenMiddleware, async (req, res) => {
  try {
    console.log('Received task creation request:', req.body);
    const { title, description, dueDate, dueTime, priority, tags, estimatedTime, category } = req.body;

    if(!title || !dueDate || !dueTime || !category) {
      console.log('Missing required fields:', { title, dueDate, dueTime, category });
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Combine date and time into a single Date object
    const [year, month, day] = dueDate.split('-');
    const [hours, minutes] = dueTime.split(':');
    const dueDateTime = new Date(year, month - 1, day, hours, minutes);

    console.log('Creating task with data:', {
      title,
      description,
      dueDateTime,
      priority,
      tags,
      estimatedTime,
      category,
      userId: req.userId
    });

    const task = new Task({
      title,
      description,
      dueDate: dueDateTime,
      dueTime,
      priority,
      tags,
      estimatedTime,
      category,
      user: req.userId
    });

    await task.save();
    console.log('Task created successfully:', task);
    
    // Update user statistics
    await updateStatsOnTaskCreate(req.userId, task);
    
    // Update productivity score
    await updateProductivityOnTaskCreate(req.userId, task);
    
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({ 
      message: 'Error creating task',
      error: error.message 
    });
  }
});

// Get task statistics for analytics (must come before /:id routes)
router.get('/stats', verifyTokenMiddleware, async (req, res) => {
  try {
    console.log('Stats endpoint called for user:', req.userId);
    
    // Get comprehensive stats including historical data
    const stats = await getComprehensiveStats(req.userId);
    
    console.log('Comprehensive stats:', stats);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching task stats:', error);
    res.status(500).json({ message: 'Error fetching task statistics' });
  }
});

// Get productivity score data for the current week
router.get('/productivity-score', verifyTokenMiddleware, async (req, res) => {
  try {
    console.log('Productivity score endpoint called for user:', req.userId);
    
    // Get productivity score data using the new manager
    const productivityData = await getProductivityScoreData(req.userId);
    
    console.log('Productivity score data:', productivityData);
    res.json(productivityData);
  } catch (error) {
    console.error('Error fetching productivity score:', error);
    res.status(500).json({ message: 'Error fetching productivity score data' });
  }
});

// Get average completion time
router.get('/avg-completion-time', verifyTokenMiddleware, async (req, res) => {
  try {
    console.log('Average completion time endpoint called for user:', req.userId);
    
    const averageTime = await calculateAverageCompletionTime(req.userId);
    
    console.log('Average completion time:', averageTime);
    res.json({ averageTime });
  } catch (error) {
    console.error('Error fetching average completion time:', error);
    res.status(500).json({ message: 'Error fetching average completion time' });
  }
});

// Get completion streak data
router.get('/completion-streak', verifyTokenMiddleware, async (req, res) => {
  try {
    console.log('Completion streak endpoint called for user:', req.userId);
    
    const streakData = await getCompletionStreakData(req.userId);
    
    console.log('Completion streak data:', streakData);
    res.json(streakData);
  } catch (error) {
    console.error('Error fetching completion streak:', error);
    res.status(500).json({ message: 'Error fetching completion streak data' });
  }
});

// Get week-over-week comparison data
router.get('/week-over-week', verifyTokenMiddleware, async (req, res) => {
  try {
    console.log('Week-over-week endpoint called for user:', req.userId);
    
    const UserStats = (await import('../models/UserStats.js')).default;
    const userStats = await UserStats.findOne({ user: req.userId });
    
    if (!userStats) {
      return res.json([
        { week: 'Last Week', tasks: 0 },
        { week: 'This Week', tasks: 0 }
      ]);
    }
    
    // Calculate week boundaries
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(currentWeekStart.getDate() - 7);
    
    const lastWeekEnd = new Date(currentWeekStart);
    lastWeekEnd.setDate(currentWeekStart.getDate() - 1);
    lastWeekEnd.setHours(23, 59, 59, 999);
    
    const currentWeekEnd = new Date(now);
    currentWeekEnd.setHours(23, 59, 59, 999);
    
    // Calculate last week completed tasks from daily stats
    let lastWeekCompleted = 0;
    if (userStats.dailyStats && userStats.dailyStats.length > 0) {
      lastWeekCompleted = userStats.dailyStats
        .filter(stat => {
          const statDate = new Date(stat.date);
          return statDate >= lastWeekStart && statDate <= lastWeekEnd;
        })
        .reduce((total, stat) => total + stat.tasksCompleted, 0);
    }
    
    // Calculate current week tasks (completed + ongoing)
    let currentWeekTasks = 0;
    
    // Get current week completed tasks from daily stats
    if (userStats.dailyStats && userStats.dailyStats.length > 0) {
      const currentWeekCompleted = userStats.dailyStats
        .filter(stat => {
          const statDate = new Date(stat.date);
          return statDate >= currentWeekStart && statDate <= currentWeekEnd;
        })
        .reduce((total, stat) => total + stat.tasksCompleted, 0);
      
      currentWeekTasks += currentWeekCompleted;
    }
    
    // Get ongoing tasks for current week from active tasks
    const Task = (await import('../models/Task.js')).default;
    const currentWeekOngoing = await Task.countDocuments({
      user: req.userId,
      completed: false,
      $or: [
        { createdAt: { $gte: currentWeekStart, $lte: currentWeekEnd } },
        { dueDate: { $gte: currentWeekStart, $lte: currentWeekEnd } }
      ]
    });
    
    currentWeekTasks += currentWeekOngoing;
    
    const weekData = [
      { week: 'Last Week', tasks: lastWeekCompleted },
      { week: 'This Week', tasks: currentWeekTasks }
    ];
    
    console.log('Week-over-week data:', weekData);
    res.json(weekData);
  } catch (error) {
    console.error('Error fetching week-over-week data:', error);
    res.status(500).json({ message: 'Error fetching week-over-week data' });
  }
});

// Get category completions for pie chart
router.get('/category-completions', verifyTokenMiddleware, async (req, res) => {
  try {
    const UserStats = (await import('../models/UserStats.js')).default;
    const userStats = await UserStats.findOne({ user: req.userId });
    if (!userStats || !userStats.categoryCompletions) {
      return res.json({});
    }
    // Convert Map to plain object
    const completions = {};
    for (const [key, value] of userStats.categoryCompletions.entries()) {
      completions[key] = value;
    }
    res.json(completions);
  } catch (error) {
    console.error('Error fetching category completions:', error);
    res.status(500).json({ message: 'Error fetching category completions' });
  }
});

// Fix badge progress for existing users (admin endpoint)
router.post('/fix-badges', verifyTokenMiddleware, async (req, res) => {
  try {
    const { fixBadgeProgress } = await import('../utils/fixBadgeProgress.js');
    await fixBadgeProgress();
    res.json({ message: 'Badge progress fix completed' });
  } catch (error) {
    console.error('Error fixing badge progress:', error);
    res.status(500).json({ message: 'Error fixing badge progress' });
  }
});

// Run category stats migration
router.post('/migrate-category-stats', verifyTokenMiddleware, async (req, res) => {
  try {
    const { migrateCategoryStats } = await import('../utils/migrateCategoryStats.js');
    await migrateCategoryStats();
    res.json({ message: 'Category stats migration completed' });
  } catch (error) {
    console.error('Error running category stats migration:', error);
    res.status(500).json({ message: 'Error running category stats migration' });
  }
});

// Get productivity insights
router.get('/productivity-insights', verifyTokenMiddleware, async (req, res) => {
  try {
    const Task = (await import('../models/Task.js')).default;
    const UserStats = (await import('../models/UserStats.js')).default;
    
    // Get current week boundaries
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    currentWeekStart.setHours(0, 0, 0, 0);
    
    const currentWeekEnd = new Date(now);
    currentWeekEnd.setHours(23, 59, 59, 999);
    
    // Get user stats for historical data
    const userStats = await UserStats.findOne({ user: req.userId });
    
    // Get completed tasks this week from dailyStats (preserved even if tasks are deleted)
    let completedTasksThisWeek = 0;
    if (userStats && userStats.dailyStats) {
      completedTasksThisWeek = userStats.dailyStats
        .filter(stat => {
          const statDate = new Date(stat.date);
          return statDate >= currentWeekStart && statDate <= currentWeekEnd;
        })
        .reduce((total, stat) => total + stat.tasksCompleted, 0);
    }
    
    // Get total tasks created this week from dailyStats (preserved even if tasks are deleted)
    let totalTasksThisWeek = 0;
    if (userStats && userStats.dailyStats) {
      totalTasksThisWeek = userStats.dailyStats
        .filter(stat => {
          const statDate = new Date(stat.date);
          return statDate >= currentWeekStart && statDate <= currentWeekEnd;
        })
        .reduce((total, stat) => total + stat.tasksAssigned, 0);
    }
    
    // Fallback: If no dailyStats data, use current tasks
    if (totalTasksThisWeek === 0) {
      const allTasks = await Task.find({ user: req.userId });
      const createdThisWeek = allTasks.filter(task => {
        const createdDate = new Date(task.createdAt);
        return createdDate >= currentWeekStart && createdDate <= currentWeekEnd;
      });
      totalTasksThisWeek = createdThisWeek.length;
      
      // For completed tasks, count completed tasks created this week
      completedTasksThisWeek = createdThisWeek.filter(task => task.completed).length;
    }
    
    // Calculate most productive day from dailyStats
    const dayCounts = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    if (userStats && userStats.dailyStats) {
      userStats.dailyStats
        .filter(stat => {
          const statDate = new Date(stat.date);
          return statDate >= currentWeekStart && statDate <= currentWeekEnd;
        })
        .forEach(stat => {
          const dayName = dayNames[new Date(stat.date).getDay()];
          dayCounts[dayName] = (dayCounts[dayName] || 0) + stat.tasksCompleted;
        });
    }
    
    const mostProductiveDay = Object.keys(dayCounts).length > 0 
      ? Object.keys(dayCounts).reduce((a, b) => dayCounts[a] > dayCounts[b] ? a : b)
      : 'No tasks completed this week';
    
    // Calculate most used category from historical data (preserved even when tasks are deleted)
    let mostUsedCategory = 'No tasks created this week';
    let categoryCounts = {};
    
    if (totalTasksThisWeek > 0) {
      // Use historical category data from dailyStats (preserved even when tasks are deleted)
      
      if (userStats && userStats.dailyStats) {
        userStats.dailyStats
          .filter(stat => {
            const statDate = new Date(stat.date);
            return statDate >= currentWeekStart && statDate <= currentWeekEnd;
          })
          .forEach(stat => {
            if (stat.categoryStats) {
              stat.categoryStats.forEach((count, category) => {
                categoryCounts[category] = (categoryCounts[category] || 0) + count;
              });
            }
          });
      }
      
      // Fallback to current tasks if no historical category data
      if (Object.keys(categoryCounts).length === 0) {
        const allTasks = await Task.find({ user: req.userId });
        const createdThisWeek = allTasks.filter(task => {
          const createdDate = new Date(task.createdAt);
          return createdDate >= currentWeekStart && createdDate <= currentWeekEnd;
        });
        
        createdThisWeek.forEach(task => {
          if (task.category) {
            categoryCounts[task.category] = (categoryCounts[task.category] || 0) + 1;
          }
        });
      }
      
      if (Object.keys(categoryCounts).length > 0) {
        mostUsedCategory = Object.keys(categoryCounts).reduce((a, b) => 
          categoryCounts[a] > categoryCounts[b] ? a : b
        );
      }
    }
    
    // Calculate weekly completion percentage using historical data
    const completionPercentage = totalTasksThisWeek > 0 
      ? Math.round((completedTasksThisWeek / totalTasksThisWeek) * 100)
      : 0;
    
    const insights = {
      mostProductiveDay,
      mostUsedCategory,
      completionPercentage,
      totalTasksThisWeek,
      completedTasksThisWeek
    };
    
    console.log('Productivity insights:', {
      ...insights,
      debug: {
        dailyStats: userStats?.dailyStats?.filter(stat => {
          const statDate = new Date(stat.date);
          return statDate >= currentWeekStart && statDate <= currentWeekEnd;
        }),
        categoryCounts: Object.keys(categoryCounts).length > 0 ? categoryCounts : 'No categories found',
        currentWeekStart,
        currentWeekEnd,
        totalTasksThisWeek,
        completedTasksThisWeek
      }
    });
    res.json(insights);
  } catch (error) {
    console.error('Error fetching productivity insights:', error);
    res.status(500).json({ message: 'Error fetching productivity insights' });
  }
});

// Get badge data
router.get('/badges', verifyTokenMiddleware, async (req, res) => {
  try {
    console.log('Badge data endpoint called for user:', req.userId);
    
    const badgeData = await getBadgeData(req.userId);
    
    console.log('Badge data:', badgeData);
    res.json(badgeData);
  } catch (error) {
    console.error('Error fetching badge data:', error);
    res.status(500).json({ message: 'Error fetching badge data' });
  }
});

// Get all tasks for the authenticated user
router.get('/', verifyTokenMiddleware, async (req, res) => {
  try {
    const tasks = await Task.find({ user: req.userId }).sort({ dueDate: 1 });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Error fetching tasks' });
  }
});

// Toggle task completion
router.patch('/:id/toggle', verifyTokenMiddleware, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.userId });
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const wasCompleted = !task.completed; // This will be the new state
    task.completed = wasCompleted;
    
    // Set completion time when task is completed
    if (wasCompleted) {
      task.completedAt = new Date();
    } else {
      task.completedAt = null; // Clear completion time when uncompleted
    }
    
    await task.save();
    
    // Update user statistics
    await updateStatsOnTaskComplete(req.userId, task, wasCompleted);
    
    // Update productivity score
    await updateProductivityOnTaskComplete(req.userId, task, wasCompleted);
    
    // Update completion streak
    const streakBadgeResult = await updateCompletionStreak(req.userId, task, wasCompleted);
    
    // Update badge progress
    const { badge, newlyEarnedBadge } = await updateBadgeOnTaskComplete(req.userId, wasCompleted);
    
    // Store completion time when task is completed
    if (wasCompleted) {
      await storeCompletionTime(req.userId, task);
    }
    
    // Return task with badge information if a new badge was earned
    const response = { task };
    if (newlyEarnedBadge) {
      response.newlyEarnedBadge = newlyEarnedBadge;
    } else if (streakBadgeResult) {
      response.newlyEarnedBadge = streakBadgeResult;
    }
    
    // If both badges were earned, prioritize task badge for notification
    if (newlyEarnedBadge && streakBadgeResult) {
      response.newlyEarnedBadge = newlyEarnedBadge;
      console.log('Both task and streak badges earned, showing task badge notification');
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error toggling task:', error);
    res.status(500).json({ message: 'Error toggling task' });
  }
});

// Delete a task
router.delete('/:id', verifyTokenMiddleware, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.userId });
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Update user statistics before deleting
    await updateStatsOnTaskDelete(req.userId, task);
    
    // Note: We intentionally do NOT update productivity scores when deleting tasks
    // This ensures that productivity data remains consistent and isn't affected by task deletions
    
    // Now delete the task
    await Task.findByIdAndDelete(req.params.id);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ message: 'Error deleting task' });
  }
});

export default router; 
