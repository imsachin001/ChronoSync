import React, { useState, useEffect } from 'react';
import { FiCalendar, FiClock, FiEdit, FiTrash, FiFilter } from 'react-icons/fi';
import { useAuth } from '@clerk/clerk-react';
import BadgeNotification from '../../../components/Badge/BadgeNotification';
import { createApi } from '../../../utils/api';
import './TaskList.css';

const TaskList = ({ searchQuery, selectedFilter, selectedPriority, onTaskUpdate }) => {
  const { getToken, isSignedIn } = useAuth();
  const [tasks, setTasks] = useState([]);
  const api = createApi(getToken);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [badgeNotification, setBadgeNotification] = useState({ isVisible: false, badge: null });

  useEffect(() => {
    if (isSignedIn) {
      fetchTasks();
    }
  }, [isSignedIn]);

  useEffect(() => {
    filterTasks();
  }, [tasks, searchQuery, selectedFilter, selectedPriority]);

  const fetchTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      setError('Failed to load tasks. Please try again later.');
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = () => {
    let filtered = [...tasks];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply date filter
    if (selectedFilter === 'week') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      
      filtered = filtered.filter(task => {
        const taskDate = new Date(task.dueDate);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate >= today && taskDate <= nextWeek;
      });
    } else if (selectedFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      filtered = filtered.filter(task => {
        const taskDate = new Date(task.dueDate);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate >= today && taskDate < tomorrow;
      });
    }
    // No date filtering needed for 'all' filter

    // Apply priority filter
    if (selectedPriority && selectedPriority !== 'all') {
      filtered = filtered.filter(task => task.priority === selectedPriority);
    }

    setFilteredTasks(filtered);
  };

  const toggleTaskCompletion = async (taskId) => {
    try {
      const data = await api.toggleTask(taskId);
      
      // Update local state with new completion status
      const updatedTasks = tasks.map(task => 
        task._id === taskId ? { ...task, completed: !task.completed } : task
      );
      
      setTasks(updatedTasks);
      
      // Show badge notification if a new badge was earned
      if (data.newlyEarnedBadge) {
        setBadgeNotification({
          isVisible: true,
          badge: data.newlyEarnedBadge
        });
      }
      
      // Notify parent component of the task update if callback exists
      if (onTaskUpdate) {
        onTaskUpdate(updatedTasks);
      }
    } catch (err) {
      setError('Failed to update task. Please try again.');
      console.error('Error updating task:', err);
    }
  };

  const deleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      await api.deleteTask(taskId);

      // Update local state after successful deletion
      const updatedTasks = tasks.filter(task => task._id !== taskId);
      setTasks(updatedTasks);
      
      // Notify parent component of the task update if callback exists
      if (onTaskUpdate) {
        onTaskUpdate(updatedTasks);
      }
    } catch (err) {
      setError('Failed to delete task. Please try again.');
      console.error('Error deleting task:', err);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const closeBadgeNotification = () => {
    setBadgeNotification({ isVisible: false, badge: null });
  };

  if (loading) {
    return <div className="loading">Loading tasks...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (filteredTasks.length === 0) {
    return <div className="no-tasks">No tasks found. Create your first task!</div>;
  }

  return (
    <>
      <div className='task-list'>
        {filteredTasks.map((task) => (
          <TaskCard 
            key={task._id} 
            task={task}
            toggleTaskCompletion={() => toggleTaskCompletion(task._id)}
            deleteTask={() => deleteTask(task._id)}
            formatDate={formatDate}
            formatTime={formatTime}
          />
        ))}
      </div>
      
      <BadgeNotification
        badge={badgeNotification.badge}
        isVisible={badgeNotification.isVisible}
        onClose={closeBadgeNotification}
      />
    </>
  );
};

const TaskCard = ({ task, toggleTaskCompletion, deleteTask, formatDate, formatTime }) => {
  return (
    <div className={`task-card ${task.priority} ${task.completed ? 'completed' : ''}`}>
      <div className="task-main">
        <div className="task-checkbox">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={toggleTaskCompletion}
          />
        </div>
        <div className="task-content">
          <h4>{task.title}</h4>
          <div className="task-meta">
            <span><FiCalendar /> {formatDate(task.dueDate)}</span>
            <span><FiClock /> {formatTime(task.dueTime)}</span>
          </div>
          {task.tags && task.tags.length > 0 && (
            <div className="task-tags">
              {task.tags.map((tag) => (
                <span key={tag} className="task-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="task-actions">
        <button className="btn-edit" title="Edit Task">
          <FiEdit />
        </button>
        <button 
          className="btn-delete" 
          onClick={deleteTask}
          title="Delete Task"
        >
          <FiTrash />
        </button>
      </div>
    </div>
  );
};

export default TaskList;
