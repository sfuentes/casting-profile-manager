# Quick Start Guide

## Prerequisites Check

Before starting, ensure you have:

- ✅ **Node.js** (v18+): Run `node --version`
- ✅ **npm** (v8+): Run `npm --version`
- ✅ **MongoDB**: See INSTALL-MONGODB.md if not installed

## Installation (First Time Only)

### 1. Install All Dependencies

```bash
npm run install-all
```

This will install dependencies for:
- Root project (concurrently for running both servers)
- Backend (Express API server)
- Frontend (React + Vite)

### 2. Install MongoDB

If you don't have MongoDB installed:
- **Detailed Guide**: See `INSTALL-MONGODB.md`
- **Quick Link**: https://www.mongodb.com/try/download/community
- **Cloud Option**: Use MongoDB Atlas (free tier)

### 3. Configure Backend

The backend uses `backend/.env` for configuration. A default `.env` file should exist, but verify these settings:

```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/darsteller-manager
JWT_SECRET=your-secret-key-here
```

**Important**: Change `JWT_SECRET` to a secure random string in production!

### 4. Seed Database (Optional)

Populate the database with sample data:

```bash
npm run seed
```

## Starting the Application

### Option 1: Windows Startup Script (Easiest)

Double-click or run:
```bash
START.bat
```

This opens two windows:
- Backend server (port 5000)
- Frontend dev server (port 5173)

### Option 2: Single Command

```bash
npm start
```

This runs both servers in the same terminal window.

### Option 3: Manual (Separate Terminals)

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

## Access Points

Once running:

- 🌐 **Frontend**: http://localhost:5173
- 🔧 **Backend API**: http://localhost:5000
- ❤️ **Health Check**: http://localhost:5000/health

## First Login

### Option 1: Register New Account
1. Open http://localhost:5173
2. Click "Register" or switch to registration
3. Fill in your details
4. Submit and login

### Option 2: Use Seeded Data
If you ran `npm run seed`, use:
- **Email**: demo@example.com
- **Password**: password123

## Common Issues

### "Cannot connect to MongoDB"
- **Fix**: Start MongoDB service
- **Windows**: `net start MongoDB` (as Admin)
- **Mac**: `brew services start mongodb-community`
- **Linux**: `sudo systemctl start mongod`

### "Port 5000 already in use"
- **Fix**: Another process is using port 5000
- **Solution 1**: Stop that process
- **Solution 2**: Change `PORT` in `backend/.env`

### "Port 5173 already in use"
- **Fix**: Vite will auto-prompt to use next available port
- Or stop the other Vite server

### Dependencies not found
- **Fix**: Run `npm run install-all`

## Project Structure

```
casting-profile-manager/
├── backend/              # Express.js API
│   ├── src/
│   │   ├── controllers/  # Request handlers
│   │   ├── models/       # MongoDB schemas
│   │   ├── routes/       # API endpoints
│   │   ├── middleware/   # Auth, validation, errors
│   │   └── index.js      # Entry point
│   └── package.json
├── frontend/             # React + Vite
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── context/      # App state management
│   │   ├── services/     # API calls
│   │   └── App.jsx       # Main component
│   └── package.json
└── package.json          # Root scripts
```

## Available Commands

### Root Level
```bash
npm start              # Start both backend and frontend
npm run dev            # Same as start
npm run backend        # Start only backend
npm run frontend       # Start only frontend
npm run install-all    # Install all dependencies
npm run seed           # Seed database with data
```

### Backend Only
```bash
cd backend
npm run dev           # Development with auto-reload
npm start             # Production mode
npm test              # Run tests
npm run lint          # Check code style
npm run seed          # Seed database
npm run seed:destroy  # Clear database
```

### Frontend Only
```bash
cd frontend
npm run dev           # Development server
npm run build         # Build for production
npm run preview       # Preview production build
npm run lint          # Check code style
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Profile
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update profile
- `POST /api/profile/work-history` - Add work history
- `POST /api/profile/education` - Add education

### Platforms
- `GET /api/platforms` - Get all platforms
- `POST /api/platforms/:id/connect` - Connect platform
- `POST /api/platforms/:id/disconnect` - Disconnect platform
- `POST /api/platforms/:id/sync` - Sync data to platform

### Bookings
- `GET /api/bookings` - Get all bookings
- `POST /api/bookings` - Create booking
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Delete booking

### Availability
- `GET /api/availability` - Get availability
- `POST /api/availability` - Add availability
- `PUT /api/availability/:id` - Update availability
- `DELETE /api/availability/:id` - Delete availability

## Development Workflow

1. **Start Services**: Run `START.bat` or `npm start`
2. **Code Changes**:
   - Backend auto-reloads with nodemon
   - Frontend auto-reloads with Vite HMR
3. **Check Logs**: Monitor terminal output for errors
4. **Test API**: Use browser DevTools or Postman
5. **Debug**: Check backend console and browser console

## Stopping the Application

### If using START.bat
Close both terminal windows (Backend and Frontend)

### If using npm start
Press `Ctrl+C` in the terminal

### MongoDB
MongoDB service keeps running. To stop:
- **Windows**: `net stop MongoDB` (as Admin)
- **Mac**: `brew services stop mongodb-community`
- **Linux**: `sudo systemctl stop mongod`

## Next Steps

1. ✅ Complete setup above
2. 📚 Read full documentation: `SETUP.md`
3. 🗄️ Review database setup: `INSTALL-MONGODB.md`
4. 🎨 Explore the UI at http://localhost:5173
5. 🔧 Test API endpoints at http://localhost:5000
6. 📝 Start building your features!

## Need Help?

- Check `SETUP.md` for detailed documentation
- Review `INSTALL-MONGODB.md` for database issues
- Ensure all services are running
- Check terminal output for error messages
- Verify environment variables in `backend/.env`
