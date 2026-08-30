import puppeteer from 'puppeteer';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { PlatformConnector } from './PlatformConnector.js';
import { findByCssOrText } from './selectors.js';
import { AuthError, PlatformChangedError } from './errors.js';

/**
 * Wanted Platform Adapter
 * Platform ID: 9
 * Type: Web scraping (no public API)
 * Features: Profile, Jobs, Availability
 * Regions: DE, AT, CH
 */
export class WantedConnector extends PlatformConnector {
  static manifest = Object.freeze({
    id: 9,
    key: 'wanted',
    name: 'Wanted',
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

    this.baseUrl = 'https://www.wanted.de';
    // NOT verified against the live site: unlike Filmmakers (whose /login turned
    // out to be a 404), nobody has loaded this path from a machine that can
    // reach the platform. Treat a PlatformChangedError from the login step as a
    // sign that this is wrong before assuming the selectors are.
    this.loginPath = '/login';
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
   * Authenticate with Wanted platform
   * @returns {Promise<boolean>}
   */
  async authenticate() {
    try {
      this.log('info', 'Authenticating with Wanted via web automation');

      if (!this.credentials || !this.credentials.email || !this.credentials.password) {
        throw new AuthError('Missing Wanted credentials (email/password required)', {
          platform: 'wanted'
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

      // Fill in login form (German platform)
      await this.page.waitForSelector('input[type="email"], input[name="email"], input[name="benutzername"]', { timeout: 10000 });
      await this.page.type('input[type="email"], input[name="email"], input[name="benutzername"]', this.credentials.email);
      await this.page.type('input[type="password"], input[name="password"], input[name="passwort"]', this.credentials.password);

      // Submit the login form itself, not the first submit control on the page:
      // a page-wide selector can hit an unrelated form in the header (on
      // Filmmakers it matched 36 language-switcher buttons).
      const submitted = await this.submitFormOwning('input[type="password"], input[name="password"], input[name="passwort"]');
      if (!submitted) {
        throw new PlatformChangedError(
          'The login form has no submit control',
          { platform: 'wanted' }
        );
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
          { platform: 'wanted' }
        );
      }

      this.isAuthenticated = true;
      this.log('info', 'Successfully authenticated with Wanted');

      return true;

    } catch (error) {
      const failure = this.classifyFailure(error);
      this.log('error', 'Wanted authentication failed', {
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
   * Push availability data to Wanted
   * @param {Array} availability
   * @returns {Promise<Object>}
   */
  async pushAvailability(availability) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', `Pushing ${availability.length} availability items to Wanted`);

        if (!this.isAuthenticated || !this.page) {
          throw new Error('Not authenticated. Call authenticate() first.');
        }

        // Navigate to availability management
        await this.page.goto(`${this.baseUrl}/profil/verfuegbarkeit`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        let successCount = 0;
        let firstItemError = null;

        // Process each availability item
        for (const item of availability) {
          try {
            // Structural selectors first, German labels as the fallback. These
            // were `button:contains("Hinzufügen")` - jQuery, not CSS - so
            // `page.$` threw and the guard quietly skipped every item.
            const addButton = await findByCssOrText(this.page, {
              css: ['[data-action="add"]', '.add-availability'],
              texts: ['verfügbarkeit hinzufügen', 'hinzufügen', 'neu', 'add'],
              timeout: 5000
            });

            if (!addButton) {
              throw new PlatformChangedError('No "add availability" control found on the availability page', {
                platform: 'wanted'
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
                platform: 'wanted'
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
            'No availability item could be added on Wanted',
            { platform: 'wanted' }
          );
        }

        this.log('info', `Pushed ${successCount}/${availability.length} availability items to Wanted`);

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
   * Fill availability form fields (German interface)
   * @param {Object} item
   */
  async fillAvailabilityForm(item) {
    const startDate = this.formatDateForInput(item.startDate);
    const endDate = this.formatDateForInput(item.endDate);

    // Start date (Von/From)
    const startInput = await this.page.$('input[name="start_date"], input[name="von"], input[name="from"]');
    if (startInput) {
      await this.page.evaluate((el, value) => { el.value = value; }, startInput, startDate);
    }

    // End date (Bis/To)
    const endInput = await this.page.$('input[name="end_date"], input[name="bis"], input[name="to"]');
    if (endInput) {
      await this.page.evaluate((el, value) => { el.value = value; }, endInput, endDate);
    }

    // Status (German mapping)
    if (item.status) {
      const statusMap = {
        'available': 'verfuegbar',
        'unavailable': 'nicht_verfuegbar',
        'booking': 'gebucht',
        'option': 'option'
      };
      const mappedStatus = statusMap[item.status] || item.status;

      const statusSelect = await this.page.$('select[name="status"], select[name="typ"], select[name="verfuegbarkeit"]');
      if (statusSelect) {
        try {
          await this.page.select('select[name="status"], select[name="typ"], select[name="verfuegbarkeit"]', mappedStatus);
        } catch (e) {
          // Value might not exist in select
        }
      }
    }

    // Notes (Notizen/Bemerkung)
    if (item.notes) {
      const notesTextarea = await this.page.$('textarea[name="notes"], textarea[name="notizen"], textarea[name="bemerkung"]');
      if (notesTextarea) {
        await notesTextarea.type(item.notes);
      }
    }
  }

  /**
   * Push media (photos) to Wanted
   * @param {Object} media
   * @returns {Promise<Object>}
   */
  async pushMedia(media) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', 'Uploading media to Wanted', {
          type: media.type,
          filename: media.filename
        });

        if (!this.isAuthenticated || !this.page) {
          throw new Error('Not authenticated. Call authenticate() first.');
        }

        // Navigate to media/photos page
        await this.page.goto(`${this.baseUrl}/profil/fotos`, {
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

          // Wait for upload success (German: Erfolgreich/Hochgeladen)
          await this.page.waitForSelector('.upload-success, .erfolgreich, .hochgeladen, .success', {
            timeout: 60000
          });

          this.log('info', 'Successfully uploaded media to Wanted');

          return {
            success: true,
            externalId: null,
            url: null
          };

        } finally {
          // Cleanup temp file
          try {
            await fs.unlink(tempFilePath);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      });
    });
  }

  /**
   * Update profile information on Wanted
   * @param {Object} profile
   * @returns {Promise<Object>}
   */
  async updateProfile(profile) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', 'Updating profile on Wanted');

        if (!this.isAuthenticated || !this.page) {
          throw new Error('Not authenticated. Call authenticate() first.');
        }

        // Navigate to profile edit (German: Bearbeiten)
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

        // Biography (Biografie/Über mich)
        if (profile.biography) {
          await applyField('biography', 'textarea[name="biography"], textarea[name="biografie"], textarea[name="ueber_mich"]', async () => {
            const bioTextarea = await this.page.$('textarea[name="biography"], textarea[name="biografie"], textarea[name="ueber_mich"]');
            if (!bioTextarea) return false;
            await this.page.evaluate(el => { el.value = ''; }, bioTextarea);
            await bioTextarea.type(profile.biography);
            return true;
          });
        }

        // Physical attributes (German labels)
        if (profile.height) {
          await applyField('height', 'input[name="height"], input[name="groesse"], input[name="koerpergroesse"]', async () => {
            const heightInput = await this.page.$('input[name="height"], input[name="groesse"], input[name="koerpergroesse"]');
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

        // Nothing landed: this is not the page the connector was written
        // against. Fail before submitting an untouched form.
        if (requestedFields.length > 0 && updatedFields.length === 0) {
          throw new PlatformChangedError(
            'No profile field was found on the Wanted edit page '
            + `(looked for: ${requestedFields.join(', ')})`,
            { platform: 'wanted' }
          );
        }

        // Submit (German: Speichern/Aktualisieren).
        //
        // The form that owns an edited field first: a page-wide submit selector
        // can hit an unrelated form elsewhere on the page. The label lookup
        // stays as the fallback for forms whose button sits outside the form
        // element.
        let submittedByForm = await this.submitFormOwning(updatedSelector);

        if (!submittedByForm) {
          const submitButton = await findByCssOrText(this.page, {
            css: ['button[type="submit"]', 'input[type="submit"]'],
            texts: ['speichern', 'aktualisieren', 'übernehmen', 'save'],
            timeout: 5000
          });

          if (!submitButton) {
            // Previously swallowed as "the form might auto-save", which reported a
            // successful profile push whether or not anything had been submitted.
            throw new PlatformChangedError('Profile form has no submit control', { platform: 'wanted' });
          }

          await submitButton.click();
          await submitButton.dispose().catch(() => {});
          submittedByForm = true;
        }
        // Some forms save without navigating; a timeout here is not a failure.
        await this.page
          .waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
          .catch(() => {});

        this.log('info', 'Updated profile on Wanted', {
          updatedFields,
          missingFields
        });

        return {
          success: true,
          updatedFields,
          missingFields,
          submitted: true,
          details: { updatedFields, missingFields, submitted: true }
        };
      });
    });
  }

  /**
   * Format date for input field (DD.MM.YYYY for German platforms)
   * @param {Date|string} date
   * @returns {string}
   */
  formatDateForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    // German date format: DD.MM.YYYY
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

export default WantedConnector;
