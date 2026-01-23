# Platform Sync Implementation Guide

## Current State Analysis

### Demo Mode Locations
1. `frontend/src/services/apiService.js` - `demoMode: false` with conditional logic
2. `frontend/src/context/AppContext.jsx` - References to demo mode
3. `frontend/src/services/platformAgent.js` - Simulation mode for platform testing

### What Needs to Change

The current implementation has mock/demo code that simulates platform syncing. We need to replace this with real sync logic.

## Step 1: Remove Demo Mode (Quick Win)

### File: `frontend/src/services/apiService.js`

**Current Pattern:**
```javascript
getProfile: async () => {
    if (apiService.demoMode) {
        // Return mock data
    }
    // Real API call
}
```

**Action**: Since `demoMode: false`, remove all the conditional blocks:

```javascript
getProfile: async () => {
    const response = await fetch(`${API_BASE_URL}/profile`, {headers: getHeaders()});
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch profile');
    }
    return data.data;
}
```

**Files to Clean:**
- Remove `if (apiService.demoMode)` blocks from all methods
- Remove `demoMode: false` property
- Keep only the real API calls

## Step 2: Backend Sync Service Architecture

### Create Base Adapter Interface

**File**: `backend/src/services/sync/BasePlatformAdapter.js`

```javascript
export class BasePlatformAdapter {
  constructor(platform, credentials) {
    this.platform = platform;
    this.credentials = credentials;
    this.rateLimiter = this.initRateLimiter();
  }

  // Must be implemented by subclasses
  async authenticate() {
    throw new Error('authenticate() must be implemented');
  }

  async pushAvailability(availability) {
    throw new Error('pushAvailability() must be implemented');
  }

  async pushMedia(media) {
    throw new Error('pushMedia() must be implemented');
  }

  async updateProfile(profile) {
    throw new Error('updateProfile() must be implemented');
  }

  // Common utilities
  async withRateLimit(fn) {
    await this.rateLimiter.consume(this.platform.platformId);
    return fn();
  }

  async withRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1 || !this.isRetryable(error)) {
          throw error;
        }
        await this.delay(Math.pow(2, i) * 1000); // Exponential backoff
      }
    }
  }

  isRetryable(error) {
    return error.code === 'ETIMEDOUT' ||
           error.code === 'ECONNRESET' ||
           (error.response?.status >= 500);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Create Sync Service

**File**: `backend/src/services/sync/SyncService.js`

```javascript
import { BasePlatformAdapter } from './BasePlatformAdapter.js';
import { FilmmakersAdapter } from './adapters/FilmmakersAdapter.js';
import { ETalentaAdapter } from './adapters/ETalentaAdapter.js';
import { CastingNetworkAdapter } from './adapters/CastingNetworkAdapter.js';
import SyncLog from '../../models/SyncLog.js';

class SyncService {
  constructor() {
    this.adapters = {
      1: FilmmakersAdapter,        // Filmmakers
      2: CastingNetworkAdapter,    // Casting Network
      3: null,                     // Schauspielervideos - TBD
      4: ETalentaAdapter,          // e-TALENTA
      5: null,                     // JobWork - TBD
      6: null,                     // Manual agency
      7: null,                     // Manual agency
      8: null,                     // Manual agency
      9: null                      // Wanted - TBD
    };
  }

  async syncAvailability(userId, platformId, availability) {
    const platform = await Platform.findOne({
      user: userId,
      platformId: platformId,
      connected: true
    });

    if (!platform) {
      throw new Error('Platform not connected');
    }

    const AdapterClass = this.adapters[platformId];
    if (!AdapterClass) {
      throw new Error(`No adapter available for platform ${platformId}`);
    }

    const adapter = new AdapterClass(platform, platform.authData);

    // Create sync log
    const syncLog = await SyncLog.create({
      user: userId,
      platform: platformId,
      operation: 'push_availability',
      status: 'pending',
      startedAt: new Date()
    });

    try {
      // Authenticate
      await adapter.authenticate();

      // Push availability
      const result = await adapter.pushAvailability(availability);

      // Update sync log
      syncLog.status = 'success';
      syncLog.completedAt = new Date();
      syncLog.itemsProcessed = result.count || availability.length;
      await syncLog.save();

      // Update platform last sync
      platform.lastSync = new Date();
      await platform.save();

      return { success: true, syncLog };
    } catch (error) {
      // Update sync log with error
      syncLog.status = 'failed';
      syncLog.error = error.message;
      syncLog.completedAt = new Date();
      await syncLog.save();

      throw error;
    }
  }

  async syncMedia(userId, platformId, media) {
    // Similar structure to syncAvailability
    // ...
  }

  async syncProfile(userId, platformId, profile) {
    // Similar structure to syncAvailability
    // ...
  }
}

export default new SyncService();
```

### Create SyncLog Model

**File**: `backend/src/models/SyncLog.js`

```javascript
import mongoose from 'mongoose';

const SyncLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  platform: {
    type: Number,
    required: true
  },
  operation: {
    type: String,
    enum: ['push_availability', 'push_media', 'push_profile', 'pull_availability'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'partial'],
    default: 'pending'
  },
  itemsProcessed: {
    type: Number,
    default: 0
  },
  error: String,
  startedAt: Date,
  completedAt: Date,
  duration: Number,
  metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

// Calculate duration before save
SyncLogSchema.pre('save', function(next) {
  if (this.completedAt && this.startedAt) {
    this.duration = this.completedAt - this.startedAt;
  }
  next();
});

export default mongoose.model('SyncLog', SyncLogSchema);
```

## Step 3: Platform Adapters

### Example: e-TALENTA Adapter (API-Based)

**File**: `backend/src/services/sync/adapters/ETalentaAdapter.js`

```javascript
import axios from 'axios';
import { BasePlatformAdapter } from '../BasePlatformAdapter.js';

export class ETalentaAdapter extends BasePlatformAdapter {
  constructor(platform, credentials) {
    super(platform, credentials);
    this.baseURL = 'https://api.etalenta.com/v1';
    this.apiKey = credentials.apiKey;
  }

  async authenticate() {
    // Verify API key
    const response = await axios.get(`${this.baseURL}/auth/verify`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` }
    });
    return response.data.valid;
  }

  async pushAvailability(availability) {
    // Convert our format to e-TALENTA format
    const formattedDates = availability.map(a => ({
      start_date: a.startDate.toISOString().split('T')[0],
      end_date: a.endDate.toISOString().split('T')[0],
      status: a.status === 'unavailable' ? 'blocked' : 'available'
    }));

    const response = await this.withRetry(async () => {
      return await axios.post(
        `${this.baseURL}/availability`,
        { dates: formattedDates },
        { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
      );
    });

    return {
      success: true,
      count: formattedDates.length,
      externalIds: response.data.ids
    };
  }

  async pushMedia(media) {
    const formData = new FormData();
    formData.append('file', media.buffer, media.filename);
    formData.append('type', media.type);

    const response = await axios.post(
      `${this.baseURL}/media`,
      formData,
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    return {
      success: true,
      externalId: response.data.id,
      url: response.data.url
    };
  }
}
```

### Example: Filmmakers Adapter (Web Scraping)

**File**: `backend/src/services/sync/adapters/FilmmakersAdapter.js`

```javascript
import puppeteer from 'puppeteer';
import { BasePlatformAdapter } from '../BasePlatformAdapter.js';

export class FilmmakersAdapter extends BasePlatformAdapter {
  constructor(platform, credentials) {
    super(platform, credentials);
    this.baseURL = 'https://www.filmmakers.de';
    this.email = credentials.email || credentials.username;
    this.password = credentials.password;
  }

  async authenticate() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto(`${this.baseURL}/login`);
      await page.type('#email', this.email);
      await page.type('#password', this.password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ timeout: 10000 });

      // Check if login was successful
      const isLoggedIn = await page.$('.user-dashboard') !== null;
      await browser.close();
      return isLoggedIn;
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  async pushAvailability(availability) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
      // Login
      await page.goto(`${this.baseURL}/login`);
      await page.type('#email', this.email);
      await page.type('#password', this.password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation();

      // Navigate to calendar
      await page.goto(`${this.baseURL}/calendar`);

      // Mark dates as unavailable
      for (const date of availability) {
        if (date.status === 'unavailable') {
          await this.markDateUnavailable(page, date);
        }
      }

      await browser.close();
      return { success: true, count: availability.length };
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  async markDateUnavailable(page, dateRange) {
    // Platform-specific calendar interaction logic
    const startDate = dateRange.startDate.toISOString().split('T')[0];
    const endDate = dateRange.endDate.toISOString().split('T')[0];

    // Click on date range
    await page.click(`[data-date="${startDate}"]`);
    // ... platform-specific calendar UI interaction
  }
}
```

## Step 4: API Controllers

### Update Availability Controller

**File**: `backend/src/controllers/availabilityController.js`

Add sync endpoint:

```javascript
import syncService from '../services/sync/SyncService.js';

export const syncAvailabilityToPlatforms = catchAsync(async (req, res) => {
  const { platformIds } = req.body; // Array of platform IDs to sync to

  const availability = await Availability.find({ user: req.user.id });

  const results = [];
  const errors = [];

  for (const platformId of platformIds) {
    try {
      const result = await syncService.syncAvailability(
        req.user.id,
        platformId,
        availability
      );
      results.push({ platformId, ...result });
    } catch (error) {
      errors.push({ platformId, error: error.message });
    }
  }

  res.status(200).json({
    success: true,
    synced: results.length,
    failed: errors.length,
    results,
    errors
  });
});
```

## Step 5: API Routes

**File**: `backend/src/routes/syncRoutes.js`

```javascript
import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  syncAvailability,
  syncMedia,
  getSyncHistory,
  getSyncStatus,
  retrySync
} from '../controllers/syncController.js';

const router = express.Router();

router.use(protect);

router.post('/availability/:platformId', syncAvailability);
router.post('/media/:platformId', syncMedia);
router.get('/history', getSyncHistory);
router.get('/status/:platformId', getSyncStatus);
router.post('/retry/:syncLogId', retrySync);

export default router;
```

Add to `backend/src/index.js`:
```javascript
import syncRoutes from './routes/syncRoutes.js';
app.use('/api/sync', syncRoutes);
```

## Step 6: Frontend Integration

### Remove Demo Mode

1. **Edit `frontend/src/services/apiService.js`**:
   - Remove `demoMode: false` property
   - Remove all `if (apiService.demoMode)` conditional blocks
   - Keep only the real API fetch calls

2. **Update Sync Calls**:

```javascript
// Add new sync methods
syncAvailabilityToPlatform: async (platformId) => {
  const response = await fetch(`${API_BASE_URL}/sync/availability/${platformId}`, {
    method: 'POST',
    headers: getHeaders()
  });
  return handleResponse(response);
},

getSyncHistory: async () => {
  const response = await fetch(`${API_BASE_URL}/sync/history`, {
    headers: getHeaders()
  });
  return handleResponse(response);
},

getSyncStatus: async (platformId) => {
  const response = await fetch(`${API_BASE_URL}/sync/status/${platformId}`, {
    headers: getHeaders()
  });
  return handleResponse(response);
}
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
- ✅ Create sync strategy document
- ☐ Remove demo mode from frontend
- ☐ Create BasePlatformAdapter
- ☐ Create SyncService
- ☐ Create SyncLog model
- ☐ Add sync routes

### Phase 2: First Adapter (Week 2)
- ☐ Implement e-TALENTA adapter (API-based - easiest)
- ☐ Test availability sync
- ☐ Add error handling
- ☐ Create sync history UI

### Phase 3: Additional Adapters (Week 3-4)
- ☐ Implement Filmmakers adapter (Puppeteer)
- ☐ Implement Casting Network adapter
- ☐ Add media sync support
- ☐ Implement retry logic

### Phase 4: Polish (Week 5)
- ☐ Add sync status indicators
- ☐ Create conflict resolution UI
- ☐ Add manual sync triggers
- ☐ Performance optimization

## Next Immediate Steps

1. **Review this implementation guide**
2. **Start with Phase 1**: Remove demo mode
3. **Create base infrastructure**: Adapters, SyncService, Models
4. **Implement one adapter** (e-TALENTA recommended)
5. **Test with real platform**
6. **Iterate and expand**

---

**Status**: Ready for implementation
**Complexity**: High
**Timeline**: 4-5 weeks
**Risk**: Medium (depends on platform API availability)
