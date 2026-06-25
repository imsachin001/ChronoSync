import React, { useState, useEffect, useRef } from 'react';
import { FiSend, FiCalendar, FiClock, FiCpu, FiSave, FiTrash2, FiAlertCircle } from 'react-icons/fi';
import './AiScheduler.css';
import { useAuth } from '../../../context/AuthContext';
import { API_BASE_URL, createApi } from '../../../utils/api';

const AiScheduler = () => {
  const { isAuthenticated, getToken } = useAuth();
  // createApi is stable as long as getToken is stable — no need to memoize here.
  const api = createApi(getToken);

  const [prompt, setPrompt]               = useState('');
  const [messages, setMessages]           = useState([
    {
      type: 'system',
      content:
        'I can help plan your schedule. Try:\n' +
        '- "Plan my day with high priority tasks first"\n' +
        '- "What should I work on right now?"\n' +
        '- "Create a focus schedule for today"',
    },
  ]);
  const [isLoading, setIsLoading]         = useState(false);
  const [isSaving, setIsSaving]           = useState(false);
  const [tasks, setTasks]                 = useState([]);
  const [tasksFetched, setTasksFetched]   = useState(false); // track whether tasks loaded
  const [fetchError, setFetchError]       = useState(null);  // surface task-fetch failures

  // Auto-scroll to the latest message.
  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // ── On mount: restore a saved chat OR fetch tasks ──────────────────────────
  useEffect(() => {
    const savedChat = localStorage.getItem('viewingChat');
    if (savedChat) {
      try {
        const chatData = JSON.parse(savedChat);
        setMessages(chatData.messages);
      } catch {
        // Corrupted data — ignore and proceed normally.
      } finally {
        localStorage.removeItem('viewingChat');
      }
    }

    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Task fetching ──────────────────────────────────────────────────────────
  const fetchTasks = async () => {
    // Don't block UI — tasks are context for the AI, not required to render.
    if (!isAuthenticated) return;

    try {
      const data = await api.getTasks();
      // api.getTasks() returns the array directly (see api.js → makeAuthenticatedRequest).
      setTasks(Array.isArray(data) ? data : []);
      setTasksFetched(true);
    } catch (error) {
      console.error('[AiScheduler] Failed to fetch tasks:', error);
      // Show a non-blocking warning in the UI — the user can still chat.
      setFetchError('Could not load your tasks. AI responses will be based on your message only.');
      setTasksFetched(true);
    }
  };

  // ── Keyboard submit (Shift+Enter = newline, Enter = send) ──────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isLoading) return;

    // Optimistically show the user's message.
    setMessages(prev => [...prev, { type: 'user', content: trimmed }]);
    setPrompt('');
    setIsLoading(true);

    try {
      const token = await getToken();

      const response = await fetch(`${API_BASE_URL}/api/ai/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: trimmed,
          tasks,               // full task objects — backend uses all schema fields
        }),
      });

      if (!response.ok) {
        // Try to get a message from the server; fall back to HTTP status text.
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Server error ${response.status}`);
      }

      const data = await response.json();

      // `source` tells us whether Gemini or the fallback handled this request.
      // We surface it as a subtle label so users understand what they're seeing.
      const sourceLabel =
        data.source === 'fallback'
          ? '\n\n— Scheduled by built-in priority algorithm (AI unavailable) —'
          : '';                // Gemini responses need no annotation

      setMessages(prev => [
        ...prev,
        {
          type: 'ai',
          content: data.response + sourceLabel,
          source: data.source,   // keep raw source for potential future styling
        },
      ]);
    } catch (error) {
      console.error('[AiScheduler] Request failed:', error);
      setMessages(prev => [
        ...prev,
        {
          type: 'ai',
          content:
            `Sorry, something went wrong: ${error.message}.\n` +
            `Please check your connection and try again.`,
          source: 'error',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Save chat ──────────────────────────────────────────────────────────────
  const handleSaveChat = async () => {
    // Need at least one real exchange (system + user + ai).
    if (messages.length <= 1) return;

    setIsSaving(true);
    try {
      if (!isAuthenticated) {
        alert('You need to be logged in to save chats.');
        window.location.href = '/login';
        return;
      }

      const token = await getToken();

      const formattedMessages = messages.map(msg => ({
        type:      msg.type,
        content:   msg.content,
        timestamp: new Date().toISOString(),
      }));

      const chatToSave = {
        // Use first user message as title (trimmed to 50 chars for readability).
        title: messages.find(m => m.type === 'user')?.content.substring(0, 50) || 'Untitled Chat',
        messages: formattedMessages,
      };

      const response = await fetch(`${API_BASE_URL}/api/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(chatToSave),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Unknown error' }));
        if (response.status === 401) {
          alert('Session expired. Please log in again.');
          window.location.href = '/login';
          return;
        }
        throw new Error(errData.message || response.statusText);
      }

      alert('Chat saved successfully!');
    } catch (error) {
      console.error('[AiScheduler] Save failed:', error);
      alert(`Failed to save chat: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Clear chat ─────────────────────────────────────────────────────────────
  const handleClearChat = () => {
    setMessages([
      {
        type: 'system',
        content:
          'I can help plan your schedule. Try:\n' +
          '- "Plan my day with high priority tasks first"\n' +
          '- "What should I work on right now?"\n' +
          '- "Create a focus schedule for today"',
      },
    ]);
    setFetchError(null);
    setPrompt('');
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const hasExchange = messages.length > 1;
  const pendingCount = tasks.filter(t => !t.completed).length;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="ai-scheduler-container">

      {/* ── Header ── */}
      <div className="ai-scheduler-header">
        <h2><FiCpu /> AI Scheduling Assistant</h2>
        <div className="ai-header-actions">
          <p>
            Personalized scheduling based on your tasks
            {tasksFetched && ` · ${pendingCount} pending task${pendingCount !== 1 ? 's' : ''} loaded`}
          </p>

          {hasExchange && (
            <div className="header-buttons">
              {isAuthenticated ? (
                <button
                  className="save-chat-btn"
                  onClick={handleSaveChat}
                  disabled={isSaving}
                  title="Save this conversation"
                >
                  <FiSave />
                  <span>{isSaving ? 'Saving…' : 'Save Chat'}</span>
                </button>
              ) : (
                <button
                  className="login-btn"
                  onClick={() => (window.location.href = '/login')}
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

      {/* ── Non-blocking task-fetch warning ── */}
      {fetchError && (
        <div className="ai-fetch-warning">
          <FiAlertCircle />
          <span>{fetchError}</span>
        </div>
      )}

      {/* ── Chat area ── */}
      <div className="ai-chat-container">
        <div className="ai-messages">
          {messages.map((message, index) => (
            <div key={index} className={`ai-message ${message.type}`}>

              {message.type === 'system' && <FiCpu className="message-icon" />}
              {message.type === 'user'   && <div className="user-icon">You</div>}
              {message.type === 'ai'     && <FiCalendar className="message-icon" />}

              {/* whiteSpace: pre-wrap renders the scheduler's newlines correctly. */}
              <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>
                {message.content}
              </div>

            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="ai-message ai">
              <FiCalendar className="message-icon" />
              <div className="message-content loading">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
              </div>
            </div>
          )}

          {/* Invisible anchor for auto-scroll */}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Input form ── */}
        {/*
          The onSubmit on the form covers button click.
          handleKeyDown covers Enter key (Shift+Enter = newline).
        */}
        <form className="ai-input-container" onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to plan your schedule… (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="ai-input"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="ai-submit-btn"
            disabled={!prompt.trim() || isLoading}
            title="Send"
          >
            <FiSend />
          </button>
        </form>
      </div>

      {/* ── Feature strip ── */}
      <div className="ai-features">
        <div className="feature"><FiClock />    <span>Time-Blocking</span></div>
        <div className="feature"><FiCalendar /> <span>Daily Planning</span></div>
        <div className="feature"><FiCpu />      <span>Priority Analysis</span></div>
      </div>

    </div>
  );
};

export default AiScheduler;