import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MapSelector from '../components/MapSelector';
import { API_ENDPOINTS } from '../config/api';

interface PredefinedPlayer {
  _id: string;
  name: string;
  role: string;
  team?: string;
  password: string;
  isJoined: boolean;
  playerId?: string;
  createdAt: string;
}

// QR Codes Display Component
const QRCodesDisplay: React.FC<{ gameId: string }> = ({ gameId }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.GAME_TASKS(gameId), {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          }
        });

        if (response.ok) {
          const data = await response.json();
          setTasks(data.tasks || []);
        } else {
          setError('Failed to load QR codes');
        }
      } catch (err) {
        setError('Error loading QR codes');
      } finally {
        setLoading(false);
      }
    };

    if (gameId) {
      fetchTasks();
    }
  }, [gameId]);

  const downloadQRCode = (qrCode: string, taskNumber: number) => {
    const link = document.createElement('a');
    link.href = qrCode;
    link.download = `Mission_${taskNumber}_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div>Loading QR codes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#ff6b6b' }}>
        <div>{error}</div>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="no-games-enhanced" style={{ padding: '2rem 1rem' }}>
        <div className="no-games-icon">📱</div>
        <div className="no-games-title">NO QR CODES GENERATED</div>
        <div className="no-games-subtitle">Create tasks first to generate QR codes</div>
      </div>
    );
  }

  return (
    <div className="qr-codes-grid">
      {tasks.map((task) => (
        <div key={task.taskNumber} className="qr-code-item">
          <div className="qr-code-header">
            <h5>MISSION {task.taskNumber}</h5>
            <div className="qr-code-location">📍 {task.location?.address || 'No location'}</div>
          </div>
          
          <div className="qr-code-display">
            {task.qrCode ? (
              <img 
                src={task.qrCode} 
                alt={`Mission ${task.taskNumber} QR Code`}
                style={{ width: '150px', height: '150px', border: '2px solid #ddd' }}
              />
            ) : (
              <div style={{ 
                width: '150px', 
                height: '150px', 
                border: '2px solid #ddd', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: '#f5f5f5',
                color: '#888'
              }}>
                No QR Code
              </div>
            )}
          </div>
          
          <div className="qr-code-question">
            <strong>Question:</strong> {task.question || 'No question'}
          </div>
          
          <div className="qr-code-actions">
            {task.qrCode && (
              <button 
                className="btn-enhanced btn-primary-enhanced"
                onClick={() => downloadQRCode(task.qrCode, task.taskNumber)}
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
              >
                📥 DOWNLOAD
              </button>
            )}
          </div>
        </div>
      ))}
      
      <div className="qr-codes-actions" style={{ marginTop: '1rem', textAlign: 'center' }}>
        <button 
          className="btn-enhanced btn-info-enhanced"
          onClick={() => {
            tasks.forEach((task) => {
              if (task.qrCode) {
                setTimeout(() => downloadQRCode(task.qrCode, task.taskNumber), task.taskNumber * 100);
              }
            });
          }}
        >
          📥 DOWNLOAD ALL QR CODES
        </button>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [selectedView, setSelectedView] = useState(() => {
    // Check URL parameters for initial view
    const urlParams = new URLSearchParams(window.location.search);
    const urlView = urlParams.get('view');
    
    // If there's a URL parameter, use that
    if (urlView) {
      return urlView;
    }
    
    // For game leads, default to the KLOPJACHT DATABASE view
    const userRole = localStorage.getItem('userRole');
    if (userRole === 'game_lead') {
      return 'games';
    }
    
    // For super admins and others, default to overview
    return 'overview';
  });
  const [gameForm, setGameForm] = useState({
    name: '',
    duration: 30, // Changed from 120 to 30 (minimum required by backend)
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

  // Real data state
  const [games, setGames] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [gameTimeRemaining, setGameTimeRemaining] = useState<{[key: string]: string}>({});

  // Fetch games and players data
  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const userRole = localStorage.getItem('userRole');
      console.log('Fetching data from API...');
      console.log('Using token:', token ? token.substring(0, 20) + '...' : 'No token');
      console.log('User role:', userRole);
      
      // Fetch games
      console.log('Fetching games...');
      const gamesResponse = await fetch(API_ENDPOINTS.GAMES, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      if (gamesResponse.ok) {
        const gamesData = await gamesResponse.json();
        const gamesList = gamesData.games || gamesData || [];
        setGames(gamesList);
        console.log('Games loaded:', gamesList.length);
      } else if (gamesResponse.status === 401) {
        console.log('Unauthorized - redirecting to login');
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      // Only fetch all players if user is admin or super_admin
      if (userRole === 'admin' || userRole === 'super_admin') {
        console.log('Fetching players (admin/super_admin access)...');
        const playersResponse = await fetch(API_ENDPOINTS.PLAYERS, {
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        });
        
        if (playersResponse.ok) {
          const playersData = await playersResponse.json();
          console.log('Raw players API response:', playersData);
          
          const playersList = playersData.players || playersData || [];
          setPlayers(playersList);
          console.log('Players loaded:', playersList.length);
          console.log('Players data:', playersList.slice(0, 3)); // Log first 3 players for debugging
        } else if (playersResponse.status === 401) {
          console.log('Unauthorized for players - redirecting to login');
          localStorage.removeItem('token');
          navigate('/login');
          return;
        } else {
          console.error('Players API Error:', playersResponse.status);
        }
      } else {
        console.log('Game Lead access - skipping global players fetch');
        // For game leads, we'll fetch players per game when needed
        setPlayers([]);
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  // Fetch data on component mount and set up refresh interval
  useEffect(() => {
    fetchData();
    
    // Set up auto-refresh every 60 seconds to show real-time updates
    const interval = setInterval(fetchData, 60000);
    
    return () => clearInterval(interval);
  }, [navigate]);

  // Update game timers every second
  useEffect(() => {
    const updateTimers = () => {
      const newTimers: {[key: string]: string} = {};
      games.forEach(game => {
        if (game.gameCode) {
          newTimers[game.gameCode] = calculateGameTimeRemaining(game);
        }
      });
      setGameTimeRemaining(newTimers);
    };

    updateTimers();
    const timerInterval = setInterval(updateTimers, 1000);
    
    return () => clearInterval(timerInterval);
  }, [games]);

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
    const location = player.currentLocation || player.location || {};
    const address = location.address || 'No address available';
    const lat = location.latitude || location.lat || 'N/A';
    const lng = location.longitude || location.lng || 'N/A';
    const lastUpdate = player.lastSeen || player.lastUpdate || player.updatedAt || 'Never';
    
    alert(`Player Location:\n\nName: ${player.name}\nRole: ${player.role}\nStatus: ${player.status}\nLocation: ${address}\nCoordinates: ${lat}, ${lng}\nLast Update: ${lastUpdate}`);
  };

  const handleDeleteGame = async (gameId: string, gameName: string) => {
    console.log('Attempting to delete game:', { gameId, gameName });
    
    if (!gameId || gameId === 'undefined') {
      console.error('Invalid game ID:', gameId);
      alert('Cannot delete game: Invalid game ID');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete the game "${gameName}"?\n\nThis action cannot be undone and will remove all associated data.`)) {
      try {
        const response = await fetch(API_ENDPOINTS.GAME_BY_ID(gameId), {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          }
        });

        if (response.ok) {
          // Remove the game from the local state - check both id and _id
          setGames(prev => prev.filter(game => (game.id !== gameId && game._id !== gameId)));
          alert(`Game "${gameName}" has been successfully deleted from the database.`);
        } else {
          const errorData = await response.json();
          alert(`Failed to delete game: ${errorData.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting game:', error);
        alert('Failed to delete game. Please try again.');
      }
    }
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
      setGameForm(prev => {
        const updatedForm = {
          ...prev,
          extractionPoint: location
        };
        
        // Automatically set Task 6 location to match extraction point
        updatedForm.tasks = prev.tasks.map((task, i) => 
          i === 5 ? { ...task, location } : task // Task 6 is index 5
        );
        
        return updatedForm;
      });
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

  // Game control handlers
  const handleStartGame = async (gameId: string, gameName: string) => {
    if (window.confirm(`Start the game "${gameName}"?\n\nThis will begin the countdown timer and notify all players.`)) {
      try {
        const response = await fetch(API_ENDPOINTS.GAME_START(gameId), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          }
        });

        if (response.ok) {
          alert(`Game "${gameName}" has been started successfully!`);
          fetchData(); // Refresh data to show updated status
        } else {
          const errorData = await response.json();
          alert(`Failed to start game: ${errorData.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error starting game:', error);
        alert('Failed to start game. Please try again.');
      }
    }
  };

  const handlePauseGame = async (gameId: string, gameName: string) => {
    if (window.confirm(`Pause the game "${gameName}"?\n\nThis will stop the timer and notify all players.`)) {
      try {
        console.log('Attempting to pause game:', { gameId, gameName });
        console.log('Token:', localStorage.getItem('token') ? 'Present' : 'Missing');
        
        const response = await fetch(API_ENDPOINTS.GAME_PAUSE(gameId), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          }
        });

        console.log('Pause response status:', response.status);
        console.log('Pause response ok:', response.ok);

        if (response.ok) {
          alert(`Game "${gameName}" has been paused successfully!`);
          fetchData(); // Refresh data to show updated status
        } else {
          const errorData = await response.json();
          console.error('Pause error data:', errorData);
          alert(`Failed to pause game: ${errorData.error || errorData.message || 'Unknown error'}\n\nDetails: ${JSON.stringify(errorData, null, 2)}`);
        }
      } catch (error) {
        console.error('Error pausing game:', error);
        alert('Failed to pause game. Please try again.');
      }
    }
  };

  const handleResumeGame = async (gameId: string, gameName: string) => {
    if (window.confirm(`Resume the game "${gameName}"?\n\nThis will restart the timer and notify all players.`)) {
      try {
        console.log('Attempting to resume game:', { gameId, gameName });
        console.log('Token:', localStorage.getItem('token') ? 'Present' : 'Missing');
        
        const response = await fetch(API_ENDPOINTS.GAME_RESUME(gameId), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          }
        });

        console.log('Resume response status:', response.status);
        console.log('Resume response ok:', response.ok);

        if (response.ok) {
          alert(`Game "${gameName}" has been resumed successfully!`);
          fetchData(); // Refresh data to show updated status
        } else {
          const errorData = await response.json();
          console.error('Resume error data:', errorData);
          alert(`Failed to resume game: ${errorData.error || errorData.message || 'Unknown error'}\n\nDetails: ${JSON.stringify(errorData, null, 2)}`);
        }
      } catch (error) {
        console.error('Error resuming game:', error);
        alert('Failed to resume game. Please try again.');
      }
    }
  };

  const handleEndGame = async (gameId: string, gameName: string) => {
    // Find the game to get its current status
    const currentGame = games.find(g => (g._id === gameId || g.id === gameId));
    console.log('DEBUG: Attempting to end game:', {
      gameId,
      gameName,
      currentGame,
      gameStatus: currentGame?.status,
      gameObject: currentGame
    });
    
    if (window.confirm(`End the game "${gameName}"?\n\nCurrent Status: ${currentGame?.status || 'Unknown'}\n\nThis action cannot be undone and will complete the game for all players.`)) {
      try {
        const response = await fetch(API_ENDPOINTS.GAME_END(gameId), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          }
        });

        console.log('DEBUG: End game response:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });

        if (response.ok) {
          alert(`Game "${gameName}" has been ended successfully!`);
          fetchData(); // Refresh data to show updated status
        } else {
          const errorData = await response.json();
          console.log('DEBUG: End game error data:', errorData);
          
          let errorMessage = 'Unknown error';
          
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          } else if (response.status === 400) {
            errorMessage = 'Game cannot be ended in its current state. Only active or paused games can be ended.';
          }
          
          const gameStatus = currentGame?.status || 'Unknown';
          
          alert(`Failed to end game: ${errorMessage}\n\nCurrent Game Status: "${gameStatus}"\n\nGame Object Debug Info:\n- ID: ${currentGame?._id || currentGame?.id}\n- Status: ${gameStatus}\n- All properties: ${Object.keys(currentGame || {}).join(', ')}\n\nValid states for ending: "active" or "paused"\nCurrent state "${gameStatus}" cannot be ended.\n\nTip: You may need to start the game first before you can end it.`);
        }
      } catch (error) {
        console.error('Error ending game:', error);
        alert('Failed to end game. Please try again.');
      }
    }
  };

  const handleSendMessage = async (gameId: string, gameName: string) => {
    const message = prompt(`Send a message to all players in "${gameName}":\n\nEnter your message:`);
    
    if (message && message.trim()) {
      try {
        const response = await fetch(API_ENDPOINTS.GAME_MESSAGE(gameId), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ message: message.trim() })
        });

        if (response.ok) {
          alert(`Message sent successfully to all players in "${gameName}"!`);
        } else {
          const errorData = await response.json();
          alert(`Failed to send message: ${errorData.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
      }
    }
  };

  const handleEditPredefinedPlayer = async (gameId: string, player: any) => {
    const newName = prompt(`Edit player name:`, player.name);
    if (newName === null) return; // User cancelled
    
    const newRole = prompt(`Edit player role (fugitive/hunter/spectator):`, player.role);
    if (newRole === null) return; // User cancelled
    
    const newTeam = prompt(`Edit player team (optional):`, player.team || '');
    if (newTeam === null) return; // User cancelled
    
    const newPassword = prompt(`Edit player password:`, player.password);
    if (newPassword === null) return; // User cancelled
    
    if (!newName.trim() || !newRole.trim() || !newPassword.trim()) {
      alert('Name, role, and password are required');
      return;
    }
    
    if (!['fugitive', 'hunter', 'spectator'].includes(newRole.toLowerCase())) {
      alert('Role must be fugitive, hunter, or spectator');
      return;
    }
    
    try {
        const response = await fetch(API_ENDPOINTS.GAME_DELETE_PREDEFINED_PLAYER(gameId, player._id), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            name: newName.trim(),
            role: newRole.toLowerCase(),
            team: newTeam.trim() || undefined,
            password: newPassword.trim()
          })
        });

      if (response.ok) {
        alert('Player updated successfully!');
        fetchData(); // Refresh data to show updated player
      } else {
        const errorData = await response.json();
        alert(`Failed to update player: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating player:', error);
      alert('Failed to update player. Please try again.');
    }
  };

  const handleDeletePredefinedPlayer = async (gameId: string, playerId: string, playerName: string) => {
    if (window.confirm(`Are you sure you want to delete player "${playerName}"?\n\nThis action cannot be undone.`)) {
      try {
        const response = await fetch(API_ENDPOINTS.GAME_DELETE_PREDEFINED_PLAYER(gameId, playerId), {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          }
        });

        if (response.ok) {
          alert(`Player "${playerName}" has been deleted successfully!`);
          fetchData(); // Refresh data to show updated list
        } else {
          const errorData = await response.json();
          alert(`Failed to delete player: ${errorData.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting player:', error);
        alert('Failed to delete player. Please try again.');
      }
    }
  };

  const handleEditGame = async (gameId: string, gameName: string) => {
    if (window.confirm(`Edit the game "${gameName}"?\n\nThis will allow you to modify game details, tasks, and locations before starting the game.`)) {
      try {
        // First, fetch the current game data
        const response = await fetch(API_ENDPOINTS.GAME_BY_ID(gameId), {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          }
        });

        if (response.ok) {
          const gameData = await response.json();
          const game = gameData.game || gameData;
          
          // Populate the form with existing game data
          setGameForm({
            name: game.name || '',
            duration: game.duration || 120,
            maxPlayers: game.maxPlayers || game.settings?.maxPlayers || 20,
            extractionPoint: {
              lat: game.extractionPoint?.latitude || game.extractionPoint?.lat || 0,
              lng: game.extractionPoint?.longitude || game.extractionPoint?.lng || 0,
              address: game.extractionPoint?.address || ''
            },
            tasks: game.tasks && game.tasks.length === 6 ? game.tasks.map((task: any, index: number) => ({
              id: index + 1,
              question: task.question || '',
              answer: task.answer || '',
              location: {
                lat: task.location?.latitude || task.location?.lat || 0,
                lng: task.location?.longitude || task.location?.lng || 0,
                address: task.location?.address || ''
              }
            })) : Array(6).fill(null).map((_, i) => ({
              id: i + 1,
              question: '',
              answer: '',
              location: { lat: 0, lng: 0, address: '' }
            }))
          });
          
          // Set the view to edit mode (reuse create-game view)
          setCurrentStep(1);
          setSelectedView('edit-game');
          
          // Store the game ID for updating
          localStorage.setItem('editingGameId', gameId);
          
        } else {
          const errorData = await response.json();
          alert(`Failed to load game data: ${errorData.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error loading game for editing:', error);
        alert('Failed to load game data. Please try again.');
      }
    }
  };

  const renderOverview = () => (
    <div className="admin-content">
      <div className="klopjacht-header">
        <div className="header-title">
          <h2>KLOPJACHT: SYSTEM OVERVIEW</h2>
          <div className="header-subtitle">COMPLETE SYSTEM MONITORING & CONTROL</div>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-primary btn-large"
            onClick={handleCreateGame}
          >
            🎮 CREATE NEW GAME
          </button>
        </div>
      </div>
      
      <div className="klopjacht-stats">
        <div 
          className="stat-card-enhanced stat-card-clickable" 
          onClick={() => setSelectedView('games')}
          style={{ cursor: 'pointer' }}
          title="Click to view all games"
        >
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className="stat-number">{Array.isArray(games) ? games.length : 0}</div>
            <div className="stat-label">TOTAL GAMES</div>
          </div>
        </div>
        <div className="stat-card-enhanced">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <div className="stat-number">{Array.isArray(games) ? games.filter(g => g.status === 'active').length : 0}</div>
            <div className="stat-label">ACTIVE GAMES</div>
          </div>
        </div>
        <div className="stat-card-enhanced">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-number">{Array.isArray(players) ? players.length : 0}</div>
            <div className="stat-label">TOTAL PLAYERS</div>
          </div>
        </div>
        <div className="stat-card-enhanced">
          <div className="stat-icon">🎮</div>
          <div className="stat-content">
            <div className="stat-number">{Array.isArray(players) ? players.filter(p => p.status === 'active').length : 0}</div>
            <div className="stat-label">ACTIVE PLAYERS</div>
          </div>
        </div>
      </div>

      <div className="klopjacht-games-section">
        <div className="klopjacht-games-grid">
          {/* Active Games Card */}
          <div className="klopjacht-game-card">
            <div className="game-card-header-enhanced">
              <div className="game-title">
                <h4>ACTIVE GAMES</h4>
                <div className="game-code">LIVE MONITORING</div>
              </div>
              <div className="status-badge-enhanced active">
                {Array.isArray(games) ? games.filter(g => g.status === 'active').length : 0} LIVE
              </div>
            </div>
            
            <div className="game-card-body-enhanced">
              {Array.isArray(games) && games.filter(game => game.status === 'active').length > 0 ? (
                <div className="overview-games-list">
                  {games.filter(game => game.status === 'active').map(game => (
                    <div key={game._id || game.id} className="overview-game-item">
                      <div className="overview-game-header">
                        <strong>#{game.gameCode}</strong>
                        <span className="overview-game-name">{game.name}</span>
                      </div>
                      <div className="overview-game-details">
                        <div><strong>PLAYERS:</strong> {game.players || 0}/{game.maxPlayers || 20}</div>
                        <div><strong>TIME:</strong> {gameTimeRemaining[game.gameCode] || calculateGameTimeRemaining(game)}</div>
                      </div>
                      <div className="overview-game-actions">
                        <button 
                          className="btn-enhanced btn-primary-enhanced" 
                          onClick={() => handleViewGame(game.gameCode)}
                        >
                          📊 VIEW DETAILS
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-games-enhanced" style={{ padding: '2rem 1rem' }}>
                  <div className="no-games-icon">⚡</div>
                  <div className="no-games-title">NO ACTIVE GAMES</div>
                  <div className="no-games-subtitle">No games are currently running</div>
                </div>
              )}
            </div>
          </div>

          {/* Live Player Status Card */}
          <div className="klopjacht-game-card">
            <div className="game-card-header-enhanced">
              <div className="game-title">
                <h4>LIVE PLAYER STATUS</h4>
                <div className="game-code">REAL-TIME MONITORING</div>
              </div>
              <div className="status-badge-enhanced active">
                {Array.isArray(players) ? players.filter(p => p.status === 'active').length : 0} ACTIVE
              </div>
            </div>
            
            <div className="game-card-body-enhanced">
              {Array.isArray(players) && players.filter(p => p.status === 'active').length > 0 ? (
                <div className="overview-players-list">
                  {players.filter(p => p.status === 'active').map(player => (
                    <div key={player._id || player.id} className="overview-player-item">
                      <div className="overview-player-header">
                        <strong>{player.name.toUpperCase()}</strong>
                        <span className={`status-badge-enhanced ${player.status}`}>
                          {player.role?.toUpperCase() || 'UNKNOWN'}
                        </span>
                      </div>
                      <div className="overview-player-details">
                        <div><strong>GAME:</strong> #{player.gameCode || 'N/A'}</div>
                        <div><strong>TASKS:</strong> {player.tasksCompleted || 0}/6</div>
                      </div>
                      <div className="overview-player-actions">
                        <button 
                          className="btn-enhanced btn-info-enhanced" 
                          onClick={() => handleViewLocation(player)}
                        >
                          📍 LOCATION
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-games-enhanced" style={{ padding: '2rem 1rem' }}>
                  <div className="no-games-icon">👥</div>
                  <div className="no-games-title">NO ACTIVE PLAYERS</div>
                  <div className="no-games-subtitle">No players are currently in games</div>
                </div>
              )}
            </div>
          </div>

          {/* System Status Card */}
          <div className="klopjacht-game-card">
            <div className="game-card-header-enhanced">
              <div className="game-title">
                <h4>SYSTEM STATUS</h4>
                <div className="game-code">HEALTH MONITORING</div>
              </div>
              <div className="status-badge-enhanced active">
                OPERATIONAL
              </div>
            </div>
            
            <div className="game-card-body-enhanced">
              <div className="system-status-grid">
                <div className="status-item">
                  <div className="status-label">DATABASE</div>
                  <div className="status-value">✅ CONNECTED</div>
                </div>
                <div className="status-item">
                  <div className="status-label">BACKEND</div>
                  <div className="status-value">✅ RUNNING</div>
                </div>
                <div className="status-item">
                  <div className="status-label">FRONTEND</div>
                  <div className="status-value">✅ ACTIVE</div>
                </div>
                <div className="status-item">
                  <div className="status-label">LAST REFRESH</div>
                  <div className="status-value">{new Date().toLocaleTimeString()}</div>
                </div>
              </div>
              
              <div className="system-actions">
                <button 
                  className="btn-enhanced btn-primary-enhanced"
                  onClick={() => {
                    console.log('Manual refresh triggered from overview');
                    fetchData();
                  }}
                >
                  🔄 REFRESH DATA
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Calculate time remaining for a specific game
  const calculateGameTimeRemaining = (game: any) => {
    if (!game) return 'No game';
    
    if (game.status === 'waiting' || game.status === 'setup') {
      return '⏳ Waiting to start';
    }
    
    if (game.status === 'completed') {
      return '🏁 Game completed';
    }
    
    if (game.status === 'cancelled') {
      return '❌ Game cancelled';
    }
    
    if (game.status === 'paused') {
      // When paused, show the time remaining at the moment of pause
      if (!game.startTime) {
        return '⏸️ Paused - Not started';
      }
      
      const startTime = new Date(game.startTime);
      const pausedAt = game.pausedAt ? new Date(game.pausedAt) : new Date();
      const gameDuration = (game.duration || 120) * 60 * 1000; // Convert to milliseconds
      const timeElapsedBeforePause = pausedAt.getTime() - startTime.getTime();
      const remaining = gameDuration - timeElapsedBeforePause;
      
      if (remaining <= 0) {
        return '⏸️ Paused - Time expired';
      }
      
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      return `⏸️ Paused - ${timeString} remaining`;
    }
    
    if (!game.startTime) {
      return '⏸️ Not started';
    }

    const startTime = new Date(game.startTime);
    const gameDuration = (game.duration || 120) * 60 * 1000; // Convert to milliseconds
    const now = new Date();
    
    // Calculate total elapsed time, accounting for any paused periods
    let totalElapsed = now.getTime() - startTime.getTime();
    
    // If the game was paused and resumed, we need to subtract the paused time
    // For now, we'll use a simple approach - in a full implementation, you'd track all pause/resume periods
    
    const remaining = gameDuration - totalElapsed;
    
    if (remaining <= 0) {
      return '⏰ Time expired';
    }
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (remaining < 5 * 60 * 1000) {
      return `🚨 ${timeString} - CRITICAL!`;
    } else if (remaining < 15 * 60 * 1000) {
      return `⚠️ ${timeString} - Low time`;
    } else {
      return `⏱️ ${timeString}`;
    }
  };

  const renderGameDetails = (gameCode: string) => {
    const game = games.find(g => g.gameCode === gameCode || g.code === gameCode);
    const gamePlayers = players.filter(p => {
      // Match by game code or game ID
      return p.game?.gameCode === gameCode || 
             p.gameCode === gameCode ||
             (p.game && p.game._id === game?._id) ||
             (p.game && p.game.id === game?.id);
    });
    
    const gameTimeRemaining = calculateGameTimeRemaining(game);
    
    console.log('Looking for game with code:', gameCode);
    console.log('Available games:', games.map(g => ({ id: g.id, code: g.code, gameCode: g.gameCode, name: g.name })));
    console.log('Found game:', game);
    
    if (!game) {
      return (
        <div className="admin-content">
          <div className="klopjacht-header">
            <div className="header-title">
              <h2>GAME NOT FOUND</h2>
              <div className="header-subtitle">UNABLE TO LOCATE REQUESTED GAME</div>
            </div>
            <div className="header-actions">
              <button 
                className="btn btn-secondary btn-large" 
                onClick={() => setSelectedView('games')}
              >
                ← BACK TO GAMES
              </button>
            </div>
          </div>
          <div className="no-games-enhanced">
            <div className="no-games-icon">❌</div>
            <div className="no-games-title">GAME NOT FOUND</div>
            <div className="no-games-subtitle">Could not find game with code: {gameCode}</div>
            <div style={{ marginTop: '1rem', color: '#888' }}>Available games: {games.length}</div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="admin-content">
        <div className="klopjacht-header">
          <div className="header-title">
            <h2>KLOPJACHT: {game.name.toUpperCase()}</h2>
            <div className="header-subtitle">GAME CODE: #{game.gameCode} | COMPLETE GAME MANAGEMENT</div>
          </div>
          <div className="header-actions">
            <button 
              className="btn btn-secondary btn-large" 
              onClick={() => setSelectedView('games')}
            >
              ← BACK TO GAMES
            </button>
          </div>
        </div>
        
        <div className="klopjacht-games-section">
          <div className="klopjacht-games-grid">
            {/* Game Status & Actions Card */}
            <div className="klopjacht-game-card">
              <div className="game-card-header-enhanced">
                <div className="game-title">
                  <h4>GAME STATUS & ACTIONS</h4>
                  <div className="game-code">CONTROL CENTER</div>
                </div>
                <div className={`status-badge-enhanced ${game.status}`}>
                  {game.status?.toUpperCase() || 'UNKNOWN'}
                </div>
              </div>
              
              <div className="game-card-body-enhanced">
                <div className="game-info-grid">
                  <div className="info-item">
                    <div className="info-label">STATUS</div>
                    <div className="info-value">{game.status?.toUpperCase() || 'UNKNOWN'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">PLAYERS</div>
                    <div className="info-value">{game.players || 0}/{game.maxPlayers || 20}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">STARTED</div>
                    <div className="info-value">{game.startTime ? new Date(game.startTime).toLocaleString() : 'Not started'}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">CREATOR</div>
                    <div className="info-value">{typeof game.createdBy === 'object' ? game.createdBy?.name || 'Unknown' : game.createdBy || 'Unknown'}</div>
                  </div>
                </div>
                
                {game.status === 'active' && (
                  <div className="game-timer">
                    <div className="timer-label">TIME REMAINING</div>
                    <div className="timer-value">{gameTimeRemaining[game.gameCode] || calculateGameTimeRemaining(game)}</div>
                  </div>
                )}
              </div>
              
              <div className="game-card-actions-enhanced">
                {/* Edit Game - show for setup/waiting/created games (before they start) */}
                {(!game.status || game.status === 'setup' || game.status === 'waiting' || game.status === 'created' || game.status === 'pending') && (
                  <button 
                    className="btn-enhanced btn-primary-enhanced" 
                    onClick={() => handleEditGame(game._id || game.id, game.name)}
                  >
                    ✏️ EDIT
                  </button>
                )}
                
                {/* Start Game - show for setup/waiting/created games */}
                {(!game.status || game.status === 'setup' || game.status === 'waiting' || game.status === 'created' || game.status === 'pending') && (
                  <button 
                    className="btn-enhanced btn-primary-enhanced" 
                    onClick={() => handleStartGame(game._id || game.id, game.name)}
                  >
                    ▶️ START
                  </button>
                )}
                
                {/* Pause Game - show for active games */}
                {game.status === 'active' && (
                  <button 
                    className="btn-enhanced btn-primary-enhanced" 
                    onClick={() => handlePauseGame(game._id || game.id, game.name)}
                  >
                    ⏸️ PAUSE
                  </button>
                )}
                
                {/* Resume Game - show for paused games */}
                {game.status === 'paused' && (
                  <button 
                    className="btn-enhanced btn-primary-enhanced" 
                    onClick={() => handleResumeGame(game._id || game.id, game.name)}
                  >
                    ▶️ RESUME
                  </button>
                )}
                
                {/* End Game - show for active or paused games */}
                {(game.status === 'active' || game.status === 'paused') && (
                  <button 
                    className="btn-enhanced btn-danger-enhanced" 
                    onClick={() => handleEndGame(game._id || game.id, game.name)}
                  >
                    ⏹️ END
                  </button>
                )}
                
                {/* Always show End Game button if game is not completed */}
                {game.status !== 'completed' && game.status !== 'cancelled' && game.status !== 'active' && game.status !== 'paused' && (
                  <button 
                    className="btn-enhanced btn-danger-enhanced" 
                    onClick={() => handleEndGame(game._id || game.id, game.name)}
                  >
                    ⏹️ END
                  </button>
                )}
                
                {/* Send Message - always available */}
                <button 
                  className="btn-enhanced btn-info-enhanced" 
                  onClick={() => handleSendMessage(game._id || game.id, game.name)}
                >
                  💬 MESSAGE
                </button>
                
                {/* Delete Game - show for all games except active ones */}
                <button 
                  className="btn-enhanced btn-danger-enhanced" 
                  onClick={() => handleDeleteGame(game._id || game.id, game.name)}
                  disabled={game.status === 'active'}
                  title={game.status === 'active' ? 'Cannot delete active games' : 'Delete this game permanently'}
                >
                  🗑️ DELETE
                </button>
              </div>
              
              {game.status === 'active' && (
                <div className="active-game-indicator">
                  <div className="pulse-dot"></div>
                  LIVE GAME IN PROGRESS
                </div>
              )}
            </div>

            {/* Predefined Players Card */}
            <div className="klopjacht-game-card">
              <div className="game-card-header-enhanced">
                <div className="game-title">
                  <h4>PREDEFINED PLAYERS</h4>
                  <div className="game-code">PLAYER SLOTS: {game.predefinedPlayers?.length || 0}</div>
                </div>
                <div className="status-badge-enhanced setup">
                  {game.predefinedPlayers?.length || 0} PLAYERS
                </div>
              </div>
              
              <div className="game-card-body-enhanced">
                {game.predefinedPlayers && game.predefinedPlayers.length > 0 ? (
                  <div className="players-enhanced-list">
                    {game.predefinedPlayers.map((player: PredefinedPlayer) => (
                      <div key={player._id} className="player-enhanced-item">
                        <div className="player-enhanced-header">
                          <strong>{player.name.toUpperCase()}</strong>
                          <span className={`status-badge-enhanced ${player.isJoined ? 'active' : 'setup'}`}>
                            {player.isJoined ? 'JOINED' : 'AVAILABLE'}
                          </span>
                        </div>
                        <div className="player-enhanced-details">
                          <div><strong>ROLE:</strong> {player.role.toUpperCase()}</div>
                          <div><strong>TEAM:</strong> {(player.team || 'NONE').toUpperCase()}</div>
                          <div><strong>PASSWORD:</strong> {player.password}</div>
                          <div><strong>CREATED:</strong> {new Date(player.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div className="player-enhanced-actions">
                          <button 
                            className="btn-enhanced btn-primary-enhanced" 
                            onClick={() => handleEditPredefinedPlayer(game._id || game.id, player)}
                          >
                            ✏️ EDIT
                          </button>
                          <button 
                            className="btn-enhanced btn-danger-enhanced" 
                            onClick={() => handleDeletePredefinedPlayer(game._id || game.id, player._id, player.name)}
                            disabled={player.isJoined}
                            title={player.isJoined ? 'Cannot delete players who have already joined' : 'Delete this predefined player'}
                          >
                            🗑️ {player.isJoined ? 'JOINED' : 'DELETE'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-games-enhanced" style={{ padding: '2rem 1rem' }}>
                    <div className="no-games-icon">👥</div>
                    <div className="no-games-title">NO PLAYERS CREATED</div>
                    <div className="no-games-subtitle">Create predefined players to get started</div>
                    <button 
                      className="btn btn-primary btn-large" 
                      onClick={() => navigate(`/manage-players/${game._id || game.id}`)}
                      style={{ marginTop: '1rem' }}
                    >
                      👥 ADD PLAYERS
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Joined Players Card */}
            <div className="klopjacht-game-card">
              <div className="game-card-header-enhanced">
                <div className="game-title">
                  <h4>JOINED PLAYERS</h4>
                  <div className="game-code">IN GAME: {(() => {
                    // Count predefined players who have joined
                    const joinedPredefined = game.predefinedPlayers?.filter((p: PredefinedPlayer) => p.isJoined).length || 0;
                    // Count active players in the game
                    const activePlayers = gamePlayers.length;
                    return Math.max(joinedPredefined, activePlayers);
                  })()}</div>
                </div>
                <div className="status-badge-enhanced active">
                  {(() => {
                    const joinedPredefined = game.predefinedPlayers?.filter((p: PredefinedPlayer) => p.isJoined).length || 0;
                    const activePlayers = gamePlayers.length;
                    const totalJoined = Math.max(joinedPredefined, activePlayers);
                    return `${totalJoined} JOINED`;
                  })()}
                </div>
              </div>
              
              <div className="game-card-body-enhanced">
                {(() => {
                  // Show predefined players who have joined, or active players if game is running
                  const joinedPredefined = game.predefinedPlayers?.filter((p: PredefinedPlayer) => p.isJoined) || [];
                  const playersToShow = joinedPredefined.length > 0 ? joinedPredefined : gamePlayers;
                  
                  return playersToShow.length > 0 ? (
                    <div className="players-enhanced-list">
                      {playersToShow.map((player: any) => {
                        // Handle both predefined players and active players
                        const isPredefPlayer = player.hasOwnProperty('isJoined');
                        
                        return (
                          <div key={player._id || player.id} className="player-enhanced-item">
                            <div className="player-enhanced-header">
                              <strong>{player.name.toUpperCase()}</strong>
                              <span className={`status-badge-enhanced ${
                                isPredefPlayer 
                                  ? (game.status === 'active' ? 'active' : 'setup')
                                  : (player.status || 'active')
                              }`}>
                                {isPredefPlayer 
                                  ? (game.status === 'active' ? 'IN GAME' : 'WAITING')
                                  : (player.status?.toUpperCase() || 'ACTIVE')
                                }
                              </span>
                            </div>
                            <div className="player-enhanced-details">
                              <div><strong>ROLE:</strong> {player.role?.toUpperCase() || 'UNKNOWN'}</div>
                              <div><strong>TEAM:</strong> {(player.team || 'NONE').toUpperCase()}</div>
                              {!isPredefPlayer && (
                                <>
                                  <div><strong>TASKS:</strong> {player.tasksCompleted || 0}/6</div>
                                  <div><strong>LOCATION:</strong> {player.location?.address || player.currentLocation?.address || 'NO LOCATION'}</div>
                                </>
                              )}
                              {isPredefPlayer && (
                                <>
                                  <div><strong>STATUS:</strong> JOINED & {game.status === 'active' ? 'PLAYING' : 'WAITING'}</div>
                                  <div><strong>JOINED:</strong> {new Date(player.createdAt).toLocaleDateString()}</div>
                                </>
                              )}
                            </div>
                            <div className="player-enhanced-actions">
                              {!isPredefPlayer && (
                                <button 
                                  className="btn-enhanced btn-info-enhanced" 
                                  onClick={() => handleViewLocation(player)}
                                >
                                  📍 LOCATION
                                </button>
                              )}
                              {isPredefPlayer && game.status !== 'active' && (
                                <div className="player-waiting-indicator">
                                  <span style={{ color: '#0066CC', fontSize: '0.9rem' }}>
                                    ⏳ WAITING FOR GAME START
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="no-games-enhanced" style={{ padding: '2rem 1rem' }}>
                      <div className="no-games-icon">👥</div>
                      <div className="no-games-title">NO PLAYERS JOINED</div>
                      <div className="no-games-subtitle">No players have joined the game yet</div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* QR Codes Card */}
            <div className="klopjacht-game-card">
              <div className="game-card-header-enhanced">
                <div className="game-title">
                  <h4>MISSION QR CODES</h4>
                  <div className="game-code">FUGITIVE TASKS: {game.tasks?.length || 0}/6</div>
                </div>
                <div className="status-badge-enhanced setup">
                  {game.tasks?.length || 0} QR CODES
                </div>
              </div>
              
              <div className="game-card-body-enhanced">
                <QRCodesDisplay gameId={game._id || game.id} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAllGames = () => (
    <div className="admin-content">
      <div className="klopjacht-header">
        <div className="header-title">
          <h2>KLOPJACHT: YOUR GAMES</h2>
          <div className="header-subtitle">COMPLETE GAMES MANAGEMENT SYSTEM</div>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-primary btn-large"
            onClick={handleCreateGame}
          >
            🎮 CREATE NEW GAME
          </button>
        </div>
      </div>
      
      <div className="klopjacht-stats">
        <div className="stat-card-enhanced">
          <div className="stat-icon">🎯</div>
          <div className="stat-content">
            <div className="stat-number">{games.length}</div>
            <div className="stat-label">TOTAL GAMES</div>
          </div>
        </div>
        <div className="stat-card-enhanced">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <div className="stat-number">{Array.isArray(games) ? games.filter(g => g.status === 'active').length : 0}</div>
            <div className="stat-label">ACTIVE GAMES</div>
          </div>
        </div>
        <div className="stat-card-enhanced">
          <div className="stat-icon">🏁</div>
          <div className="stat-content">
            <div className="stat-number">{Array.isArray(games) ? games.filter(g => g.status === 'completed').length : 0}</div>
            <div className="stat-label">COMPLETED</div>
          </div>
        </div>
        <div className="stat-card-enhanced">
          <div className="stat-icon">⏸️</div>
          <div className="stat-content">
            <div className="stat-number">{Array.isArray(games) ? games.filter(g => g.status === 'paused').length : 0}</div>
            <div className="stat-label">PAUSED</div>
          </div>
        </div>
      </div>

      <div className="klopjacht-games-section">
        <div className="section-header">
          <h3>ALL GAMES</h3>
          <div className="section-subtitle">Manage and monitor all KLOPJACHT games</div>
        </div>
        
        {games.length === 0 ? (
          <div className="no-games-enhanced">
            <div className="no-games-icon">🎮</div>
            <div className="no-games-title">NO GAMES FOUND</div>
            <div className="no-games-subtitle">Create your first KLOPJACHT game to get started</div>
            <button 
              className="btn btn-primary btn-large"
              onClick={handleCreateGame}
              style={{ marginTop: '1rem' }}
            >
              🎮 CREATE FIRST GAME
            </button>
          </div>
        ) : (
          <div className="klopjacht-games-grid">
            {Array.isArray(games) ? games.map(game => (
              <div key={game._id || game.id} className="klopjacht-game-card">
                <div className="game-card-header-enhanced">
                  <div className="game-title">
                    <h4>{game.name}</h4>
                    <div className="game-code">#{game.gameCode}</div>
                  </div>
                  <div className={`status-badge-enhanced ${game.status}`}>
                    {game.status?.toUpperCase() || 'UNKNOWN'}
                  </div>
                </div>
                
                <div className="game-card-body-enhanced">
                  <div className="game-info-grid">
                    <div className="info-item">
                      <div className="info-label">CREATED</div>
                      <div className="info-value">{new Date(game.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">DURATION</div>
                      <div className="info-value">{game.duration}min</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">PLAYERS</div>
                      <div className="info-value">{game.predefinedPlayers?.length || 0}/{game.maxPlayers || game.settings?.maxPlayers || 20}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">CREATOR</div>
                      <div className="info-value">{game.createdBy?.name || 'Unknown'}</div>
                    </div>
                  </div>
                  
                  {game.status === 'active' && (
                    <div className="game-timer">
                      <div className="timer-label">TIME REMAINING</div>
                      <div className="timer-value">{gameTimeRemaining[game.gameCode] || calculateGameTimeRemaining(game)}</div>
                    </div>
                  )}
                </div>
                
                <div className="game-card-actions-enhanced">
                  <button 
                    className="btn-enhanced btn-primary-enhanced" 
                    onClick={() => handleViewGame(game.gameCode)}
                  >
                    📊 DETAILS
                  </button>
                  <button 
                    className="btn-enhanced btn-info-enhanced" 
                    onClick={() => navigate(`/manage-players/${game._id || game.id}`)}
                  >
                    👥 PLAYERS
                  </button>
                  <button 
                    className="btn-enhanced btn-danger-enhanced" 
                    onClick={() => handleDeleteGame(game._id || game.id, game.name)}
                    disabled={game.status === 'active'}
                    title={game.status === 'active' ? 'Cannot delete active games' : 'Delete this game permanently'}
                  >
                    🗑️ DELETE
                  </button>
                </div>
                
                {game.status === 'active' && (
                  <div className="active-game-indicator">
                    <div className="pulse-dot"></div>
                    LIVE GAME IN PROGRESS
                  </div>
                )}
              </div>
            )) : null}
          </div>
        )}
      </div>
    </div>
  );

  const renderCreateGame = () => {
    const handleFormSubmit = async (e: any) => {
      e.preventDefault();
      
      // Check if we're editing an existing game
      const editingGameId = localStorage.getItem('editingGameId');
      const isEditing = !!editingGameId;
      
      // CRITICAL: Validate form before any processing
      const validTasks = gameForm.tasks.filter(t => 
        t.question && t.question.trim().length >= 10 && 
        t.answer && t.answer.trim().length >= 1 && 
        t.location.address && t.location.address.trim().length > 0
      );
      const isFormValid = validTasks.length === 6 && 
                         gameForm.name.trim().length >= 3 && 
                         gameForm.extractionPoint.address && 
                         gameForm.extractionPoint.address.trim().length > 0;
      
      console.log('FORM SUBMISSION VALIDATION:', {
        isEditing,
        editingGameId,
        validTasksCount: validTasks.length,
        gameNameLength: gameForm.name.trim().length,
        hasExtractionPoint: !!gameForm.extractionPoint.address,
        isFormValid,
        gameFormData: {
          name: gameForm.name,
          extractionPoint: gameForm.extractionPoint,
          tasks: gameForm.tasks.map(t => ({
            question: t.question,
            answer: t.answer,
            location: t.location.address
          }))
        }
      });
      
      if (!isFormValid) {
        alert(`Form is incomplete!\n\nRequirements:\n- Game name: ${gameForm.name.trim().length}/3 characters\n- Extraction point: ${gameForm.extractionPoint.address ? 'Set' : 'Missing'}\n- Valid tasks: ${validTasks.length}/6\n\nPlease complete all fields before submitting.`);
        return;
      }
      
      setLoading(true);
      
      try {
        // Debug: Check if token exists
        const token = localStorage.getItem('token');
        console.log('Token exists:', !!token);
        console.log('Token preview:', token ? token.substring(0, 20) + '...' : 'No token');
        
        // Debug: Try to decode the token to see if it's valid
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            console.log('Token payload:', payload);
            console.log('Token expires at:', new Date(payload.exp * 1000));
            console.log('Current time:', new Date());
            console.log('Token is expired:', payload.exp * 1000 < Date.now());
          } catch (e) {
            console.log('Error decoding token:', e);
          }
        }
        
        // Create game data
        const gameData = {
          name: gameForm.name,
          duration: gameForm.duration,
          maxPlayers: gameForm.maxPlayers,
          extractionPoint: gameForm.extractionPoint,
          tasks: gameForm.tasks
        };

        if (isEditing) {
          // UPDATE EXISTING GAME
          console.log('Updating existing game:', editingGameId);
          
          // Step 1: Update the basic game info
          const basicGameData = {
            name: gameData.name,
            duration: gameData.duration,
            extractionPoint: {
              latitude: parseFloat(gameData.extractionPoint.lat.toString()),
              longitude: parseFloat(gameData.extractionPoint.lng.toString()),
              address: gameData.extractionPoint.address
            },
            settings: {
              maxPlayers: gameData.maxPlayers
            }
          };

          const gameResponse = await fetch(API_ENDPOINTS.GAME_BY_ID(editingGameId), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(basicGameData)
          });

          if (!gameResponse.ok) {
            const errorData = await gameResponse.json();
            console.error('Game update error:', errorData);
            
            // Handle invalid token - redirect to login
            if (errorData.code === 'INVALID_TOKEN' || errorData.error === 'Invalid token') {
              alert('Your session has expired. Please log in again.');
              localStorage.removeItem('token');
              navigate('/login');
              return;
            }
            
            throw new Error(`Failed to update game: ${errorData.error || errorData.message || 'Unknown error'}`);
          }

          // Step 2: Update tasks
          const tasksData = {
            tasks: gameData.tasks.map(task => ({
              question: task.question,
              answer: task.answer,
              location: {
                latitude: task.location.lat,
                longitude: task.location.lng,
                address: task.location.address
              }
            }))
          };

          const tasksResponse = await fetch(API_ENDPOINTS.GAME_TASKS(editingGameId), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(tasksData)
          });

          if (!tasksResponse.ok) {
            const errorData = await tasksResponse.json();
            console.error('Tasks update error:', errorData);
            console.error('Validation details:', errorData.details);
            
            // Log each validation error individually
            if (errorData.details && Array.isArray(errorData.details)) {
              errorData.details.forEach((detail: any, index: number) => {
                console.error(`Validation Error ${index + 1}:`, detail);
              });
            }
            
            throw new Error(`Failed to update tasks: ${errorData.error || errorData.message || 'Unknown error'}`);
          }

          // Update the game in the games list
          setGames(prev => prev.map(game => 
            (game._id === editingGameId || game.id === editingGameId) 
              ? { ...game, ...gameData, tasks: gameData.tasks }
              : game
          ));
          
          alert(`Game Updated Successfully!\n\nName: ${gameData.name}\nDuration: ${gameData.duration} minutes\nMax Players: ${gameData.maxPlayers}\n\nExtraction Point: ${gameData.extractionPoint.address}\nTasks: 6/6 updated\n\nGame changes have been saved!`);
          
          // Clean up editing state
          localStorage.removeItem('editingGameId');
          
        } else {
          // CREATE NEW GAME
          console.log('Creating new game');
          
          // Step 1: Create the basic game
          const basicGameData = {
            name: gameData.name,
            duration: gameData.duration,
            extractionPoint: {
              latitude: parseFloat(gameData.extractionPoint.lat.toString()),
              longitude: parseFloat(gameData.extractionPoint.lng.toString()),
              address: gameData.extractionPoint.address
            },
            settings: {
              maxPlayers: gameData.maxPlayers
            }
          };

          console.log('🔍 DEBUGGING: SENDING GAME DATA TO BACKEND:', JSON.stringify(basicGameData, null, 2));
          console.log('🔍 DEBUGGING: API_ENDPOINTS.GAMES:', API_ENDPOINTS.GAMES);
          console.log('🔍 DEBUGGING: Token:', localStorage.getItem('token') ? 'Present' : 'Missing');

          const gameResponse = await fetch(API_ENDPOINTS.GAMES, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(basicGameData)
          });

          console.log('🔍 DEBUGGING: Game response status:', gameResponse.status);
          console.log('🔍 DEBUGGING: Game response ok:', gameResponse.ok);

          if (!gameResponse.ok) {
            const errorData = await gameResponse.json();
            console.error('🔍 DEBUGGING: Game creation error:', errorData);
            console.error('🔍 DEBUGGING: Full error response:', {
              status: gameResponse.status,
              statusText: gameResponse.statusText,
              headers: Object.fromEntries(gameResponse.headers.entries()),
              errorData
            });
            
            // Show detailed validation errors
            if (errorData.details && Array.isArray(errorData.details)) {
              const validationErrors = errorData.details.map((detail: any) => `• ${detail.msg} (${detail.param})`).join('\n');
              alert(`❌ VALIDATION FAILED:\n\n${validationErrors}\n\nPlease fix these issues and try again.`);
            } else {
              alert(`❌ ERROR: ${errorData.error || errorData.message || 'Unknown error'}`);
            }
            
            // Handle invalid token - redirect to login
            if (errorData.code === 'INVALID_TOKEN' || errorData.error === 'Invalid token') {
              alert('Your session has expired. Please log in again.');
              localStorage.removeItem('token');
              navigate('/login');
              return;
            }
            
            throw new Error(`Failed to create game: ${errorData.error || errorData.message || 'Unknown error'}`);
          }

          const newGame = await gameResponse.json();
          
          // Step 2: Add tasks to the game
          const tasksData = {
            tasks: gameData.tasks.map(task => ({
              question: task.question,
              answer: task.answer,
              location: {
                latitude: parseFloat(task.location.lat.toString()),
                longitude: parseFloat(task.location.lng.toString()),
                address: task.location.address
              }
            }))
          };

          const tasksResponse = await fetch(API_ENDPOINTS.GAME_TASKS(newGame.game.id), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(tasksData)
          });

          if (!tasksResponse.ok) {
            const errorData = await tasksResponse.json();
            console.error('Tasks creation error:', errorData);
            console.error('Validation details:', errorData.details);
            
            // Log each validation error individually
            if (errorData.details && Array.isArray(errorData.details)) {
              errorData.details.forEach((detail: any, index: number) => {
                console.error(`Validation Error ${index + 1}:`, detail);
              });
            }
            
            throw new Error(`Failed to add tasks to game: ${errorData.error || errorData.message || 'Unknown error'}`);
          }

          // Add the new game to the games list
          setGames(prev => Array.isArray(prev) ? [...prev, { ...newGame.game, tasks: gameData.tasks }] : [{ ...newGame.game, tasks: gameData.tasks }]);
          
          alert(`Game Created Successfully!\n\nGame Code: ${newGame.code || newGame.game?.gameCode || 'Generated'}\nName: ${newGame.game?.name || gameData.name}\nDuration: ${gameData.duration} minutes\nMax Players: ${gameData.maxPlayers}\n\nExtraction Point: ${gameData.extractionPoint.address || 'Not set'}\nTasks: 6/6 completed\n\nGame is ready for players to join!`);
        }
        
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
        
        // Refresh data to show updated information
        fetchData();
        
      } catch (error: any) {
        console.error(`Error ${isEditing ? 'updating' : 'creating'} game:`, error);
        console.error('Error details:', {
          message: error?.message || 'No message',
          stack: error?.stack || 'No stack trace',
          name: error?.name || 'Unknown error type'
        });
        alert(`Failed to ${isEditing ? 'update' : 'create'} game: ${error?.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="admin-content">
        <div className="game-header">
          <h2>🎮 {localStorage.getItem('editingGameId') ? 'Edit Game' : 'Create New Game'}</h2>
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              // Clean up editing state when canceling
              localStorage.removeItem('editingGameId');
              setSelectedView('overview');
            }}
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
                    onChange={(e) => setGameForm(prev => ({ ...prev, duration: Math.max(30, parseInt(e.target.value) || 30) }))}
                    min="30"
                    max="480"
                    required
                  />
                  <small style={{ color: '#666', fontSize: '0.8rem' }}>
                    Minimum 30 minutes, maximum 480 minutes (8 hours)
                  </small>
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
                  
                  <div className="location-input-options">
                    <div className="form-group">
                      <label>Enter Address Manually:</label>
                      <input
                        type="text"
                        placeholder="e.g., Dam Square, Amsterdam or Central Station, Rotterdam"
                        onKeyPress={async (e) => {
                          if (e.key === 'Enter') {
                            const target = e.target as HTMLInputElement;
                            const address = target.value.trim();
                            if (address) {
                              try {
                                // Real geocoding using Nominatim API (OpenStreetMap)
                                const response = await fetch(
                                  `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
                                );
                                const data = await response.json();
                                
                                if (data && data.length > 0) {
                                  const result = data[0];
                                  const coordinates = {
                                    lat: parseFloat(result.lat),
                                    lng: parseFloat(result.lon),
                                    address: result.display_name
                                  };
                                  handleLocationSelect(coordinates);
                                  target.value = '';
                                } else {
                                  alert('Address not found. Please try a different address or use the map.');
                                }
                              } catch (error) {
                                console.error('Geocoding error:', error);
                                alert('Error finding address. Please try again or use the map.');
                              }
                            }
                          }
                        }}
                        style={{ marginBottom: '0.5rem' }}
                      />
                      <small style={{ color: '#666', fontSize: '0.8rem' }}>
                        Press Enter to set location, or use the map below
                      </small>
                    </div>
                    
                    <div style={{ textAlign: 'center', margin: '1rem 0', color: '#888' }}>
                      — OR —
                    </div>
                    
                    <button 
                      type="button" 
                      className="btn btn-info" 
                      onClick={() => handleSetLocation('extraction')}
                    >
                      {gameForm.extractionPoint.address ? 'Change Location on Map' : 'Set Location on Map'}
                    </button>
                  </div>
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
                        {task.id === 6 ? (
                          // Task 6 automatically uses extraction point
                          <div className="location-display extraction-point-notice">
                            {gameForm.extractionPoint.address ? (
                              <>
                                <strong>📍 {gameForm.extractionPoint.address}</strong>
                                <br />
                                <small>Coordinates: {gameForm.extractionPoint.lat}, {gameForm.extractionPoint.lng}</small>
                                <br />
                                <em style={{ color: '#4A90E2', fontSize: '0.9rem' }}>
                                  ✓ Automatically set to Extraction Point (Final Task)
                                </em>
                              </>
                            ) : (
                              <em style={{ color: '#888' }}>
                                Will be set automatically when you set the Extraction Point
                              </em>
                            )}
                          </div>
                        ) : (
                          // Tasks 1-5 can have custom locations
                          <>
                            {task.location.address ? (
                              <div className="location-display">
                                <strong>📍 {task.location.address}</strong>
                                <br />
                                <small>Coordinates: {task.location.lat}, {task.location.lng}</small>
                              </div>
                            ) : (
                              <div className="no-location">No location set</div>
                            )}
                            
                            <div className="location-input-options" style={{ marginTop: '0.5rem' }}>
                              <input
                                type="text"
                                placeholder="Enter address and press Enter"
                                onKeyPress={async (e) => {
                                  if (e.key === 'Enter') {
                                    const target = e.target as HTMLInputElement;
                                    const address = target.value.trim();
                                    if (address) {
                                      try {
                                        // Real geocoding using Nominatim API (OpenStreetMap)
                                        const response = await fetch(
                                          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
                                        );
                                        const data = await response.json();
                                        
                                        if (data && data.length > 0) {
                                          const result = data[0];
                                          const coordinates = {
                                            lat: parseFloat(result.lat),
                                            lng: parseFloat(result.lon),
                                            address: result.display_name
                                          };
                                          setGameForm(prev => ({
                                            ...prev,
                                            tasks: prev.tasks.map((t, i) => 
                                              i === index ? { ...t, location: coordinates } : t
                                            )
                                          }));
                                          target.value = '';
                                        } else {
                                          alert('Address not found. Please try a different address or use the map.');
                                        }
                                      } catch (error) {
                                        console.error('Geocoding error:', error);
                                        alert('Error finding address. Please try again or use the map.');
                                      }
                                    }
                                  }
                                }}
                                style={{ width: '100%', marginBottom: '0.5rem', fontSize: '0.9rem' }}
                              />
                              <button 
                                type="button" 
                                className="btn-small btn-info" 
                                onClick={() => handleSetLocation('task', index)}
                              >
                                {task.location.address ? 'Change on Map' : 'Set on Map'}
                              </button>
                            </div>
                          </>
                        )}
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
                    disabled={(() => {
                      const validTasks = gameForm.tasks.filter(t => 
                        t.question && t.question.trim().length >= 10 && 
                        t.answer && t.answer.trim().length >= 1 && 
                        t.location.address && t.location.address.trim().length > 0
                      );
                      const isFormValid = validTasks.length === 6 && 
                                         gameForm.name.trim().length >= 3 && 
                                         gameForm.extractionPoint.address && 
                                         gameForm.extractionPoint.address.trim().length > 0;
                      
                      // Debug logging
                      console.log('Form validation check:', {
                        validTasksCount: validTasks.length,
                        gameNameLength: gameForm.name.trim().length,
                        hasExtractionPoint: !!gameForm.extractionPoint.address,
                        isFormValid,
                        buttonDisabled: !isFormValid
                      });
                      
                      return !isFormValid;
                    })()}
                  >
                    {(() => {
                      const validTasks = gameForm.tasks.filter(t => 
                        t.question && t.question.trim().length >= 10 && 
                        t.answer && t.answer.trim().length >= 1 && 
                        t.location.address && t.location.address.trim().length > 0
                      );
                      const isFormValid = validTasks.length === 6 && 
                                         gameForm.name.trim().length >= 3 && 
                                         gameForm.extractionPoint.address && 
                                         gameForm.extractionPoint.address.trim().length > 0;
                      
                      if (!isFormValid) {
                        return `Complete All Fields (${validTasks.length}/6 tasks ready)`;
                      }
                      const isEditing = !!localStorage.getItem('editingGameId');
                      return isEditing ? 'Save Game 💾' : 'Create Game 🎮';
                    })()}
                  </button>
                </div>
                <div className="task-progress">
                  Valid Tasks: {gameForm.tasks.filter(t => 
                    t.question && t.question.length >= 10 && 
                    t.answer && t.answer.length >= 1 && 
                    t.location.address
                  ).length}/6
                  <br />
                  <small>
                    Questions ≥10 chars: {gameForm.tasks.filter(t => t.question && t.question.length >= 10).length}/6 |
                    Answers ≥1 char: {gameForm.tasks.filter(t => t.answer && t.answer.length >= 1).length}/6 |
                    Locations set: {gameForm.tasks.filter(t => t.location.address).length}/6
                  </small>
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
        <h1>🔍 {
          localStorage.getItem('userRole') === 'super_admin' ? 'Super Admin Dashboard' :
          localStorage.getItem('userRole') === 'game_lead' ? 'Game Lead Dashboard' :
          'Admin Dashboard'
        }</h1>
        
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
          {localStorage.getItem('userRole') === 'super_admin' && (
            <button 
              className="nav-btn"
              onClick={() => navigate('/user-management')}
            >
              👥 Manage Game Leads
            </button>
          )}
          <button 
            className="nav-btn"
            onClick={() => {
              console.log('Manual refresh triggered');
              fetchData();
            }}
            style={{ marginLeft: 'auto', backgroundColor: '#28a745' }}
          >
            🔄 Refresh
          </button>
        </div>

        {selectedView === 'overview' && renderOverview()}
        {selectedView === 'games' && renderAllGames()}
        {selectedView === 'create-game' && renderCreateGame()}
        {selectedView === 'edit-game' && renderCreateGame()} {/* Reuse create game form for editing */}
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
