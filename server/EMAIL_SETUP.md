# Email Notification Setup Guide for ChronoSync

This guide will help you configure email notifications for overdue tasks and reminders in ChronoSync.

## 📧 Email Configuration

Add the following environment variables to your `.env` file in the `server` directory:

```env
# Email Configuration for Notifications
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

## 🔐 Gmail Setup (Recommended)

If you're using Gmail, follow these steps:

### 1. Enable 2-Factor Authentication
- Go to your Google Account settings
- Navigate to Security → 2-Step Verification
- Enable 2-Step Verification

### 2. Generate App Password
- Go to Google Account → Security → App passwords
- Select "Mail" and your device type
- Copy the 16-character password generated
- Use this password as `EMAIL_PASSWORD` in your `.env` file

### 3. Example Configuration
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=chronosync@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop
```

## 📮 Other Email Providers

### Outlook/Hotmail
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

### Yahoo Mail
```env
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
EMAIL_USER=your-email@yahoo.com
EMAIL_PASSWORD=your-app-password
```

### Custom SMTP Server
```env
EMAIL_HOST=smtp.yourprovider.com
EMAIL_PORT=587  # Or 465 for SSL
EMAIL_USER=your-email@domain.com
EMAIL_PASSWORD=your-password
```

## 🔔 Notification Features

Once configured, ChronoSync will automatically send:

### 1. **Overdue Task Notifications**
- Checked every hour
- Sent when a task passes its due date
- Only sent once per task

### 2. **Reminder Notifications**
- Checked every 5 minutes
- Sent when a note reminder is due
- Only sent once per reminder

### 3. **Daily Task Digest**
- Sent every morning at 8:00 AM
- Lists all tasks due today
- Helps you plan your day

### 4. **Upcoming Task Reminders**
- Checked every 10 minutes
- Sent 30 minutes before a task is due
- Helps you stay on track

## 🧪 Testing Your Configuration

### Method 1: Check Server Logs
When you start the server, you should see:
```
✅ Email server connection verified successfully
✅ Overdue task checker scheduled (runs every hour)
✅ Reminder checker scheduled (runs every 5 minutes)
✅ Daily digest scheduled (runs every day at 8:00 AM)
✅ Upcoming task reminder scheduled (runs every 10 minutes)
```

### Method 2: Manual Test Endpoint
Send a GET request to test email manually:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/notifications/test
```

### Method 3: Create a Test Task
1. Create a task with a due date in the past
2. Wait up to 1 hour
3. Check your email inbox

## 🔧 Troubleshooting

### "Email credentials not configured"
- Make sure all EMAIL_* environment variables are set in `.env`
- Restart the server after adding variables

### "Invalid login"
- For Gmail, make sure you're using an App Password, not your regular password
- Check that 2-Factor Authentication is enabled on Gmail

### "Connection timeout"
- Check your firewall settings
- Verify the EMAIL_HOST and EMAIL_PORT are correct
- Try using port 465 with `secure: true` in nodemailer config

### "No email received"
- Check spam/junk folder
- Verify the user's email in Clerk authentication
- Check server logs for error messages
- Test with curl command to verify endpoint works

## 🔒 Security Notes

- Never commit your `.env` file to version control
- Use App Passwords instead of regular passwords
- Keep your email credentials secure
- Consider using environment-specific email accounts for development and production

## 📝 Notification Customization

To customize email templates, edit:
- `server/utils/emailTemplates.js` - HTML email templates
- `server/utils/notificationScheduler.js` - Notification timing and logic

## ⚙️ Advanced Configuration

### Disable Notifications
To temporarily disable notifications without removing configuration:
```env
# Comment out email credentials
# EMAIL_USER=your-email@gmail.com
# EMAIL_PASSWORD=your-app-password
```

### Change Schedule Times
Edit `server/utils/notificationScheduler.js`:
```javascript
// Change daily digest time (currently 8:00 AM)
cron.schedule('0 8 * * *', async () => { ... });

// Change check frequency
cron.schedule('*/5 * * * *', async () => { ... }); // Every 5 minutes
```

### Custom Email Templates
Modify templates in `server/utils/emailTemplates.js` to match your brand or preferences.

## ✅ Complete .env Example

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/chronosyncDB

# Clerk Authentication
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

# Email Notifications
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=chronosync@gmail.com
EMAIL_PASSWORD=your-16-char-app-password

# Google AI (optional)
GOOGLE_API_KEY=your_google_api_key
```

---

**Need help?** Check the server console logs for detailed error messages when the server starts or during notification attempts.
