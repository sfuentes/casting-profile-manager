# Casting Profile Manager - Setup Guide

## Prerequisites

### 1. Node.js
- **Required Version**: Node.js >= 18.0.0 and npm >= 8.0.0
- **Check your version**: `node --version` and `npm --version`
- **Download**: https://nodejs.org/ (LTS version recommended)

### 2. MongoDB
MongoDB is **required** for this application to run.

#### Option A: Install MongoDB Community Edition (Recommended)
1. **Download MongoDB Community Server**: https://www.mongodb.com/try/download/community
2. **Install MongoDB**:
   - Choose "Complete" installation
   - Check "Install MongoDB as a Service" during installation
   - Default port is 27017
3. **Verify Installation**:
   ```bash
   mongod --version
   ```
4. **Start MongoDB Service** (if not auto-started):
   ```bash
   net start MongoDB
   ```

#### Option B: Use MongoDB Atlas (Cloud Database)
1. Create a free account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster (free tier available)
3. Get your connection string
4. Update `backend/.env` with your Atlas connection string

## Installation Steps

### 1. Install Dependencies

Open a terminal in the project root directory and run:

```bash
# Install all dependencies (root, backend, and frontend)
npm run install-all
```

Or manually install for each part:

```bash
# Install root dependencies (concurrently for running both servers)
npm install

# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Configure Environment Variables

The backend needs environment variables configured:

```bash
# Check if backend/.env exists
# If not, it will use backend/.env.example as template
```

Key environment variables in `backend/.env`:
- `PORT=5000` - Backend server port
- `MONGO_URI=mongodb://127.0.0.1:27017/darsteller-manager` - MongoDB connection
- `JWT_SECRET=your-secret-key-here` - Change this to a secure random string
- `NODE_ENV=development` - Environment mode

### 3. Start MongoDB

**Windows:**
```bash
# As Administrator
net start MongoDB
```

**Mac/Linux:**
```bash
# Using Homebrew
brew services start mongodb-community

# Or manually
mongod --dbpath /path/to/data/directory
```

### 4. Seed Database (Optional)

To populate the database with initial data:

```bash
npm run seed
```

To clear all data:

```bash
npm run seed:destroy
```

## Running the Application

### Option 1: Use the Startup Script (Windows)

Simply double-click `START.bat` or run:

```bash
START.bat
```

This will:
1. Check if MongoDB is running
2. Start the backend server
3. Start the frontend development server
4. Open two terminal windows for each server

### Option 2: Use npm Scripts

**Run both frontend and backend together:**
```bash
npm start
# or
npm run dev
```

**Run backend only:**
```bash
npm run backend
# or
cd backend && npm run dev
```

**Run frontend only:**
```bash
npm run frontend
# or
cd frontend && npm run dev
```

### Option 3: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Accessing the Application

Once all services are running:

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

## Default Credentials

After seeding, you can use these default credentials:

- **Email**: demo@example.com
- **Password**: password123

## Troubleshooting

### MongoDB Connection Issues

**Error**: "MongoServerError: connect ECONNREFUSED 127.0.0.1:27017"
- **Solution**: MongoDB is not running. Start MongoDB service first.

**Error**: "MongooseError: Operation `users.findOne()` buffering timed out"
- **Solution**: Check MongoDB is running and accessible at the configured URI.

### Port Already in Use

**Error**: "EADDRINUSE: address already in use :::5000"
- **Solution**: Another process is using port 5000. Either stop that process or change PORT in backend/.env

**Error**: "Port 5173 is already in use"
- **Solution**: Another Vite server is running. Close it or the frontend will prompt to use a different port.

### Module Not Found Errors

**Error**: "Cannot find module 'express'"
- **Solution**: Dependencies not installed. Run `npm run install-all`

### CORS Errors

**Error**: "CORS policy: No 'Access-Control-Allow-Origin' header"
- **Solution**: Make sure both frontend and backend are running. Backend CORS is configured for http://localhost:5173

## Development Scripts

### Backend Scripts

```bash
cd backend

# Start with nodemon (auto-restart on changes)
npm run dev

# Start without nodemon
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Seed database
npm run seed

# Clear database
npm run seed:destroy
```

### Frontend Scripts

```bash
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Project Structure

```
casting-profile-manager/
├── backend/                # Backend API server
│   ├── src/
│   │   ├── config/        # Configuration files
│   │   ├── controllers/   # Route controllers
│   │   ├── middleware/    # Express middleware
│   │   ├── models/        # Mongoose models
│   │   ├── routes/        # API routes
│   │   ├── utils/         # Utility functions
│   │   └── index.js       # Server entry point
│   ├── .env               # Environment variables
│   └── package.json
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── context/       # Context providers
│   │   ├── services/      # API services
│   │   └── App.jsx        # Main app component
│   ├── public/
│   └── package.json
├── START.bat              # Windows startup script
├── SETUP.md              # This file
└── package.json          # Root package.json
```

## Next Steps

1. Install prerequisites (Node.js and MongoDB)
2. Run `npm run install-all`
3. Start MongoDB
4. Run `npm run seed` (optional)
5. Run `START.bat` or `npm start`
6. Open http://localhost:5173 in your browser
7. Login or register a new account

## Support

For issues or questions:
- Check the troubleshooting section above
- Review the backend logs in the terminal
- Check the browser console for frontend errors
- Ensure all services are running (MongoDB, Backend, Frontend)
