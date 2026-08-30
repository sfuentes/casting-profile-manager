import puppeteer from 'puppeteer';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { PlatformConnector } from './PlatformConnector.js';
import { findByCssOrText } from './selectors.js';
import { AuthError, PlatformChangedError } from './errors.js';

/**
 * Everything a browser-driven connector does that is not specific to one
 * platform: launching Chromium, logging in, deciding whether the login worked,
 * filling a profile form, tearing down.
 *
 * The four scraping connectors used to carry a copy of all of it - four
 * versions of the same eighty-line authenticate(), four cleanup()s, four
 * withRetry()s. Every fix had to be made four times and, in practice, was made
 * in one or two of them: that is how one connector ended up checking for
 * "/login" in the URL while another had already learned the check was wrong.
 *
 * A platform connector now declares what makes it different - a `site`
 * descriptor - and overrides a method only where the platform genuinely
 * behaves differently. Adding a platform should be a descriptor plus whatever
 * it does that nobody else does.
 *
 * The descriptor:
 *
 *   static site = {
 *     baseUrl:   'https://www.example.com',   // no trailing slash
 *     loginPath: '/users/sign_in',            // where the form actually is
 *     login: {
 *       user:        'CSS for the account field',
 *       password:    'CSS for the password field',
 *       submitTexts: ['weiter', 'anmelden'],  // fallback if no submit control
 *       // Optional. Extra evidence that a login did not take, on top of the
 *       // two checks every platform gets (still on the login URL, password
 *       // field still on the page).
 *       failureUrls: ['/anmelden']
 *     },
 *     paths: { profileEdit: '/profile/edit', ... },
 *     // What to write where, when pushing a profile. `kind` picks the writer.
 *     profileFields: [
 *       { field: 'height', selector: 'input[name="height"]', kind: 'text' },
 *       { field: 'eyeColor', selector: 'select[name="eye_color"]', kind: 'select' }
 *     ]
 *   };
 *
 * Every selector in a descriptor is a plain string literal on purpose:
 * scripts/check-selectors.mjs reads them straight out of the source, so a
 * descriptor's selectors are checked like any other.
 */
export class BrowserConnector extends PlatformConnector {
  /** @returns {object} the platform's descriptor */
  static get site() {
    throw new Error(`${this.name} must declare a static site descriptor`);
  }

  get site() {
    return this.constructor.site;
  }

  constructor(platform, credentials) {
    super(platform, credentials);

    const { baseUrl, loginPath } = this.constructor.site;
    // Kept as instance fields so a test can point one connector at a local
    // fixture server without touching the class every other test shares.
    this.baseUrl = baseUrl;
    this.loginPath = loginPath;

    this.browser = null;
    this.page = null;
    this.isAuthenticated = false;
  }

  /**
   * Conservative by default: ten requests a minute. These are other people's
   * sites and the connector is a guest on them.
   */
  initRateLimiter() {
    return new RateLimiterMemory({ points: 10, duration: 60 });
  }

  /** Absolute URL for a path from the descriptor. */
  url(path) {
    return `${this.baseUrl}${path}`;
  }

  // ---- browser lifecycle ---------------------------------------------------

  async launch() {
    this.browser = await puppeteer.launch({
      ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
      }),
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    return this.page;
  }

  async cleanup() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.isAuthenticated = false;
    } catch (error) {
      this.log('error', 'Error during cleanup', { error: error.message });
    }
  }

  async close() {
    await this.cleanup();
  }

  /**
   * Give every failure a typed error, and leave the browser open.
   *
   * Closing here would destroy the page the caller is about to photograph -
   * ConnectorService captures forensics and then closes in a `finally`, and a
   * capture taken after teardown has no URL, no screenshot and no HTML.
   */
  async withRetry(fn, maxRetries = 3) {
    try {
      return await super.withRetry(fn, maxRetries);
    } catch (error) {
      throw this.classifyFailure(error);
    }
  }

  // ---- login ---------------------------------------------------------------

  async verify() {
    await this.authenticate();
    return { ok: true, message: 'Login succeeded.' };
  }

  /**
   * Log in, using the descriptor's selectors.
   *
   * The success check deserves its comment. It used to be
   * `url.includes('/login')`, which is wrong for any platform that renders its
   * sign-in page under a different path - Filmmakers re-renders
   * /users/sign_in on a rejected password, so every failed login there was
   * reported as a success. What is actually true after a working login is that
   * you are no longer on the login page: not at its URL, and not looking at a
   * password field.
   */
  async authenticate() {
    const { login } = this.site;

    try {
      this.log('info', `Authenticating with ${this.manifest.name} via web automation`);

      const missing = this.missingCredentials();
      if (missing.length > 0) {
        throw new AuthError(
          `Missing ${this.manifest.name} credentials (${missing.join(', ')} required)`,
          { platform: this.manifest.key }
        );
      }

      await this.launch();

      const loginUrl = this.url(this.loginPath);
      await this.page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      this.log('info', 'Loaded login page, entering credentials');

      await this.page.waitForSelector(login.user, { timeout: 10000 });
      await this.page.type(login.user, this.credentialValue());
      await this.page.type(login.password, this.credentials.password);

      await this.submitLogin();
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      const currentUrl = this.page.url();
      const passwordStillVisible = Boolean(await this.page.$('input[type="password"]'));
      const onKnownFailureUrl = (login.failureUrls || []).some((part) => currentUrl.includes(part));

      if (currentUrl.startsWith(loginUrl) || passwordStillVisible || onKnownFailureUrl) {
        // Rejected credentials and a changed login form look identical from
        // here. AuthError is the common case and the one the user can act on;
        // the caller's forensics capture holds the final URL and a screenshot,
        // which is what actually tells the two apart.
        throw new AuthError(
          `Login failed: still on the login page after submitting (${currentUrl}). `
          + 'The credentials were rejected, or the login form changed.',
          { platform: this.manifest.key }
        );
      }

      this.isAuthenticated = true;
      this.log('info', `Successfully authenticated with ${this.manifest.name}`);
      return true;
    } catch (error) {
      const failure = this.classifyFailure(error);
      this.log('error', `${this.manifest.name} authentication failed`, {
        error: failure.message,
        type: failure.name
      });
      throw failure;
    }
  }

  /**
   * The account field's value. Most platforms want the email address; a
   * connector whose manifest asks for a username overrides this.
   */
  credentialValue() {
    return this.credentials.email || this.credentials.username;
  }

  /**
   * Submit the login form: the form that owns the password field, falling back
   * to a button matched by its label. JobWork needs the fallback - its only
   * button[type="submit"] is hidden and the visible control is a plain
   * "Weiter" button with no type attribute.
   */
  async submitLogin() {
    const { login } = this.site;

    // `submitBy: 'text'` when the form holds more than one submit button and
    // picking the wrong one does something the user did not ask for. Filmpool
    // and UFA Base put "Einloggen" and "Sende mir einen Login-Link" in the same
    // form: clicking blindly would mail the account holder a login link.
    if (login.submitBy !== 'text' && await this.submitFormOwning(login.password)) return true;

    const button = await findByCssOrText(this.page, {
      css: ['button[type="submit"]', 'input[type="submit"]'],
      texts: login.submitTexts || ['anmelden', 'einloggen', 'login', 'sign in'],
      timeout: 5000
    });

    if (!button) {
      throw new PlatformChangedError('The login form has no submit control', {
        platform: this.manifest.key
      });
    }

    await button.click();
    await button.dispose().catch(() => {});
    return true;
  }

  // ---- reading the page ----------------------------------------------------

  /** Navigate, waiting for the page to settle. */
  async openPage(url) {
    await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  }

  /** Trimmed value of an input, or null when it is absent or empty. */
  async readValue(selector) {
    return this.page
      .$eval(selector, (el) => (el.value || '').trim() || null)
      .catch(() => null);
  }

  /** Texts of the selected options of a (possibly multiple) select. */
  async readSelected(selector) {
    return this.page
      .$eval(selector, (el) => [...el.selectedOptions].map((o) => o.text.trim()).filter(Boolean))
      .catch(() => []);
  }

  /** Values of a repeated hidden input, as a tag widget writes them. */
  async readList(selector) {
    return this.page
      .$$eval(selector, (els) => els.map((el) => (el.value || '').trim()).filter(Boolean))
      .catch(() => []);
  }

  /**
   * Read a tag widget: chosen values sit in repeated hidden inputs as
   * "code#level", and the code is only readable through the options of the
   * widget's own select.
   *
   * Note that `selectSelector` is resolved inside this method, so it is not
   * covered by scripts/check-selectors.mjs. That is tolerable here and nowhere
   * else: if it matches nothing the codes are returned as they are, which is
   * ugly but not wrong - it cannot throw and cannot silently drop an entry.
   */
  async readTagged(hashSelector, selectSelector) {
    const entries = await this.readList(hashSelector);
    if (entries.length === 0) return [];

    const labels = await this.page.$eval(selectSelector, (select) => {
      const map = {};
      for (const option of select.options) {
        if (option.value) map[option.value] = option.text.trim();
      }
      return map;
    }).catch(() => ({}));

    return entries.map((entry) => {
      const [code, level] = entry.split('#');
      return { name: labels[code] || code.trim(), level: (level || '').trim() };
    });
  }

  // ---- writing the page ----------------------------------------------------

  /** Clear a field and type into it. */
  async clearAndType(selector, value) {
    await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.value = '';
    }, selector);
    await this.page.type(selector, String(value));
  }

  /**
   * Write one field.
   * @returns {Promise<boolean>} false when the field is not on the page - the
   *   caller must not count that as an update.
   */
  async writeField({ selector, kind, wait }, value) {
    if (wait) {
      const appeared = await this.page
        .waitForSelector(selector, { timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (!appeared) return false;
    }

    if (!await this.page.$(selector)) return false;

    if (kind === 'select') {
      // page.select does not throw on a value the select does not offer - it
      // selects nothing and returns an empty array. Treating that as a write
      // would report a field as updated whose dropdown never moved.
      const selected = await this.page.select(selector, String(value));
      return selected.length > 0;
    }

    await this.clearAndType(selector, value);
    return true;
  }

  /**
   * Fill in the descriptor's profile fields.
   *
   * Three lists, not one: what we were asked to write, what actually landed,
   * and what could not be found. A field whose input is missing must never
   * appear in `updatedFields` - reporting height, eyeColor and hairColor as
   * updated on a page that contains none of them is how a rotted selector used
   * to look exactly like a completed sync.
   */
  async applyProfileFields(profile, fields) {
    const requestedFields = [];
    const updatedFields = [];
    const missingFields = [];
    let updatedSelector = null;

    for (const descriptor of fields) {
      const value = profile[descriptor.field];
      if (value === undefined || value === null || value === '') continue;

      requestedFields.push(descriptor.field);
      try {
        // eslint-disable-next-line no-await-in-loop
        const written = await this.writeField(descriptor, descriptor.transform ? descriptor.transform(value) : value);
        if (written) {
          updatedFields.push(descriptor.field);
          updatedSelector = updatedSelector || descriptor.selector;
        } else {
          missingFields.push(descriptor.field);
        }
      } catch (error) {
        this.log('warn', `Could not update ${descriptor.field}`, { error: error.message });
        missingFields.push(descriptor.field);
      }
    }

    return { requestedFields, updatedFields, missingFields, updatedSelector };
  }

  /** Where this platform's profile form lives. Overridden where it is dynamic. */
  async profileEditUrl() {
    return this.url(this.site.paths.profileEdit);
  }

  async pushProfile(profile) {
    return this.updateProfile(profile);
  }

  /**
   * Write the profile to the platform's own form.
   *
   * Fails loudly when nothing landed: this is the one place where a scraper is
   * most tempted to report success it did not earn.
   */
  async updateProfile(profile) {
    return this.withRateLimit(() => this.withRetry(async () => {
      this.log('info', `Updating profile on ${this.manifest.name}`);

      if (!this.isAuthenticated || !this.page) {
        throw new Error('Not authenticated. Call authenticate() first.');
      }

      await this.openPage(await this.profileEditUrl());

      const {
        requestedFields, updatedFields, missingFields, updatedSelector
      } = await this.applyProfileFields(profile, this.site.profileFields || []);

      if (requestedFields.length > 0 && updatedFields.length === 0) {
        throw new PlatformChangedError(
          `No profile field was found on the ${this.manifest.name} edit page `
          + `(looked for: ${requestedFields.join(', ')})`,
          { platform: this.manifest.key }
        );
      }

      let submitted = false;
      if (updatedFields.length > 0) {
        // The form that owns an edited field, never a page-wide submit
        // selector: that can hit an unrelated form elsewhere on the page.
        submitted = await this.submitFormOwning(updatedSelector);
        if (!submitted) {
          throw new PlatformChangedError(
            'Filled the profile form but found no submit control in it, so nothing was saved',
            { platform: this.manifest.key }
          );
        }
        // Some forms save without navigating; a timeout here is not a failure.
        await this.page
          .waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
          .catch(() => {});
      }

      this.log('info', `Updated profile on ${this.manifest.name}`, {
        updatedFields,
        missingFields,
        submitted
      });

      return {
        success: true,
        updatedFields,
        missingFields,
        submitted,
        details: { updatedFields, missingFields, submitted }
      };
    }));
  }

  /**
   * Click the submit control of the form that owns `selector`.
   *
   * A bare `button[type="submit"], input[type="submit"]` is not safe: on
   * filmmakers.eu the header carries one submit form per interface language, so
   * that selector matches 36 elements and `page.click` takes the first in the
   * DOM - the "English" button. Scoping to the form that actually holds the
   * field we filled is the only reliable way to hit the right button.
   *
   * @returns {Promise<boolean>} false when there is no such form or no submit
   *   control in it - the caller must not treat that as a submission.
   */
  async submitFormOwning(selector) {
    if (!this.page || !selector) return false;

    // A visible control is clicked like a person would. JobWork's login form
    // carries a hidden button[type="submit"] and does its work from a visible
    // "Weiter" button with no type attribute, so taking the first match in DOM
    // order would pick the hidden one - and puppeteer refuses to click that.
    const handle = await this.page.evaluateHandle((sel) => {
      const field = document.querySelector(sel);
      const form = field && field.closest('form');
      if (!form) return null;

      const isVisible = (el) => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden'
          && box.width > 0 && box.height > 0;
      };

      return [...form.querySelectorAll(
        'input[type="submit"], button[type="submit"], button:not([type])'
      )].find(isVisible) || null;
    }, selector);

    const element = handle.asElement();
    if (element) {
      await element.click();
      await element.dispose();
      return true;
    }
    await handle.dispose();

    // Nothing visible to click. A form whose only submit control is hidden is
    // still meant to be submitted - that is what the hidden button is for - so
    // ask the form itself, which fires the same submit event a click would.
    return this.page.evaluate((sel) => {
      const field = document.querySelector(sel);
      const form = field && field.closest('form');
      if (!form) return false;

      const submitter = form.querySelector('input[type="submit"], button[type="submit"]');
      if (typeof form.requestSubmit === 'function') form.requestSubmit(submitter || undefined);
      else form.submit();
      return true;
    }, selector);
  }

  /** Format a date for a date input (YYYY-MM-DD). */
  formatDateForInput(date) {
    if (!date) return '';
    const value = new Date(date);
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().split('T')[0];
  }
}

export default BrowserConnector;
