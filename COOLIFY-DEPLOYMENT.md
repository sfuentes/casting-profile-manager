# Coolify Deployment Guide

Complete step-by-step guide to deploy the Casting Profile Manager on Coolify.

---

## 📋 Prerequisites

- Coolify instance running (v4.0+)
- Git repository URL for this project
- Domain names for frontend and backend (or Coolify-provided domains)
- 2GB+ RAM on Coolify server (for MongoDB + Backend + Frontend)

---

## 🚀 Deployment Steps

### Step 1: Prepare Environment Variables

Before creating the resource in Coolify, generate secure secrets:

**Generate JWT Secret:**
```bash
openssl rand -hex 64
```

**Generate MongoDB Password:**
```bash
openssl rand -hex 32
```
> **Important:** Use `-hex`, not `-base64`. Base64 output contains `/`, `+`, and `=`
> which are URL-unsafe and will silently break the MongoDB connection string.

**Required Variables:**
- `JWT_SECRET` - Your generated JWT secret
- `MONGO_ROOT_PASSWORD` - Your generated MongoDB password
- `VITE_API_URL` - Your backend API URL (e.g., `https://api.yourdomain.com/api`)
- `FRONTEND_URL` - Your frontend URL (e.g., `https://app.yourdomain.com`)

---

### Step 2: Create Resource in Coolify

1. **Login to Coolify Dashboard**
2. **Create New Resource**
   - Click "New Resource"
   - Select "Docker Compose"
   - Choose "Public Repository" or connect your Git account

3. **Configure Repository**
   - Repository URL: `https://github.com/yourusername/casting-profile-manager`
   - Branch: `main` or `master`
   - Compose File: `docker-compose.coolify.yml`

4. **Set Domains**

   `docker-compose.coolify.yml` declares two Coolify magic variables —
   `SERVICE_FQDN_FRONTEND_80` and `SERVICE_FQDN_BACKEND_5000`. These are what
   make Coolify allocate a domain and generate the Traefik routing labels that
   publish each service; `expose:` on its own only opens the port on the
   internal network, so without them the stack deploys successfully but is
   unreachable from the internet.

   Coolify populates both on first deploy using your wildcard subdomain. To use
   your own domains, override them under **Environment Variables**:
   - `SERVICE_FQDN_FRONTEND_80` → `app.yourdomain.com`
   - `SERVICE_FQDN_BACKEND_5000` → `api.yourdomain.com`

   Enable SSL/TLS for both. Whatever you settle on must match `VITE_API_URL` and
   `FRONTEND_URL` below, or the frontend will call the wrong host and CORS will
   reject it.

---

### Step 3: Configure Environment Variables

In Coolify UI, go to **Resource → Environment Variables** and add:

#### Required Variables

```bash
# JWT Configuration
JWT_SECRET=your-generated-64-char-hex-secret-here

# MongoDB Configuration
MONGO_ROOT_PASSWORD=your-strong-mongodb-password-here

# API URL (CRITICAL - must match backend domain)
VITE_API_URL=https://api.yourdomain.com/api

# Frontend URL (for CORS)
FRONTEND_URL=https://app.yourdomain.com
```

#### Optional Variables (with sensible defaults)

```bash
# MongoDB Username (default: admin)
MONGO_ROOT_USERNAME=admin

# JWT Expiry (default: 7d)
JWT_EXPIRES_IN=7d
JWT_COOKIE_EXPIRE=7

# File Upload Size (default: 10MB)
MAX_FILE_SIZE=10

# Rate Limiting (default: 100 requests per 10 minutes)
RATE_LIMIT_WINDOW_MS=600000
RATE_LIMIT_MAX=100
```

#### Platform API Keys (Optional)

Only add these if you plan to use the respective platforms:

```bash
FILMMAKERS_CLIENT_ID=your-key
FILMMAKERS_CLIENT_SECRET=your-secret
CASTING_NETWORK_API_KEY=your-key
SCHAUSPIELERVIDEOS_API_KEY=your-key
ETALENTA_API_KEY=your-key
JOBWORK_CLIENT_ID=your-key
JOBWORK_CLIENT_SECRET=your-secret
WANTED_CLIENT_ID=your-key
WANTED_CLIENT_SECRET=your-secret
```

---

### Step 4: Verify Configuration

**Before deploying**, run the validation script:

```bash
# In your local repository
node scripts/validate-coolify-env.js
```

This will check for missing required variables and warn about potential issues.

---

### Step 5: Deploy

1. **Click "Deploy" in Coolify**
2. **Monitor Build Logs**
   - Watch for errors in MongoDB, Backend, and Frontend builds
   - First deployment takes 5-10 minutes (building images)

3. **Check Service Health**
   - MongoDB should be healthy first (~2 minutes)
   - Backend should connect to MongoDB (~1 minute after MongoDB is healthy)
   - Frontend should build and start (~3-5 minutes)

---

### Step 6: Verify Deployment

#### Check Backend Health

```bash
curl https://api.yourdomain.com/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Server is healthy",
  "timestamp": "2026-02-23T...",
  "uptime": 123.456
}
```

#### Check Frontend

Open browser: `https://app.yourdomain.com`

**Expected**: Login/Registration page loads

#### Check MongoDB (via Backend API)

```bash
curl https://api.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"TestPass123!","confirmPassword":"TestPass123!"}'
```

**Expected**: Registration successful

---

## 🐛 Troubleshooting

### ⚠️ Most Common: MongoDB `UserNotFound` on Startup (Stale Volume)

**Symptoms:**
```
UserNotFound: Could not find user "SuperSecretAdmin" for db "admin"
```
MongoDB never becomes healthy, and the backend never starts because it waits on
`depends_on: condition: service_healthy`. The whole stack stalls.

**Cause:**

`MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD` are honoured **only
when `/data/db` is empty**. The `mongo:7.0` entrypoint checks for existing
database files and, if it finds any, skips initialisation entirely — no root user
is created, and `docker/mongo-init.js` never runs either.

The `mongodb_data` volume survives Coolify redeploys. So if any earlier deploy
attempt created that volume — under a different username, or with no credentials
at all because it failed before they were set — the volume is already
"initialised". Every later deploy then reuses it and silently skips user
creation, no matter what you put in the Coolify environment variables. The
credentials you configured describe a user that only *would* have been created on
a fresh volume.

This is why the error persists across redeploys and why changing the password in
the Coolify UI appears to have no effect.

**Fix (no data to preserve — the normal case for a first deployment):**

1. Stop the resource in Coolify.
2. On the server, find and delete the volume. Coolify prefixes volume names with
   the resource UUID, so match on the suffix rather than guessing the full name:
   ```bash
   docker volume ls | grep mongodb_data
   docker volume rm <the_name_you_just_found>
   ```
3. Redeploy. Initialisation now runs against an empty `/data/db`: the root user
   is created with your current credentials, and `mongo-init.js` executes.

**Fix (existing data must be preserved):**

Create the user by hand instead of wiping:

```bash
docker exec -it <mongo_container> mongosh
```
```javascript
db.getSiblingDB('admin').createUser({
  user: 'YOUR_MONGO_ROOT_USERNAME',
  pwd:  'YOUR_MONGO_ROOT_PASSWORD',
  roles: [ { role: 'root', db: 'admin' } ]
})
```

If the volume was initialised with no credentials, mongod is running with auth
disabled and this works unauthenticated. If it was initialised under a different
username, authenticate as that user first.

Note that `mongo-init.js` will still never have run on that volume, so the
collection validators and the unique index on `users.email` will be missing.
Mongoose creates collections on demand, so the app will function, but without
those server-side guarantees. Prefer wiping the volume unless you genuinely have
data to keep.

---

### Backend Crashes with `ValidationError: X-Forwarded-For ... trust proxy`

**Symptoms:**
```
ValidationError: The 'X-Forwarded-For' header is set but the Express
'trust proxy' setting is false (default).
```

**Cause:**

Behind Coolify's Traefik proxy the real client IP arrives in `X-Forwarded-For`,
not on the socket. With `trust proxy` unset, `express-rate-limit` cannot identify
callers and raises this error; every request would otherwise be attributed to the
proxy's own IP, putting all clients in a single shared rate-limit bucket.

**Fix:**

Already handled in `backend/src/index.js`, which trusts 1 hop when
`NODE_ENV=production`. No configuration needed for a standard Coolify setup.

Set `TRUST_PROXY_HOPS` only if you add another proxy in front of Coolify —
Cloudflare in front of Traefik would make it `2`. Do not raise it beyond your
actual proxy count, and never set it to trust everything: each extra trusted hop
is one more `X-Forwarded-For` entry a client can forge to spoof their IP and
bypass the rate limiter.

---

### Issue 0: Deployment Fails — "mongodb Pulling" / Docker Hub Rate Limit

**Symptoms (Coolify deployment log):**
```
Deployment failed: Command execution failed (exit code 1)
Error:  mongodb Pulling
```

**Root cause:**
Docker Hub limits anonymous image pulls to **100 per 6 hours per IP address**.
Hetzner IPs are shared across many customers, so the quota is regularly exhausted
before your pull ever starts.

**Fix A — Pre-pull the image once on the Hetzner server (fastest):**
```bash
# SSH into your Hetzner server and pull the image manually
ssh root@<your-server-ip>
docker pull mongo:7.0
```
After the image is cached on the host Coolify will use `pull_policy: if_not_present`
(already set in `docker-compose.coolify.yml`) and will **never pull it again**,
even across redeployments.

**Fix B — Authenticate with Docker Hub in Coolify (permanent, recommended):**
1. Log in to [hub.docker.com](https://hub.docker.com) and create a free account if
   you don't have one (free accounts get **200 pulls / 6 h** per authenticated user).
2. In Coolify go to **Settings → Registries → Add Registry**
3. Fill in:
   - Registry URL: `https://registry.hub.docker.com` (or `https://index.docker.io`)
   - Username: your Docker Hub username
   - Password/Token: a Docker Hub **Access Token** (recommended) or your password
4. Save and redeploy — Coolify will now authenticate every pull.

**Why `pull_policy: if_not_present` helps:**
Once the image is cached (after Fix A or a successful first pull), subsequent
redeployments skip the pull entirely regardless of rate limits.

---

### Issue 1: Backend Can't Connect to MongoDB

**Symptoms:**
```
backend | Error: connect ECONNREFUSED mongodb:27017
```

**Solutions:**
1. Check MongoDB container is running and healthy:
   ```bash
   docker ps | grep mongodb
   ```
2. Verify `MONGO_ROOT_PASSWORD` is set in environment variables
3. Check MongoDB logs in Coolify dashboard
4. Increase MongoDB `start_period` in docker-compose if server is slow

**Fix in Coolify:**
- Go to Resource → Logs → mongodb
- Look for authentication errors or startup failures

---

### Issue 2: Frontend Shows "Network Error"

**Symptoms:**
- Frontend loads but API calls fail
- Browser console shows CORS errors

**Solutions:**
1. **Verify `VITE_API_URL` is correct**
   - Must include `/api` at the end
   - Must use `https://` for production
   - Example: `https://api.yourdomain.com/api`

2. **Check browser console** (F12)
   - Look for: `Access to fetch... has been blocked by CORS policy`

3. **Verify `FRONTEND_URL` matches actual domain**
   - Must be exact match (including `https://`)
   - No trailing slash

4. **Rebuild frontend** if you changed `VITE_API_URL`:
   - Redeploy in Coolify (VITE_API_URL is baked into build)

---

### Issue 3: Frontend Build Fails

**Symptoms:**
```
frontend | error: VITE_API_URL is not defined
```

**Solution:**
1. Ensure `VITE_API_URL` is set in Coolify environment variables
2. Redeploy the resource
3. Check build logs for exact error message

---

### Issue 4: MongoDB Keeps Restarting

**Symptoms:**
```
mongodb | Restarting...
mongodb | Restarting...
```

**Solutions:**
1. Check available disk space on Coolify server
2. Check available RAM (MongoDB needs ~512MB minimum)
3. Review MongoDB logs for specific error
4. Verify `MONGO_ROOT_PASSWORD` is set correctly

---

### Issue 5: Platform Sync Fails (Puppeteer)

**Symptoms:**
- Filmmakers sync fails with "Chromium not found"

**Solutions:**
1. Check backend logs for Puppeteer errors
2. Verify Chromium was installed during build
3. Check backend Dockerfile logs for apk errors
4. Server might need more RAM for Chromium (add 512MB)

**Workaround:**
- Disable web scraping platforms temporarily
- Use only API-based platforms (e-TALENTA, etc.)

---

### Issue 6: File Uploads Fail

**Symptoms:**
- Image uploads return 500 errors
- Backend logs show permission errors

**Solutions:**
1. Check volume permissions in Coolify
2. Verify `backend_uploads` volume is mounted
3. Check disk space on server
4. Review backend logs: `Resource → Logs → backend`

---

## 🔍 Health Check Commands

### Check All Services

```bash
# Via Coolify CLI (if installed)
coolify ps

# Or via Docker on server
docker ps | grep casting-
```

**Expected Output:**
```
casting-mongodb    healthy   2 minutes ago
casting-backend    healthy   1 minute ago
casting-frontend   healthy   30 seconds ago
```

### Test Backend API

```bash
# Health check
curl https://api.yourdomain.com/health

# Register user
curl -X POST https://api.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","password":"Test123!","confirmPassword":"Test123!"}'

# Login
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

### Check MongoDB

```bash
# Via Coolify console or SSH to server
docker exec -it casting-mongodb mongosh -u admin -p YOUR_MONGO_PASSWORD --authenticationDatabase admin

# In MongoDB shell
show dbs
use darsteller-manager
show collections
db.users.countDocuments()
```

---

## 🔒 Security Checklist

After deployment, verify:

- ✅ `JWT_SECRET` is strong (64+ characters)
- ✅ `MONGO_ROOT_PASSWORD` is strong
- ✅ HTTPS/SSL is enabled for both frontend and backend
- ✅ Domains are correct and accessible
- ✅ CORS is properly configured
- ✅ Rate limiting is enabled (default: 100 req/10min)
- ✅ File upload size is reasonable (default: 10MB)
- ✅ MongoDB is not exposed publicly (internal only)
- ✅ Environment variables are not logged

---

## 🔄 Updating the Application

### Deploy New Version

1. **Push changes to Git repository**
2. **Redeploy in Coolify**
   - Click "Redeploy" button
   - Or set up auto-deploy on Git push

3. **Monitor logs** during update
4. **Verify health checks** pass

### Database Migrations

If you need to update database schema:

1. **SSH to Coolify server**
2. **Run migration script**:
   ```bash
   docker exec -it casting-backend node scripts/migrate.js
   ```

### Backup Before Updates

```bash
# Backup MongoDB
docker exec casting-mongodb mongodump -u admin -p YOUR_PASSWORD --authenticationDatabase admin -o /data/backup

# Copy backup to host
docker cp casting-mongodb:/data/backup ./mongodb-backup-$(date +%Y%m%d)
```

---

## 📊 Monitoring

### Resource Usage

**In Coolify:**
- Go to Resource → Metrics
- Monitor CPU, RAM, and disk usage

**Via Docker:**
```bash
docker stats casting-mongodb casting-backend casting-frontend
```

### Logs

**Real-time logs:**
```bash
# In Coolify UI: Resource → Logs

# Or via Docker
docker logs -f casting-backend
docker logs -f casting-mongodb
docker logs -f casting-frontend
```

### Performance Metrics

**Backend uptime:**
```bash
curl https://api.yourdomain.com/health | jq .uptime
```

**MongoDB performance:**
```bash
docker exec casting-mongodb mongosh -u admin -p PASSWORD --eval "db.serverStatus()"
```

---

## 🆘 Emergency Procedures

### Complete Reset (DANGEROUS - DELETES DATA)

If deployment is completely broken:

1. **Stop resource in Coolify**
2. **Delete volumes**. Coolify prefixes volume names with the resource UUID, not
   the repository name, so list them first rather than assuming the prefix:
   ```bash
   docker volume ls | grep -E 'mongodb_data|backend_uploads'
   docker volume rm <mongodb_data_volume> <backend_uploads_volume>
   ```
3. **Redeploy from scratch**

### Restore from Backup

```bash
# Copy backup to container
docker cp ./mongodb-backup casting-mongodb:/data/restore

# Restore
docker exec casting-mongodb mongorestore -u admin -p PASSWORD --authenticationDatabase admin /data/restore
```

---

## 📞 Support

### Logs to Collect for Support

1. **Backend logs**: `docker logs casting-backend --tail=100`
2. **MongoDB logs**: `docker logs casting-mongodb --tail=100`
3. **Frontend build logs**: From Coolify UI
4. **Environment variables**: (sanitized - remove passwords!)
5. **Health check responses**: `curl https://api.yourdomain.com/health`

### Common Issues Reference

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| `UserNotFound` for db "admin" | Stale `mongodb_data` volume from a failed deploy — init is skipped on a non-empty `/data/db` | Stop resource, `docker volume rm` the mongodb_data volume, redeploy |
| Backend can't connect to MongoDB | MongoDB not ready or password wrong | Check MongoDB logs, verify MONGO_ROOT_PASSWORD |
| `ValidationError` re `X-Forwarded-For` / `trust proxy` | Express not told it sits behind Traefik | Fixed in `backend/src/index.js`; set `TRUST_PROXY_HOPS` only for extra proxies |
| Frontend shows "Network Error" | VITE_API_URL wrong or CORS issue | Rebuild with correct VITE_API_URL |
| CORS errors in browser | FRONTEND_URL mismatch | Set correct FRONTEND_URL, redeploy backend |
| Puppeteer crashes | Low RAM or Chromium install failed | Increase RAM or disable scraping platforms |
| Upload fails | Volume permission or disk space | Check volume mounts and disk space |

---

## ✅ Post-Deployment Checklist

- [ ] All three services are healthy (MongoDB, Backend, Frontend)
- [ ] Frontend loads at `https://app.yourdomain.com`
- [ ] Backend health check works at `https://api.yourdomain.com/health`
- [ ] User registration works
- [ ] User login works
- [ ] HTTPS/SSL certificates are valid
- [ ] File uploads work (test profile photo upload)
- [ ] Platform sync works (test at least one platform)
- [ ] Backups are configured
- [ ] Monitoring is set up
- [ ] Error alerts are configured (if available)

---

## 🎉 Success!

Your Casting Profile Manager should now be running on Coolify!

**Next Steps:**
1. Create your first user account
2. Configure platform integrations
3. Set up automated backups
4. Monitor resource usage for first few days
5. Configure any additional platform API keys

**Documentation:**
- Main README: [README.md](README.md)
- Quick Start: [QUICK-START.md](QUICK-START.md)
- Docker Guide: [DOCKER.md](DOCKER.md)

---

**Need Help?** Check the troubleshooting section above or review application logs in Coolify.
