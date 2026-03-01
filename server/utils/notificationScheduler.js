import cron from 'node-cron';
import Task from '../models/Task.js';
import NoteForm from '../models/NoteForm.js';
import { 
  sendOverdueTaskNotification, 
  sendReminderNotification,
  sendDailyTaskDigest 
} from './notificationService.js';

// Check for overdue tasks every hour
export const scheduleOverdueTaskCheck = () => {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('🔍 Checking for overdue tasks...');
      
      const now = new Date();
      
      // Find tasks that are overdue and not completed, and notification hasn't been sent
      const overdueTasks = await Task.find({
        completed: false,
        dueDate: { $lt: now },
        overdueNotificationSent: false
      });

      console.log(`Found ${overdueTasks.length} overdue tasks without notifications`);

      for (const task of overdueTasks) {
        const result = await sendOverdueTaskNotification(task);
        
        if (result.success) {
          // Mark notification as sent
          task.overdueNotificationSent = true;
          task.lastNotificationSent = now;
          await task.save();
          console.log(`✅ Sent overdue notification for task: ${task.title}`);
        } else {
          console.error(`❌ Failed to send notification for task: ${task.title}`, result.error);
        }
      }
    } catch (error) {
      console.error('Error in overdue task check:', error);
    }
  });
  
  console.log('✅ Overdue task checker scheduled (runs every hour)');
};

// Check for reminders every 5 minutes
export const scheduleReminderCheck = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      console.log('🔔 Checking for reminders...');
      
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      // Find notes with reminders that are due and notification hasn't been sent
      const dueReminders = await NoteForm.find({
        reminder: { 
          $ne: null,
          $lte: now,
          $gte: fiveMinutesAgo
        },
        reminderNotificationSent: false,
        trashed: false
      });

      console.log(`Found ${dueReminders.length} due reminders without notifications`);

      for (const note of dueReminders) {
        const result = await sendReminderNotification(note);
        
        if (result.success) {
          // Mark notification as sent
          note.reminderNotificationSent = true;
          await note.save();
          console.log(`✅ Sent reminder notification for note: ${note.title || 'Untitled'}`);
        } else {
          console.error(`❌ Failed to send reminder for note: ${note.title || 'Untitled'}`, result.error);
        }
      }
    } catch (error) {
      console.error('Error in reminder check:', error);
    }
  });
  
  console.log('✅ Reminder checker scheduled (runs every 5 minutes)');
};

// Send daily digest at 8 AM every day
export const scheduleDailyDigest = () => {
  // Run every day at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    try {
      console.log('📅 Sending daily task digests...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      
      // Find all users with tasks due today
      const tasksDueToday = await Task.find({
        completed: false,
        dueDate: { 
          $gte: today,
          $lte: endOfDay
        }
      });

      // Group tasks by user
      const tasksByUser = {};
      tasksDueToday.forEach(task => {
        if (!tasksByUser[task.user]) {
          tasksByUser[task.user] = [];
        }
        tasksByUser[task.user].push(task);
      });

      console.log(`Sending digests to ${Object.keys(tasksByUser).length} users`);

      // Send digest to each user
      for (const [userId, tasks] of Object.entries(tasksByUser)) {
        const result = await sendDailyTaskDigest(userId, tasks);
        
        if (result.success) {
          console.log(`✅ Sent daily digest to user ${userId} with ${tasks.length} tasks`);
        } else {
          console.error(`❌ Failed to send digest to user ${userId}`, result.error);
        }
      }
    } catch (error) {
      console.error('Error in daily digest:', error);
    }
  });
  
  console.log('✅ Daily digest scheduled (runs every day at 8:00 AM)');
};

// Send reminder before task due (30 minutes before)
export const scheduleUpcomingTaskReminder = () => {
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      console.log('⏰ Checking for upcoming task reminders...');
      
      const now = new Date();
      const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);
      const fortyMinutesLater = new Date(now.getTime() + 40 * 60 * 1000);
      
      // Find tasks due in 30-40 minutes that haven't been notified recently
      const upcomingTasks = await Task.find({
        completed: false,
        dueDate: { 
          $gte: thirtyMinutesLater,
          $lte: fortyMinutesLater
        },
        $or: [
          { lastNotificationSent: null },
          { lastNotificationSent: { $lt: new Date(now.getTime() - 60 * 60 * 1000) } } // Not notified in last hour
        ]
      });

      console.log(`Found ${upcomingTasks.length} upcoming tasks to notify`);

      for (const task of upcomingTasks) {
        const result = await sendOverdueTaskNotification(task);
        
        if (result.success) {
          task.lastNotificationSent = now;
          await task.save();
          console.log(`✅ Sent upcoming reminder for task: ${task.title}`);
        }
      }
    } catch (error) {
      console.error('Error in upcoming task reminder:', error);
    }
  });
  
  console.log('✅ Upcoming task reminder scheduled (runs every 10 minutes)');
};

// Initialize all schedulers
export const initializeSchedulers = () => {
  console.log('\n📬 Initializing notification schedulers...');
  scheduleOverdueTaskCheck();
  scheduleReminderCheck();
  scheduleDailyDigest();
  scheduleUpcomingTaskReminder();
  console.log('✅ All notification schedulers initialized\n');
};
