import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiClock, FiAlertCircle, FiClipboard, FiRefreshCw } from 'react-icons/fi';
import './Taskfooter.css';

const Taskfooter = ({ tasks = [] }) => {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  
  // Productivity tips and motivational quotes
  const tips = [
    "Break large tasks into subtasks to reduce procrastination.",
    "Use the 2-minute rule: If a task takes less than 2 minutes, do it now.",
    "Missed a task? Use the AI Assistant to reassign it smartly.",
    "The most productive time of day is different for everyone. Find yours!",
    "Schedule focused work blocks of 25-45 minutes with short breaks in between.",
    "Your future self will thank you for completing tasks on time today.",
    "Set SMART goals: Specific, Measurable, Achievable, Relevant, and Time-bound.",
    "Done is better than perfect. Aim for progress, not perfection.",
    "Prioritize tasks that align with your long-term goals.",
    "Remember to celebrate your achievements, no matter how small."
  ];
  
  // Rotate tips every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTipIndex((prevIndex) => (prevIndex + 1) % tips.length);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [tips.length]);
  
  // Calculate task statistics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.completed).length;
  const pendingTasks = totalTasks - completedTasks;
  
  // Calculate overdue tasks (tasks with due date in the past and not completed)
  const overdueTasks = tasks.filter(task => {
    if (task.completed) return false;
    if (!task.dueDate) return false;
    
    const dueDate = new Date(task.dueDate);
    const now = new Date();
    return dueDate < now;
  }).length;

  return (
    <div className="taskfooter-container">
      <div className="task-summary">
        <div className="summary-item total">
          <FiClipboard className="summary-icon" />
          <div className="summary-text">
            <span className="summary-count">{totalTasks}</span>
            <span className="summary-label">Total Tasks</span>
          </div>
        </div>
        
        <div className="summary-item completed">
          <FiCheckCircle className="summary-icon" />
          <div className="summary-text">
            <span className="summary-count">{completedTasks}</span>
            <span className="summary-label">Completed</span>
          </div>
        </div>
        
        <div className="summary-item pending">
          <FiClock className="summary-icon" />
          <div className="summary-text">
            <span className="summary-count">{pendingTasks}</span>
            <span className="summary-label">Pending</span>
          </div>
        </div>
        
        <div className="summary-item overdue">
          <FiAlertCircle className="summary-icon" />
          <div className="summary-text">
            <span className="summary-count">{overdueTasks}</span>
            <span className="summary-label">Overdue</span>
          </div>
        </div>
      </div>
      
      <div className="productivity-tip">
        <FiRefreshCw className="tip-icon" />
        <p className="tip-text">{tips[currentTipIndex]}</p>
      </div>
    </div>
  );
};

export default Taskfooter;
