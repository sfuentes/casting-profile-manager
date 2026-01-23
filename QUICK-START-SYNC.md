# Quick Start Guide - Platform Synchronization

## 🚀 Getting Started

The platform synchronization system is now fully implemented and running. Here's how to use it:

## ✅ Prerequisites

- Backend running on `http://localhost:5000` ✓
- MongoDB running ✓
- User account created and logged in ✓

## 📱 Using the Sync Features

### 1. **View Sync Components in Your App**

To integrate the sync UI into your existing platform pages, import the components:

```jsx
import { SyncStatus, SyncHistory } from './components';

// In your PlatformView or similar component:
<SyncStatus platformId={4} platformName="e-TALENTA" />
<SyncHistory />
```

### 2. **API Endpoints Available**

All endpoints require Bearer token authentication:

```bash
# Get sync history
GET /api/sync/history?limit=20

# Sync availability to platform
POST /api/sync/availability/:platformId

# Sync profile to platform
POST /api/sync/profile/:platformId

# Sync media to platform
POST /api/sync/media/:platformId

# Get sync status for a platform
GET /api/sync/status/:platformId

# Bulk sync to multiple platforms
POST /api/sync/bulk
```

### 3. **Test the Sync Functionality**

#### Option A: Using the Frontend (Recommended)
1. Navigate to the Platforms page
2. Select a connected platform
3. Click "Sync Availability" or "Sync Profile"
4. Check the sync status display

#### Option B: Using cURL

```bash
# Replace YOUR_TOKEN with your JWT token
TOKEN="YOUR_TOKEN_HERE"

# 1. Sync availability to e-TALENTA (Platform 4)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:5000/api/sync/availability/4

# 2. Check sync history
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/sync/history

# 3. Get sync status for a platform
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/sync/status/4

# 4. Bulk sync
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"platformIds": [1,3,4], "dataTypes": ["profile", "availability"]}' \
  http://localhost:5000/api/sync/bulk
```

## 🔧 Platform Configuration

### e-TALENTA (Platform 4) - API Integration

**Credentials needed in Platform model:**
```json
{
  "username": "your.email@example.com",
  "password": "your_password"
}
```

**Environment variables** (add to `backend/.env`):
```bash
ETALENTA_API_URL=https://api.e-talenta.eu/v1
ETALENTA_CLIENT_ID=your_client_id
ETALENTA_CLIENT_SECRET=your_client_secret
```

### Filmmakers (Platform 1) - Web Scraping

**Credentials needed:**
```json
{
  "email": "your.email@example.com",
  "password": "your_password"
}
```

### Schauspielervideos (Platform 3) - API Integration

**Credentials needed:**
```json
{
  "apiKey": "your_api_key_here"
}
```

**Environment variable** (add to `backend/.env`):
```bash
SCHAUSPIELERVIDEOS_API_URL=https://api.schauspielervideos.de/v2
```

## 📊 Expected Behavior

### Success Response:
```json
{
  "success": true,
  "data": {
    "syncLog": {...},
    "itemsProcessed": 5,
    "duration": 2345
  },
  "message": "Successfully synced 5 availability items to platform"
}
```

### Error Response:
```json
{
  "success": false,
  "error": {
    "message": "No adapter available for platform 2. Sync functionality not yet implemented."
  }
}
```

## ⚠️ Important Notes

1. **Adapter Availability**:
   - Platform 1 (Filmmakers): ✅ Available
   - Platform 2 (Casting Network): ❌ Not implemented
   - Platform 3 (Schauspielervideos): ✅ Available
   - Platform 4 (e-TALENTA): ✅ Available
   - Platforms 5-9: Various statuses

2. **Rate Limiting**:
   - e-TALENTA: 100 requests/minute
   - Schauspielervideos: 50 requests/minute
   - Filmmakers: 10 requests/minute (web scraping)

3. **Credentials**:
   - Credentials must be stored in the Platform model's `authData` field
   - Credentials are encrypted at rest

4. **First Sync**:
   - First sync might take longer as authentication is established
   - Subsequent syncs will be faster

## 🐛 Troubleshooting

### "Platform not connected" Error
- Ensure the platform's `connected` field is set to `true` in the database
- Verify credentials are correct and stored in `authData`

### "No adapter available" Error
- The platform adapter hasn't been implemented yet
- Check `SYNC-IMPLEMENTATION-COMPLETE.md` for platform coverage

### "Authentication failed" Error
- Check credentials are correct
- For API platforms, verify API keys/client credentials in `.env`
- For scraping platforms, check if website structure has changed

### Puppeteer/Scraping Issues
- Ensure Docker container has sufficient resources
- Check logs: `docker logs casting-backend`
- Filmmakers may detect bot behavior - use sparingly

## 📚 Next Steps

1. **Add Real Credentials**: Replace placeholder credentials with real platform credentials
2. **Test Each Platform**: Test sync for each implemented platform
3. **Monitor Logs**: Check `docker logs casting-backend` for detailed sync logs
4. **Review History**: Use SyncHistory component to monitor success rates
5. **Implement Remaining Platforms**: Use existing adapters as templates

## 🔗 Related Documentation

- **Full Implementation Details**: See `SYNC-IMPLEMENTATION-COMPLETE.md`
- **Strategy Document**: See `SYNC-STRATEGY.md`
- **Implementation Guide**: See `IMPLEMENTATION-GUIDE.md`

## 💡 Quick Tips

- Start with e-TALENTA (Platform 4) - it has the most robust API
- Test availability sync first - it's simpler than profile sync
- Check sync history after each operation to verify success
- Use bulk sync for efficiency when syncing to multiple platforms
- Rate limits are enforced - respect them to avoid being blocked

---

**Status**: ✅ System ready for testing
**Backend**: Running on http://localhost:5000
**Database**: Connected and healthy
**Adapters**: 3/9 platforms implemented (e-TALENTA, Filmmakers, Schauspielervideos)
