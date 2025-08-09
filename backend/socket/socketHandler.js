const { verifyToken } = require('../middleware/auth');
const Player = require('../models/Player');
const Game = require('../models/Game');

function socketHandler(io) {
  // Middleware for socket authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        // Allow anonymous connections for players
        socket.user = null;
        return next();
      }

      const user = await verifyToken(token);
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      socket.user = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join game room
    socket.on('join_game', async (data) => {
      try {
        const { gameId, playerId } = data;
        
        if (!gameId) {
          socket.emit('error', { message: 'Game ID is required' });
          return;
        }

        // Verify game exists
        const game = await Game.findById(gameId);
        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        // Join game room
        socket.join(`game_${gameId}`);
        socket.gameId = gameId;

        // If player ID provided, update player's socket info
        if (playerId) {
          const player = await Player.findById(playerId);
          if (player && player.game.toString() === gameId) {
            player.socketId = socket.id;
            player.isOnline = true;
            await player.save();
            socket.playerId = playerId;
          }
        }

        socket.emit('joined_game', { 
          gameId, 
          message: 'Successfully joined game room' 
        });

        // Notify others in the game
        socket.to(`game_${gameId}`).emit('player_joined', {
          socketId: socket.id,
          playerId: playerId || null,
          timestamp: new Date()
        });

        console.log(`Socket ${socket.id} joined game ${gameId}`);
      } catch (error) {
        console.error('Join game error:', error);
        socket.emit('error', { message: 'Failed to join game' });
      }
    });

    // Leave game room
    socket.on('leave_game', async (data) => {
      try {
        const { gameId } = data;
        
        if (gameId) {
          socket.leave(`game_${gameId}`);
          
          // Update player offline status
          if (socket.playerId) {
            const player = await Player.findById(socket.playerId);
            if (player) {
              player.isOnline = false;
              player.socketId = null;
              await player.save();
            }
          }

          socket.to(`game_${gameId}`).emit('player_left', {
            socketId: socket.id,
            playerId: socket.playerId || null,
            timestamp: new Date()
          });
        }

        socket.gameId = null;
        socket.playerId = null;
        
        socket.emit('left_game', { message: 'Left game room' });
      } catch (error) {
        console.error('Leave game error:', error);
        socket.emit('error', { message: 'Failed to leave game' });
      }
    });

    // Update player location
    socket.on('update_location', async (data) => {
      try {
        const { playerId, latitude, longitude, accuracy, trigger = 'manual' } = data;
        
        if (!playerId || !latitude || !longitude) {
          socket.emit('error', { message: 'Player ID and coordinates are required' });
          return;
        }

        const player = await Player.findById(playerId).populate('game');
        if (!player) {
          socket.emit('error', { message: 'Player not found' });
          return;
        }

        // Only update location for active games and players
        if (player.game.status !== 'active' || player.status !== 'active') {
          socket.emit('error', { message: 'Cannot update location for inactive player or game' });
          return;
        }

        // Update location
        await player.updateLocation(latitude, longitude, accuracy, trigger);

        // Emit location update to game room (for game masters and hunters)
        socket.to(`game_${player.game._id}`).emit('location_updated', {
          playerId: player._id,
          playerName: player.name,
          role: player.role,
          location: player.currentLocation,
          trigger,
          timestamp: new Date()
        });

        socket.emit('location_update_success', {
          message: 'Location updated successfully',
          location: player.currentLocation
        });

      } catch (error) {
        console.error('Update location error:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // Game master controls
    socket.on('game_control', async (data) => {
      try {
        const { action, gameId, targetPlayerId, ...params } = data;
        
        // Verify user is authenticated and has game master privileges
        if (!socket.user || !['super_admin', 'admin', 'game_master'].includes(socket.user.role)) {
          socket.emit('error', { message: 'Insufficient permissions' });
          return;
        }

        const game = await Game.findById(gameId);
        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        // Check if user has access to this game
        if (socket.user.role !== 'super_admin' && 
            game.createdBy.toString() !== socket.user._id.toString()) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        switch (action) {
          case 'start_game':
            if (game.status === 'setup' || game.status === 'waiting') {
              game.status = 'active';
              game.startTime = new Date();
              game.endTime = new Date(Date.now() + (game.duration * 60 * 1000));
              await game.save();

              // Update all players to active
              await Player.updateMany(
                { game: gameId, status: 'waiting' },
                { status: 'active' }
              );

              io.to(`game_${gameId}`).emit('game_started', {
                gameId,
                startTime: game.startTime,
                endTime: game.endTime,
                message: 'Game has started!'
              });
            }
            break;

          case 'end_game':
            if (game.status === 'active') {
              game.status = 'completed';
              game.results.gameEndReason = 'manual';
              await game.save();

              io.to(`game_${gameId}`).emit('game_ended', {
                gameId,
                reason: 'manual',
                message: 'Game has been ended by game master'
              });
            }
            break;

          case 'pause_game':
            if (game.status === 'active') {
              game.status = 'paused';
              await game.save();

              io.to(`game_${gameId}`).emit('game_paused', {
                gameId,
                message: 'Game has been paused'
              });
            }
            break;

          case 'resume_game':
            if (game.status === 'paused') {
              game.status = 'active';
              await game.save();

              io.to(`game_${gameId}`).emit('game_resumed', {
                gameId,
                message: 'Game has been resumed'
              });
            }
            break;

          case 'catch_player':
            if (targetPlayerId) {
              const player = await Player.findById(targetPlayerId);
              if (player && player.role === 'fugitive' && player.status === 'active') {
                player.status = 'caught';
                await player.save();

                io.to(`game_${gameId}`).emit('player_caught', {
                  playerId: targetPlayerId,
                  playerName: player.name,
                  location: player.currentLocation,
                  caughtBy: socket.user.name,
                  timestamp: new Date()
                });
              }
            }
            break;

          default:
            socket.emit('error', { message: 'Unknown game control action' });
        }

      } catch (error) {
        console.error('Game control error:', error);
        socket.emit('error', { message: 'Game control action failed' });
      }
    });

    // Chat message
    socket.on('chat_message', async (data) => {
      try {
        const { gameId, message, playerId } = data;
        
        if (!gameId || !message) {
          socket.emit('error', { message: 'Game ID and message are required' });
          return;
        }

        let senderName = 'Anonymous';
        let senderRole = 'spectator';

        // Get sender info
        if (playerId) {
          const player = await Player.findById(playerId);
          if (player) {
            senderName = player.name;
            senderRole = player.role;
          }
        } else if (socket.user) {
          senderName = socket.user.name;
          senderRole = socket.user.role;
        }

        const chatMessage = {
          id: socket.id + '_' + Date.now(),
          gameId,
          message: message.trim(),
          sender: {
            name: senderName,
            role: senderRole,
            playerId: playerId || null,
            userId: socket.user?._id || null
          },
          timestamp: new Date()
        };

        // Broadcast to game room
        io.to(`game_${gameId}`).emit('chat_message', chatMessage);

      } catch (error) {
        console.error('Chat message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Heartbeat for keeping connection alive
    socket.on('heartbeat', async () => {
      if (socket.playerId) {
        try {
          const player = await Player.findById(socket.playerId);
          if (player) {
            player.lastSeen = new Date();
            await player.save();
          }
        } catch (error) {
          console.error('Heartbeat error:', error);
        }
      }
      
      socket.emit('heartbeat_ack', { timestamp: new Date() });
    });

    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
      
      try {
        // Update player offline status
        if (socket.playerId) {
          const player = await Player.findById(socket.playerId);
          if (player) {
            player.isOnline = false;
            player.socketId = null;
            await player.save();
          }
        }

        // Notify game room
        if (socket.gameId) {
          socket.to(`game_${socket.gameId}`).emit('player_disconnected', {
            socketId: socket.id,
            playerId: socket.playerId || null,
            reason,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Disconnect cleanup error:', error);
      }
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Periodic cleanup of offline players
  setInterval(async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      await Player.updateMany(
        { 
          isOnline: true,
          lastSeen: { $lt: fiveMinutesAgo }
        },
        { 
          isOnline: false,
          socketId: null
        }
      );
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, 300000); // Run every 5 minutes

  console.log('Socket.IO handler initialized');
}

module.exports = socketHandler;
