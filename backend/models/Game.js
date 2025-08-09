const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const { v4: uuidv4 } = require('uuid');

const taskSchema = new mongoose.Schema({
  taskNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 6
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    address: {
      type: String,
      trim: true
    }
  },
  qrCode: {
    type: String, // Base64 encoded QR code image
    required: true
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedBy: [{
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player'
    },
    completedAt: {
      type: Date,
      default: Date.now
    }
  }]
});

const gameSchema = new mongoose.Schema({
  gameCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    length: 6
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  gameMaster: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['setup', 'waiting', 'active', 'paused', 'completed', 'cancelled'],
    default: 'setup'
  },
  extractionPoint: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    address: {
      type: String,
      trim: true
    },
    radius: {
      type: Number,
      default: 50 // meters
    }
  },
  tasks: [taskSchema],
  duration: {
    type: Number,
    default: 120, // minutes
    min: 30,
    max: 480
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  settings: {
    locationUpdateInterval: {
      type: Number,
      default: 15 // minutes
    },
    timerWarningMinutes: {
      type: Number,
      default: 30
    },
    maxPlayers: {
      type: Number,
      default: 20,
      min: 2,
      max: 50
    },
    allowSpectators: {
      type: Boolean,
      default: false
    }
  },
  results: {
    winner: {
      type: String,
      enum: ['fugitives', 'hunters', 'none']
    },
    fugitivesEscaped: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player'
    }],
    fugitivesCaught: [{
      player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      },
      caughtBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      },
      caughtAt: {
        type: Date
      },
      location: {
        latitude: Number,
        longitude: Number
      }
    }],
    completedTasks: {
      type: Number,
      default: 0
    },
    gameEndReason: {
      type: String,
      enum: ['time_up', 'all_fugitives_caught', 'fugitives_escaped', 'cancelled']
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for performance
gameSchema.index({ gameCode: 1 });
gameSchema.index({ createdBy: 1 });
gameSchema.index({ status: 1 });
gameSchema.index({ startTime: 1 });

// Generate unique game code
gameSchema.pre('save', async function(next) {
  if (!this.gameCode) {
    let code;
    let isUnique = false;
    
    while (!isUnique) {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existingGame = await this.constructor.findOne({ gameCode: code });
      if (!existingGame) {
        isUnique = true;
      }
    }
    
    this.gameCode = code;
  }
  next();
});

// Calculate end time based on start time and duration
gameSchema.pre('save', function(next) {
  if (this.startTime && this.duration && !this.endTime) {
    this.endTime = new Date(this.startTime.getTime() + (this.duration * 60 * 1000));
  }
  next();
});

// Virtual for remaining time
gameSchema.virtual('remainingTime').get(function() {
  if (!this.startTime || this.status !== 'active') return null;
  
  const now = new Date();
  const endTime = this.endTime || new Date(this.startTime.getTime() + (this.duration * 60 * 1000));
  const remaining = endTime.getTime() - now.getTime();
  
  return Math.max(0, Math.floor(remaining / 1000)); // seconds
});

// Virtual for game progress
gameSchema.virtual('progress').get(function() {
  if (!this.startTime) return 0;
  
  const now = new Date();
  const totalDuration = this.duration * 60 * 1000; // milliseconds
  const elapsed = now.getTime() - this.startTime.getTime();
  
  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
});

// Method to check if game is expired
gameSchema.methods.isExpired = function() {
  if (!this.startTime || this.status !== 'active') return false;
  
  const now = new Date();
  const endTime = this.endTime || new Date(this.startTime.getTime() + (this.duration * 60 * 1000));
  
  return now > endTime;
};

// Method to get next task for a player
gameSchema.methods.getNextTaskForPlayer = function(playerId) {
  const completedTasks = this.tasks.filter(task => 
    task.completedBy.some(completion => completion.player.toString() === playerId.toString())
  );
  
  const nextTaskNumber = completedTasks.length + 1;
  
  if (nextTaskNumber > 6) return null; // All tasks completed
  
  return this.tasks.find(task => task.taskNumber === nextTaskNumber);
};

// Static method to find active games
gameSchema.statics.findActiveGames = function() {
  return this.find({ 
    status: 'active',
    isActive: true 
  });
};

// Static method to find games by creator
gameSchema.statics.findByCreator = function(creatorId) {
  return this.find({ 
    createdBy: creatorId,
    isActive: true 
  }).sort({ createdAt: -1 });
};

// Add pagination plugin
gameSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Game', gameSchema);
