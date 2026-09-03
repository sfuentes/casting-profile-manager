import connectorService from '../connectors/ConnectorService.js';
import Profile from '../models/Profile.js';
import { toBlockedPeriods } from '../connectors/blockedPeriods.js';
import { loadCalendarEntries } from '../utils/calendarEntries.js';
import { asyncHandler as catchAsync } from '../middleware/asyncHandler.js';

/**
 * A dry run is a verification tool, not a feature of the app.
 *
 * `ConnectorService` takes `{ dryRun: true }` and the scripts use it to check a
 * push before anything is published. The HTTP layer deliberately does not read
 * it off the request: a sync route exists to sync, and a client that could ask
 * for a dry run could also record one as if the platform had been updated.
 * Nothing here forwards a caller-supplied dryRun.
 */

/**
 * Sync availability to a specific platform
 * POST /api/sync/availability/:platformId
 */
export const syncAvailability = catchAsync(async (req, res) => {
  const { platformId } = req.params;
  const userId = req.user.id;

  // Bookings, options and availability entries together - they are three
  // collections in the manager and one statement to a platform.
  const availability = await loadCalendarEntries(userId);

  if (availability.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'No calendar entries to sync'
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
      parseInt(platformId, 10),
      availability
    );

    res.status(200).json({
      success: true,
      data: result,
      message: `Successfully synced ${result.itemsProcessed} block times to platform`
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
 * Sync the profile's pictures and videos to a platform
 * POST /api/sync/media/:platformId
 *
 * The payload is the profile, not a single media item. Which picture goes into
 * which slot is the connector's decision - it is the only party that can see
 * the slots and ask each one what it accepts - so the route's job is to hand
 * over the profile and report what came back.
 *
 * This used to answer 501 with a TODO to fetch media from the database. There
 * was nothing to fetch: only references are stored, because a picture stays on
 * the platform hosting it, and the connector fetches it through the logged-in
 * page at upload time.
 */
export const syncMedia = catchAsync(async (req, res) => {
  const { platformId } = req.params;
  const userId = req.user.id;

  const profile = await Profile.findOne({ user: userId }).lean();

  if (!profile) {
    return res.status(400).json({
      success: false,
      error: { message: 'No profile to take pictures or videos from' }
    });
  }

  try {
    const result = await connectorService.syncMedia(userId, parseInt(platformId, 10), profile);

    res.status(200).json({
      success: true,
      data: result,
      message: `Successfully uploaded ${result.itemsProcessed} file(s) to platform`
    });
  } catch (error) {
    // A platform whose uploader nobody has read yet is not a server fault, and
    // it is not retryable either - it says so in the message.
    const status = error.name === 'NotSupportedError' ? 400 : 500;
    res.status(status).json({
      success: false,
      error: {
        message: error.message,
        details: status === 400
          ? 'This platform has no upload slots yet.'
          : 'Upload failed. Please check platform connection and try again.'
      }
    });
  }
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
      parseInt(platformId, 10),
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
 * Add the credits a platform is missing
 * POST /api/sync/work-history/:platformId
 *
 * Answers to earlier questions come in the body as `resolutions`, keyed the way
 * the questions were - the same contract the import dialog uses for values it
 * could not map. A credit the connector cannot tell apart from one already on
 * the platform is returned as a question and is neither added nor discarded:
 * pushing it might duplicate a credit on a public profile, dropping it might
 * lose a job from a CV, and only the user knows which.
 */
export const syncWorkHistory = catchAsync(async (req, res) => {
  const { platformId } = req.params;
  const userId = req.user.id;

  const profile = await Profile.findOne({ user: userId }).lean();

  if (!profile?.workHistory?.length) {
    return res.status(400).json({
      success: false,
      error: { message: 'No credits in the profile to sync' }
    });
  }

  try {
    const result = await connectorService.syncWorkHistory(
      userId,
      parseInt(platformId, 10),
      profile,
      { resolutions: req.body?.resolutions || {} }
    );

    res.status(200).json({
      success: true,
      data: result,
      questions: result.questions || [],
      message: result.questions?.length
        ? `${result.itemsProcessed} credit(s) added, ${result.questions.length} need a decision`
        : `${result.itemsProcessed} credit(s) added`
    });
  } catch (error) {
    const status = error.name === 'NotSupportedError' ? 400 : 500;
    res.status(status).json({
      success: false,
      error: {
        message: error.message,
        details: status === 400
          ? 'This platform cannot receive credits yet.'
          : 'Sync failed. Please check platform connection and try again.'
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
  const limit = parseInt(req.query.limit, 10) || 20;

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

  const status = await connectorService.getSyncStatus(userId, parseInt(platformId, 10));

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
        const availability = await loadCalendarEntries(userId);
        if (availability.length > 0) {
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
