import React from 'react';
import { FiCalendar, FiEdit, FiPieChart, FiClock, FiBell, FiZap } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const Features = () => {
  const navigate = useNavigate();
  const features = [
    {
      icon: <FiCalendar />,
      title: "AI Task Scheduler",
      desc: "Get intelligent task recommendations based on your priorities, deadlines, and work patterns. Our AI learns from your habits to optimize your schedule.",
      path: "/tasks"
    },
    {
      icon: <FiEdit />,
      title: "Smart Notes",
      desc: "Create rich text notes with AI-powered organization. Get automatic summaries and smart tagging for better content management.",
      path: "/notes"
    },
    {
      icon: <FiPieChart />,
      title: "Productivity Analytics",
      desc: "Track your progress with detailed analytics. Visualize your productivity trends and get personalized improvement suggestions.",
      path: "/analytics"
    },
    {
      icon: <FiClock />,
      title: "Focus Timer",
      desc: "Stay focused with customizable Pomodoro sessions. Track your deep work time and maintain optimal productivity.",
      path: "/pomodoro"
    },
    {
      icon: <FiBell />,
      title: "Smart Reminders",
      desc: "Never miss a deadline with intelligent reminders. Get notifications based on task priority and your schedule.",
      path: "/reminders"
    },
    {
      icon: <FiZap />,
      title: "Quick Actions",
      desc: "Speed up your workflow with keyboard shortcuts and quick task creation. Work faster with our intuitive interface.",
      path: "/shortcuts"
    }
  ];
  

  const handleNavigation = (path)=>{
    navigate(path);
  }

  return (
    <section className="features-section">
      <div className="section-header">
        <h2>Powerful Features for Maximum Productivity</h2>
        <p className="section-subtitle">
          Everything you need to organize, track, and optimize your workflow
        </p>
      </div>
      <div className="features-grid" >
        {features.map((feature, index) => (
          <div
            className="feature-card"
            key={index}
            onClick={() => handleNavigation(feature.path)}
          >
            <div className="feature-icon">{feature.icon}</div>
            <h3>{feature.title}</h3>
            <p>{feature.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Features;