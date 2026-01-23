import syncService from '../services/sync/SyncService.js';
import Availability from '../models/Availability.js';
import Profile from '../models/Profile.js';
import { asyncHandler as catchAsync } from '../middleware/asyncHandler.js';

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

  try {
    const result = await syncService.syncAvailability(
      userId,
      parseInt(platformId),
      availability
    );

    res.status(200).json({
      success: true,
      data: result,
      message: `Successfully synced ${result.itemsProcessed} availability items to platform`
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
    const result = await syncService.syncProfile(
      userId,
      parseInt(platformId),
      profile
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Successfully synced profile to platform'
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

  const history = await syncService.getSyncHistory(userId, limit);

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

  const status = await syncService.getSyncStatus(userId, parseInt(platformId));

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
    const result = await syncService.retrySync(syncLogId);

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
  const { platformIds, dataTypes } = req.body;

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
          const result = await syncService.syncAvailability(userId, platformId, availability);
          results.push({ platformId, operation: 'availability', ...result });
        }
      }

      if (dataTypes.includes('profile')) {
        const profile = await Profile.findOne({ user: userId }).lean();
        if (profile) {
          const result = await syncService.syncProfile(userId, platformId, profile);
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
