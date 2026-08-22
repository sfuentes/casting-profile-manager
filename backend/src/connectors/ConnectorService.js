import Platform from '../models/Platform.js';
import Profile from '../models/Profile.js';
import Availability from '../models/Availability.js';
import SyncLog from '../models/SyncLog.js';
import { logger } from '../utils/logger.js';
import { getConnector, listManifests } from './registry.js';
import { AuthError, ConnectorError, NotSupportedError } from './errors.js';

/**
 * The app's single entry point to every platform.
 *
 * Callers name an operation and a platform id. They never construct a
 * connector, never learn whether it drives a browser or an API, and never
 * branch on which platform they are talking to.
 */
class ConnectorService {
  listPlatforms() {
    return listManifests();
  }

  getConnectorClass(platformId) {
    return getConnector(platformId);
  }

  /**
   * Build a connector for a stored platform record.
   * @throws {NotSupportedError} when no connector is registered
   */
  instantiate(platform) {
    const Connector = getConnector(platform.platformId);
    if (!Connector) {
      throw new NotSupportedError(
        `No integration is registered for platform ${platform.platformId}`,
        { platform: platform.platformId }
      );
    }
    return new Connector(platform, platform.authData || {});
  }

  /**
   * Try the credentials against the platform.
   * Never throws: verification failure is an outcome, not an exception.
   * @returns {Promise<{ok, verified, message, capabilities}>}
   */
  async verify(platform) {
    let connector;
    try {
      connector = this.instantiate(platform);
    } catch (error) {
      return { ok: false, verified: false, message: error.message, capabilities: [] };
    }

    const manifest = connector.manifest;

    // Manual platforms have nothing to log into; ask the connector rather than
    // testing the id against a list here.
    if (!connector.supports('verify')) {
      const result = await connector.verify().catch(() => null);
      return {
        ok: result?.ok ?? true,
        verified: false,
        message: result?.message ?? 'This platform has no automated login.',
        capabilities: manifest.capabilities
      };
    }

    const missing = connector.missingCredentials();
    if (missing.length > 0) {
      return {
        ok: false,
        verified: false,
        message: `Missing credentials: ${missing.join(', ')}`,
        capabilities: manifest.capabilities
      };
    }

    try {
      const result = await connector.verify();
      return {
        ok: result.ok !== false,
        verified: true,
        message: result.message || 'Login succeeded.',
        capabilities: manifest.capabilities
      };
    } catch (error) {
      logger.warn(`[connectors] verify failed for ${manifest.key}`, { error: error.message });
      return {
        ok: false,
        verified: false,
        message: error.message,
        errorType: error instanceof ConnectorError ? error.name : 'UnknownError',
        retryable: error instanceof ConnectorError ? error.retryable : false,
        capabilities: manifest.capabilities
      };
    } finally {
      await this.#close(connector);
    }
  }

  /** Push profile data. */
  syncProfile(userId, platformId, profile) {
    return this.#run(userId, platformId, 'pushProfile', 'push_profile', profile);
  }

  /** Push availability windows. */
  syncAvailability(userId, platformId, availability) {
    return this.#run(userId, platformId, 'pushAvailability', 'push_availability', availability);
  }

  /** Push media items. */
  syncMedia(userId, platformId, media) {
    return this.#run(userId, platformId, 'pushMedia', 'push_media', media);
  }

  /**
   * One code path for every push operation: resolve the platform, check the
   * capability, log the attempt, run it, record the outcome. Previously each
   * operation repeated this, which is how the three sync routes drifted apart.
   */
  async #run(userId, platformId, capability, operation, payload) {
    const platform = await Platform.findOne({
      user: userId,
      platformId: Number(platformId),
      connected: true
    });

    if (!platform) {
      throw new NotSupportedError(`Platform ${platformId} is not connected`, { platform: platformId });
    }

    const connector = this.instantiate(platform);
    connector.assertSupports(capability);

    const itemsTotal = Array.isArray(payload) ? payload.length : 1;
    const syncLog = await SyncLog.create({
      user: userId,
      platform: Number(platformId),
      operation,
      status: 'pending',
      startedAt: new Date(),
      itemsTotal
    });

    try {
      if (connector.supports('verify')) await connector.verify();

      const result = (await connector[capability](payload)) || {};

      syncLog.status = 'success';
      syncLog.completedAt = new Date();
      syncLog.itemsProcessed = result.itemsSynced ?? result.count ?? itemsTotal;
      syncLog.metadata = { details: result.details, externalIds: result.externalIds };
      await syncLog.save();

      platform.lastSync = new Date();
      await platform.save();

      return {
        success: true,
        itemsProcessed: syncLog.itemsProcessed,
        syncLog: syncLog.toObject()
      };
    } catch (error) {
      syncLog.status = 'failed';
      syncLog.completedAt = new Date();
      syncLog.error = {
        message: error.message,
        code: error instanceof ConnectorError ? error.name : error.code,
        stack: error.stack
      };
      await syncLog.save();

      // Credentials that no longer work should stop presenting as connected,
      // so the user is prompted to fix them instead of seeing silent failures.
      if (error instanceof AuthError) {
        platform.connected = false;
        await platform.save();
      }

      logger.error(`[connectors] ${operation} failed for platform ${platformId}`, {
        error: error.message
      });
      throw error;
    } finally {
      await this.#close(connector);
    }
  }

  /** Closing must never mask the original failure. */
  async #close(connector) {
    try {
      await connector.close();
    } catch (error) {
      logger.warn('[connectors] close() failed', { error: error.message });
    }
  }

  /**
   * Re-run a failed sync using the user's current data.
   *
   * The previous implementation threw "not yet implemented" for every
   * operation, because each sync type had its own bespoke path and there was
   * nothing generic to re-enter. With one dispatcher it is just a lookup plus
   * a re-run.
   */
  async retrySync(syncLogId) {
    const syncLog = await SyncLog.findById(syncLogId);
    if (!syncLog) throw new Error('Sync log not found');
    if (syncLog.status !== 'failed') throw new Error('Can only retry failed syncs');

    const userId = syncLog.user;
    const platformId = syncLog.platform;

    switch (syncLog.operation) {
      case 'push_profile': {
        const profile = await Profile.findOne({ user: userId }).lean();
        if (!profile) throw new Error('No profile data to sync');
        return this.syncProfile(userId, platformId, profile);
      }
      case 'push_availability': {
        const availability = await Availability.find({ user: userId }).lean();
        if (!availability.length) throw new Error('No availability data to sync');
        return this.syncAvailability(userId, platformId, availability);
      }
      case 'push_media':
        throw new NotSupportedError('Media retry needs a media store; not wired yet');
      default:
        throw new Error(`Unknown operation: ${syncLog.operation}`);
    }
  }

  getSyncHistory(userId, limit = 20) {
    return SyncLog.find({ user: userId }).sort({ startedAt: -1 }).limit(limit).lean();
  }

  getSyncStatus(userId, platformId) {
    return SyncLog.findOne({ user: userId, platform: Number(platformId) })
      .sort({ startedAt: -1 })
      .lean();
  }
}

export default new ConnectorService();
