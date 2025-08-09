import React, { useState, useEffect } from 'react';
import NotesList from '../NotesList/NotesList';
import NotesForm from '../NotesForm/NotesForm';
import './Reminders.css';

const Reminders = () => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState(null);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [newNote, setNewNote] = useState({
      title: '',
      content: '',
      pinned: false,
      tags: [],
      archived: false,
      trashed: false,
      reminder: null,
  });

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      const response = await fetch('/api/notes', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch notes');
      const data = await response.json();
      setNotes(data);
    } catch (err) {
      console.error('Error fetching Notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    setNewNote({
      title: note.title || '',
      content: note.content || '',
      pinned: note.pinned || false,
      archived: note.archived || false,
      trashed: note.trashed || false,
      reminder: note.reminder || null,
    });
    setShowNoteForm(true);
  };

  const handleSaveNote = async () => {
    if (!newNote.content.trim()) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      let noteToSend = { ...newNote };
      if (!noteToSend.reminder) {
        noteToSend.reminder = null;
      }
      let response;
      if (editingNote) {
        response = await fetch(`/api/notes/${editingNote._id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(noteToSend),
          credentials: 'include',
        });
      } else {
        response = await fetch('/api/notes', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(noteToSend),
          credentials: 'include',
        });
      }
      if (!response.ok) throw new Error(editingNote ? 'Failed to update Note' : 'Failed to create Note');
      setNewNote({
        title: '',
        content: '',
        pinned: false,
        tags: [],
        archived: false,
        trashed: false,
        reminder: null,
      });
      setShowNoteForm(false);
      setEditingNote(null);
      fetchNotes();
    } catch (error) {
      console.error(editingNote ? 'Error updating Note:' : 'Error creating Note:', error);
    }
  };

  const handlePin = async (id) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await fetch(`/api/notes/${id}/toggle-pin`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      fetchNotes();
    } catch (error) {
      console.error('Error pinning note:', error);
    }
  };

  const handleTrash = async (id) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await fetch(`/api/notes/${id}/trash`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      fetchNotes();
    } catch (error) {
      console.error('Error trashing note:', error);
    }
  };

  return (
    <div className='notes-container'>
      <h2 className='notes-reminders'>Reminders</h2>
      <NotesList
        notes={notes.filter(note => {
          if (!note.reminder || note.archived || note.trashed) return false;
          const reminderDate = new Date(note.reminder);
          return !isNaN(reminderDate.getTime());
        })}
        loading={loading}
        onPin={handlePin}
        onTrash={handleTrash}
        onDelete={handleTrash}
        onEdit={handleEditNote}
      />
      <NotesForm
        show={showNoteForm}
        onClose={() => { setShowNoteForm(false); setEditingNote(null); }}
        onInputChange={e => setNewNote({ ...newNote, [e.target.name]: e.target.value })}
        onSave={handleSaveNote}
        newNote={newNote}
      />
    </div>
  );
};

export default Reminders;
