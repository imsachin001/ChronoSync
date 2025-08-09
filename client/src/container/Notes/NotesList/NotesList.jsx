import React from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { FaThumbtack, FaArchive, FaBoxOpen, FaTrashRestore, FaTrash } from 'react-icons/fa';
import { useTheme } from '../../../context/ThemeContext';
import './NotesList.css';
import NoteDetail from './NoteDetail';
import { useState } from 'react';

const NotesList = ({ notes, loading, onPin, onArchive, onUnarchive, onTrash, onDelete, onEdit }) => {
  const { theme } = useTheme(); 
  const [selectedNote, setSelectedNote] = useState(null);

  if (loading) return <div className="notes-loading">Loading...</div>;
  if (!notes.length) return <div className="notes-empty">No notes yet.</div>;

  const sortedNotes = [...notes].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <>
      <div className={`notes-list ${theme === 'dark' ? 'dark' : ''}`}>  
        {sortedNotes.map(note => (
          <div
            className={`note-card${note.pinned ? ' pinned' : ''}${note.archived ? ' archived' : ''}${note.trashed ? ' trashed' : ''}${note.reminder && new Date(note.reminder) < new Date() ? ' overdue-reminder' : ''}`}
            key={note._id}
            onClick={e => {
              // Only open detail if not clicking an action button
              if (e.target.classList.contains('note-action-btn') || e.target.closest('.note-action-btn')) return;
              setSelectedNote(note);
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="note-card-header">
              <div className="note-card-title">{note.title || <span className="note-card-untitled">Untitled</span>}
                {note.reminder && (
                  <span className={`note-reminder-label${new Date(note.reminder) < new Date() ? ' overdue' : ''}`}></span>
                )}
              </div>
              <div className="note-card-actions">
                {!note.trashed && (
                  <>
                    <button 
                      className={`note-action-btn${note.pinned ? ' active' : ''}`} 
                      title={note.pinned ? 'Unpin' : 'Pin'} 
                      onClick={() => onPin(note._id)}
                    >
                      <FaThumbtack />
                    </button>
                    {note.archived ? (
                      <button 
                        className="note-action-btn" 
                        title="Unarchive" 
                        onClick={() => onUnarchive(note._id)}
                      >
                        <FaBoxOpen />
                      </button>
                    ) : (
                      <button 
                        className="note-action-btn" 
                        title="Archive" 
                        onClick={() => onArchive(note._id)}
                      >
                        <FaArchive />
                      </button>
                    )}
                  </>
                )}
                {note.trashed ? (
                  <>
                    <button 
                      className="note-action-btn" 
                      title="Restore from Trash" 
                      onClick={() => onTrash(note._id)}
                    >
                      <FaTrashRestore />
                    </button>
                    <button 
                      className="note-action-btn delete" 
                      title="Delete Permanently" 
                      onClick={() => {
                        if (window.confirm('Are you sure you want to permanently delete this note? This action cannot be undone.')) {
                          onDelete(note._id);
                        }
                      }}
                    >
                      <FaTrash />
                    </button>
                  </>
                ) : (
                  <button 
                    className="note-action-btn" 
                    title="Move to Trash" 
                    onClick={() => onTrash(note._id)}
                  >
                    <FiTrash2 />
                  </button>
                )}
              </div>
            </div>
            {/* <div className="note-card-content">{note.content.length > 120 ? note.content.slice(0, 120) + '…' : note.content}</div> */}
            <div
              className="note-card-content"
              dangerouslySetInnerHTML={{
                __html: note.content.length > 120
                  ? note.content.slice(0, 120) + '…'
                  : note.content
              }}
            ></div>

            {note.reminder && (
              <div className={`note-reminder-label${new Date(note.reminder) < new Date() ? ' overdue' : ''}`} style={{marginTop: '0.5em'}}>
                ⏰ {new Date(note.reminder).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
      <NoteDetail
        note={selectedNote}
        onClose={() => setSelectedNote(null)}
        onEdit={note => {
          setSelectedNote(null);
          if (onEdit) onEdit(note);
        }}
      />
    </>
  );
};

export default NotesList;
