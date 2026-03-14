# ChronoSync

**ChronoSync** is a full-stack productivity and task management application that combines smart scheduling, rich note-taking, AI assistance, and analytics into a single cohesive workspace.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
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

## Live Demo

> 
