import React, { useState } from 'react';
import { FiEdit, FiArchive, FiBell, FiTrash, FiTag, FiMenu, FiX, FiSun, FiMoon } from 'react-icons/fi';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import './Sidebar.css';


const Sidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const sideBarItems = [
        { name: 'Notes', path: '/notes', icon: <FiEdit /> },
        { name: 'Reminders', path: '/notes/reminders', icon: <FiBell /> },
        { name: 'Archive', path: '/notes/archive', icon: <FiArchive /> },
        { name: 'Trash', path: '/notes/trash', icon: <FiTrash /> }
    ];

    const handleNavigation = (path) => {
        navigate(path);
        if (window.innerWidth <= 768) {
            setIsMenuOpen(false);
        }
    };

    return (
        <>
            <div className="hamburger-menu" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <FiX /> : <FiMenu />}
            </div>
            <nav className={`sideBar ${isMenuOpen ? 'open' : ''} ${theme === 'dark' ? 'dark' : ''}`}>
                <div className="sidebar-header">
                    <h2>Notes</h2>
                </div>
                <div className='sideBarContainer'>
                    {sideBarItems.map((item) => (
                        <button
                            key={item.name}
                            className={`sideBar-link ${location.pathname === item.path ? 'active' : ''}`}
                            onClick={() => handleNavigation(item.path)}
                        >
                            {item.icon}
                            <span>{item.name}</span>
                        </button>
                    ))}
                </div>
            </nav>
        </>
    );
};

export default Sidebar;