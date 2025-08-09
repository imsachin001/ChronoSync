import React, { useState, useEffect } from 'react';
import { FiCalendar, FiClock, FiTag, FiX } from 'react-icons/fi';
import './TaskForm.css';
import { useAuth } from '../../../context/AuthContext';

const CATEGORY_OPTIONS = [
  '🧠 Study',
  '💼 Work',
  '🧘 Personal',
  '🛠️ Projects',
  '🛒  Others'
];

const TaskForm = ({ onTaskAdded, onClose, newTask, setNewTask, handleAddTask }) => {
  const { getToken } = useAuth();
  const [formData, setFormData] = useState({
    title: newTask?.title || '',
    description: newTask?.description || '',
    dueDate: newTask?.dueDate || '',
    dueTime: newTask?.dueTime || '',
    priority: newTask?.priority || 'medium',
    tags: newTask?.tags || [],
    estimatedTime: newTask?.estimatedTime || '',
    category: newTask?.category || CATEGORY_OPTIONS[0]
  });

  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    }
    
    if (!formData.dueTime) {
      newErrors.dueTime = 'Due time is required';
    }
    
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      const data = await response.json();
      if (typeof onTaskAdded === 'function') {
        onTaskAdded(data);
      }
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        dueDate: '',
        dueTime: '',
        priority: 'medium',
        tags: [],
        estimatedTime: '',
        category: CATEGORY_OPTIONS[0]
      });
      setNewTag('');
      setErrors({});
    } catch (error) {
      setErrors({ submit: 'Failed to create task. Please try again.' });
      console.error('Error creating task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="modal-overlay">
      <div className='task-form'>
        <div className="modal-header">
          <h3>Create New Task</h3>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className='form-group'>
            <label htmlFor="title">Task Title *</label>
            <input
              id="title"
              type='text'
              placeholder='Enter task title'
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className={errors.title ? 'error' : ''}
            />
            {errors.title && <span className="error-message">{errors.title}</span>}
          </div>

          <div className='form-group'>
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              placeholder='Enter task description'
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows="3"
            />
          </div>

          <div className='form-row'>
            <div className='form-group'>
              <label htmlFor="dueDate">Due Date *</label>
              <div className="input-with-icon">
                <FiCalendar className="input-icon" />
                <input
                  id="dueDate"
                  type='date'
                  value={formData.dueDate}
                  onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                  className={errors.dueDate ? 'error' : ''}
                />
              </div>
              {errors.dueDate && <span className="error-message">{errors.dueDate}</span>}
            </div>

            <div className='form-group'>
              <label htmlFor="dueTime">Due Time</label>
              <div className="input-with-icon">
                <FiClock className="input-icon" />
                <input
                  id="dueTime"
                  type='time'
                  value={formData.dueTime}
                  onChange={(e) => setFormData({...formData, dueTime: e.target.value})}
                  className={errors.dueTime ? 'error' : ''}
                />
              </div>
              {errors.dueTime && <span className="error-message">{errors.dueTime}</span>}
            </div>
          </div>

          <div className='form-row'>
            <div className='form-group'>
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData({...formData, priority: e.target.value})}
              >
                <option value='low'>Low</option>
                <option value='medium'>Medium</option>
                <option value='high'>High</option>
              </select>
            </div>

            <div className='form-group'>
              <label htmlFor="estimatedTime">Estimated Time</label>
              <div className="input-with-icon">
                <FiClock className="input-icon" />
                <input
                  id="estimatedTime"
                  type='text'
                  placeholder='e.g., 2 hours'
                  value={formData.estimatedTime}
                  onChange={(e) => setFormData({...formData, estimatedTime: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className='form-group'>
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              className={errors.category ? 'error' : ''}
              required
            >
              {CATEGORY_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {errors.category && <span className="error-message">{errors.category}</span>}
          </div>

          <div className='form-group'>
            <label htmlFor="tags">Tags</label>
            <div className="tags-input">
              <div className="input-with-icon">
                <FiTag className="input-icon" />
                <input
                  id="tags"
                  type='text'
                  placeholder='Add tags (press Enter)'
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyUp={handleKeyPress}
                />
              </div>
              <button 
                type="button" 
                className="add-tag-button"
                onClick={handleAddTag}
              >
                Add
              </button>
            </div>
            <div className="tags-list">
              {formData.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                  <button 
                    type="button"
                    className="remove-tag"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    <FiX size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {errors.submit && (
            <div className="submit-error">{errors.submit}</div>
          )}

          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type='submit' 
              className='submit-button'
              disabled={loading}
            >
              {loading ? 'Creating Task...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskForm;
