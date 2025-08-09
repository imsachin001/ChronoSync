import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { FiShare2, FiLock } from 'react-icons/fi';
import './Badge.css';
import { useAuth } from '../../context/AuthContext';

const Badge = () => {
  const { isAuthenticated, getToken } = useAuth();
  const { theme } = useTheme();
  const [badgeData, setBadgeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBadgeData = async () => {
    try {
      const token = await getToken();
      
      if (!token) {
        return;
      }

      const response = await fetch('/api/tasks/badges', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Badge data:', data);
        setBadgeData(data);
        setError(null);
      } else {
        console.error('Failed to fetch badge data');
        setError('Failed to load badge data');
      }
    } catch (err) {
      console.error('Error fetching badge data:', err);
      setError(`Failed to load badge data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchBadgeData();
    }
  }, [isAuthenticated]);

  const handleShare = () => {
    // Implement share functionality
    console.log('Share badge achievement');
  };

  const renderBadgeItem = (badge, progress, title, description) => (
    <div className="badge-item">
      <div className="badge-icon">
        {badge.earned ? (
          <span className="badge-emoji">{badge.emoji}</span>
        ) : (
          <FiLock className="badge-lock" />
        )}
      </div>
      
      <div className="badge-info">
        <h3 className="badge-name">
          {badge.earned ? badge.name : `${badge.name} - No Badge`}
        </h3>
        
        <div className="badge-progress">
          <span className="progress-text">
            {progress.current} / {progress.nextMilestone}
          </span>
          
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress.percentage}%` }}
            ></div>
          </div>
        </div>
        
        <p className="badge-requirement">
          {progress.current >= progress.nextMilestone 
            ? `Completed ${progress.nextMilestone} ${title}!`
            : `Complete ${progress.nextMilestone - progress.current} more ${description} to get Next Badge`
          }
          {progress.nextMilestone - progress.current > 0 && (
            <span className="highlight"> {progress.nextMilestone - progress.current}</span>
          )}
        </p>
      </div>
    </div>
  );

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="badge-container">
        <div className="badge-header">
          <h2 className="badge-title">Badges</h2>
          <button className="share-button" onClick={handleShare}>
            <FiShare2 />
          </button>
        </div>
        <div className="badge-content">
          <div className="loading-badge">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="badge-container">
        <div className="badge-header">
          <h2 className="badge-title">Badges</h2>
          <button className="share-button" onClick={handleShare}>
            <FiShare2 />
          </button>
        </div>
        <div className="badge-content">
          <div className="badge-error">{error}</div>
        </div>
      </div>
    );
  }

  if (!badgeData) {
    return null;
  }

  const { taskBadge, taskProgress, streakBadge, streakProgress, totalCompleted, currentStreak } = badgeData;

  return (
    <div className="badge-container">
      <div className="badge-header">
        <h2 className="badge-title">Badges</h2>
        <button className="share-button" onClick={handleShare}>
          <FiShare2 />
        </button>
      </div>
      
      <div className="badge-content">
        {/* Task Completion Badge */}
        <div className="badge-section">
          <h3 className="badge-section-title">Task Completion</h3>
          {renderBadgeItem(
            taskBadge, 
            taskProgress, 
            'tasks', 
            'tasks'
          )}
          <div className="badge-stats">
            <span>Total completed: {totalCompleted}</span>
          </div>
        </div>

        {/* Streak Badge */}
        <div className="badge-section">
          <h3 className="badge-section-title">Daily Streak</h3>
          {renderBadgeItem(
            streakBadge, 
            streakProgress, 
            'days', 
            'days'
          )}
          <div className="badge-stats">
            <span>Current streak: {currentStreak} days</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Badge; 