import mongoose from 'mongoose';
import Task from '../models/Task.js';
import UserStats from '../models/UserStats.js';
import dotenv from 'dotenv';

dotenv.config();

const migrateUserStats = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/chronosyncDB");
    console.log("Connected to MongoDB for migration");

    // Get all unique users who have tasks
    const usersWithTasks = await Task.distinct('user');
    console.log(`Found ${usersWithTasks.length} users with tasks:`, usersWithTasks);

    for (const userId of usersWithTasks) {
      console.log(`Migrating stats for user: ${userId}`);
      
      // Get all tasks for this user
      const tasks = await Task.find({ user: userId });
      
      // Calculate stats
      const now = new Date();
      const totalTasksAssigned = tasks.length;
      const totalTasksCompleted = tasks.filter(task => task.completed).length;
      const totalTasksOverdue = tasks.filter(task => {
        const dueDate = new Date(task.dueDate);
        return !task.completed && dueDate < now;
      }).length;

      // Check if user stats already exist
      let userStats = await UserStats.findOne({ user: userId });
      
      // Always update stats (create new or update existing)
      if (!userStats) {
        // Create new user stats
        userStats = new UserStats({
          user: userId,
          totalTasksAssigned,
          totalTasksCompleted,
          totalTasksOverdue,
          dailyStats: []
        });
      } else {
        // Update existing stats
        userStats.totalTasksAssigned = totalTasksAssigned;
        userStats.totalTasksCompleted = totalTasksCompleted;
        userStats.totalTasksOverdue = totalTasksOverdue;
      }
      
      // Calculate daily stats
      const dailyStatsMap = new Map();
      
      tasks.forEach(task => {
        const taskDate = new Date(task.createdAt);
        taskDate.setHours(0, 0, 0, 0);
        const dateKey = taskDate.getTime();
        
        if (!dailyStatsMap.has(dateKey)) {
          dailyStatsMap.set(dateKey, {
            date: taskDate,
            tasksAssigned: 0,
            tasksCompleted: 0,
            tasksOverdue: 0
          });
        }
        
        const dailyStat = dailyStatsMap.get(dateKey);
        dailyStat.tasksAssigned += 1;
        
        if (task.completed) {
          dailyStat.tasksCompleted += 1;
        }
        
        const dueDate = new Date(task.dueDate);
        if (!task.completed && dueDate < now) {
          dailyStat.tasksOverdue += 1;
        }
      });
      
      userStats.dailyStats = Array.from(dailyStatsMap.values());
      
      await userStats.save();
      console.log(`Updated stats for user ${userId}: assigned=${totalTasksAssigned}, completed=${totalTasksCompleted}, overdue=${totalTasksOverdue}`);
    }
    
    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
};

// Run migration if this file is executed directly
migrateUserStats();

export default migrateUserStats; 