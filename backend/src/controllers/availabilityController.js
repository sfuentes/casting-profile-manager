import Availability from '../models/Availability.js';
import Platform from '../models/Platform.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import platformAgent from '../services/platformAgent.js';
import { validateObjectId } from '../utils/validation.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

/**
 * @desc    Get all availability slots with filtering and pagination
 * @route   GET /api/availability
 * @access  Private
 */
export const getAvailability = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sort = '-createdAt',
    type,
    startDate,
    endDate,
    synced
  } = req.query;

  // Build query object
  const query = { user: req.user.id };

  // Add filters
  if (type) {
    query.type = type;
  }

  if (synced !== undefined) {
    query.synced = synced === 'true';
  }

  // Date range filtering
  if (startDate || endDate) {
    query.startDate = {};
    if (startDate) {
      query.startDate.$gte = new Date(startDate);
    }
    if (endDate) {
      query.startDate.$lte = new Date(endDate);
    }
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await Availability.countDocuments(query);

  // Execute query with pagination
  const availability = await Availability.find(query)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .populate('user', 'name email')
    .lean();

  // Calculate pagination info
  const totalPages = Math.ceil(total / parseInt(limit));
  const hasNextPage = parseInt(page) < totalPages;
  const hasPrevPage = parseInt(page) > 1;

  res.status(200).json({
    success: true,
    count: availability.length,
    total,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      hasNextPage,
      hasPrevPage,
      limit: parseInt(limit)
    },
    data: availability
  });
});

/**
 * @desc    Get single availability slot
 * @route   GET /api/availability/:id
 * @access  Private
 */
export const getAvailabilityItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId
  if (!validateObjectId(id)) {
    throw new ApiError('Invalid availability ID format', 400);
  }

  const availability = await Availability.findOne({
    _id: id,
    user: req.user.id
  }).populate('user', 'name email');

  if (!availability) {
    throw new ApiError(`Availability not found with id of ${id}`, 404);
  }

  res.status(200).json({
    success: true,
    data: availability
  });
});

/**
 * @desc    Create new availability slot
 * @route   POST /api/availability
 * @access  Private
 */
export const addAvailability = asyncHandler(async (req, res) => {
  const {
    type,
    startDate,
    endDate,
    startTime,
    endTime,
    reason,
    preferredCallStart,
    preferredCallEnd,
    minimumNotice,
    recurring,
    recurringPattern
  } = req.body;

  // Validate required fields
  if (!type || !startDate || !endDate) {
    throw new ApiError('Type, start date, and end date are required', 400);
  }

  // Validate date logic
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    throw new ApiError('End date cannot be before start date', 400);
  }

  // Validate time logic if both times are provided
  if (startTime && endTime) {
    const startTimeDate = new Date(`2000-01-01T${startTime}`);
    const endTimeDate = new Date(`2000-01-01T${endTime}`);

    if (endTimeDate <= startTimeDate) {
      throw new ApiError('End time must be after start time', 400);
    }
  }

  // Check for overlapping availability slots
  const overlapping = await Availability.findOne({
    user: req.user.id,
    $or: [
      {
        startDate: { $lte: end },
        endDate: { $gte: start }
      }
    ]
  });

  if (overlapping) {
    throw new ApiError('Availability slot overlaps with existing slot', 409);
  }

  // Create availability slot
  const availabilityData = {
    user: req.user.id,
    type,
    startDate: start,
    endDate: end,
    startTime,
    endTime,
    reason,
    preferredCallStart,
    preferredCallEnd,
    minimumNotice: minimumNotice || 24, // Default 24 hours
    recurring: recurring || false,
    recurringPattern,
    synced: false,
    syncedPlatforms: []
  };

  const availability = await Availability.create(availabilityData);

  logger.info(`New availability slot created by user ${req.user.id}`, {
    availabilityId: availability._id,
    type,
    startDate,
    endDate
  });

  res.status(201).json({
    success: true,
    message: 'Availability slot created successfully',
    data: availability
  });
});

/**
 * @desc    Update availability slot
 * @route   PUT /api/availability/:id
 * @access  Private
 */
export const updateAvailabilityItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId
  if (!validateObjectId(id)) {
    throw new ApiError('Invalid availability ID format', 400);
  }

  let availability = await Availability.findOne({
    _id: id,
    user: req.user.id
  });

  if (!availability) {
    throw new ApiError(`Availability not found with id of ${id}`, 404);
  }

  // Validate dates if updating
  const startDate = req.body.startDate || availability.startDate;
  const endDate = req.body.endDate || availability.endDate;

  if (new Date(endDate) < new Date(startDate)) {
    throw new ApiError('End date cannot be before start date', 400);
  }

  // Validate time logic if updating times
  const startTime = req.body.startTime || availability.startTime;
  const endTime = req.body.endTime || availability.endTime;

  if (startTime && endTime) {
    const startTimeDate = new Date(`2000-01-01T${startTime}`);
    const endTimeDate = new Date(`2000-01-01T${endTime}`);

    if (endTimeDate <= startTimeDate) {
      throw new ApiError('End time must be after start time', 400);
    }
  }

  // Check for overlapping availability slots (excluding current one)
  if (req.body.startDate || req.body.endDate) {
    const overlapping = await Availability.findOne({
      _id: { $ne: id },
      user: req.user.id,
      $or: [
        {
          startDate: { $lte: new Date(endDate) },
          endDate: { $gte: new Date(startDate) }
        }
      ]
    });

    if (overlapping) {
      throw new ApiError('Updated availability slot would overlap with existing slot', 409);
    }
  }

  // Reset synced status if important fields are changed
  const importantFields = ['type', 'startDate', 'endDate', 'startTime', 'endTime'];
  const hasImportantChanges = importantFields.some((field) => req.body[field] !== undefined && req.body[field] !== availability[field]);

  if (hasImportantChanges) {
    req.body.synced = false;
    req.body.syncedPlatforms = [];
  }

  // Update availability
  availability = await Availability.findByIdAndUpdate(
    id,
    { ...req.body, updatedAt: new Date() },
    {
      new: true,
      runValidators: true
    }
  );

  logger.info(`Availability slot updated by user ${req.user.id}`, {
    availabilityId: id,
    changes: Object.keys(req.body)
  });

  res.status(200).json({
    success: true,
    message: 'Availability slot updated successfully',
    data: availability
  });
});

/**
 * @desc    Delete availability slot
 * @route   DELETE /api/availability/:id
 * @access  Private
 */
export const deleteAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId
  if (!validateObjectId(id)) {
    throw new ApiError('Invalid availability ID format', 400);
  }

  const availability = await Availability.findOne({
    _id: id,
    user: req.user.id
  });

  if (!availability) {
    throw new ApiError(`Availability not found with id of ${id}`, 404);
  }

  await availability.deleteOne();

  logger.info(`Availability slot deleted by user ${req.user.id}`, {
    availabilityId: id
  });

  res.status(200).json({
    success: true,
    message: 'Availability slot deleted successfully',
    data: {}
  });
});

/**
 * @desc    Bulk delete availability slots
 * @route   DELETE /api/availability/bulk
 * @access  Private
 */
export const bulkDeleteAvailability = asyncHandler(async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ApiError('Provide array of availability IDs to delete', 400);
  }

  // Validate all IDs
  const invalidIds = ids.filter((id) => !validateObjectId(id));
  if (invalidIds.length > 0) {
    throw new ApiError(`Invalid ID format: ${invalidIds.join(', ')}`, 400);
  }

  const result = await Availability.deleteMany({
    _id: { $in: ids },
    user: req.user.id
  });

  logger.info(`Bulk delete availability slots by user ${req.user.id}`, {
    deletedCount: result.deletedCount,
    requestedIds: ids
  });

  res.status(200).json({
    success: true,
    message: `Successfully deleted ${result.deletedCount} availability slot(s)`,
    deletedCount: result.deletedCount
  });
});

/**
 * @desc    Sync availability to platforms
 * @route   POST /api/availability/sync
 * @access  Private
 */
export const syncAvailabilityToPlatforms = asyncHandler(async (req, res) => {
  const { platformIds = [] } = req.body;

  // Get availability slots
  const availabilitySlots = await Availability.find({
    user: req.user.id,
    synced: false // Only sync unsynced slots or sync all if forced
  });

  if (availabilitySlots.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No availability slots to sync',
      syncedCount: 0,
      results: [],
      timestamp: new Date().toISOString()
    });
  }

  // Build platform query
  const platformQuery = {
    user: req.user.id,
    connected: true,
    'syncSettings.syncAvailability': true
  };

  // Filter by specific platforms if provided
  if (platformIds.length > 0) {
    platformQuery._id = { $in: platformIds };
  }

  const platforms = await Platform.find(platformQuery);

  if (platforms.length === 0) {
    throw new ApiError('No platforms configured for availability sync', 400);
  }

  // Track sync results
  let syncCount = 0;
  const syncResults = [];
  const timestamp = new Date().toISOString();
  const errors = [];

  // Sync to each platform
  for (const platform of platforms) {
    try {
      // Prepare availability data for the platform
      const availabilityData = {
        userId: req.user.id,
        slots: availabilitySlots.map((slot) => ({
          id: slot._id.toString(),
          startDate: slot.startDate,
          endDate: slot.endDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          type: slot.type,
          reason: slot.reason,
          preferredCallStart: slot.preferredCallStart,
          preferredCallEnd: slot.preferredCallEnd,
          minimumNotice: slot.minimumNotice,
          recurring: slot.recurring,
          recurringPattern: slot.recurringPattern
        }))
      };

      // Sync availability using platform agent
      const result = await platformAgent.updateAvailability(
        platform.platformId,
        platform.authData,
        availabilityData
      );

      // Update sync status for availability slots
      await Availability.updateMany(
        { _id: { $in: availabilitySlots.map((slot) => slot._id) } },
        {
          $set: { synced: true },
          $push: {
            syncedPlatforms: {
              platformId: platform.platformId,
              platformName: platform.name,
              syncedAt: timestamp,
              status: 'success',
              syncId: result.syncId
            }
          }
        }
      );

      syncCount++;
      syncResults.push({
        platformId: platform.platformId,
        name: platform.name,
        success: true,
        timestamp,
        syncedSlots: availabilitySlots.length,
        message: result.message || 'Sync successful'
      });

      // Update platform's last sync time
      await Platform.findByIdAndUpdate(platform._id, {
        lastSync: timestamp,
        'syncSettings.lastAvailabilitySync': timestamp
      });

      logger.info(`Availability synced to platform ${platform.name}`, {
        platformId: platform.platformId,
        userId: req.user.id,
        slotsCount: availabilitySlots.length
      });
    } catch (error) {
      logger.error(`Failed to sync availability to platform ${platform.name}:`, error);

      errors.push({
        platformId: platform.platformId,
        name: platform.name,
        error: error.message
      });

      syncResults.push({
        platformId: platform.platformId,
        name: platform.name,
        success: false,
        timestamp,
        message: error.message || 'Sync failed'
      });
    }
  }

  const response = {
    success: syncCount > 0,
    message: `Availability synced to ${syncCount} of ${platforms.length} platform(s)`,
    syncedCount: syncCount,
    totalPlatforms: platforms.length,
    syncedSlots: availabilitySlots.length,
    results: syncResults,
    timestamp
  };

  // Add errors if any
  if (errors.length > 0) {
    response.errors = errors;
  }

  res.status(200).json(response);
});

/**
 * @desc    Get availability sync status
 * @route   GET /api/availability/sync/status
 * @access  Private
 */
export const getAvailabilitySyncStatus = asyncHandler(async (req, res) => {
  const availabilitySlots = await Availability.find({ user: req.user.id });
  const platforms = await Platform.find({
    user: req.user.id,
    connected: true,
    'syncSettings.syncAvailability': true
  });

  const syncStats = {
    totalSlots: availabilitySlots.length,
    syncedSlots: availabilitySlots.filter((slot) => slot.synced).length,
    unsyncedSlots: availabilitySlots.filter((slot) => !slot.synced).length,
    connectedPlatforms: platforms.length,
    lastSync: platforms.reduce((latest, platform) => {
      const platformSync = platform.syncSettings?.lastAvailabilitySync;

      return platformSync && (!latest || new Date(platformSync) > new Date(latest))
        ? platformSync
        : latest;
    }, null)
  };

  res.status(200).json({
    success: true,
    data: syncStats,
    platforms: platforms.map((platform) => ({
      id: platform._id,
      name: platform.name,
      platformId: platform.platformId,
      lastSync: platform.syncSettings?.lastAvailabilitySync,
      connected: platform.connected
    }))
  });
});
