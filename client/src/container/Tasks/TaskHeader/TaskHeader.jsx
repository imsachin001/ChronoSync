import React from 'react';
import { FiCheckSquare, FiPlus, FiSearch, FiFilter, FiChevronDown } from 'react-icons/fi';
import './TaskHeader.css';

const TaskHeader = ({ 
  searchQuery, 
  setSearchQuery, 
  selectedFilter, 
  setSelectedFilter, 
  selectedPriority, 
  setSelectedPriority,
  setShowTaskForm 
}) => {
  const [showPriorityDropdown, setShowPriorityDropdown] = React.useState(false);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleFilterClick = (filter) => {
    setSelectedFilter(filter);
  };

  const handlePrioritySelect = (priority) => {
    setSelectedPriority(priority);
    setShowPriorityDropdown(false);
  };

  return (
    <header className='tasks-header'>
      <div className='header-top'>
        <h1><FiCheckSquare/>My Tasks</h1>
        <div className='header-actions'>
          <button className='btn-primary' onClick={() => setShowTaskForm(true)}>
            <FiPlus/> New Task
          </button>
        </div>
      </div>

      <div className='header-controls'>
        <div className='search-bar'>
          <FiSearch/>
          <input 
            type='text'
            placeholder='Search Tasks...'
            value={searchQuery}
            onChange={handleSearch}
          />
        </div>
        <div className='filters'>
          <button 
            className={`filter-btn ${selectedFilter === 'all' ? 'active' : ''}`}
            onClick={() => handleFilterClick('all')}
          >
            All Tasks
          </button>
          <button 
            className={`filter-btn ${selectedFilter === 'today' ? 'active' : ''}`}
            onClick={() => handleFilterClick('today')}
          >
            Today
          </button>
          <button 
            className={`filter-btn ${selectedFilter === 'week' ? 'active' : ''}`}
            onClick={() => handleFilterClick('week')}
          >
            This Week
          </button>
          <div className="priority-dropdown">
            <button 
              className="dropdown-btn"
              onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
            >
              <FiFilter /> Priority <FiChevronDown />
            </button>
            {showPriorityDropdown && (
              <div className="dropdown-content">
                <button 
                  className={`priority-option ${selectedPriority === 'all' ? 'active' : ''}`}
                  onClick={() => handlePrioritySelect('all')}
                >
                  All Priorities
                </button>
                <button 
                  className={`priority-option ${selectedPriority === 'low' ? 'active' : ''}`}
                  onClick={() => handlePrioritySelect('low')}
                >
                  Low
                </button>
                <button 
                  className={`priority-option ${selectedPriority === 'medium' ? 'active' : ''}`}
                  onClick={() => handlePrioritySelect('medium')}
                >
                  Medium
                </button>
                <button 
                  className={`priority-option ${selectedPriority === 'high' ? 'active' : ''}`}
                  onClick={() => handlePrioritySelect('high')}
                >
                  High
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TaskHeader;
