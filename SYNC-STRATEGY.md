# Platform Sync Strategy

## Overview

This document outlines the strategy for syncing calendar/availability and media with external casting platforms.

## Sync Architecture

### 1. Sync Service Layer

```
┌─────────────────────────────────────────────────────────────┐
│                    Sync Orchestrator                         │
│  - Manages sync queue                                        │
│  - Handles retries and failures                              │
│  - Logs sync history                                         │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Availability│   │    Profile   │   │    Media     │
│  Sync Service│   │ Sync Service │   │ Sync Service │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
        ┌──────────────────────────────────────┐
        │      Platform Adapters               │
        │  - Filmmakers Adapter                │
        │  - Casting Network Adapter           │
        │  - e-TALENTA Adapter                 │
        │  - etc...                            │
        └──────────────────────────────────────┘
```

## Data Types to Sync

### 1. **Availability/Calendar** (High Priority)
- Unavailable dates (blocked dates)
- Available date ranges
- Booking status (tentative/confirmed)
- Travel availability

### 2. **Media** (Medium Priority)
- Profile photos
- Headshots
- Setcard images
- Videos/showreels
- Resume/CV

### 3. **Profile Data** (Low Priority - Already Exists)
- Basic info (name, measurements, etc.)
- Skills and languages
- Work history
- Education

## Sync Strategies

### Strategy 1: Push-Based Sync (Recommended)

**When**: User makes a change in our system
**Action**: Immediately push to connected platforms

**Pros**:
- Real-time updates
- User sees immediate feedback
- Lower server load
- No polling required

**Cons**:
- Platform APIs must support write operations
- Requires retry logic for failures

**Implementation**:
```javascript
// User updates availability
async function updateAvailability(userId, availabilityData) {
  // 1. Save to our database
  await Availability.create(availabilityData);

  // 2. Get connected platforms with auto-sync enabled
  const platforms = await Platform.find({
    user: userId,
    connected: true,
    'syncSettings.autoSync': true,
    'syncSettings.syncAvailability': true
  });

  // 3. Push to each platform asynchronously
  for (const platform of platforms) {
    syncQueue.add({
      type: 'availability',
      platform: platform._id,
      data: availabilityData,
      userId
    });
  }
}
```

### Strategy 2: Pull-Based Sync

**When**: Scheduled intervals (hourly/daily)
**Action**: Fetch data from platforms and merge

**Pros**:
- Works with read-only APIs
- Catches external changes
- Consolidated sync windows

**Cons**:
- Not real-time
- Higher API quota usage
- Merge conflicts possible

**Use Case**: Syncing bookings created directly on platforms

### Strategy 3: Hybrid Approach (Best)

**Push** for our changes → platforms
**Pull** for platform changes → our system

## Platform-Specific Adapters

Each platform needs an adapter implementing this interface:

```typescript
interface PlatformAdapter {
  // Authentication
  authenticate(credentials: AuthData): Promise<boolean>;

  // Availability Sync
  pushAvailability(availability: Availability[]): Promise<SyncResult>;
  pullAvailability(): Promise<Availability[]>;

  // Media Sync
  uploadMedia(media: MediaFile): Promise<MediaUploadResult>;
  deleteMedia(mediaId: string): Promise<boolean>;
  listMedia(): Promise<MediaFile[]>;

  // Profile Sync (optional)
  updateProfile(profile: Profile): Promise<SyncResult>;
  getProfile(): Promise<Profile>;
}
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)

1. **Sync Queue Service**
   - Use Bull or BullMQ for job queue
   - Redis for queue storage
   - Retry logic with exponential backoff

2. **Sync History Tracking**
   - SyncLog model to track all sync operations
   - Status: pending, success, failed, partial
   - Error messages and retry count

3. **Base Adapter Class**
   - Abstract class with common functionality
   - Rate limiting
   - Error handling
   - Logging

### Phase 2: Availability Sync (Week 2)

1. **Availability Data Model**
   ```javascript
   {
     user: ObjectId,
     startDate: Date,
     endDate: Date,
     status: 'available' | 'unavailable' | 'tentative',
     type: 'booking' | 'block' | 'travel',
     platforms: [{ platformId, synced: Boolean, syncedAt: Date }]
   }
   ```

2. **Sync Service**
   - Batch sync multiple date ranges
   - Detect conflicts
   - Merge strategies

3. **Platform Adapters**
   - Start with platforms that have APIs
   - Filmmakers: Web scraping with Puppeteer
   - e-TALENTA: API integration
   - Casting Network: API integration

### Phase 3: Media Sync (Week 3)

1. **Media Tracking**
   ```javascript
   {
     user: ObjectId,
     type: 'photo' | 'video' | 'document',
     filename: String,
     url: String,
     platforms: [{
       platformId: Number,
       externalId: String,
       synced: Boolean,
       syncedAt: Date
     }]
   }
   ```

2. **Upload Strategy**
   - Optimize images (resize, compress)
   - Convert to platform-specific formats
   - Track external IDs

3. **Sync Service**
   - Upload new media
   - Update existing media
   - Delete removed media

## Platform Connection Types

### Type 1: API-Based (Easiest)
**Platforms**: e-TALENTA, Agentur Connection
**Method**: HTTP REST APIs
**Auth**: API Keys or OAuth tokens

```javascript
class ETalentaAdapter extends BasePlatformAdapter {
  async pushAvailability(availability) {
    const response = await axios.post(
      'https://api.etalenta.com/v1/availability',
      { dates: availability },
      { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
    );
    return { success: true, synced: availability.length };
  }
}
```

### Type 2: Web Scraping/Automation (Complex)
**Platforms**: Filmmakers, Casting Network, Schauspielervideos
**Method**: Puppeteer-based automation
**Auth**: Username/Password login

```javascript
class FilmmakersAdapter extends BasePlatformAdapter {
  async pushAvailability(availability) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Login
    await page.goto('https://filmmakers.de/login');
    await page.type('#email', this.credentials.email);
    await page.type('#password', this.credentials.password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    // Navigate to calendar
    await page.goto('https://filmmakers.de/calendar');

    // Update availability
    for (const date of availability) {
      await this.markDateUnavailable(page, date);
    }

    await browser.close();
    return { success: true };
  }
}
```

### Type 3: OAuth-Based (Secure)
**Platforms**: JobWork, Wanted
**Method**: OAuth 2.0 flow
**Auth**: Access tokens with refresh

```javascript
class JobWorkAdapter extends BasePlatformAdapter {
  async pushAvailability(availability) {
    // Refresh token if needed
    if (this.isTokenExpired()) {
      await this.refreshAccessToken();
    }

    const response = await axios.post(
      'https://api.jobwork.de/v2/calendar/unavailable',
      { dates: availability },
      { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
    );
    return { success: true };
  }
}
```

### Type 4: Manual/Email (Fallback)
**Platforms**: Agentur Iris Müller, Agentur Sarah Weiss
**Method**: Email notifications
**Auth**: N/A

```javascript
class ManualAdapter extends BasePlatformAdapter {
  async pushAvailability(availability) {
    // Send email to agency with changes
    await sendEmail({
      to: this.agencyEmail,
      subject: `Availability Update for ${user.name}`,
      body: this.formatAvailabilityEmail(availability)
    });
    return { success: true, method: 'email_sent' };
  }
}
```

## Conflict Resolution

### Scenario 1: Date Already Blocked on Platform
**Strategy**: Skip with warning
**User Action**: Manual review in conflict UI

### Scenario 2: Different Availability on Platform
**Strategy**: Our system is source of truth (push overwrites)
**Alternative**: Pull first, then merge

### Scenario 3: Booking Created on Platform
**Strategy**: Pull periodically and show in our system
**User Action**: Confirm or update

## Rate Limiting & Quotas

```javascript
const RATE_LIMITS = {
  filmmakers: { requests: 100, per: 'hour' },
  etalenta: { requests: 1000, per: 'day' },
  castingnetwork: { requests: 500, per: 'hour' }
};

// Implement with rate-limiter-flexible
const rateLimiter = new RateLimiterMemory({
  points: RATE_LIMITS[platform].requests,
  duration: parseDuration(RATE_LIMITS[platform].per)
});
```

## Error Handling

```javascript
class SyncError extends Error {
  constructor(platform, operation, originalError) {
    super(`Sync failed: ${platform} - ${operation}`);
    this.platform = platform;
    this.operation = operation;
    this.originalError = originalError;
    this.retryable = this.isRetryable(originalError);
  }

  isRetryable(error) {
    // Network errors, timeouts, 5xx - retry
    // Auth errors, 4xx - don't retry
    return error.code === 'ETIMEDOUT' ||
           error.response?.status >= 500;
  }
}
```

## Monitoring & Logging

```javascript
// Sync metrics
const metrics = {
  totalSyncs: Counter,
  successfulSyncs: Counter,
  failedSyncs: Counter,
  syncDuration: Histogram,
  lastSyncTime: Gauge
};

// Log every sync attempt
await SyncLog.create({
  user: userId,
  platform: platformId,
  operation: 'push_availability',
  status: 'success',
  itemsProcessed: 5,
  duration: 1234,
  timestamp: new Date()
});
```

## Security Considerations

1. **Credential Storage**: Encrypt all passwords and API keys
2. **Token Refresh**: Implement automatic OAuth token refresh
3. **Session Management**: Handle platform session timeouts
4. **Rate Limiting**: Respect platform API limits
5. **Audit Trail**: Log all sync operations

## Next Steps

1. ✅ Remove demo/mock mode from frontend
2. ✅ Implement base sync service architecture
3. ✅ Create platform adapter interface
4. ✅ Implement first adapter (e-TALENTA API)
5. ✅ Add sync queue with Bull
6. ✅ Implement sync history tracking
7. ✅ Create sync UI for manual triggers
8. ✅ Add conflict resolution UI

## API Endpoints

```
POST   /api/sync/availability/:platformId    # Manual sync
POST   /api/sync/media/:platformId          # Upload media
GET    /api/sync/history                    # Sync history
GET    /api/sync/status/:platformId         # Current status
POST   /api/sync/retry/:syncLogId           # Retry failed sync
```

---

**Priority**: High
**Complexity**: Medium-High
**Timeline**: 3-4 weeks
**Dependencies**: Platform API access, Redis for queuing
