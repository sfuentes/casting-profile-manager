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
