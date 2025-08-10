import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import QRScanner from '../components/QRScanner';
import { API_ENDPOINTS } from '../config/api';

interface Player {
  id: string;
  name: string;
  role: string;
  status: string;
  team?: string;
  tasksCompleted?: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

interface Task {
  taskNumber: number;
  question: string;
  answer: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  qrCode: string;
  isCompleted: boolean;
  completedBy: Array<{
    player: string;
    completedAt: string;
  }>;
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
  tasks: Task[];
  extractionPoint: {
    latitude: number;
    longitude: number;
    address: string;
  };
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
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [timeExpiredNotified, setTimeExpiredNotified] = useState(false);
  const [showSafetyWarning, setShowSafetyWarning] = useState(true);
  const [showTaskMap, setShowTaskMap] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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
        
        // Get game by code - now includes ALL game data including startTime, status, tasks, etc.
        const gameResponse = await fetch(API_ENDPOINTS.GAME_BY_CODE(gameId));
        
        if (!gameResponse.ok) {
          if (gameResponse.status === 404) {
            console.warn('Game not found, may have been deleted or ended');
            setError('Game not found or has ended');
            return;
          }
          throw new Error(`Failed to fetch game: ${gameResponse.status}`);
        }
        
        const gameInfo = await gameResponse.json();
        const fullGameData = gameInfo.game;
        console.log('Complete game data fetched:', fullGameData);
        
        // Check if game status allows playing
        if (fullGameData.status === 'cancelled' || fullGameData.status === 'completed') {
          console.warn('Game is no longer playable:', fullGameData.status);
          setError(`Game has ${fullGameData.status === 'cancelled' ? 'been cancelled' : 'ended'}`);
          return;
        }
        
        // Then get players for this game (skip if unauthorized, it's not critical)
        try {
          const playersResponse = await fetch(API_ENDPOINTS.PLAYER_BY_GAME(fullGameData.id));
          
          if (playersResponse.ok) {
            const playersData = await playersResponse.json();
            setGameData({
              game: fullGameData,
              players: playersData.players,
              playersByRole: playersData.playersByRole,
              counts: playersData.counts
            });
          } else {
            // If we can't get players (auth required), just show game info
            setGameData({
              game: fullGameData,
              players: [],
              playersByRole: { fugitives: [], hunters: [], spectators: [] },
              counts: { total: 0, fugitives: 0, hunters: 0, spectators: 0, online: 0 }
            });
          }
        } catch (playersError) {
          console.warn('Could not fetch players data, continuing with game data only');
          setGameData({
            game: fullGameData,
            players: [],
            playersByRole: { fugitives: [], hunters: [], spectators: [] },
            counts: { total: 0, fugitives: 0, hunters: 0, spectators: 0, online: 0 }
          });
        }
        
        // Clear any previous errors
        setError('');
      } catch (err) {
        console.error('Error fetching game data:', err);
        
        // Don't immediately show error on network issues, keep trying
        if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
          console.warn('Network error, will retry on next interval');
          return;
        }
        
        setError('Failed to load game data');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchGameData();
    
    // Set up auto-refresh every 30 seconds to get real-time updates
    const refreshInterval = setInterval(fetchGameData, 30000);
    
    // Cleanup interval on unmount
    return () => clearInterval(refreshInterval);
  }, [gameId, gameData]);

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
        
        // Check if we need to notify about time expiration and end the game
        if (game.status === 'active' && !timeExpiredNotified) {
          setTimeExpiredNotified(true);
          
          // Show notification to player
          alert('⏰ TIME EXPIRED!\n\nThe game has ended. Time ran out before all missions could be completed.');
          
          // Call backend to end the game
          fetch(API_ENDPOINTS.GAME_END(game.id), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              reason: 'time_expired',
              endedBy: 'system'
            })
          })
          .then(response => response.json())
          .then(data => {
            console.log('Game ended due to time expiration:', data);
          })
          .catch(error => {
            console.error('Error ending game:', error);
          });
        }
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

    if (!gameData?.game || gameData.game.status !== 'active') {
      alert('QR scanning is only available during active games.');
      return;
    }

    setShowQRScanner(true);
  };

  const handleQRScanSuccess = async (decodedText: string, decodedResult: any) => {
    console.log('QR Code scanned:', decodedText);
    setShowQRScanner(false);

    if (!currentPlayer || !gameData?.game) {
      alert('Game data not available. Please refresh and try again.');
      return;
    }

    try {
      // Parse the input data
      let parsedData: any;
      
      try {
        parsedData = JSON.parse(decodedText);
      } catch (e) {
        alert('Invalid code format. Please scan a valid QR code or enter a valid manual code.');
        return;
      }

      // Handle manual code entry (6-digit codes from admin dashboard)
      if (parsedData.type === 'manual_code') {
        const manualCode = parsedData.code;
        
        // Find which task this manual code belongs to by matching the generated hash
        let matchingTask = null;
        let matchingTaskNumber = null;
        
        for (let taskNum = 1; taskNum <= 6; taskNum++) {
          // Generate the same secure hash as in the admin dashboard
          const salt = 'KLOPJACHT_SECURE_2024';
          const hashInput = `${salt}-${gameData.game.id}-TASK-${taskNum}-${salt}`;
          
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
          const combined = Math.abs(hash1 ^ hash2) * (taskNum * 7919); // 7919 is a prime
          const sixDigitCode = (combined % 900000) + 100000;
          
          if (sixDigitCode.toString() === manualCode) {
            matchingTaskNumber = taskNum;
            matchingTask = gameData.game.tasks?.find(t => t.taskNumber === taskNum);
            break;
          }
        }
        
        if (!matchingTask || !matchingTaskNumber) {
          alert('Invalid manual code. This code does not match any task in this game.');
          return;
        }
        
        // Check if player can access this task (sequential completion)
        const playerCompletedTasks = currentPlayer.tasksCompleted || 0;
        if (matchingTaskNumber !== playerCompletedTasks + 1) {
          if (matchingTaskNumber <= playerCompletedTasks) {
            alert(`You have already completed Task ${matchingTaskNumber}.`);
          } else {
            alert(`You must complete Task ${playerCompletedTasks + 1} first before accessing Task ${matchingTaskNumber}.`);
          }
          return;
        }
        
        // Show task question and get answer
        const userAnswer = prompt(`Task ${matchingTaskNumber}:\n\n${matchingTask.question}\n\nEnter your answer:`);
        
        if (userAnswer === null) {
          // User cancelled
          return;
        }

        if (!userAnswer.trim()) {
          alert('Please provide an answer.');
          return;
        }

        // Submit the task completion
        const response = await fetch(API_ENDPOINTS.PLAYER_COMPLETE_TASK(currentPlayer.id), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskNumber: matchingTaskNumber,
            answer: userAnswer.trim(),
            gameId: gameData.game.id
          })
        });

        const result = await response.json();

        if (response.ok) {
          if (result.correct) {
            alert(`🎉 Correct! Task ${matchingTaskNumber} completed successfully!\n\nTasks completed: ${result.tasksCompleted}/6`);
            
            // Update current player data
            setCurrentPlayer(prev => prev ? {
              ...prev,
              tasksCompleted: result.tasksCompleted
            } : null);
          } else {
            alert(`❌ Incorrect answer. Try again!\n\nHint: Make sure you're at the correct location and read the question carefully.`);
          }
        } else {
          alert(`Error: ${result.message || 'Failed to submit task completion'}`);
        }
        
        return;
      }

      // Handle regular QR code data
      const qrData: {
        gameId: string;
        taskNumber: number;
        question: string;
        taskId?: string;
        url?: string;
      } = parsedData;

      // Validate QR code structure
      if (!qrData.gameId || !qrData.taskNumber || !qrData.question) {
        alert('Invalid QR code. This QR code is not for a game task.');
        return;
      }

      // Check if QR code is for this game
      if (qrData.gameId !== gameData.game.id) {
        alert('This QR code is for a different game.');
        return;
      }

      // Find the task
      const task = gameData.game.tasks?.find(t => t.taskNumber === qrData.taskNumber);
      if (!task) {
        alert(`Task ${qrData.taskNumber} not found in this game.`);
        return;
      }

      // Check if player can access this task (sequential completion)
      const playerCompletedTasks = currentPlayer.tasksCompleted || 0;
      if (qrData.taskNumber !== playerCompletedTasks + 1) {
        if (qrData.taskNumber <= playerCompletedTasks) {
          alert(`You have already completed Task ${qrData.taskNumber}.`);
        } else {
          alert(`You must complete Task ${playerCompletedTasks + 1} first before accessing Task ${qrData.taskNumber}.`);
        }
        return;
      }

      // Show task question and get answer
      const userAnswer = prompt(`Task ${qrData.taskNumber}:\n\n${qrData.question}\n\nEnter your answer:`);
      
      if (userAnswer === null) {
        // User cancelled
        return;
      }

      if (!userAnswer.trim()) {
        alert('Please provide an answer.');
        return;
      }

      // Submit the task completion
      const response = await fetch(API_ENDPOINTS.PLAYER_COMPLETE_TASK(currentPlayer.id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskNumber: qrData.taskNumber,
          answer: userAnswer.trim(),
          gameId: gameData.game.id
        })
      });

      const result = await response.json();

      if (response.ok) {
        if (result.correct) {
          alert(`🎉 Correct! Task ${qrData.taskNumber} completed successfully!\n\nTasks completed: ${result.tasksCompleted}/6`);
          
          // Update current player data
          setCurrentPlayer(prev => prev ? {
            ...prev,
            tasksCompleted: result.tasksCompleted
          } : null);

          // Refresh game data to show updated progress
          // The useEffect will handle this automatically with the next refresh cycle
        } else {
          alert(`❌ Incorrect answer. Try again!\n\nHint: Make sure you're at the correct location and read the question carefully.`);
        }
      } else {
        alert(`Error: ${result.message || 'Failed to submit task completion'}`);
      }

    } catch (error) {
      console.error('Error processing QR scan:', error);
      alert('Failed to process QR code. Please try again.');
    }
  };

  const handleQRScanFailure = (error: string) => {
    // Don't show errors for normal scanning failures
    console.log('QR scan failure:', error);
  };

  const handleCloseQRScanner = () => {
    setShowQRScanner(false);
  };

  const handleViewMap = () => {
    alert('Map view would show:\n- Your current location\n- Task locations (if unlocked)\n- Other players (for hunters)\n- Extraction point (when all tasks completed)');
  };

  const handleViewTaskMap = (task: Task) => {
    setSelectedTask(task);
    setShowTaskMap(true);
  };

  const handleCloseTaskMap = () => {
    setShowTaskMap(false);
    setSelectedTask(null);
  };

  const handleUpdateLocation = () => {
    if (!currentPlayer) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          // Update location on server
          fetch(API_ENDPOINTS.PLAYER_UPDATE_LOCATION(currentPlayer.id), {
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

  // Calculate player's completed tasks
  const playerCompletedTasks = currentPlayer?.tasksCompleted || 0;
  const completedTasksList = game.tasks?.filter(task => 
    task.completedBy?.some(completion => completion.player === currentPlayer?.id)
  ) || [];

  // Get time remaining for big countdown
  const getTimeRemainingData = () => {
    if (!game.startTime || game.status !== 'active') {
      return { hours: 0, minutes: 0, seconds: 0, isActive: false, remaining: 0 };
    }

    const startTime = new Date(game.startTime);
    const gameDuration = game.duration * 60 * 1000;
    const now = new Date();
    const totalElapsed = now.getTime() - startTime.getTime();
    const remaining = Math.max(0, gameDuration - totalElapsed);

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    return { hours, minutes, seconds, isActive: true, remaining };
  };

  const timeData = getTimeRemainingData();

  // Show safety warning first
  if (showSafetyWarning) {
    return (
      <div className="App safety-warning-page">
        <div className="safety-warning-container">
          <div className="klopjacht-logo">
            <h1>🔍 KLOPJACHT</h1>
          </div>
          
          <div className="safety-warning-content">
            <div className="warning-icon">⚠️</div>
            <div className="warning-text">
              <p>Gelieve tijdens dit spel ALLE verkeersregels in acht te nemen.</p>
              <p>Breng uzelf en anderen niet in gevaar.</p>
            </div>
          </div>
          
          <button 
            className="safety-acknowledge-btn"
            onClick={() => setShowSafetyWarning(false)}
          >
            BEGREPEN
          </button>
        </div>
        
        <style>{`
          .safety-warning-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 2rem;
          }
          
          .safety-warning-container {
            background: white;
            border-radius: 20px;
            padding: 3rem;
            max-width: 500px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.5s ease-out;
          }
          
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-50px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .klopjacht-logo h1 {
            font-size: 3rem;
            color: #333;
            margin: 0 0 2rem 0;
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
          }
          
          .safety-warning-content {
            margin: 2rem 0;
          }
          
          .warning-icon {
            font-size: 4rem;
            margin-bottom: 1.5rem;
            animation: pulse 2s infinite;
          }
          
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.1);
            }
          }
          
          .warning-text {
            color: #333;
            font-size: 1.2rem;
            line-height: 1.6;
            font-weight: 500;
            margin-bottom: 2rem;
          }
          
          .warning-text p {
            margin: 0.5rem 0;
          }
          
          .safety-acknowledge-btn {
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            border: none;
            padding: 1rem 3rem;
            font-size: 1.3rem;
            font-weight: bold;
            border-radius: 50px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .safety-acknowledge-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
            background: linear-gradient(135deg, #218838, #1e7e34);
          }
          
          .safety-acknowledge-btn:active {
            transform: translateY(0);
          }
          
          @media (max-width: 600px) {
            .safety-warning-container {
              padding: 2rem;
              margin: 1rem;
            }
            
            .klopjacht-logo h1 {
              font-size: 2.5rem;
            }
            
            .warning-text {
              font-size: 1.1rem;
            }
            
            .safety-acknowledge-btn {
              padding: 0.8rem 2rem;
              font-size: 1.1rem;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="App fugitive-game-page">
      {/* Big Countdown Timer */}
      <div className="countdown-header">
        <div className="game-title">
          <h1>🔍 {game.name}</h1>
          <div className="game-code">#{game.gameCode}</div>
        </div>
        
        {timeData.isActive ? (
          <div className={`countdown-timer ${timeData.remaining < 300000 ? 'critical' : timeData.remaining < 900000 ? 'warning' : ''}`}>
            <div className="countdown-display">
              <div className="time-unit">
                <div className="time-number">{timeData.hours.toString().padStart(2, '0')}</div>
                <div className="time-label">HOURS</div>
              </div>
              <div className="time-separator">:</div>
              <div className="time-unit">
                <div className="time-number">{timeData.minutes.toString().padStart(2, '0')}</div>
                <div className="time-label">MINUTES</div>
              </div>
              <div className="time-separator">:</div>
              <div className="time-unit">
                <div className="time-number">{timeData.seconds.toString().padStart(2, '0')}</div>
                <div className="time-label">SECONDS</div>
              </div>
            </div>
            <div className="countdown-status">
              {timeData.remaining < 300000 ? '🚨 CRITICAL TIME!' : 
               timeData.remaining < 900000 ? '⚠️ TIME RUNNING OUT!' : 
               '⏱️ TIME REMAINING'}
            </div>
          </div>
        ) : (
          <div className="countdown-timer waiting">
            <div className="countdown-display">
              <div className="waiting-message">
                {game.status === 'waiting' ? '⏳ WAITING TO START' :
                 game.status === 'paused' ? '⏸️ GAME PAUSED' :
                 game.status === 'completed' ? '🏁 GAME COMPLETED' :
                 '⏸️ NOT STARTED'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Player Info Bar */}
      {currentPlayer && (
        <div className="player-info-bar">
          <div className="player-details">
            <div className="player-name">👤 {currentPlayer.name}</div>
            <div className="player-role">{currentPlayer.role.toUpperCase()}</div>
            {currentPlayer.team && <div className="player-team">Team: {currentPlayer.team}</div>}
          </div>
          <div className="player-progress">
            <div className="tasks-completed">{playerCompletedTasks}/6 TASKS</div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(playerCompletedTasks / 6) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Mission Progress */}
      <div className="mission-section">
        <h2 className="section-title">🎯 MISSION PROGRESS</h2>
        <div className="missions-grid">
          {Array.from({ length: 6 }, (_, index) => {
            const taskNumber = index + 1;
            const task = game.tasks?.find(t => t.taskNumber === taskNumber);
            const isCompleted = completedTasksList.some(t => t.taskNumber === taskNumber);
            const isCurrent = !isCompleted && taskNumber === playerCompletedTasks + 1;
            const isLocked = taskNumber > playerCompletedTasks + 1;

            return (
              <div 
                key={taskNumber} 
                className={`mission-card ${isCompleted ? 'completed' : isCurrent ? 'current' : isLocked ? 'locked' : 'available'}`}
              >
                <div className="mission-header">
                  <div className="mission-number">
                    {isCompleted ? '✅' : isCurrent ? '🎯' : isLocked ? '🔒' : taskNumber}
                  </div>
                  <div className="mission-title">MISSION {taskNumber}</div>
                </div>
                
                <div className="mission-content">
                  {isCompleted ? (
                    <div className="mission-completed">
                      <div className="completion-status">✅ COMPLETED</div>
                      <div className="completion-time">
                        {completedTasksList.find(t => t.taskNumber === taskNumber)?.completedBy
                          ?.find(c => c.player === currentPlayer?.id)?.completedAt 
                          ? new Date(completedTasksList.find(t => t.taskNumber === taskNumber)?.completedBy
                              ?.find(c => c.player === currentPlayer?.id)?.completedAt || '').toLocaleTimeString()
                          : 'Completed'}
                      </div>
                    </div>
                  ) : isCurrent ? (
                    <div className="mission-active">
                      <div className="mission-status">🎯 ACTIVE MISSION</div>
                      <div className="mission-instruction">Find the location and scan QR code</div>
                    </div>
                  ) : isLocked ? (
                    <div className="mission-locked">
                      <div className="lock-status">🔒 LOCKED</div>
                      <div className="unlock-requirement">Complete previous missions</div>
                    </div>
                  ) : (
                    <div className="mission-available">
                      <div className="mission-status">⏳ AVAILABLE</div>
                    </div>
                  )}
                </div>

                {task && (isCurrent || isCompleted) && (
                  <div className="mission-location">
                    <div className="location-coordinates">
                      📍 {task.location.latitude.toFixed(4)}, {task.location.longitude.toFixed(4)}
                    </div>
                    <button 
                      className="view-map-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewTaskMap(task);
                      }}
                    >
                      🗺️ View On Map
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mission History */}
      {completedTasksList.length > 0 && (
        <div className="history-section">
          <h2 className="section-title">📜 MISSION HISTORY</h2>
          <div className="history-list">
            {completedTasksList
              .sort((a, b) => a.taskNumber - b.taskNumber)
              .map(task => {
                const completion = task.completedBy?.find(c => c.player === currentPlayer?.id);
                return (
                  <div key={task.taskNumber} className="history-item">
                    <div className="history-header">
                      <div className="history-mission">✅ MISSION {task.taskNumber}</div>
                      <div className="history-time">
                        {completion?.completedAt 
                          ? new Date(completion.completedAt).toLocaleString()
                          : 'Completed'}
                      </div>
                    </div>
                    <div className="history-location">
                      📍 {task.location.address}
                    </div>
                    <div className="history-question">
                      ❓ {task.question}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="game-actions">
        {currentPlayer?.role === 'fugitive' && (
          <button className="action-btn primary" onClick={handleScanQR}>
            📱 SCAN QR CODE
          </button>
        )}
        
        <button className="action-btn secondary" onClick={handleViewMap}>
          🗺️ VIEW MAP
        </button>
        
        <button className="action-btn danger" onClick={handleBack}>
          🚪 LEAVE GAME
        </button>
      </div>

      {/* Status Messages */}
      {game.status === 'waiting' && (
        <div className="status-message waiting">
          <div className="status-icon">⏳</div>
          <div className="status-text">
            <strong>WAITING FOR GAME TO START</strong>
            <br />
            The game master will start the game when ready.
          </div>
        </div>
      )}

      {game.status === 'paused' && (
        <div className="status-message paused">
          <div className="status-icon">⏸️</div>
          <div className="status-text">
            <strong>GAME PAUSED</strong>
            <br />
            The game has been temporarily paused by the game master.
          </div>
        </div>
      )}

      {playerCompletedTasks === 6 && game.status === 'active' && (
        <div className="status-message success">
          <div className="status-icon">🎉</div>
          <div className="status-text">
            <strong>ALL MISSIONS COMPLETED!</strong>
            <br />
            Head to the extraction point: {game.extractionPoint?.address}
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScanner
          onScanSuccess={handleQRScanSuccess}
          onScanFailure={handleQRScanFailure}
          onClose={handleCloseQRScanner}
        />
      )}

      {/* Task Map Modal */}
      {showTaskMap && selectedTask && (
        <div className="task-map-modal">
          <div className="task-map-overlay" onClick={handleCloseTaskMap}></div>
          <div className="task-map-content">
            <div className="task-map-header">
              <h3>🗺️ Mission {selectedTask.taskNumber} Location</h3>
              <button className="close-map-btn" onClick={handleCloseTaskMap}>
                ✕
              </button>
            </div>
            <div className="task-map-body">
              <div className="task-location-info">
                <div className="location-coordinates">
                  <strong>📍 Coordinates:</strong><br/>
                  {selectedTask.location.latitude.toFixed(6)}, {selectedTask.location.longitude.toFixed(6)}
                </div>
                <div className="location-address">
                  <strong>📍 Address:</strong><br/>
                  {selectedTask.location.address}
                </div>
              </div>
              <div className="map-placeholder">
                <div className="map-icon">🗺️</div>
                <div className="map-text">
                  <strong>Interactive Map</strong><br/>
                  Use your device's map app to navigate to:<br/>
                  <code>{selectedTask.location.latitude.toFixed(6)}, {selectedTask.location.longitude.toFixed(6)}</code>
                </div>
                <div className="map-actions">
                  <button 
                    className="open-maps-btn"
                    onClick={() => {
                      const lat = selectedTask.location.latitude;
                      const lng = selectedTask.location.longitude;
                      const url = `https://www.google.com/maps?q=${lat},${lng}`;
                      window.open(url, '_blank');
                    }}
                  >
                    📱 Open in Google Maps
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .mission-location {
          margin-top: 0.5rem;
          padding: 0.5rem;
          background: #f8f9fa;
          border-radius: 6px;
          border: 1px solid #dee2e6;
        }

        .location-coordinates {
          font-family: monospace;
          font-size: 0.9rem;
          color: #495057;
          margin-bottom: 0.5rem;
        }

        .view-map-btn {
          background: #007bff;
          color: white;
          border: none;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .view-map-btn:hover {
          background: #0056b3;
        }

        .task-map-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        }

        .task-map-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
        }

        .task-map-content {
          position: relative;
          background: white;
          border-radius: 12px;
          max-width: 500px;
          width: 100%;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-50px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .task-map-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: #007bff;
          color: white;
        }

        .task-map-header h3 {
          margin: 0;
          font-size: 1.2rem;
        }

        .close-map-btn {
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .close-map-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .task-map-body {
          padding: 1.5rem;
        }

        .task-location-info {
          margin-bottom: 1.5rem;
        }

        .location-coordinates,
        .location-address {
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: #f8f9fa;
          border-radius: 6px;
          border-left: 4px solid #007bff;
        }

        .location-coordinates strong,
        .location-address strong {
          color: #007bff;
        }

        .map-placeholder {
          text-align: center;
          padding: 2rem;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 8px;
          border: 2px dashed #dee2e6;
        }

        .map-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .map-text {
          color: #495057;
          margin-bottom: 1.5rem;
          line-height: 1.5;
        }

        .map-text code {
          background: #e9ecef;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-family: monospace;
          color: #007bff;
          font-weight: bold;
        }

        .open-maps-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-size: 1rem;
          cursor: pointer;
          transition: background-color 0.2s;
          font-weight: bold;
        }

        .open-maps-btn:hover {
          background: #218838;
        }

        @media (max-width: 600px) {
          .task-map-content {
            margin: 0.5rem;
            max-width: none;
          }
          
          .task-map-body {
            padding: 1rem;
          }
          
          .map-placeholder {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
};

export default GamePage;
