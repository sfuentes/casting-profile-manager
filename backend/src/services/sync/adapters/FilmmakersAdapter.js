import puppeteer from 'puppeteer';
import { BasePlatformAdapter } from '../BasePlatformAdapter.js';

/**
 * Filmmakers Platform Adapter
 * Platform ID: 1
 * Type: Web scraping-based integration (no official API)
 * Features: Profile, Photos, Networking
 * Regions: EU, Global
 */
export class FilmmakersAdapter extends BasePlatformAdapter {
  constructor(platform, credentials) {
    super(platform, credentials);

    this.baseUrl = 'https://www.filmmakers.eu';
    this.browser = null;
    this.page = null;
    this.isAuthenticated = false;
  }

  /**
   * Initialize rate limiter with conservative limits for web scraping
   * Be respectful to the platform
   */
  initRateLimiter() {
    return new (require('rate-limiter-flexible').RateLimiterMemory)({
      points: 10, // Only 10 requests
      duration: 60, // Per minute
    });
  }

  /**
   * Authenticate with Filmmakers platform via web scraping
   * @returns {Promise<boolean>}
   */
  async authenticate() {
    try {
      this.log('info', 'Authenticating with Filmmakers via web automation');

      if (!this.credentials || !this.credentials.email || !this.credentials.password) {
        throw new Error('Missing Filmmakers credentials (email/password required)');
      }

      // Launch browser
      this.browser = await puppeteer.launch({
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

      // Set user agent to avoid bot detection
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Navigate to login page
      await this.page.goto(`${this.baseUrl}/login`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      this.log('info', 'Loaded login page, entering credentials');

      // Fill in login form
      await this.page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });
      await this.page.type('input[name="email"], input[type="email"]', this.credentials.email);
      await this.page.type('input[name="password"], input[type="password"]', this.credentials.password);

      // Submit form
      await Promise.all([
        this.page.click('button[type="submit"], input[type="submit"]'),
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
      ]);

      // Check if login was successful
      const currentUrl = this.page.url();
      if (currentUrl.includes('/login')) {
        throw new Error('Login failed - still on login page');
      }

      this.isAuthenticated = true;
      this.log('info', 'Successfully authenticated with Filmmakers');

      return true;

    } catch (error) {
      this.log('error', 'Filmmakers authentication failed', {
        error: error.message
      });

      // Clean up browser
      await this.cleanup();

      throw new Error(`Filmmakers authentication failed: ${error.message}`);
    }
  }

  /**
   * Push availability data to Filmmakers
   * @param {Array} availability
   * @returns {Promise<Object>}
   */
  async pushAvailability(availability) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', `Pushing ${availability.length} availability items to Filmmakers`);

        if (!this.isAuthenticated || !this.page) {
          throw new Error('Not authenticated. Call authenticate() first.');
        }

        // Navigate to availability management page
        await this.page.goto(`${this.baseUrl}/profile/availability`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        let successCount = 0;

        // Process each availability item
        for (const item of availability) {
          try {
            // Look for "Add Availability" button or similar
            await this.page.waitForSelector('[data-action="add-availability"], .add-availability-btn, button:contains("Add")', {
              timeout: 5000
            });

            await this.page.click('[data-action="add-availability"], .add-availability-btn');

            // Wait for form to appear
            await this.page.waitForSelector('input[name="start_date"], input[name="from"]', {
              timeout: 5000
            });

            // Fill availability form
            await this.fillAvailabilityForm(item);

            // Submit form
            await this.page.click('button[type="submit"]');

            // Wait for submission to complete
            await this.delay(1000);

            successCount++;

          } catch (itemError) {
            this.log('warn', 'Failed to add availability item', {
              item,
              error: itemError.message
            });
          }
        }

        this.log('info', `Successfully pushed ${successCount}/${availability.length} availability items to Filmmakers`);

        return {
          success: true,
          count: successCount,
          total: availability.length,
          externalIds: [] // Filmmakers doesn't return IDs via scraping
        };
      });
    });
  }

  /**
   * Fill availability form fields
   * @param {Object} item
   */
  async fillAvailabilityForm(item) {
    // Start date
    const startDate = this.formatDateForInput(item.startDate);
    await this.page.evaluate((selector, value) => {
      const input = document.querySelector(selector);
      if (input) input.value = value;
    }, 'input[name="start_date"], input[name="from"]', startDate);

    // End date
    const endDate = this.formatDateForInput(item.endDate);
    await this.page.evaluate((selector, value) => {
      const input = document.querySelector(selector);
      if (input) input.value = value;
    }, 'input[name="end_date"], input[name="to"]', endDate);

    // Status/Type (if available)
    if (item.status) {
      try {
        await this.page.select('select[name="status"], select[name="type"]', item.status);
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
   * Push media (photos) to Filmmakers
   * @param {Object} media
   * @returns {Promise<Object>}
   */
  async pushMedia(media) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', 'Uploading media to Filmmakers', {
          type: media.type,
          filename: media.filename
        });

        if (!this.isAuthenticated || !this.page) {
          throw new Error('Not authenticated. Call authenticate() first.');
        }

        // Navigate to media upload page
        await this.page.goto(`${this.baseUrl}/profile/photos`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Find file upload input
        const uploadInput = await this.page.$('input[type="file"]');
        if (!uploadInput) {
          throw new Error('Could not find file upload input');
        }

        // Save media buffer to temporary file
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');

        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, media.filename);
        await fs.writeFile(tempFilePath, media.buffer);

        try {
          // Upload file
          await uploadInput.uploadFile(tempFilePath);

          // Wait for upload to complete
          await this.page.waitForSelector('.upload-success, .photo-uploaded', {
            timeout: 60000
          });

          this.log('info', 'Successfully uploaded media to Filmmakers');

          return {
            success: true,
            externalId: null, // Can't get ID via scraping
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
   * Update profile information on Filmmakers
   * @param {Object} profile
   * @returns {Promise<Object>}
   */
  async updateProfile(profile) {
    return this.withRateLimit(async () => {
      return this.withRetry(async () => {
        this.log('info', 'Updating profile on Filmmakers');

        if (!this.isAuthenticated || !this.page) {
          throw new Error('Not authenticated. Call authenticate() first.');
        }

        // Navigate to profile edit page
        await this.page.goto(`${this.baseUrl}/profile/edit`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        const updatedFields = [];

        // Update biography
        if (profile.biography) {
          try {
            await this.page.waitForSelector('textarea[name="biography"], textarea[name="bio"]', {
              timeout: 5000
            });
            await this.page.evaluate((selector) => {
              const textarea = document.querySelector(selector);
              if (textarea) textarea.value = '';
            }, 'textarea[name="biography"], textarea[name="bio"]');
            await this.page.type('textarea[name="biography"], textarea[name="bio"]', profile.biography);
            updatedFields.push('biography');
          } catch (e) {
            this.log('warn', 'Could not update biography field');
          }
        }

        // Update physical attributes
        if (profile.height) {
          try {
            await this.updateInputField('input[name="height"]', profile.height);
            updatedFields.push('height');
          } catch (e) {
            // Field might not exist
          }
        }

        if (profile.eyeColor) {
          try {
            await this.updateSelectField('select[name="eye_color"]', profile.eyeColor);
            updatedFields.push('eyeColor');
          } catch (e) {
            // Field might not exist
          }
        }

        if (profile.hairColor) {
          try {
            await this.updateSelectField('select[name="hair_color"]', profile.hairColor);
            updatedFields.push('hairColor');
          } catch (e) {
            // Field might not exist
          }
        }

        // Submit form
        try {
          await this.page.click('button[type="submit"], input[type="submit"]');
          await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
        } catch (e) {
          // Form might auto-save
        }

        this.log('info', 'Successfully updated profile on Filmmakers', {
          updatedFields
        });

        return {
          success: true,
          updatedFields
        };
      });
    });
  }

  /**
   * Update input field value
   * @param {string} selector
   * @param {string} value
   */
  async updateInputField(selector, value) {
    const element = await this.page.$(selector);
    if (element) {
      await this.page.evaluate((sel) => {
        const input = document.querySelector(sel);
        if (input) input.value = '';
      }, selector);
      await this.page.type(selector, String(value));
    }
  }

  /**
   * Update select field value
   * @param {string} selector
   * @param {string} value
   */
  async updateSelectField(selector, value) {
    const element = await this.page.$(selector);
    if (element) {
      await this.page.select(selector, value);
    }
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
   * Override to ensure cleanup on errors
   */
  async withRetry(fn, maxRetries = 3) {
    try {
      return await super.withRetry(fn, maxRetries);
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }
}

export default FilmmakersAdapter;
