import React, { useState, useEffect } from 'react';
import NotesList from '../NotesList/NotesList';
import './Trash.css'
import { useAuth } from '../../../context/AuthContext';

const Trash = () => {
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

    const handleRestoreFromTrash = async (noteId) => {
        try {
            const token = await getToken();
            if (!token) return;

            const response = await fetch(`/api/notes/${noteId}/trash`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
            });

            if (!response.ok) throw new Error('Failed to restore note from trash');
            
            setNotes(prevNotes => 
                prevNotes.map(note => 
                    note._id === noteId 
                        ? { ...note, trashed: false }
                        : note
                )
            );
        } catch (err) {
            console.error('Error restoring note from trash:', err);
        }
    };

    const handlePermanentDelete = async (noteId) => {
        try {
            const token = await getToken();
            if (!token) return;

            const response = await fetch(`/api/notes/${noteId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
            });

            if (!response.ok) throw new Error('Failed to permanently delete note');
            
            setNotes(prevNotes => prevNotes.filter(note => note._id !== noteId));
        } catch (err) {
            console.error('Error permanently deleting note:', err);
        }
    };
    
    return (
        <div className='notes-container'>
            <h2 className='notes-trash'>Trash</h2>
            <NotesList
                notes={notes.filter(note => note.trashed)}
                loading={loading}
                onPin={() => {}}
                onArchive={() => {}}
                onTrash={handleRestoreFromTrash}
                onDelete={handlePermanentDelete}
            />
        </div>
    );
}

export default Trash;