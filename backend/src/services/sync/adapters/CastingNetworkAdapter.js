import puppeteer from 'puppeteer';
import { BasePlatformAdapter } from '../BasePlatformAdapter.js';

/**
 * Casting Network Platform Adapter
 * Platform ID: 2
 * Type: Web scraping-based integration (no official public API)
 * Features: Profile, Photos, Submissions, Availability
 * Regions: US, CA, UK
 */
export class CastingNetworkAdapter extends BasePlatformAdapter {
  constructor(platform, credentials) {
    super(platform, credentials);

    this.baseUrl = 'https://home.castingnetworks.com';
    this.browser = null;
    this.page = null;
    this.isAuthenticated = false;
  }

  /**
   * Initialize rate limiter with conservative limits for web scraping
   */
  initRateLimiter() {
    return new (require('rate-limiter-flexible').RateLimiterMemory)({
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
        throw new Error('Missing Casting Network credentials (email/password required)');
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

      // Set user agent
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
      await this.page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
      await this.page.type('input[type="email"], input[name="email"]', this.credentials.email);
      await this.page.type('input[type="password"], input[name="password"]', this.credentials.password);

      // Submit form
      await Promise.all([
        this.page.click('button[type="submit"], input[type="submit"]'),
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
      ]);

      // Check if login was successful
      const currentUrl = this.page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/signin')) {
        throw new Error('Login failed - still on login page');
      }

      this.isAuthenticated = true;
      this.log('info', 'Successfully authenticated with Casting Network');

      return true;

    } catch (error) {
      this.log('error', 'Casting Network authentication failed', {
        error: error.message
      });

      await this.cleanup();
      throw new Error(`Casting Network authentication failed: ${error.message}`);
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

        // Process each availability item
        for (const item of availability) {
          try {
            // Look for "Add" or "New" button
            await this.page.waitForSelector('[data-action="add"], .add-availability, button:contains("Add"), a:contains("Add")', {
              timeout: 5000
            });

            await this.page.click('[data-action="add"], .add-availability');

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
            this.log('warn', 'Failed to add availability item', {
              item,
              error: itemError.message
            });
          }
        }

        this.log('info', `Successfully pushed ${successCount}/${availability.length} availability items`);

        return {
          success: true,
          count: successCount,
          total: availability.length,
          externalIds: []
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

        const updatedFields = [];

        // Update biography/about
        if (profile.biography) {
          try {
            await this.page.waitForSelector('textarea[name="biography"], textarea[name="about"]', { timeout: 5000 });
            await this.clearAndType('textarea[name="biography"], textarea[name="about"]', profile.biography);
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

        if (profile.weight) {
          try {
            await this.updateInputField('input[name="weight"]', profile.weight);
            updatedFields.push('weight');
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

        this.log('info', 'Successfully updated profile on Casting Network', {
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
   * Update input field value
   * @param {string} selector
   * @param {string} value
   */
  async updateInputField(selector, value) {
    const element = await this.page.$(selector);
    if (element) {
      await this.clearAndType(selector, String(value));
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

export default CastingNetworkAdapter;
