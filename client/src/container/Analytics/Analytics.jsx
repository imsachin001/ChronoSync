import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts'
import Badge from '../../components/Badge/Badge'
import "./Analytics.css"

const Analytics = () => {
  const { isAuthenticated, isLoading, getToken } = useAuth()
  const { theme } = useTheme()
  const [taskStats, setTaskStats] = useState({
    assigned: 0,
    completed: 0,
    overdue: 0
  })
  const [productivityData, setProductivityData] = useState([])
  const [weekOverWeekData, setWeekOverWeekData] = useState([])
  const [averageCompletionTime, setAverageCompletionTime] = useState(0)
  const [completionStreak, setCompletionStreak] = useState({ currentStreak: 0, longestStreak: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const CATEGORY_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c', '#d0ed57'];
  const [categoryData, setCategoryData] = useState([]);
  const [productivityInsights, setProductivityInsights] = useState(null);

  const fetchProductivityInsights = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch('/api/tasks/productivity-insights', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      if (response.ok) {
        const insights = await response.json();
        setProductivityInsights(insights);
      }
    } catch (err) {
      console.error('Error fetching productivity insights:', err);
    }
  };

  const fetchTaskStats = async () => {
    try {
      setLoading(true)
      const token = await getToken();
      if (!token) {
        setError(null)
        setLoading(false)
        return
      }
      let response = await fetch('/api/tasks/stats', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      if (!response.ok) {
        response = await fetch('/api/tasks', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        })
        if (!response.ok) {
          if (response.status === 401) {
            setError(null)
          } else {
            setError(`Failed to fetch task data: ${response.status}`)
          }
          return
        }
        const tasks = await response.json()
        const now = new Date()
        const stats = {
          assigned: tasks.length,
          completed: tasks.filter(task => task.completed).length,
          overdue: tasks.filter(task => {
            const dueDate = new Date(task.dueDate)
            return !task.completed && dueDate < now
          }).length
        }
        setTaskStats(stats)
        setError(null)
      } else {
        const stats = await response.json()
        setTaskStats(stats)
        setError(null)
      }
    } catch (err) {
      setError(`Failed to load task statistics: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchProductivityScore = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch('/api/tasks/productivity-score', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setProductivityData(data)
      }
    } catch (err) {
      console.error('Error fetching productivity score:', err)
    }
  }

  const fetchAverageCompletionTime = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch('/api/tasks/avg-completion-time', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setAverageCompletionTime(data.averageTime)
      }
    } catch (err) {
      console.error('Error fetching average completion time:', err)
    }
  }

  const fetchCompletionStreak = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch('/api/tasks/completion-streak', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setCompletionStreak(data)
      }
    } catch (err) {
      console.error('Error fetching completion streak:', err)
    }
  }

  const fetchWeekOverWeekData = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch('/api/tasks/week-over-week', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      if (response.ok) {
        const weekData = await response.json()
        setWeekOverWeekData(weekData)
      }
    } catch (err) {
      console.error('Error fetching week-over-week data:', err)
    }
  }

  const fetchCategoryCompletions = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch('/api/tasks/category-completions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const arr = Object.entries(data).map(([name, value]) => ({ name, value }));
        setCategoryData(arr);
      }
    } catch (err) {
      console.error('Error fetching category completions:', err);
    }
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      fetchTaskStats();
      fetchProductivityScore();
      fetchAverageCompletionTime();
      fetchCompletionStreak();
      fetchWeekOverWeekData();
      fetchCategoryCompletions();
      fetchProductivityInsights();
    }
  }, [isLoading, isAuthenticated]);

  useEffect(() => {
    const handleTaskUpdate = () => {
      fetchTaskStats();
      fetchProductivityScore();
      fetchAverageCompletionTime();
      fetchCompletionStreak();
      fetchWeekOverWeekData();
      fetchCategoryCompletions();
      fetchProductivityInsights();
    };
    window.addEventListener('taskUpdate', handleTaskUpdate);
    return () => window.removeEventListener('taskUpdate', handleTaskUpdate);
  }, []);

  useEffect(() => {
    console.log('Category data state changed:', categoryData);
  }, [categoryData]);

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="analytics-page">
        <div className="analytics-content">
          <h1 className="analytics-heading">Please log in to view analytics</h1>
        </div>
      </div>
    )
  }

  return (
    <div className="analytics-page">
      <div className="analytics-content">
        <h1 className="analytics-heading">Track your Productivity</h1>
        
        {error && (
          <div className="analytics-error">
            {error}
          </div>
        )}
        
        <div className="analytics-cards">
          <div className="analytics-card">
            <div className="card-icon">📋</div>
            <div className="card-content">
              <h3 className="card-title">Tasks Assigned</h3>
              <div className="card-count">
                {loading ? '...' : taskStats.assigned}
              </div>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon">✅</div>
            <div className="card-content">
              <h3 className="card-title">Tasks Completed</h3>
              <div className="card-count">
                {loading ? '...' : taskStats.completed}
              </div>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon">⏰</div>
            <div className="card-content">
              <h3 className="card-title">Tasks Overdue</h3>
              <div className="card-count">
                {loading ? '...' : taskStats.overdue}
              </div>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon">⏱️</div>
            <div className="card-content">
              <h3 className="card-title">Avg Completion Time</h3>
              <div className="card-count">
                {loading ? '...' : `${averageCompletionTime}h`}
              </div>
            </div>
          </div>
          
          <div className="analytics-card">
            <div className="card-icon">🔥</div>
            <div className="card-content">
              <h3 className="card-title">Completion Streak</h3>
              <div className="card-count">
                {loading ? '...' : completionStreak.currentStreak}
              </div>
            </div>
          </div>
        </div>

        {/* Productivity Score Chart and Badges */}
        <div className="charts-section">
          <div className="productivity-chart-container">
            <h2 className="chart-title">Productivity Score</h2>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={productivityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#4a5568' : '#e2e8f0'} />
                  <XAxis 
                    dataKey="day" 
                    stroke={theme === 'dark' ? '#a0aec0' : '#64748b'}
                    fontSize={12}
                  />
                  <YAxis 
                    stroke={theme === 'dark' ? '#a0aec0' : '#64748b'}
                    fontSize={12}
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#2d3748' : '#ffffff',
                      border: `1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      color: theme === 'dark' ? '#f7fafc' : '#2c3e50'
                    }}
                    formatter={(value, name) => [`${value}%`, 'Productivity Score']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#667eea" 
                    strokeWidth={3}
                    dot={{ fill: '#667eea', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, stroke: '#667eea', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="badge-section">
            <Badge />
          </div>
        </div>

        {/* Week-over-Week Comparison */}
        <div className="week-comparison-section">
          <div className="week-comparison-chart-container">
            <h2 className="chart-title">Week-over-Week Comparison</h2>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weekOverWeekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#4a5568' : '#e2e8f0'} />
                  <XAxis 
                    dataKey="week" 
                    stroke={theme === 'dark' ? '#a0aec0' : '#64748b'}
                    fontSize={12}
                  />
                  <YAxis 
                    stroke={theme === 'dark' ? '#a0aec0' : '#64748b'}
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#2d3748' : '#ffffff',
                      border: `1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      color: theme === 'dark' ? '#f7fafc' : '#2c3e50'
                    }}
                    formatter={(value, name) => [value, 'Tasks']}
                  />
                  <Bar 
                    dataKey="tasks" 
                    fill="#667eea" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="week-comparison-chart-container">
            <h2 className="chart-title">Tasks by Category</h2>
            <div className="chart-wrapper">
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {categoryData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  height: '300px',
                  color: theme === 'dark' ? '#a0aec0' : '#64748b',
                  fontSize: '16px'
                }}>
                  No completed tasks by category yet. Complete some tasks to see the breakdown!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Productivity Insights Summary */}
        <div className="productivity-insights-section">
          <h2 className="chart-title">🧠 Your Productivity Insights</h2>
          {productivityInsights ? (
            <div className="insights-content">
              <div className="insight-item">
                <strong>You're most productive on:</strong> {productivityInsights.mostProductiveDay}
              </div>
              <div className="insight-item">
                <strong>Most tasks created:</strong> "{productivityInsights.mostUsedCategory}" category
              </div>
              <div className="insight-item">
                <strong>You completed {productivityInsights.completionPercentage}% of your tasks this week</strong>
                {productivityInsights.completionPercentage >= 75 ? ' – great job!' : 
                 productivityInsights.completionPercentage >= 50 ? ' – keep it up!' : 
                 ' – room for improvement!'}
              </div>
              <div className="insight-details">
                <small>
                  ({productivityInsights.completedTasksThisWeek} completed out of {productivityInsights.totalTasksThisWeek} total tasks this week)
                </small>
              </div>
            </div>
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '200px',
              color: theme === 'dark' ? '#a0aec0' : '#64748b',
              fontSize: '16px'
            }}>
              No productivity insights available yet. Complete more tasks to generate insights!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Analytics