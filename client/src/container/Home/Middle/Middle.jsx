import React from 'react';
import { FiUserPlus, FiList, FiTrendingUp, FiCheckCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const Middle = () => {
  const navigate = useNavigate();
  const steps = [
    {
      icon: <FiUserPlus />,
      title: "Create Your Account",
      desc: "Sign up in seconds and start organizing your tasks immediately. No credit card required.",
      path: "/signup"
    },
    {
      icon: <FiList />,
      title: "Add Your Tasks",
      desc: "Import existing tasks or create new ones. Our AI will help you organize and prioritize them.",
      path: "/tasks"
    },
    {
      icon: <FiTrendingUp />,
      title: "Boost Productivity",
      desc: "Watch your productivity soar with smart scheduling and automated task management.",
      path: "/analytics"
    }
  ];

  const benefits = [
    "AI-powered task scheduling",
    "Smart reminders and notifications",
    "Detailed productivity analytics",
    "Cross-platform synchronization",
    "Team collaboration features",
    "Customizable workflows"
  ];

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <section className="how-it-works">
      <div className="section-header">
        <h2>Get Started in 3 Simple Steps</h2>
        <p className="section-subtitle">
          Join thousands of users who have transformed their productivity with ChronoSync
        </p>
      </div>
      <div className="steps-container">
        {steps.map((step, index) => (
          <div className="step-card" key={index} onClick={() => handleNavigation(step.path)}>
            <div className="step-number">{index + 1}</div>
            <div className="step-icon">{step.icon}</div>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </div>
        ))}
      </div>
      <div className="benefits-section">
        <h3>What You'll Get</h3>
        <div className="benefits-grid">
          {benefits.map((benefit, index) => (
            <div key={index} className="benefit-item">
              <FiCheckCircle className="benefit-icon" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Middle;