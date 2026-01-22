import Profile from '../models/Profile.js';
import Platform from '../models/Platform.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import platformAgent from '../services/platformAgent.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

// @desc    Get user profile
// @route   GET /api/v1/profile
// @access  Private
export const getProfile = asyncHandler(async (req, res, next) => {
  let profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    // Create a new profile if it doesn't exist
    profile = await Profile.create({
      user: req.user.id,
      name: req.user.name,
      lastUpdated: new Date()
    });
  }

  res.status(200).json({
    success: true,
    data: profile
  });
});

// @desc    Update user profile
// @route   PUT /api/v1/profile
// @access  Private
export const updateProfile = asyncHandler(async (req, res, next) => {
  let profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    // Create a new profile if it doesn't exist
    profile = await Profile.create({
      user: req.user.id,
      ...req.body,
      lastUpdated: new Date()
    });
  } else {
    // Update existing profile
    profile = await Profile.findOneAndUpdate(
      { user: req.user.id },
      { ...req.body, lastUpdated: new Date() },
      { new: true, runValidators: true }
    );
  }

  res.status(200).json({
    success: true,
    data: profile
  });
});

// @desc    Add work history item
// @route   POST /api/v1/profile/work-history
// @access  Private
export const addWorkHistory = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    throw new ApiError('Profile not found', 404);
  }

  // Create a unique ID for the work history item
  const workItem = {
    ...req.body,
    id: `work-${Date.now()}`
  };

  profile.workHistory = [...(profile.workHistory || []), workItem];
  profile.lastUpdated = new Date();

  await profile.save();

  res.status(201).json({
    success: true,
    data: workItem
  });
});

// @desc    Update work history item
// @route   PUT /api/v1/profile/work-history/:id
// @access  Private
export const updateWorkHistory = asyncHandler(async (req, res, next) => {
  const profile = await Profile.findOne({ user: req.user.id });

  if (!profile) {
    throw new ApiError('Profile not found', 404);
  }

  // Find and update the work history item
  const workHistoryIndex = profile.workHistory.findIndex(
    (item) => item.id === req.params.id
  );

  if (workHistoryIndex === -1) {
    throw new ApiError('Work history item not found', 404);
  }

  // Update the item
  profile.workHistory[workHistoryIndex] = {
    ...profile.workHistory[workHistoryIndex],
    ...req.body
  };

  profile.lastUpdated = new Date();
  await profile.save();

  res.status(200).json({
    success: true,
    data: profile.workHistory[workHistoryIndex]
  });
});

// @desc    Delete work history item
// @route   DELETE /api/v1/profile/work-history/:id
// @access  Private
export const deleteWorkHistory = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id });

    if (!profile) {
      throw new ApiError('Profile not found', 404);
    }

    // Filter out the work history item
    profile.workHistory = profile.workHistory.filter(
      (item) => item.id !== req.params.id
    );

    profile.lastUpdated = new Date();
    await profile.save();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Work history item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add education item
// @route   POST /api/v1/profile/education
// @access  Private
export const addEducation = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id });

    if (!profile) {
      throw new ApiError('Profile not found', 404);
    }

    // Create a unique ID for the education item
    const educationItem = {
      ...req.body,
      id: `edu-${Date.now()}`
    };

    profile.education = [...(profile.education || []), educationItem];
    profile.lastUpdated = new Date();

    await profile.save();

    res.status(201).json({
      success: true,
      data: educationItem
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update education item
// @route   PUT /api/v1/profile/education/:id
// @access  Private
export const updateEducation = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id });

    if (!profile) {
      throw new ApiError('Profile not found', 404);
    }

    // Find and update the education item
    const educationIndex = profile.education.findIndex(
      (item) => item.id === req.params.id
    );

    if (educationIndex === -1) {
      throw new ApiError('Education item not found', 404);
    }

    // Update the item
    profile.education[educationIndex] = {
      ...profile.education[educationIndex],
      ...req.body
    };

    profile.lastUpdated = new Date();
    await profile.save();

    res.status(200).json({
      success: true,
      data: profile.education[educationIndex]
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete education item
// @route   DELETE /api/v1/profile/education/:id
// @access  Private
export const deleteEducation = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id });

    if (!profile) {
      throw new ApiError('Profile not found', 404);
    }

    // Filter out the education item
    profile.education = profile.education.filter(
      (item) => item.id !== req.params.id
    );

    profile.lastUpdated = new Date();
    await profile.save();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Education item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Sync profile to platforms
// @route   POST /api/v1/profile/sync
// @access  Private
export const syncProfileToPlatforms = async (req, res, next) => {
  try {
    // Get user profile
    const profile = await Profile.findOne({ user: req.user.id });

    if (!profile) {
      throw new ApiError('Profile not found', 404);
    }

    // Get connected platforms with profile sync enabled
    const platforms = await Platform.find({
      user: req.user.id,
      connected: true,
      'syncSettings.syncProfile': true
    });

    if (platforms.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No platforms configured for profile sync',
        synced: 0,
        platforms: []
      });
    }

    // Track sync results
    let syncCount = 0;
    const syncResults = [];
    const timestamp = new Date().toISOString();

    // Sync to each platform
    for (const platform of platforms) {
      try {
        // Sync profile using platform agent
        const result = await platformAgent.syncProfile(
          platform.platformId,
          platform.authData,
          profile
        );

        syncCount++;
        syncResults.push({
          platformId: platform.platformId,
          name: platform.name,
          success: true,
          timestamp,
          message: result.message || 'Sync successful',
          syncedFields: result.syncedFields || []
        });

        // Update platform's last sync time
        await Platform.findByIdAndUpdate(platform._id, { lastSync: timestamp });
      } catch (error) {
        logger.error(`Failed to sync profile to platform ${platform.name}:`, error);
        syncResults.push({
          platformId: platform.platformId,
          name: platform.name,
          success: false,
          timestamp,
          message: error.message || 'Sync failed'
        });
      }
    }

    // Get updated platforms list
    const updatedPlatforms = await Platform.find({ user: req.user.id });

    res.status(200).json({
      success: true,
      message: `Profile synced to ${syncCount} platform(s)`,
      synced: syncCount,
      results: syncResults,
      platforms: updatedPlatforms,
      timestamp
    });
  } catch (error) {
    next(error);
  }
};
