import express from 'express';
import Note from '../models/NoteForm.js';
import { verifyToken } from '@clerk/backend';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// ---------------------------
// Middleware: verify Clerk token
// ---------------------------
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



// ---------------------------
// POST /notes -> Create Note
// ---------------------------
router.post('/', verifyTokenMiddleware, async (req, res) => {
  try {
    const {
      title,
      content,
      pinned,
      archived,
      trashed,
      tags,
      reminder
    } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Note content is required' });
    }

    console.log('Creating note with reminder:', reminder);
    const reminderDate = reminder ? new Date(reminder) : null;
    console.log('Parsed reminder date:', reminderDate);

    const note = new Note({
      title,
      content,
      pinned: pinned || false,
      archived: archived || false,
      trashed: trashed || false,
      tags: tags || [],
      reminder: reminderDate,
      user: req.userId
    });

    await note.save();
    console.log('Note saved:', { id: note._id, reminder: note.reminder });
    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ message: 'Error creating note', error: error.message });
  }
});


// ---------------------------
// GET /notes -> Fetch All Notes for User
// ---------------------------
router.get('/', verifyTokenMiddleware, async (req, res) => {
  try {
    const notes = await Note.find({ user: req.userId }).sort({ updatedAt: -1 });
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ message: 'Error fetching notes' });
  }
});

// PATCH /notes/:id -> Update Note
router.patch('/:id', verifyTokenMiddleware, async (req, res) => {
  try {
    const updateData = { ...req.body, updatedAt: new Date() };
    if (updateData.reminder) {
      updateData.reminder = new Date(updateData.reminder);
    }
    if (updateData.reminder === '' || updateData.reminder === null) {
      updateData.reminder = null;
    }
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: updateData },
      { new: true }
    );
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json(note);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ message: 'Error updating note', error: error.message });
  }
});


// ---------------------------
// PATCH /notes/:id/toggle-pin -> Toggle pinned
// ---------------------------
router.patch('/:id/toggle-pin', verifyTokenMiddleware, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, user: req.userId });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    note.pinned = !note.pinned;
    note.updatedAt = new Date();
    await note.save();

    res.json(note);
  } catch (error) {
    console.error('Error toggling pin:', error);
    res.status(500).json({ message: 'Error toggling pin' });
  }
});


// ---------------------------
// PATCH /notes/:id/archive -> Toggle archived
// ---------------------------
router.patch('/:id/archive', verifyTokenMiddleware, async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: { archived: true, updatedAt: new Date() } },
      { new: true }
    );
    if (!note) return res.status(404).json({ message: 'Note not found' });

    res.json(note);
  } catch (error) {
    console.error('Error archiving note:', error);
    res.status(500).json({ message: 'Error archiving note' });
  }
});

// ---------------------------
// PATCH /notes/:id/unarchive -> Unarchive Note
// ---------------------------
router.patch('/:id/unarchive', verifyTokenMiddleware, async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: { archived: false, updatedAt: new Date() } },
      { new: true }
    );
    if (!note) return res.status(404).json({ message: 'Note not found' });

    res.json(note);
  } catch (error) {
    console.error('Error unarchiving note:', error);
    res.status(500).json({ message: 'Error unarchiving note' });
  }
});

// ---------------------------
// PATCH /notes/:id/trash -> Toggle trashed
// ---------------------------
router.patch('/:id/trash', verifyTokenMiddleware, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, user: req.userId });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    note.trashed = !note.trashed;
    note.updatedAt = new Date();
    await note.save();

    res.json(note);
  } catch (error) {
    console.error('Error toggling trash:', error);
    res.status(500).json({ message: 'Error toggling trash' });
  }
});


// ---------------------------
// DELETE /notes/:id -> Permanently Delete Note
// ---------------------------
router.delete('/:id', verifyTokenMiddleware, async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.userId });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    res.json({ message: 'Note deleted permanently' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ message: 'Error deleting note' });
  }
});

export default router;
