import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const handleJoinGame = () => {
    navigate('/join');
  };

  const handleAdminPanel = () => {
    navigate('/login');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔍 Klopjacht</h1>
        <p>Interactive outdoor chase game</p>
        <div className="game-features">
          <div className="feature">
            <h3>For Fugitives</h3>
            <ul>
              <li>Complete 6 missions</li>
              <li>Scan QR codes</li>
              <li>Reach extraction point</li>
            </ul>
          </div>
          <div className="feature">
            <h3>For Hunters</h3>
            <ul>
              <li>Track fugitives</li>
              <li>Real-time updates</li>
              <li>Prevent escape</li>
            </ul>
          </div>
          <div className="feature">
            <h3>For Game Masters</h3>
            <ul>
              <li>Create games</li>
              <li>Set tasks & locations</li>
              <li>Monitor progress</li>
            </ul>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={handleJoinGame}>
            Join Game
          </button>
          <button className="btn btn-secondary" onClick={handleAdminPanel}>
            Admin Panel
          </button>
        </div>
      </header>
    </div>
  );
};

export default HomePage;
