import React, {useState, useRef, useMemo} from 'react';
import './NotesForm.css';
import { useTheme } from '../../../context/ThemeContext';
import JoditEditor from 'jodit-react';
import { useAuth } from '../../../context/AuthContext';   

const NotesForm = ({ show, onClose, onInputChange, onSave, newNote }) => {
  const { getToken } = useAuth();
  const editor = useRef(null);  

  const config = useMemo(() => ({
    readonly: false,
    placeholder: 'Start typing...',
    toolbarSticky: false,
    toolbarAdaptive: false,
    height: 300,
    showCharsCounter: false,
    showWordsCounter: false,
    showXPathInStatusbar: false,
    buttons: [
      'bold', 'italic', 'underline', '|',
      'ul', 'ol', '|',
      'font', 'fontsize', 'brush', '|',
      'align', '|',
      'undo', 'redo', '|',
      'hr', 'eraser'
    ]
  }), []);

  const { theme } = useTheme();
  if (!show) return null;
  return (
    <div className={`note-popup-overlay${theme === 'dark' ? ' dark' : ''}`} onClick={onClose}>
      <div className={`note-popup${theme === 'dark' ? ' dark' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="note-popup-body">
          <input
            className="note-title-input"
            name="title"
            type="text"
            placeholder="Title"
            value={newNote.title}
            onChange={onInputChange}
          />
          <input
            className="note-reminder-input"
            name="reminder"
            type="datetime-local"
            value={newNote.reminder ? (typeof newNote.reminder === 'string' ? newNote.reminder.slice(0, 16) : new Date(newNote.reminder).toISOString().slice(0, 16)) : ''}
            onChange={onInputChange}
          />
          {/* <textarea
            className="note-content-input"
            name="content"
            placeholder="Take a note..."
            value={newNote.content}
            onChange={onInputChange}
          /> */}
          <JoditEditor
            ref={editor}
            value={newNote.content}
            config={config}
            onBlur={newContent => {
              onInputChange({ target: { name: 'content', value: newContent } });
            }}
            className={theme === 'dark' ? 'jodit-dark' : ''}
          />

        </div>

        <div className="note-popup-actions">
          <button className="note-save-btn" onClick={onSave}>Save</button>
          <button className="note-cancel-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default NotesForm;
