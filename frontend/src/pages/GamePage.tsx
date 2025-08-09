import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const GamePage = () => {
  const navigate = useNavigate();
  const { gameId } = useParams();

  const handleBack = () => {
    navigate('/');
  };

  const handleScanQR = () => {
    // For demo purposes, simulate QR code scanning
    alert(`QR Scanner activated!\n\nIn a real implementation, this would:\n- Access device camera\n- Scan QR codes at task locations\n- Submit answers to unlock next location\n\nGame: ${gameId}`);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔍 Game: {gameId}</h1>
        <div className="game-features">
          <div className="feature">
            <h3>Game Status</h3>
            <ul>
              <li>Status: Active</li>
              <li>Players: 8/20</li>
              <li>Time Remaining: 1:45:30</li>
            </ul>
          </div>
          <div className="feature">
            <h3>Your Progress</h3>
            <ul>
              <li>Role: Fugitive</li>
              <li>Tasks Completed: 2/6</li>
              <li>Current Location: Task 3</li>
            </ul>
          </div>
          <div className="feature">
            <h3>Actions</h3>
            <ul>
              <li>Scan QR Code</li>
              <li>View Map</li>
              <li>Check Status</li>
            </ul>
          </div>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={handleScanQR}>Scan QR Code</button>
          <button className="btn btn-secondary" onClick={handleBack}>
            Leave Game
          </button>
        </div>
      </header>
    </div>
  );
};

export default GamePage;
