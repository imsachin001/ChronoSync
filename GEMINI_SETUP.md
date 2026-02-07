# Gemini AI Integration Setup

## Overview
The ChronoSync AI Scheduler now uses Google's Gemini AI to provide intelligent scheduling recommendations based on your current tasks.

## Setup Instructions

### 1. Get Your Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Add API Key to Environment

Open `server/.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
```

### 3. Restart the Server

After adding the API key, restart your server:

```bash
cd server
npm run dev
```

## Features

The AI Scheduler can now:

- ✅ Analyze your current tasks (title, priority, due date, status)
- ✅ Provide personalized scheduling recommendations
- ✅ Suggest time-blocking strategies
- ✅ Help with task prioritization
- ✅ Offer productivity tips based on your workload

## Usage

1. Navigate to the Tasks page
2. Scroll down to the "AI Assistant" section
3. Ask questions like:
   - "Plan my day with high priority tasks first"
   - "How should I organize my tasks for tomorrow?"
   - "Create a schedule with focus blocks"
   - "What should I work on first?"

## Authentication Fixed

The "Please log in to view your saved chats" issue has been resolved. The app now properly uses Clerk authentication throughout the AI features.

## Notes

- The Gemini API has a free tier with generous limits
- Responses are generated in real-time based on your actual task data
- All conversations can be saved and retrieved later (requires login)
