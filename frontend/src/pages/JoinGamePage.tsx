import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../config/api';

interface PredefinedPlayer {
  id: string;
  name: string;
  role: string;
  team?: string;
}

interface GameInfo {
  id: string;
  name: string;
  description: string;
  status: string;
  gameCode: string;
  playerCount: number;
  maxPlayers: number;
  availablePlayers: PredefinedPlayer[];
  allPlayers: (PredefinedPlayer & { isJoined: boolean })[];
}

const JoinGamePage = () => {
  const navigate = useNavigate();
  const [gameCode, setGameCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
  const [selectedPredefinedPlayer, setSelectedPredefinedPlayer] = useState<string>('');
  const [password, setPassword] = useState('');

  // Fetch game info when game code is entered
  useEffect(() => {
    const fetchGameInfo = async () => {
      if (gameCode.length === 6) {
        try {
          const response = await fetch(API_ENDPOINTS.GAME_BY_CODE(gameCode.toUpperCase()));
          if (response.ok) {
            const data = await response.json();
            setGameInfo(data.game);
            setError('');
          } else {
            setGameInfo(null);
            setError('Game not found. Please check the code and try again.');
          }
        } catch (error) {
          console.error('Error fetching game info:', error);
          setGameInfo(null);
          setError('Network error. Please check your connection.');
        }
      } else {
        setGameInfo(null);
        setSelectedPredefinedPlayer('');
        setError('');
      }
    };

    fetchGameInfo();
  }, [gameCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gameCode || !selectedPredefinedPlayer) {
      setError('Please enter a game code and select your player name');
      return;
    }

    if (!gameInfo) {
      setError('Please enter a valid game code first');
      return;
    }

    if (!gameInfo.allPlayers || gameInfo.allPlayers.length === 0) {
      setError('No player slots found for this game. Please contact the game lead.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const selectedPlayer = gameInfo.allPlayers.find(p => p.id === selectedPredefinedPlayer);
      if (!selectedPlayer) {
        setError('Selected player slot is no longer available');
        setLoading(false);
        return;
      }

      const requestBody = {
        gameCode: gameCode.toUpperCase(),
        predefinedPlayerId: selectedPredefinedPlayer,
        name: selectedPlayer.name,
        role: selectedPlayer.role,
        team: selectedPlayer.team,
        password: password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      };

      console.log('Attempting to join game:', requestBody);
      
      const response = await fetch(API_ENDPOINTS.PLAYER_JOIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('Join game response:', data);

      if (response.ok) {
        // Store player info in localStorage for the game session
        localStorage.setItem('playerId', data.player.id);
        localStorage.setItem('playerName', data.player.name);
        localStorage.setItem('playerRole', data.player.role);
        localStorage.setItem('gameCode', data.game.gameCode);
        localStorage.setItem('gameId', data.game.id);
        
        const teamInfo = data.player.team ? `\nTeam: ${data.player.team}` : '';
        alert(`Successfully joined game "${data.game.name}"!\n\nPlayer: ${data.player.name}\nRole: ${data.player.role}${teamInfo}\nStatus: ${data.player.status}\n\nGame Code: ${data.game.gameCode}`);
        
        // Navigate to the game page
        navigate(`/game/${data.game.gameCode}`, { 
          state: { 
            player: data.player, 
            game: data.game 
          } 
        });
      } else {
        // Handle specific error cases
        if (data.code === 'GAME_NOT_FOUND') {
          setError(`Game with code "${gameCode}" not found. Please check the code and try again.`);
        } else if (data.code === 'GAME_FULL') {
          setError('This game is full. Please try joining a different game.');
        } else if (data.code === 'PLAYER_NAME_EXISTS') {
          setError('This player slot has already been taken by someone else.');
        } else if (data.code === 'GAME_CLOSED') {
          setError('This game is no longer accepting players.');
        } else if (data.code === 'PREDEFINED_PLAYER_NOT_FOUND') {
          setError('The selected player slot is no longer available.');
        } else if (data.code === 'PLAYER_SLOT_TAKEN') {
          setError('This player slot has already been taken by someone else.');
        } else {
          setError(data.error || data.message || 'Failed to join game. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error joining game:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔍 Join Game</h1>
        <p style={{ fontSize: '1rem', color: '#CCC', marginBottom: '2rem', maxWidth: '500px' }}>
          Enter the game code provided by your game lead and select your assigned player name.
        </p>
        
        <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
          {/* Game Code Input */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
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
                padding: '1rem',
                fontSize: '1.2rem',
                borderRadius: '0.5rem',
                border: '2px solid #333',
                backgroundColor: '#1A1A1A',
                color: '#FFFFFF',
                textAlign: 'center',
                letterSpacing: '0.2rem',
                fontWeight: 'bold'
              }}
            />
          </div>

          {/* Game Info Display */}
          {gameInfo && (
            <div style={{ 
              marginBottom: '1.5rem', 
              padding: '1rem', 
              backgroundColor: '#2A2A2A', 
              borderRadius: '0.5rem',
              border: '2px solid #4CAF50'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#4CAF50' }}>{gameInfo.name}</h3>
              {gameInfo.description && (
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#CCC' }}>
                  {gameInfo.description}
                </p>
              )}
              <p style={{ margin: '0', fontSize: '0.8rem', color: '#AAA' }}>
                Players: {gameInfo.playerCount}/{gameInfo.maxPlayers} | Status: {gameInfo.status}
              </p>
            </div>
          )}

          {/* Player Name Selection */}
          {gameInfo && gameInfo.allPlayers && gameInfo.allPlayers.length > 0 ? (
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                Select Your Name:
              </label>
              <select
                value={selectedPredefinedPlayer}
                onChange={(e) => setSelectedPredefinedPlayer(e.target.value)}
                title="Select your assigned player name"
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1rem',
                  borderRadius: '0.5rem',
                  border: '2px solid #333',
                  backgroundColor: '#1A1A1A',
                  color: '#FFFFFF'
                }}
              >
                <option value="">-- Select your assigned name --</option>
                {gameInfo.allPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} ({player.role}){player.team ? ` - Team: ${player.team}` : ''} {player.isJoined ? '- JOINED' : '- AVAILABLE'}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
                <p style={{ margin: '0.25rem 0' }}>
                  Available slots: {gameInfo.availablePlayers?.length || 0} | 
                  Already joined: {gameInfo.allPlayers.filter(p => p.isJoined).length}
                </p>
                <p style={{ margin: '0.25rem 0', color: '#4CAF50' }}>
                  ✓ You can rejoin even if you've already joined before
                </p>
              </div>
            </div>
          ) : gameInfo && gameInfo.allPlayers && gameInfo.allPlayers.length === 0 ? (
            <div style={{ 
              marginBottom: '2rem', 
              padding: '1rem', 
              backgroundColor: '#ff6600', 
              borderRadius: '0.5rem',
              textAlign: 'center'
            }}>
              <p style={{ margin: '0', color: '#ffffff', fontWeight: 'bold' }}>
                No predefined players found
              </p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#ffffff' }}>
                The game lead needs to create player slots first. Please contact them.
              </p>
            </div>
          ) : null}

          {/* Password Input - only show when a player is selected */}
          {selectedPredefinedPlayer && (
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold' }}>
                Password:
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your player password"
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1rem',
                  borderRadius: '0.5rem',
                  border: '2px solid #333',
                  backgroundColor: '#1A1A1A',
                  color: '#FFFFFF'
                }}
              />
              <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
                Password provided by your game lead for this player slot
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div style={{ 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              backgroundColor: '#ff4444', 
              color: '#ffffff', 
              borderRadius: '0.5rem',
              fontSize: '0.9rem',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={handleBack} disabled={loading}>
              Back to Home
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading || !gameCode || !selectedPredefinedPlayer}
              style={{
                opacity: (loading || !gameCode || !selectedPredefinedPlayer) ? 0.5 : 1
              }}
            >
              {loading ? 'Joining...' : 'Join Game'}
            </button>
          </div>
        </form>

        {/* Instructions */}
        <div style={{ 
          marginTop: '3rem', 
          padding: '1rem', 
          backgroundColor: '#2A2A2A', 
          borderRadius: '0.5rem',
          maxWidth: '500px',
          fontSize: '0.9rem',
          color: '#CCC'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#4CAF50' }}>How to Join:</h4>
          <ol style={{ margin: '0', paddingLeft: '1.5rem' }}>
            <li>Get the 6-character game code from your game lead</li>
            <li>Enter the code above to see available player slots</li>
            <li>Select your assigned name from the dropdown</li>
            <li>Click "Join Game" to enter the game</li>
          </ol>
          <p style={{ margin: '1rem 0 0 0', fontSize: '0.8rem', fontStyle: 'italic' }}>
            Note: All player names and roles are created by the game lead. You cannot create custom players.
          </p>
        </div>
      </header>
    </div>
  );
};

export default JoinGamePage;
