import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Failure forensics for browser-driven connectors.
 *
 * No connector has ever run against a live platform, and the environment this
 * code is developed in cannot reach one. A failure in production is therefore
 * the only evidence that exists, and "PlatformChangedError: selector not found"
 * on its own does not say whether the login failed, the site redirected, a
 * cookie banner covered the page, or the markup simply moved. Capturing the
 * page state at the moment of failure turns a blind redeploy loop into one
 * round trip.
 *
 * Everything here is best-effort: forensics must never be the reason an
 * operation fails, so every path swallows its own errors.
 */

/**
 * Read at call time, not at import time. ESM hoists imports above everything
 * else in the importing module, so anything captured into a const here is fixed
 * before a caller could configure it - which made this module untestable and
 * would silently ignore any env var set after startup.
 */
const enabled = () => process.env.CONNECTOR_FORENSICS !== 'off';
const dir = () => process.env.CONNECTOR_FORENSICS_DIR || path.join(process.cwd(), 'forensics');

/** Keep the newest N capture directories; older ones are pruned after each write. */
const retain = () => Number(process.env.CONNECTOR_FORENSICS_RETAIN || 50);

/**
 * A page's HTML can carry more than markup: prefilled values, tokens in inline
 * scripts, a session id in a URL. Credentials the connector holds are replaced
 * before anything touches disk.
 */
export const redact = (text, credentials = {}) => {
  if (!text) return text;
  let out = text;
  /* eslint-disable no-restricted-syntax, no-continue, no-await-in-loop */
  for (const value of Object.values(credentials)) {
    if (typeof value !== 'string' || value.length < 4) continue;
    out = out.split(value).join('[REDACTED]');
  }
  /* eslint-enable no-restricted-syntax, no-continue */

  return out;
};

const slug = (value) => String(value ?? 'unknown')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 60) || 'unknown';

const prune = async (root) => {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
    // Sequential deletes: pruning is background housekeeping, and doing it in
    // parallel would compete with the request that is still being served.
    /* eslint-disable-next-line no-restricted-syntax */
    for (const name of dirs.slice(0, Math.max(0, dirs.length - retain()))) {
      // eslint-disable-next-line no-await-in-loop
      await fs.rm(path.join(root, name), { recursive: true, force: true });
    }
  } catch {
    // pruning is housekeeping, not part of the capture
  }
};

/**
 * Capture what the browser was looking at when something went wrong.
 *
 * @param {import('puppeteer').Page} page   may be null - a connector can fail
 *                                          before it ever opened a page
 * @param {object} context
 * @param {string} context.platform         connector key, e.g. 'filmmakers'
 * @param {string} context.operation        e.g. 'pushAvailability'
 * @param {Error}  context.error
 * @param {object} context.credentials      redacted out of the captured HTML
 * @param {object} context.meta             anything else worth recording
 * @returns {Promise<object|null>} a summary safe to attach to an error, or null
 */
export const capture = async (page, {
  platform, operation, error, credentials = {}, meta = {}
} = {}) => {
  if (!enabled()) return null;

  const root = dir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(root, `${stamp}_${slug(platform)}_${slug(operation)}`);

  const summary = {
    platform,
    operation,
    capturedAt: new Date().toISOString(),
    error: error?.message,
    errorType: error?.name,
    url: null,
    title: null,
    artifacts: {},
    ...meta
  };

  try {
    await fs.mkdir(target, { recursive: true });

    if (page && !page.isClosed?.()) {
      // The final URL is the single most useful field: a redirect back to
      // /login means the session died, which reads identically to a missing
      // selector from the call site.
      // `page.url()` is synchronous and returns a string, not a promise -
      // calling .catch() on it threw and took the whole capture down with it.
      try {
        summary.url = page.url();
      } catch {
        summary.url = null;
      }
      summary.title = await page.title().catch(() => null);

      const shot = path.join(target, 'screenshot.png');
      await page
        .screenshot({ path: shot, fullPage: true })
        .then(() => {
          summary.artifacts.screenshot = shot;
        })
        .catch(() => {});

      const html = await page.content().catch(() => null);
      if (html) {
        const file = path.join(target, 'page.html');
        await fs.writeFile(file, redact(html, credentials), 'utf8');
        summary.artifacts.html = file;
      }
    }

    await fs.writeFile(
      path.join(target, 'summary.json'),
      JSON.stringify({ ...summary, stack: error?.stack }, null, 2),
      'utf8'
    );
    summary.artifacts.summary = path.join(target, 'summary.json');

    // Logged as well as written: on a container with no shell access the log
    // stream may be all anyone can reach.
    logger.warn(`[forensics] ${platform}/${operation} captured`, {
      url: summary.url,
      title: summary.title,
      dir: target
    });

    await prune(root);

    return summary;
  } catch (captureError) {
    logger.warn('[forensics] capture failed', { error: captureError.message });

    return null;
  }
};

export const forensicsDir = dir;
export const forensicsEnabled = enabled;
