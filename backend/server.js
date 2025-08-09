const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const playerRoutes = require('./routes/players');
const taskRoutes = require('./routes/tasks');
const adminRoutes = require('./routes/admin');

// Import middleware
const authMiddleware = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

// Import socket handlers
const socketHandler = require('./socket/socketHandler');

// Import database initialization
const initDatabase = require('./config/database');

// Import models for game expiration checking
const Game = require('./models/Game');
const Player = require('./models/Player');

const app = express();
const server = createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);

// Socket.IO connection handling
socketHandler(io);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Automatic game expiration checker
async function checkExpiredGames() {
  try {
    const now = new Date();
    
    // Find active games that have exceeded their duration
    const expiredGames = await Game.find({
      status: 'active',
      startTime: { $exists: true },
      $expr: {
        $lt: [
          { $add: ['$startTime', { $multiply: ['$duration', 60000] }] }, // startTime + duration in ms
          now
        ]
      }
    });

    for (const game of expiredGames) {
      console.log(`⏰ Game ${game.name} (${game.gameCode}) has expired, ending automatically...`);
      
      // End the game
      game.status = 'completed';
      game.results.gameEndReason = 'time_expired';
      
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

      // Determine winner based on time expiration
      if (escapedFugitives.length > 0) {
        game.results.winner = 'fugitives'; // Fugitives win if they survived until time expired
      } else if (caughtFugitives.length === fugitives.length) {
        game.results.winner = 'hunters';
      } else {
        game.results.winner = 'fugitives'; // Default to fugitives if time expired
      }

      await game.save();

      // Update all players to completed status
      await Player.updateMany(
        { game: game._id },
        { status: 'completed' }
      );

      console.log(`✅ Game ${game.name} ended due to time expiration. Winner: ${game.results.winner}`);
    }

    if (expiredGames.length > 0) {
      console.log(`⏰ Processed ${expiredGames.length} expired game(s)`);
    }
  } catch (error) {
    console.error('❌ Error checking expired games:', error);
  }
}

// Database connection and server startup
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/klopjacht');
    
    console.log('✅ Connected to MongoDB');
    
    // Initialize database (create super admin, etc.)
    await initDatabase();
    
    // Start automatic game expiration checker (runs every minute)
    setInterval(checkExpiredGames, 60000); // Check every 60 seconds
    console.log('⏰ Game expiration checker started (runs every 60 seconds)');
    
    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 CORS origins: ${process.env.CORS_ORIGINS || 'http://localhost:3000'}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

startServer();

module.exports = { app, server, io };
