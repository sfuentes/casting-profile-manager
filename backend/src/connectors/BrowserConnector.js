import puppeteer from 'puppeteer';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { PlatformConnector } from './PlatformConnector.js';
import { findByCssOrText } from './selectors.js';
import { AuthError, NotSupportedError, PlatformChangedError } from './errors.js';

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
  /**
   * Labels that decline a consent banner, lower-cased and matched exactly.
   * Ordered by preference: refusing outright beats saving a set of switches
   * that some banners pre-tick. Nothing here accepts anything.
   */
  static DECLINE_TEXTS = Object.freeze([
    'ablehnen',
    'alle ablehnen',
    'alles ablehnen',
    'nur notwendige',
    'nur notwendige cookies',
    'nur essenzielle',
    'nur erforderliche',
    'reject all',
    'decline',
    'decline all',
    'only necessary',
    'necessary only',
    'reject',
    'weiter ohne einwilligung',
    'continue without agreeing'
  ]);

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
      await this.openPage(loginUrl);
      this.log('info', 'Loaded login page, entering credentials');

      await this.page.waitForSelector(login.user, { timeout: 10000 });
      await this.page.type(login.user, this.credentialValue());
      await this.page.type(login.password, this.credentials.password);

      await this.submitLogin();
      await this.waitForLoginOutcome(loginUrl);

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
   * Wait for the login to resolve one way or the other.
   *
   * `waitForNavigation` alone is wrong twice over. A single-page app never
   * fires one, so waiting for it times out after a successful login - which is
   * how JobWork reported "could not be reached" while logging in perfectly
   * well. And when it does fire, it can resolve while the app is still
   * client-side routing: JobWork had already torn its form down and had not yet
   * changed the URL, so judging at that instant called a good login a rejected
   * one.
   *
   * What settles it either way is the URL leaving the login page. This waits
   * for that, and gives up quietly - the caller decides what a still-unchanged
   * URL means.
   */
  async waitForLoginOutcome(loginUrl, timeoutMs = 20000) {
    // A classic form post navigates; take that when it happens.
    await this.page
      .waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 })
      .catch(() => {});

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!this.page.url().startsWith(loginUrl)) return true;
      // eslint-disable-next-line no-await-in-loop
      await this.delay(500);
    }
    return false;
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
    const labels = login.submitTexts || ['anmelden', 'einloggen', 'login', 'sign in'];
    if (login.submitBy !== 'text' && await this.submitFormOwning(login.password, labels)) return true;

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

  /** Navigate, waiting for the page to settle, then clear any consent overlay. */
  async openPage(url) {
    await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await this.dismissConsentBanner();
  }

  /**
   * Decline a cookie banner if one is covering the page.
   *
   * JobWork's login sat behind a Usercentrics banner. The fields underneath it
   * were in the DOM and could be typed into, so the connector filled them in,
   * clicked "Weiter", and waited thirty seconds for a navigation that could
   * never happen because the overlay swallowed the click. The failure read
   * "JobWork could not be reached", which is not what was wrong at all - only
   * the forensics screenshot showed the banner.
   *
   * Two details make this awkward, and both are why a plain selector does not
   * work: the banner renders inside a shadow root, so it is invisible to
   * document.querySelector and absent from page.content(); and its buttons are
   * identified only by their labels.
   *
   * It always declines. "Alles akzeptieren" is right there and would be one
   * word shorter to match, but consenting to tracking on someone's behalf is
   * not this code's decision to make.
   */
  async dismissConsentBanner() {
    const declined = await this.page.evaluate((texts) => {
      const buttons = [];
      const visit = (root, depth) => {
        if (!root || depth > 12) return;
        for (const element of root.querySelectorAll('*')) {
          const tag = element.tagName.toLowerCase();
          const role = element.getAttribute && element.getAttribute('role');
          if (tag === 'button' || role === 'button' || tag === 'a') buttons.push(element);
          if (element.shadowRoot) visit(element.shadowRoot, depth + 1);
        }
      };
      visit(document, 0);

      const visible = (el) => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden'
          && box.width > 0 && box.height > 0;
      };

      for (const wanted of texts) {
        const match = buttons.find((el) => visible(el)
          && (el.innerText || el.textContent || '').trim().toLowerCase() === wanted);
        if (match) {
          match.click();
          return match.innerText.trim();
        }
      }
      return null;
    }, this.site.consent?.declineTexts || BrowserConnector.DECLINE_TEXTS);

    if (declined) {
      this.log('info', `Declined a consent banner ("${declined}")`);
      // The overlay unmounts asynchronously; give it a moment before anything
      // tries to click what it was covering.
      await this.delay(500);
    }
    return Boolean(declined);
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

  /**
   * Read a profile from a form the descriptor describes.
   *
   * Filmmakers and JobWork each needed their own reader - one discovers a slug
   * and parses a vita list, the other listens to GraphQL. A platform whose
   * profile is simply a form, possibly spread over several pages, needs no code
   * at all: it declares where to look and what each control means.
   *
   *   profileRead: {
   *     pages: [{
   *       path: '/external/extras',
   *       fields: [
   *         { field: 'firstName', selector: '#first_name' },
   *         { field: 'gender', selector: '#sex', kind: 'selected' },
   *         { field: 'languages', selector: '#mother_tongue_id', kind: 'nativeLanguage' },
   *         { field: 'skills', selector: '#dialect', kind: 'list' }
   *       ]
   *     }]
   *   }
   *
   * Values are passed on exactly as the platform words them. Turning "braun"
   * or "männlich" into this app's vocabulary is the normaliser's job, and what
   * it cannot map becomes a question for the user rather than a guess here.
   */
  async readDeclaredProfile() {
    const { profileRead } = this.site;
    if (!profileRead?.pages?.length) {
      throw new NotSupportedError(
        `${this.manifest.name} declares no profileRead descriptor`,
        { platform: this.manifest.key }
      );
    }

    const fields = {};
    const sources = {};
    const missing = [];

    const add = (field, value, source) => {
      const empty = value === null || value === undefined || value === ''
        || (Array.isArray(value) && value.length === 0);
      if (empty) {
        missing.push(field);
        return;
      }

      // Several controls can feed one field - dialects, instruments and
      // hobbies are all just skills here.
      if (Array.isArray(value) && Array.isArray(fields[field])) {
        fields[field] = [...fields[field], ...value];
      } else if (field.includes('.')) {
        const [head, tail] = field.split('.');
        fields[head] = { ...(fields[head] || {}), [tail]: value };
      } else {
        fields[field] = value;
      }
      sources[field] = source;
    };

    for (const page of profileRead.pages) {
      const url = page.path.startsWith('http') ? page.path : this.url(page.path);
      // eslint-disable-next-line no-await-in-loop
      await this.openPage(url);

      for (const descriptor of page.fields) {
        const { field, selector, kind = 'value' } = descriptor;
        const where = selector || (descriptor.selectors || []).join(' + ');
        let value;

        /* eslint-disable no-await-in-loop */
        if (kind === 'selected') {
          [value] = await this.readSelected(selector);
        } else if (kind === 'selectedList') {
          value = await this.readSelected(selector);
        } else if (kind === 'nativeLanguage') {
          const [language] = await this.readSelected(selector);
          value = language ? [{ language, level: 'Muttersprache' }] : [];
        } else if (kind === 'list') {
          const raw = await this.readValue(selector);
          value = (raw || '').split(/[,;]/).map((part) => part.trim()).filter(Boolean);
        } else if (kind === 'join') {
          // One value of ours spread over several of theirs: an address is a
          // street, a postal code and a town in three separate inputs.
          const parts = [];
          for (const one of descriptor.selectors || []) {
            parts.push(await this.readValue(one));
          }
          // `separators` gives one per gap, because the gaps differ: a German
          // address is "street, postcode town", not "street, postcode, town".
          const present = parts.filter(Boolean);
          const gaps = descriptor.separators || [];
          value = present.reduce((text, part, index) => (index === 0
            ? part
            : text + (gaps[index - 1] ?? descriptor.separator ?? ', ') + part), '');
        } else {
          value = await this.readValue(selector);
        }
        /* eslint-enable no-await-in-loop */

        add(field, value, `${page.path} ${where}`);
      }
    }

    if (Object.keys(fields).length === 0) {
      throw new PlatformChangedError(
        `None of the declared profile fields were found on ${this.manifest.name}`,
        { platform: this.manifest.key }
      );
    }

    this.log('info', `Read profile from ${this.manifest.name}`, {
      found: Object.keys(fields),
      missing
    });

    // One field can be fed by several controls, so the same name can land in
    // `missing` more than once - report it once.
    const missingOnce = [...new Set(missing)].filter((field) => !(field in fields));

    return {
      success: true,
      fields,
      sources,
      missing: missingOnce,
      details: { found: Object.keys(fields), missing: missingOnce }
    };
  }

  /** Declarative by default; connectors with a stranger source override this. */
  async pullProfile() {
    return this.withRateLimit(() => this.withRetry(async () => {
      if (!this.isAuthenticated || !this.page) {
        throw new Error('Not authenticated. Call authenticate() first.');
      }
      return this.readDeclaredProfile();
    }));
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
        submitted = await this.submitFormOwning(updatedSelector, this.site.saveTexts || ['speichern', 'save', 'übernehmen', 'aktualisieren']);
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
  async submitFormOwning(selector, labels = []) {
    if (!this.page || !selector) return false;

    // Which control to click, in order of how sure we can be about it.
    //
    // "First visible candidate" is not good enough. JobWork's login form holds
    // a hidden button[type="submit"], then a typeless icon button that reveals
    // the password, then the typeless "Weiter" button that actually submits.
    // Clicking the first visible one clicked the eye: no login, and the
    // password rendered in clear - which the forensics screenshot then stored.
    //
    // So: a real submit button first; then a labelled button matching what the
    // caller expects; then any labelled button. A button with no text at all is
    // never clicked - that is an icon, and icons in a login form do things like
    // reveal passwords.
    const handle = await this.page.evaluateHandle((sel, wanted) => {
      const field = document.querySelector(sel);
      const form = field && field.closest('form');
      if (!form) return null;

      const isVisible = (el) => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden'
          && box.width > 0 && box.height > 0;
      };
      const labelOf = (el) => (el.innerText || el.value || '').trim().toLowerCase();

      const typed = [...form.querySelectorAll('input[type="submit"], button[type="submit"]')]
        .filter(isVisible);
      if (typed.length > 0) return typed[0];

      const bare = [...form.querySelectorAll('button:not([type])')]
        .filter((el) => isVisible(el) && labelOf(el).length > 0);

      const expected = bare.find((el) => wanted.some((text) => labelOf(el) === text
        || labelOf(el).includes(text)));

      return expected || bare[0] || null;
    }, selector, labels.map((text) => text.toLowerCase()));

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
