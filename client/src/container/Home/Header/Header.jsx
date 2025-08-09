import React from 'react';
import { FiArrowRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import tasksImage from '../../../assets/tasks.avif';
import notesImage from '../../../assets/notes.jpg';
import logo from '../../../assets/logo2.jpg';


const Header = () => {
  const navigate = useNavigate();
  const handleClick = () => {
    navigate("/signup");
  };

  return (
    <header className="hero-section">
      {/* Top corner images */}
      <div className="corner-image top-left">
        <img src={tasksImage} alt="Tasks" />
      </div>
      <div className="corner-image top-right">
        <img src={notesImage} alt="Notes" />
        <div className="note-text">Don't forget!</div>
      </div>
      
              <div className="hero-content">
          <div className="logo-section">
            <img src={logo} alt="ChronoSync Logo" className="logo-image" />
          </div>
        
        <h1 className="main-headline">
          Think, plan, and track
          <span className="sub-headline">all in one place</span>
        </h1>
        
        <p className="description">
          Efficiently manage your tasks and boost productivity.
        </p>
        
        <button className="cta-button" onClick={handleClick}>
          Get free demo <FiArrowRight />
        </button>
      </div>
    </header>
  );
};

export default Header;