import mongoose from 'mongoose';
import Platform from '../models/Platform.js';
import Profile from '../models/Profile.js';
import connectorService from '../connectors/ConnectorService.js';
import { getConnector } from '../connectors/registry.js';
import { logger } from '../utils/logger.js';
import { asyncHandler as catchAsync } from '../middleware/asyncHandler.js';

/**
 * Callers are inconsistent about which id they send: the Mongo _id of the
 * user's platform record, or the small numeric platformId that identifies the
 * site itself. Accept either rather than 404-ing on the wrong one.
 */
const findUserPlatform = async (id, userId) => {
  if (mongoose.isValidObjectId(id)) {
    const byId = await Platform.findOne({ _id: id, user: userId });
    if (byId) return byId;
  }
  const numeric = parseInt(id, 10);
  if (Number.isNaN(numeric)) return null;
  return Platform.findOne({ platformId: numeric, user: userId });
};

/**
 * Verify credentials through the connector layer.
 *
 * Whether a platform can be logged into at all, and what it supports, comes
 * from its manifest - no ids are special-cased here any more.
 */
const verifyPlatformCredentials = (platform) => connectorService.verify(platform);

// Get all platforms for the current user
export const getPlatforms = catchAsync(async (req, res) => {
  const platforms = await Platform.find({ user: req.user.id });
  res.status(200).json({
    success: true,
    count: platforms.length,
    data: platforms
  });
});

// Get single platform
export const getPlatform = catchAsync(async (req, res) => {
  const platform = await Platform.findOne({
    _id: req.params.id,
    user: req.user.id
  });

  if (!platform) {
    return res.status(404).json({
      success: false,
      message: 'Platform not found'
    });
  }

  res.status(200).json({
    success: true,
    data: platform
  });
});

// Connect to a platform
export const connectPlatform = catchAsync(async (req, res) => {
  const { authData } = req.body;

  let platform = await findUserPlatform(req.params.id, req.user.id);

  if (!platform) {
    const numeric = parseInt(req.params.id, 10);
    if (Number.isNaN(numeric)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid platform identifier'
      });
    }
    platform = new Platform({
      user: req.user.id,
      platformId: numeric,
      name: req.body.name,
      authType: req.body.authType,
      authData,
      connected: false,
      meta: req.body.meta || {}
    });
  } else {
    if (authData) platform.authData = authData;
    if (req.body.name) platform.name = req.body.name;
    if (req.body.authType) platform.authType = req.body.authType;
    if (req.body.meta) platform.meta = req.body.meta;
  }

  // Verify before recording the platform as connected. Storing credentials and
  // reporting success without ever contacting the platform is what made the
  // previous behaviour misleading: the UI showed a working connection that had
  // never been tested.
  const result = await verifyPlatformCredentials(platform);

  platform.connected = result.ok;
  platform.testResult = {
    success: result.ok,
    message: result.message,
    timestamp: new Date()
  };
  platform.lastTested = new Date();
  if (result.ok) platform.lastSync = platform.lastSync || null;

  await platform.save();

  res.status(result.ok ? 200 : 400).json({
    success: result.ok,
    verified: result.verified,
    message: result.message,
    data: platform
  });
});

// Disconnect from a platform
export const disconnectPlatform = catchAsync(async (req, res) => {
  const platform = await Platform.findOne({
    _id: req.params.id,
    user: req.user.id
  });

  if (!platform) {
    return res.status(404).json({
      success: false,
      message: 'Platform not found'
    });
  }

  platform.connected = false;
  platform.authData = {};
  await platform.save();

  res.status(200).json({
    success: true,
    data: platform
  });
});

// Update platform settings
export const updatePlatformSettings = catchAsync(async (req, res) => {
  const { syncSettings } = req.body;

  const platform = await Platform.findOne({
    _id: req.params.id,
    user: req.user.id
  });

  if (!platform) {
    return res.status(404).json({
      success: false,
      message: 'Platform not found'
    });
  }

  if (syncSettings) {
    platform.syncSettings = {
      ...platform.syncSettings,
      ...syncSettings
    };
  }

  await platform.save();

  res.status(200).json({
    success: true,
    data: platform
  });
});

// Test platform connection - performs a real login attempt
export const testPlatformConnection = catchAsync(async (req, res) => {
  const platform = await findUserPlatform(req.params.id, req.user.id);

  if (!platform) {
    return res.status(404).json({
      success: false,
      message: 'Platform not found'
    });
  }

  const result = await verifyPlatformCredentials(platform);

  platform.testResult = {
    success: result.ok,
    message: result.message,
    timestamp: new Date()
  };
  platform.lastTested = new Date();
  // A failed test means the stored credentials no longer work; stop reporting
  // the platform as connected until they are fixed.
  if (!result.ok) platform.connected = false;
  await platform.save();

  res.status(200).json({
    success: result.ok,
    verified: result.verified,
    message: result.message,
    data: {
      platform,
      testResult: platform.testResult
    }
  });
});

// Sync the user's profile to a platform
export const syncToPlatform = catchAsync(async (req, res) => {
  const platform = await findUserPlatform(req.params.id, req.user.id);

  if (!platform) {
    return res.status(404).json({
      success: false,
      message: 'Platform not found'
    });
  }

  if (!platform.connected) {
    return res.status(400).json({
      success: false,
      message: 'Platform not connected'
    });
  }

  if (!getConnector(platform.platformId)) {
    return res.status(501).json({
      success: false,
      message: `No sync integration is available for platform ${platform.platformId} yet.`
    });
  }

  const profile = await Profile.findOne({ user: req.user.id }).lean();
  if (!profile) {
    return res.status(400).json({
      success: false,
      message: 'No profile data to sync'
    });
  }

  try {
    const result = await connectorService.syncProfile(
      req.user.id,
      platform.platformId,
      profile
    );
    res.status(200).json({
      success: true,
      message: 'Profile synced to platform',
      data: result
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      message: error.message,
      details: 'The platform rejected the sync or could not be reached.'
    });
  }
});

// Sync to several platforms, reporting each outcome separately
export const bulkSyncToPlatforms = catchAsync(async (req, res) => {
  const { platformIds } = req.body;

  if (!platformIds || !Array.isArray(platformIds) || platformIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide an array of platform IDs'
    });
  }

  const profile = await Profile.findOne({ user: req.user.id }).lean();
  if (!profile) {
    return res.status(400).json({
      success: false,
      message: 'No profile data to sync'
    });
  }

  // Sequential on purpose: each scraping adapter starts a browser, and running
  // several at once would multiply memory use on a small server.
  const results = [];
  for (const id of platformIds) {
    const platform = await findUserPlatform(id, req.user.id);

    if (!platform || !platform.connected) {
      results.push({ platformId: id, success: false, message: 'Not connected' });
      continue;
    }
    if (!getConnector(platform.platformId)) {
      results.push({
        platformId: id,
        success: false,
        message: 'No integration available yet'
      });
      continue;
    }

    try {
      await connectorService.syncProfile(req.user.id, platform.platformId, profile);
      results.push({ platformId: id, success: true, message: 'Synced' });
    } catch (error) {
      results.push({ platformId: id, success: false, message: error.message });
    }
  }

  const syncedCount = results.filter((r) => r.success).length;

  res.status(200).json({
    success: syncedCount > 0,
    message: `Synced ${syncedCount} of ${results.length} platforms`,
    data: { syncedCount, results }
  });
});

// OAuth is not available: every platform currently integrated is driven by
// browser automation with the user's own credentials. The previous handlers
// pointed at platform-oauth-mock.com - a domain that does not exist - and
// minted fake tokens, which made the flow look implemented when it was not.
const oauthUnavailable = (req, res) =>
  res.status(501).json({
    success: false,
    message:
      'OAuth is not available. These platforms are integrated with stored ' +
      'credentials, not OAuth. Use POST /api/platforms/:id/connect instead.'
  });

export const initiateOAuth = catchAsync(oauthUnavailable);
export const handleOAuthCallback = catchAsync(oauthUnavailable);
