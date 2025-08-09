import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

interface Player {
  id: string;
  name: string;
  role: string;
  status: string;
  team?: string;
}

interface Game {
  id: string;
  name: string;
  gameCode: string;
  status: string;
  startTime?: string;
  endTime?: string;
  pausedAt?: string;
  duration: number;
  settings?: {
    maxPlayers: number;
  };
}

interface GameData {
  game: Game;
  players: Player[];
  playersByRole: {
    fugitives: Player[];
    hunters: Player[];
    spectators: Player[];
  };
  counts: {
    total: number;
    fugitives: number;
    hunters: number;
    spectators: number;
    online: number;
  };
}

const GamePage = () => {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const location = useLocation();
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');

  // Get player info from localStorage or location state
  useEffect(() => {
    const playerId = localStorage.getItem('playerId');
    const playerName = localStorage.getItem('playerName');
    const playerRole = localStorage.getItem('playerRole');
    
    if (location.state?.player) {
      setCurrentPlayer(location.state.player);
    } else if (playerId && playerName && playerRole) {
      setCurrentPlayer({
        id: playerId,
        name: playerName,
        role: playerRole,
        status: 'active'
      });
    }
  }, [location.state]);

  // Fetch game data with auto-refresh
  useEffect(() => {
    const fetchGameData = async () => {
      if (!gameId) return;

      try {
        // Don't show loading on refresh, only on initial load
        if (!gameData) {
          setLoading(true);
        }
        
        // First try to get game by code
        const gameResponse = await fetch(`http://localhost:5000/api/games/code/${gameId}`);
        
        if (!gameResponse.ok) {
          throw new Error('Game not found');
        }
        
        const gameInfo = await gameResponse.json();
        
        // Then get players for this game
        const playersResponse = await fetch(`http://localhost:5000/api/players/game/${gameInfo.game.id}`);
        
        if (playersResponse.ok) {
          const playersData = await playersResponse.json();
          setGameData({
            game: gameInfo.game,
            players: playersData.players,
            playersByRole: playersData.playersByRole,
            counts: playersData.counts
          });
        } else {
          // If we can't get players (auth required), just show game info
          setGameData({
            game: gameInfo.game,
            players: [],
            playersByRole: { fugitives: [], hunters: [], spectators: [] },
            counts: { total: 0, fugitives: 0, hunters: 0, spectators: 0, online: 0 }
          });
        }
        
        // Clear any previous errors
        setError('');
      } catch (err) {
        console.error('Error fetching game data:', err);
        setError('Failed to load game data');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchGameData();
    
    // Set up auto-refresh every 15 seconds to get real-time updates (reduced frequency to avoid rate limiting)
    const refreshInterval = setInterval(fetchGameData, 15000);
    
    // Cleanup interval on unmount
    return () => clearInterval(refreshInterval);
  }, [gameId]);

  // Calculate time remaining
  useEffect(() => {
    if (!gameData?.game) return;

    const updateTimeRemaining = () => {
      const game = gameData.game;
      
      if (game.status === 'waiting' || game.status === 'setup') {
        setTimeRemaining('⏳ Waiting to start');
        return;
      }
      
      if (game.status === 'completed') {
        setTimeRemaining('🏁 Game completed');
        return;
      }
      
      if (game.status === 'cancelled') {
        setTimeRemaining('❌ Game cancelled');
        return;
      }
      
      if (game.status === 'paused') {
        // When paused, show the time remaining at the moment of pause
        if (!game.startTime) {
          setTimeRemaining('⏸️ Paused - Not started');
          return;
        }
        
        const startTime = new Date(game.startTime);
        const pausedAt = game.pausedAt ? new Date(game.pausedAt) : new Date();
        const gameDuration = game.duration * 60 * 1000; // Convert to milliseconds
        const timeElapsedBeforePause = pausedAt.getTime() - startTime.getTime();
        const remaining = gameDuration - timeElapsedBeforePause;
        
        if (remaining <= 0) {
          setTimeRemaining('⏸️ Paused - Time expired');
          return;
        }
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        setTimeRemaining(`⏸️ PAUSED - ${timeString} remaining`);
        return;
      }
      
      if (!game.startTime) {
        setTimeRemaining('⏸️ Not started');
        return;
      }

      const startTime = new Date(game.startTime);
      const gameDuration = game.duration * 60 * 1000; // Convert to milliseconds
      const now = new Date();
      
      // Calculate total elapsed time
      const totalElapsed = now.getTime() - startTime.getTime();
      const remaining = gameDuration - totalElapsed;
      
      if (remaining <= 0) {
        setTimeRemaining('⏰ Time expired');
        return;
      }
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
      
      // Format with leading zeros and add visual indicators
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      // Add urgency indicators
      if (remaining < 5 * 60 * 1000) { // Less than 5 minutes
        setTimeRemaining(`🚨 ${timeString} - HURRY!`);
      } else if (remaining < 15 * 60 * 1000) { // Less than 15 minutes
        setTimeRemaining(`⚠️ ${timeString} - Time running out!`);
      } else {
        setTimeRemaining(`⏱️ ${timeString}`);
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    
    return () => clearInterval(interval);
  }, [gameData]);

  const handleBack = () => {
    // Clear player data from localStorage
    localStorage.removeItem('playerId');
    localStorage.removeItem('playerName');
    localStorage.removeItem('playerRole');
    localStorage.removeItem('gameCode');
    localStorage.removeItem('gameId');
    navigate('/');
  };

  const handleScanQR = () => {
    if (!currentPlayer) {
      alert('Player information not found. Please rejoin the game.');
      return;
    }

    // Check if player has camera permission
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => {
          // Camera access granted - in a real implementation, this would open QR scanner
          alert(`QR Scanner activated for ${currentPlayer.name}!\n\nRole: ${currentPlayer.role}\n\nThis would open the camera to scan QR codes at task locations.`);
        })
        .catch(() => {
          alert('Camera access is required to scan QR codes. Please enable camera permissions and try again.');
        });
    } else {
      alert('Camera not available on this device.');
    }
  };

  const handleViewMap = () => {
    alert('Map view would show:\n- Your current location\n- Task locations (if unlocked)\n- Other players (for hunters)\n- Extraction point (when all tasks completed)');
  };

  const handleUpdateLocation = () => {
    if (!currentPlayer) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          // Update location on server
          fetch(`http://localhost:5000/api/players/${currentPlayer.id}/location`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              latitude,
              longitude,
              accuracy,
              trigger: 'manual'
            })
          })
          .then(response => response.json())
          .then(data => {
            if (data.message) {
              alert(`Location updated successfully!\nLat: ${latitude.toFixed(6)}\nLng: ${longitude.toFixed(6)}`);
            }
          })
          .catch(error => {
            console.error('Error updating location:', error);
            alert('Failed to update location');
          });
        },
        (error) => {
          alert('Location access denied. Please enable location permissions to update your position.');
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  };

  if (loading) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>🔍 Loading Game...</h1>
        </header>
      </div>
    );
  }

  if (error || !gameData) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>🔍 Game Error</h1>
          <p>{error || 'Game not found'}</p>
          <button className="btn btn-secondary" onClick={handleBack}>
            Back to Home
          </button>
        </header>
      </div>
    );
  }

  const { game, counts } = gameData;

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔍 {game.name}</h1>
        <p>Game Code: <strong>{game.gameCode}</strong></p>
        
        <div className="game-features">
          <div className="feature">
            <h3>Game Status</h3>
            <ul>
              <li>Status: {game.status.charAt(0).toUpperCase() + game.status.slice(1)}</li>
              <li>Players: {counts.total}/{game.settings?.maxPlayers || 'N/A'}</li>
              <li>Time: {timeRemaining}</li>
              <li>Online: {counts.online}</li>
            </ul>
          </div>
          
          {currentPlayer && (
            <div className="feature">
              <h3>Your Info</h3>
              <ul>
                <li>Name: {currentPlayer.name}</li>
                <li>Role: {currentPlayer.role.charAt(0).toUpperCase() + currentPlayer.role.slice(1)}</li>
                <li>Status: {currentPlayer.status.charAt(0).toUpperCase() + currentPlayer.status.slice(1)}</li>
                {currentPlayer.team && <li>Team: {currentPlayer.team}</li>}
              </ul>
            </div>
          )}
          
          <div className="feature">
            <h3>Player Count</h3>
            <ul>
              <li>Fugitives: {counts.fugitives}</li>
              <li>Hunters: {counts.hunters}</li>
              <li>Spectators: {counts.spectators}</li>
            </ul>
          </div>
        </div>
        
        <div className="actions">
          {currentPlayer?.role === 'fugitive' && (
            <button className="btn btn-primary" onClick={handleScanQR}>
              📱 Scan QR Code
            </button>
          )}
          
          <button className="btn btn-info" onClick={handleViewMap}>
            🗺️ View Map
          </button>
          
          <button className="btn btn-warning" onClick={handleUpdateLocation}>
            📍 Update Location
          </button>
          
          <button className="btn btn-secondary" onClick={handleBack}>
            🚪 Leave Game
          </button>
        </div>
        
        {game.status === 'waiting' && (
          <div style={{ 
            marginTop: '2rem', 
            padding: '1rem', 
            backgroundColor: '#ffa500', 
            color: '#000', 
            borderRadius: '0.5rem' 
          }}>
            <strong>⏳ Waiting for game to start...</strong>
            <br />
            The game master will start the game when ready.
          </div>
        )}
      </header>
    </div>
  );
};

export default GamePage;
