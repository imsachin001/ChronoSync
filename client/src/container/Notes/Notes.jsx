import React, { useState, useEffect } from 'react'
import NotesHeader from './NotesHeader/NotesHeader' 
import NotesList from './NotesList/NotesList'
import NotesForm from './NotesForm/NotesForm'
import "./Notes.css"
import { useAuth } from '../../context/AuthContext'

const Notes = () => {
  const { getToken } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState(null);

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
      setNotes(data);
    } catch (err) {
      console.error('Error fetching Notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowForm = () => setShowNoteForm(true);
  const handleHideForm = () => {
    setShowNoteForm(false);
    setEditingNote(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewNote((prev) => ({ ...prev, [name]: value }));
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
          ? '✅ Note updated successfully! Reminder has been set and will appear in the Reminders section.' 
          : '✅ Note added successfully! Your reminder has been set and the note will appear in the Reminders section.');
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

  const handleArchive = async (id) => {
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`/api/notes/${id}/archive`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      fetchNotes();
    } catch (error) {
      console.error('Error archiving note:', error);
    }
  };

  const handleUnarchive = async (id) => {
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`/api/notes/${id}/unarchive`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      fetchNotes();
    } catch (error) {
      console.error('Error unarchiving note:', error);
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

  const handleDelete = async (id) => {
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      fetchNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  return (
    <div className='notes-container'>
      <NotesHeader onShowForm={handleShowForm} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      <NotesForm
        show={showNoteForm}
        onClose={handleHideForm}
        onInputChange={handleInputChange}
        onSave={handleSaveNote}
        newNote={newNote}
      />
      <NotesList
        notes={notes.filter(note =>
          !note.archived &&
          !note.trashed &&
          !note.reminder &&
          (note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           note.content.toLowerCase().includes(searchQuery.toLowerCase()))
        )}
        loading={loading}
        onPin={handlePin}
        onArchive={handleArchive}
        onUnarchive={handleUnarchive}
        onTrash={handleTrash}
        onDelete={handleDelete}
        onEdit={handleEditNote}
      />
    </div>
  )
}

export default Notes

