import Platform from '../models/Platform.js';
import { asyncHandler as catchAsync } from '../middleware/asyncHandler.js';

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

  // Find the platform or create if doesn't exist
  let platform = await Platform.findOne({
    platformId: req.params.id,
    user: req.user.id
  });

  if (!platform) {
    // Create new platform connection
    platform = new Platform({
      user: req.user.id,
      platformId: parseInt(req.params.id),
      name: req.body.name,
      authType: req.body.authType,
      authData,
      connected: true,
      lastSync: new Date(),
      meta: req.body.meta || {}
    });
  } else {
    // Update existing platform
    platform.authData = authData;
    platform.connected = true;
    platform.lastSync = new Date();
    if (req.body.name) platform.name = req.body.name;
    if (req.body.meta) platform.meta = req.body.meta;
  }

  await platform.save();

  res.status(200).json({
    success: true,
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

// Test platform connection
export const testPlatformConnection = catchAsync(async (req, res) => {
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

  // In a real implementation, this would make an API call to the platform
  // For demo purposes, we'll just simulate a successful test
  const testResult = {
    success: true,
    message: 'Connection successful',
    timestamp: new Date()
  };

  platform.testResult = testResult;
  platform.lastTested = new Date();
  await platform.save();

  res.status(200).json({
    success: true,
    data: {
      platform,
      testResult
    }
  });
});

// Sync data to a platform
export const syncToPlatform = catchAsync(async (req, res) => {
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

  if (!platform.connected) {
    return res.status(400).json({
      success: false,
      message: 'Platform not connected'
    });
  }

  // In a real implementation, this would sync data to the platform
  // For demo purposes, we'll just update the lastSync date
  platform.lastSync = new Date();
  await platform.save();

  res.status(200).json({
    success: true,
    message: 'Sync completed successfully',
    data: platform
  });
});

// Bulk sync to multiple platforms
export const bulkSyncToPlatforms = catchAsync(async (req, res) => {
  const { platformIds } = req.body;

  if (!platformIds || !Array.isArray(platformIds) || platformIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide an array of platform IDs'
    });
  }

  const platforms = await Platform.find({
    _id: { $in: platformIds },
    user: req.user.id,
    connected: true
  });

  // In a real implementation, this would sync data to each platform
  // For demo purposes, we'll just update the lastSync date
  const updates = platforms.map((platform) => ({
    updateOne: {
      filter: { _id: platform._id },
      update: { lastSync: new Date() }
    }
  }));

  if (updates.length > 0) {
    await Platform.bulkWrite(updates);
  }

  res.status(200).json({
    success: true,
    message: `Sync completed for ${platforms.length} platforms`,
    data: {
      syncedCount: platforms.length,
      platformIds: platforms.map((p) => p._id)
    }
  });
});

// Initiate OAuth flow
export const initiateOAuth = catchAsync(async (req, res) => {
  const platformId = req.params.id;

  // In a real implementation, this would redirect to the platform's OAuth page
  // For demo purposes, we'll just return a mock URL
  const redirectUrl = `https://platform-oauth-mock.com/authorize?client_id=demo_client_id&redirect_uri=${encodeURIComponent(
    `${req.protocol}://${req.get('host')}/api/platforms/${platformId}/oauth/callback`
  )}&state=${req.user.id}_${Date.now()}`;

  res.status(200).json({
    success: true,
    data: {
      redirectUrl
    }
  });
});

// Handle OAuth callback
export const handleOAuthCallback = catchAsync(async (req, res) => {
  const { code, state } = req.query;
  const platformId = req.params.id;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Authorization code is required'
    });
  }

  // In a real implementation, this would exchange the code for tokens
  // For demo purposes, we'll create mock tokens
  const authData = {
    token: `mock_token_${Date.now()}`,
    refreshToken: `mock_refresh_${Date.now()}`,
    expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
  };

  // Find or create platform
  let platform = await Platform.findOne({
    platformId: parseInt(platformId),
    user: req.user.id
  });

  if (!platform) {
    // Create new platform
    platform = new Platform({
      user: req.user.id,
      platformId: parseInt(platformId),
      name: `Platform ${platformId}`,
      authType: 'oauth',
      authData,
      connected: true,
      lastSync: new Date()
    });
  } else {
    // Update existing platform
    platform.authData = authData;
    platform.connected = true;
    platform.lastSync = new Date();
  }

  await platform.save();

  // In a real implementation, this would redirect to the frontend
  // For demo purposes, we'll just return the platform data
  res.status(200).json({
    success: true,
    message: 'OAuth authentication successful',
    data: platform
  });
});
