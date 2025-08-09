import express from 'express';
import { verifyToken } from '@clerk/backend';
import Chat from '../models/Chat.js';

const router = express.Router();

// Middleware to verify Clerk token
const verifyTokenMiddleware = async (req, res, next) => {
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

// Create a new chat
router.post('/', verifyTokenMiddleware, async (req, res) => {
  try {
    const { title, messages } = req.body;
    
    console.log('Chat creation request:', { title, messageCount: messages?.length });
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: 'Messages are required and must be an array' });
    }
    
    // Validate message format
    const validMessages = messages.every(msg => 
      msg.type && ['system', 'user', 'ai'].includes(msg.type) && 
      msg.content && typeof msg.content === 'string'
    );
    
    if (!validMessages) {
      return res.status(400).json({ 
        message: 'Invalid message format. Each message must have type (system, user, or ai) and content.'
      });
    }
    
    const newChat = new Chat({
      title: title || 'Untitled Chat',
      messages,
      user: req.userId
    });
    
    console.log('Saving chat to database...');
    await newChat.save();
    console.log('Chat saved successfully with ID:', newChat._id);
    
    res.status(201).json(newChat);
  } catch (error) {
    console.error('Error saving chat:', error);
    res.status(500).json({ 
      message: 'Error saving chat',
      error: error.message
    });
  }
});

// Get all chats for the authenticated user
router.get('/', verifyTokenMiddleware, async (req, res) => {
  try {
    const userChats = await Chat.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json(userChats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ message: 'Error fetching chats' });
  }
});

// Get a specific chat by ID
router.get('/:id', verifyTokenMiddleware, async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, user: req.userId });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    res.json(chat);
  } catch (error) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ message: 'Error fetching chat' });
  }
});

// Delete a chat
router.delete('/:id', verifyTokenMiddleware, async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({ _id: req.params.id, user: req.userId });
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ message: 'Error deleting chat' });
  }
});

export default router; 