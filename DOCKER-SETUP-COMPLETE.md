# ✅ Docker Setup Complete!

Your backend is now fully dockerized with MongoDB included.

## 🎉 What's Been Created

### Docker Configuration Files

1. **backend/Dockerfile** - Production backend image
2. **backend/Dockerfile.dev** - Development backend image with hot reload
3. **backend/.dockerignore** - Files to exclude from Docker build
4. **docker-compose.yml** - Production configuration
5. **docker-compose.dev.yml** - Development configuration with Mongo Express
6. **docker/mongo-init.js** - MongoDB initialization script

### Startup Scripts

1. **docker-start.bat** - Windows startup script
2. **docker-start.sh** - Mac/Linux startup script
3. **docker-stop.bat** - Windows stop script
4. **docker-stop.sh** - Mac/Linux stop script

### Documentation

1. **DOCKER.md** - Complete Docker guide (comprehensive)
2. **DOCKER-QUICKSTART.md** - Quick reference (fast setup)
3. **.env.docker** - Environment template for Docker

### NPM Scripts Added

```json
"docker:prod": "docker-compose up -d",
"docker:dev": "docker-compose -f docker-compose.dev.yml up",
"docker:build": "docker-compose build",
"docker:stop": "docker-compose down",
"docker:logs": "docker-compose logs -f",
"docker:clean": "docker-compose down -v"
```

## 🚀 How to Use

### Quick Start (Production Mode)

```bash
# Windows
docker-start.bat

# Mac/Linux
./docker-start.sh

# Or
npm run docker:prod
```

This starts:
- MongoDB on port 27017
- Backend API on port 5000

### Development Mode

```bash
# Windows
docker-start.bat dev

# Mac/Linux
./docker-start.sh dev

# Or
npm run docker:dev
```

This adds:
- MongoDB Express UI on port 8081
- Auto-reload on code changes
- Volume mounting for live editing

## 🌐 Access Points

### Production Mode
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

### Development Mode (Additional)
- MongoDB Express: http://localhost:8081
  - Username: `admin`
  - Password: `admin123`

## 📦 What's Included in Docker

### Services

1. **MongoDB 7.0**
   - Port: 27017
   - Username: admin
   - Password: admin123 (⚠️ change in production!)
   - Database: darsteller-manager
   - Persistent volumes for data
   - Auto-initialization script

2. **Backend API**
   - Node.js 18 Alpine
   - Express.js server
   - All dependencies pre-installed
   - Health checks configured
   - Auto-restart on failure

3. **MongoDB Express** (Dev only)
   - Web-based MongoDB admin interface
   - Port: 8081
   - Username: admin
   - Password: admin123

## 🔧 Configuration

### Environment Variables

Set in `docker-compose.yml`:

```yaml
environment:
  NODE_ENV: production
  PORT: 5000
  MONGO_URI: mongodb://admin:admin123@mongodb:27017/darsteller-manager?authSource=admin
  JWT_SECRET: ${JWT_SECRET:-your-secret-key-change-in-production}
```

### Customize

Create `.env` file in project root:

```env
JWT_SECRET=your-super-secret-production-key
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=strong-password-here
```

## 📊 Docker Commands

### Basic Operations

```bash
# Start
npm run docker:prod          # Production
npm run docker:dev           # Development

# Stop
npm run docker:stop          # Stop containers
npm run docker:clean         # Stop and remove data

# Monitor
npm run docker:logs          # View logs
docker-compose ps            # Check status

# Rebuild
npm run docker:build         # Rebuild images
docker-compose build --no-cache  # Full rebuild
```

### Advanced Operations

```bash
# Shell access
docker-compose exec backend sh
docker-compose exec mongodb mongosh -u admin -p admin123

# Database backup
docker-compose exec mongodb mongodump -u admin -p admin123 --out /data/backup

# Resource usage
docker stats

# Remove everything
docker-compose down -v
docker system prune -a
```

## 🗄️ Database Management

### Access MongoDB

```bash
# MongoDB Shell
docker-compose exec mongodb mongosh -u admin -p admin123

# MongoDB Express (dev mode)
# Open browser: http://localhost:8081
```

### Backup & Restore

```bash
# Backup
docker-compose exec mongodb mongodump -u admin -p admin123 --db darsteller-manager --out /data/backup
docker cp casting-mongodb:/data/backup ./backup

# Restore
docker cp ./backup casting-mongodb:/data/restore
docker-compose exec mongodb mongorestore -u admin -p admin123 --db darsteller-manager /data/restore/darsteller-manager
```

## 🔍 Health Checks

All services have health checks:

```bash
# Check status
docker-compose ps

# Test backend health
curl http://localhost:5000/health

# Test MongoDB
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

## 🛠️ Development Workflow

### 1. Start in Dev Mode

```bash
./docker-start.sh dev
```

### 2. Edit Code

Make changes in `backend/src/` - changes auto-reload with nodemon.

### 3. Check Logs

```bash
docker-compose -f docker-compose.dev.yml logs -f backend
```

### 4. Access Database

- MongoDB Express: http://localhost:8081
- Or MongoDB shell: `docker-compose exec mongodb mongosh -u admin -p admin123`

### 5. Test API

```bash
# Health check
curl http://localhost:5000/health

# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"password123"}'
```

## 🔒 Security Notes

### For Production

1. **Change default credentials!**
   - Update `MONGO_ROOT_PASSWORD` in docker-compose.yml
   - Set strong `JWT_SECRET` in environment

2. **Use environment variables**
   - Don't hardcode secrets
   - Use `.env` file or Docker secrets

3. **Restrict ports**
   - Only expose necessary ports
   - Use firewall rules

4. **Regular updates**
   ```bash
   docker-compose pull
   docker-compose up -d --build
   ```

## 🐛 Troubleshooting

### Docker not running
**Error**: "Cannot connect to the Docker daemon"
**Fix**: Start Docker Desktop

### Port already in use
**Error**: "Bind for 0.0.0.0:5000 failed"
**Fix**: Change port in docker-compose.yml or stop conflicting service

### MongoDB connection failed
**Error**: "MongoServerError: Authentication failed"
**Fix**:
1. Check credentials in docker-compose.yml
2. Wait for MongoDB to fully start (check with `docker-compose logs mongodb`)
3. Ensure health checks pass: `docker-compose ps`

### Container won't start
```bash
# Check logs
docker-compose logs backend
docker-compose logs mongodb

# Rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

## 📚 Documentation

- **Quick Start**: [DOCKER-QUICKSTART.md](DOCKER-QUICKSTART.md)
- **Complete Guide**: [DOCKER.md](DOCKER.md)
- **Main README**: [README.md](README.md)
- **Traditional Setup**: [SETUP.md](SETUP.md)

## 💡 Tips

1. **Use production mode** for testing/demo
2. **Use development mode** when coding
3. **Data persists** between restarts (stored in Docker volumes)
4. **Clean start**: `npm run docker:clean` removes all data
5. **View logs**: `npm run docker:logs` for debugging
6. **Shell access**: `docker-compose exec backend sh` to explore container

## ✨ Benefits of Docker Setup

✅ **No MongoDB installation required**
✅ **Consistent environment** across all machines
✅ **Easy cleanup** - just remove containers
✅ **Portable** - works on Windows, Mac, Linux
✅ **Isolated** - doesn't conflict with other services
✅ **Reproducible** - same setup every time
✅ **Production-ready** - same config for dev and prod

## 🎯 Next Steps

1. **Start the backend:**
   ```bash
   docker-start.bat  # or ./docker-start.sh
   ```

2. **Verify it's running:**
   ```bash
   curl http://localhost:5000/health
   ```

3. **Start the frontend** (in another terminal):
   ```bash
   cd frontend
   npm run dev
   ```

4. **Open the app:**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:5000

5. **Register/Login** and start using the app!

## 📞 Support

If you encounter issues:
1. Check `DOCKER.md` for detailed troubleshooting
2. View logs: `npm run docker:logs`
3. Check container status: `docker-compose ps`
4. Ensure Docker is running: `docker --version`

---

## 🎉 Summary

Your backend is now fully dockerized!

**To run:**
```bash
docker-start.bat  # Windows
./docker-start.sh # Mac/Linux
```

**No MongoDB installation needed!**
**Everything is containerized and ready to go!**

Enjoy your Docker-powered Casting Profile Manager! 🚀
