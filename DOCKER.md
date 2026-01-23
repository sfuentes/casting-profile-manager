# Docker Deployment Guide

Complete guide for running the Casting Profile Manager backend with Docker and MongoDB.

## 📋 Prerequisites

### Docker Installation

**Windows:**
- Download Docker Desktop: https://www.docker.com/products/docker-desktop
- Install and start Docker Desktop
- Verify: `docker --version`

**Mac:**
```bash
# Using Homebrew
brew install --cask docker

# Or download from: https://www.docker.com/products/docker-desktop
```

**Linux:**
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
```

Verify Docker is running:
```bash
docker --version
docker-compose --version
```

## 🚀 Quick Start

### Option 1: Production Mode (Recommended)

```bash
# Windows
docker-start.bat

# Mac/Linux
./docker-start.sh
```

This starts:
- ✅ MongoDB database on port 27017
- ✅ Backend API on port 5000
- ✅ Persistent data volumes

### Option 2: Development Mode (with Hot Reload)

```bash
# Windows
docker-start.bat dev

# Mac/Linux
./docker-start.sh dev
```

This starts:
- ✅ MongoDB database on port 27017
- ✅ Backend API on port 5000 with auto-reload
- ✅ MongoDB Express UI on port 8081
- ✅ Source code mounted for live editing

## 📦 What's Included

### Services

1. **MongoDB** (mongo:7.0)
   - Port: 27017
   - Username: admin
   - Password: admin123
   - Database: darsteller-manager
   - Persistent storage

2. **Backend API** (Node.js 18)
   - Port: 5000
   - Express.js server
   - JWT authentication
   - File uploads support

3. **MongoDB Express** (Dev only)
   - Port: 8081
   - Web UI for database management
   - Username: admin
   - Password: admin123

## 🔧 Configuration

### Environment Variables

The Docker setup uses environment variables defined in:
- `docker-compose.yml` - Production configuration
- `docker-compose.dev.yml` - Development configuration
- `.env.docker` - Template for custom configuration

**Important**: Change `JWT_SECRET` for production!

You can create a `.env` file in the root directory:

```env
# .env file (optional - overrides docker-compose defaults)
JWT_SECRET=your-super-secret-jwt-key-change-this
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=admin123
```

### MongoDB Credentials

Default credentials (can be changed in docker-compose.yml):
- **Username**: admin
- **Password**: admin123
- **Database**: darsteller-manager

### Ports

| Service | Port | Description |
|---------|------|-------------|
| Backend API | 5000 | Main application API |
| MongoDB | 27017 | Database connection |
| MongoDB Express | 8081 | Database UI (dev only) |

## 📝 Docker Commands

### Starting Services

```bash
# Production mode (detached)
docker-compose up -d

# Production mode with build
docker-compose up --build -d

# Development mode
docker-compose -f docker-compose.dev.yml up

# Development mode with build
docker-compose -f docker-compose.dev.yml up --build
```

### Stopping Services

```bash
# Stop containers (preserve data)
docker-compose down

# Stop and remove volumes (DELETE ALL DATA)
docker-compose down -v

# Development mode
docker-compose -f docker-compose.dev.yml down
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f mongodb

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Managing Containers

```bash
# List running containers
docker-compose ps

# Restart a service
docker-compose restart backend

# Execute command in container
docker-compose exec backend sh
docker-compose exec mongodb mongosh

# View resource usage
docker stats
```

## 🗄️ Database Management

### Access MongoDB Shell

```bash
# From host machine
docker-compose exec mongodb mongosh -u admin -p admin123

# From inside container
docker exec -it casting-mongodb mongosh -u admin -p admin123
```

### MongoDB Express Web UI (Dev Mode)

1. Start in development mode: `./docker-start.sh dev`
2. Open browser: http://localhost:8081
3. Login:
   - Username: admin
   - Password: admin123
4. Select database: darsteller-manager

### Backup Database

```bash
# Backup all databases
docker-compose exec mongodb mongodump -u admin -p admin123 --authenticationDatabase admin --out /data/backup

# Copy backup to host
docker cp casting-mongodb:/data/backup ./mongodb-backup

# Backup single database
docker-compose exec mongodb mongodump -u admin -p admin123 --authenticationDatabase admin --db darsteller-manager --out /data/backup
```

### Restore Database

```bash
# Copy backup to container
docker cp ./mongodb-backup casting-mongodb:/data/backup

# Restore database
docker-compose exec mongodb mongorestore -u admin -p admin123 --authenticationDatabase admin --db darsteller-manager /data/backup/darsteller-manager
```

## 🔍 Health Checks

### Check Service Health

```bash
# Check all services
docker-compose ps

# Backend health endpoint
curl http://localhost:5000/health

# MongoDB health
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

### Health Check Responses

**Backend:**
```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2026-01-22T...",
  "uptime": 123.456
}
```

## 🛠️ Development Workflow

### 1. Start Development Environment

```bash
./docker-start.sh dev
```

### 2. Make Code Changes

- Edit files in `backend/src/`
- Changes automatically reload (nodemon)
- No need to restart containers

### 3. View Logs

```bash
docker-compose -f docker-compose.dev.yml logs -f backend
```

### 4. Access Database

- MongoDB Express: http://localhost:8081
- Or use MongoDB shell:
  ```bash
  docker-compose exec mongodb mongosh -u admin -p admin123
  ```

### 5. Test API

```bash
# Health check
curl http://localhost:5000/health

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

## 📦 Data Persistence

### Volumes

Docker creates persistent volumes for data:

- `mongodb_data` - Database files (production)
- `mongodb_config` - MongoDB configuration
- `mongodb_data_dev` - Database files (development)
- `./backend/uploads` - Uploaded files
- `./backend/logs` - Application logs

### List Volumes

```bash
docker volume ls | grep casting
```

### Inspect Volume

```bash
docker volume inspect casting-profile-manager_mongodb_data
```

### Remove All Data

```bash
# WARNING: This deletes all database data!
docker-compose down -v

# Remove specific volume
docker volume rm casting-profile-manager_mongodb_data
```

## 🚀 Production Deployment

### 1. Build Production Images

```bash
cd backend
docker build -t casting-backend:latest .
```

### 2. Configure Environment

Create `.env` file with production settings:

```env
JWT_SECRET=your-super-secret-production-key-here
NODE_ENV=production
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=strong-production-password
```

### 3. Start Production Services

```bash
docker-compose up -d
```

### 4. Verify Services

```bash
docker-compose ps
curl http://localhost:5000/health
```

### 5. View Logs

```bash
docker-compose logs -f
```

## 🔒 Security Considerations

### Production Checklist

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Change MongoDB credentials from defaults
- [ ] Use environment variables for secrets (not hardcoded)
- [ ] Enable MongoDB authentication
- [ ] Use Docker secrets for sensitive data
- [ ] Restrict port exposure (only expose necessary ports)
- [ ] Regular security updates: `docker-compose pull`
- [ ] Enable firewall rules
- [ ] Use HTTPS/TLS in production
- [ ] Regular database backups

### Using Docker Secrets

For enhanced security in production:

```yaml
# docker-compose.prod.yml
services:
  backend:
    secrets:
      - jwt_secret
      - mongo_password

secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  mongo_password:
    file: ./secrets/mongo_password.txt
```

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend
docker-compose logs mongodb

# Check container status
docker-compose ps

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### MongoDB Connection Failed

**Error**: "MongoServerError: Authentication failed"

**Solutions**:
1. Check credentials in docker-compose.yml
2. Ensure MongoDB is fully started (check health)
3. Verify MONGO_URI in backend environment

```bash
# Check MongoDB logs
docker-compose logs mongodb

# Test connection
docker-compose exec mongodb mongosh -u admin -p admin123
```

### Port Already in Use

**Error**: "Bind for 0.0.0.0:5000 failed: port is already allocated"

**Solutions**:
1. Stop conflicting service
2. Change port in docker-compose.yml:
   ```yaml
   ports:
     - "5001:5000"  # Change host port
   ```

### Out of Disk Space

```bash
# Remove unused containers, images, volumes
docker system prune -a

# Remove specific components
docker container prune
docker image prune
docker volume prune
```

### Slow Performance

```bash
# Check resource usage
docker stats

# Allocate more resources in Docker Desktop:
# Settings > Resources > Advanced
# Increase CPU, Memory limits
```

### Permission Denied (Linux)

```bash
# Add user to docker group
sudo usermod -aG docker $USER

# Logout and login, or:
newgrp docker
```

## 📊 Monitoring

### Resource Usage

```bash
# Real-time stats
docker stats

# Specific container
docker stats casting-backend
```

### Container Logs

```bash
# Follow logs
docker-compose logs -f

# Last N lines
docker-compose logs --tail=50 backend

# Timestamps
docker-compose logs -t backend
```

### Health Checks

All services have health checks configured:

```bash
# Check health status
docker-compose ps

# Healthy output:
# NAME                     STATUS                    PORTS
# casting-backend          Up 2 minutes (healthy)    0.0.0.0:5000->5000/tcp
# casting-mongodb          Up 2 minutes (healthy)    0.0.0.0:27017->27017/tcp
```

## 🔄 Updates and Maintenance

### Update Docker Images

```bash
# Pull latest images
docker-compose pull

# Rebuild and restart
docker-compose up -d --build
```

### Update Node Dependencies

```bash
# Rebuild backend image
docker-compose build backend

# Or rebuild without cache
docker-compose build --no-cache backend
```

## 📚 Additional Resources

### Docker Documentation
- Docker Compose: https://docs.docker.com/compose/
- Dockerfile reference: https://docs.docker.com/engine/reference/builder/
- Docker best practices: https://docs.docker.com/develop/dev-best-practices/

### MongoDB Documentation
- MongoDB Docker: https://hub.docker.com/_/mongo
- MongoDB manual: https://docs.mongodb.com/manual/

## 🎯 Common Commands Reference

```bash
# Start services
docker-compose up -d                          # Production
docker-compose -f docker-compose.dev.yml up   # Development

# Stop services
docker-compose down                           # Stop containers
docker-compose down -v                        # Stop and remove data

# Logs
docker-compose logs -f                        # All services
docker-compose logs -f backend                # Specific service

# Rebuild
docker-compose build                          # Rebuild images
docker-compose up --build -d                  # Build and start

# Shell access
docker-compose exec backend sh                # Backend shell
docker-compose exec mongodb mongosh           # MongoDB shell

# Cleanup
docker-compose down -v                        # Remove containers and volumes
docker system prune -a                        # Clean everything
```

---

**Need help?** Check the main [README.md](README.md) or [SETUP.md](SETUP.md)
