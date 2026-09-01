# ChronoSync

**ChronoSync** is a full-stack productivity and task management application that combines smart scheduling, rich note-taking, AI assistance, and analytics into a single cohesive workspace. Built with a modern microservices-ready architecture using BullMQ job queues and Redis for async processing.

---

## Table of Contents

- [Project Overview](#project-overview)
- [System Architecture](#system-architecture)
- [Core Components](#core-components)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Key Services](#key-services)
- [Database Models](#database-models)
- [Setup & Deployment](#setup--deployment)
- [Performance & Testing](#performance--testing)
- [Live Demo](#live-demo)

---

## Project Overview

ChronoSync helps individuals and teams stay productive by providing a unified platform for managing tasks, writing notes, tracking habits, and analyzing productivity patterns. It leverages Google Gemini AI as a personal scheduling assistant and implements event-driven architecture with BullMQ workers for reliable background job processing.

**Key highlights:**
- 🔐 Secure authentication via Clerk
- 🤖 AI-powered scheduling recommendations using Google Gemini
- 📝 Rich text notes with pin, archive, trash, and reminder support
- 🎮 Gamified productivity with badges, streaks, and completion tracking
- 📊 Real-time analytics with heatmaps, progress charts, and productivity scoring
- 📧 Reliable email notifications via BullMQ job queue
- ⚡ Async background job processing with Redis + BullMQ
- 🏗️ Scalable event-driven architecture

---

## System Architecture

ChronoSync uses a **distributed microservices-ready architecture** with decoupled async processing:

```
┌───────────────────────────────────────────────────────────────────┐
│                          FRONTEND                                 │
│         React (Vite SPA) — port 5173                              │
│  Clerk Auth │ Recharts │ TipTap │ Framer Motion │ Material UI    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ REST API (JSON) + WebSocket
        ┌──────────────────────▼──────────────────────┐
        │         EXPRESS API SERVER                  │
        │        Node.js — port 5000                  │
        │                                              │
        │  ┌─────────────────────────────────────┐   │
        │  │ Route Handlers                      │   │
        │  │ • taskRoutes.js                     │   │
        │  │ • noteRoutes.js                     │   │
        │  │ • chatRoutes.js                     │   │
        │  │ • aiRoutes.js (AI scheduling)       │   │
        │  │ • notificationRoutes.js             │   │
        │  │ • authRoutes.js                     │   │
        │  └─────────────────────────────────────┘   │
        │                 │                           │
        │  ┌──────────────┼──────────────┐           │
        │  │ Core Services & Utilities    │           │
        │  │ • scheduleScoring.js         │           │
        │  │ • notificationScheduler.js   │           │
        │  │ • notificationService.js     │           │
        │  │ • badgeManager.js            │           │
        │  │ • productivityManager.js     │           │
        │  │ • analyticsManager.js        │           │
        │  │ • statsManager.js            │           │
        │  └──────────────┬───────────────┘           │
        │                 │                           │
        └─────────────────┼─────────────────────────┘
            ┌─────────────┼───────────────────────────────────┐
            │             │                                   │
    ┌───────▼────────┐ ┌──▼────────────────────┐  ┌─────────▼──────────┐
    │    MongoDB     │ │ Redis + BullMQ        │  │ Google Gemini API  │
    │  (Mongoose)    │ │                       │  │ (gemini-2.5-flash) │
    │                │ │ ┌──────────────────┐ │  │                    │
    │ 10 Models:     │ │ │ Queue: "schedule"│ │  │ AI Recommendations │
    │ • User         │ │ │                  │ │  │ & Scheduling       │
    │ • Task         │ │ │ Retry Policy:    │ │  │                    │
    │ • Note         │ │ │ • 3 attempts     │ │  │ Rate Limit: 15 rpm │
    │ • Chat         │ │ │ • Exponential    │ │  │                    │
    │ • Badge        │ │ │   backoff        │ │  └────────────────────┘
    │ • UserStats    │ │ │                  │ │
    │ • CompletionTime
    │ • etc.         │ │ └──────────────────┘ │  ┌──────────────────┐
    └────────────────┘ │                       │  │   Email Service  │
                       │ ┌──────────────────┐ │  │  (Nodemailer)    │
                       │ │ Worker Process   │ │  │                  │
                       │ │ scheduleWorker.js│ │  │ Template Driven  │
                       │ │                  │ │  └──────────────────┘
                       │ │ Processes:       │ │
                       │ │ • Job handling   │ │
                       │ │ • Scoring tasks  │ │
                       │ │ • Gemini calls   │ │
                       │ │ • Result storage │ │
                       │ └──────────────────┘ │
                       └──────────────────────┘
```

**Request & Job Flow:**

1. **Synchronous Requests (REST API):**
   - React client authenticates via Clerk and sends API requests
   - Express middleware verifies Clerk token
   - Route handlers process CRUD operations and business logic
   - Results persisted to MongoDB via Mongoose
   - Immediate response returned to client

2. **Asynchronous Jobs (BullMQ):**
   - API endpoint enqueues job into Redis BullMQ queue
   - Response with `jobId` sent immediately to client
   - Standalone Worker process polls queue
   - Worker processes job (e.g., AI scheduling, email)
   - Result stored in MongoDB (e.g., `ScheduleJob` model)
   - Client polls GET endpoint to check job status
   - UI updates when job completes

3. **Background Scheduling (node-cron):**
   - Scheduled tasks run at fixed intervals
   - Notifications sent for overdue tasks, reminders
   - Uses `notificationScheduler.js` and `notificationService.js`

---

## Core Components

### 1. **Express API Server** (`server.js`)
- Main application server on port 5000
- Handles REST API requests
- Initializes BullMQ queue and worker
- Configures CORS for local dev and production
- Sets up MongoDB and Redis connections

### 2. **BullMQ Queue System** (`queues/scheduleQueue.js`)
- Single Redis-backed queue named `"schedule"`
- Shared between API (enqueue) and Worker (process)
- **Retry Policy:**
  - Max 3 attempts per job
  - Exponential backoff: 1s → 2s → 4s
  - Keeps last 100 completed & 50 failed jobs

### 3. **Standalone Worker** (`workers/scheduleWorker.js`)
- Separate process that consumes "schedule" queue
- Runs independently: `node workers/scheduleWorker.js` (prod) or `nodemon workers/scheduleWorker.js` (dev)
- Responsibilities:
  - Fetch job payload (userId, taskIds, prompt)
  - Load task docs from MongoDB
  - Call Gemini AI for scheduling recommendations
  - Store results in `ScheduleJob` collection
  - Handle retries and errors gracefully

### 4. **API Routes** (`routes/`)
- **`taskRoutes.js`** — Create, read, update, delete tasks; trigger scoring & analytics
- **`noteRoutes.js`** — Manage notes (CRUD, archive, trash, reminders)
- **`chatRoutes.js`** — Real-time chat endpoint (chat history, user interactions)
- **`aiRoutes.js`** — Enqueue schedule jobs, check status, get recommendations
- **`notificationRoutes.js`** — Get user notifications, mark as read
- **`authRoutes.js`** — Authentication endpoints with Clerk integration

### 5. **Service Utilities** (`utils/`)
- **`scheduleScoring.js`** — Task priority scoring (urgency + effort)
- **`notificationScheduler.js`** — node-cron scheduler for background jobs
- **`notificationService.js`** — Email template rendering & delivery
- **`badgeManager.js`** — Badge progression & milestone checks
- **`productivityManager.js`** — Productivity score calculations
- **`analyticsManager.js`** — Completion tracking, streak logic
- **`statsManager.js`** — User statistics aggregation
- **`emailTemplates.js`** — HTML email templates

### 6. **Data Models** (`models/`)
- **`User.js`** — User profile with Clerk integration
- **`Task.js`** — Task records with priority, due date, category, status
- **`NoteForm.js`** — Rich text notes with pin/archive/trash/reminder
- **`Chat.js`** — Chat message history
- **`ScheduleJob.js`** — Async job records (Gemini recommendations)
- **`Badge.js`** — Badge achievements & milestones
- **`CompletionStreak.js`** — Daily completion streaks
- **`CompletionTime.js`** — Task completion timestamps
- **`ProductivityScore.js`** — Productivity metrics
- **`UserStats.js`** — Aggregated user statistics

### 7. **Middleware** (`middleware/`)
- **`clerkAuth.js`** — Clerk authentication & token verification

### 8. **Configuration** (`config/`)
- **`db.js`** — MongoDB Mongoose connection
- **`redis.js`** — Redis connection for BullMQ (supports local, Upstash, Redis Cloud)

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 | Modern UI framework with hooks |
| Vite v6 | Lightning-fast build tool & dev server |
| React Router DOM v7 | Client-side routing & navigation |
| Tailwind CSS v4 | Utility-first CSS styling |
| Material UI (MUI) v7 | Pre-built component library |
| Framer Motion | Smooth animations & transitions |
| Recharts v3 | Interactive analytics charts |
| TipTap v2 | Headless rich text editor |
| Clerk React v5 | User authentication & management |
| Lucide React / React Icons | Icon libraries |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express v4 | REST API server & routing |
| Mongoose v7 | MongoDB schema & ODM |
| BullMQ v6 | Redis-backed job queue (RabbitMQ alternative) |
| ioredis v6 | Redis client for BullMQ |
| @google/generative-ai | Gemini AI API integration |
| Clerk Backend SDK | Server-side token verification |
| node-cron v3 | Scheduled background tasks |
| Nodemailer v8 | SMTP email delivery |
| bcryptjs v2 | Password hashing |
| jsonwebtoken v9 | JWT token generation |
| Jest v29 | Testing framework |
| dotenv v16 | Environment variable management |

### Infrastructure
| Technology | Purpose |
|---|---|
| MongoDB | NoSQL database (Atlas or self-hosted) |
| Redis | In-memory cache & BullMQ message broker |
| Clerk | Identity & access management (IAM) |
| Google Gemini API | AI model for recommendations |
| Nodemailer/SMTP | Email delivery |
| Docker | Containerization (optional) |

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

### 5. Set up Redis (for BullMQ)

ChronoSync uses Redis for the BullMQ message queue. You have three options:

**Option A: Local Redis (Development)**
```bash
# On Windows, using WSL2 or Docker:
docker run -d -p 6379:6379 redis:latest

# Or install Redis natively and start the server
redis-server
```

**Option B: Docker Compose (Recommended for Dev)**
```yaml
# In the project root, create docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:latest
    ports:
      - "6379:6379"
  
  mongodb:
    image: mongo:latest
    environment:
      MONGO_INITDB_DATABASE: chronosyncDB
    ports:
      - "27017:27017"
```

Then run:
```bash
docker-compose up -d
```

**Option C: Cloud Redis (Production)**
- [Redis Cloud](https://redis.com/cloud/) (managed service)
- [Upstash](https://upstash.com) (serverless Redis)
- [AWS ElastiCache](https://aws.amazon.com/elasticache/)

Update `.env`:
```env
REDIS_URL=redis://:your_password@your_host:your_port
```

### 6. Run the Worker Process

The BullMQ worker is a separate Node.js process that consumes jobs from the Redis queue.

**In a third terminal (with server running):**

```bash
cd server
npm run dev:worker
```

Or in production:
```bash
node workers/scheduleWorker.js
```

The worker will display:
```
Worker started, listening for jobs on "schedule" queue...
```

> **Important:** The worker is a separate process. You need 3 terminals running:
> - Terminal 1: `cd server && npm run dev` (Express API server)
> - Terminal 2: `cd client && npm run dev` (React frontend)
> - Terminal 3: `cd server && npm run dev:worker` (BullMQ worker)

### 7. Docker Deployment

A `Dockerfile` is included in `server/`. For production:

```bash
docker build -t chronosync-server ./server
docker run \
  -p 5000:5000 \
  -e MONGO_URI=your_mongo_uri \
  -e CLERK_SECRET_KEY=your_clerk_key \
  -e GEMINI_API_KEY=your_gemini_key \
  -e REDIS_URL=your_redis_url \
  chronosync-server
```

To run both the API and worker in separate containers:
```bash
# Start API server
docker run -p 5000:5000 --env-file .env chronosync-server npm start

# Start worker in a separate container
docker run --env-file .env chronosync-server npm run worker
```

---

## Key Services

### AI Scheduling & Gemini Integration

**File:** `utils/scheduleScoring.js`, `routes/aiRoutes.js`, `workers/scheduleWorker.js`

The AI scheduling service uses Google Gemini to intelligently prioritize tasks:

1. **Task Scoring:** Each task is assigned a composite score based on:
   - Priority (high/medium/low)
   - Urgency (overdue/today/tomorrow/week/later)
   - Estimated duration
   - Category urgency

2. **Job Enqueuing (aiRoutes.js):**
   ```javascript
   POST /api/ai/schedule
   {
     taskIds: ["507f1f77bcf86cd799439011", ...],
     prompt: "I have 30 min available, what should I focus on?"
   }
   ```
   Returns immediately with `jobId`.

3. **Async Processing (scheduleWorker.js):**
   - Worker receives job from Redis queue
   - Fetches task documents from MongoDB
   - Sends task list + prompt to Gemini API
   - Handles rate limiting (15 req/min) with exponential backoff
   - Stores recommendation in `ScheduleJob` collection

4. **Status Polling (aiRoutes.js):**
   ```javascript
   GET /api/ai/schedule/:jobId
   ```
   Client polls this endpoint until `status === "complete"`

### Notification System

**Files:** `utils/notificationScheduler.js`, `utils/notificationService.js`

Uses `node-cron` to trigger background jobs at fixed intervals:

- **Overdue Task Emails:** Runs every hour, finds overdue tasks, sends SMTP emails
- **Reminder Emails:** Checks tasks with reminder dates, sends template-based emails
- **Email Template Rendering:** HTML templates with user-friendly formatting

### Badge & Achievement System

**File:** `utils/badgeManager.js`

Implements progressive badge milestones:

- **Task Completion Track:** 
  - Task Initiate (5 tasks) → Task Navigator (15) → Task Master (50) → Task Legend (100)
  
- **Streak Track:**
  - Streak Starter (3 days) → Streak Champion (7 days) → Streak Titan (30 days)

Badges are awarded automatically when thresholds are reached. Metadata stored in `Badge` collection.

### Productivity Scoring

**File:** `utils/productivityManager.js`

Calculates a dynamic productivity score based on:

- Task completion rate
- Priority weighting (high-priority tasks worth more points)
- Daily consistency
- Category performance

### Analytics Engine

**Files:** `utils/analyticsManager.js`, `utils/statsManager.js`

Tracks:

- **Completion Streaks:** Consecutive days of task completions
- **Completion Times:** Historical task completion timestamps
- **Weekly Trends:** Week-over-week comparisons
- **Category Breakdown:** Performance by task category

---

## Database Models

ChronoSync uses Mongoose for schema validation and MongoDB for persistence. Here's the complete data model:

### Core Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| **User** | User profile & authentication | userId (Clerk), email, name, avatar |
| **Task** | Task records | title, description, priority, category, dueDate, status, completedAt, estimatedTime |
| **NoteForm** | Rich text notes | title, content, pinned, archived, trashed, reminders, tags |
| **Chat** | Chat history | userId, role (user/assistant), content, timestamp |
| **ScheduleJob** | Async AI job results | userId, taskIds, prompt, status, result, error, createdAt |
| **Badge** | Achievement tracking | userId, type (task/streak), level, unlockedAt |
| **CompletionStreak** | Daily streaks | userId, currentStreak, maxStreak, lastCompletionDate |
| **CompletionTime** | Task timestamps | userId, taskId, completedAt |
| **ProductivityScore** | Productivity metrics | userId, score, date, factors |
| **UserStats** | Aggregated stats | userId, totalTasks, completedTasks, totalNotes, etc. |

### Relationship Flow

```
User (1) ──┬──→ (N) Task
           ├──→ (N) NoteForm
           ├──→ (N) Chat
           ├──→ (N) Badge
           ├──→ (N) ScheduleJob
           ├──→ (1) CompletionStreak
           ├──→ (N) CompletionTime
           ├──→ (N) ProductivityScore
           └──→ (1) UserStats
```

### Sample Query Examples

**Get user's pending tasks with latest updates:**
```javascript
Task.find({ 
  user: userId, 
  completed: false 
}).sort({ dueDate: 1 }).limit(20);
```

**Find completed tasks for analytics:**
```javascript
Task.find({
  user: userId,
  completed: true,
  completedAt: { $gte: lastWeek, $lte: now }
}).sort({ completedAt: -1 });
```

**Get user's achievement badges:**
```javascript
Badge.find({ userId }).sort({ unlockedAt: -1 });
```

---

## API Endpoints Overview

### Tasks
- `POST /api/tasks` — Create task
- `GET /api/tasks` — Get all user tasks
- `PUT /api/tasks/:id` — Update task
- `DELETE /api/tasks/:id` — Delete task
- `PATCH /api/tasks/:id/complete` — Mark task complete

### Notes
- `POST /api/notes` — Create note
- `GET /api/notes` — Get all notes
- `PUT /api/notes/:id` — Update note
- `DELETE /api/notes/:id` — Delete note
- `PATCH /api/notes/:id/archive` — Archive note
- `PATCH /api/notes/:id/pin` — Pin/unpin note

### AI & Scheduling
- `POST /api/ai/schedule` — Enqueue schedule job
- `GET /api/ai/schedule/:jobId` — Check job status & results

### Chat
- `GET /api/chat/:userId` — Get chat history
- `POST /api/chat` — Send chat message

### Notifications
- `GET /api/notifications` — Get user notifications
- `PATCH /api/notifications/:id/read` — Mark as read

### Auth
- `GET /api/auth/profile` — Get user profile
- `POST /api/auth/logout` — Logout user

---

## Environment Variables Reference

### Server (`.env` in `server/` folder)

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/chronosyncDB

# Authentication
CLERK_SECRET_KEY=sk_test_xxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxx

# AI
GEMINI_API_KEY=your_gemini_api_key

# Redis & BullMQ
REDIS_URL=redis://localhost:6379
# Format: redis://:<password>@<host>:<port>
# For Upstash: rediss://default:<password>@<host>:<port>

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Environment
DEBUG=false
```

### Client (`.env.local` in `client/` folder)

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxx
VITE_API_BASE_URL=http://localhost:5000/api
```

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

🚀 **Hosted Application:** [ChronoSync](https://chronosync-1.onrender.com)  
📱 **Frontend:** Deployed on Vercel  
⚙️ **Backend API:** Deployed on Render  
🗄️ **Database:** MongoDB Atlas  
📨 **Queue System:** Redis (Upstash for serverless)

---

## Production Deployment Guide

### Architecture for Production

```
┌──────────────────────────────────────────────────────────────────┐
│                    CDN / Load Balancer                            │
└─────────────────────────────┬──────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
    ┌───▼────┐          ┌────▼────┐         ┌─────▼──┐
    │ Vercel │          │ Render   │  ┌──────┤ Render │
    │ React  │          │ API-01   │  │      │ Worker │
    │ (CDN)  │          └────┬─────┘  │      └────────┘
    └────────┘               │        │
                    ┌────────┴───┬────┘
                    │            │
                ┌───▼──┐     ┌───▼──────┐
                │ API  │     │ API      │
                │ 02   │     │ 03       │
                └────┬─┘     └──┬───────┘
                     │          │
        ┌────────────┴──────────┘
        │
    ┌───▼─────────────────────────┐
    │   MongoDB Atlas Cluster      │
    │ (Replica Set - 3 nodes)      │
    └──────────────────────────────┘
        ▲
        │
    ┌───┴──────────────────────────┐
    │  Upstash Redis (Serverless)   │
    │  BullMQ Queue Storage         │
    └───────────────────────────────┘
```

### Deployment Steps

#### 1. Prepare Server for Render

Create `render.yaml` in root:
```yaml
services:
  - type: web
    name: chronosync-api
    runtime: node
    buildCommand: "cd server && npm install"
    startCommand: "cd server && npm start"
    envVars:
      - key: MONGO_URI
        sync: false
      - key: CLERK_SECRET_KEY
        sync: false
      - key: REDIS_URL
        sync: false
      - key: GEMINI_API_KEY
        sync: false

  - type: worker
    name: chronosync-worker
    runtime: node
    buildCommand: "cd server && npm install"
    startCommand: "cd server && npm run worker"
    envVars:
      - key: MONGO_URI
        sync: false
      - key: REDIS_URL
        sync: false
      - key: GEMINI_API_KEY
        sync: false
```

#### 2. Deploy to Render

1. Push code to GitHub
2. Login to [Render](https://render.com)
3. Click "New" → "Web Service"
4. Connect GitHub repository
5. Set environment variables in Render dashboard
6. Deploy

#### 3. Deploy Frontend to Vercel

1. Push `client/` folder to GitHub
2. Login to [Vercel](https://vercel.com)
3. Click "Import Project"
4. Select the repository
5. Set build command: `npm run build`
6. Set environment variables
7. Deploy

#### 4. Configure Redis on Upstash

1. Create account on [Upstash](https://upstash.com)
2. Create new Redis database
3. Copy connection string
4. Add to server environment: `REDIS_URL=rediss://...`

### Scaling Considerations

**For 10,000+ Concurrent Users:**

1. **Database Scaling:**
   - Use MongoDB Atlas with replica sets
   - Enable auto-scaling
   - Set up read replicas for analytics queries

2. **API Server Scaling:**
   - Deploy multiple API instances behind load balancer
   - Each instance can handle ~100 concurrent connections
   - Use connection pooling with MongoDB

3. **Worker Scaling:**
   - Deploy multiple worker processes
   - Each worker can handle ~50 jobs/minute
   - Monitor queue depth and scale up if needed

4. **Redis Scaling:**
   - Use Redis Cluster for horizontal scaling
   - Monitor memory usage (BullMQ keeps job history)
   - Set appropriate job expiration times

**Monitoring & Observability:**
- Set up error tracking (Sentry)
- Monitor Redis queue depth and job processing time
- Log worker errors and retries
- Set up email alerts for critical failures

---

## Troubleshooting

### Common Issues & Solutions

#### ❌ "Worker not processing jobs"

**Check 1:** Is the worker process running?
```bash
ps aux | grep scheduleWorker
```

**Check 2:** Is Redis connected?
```bash
cd server
npm run dev:worker
# Look for: "Worker started, listening for queue 'schedule'..."
```

**Check 3:** Check Redis connection string
```env
# Verify REDIS_URL format in .env
redis://localhost:6379  # Local
rediss://default:password@host:port  # Upstash
```

#### ❌ "Gemini API rate limit exceeded"

**Solution:** The worker implements exponential backoff, but if still hitting limits:
- Upgrade Gemini API plan
- Add request throttling in `workers/scheduleWorker.js`
- Increase delay between retries (currently 600ms base)

#### ❌ "MongoDB connection timeout"

**Solution:**
- Verify `MONGO_URI` is correct
- Check MongoDB Atlas IP whitelist
- Ensure network connectivity
- Check connection string for authentication issues

#### ❌ "Clerk authentication failing"

**Solution:**
- Verify `CLERK_SECRET_KEY` matches your account
- Check token format (should be in Authorization header)
- Ensure Clerk frontend & backend keys match

#### ❌ "Redis memory exceeded"

**Solution:**
- Reduce job history: modify `removeOnComplete` count in `scheduleQueue.js`
- Monitor queue size: `redis-cli LLEN bull:schedule:jobs`
- Clean up old jobs manually if needed

---

## Architecture Decisions

### Why BullMQ + Redis?

1. **Reliability:** Jobs persist in Redis even if worker crashes
2. **Scalability:** Multiple workers can consume same queue
3. **Retry Logic:** Built-in exponential backoff and retry policy
4. **Observability:** Job history and debugging capabilities
5. **Decoupling:** API doesn't wait for long-running tasks

**Alternatives considered:**
- AWS SQS (no local development story)
- RabbitMQ (more complex, requires separate broker)
- node-cron only (can't scale to multiple processes)

### Why Mongoose?

1. **Schema Validation:** Enforces data integrity
2. **Rich Querying:** Chainable query builder
3. **Middleware Hooks:** Pre/post save hooks for business logic
4. **Indexing:** Simple API for MongoDB indexes
5. **Ecosystem:** Large community and plugins

### Why Google Gemini?

1. **Cost-effective:** Pay-per-request model
2. **Context Understanding:** Gemini understands task schedules well
3. **Availability:** Generous free tier for development
4. **Rate Limiting:** Clear limits (15 req/min) for scaling

---

## File Structure Summary

```
ChronoSync/
├── client/                          # React Frontend (Vite)
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   ├── container/               # Page containers
│   │   ├── context/                 # React Context (Auth, Theme)
│   │   ├── pages/                   # Page routing
│   │   └── utils/                   # Helper functions
│   └── vite.config.js
│
├── server/                          # Node.js Backend
│   ├── config/                      # Configuration
│   │   ├── db.js                    # MongoDB connection
│   │   └── redis.js                 # Redis connection
│   │
│   ├── models/                      # Mongoose schemas (10 models)
│   │   ├── User.js
│   │   ├── Task.js
│   │   ├── NoteForm.js
│   │   ├── Badge.js
│   │   └── ...
│   │
│   ├── routes/                      # API endpoints
│   │   ├── taskRoutes.js
│   │   ├── noteRoutes.js
│   │   ├── aiRoutes.js              # AI scheduling endpoints
│   │   ├── chatRoutes.js
│   │   ├── notificationRoutes.js
│   │   └── authRoutes.js
│   │
│   ├── queues/                      # BullMQ job queues
│   │   └── scheduleQueue.js         # Main job queue definition
│   │
│   ├── workers/                     # Job processors
│   │   └── scheduleWorker.js        # Standalone worker process
│   │
│   ├── utils/                       # Business logic & services
│   │   ├── scheduleScoring.js       # Task scoring algorithm
│   │   ├── notificationScheduler.js # Cron jobs
│   │   ├── notificationService.js   # Email delivery
│   │   ├── badgeManager.js          # Badge progression
│   │   ├── productivityManager.js   # Productivity tracking
│   │   ├── analyticsManager.js      # Analytics computation
│   │   ├── statsManager.js          # Statistics aggregation
│   │   └── emailTemplates.js        # Email templates
│   │
│   ├── middleware/                  # Express middleware
│   │   └── clerkAuth.js             # Authentication middleware
│   │
│   ├── server.js                    # Main Express app
│   ├── package.json                 # Backend dependencies
│   └── Dockerfile                   # Docker configuration
│
├── README.md                        # This file
├── ENV_SETUP.md                     # Environment setup guide
├── GEMINI_SETUP.md                  # Gemini API setup guide
└── .env.example                     # Environment template
```

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use consistent indentation (2 spaces)
- Follow naming conventions (camelCase for variables, PascalCase for components)
- Add JSDoc comments for complex functions
- Write tests for new features

---

## Support & Contact

Have questions or found a bug? 

- 📧 Email: [your-email@example.com](mailto:your-email@example.com)
- 🐛 Issues: [GitHub Issues](https://github.com/imsachin001/ChronoSync/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/imsachin001/ChronoSync/discussions)

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- **Google Gemini AI** for intelligent scheduling recommendations
- **Clerk** for secure authentication
- **MongoDB & Mongoose** for robust data persistence
- **BullMQ & Redis** for reliable async job processing
- **React & Vite** for modern frontend tooling
- **Express.js** for elegant backend framework

---

**Made with ❤️ by [imsachin001](https://github.com/imsachin001)**
