import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import taskRoutes from "./routes/taskRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { clerkAuth } from "./middleware/clerkAuth.js";
import dotenv from 'dotenv';
import { initializeSchedulers } from "./utils/notificationScheduler.js";
import { testEmailConfiguration } from "./utils/notificationService.js";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

const app = express();
app.use(express.json());
app.use(cors({
  origin: "https://deployed-chronosync.vercel.app",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/chronosyncDB")
.then(() => {
  console.log("MongoDB connected successfully!");
  
  // Initialize notification schedulers after DB connection
  initializeSchedulers();
  
  // Test email configuration
  testEmailConfiguration();
})
.catch((err) => {
  console.error("MongoDB connection error:", err);
});

// Test authentication route using Clerk
app.get('/api/test-auth', clerkAuth, (req, res) => {
  res.json({ 
    message: 'Authentication successful',
    user: req.user
  });
});

// Use task routes with Clerk auth
app.use('/api/tasks', clerkAuth, taskRoutes);

// Use chat routes with Clerk auth
app.use('/api/chats', clerkAuth, chatRoutes);

// Use notes routes with Clerk auth
app.use('/api/notes', clerkAuth, noteRoutes);

// Use AI routes with Clerk auth
app.use('/api/ai', clerkAuth, aiRoutes);

// Use notification routes with Clerk auth
app.use('/api/notifications', clerkAuth, notificationRoutes);

// Add server health check
app.get('/api/status', (req, res) => {
  res.json({
    server: 'running',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Start Server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
