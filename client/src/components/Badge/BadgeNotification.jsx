import React, { useEffect } from 'react';
import { FiX } from 'react-icons/fi';
import './BadgeNotification.css';

const BadgeNotification = ({ badge, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible || !badge) {
    return null;
  }

  return (
    <div className="badge-notification-overlay">
      <div className="badge-notification-card">
        <button className="badge-notification-close" onClick={onClose}>
          <FiX />
        </button>
        
        <div className="badge-notification-content">
          <div className="badge-notification-emoji">
            🎉
          </div>
          
          <h3 className="badge-notification-title">
            Congratulations!
          </h3>
          
          <p className="badge-notification-message">
            You have unlocked a new badge
          </p>
          
          <div className="badge-notification-badge">
            <span className="badge-emoji">{badge.emoji}</span>
            <span className="badge-name">{badge.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgeNotification; 