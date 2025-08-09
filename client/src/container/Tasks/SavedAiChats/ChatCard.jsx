import React from 'react';
import { FiEye, FiTrash2, FiClock, FiMessageSquare } from 'react-icons/fi';
import './ChatCard.css';

const ChatCard = ({ chat, onDelete, onView }) => {
  // Format date to display in a readable format
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Truncate text if it's too long
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  console.log("Rendering chat card:", chat.title, "with ID:", chat._id);

  return (
    <div className="chat-card">
      <div className="chat-card-header">
        <h3 className="chat-title">{chat.title || 'Untitled Chat'}</h3>
        <div className="chat-card-actions">
          <button 
            className="card-btn view-btn"
            onClick={() => onView(chat)}
            aria-label="View chat"
          >
            <FiMessageSquare />
          </button>
          <button 
            className="card-btn delete-btn"
            onClick={() => onDelete(chat._id)}
            aria-label="Delete chat"
          >
            <FiTrash2 />
          </button>
        </div>
      </div>
      
      <div className="chat-card-content">
        <p className="chat-preview">{truncateText(chat.messages[0]?.content || 'No messages')}</p>
      </div>
      
      <div className="chat-card-footer">
        <div className="chat-date">
          <FiClock className="date-icon" />
          <span>{formatDate(chat.createdAt)}</span>
        </div>
        <div className="chat-message-count">
          <span>{chat.messages.length} message{chat.messages.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
};

export default ChatCard; 