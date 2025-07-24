import Availability from '../models/Availability.js';
import Platform from '../models/Platform.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import platformAgent from '../services/platformAgent.js';

// @desc    Get all availability slots
// @route   GET /api/v1/availability
// @access  Private
export const getAvailability = async (req, res, next) => {
  try {
    const availability = await Availability.find({ user: req.user.id });

    res.status(200).json({
      success: true,
      count: availability.length,
      data: availability
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single availability slot
// @route   GET /api/v1/availability/:id
// @access  Private
export const getAvailabilityItem = async (req, res, next) => {
  try {
    const availability = await Availability.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!availability) {
      throw new ApiError(`Availability not found with id of ${req.params.id}`, 404);
    }

    res.status(200).json({
      success: true,
      data: availability
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new availability slot
// @route   POST /api/v1/availability
// @access  Private
export const addAvailability = async (req, res, next) => {
  try {
    // Add user to req.body
    req.body.user = req.user.id;

    // Validate dates
    const { startDate, endDate } = req.body;
    if (new Date(endDate) < new Date(startDate)) {
      throw new ApiError('End date cannot be before start date', 400);
    }

    const availability = await Availability.create(req.body);

    res.status(201).json({
      success: true,
      data: availability
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update availability slot
// @route   PUT /api/v1/availability/:id
// @access  Private
export const updateAvailabilityItem = async (req, res, next) => {
  try {
    let availability = await Availability.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!availability) {
      throw new ApiError(`Availability not found with id of ${req.params.id}`, 404);
    }

    // Validate dates if updating
    if (req.body.startDate && req.body.endDate) {
      if (new Date(req.body.endDate) < new Date(req.body.startDate)) {
        throw new ApiError('End date cannot be before start date', 400);
      }
    }

    // Reset synced status if important fields are changed
    const importantFields = ['type', 'startDate', 'endDate', 'startTime', 'endTime'];
    const hasImportantChanges = importantFields.some(field => req.body[field] !== undefined);

    if (hasImportantChanges) {
      req.body.synced = false;
    }

    availability = await Availability.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: availability
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete availability slot
// @route   DELETE /api/v1/availability/:id
// @access  Private
export const deleteAvailability = async (req, res, next) => {
  try {
    const availability = await Availability.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!availability) {
      throw new ApiError(`Availability not found with id of ${req.params.id}`, 404);
    }

    await availability.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Availability deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Sync availability to platforms
// @route   POST /api/v1/availability/sync
// @access  Private
export const syncAvailabilityToPlatforms = async (req, res, next) => {
  try {
    // Get all availability slots
    const availabilitySlots = await Availability.find({ user: req.user.id });

    // Get connected platforms with availability sync enabled
    const platforms = await Platform.find({
      user: req.user.id,
      connected: true,
      'syncSettings.syncAvailability': true
    });

    if (platforms.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No platforms configured for availability sync',
        syncedCount: 0,
        timestamp: new Date().toISOString()
      });
    }

    // Track sync results
    let syncCount = 0;
    const syncResults = [];
    const timestamp = new Date().toISOString();

    // Sync to each platform
    for (const platform of platforms) {
      try {
        // Prepare data for the platform
        const availabilityData = {
          slots: availabilitySlots.map(slot => ({
            startDate: slot.startDate,
            endDate: slot.endDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            type: slot.type,
            reason: slot.reason,
            preferredCallStart: slot.preferredCallStart,
            preferredCallEnd: slot.preferredCallEnd,
            minimumNotice: slot.minimumNotice
          }))
        };

        // Sync availability using platform agent
        const result = await platformAgent.updateAvailability(
          platform.platformId,
          platform.authData,
          availabilityData
        );

        // Update sync status for each availability slot
        for (const slot of availabilitySlots) {
          await Availability.findByIdAndUpdate(slot._id, {
            synced: true,
            $push: {
              syncedPlatforms: {
                platformId: platform.platformId,
                syncedAt: timestamp,
                status: 'success'
              }
            }
          });
        }

        syncCount++;
        syncResults.push({
          platformId: platform.platformId,
          name: platform.name,
          success: true,
          timestamp,
          message: result.message || 'Sync successful'
        });

        // Update platform's last sync time
        await Platform.findByIdAndUpdate(platform._id, { lastSync: timestamp });
      } catch (error) {
        logger.error(`Failed to sync availability to platform ${platform.name}:`, error);
        syncResults.push({
          platformId: platform.platformId,
          name: platform.name,
          success: false,
          timestamp,
          message: error.message || 'Sync failed'
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Availability synced to ${syncCount} platform(s)`,
      syncedCount: syncCount,
      results: syncResults,
      timestamp
    });
  } catch (error) {
    next(error);
  }
};
