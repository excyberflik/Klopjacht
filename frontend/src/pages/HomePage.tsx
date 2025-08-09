import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const handleJoinGame = () => {
    navigate('/join');
  };

  const handleAdminPortal = () => {
    navigate('/login');
  };

  return (
    <div className="App">
      <div className="landing-page">
        <div className="logo-container">
          <img 
            src="/klopjacht-logo.png" 
            alt="KLOPJACHT - Interactive Outdoor Chase Game" 
            className="main-logo"
            onError={(e) => {
              // Fallback if logo image is not found
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'block';
            }}
          />
          <div className="logo-fallback" style={{ display: 'none' }}>
            <h1 className="logo-text">KLOPJACHT</h1>
            <p className="logo-subtitle">INTERACTIVE OUTDOOR CHASE GAME</p>
          </div>
        </div>
        
        <div className="main-actions">
          <button className="btn btn-primary btn-large" onClick={handleJoinGame}>
            🎮 Join Game
          </button>
          <button className="btn btn-secondary btn-large" onClick={handleAdminPortal}>
            🔧 Admin Portal
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
