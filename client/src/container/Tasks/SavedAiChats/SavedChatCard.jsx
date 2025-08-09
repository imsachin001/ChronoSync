import React from 'react';
import { FiClock, FiTrash2, FiEye } from 'react-icons/fi';
import './SavedChats.css';

const SavedChatCard = ({ chat, onDelete, onView }) => {
  // Format the timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown date';
     
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  // Get a preview of the chat content (first message/question)
  const getChatPreview = (chat) => {
    if (!chat || !chat.messages || chat.messages.length === 0) {
      return 'No content available';
    }
    
    // Return the first user message or the beginning of the conversation
    const firstMessage = chat.messages.find(msg => msg.type === 'user') || chat.messages[0];
    return firstMessage.content || 'Empty message';
  };

  return (
    <div className="chat-card">
      <div className="chat-card-header">
        <div className="chat-timestamp">
          <FiClock />
          <span>{formatTimestamp(chat.createdAt || chat.timestamp)}</span>
        </div>
        <div className="chat-actions">
          <button
            className="chat-action-btn view-btn"
            onClick={() => onView(chat)}
            aria-label="View chat"
            title="View chat"
          >
            <FiEye />
          </button>
          <button
            className="chat-action-btn delete-btn"
            onClick={() => onDelete(chat._id)}
            aria-label="Delete chat"
            title="Delete chat"
          >
            <FiTrash2 />
          </button>
        </div>
      </div>
      <div className="chat-preview">
        {getChatPreview(chat)}
      </div>
    </div>
  );
};

export default SavedChatCard; 