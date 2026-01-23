import Platform from '../../models/Platform.js';
import SyncLog from '../../models/SyncLog.js';
import { logger } from '../../utils/logger.js';

// Import adapters
import { FilmmakersAdapter } from './adapters/FilmmakersAdapter.js';
import { CastingNetworkAdapter } from './adapters/CastingNetworkAdapter.js';
import { SchauspielerVideosAdapter } from './adapters/SchauspielervideosAdapter.js';
import { ETalentaAdapter } from './adapters/ETalentaAdapter.js';
import { JobWorkAdapter } from './adapters/JobWorkAdapter.js';
import { WantedAdapter } from './adapters/WantedAdapter.js';

/**
 * Central service for managing platform synchronization
 */
class SyncService {
  constructor() {
    // Map platform IDs to their adapter classes
    this.adapters = {
      1: FilmmakersAdapter,          // Filmmakers - Web scraping
      2: CastingNetworkAdapter,      // Casting Network - Web scraping
      3: SchauspielerVideosAdapter,  // Schauspielervideos - API
      4: ETalentaAdapter,            // e-TALENTA - API
      5: JobWorkAdapter,             // JobWork - Web scraping
      6: null,                       // Manual agency - Not applicable
      7: null,                       // Manual agency - Not applicable
      8: null,                       // Manual agency - Not applicable
      9: WantedAdapter               // Wanted - Web scraping
    };
  }

  /**
   * Get the adapter for a specific platform
   * @param {number} platformId - Platform ID
   * @returns {Class|null} Adapter class or null if not available
   */
  getAdapter(platformId) {
    return this.adapters[platformId];
  }

  /**
   * Sync availability to a specific platform
   * @param {string} userId - User ID
   * @param {number} platformId - Platform ID
   * @param {Array} availability - Availability data
   * @returns {Promise<Object>} Sync result
   */
  async syncAvailability(userId, platformId, availability) {
    // Find connected platform
    const platform = await Platform.findOne({
      user: userId,
      platformId: platformId,
      connected: true
    });

    if (!platform) {
      throw new Error(`Platform ${platformId} not connected`);
    }

    // Check if adapter exists
    const AdapterClass = this.getAdapter(platformId);
    if (!AdapterClass) {
      throw new Error(`No adapter available for platform ${platformId}. Sync functionality not yet implemented.`);
    }

    // Create sync log
    const syncLog = await SyncLog.create({
      user: userId,
      platform: platformId,
      operation: 'push_availability',
      status: 'pending',
      startedAt: new Date(),
      itemsTotal: availability.length
    });

    try {
      // Initialize adapter
      const adapter = new AdapterClass(platform, platform.authData);

      // Authenticate with platform
      logger.info(`[SyncService] Authenticating with platform ${platformId} for user ${userId}`);
      await adapter.authenticate();

      // Push availability
      logger.info(`[SyncService] Pushing ${availability.length} availability items to platform ${platformId}`);
      const result = await adapter.pushAvailability(availability);

      // Update sync log with success
      syncLog.status = 'success';
      syncLog.completedAt = new Date();
      syncLog.itemsProcessed = result.count || availability.length;
      syncLog.metadata = {
        externalIds: result.externalIds,
        response: result.response
      };
      await syncLog.save();

      // Update platform last sync timestamp
      platform.lastSync = new Date();
      await platform.save();

      logger.info(`[SyncService] Successfully synced availability to platform ${platformId} for user ${userId}`);

      return {
        success: true,
        syncLog: syncLog.toObject(),
        itemsProcessed: syncLog.itemsProcessed,
        duration: syncLog.duration
      };

    } catch (error) {
      // Update sync log with error
      syncLog.status = 'failed';
      syncLog.error = {
        message: error.message,
        code: error.code,
        stack: error.stack
      };
      syncLog.completedAt = new Date();
      await syncLog.save();

      logger.error(`[SyncService] Failed to sync availability to platform ${platformId} for user ${userId}:`, error);

      throw error;
    }
  }

  /**
   * Sync media to a specific platform
   * @param {string} userId - User ID
   * @param {number} platformId - Platform ID
   * @param {Object} media - Media data
   * @returns {Promise<Object>} Sync result
   */
  async syncMedia(userId, platformId, media) {
    const platform = await Platform.findOne({
      user: userId,
      platformId: platformId,
      connected: true
    });

    if (!platform) {
      throw new Error(`Platform ${platformId} not connected`);
    }

    const AdapterClass = this.getAdapter(platformId);
    if (!AdapterClass) {
      throw new Error(`No adapter available for platform ${platformId}. Sync functionality not yet implemented.`);
    }

    const syncLog = await SyncLog.create({
      user: userId,
      platform: platformId,
      operation: 'push_media',
      status: 'pending',
      startedAt: new Date(),
      itemsTotal: 1
    });

    try {
      const adapter = new AdapterClass(platform, platform.authData);
      await adapter.authenticate();

      logger.info(`[SyncService] Pushing media to platform ${platformId} for user ${userId}`);
      const result = await adapter.pushMedia(media);

      syncLog.status = 'success';
      syncLog.completedAt = new Date();
      syncLog.itemsProcessed = 1;
      syncLog.metadata = {
        externalId: result.externalId,
        url: result.url
      };
      await syncLog.save();

      platform.lastSync = new Date();
      await platform.save();

      logger.info(`[SyncService] Successfully synced media to platform ${platformId} for user ${userId}`);

      return {
        success: true,
        syncLog: syncLog.toObject(),
        externalId: result.externalId,
        url: result.url
      };

    } catch (error) {
      syncLog.status = 'failed';
      syncLog.error = {
        message: error.message,
        code: error.code,
        stack: error.stack
      };
      syncLog.completedAt = new Date();
      await syncLog.save();

      logger.error(`[SyncService] Failed to sync media to platform ${platformId} for user ${userId}:`, error);

      throw error;
    }
  }

  /**
   * Sync profile to a specific platform
   * @param {string} userId - User ID
   * @param {number} platformId - Platform ID
   * @param {Object} profile - Profile data
   * @returns {Promise<Object>} Sync result
   */
  async syncProfile(userId, platformId, profile) {
    const platform = await Platform.findOne({
      user: userId,
      platformId: platformId,
      connected: true
    });

    if (!platform) {
      throw new Error(`Platform ${platformId} not connected`);
    }

    const AdapterClass = this.getAdapter(platformId);
    if (!AdapterClass) {
      throw new Error(`No adapter available for platform ${platformId}. Sync functionality not yet implemented.`);
    }

    const syncLog = await SyncLog.create({
      user: userId,
      platform: platformId,
      operation: 'push_profile',
      status: 'pending',
      startedAt: new Date(),
      itemsTotal: 1
    });

    try {
      const adapter = new AdapterClass(platform, platform.authData);
      await adapter.authenticate();

      logger.info(`[SyncService] Pushing profile to platform ${platformId} for user ${userId}`);
      const result = await adapter.updateProfile(profile);

      syncLog.status = 'success';
      syncLog.completedAt = new Date();
      syncLog.itemsProcessed = 1;
      syncLog.metadata = result;
      await syncLog.save();

      platform.lastSync = new Date();
      await platform.save();

      logger.info(`[SyncService] Successfully synced profile to platform ${platformId} for user ${userId}`);

      return {
        success: true,
        syncLog: syncLog.toObject()
      };

    } catch (error) {
      syncLog.status = 'failed';
      syncLog.error = {
        message: error.message,
        code: error.code,
        stack: error.stack
      };
      syncLog.completedAt = new Date();
      await syncLog.save();

      logger.error(`[SyncService] Failed to sync profile to platform ${platformId} for user ${userId}:`, error);

      throw error;
    }
  }

  /**
   * Get sync history for a user
   * @param {string} userId - User ID
   * @param {number} limit - Number of records to return
   * @returns {Promise<Array>} Sync history
   */
  async getSyncHistory(userId, limit = 20) {
    return await SyncLog.getRecentHistory(userId, limit);
  }

  /**
   * Get sync status for a specific platform
   * @param {string} userId - User ID
   * @param {number} platformId - Platform ID
   * @returns {Promise<Object|null>} Latest sync status
   */
  async getSyncStatus(userId, platformId) {
    return await SyncLog.getPlatformStatus(userId, platformId);
  }

  /**
   * Retry a failed sync
   * @param {string} syncLogId - Sync log ID to retry
   * @returns {Promise<Object>} Retry result
   */
  async retrySync(syncLogId) {
    const syncLog = await SyncLog.findById(syncLogId);

    if (!syncLog) {
      throw new Error('Sync log not found');
    }

    if (syncLog.status !== 'failed') {
      throw new Error('Can only retry failed syncs');
    }

    // Determine which sync method to call based on operation
    switch (syncLog.operation) {
      case 'push_availability':
        // Would need to fetch availability data
        throw new Error('Retry for availability sync not yet implemented');
      case 'push_media':
        throw new Error('Retry for media sync not yet implemented');
      case 'push_profile':
        throw new Error('Retry for profile sync not yet implemented');
      default:
        throw new Error(`Unknown operation: ${syncLog.operation}`);
    }
  }
}

export default new SyncService();
