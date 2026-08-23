import { RateLimiterMemory } from 'rate-limiter-flexible';

/**
 * Base class for platform-specific sync adapters
 * Provides common functionality for rate limiting, retry logic, and error handling
 */
export class BasePlatformAdapter {
  constructor(platform, credentials) {
    this.platform = platform;
    this.credentials = credentials;
    this.rateLimiter = this.initRateLimiter();
  }

  /**
   * Initialize rate limiter with platform-specific limits
   * Override in subclass for custom limits
   */
  initRateLimiter() {
    return new RateLimiterMemory({
      points: 10, // Number of requests
      duration: 60, // Per 60 seconds
    });
  }

  /**
   * Must be implemented by subclasses
   * Authenticate with the platform
   * @returns {Promise<boolean>} Authentication success
   */
  async authenticate() {
    throw new Error('authenticate() must be implemented by subclass');
  }

  /**
   * Must be implemented by subclasses
   * Push availability data to the platform
   * @param {Array} availability - Array of availability objects
   * @returns {Promise<Object>} Sync result
   */
  async pushAvailability(availability) {
    throw new Error('pushAvailability() must be implemented by subclass');
  }

  /**
   * Must be implemented by subclasses
   * Push media (photos/videos) to the platform
   * @param {Object} media - Media object with buffer and metadata
   * @returns {Promise<Object>} Upload result
   */
  async pushMedia(media) {
    throw new Error('pushMedia() must be implemented by subclass');
  }

  /**
   * Must be implemented by subclasses
   * Update profile information on the platform
   * @param {Object} profile - Profile data
   * @returns {Promise<Object>} Update result
   */
  async updateProfile(profile) {
    throw new Error('updateProfile() must be implemented by subclass');
  }

  /**
   * Wrap a function with rate limiting
   * @param {Function} fn - Function to execute
   * @returns {Promise<any>} Function result
   */
  async withRateLimit(fn) {
    await this.rateLimiter.consume(this.platform.platformId);
    return fn();
  }

  /**
   * Retry a function with exponential backoff
   * @param {Function} fn - Function to execute
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<any>} Function result
   */
  async withRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1 || !this.isRetryable(error)) {
          throw error;
        }
        await this.delay(Math.pow(2, i) * 1000); // Exponential backoff: 1s, 2s, 4s
      }
    }
  }

  /**
   * Determine if an error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} Whether the error is retryable
   */
  isRetryable(error) {
    // Network errors
    if (error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP 5xx errors (server errors)
    if (error.response?.status >= 500) {
      return true;
    }

    // HTTP 429 (Too Many Requests)
    if (error.response?.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * Delay execution for a specified time
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log adapter activity
   * @param {string} level - Log level (info, warn, error)
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  log(level, message, meta = {}) {
    const logData = {
      adapter: this.constructor.name,
      platformId: this.platform.platformId,
      platformName: this.platform.name,
      message,
      ...meta,
      timestamp: new Date().toISOString()
    };

    console[level](JSON.stringify(logData));
  }
}

export default BasePlatformAdapter;
