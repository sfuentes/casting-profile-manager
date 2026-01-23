# Docker Quick Start 🐳

**Fastest way to run the backend with MongoDB - No MongoDB installation needed!**

## ⚡ Quick Commands

### Start Everything (Production)

```bash
# Windows
docker-start.bat

# Mac/Linux
./docker-start.sh

# Or using npm
npm run docker:prod
```

**That's it!** Backend + MongoDB are now running.

### Start in Development Mode

```bash
# Windows
docker-start.bat dev

# Mac/Linux
./docker-start.sh dev

# Or using npm
npm run docker:dev
```

Development mode includes:
- 🔄 Auto-reload on code changes
- 🗄️ MongoDB Express UI (http://localhost:8081)

## 🌐 Access Points

Once running:

- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health
- **MongoDB Express**: http://localhost:8081 (dev mode only)
  - Username: `admin`
  - Password: `admin123`

## 🛑 Stop Everything

```bash
# Windows
docker-stop.bat

# Mac/Linux
./docker-stop.sh

# Or using npm
npm run docker:stop
```

## 📊 View Logs

```bash
npm run docker:logs

# Or
docker-compose logs -f
```

## 🔧 Common Tasks

### Rebuild Images

```bash
npm run docker:build

# Or
docker-compose build
```

### Remove All Data

```bash
npm run docker:clean

# Or
docker-compose down -v
```

### Check Status

```bash
docker-compose ps
```

### Access MongoDB Shell

```bash
docker-compose exec mongodb mongosh -u admin -p admin123
```

## 📋 Prerequisites

**Just Docker!** No MongoDB installation needed.

Install Docker:
- **Windows/Mac**: https://www.docker.com/products/docker-desktop
- **Linux**: `curl -fsSL https://get.docker.com | sh`

Verify:
```bash
docker --version
```

## 🎯 What's Included

- ✅ MongoDB 7.0 (with persistent storage)
- ✅ Backend API (Node.js 18 + Express)
- ✅ Auto-configured database connection
- ✅ Ready-to-use authentication system
- ✅ All dependencies pre-installed

## 🔐 Default Credentials

**MongoDB:**
- Username: `admin`
- Password: `admin123`
- Database: `darsteller-manager`

**MongoDB Express (Dev Mode):**
- Username: `admin`
- Password: `admin123`

⚠️ **Change these in production!** Edit `docker-compose.yml`

## 🚀 Complete Workflow

### 1. First Time Setup

```bash
# Start Docker Desktop (Windows/Mac)

# Start the app
docker-start.bat  # or ./docker-start.sh
```

### 2. Test It Works

```bash
# Check health
curl http://localhost:5000/health

# Expected response:
# {"success":true,"message":"Server is healthy",...}
```

### 3. Create a User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

### 4. Start Frontend (Optional)

```bash
# In another terminal
cd frontend
npm run dev
```

Open http://localhost:5173 and use your credentials!

## 🐛 Troubleshooting

### Docker not running
**Error**: "Cannot connect to the Docker daemon"
**Fix**: Start Docker Desktop

### Port already in use
**Error**: "port is already allocated"
**Fix**: Stop conflicting service or change port in `docker-compose.yml`

### Container won't start
```bash
# Check logs
docker-compose logs backend
docker-compose logs mongodb

# Rebuild
docker-compose build --no-cache
docker-compose up
```

## 📚 More Information

- **Full Docker Guide**: [DOCKER.md](DOCKER.md)
- **Setup Guide**: [SETUP.md](SETUP.md)
- **Main README**: [README.md](README.md)

## 💡 Tips

- Use **production mode** (`docker-start.bat`) for demo/testing
- Use **development mode** (`docker-start.bat dev`) for coding
- MongoDB data persists between restarts
- Run `npm run docker:clean` to reset database

## ⚙️ NPM Scripts Reference

```bash
npm run docker:prod    # Start production mode (detached)
npm run docker:dev     # Start development mode (with logs)
npm run docker:build   # Rebuild images
npm run docker:stop    # Stop containers
npm run docker:logs    # View logs
npm run docker:clean   # Stop and remove all data
```

---

**That's it!** You now have a fully functional backend with MongoDB running in Docker. 🎉

No MongoDB installation, no configuration headaches, just `docker-start.bat` and go!
