# Quick Guide: Add Platforms to Users

## If a user has no platforms showing in their account:

### Option 1: Run Migration Script (Adds to ALL users)

```bash
# This adds platforms to any user that doesn't have them
docker-compose exec backend npm run add-platforms
```

This is **safe** to run multiple times - it only adds missing platforms.

### Option 2: Manual Database Query (Specific user)

```bash
# 1. Find the user's ID
docker-compose exec mongodb mongosh -u admin -p admin123 --authenticationDatabase admin --eval "db.getSiblingDB('darsteller-manager').users.find({email: 'user@example.com'}, {_id: 1}).pretty()"

# 2. Check if they have platforms
docker-compose exec mongodb mongosh -u admin -p admin123 --authenticationDatabase admin --eval "db.getSiblingDB('darsteller-manager').platforms.find({user: ObjectId('USER_ID_HERE')}).count()"

# 3. If count is 0, run the migration
docker-compose exec backend npm run add-platforms
```

### Option 3: Quick Fix Script (Windows)

Save this as `fix-platforms.bat`:

```batch
@echo off
echo Adding platforms to all users...
docker-compose exec backend npm run add-platforms
echo Done!
pause
```

## Verification

After running the migration, the user should:
1. **Logout** from the app
2. **Login** again
3. Navigate to **"Plattformen"** section
4. See all 9 platforms listed

## What Gets Added

All users receive these 9 platforms:

| # | Platform Name | Type | Region |
|---|--------------|------|---------|
| 1 | Filmmakers | OAuth | DE, AT, CH |
| 2 | Casting Network | API | US, UK, CA, AU |
| 3 | Schauspielervideos | API | DE, AT, CH |
| 4 | e-TALENTA | API | EU, DE, AT, CH |
| 5 | JobWork | OAuth | DE, AT, CH |
| 6 | Agentur Iris Müller | Manual | DE |
| 7 | Agentur Connection | API | DE, AT |
| 8 | Agentur Sarah Weiss | Manual | DE |
| 9 | Wanted | OAuth | DE, AT, CH |

All platforms start as **disconnected** (users need to connect them).

## When to Run

Run the migration when:
- ✅ A user reports empty platform list
- ✅ After restoring from database backup
- ✅ After manually creating users in database
- ✅ New user registered before the auto-creation feature

## Troubleshooting

### User still doesn't see platforms after migration

**Solution**: Have the user **logout and login again**

```bash
# Verify platforms exist in database
docker-compose exec mongodb mongosh -u admin -p admin123 --authenticationDatabase admin --eval "db.getSiblingDB('darsteller-manager').platforms.find({user: ObjectId('USER_ID')}).count()"

# Should return: 9
```

### Frontend shows "Loading..." forever

**Solution**:
1. Check browser console for errors
2. Verify backend is running: `docker-compose ps`
3. Check API is accessible: `curl http://localhost:5000/health`

### Migration fails

**Solution**:
```bash
# Check containers are running
docker-compose ps

# Check backend logs
docker-compose logs backend --tail=50

# Restart if needed
docker-compose restart backend
```

## Quick Command Reference

```bash
# List all users
docker-compose exec mongodb mongosh -u admin -p admin123 --authenticationDatabase admin --eval "db.getSiblingDB('darsteller-manager').users.find({}, {name: 1, email: 1}).pretty()"

# Count platforms per user
docker-compose exec mongodb mongosh -u admin -p admin123 --authenticationDatabase admin --eval "db.getSiblingDB('darsteller-manager').platforms.aggregate([{$group: {_id: '$user', count: {$sum: 1}}}]).pretty()"

# Add platforms to all users
docker-compose exec backend npm run add-platforms

# Restart backend
docker-compose restart backend
```

---

**Issue Resolved**: 2026-01-22
**User**: Sebastian Fuentes (sebastianfuen@gmail.com)
**Solution**: Ran `npm run add-platforms` - Added 9 platforms
**Status**: ✅ Fixed
