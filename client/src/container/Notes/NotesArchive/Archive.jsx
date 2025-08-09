import React, { useState, useEffect } from 'react';
import NotesList from '../NotesList/NotesList';
import './Archive.css';
import { useAuth } from '../../../context/AuthContext';

const Archive = () => {
  const { getToken } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleUnarchive = async (noteId) => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`/api/notes/${noteId}/unarchive`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to unarchive note');
      
      setNotes(prevNotes => 
        prevNotes.map(note => 
          note._id === noteId 
            ? { ...note, archived: false }
            : note
        )
      );
    } catch (err) {
      console.error('Error unarchiving note:', err);
    }
  };

  return (
    <div className='notes-container'>
      <h2 className='notes-archived'>Archived Notes</h2>
      <NotesList
        notes={notes.filter(note => note.archived && !note.trashed)}
        loading={loading}
        onPin={() => {}}
        onArchive={() => {}}
        onUnarchive={handleUnarchive}
        onTrash={() => {}}
        onDelete={() => {}}
      />
    </div>
  );
};

export default Archive;
