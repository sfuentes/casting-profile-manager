import Platform from '../models/Platform.js';
import Profile from '../models/Profile.js';
import Availability from '../models/Availability.js';
import SyncLog from '../models/SyncLog.js';
import { logger } from '../utils/logger.js';
import { getConnector, listManifests } from './registry.js';
import { AuthError, ConnectorError, NotSupportedError } from './errors.js';
import { normalizeProfileFields } from './profileNormalizer.js';
import { toBlockedFormItems } from './blockedPeriods.js';

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
      // A failed login is the failure users hit first and the one hardest to
      // reason about remotely, so it gets the same treatment as a failed sync.
      //
      // The capture used to be taken and thrown away. On a server that meant
      // the one thing needed to tell a dead session from moved markup - the URL
      // the browser actually ended on - was written into a container filesystem
      // that nobody can reach and that the next deploy wipes. It is carried out
      // of here now.
      const forensics = await connector.captureFailure(error, 'verify');
      logger.warn(`[connectors] verify failed for ${manifest.key}`, {
        error: error.message, url: forensics?.url, title: forensics?.title
      });
      return {
        ok: false,
        verified: false,
        message: error.message,
        errorType: error instanceof ConnectorError ? error.name : 'UnknownError',
        retryable: error instanceof ConnectorError ? error.retryable : false,
        forensics,
        capabilities: manifest.capabilities
      };
    } finally {
      await this.#close(connector);
    }
  }

  /**
   * Push profile data.
   * `options.dryRun` fills the forms and submits nothing.
   */
  syncProfile(userId, platformId, profile, options = {}) {
    return this.#run(userId, platformId, 'pushProfile', 'push_profile', profile, options);
  }

  /**
   * Push the calendar - as block times, and only as block times.
   *
   * The reduction happens here rather than in the connectors, because here is
   * the one place every platform passes through. A connector cannot leak a
   * booking's reason or the actor's notes if it is never handed them, and that
   * holds for the connectors that exist today and the ones added later, without
   * each having to remember the rule. See blockedPeriods.js.
   */
  syncAvailability(userId, platformId, availability, options = {}) {
    const blocked = toBlockedFormItems(availability);
    return this.#run(userId, platformId, 'pushAvailability', 'push_availability', blocked, options);
  }

  /**
   * Push the profile's pictures and videos.
   *
   * The payload is the whole profile, not a single media item. That is the
   * model the rest of the app uses - the connector holds the slots, decides
   * which picture belongs in which, and asks each control what it accepts -
   * and it is the model the remaining platforms are meant to arrive at.
   *
   * A connector with no `mediaFields` is refused here rather than downstream.
   * Its `pushMedia` is the older per-item kind that wants the bytes of one
   * file, and there are no bytes to give it: these pictures live on the
   * platform that already holds them, and fetching one server-side returns the
   * sign-in page rather than an image, which is why the descriptor-driven push
   * fetches through the logged-in browser. Handing such a connector a profile
   * would fail deep inside it with a TypeError about a missing buffer. The
   * refusal lifts on its own once a platform's upload controls have been read
   * and its slots declared - nothing here needs changing for that.
   *
   * `options.dryRun` plans the uploads and uploads nothing. It is not reachable
   * from the HTTP layer; see syncController.
   */
  syncMedia(userId, platformId, profile, options = {}) {
    const Connector = getConnector(platformId);
    const slots = Connector?.site?.mediaFields || [];

    if (slots.length === 0) {
      throw new NotSupportedError(
        `${Connector?.manifest?.name || `Platform ${platformId}`} has no upload slots yet: `
        + 'its uploader has not been read, so there is nowhere to put a picture.',
        { platform: Connector?.manifest?.key || platformId }
      );
    }

    return this.#run(userId, platformId, 'pushMedia', 'push_media', profile, options);
  }

  /**
   * Add the credits a platform does not have.
   *
   * Only additions: what the platform already holds is left exactly as it is,
   * and nothing is ever removed. Which credits count as the same one is decided
   * in `workHistory.js`, so every platform is compared the same way.
   *
   * `options.dryRun` fills each form and cancels out of it.
   */
  syncWorkHistory(userId, platformId, profile, options = {}) {
    return this.#run(userId, platformId, 'pushWorkHistory', 'push_profile', profile, options);
  }

  /**
   * Read the profile back off a platform.
   *
   * Deliberately not routed through #run: that dispatcher counts items and
   * stamps `lastSync`, both of which describe a push. An import writes nothing
   * to the platform and must not look like a sync in the history. It is logged
   * all the same, with the same forensics on failure.
   *
   * Nothing is written to the user's profile here either - the caller decides
   * what to keep. Overwriting a profile from a scraper without the user seeing
   * it first is not a decision this layer gets to make.
   */
  async importProfile(userId, platformId) {
    const platform = await Platform.findOne({
      user: userId,
      platformId: Number(platformId),
      connected: true
    });

    if (!platform) {
      throw new NotSupportedError(`Platform ${platformId} is not connected`, { platform: platformId });
    }

    const connector = this.instantiate(platform);
    connector.assertSupports('pullProfile');

    const syncLog = await SyncLog.create({
      user: userId,
      platform: Number(platformId),
      operation: 'pull_profile',
      status: 'pending',
      startedAt: new Date(),
      itemsTotal: 1
    });

    try {
      if (connector.supports('verify')) await connector.verify();

      const result = (await connector.pullProfile()) || {};

      // Normalise here, not in the connector: every platform spells its values
      // differently, and the app has exactly one vocabulary. Values that cannot
      // be mapped are not guessed - they come back as questions for the user.
      const { fields, unmapped } = normalizeProfileFields(result.fields || {});

      syncLog.status = 'success';
      syncLog.completedAt = new Date();
      syncLog.itemsProcessed = Object.keys(fields).length;
      // The imported values are kept on the log so that applying them later
      // does not mean scraping the platform a second time - and so the values
      // the user confirms are the ones the server read, not whatever a client
      // sends back.
      // Where each value came from, named so it stays readable once it is out
      // of this run: a connector reports the place inside its own site
      // ("graphql:profileExperienceRepeater"), which says nothing about which
      // site that was. The platform is stamped on here, because this is the
      // layer that knows it.
      const sources = {};
      for (const [field, location] of Object.entries(result.sources || {})) {
        sources[field] = {
          platform: connector.manifest.key,
          platformName: connector.manifest.name,
          location,
          readAt: new Date()
        };
      }

      syncLog.metadata = {
        details: result.details, sources, fields, unmapped
      };
      await syncLog.save();

      return {
        success: true,
        fields,
        sources,
        missing: result.missing || [],
        unmapped,
        syncLogId: String(syncLog._id)
      };
    } catch (error) {
      // Same rule as the push path: photograph the page before anything closes
      // it, or the failure arrives as a message with nothing behind it.
      const forensics = await connector.captureFailure(error, 'pull_profile', { userId: String(userId) });

      syncLog.status = 'failed';
      syncLog.completedAt = new Date();
      syncLog.error = {
        message: error.message,
        code: error instanceof ConnectorError ? error.name : error.code,
        stack: error.stack
      };
      syncLog.metadata = { ...(syncLog.metadata || {}), forensics };
      await syncLog.save();

      if (error instanceof AuthError) {
        platform.connected = false;
        await platform.save();
      }

      logger.error(`[connectors] pull_profile failed for platform ${platformId}`, {
        error: error.message
      });
      throw error;
    } finally {
      await this.#close(connector);
    }
  }

  /**
   * One code path for every push operation: resolve the platform, check the
   * capability, log the attempt, run it, record the outcome. Previously each
   * operation repeated this, which is how the three sync routes drifted apart.
   */
  async #run(userId, platformId, capability, operation, payload, options = {}) {
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

    const dryRun = options.dryRun === true;
    const itemsTotal = Array.isArray(payload) ? payload.length : 1;
    const syncLog = await SyncLog.create({
      user: userId,
      platform: Number(platformId),
      operation,
      status: 'pending',
      startedAt: new Date(),
      itemsTotal,
      dryRun
    });

    try {
      if (connector.supports('verify')) await connector.verify();

      // The options reach the connector. Without this a dry run could not be
      // asked for through the app at all - `pushProfile(profile, {dryRun})` and
      // `pushMedia(profile, {dryRun})` were reachable only from a script, so
      // every push the API could make was a live one.
      const result = (await connector[capability](payload, options)) || {};

      syncLog.status = 'success';
      syncLog.completedAt = new Date();
      // A dry run processed nothing, whatever it planned. Falling back to
      // `itemsTotal` here would write "5 items synced" for a run that submitted
      // nothing at all.
      syncLog.itemsProcessed = dryRun ? 0 : (result.itemsSynced ?? result.count ?? itemsTotal);
      syncLog.metadata = {
        details: result.details,
        externalIds: result.externalIds,
        planned: result.planned,
        // Credits the connector could not tell apart from ones already on the
        // platform. They are questions for the user, not failures, and they are
        // kept on the log so the answer can be applied without reading the
        // platform a second time.
        questions: result.questions
      };
      await syncLog.save();

      // Only a real push moves `lastSync`. A dry run that stamped it would tell
      // the user their profile went out when nothing left the building.
      if (!dryRun) {
        platform.lastSync = new Date();
        await platform.save();
      }

      return {
        success: true,
        dryRun,
        itemsProcessed: syncLog.itemsProcessed,
        questions: result.questions || [],
        syncLog: syncLog.toObject()
      };
    } catch (error) {
      // Capture before the finally block closes the browser: once close() has
      // run there is no page left to photograph. This is the only place the
      // page state exists, and without it a failure on the server is just a
      // message with no way to tell a dead session from moved markup.
      const forensics = await connector.captureFailure(error, operation, { userId: String(userId) });

      syncLog.status = 'failed';
      syncLog.completedAt = new Date();
      syncLog.error = {
        message: error.message,
        code: error instanceof ConnectorError ? error.name : error.code,
        stack: error.stack
      };
      syncLog.metadata = { ...(syncLog.metadata || {}), forensics };
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
