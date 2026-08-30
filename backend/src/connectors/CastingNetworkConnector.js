import puppeteer from 'puppeteer';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { PlatformConnector } from './PlatformConnector.js';
import { clickByCssOrText, findByCssOrText } from './selectors.js';
import { AuthError, PlatformChangedError } from './errors.js';

/**
 * Casting Network Platform Adapter
 * Platform ID: 2
 * Type: Web scraping-based integration (no official public API)
 * Features: Profile, Photos, Submissions, Availability
 * Regions: US, CA, UK
 */
export class CastingNetworkConnector extends PlatformConnector {
  static manifest = Object.freeze({
    id: 2,
    key: 'casting-network',
    name: 'Casting Network',
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

    this.baseUrl = 'https://home.castingnetworks.com';
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
   * Initialize rate limiter with conservative limits for web scraping
   */
  initRateLimiter() {
    return new RateLimiterMemory({
      points: 10, // Only 10 requests
      duration: 60, // Per minute
    });
  }

  /**
   * Authenticate with Casting Network platform
   * @returns {Promise<boolean>}
   */
  async authenticate() {
    try {
      this.log('info', 'Authenticating with Casting Network via web automation');

      if (!this.credentials || !this.credentials.email || !this.credentials.password) {
        throw new AuthError('Missing Casting Network credentials (email/password required)', {
          platform: 'casting-network'
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

      // Fill in login form
      await this.page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
      await this.page.type('input[type="email"], input[name="email"]', this.credentials.email);
      await this.page.type('input[type="password"], input[name="password"]', this.credentials.password);

      // Submit the login form itself, not the first submit control on the page:
      // a page-wide selector can hit an unrelated form in the header (on
      // Filmmakers it matched 36 language-switcher buttons).
      const submitted = await this.submitFormOwning('input[type="password"], input[name="password"]');
      if (!submitted) {
        throw new PlatformChangedError(
          'The login form has no submit control',
          { platform: 'casting-network' }
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
          { platform: 'casting-network' }
        );
      }

      this.isAuthenticated = true;
      this.log('info', 'Successfully authenticated with Casting Network');

      return true;

    } catch (error) {
      const failure = this.classifyFailure(error);
      this.log('error', 'Casting Network authentication failed', {
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
   * Push availability data to Casting Network
   * @param {Array} availability
   * @returns {Promise<Object>}
   */
  async pushAvailability(availability) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', `Pushing ${availability.length} availability items to Casting Network`);

        if (!this.isAuthenticated || !this.page) {
          throw new Error('Not authenticated. Call authenticate() first.');
        }

        // Navigate to availability page
        await this.page.goto(`${this.baseUrl}/talent/schedule`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        let successCount = 0;
        let firstItemError = null;

        // Process each availability item
        for (const item of availability) {
          try {
            // Structural selectors first, then the label. `button:contains("Add")`
            // was jQuery syntax and invalidated the entire selector string.
            const added = await clickByCssOrText(this.page, {
              css: ['[data-action="add"]', '.add-availability'],
              texts: ['add availability', 'add new', 'add', 'new'],
              timeout: 5000
            });

            if (!added) {
              throw new PlatformChangedError('No "add availability" control found on the availability page', {
                platform: 'casting-network'
              });
            }

            // Wait for form
            await this.page.waitForSelector('input[name="start_date"], input[name="from_date"]', {
              timeout: 5000
            });

            // Fill availability form
            await this.fillAvailabilityForm(item);

            // Submit
            await this.page.click('button[type="submit"], input[type="submit"]');
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
            'No availability item could be added on Casting Network',
            { platform: 'casting-network' }
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
    await this.page.evaluate((selector, value) => {
      const input = document.querySelector(selector);
      if (input) input.value = value;
    }, 'input[name="start_date"], input[name="from_date"]', startDate);

    // End date
    await this.page.evaluate((selector, value) => {
      const input = document.querySelector(selector);
      if (input) input.value = value;
    }, 'input[name="end_date"], input[name="to_date"]', endDate);

    // Status
    if (item.status) {
      try {
        const statusMap = {
          'available': 'available',
          'unavailable': 'unavailable',
          'booking': 'booked',
          'option': 'option'
        };
        const mappedStatus = statusMap[item.status] || item.status;
        await this.page.select('select[name="status"], select[name="availability_type"]', mappedStatus);
      } catch (e) {
        // Status field might not exist
      }
    }

    // Notes
    if (item.notes) {
      try {
        await this.page.type('textarea[name="notes"], textarea[name="description"]', item.notes);
      } catch (e) {
        // Notes field might not exist
      }
    }
  }

  /**
   * Push media (photos) to Casting Network
   * @param {Object} media
   * @returns {Promise<Object>}
   */
  async pushMedia(media) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', 'Uploading media to Casting Network', {
          type: media.type,
          filename: media.filename
        });

        if (!this.isAuthenticated || !this.page) {
          throw new Error('Not authenticated. Call authenticate() first.');
        }

        // Navigate to media upload page
        await this.page.goto(`${this.baseUrl}/talent/photos`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Find file upload input
        const uploadInput = await this.page.$('input[type="file"]');
        if (!uploadInput) {
          throw new Error('Could not find file upload input');
        }

        // Save media to temp file
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');

        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, media.filename);
        await fs.writeFile(tempFilePath, media.buffer);

        try {
          // Upload file
          await uploadInput.uploadFile(tempFilePath);

          // Wait for upload confirmation
          await this.page.waitForSelector('.upload-success, .photo-uploaded, .success-message', {
            timeout: 60000
          });

          this.log('info', 'Successfully uploaded media to Casting Network');

          return {
            success: true,
            externalId: null,
            url: null
          };

        } finally {
          // Clean up temp file
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
   * Update profile information on Casting Network
   * @param {Object} profile
   * @returns {Promise<Object>}
   */
  async updateProfile(profile) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', 'Updating profile on Casting Network');

        if (!this.isAuthenticated || !this.page) {
          throw new Error('Not authenticated. Call authenticate() first.');
        }

        // Navigate to profile edit page
        await this.page.goto(`${this.baseUrl}/talent/profile/edit`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // What we were asked to write, what landed, and what was not found.
        // A field whose input is missing must never appear in updatedFields.
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

        // Update biography/about
        if (profile.biography) {
          await applyField('biography', 'textarea[name="biography"], textarea[name="about"]', async () => {
            try {
              await this.page.waitForSelector('textarea[name="biography"], textarea[name="about"]', { timeout: 5000 });
            } catch {
              return false;
            }
            await this.clearAndType('textarea[name="biography"], textarea[name="about"]', profile.biography);
            return true;
          });
        }

        // Update physical attributes
        if (profile.height) {
          await applyField('height', 'input[name="height"]', () => this.updateInputField('input[name="height"]', profile.height));
        }

        if (profile.weight) {
          await applyField('weight', 'input[name="weight"]', () => this.updateInputField('input[name="weight"]', profile.weight));
        }

        if (profile.eyeColor) {
          await applyField('eyeColor', 'select[name="eye_color"]', () => this.updateSelectField('select[name="eye_color"]', profile.eyeColor));
        }

        if (profile.hairColor) {
          await applyField('hairColor', 'select[name="hair_color"]', () => this.updateSelectField('select[name="hair_color"]', profile.hairColor));
        }

        // Submit form. Only worth attempting if something was actually filled.
        let submitted = false;
        if (updatedFields.length > 0) {
          // The form that owns an edited field, never a page-wide submit
          // selector: that can hit an unrelated form elsewhere on the page.
          submitted = await this.submitFormOwning(updatedSelector);
          if (!submitted) {
            throw new PlatformChangedError(
              'Filled the profile form but found no submit control in it, so nothing was saved',
              { platform: 'casting-network' }
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
            'No profile field was found on the Casting Network edit page '
            + `(looked for: ${requestedFields.join(', ')})`,
            { platform: 'casting-network' }
          );
        }

        this.log('info', 'Updated profile on Casting Network', {
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
   * Clear and type into a field
   * @param {string} selector
   * @param {string} value
   */
  async clearAndType(selector, value) {
    await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.value = '';
    }, selector);
    await this.page.type(selector, value);
  }

  /**
   * Update input field value.
   * @returns {Promise<boolean>} false when the field is not on the page - the
   *   caller must not count that as an update.
   */
  async updateInputField(selector, value) {
    const element = await this.page.$(selector);
    if (!element) return false;

    await this.clearAndType(selector, String(value));
    return true;
  }

  /**
   * Update select field value.
   * @returns {Promise<boolean>} false when the field is not on the page.
   */
  async updateSelectField(selector, value) {
    const element = await this.page.$(selector);
    if (!element) return false;

    await this.page.select(selector, value);
    return true;
  }

  /**
   * Format date for input field (YYYY-MM-DD)
   * @param {Date|string} date
   * @returns {string}
   */
  formatDateForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
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

export default CastingNetworkConnector;
