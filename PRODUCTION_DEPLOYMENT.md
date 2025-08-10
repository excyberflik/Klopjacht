# KLOPJACHT - Production Deployment Guide

This guide will help you deploy your KLOPJACHT application to production using various hosting platforms.

## 📋 Pre-Deployment Checklist

### 1. Environment Configuration

#### Backend Environment Variables
Create a production `.env` file in the `backend` folder:

```env
# Database
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/klopjacht-prod?retryWrites=true&w=majority

# JWT Secret (generate a strong secret)
JWT_SECRET=your-super-secure-jwt-secret-key-here

# Server Configuration
PORT=5000
NODE_ENV=production

# CORS Configuration
FRONTEND_URL=https://your-frontend-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend Environment Variables
Create a production `.env` file in the `frontend` folder:

```env
# API Configuration
REACT_APP_API_URL=https://your-backend-domain.com/api
REACT_APP_ENVIRONMENT=production

# Optional: Analytics, monitoring, etc.
REACT_APP_GOOGLE_ANALYTICS_ID=your-ga-id
```

### 2. Code Optimization

#### Backend Optimizations
Update `backend/server.js` for production:

```javascript
// Add at the top
if (process.env.NODE_ENV === 'production') {
  // Trust proxy for proper IP detection behind load balancers
  app.set('trust proxy', 1);
  
  // Enhanced security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
}
```

#### Frontend Optimizations
Update `frontend/src/config/api.ts`:

```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://your-backend-domain.com/api'
    : 'http://localhost:5000/api');
```

## 🚀 Deployment Options

### Option 1: Heroku (Recommended for beginners)

#### Backend Deployment to Heroku

1. **Install Heroku CLI**
   ```bash
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Prepare Backend for Heroku**
   ```bash
   cd backend
   
   # Create Procfile
   echo "web: node server.js" > Procfile
   
   # Update package.json
   ```
   
   Add to `backend/package.json`:
   ```json
   {
     "scripts": {
       "start": "node server.js",
       "dev": "nodemon server.js"
     },
     "engines": {
       "node": "18.x",
       "npm": "9.x"
     }
   }
   ```

3. **Deploy Backend**
   ```bash
   # Initialize git (if not already done)
   git init
   git add .
   git commit -m "Initial backend commit"
   
   # Create Heroku app
   heroku create klopjacht-backend
   
   # Set environment variables
   heroku config:set MONGODB_URI="your-mongodb-connection-string"
   heroku config:set JWT_SECRET="your-jwt-secret"
   heroku config:set NODE_ENV="production"
   heroku config:set FRONTEND_URL="https://your-frontend-domain.netlify.app"
   
   # Deploy
   git push heroku main
   ```

#### Frontend Deployment to Netlify

1. **Prepare Frontend for Production**
   ```bash
   cd frontend
   
   # Build production version
   npm run build
   ```

2. **Deploy to Netlify**
   - Go to [netlify.com](https://netlify.com)
   - Sign up/login
   - Drag and drop the `build` folder
   - Or connect your GitHub repository for automatic deployments

3. **Configure Netlify**
   Create `frontend/public/_redirects`:
   ```
   /*    /index.html   200
   ```
   
   Set environment variables in Netlify dashboard:
   ```
   REACT_APP_API_URL=https://klopjacht-backend.herokuapp.com/api
   REACT_APP_ENVIRONMENT=production
   ```

### Option 2: DigitalOcean App Platform

1. **Create DigitalOcean Account**
   - Sign up at [digitalocean.com](https://digitalocean.com)

2. **Deploy via App Platform**
   - Connect your GitHub repository
   - Configure build settings:
     
     **Backend:**
     ```yaml
     name: klopjacht-backend
     source_dir: /backend
     github:
       repo: your-username/klopjacht
       branch: main
     run_command: node server.js
     environment_slug: node-js
     instance_count: 1
     instance_size_slug: basic-xxs
     envs:
       - key: MONGODB_URI
         value: your-mongodb-uri
       - key: JWT_SECRET
         value: your-jwt-secret
       - key: NODE_ENV
         value: production
     ```
     
     **Frontend:**
     ```yaml
     name: klopjacht-frontend
     source_dir: /frontend
     github:
       repo: your-username/klopjacht
       branch: main
     build_command: npm run build
     output_dir: /build
     environment_slug: node-js
     instance_count: 1
     instance_size_slug: basic-xxs
     envs:
       - key: REACT_APP_API_URL
         value: https://klopjacht-backend-xxxxx.ondigitalocean.app/api
     ```

### Option 3: AWS (Advanced)

#### Using AWS Elastic Beanstalk

1. **Install AWS CLI and EB CLI**
   ```bash
   pip install awscli awsebcli
   aws configure
   ```

2. **Deploy Backend**
   ```bash
   cd backend
   eb init
   eb create klopjacht-backend-prod
   eb deploy
   ```

3. **Deploy Frontend to S3 + CloudFront**
   ```bash
   cd frontend
   npm run build
   aws s3 sync build/ s3://your-bucket-name
   ```

### Option 4: VPS (Most Control)

#### Using Ubuntu Server

1. **Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2 for process management
   sudo npm install -g pm2
   
   # Install Nginx
   sudo apt install nginx -y
   ```

2. **Deploy Backend**
   ```bash
   # Clone repository
   git clone https://github.com/your-username/klopjacht.git
   cd klopjacht/backend
   
   # Install dependencies
   npm install --production
   
   # Create PM2 ecosystem file
   cat > ecosystem.config.js << EOF
   module.exports = {
     apps: [{
       name: 'klopjacht-backend',
       script: 'server.js',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 5000
       }
     }]
   }
   EOF
   
   # Start with PM2
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

3. **Deploy Frontend**
   ```bash
   cd ../frontend
   npm install
   npm run build
   
   # Copy build to nginx directory
   sudo cp -r build/* /var/www/html/
   ```

4. **Configure Nginx**
   ```bash
   sudo nano /etc/nginx/sites-available/klopjacht
   ```
   
   Add configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       # Frontend
       location / {
           root /var/www/html;
           index index.html;
           try_files $uri $uri/ /index.html;
       }
       
       # Backend API
       location /api {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
   
   Enable site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/klopjacht /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## 🔒 Security Considerations

### 1. SSL/HTTPS Setup

#### For VPS with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

#### For Cloud Platforms
- Most platforms (Heroku, Netlify, DigitalOcean) provide SSL automatically

### 2. Database Security
- Use MongoDB Atlas with IP whitelisting
- Enable database authentication
- Use connection string with SSL

### 3. Environment Variables
- Never commit `.env` files to git
- Use platform-specific environment variable management
- Rotate secrets regularly

## 📊 Monitoring & Maintenance

### 1. Application Monitoring
```bash
# For VPS deployments
pm2 monit

# Set up log rotation
pm2 install pm2-logrotate
```

### 2. Database Monitoring
- Use MongoDB Atlas monitoring
- Set up alerts for high CPU/memory usage
- Monitor connection counts

### 3. Error Tracking
Consider integrating services like:
- Sentry for error tracking
- LogRocket for session replay
- New Relic for performance monitoring

## 🔄 CI/CD Pipeline (Optional)

### GitHub Actions Example
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Deploy to Heroku
        uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{secrets.HEROKU_API_KEY}}
          heroku_app_name: "klopjacht-backend"
          heroku_email: "your-email@example.com"
          appdir: "backend"

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Build and Deploy to Netlify
        run: |
          cd frontend
          npm install
          npm run build
          npx netlify-cli deploy --prod --dir=build
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## 🎯 Recommended Production Stack

For most users, I recommend:

1. **Backend**: Heroku (easy) or DigitalOcean App Platform (more features)
2. **Frontend**: Netlify (free tier available) or Vercel
3. **Database**: MongoDB Atlas (managed service)
4. **Domain**: Namecheap or Google Domains
5. **SSL**: Automatic with chosen platforms
6. **Monitoring**: Built-in platform monitoring + Sentry for errors

## 📞 Support

If you encounter issues during deployment:

1. Check the platform-specific logs
2. Verify environment variables are set correctly
3. Ensure database connectivity
4. Check CORS configuration
5. Verify build processes complete successfully

## 🚀 Quick Start Commands

```bash
# Backend production build
cd backend
npm install --production
npm start

# Frontend production build
cd frontend
npm install
npm run build
npm install -g serve
serve -s build -l 3000
```

Your KLOPJACHT application is now ready for production! 🎉
