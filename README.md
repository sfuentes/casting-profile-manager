# Casting Profile Manager

A comprehensive platform for managing actor/actress profiles, bookings, availability, and platform integrations.

## 🚀 Quick Start

**Choose your preferred method:**

### Option 1: 🐳 Docker (Easiest - No MongoDB Installation!)

**Includes MongoDB automatically!**

```bash
# Windows
docker-start.bat

# Mac/Linux
./docker-start.sh
```

→ Read [`DOCKER-QUICKSTART.md`](DOCKER-QUICKSTART.md) for details

### Option 2: Traditional Setup

**New to this project?** → Read [`QUICK-START.md`](QUICK-START.md)

**Need to install MongoDB?** → Read [`INSTALL-MONGODB.md`](INSTALL-MONGODB.md)

**Want detailed setup info?** → Read [`SETUP.md`](SETUP.md)

#### TL;DR - Traditional Setup in 3 Steps

1. **Install MongoDB** (if not installed)
   ```bash
   # Download from: https://www.mongodb.com/try/download/community
   # Or use MongoDB Atlas (cloud, free tier)
   ```

2. **Install Dependencies**
   ```bash
   npm run install-all
   ```

3. **Start Everything**
   ```bash
   # Windows: Double-click START.bat
   # Or run:
   npm start
   ```

### Access Points

- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## 📋 Features

### Core Features
- 🔐 **User Authentication** - Secure JWT-based authentication
- 👤 **Profile Management** - Comprehensive actor/actress profiles
- 📅 **Calendar & Availability** - Manage bookings and availability
- 🎬 **Booking System** - Track confirmed bookings and options
- 🌐 **Platform Integration** - Connect multiple casting platforms
- 📸 **Media Management** - Profile photos and setcard management
- 🔄 **Data Synchronization** - Sync profiles across platforms

### Platform Integrations
- Filmmakers.de
- Casting Network
- Schauspielervideos.de
- e-TALENTA
- JobWork
- Various Agency Systems
- And more...

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT + bcrypt
- **Security**: Helmet, CORS, Rate Limiting, XSS Protection
- **Validation**: express-validator
- **Logging**: Winston + Morgan

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **HTTP Client**: Fetch API
- **State Management**: React Context API

## 📁 Project Structure

```
casting-profile-manager/
├── backend/                    # Express.js API Server
│   ├── src/
│   │   ├── config/            # Database and app configuration
│   │   │   └── database.js
│   │   ├── controllers/       # Request handlers
│   │   │   ├── authController.js
│   │   │   ├── profileController.js
│   │   │   ├── platformController.js
│   │   │   ├── bookingController.js
│   │   │   └── uploadController.js
│   │   ├── middleware/        # Express middleware
│   │   │   ├── auth.js        # JWT authentication
│   │   │   ├── errorHandler.js
│   │   │   ├── validation.js
│   │   │   └── asyncHandler.js
│   │   ├── models/            # Mongoose schemas
│   │   │   ├── User.js
│   │   │   ├── Profile.js
│   │   │   ├── Platform.js
│   │   │   ├── Booking.js
│   │   │   └── Availability.js
│   │   ├── routes/            # API routes
│   │   │   ├── authRoutes.js
│   │   │   ├── profileRoutes.js
│   │   │   ├── platformRoutes.js
│   │   │   ├── bookingRoutes.js
│   │   │   ├── availabilityRoutes.js
│   │   │   ├── optionRoutes.js
│   │   │   └── uploadRoutes.js
│   │   ├── utils/             # Utility functions
│   │   │   ├── logger.js
│   │   │   ├── validation.js
│   │   │   └── seeder.js
│   │   └── index.js           # Server entry point
│   ├── uploads/               # File uploads directory
│   ├── logs/                  # Application logs
│   ├── .env                   # Environment variables
│   ├── .env.example           # Environment template
│   └── package.json
│
├── frontend/                   # React Application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── CalendarView.jsx
│   │   │   ├── ProfileView.jsx
│   │   │   ├── PlatformsView.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── index.js
│   │   ├── context/           # Context providers
│   │   │   └── AppContext.jsx
│   │   ├── services/          # API services
│   │   │   ├── apiService.js
│   │   │   └── platformAgent.js
│   │   ├── App.jsx            # Main app component
│   │   └── main.jsx           # Entry point
│   ├── public/                # Static assets
│   ├── dist/                  # Build output
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── START.bat                   # Windows startup script
├── start.sh                    # Unix/Mac startup script
├── README.md                   # This file
├── QUICK-START.md             # Quick start guide
├── SETUP.md                   # Detailed setup guide
├── INSTALL-MONGODB.md         # MongoDB installation guide
└── package.json               # Root package.json
```

## 🔧 Configuration

### Environment Variables

Backend configuration in `backend/.env`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://127.0.0.1:27017/darsteller-manager

# Authentication
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
JWT_COOKIE_EXPIRE=7

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10
FILE_UPLOAD_PATH=./uploads

# Security
RATE_LIMIT_WINDOW_MS=600000
RATE_LIMIT_MAX=100

# Platform API Keys (optional)
FILMMAKERS_CLIENT_ID=
FILMMAKERS_CLIENT_SECRET=
CASTING_NETWORK_API_KEY=
SCHAUSPIELERVIDEOS_API_KEY=
ETALENTA_API_KEY=
```

### Default Ports

- **Backend**: 5000
- **Frontend**: 5173
- **MongoDB**: 27017

## 📡 API Documentation

### Authentication Endpoints

```
POST   /api/auth/register          Register new user
POST   /api/auth/login             Login user
POST   /api/auth/logout            Logout user
GET    /api/auth/me                Get current user
POST   /api/auth/forgot-password   Request password reset
PUT    /api/auth/reset-password    Reset password
PUT    /api/auth/update-password   Update password
PUT    /api/auth/update-details    Update user details
```

### Profile Endpoints

```
GET    /api/profile                Get user profile
PUT    /api/profile                Update profile
POST   /api/profile/work-history   Add work history
PUT    /api/profile/work-history/:id   Update work history
DELETE /api/profile/work-history/:id   Delete work history
POST   /api/profile/education      Add education
PUT    /api/profile/education/:id  Update education
DELETE /api/profile/education/:id  Delete education
POST   /api/profile/sync           Sync profile to platforms
```

### Platform Endpoints

```
GET    /api/platforms              Get all platforms
POST   /api/platforms/:id/connect  Connect platform
POST   /api/platforms/:id/disconnect   Disconnect platform
POST   /api/platforms/:id/test     Test platform connection
POST   /api/platforms/:id/sync     Sync data to platform
PUT    /api/platforms/:id/settings Update platform settings
```

### Booking Endpoints

```
GET    /api/bookings               Get all bookings
POST   /api/bookings               Create booking
GET    /api/bookings/:id           Get booking by ID
PUT    /api/bookings/:id           Update booking
DELETE /api/bookings/:id           Delete booking
```

### Availability Endpoints

```
GET    /api/availability           Get availability
POST   /api/availability           Add availability
PUT    /api/availability/:id       Update availability
DELETE /api/availability/:id       Delete availability
POST   /api/availability/sync      Sync to platforms
```

### Upload Endpoints

```
POST   /api/upload/profile-photo   Upload profile photo
POST   /api/upload/setcard-photo/:id   Upload setcard photo
DELETE /api/upload/setcard-photo/:id   Delete setcard photo
```

## 🧪 Testing

### Run Tests

```bash
# Backend tests
cd backend
npm test

# Watch mode
npm run test:watch
```

## 🔍 Development

### Backend Development

```bash
cd backend

# Development with auto-reload
npm run dev

# Production mode
npm start

# Lint code
npm run lint

# Seed database
npm run seed

# Clear database
npm run seed:destroy
```

### Frontend Development

```bash
cd frontend

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 📦 Deployment

### Backend Deployment

1. Set `NODE_ENV=production` in `.env`
2. Configure production MongoDB URI
3. Set secure `JWT_SECRET`
4. Run `npm start` in backend directory
5. Consider using PM2 for process management:
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name casting-backend
   ```

### Frontend Deployment

1. Build the production bundle:
   ```bash
   cd frontend
   npm run build
   ```
2. The `dist/` folder contains the static files
3. Deploy to any static hosting service:
   - Vercel
   - Netlify
   - AWS S3 + CloudFront
   - GitHub Pages
   - etc.

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcryptjs
- Rate limiting on auth endpoints
- XSS protection
- NoSQL injection prevention
- CORS configuration
- Helmet security headers
- Input validation
- File upload restrictions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request

## 📝 Available Scripts

### Root Level

```bash
npm start              # Start both backend and frontend
npm run dev            # Same as start
npm run backend        # Start only backend
npm run frontend       # Start only frontend
npm run install-all    # Install all dependencies
npm run seed           # Seed database
```

### Backend

```bash
npm run dev            # Development with nodemon
npm start              # Production mode
npm test               # Run tests
npm run test:watch     # Tests in watch mode
npm run lint           # Lint code
npm run lint:check     # Check lint without fixing
npm run seed           # Seed database
npm run seed:destroy   # Clear database
```

### Frontend

```bash
npm run dev            # Development server
npm run build          # Build for production
npm run preview        # Preview production build
npm run lint           # Lint code
```

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify port 27017 is not in use

2. **Port Already in Use**
   - Backend: Change `PORT` in `backend/.env`
   - Frontend: Vite will prompt for alternative port

3. **Module Not Found**
   - Run `npm run install-all`
   - Clear `node_modules` and reinstall

4. **CORS Errors**
   - Ensure both servers are running
   - Check CORS configuration in `backend/src/index.js`

For more troubleshooting, see [`SETUP.md`](SETUP.md#troubleshooting)

## 📚 Documentation Files

- [`README.md`](README.md) - This file (overview)
- [`QUICK-START.md`](QUICK-START.md) - Get started quickly
- [`SETUP.md`](SETUP.md) - Detailed setup instructions
- [`INSTALL-MONGODB.md`](INSTALL-MONGODB.md) - MongoDB installation guide

## 📄 License

MIT License

## 👥 Authors

- Development Team

## 🙏 Acknowledgments

- MongoDB for the excellent database
- Express.js for the robust backend framework
- React team for the amazing frontend library
- Vite for the lightning-fast build tool
- All contributors and open-source libraries used

---

**Made with ❤️ for the acting community**
