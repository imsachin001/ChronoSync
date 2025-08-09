import React, { useState } from 'react';
import { FiSearch, FiPlus } from 'react-icons/fi';
import { IoMdClose } from 'react-icons/io';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../../context/ThemeContext';
import './NotesHeader.css';

const NotesHeader = ({ onShowForm, searchQuery, setSearchQuery }) => {
  const navigate = useNavigate();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { theme } = useTheme();

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className={`notes-header ${theme === 'dark' ? 'dark' : ''}`}>
      <div className={`search-container ${isSearchFocused ? 'focused' : ''}`}>
        <div className="search-icon">
          <FiSearch />
        </div>
        <input
          type="text"
          placeholder="Search notes"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          className="search-input"
        />
        {searchQuery && (
          <button className="clear-search" onClick={clearSearch}>
            <IoMdClose />
          </button>
        )}
      </div>
      <button className="add-note-btn" onClick={onShowForm} title="Add note">
        <FiPlus />
      </button>
      <button className="take-note-fab" onClick={onShowForm}>
        Take a note...
      </button>
    </div>
  );
};

export default NotesHeader;
