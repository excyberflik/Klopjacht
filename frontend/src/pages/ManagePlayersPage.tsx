import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface PredefinedPlayer {
  _id: string;
  name: string;
  role: string;
  team?: string;
  isJoined: boolean;
  playerId?: string;
  createdAt: string;
}

interface Game {
  _id: string;
  name: string;
  gameCode: string;
  status: string;
  predefinedPlayers: PredefinedPlayer[];
}

const ManagePlayersPage = () => {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlayers, setNewPlayers] = useState([{ name: '', role: 'fugitive', team: '', password: '' }]);

  useEffect(() => {
    fetchGame();
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/games/${gameId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setGame(data.game);
      } else {
        setError('Failed to load game');
      }
    } catch (error) {
      console.error('Error fetching game:', error);
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPredefinedPlayers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/games/${gameId}/predefined-players`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setGame(prev => prev ? { ...prev, predefinedPlayers: data.predefinedPlayers } : null);
      }
    } catch (error) {
      console.error('Error fetching predefined players:', error);
    }
  };

  const handleAddPlayers = async () => {
    try {
      const token = localStorage.getItem('token');
      const validPlayers = newPlayers.filter(p => p.name.trim());
      
      if (validPlayers.length === 0) {
        setError('Please add at least one player with a name');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/games/${gameId}/predefined-players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          players: validPlayers.map(p => ({
            name: p.name.trim(),
            role: p.role,
            team: p.team.trim() || undefined,
            password: p.password.trim()
          }))
        })
      });

      const data = await response.json();

      if (response.ok) {
        setGame(prev => prev ? { ...prev, predefinedPlayers: data.predefinedPlayers } : null);
        setNewPlayers([{ name: '', role: 'fugitive', team: '', password: '' }]);
        setShowAddForm(false);
        setError('');
      } else {
        setError(data.error || 'Failed to add players');
      }
    } catch (error) {
      console.error('Error adding players:', error);
      setError('Network error');
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!window.confirm('Are you sure you want to remove this player?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/games/${gameId}/predefined-players/${playerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchPredefinedPlayers();
        setError('');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to remove player');
      }
    } catch (error) {
      console.error('Error removing player:', error);
      setError('Network error');
    }
  };

  const addNewPlayerRow = () => {
    setNewPlayers([...newPlayers, { name: '', role: 'fugitive', team: '', password: '' }]);
  };

  const removePlayerRow = (index: number) => {
    setNewPlayers(newPlayers.filter((_, i) => i !== index));
  };

  const updateNewPlayer = (index: number, field: string, value: string) => {
    const updated = [...newPlayers];
    updated[index] = { ...updated[index], [field]: value };
    setNewPlayers(updated);
  };

  if (loading) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Loading...</h1>
        </header>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Game not found</h1>
          <button onClick={() => navigate('/admin')} className="btn btn-primary">
            Back to Dashboard
          </button>
        </header>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>🎮 Manage Players</h1>
        <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            backgroundColor: '#2A2A2A', 
            borderRadius: '0.5rem',
            textAlign: 'left'
          }}>
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#4CAF50' }}>{game.name}</h2>
            <p style={{ margin: '0', color: '#CCC' }}>
              Game Code: <strong>{game.gameCode}</strong> | Status: <strong>{game.status}</strong>
            </p>
          </div>

          {error && (
            <div style={{ 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              backgroundColor: '#ff4444', 
              color: '#ffffff', 
              borderRadius: '0.5rem',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Predefined Players ({game.predefinedPlayers?.length || 0})</h3>
              {game.status !== 'active' && (
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="btn btn-primary"
                  style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                >
                  {showAddForm ? 'Cancel' : 'Add Players'}
                </button>
              )}
            </div>

            {showAddForm && (
              <div style={{ 
                marginBottom: '2rem', 
                padding: '1rem', 
                backgroundColor: '#2A2A2A', 
                borderRadius: '0.5rem',
                border: '1px solid #444'
              }}>
                <h4 style={{ margin: '0 0 1rem 0' }}>Add New Players</h4>
                {newPlayers.map((player, index) => (
                  <div key={index} style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '2fr 1fr 1fr 1fr auto', 
                    gap: '0.5rem', 
                    marginBottom: '0.5rem',
                    alignItems: 'end'
                  }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                        Name:
                      </label>
                      <input
                        type="text"
                        value={player.name}
                        onChange={(e) => updateNewPlayer(index, 'name', e.target.value)}
                        placeholder="Player name"
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          fontSize: '0.9rem',
                          borderRadius: '0.25rem',
                          border: '1px solid #333',
                          backgroundColor: '#1A1A1A',
                          color: '#FFFFFF'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                        Role:
                      </label>
                      <select
                        value={player.role}
                        onChange={(e) => updateNewPlayer(index, 'role', e.target.value)}
                        title="Select player role"
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          fontSize: '0.9rem',
                          borderRadius: '0.25rem',
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
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                        Team:
                      </label>
                      <input
                        type="text"
                        value={player.team}
                        onChange={(e) => updateNewPlayer(index, 'team', e.target.value)}
                        placeholder="Team (optional)"
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          fontSize: '0.9rem',
                          borderRadius: '0.25rem',
                          border: '1px solid #333',
                          backgroundColor: '#1A1A1A',
                          color: '#FFFFFF'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                        Password:
                      </label>
                      <input
                        type="text"
                        value={player.password}
                        onChange={(e) => updateNewPlayer(index, 'password', e.target.value)}
                        placeholder="Player password"
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          fontSize: '0.9rem',
                          borderRadius: '0.25rem',
                          border: '1px solid #333',
                          backgroundColor: '#1A1A1A',
                          color: '#FFFFFF'
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePlayerRow(index)}
                      disabled={newPlayers.length === 1}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.25rem',
                        cursor: newPlayers.length === 1 ? 'not-allowed' : 'pointer',
                        opacity: newPlayers.length === 1 ? 0.5 : 1
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={addNewPlayerRow}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                  >
                    Add Another Player
                  </button>
                  <button
                    type="button"
                    onClick={handleAddPlayers}
                    className="btn btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                  >
                    Save Players
                  </button>
                </div>
              </div>
            )}

            {game.predefinedPlayers && game.predefinedPlayers.length > 0 ? (
              <div style={{ 
                backgroundColor: '#2A2A2A', 
                borderRadius: '0.5rem',
                overflow: 'hidden'
              }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '2fr 1fr 1fr 1fr auto', 
                  gap: '1rem',
                  padding: '1rem',
                  backgroundColor: '#333',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  <div>Name</div>
                  <div>Role</div>
                  <div>Team</div>
                  <div>Status</div>
                  <div>Actions</div>
                </div>
                {game.predefinedPlayers.map((player) => (
                  <div key={player._id} style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '2fr 1fr 1fr 1fr auto', 
                    gap: '1rem',
                    padding: '1rem',
                    borderTop: '1px solid #444',
                    alignItems: 'center'
                  }}>
                    <div style={{ fontWeight: 'bold' }}>{player.name}</div>
                    <div style={{ 
                      color: player.role === 'fugitive' ? '#ff6b6b' : 
                            player.role === 'hunter' ? '#4ecdc4' : '#95a5a6'
                    }}>
                      {player.role}
                    </div>
                    <div style={{ color: '#CCC' }}>{player.team || '-'}</div>
                    <div>
                      <span style={{ 
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.8rem',
                        backgroundColor: player.isJoined ? '#4CAF50' : '#666',
                        color: 'white'
                      }}>
                        {player.isJoined ? 'Joined' : 'Available'}
                      </span>
                    </div>
                    <div>
                      {!player.isJoined && game.status !== 'active' && (
                        <button
                          onClick={() => handleRemovePlayer(player._id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#ff4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ 
                padding: '2rem', 
                textAlign: 'center', 
                backgroundColor: '#2A2A2A', 
                borderRadius: '0.5rem',
                color: '#CCC'
              }}>
                No predefined players yet. Click "Add Players" to create player slots.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button 
              onClick={() => navigate('/admin')} 
              className="btn btn-secondary"
            >
              Back to Dashboard
            </button>
            <button 
              onClick={() => navigate(`/admin?view=game-${game.gameCode}`)} 
              className="btn btn-primary"
            >
              View Game Details
            </button>
          </div>
        </div>
      </header>
    </div>
  );
};

export default ManagePlayersPage;
