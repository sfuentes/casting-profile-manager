/**
 * Typed errors shared by every connector.
 *
 * Callers need to react differently to "the password is wrong" and "the site is
 * down" - the first needs the user, the second needs a retry. Matching on
 * message strings is fragile, so connectors throw these instead.
 */

export class ConnectorError extends Error {
  constructor(message, { platform, cause } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.platform = platform;
    this.cause = cause;
    // Whether retrying the same call unchanged could plausibly succeed.
    this.retryable = false;
  }

  toJSON() {
    return {
      type: this.name,
      message: this.message,
      platform: this.platform,
      retryable: this.retryable
    };
  }
}

/** Credentials were rejected. Needs the user to fix them; never retry. */
export class AuthError extends ConnectorError {}

/** Platform asked us to slow down. Retryable once the window passes. */
export class RateLimitError extends ConnectorError {
  constructor(message, options = {}) {
    super(message, options);
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.retryable = true;
  }
}

/** Site unreachable, timed out, or returned a server error. Retryable. */
export class PlatformUnavailableError extends ConnectorError {
  constructor(message, options = {}) {
    super(message, options);
    this.retryable = true;
  }
}

/**
 * The connector does not implement this capability - a manual agency with no
 * site to automate, or a platform whose API does not expose the operation.
 * Not a failure to fix; the caller should not offer the action.
 */
export class NotSupportedError extends ConnectorError {}

/**
 * The page did not look the way the connector expected. Distinct from
 * PlatformUnavailableError because it means our selectors need updating, not
 * that the platform is down - the single most common way scrapers rot.
 */
export class PlatformChangedError extends ConnectorError {}

/**
 * Map a raw browser or transport failure onto the typed errors above.
 *
 * Puppeteer reports everything as a plain Error, so without this every login
 * failure reached the caller as `UnknownError, retryable: false` - a wrong
 * password and a site outage were indistinguishable, and the service's
 * `error instanceof AuthError` branch (which marks a platform disconnected so
 * the user is prompted to fix their credentials) could never fire.
 *
 * The distinction is drawn from what puppeteer was doing when it gave up:
 * a selector that never appeared means the markup moved; a navigation that
 * never completed means the site did not answer.
 */
export const classifyBrowserError = (error, { platform, name } = {}) => {
  if (error instanceof ConnectorError) return error;

  const label = name || platform || 'The platform';
  const message = error?.message || String(error);
  const options = { platform, cause: error };

  // Selector-level: the page loaded, it just did not look as expected.
  if (/waiting for selector|waiting for function|no node found for selector|not clickable|no element found/i.test(message)) {
    return new PlatformChangedError(
      `${label}: expected element not found on the page (${message})`,
      options
    );
  }

  // Transport-level: DNS, refused connections, TLS, or a navigation that never
  // finished. Retrying these can plausibly succeed.
  if (/net::|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket hang up|navigation timeout|frame was detached/i.test(message)) {
    return new PlatformUnavailableError(
      `${label} could not be reached (${message})`,
      options
    );
  }

  // Anything else still gets a typed error, so callers keep a usable name and
  // an explicit retryable flag rather than falling through to 'UnknownError'.
  return new ConnectorError(`${label}: ${message}`, options);
};

/**
 * The same job for the API-driven connectors, where the signal is an HTTP
 * status rather than a browser message.
 */
export const classifyHttpError = (error, { platform, name } = {}) => {
  if (error instanceof ConnectorError) return error;

  const label = name || platform || 'The platform';
  const status = error?.response?.status;
  const message = error?.message || String(error);
  const options = { platform, cause: error };

  if (status === 401 || status === 403) {
    return new AuthError(`${label} rejected the credentials (HTTP ${status})`, options);
  }

  if (status === 429) {
    const retryAfter = Number(error?.response?.headers?.['retry-after']);
    return new RateLimitError(`${label} is rate limiting this account (HTTP 429)`, {
      ...options,
      retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : null
    });
  }

  if (status >= 500 || /ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket hang up|timeout of/i.test(message)) {
    return new PlatformUnavailableError(
      `${label} could not be reached (${status ? `HTTP ${status}` : message})`,
      options
    );
  }

  return new ConnectorError(`${label}: ${message}`, options);
};
