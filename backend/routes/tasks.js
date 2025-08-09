const express = require('express');
const { body, validationResult } = require('express-validator');
const Game = require('../models/Game');
const Player = require('../models/Player');
const { optionalAuth } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Validation rules
const submitAnswerValidation = [
  body('answer')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Answer must be between 1 and 100 characters'),
  body('playerId')
    .isMongoId()
    .withMessage('Valid player ID is required'),
  body('location')
    .optional()
    .isObject()
    .withMessage('Location must be an object'),
  body('location.latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('location.longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180')
];

// @route   GET /api/tasks/:gameId/:taskNumber
// @desc    Get a specific task (accessed via QR code)
// @access  Public
router.get('/:gameId/:taskNumber', asyncHandler(async (req, res) => {
  const { gameId, taskNumber } = req.params;

  const game = await Game.findById(gameId);
  if (!game || !game.isActive) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  const taskNum = parseInt(taskNumber);
  if (isNaN(taskNum) || taskNum < 1 || taskNum > 6) {
    throw new AppError('Invalid task number', 400, 'INVALID_TASK_NUMBER');
  }

  const task = game.tasks.find(t => t.taskNumber === taskNum);
  if (!task) {
    throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
  }

  // Return task without the answer
  res.json({
    task: {
      id: task._id,
      taskNumber: task.taskNumber,
      question: task.question,
      location: task.location,
      gameId: game._id,
      gameName: game.name,
      gameStatus: game.status
    }
  });
}));

// @route   POST /api/tasks/:gameId/:taskNumber/submit
// @desc    Submit an answer to a task
// @access  Public
router.post('/:gameId/:taskNumber/submit', submitAnswerValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { gameId, taskNumber } = req.params;
  const { answer, playerId, location } = req.body;

  // Find the game
  const game = await Game.findById(gameId);
  if (!game || !game.isActive) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check if game is active
  if (game.status !== 'active') {
    throw new AppError('Game is not active', 400, 'GAME_NOT_ACTIVE');
  }

  // Check if game has expired
  if (game.isExpired()) {
    throw new AppError('Game has expired', 400, 'GAME_EXPIRED');
  }

  const taskNum = parseInt(taskNumber);
  if (isNaN(taskNum) || taskNum < 1 || taskNum > 6) {
    throw new AppError('Invalid task number', 400, 'INVALID_TASK_NUMBER');
  }

  // Find the task
  const task = game.tasks.find(t => t.taskNumber === taskNum);
  if (!task) {
    throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
  }

  // Find the player
  const player = await Player.findById(playerId);
  if (!player) {
    throw new AppError('Player not found', 404, 'PLAYER_NOT_FOUND');
  }

  // Check if player belongs to this game
  if (player.game.toString() !== gameId) {
    throw new AppError('Player does not belong to this game', 403, 'PLAYER_GAME_MISMATCH');
  }

  // Check if player is a fugitive and active
  if (player.role !== 'fugitive') {
    throw new AppError('Only fugitives can complete tasks', 403, 'INVALID_PLAYER_ROLE');
  }

  if (player.status !== 'active') {
    throw new AppError('Player is not active', 400, 'PLAYER_NOT_ACTIVE');
  }

  // Check if this is the correct next task for the player
  const expectedTaskNumber = player.completedTasks.length + 1;
  if (taskNum !== expectedTaskNumber) {
    throw new AppError(
      `You must complete task ${expectedTaskNumber} first`, 
      400, 
      'WRONG_TASK_ORDER'
    );
  }

  // Check if player already completed this task
  const alreadyCompleted = player.completedTasks.some(ct => ct.taskNumber === taskNum);
  if (alreadyCompleted) {
    throw new AppError('Task already completed', 400, 'TASK_ALREADY_COMPLETED');
  }

  // Check the answer (case-insensitive)
  const normalizedAnswer = answer.toLowerCase().trim();
  const correctAnswer = task.answer.toLowerCase().trim();
  
  const isCorrect = normalizedAnswer === correctAnswer;

  if (!isCorrect) {
    return res.status(400).json({
      error: 'Incorrect answer',
      code: 'INCORRECT_ANSWER',
      correct: false
    });
  }

  // Answer is correct - complete the task
  await player.completeTask(task._id, taskNum, location);

  // Update task completion in game
  const taskIndex = game.tasks.findIndex(t => t.taskNumber === taskNum);
  if (taskIndex !== -1) {
    game.tasks[taskIndex].completedBy.push({
      player: player._id,
      completedAt: new Date()
    });
    
    // Update game stats
    game.results.completedTasks = Math.max(
      game.results.completedTasks || 0,
      player.completedTasks.length
    );
    
    await game.save();
  }

  // Update player location if provided
  if (location && location.latitude && location.longitude) {
    await player.updateLocation(
      location.latitude, 
      location.longitude, 
      location.accuracy,
      'task_completion'
    );
  }

  // Determine what to return next
  let nextStep = null;
  
  if (player.completedTasks.length === 6) {
    // All tasks completed - provide extraction point
    nextStep = {
      type: 'extraction',
      message: 'All tasks completed! Head to the extraction point.',
      extractionPoint: game.extractionPoint,
      remainingTime: game.remainingTime
    };
  } else {
    // Get next task location
    const nextTask = game.getNextTaskForPlayer(player._id);
    if (nextTask) {
      nextStep = {
        type: 'next_task',
        message: `Task ${taskNum} completed! Head to the next location.`,
        nextTaskNumber: nextTask.taskNumber,
        nextLocation: nextTask.location,
        remainingTasks: 6 - player.completedTasks.length
      };
    }
  }

  // Emit socket event for real-time updates
  req.app.get('io')?.to(`game_${gameId}`).emit('task_completed', {
    playerId: player._id,
    playerName: player.name,
    taskNumber: taskNum,
    completedTasks: player.completedTasks.length,
    location: player.currentLocation
  });

  res.json({
    correct: true,
    message: `Task ${taskNum} completed successfully!`,
    completedTasks: player.completedTasks.length,
    totalTasks: 6,
    nextStep,
    player: {
      id: player._id,
      name: player.name,
      completedTasks: player.completedTasks.length,
      currentLocation: player.currentLocation
    }
  });
}));

// @route   GET /api/tasks/player/:playerId/current
// @desc    Get current task for a player
// @access  Public
router.get('/player/:playerId/current', asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.playerId).populate('game');
  
  if (!player) {
    throw new AppError('Player not found', 404, 'PLAYER_NOT_FOUND');
  }

  if (player.role !== 'fugitive') {
    throw new AppError('Only fugitives have tasks', 403, 'INVALID_PLAYER_ROLE');
  }

  const game = player.game;
  
  if (!game || game.status !== 'active') {
    return res.json({
      currentTask: null,
      message: 'Game is not active',
      completedTasks: player.completedTasks.length
    });
  }

  // Check if all tasks are completed
  if (player.completedTasks.length === 6) {
    return res.json({
      currentTask: null,
      allTasksCompleted: true,
      extractionPoint: game.extractionPoint,
      message: 'All tasks completed! Head to the extraction point.',
      completedTasks: player.completedTasks.length
    });
  }

  // Get next task
  const nextTask = game.getNextTaskForPlayer(player._id);
  
  if (!nextTask) {
    return res.json({
      currentTask: null,
      message: 'No more tasks available',
      completedTasks: player.completedTasks.length
    });
  }

  res.json({
    currentTask: {
      taskNumber: nextTask.taskNumber,
      location: nextTask.location,
      // Don't include question or QR code - player must scan QR to get task
    },
    completedTasks: player.completedTasks.length,
    totalTasks: 6,
    remainingTasks: 6 - player.completedTasks.length,
    gameStatus: game.status,
    remainingTime: game.remainingTime
  });
}));

// @route   GET /api/tasks/player/:playerId/completed
// @desc    Get completed tasks for a player
// @access  Public
router.get('/player/:playerId/completed', asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.playerId).populate('game');
  
  if (!player) {
    throw new AppError('Player not found', 404, 'PLAYER_NOT_FOUND');
  }

  const completedTasks = player.completedTasks.map(ct => ({
    taskNumber: ct.taskNumber,
    completedAt: ct.completedAt,
    location: ct.location
  }));

  res.json({
    completedTasks,
    totalCompleted: completedTasks.length,
    totalTasks: 6,
    player: {
      id: player._id,
      name: player.name,
      role: player.role
    }
  });
}));

// @route   GET /api/tasks/game/:gameId/progress
// @desc    Get task completion progress for all players in a game
// @access  Public
router.get('/game/:gameId/progress', asyncHandler(async (req, res) => {
  const game = await Game.findById(req.params.gameId);
  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  const players = await Player.find({ 
    game: req.params.gameId, 
    role: 'fugitive' 
  }).select('name completedTasks status');

  const progress = players.map(player => ({
    playerId: player._id,
    playerName: player.name,
    completedTasks: player.completedTasks.length,
    status: player.status,
    lastTaskCompleted: player.completedTasks.length > 0 
      ? player.completedTasks[player.completedTasks.length - 1].completedAt 
      : null
  }));

  // Calculate overall statistics
  const totalTasks = players.length * 6;
  const completedTasks = players.reduce((sum, p) => sum + p.completedTasks.length, 0);
  const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  res.json({
    progress,
    statistics: {
      totalPlayers: players.length,
      totalTasks,
      completedTasks,
      completionRate: Math.round(completionRate * 100) / 100,
      playersCompleted: players.filter(p => p.completedTasks.length === 6).length
    }
  });
}));

module.exports = router;
