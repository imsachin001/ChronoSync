import React, { useState, useEffect, useRef } from 'react'
import "./Profile.css"
import { useAuth } from '../../context/AuthContext'
import { createApi } from '../../utils/api'
import { useUser } from '@clerk/clerk-react'
import Heatmap from '../../components/Heatmap/Heatmap'

const Profile = () => {
  const { user, getToken } = useAuth()
  const { user: clerkUser } = useUser()
  const [streakData, setStreakData] = useState(null)
  const [showImageOptions, setShowImageOptions] = useState(false)
  const [profession, setProfession] = useState('Student') // Default profession
  const [isEditingProfession, setIsEditingProfession] = useState(false)
  const [loading, setLoading] = useState(true)
  const [badgeData, setBadgeData] = useState(null)
  const [badgeLoading, setBadgeLoading] = useState(true)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchStreakData()
    fetchBadgeData()
    // Auto-refresh every 5 seconds to catch updates
    const interval = setInterval(() => {
      fetchStreakData()
      fetchBadgeData()
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const fetchStreakData = async () => {
    try {
      const api = createApi(getToken)
      const data = await api.getCompletionStreak()
      setStreakData(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching streak data:', error)
      setLoading(false)
    }
  }

  const fetchBadgeData = async () => {
    try {
      const api = createApi(getToken)
      const data = await api.getBadges()
      setBadgeData(data)
      setBadgeLoading(false)
    } catch (error) {
      console.error('Error fetching badge data:', error)
      setBadgeLoading(false)
    }
  }

  const getStageInfo = (streak) => {
    if (streak >= 365) return { stage: 5, name: 'Master', color: '#FF6B35' }
    if (streak >= 180) return { stage: 4, name: 'Expert', color: '#9B51E0' }
    if (streak >= 90) return { stage: 3, name: 'Advanced', color: '#2E86DE' }
    if (streak >= 30) return { stage: 2, name: 'Intermediate', color: '#26C281' }
    return { stage: 1, name: 'Beginner', color: '#95A5A6' }
  }

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageChange = async (event) => {
    const file = event.target.files[0]
    if (file) {
      try {
        // Upload to Clerk
        await clerkUser.setProfileImage({ file })
        console.log('Profile image updated successfully')
      } catch (error) {
        console.error('Error updating profile image:', error)
      }
    }
  }

  const currentStreak = streakData?.currentStreak || 0
  const stageInfo = getStageInfo(currentStreak)

  // Function to get badge card gradient based on type and level
  const getBadgeGradient = (type, level) => {
    const gradients = {
      task: [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Level 1-2
        'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)', // Level 3-4
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Level 5-6
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Level 7+
      ],
      streak: [
        'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)', // Level 1-2
        'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', // Level 3-4
        'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)', // Level 5-6
        'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)', // Level 7+
      ]
    };
    
    const gradientIndex = Math.min(Math.floor((level - 1) / 2), 3);
    return gradients[type]?.[gradientIndex] || gradients.task[0];
  }

  return (
    <div className='profile-page'>
      <div className='profile-container'>
        {/* Left Section - Profile Info */}
        <div className='profile-left'>
          {/* Profile Header - Picture and Info Side by Side */}
          <div className='profile-header'>
            <div 
              className='profile-picture-wrapper'
              onMouseEnter={() => setShowImageOptions(true)}
              onMouseLeave={() => setShowImageOptions(false)}
              onClick={handleImageClick}
            >
              <img 
                src={user?.imageUrl || '/default-avatar.png'} 
                alt='Profile' 
                className='profile-picture'
              />
              {showImageOptions && (
                <div className='profile-picture-overlay'>
                  <span className='change-photo-text'>Change Photo</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type='file'
                accept='image/*'
                onChange={handleImageChange}
                style={{ display: 'none' }}
              />
            </div>

            <div className='profile-info'>
              <div className='profile-info-row'>
                <span className='info-label'>Name:</span>
                <h2 className='profile-username'>{user?.name || 'User'}</h2>
              </div>
              <div className='profile-info-row'>
                <span className='info-label'>Profession:</span>
                {isEditingProfession ? (
                  <input
                    type='text'
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    onBlur={() => setIsEditingProfession(false)}
                    onKeyPress={(e) => e.key === 'Enter' && setIsEditingProfession(false)}
                    className='profession-input'
                    autoFocus
                  />
                ) : (
                  <p 
                    className='profile-profession' 
                    onClick={() => setIsEditingProfession(true)}
                  >
                    {profession}
                  </p>
                )}
              </div>
              <div className='profile-info-row'>
                <span className='info-label'>Email:</span>
                <p className='profile-email'>{user?.email || 'Not available'}</p>
              </div>
            </div>
          </div>

          {/* Heatmap Placeholder */}
          <div className='heatmap-placeholder'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Activity Heatmap</h3>
              <button 
                onClick={fetchStreakData} 
                className='refresh-button'
                disabled={loading}
              >
                {loading ? 'Loading...' : '🔄 Refresh'}
              </button>
            </div>
            <div className='heatmap-content'>
              {loading ? (
                <p>Loading activity data...</p>
              ) : streakData?.activityData && streakData.activityData.length > 0 ? (
                <Heatmap activityData={streakData.activityData} />
              ) : (
                <p style={{ textAlign: 'center', color: '#9CA3AF' }}>
                  No activity yet. Complete some tasks to see your activity heatmap!
                </p>
              )}
            </div>
          </div>

          {/* Badges Section */}
          <div className='profile-badges-section'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3>Achieved Badges</h3>
              <span className='badge-count'>
                {badgeData?.badgesEarned?.length || 0} {badgeData?.badgesEarned?.length === 1 ? 'Badge' : 'Badges'}
              </span>
            </div>
            <div className='badges-grid'>
              {badgeLoading ? (
                <p>Loading badges...</p>
              ) : badgeData?.badgesEarned && badgeData.badgesEarned.length > 0 ? (
                // Display all earned badges sorted by date (newest first)
                [...badgeData.badgesEarned]
                  .sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt))
                  .map((badge, index) => (
                    <div 
                      key={`${badge.type}-${badge.level}-${index}`} 
                      className='badge-card'
                      style={{ background: getBadgeGradient(badge.type, badge.level) }}
                    >
                      <div className='badge-card-icon'>{badge.emoji}</div>
                      <div className='badge-card-info'>
                        <h4 className='badge-card-name'>{badge.name}</h4>
                        <p className='badge-card-desc'>
                          {badge.type === 'task' ? 'Task Completion' : 'Daily Streak'} • Level {badge.level}
                        </p>
                        <div className='badge-card-stats'>
                          <span className='badge-earned-date'>
                            Earned {new Date(badge.earnedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
              ) : (
                <p style={{ textAlign: 'center', color: '#9CA3AF', gridColumn: '1 / -1' }}>
                  Complete tasks and build streaks to earn badges! 🎯
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Section - Streak Stage */}
        <div className='profile-right'>
          <div className='stage-container'>
            <div className='stage-number' style={{ borderColor: stageInfo.color }}>
              {currentStreak}
            </div>
            <div className='stage-info'>
              <span className='stage-label'>Stage {stageInfo.stage}</span>
              <span className='stage-name' style={{ color: stageInfo.color }}>
                {stageInfo.name}
              </span>
            </div>
          </div>

          <div className='streak-details'>
            <div className='streak-stat'>
              <span className='streak-label'>Current Streak</span>
              <span className='streak-value'>{currentStreak} days</span>
            </div>
            <div className='streak-stat'>
              <span className='streak-label'>Longest Streak</span>
              <span className='streak-value'>{streakData?.longestStreak || 0} days</span>
            </div>
          </div>

          {/* Stage Progress */}
          <div className='stage-progress'>
            <h4>Next Stage Progress</h4>
            <div className='progress-stages'>
              {[1, 2, 3, 4, 5].map((stage) => (
                <div 
                  key={stage}
                  className={`stage-dot ${stageInfo.stage >= stage ? 'active' : ''}`}
                  style={stageInfo.stage >= stage ? { backgroundColor: stageInfo.color } : {}}
                >
                  {stage}
                </div>
              ))}
            </div>
            <div className='stage-milestones'>
              <span>0d</span>
              <span>30d</span>
              <span>90d</span>
              <span>180d</span>
              <span>365d</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
