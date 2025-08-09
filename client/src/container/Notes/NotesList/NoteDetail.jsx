import React, { useState } from 'react';
import './NoteDetail.css';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';

const NoteDetail = ({ note, onClose, onEdit }) => {
  const { theme } = useTheme();
  if (!note) return null;

  return (
    <div className={`note-detail-modal${theme === 'dark' ? ' dark' : ''}`}>
      <div className={`note-detail-content${theme === 'dark' ? ' dark' : ''}`}>
        <button className="note-detail-close" onClick={onClose}>&times;</button>
        <h2>{note.title || 'Untitled'}</h2>
        <div
              className="note-detail-body"
              dangerouslySetInnerHTML={{ __html: note.content }}
        ></div>
        <div className='note-detail-body'>⏰ {new Date(note.reminder).toLocaleString()}</div>
        <div className="note-detail-footer">
          <button className="note-detail-edit" onClick={() => onEdit(note)}>Edit</button>
        </div>
      </div>
    </div>
  );
};

export default NoteDetail; 