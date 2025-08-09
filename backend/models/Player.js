const mongoose = require('mongoose');

const locationHistorySchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  accuracy: {
    type: Number // GPS accuracy in meters
  },
  trigger: {
    type: String,
    enum: ['manual', 'automatic', 'surveillance', 'atm', 'phone_call', 'task_completion'],
    default: 'manual'
  }
});

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  game: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Game',
    required: true
  },
  role: {
    type: String,
    enum: ['fugitive', 'hunter', 'spectator'],
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'caught', 'escaped', 'disconnected'],
    default: 'waiting'
  },
  currentLocation: {
    latitude: {
      type: Number
    },
    longitude: {
      type: Number
    },
    lastUpdated: {
      type: Date
    },
    accuracy: {
      type: Number
    }
  },
  locationHistory: [locationHistorySchema],
  completedTasks: [{
    taskId: {
      type: mongoose.Schema.Types.ObjectId
    },
    taskNumber: {
      type: Number
    },
    completedAt: {
      type: Date,
      default: Date.now
    },
    location: {
      latitude: Number,
      longitude: Number
    }
  }],
  team: {
    type: String,
    trim: true
  },
  deviceInfo: {
    userAgent: String,
    platform: String,
    screenResolution: String,
    timezone: String
  },
  permissions: {
    location: {
      type: Boolean,
      default: false
    },
    camera: {
      type: Boolean,
      default: false
    },
    notifications: {
      type: Boolean,
      default: false
    }
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  socketId: {
    type: String
  },
  gameStats: {
    tasksCompleted: {
      type: Number,
      default: 0
    },
    distanceTraveled: {
      type: Number,
      default: 0 // in meters
    },
    timeActive: {
      type: Number,
      default: 0 // in seconds
    },
    lastLocationUpdate: {
      type: Date
    }
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Indexes for performance
playerSchema.index({ game: 1 });
playerSchema.index({ role: 1 });
playerSchema.index({ status: 1 });
playerSchema.index({ 'currentLocation.lastUpdated': 1 });
playerSchema.index({ lastSeen: 1 });

// Update last seen when player is active
playerSchema.pre('save', function(next) {
  if (this.isOnline) {
    this.lastSeen = new Date();
  }
  next();
});

// Method to update location
playerSchema.methods.updateLocation = function(latitude, longitude, accuracy = null, trigger = 'manual') {
  // Update current location
  this.currentLocation = {
    latitude,
    longitude,
    lastUpdated: new Date(),
    accuracy
  };

  // Add to location history
  this.locationHistory.push({
    latitude,
    longitude,
    accuracy,
    trigger
  });

  // Keep only last 100 location points to prevent document size issues
  if (this.locationHistory.length > 100) {
    this.locationHistory = this.locationHistory.slice(-100);
  }

  // Update game stats
  this.gameStats.lastLocationUpdate = new Date();

  return this.save();
};

// Method to calculate distance traveled
playerSchema.methods.calculateDistanceTraveled = function() {
  if (this.locationHistory.length < 2) return 0;

  let totalDistance = 0;
  
  for (let i = 1; i < this.locationHistory.length; i++) {
    const prev = this.locationHistory[i - 1];
    const curr = this.locationHistory[i];
    
    totalDistance += this.calculateDistance(
      prev.latitude, prev.longitude,
      curr.latitude, curr.longitude
    );
  }

  this.gameStats.distanceTraveled = totalDistance;
  return totalDistance;
};

// Method to calculate distance between two points (Haversine formula)
playerSchema.methods.calculateDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

// Method to check if player is near a location
playerSchema.methods.isNearLocation = function(targetLat, targetLon, radiusMeters = 50) {
  if (!this.currentLocation.latitude || !this.currentLocation.longitude) {
    return false;
  }

  const distance = this.calculateDistance(
    this.currentLocation.latitude,
    this.currentLocation.longitude,
    targetLat,
    targetLon
  );

  return distance <= radiusMeters;
};

// Method to complete a task
playerSchema.methods.completeTask = function(taskId, taskNumber, location = null) {
  const taskLocation = location || this.currentLocation;
  
  this.completedTasks.push({
    taskId,
    taskNumber,
    completedAt: new Date(),
    location: taskLocation
  });

  this.gameStats.tasksCompleted = this.completedTasks.length;
  
  return this.save();
};

// Virtual for player's current task number
playerSchema.virtual('currentTaskNumber').get(function() {
  return this.completedTasks.length + 1;
});

// Virtual for time since last location update
playerSchema.virtual('timeSinceLastLocation').get(function() {
  if (!this.currentLocation.lastUpdated) return null;
  
  const now = new Date();
  const lastUpdate = this.currentLocation.lastUpdated;
  
  return Math.floor((now - lastUpdate) / 1000); // seconds
});

// Static method to find players by game
playerSchema.statics.findByGame = function(gameId) {
  return this.find({ game: gameId }).populate('game');
};

// Static method to find fugitives in a game
playerSchema.statics.findFugitivesByGame = function(gameId) {
  return this.find({ 
    game: gameId, 
    role: 'fugitive',
    status: { $in: ['waiting', 'active'] }
  });
};

// Static method to find hunters in a game
playerSchema.statics.findHuntersByGame = function(gameId) {
  return this.find({ 
    game: gameId, 
    role: 'hunter',
    status: { $in: ['waiting', 'active'] }
  });
};

// Static method to find online players
playerSchema.statics.findOnlineByGame = function(gameId) {
  return this.find({ 
    game: gameId,
    isOnline: true,
    lastSeen: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
  });
};

module.exports = mongoose.model('Player', playerSchema);
