import React, { useState } from 'react';
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
  SignedIn,
  SignedOut
} from "@clerk/clerk-react";

import { FiMenu, FiX, FiBell, FiUser, FiLogIn, FiSun, FiMoon } from 'react-icons/fi';
import './Navbar.css';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import logo from '../../assets/logo2.jpg';

const Navbar = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { isSignedIn } = useUser();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, message: "Task deadline approaching", time: "2h ago" },
    { id: 2, message: "New feature available", time: "1d ago" }
  ]);

  const navItems = [
    { name: 'Home', path: '/home' },
    { name: 'Tasks', path: '/tasks' },
    { name: 'Notes', path: '/notes' },
    { name: 'Analytics', path: '/analytics' }
  ];

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const toggleNotifications = () => setShowNotifications(!showNotifications);
  const handleNavigation = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };
  const handleProfile = () => {
    navigate("/profile");
    setIsMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        {/* Left: Brand + Menu */}
        <div className="nav-left">
          <button className="menu-icon" onClick={toggleMenu} aria-label="Toggle menu">
            {isMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
          <div className="brand-container" onClick={() => handleNavigation('/')}>
            <img src={logo} alt="ChronoSync Logo" className="navbar-logo" />
            <h1 className="brand">ChronoSync</h1>
          </div>
        </div>

        {/* Middle: Nav Links */}
        <div className="nav-middle">
          {navItems.map((item) => (
            <button
              key={item.name}
              className="nav-link"
              onClick={() => handleNavigation(item.path)}
            >
              {item.name}
            </button>
          ))}
        </div>

        {/* Right: Theme + Notifications + Auth */}
        <div className="nav-end">
          <button className="theme-toggle icon-button" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <FiSun size={20} /> : <FiMoon size={20} />}
          </button>

          <div className="notification-container">
            <button className="icon-button" onClick={toggleNotifications} aria-label="Notifications">
              <FiBell size={20} />
              {notifications.length > 0 && (
                <span className="notification-badge">{notifications.length}</span>
              )}
            </button>
            {showNotifications && (
              <div className="notification-dropdown">
                <div className="notification-header">
                  <h3>Notifications</h3>
                  <button className="clear-all">Clear All</button>
                </div>
                <div className="notification-list">
                  {notifications.map(notification => (
                    <div key={notification.id} className="notification-item">
                      <p>{notification.message}</p>
                      <span className="notification-time">{notification.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Auth Buttons */}
          <SignedIn>
            <div className="user-menu">
              <button className="profile-button" onClick={handleProfile}>
                <FiUser size={24} />
              </button>
              <UserButton afterSignOutUrl='/' />
            </div>
          </SignedIn>

          <SignedOut>
            <div className="auth-buttons">
              <SignInButton mode="modal">
                <button className="login-button">
                  <FiLogIn size={20} />
                  <span>Login</span>
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="signup-button">
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          </SignedOut>
        </div>

        {/* Mobile Menu */}
        <div className={`mobile-menu ${isMenuOpen ? 'open' : ''}`}>
          <div className="mobile-nav-middle">
            {navItems.map((item) => (
              <button
                key={item.name}
                className="nav-link"
                onClick={() => handleNavigation(item.path)}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="mobile-nav-end">
            <button className="theme-toggle icon-button" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <FiSun size={20} /> : <FiMoon size={20} />}
            </button>

            <button className="icon-button" onClick={toggleNotifications} aria-label="Notifications">
              <FiBell size={20} />
              {notifications.length > 0 && (
                <span className="notification-badge">{notifications.length}</span>
              )}
            </button>

            <SignedIn>
              <button className="profile-button" onClick={handleProfile}>
                <FiUser size={24} />
                <span>Profile</span>
              </button>
              <UserButton afterSignOutUrl='/' />
            </SignedIn>

            <SignedOut>
              <SignInButton mode="modal">
                <button className="login-button">
                  <FiLogIn size={20} />
                  <span>Login</span>
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="signup-button">
                  <span>Sign Up</span>
                </button>
              </SignUpButton>
            </SignedOut>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
