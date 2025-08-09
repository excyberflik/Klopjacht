# 🔍 Klopjacht - Interactive Chase Game

Klopjacht is an interactive outdoor chase game where fugitives must try to escape from hunters within a set time limit. Along the way, the fugitives must complete various tasks to gather the coordinates of the extraction point (escape point). Will they make it in time without getting caught?

## 🎯 Game Overview

### For Fugitives
- Complete 6 missions spread out across the location
- With each correct answer, receive the coordinates for the next task location
- Reach the correct extraction point before time runs out and "escape"

### For Hunters
- Receive a real-time location update of the fugitives every 15 minutes
- These are triggered when fugitives:
  - Pass a surveillance camera
  - Withdraw money
  - Make a phone call
- Prevent the fugitives from reaching the extraction point in time

### For Game Masters (Admin)
- Manages the game, sees everything, sets extraction point and tasks
- Create new game (unique code)
- View player list with their roles
- Live player location tracking on map
- Set extraction point on map
- Create 6 tasks linked to QR codes
- Start and end the game
- Delete the game

## 🏗️ Architecture

This application consists of:
- **Backend**: Node.js with Express, MongoDB, Socket.IO for real-time communication
- **Frontend**: React with TypeScript, styled-components, Leaflet maps
- **Real-time Features**: WebSocket connections for live updates
- **Mobile-First**: Responsive design optimized for mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Klopjacht
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install

   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example environment file
   cp backend/.env.example backend/.env
   ```

   Edit `backend/.env` with your configuration:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # Database
   MONGODB_URI=mongodb://localhost:27017/klopjacht

   # JWT Secret (change this!)
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

   # Super Admin Credentials
   SUPER_ADMIN_EMAIL=admin@klopjacht.com
   SUPER_ADMIN_PASSWORD=SuperAdmin123!

   # CORS Origins
   CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

   # Game Settings
   GAME_DURATION_MINUTES=120
   LOCATION_UPDATE_INTERVAL_MINUTES=15
   TIMER_WARNING_MINUTES=30
   ```

4. **Start MongoDB**
   
   Make sure MongoDB is running on your system:
   ```bash
   # If using local MongoDB
   mongod

   # Or if using MongoDB as a service
   sudo systemctl start mongod
   ```

5. **Start the application**
   ```bash
   # From the root directory, start both backend and frontend
   npm run dev
   ```

   Or start them separately:
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend
   cd frontend
   npm start
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - API Health Check: http://localhost:5000/health

## 🔧 Development

### Project Structure

```
Klopjacht/
├── backend/                 # Node.js backend
│   ├── config/             # Database configuration
│   ├── middleware/         # Express middleware
│   ├── models/            # MongoDB models
│   ├── routes/            # API routes
│   ├── socket/            # Socket.IO handlers
│   └── server.js          # Main server file
├── frontend/              # React frontend
│   ├── public/           # Static files
│   ├── src/              # Source code
│   │   ├── components/   # Reusable components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API services
│   │   ├── store/        # State management
│   │   ├── styles/       # Styling
│   │   └── types/        # TypeScript types
│   └── package.json
└── package.json          # Root package.json
```

### Available Scripts

**Root level:**
- `npm run dev` - Start both backend and frontend in development mode
- `npm run install-all` - Install dependencies for all packages

**Backend:**
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests

**Frontend:**
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests

### API Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Register new admin (super admin only)
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password

#### Games
- `GET /api/games` - Get all games for authenticated user
- `POST /api/games` - Create new game
- `GET /api/games/:id` - Get specific game
- `PUT /api/games/:id` - Update game
- `POST /api/games/:id/tasks` - Add tasks to game
- `POST /api/games/:id/start` - Start game
- `POST /api/games/:id/end` - End game
- `DELETE /api/games/:id` - Delete game
- `GET /api/games/code/:gameCode` - Get game by code (for players)

#### Players
- `POST /api/players/join` - Join game as player
- `GET /api/players/game/:gameId` - Get all players in game
- `PUT /api/players/:id/location` - Update player location
- `PUT /api/players/:id/status` - Update player status
- `POST /api/players/:id/permissions` - Update player permissions

#### Tasks
- `GET /api/tasks/:gameId/:taskNumber` - Get task (via QR code)
- `POST /api/tasks/:gameId/:taskNumber/submit` - Submit task answer
- `GET /api/tasks/player/:playerId/current` - Get current task for player
- `GET /api/tasks/player/:playerId/completed` - Get completed tasks

#### Admin
- `GET /api/admin/dashboard` - Admin dashboard statistics
- `GET /api/admin/users` - Get all users (super admin only)
- `POST /api/admin/users` - Create admin user
- `GET /api/admin/games` - Get all games with admin filtering

## 🎮 How to Play

### Setting Up a Game

1. **Admin Login**: Access the admin panel with super admin credentials
2. **Create Game**: Set up a new game with:
   - Game name and description
   - Duration (30-480 minutes)
   - Extraction point coordinates
   - Maximum players
3. **Create Tasks**: Add 6 tasks with:
   - Questions and answers
   - Location coordinates for each task
   - QR codes are automatically generated
4. **Share Game Code**: Give the 6-character game code to players

### For Players

1. **Join Game**: Enter the game code to join
2. **Choose Role**: Select fugitive, hunter, or spectator
3. **Grant Permissions**: Allow location and camera access
4. **Wait for Start**: Game master will start the game

### During the Game

**Fugitives:**
- Scan QR codes at task locations
- Answer questions correctly to get next location
- Avoid hunters while completing tasks
- Reach extraction point after completing all 6 tasks

**Hunters:**
- Monitor fugitive locations on the map
- Receive location updates every 15 minutes
- Try to intercept fugitives before they escape

**Game Master:**
- Monitor all players on the live map
- Control game state (start, pause, end)
- Mark players as caught if needed

## 🔒 Security Features

- JWT-based authentication
- Role-based access control
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS protection
- Helmet.js security headers
- Password hashing with bcrypt

## 📱 Mobile Features

- Progressive Web App (PWA) support
- Responsive design for all screen sizes
- Geolocation API integration
- Camera access for QR code scanning
- Offline capability (limited)
- Push notifications (planned)

## 🗺️ Maps Integration

- Leaflet.js for interactive maps
- Real-time player location tracking
- Custom markers for different player types
- Extraction point visualization
- Task location markers

## 🔧 Configuration

### Environment Variables

See `backend/.env.example` for all available configuration options.

### Game Settings

- **Duration**: 30-480 minutes
- **Location Updates**: Every 15 minutes (configurable)
- **Timer Warning**: Last 30 minutes (configurable)
- **Max Players**: 2-50 per game
- **Extraction Radius**: 50 meters (configurable)

## 🚀 Deployment

### Production Build

1. **Build Frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Set Production Environment**
   ```bash
   # Update backend/.env
   NODE_ENV=production
   MONGODB_URI=your-production-mongodb-uri
   JWT_SECRET=your-production-jwt-secret
   ```

3. **Start Production Server**
   ```bash
   cd backend
   npm start
   ```

### Docker Deployment (Optional)

```dockerfile
# Dockerfile example for backend
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

## 🎯 Roadmap

- [ ] Push notifications
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Team-based gameplay
- [ ] Custom game modes
- [ ] Integration with external maps
- [ ] Mobile app versions (iOS/Android)

---

**Built with ❤️ for outdoor adventure gaming**
