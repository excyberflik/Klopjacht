const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Game = require('../models/Game');
const Player = require('../models/Player');
const { authenticateToken, requireSuperAdmin, requireAdmin } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Validation rules
const createAdminValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('organization')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Organization must be between 2 and 100 characters')
];

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin)
router.get('/dashboard', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const isSuper = req.user.role === 'super_admin';
  
  // Base query - super admin sees all, regular admin sees only their created content
  const baseQuery = isSuper ? {} : { createdBy: req.user._id };
  
  // Get statistics
  const [
    totalGames,
    activeGames,
    completedGames,
    totalPlayers,
    totalAdmins
  ] = await Promise.all([
    Game.countDocuments({ ...baseQuery, isActive: true }),
    Game.countDocuments({ ...baseQuery, status: 'active', isActive: true }),
    Game.countDocuments({ ...baseQuery, status: 'completed', isActive: true }),
    Player.countDocuments({}), // All players across all games
    isSuper ? User.countDocuments({ role: 'admin', isActive: true }) : 
              User.countDocuments({ createdBy: req.user._id, role: 'admin', isActive: true })
  ]);

  // Get recent games
  const recentGames = await Game.find({ ...baseQuery, isActive: true })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('createdBy', 'name email')
    .select('name status createdAt playerCount');

  // Get active games with player counts
  const activeGamesWithPlayers = await Game.aggregate([
    { 
      $match: { 
        ...baseQuery, 
        status: 'active', 
        isActive: true 
      } 
    },
    {
      $lookup: {
        from: 'players',
        localField: '_id',
        foreignField: 'game',
        as: 'players'
      }
    },
    {
      $project: {
        name: 1,
        gameCode: 1,
        startTime: 1,
        duration: 1,
        playerCount: { $size: '$players' },
        fugitiveCount: {
          $size: {
            $filter: {
              input: '$players',
              cond: { $eq: ['$$this.role', 'fugitive'] }
            }
          }
        },
        hunterCount: {
          $size: {
            $filter: {
              input: '$players',
              cond: { $eq: ['$$this.role', 'hunter'] }
            }
          }
        }
      }
    },
    { $sort: { startTime: -1 } },
    { $limit: 10 }
  ]);

  res.json({
    statistics: {
      totalGames,
      activeGames,
      completedGames,
      totalPlayers,
      totalAdmins: isSuper ? totalAdmins : null // Only show to super admin
    },
    recentGames,
    activeGames: activeGamesWithPlayers,
    user: {
      role: req.user.role,
      isSuper
    }
  });
}));

// @route   GET /api/admin/users
// @desc    Get all users (super admin only)
// @access  Private (Super Admin)
router.get('/users', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 20, search } = req.query;
  
  let query = { isActive: true };
  
  if (role) {
    query.role = role;
  }
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { organization: { $regex: search, $options: 'i' } }
    ];
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 },
    populate: { path: 'createdBy', select: 'name email' }
  };

  const users = await User.paginate(query, options);

  res.json({
    users: users.docs,
    pagination: {
      page: users.page,
      pages: users.totalPages,
      total: users.totalDocs,
      limit: users.limit
    }
  });
}));

// @route   POST /api/admin/users
// @desc    Create a new admin user
// @access  Private (Super Admin)
router.post('/users', authenticateToken, requireSuperAdmin, createAdminValidation, asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { email, password, name, organization } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User with this email already exists', 409, 'USER_EXISTS');
  }

  // Create new admin user
  const user = new User({
    email,
    password,
    name,
    organization,
    role: 'admin',
    createdBy: req.user._id
  });

  await user.save();

  res.status(201).json({
    message: 'Admin user created successfully',
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization,
      createdAt: user.createdAt
    }
  });
}));

// @route   PUT /api/admin/users/:id
// @desc    Update a user
// @access  Private (Super Admin)
router.put('/users/:id', authenticateToken, requireSuperAdmin, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('organization')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Organization must be less than 100 characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be boolean')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { name, organization, isActive } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Can't deactivate yourself
  if (user._id.toString() === req.user._id.toString() && isActive === false) {
    throw new AppError('Cannot deactivate your own account', 400, 'CANNOT_DEACTIVATE_SELF');
  }

  // Update fields
  if (name) user.name = name;
  if (organization !== undefined) user.organization = organization;
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();

  res.json({
    message: 'User updated successfully',
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization: user.organization,
      isActive: user.isActive
    }
  });
}));

// @route   DELETE /api/admin/users/:id
// @desc    Deactivate a user
// @access  Private (Super Admin)
router.delete('/users/:id', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Can't delete yourself
  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError('Cannot delete your own account', 400, 'CANNOT_DELETE_SELF');
  }

  // Can't delete other super admins
  if (user.role === 'super_admin') {
    throw new AppError('Cannot delete super admin accounts', 400, 'CANNOT_DELETE_SUPER_ADMIN');
  }

  // Soft delete the user
  user.isActive = false;
  await user.save();

  // Also soft delete all games created by this user
  await Game.updateMany(
    { createdBy: user._id },
    { isActive: false }
  );

  // Also remove all players from games created by this user
  const userGames = await Game.find({ createdBy: user._id }).select('_id');
  const gameIds = userGames.map(game => game._id);
  
  if (gameIds.length > 0) {
    await Player.deleteMany({ game: { $in: gameIds } });
  }

  res.json({
    message: 'User and associated games deactivated successfully',
    gamesAffected: gameIds.length
  });
}));

// @route   GET /api/admin/games
// @desc    Get all games (with admin filtering)
// @access  Private (Admin)
router.get('/games', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20, search } = req.query;
  
  // Base query - super admin sees all, regular admin sees only their created games
  let query = { isActive: true };
  
  if (req.user.role !== 'super_admin') {
    query.createdBy = req.user._id;
  }
  
  if (status) {
    query.status = status;
  }
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { gameCode: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
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
      spectators: playerCounts.find(p => p._id === 'spectator')?.count || 0,
      total: playerCounts.reduce((sum, p) => sum + p.count, 0)
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

// @route   GET /api/admin/games/:id/details
// @desc    Get detailed game information
// @access  Private (Admin)
router.get('/games/:id/details', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const game = await Game.findById(req.params.id)
    .populate('createdBy', 'name email organization')
    .populate('gameMaster', 'name email');

  if (!game) {
    throw new AppError('Game not found', 404, 'GAME_NOT_FOUND');
  }

  // Check access for non-super admin
  if (req.user.role !== 'super_admin' && 
      game.createdBy._id.toString() !== req.user._id.toString()) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Get players
  const players = await Player.find({ game: game._id })
    .sort({ createdAt: -1 });

  // Get game statistics
  const stats = {
    totalPlayers: players.length,
    playersByRole: {
      fugitives: players.filter(p => p.role === 'fugitive').length,
      hunters: players.filter(p => p.role === 'hunter').length,
      spectators: players.filter(p => p.role === 'spectator').length
    },
    playersByStatus: {
      waiting: players.filter(p => p.status === 'waiting').length,
      active: players.filter(p => p.status === 'active').length,
      caught: players.filter(p => p.status === 'caught').length,
      escaped: players.filter(p => p.status === 'escaped').length,
      disconnected: players.filter(p => p.status === 'disconnected').length
    },
    onlinePlayers: players.filter(p => p.isOnline).length,
    tasksCompleted: players.reduce((sum, p) => sum + p.completedTasks.length, 0),
    averageTasksPerPlayer: players.length > 0 ? 
      players.reduce((sum, p) => sum + p.completedTasks.length, 0) / players.length : 0
  };

  res.json({
    game,
    players,
    statistics: stats
  });
}));

// @route   GET /api/admin/system/stats
// @desc    Get system-wide statistics
// @access  Private (Super Admin)
router.get('/system/stats', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalAdmins,
    totalGames,
    totalPlayers,
    activeGames,
    gamesThisMonth,
    playersThisMonth
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'admin', isActive: true }),
    Game.countDocuments({ isActive: true }),
    Player.countDocuments({}),
    Game.countDocuments({ status: 'active', isActive: true }),
    Game.countDocuments({
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      isActive: true
    }),
    Player.countDocuments({
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    })
  ]);

  // Get games by status
  const gamesByStatus = await Game.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  // Get recent activity
  const recentGames = await Game.find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('createdBy', 'name email')
    .select('name status createdAt gameCode');

  const recentUsers = await User.find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('createdBy', 'name email')
    .select('name email role organization createdAt');

  res.json({
    statistics: {
      totalUsers,
      totalAdmins,
      totalGames,
      totalPlayers,
      activeGames,
      gamesThisMonth,
      playersThisMonth
    },
    gamesByStatus: gamesByStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    recentActivity: {
      games: recentGames,
      users: recentUsers
    }
  });
}));

module.exports = router;
