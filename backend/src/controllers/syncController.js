import connectorService from '../connectors/ConnectorService.js';
import Availability from '../models/Availability.js';
import Profile from '../models/Profile.js';
import { toBlockedPeriods } from '../connectors/blockedPeriods.js';
import { asyncHandler as catchAsync } from '../middleware/asyncHandler.js';

/**
 * Whether the caller asked for a dry run.
 *
 * On these platforms "save" can mean publishing a public profile, so a dry run
 * - fill everything in, photograph the page, submit nothing - is the only way
 * to see what a push would do. It was reachable from a script and not through
 * the API, which meant every push the app itself could make was a live one.
 */
const wantsDryRun = (req) => req.body?.dryRun === true || req.query?.dryRun === 'true';

const said = (result, done) => (result?.dryRun
  ? 'Dry run: nothing was submitted to the platform.'
  : done);

/**
 * Sync availability to a specific platform
 * POST /api/sync/availability/:platformId
 */
export const syncAvailability = catchAsync(async (req, res) => {
  const { platformId } = req.params;
  const userId = req.user.id;

  // Fetch user's availability
  const availability = await Availability.find({ user: userId }).lean();

  if (!availability || availability.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'No availability data to sync'
      }
    });
  }

  // A calendar full of free days has no block times in it. Saying so beats
  // recording a sync that sent nothing, which is how "synced" comes to mean
  // nothing at all.
  if (toBlockedPeriods(availability).length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'No block times to share. Only blocked periods are sent to platforms.'
      }
    });
  }

  try {
    // Only block times leave here - the service reduces the entries before any
    // connector sees them. See connectors/blockedPeriods.js.
    const result = await connectorService.syncAvailability(
      userId,
      parseInt(platformId),
      availability,
      { dryRun: wantsDryRun(req) }
    );

    res.status(200).json({
      success: true,
      data: result,
      message: said(result, `Successfully synced ${result.itemsProcessed} block times to platform`)
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        details: 'Sync failed. Please check platform connection and try again.'
      }
    });
  }
});

/**
 * Sync media to a specific platform
 * POST /api/sync/media/:platformId
 */
export const syncMedia = catchAsync(async (req, res) => {
  const { platformId } = req.params;
  const userId = req.user.id;
  const { mediaId, mediaType } = req.body;

  if (!mediaId || !mediaType) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'mediaId and mediaType are required'
      }
    });
  }

  // TODO: Fetch media from database
  // For now, return not implemented
  res.status(501).json({
    success: false,
    error: {
      message: 'Media sync not yet implemented'
    }
  });
});

/**
 * Sync profile to a specific platform
 * POST /api/sync/profile/:platformId
 */
export const syncProfile = catchAsync(async (req, res) => {
  const { platformId } = req.params;
  const userId = req.user.id;

  // Fetch user's profile
  const profile = await Profile.findOne({ user: userId }).lean();

  if (!profile) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'No profile data to sync'
      }
    });
  }

  try {
    const result = await connectorService.syncProfile(
      userId,
      parseInt(platformId),
      profile,
      { dryRun: wantsDryRun(req) }
    );

    res.status(200).json({
      success: true,
      data: result,
      message: said(result, 'Successfully synced profile to platform')
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        details: 'Sync failed. Please check platform connection and try again.'
      }
    });
  }
});

/**
 * Get sync history for the current user
 * GET /api/sync/history
 */
export const getSyncHistory = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const limit = parseInt(req.query.limit) || 20;

  const history = await connectorService.getSyncHistory(userId, limit);

  res.status(200).json({
    success: true,
    data: history,
    count: history.length
  });
});

/**
 * Get sync status for a specific platform
 * GET /api/sync/status/:platformId
 */
export const getSyncStatus = catchAsync(async (req, res) => {
  const { platformId } = req.params;
  const userId = req.user.id;

  const status = await connectorService.getSyncStatus(userId, parseInt(platformId));

  res.status(200).json({
    success: true,
    data: status
  });
});

/**
 * Retry a failed sync
 * POST /api/sync/retry/:syncLogId
 */
export const retrySync = catchAsync(async (req, res) => {
  const { syncLogId } = req.params;

  try {
    const result = await connectorService.retrySync(syncLogId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Sync retry completed successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message
      }
    });
  }
});

/**
 * Bulk sync to multiple platforms
 * POST /api/sync/bulk
 */
export const bulkSync = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { platformIds, dataTypes = ['profile', 'availability'] } = req.body;

  if (!platformIds || !Array.isArray(platformIds) || platformIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'platformIds array is required'
      }
    });
  }

  const results = [];
  const errors = [];

  for (const platformId of platformIds) {
    try {
      // Sync based on dataTypes
      if (dataTypes.includes('availability')) {
        const availability = await Availability.find({ user: userId }).lean();
        if (availability && availability.length > 0) {
          const result = await connectorService.syncAvailability(userId, platformId, availability);
          results.push({ platformId, operation: 'availability', ...result });
        }
      }

      if (dataTypes.includes('profile')) {
        const profile = await Profile.findOne({ user: userId }).lean();
        if (profile) {
          const result = await connectorService.syncProfile(userId, platformId, profile);
          results.push({ platformId, operation: 'profile', ...result });
        }
      }

    } catch (error) {
      errors.push({
        platformId,
        error: error.message
      });
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
