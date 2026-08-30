import { RateLimiterMemory } from 'rate-limiter-flexible';
import { logger } from '../utils/logger.js';
import { NotSupportedError, classifyBrowserError } from './errors.js';
import { capture } from './forensics.js';

/**
 * Base class every platform connector extends.
 *
 * The app talks to this interface only. It never learns whether a platform is
 * driven by an API or by a headless browser, what its login field is called, or
 * which operations it supports - all of that is declared by the connector's
 * manifest and enforced here.
 */
export class PlatformConnector {
  /**
   * Every connector must declare a manifest:
   *
   *   id                numeric platform id used by stored records
   *   key               stable string identifier
   *   name              human-readable name
   *   authType          'credentials' | 'apiKey' | 'manual'
   *   credentialFields  [{ name, type, required, label }] - the UI renders and
   *                     validates from this, so no caller has to guess whether
   *                     a platform wants an email or a username
   *   capabilities      subset of CAPABILITIES this connector implements
   */
  static get manifest() {
    throw new Error(`${this.name} must declare a static manifest`);
  }

  static CAPABILITIES = Object.freeze([
    'verify',
    'pushProfile',
    'pushAvailability',
    'pushMedia',
    // Reading the profile back off the platform. Declared separately from
    // pushProfile: a connector can usually fill a form long before it can parse
    // one reliably, and the UI must only offer an import where that parsing has
    // actually been written against the real page.
    'pullProfile'
  ]);

  constructor(platform, credentials = {}) {
    this.platform = platform;
    this.credentials = credentials;
    this.isAuthenticated = false;
    this.rateLimiter = this.initRateLimiter();
  }

  get manifest() {
    return this.constructor.manifest;
  }

  supports(capability) {
    return this.manifest.capabilities.includes(capability);
  }

  /**
   * Throw unless the connector declares the capability. Called by the service
   * before dispatch so an unsupported action fails the same way everywhere
   * rather than as a random TypeError deep inside a subclass.
   */
  assertSupports(capability) {
    if (!this.supports(capability)) {
      throw new NotSupportedError(
        `${this.manifest.name} does not support ${capability}`,
        { platform: this.manifest.key }
      );
    }
  }

  /**
   * Check the credentials on hand against what the manifest requires, before
   * any network call. Returns the names of missing fields.
   */
  missingCredentials() {
    return this.manifest.credentialFields
      .filter((f) => f.required && !this.credentials[f.name])
      .map((f) => f.name);
  }

  initRateLimiter() {
    return new RateLimiterMemory({ points: 10, duration: 60 });
  }

  async withRateLimit(fn) {
    await this.rateLimiter.consume(this.manifest.key);
    return fn();
  }

  /** Retry with exponential backoff, but only for errors worth retrying. */
  async withRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1 || !this.isRetryable(error)) throw error;
        await this.delay(Math.pow(2, i) * 1000);
      }
    }
  }

  /**
   * Connector errors carry their own retryable flag; everything else falls back
   * to inspecting transport-level signals.
   */
  isRetryable(error) {
    if (typeof error?.retryable === 'boolean') return error.retryable;
    if (['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'].includes(error?.code)) return true;
    const status = error?.response?.status;
    return status >= 500 || status === 429;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  log(level, message, meta = {}) {
    logger[level](`[${this.manifest.key}] ${message}`, {
      platform: this.manifest.key,
      ...meta
    });
  }

  /**
   * Map a raw browser or transport failure onto a typed error, filling in this
   * connector's identity. Connectors call this in their catch blocks so that
   * "wrong password" and "site is down" stay distinguishable at the caller.
   */
  classifyFailure(error) {
    return classifyBrowserError(error, {
      platform: this.manifest.key,
      name: this.manifest.name
    });
  }

  /**
   * Record the page state behind a failure.
   *
   * Connectors that drive a browser expose `this.page`; API connectors have
   * none and still get a summary written, which is enough to tell a transport
   * error apart from a rejected request. Returns a summary the caller may
   * attach to the error - never throws, so it is safe inside a catch block.
   *
   * This only works while the page is still open. A connector must therefore
   * never close its own browser in a catch block: teardown belongs to whoever
   * ran the operation, which captures first and closes in a `finally`. A
   * capture taken after cleanup has no URL, no screenshot and no HTML - it is
   * an empty directory that looks like evidence.
   */
  async captureFailure(error, operation, meta = {}) {
    return capture(this.page || null, {
      platform: this.manifest.key,
      operation,
      error,
      credentials: this.credentials,
      meta
    });
  }

  // ---- Interface. Subclasses override what their manifest declares. ----

  /** @returns {Promise<{ ok: boolean, message: string }>} */
  async verify() {
    this.assertSupports('verify');
    throw new Error(`${this.constructor.name} declares verify but does not implement it`);
  }

  async pushProfile() {
    this.assertSupports('pushProfile');
    throw new Error(`${this.constructor.name} declares pushProfile but does not implement it`);
  }

  async pushAvailability() {
    this.assertSupports('pushAvailability');
    throw new Error(`${this.constructor.name} declares pushAvailability but does not implement it`);
  }

  async pushMedia() {
    this.assertSupports('pushMedia');
    throw new Error(`${this.constructor.name} declares pushMedia but does not implement it`);
  }

  /**
   * Read the profile back off the platform.
   *
   * @returns {Promise<{ fields: object, sources: object }>} `fields` uses this
   *   app's own Profile vocabulary, so callers never learn platform field
   *   names; `sources` records where each value came from, which is what makes
   *   a wrong import diagnosable.
   */
  async pullProfile() {
    this.assertSupports('pullProfile');
    throw new Error(`${this.constructor.name} declares pullProfile but does not implement it`);
  }

  /**
   * Release resources. Always called by the service in a finally block, so the
   * default must be safe for connectors that hold nothing.
   */
  async close() {
    // nothing to release by default
  }

  /** Uniform result shape, so callers never branch on which platform ran. */
  static result({ ok = true, itemsSynced = 0, itemsFailed = 0, errors = [], details = {} } = {}) {
    return { ok, itemsSynced, itemsFailed, errors, details };
  }
}
