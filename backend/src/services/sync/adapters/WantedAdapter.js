import puppeteer from 'puppeteer';
import { BasePlatformAdapter } from '../BasePlatformAdapter.js';

/**
 * Wanted Platform Adapter
 * Platform ID: 9
 * Type: Web scraping (no public API)
 * Features: Profile, Jobs, Availability
 * Regions: DE, AT, CH
 */
export class WantedAdapter extends BasePlatformAdapter {
  constructor(platform, credentials) {
    super(platform, credentials);

    this.baseUrl = 'https://www.wanted.de';
    this.browser = null;
    this.page = null;
    this.isAuthenticated = false;
  }

  /**
   * Initialize rate limiter with conservative limits
   */
  initRateLimiter() {
    return new (require('rate-limiter-flexible').RateLimiterMemory)({
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
        throw new Error('Missing Wanted credentials (email/password required)');
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

      // Fill in login form (German platform)
      await this.page.waitForSelector('input[type="email"], input[name="email"], input[name="benutzername"]', { timeout: 10000 });
      await this.page.type('input[type="email"], input[name="email"], input[name="benutzername"]', this.credentials.email);
      await this.page.type('input[type="password"], input[name="password"], input[name="passwort"]', this.credentials.password);

      // Submit form
      await Promise.all([
        this.page.click('button[type="submit"], input[type="submit"], .login-button'),
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
      ]);

      // Check if login was successful
      const currentUrl = this.page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/anmelden')) {
        throw new Error('Login failed - still on login page');
      }

      this.isAuthenticated = true;
      this.log('info', 'Successfully authenticated with Wanted');

      return true;

    } catch (error) {
      this.log('error', 'Wanted authentication failed', {
        error: error.message
      });

      await this.cleanup();
      throw new Error(`Wanted authentication failed: ${error.message}`);
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

        // Process each availability item
        for (const item of availability) {
          try {
            // Look for add button (German: Hinzufügen/Neu)
            const addButton = await this.page.$('[data-action="add"], .add-availability, button:contains("Hinzufügen"), button:contains("Neu")');

            if (addButton) {
              await addButton.click();
              await this.delay(500);

              // Fill form
              await this.fillAvailabilityForm(item);

              // Submit
              const submitButton = await this.page.$('button[type="submit"], input[type="submit"], button:contains("Speichern")');
              if (submitButton) {
                await submitButton.click();
                await this.delay(1000);
                successCount++;
              }
            }

          } catch (itemError) {
            this.log('warn', 'Failed to add availability item', {
              item,
              error: itemError.message
            });
          }
        }

        this.log('info', `Successfully pushed ${successCount}/${availability.length} availability items to Wanted`);

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

        const updatedFields = [];

        // Biography (Biografie/Über mich)
        if (profile.biography) {
          try {
            const bioTextarea = await this.page.$('textarea[name="biography"], textarea[name="biografie"], textarea[name="ueber_mich"]');
            if (bioTextarea) {
              await this.page.evaluate(el => { el.value = ''; }, bioTextarea);
              await bioTextarea.type(profile.biography);
              updatedFields.push('biography');
            }
          } catch (e) {
            this.log('warn', 'Could not update biography');
          }
        }

        // Physical attributes (German labels)
        if (profile.height) {
          try {
            const heightInput = await this.page.$('input[name="height"], input[name="groesse"], input[name="koerpergroesse"]');
            if (heightInput) {
              await this.page.evaluate(el => { el.value = ''; }, heightInput);
              await heightInput.type(profile.height);
              updatedFields.push('height');
            }
          } catch (e) {
            // Field might not exist
          }
        }

        if (profile.eyeColor) {
          try {
            const eyeColorSelect = await this.page.$('select[name="eye_color"], select[name="augenfarbe"]');
            if (eyeColorSelect) {
              await this.page.select('select[name="eye_color"], select[name="augenfarbe"]', profile.eyeColor.toLowerCase());
              updatedFields.push('eyeColor');
            }
          } catch (e) {
            // Field might not exist
          }
        }

        if (profile.hairColor) {
          try {
            const hairColorSelect = await this.page.$('select[name="hair_color"], select[name="haarfarbe"]');
            if (hairColorSelect) {
              await this.page.select('select[name="hair_color"], select[name="haarfarbe"]', profile.hairColor.toLowerCase());
              updatedFields.push('hairColor');
            }
          } catch (e) {
            // Field might not exist
          }
        }

        // Submit (German: Speichern/Aktualisieren)
        try {
          const submitButton = await this.page.$('button[type="submit"], input[type="submit"], button:contains("Speichern")');
          if (submitButton) {
            await submitButton.click();
            await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
          }
        } catch (e) {
          // Form might auto-save
        }

        this.log('info', 'Successfully updated profile on Wanted', {
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

export default WantedAdapter;
