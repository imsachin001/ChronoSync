import React from 'react';
import Header from './Header/Header';
import Features from './Features/Features';
import Middle from './Middle/Middle';
import Footer from './Footer/Footer';
import './Home.css';

const Home = () => {
  return (
    <div className="home-container">
      <Header />
      <Features />
      <Middle />
      <Footer />
    </div>
  );
};

export default Home;