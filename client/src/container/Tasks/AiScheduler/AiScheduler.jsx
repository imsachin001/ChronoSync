import React, { useState, useEffect, useRef } from 'react';
import {
  FiSend, FiSave, FiTrash2, FiAlertCircle,
  FiZap, FiClock, FiTarget, FiCalendar, FiCheckCircle,
} from 'react-icons/fi';
import './AiScheduler.css';
import { useAuth } from '../../../context/AuthContext';
import { API_BASE_URL, createApi } from '../../../utils/api';

// ── Quick-prompt suggestions shown in the welcome state ───────────────────────
const QUICK_PROMPTS = [
  { icon: <FiZap />,      label: 'Plan my day',            text: 'Plan my day with high priority tasks first' },
  { icon: <FiTarget />,   label: "What's urgent?",         text: 'What should I work on right now?' },
  { icon: <FiClock />,    label: 'Focus schedule',         text: 'Create a 2-hour deep focus schedule for today' },
  { icon: <FiCalendar />, label: 'Schedule this week',     text: 'Help me schedule my tasks across this week' },
  { icon: <FiCheckCircle />, label: 'Prioritise overdue', text: 'Show me overdue tasks and help me catch up' },
];

const AiScheduler = () => {
  const { isAuthenticated, getToken } = useAuth();
  const api = createApi(getToken);

  const [prompt, setPrompt]             = useState('');
  const [messages, setMessages]         = useState([]);   // empty = show welcome state
  const [isLoading, setIsLoading]       = useState(false);
  const [isSaving, setIsSaving]         = useState(false);
  const [savedOk, setSavedOk]           = useState(false); // brief ✓ feedback
  const [tasks, setTasks]               = useState([]);
  const [tasksFetched, setTasksFetched] = useState(false);
  const [fetchError, setFetchError]     = useState(null);

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);

  // Auto-scroll to bottom whenever messages change.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea as user types.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  }, [prompt]);

  // ── On mount ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const savedChat = localStorage.getItem('viewingChat');
    if (savedChat) {
      try {
        const chatData = JSON.parse(savedChat);
        setMessages(chatData.messages);
      } catch { /* ignore */ } finally {
        localStorage.removeItem('viewingChat');
      }
    }
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Task fetching ────────────────────────────────────────────────────────────
  const fetchTasks = async () => {
    if (!isAuthenticated) return [];
    try {
      const data = await api.getTasks();
      const arr  = Array.isArray(data) ? data : [];
      setTasks(arr);
      setTasksFetched(true);
      setFetchError(null);
      return arr;
    } catch (error) {
      console.error('[AiScheduler] Failed to fetch tasks:', error);
      setFetchError('Could not load your tasks. AI will respond based on your message only.');
      setTasksFetched(true);
      return tasks;
    }
  };

  // Keep tasks fresh when they're modified elsewhere.
  useEffect(() => {
    const onTaskUpdate = () => { fetchTasks(); };
    window.addEventListener('taskUpdate', onTaskUpdate);
    return () => window.removeEventListener('taskUpdate', onTaskUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ── Keyboard handling ────────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // ── Submit / enqueue + poll ──────────────────────────────────────────────────
  const handleSubmit = async (e, overrideText) => {
    e?.preventDefault();
    const trimmed = (overrideText ?? prompt).trim();
    if (!trimmed || isLoading) return;

    setMessages(prev => [...prev, { type: 'user', content: trimmed }]);
    setPrompt('');
    setIsLoading(true);

    try {
      const freshTasks = await fetchTasks();
      const taskIds    = freshTasks.map(t => t._id).filter(Boolean);

      // Step 1 — enqueue
      const enqueueToken = await getToken();
      const enqueueRes   = await fetch(`${API_BASE_URL}/api/ai/schedule`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${enqueueToken}` },
        body:    JSON.stringify({ prompt: trimmed, taskIds }),
      });

      if (!enqueueRes.ok) {
        const err = await enqueueRes.json().catch(() => ({}));
        throw new Error(err.message || `Server error ${enqueueRes.status}`);
      }

      const { jobId } = await enqueueRes.json();
      if (!jobId) throw new Error('No jobId returned from server.');

      // Step 2 — poll
      const POLL_MS   = 2000;
      const MAX_POLLS = 30;
      let result = null;

      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise(r => setTimeout(r, POLL_MS));
        const pollToken = await getToken();
        const pollRes   = await fetch(`${API_BASE_URL}/api/ai/schedule/${jobId}`, {
          headers: { 'Authorization': `Bearer ${pollToken}` },
        });

        if (!pollRes.ok && pollRes.status !== 202) {
          const err = await pollRes.json().catch(() => ({}));
          throw new Error(err.message || `Poll error ${pollRes.status}`);
        }

        const pollData = await pollRes.json();
        if (pollData.status === 'completed' || pollData.status === 'failed') {
          result = pollData;
          break;
        }
      }

      if (!result) throw new Error('Schedule generation timed out. Please try again.');
      if (result.status === 'failed') {
        throw new Error(result.result?.errorMessage || 'Worker failed to generate a schedule.');
      }

      const scheduleResult = result.result || {};

      const sourceLabel =
        scheduleResult.source === 'fallback'
          ? '\n\n— Scheduled by built-in priority algorithm (AI unavailable) —'
          : '';

      setMessages(prev => [...prev, {
        type:    'ai',
        content: (scheduleResult.response || 'The scheduler returned no response.') + sourceLabel,
        source:  scheduleResult.source,
        model:   scheduleResult.model,
      }]);
    } catch (error) {
      console.error('[AiScheduler] Request failed:', error);
      setMessages(prev => [...prev, {
        type:    'ai',
        content: `Something went wrong: ${error.message}\n\nPlease check your connection and try again.`,
        source:  'error',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Quick prompt click ───────────────────────────────────────────────────────
  const handleQuickPrompt = (text) => {
    handleSubmit(null, text);
  };

  // ── Save chat ────────────────────────────────────────────────────────────────
  const handleSaveChat = async () => {
    if (messages.length === 0) return;
    setIsSaving(true);
    try {
      if (!isAuthenticated) { window.location.href = '/login'; return; }
      const token    = await getToken();
      const chatData = {
        title:    messages.find(m => m.type === 'user')?.content.substring(0, 50) || 'Untitled Chat',
        messages: messages.map(m => ({ type: m.type, content: m.content, timestamp: new Date().toISOString() })),
      };
      const res = await fetch(`${API_BASE_URL}/api/chats`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify(chatData),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || res.statusText);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (error) {
      console.error('[AiScheduler] Save failed:', error);
      alert(`Failed to save chat: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Clear chat ───────────────────────────────────────────────────────────────
  const handleClearChat = () => {
    setMessages([]);
    setFetchError(null);
    setPrompt('');
  };

  // ── Derived state ────────────────────────────────────────────────────────────
  const hasMessages   = messages.length > 0;
  const pendingCount  = tasks.filter(t => !t.completed).length;
  const showWelcome   = !hasMessages && !isLoading;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="ais-root">

      {/* ── Gradient Header ─────────────────────────────────────────────────── */}
      <div className="ais-header">
        <div className="ais-header-left">
          <div className="ais-avatar-orb">
            <span className="ais-orb-inner" />
          </div>
          <div>
            <h1 className="ais-title">ChronoSync <span>AI</span></h1>
            <p className="ais-subtitle">
              {tasksFetched
                ? `${pendingCount} pending task${pendingCount !== 1 ? 's' : ''} · ready to schedule`
                : 'Your intelligent scheduling assistant'}
            </p>
          </div>
        </div>

        {hasMessages && (
          <div className="ais-header-actions">
            {isAuthenticated && (
              <button
                className={`ais-action-btn ${savedOk ? 'saved' : ''}`}
                onClick={handleSaveChat}
                disabled={isSaving}
                title="Save conversation"
              >
                <FiSave />
                <span>{savedOk ? 'Saved!' : isSaving ? 'Saving…' : 'Save'}</span>
              </button>
            )}
            <button
              className="ais-action-btn danger"
              onClick={handleClearChat}
              title="Clear conversation"
            >
              <FiTrash2 />
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Task-fetch error banner ──────────────────────────────────────────── */}
      {fetchError && (
        <div className="ais-banner">
          <FiAlertCircle />
          <span>{fetchError}</span>
        </div>
      )}

      {/* ── Chat body ───────────────────────────────────────────────────────── */}
      <div className="ais-body">

        {/* Welcome / empty state */}
        {showWelcome && (
          <div className="ais-welcome">
            <div className="ais-welcome-orb" />
            <h2>How can I help you today?</h2>
            <p>Ask me to plan, prioritise, or optimise your schedule.</p>
            <div className="ais-chips">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp.label}
                  className="ais-chip"
                  onClick={() => handleQuickPrompt(qp.text)}
                >
                  <span className="ais-chip-icon">{qp.icon}</span>
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="ais-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`ais-msg-row ${msg.type}`}>
              {msg.type === 'ai' && (
                <div className={`ais-msg-avatar ${msg.source === 'error' ? 'error' : ''}`}>
                  <span />
                </div>
              )}

              <div className={`ais-bubble ${msg.type} ${msg.source === 'error' ? 'error' : ''}`}>
                {msg.type === 'ai' && msg.source && msg.source !== 'error' && (
                  <div className="ais-bubble-badge">
                    {msg.source === 'gemini' ? `✦ Gemini${msg.model ? ` · ${msg.model.replace('gemini-', '').replace('-', ' ')}` : ''}` : '⚡ Priority Scheduler'}
                  </div>
                )}
                <div className="ais-bubble-content">
                  {msg.content}
                </div>
              </div>

              {msg.type === 'user' && (
                <div className="ais-msg-avatar user">
                  <span>You</span>
                </div>
              )}
            </div>
          ))}

          {/* Typing / processing indicator */}
          {isLoading && (
            <div className="ais-msg-row ai">
              <div className="ais-msg-avatar">
                <span />
              </div>
              <div className="ais-bubble ai thinking">
                <div className="ais-thinking-dots">
                  <span /><span /><span />
                </div>
                <span className="ais-thinking-label">AI is generating your schedule…</span>
              </div>
            </div>
          )}

          {/* Quick-prompt chips (shown after first exchange too) */}
          {hasMessages && !isLoading && (
            <div className="ais-inline-chips">
              {QUICK_PROMPTS.slice(0, 3).map((qp) => (
                <button
                  key={qp.label}
                  className="ais-chip small"
                  onClick={() => handleQuickPrompt(qp.text)}
                >
                  <span className="ais-chip-icon">{qp.icon}</span>
                  {qp.label}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div className="ais-input-wrapper">
        <form className="ais-input-bar" onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to plan your schedule…"
            rows={1}
            className="ais-textarea"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="ais-send-btn"
            disabled={!prompt.trim() || isLoading}
            title="Send (Enter)"
          >
            <FiSend />
          </button>
        </form>
        <p className="ais-hint">Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line</p>
      </div>

    </div>
  );
};

export default AiScheduler;