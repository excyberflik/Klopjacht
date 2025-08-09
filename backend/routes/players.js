const express = require('express');
const { body, validationResult } = require('express-validator');
const Game = require('../models/Game');
const Player = require('../models/Player');
const { optionalAuth, authenticateToken, requireGameMaster } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Validation rules
const joinGameValidation = [
  body('gameCode')
    .trim()
    .isLength({ min: 6, max: 6 })
    .withMessage('Game code must be exactly 6 characters'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('role')
    .isIn(['fugitive', 'hunter', 'spectator'])
    .withMessage('Role must be fugitive, hunter, or spectator'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('phoneNumber')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number must be less than 20 characters')
];

const updateLocationValidation = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('accuracy')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Accuracy must be a positive number'),
  body('trigger')
    .optional()
    .isIn(['manual', 'automatic', 'surveillance', 'atm', 'phone_call', 'task_completion'])
    .withMessage('Invalid trigger type')
];

// @route   POST /api/players/join
// @desc    Join a game as a player
// @access  Public
router.post('/join', joinGameValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { gameCode, name, role, email, phoneNumber, team } = req.body;

  // Find the game
  const game = await Game.findOne({ 
    gameCode: gameCode.toUpperCase(),
    isActive: true 
  });

  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check if game is accepting players
  if (game.status === 'completed' || game.status === 'cancelled') {
    throw new AppError('Game is no longer accepting players', 400, 'GAME_CLOSED');
  }

  // Check player limit
  const currentPlayerCount = await Player.countDocuments({ game: game._id });
  if (currentPlayerCount >= game.settings.maxPlayers) {
    throw new AppError('Game is full', 400, 'GAME_FULL');
  }

  // Check if player with same name already exists in this game
  const existingPlayer = await Player.findOne({ 
    game: game._id, 
    name: name.trim() 
  });

  if (existingPlayer) {
    throw new AppError('A player with this name already exists in the game', 409, 'PLAYER_NAME_EXISTS');
  }

  // Create new player
  const player = new Player({
    name: name.trim(),
    email,
    phoneNumber,
    game: game._id,
    role,
    team,
    status: game.status === 'active' ? 'active' : 'waiting',
    deviceInfo: {
      userAgent: req.get('User-Agent'),
      platform: req.get('Sec-CH-UA-Platform'),
      timezone: req.body.timezone
    }
  });

  await player.save();

  res.status(201).json({
    message: 'Successfully joined the game',
    player: {
      id: player._id,
      name: player.name,
      role: player.role,
      status: player.status,
      team: player.team
    },
    game: {
      id: game._id,
      name: game.name,
      gameCode: game.gameCode,
      status: game.status
    }
  });
}));

// @route   GET /api/players/game/:gameId
// @desc    Get all players in a game
// @access  Private (Game Master or Admin)
router.get('/game/:gameId', authenticateToken, requireGameMaster, asyncHandler(async (req, res) => {
  const { role, status } = req.query;
  
  let query = { game: req.params.gameId };
  
  if (role) query.role = role;
  if (status) query.status = status;

  const players = await Player.find(query)
    .populate('game', 'name gameCode status')
    .sort({ createdAt: -1 });

  // Group players by role
  const playersByRole = {
    fugitives: players.filter(p => p.role === 'fugitive'),
    hunters: players.filter(p => p.role === 'hunter'),
    spectators: players.filter(p => p.role === 'spectator')
  };

  res.json({
    players,
    playersByRole,
    counts: {
      total: players.length,
      fugitives: playersByRole.fugitives.length,
      hunters: playersByRole.hunters.length,
      spectators: playersByRole.spectators.length,
      online: players.filter(p => p.isOnline).length
    }
  });
}));

// @route   GET /api/players/:id
// @desc    Get a specific player
// @access  Private
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id)
    .populate('game', 'name gameCode status startTime endTime duration');

  if (!player) {
    throw new AppError('Player not found', 404, 'PLAYER_NOT_FOUND');
  }

  res.json({ player });
}));

// @route   PUT /api/players/:id/location
// @desc    Update player location
// @access  Public (with player ID)
router.put('/:id/location', updateLocationValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { latitude, longitude, accuracy, trigger = 'manual' } = req.body;

  const player = await Player.findById(req.params.id).populate('game');
  if (!player) {
    throw new AppError('Player not found', 404, 'PLAYER_NOT_FOUND');
  }

  // Only update location for active games and active players
  if (player.game.status !== 'active' || player.status !== 'active') {
    throw new AppError('Cannot update location for inactive player or game', 400, 'INACTIVE_PLAYER_OR_GAME');
  }

  // Update location
  await player.updateLocation(latitude, longitude, accuracy, trigger);

  // Check if fugitive reached extraction point
  if (player.role === 'fugitive' && player.game.extractionPoint) {
    const isNearExtraction = player.isNearLocation(
      player.game.extractionPoint.latitude,
      player.game.extractionPoint.longitude,
      player.game.extractionPoint.radius || 50
    );

    if (isNearExtraction && player.completedTasks.length === 6) {
      player.status = 'escaped';
      await player.save();

      // Emit socket event for real-time updates
      req.app.get('io')?.to(`game_${player.game._id}`).emit('player_escaped', {
        playerId: player._id,
        playerName: player.name,
        location: player.currentLocation
      });
    }
  }

  res.json({
    message: 'Location updated successfully',
    location: player.currentLocation,
    status: player.status
  });
}));

// @route   PUT /api/players/:id/status
// @desc    Update player status (for game masters)
// @access  Private (Game Master)
router.put('/:id/status', authenticateToken, requireGameMaster, [
  body('status')
    .isIn(['waiting', 'active', 'caught', 'escaped', 'disconnected'])
    .withMessage('Invalid status')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { status, caughtBy, location } = req.body;

  const player = await Player.findById(req.params.id).populate('game');
  if (!player) {
    throw new AppError('Player not found', 404, 'PLAYER_NOT_FOUND');
  }

  const oldStatus = player.status;
  player.status = status;

  // If player was caught, record details
  if (status === 'caught' && oldStatus !== 'caught') {
    // Update game results
    const game = await Game.findById(player.game._id);
    if (game) {
      game.results.fugitivesCaught.push({
        player: player._id,
        caughtBy: caughtBy || null,
        caughtAt: new Date(),
        location: location || player.currentLocation
      });
      await game.save();
    }
  }

  await player.save();

  // Emit socket event
  req.app.get('io')?.to(`game_${player.game._id}`).emit('player_status_changed', {
    playerId: player._id,
    playerName: player.name,
    oldStatus,
    newStatus: status,
    location: player.currentLocation
  });

  res.json({
    message: 'Player status updated successfully',
    player: {
      id: player._id,
      name: player.name,
      status: player.status
    }
  });
}));

// @route   POST /api/players/:id/permissions
// @desc    Update player permissions
// @access  Public (with player ID)
router.post('/:id/permissions', [
  body('location')
    .optional()
    .isBoolean()
    .withMessage('Location permission must be boolean'),
  body('camera')
    .optional()
    .isBoolean()
    .withMessage('Camera permission must be boolean'),
  body('notifications')
    .optional()
    .isBoolean()
    .withMessage('Notifications permission must be boolean')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { location, camera, notifications } = req.body;

  const player = await Player.findById(req.params.id);
  if (!player) {
    throw new AppError('Player not found', 404, 'PLAYER_NOT_FOUND');
  }

  // Update permissions
  if (location !== undefined) player.permissions.location = location;
  if (camera !== undefined) player.permissions.camera = camera;
  if (notifications !== undefined) player.permissions.notifications = notifications;

  await player.save();

  res.json({
    message: 'Permissions updated successfully',
    permissions: player.permissions
  });
}));

// @route   DELETE /api/players/:id
// @desc    Remove a player from the game
// @access  Private (Game Master)
router.delete('/:id', authenticateToken, requireGameMaster, asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id);
  if (!player) {
    throw new AppError('Player not found', 404, 'PLAYER_NOT_FOUND');
  }

  // Can't remove players from active games
  const game = await Game.findById(player.game);
  if (game && game.status === 'active') {
    throw new AppError('Cannot remove players from active games', 400, 'GAME_ACTIVE');
  }

  await Player.findByIdAndDelete(req.params.id);

  res.json({
    message: 'Player removed successfully'
  });
}));

// @route   GET /api/players/:id/stats
// @desc    Get player statistics
// @access  Public (with player ID)
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id).populate('game');
  if (!player) {
    throw new AppError('Player not found', 404, 'PLAYER_NOT_FOUND');
  }

  // Calculate additional stats
  const distanceTraveled = player.calculateDistanceTraveled();
  
  const stats = {
    ...player.gameStats,
    distanceTraveled,
    tasksCompleted: player.completedTasks.length,
    currentTaskNumber: player.currentTaskNumber,
    timeSinceLastLocation: player.timeSinceLastLocation,
    isOnline: player.isOnline,
    lastSeen: player.lastSeen
  };

  res.json({ stats });
}));

module.exports = router;
