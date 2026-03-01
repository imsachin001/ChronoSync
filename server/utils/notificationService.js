import nodemailer from 'nodemailer';
import { createClerkClient } from '@clerk/backend';
import { 
  getOverdueTaskEmailTemplate, 
  getReminderEmailTemplate, 
  getUpcomingTaskEmailTemplate 
} from './emailTemplates.js';

// Initialize Clerk client
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY
});

// Create reusable transporter
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }
  return transporter;
};

// Get user email from Clerk
const getUserEmail = async (userId) => {
  try {
    const user = await clerkClient.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId);
    return primaryEmail ? primaryEmail.emailAddress : null;
  } catch (error) {
    console.error('Error fetching user email from Clerk:', error);
    return null;
  }
};

// Get user name from Clerk
const getUserName = async (userId) => {
  try {
    const user = await clerkClient.users.getUser(userId);
    return user.firstName || user.username || 'there';
  } catch (error) {
    console.error('Error fetching user name from Clerk:', error);
    return 'there';
  }
};

// Send email notification
const sendEmail = async (to, subject, html, text) => {
  try {
    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('Email credentials not configured. Skipping email notification.');
      return { success: false, error: 'Email not configured' };
    }

    const mailOptions = {
      from: `"ChronoSync" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Send overdue task notification
export const sendOverdueTaskNotification = async (task) => {
  try {
    const userEmail = await getUserEmail(task.user);
    if (!userEmail) {
      console.warn(`No email found for user ${task.user}`);
      return { success: false, error: 'No email found' };
    }

    const userName = await getUserName(task.user);
    const { subject, html, text } = getOverdueTaskEmailTemplate(task, userName);
    
    const result = await sendEmail(userEmail, subject, html, text);
    console.log(`Overdue task notification sent for task: ${task.title}`);
    return result;
  } catch (error) {
    console.error('Error sending overdue task notification:', error);
    return { success: false, error: error.message };
  }
};

// Send reminder notification
export const sendReminderNotification = async (note) => {
  try {
    const userEmail = await getUserEmail(note.user);
    if (!userEmail) {
      console.warn(`No email found for user ${note.user}`);
      return { success: false, error: 'No email found' };
    }

    const userName = await getUserName(note.user);
    const { subject, html, text } = getReminderEmailTemplate(note, userName);
    
    const result = await sendEmail(userEmail, subject, html, text);
    console.log(`Reminder notification sent for note: ${note.title || 'Untitled'}`);
    return result;
  } catch (error) {
    console.error('Error sending reminder notification:', error);
    return { success: false, error: error.message };
  }
};

// Send daily digest of tasks due today
export const sendDailyTaskDigest = async (userId, tasks) => {
  try {
    if (!tasks || tasks.length === 0) {
      return { success: false, error: 'No tasks to send' };
    }

    const userEmail = await getUserEmail(userId);
    if (!userEmail) {
      console.warn(`No email found for user ${userId}`);
      return { success: false, error: 'No email found' };
    }

    const userName = await getUserName(userId);
    const { subject, html, text } = getUpcomingTaskEmailTemplate(tasks, userName);
    
    const result = await sendEmail(userEmail, subject, html, text);
    console.log(`Daily digest sent to user ${userId} with ${tasks.length} tasks`);
    return result;
  } catch (error) {
    console.error('Error sending daily task digest:', error);
    return { success: false, error: error.message };
  }
};

// Test email configuration
export const testEmailConfiguration = async () => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error('Email credentials not configured in environment variables');
    }

    await getTransporter().verify();
    console.log('✅ Email server connection verified successfully');
    return { success: true, message: 'Email configuration is valid' };
  } catch (error) {
    console.error('❌ Email configuration test failed:', error.message);
    return { success: false, error: error.message };
  }
};
