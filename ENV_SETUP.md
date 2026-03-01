# 🔐 Environment Variables Setup

ChronoSync requires environment variables for both the **client** and **server** to function properly.

## 📍 Two Separate .env Files

### 1️⃣ Server Environment Variables
**Location:** `server/.env`

This file contains server-side secrets and configurations:
- Database connection
- Email credentials
- API keys
- Authentication secrets

### 2️⃣ Client Environment Variables  
**Location:** `client/.env`

This file contains client-side (frontend) configurations:
- Clerk publishable key (safe for browser)

---

## 🚀 Quick Setup

### Step 1: Copy Example Files

```bash
# Copy server example
cd server
cp .env.example .env

# Copy client example  
cd ../client
cp .env.example .env
```

### Step 2: Fill in Your Credentials

#### **For Server** (`server/.env`):

```env
# Clerk Authentication
CLERK_SECRET_KEY=sk_test_your_key_from_clerk_dashboard

# Google Gemini AI
GEMINI_API_KEY=your_key_from_google_ai_studio

# Email Notifications
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
```

#### **For Client** (`client/.env`):

```env
# Clerk Authentication (Client-Side)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_from_clerk_dashboard
```

---

## 📧 Email Setup (Gmail)

To enable email notifications for tasks and reminders:

1. **Enable 2-Factor Authentication**
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Turn on 2-Step Verification

2. **Generate App Password**
   - Visit [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and your device
   - Copy the 16-character password (remove spaces)

3. **Add to server/.env**
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=abcdefghijklmnop
   ```

For other email providers, see: [server/EMAIL_SETUP.md](server/EMAIL_SETUP.md)

---

## 🔑 Where to Get Your Keys

| Service | Where to Get | Used In |
|---------|-------------|---------|
| **Clerk Auth** | [dashboard.clerk.com](https://dashboard.clerk.com) | Both client & server |
| **Google Gemini AI** | [makersuite.google.com](https://makersuite.google.com/app/apikey) | Server only |
| **Email (Gmail)** | [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) | Server only |
| **MongoDB** | Local or [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas) | Server only |

---

## ✅ Verify Your Setup

### Check Server Configuration
```bash
cd server
npm start
```

Look for these success messages:
```
✅ MongoDB connected successfully!
✅ Email server connection verified successfully
✅ Overdue task checker scheduled
✅ Reminder checker scheduled
✅ Daily digest scheduled
```

### Check Client Configuration
```bash
cd client
npm run dev
```

If Clerk is configured correctly, you should be able to sign in.

---

## 🔒 Security Notes

- ❌ **Never commit `.env` files to Git** (they're in `.gitignore`)
- ✅ **Use `.env.example`** files as templates
- 🔐 **Keep secrets secure** - don't share them publicly
- 📧 **Use App Passwords**, not your regular email password

---

## 🆘 Troubleshooting

### "Email credentials not configured"
- Check that `EMAIL_USER` and `EMAIL_PASSWORD` are set in `server/.env`
- Restart the server after adding variables

### "Clerk authentication failed"
- Verify you're using the correct keys for client vs server
- `VITE_CLERK_PUBLISHABLE_KEY` in client (starts with `pk_`)
- `CLERK_SECRET_KEY` in server (starts with `sk_`)

### "MongoDB connection error"
- Make sure MongoDB is running locally, or
- Update `MONGO_URI` with your MongoDB Atlas connection string

---

## 📝 Example Configuration

### Complete server/.env
```env
MONGO_URI=mongodb://localhost:27017/chronosyncDB
CLERK_SECRET_KEY=sk_test_abc123...
GEMINI_API_KEY=AIza...
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=myapp@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
```

### Complete client/.env
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xyz789...
```

---

Need more help? Check out:
- 📧 [Email Setup Guide](server/EMAIL_SETUP.md)
- 🔐 [Clerk Documentation](https://clerk.com/docs)
- 🤖 [Google AI Studio](https://makersuite.google.com/)
