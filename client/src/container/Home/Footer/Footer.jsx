import React from 'react';
import { FiGithub, FiInstagram, FiLinkedin } from 'react-icons/fi';

const Footer = () => {
  return (
    <footer className="main-footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>ChronoSync</h3>
          <p>Transform your productivity with AI-powered task management</p>
        </div>

        <div className="footer-section">
          <h4>Connect</h4>
          <div className="social-icons">
            <a href="https://www.instagram.com/jsoneh1t/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <FiInstagram />
            </a>
            <a href="https://github.com/imsachin001" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <FiGithub />
            </a>
            <a href="https://www.linkedin.com/in/sachin-jangid-18954b289/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <FiLinkedin />
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} ChronoSync. All rights reserved</p>
        <div className="legal-links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;