import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiSearch, FiRefreshCw, FiLogIn } from 'react-icons/fi';
import ChatCard from './ChatCard';
import './SavedChats.css';
import { useAuth } from '../../../context/AuthContext';

const SavedChats = () => {
  const { isAuthenticated, getToken } = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState(null);

  // Create a reusable function to fetch chats that can be called on demand
  const fetchSavedChats = useCallback(async () => {
    try {
      setLoading(true);
      
      // Check if user is authenticated
      if (!isAuthenticated) {
        setError('Please log in to view your saved chats');
        setLoading(false);
        return;
      }
      
      const token = await getToken();
      if (!token) {
        setError('Please log in to view your saved chats');
        setLoading(false);
        return;
      }
      
      console.log('Fetching saved chats with valid token');
      
      const response = await fetch('/api/chats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Fetch response status:', response.status);
      
      if (!response.ok) {
        // If unauthorized, show error
        if (response.status === 401) {
          setError('Your session has expired. Please log in again.');
          setLoading(false);
          return;
        }
        
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response from server:', errorData);
        throw new Error(errorData.message || 'Failed to fetch saved chats');
      }

      const data = await response.json();
      console.log('Fetched chats:', data.length);
      console.log('Chat data sample:', data.length > 0 ? JSON.stringify(data[0], null, 2) : 'No chats found');
      console.log('All chat data:', JSON.stringify(data, null, 2));
      
      // Ensure all chat objects have the required properties
      const processedChats = data.map(chat => {
        console.log("Processing chat:", chat.title || 'Untitled', "ID:", chat._id || chat.id);
        
        // Clone to avoid modifying the original
        const processedChat = { ...chat };
        
        // Make sure there's an _id property
        if (!processedChat._id && processedChat.id) {
          console.log("Fixing missing _id for chat:", processedChat.title);
          processedChat._id = processedChat.id;
        }
        
        // Make sure there's a createdAt property
        if (!processedChat.createdAt && processedChat.timestamp) {
          console.log("Fixing missing createdAt for chat:", processedChat.title);
          processedChat.createdAt = processedChat.timestamp;
        }
        
        // Ensure messages array exists
        if(!processedChat.messages) {
          console.log("Adding empty messages array for chat:", processedChat.title);
          processedChat.messages = [];
        }
        
        // Ensure title exists
        if (!processedChat.title) {
          processedChat.title = 'Untitled Chat';
        }
        
        return processedChat;
      });
      
      console.log('Processed chats count:', processedChats.length);
      console.log('First processed chat sample:', processedChats.length > 0 ? JSON.stringify(processedChats[0], null, 2) : 'No chats');
      setChats(processedChats);
      setError(null);
    } catch (err) {
      setError('Error fetching saved chats. Please try again later.');
      console.error('Error fetching saved chats:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, getToken]);

  useEffect(() => {
    fetchSavedChats();
  }, [fetchSavedChats]);

  const handleDeleteChat = async (chatId) => {
    if (window.confirm('Are you sure you want to delete this chat?')) {
      try {
        console.log('Deleting chat with ID:', chatId);
        
        const token = await getToken();
        if (!token) {
          setError('Please log in to delete chats');
          return;
        }
        
        const response = await fetch(`/api/chats/${chatId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        console.log('Delete response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Error response from server:', errorData);
          throw new Error(errorData.message || 'Failed to delete chat');
        }
        
        console.log('Chat deleted successfully');
        // Remove the deleted chat from state
        setChats(prevChats => prevChats.filter(chat => chat._id !== chatId));
        
        // Show success message
        setError(null);
      } catch (err) {
        setError('Error deleting chat. Please try again.');
        console.error('Error deleting chat:', err);
      }
    }
  };

  const handleViewChat = (chat) => {
    setSelectedChat(chat);
    // Navigate to the AiScheduler with the selected chat
    // We'll use localStorage to pass the chat data to the AiScheduler
    localStorage.setItem('viewingChat', JSON.stringify(chat));
    window.location.href = '/tasks';
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const filteredChats = chats.filter(chat => {
    console.log("Filtering chat:", chat.title);
    
    if (!searchQuery) {
      return true;
    }
    
    // Make sure chat has messages array
    if (!chat.messages || !Array.isArray(chat.messages) || chat.messages.length === 0) {
      console.log("Chat has no messages:", chat.title);
      return false;
    }
    
    // Search in chat title
    if (chat.title && chat.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return true;
    }
    
    // Search in chat messages content
    const messagesText = chat.messages
      .map(msg => msg.content || '')
      .join(' ')
      .toLowerCase();
    
    return messagesText.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="saved-chats-container">
      <div className="saved-chats-header">
        <div className="header-actions">
          <button 
            className="refresh-btn"
            onClick={fetchSavedChats}
            disabled={loading}
            title="Refresh chats"
          >
            <FiRefreshCw className={loading ? 'spinning' : ''} />
          </button>
          {!isAuthenticated && (
            <button 
              className="login-btn"
              onClick={() => window.location.href = '/login'}
              title="Log in to view and save chats"
            >
              <FiLogIn />
              <span>Login</span>
            </button>
          )}
        </div>
      </div>

      <div className="search-container">
        <FiSearch className="search-icon" />
        <input
          type="text"
          placeholder="Search saved chats..."
          className="search-input"
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>

      {loading ? (
        <div className="loading-state">Loading saved chats...</div>
      ) : error ? (
        <div className="error-state">{error}</div>
      ) : filteredChats.length === 0 ? (
        <div className="empty-state">
          {searchQuery 
            ? "No chats match your search" 
            : "You don't have any saved chats yet. Start a new conversation!"}
        </div>
      ) : (
        <div className="saved-chats-grid">
          {filteredChats.map(chat => (
            <ChatCard
              key={chat._id}
              chat={chat}
              onDelete={handleDeleteChat}
              onView={() => handleViewChat(chat)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedChats; 