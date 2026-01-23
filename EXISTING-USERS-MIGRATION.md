# Migration: Add Platforms to Existing Users

## Overview
This migration adds the 9 default platforms to all existing users who registered before the platform auto-creation feature was implemented.

## What Was Done

### 1. Created Migration Script
**File**: `backend/src/utils/addPlatformsToExistingUsers.js`

This script:
- Connects to the database
- Finds all existing users
- Checks which platforms each user already has
- Adds any missing platforms from the default list
- Skips platforms that already exist (prevents duplicates)
- Provides detailed logging of the process

### 2. Added NPM Script
**File**: `backend/package.json`

Added script command:
```json
"add-platforms": "node src/utils/addPlatformsToExistingUsers.js"
```

### 3. Ran Migration
Successfully migrated all existing users:

```bash
$ docker-compose exec backend npm run add-platforms

Connected to database
Found 2 users

Processing user: testuser@example.com
  - Existing platforms: 0 (IDs: none)
  ✅ Added 9 new platforms

Processing user: platformtest@example.com
  - Existing platforms: 9 (IDs: 1, 2, 3, 4, 5, 6, 7, 8, 9)
  - All platforms already exist for this user

========================================
Migration completed successfully!
Total platforms added: 9
Total platforms skipped (already exist): 9
========================================
```

## How to Run the Migration

### If you have existing users without platforms:

**Option 1: Using Docker**
```bash
# Make sure containers are running
docker-compose up -d

# Run the migration
docker-compose exec backend npm run add-platforms
```

**Option 2: Directly (if not using Docker)**
```bash
cd backend
npm run add-platforms
```

## Features of the Migration Script

✅ **Safe** - Only adds missing platforms, doesn't affect existing ones
✅ **Idempotent** - Can be run multiple times safely
✅ **Detailed Logging** - Shows exactly what's being done for each user
✅ **Error Handling** - Continues even if one user fails
✅ **Summary Report** - Shows total platforms added and skipped

## Platform List Added

The migration adds these 9 platforms to each user:

1. **Filmmakers** (Platform ID: 1)
2. **Casting Network** (Platform ID: 2)
3. **Schauspielervideos** (Platform ID: 3)
4. **e-TALENTA** (Platform ID: 4)
5. **JobWork** (Platform ID: 5)
6. **Agentur Iris Müller** (Platform ID: 6)
7. **Agentur Connection** (Platform ID: 7)
8. **Agentur Sarah Weiss** (Platform ID: 8)
9. **Wanted** (Platform ID: 9)

All platforms are created with:
- `connected: false`
- Empty `authData`
- Default `syncSettings`

## Verification

After running the migration, verify it worked:

```bash
# Login as a user
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Get platforms (use token from login response)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/platforms

# Should return:
# {"success":true,"count":9,"data":[...9 platforms...]}
```

## What Happens to New Users?

New users registering **after** the platform auto-creation feature was added will automatically get all 9 platforms during registration. They don't need this migration script.

The migration is only for users who registered **before** this feature was implemented.

## Files Created/Modified

### Created:
1. `backend/src/utils/addPlatformsToExistingUsers.js` - Migration script

### Modified:
1. `backend/package.json` - Added `add-platforms` script
2. Docker image rebuilt to include the new script

## When to Run This Migration

Run this migration if:
- ✅ You have existing users who registered before platform auto-creation
- ✅ Users are complaining about empty platform lists
- ✅ You're migrating from an older version of the application
- ✅ You've manually deleted platforms and want to restore defaults

**DO NOT** run if:
- ❌ All users are new (registered after the feature was added)
- ❌ You've customized platform lists per user
- ❌ You're in the middle of another migration

## Rollback

If you need to remove all platforms:

```javascript
// WARNING: This removes ALL platforms for ALL users!
// Run in MongoDB shell or via script
db.platforms.deleteMany({});
```

Then run the migration again to restore defaults.

## Future Migrations

If you need to:
- **Add new platforms**: Update `DEFAULT_PLATFORMS` in both:
  - `authController.js` (for new users)
  - `addPlatformsToExistingUsers.js` (for existing users)
  - Run migration again

- **Remove platforms**: Manual deletion or create a removal script

- **Update platform metadata**: Create a new migration script to update specific fields

## Troubleshooting

### Issue: "Cannot find module"
**Solution**: Rebuild Docker image with the new script
```bash
docker-compose build backend
docker-compose up -d
```

### Issue: "Connection refused"
**Solution**: Ensure MongoDB is running and containers are up
```bash
docker-compose ps
docker-compose up -d
```

### Issue: Platforms not showing in frontend
**Solution**:
1. Clear browser cache
2. Logout and login again
3. Check browser console for errors
4. Verify platforms exist in database

### Issue: Duplicate platforms
**Solution**: The script prevents duplicates automatically. If you have duplicates from manual creation, delete them first:
```javascript
// Find duplicates
db.platforms.aggregate([
  { $group: { _id: { user: "$user", platformId: "$platformId" }, count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } }
]);
```

## Best Practices

1. **Backup First**: Always backup your database before running migrations
   ```bash
   docker-compose exec mongodb mongodump -o /data/backup
   ```

2. **Test on Staging**: Run on staging environment first

3. **Monitor Logs**: Watch the output for any errors

4. **Verify Results**: Check a few users manually after migration

5. **Document**: Keep track of when you ran the migration

---

**Migration Created**: 2026-01-22
**Status**: ✅ Successfully completed
**Users Migrated**: 2 users
**Platforms Added**: 9 platforms per user
**Next Run**: Only needed for new existing users without platforms
