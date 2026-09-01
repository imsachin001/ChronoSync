# ChronoSync

**ChronoSync** is a full-stack productivity and task management application that combines smart scheduling, rich note-taking, AI assistance, and analytics into a single cohesive workspace.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Database Optimization](#database-optimization)
- [Performance & Testing](#performance--testing)
- [Installation](#installation)
- [Live Demo](#live-demo)

---

## Project Overview

ChronoSync helps individuals stay on top of their work by providing a unified platform for managing tasks, writing notes, tracking habits, and analyzing productivity patterns. It uses Google Gemini AI to act as a personal scheduling assistant that understands your existing task list and provides actionable recommendations.

Key highlights:
- Secure authentication via Clerk
- AI-powered scheduling chat using Google Gemini
- Rich text notes with pin, archive, trash, and reminder support
- Gamified productivity with badge milestones and completion streaks
- Real-time analytics with heatmaps and progress charts
- Email notifications for overdue tasks and note reminders

---

## Architecture

ChronoSync follows a standard **client-server** architecture:

```
┌─────────────────────────────────────────────────────────┐
│                        CLIENT                           │
│          React (Vite SPA) — port 5173                   │
│   Clerk React  │  Recharts  │  TipTap  │  Framer Motion │
└─────────────────────────┬───────────────────────────────┘
                          │ REST API (JSON)
┌─────────────────────────▼───────────────────────────────┐
│                        SERVER                           │
│          Node.js + Express — port 5000                  │
│   Clerk Auth Middleware  │  Gemini AI  │  node-cron     │
└────────────┬────────────────────────┬───────────────────┘
             │                        │
    ┌────────▼──────────┐   ┌─────────▼──────────┐
    │     MongoDB       │   │  Google Gemini API │
    │  (Mongoose ODM)   │   │  (gemini-2.5-flash)│
    └───────────────────┘   └────────────────────┘
```

**Request flow:**
1. The React client authenticates users through Clerk and attaches a session token to every API request.
2. The Express server validates the token via Clerk middleware before processing any route.
3. Business logic (tasks, notes, analytics, badges) is handled by dedicated route + utility modules.
4. MongoDB persists all user data via Mongoose models.
5. A `node-cron` scheduler runs background jobs to dispatch email notifications for overdue tasks and upcoming reminders.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| Vite | Build tool & dev server |
| React Router DOM v7 | Client-side routing |
| Tailwind CSS v4 | Utility-first styling |
| Material UI (MUI) v7 | Component library |
| Framer Motion | Animations |
| Recharts | Analytics charts |
| TipTap | Rich text editor for notes |
| Clerk React | Authentication & user management |
| Lucide React / React Icons | Icon sets |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| Mongoose | MongoDB ODM |
| Clerk Backend SDK | Server-side auth verification |
| @google/generative-ai | Gemini AI integration |
| node-cron | Scheduled background jobs |
| Nodemailer | Email notification delivery |
| bcryptjs / jsonwebtoken | Credential utilities |
| dotenv | Environment variable management |

### Infrastructure
| Technology | Purpose |
|---|---|
| MongoDB | Primary database |
| Clerk | Identity & access management |

---

## Features

### Task Management
- Create, edit, and delete tasks with title, description, priority (low / medium / high), category, tags, due date & time, and estimated duration.
- Mark tasks complete; track completion timestamps for streak calculations.
- Automatic overdue detection with email notifications sent via cron job.

### AI Scheduling Assistant
- Chat with **Google Gemini (gemini-2.5-flash)** about your tasks.
- The AI receives your full task list as context and returns a prioritised, formatted schedule.
- Conversation history is persisted so you can revisit saved AI chats.

### Notes
- Create rich text notes using the TipTap editor.
- Pin important notes to the top, archive unused ones, or move them to trash.
- Add tags for organisation and set date-based reminders with email alerts.

### Analytics
- **Heatmap** visualising daily task completion over time.
- **Productivity score** computed from task volume, priority weighting, and completion rate.
- **Category breakdown** and trend charts powered by Recharts.
- Completion streaks tracked and displayed with a consecutive-days counter.

### Badges & Gamification
- Two badge tracks: **Task Completion** and **Streak**.
- Progressive milestone levels (e.g., Task Initiate → higher ranks) awarded automatically as you hit targets.
- Badge progress is surfaced live in the UI with emoji indicators.

### Email Notifications
- Overdue task alerts dispatched by the background scheduler.
- Note reminder emails sent when a reminder datetime is reached.
- Configurable via SMTP credentials in the server environment.

### Authentication & Protected Routes
- All pages except the landing page, login, and signup are protected by Clerk.
- Session tokens validated server-side on every API call.

### Profile
- View and manage user profile details pulled from Clerk.
- Also your personal profile with achievements and stats.

---

## Database Optimization

ChronoSync leverages **MongoDB indexing strategies** to achieve significant performance improvements across all task queries.

### MongoDB Index Strategy

We implemented 5 strategic compound and single-field indexes on the Task collection to optimize the most common query patterns:

**Indexes Implemented:**

1. **`{ user: 1, dueDate: 1 }`** — Task listing queries
   - Optimizes: Fetching all tasks for a user sorted by due date
   - Use case: Main task dashboard view

2. **`{ user: 1, dueDate: 1, completed: 1 }`** — Overdue/upcoming task filtering
   - Optimizes: Finding tasks due today, overdue tasks, and upcoming tasks
   - Use case: Notification scheduler, task filtering

3. **`{ user: 1, completed: 1, completedAt: 1 }`** — Analytics and completion queries
   - Optimizes: Fetching completed tasks for productivity calculations
   - Use case: Analytics dashboard, completion streaks, badge calculations

4. **`{ user: 1, completed: 1, createdAt: -1 }`** — Week-over-week and time-series analysis
   - Optimizes: Queries on task creation date ranges
   - Use case: Weekly productivity trends, historical data aggregation

5. **`{ user: 1 }`** — Baseline user filtering
   - Optimizes: All user-based queries as the primary filter
   - Use case: Universal fallback index for any user-scoped query

### Query Pattern Optimization

All major query patterns in ChronoSync now use **Index Scan (IXSCAN)** instead of full collection scans:

- ✅ Get all tasks for user
- ✅ Find overdue tasks
- ✅ Find upcoming tasks (next 7 days)
- ✅ Retrieve completed tasks for analytics
- ✅ Count pending/incomplete tasks
- ✅ Week-over-week productivity analysis

### Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|------------|
| **Query Latency** | 107ms | 47ms | **56.1% faster** |
| **Documents Scanned** | 100,000 | 20,000 | **80% reduction** |
| **Execution Stage** | COLLSCAN | IXSCAN | **Index utilization** |
| **Performance Speedup** | — | — | **2.28x faster** |

These measurements are based on a production-realistic dataset of 100,000 tasks with 20,000 user-specific tasks.

### Annual Business Impact

At 1,000 queries per day (typical production load):
- ⏱️ **6.1 hours saved per year**
- 📊 **80 million document scans avoided per year**
- 💪 **Significantly reduced CPU and memory usage**
- 🚀 **Improved application responsiveness**

---

## Installation

### Prerequisites
- Node.js ≥ 18
- MongoDB (local instance or MongoDB Atlas connection string)
- [Clerk](https://clerk.com) account (publishable key + secret key)
- [Google AI Studio](https://aistudio.google.com) API key (Gemini)
- SMTP email credentials (e.g., Gmail App Password)

### 1. Clone the repository

```bash
git clone https://github.com/imsachin001/ChronoSync.git
cd ChronoSync
```

### 2. Set up the server

```bash
cd server
npm install
```

Create `server/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/chronosyncDB

# Clerk
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### 3. Set up the client

```bash
cd ../client
npm install
```

Create `client/.env`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key
```

### 4. Run the application

In one terminal, start the server:

```bash
cd server
npm run dev
```

In a second terminal, start the client:

```bash
cd client
npm run dev
```

The app will be available at `http://localhost:5173`.

> **Docker (server only)**  
> A `Dockerfile` is included in `server/`. Build and run with:
> ```bash
> docker build -t chronosync-server ./server
> docker run -p 5000:5000 --env-file server/.env chronosync-server
> ```

---

## Performance & Testing

### Scale Testing Results

We conducted comprehensive scale testing across multiple dataset sizes to verify that indexes remain effective as data grows. All measurements were taken using MongoDB's native `explain('executionStats')` method.

#### Test 1: Get All Tasks for User (Sorted by Due Date)

**Query:** `Task.find({ user: userId }).sort({ dueDate: 1 })`

| Dataset | Execution Time | Documents Scanned | Execution Stage | Status |
|---------|----------------|-------------------|-----------------|--------|
| 5K tasks | 3ms | 1,000 | IXSCAN ✅ | Optimized |
| 10K tasks | 6ms | 2,000 | IXSCAN ✅ | Optimized |
| 50K tasks | 22ms | 10,000 | IXSCAN ✅ | Optimized |
| 100K tasks | 47ms | 20,000 | IXSCAN ✅ | Optimized |

**Key Finding:** Linear scaling maintained across all dataset sizes with consistent IXSCAN usage.

#### Test 2: Find Overdue Tasks

**Query:** `Task.find({ user: userId, dueDate: { $lte: today }, completed: false })`

| Dataset | Execution Time | Documents Scanned | Execution Stage | Status |
|---------|----------------|-------------------|-----------------|--------|
| 5K tasks | 3ms | 324 | IXSCAN ✅ | Optimized |
| 10K tasks | 5ms | 709 | IXSCAN ✅ | Optimized |
| 50K tasks | 14ms | 3,539 | IXSCAN ✅ | Optimized |
| 100K tasks | 28ms | 6,906 | IXSCAN ✅ | Optimized |

**Key Finding:** Subset queries show excellent index efficiency with significant CPU reduction.

#### Test 3: Find Upcoming Tasks (Next 7 Days)

**Query:** `Task.find({ user: userId, dueDate: { $gte: today, $lte: nextWeek }, completed: false })`

| Dataset | Execution Time | Documents Scanned | Execution Stage | Status |
|---------|----------------|-------------------|-----------------|--------|
| 5K tasks | 3ms | 108 | IXSCAN ✅ | Optimized |
| 10K tasks | 3ms | 196 | IXSCAN ✅ | Optimized |
| 50K tasks | 21ms | 896 | IXSCAN ✅ | Optimized |
| 100K tasks | 9ms | 1,943 | IXSCAN ✅ | Optimized |

**Key Finding:** Most efficient query with smallest subset. Time growth decouples from data growth.

#### Test 4: Find Completed Tasks

**Query:** `Task.find({ user: userId, completed: true }).sort({ completedAt: -1 }).limit(50)`

| Dataset | Execution Time | Documents Scanned | Execution Stage | Status |
|---------|----------------|-------------------|-----------------|--------|
| 5K tasks | 2ms | 304 | IXSCAN ✅ | Optimized |
| 10K tasks | 3ms | 606 | IXSCAN ✅ | Optimized |
| 50K tasks | 9ms | 3,006 | IXSCAN ✅ | Optimized |
| 100K tasks | 16ms | 5,975 | IXSCAN ✅ | Optimized |

**Key Finding:** Consistent performance with excellent index utilization across all scales.

### Overall Performance Summary

- **Total Queries Tested:** 4 production query patterns
- **Optimization Rate:** 100% (all queries use IXSCAN)
- **Average Query Time (100K dataset):** 25ms
- **Largest Query Time (100K dataset):** 47ms
- **Smallest Query Time (100K dataset):** 9ms

### Before vs. After Comparison

**Real-world scenario:** User with 20,000 tasks in a collection of 100,000 total tasks

**Without Indexes (COLLSCAN):**
- Documents examined: 100,000 (full collection)
- Execution time: 107ms
- CPU impact: High (full collection in memory)
- ⚠️ Not suitable for production

**With Indexes (IXSCAN):**
- Documents examined: 20,000 (user's tasks only)
- Execution time: 47ms
- CPU impact: Low (only relevant documents)
- ✅ Production-ready

**Results:**
- **56.1% faster** query execution
- **80% reduction** in documents scanned
- **2.28x performance speedup**

### Testing Methodology

All performance measurements use MongoDB's native `explain('executionStats')` to capture:
- `executionTimeMillis` — Total query execution time
- `totalDocsExamined` — Number of documents MongoDB inspected
- `executionStages` — Whether the query used IXSCAN (good) or COLLSCAN (bad)
- `totalKeysExamined` — Number of index entries evaluated

**Reproducibility:** Performance testing scripts are available in:
- `server/utils/measureIndexPerformance.js` — Initial performance metrics
- `server/utils/beforeAfterIndexComparison.js` — Before/after proof
- `server/utils/scalePerformanceTest.js` — Scale testing across dataset sizes

### Documentation

For detailed information on MongoDB optimization, refer to:
- [`server/MONGODB_INDEXES_GUIDE.md`](server/MONGODB_INDEXES_GUIDE.md) — Complete implementation guide
- [`server/BENCHMARK_REPORT.md`](server/BENCHMARK_REPORT.md) — Comprehensive performance analysis
- [`server/IMPLEMENTATION_SUMMARY.md`](server/IMPLEMENTATION_SUMMARY.md) — Implementation details

---

## Live Demo

> 
