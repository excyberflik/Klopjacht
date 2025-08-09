import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MapSelector from '../components/MapSelector';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [selectedView, setSelectedView] = useState('overview');
  const [gameForm, setGameForm] = useState({
    name: '',
    duration: 120,
    maxPlayers: 20,
    extractionPoint: { lat: 0, lng: 0, address: '' },
    tasks: Array(6).fill(null).map((_, i) => ({
      id: i + 1,
      question: '',
      answer: '',
      location: { lat: 0, lng: 0, address: '' }
    }))
  });
  const [currentStep, setCurrentStep] = useState(1); // 1: Basic Info, 2: Extraction Point, 3: Tasks
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [mapSelectorType, setMapSelectorType] = useState<'extraction' | 'task'>('extraction');
  const [mapSelectorTaskIndex, setMapSelectorTaskIndex] = useState<number>(0);

  // Mock data for demonstration
  const mockGames = [
    {
      id: 'GAME01',
      code: 'ABC123',
      name: 'Downtown Chase',
      status: 'active',
      players: 8,
      maxPlayers: 20,
      timeRemaining: '1:45:30',
      createdBy: 'Admin User',
      startTime: '2024-01-08 17:30:00'
    },
    {
      id: 'GAME02',
      code: 'XYZ789',
      name: 'Park Hunt',
      status: 'active',
      players: 12,
      maxPlayers: 15,
      timeRemaining: '0:32:15',
      createdBy: 'Game Master',
      startTime: '2024-01-08 18:15:00'
    },
    {
      id: 'GAME03',
      code: 'DEF456',
      name: 'City Escape',
      status: 'completed',
      players: 6,
      maxPlayers: 10,
      timeRemaining: 'Finished',
      createdBy: 'Admin User',
      startTime: '2024-01-08 15:00:00'
    }
  ];

  const mockPlayers = [
    {
      id: 'P001',
      name: 'Alex Hunter',
      gameCode: 'ABC123',
      role: 'fugitive',
      status: 'active',
      location: { lat: 52.3676, lng: 4.9041, address: 'Dam Square, Amsterdam' },
      tasksCompleted: 3,
      lastUpdate: '2 min ago'
    },
    {
      id: 'P002',
      name: 'Sarah Chase',
      gameCode: 'ABC123',
      role: 'hunter',
      status: 'active',
      location: { lat: 52.3702, lng: 4.8952, address: 'Vondelpark, Amsterdam' },
      tasksCompleted: 0,
      lastUpdate: '1 min ago'
    },
    {
      id: 'P003',
      name: 'Mike Runner',
      gameCode: 'XYZ789',
      role: 'fugitive',
      status: 'caught',
      location: { lat: 52.3738, lng: 4.8910, address: 'Museumplein, Amsterdam' },
      tasksCompleted: 2,
      lastUpdate: '5 min ago'
    },
    {
      id: 'P004',
      name: 'Emma Swift',
      gameCode: 'XYZ789',
      role: 'fugitive',
      status: 'active',
      location: { lat: 52.3676, lng: 4.9041, address: 'Central Station, Amsterdam' },
      tasksCompleted: 4,
      lastUpdate: '30 sec ago'
    }
  ];

  const handleBack = () => {
    navigate('/');
  };

  const handleCreateGame = () => {
    setSelectedView('create-game');
  };

  const handleViewGame = (gameCode: string) => {
    setSelectedView(`game-${gameCode}`);
  };

  const handleViewLocation = (player: any) => {
    alert(`Player Location:\n\nName: ${player.name}\nRole: ${player.role}\nStatus: ${player.status}\nLocation: ${player.location.address}\nCoordinates: ${player.location.lat}, ${player.location.lng}\nLast Update: ${player.lastUpdate}`);
  };

  const handleSetLocation = (type: string, index?: number) => {
    if (type === 'extraction') {
      setMapSelectorType('extraction');
    } else if (type === 'task' && index !== undefined) {
      setMapSelectorType('task');
      setMapSelectorTaskIndex(index);
    }
    setShowMapSelector(true);
  };

  const handleLocationSelect = (location: { lat: number; lng: number; address: string }) => {
    if (mapSelectorType === 'extraction') {
      setGameForm(prev => ({
        ...prev,
        extractionPoint: location
      }));
    } else if (mapSelectorType === 'task') {
      setGameForm(prev => ({
        ...prev,
        tasks: prev.tasks.map((task, i) => 
          i === mapSelectorTaskIndex ? { ...task, location } : task
        )
      }));
    }
    setShowMapSelector(false);
  };

  const handleMapClose = () => {
    setShowMapSelector(false);
  };

  const renderOverview = () => (
    <div className="admin-content">
      <div className="game-features">
        <div className="feature">
          <h3>System Overview</h3>
          <ul>
            <li>Total Games: {mockGames.length}</li>
            <li>Active Games: {mockGames.filter(g => g.status === 'active').length}</li>
            <li>Total Players: {mockPlayers.length}</li>
            <li>Active Players: {mockPlayers.filter(p => p.status === 'active').length}</li>
          </ul>
        </div>
        
        <div className="feature">
          <h3>Active Games</h3>
          <div className="games-list">
            {mockGames.filter(game => game.status === 'active').map(game => (
              <div key={game.id} className="game-item">
                <strong>{game.code}</strong> - {game.name}
                <br />
                <small>Players: {game.players}/{game.maxPlayers} | Time: {game.timeRemaining}</small>
                <br />
                <button 
                  className="btn-small btn-primary" 
                  onClick={() => handleViewGame(game.code)}
                  style={{ marginTop: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="feature">
          <h3>Live Player Status</h3>
          <div className="players-list">
            {mockPlayers.filter(p => p.status === 'active').map(player => (
              <div key={player.id} className="player-item">
                <strong>{player.name}</strong> ({player.role})
                <br />
                <small>Game: {player.gameCode} | Tasks: {player.tasksCompleted}/6</small>
                <br />
                <button 
                  className="btn-small btn-secondary" 
                  onClick={() => handleViewLocation(player)}
                  style={{ marginTop: '0.25rem', padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                >
                  View Location
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderGameDetails = (gameCode: string) => {
    const game = mockGames.find(g => g.code === gameCode);
    const gamePlayers = mockPlayers.filter(p => p.gameCode === gameCode);
    
    if (!game) {
      return <div>Game not found</div>;
    }
    
    return (
      <div className="admin-content">
        <div className="game-header">
          <h2>Game: {game.name} ({game.code})</h2>
          <button 
            className="btn btn-secondary" 
            onClick={() => setSelectedView('overview')}
            style={{ marginBottom: '1rem' }}
          >
            ← Back to Overview
          </button>
        </div>
        
        <div className="game-features">
          <div className="feature">
            <h3>Game Status</h3>
            <ul>
              <li>Status: {game.status}</li>
              <li>Players: {game.players}/{game.maxPlayers}</li>
              <li>Time Remaining: {game.timeRemaining}</li>
              <li>Started: {game.startTime}</li>
              <li>Created by: {game.createdBy}</li>
            </ul>
          </div>

          <div className="feature">
            <h3>Players in Game</h3>
            <div className="players-detailed">
              {gamePlayers.map(player => (
                <div key={player.id} className="player-detailed">
                  <div className="player-info">
                    <strong>{player.name}</strong>
                    <span className={`status-badge ${player.status}`}>{player.status}</span>
                  </div>
                  <div className="player-details">
                    <div>Role: {player.role}</div>
                    <div>Tasks: {player.tasksCompleted}/6</div>
                    <div>Location: {player.location.address}</div>
                    <div>Last Update: {player.lastUpdate}</div>
                  </div>
                  <button 
                    className="btn-small btn-primary" 
                    onClick={() => handleViewLocation(player)}
                    style={{ marginTop: '0.5rem' }}
                  >
                    View on Map
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="feature">
            <h3>Game Actions</h3>
            <div className="game-actions">
              <button className="btn btn-warning" style={{ margin: '0.25rem' }}>
                Pause Game
              </button>
              <button className="btn btn-error" style={{ margin: '0.25rem' }}>
                End Game
              </button>
              <button className="btn btn-info" style={{ margin: '0.25rem' }}>
                Send Message
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCreateGame = () => {
    const handleFormSubmit = (e: any) => {
      e.preventDefault();
      // For demo purposes, create a mock game
      const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      alert(`Game Created Successfully!\n\nGame Code: ${gameCode}\nName: ${gameForm.name}\nDuration: ${gameForm.duration} minutes\nMax Players: ${gameForm.maxPlayers}\n\nExtraction Point: ${gameForm.extractionPoint.address || 'Not set'}\nTasks: ${gameForm.tasks.filter(t => t.question && t.answer).length}/6 completed\n\nGame is ready for players to join!`);
      
      // Reset form and go back to overview
      setGameForm({
        name: '',
        duration: 120,
        maxPlayers: 20,
        extractionPoint: { lat: 0, lng: 0, address: '' },
        tasks: Array(6).fill(null).map((_, i) => ({
          id: i + 1,
          question: '',
          answer: '',
          location: { lat: 0, lng: 0, address: '' }
        }))
      });
      setCurrentStep(1);
      setSelectedView('overview');
    };

    return (
      <div className="admin-content">
        <div className="game-header">
          <h2>🎮 Create New Game</h2>
          <button 
            className="btn btn-secondary" 
            onClick={() => setSelectedView('overview')}
            style={{ marginBottom: '1rem' }}
          >
            ← Cancel
          </button>
        </div>

        <div className="create-game-steps">
          <div className="step-indicator">
            <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>1. Basic Info</div>
            <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>2. Extraction Point</div>
            <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>3. Tasks (6)</div>
          </div>

          <form onSubmit={handleFormSubmit}>
            {currentStep === 1 && (
              <div className="form-step">
                <h3>Game Basic Information</h3>
                <div className="form-group">
                  <label>Game Name:</label>
                  <input
                    type="text"
                    value={gameForm.name}
                    onChange={(e) => setGameForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter game name (e.g., Downtown Chase)"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Duration (minutes):</label>
                  <input
                    type="number"
                    value={gameForm.duration}
                    onChange={(e) => setGameForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    min="30"
                    max="300"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Max Players:</label>
                  <input
                    type="number"
                    value={gameForm.maxPlayers}
                    onChange={(e) => setGameForm(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) }))}
                    min="4"
                    max="50"
                    required
                  />
                </div>
                <button type="button" className="btn btn-primary" onClick={() => setCurrentStep(2)}>
                  Next: Set Extraction Point →
                </button>
              </div>
            )}

            {currentStep === 2 && (
              <div className="form-step">
                <h3>Extraction Point</h3>
                <p>Set the final escape location where fugitives must reach to win.</p>
                <div className="location-setting">
                  {gameForm.extractionPoint.address ? (
                    <div className="location-display">
                      <strong>📍 {gameForm.extractionPoint.address}</strong>
                      <br />
                      <small>Coordinates: {gameForm.extractionPoint.lat}, {gameForm.extractionPoint.lng}</small>
                    </div>
                  ) : (
                    <div className="no-location">No extraction point set</div>
                  )}
                  <button 
                    type="button" 
                    className="btn btn-info" 
                    onClick={() => handleSetLocation('extraction')}
                  >
                    {gameForm.extractionPoint.address ? 'Change Location' : 'Set Location on Map'}
                  </button>
                </div>
                <div className="step-navigation">
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentStep(1)}>
                    ← Previous
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={() => setCurrentStep(3)}
                    disabled={!gameForm.extractionPoint.address}
                  >
                    Next: Create Tasks →
                  </button>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="form-step">
                <h3>Create 6 Tasks</h3>
                <p>Fugitives must complete these tasks to get the extraction point coordinates.</p>
                <div className="tasks-list">
                  {gameForm.tasks.map((task, index) => (
                    <div key={task.id} className="task-form">
                      <h4>Task {task.id}</h4>
                      <div className="form-group">
                        <label>Question:</label>
                        <input
                          type="text"
                          value={task.question}
                          onChange={(e) => setGameForm(prev => ({
                            ...prev,
                            tasks: prev.tasks.map((t, i) => 
                              i === index ? { ...t, question: e.target.value } : t
                            )
                          }))}
                          placeholder="Enter the task question"
                        />
                      </div>
                      <div className="form-group">
                        <label>Answer:</label>
                        <input
                          type="text"
                          value={task.answer}
                          onChange={(e) => setGameForm(prev => ({
                            ...prev,
                            tasks: prev.tasks.map((t, i) => 
                              i === index ? { ...t, answer: e.target.value } : t
                            )
                          }))}
                          placeholder="Enter the correct answer"
                        />
                      </div>
                      <div className="form-group">
                        <label>Task Location:</label>
                        {task.location.address ? (
                          <div className="location-display">
                            <strong>📍 {task.location.address}</strong>
                            <br />
                            <small>Coordinates: {task.location.lat}, {task.location.lng}</small>
                          </div>
                        ) : (
                          <div className="no-location">No location set</div>
                        )}
                        <button 
                          type="button" 
                          className="btn-small btn-info" 
                          onClick={() => handleSetLocation('task', index)}
                        >
                          {task.location.address ? 'Change Location' : 'Set Location'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="step-navigation">
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentStep(2)}>
                    ← Previous
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-success"
                    disabled={gameForm.tasks.filter(t => t.question && t.answer && t.location.address).length < 6}
                  >
                    Create Game 🎮
                  </button>
                </div>
                <div className="task-progress">
                  Completed Tasks: {gameForm.tasks.filter(t => t.question && t.answer && t.location.address).length}/6
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔍 Super Admin Dashboard</h1>
        
        <div className="admin-nav">
          <button 
            className={`nav-btn ${selectedView === 'overview' ? 'active' : ''}`}
            onClick={() => setSelectedView('overview')}
          >
            Overview
          </button>
          <button 
            className={`nav-btn ${selectedView === 'games' ? 'active' : ''}`}
            onClick={() => setSelectedView('games')}
          >
            All Games
          </button>
          <button 
            className={`nav-btn ${selectedView === 'players' ? 'active' : ''}`}
            onClick={() => setSelectedView('players')}
          >
            Live Tracking
          </button>
        </div>

        {selectedView === 'overview' && renderOverview()}
        {selectedView === 'create-game' && renderCreateGame()}
        {selectedView.startsWith('game-') && renderGameDetails(selectedView.split('-')[1])}

        <div className="actions">
          <button className="btn btn-primary" onClick={handleCreateGame}>
            Create New Game
          </button>
          <button className="btn btn-secondary" onClick={handleBack}>
            Back to Home
          </button>
        </div>
      </header>

      {showMapSelector && (
        <MapSelector
          onLocationSelect={handleLocationSelect}
          onClose={handleMapClose}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
