import React, { useState, useEffect } from 'react';
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
  SignedIn,
  SignedOut
} from "@clerk/clerk-react";

import { FiMenu, FiX, FiBell, FiUser, FiLogIn, FiSun, FiMoon } from 'react-icons/fi';
import './Navbar.css';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../utils/api';
import logo from '../../assets/logo2.jpg';

const Navbar = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  const navItems = [
    { name: 'Home', path: '/home' },
    { name: 'Tasks', path: '/tasks' },
    { name: 'Notes', path: '/notes' },
    { name: 'Analytics', path: '/analytics' }
  ];

  // Fetch notifications (reminders and overdue tasks)
  const fetchNotifications = async () => {
    if (!isSignedIn) return;
    
    try {
      const token = await getToken();
      if (!token) return;

      // Fetch notes with upcoming reminders
      const notesResponse = await fetch(`${API_BASE_URL}/api/notes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      // Fetch tasks
      const tasksResponse = await fetch(`${API_BASE_URL}/api/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const allNotifications = [];

      if (notesResponse.ok) {
        const notes = await notesResponse.json();
        const now = new Date();
        
        // Filter notes with reminders that are upcoming or overdue
        const reminders = notes
          .filter(note => note.reminder && !note.trashed)
          .map(note => {
            const reminderDate = new Date(note.reminder);
            const isOverdue = reminderDate < now;
            const timeDiff = Math.abs(now - reminderDate);
            
            return {
              id: `note-${note._id}`,
              type: 'reminder',
              noteId: note._id,
              title: note.title || 'Untitled Note',
              message: `Reminder: ${note.title || note.content.substring(0, 50)}`,
              time: formatTimeAgo(reminderDate),
              isOverdue,
              date: reminderDate
            };
          });
        
        allNotifications.push(...reminders);
      }

      if (tasksResponse.ok) {
        const tasks = await tasksResponse.json();
        const now = new Date();
        
        // Filter overdue tasks
        const overdueTasks = tasks
          .filter(task => !task.completed && new Date(task.dueDate) < now)
          .map(task => ({
            id: `task-${task._id}`,
            type: 'overdue',
            taskId: task._id,
            title: task.title,
            message: `Overdue: ${task.title}`,
            time: formatTimeAgo(new Date(task.dueDate)),
            isOverdue: true,
            date: new Date(task.dueDate)
          }));
        
        allNotifications.push(...overdueTasks);
      }

      // Sort by date (most recent first)
      allNotifications.sort((a, b) => b.date - a.date);
      setNotifications(allNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Format time ago
  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Remove individual notification
  const removeNotification = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
    setShowNotifications(false);
  };

  // Load notifications on mount and when signed in
  useEffect(() => {
    if (isSignedIn) {
      fetchNotifications();
      // Refresh notifications every 2 minutes
      const interval = setInterval(fetchNotifications, 120000);
      return () => clearInterval(interval);
    }
  }, [isSignedIn]);

  // Listen for task/note updates
  useEffect(() => {
    const handleUpdate = () => {
      fetchNotifications();
    };
    
    window.addEventListener('taskUpdate', handleUpdate);
    window.addEventListener('noteUpdate', handleUpdate);
    
    return () => {
      window.removeEventListener('taskUpdate', handleUpdate);
      window.removeEventListener('noteUpdate', handleUpdate);
    };
  }, []);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    setShowAllNotifications(false);
  };
  const handleNavigation = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };
  const handleProfile = () => {
    navigate("/profile");
    setIsMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        {/* Left: Brand + Menu */}
        <div className="nav-left">
          <button className="menu-icon" onClick={toggleMenu} aria-label="Toggle menu">
            {isMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
          <div className="brand-container" onClick={() => handleNavigation('/')}>
            <img src={logo} alt="ChronoSync Logo" className="navbar-logo" />
            <h1 className="brand">ChronoSync</h1>
          </div>
        </div>

        {/* Middle: Nav Links */}
        <div className="nav-middle">
          {navItems.map((item) => (
            <button
              key={item.name}
              className="nav-link"
              onClick={() => handleNavigation(item.path)}
            >
              {item.name}
            </button>
          ))}
        </div>

        {/* Right: Theme + Notifications + Auth */}
        <div className="nav-end">
          <button className="theme-toggle icon-button" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <FiSun size={20} /> : <FiMoon size={20} />}
          </button>

          <div className="notification-container">
            <button className="icon-button" onClick={toggleNotifications} aria-label="Notifications">
              <FiBell size={20} />
              {notifications.length > 0 && (
                <span className="notification-badge">{notifications.length}</span>
              )}
            </button>
            {showNotifications && (
              <div className="notification-dropdown">
                <div className="notification-header">
                  <h3>Notifications</h3>
                  {notifications.length > 0 && (
                    <button className="clear-all" onClick={clearAllNotifications}>Clear All</button>
                  )}
                </div>
                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <div className="no-notifications">
                      <FiBell size={40} style={{ opacity: 0.3 }} />
                      <p>No notifications</p>
                    </div>
                  ) : (
                    <>
                      {(showAllNotifications ? notifications : notifications.slice(0, 3)).map(notification => (
                        <div 
                          key={notification.id} 
                          className={`notification-item ${notification.isOverdue ? 'overdue' : ''}`}
                          onClick={() => {
                            if (notification.type === 'reminder') {
                              navigate('/notes');
                            } else if (notification.type === 'overdue') {
                              navigate('/tasks');
                            }
                            setShowNotifications(false);
                          }}
                        >
                          <div className="notification-content">
                            <div className="notification-icon">
                              {notification.type === 'reminder' ? '🔔' : '⏰'}
                            </div>
                            <div className="notification-text">
                              <p className="notification-message">{notification.message}</p>
                              <span className="notification-time">{notification.time}</span>
                            </div>
                          </div>
                          <button 
                            className="notification-close"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNotification(notification.id);
                            }}
                            aria-label="Remove notification"
                          >
                            <FiX size={16} />
                          </button>
                        </div>
                      ))}
                      {notifications.length > 3 && !showAllNotifications && (
                        <button 
                          className="see-more-btn"
                          onClick={() => setShowAllNotifications(true)}
                        >
                          See More ({notifications.length - 3} more)
                        </button>
                      )}
                      {showAllNotifications && notifications.length > 3 && (
                        <button 
                          className="see-more-btn"
                          onClick={() => setShowAllNotifications(false)}
                        >
                          Show Less
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Auth Buttons */}
          <SignedIn>
            <div className="user-menu">
              <button className="profile-button" onClick={handleProfile}>
                <FiUser size={24} />
              </button>
              <UserButton afterSignOutUrl='/' />
            </div>
          </SignedIn>

          <SignedOut>
            <div className="auth-buttons">
              <SignInButton mode="modal">
                <button className="login-button">
                  <FiLogIn size={20} />
                  <span>Login</span>
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="signup-button">
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          </SignedOut>
        </div>

        {/* Mobile Menu */}
        <div className={`mobile-menu ${isMenuOpen ? 'open' : ''}`}>
          <div className="mobile-nav-middle">
            {navItems.map((item) => (
              <button
                key={item.name}
                className="nav-link"
                onClick={() => handleNavigation(item.path)}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="mobile-nav-end">
            <button className="theme-toggle icon-button" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <FiSun size={20} /> : <FiMoon size={20} />}
            </button>

            <button className="icon-button" onClick={toggleNotifications} aria-label="Notifications">
              <FiBell size={20} />
              {notifications.length > 0 && (
                <span className="notification-badge">{notifications.length}</span>
              )}
            </button>

            <SignedIn>
              <button className="profile-button" onClick={handleProfile}>
                <FiUser size={24} />
                <span>Profile</span>
              </button>
              <UserButton afterSignOutUrl='/' />
            </SignedIn>

            <SignedOut>
              <SignInButton mode="modal">
                <button className="login-button">
                  <FiLogIn size={20} />
                  <span>Login</span>
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="signup-button">
                  <span>Sign Up</span>
                </button>
              </SignUpButton>
            </SignedOut>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
