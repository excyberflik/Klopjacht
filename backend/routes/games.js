const express = require('express');
const { body, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const Game = require('../models/Game');
const Player = require('../models/Player');
const { authenticateToken, requireAdmin, requireGameLead, requireOwnershipOrAdmin } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Validation rules
const createGameValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Game name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  body('duration')
    .optional()
    .isInt({ min: 30, max: 480 })
    .withMessage('Duration must be between 30 and 480 minutes'),
  body('extractionPoint.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('extractionPoint.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('extractionPoint.address')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Address must be less than 200 characters')
];

const taskValidation = [
  body('tasks')
    .isArray({ min: 6, max: 6 })
    .withMessage('Exactly 6 tasks are required'),
  body('tasks.*.question')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Question must be between 10 and 500 characters'),
  body('tasks.*.answer')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Answer must be between 1 and 100 characters'),
  body('tasks.*.location.latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Task latitude must be between -90 and 90'),
  body('tasks.*.location.longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Task longitude must be between -180 and 180')
];

// @route   GET /api/games
// @desc    Get all games for the authenticated user
// @access  Private
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  
  let query = { isActive: true };
  
  // Super admins can see all games, others only their own
  if (req.user.role !== 'super_admin') {
    query.createdBy = req.user._id;
  }
  
  if (status) {
    query.status = status;
  }
  
  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 },
    populate: [
      { path: 'createdBy', select: 'name email organization' },
      { path: 'gameMaster', select: 'name email' }
    ]
  };

  const games = await Game.paginate(query, options);
  
  // Add player counts and joined players to each game
  for (let game of games.docs) {
    const playerCounts = await Player.aggregate([
      { $match: { game: game._id } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    
    game._doc.playerCounts = {
      fugitives: playerCounts.find(p => p._id === 'fugitive')?.count || 0,
      hunters: playerCounts.find(p => p._id === 'hunter')?.count || 0,
      spectators: playerCounts.find(p => p._id === 'spectator')?.count || 0
    };

    // Add joined players data
    const joinedPlayers = await Player.find({ game: game._id })
      .select('name role team status tasksCompleted lastSeen currentLocation')
      .lean();
    
    game._doc.joinedPlayers = joinedPlayers;
  }

  res.json({
    games: games.docs,
    pagination: {
      page: games.page,
      pages: games.totalPages,
      total: games.totalDocs,
      limit: games.limit
    }
  });
}));

// @route   GET /api/games/:id
// @desc    Get a specific game
// @access  Private
router.get('/:id', authenticateToken, requireOwnershipOrAdmin(), asyncHandler(async (req, res) => {
  const game = await Game.findById(req.params.id)
    .populate('createdBy', 'name email organization')
    .populate('gameMaster', 'name email');

  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check ownership for non-admin users
  if (req.requireOwnershipCheck && 
      !['super_admin', 'admin'].includes(req.user.role) &&
      game.createdBy._id.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Get player counts
  const playerCounts = await Player.aggregate([
    { $match: { game: game._id } },
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]);

  game._doc.playerCounts = {
    fugitives: playerCounts.find(p => p._id === 'fugitive')?.count || 0,
    hunters: playerCounts.find(p => p._id === 'hunter')?.count || 0,
    spectators: playerCounts.find(p => p._id === 'spectator')?.count || 0
  };

  // Add joined players data
  const joinedPlayers = await Player.find({ game: game._id })
    .select('name role team status tasksCompleted lastSeen currentLocation')
    .lean();
  
  game._doc.joinedPlayers = joinedPlayers;

  res.json({ game });
}));

// @route   POST /api/games
// @desc    Create a new game
// @access  Private (Game Lead)
router.post('/', authenticateToken, requireGameLead, createGameValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { name, description, duration, extractionPoint, settings } = req.body;

  const game = new Game({
    name,
    description,
    duration,
    extractionPoint,
    settings,
    createdBy: req.user._id,
    gameMaster: req.user._id
  });

  await game.save();

  res.status(201).json({
    message: 'Game created successfully',
    game: {
      id: game._id,
      gameCode: game.gameCode,
      name: game.name,
      status: game.status,
      extractionPoint: game.extractionPoint,
      createdAt: game.createdAt
    }
  });
}));

// @route   PUT /api/games/:id
// @desc    Update a game
// @access  Private (Owner or Admin)
router.put('/:id', authenticateToken, requireOwnershipOrAdmin(), createGameValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const game = await Game.findById(req.params.id);
  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check ownership
  if (req.requireOwnershipCheck && 
      !['super_admin', 'admin'].includes(req.user.role) &&
      game.createdBy.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Can't update active games
  if (game.status === 'active') {
    throw new AppError('Cannot update active game', 400, 'GAME_ACTIVE');
  }

  const { name, description, duration, extractionPoint, settings } = req.body;

  game.name = name;
  game.description = description;
  game.duration = duration;
  game.extractionPoint = extractionPoint;
  if (settings) game.settings = { ...game.settings, ...settings };

  await game.save();

  res.json({
    message: 'Game updated successfully',
    game
  });
}));

// @route   POST /api/games/:id/tasks
// @desc    Add tasks to a game
// @access  Private (Owner or Admin)
router.post('/:id/tasks', authenticateToken, requireOwnershipOrAdmin(), taskValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const game = await Game.findById(req.params.id);
  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check ownership
  if (req.requireOwnershipCheck && 
      !['super_admin', 'admin'].includes(req.user.role) &&
      game.createdBy.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Can't update active games
  if (game.status === 'active') {
    throw new AppError('Cannot update active game', 400, 'GAME_ACTIVE');
  }

  const { tasks } = req.body;

  // Generate QR codes for each task
  const tasksWithQR = await Promise.all(tasks.map(async (task, index) => {
    const taskNumber = index + 1;
    const qrData = {
      gameId: game._id,
      taskId: `task_${taskNumber}`,
      taskNumber,
      question: task.question,
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/task/${game._id}/${taskNumber}`
    };

    const qrCode = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return {
      taskNumber,
      question: task.question,
      answer: task.answer.toLowerCase().trim(), // Normalize answer
      location: task.location,
      qrCode
    };
  }));

  game.tasks = tasksWithQR;
  await game.save();

  res.json({
    message: 'Tasks added successfully',
    tasks: game.tasks.map(task => ({
      taskNumber: task.taskNumber,
      question: task.question,
      location: task.location,
      qrCode: task.qrCode
    }))
  });
}));

// @route   PUT /api/games/:id/tasks
// @desc    Update tasks for a game
// @access  Private (Owner or Admin)
router.put('/:id/tasks', authenticateToken, requireOwnershipOrAdmin(), taskValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const game = await Game.findById(req.params.id);
  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check ownership
  if (req.requireOwnershipCheck && 
      !['super_admin', 'admin'].includes(req.user.role) &&
      game.createdBy.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Can't update active games
  if (game.status === 'active') {
    throw new AppError('Cannot update active game', 400, 'GAME_ACTIVE');
  }

  const { tasks } = req.body;

  // Generate QR codes for each task
  const tasksWithQR = await Promise.all(tasks.map(async (task, index) => {
    const taskNumber = index + 1;
    const qrData = {
      gameId: game._id,
      taskId: `task_${taskNumber}`,
      taskNumber,
      question: task.question,
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/task/${game._id}/${taskNumber}`
    };

    const qrCode = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return {
      taskNumber,
      question: task.question,
      answer: task.answer.toLowerCase().trim(), // Normalize answer
      location: task.location,
      qrCode
    };
  }));

  game.tasks = tasksWithQR;
  await game.save();

  res.json({
    message: 'Tasks updated successfully',
    tasks: game.tasks.map(task => ({
      taskNumber: task.taskNumber,
      question: task.question,
      location: task.location,
      qrCode: task.qrCode
    }))
  });
}));

// @route   POST /api/games/:id/start
// @desc    Start a game
// @access  Private (Owner or Admin)
router.post('/:id/start', authenticateToken, requireOwnershipOrAdmin(), asyncHandler(async (req, res) => {
  const game = await Game.findById(req.params.id);
  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check ownership
  if (req.requireOwnershipCheck && 
      !['super_admin', 'admin'].includes(req.user.role) &&
      game.createdBy.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  if (game.status !== 'setup' && game.status !== 'waiting') {
    throw new AppError('Game cannot be started', 400, 'INVALID_GAME_STATUS');
  }

  if (game.tasks.length !== 6) {
    throw new AppError('Game must have exactly 6 tasks', 400, 'INCOMPLETE_TASKS');
  }

  // Check if there are players
  const playerCount = await Player.countDocuments({ game: game._id });
  if (playerCount === 0) {
    throw new AppError('Game must have at least one player', 400, 'NO_PLAYERS');
  }

  game.status = 'active';
  game.startTime = new Date();
  game.endTime = new Date(Date.now() + (game.duration * 60 * 1000));

  await game.save();

  // Update all players to active status
  await Player.updateMany(
    { game: game._id, status: 'waiting' },
    { status: 'active' }
  );

  res.json({
    message: 'Game started successfully',
    game: {
      id: game._id,
      status: game.status,
      startTime: game.startTime,
      endTime: game.endTime
    }
  });
}));

// @route   POST /api/games/:id/pause
// @desc    Pause a game
// @access  Private (Owner or Admin)
router.post('/:id/pause', authenticateToken, asyncHandler(async (req, res) => {
  console.log('=== PAUSE ROUTE HIT ===');
  console.log('Params:', req.params);
  console.log('Body:', req.body);
  console.log('User:', req.user?.email, req.user?.role);
  console.log('Headers:', req.headers);
  
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      console.log('Game not found');
      throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
    }

    console.log('Game found:', { id: game._id, status: game.status, createdBy: game.createdBy });

    // Simple ownership check - only check if user is admin or game creator
    if (!['super_admin', 'admin'].includes(req.user.role) &&
        game.createdBy.toString() !== req.user._id.toString()) {
      console.log('Access denied - ownership check failed');
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    if (game.status !== 'active') {
      console.log('Invalid game status for pause:', game.status);
      throw new AppError('Only active games can be paused', 400, 'INVALID_GAME_STATUS');
    }

    console.log('Pausing game...');
    game.status = 'paused';
    game.pausedAt = new Date();

    await game.save();

    // Update all players to paused status
    await Player.updateMany(
      { game: game._id, status: 'active' },
      { status: 'paused' }
    );

    console.log('Game paused successfully');
    res.json({
      message: 'Game paused successfully',
      game: {
        id: game._id,
        status: game.status,
        pausedAt: game.pausedAt
      }
    });
  } catch (error) {
    console.log('Error in pause route:', error);
    throw error;
  }
}));

// @route   POST /api/games/:id/resume
// @desc    Resume a paused game
// @access  Private (Owner or Admin)
router.post('/:id/resume', authenticateToken, requireOwnershipOrAdmin(), asyncHandler(async (req, res) => {
  const game = await Game.findById(req.params.id);
  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check ownership
  if (req.requireOwnershipCheck && 
      !['super_admin', 'admin'].includes(req.user.role) &&
      game.createdBy.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  if (game.status !== 'paused') {
    throw new AppError('Only paused games can be resumed', 400, 'INVALID_GAME_STATUS');
  }

  game.status = 'active';
  game.resumedAt = new Date();

  await game.save();

  // Update all players to active status
  await Player.updateMany(
    { game: game._id, status: 'paused' },
    { status: 'active' }
  );

  res.json({
    message: 'Game resumed successfully',
    game: {
      id: game._id,
      status: game.status,
      resumedAt: game.resumedAt
    }
  });
}));

// @route   POST /api/games/:id/end
// @desc    End a game
// @access  Private (Owner or Admin)
router.post('/:id/end', authenticateToken, requireOwnershipOrAdmin(), asyncHandler(async (req, res) => {
  const { reason = 'manual' } = req.body;

  const game = await Game.findById(req.params.id);
  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check ownership
  if (req.requireOwnershipCheck && 
      !['super_admin', 'admin'].includes(req.user.role) &&
      game.createdBy.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  if (game.status === 'completed' || game.status === 'cancelled') {
    throw new AppError('Game is already completed or cancelled', 400, 'INVALID_GAME_STATUS');
  }

  game.status = 'completed';
  game.results.gameEndReason = reason;

  // Calculate results
  const fugitives = await Player.find({ game: game._id, role: 'fugitive' });
  const escapedFugitives = fugitives.filter(f => f.status === 'escaped');
  const caughtFugitives = fugitives.filter(f => f.status === 'caught');

  game.results.fugitivesEscaped = escapedFugitives.map(f => f._id);
  game.results.fugitivesCaught = caughtFugitives.map(f => ({
    player: f._id,
    caughtAt: f.updatedAt,
    location: f.currentLocation
  }));

  // Determine winner
  if (escapedFugitives.length > 0) {
    game.results.winner = 'fugitives';
  } else if (caughtFugitives.length === fugitives.length) {
    game.results.winner = 'hunters';
  } else {
    game.results.winner = 'none';
  }

  await game.save();

  // Update all players to completed status
  await Player.updateMany(
    { game: game._id },
    { status: 'completed' }
  );

  res.json({
    message: 'Game ended successfully',
    game: {
      id: game._id,
      status: game.status,
      results: game.results
    }
  });
}));

// @route   POST /api/games/:id/message
// @desc    Send a message to all players in a game
// @access  Private (Owner or Admin)
router.post('/:id/message', authenticateToken, requireOwnershipOrAdmin(), [
  body('message')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Message must be between 1 and 500 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const game = await Game.findById(req.params.id);
  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check ownership
  if (req.requireOwnershipCheck && 
      !['super_admin', 'admin'].includes(req.user.role) &&
      game.createdBy.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  const { message } = req.body;

  // Get all players in the game
  const players = await Player.find({ game: game._id });
  
  if (players.length === 0) {
    throw new AppError('No players found in this game', 400, 'NO_PLAYERS');
  }

  // For now, we'll just store the message in the game object
  // In a real implementation, you might want to use WebSockets or push notifications
  if (!game.messages) {
    game.messages = [];
  }

  const newMessage = {
    text: message.trim(),
    sender: req.user.name || req.user.email,
    timestamp: new Date(),
    recipients: players.length
  };

  game.messages.push(newMessage);
  await game.save();

  // TODO: In a real implementation, you would send the message to all connected players
  // via WebSockets, push notifications, or similar real-time communication method

  res.json({
    message: 'Message sent successfully to all players',
    messageDetails: {
      text: newMessage.text,
      sender: newMessage.sender,
      timestamp: newMessage.timestamp,
      recipients: newMessage.recipients
    }
  });
}));

// @route   DELETE /api/games/:id
// @desc    Delete a game
// @access  Private (Owner or Admin)
router.delete('/:id', authenticateToken, requireOwnershipOrAdmin(), asyncHandler(async (req, res) => {
  const game = await Game.findById(req.params.id);
  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check ownership
  if (req.requireOwnershipCheck && 
      !['super_admin', 'admin'].includes(req.user.role) &&
      game.createdBy.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Can't delete active games
  if (game.status === 'active') {
    throw new AppError('Cannot delete active game', 400, 'GAME_ACTIVE');
  }

  // Hard delete - completely remove from database
  await Player.deleteMany({ game: game._id });
  await Game.findByIdAndDelete(req.params.id);

  res.json({
    message: 'Game deleted successfully'
  });
}));

// @route   POST /api/games/:id/predefined-players
// @desc    Add predefined players to a game
// @access  Private (Owner or Admin)
router.post('/:id/predefined-players', authenticateToken, requireOwnershipOrAdmin(), [
  body('players')
    .isArray({ min: 1 })
    .withMessage('At least one player is required'),
  body('players.*.name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Player name must be between 2 and 50 characters'),
  body('players.*.role')
    .isIn(['fugitive', 'hunter', 'spectator'])
    .withMessage('Role must be fugitive, hunter, or spectator'),
  body('players.*.team')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Team name must be less than 50 characters'),
  body('players.*.password')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Password must be between 3 and 20 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const game = await Game.findById(req.params.id);
  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check ownership
  if (req.requireOwnershipCheck && 
      !['super_admin', 'admin'].includes(req.user.role) &&
      game.createdBy.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Can't update active games
  if (game.status === 'active') {
    throw new AppError('Cannot update active game', 400, 'GAME_ACTIVE');
  }

  const { players } = req.body;

  // Check for duplicate names within the new players
  const playerNames = players.map(p => p.name.trim().toLowerCase());
  const duplicateNames = playerNames.filter((name, index) => playerNames.indexOf(name) !== index);
  if (duplicateNames.length > 0) {
    throw new AppError('Duplicate player names are not allowed', 400, 'DUPLICATE_NAMES');
  }

  // Check for duplicate names with existing predefined players
  const existingNames = game.predefinedPlayers.map(p => p.name.toLowerCase());
  const conflictingNames = playerNames.filter(name => existingNames.includes(name));
  if (conflictingNames.length > 0) {
    throw new AppError(`Player names already exist: ${conflictingNames.join(', ')}`, 400, 'NAME_CONFLICTS');
  }

  // Add new predefined players
  const newPlayers = players.map(player => ({
    name: player.name.trim(),
    role: player.role,
    team: player.team ? player.team.trim() : undefined,
    password: player.password.trim()
  }));

  game.predefinedPlayers.push(...newPlayers);
  await game.save();

  res.json({
    message: 'Predefined players added successfully',
    predefinedPlayers: game.predefinedPlayers
  });
}));

// @route   GET /api/games/:id/predefined-players
// @desc    Get predefined players for a game
// @access  Private (Owner or Admin)
router.get('/:id/predefined-players', authenticateToken, requireOwnershipOrAdmin(), asyncHandler(async (req, res) => {
  const game = await Game.findById(req.params.id).populate('predefinedPlayers.playerId', 'name status isOnline');
  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check ownership
  if (req.requireOwnershipCheck && 
      !['super_admin', 'admin'].includes(req.user.role) &&
      game.createdBy.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  res.json({
    predefinedPlayers: game.predefinedPlayers
  });
}));

// @route   GET /api/games/:id/tasks
// @desc    Get tasks with QR codes for a game
// @access  Private (Owner or Admin)
router.get('/:id/tasks', authenticateToken, requireOwnershipOrAdmin(), asyncHandler(async (req, res) => {
  const game = await Game.findById(req.params.id);
  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check ownership
  if (req.requireOwnershipCheck && 
      !['super_admin', 'admin'].includes(req.user.role) &&
      game.createdBy.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  res.json({
    tasks: game.tasks || [],
    gameInfo: {
      id: game._id,
      name: game.name,
      gameCode: game.gameCode,
      status: game.status
    }
  });
}));

// @route   PUT /api/games/:id/predefined-players/:playerId
// @desc    Update a predefined player
// @access  Private (Owner or Admin)
router.put('/:id/predefined-players/:playerId', authenticateToken, requireOwnershipOrAdmin(), [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Player name must be between 2 and 50 characters'),
  body('role')
    .optional()
    .isIn(['fugitive', 'hunter', 'spectator'])
    .withMessage('Role must be fugitive, hunter, or spectator'),
  body('team')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Team name must be less than 50 characters'),
  body('password')
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Password must be between 3 and 20 characters')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const game = await Game.findById(req.params.id);
  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check ownership
  if (req.requireOwnershipCheck && 
      !['super_admin', 'admin'].includes(req.user.role) &&
      game.createdBy.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Can't update active games
  if (game.status === 'active') {
    throw new AppError('Cannot update active game', 400, 'GAME_ACTIVE');
  }

  const predefinedPlayer = game.predefinedPlayers.id(req.params.playerId);
  if (!predefinedPlayer) {
    throw new AppError('Predefined player not found', 404, 'PLAYER_NOT_FOUND');
  }

  // Can't update if player has already joined
  if (predefinedPlayer.isJoined) {
    throw new AppError('Cannot update player who has already joined', 400, 'PLAYER_ALREADY_JOINED');
  }

  const { name, role, team, password } = req.body;

  if (name) predefinedPlayer.name = name.trim();
  if (role) predefinedPlayer.role = role;
  if (team !== undefined) predefinedPlayer.team = team ? team.trim() : undefined;
  if (password) predefinedPlayer.password = password.trim();

  await game.save();

  res.json({
    message: 'Predefined player updated successfully',
    predefinedPlayer
  });
}));

// @route   DELETE /api/games/:id/predefined-players/:playerId
// @desc    Remove a predefined player
// @access  Private (Owner or Admin)
router.delete('/:id/predefined-players/:playerId', authenticateToken, asyncHandler(async (req, res) => {
  console.log('=== DELETE PREDEFINED PLAYER ROUTE HIT ===');
  console.log('Game ID:', req.params.id);
  console.log('Player ID:', req.params.playerId);
  console.log('User:', req.user?.email, req.user?.role);
  
  try {
    const game = await Game.findById(req.params.id);
    if (!game) {
      console.log('Game not found');
      throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
    }

    console.log('Game found:', { id: game._id, status: game.status, createdBy: game.createdBy });

    // Simple ownership check - only check if user is admin or game creator
    if (!['super_admin', 'admin'].includes(req.user.role) &&
        game.createdBy.toString() !== req.user._id.toString()) {
      console.log('Access denied - ownership check failed');
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Can't update active games
    if (game.status === 'active') {
      console.log('Cannot update active game');
      throw new AppError('Cannot update active game', 400, 'GAME_ACTIVE');
    }

    const predefinedPlayer = game.predefinedPlayers.id(req.params.playerId);
    if (!predefinedPlayer) {
      console.log('Predefined player not found');
      throw new AppError('Predefined player not found', 404, 'PLAYER_NOT_FOUND');
    }

    console.log('Found predefined player:', { name: predefinedPlayer.name, isJoined: predefinedPlayer.isJoined });

    // Can't remove if player has already joined
    if (predefinedPlayer.isJoined) {
      console.log('Cannot remove player who has already joined');
      throw new AppError('Cannot remove player who has already joined', 400, 'PLAYER_ALREADY_JOINED');
    }

    console.log('Removing predefined player...');
    game.predefinedPlayers.pull(req.params.playerId);
    await game.save();

    console.log('Predefined player removed successfully');
    res.json({
      message: 'Predefined player removed successfully'
    });
  } catch (error) {
    console.log('Error in delete predefined player route:', error);
    throw error;
  }
}));

// @route   GET /api/games/code/:gameCode
// @desc    Get game by game code (for players joining)
// @access  Public
router.get('/code/:gameCode', asyncHandler(async (req, res) => {
  const game = await Game.findOne({ 
    gameCode: req.params.gameCode.toUpperCase(),
    isActive: true 
  }); // Remove .select() to get ALL fields including startTime, endTime, tasks, etc.

  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Get player count
  const playerCount = await Player.countDocuments({ game: game._id });

  // Get available predefined players (not yet joined)
  const availablePlayers = game.predefinedPlayers.filter(p => !p.isJoined);

  // Get ALL predefined players (for rejoining functionality)
  const allPlayers = game.predefinedPlayers.map(p => ({
    id: p._id,
    name: p.name,
    role: p.role,
    team: p.team,
    isJoined: p.isJoined
  }));

  res.json({
    game: {
      id: game._id,
      name: game.name,
      description: game.description,
      status: game.status,
      gameCode: game.gameCode,
      startTime: game.startTime,
      endTime: game.endTime,
      pausedAt: game.pausedAt,
      resumedAt: game.resumedAt,
      duration: game.duration,
      tasks: game.tasks || [],
      extractionPoint: game.extractionPoint,
      playerCount,
      maxPlayers: game.settings?.maxPlayers || 20,
      settings: game.settings,
      availablePlayers: availablePlayers.map(p => ({
        id: p._id,
        name: p.name,
        role: p.role,
        team: p.team
      })),
      allPlayers: allPlayers // Include all players for rejoining
    }
  });
}));

module.exports = router;
