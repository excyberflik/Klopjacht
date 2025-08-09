const express = require('express');
const { body, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const Game = require('../models/Game');
const Player = require('../models/Player');
const { authenticateToken, requireAdmin, requireOwnershipOrAdmin } = require('../middleware/auth');
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
  
  let query = {};
  
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
  
  // Add player counts to each game
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

  res.json({ game });
}));

// @route   POST /api/games
// @desc    Create a new game
// @access  Private (Admin)
router.post('/', authenticateToken, requireAdmin, createGameValidation, asyncHandler(async (req, res) => {
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

  if (game.status !== 'active') {
    throw new AppError('Only active games can be ended', 400, 'INVALID_GAME_STATUS');
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

  res.json({
    message: 'Game ended successfully',
    game: {
      id: game._id,
      status: game.status,
      results: game.results
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

  // Soft delete
  game.isActive = false;
  await game.save();

  // Also remove all players from the game
  await Player.deleteMany({ game: game._id });

  res.json({
    message: 'Game deleted successfully'
  });
}));

// @route   GET /api/games/code/:gameCode
// @desc    Get game by game code (for players joining)
// @access  Public
router.get('/code/:gameCode', asyncHandler(async (req, res) => {
  const game = await Game.findOne({ 
    gameCode: req.params.gameCode.toUpperCase(),
    isActive: true 
  }).select('name description status gameCode settings');

  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Get player count
  const playerCount = await Player.countDocuments({ game: game._id });

  res.json({
    game: {
      id: game._id,
      name: game.name,
      description: game.description,
      status: game.status,
      gameCode: game.gameCode,
      playerCount,
      maxPlayers: game.settings.maxPlayers
    }
  });
}));

module.exports = router;
