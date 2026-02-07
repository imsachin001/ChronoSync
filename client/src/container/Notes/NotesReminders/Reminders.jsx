import React, { useState, useEffect } from 'react';
import NotesList from '../NotesList/NotesList';
import NotesForm from '../NotesForm/NotesForm';
import './Reminders.css';
import { useAuth } from '../../../context/AuthContext';

const Reminders = () => {
  const { getToken } = useAuth();
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
      const token = await getToken();
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
      console.log('All fetched notes:', data);
      console.log('Notes with reminders:', data.filter(note => note.reminder));
      setNotes(data);
    } catch (err) {
      console.error('Error fetching Notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    // Format reminder for datetime-local input
    let formattedReminder = null;
    if (note.reminder) {
      try {
        const reminderDate = new Date(note.reminder);
        if (!isNaN(reminderDate.getTime())) {
          // Convert to local datetime string format (YYYY-MM-DDTHH:mm)
          formattedReminder = new Date(reminderDate.getTime() - reminderDate.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        }
      } catch (e) {
        console.error('Error formatting reminder:', e);
      }
    }
    setNewNote({
      title: note.title || '',
      content: note.content || '',
      pinned: note.pinned || false,
      archived: note.archived || false,
      trashed: note.trashed || false,
      reminder: formattedReminder,
    });
    setShowNoteForm(true);
  };

  const handleSaveNote = async () => {
    if (!newNote.content.trim()) return;
    try {
      const token = await getToken();
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
      
      // Show success message with special notification for reminders
      if (noteToSend.reminder) {
        alert(editingNote 
          ? '✅ Note updated successfully! Reminder has been set and the note is visible in the Reminders section.' 
          : '✅ Note added successfully! Your reminder has been set and the note is now visible in the Reminders section.');
      } else {
        alert(editingNote ? '✅ Note updated successfully!' : '✅ Note added successfully!');
      }
      
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
      alert('❌ Failed to save note. Please try again.');
    }
  };

  const handlePin = async (id) => {
    try {
      const token = await getToken();
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
      const token = await getToken();
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
          console.log('Checking note:', { 
            id: note._id, 
            title: note.title, 
            reminder: note.reminder, 
            archived: note.archived, 
            trashed: note.trashed 
          });
          if (!note.reminder || note.archived || note.trashed) {
            console.log('Note filtered out - no reminder or archived/trashed');
            return false;
          }
          const reminderDate = new Date(note.reminder);
          const isValid = !isNaN(reminderDate.getTime());
          console.log('Reminder date valid?', isValid, reminderDate);
          return isValid;
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
