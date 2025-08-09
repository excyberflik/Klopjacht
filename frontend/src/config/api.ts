// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// API endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  
  // Game endpoints
  GAMES: `${API_BASE_URL}/api/games`,
  GAME_BY_CODE: (code: string) => `${API_BASE_URL}/api/games/code/${code}`,
  GAME_BY_ID: (id: string) => `${API_BASE_URL}/api/games/${id}`,
  GAME_START: (id: string) => `${API_BASE_URL}/api/games/${id}/start`,
  GAME_PAUSE: (id: string) => `${API_BASE_URL}/api/games/${id}/pause`,
  GAME_RESUME: (id: string) => `${API_BASE_URL}/api/games/${id}/resume`,
  GAME_END: (id: string) => `${API_BASE_URL}/api/games/${id}/end`,
  GAME_MESSAGE: (id: string) => `${API_BASE_URL}/api/games/${id}/message`,
  GAME_TASKS: (id: string) => `${API_BASE_URL}/api/games/${id}/tasks`,
  GAME_PREDEFINED_PLAYERS: (id: string) => `${API_BASE_URL}/api/games/${id}/predefined-players`,
  GAME_DELETE_PREDEFINED_PLAYER: (gameId: string, playerId: string) => 
    `${API_BASE_URL}/api/games/${gameId}/predefined-players/${playerId}`,
  
  // Player endpoints
  PLAYERS: `${API_BASE_URL}/api/players`,
  PLAYER_JOIN: `${API_BASE_URL}/api/players/join`,
  PLAYER_RESTORE: `${API_BASE_URL}/api/players/restore-session`,
  PLAYER_BY_GAME: (gameId: string) => `${API_BASE_URL}/api/players/game/${gameId}`,
  PLAYER_COMPLETE_TASK: (playerId: string) => `${API_BASE_URL}/api/players/${playerId}/complete-task`,
  PLAYER_UPDATE_LOCATION: (playerId: string) => `${API_BASE_URL}/api/players/${playerId}/location`,
  
  // Admin endpoints
  ADMIN_USERS: `${API_BASE_URL}/api/admin/users`,
  ADMIN_STATS: `${API_BASE_URL}/api/admin/stats`,
  
  // Health check
  HEALTH: `${API_BASE_URL}/health`
};

export default API_ENDPOINTS;
