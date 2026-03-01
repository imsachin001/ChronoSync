import express from 'express';
import { verifyToken } from '@clerk/backend';
import Task from '../models/Task.js';
import NoteForm from '../models/NoteForm.js';
import { 
  sendOverdueTaskNotification, 
  sendReminderNotification,
  testEmailConfiguration 
} from '../utils/notificationService.js';
import dotenv from 'dotenv';

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

const verifyTokenMiddleware = verifyClerkToken;

// Test email configuration
router.get('/test', verifyTokenMiddleware, async (req, res) => {
  try {
    const result = await testEmailConfiguration();
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Email configuration is valid and working!',
        details: result.message
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Email configuration test failed',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error testing email configuration:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error testing email configuration',
      error: error.message 
    });
  }
});

// Manually trigger notification for a specific task
router.post('/task/:taskId/send', verifyTokenMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Verify the task belongs to the user
    if (task.user !== req.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const result = await sendOverdueTaskNotification(task);
    
    if (result.success) {
      // Update notification tracking
      task.overdueNotificationSent = true;
      task.lastNotificationSent = new Date();
      await task.save();
      
      res.json({ 
        success: true, 
        message: 'Notification sent successfully!',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send notification',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error sending task notification:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error sending notification',
      error: error.message 
    });
  }
});

// Manually trigger notification for a specific note reminder
router.post('/note/:noteId/send', verifyTokenMiddleware, async (req, res) => {
  try {
    const note = await NoteForm.findById(req.params.noteId);
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Verify the note belongs to the user
    if (note.user !== req.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (!note.reminder) {
      return res.status(400).json({ message: 'This note has no reminder set' });
    }

    const result = await sendReminderNotification(note);
    
    if (result.success) {
      // Update notification tracking
      note.reminderNotificationSent = true;
      await note.save();
      
      res.json({ 
        success: true, 
        message: 'Reminder notification sent successfully!',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send reminder',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error sending reminder notification:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error sending reminder',
      error: error.message 
    });
  }
});

// Get notification status for tasks and notes
router.get('/status', verifyTokenMiddleware, async (req, res) => {
  try {
    const now = new Date();
    
    // Get overdue tasks without notifications
    const overdueTasksCount = await Task.countDocuments({
      user: req.userId,
      completed: false,
      dueDate: { $lt: now },
      overdueNotificationSent: false
    });

    // Get pending reminders
    const pendingRemindersCount = await NoteForm.countDocuments({
      user: req.userId,
      reminder: { $ne: null, $lte: now },
      reminderNotificationSent: false,
      trashed: false
    });

    // Get total notifications sent today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const notificationsSentToday = await Task.countDocuments({
      user: req.userId,
      lastNotificationSent: { $gte: todayStart }
    });

    res.json({
      success: true,
      status: {
        pendingOverdueTaskNotifications: overdueTasksCount,
        pendingReminderNotifications: pendingRemindersCount,
        notificationsSentToday,
        emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)
      }
    });
  } catch (error) {
    console.error('Error fetching notification status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching notification status',
      error: error.message 
    });
  }
});

// Reset notification flags (for testing purposes)
router.post('/reset', verifyTokenMiddleware, async (req, res) => {
  try {
    // Reset task notifications
    await Task.updateMany(
      { user: req.userId },
      { 
        $set: { 
          overdueNotificationSent: false,
          lastNotificationSent: null
        } 
      }
    );

    // Reset note notifications
    await NoteForm.updateMany(
      { user: req.userId },
      { 
        $set: { 
          reminderNotificationSent: false
        } 
      }
    );

    res.json({ 
      success: true, 
      message: 'All notification flags have been reset. Notifications will be resent on next check.' 
    });
  } catch (error) {
    console.error('Error resetting notifications:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error resetting notifications',
      error: error.message 
    });
  }
});

export default router;
