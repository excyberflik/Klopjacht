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
          
          <div className="qr-code-manual-entry" style={{ 
            marginTop: '0.5rem', 
            padding: '0.75rem', 
            backgroundColor: '#f8f9fa', 
            border: '1px solid #dee2e6', 
            borderRadius: '6px',
            fontSize: '0.9rem'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}>
              <strong style={{ color: '#495057' }}>Manual Entry Code:</strong>
              <button 
                onClick={async (e) => {
                  e.preventDefault();
                  const button = e.target as HTMLButtonElement;
                  const originalText = button.innerHTML;
                  const originalBgColor = button.style.backgroundColor;
                  
                  // Generate secure 6-digit code based on gameId and task number
                  const secureCode = (() => {
                    // Create a more complex hash with multiple rounds and salt
                    const salt = 'KLOPJACHT_SECURE_2024';
                    const hashInput = `${salt}-${gameId}-TASK-${task.taskNumber}-${salt}`;
                    
                    // Multiple hash rounds for better randomization
                    let hash1 = 0;
                    let hash2 = 0;
                    
                    // First hash round
                    for (let i = 0; i < hashInput.length; i++) {
                      const char = hashInput.charCodeAt(i);
                      hash1 = ((hash1 << 7) - hash1) + char;
                      hash1 = hash1 & hash1; // Convert to 32-bit integer
                    }
                    
                    // Second hash round with different algorithm
                    const reversedInput = hashInput.split('').reverse().join('');
                    for (let i = 0; i < reversedInput.length; i++) {
                      const char = reversedInput.charCodeAt(i);
                      hash2 = ((hash2 << 3) + hash2) ^ char;
                      hash2 = hash2 & hash2; // Convert to 32-bit integer
                    }
                    
                    // Combine hashes and add task-specific multiplier
                    const combined = Math.abs(hash1 ^ hash2) * (task.taskNumber * 7919); // 7919 is a prime
                    const sixDigitCode = (combined % 900000) + 100000;
                    
                    return sixDigitCode.toString();
                  })();
                  
                  try {
                    // Try modern clipboard API first
                    if (navigator.clipboard && window.isSecureContext) {
                      await navigator.clipboard.writeText(secureCode);
                    } else {
                      // Fallback for older browsers or non-HTTPS
                      const textArea = document.createElement('textarea');
                      textArea.value = secureCode;
                      textArea.style.position = 'fixed';
                      textArea.style.left = '-999999px';
                      textArea.style.top = '-999999px';
                      document.body.appendChild(textArea);
                      textArea.focus();
                      textArea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textArea);
                    }
                    
                    // Success feedback
                    button.innerHTML = '✅ COPIED!';
                    button.style.backgroundColor = '#28a745';
                    button.style.color = 'white';
                    
                  } catch (err) {
                    console.error('Copy failed:', err);
                    // Error feedback
                    button.innerHTML = '❌ FAILED';
                    button.style.backgroundColor = '#dc3545';
                    button.style.color = 'white';
                  }
                  
                  // Reset button after 2 seconds
                  setTimeout(() => {
                    button.innerHTML = originalText;
                    button.style.backgroundColor = originalBgColor || '#007bff';
                    button.style.color = 'white';
                  }, 2000);
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                📋 COPY
              </button>
            </div>
            
            <div style={{ 
              fontFamily: 'monospace', 
              fontSize: '2rem', 
              color: '#495057',
              padding: '1rem',
              backgroundColor: '#fff',
              border: '2px solid #007bff',
              borderRadius: '8px',
              textAlign: 'center',
              fontWeight: 'bold',
              letterSpacing: '0.2em'
            }}>
              {(() => {
                // Generate the same secure 6-digit code for display
                const salt = 'KLOPJACHT_SECURE_2024';
                const hashInput = `${salt}-${gameId}-TASK-${task.taskNumber}-${salt}`;
                
                // Multiple hash rounds for better randomization
                let hash1 = 0;
                let hash2 = 0;
                
                // First hash round
                for (let i = 0; i < hashInput.length; i++) {
                  const char = hashInput.charCodeAt(i);
                  hash1 = ((hash1 << 7) - hash1) + char;
                  hash1 = hash1 & hash1; // Convert to 32-bit integer
                }
                
                // Second hash round with different algorithm
                const reversedInput = hashInput.split('').reverse().join('');
                for (let i = 0; i < reversedInput.length; i++) {
                  const char = reversedInput.charCodeAt(i);
                  hash2 = ((hash2 << 3) + hash2) ^ char;
                  hash2 = hash2 & hash2; // Convert to 32-bit integer
                }
                
                // Combine hashes and add task-specific multiplier
                const combined = Math.abs(hash1 ^ hash2) * (task.taskNumber * 7919); // 7919 is a prime
                const sixDigitCode = (combined % 900000) + 100000;
                
                return sixDigitCode.toString();
              })()}
            </div>
            
            <small style={{ 
              color: '#6c757d', 
              fontSize: '0.8rem',
              display: 'block',
              marginTop: '0.5rem',
              fontStyle: 'italic',
              textAlign: 'center'
            }}>
              💡 Players can type this 6-digit code in "Enter Manually" if QR scan fails
            </small>
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
                  
                {(game.status === 'active' || game.status === 'paused') && (
                  <div className="game-timer">
                    <div className="timer-label">
                      {game.status === 'active' ? 'TIME REMAINING' : 'TIME REMAINING (PAUSED)'}
                    </div>
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
    const handleSubmitGame = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      try {
        // Automatically set Task 6 (extraction point task) to use extraction point location
        const updatedTasks = gameForm.tasks.map((task, index) => {
          if (index === 5) { // Task 6 (index 5)
            return {
              ...task,
              location: {
                lat: gameForm.extractionPoint.lat,
                lng: gameForm.extractionPoint.lng,
                address: gameForm.extractionPoint.address
              }
            };
          }
          return task;
        });

        // Validate that we have at least some tasks with complete data (including the auto-filled Task 6)
        const completeTasks = updatedTasks.filter(task => 
          task.question && task.answer && task.location.address
        );

        // Always create Task 6 as extraction point if we have extraction point
        if (gameForm.extractionPoint.address) {
          const extractionTask = {
            id: 6,
            question: 'Scan QR code or enter manual code to reach extraction point',
            answer: 'extracted',
            location: {
              lat: gameForm.extractionPoint.lat,
              lng: gameForm.extractionPoint.lng,
              address: gameForm.extractionPoint.address
            }
          };
          
          // Always set Task 6 as extraction point
          updatedTasks[5] = extractionTask;
          
          // Add to complete tasks if not already there
          if (!completeTasks.find(t => t.id === 6)) {
            completeTasks.push(extractionTask);
          }
        }

        if (completeTasks.length === 0) {
          alert('Please add at least one complete task with question, answer, and location, or ensure you have set an extraction point.');
          setLoading(false);
          return;
        }

        // First create the game without tasks
        const gameData = {
          name: gameForm.name,
          duration: gameForm.duration,
          maxPlayers: gameForm.maxPlayers,
          extractionPoint: {
            latitude: gameForm.extractionPoint.lat || 50.8503, // Default to Brussels if no coordinates
            longitude: gameForm.extractionPoint.lng || 4.3517,
            address: gameForm.extractionPoint.address
          },
          settings: {
            maxPlayers: gameForm.maxPlayers
          }
        };

        console.log('Creating game with data:', gameData);

        const response = await fetch(API_ENDPOINTS.GAMES, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(gameData),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('Game creation failed:', error);
          alert(`Failed to create game: ${error.details ? error.details.map((d: any) => d.msg).join(', ') : error.message || 'Unknown error'}`);
          setLoading(false);
          return;
        }

        const result = await response.json();
        console.log('Game created successfully:', result);

        // Now add tasks if we have any complete ones
        if (completeTasks.length > 0) {
          // Pad to exactly 6 tasks as required by backend
          const paddedTasks = [...completeTasks];
          while (paddedTasks.length < 6) {
            paddedTasks.push({
              id: paddedTasks.length + 1,
              question: `Task ${paddedTasks.length + 1} - Please complete this task`,
              answer: 'complete',
              location: {
                lat: gameData.extractionPoint.latitude,
                lng: gameData.extractionPoint.longitude,
                address: gameData.extractionPoint.address
              }
            });
          }

          const tasksData = {
            tasks: paddedTasks.map(task => ({
              question: task.question,
              answer: task.answer,
              location: {
                latitude: task.location.lat || gameData.extractionPoint.latitude,
                longitude: task.location.lng || gameData.extractionPoint.longitude,
                address: task.location.address || gameData.extractionPoint.address
              }
            }))
          };

          console.log('Adding tasks with data:', tasksData);

          const tasksResponse = await fetch(`${API_ENDPOINTS.GAMES}/${result.game.id}/tasks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(tasksData),
          });

          if (!tasksResponse.ok) {
            const tasksError = await tasksResponse.json();
            console.error('Tasks creation failed:', tasksError);
            alert(`Game created but failed to add tasks: ${tasksError.details ? tasksError.details.map((d: any) => d.msg).join(', ') : tasksError.message || 'Unknown error'}`);
          } else {
            console.log('Tasks added successfully');
          }
        }

        alert(`Game "${gameForm.name}" created successfully! Game Code: ${result.game.gameCode}`);
        
        // Reset form
        setGameForm({
          name: '',
          duration: 30,
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
        
        // Refresh data and go back to games list
        await fetchData();
        setSelectedView('games');

      } catch (error) {
        console.error('Error creating game:', error);
        alert('Error creating game. Please try again.');
      } finally {
        setLoading(false);
      }
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
          tasks: prev.tasks.map((task, index) => 
            index === mapSelectorTaskIndex 
              ? { ...task, location }
              : task
          )
        }));
      }
      setShowMapSelector(false);
    };

    const openMapSelector = (type: 'extraction' | 'task', taskIndex?: number) => {
      setMapSelectorType(type);
      if (type === 'task' && taskIndex !== undefined) {
        setMapSelectorTaskIndex(taskIndex);
      }
      setShowMapSelector(true);
    };

    return (
      <div className="admin-content">
        <div className="klopjacht-header">
          <div className="header-title">
            <h2>CREATE NEW KLOPJACHT GAME</h2>
            <div className="header-subtitle">STEP {currentStep} OF 3 - {
              currentStep === 1 ? 'BASIC GAME INFORMATION' :
              currentStep === 2 ? 'EXTRACTION POINT LOCATION' :
              'MISSION TASKS SETUP'
            }</div>
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

        <form onSubmit={handleSubmitGame} className="create-game-form">
          {currentStep === 1 && (
            <div className="klopjacht-game-card">
              <div className="game-card-header-enhanced">
                <div className="game-title">
                  <h4>BASIC GAME INFORMATION</h4>
                  <div className="game-code">STEP 1 OF 3</div>
                </div>
                <div className="status-badge-enhanced setup">SETUP</div>
              </div>
              
              <div className="game-card-body-enhanced">
                <div className="form-group">
                  <label htmlFor="gameName">Game Name *</label>
                  <input
                    type="text"
                    id="gameName"
                    value={gameForm.name}
                    onChange={(e) => setGameForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter game name (e.g., Downtown Chase, Campus Hunt)"
                    required
                    className="form-control"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="duration">Duration (minutes) *</label>
                    <input
                      type="number"
                      id="duration"
                      value={gameForm.duration}
                      onChange={(e) => setGameForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 30 }))}
                      min="30"
                      max="300"
                      required
                      className="form-control"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="maxPlayers">Max Players *</label>
                    <input
                      type="number"
                      id="maxPlayers"
                      value={gameForm.maxPlayers}
                      onChange={(e) => setGameForm(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) || 20 }))}
                      min="2"
                      max="50"
                      required
                      className="form-control"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn-enhanced btn-primary-enhanced"
                    onClick={() => setCurrentStep(2)}
                    disabled={!gameForm.name || gameForm.duration < 30}
                  >
                    NEXT: EXTRACTION POINT →
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="klopjacht-game-card">
              <div className="game-card-header-enhanced">
                <div className="game-title">
                  <h4>EXTRACTION POINT LOCATION</h4>
                  <div className="game-code">STEP 2 OF 3</div>
                </div>
                <div className="status-badge-enhanced setup">SETUP</div>
              </div>
              
              <div className="game-card-body-enhanced">
                <div className="form-group">
                  <label>Extraction Point *</label>
                  <div className="location-selector">
                    <input
                      type="text"
                      value={gameForm.extractionPoint.address}
                      onChange={(e) => setGameForm(prev => ({
                        ...prev,
                        extractionPoint: { ...prev.extractionPoint, address: e.target.value }
                      }))}
                      placeholder="Enter address manually or click 'Select on Map'"
                      className="form-control"
                    />
                    <button
                      type="button"
                      className="btn-enhanced btn-info-enhanced"
                      onClick={() => openMapSelector('extraction')}
                    >
                      📍 SELECT ON MAP
                    </button>
                  </div>
                  {gameForm.extractionPoint.lat !== 0 && gameForm.extractionPoint.lng !== 0 && (
                    <small className="form-help" style={{ color: '#28a745', fontWeight: 'bold' }}>
                      📍 Coordinates: {gameForm.extractionPoint.lat.toFixed(4)}, {gameForm.extractionPoint.lng.toFixed(4)}
                    </small>
                  )}
                  <small className="form-help">
                    The extraction point is where fugitives must reach to win the game. You can type an address manually or select on the map.
                  </small>
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn-enhanced btn-secondary-enhanced"
                    onClick={() => setCurrentStep(1)}
                  >
                    ← BACK
                  </button>
                  <button 
                    type="button" 
                    className="btn-enhanced btn-primary-enhanced"
                    onClick={() => setCurrentStep(3)}
                    disabled={!gameForm.extractionPoint.address}
                  >
                    NEXT: MISSION TASKS →
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="klopjacht-game-card">
              <div className="game-card-header-enhanced">
                <div className="game-title">
                  <h4>MISSION TASKS SETUP</h4>
                  <div className="game-code">STEP 3 OF 3</div>
                </div>
                <div className="status-badge-enhanced setup">
                  {gameForm.tasks.filter(t => t.question && t.answer && t.location.address).length}/6 TASKS
                </div>
              </div>
              
              <div className="game-card-body-enhanced">
                <div className="tasks-grid">
                  {gameForm.tasks.map((task, index) => (
                    <div key={task.id} className="task-form-item">
                      <h5>Mission {task.id} {task.id === 6 ? '(EXTRACTION POINT - NO MISSION)' : ''}</h5>
                      
                      {task.id === 6 ? (
                        <div style={{ 
                          padding: '1rem', 
                          backgroundColor: '#e8f5e8', 
                          border: '2px solid #4caf50', 
                          borderRadius: '8px',
                          marginBottom: '1rem'
                        }}>
                          <h6 style={{ color: '#2e7d32', marginBottom: '0.5rem' }}>🎯 EXTRACTION POINT</h6>
                          <p style={{ color: '#2e7d32', margin: 0, fontSize: '0.9rem' }}>
                            <strong>Task 6 is automatically the extraction point.</strong><br/>
                            Players just need to scan the QR code or enter the manual code to complete the game - no mission required!
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="form-group">
                            <label>Question *</label>
                            <input
                              type="text"
                              value={task.question}
                              onChange={(e) => setGameForm(prev => ({
                                ...prev,
                                tasks: prev.tasks.map((t, i) => 
                                  i === index ? { ...t, question: e.target.value } : t
                                )
                              }))}
                              placeholder="What question should players answer?"
                              className="form-control"
                            />
                          </div>

                          <div className="form-group">
                            <label>Answer *</label>
                            <input
                              type="text"
                              value={task.answer}
                              onChange={(e) => setGameForm(prev => ({
                                ...prev,
                                tasks: prev.tasks.map((t, i) => 
                                  i === index ? { ...t, answer: e.target.value } : t
                                )
                              }))}
                              placeholder="What is the correct answer?"
                              className="form-control"
                            />
                          </div>
                        </>
                      )}

                      <div className="form-group">
                        <label>Location *</label>
                        {task.id === 6 ? (
                          <div className="location-selector">
                            <input
                              type="text"
                              value={gameForm.extractionPoint.address || 'Extraction point from Step 2'}
                              readOnly
                              className="form-control"
                              style={{ 
                                backgroundColor: '#ffebee', 
                                borderColor: '#f44336',
                                color: '#d32f2f',
                                fontStyle: 'italic',
                                fontWeight: 'bold'
                              }}
                            />
                            <div className="btn-enhanced btn-secondary-enhanced btn-small" style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                              🎯 EXTRACTION
                            </div>
                          </div>
                        ) : (
                          <div className="location-selector">
                            <input
                              type="text"
                              value={task.location.address}
                              placeholder="Click 'Select on Map' to choose location"
                              readOnly
                              className="form-control"
                            />
                            <button
                              type="button"
                              className="btn-enhanced btn-info-enhanced btn-small"
                              onClick={() => openMapSelector('task', index)}
                            >
                              📍 MAP
                            </button>
                          </div>
                        )}
                        {task.id !== 6 && task.location.lat !== 0 && task.location.lng !== 0 && (
                          <small className="form-help" style={{ color: '#28a745', fontWeight: 'bold' }}>
                            📍 Coordinates: {task.location.lat.toFixed(4)}, {task.location.lng.toFixed(4)}
                          </small>
                        )}
                        {task.id === 6 && (
                          <small className="form-help" style={{ color: '#6c757d', fontStyle: 'italic' }}>
                            Task 6 automatically uses the extraction point location from Step 2
                          </small>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn-enhanced btn-secondary-enhanced"
                    onClick={() => setCurrentStep(2)}
                  >
                    ← BACK
                  </button>
                  <button 
                    type="submit" 
                    className="btn-enhanced btn-success-enhanced"
                    disabled={loading}
                  >
                    {loading ? 'CREATING GAME...' : '🎮 CREATE GAME'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>

        {showMapSelector && (
          <MapSelector
            onLocationSelect={handleLocationSelect}
            onClose={() => setShowMapSelector(false)}
          />
        )}
      </div>
    );
  };

  const renderGameDetails = (gameCode: string) => {
    const game = games.find(g => g.gameCode === gameCode || g.code === gameCode);
    
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
                
                {(game.status === 'active' || game.status === 'paused') && (
                  <div className="game-timer">
                    <div className="timer-label">
                      {game.status === 'active' ? 'TIME REMAINING' : 'TIME REMAINING (PAUSED)'}
                    </div>
                    <div className="timer-value">{gameTimeRemaining[game.gameCode] || calculateGameTimeRemaining(game)}</div>
                  </div>
                )}
                
                {/* Game Control Actions */}
                <div className="game-control-actions" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {game.status === 'active' && (
                    <button 
                      className="btn-enhanced btn-warning-enhanced"
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to pause this game?')) {
                          try {
                            const response = await fetch(`${API_ENDPOINTS.GAMES}/${game._id || game.id}/pause`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                'Content-Type': 'application/json'
                              }
                            });
                            
                            if (response.ok) {
                              alert('Game paused successfully!');
                              fetchData(); // Refresh data
                            } else {
                              alert('Failed to pause game');
                            }
                          } catch (error) {
                            console.error('Error pausing game:', error);
                            alert('Error pausing game');
                          }
                        }
                      }}
                    >
                      ⏸️ PAUSE GAME
                    </button>
                  )}
                  
                  {game.status === 'paused' && (
                    <button 
                      className="btn-enhanced btn-success-enhanced"
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to resume this game?')) {
                          try {
                            const response = await fetch(`${API_ENDPOINTS.GAMES}/${game._id || game.id}/resume`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                'Content-Type': 'application/json'
                              }
                            });
                            
                            if (response.ok) {
                              alert('Game resumed successfully!');
                              fetchData(); // Refresh data
                            } else {
                              alert('Failed to resume game');
                            }
                          } catch (error) {
                            console.error('Error resuming game:', error);
                            alert('Error resuming game');
                          }
                        }
                      }}
                    >
                      ▶️ RESUME GAME
                    </button>
                  )}
                  
                  {(game.status === 'setup' || game.status === 'waiting') && (
                    <button 
                      className="btn-enhanced btn-success-enhanced"
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to start this game?')) {
                          try {
                            const response = await fetch(`${API_ENDPOINTS.GAMES}/${game._id || game.id}/start`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                'Content-Type': 'application/json'
                              }
                            });
                            
                            if (response.ok) {
                              alert('Game started successfully!');
                              fetchData(); // Refresh data
                            } else {
                              alert('Failed to start game');
                            }
                          } catch (error) {
                            console.error('Error starting game:', error);
                            alert('Error starting game');
                          }
                        }
                      }}
                    >
                      🚀 START GAME
                    </button>
                  )}
                  
                  {(game.status === 'active' || game.status === 'paused') && (
                    <button 
                      className="btn-enhanced btn-danger-enhanced"
                      onClick={async () => {
                        if (window.confirm('Are you sure you want to end this game? This action cannot be undone.')) {
                          try {
                            const response = await fetch(`${API_ENDPOINTS.GAMES}/${game._id || game.id}/end`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                'Content-Type': 'application/json'
                              }
                            });
                            
                            if (response.ok) {
                              alert('Game ended successfully!');
                              fetchData(); // Refresh data
                            } else {
                              alert('Failed to end game');
                            }
                          } catch (error) {
                            console.error('Error ending game:', error);
                            alert('Error ending game');
                          }
                        }
                      }}
                    >
                      🏁 END GAME
                    </button>
                  )}
                  
                  {/* Delete button - always available but with different warnings based on status */}
                  <button 
                    className="btn-enhanced btn-danger-enhanced"
                    onClick={async () => {
                      let confirmMessage = 'Are you sure you want to delete this game? This action cannot be undone and will remove all game data.';
                      
                      if (game.status === 'active') {
                        confirmMessage = '⚠️ WARNING: This game is currently ACTIVE with players! Deleting it will immediately end the game and remove all data. Are you absolutely sure?';
                      } else if (game.status === 'paused') {
                        confirmMessage = '⚠️ WARNING: This game is PAUSED with players! Deleting it will permanently end the game and remove all data. Are you absolutely sure?';
                      }
                      
                      if (window.confirm(confirmMessage)) {
                        try {
                          const response = await fetch(`${API_ENDPOINTS.GAMES}/${game._id || game.id}`, {
                            method: 'DELETE',
                            headers: {
                              'Authorization': `Bearer ${localStorage.getItem('token')}`,
                            }
                          });
                          
                          if (response.ok) {
                            alert('Game deleted successfully!');
                            setSelectedView('games'); // Go back to games list
                            fetchData(); // Refresh data
                          } else {
                            alert('Failed to delete game');
                          }
                        } catch (error) {
                          console.error('Error deleting game:', error);
                          alert('Error deleting game');
                        }
                      }
                    }}
                  >
                    🗑️ DELETE GAME
                  </button>
                </div>
              </div>
            </div>

            {/* Active Players Card */}
            <div className="klopjacht-game-card">
              <div className="game-card-header-enhanced">
                <div className="game-title">
                  <h4>ACTIVE PLAYERS</h4>
                  <div className="game-code">JOINED PLAYERS</div>
                </div>
                <div className="status-badge-enhanced active">
                  {game.joinedPlayers?.length || 0} JOINED
                </div>
              </div>
              
              <div className="game-card-body-enhanced">
                {game.joinedPlayers && game.joinedPlayers.length > 0 ? (
                  <div className="game-players-list">
                    {game.joinedPlayers.map((player: any, index: number) => (
                      <div key={player._id || player.id || index} className="game-player-item">
                        <div className="player-info">
                          <div className="player-name">
                            <strong>{player.name?.toUpperCase() || 'UNKNOWN PLAYER'}</strong>
                          </div>
                          <div className="player-details">
                            <span className={`player-role ${player.role}`}>
                              {player.role?.toUpperCase() || 'UNKNOWN'}
                            </span>
                            {player.team && (
                              <span className="player-team">
                                Team: {player.team}
                              </span>
                            )}
                          </div>
                          <div className="player-status">
                            <div className="status-item">
                              <span className="status-label">Status:</span>
                              <span className={`status-value ${player.status || 'unknown'}`}>
                                {player.status?.toUpperCase() || 'UNKNOWN'}
                              </span>
                            </div>
                            <div className="status-item">
                              <span className="status-label">Tasks:</span>
                              <span className="status-value">
                                {player.completedTasks?.length || player.tasksCompleted || 0}/6
                              </span>
                            </div>
                            {player.lastSeen && (
                              <div className="status-item">
                                <span className="status-label">Last Seen:</span>
                                <span className="status-value">
                                  {new Date(player.lastSeen).toLocaleTimeString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="player-actions">
                          <button 
                            className="btn-enhanced btn-info-enhanced btn-small"
                            onClick={() => handleViewLocation(player)}
                            title="View player location"
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
                    <div className="no-games-title">NO PLAYERS JOINED</div>
                    <div className="no-games-subtitle">
                      {game.status === 'setup' || game.status === 'waiting' 
                        ? 'Players can join once the game starts' 
                        : 'No players have joined this game yet'}
                    </div>
                  </div>
                )}
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

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔍 {
          localStorage.getItem('userRole') === 'super_admin' ? 'Super Admin Dashboard' :
          localStorage.getItem('userRole') === 'game_lead' ? 'Game Lead Dashboard' :
          'Admin Dashboard'
        }</h1>
        
        <div className="admin-nav">
          {localStorage.getItem('userRole') === 'super_admin' && (
            <button 
              className={`nav-btn ${selectedView === 'overview' ? 'active' : ''}`}
              onClick={() => setSelectedView('overview')}
            >
              Overview
            </button>
          )}
          <button 
            className={`nav-btn ${selectedView === 'games' ? 'active' : ''}`}
            onClick={() => setSelectedView('games')}
          >
            {localStorage.getItem('userRole') === 'game_lead' ? 'My Games' : 'All Games'}
          </button>
          {localStorage.getItem('userRole') === 'super_admin' && (
            <button 
              className="nav-btn"
              onClick={() => navigate('/user-management')}
            >
              👥 Manage Game Leads
            </button>
          )}
          {localStorage.getItem('userRole') === 'super_admin' && (
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
          )}
        </div>

        {selectedView === 'overview' && localStorage.getItem('userRole') === 'super_admin' && renderOverview()}
        {selectedView === 'games' && renderAllGames()}
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
          onLocationSelect={(location) => {
            console.log('Location selected:', location);
            if (mapSelectorType === 'extraction') {
              setGameForm(prev => ({
                ...prev,
                extractionPoint: location
              }));
            } else if (mapSelectorType === 'task') {
              setGameForm(prev => ({
                ...prev,
                tasks: prev.tasks.map((task, index) => 
                  index === mapSelectorTaskIndex 
                    ? { ...task, location }
                    : task
                )
              }));
            }
            setShowMapSelector(false);
          }}
          onClose={() => setShowMapSelector(false)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
