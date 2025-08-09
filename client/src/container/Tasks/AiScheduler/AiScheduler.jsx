import React, { useState, useEffect } from 'react';
import { FiSend, FiCalendar, FiClock, FiCpu, FiSave, FiTrash2 } from 'react-icons/fi';
import './AiScheduler.css';

const AiScheduler = () => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([
    {
      type: 'system',
      content: 'I can help plan your schedule. Try "Plan my day with high priority tasks first" or "Create a schedule with focus blocks".'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isViewingSavedChat, setIsViewingSavedChat] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check authentication status
    validateToken();
    
    // Check if we're viewing a saved chat
    const savedChat = localStorage.getItem('viewingChat');
    if (savedChat) {
      try {
        const chatData = JSON.parse(savedChat);
        setMessages(chatData.messages);
        setIsViewingSavedChat(true);
        // Clear the localStorage after loading
        localStorage.removeItem('viewingChat');
      } catch (error) {
        console.error('Error parsing saved chat:', error);
      }
    }
  }, []);

  // Function to validate token
  const validateToken = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsAuthenticated(false);
      return false;
    }

    try {
      // Test if token is valid and not expired
      const response = await fetch('/api/test-auth', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setIsAuthenticated(true);
        return true;
      } else {
        // Token is invalid or expired
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        return false;
      }
    } catch (error) {
      console.error('Error validating token:', error);
      setIsAuthenticated(false);
      return false;
    }
  };

  const handlePromptChange = (e) => {
    setPrompt(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    // Add user message
    const userMessage = {
      type: 'user',
      content: prompt
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    // Simulate AI response after delay
    setTimeout(() => {
      const aiResponse = {
        type: 'ai',
        content: "I've analyzed your tasks and created an optimized schedule. Focus on completing the high-priority tasks first, and I've included regular breaks to maintain productivity."
      };
      
      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1500);
    
    // Clear the input
    setPrompt('');
  };

  const handleSaveChat = async () => {
    // Don't save if there are no messages or only the system message
    if (messages.length <= 1) return;
    
    try {
      setIsSaving(true);
      
      // Validate token before saving
      const isValid = await validateToken();
      if (!isValid) {
        alert("You need to be logged in to save chats. Please log in.");
        window.location.href = '/login';
        return;
      }
      
      // Get token after validation
      const token = localStorage.getItem('token');
      
      // Ensure all messages have the proper structure
      const formattedMessages = messages.map(msg => ({
        type: msg.type,
        content: msg.content,
        timestamp: new Date().toISOString()
      }));
      
      // Create a chat object to save
      const chatToSave = {
        title: messages.find(msg => msg.type === 'user')?.content.substring(0, 30) || 'Untitled Chat',
        messages: formattedMessages
      };
      
      console.log('Saving chat with data:', chatToSave);
      console.log('Token status:', isAuthenticated ? 'Valid' : 'Invalid');
      
      // Make a POST request to save the chat
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(chatToSave)
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Server error response:', errorData);
        
        // Handle specific error cases
        if (response.status === 401) {
          alert("Authentication error. Please log in again.");
          localStorage.removeItem('token');
          setIsAuthenticated(false);
          window.location.href = '/login';
          return;
        }
        
        throw new Error(`Failed to save chat: ${errorData.message || response.statusText}`);
      }
      
      const savedChat = await response.json();
      console.log('Chat saved successfully:', savedChat);
      
      // Show success message or notification
      alert('Chat saved successfully!');
      
    } catch (error) {
      console.error('Error saving chat:', error);
      alert(`Failed to save chat: ${error.message}. Please try again.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearChat = () => {
    // Reset messages to only include the initial system message
    setMessages([
      {
        type: 'system',
        content: 'I can help plan your schedule. Try "Plan my day with high priority tasks first" or "Create a schedule with focus blocks".'
      }
    ]);
    setPrompt('');
  };

  return (
    <div className="ai-scheduler-container">
      <div className="ai-scheduler-header">
        <h2><FiCpu /> AI Scheduling Assistant</h2>
        <div className="ai-header-actions">
          <p>Get personalized scheduling recommendations based on your tasks</p>
          {messages.length > 1 && (
            <div className="header-buttons">
              {isAuthenticated ? (
                <button 
                  className="save-chat-btn"
                  onClick={handleSaveChat}
                  disabled={isSaving || messages.length <= 1}
                  title="Save this conversation"
                >
                  <FiSave />
                  <span>{isSaving ? 'Saving...' : 'Save Chat'}</span>
                </button>
              ) : (
                <button 
                  className="login-btn"
                  onClick={() => window.location.href = '/login'}
                  title="Log in to save chats"
                >
                  <span>Login to Save Chats</span>
                </button>
              )}
              <button 
                className="clear-chat-btn"
                onClick={handleClearChat}
                title="Clear the current conversation"
              >
                <FiTrash2 />
                <span>Clear Chat</span>
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="ai-chat-container">
        <div className="ai-messages">
          {messages.map((message, index) => (
            <div key={index} className={`ai-message ${message.type}`}>
              {message.type === 'system' && <FiCpu className="message-icon" />}
              {message.type === 'user' && <div className="user-icon">You</div>}
              {message.type === 'ai' && <FiCalendar className="message-icon" />}
              <div className="message-content">{message.content}</div>
            </div>
          ))}
          
          {isLoading && (
            <div className="ai-message ai">
              <FiCalendar className="message-icon" />
              <div className="message-content loading">
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
              </div>
            </div>
          )}
        </div>
        
        <form className="ai-input-container" onSubmit={handleSubmit}>
          <textarea 
            value={prompt}
            onChange={handlePromptChange}
            placeholder="Ask me to plan your schedule..."
            rows={2}
            className="ai-input"
          />
          <button 
            type="submit" 
            className="ai-submit-btn"
            disabled={!prompt.trim() || isLoading}
          >
            <FiSend />
          </button>
        </form>
      </div>
      
      <div className="ai-features">
        <div className="feature">
          <FiClock />
          <span>Time-Blocking</span>
        </div>
        <div className="feature">
          <FiCalendar />
          <span>Daily Planning</span>
        </div>
        <div className="feature">
          <FiCpu />
          <span>Priority Analysis</span>
        </div>
      </div>
    </div>
  );
};

export default AiScheduler;
