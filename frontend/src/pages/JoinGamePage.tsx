import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const JoinGamePage = () => {
  const navigate = useNavigate();
  const [gameCode, setGameCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [role, setRole] = useState('fugitive');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gameCode && playerName) {
      // For now, just navigate to a mock game page
      navigate(`/game/${gameCode}`);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔍 Join Game</h1>
        <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Game Code:
            </label>
            <input
              type="text"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-character code"
              maxLength={6}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #333',
                backgroundColor: '#1A1A1A',
                color: '#FFFFFF'
              }}
            />
          </div>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Your Name:
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #333',
                backgroundColor: '#1A1A1A',
                color: '#FFFFFF'
              }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Role:
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #333',
                backgroundColor: '#1A1A1A',
                color: '#FFFFFF'
              }}
            >
              <option value="fugitive">Fugitive</option>
              <option value="hunter">Hunter</option>
              <option value="spectator">Spectator</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={handleBack}>
              Back
            </button>
            <button type="submit" className="btn btn-primary">
              Join Game
            </button>
          </div>
        </form>
      </header>
    </div>
  );
};

export default JoinGamePage;
