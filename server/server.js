import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import taskRoutes from "./routes/taskRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import { clerkAuth } from "./middleware/clerkAuth.js";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"], // Allow both Vite dev server ports
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/chronosyncDB")
.then(() => {
  console.log("MongoDB connected successfully!");
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

// Add server health check
app.get('/api/status', (req, res) => {
  res.json({
    server: 'running',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Start Server
app.listen(5000, () => console.log("Server running on port 5000"));
