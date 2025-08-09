import React from 'react';
import { FiFacebook, FiTwitter, FiInstagram, FiLinkedin } from 'react-icons/fi';

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
            <FiFacebook />
            <FiTwitter />
            <FiInstagram />
            <FiLinkedin />
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© 2024 ChronoSync. All rights reserved</p>
        <div className="legal-links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;