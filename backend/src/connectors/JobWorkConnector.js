import puppeteer from 'puppeteer';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { PlatformConnector } from './PlatformConnector.js';
import { findByCssOrText } from './selectors.js';
import { AuthError, PlatformChangedError } from './errors.js';

/**
 * JobWork Platform Adapter
 * Platform ID: 5
 * Type: Web scraping (no public API available)
 * Features: Profile, Jobs, Networking
 * Regions: DE, AT, CH
 */
export class JobWorkConnector extends PlatformConnector {
  static manifest = Object.freeze({
    id: 5,
    key: 'jobwork',
    name: 'JobWork',
    authType: 'credentials',
    credentialFields: [{ name: 'email', type: 'email', required: true, label: 'E-Mail' },
      { name: 'password', type: 'password', required: true, label: 'Passwort' }],
    capabilities: ['verify', 'pushProfile', 'pushAvailability', 'pushMedia']
  });

  // ---- unified interface ----
  // The app calls these names on every connector; the platform-specific work
  // stays in the methods below, which keep their original names.

  async verify() {
    await this.authenticate();
    return { ok: true, message: 'Login succeeded.' };
  }

  async pushProfile(profile) {
    return this.updateProfile(profile);
  }

  async close() {
    if (typeof this.cleanup === 'function') await this.cleanup();
  }

  constructor(platform, credentials) {
    super(platform, credentials);

    // Verified against the live site on 2026-08-30. The platform runs on
    // jobwork.COM; jobwork.de only redirects, over plain HTTP, and presents no
    // usable certificate - so the previous https://www.jobwork.de failed at the
    // TLS handshake (ERR_SSL_UNRECOGNIZED_NAME_ALERT) before any page loaded.
    this.baseUrl = 'https://www.jobwork.com';
    // /login redirects here; this is where the form actually lives.
    this.loginPath = '/de/login';
    this.browser = null;
    this.page = null;
    this.isAuthenticated = false;
  }

  /**
   * Initialize rate limiter with conservative limits
   */
  initRateLimiter() {
    return new RateLimiterMemory({
      points: 10,
      duration: 60,
    });
  }

  /**
   * Authenticate with JobWork platform
   * @returns {Promise<boolean>}
   */
  async authenticate() {
    try {
      this.log('info', 'Authenticating with JobWork via web automation');

      if (!this.credentials || !this.credentials.email || !this.credentials.password) {
        throw new AuthError('Missing JobWork credentials (email/password required)', {
          platform: 'jobwork'
        });
      }

      // Launch browser
      this.browser = await puppeteer.launch({
        ...(process.env.PUPPETEER_EXECUTABLE_PATH && { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }),
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

      // Set user agent
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Navigate to login page
      const loginUrl = `${this.baseUrl}${this.loginPath}`;
      await this.page.goto(loginUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      this.log('info', 'Loaded login page, entering credentials');

      // Fill in login form.
      //
      // The account field is `identifier` and carries type="text", not "email":
      // the previous selectors (email/username) matched nothing at all, so the
      // login could only ever fail here. The older names stay as fallbacks in
      // case the form is rolled back.
      await this.page.waitForSelector('input[name="identifier"], input[type="email"], input[name="email"], input[name="username"]', { timeout: 10000 });

      const emailInput = await this.page.$('input[name="identifier"], input[type="email"], input[name="email"], input[name="username"]');
      await emailInput.type(this.credentials.email);

      const passwordInput = await this.page.$('input[type="password"], input[name="password"]');
      await passwordInput.type(this.credentials.password);

      // Submit the login form itself, not the first submit control on the page:
      // a page-wide selector can hit an unrelated form in the header (on
      // Filmmakers it matched 36 language-switcher buttons).
      let submitted = await this.submitFormOwning('input[type="password"], input[name="password"]');

      if (!submitted) {
        // The form's only typed submit control is hidden and the visible one is
        // a plain "Weiter" button, so fall back to matching it by its label.
        const button = await findByCssOrText(this.page, {
          css: ['button[type="submit"]', 'input[type="submit"]'],
          texts: ['weiter', 'anmelden', 'einloggen', 'login', 'sign in'],
          timeout: 5000
        });
        if (!button) {
          throw new PlatformChangedError(
            'The login form has no submit control',
            { platform: 'jobwork' }
          );
        }
        await button.click();
        await button.dispose().catch(() => {});
        submitted = true;
      }
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // Check if login was successful. Compare against the URL we navigated to
      // rather than looking for "/login" in it: a platform that re-renders its
      // sign-in page under a different path (Filmmakers does) would otherwise
      // have every rejected password reported as a successful login.
      const currentUrl = this.page.url();
      const passwordStillVisible = Boolean(await this.page.$('input[type="password"]'));
      if (currentUrl.startsWith(loginUrl) || passwordStillVisible) {
        // Rejected credentials and a changed login form look identical from
        // here. AuthError is the common case and the one the user can act on;
        // the caller's forensics capture holds the final URL and a screenshot,
        // which is what actually tells the two apart.
        throw new AuthError(
          `Login failed: still on the login page after submitting (${currentUrl}). `
          + 'The credentials were rejected, or the login form changed.',
          { platform: 'jobwork' }
        );
      }

      this.isAuthenticated = true;
      this.log('info', 'Successfully authenticated with JobWork');

      return true;

    } catch (error) {
      const failure = this.classifyFailure(error);
      this.log('error', 'JobWork authentication failed', {
        error: failure.message,
        type: failure.name
      });

      // Leave the page open and let the caller photograph it. Tearing the
      // browser down here - as this used to - left the caller's forensics call
      // capturing a page that no longer existed: url null, screenshot absent,
      // every login failure indistinguishable from every other. The caller
      // captures and then closes in a `finally`.
      throw failure;
    }
  }

  /**
   * Push availability data to JobWork
   * @param {Array} availability
   * @returns {Promise<Object>}
   */
  async pushAvailability(availability) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', `Pushing ${availability.length} availability items to JobWork`);

        if (!this.isAuthenticated || !this.page) {
          throw new Error('Not authenticated. Call authenticate() first.');
        }

        // Navigate to availability/calendar page
        await this.page.goto(`${this.baseUrl}/profil/verfuegbarkeit`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        let successCount = 0;
        let firstItemError = null;

        // Process each availability item
        for (const item of availability) {
          try {
            // Structural selectors first, label as the fallback. This used to be
            // `button:contains("Hinzufügen")` - jQuery, not CSS - so `page.$`
            // threw and the `if (addButton)` guard quietly skipped every item.
            const addButton = await findByCssOrText(this.page, {
              css: ['[data-action="add-availability"]', '.add-availability'],
              texts: ['verfügbarkeit hinzufügen', 'hinzufügen', 'neu', 'add'],
              timeout: 5000
            });

            if (!addButton) {
              throw new PlatformChangedError('No "add availability" control found on the availability page', {
                platform: 'jobwork'
              });
            }

            await addButton.click();
            await addButton.dispose().catch(() => {});
            await this.delay(500);

            // Fill form
            await this.fillAvailabilityForm(item);

            // Submit
            const submitButton = await findByCssOrText(this.page, {
              css: ['button[type="submit"]', 'input[type="submit"]'],
              texts: ['speichern', 'übernehmen', 'save'],
              timeout: 5000
            });

            if (!submitButton) {
              throw new PlatformChangedError('Availability form has no submit control', {
                platform: 'jobwork'
              });
            }

            await submitButton.click();
            await submitButton.dispose().catch(() => {});
            await this.delay(1000);
            successCount++;

          } catch (itemError) {
            firstItemError = firstItemError || itemError;
            this.log('warn', 'Failed to add availability item', {
              item,
              error: itemError.message
            });
          }
        }

        // Every item failed: keeping going is right for one bad date, wrong
        // when nothing worked - the caller would log a successful sync of zero.
        if (successCount === 0 && availability.length > 0) {
          throw firstItemError || new PlatformChangedError(
            'No availability item could be added on JobWork',
            { platform: 'jobwork' }
          );
        }

        this.log('info', `Pushed ${successCount}/${availability.length} availability items`);

        return {
          success: true,
          count: successCount,
          total: availability.length,
          externalIds: [],
          details: { added: successCount, total: availability.length }
        };
      });
    });
  }

  /**
   * Fill availability form fields
   * @param {Object} item
   */
  async fillAvailabilityForm(item) {
    const startDate = this.formatDateForInput(item.startDate);
    const endDate = this.formatDateForInput(item.endDate);

    // Start date
    const startInput = await this.page.$('input[name="start_date"], input[name="von"], input[name="from"]');
    if (startInput) {
      await this.page.evaluate((el, value) => { el.value = value; }, startInput, startDate);
    }

    // End date
    const endInput = await this.page.$('input[name="end_date"], input[name="bis"], input[name="to"]');
    if (endInput) {
      await this.page.evaluate((el, value) => { el.value = value; }, endInput, endDate);
    }

    // Status (German platform)
    if (item.status) {
      const statusMap = {
        'available': 'verfuegbar',
        'unavailable': 'nicht_verfuegbar',
        'booking': 'gebucht',
        'option': 'option'
      };
      const mappedStatus = statusMap[item.status] || item.status;

      const statusSelect = await this.page.$('select[name="status"], select[name="typ"]');
      if (statusSelect) {
        await this.page.select('select[name="status"], select[name="typ"]', mappedStatus);
      }
    }

    // Notes
    if (item.notes) {
      const notesTextarea = await this.page.$('textarea[name="notes"], textarea[name="notizen"], textarea[name="bemerkung"]');
      if (notesTextarea) {
        await notesTextarea.type(item.notes);
      }
    }
  }

  /**
   * Push media (photos) to JobWork
   * @param {Object} media
   * @returns {Promise<Object>}
   */
  async pushMedia(media) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', 'Uploading media to JobWork', {
          type: media.type,
          filename: media.filename
        });

        if (!this.isAuthenticated || !this.page) {
          throw new Error('Not authenticated. Call authenticate() first.');
        }

        // Navigate to media page
        await this.page.goto(`${this.baseUrl}/profil/bilder`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Find file upload input
        const uploadInput = await this.page.$('input[type="file"]');
        if (!uploadInput) {
          throw new Error('Could not find file upload input');
        }

        // Save to temp file
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');

        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, media.filename);
        await fs.writeFile(tempFilePath, media.buffer);

        try {
          // Upload
          await uploadInput.uploadFile(tempFilePath);

          // Wait for upload confirmation
          await this.page.waitForSelector('.upload-success, .erfolg, .success', {
            timeout: 60000
          });

          this.log('info', 'Successfully uploaded media to JobWork');

          return {
            success: true,
            externalId: null,
            url: null
          };

        } finally {
          // Cleanup
          try {
            await fs.unlink(tempFilePath);
          } catch (e) {
            // Ignore
          }
        }
      });
    });
  }

  /**
   * Update profile information on JobWork
   * @param {Object} profile
   * @returns {Promise<Object>}
   */
  async updateProfile(profile) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', 'Updating profile on JobWork');

        if (!this.isAuthenticated || !this.page) {
          throw new Error('Not authenticated. Call authenticate() first.');
        }

        // Navigate to profile edit
        await this.page.goto(`${this.baseUrl}/profil/bearbeiten`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // What we were asked to write, what landed, and what was not found.
        const requestedFields = [];
        const updatedFields = [];
        const missingFields = [];

        // The selector of a field that actually landed, so the submit below can
        // be scoped to the form that owns it rather than to the whole page.
        let updatedSelector = null;

        const applyField = async (field, selector, apply) => {
          requestedFields.push(field);
          try {
            if (await apply()) {
              updatedFields.push(field);
              updatedSelector = updatedSelector || selector;
            } else {
              missingFields.push(field);
            }
          } catch (error) {
            this.log('warn', `Could not update ${field}`, { error: error.message });
            missingFields.push(field);
          }
        };

        // Biography (German: Biografie/Über mich)
        if (profile.biography) {
          await applyField('biography', 'textarea[name="biography"], textarea[name="biografie"], textarea[name="ueber_mich"]', async () => {
            const bioTextarea = await this.page.$('textarea[name="biography"], textarea[name="biografie"], textarea[name="ueber_mich"]');
            if (!bioTextarea) return false;
            await this.page.evaluate(el => { el.value = ''; }, bioTextarea);
            await bioTextarea.type(profile.biography);
            return true;
          });
        }

        // Physical attributes
        if (profile.height) {
          await applyField('height', 'input[name="height"], input[name="groesse"]', async () => {
            const heightInput = await this.page.$('input[name="height"], input[name="groesse"]');
            if (!heightInput) return false;
            await this.page.evaluate(el => { el.value = ''; }, heightInput);
            await heightInput.type(String(profile.height));
            return true;
          });
        }

        if (profile.eyeColor) {
          await applyField('eyeColor', 'select[name="eye_color"], select[name="augenfarbe"]', async () => {
            if (!await this.page.$('select[name="eye_color"], select[name="augenfarbe"]')) return false;
            await this.page.select('select[name="eye_color"], select[name="augenfarbe"]', profile.eyeColor.toLowerCase());
            return true;
          });
        }

        if (profile.hairColor) {
          await applyField('hairColor', 'select[name="hair_color"], select[name="haarfarbe"]', async () => {
            if (!await this.page.$('select[name="hair_color"], select[name="haarfarbe"]')) return false;
            await this.page.select('select[name="hair_color"], select[name="haarfarbe"]', profile.hairColor.toLowerCase());
            return true;
          });
        }

        // Submit. Only worth attempting if something was actually filled.
        let submitted = false;
        if (updatedFields.length > 0) {
          // The form that owns an edited field, never a page-wide submit
          // selector: that can hit an unrelated form elsewhere on the page.
          submitted = await this.submitFormOwning(updatedSelector);
          if (!submitted) {
            throw new PlatformChangedError(
              'Filled the profile form but found no submit control in it, so nothing was saved',
              { platform: 'jobwork' }
            );
          }
          // Some forms save without navigating; a timeout here is not a failure.
          await this.page
            .waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
            .catch(() => {});
        }

        // Nothing landed: this is not the page the connector was written
        // against, and reporting success would log a sync that never happened.
        if (requestedFields.length > 0 && updatedFields.length === 0) {
          throw new PlatformChangedError(
            'No profile field was found on the JobWork edit page '
            + `(looked for: ${requestedFields.join(', ')})`,
            { platform: 'jobwork' }
          );
        }

        this.log('info', 'Updated profile on JobWork', {
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
      });
    });
  }

  /**
   * Format date for input field (YYYY-MM-DD or DD.MM.YYYY for German platforms)
   * @param {Date|string} date
   * @returns {string}
   */
  formatDateForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    // German date format
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}.${month}.${year}`;
  }

  /**
   * Clean up browser resources
   */
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

  /**
   * Give every failure a typed error, but leave the browser open: the caller
   * captures forensics from the live page and closes in a `finally`. Closing
   * here made every sync failure capture an empty page.
   */
  async withRetry(fn, maxRetries = 3) {
    try {
      return await super.withRetry(fn, maxRetries);
    } catch (error) {
      throw this.classifyFailure(error);
    }
  }
}

export default JobWorkConnector;
