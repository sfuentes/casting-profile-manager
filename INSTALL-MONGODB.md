# MongoDB Installation Guide for Windows

## Quick Start (Recommended Method)

### Step 1: Download MongoDB

1. Visit: https://www.mongodb.com/try/download/community
2. Select:
   - **Version**: Latest (7.0 or higher)
   - **Platform**: Windows
   - **Package**: MSI installer
3. Click "Download"

### Step 2: Install MongoDB

1. **Run the installer** (`mongodb-windows-x86_64-X.X.X.msi`)
2. Click "Next" through the welcome screen
3. Accept the license agreement
4. Choose **"Complete"** installation type
5. **IMPORTANT**: On "Service Configuration" page:
   - ✅ Check "Install MongoDB as a Service"
   - ✅ Check "Run service as Network Service user"
   - Service Name: `MongoDB`
   - Data Directory: `C:\Program Files\MongoDB\Server\X.X\data\`
   - Log Directory: `C:\Program Files\MongoDB\Server\X.X\log\`
6. **OPTIONAL**: Uncheck "Install MongoDB Compass" (GUI tool - you can install later)
7. Click "Install"
8. Wait for installation to complete
9. Click "Finish"

### Step 3: Verify Installation

Open Command Prompt or PowerShell:

```bash
# Check if MongoDB is installed
mongod --version

# Check if MongoDB service is running
sc query MongoDB
```

Expected output: `STATE: RUNNING`

### Step 4: Start MongoDB (if not running)

**As Administrator**, run:

```bash
net start MongoDB
```

### Step 5: Test Connection

```bash
# Open MongoDB shell
mongosh

# You should see a connection to mongodb://127.0.0.1:27017
# Type 'exit' to close
```

## Alternative Method: MongoDB Atlas (Cloud)

If you prefer not to install MongoDB locally:

### Step 1: Create Atlas Account
1. Go to: https://www.mongodb.com/cloud/atlas
2. Sign up for free
3. Create a free M0 cluster (no credit card required)

### Step 2: Set Up Database Access
1. In Atlas dashboard, go to "Database Access"
2. Add new database user with password
3. Remember username and password

### Step 3: Get Connection String
1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Copy the connection string (looks like):
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### Step 4: Update Backend Configuration
Edit `backend/.env`:
```
MONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/darsteller-manager?retryWrites=true&w=majority
```
Replace `username` and `password` with your credentials.

## Troubleshooting

### MongoDB Won't Start

**Issue**: Service fails to start
**Solution 1**: Create data directory manually
```bash
mkdir "C:\Program Files\MongoDB\Server\7.0\data"
```

**Solution 2**: Check if port 27017 is in use
```bash
netstat -ano | findstr :27017
```
If another process is using it, either stop that process or change MongoDB port.

### MongoDB Service Not Found

**Issue**: Service wasn't installed
**Solution**: Install MongoDB as service manually
```bash
# As Administrator
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --install --serviceName "MongoDB" --serviceDisplayName "MongoDB" --dbpath "C:\Program Files\MongoDB\Server\7.0\data"
```

### Access Denied

**Issue**: Permission errors
**Solution**: Run Command Prompt as Administrator

### Connection Refused

**Issue**: Can't connect to MongoDB
**Check**:
1. Is MongoDB service running? `sc query MongoDB`
2. Is it listening on 27017? `netstat -ano | findstr :27017`
3. Check MongoDB logs: `C:\Program Files\MongoDB\Server\7.0\log\mongod.log`

## MongoDB Commands Reference

### Service Management (Run as Administrator)

```bash
# Start MongoDB
net start MongoDB

# Stop MongoDB
net stop MongoDB

# Restart MongoDB
net stop MongoDB && net start MongoDB

# Check status
sc query MongoDB
```

### MongoDB Shell Commands

```bash
# Connect to MongoDB
mongosh

# Show all databases
show dbs

# Use specific database
use darsteller-manager

# Show collections in current database
show collections

# Count documents in collection
db.users.countDocuments()

# Find all users
db.users.find()

# Delete all data (CAREFUL!)
db.dropDatabase()
```

## Post-Installation

Once MongoDB is running:

1. Go back to the project directory
2. Run `npm run install-all` (if not done yet)
3. Run `npm run seed` (to populate initial data)
4. Run `START.bat` or `npm start`

## Uninstalling MongoDB

1. Stop the service: `net stop MongoDB`
2. Open "Add or Remove Programs"
3. Find "MongoDB" and uninstall
4. Manually delete data directory if needed:
   - `C:\Program Files\MongoDB\`
   - `C:\data\db\` (if you used default path)

## Resources

- Official MongoDB Documentation: https://www.mongodb.com/docs/manual/
- MongoDB University (Free Courses): https://university.mongodb.com/
- MongoDB Compass (GUI): https://www.mongodb.com/products/compass
