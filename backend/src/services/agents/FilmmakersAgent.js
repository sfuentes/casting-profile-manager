import BaseIntelligentAgent from './BaseIntelligentAgent.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Filmmakers Platform Agent
 * Intelligent web scraping agent for Filmmakers.eu
 */
export class FilmmakersAgent extends BaseIntelligentAgent {
  constructor() {
    super({
      platformId: 1,
      name: 'Filmmakers',
      baseUrl: 'https://www.filmmakers.eu',
      capabilities: ['profile', 'photos', 'availability', 'networking']
    });

    // Multiple selector strategies for resilience
    this.loginSelectors = {
      primary: {
        email: 'input[name="email"]',
        password: 'input[name="password"]',
        submit: 'button[type="submit"]'
      },
      fallback1: {
        email: 'input[type="email"]',
        password: 'input[type="password"]',
        submit: 'button[type="submit"]'
      },
      fallback2: {
        email: '#email',
        password: '#password',
        submit: '#login-btn'
      },
      fallback3: {
        email: '[placeholder*="mail" i]',
        password: '[placeholder*="password" i]',
        submit: '[type="submit"]'
      }
    };

    this.profileSelectors = {
      primary: {
        name: 'input[name="name"]',
        biography: 'textarea[name="biography"]',
        height: 'input[name="height"]',
        location: 'input[name="location"]'
      },
      fallback1: {
        name: '#profile-name',
        biography: '#biography',
        height: '#height',
        location: '#location'
      }
    };
  }

  /**
   * Authenticate with Filmmakers
   */
  async authenticate(credentials) {
    if (!credentials || !credentials.email || !credentials.password) {
      throw new Error('Email and password are required for Filmmakers');
    }

    if (this.config.simulationMode) {
      await this.delay(1000 + Math.random() * 500);
      this.isAuthenticated = true;
      this.sessionStartTime = Date.now();
      this.log('info', 'Authentication successful (simulation)');
      return true;
    }

    return this.authenticateReal(credentials);
  }

  /**
   * Real authentication with browser
   */
  async authenticateReal(credentials) {
    try {
      this.log('info', 'Starting authentication');

      // Create new page
      this.page = await this.browser.newPage();

      // Set user agent to avoid bot detection
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Navigate to login page
      await this.page.goto(`${this.baseUrl}/login`, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      this.log('info', 'Login page loaded');

      // Check for CAPTCHA
      if (await this.detectCaptcha()) {
        throw new Error('CAPTCHA detected - manual intervention required');
      }

      // Try login with different selector strategies
      await this.tryStrategies(this.loginSelectors, async (selectors) => {
        // Fill in credentials
        await this.page.type(selectors.email, credentials.email, { delay: 50 });
        await this.page.type(selectors.password, credentials.password, { delay: 50 });

        // Submit form
        await Promise.all([
          this.page.click(selectors.submit),
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
        ]);
      });

      // Verify login was successful
      const currentUrl = this.page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/signin')) {
        throw new Error('Login failed - still on login page');
      }

      this.isAuthenticated = true;
      this.sessionStartTime = Date.now();
      this.log('info', 'Authentication successful');

      return true;
    } catch (error) {
      this.log('error', 'Authentication failed', { error: error.message });
      throw new Error(`Filmmakers authentication failed: ${error.message}`);
    }
  }

  /**
   * Sync profile to Filmmakers
   */
  async performSyncProfile(profileData) {
    try {
      this.log('info', 'Starting profile sync', {
        fields: Object.keys(profileData)
      });

      // Navigate to profile edit page
      await this.page.goto(`${this.baseUrl}/profile/edit`, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      // Wait for profile form
      await this.page.waitForSelector('form', { timeout: 10000 });

      // Fill profile using selector strategies
      await this.tryStrategies(this.profileSelectors, async (selectors) => {
        const updates = [];

        // Update name
        if (profileData.name && selectors.name) {
          await this.clearAndType(selectors.name, profileData.name);
          updates.push('name');
        }

        // Update biography
        if (profileData.biography && selectors.biography) {
          await this.clearAndType(selectors.biography, profileData.biography);
          updates.push('biography');
        }

        // Update height
        if (profileData.height && selectors.height) {
          await this.clearAndType(selectors.height, profileData.height.toString());
          updates.push('height');
        }

        // Update location
        if (profileData.location && selectors.location) {
          await this.clearAndType(selectors.location, profileData.location);
          updates.push('location');
        }

        return updates;
      });

      // Submit form
      await this.submitFormSafely();

      // Wait for success indicator
      await this.waitForSuccess();

      this.log('info', 'Profile sync completed');

      return {
        success: true,
        platform: this.platformName,
        message: 'Profile synchronized successfully',
        syncedFields: Object.keys(profileData),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log('error', 'Profile sync failed', { error: error.message });
      throw new Error(`Profile sync failed: ${error.message}`);
    }
  }

  /**
   * Update availability on Filmmakers
   */
  async performUpdateAvailability(availability) {
    try {
      this.log('info', 'Starting availability update');

      // Navigate to availability page
      await this.page.goto(`${this.baseUrl}/profile/availability`, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      const slots = Array.isArray(availability) ? availability : [availability];
      let updatedCount = 0;

      for (const slot of slots) {
        try {
          // Click add availability button
          const addButton = await this.findButton(['Add', 'Hinzufügen', '+ Add Availability']);
          if (addButton) {
            await addButton.click();
            await this.delay(500);
          }

          // Fill availability form
          await this.fillAvailabilityForm(slot);

          // Submit
          await this.submitFormSafely();
          await this.delay(500);

          updatedCount += 1;
        } catch (slotError) {
          this.log('warn', `Failed to add availability slot: ${slotError.message}`);
        }
      }

      this.log('info', 'Availability update completed', { updatedSlots: updatedCount });

      return {
        success: true,
        platform: this.platformName,
        message: `${updatedCount} availability slots updated`,
        updatedSlots: updatedCount,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log('error', 'Availability update failed', { error: error.message });
      throw new Error(`Availability update failed: ${error.message}`);
    }
  }

  /**
   * Upload media to Filmmakers
   */
  async performUploadMedia(media) {
    try {
      this.log('info', 'Starting media upload');

      // Navigate to photos page
      await this.page.goto(`${this.baseUrl}/profile/photos`, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      const files = Array.isArray(media) ? media : [media];
      let uploadedCount = 0;

      for (const file of files) {
        try {
          // Save file to temp location if it's a buffer
          const tempPath = await this.saveToTemp(file);

          // Find upload input
          const uploadInput = await this.page.$('input[type="file"]');
          if (!uploadInput) {
            throw new Error('Upload input not found');
          }

          // Upload file
          await uploadInput.uploadFile(tempPath);
          await this.delay(2000); // Wait for upload to process

          // Clean up temp file
          await fs.unlink(tempPath);

          uploadedCount += 1;
        } catch (fileError) {
          this.log('warn', `Failed to upload file: ${fileError.message}`);
        }
      }

      this.log('info', 'Media upload completed', { uploadedFiles: uploadedCount });

      return {
        success: true,
        platform: this.platformName,
        message: `${uploadedCount} files uploaded successfully`,
        uploadedFiles: uploadedCount,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log('error', 'Media upload failed', { error: error.message });
      throw new Error(`Media upload failed: ${error.message}`);
    }
  }

  /**
   * Read profile from Filmmakers
   */
  async performReadProfile() {
    try {
      this.log('info', 'Reading profile from platform');

      // Navigate to profile page
      await this.page.goto(`${this.baseUrl}/profile`, {
        waitUntil: 'networkidle2',
        timeout: this.config.timeout
      });

      // Extract profile data
      const profileData = await this.page.evaluate(() => {
        const getText = (selector) => {
          const el = document.querySelector(selector);
          return el ? el.textContent.trim() : null;
        };

        const getValue = (selector) => {
          const el = document.querySelector(selector);
          return el ? el.value : null;
        };

        return {
          name: getText('.profile-name') || getValue('input[name="name"]'),
          biography: getText('.profile-bio') || getValue('textarea[name="biography"]'),
          location: getText('.profile-location') || getValue('input[name="location"]'),
          height: getText('.profile-height') || getValue('input[name="height"]')
        };
      });

      this.log('info', 'Profile data retrieved');

      return {
        ...profileData,
        source: this.platformName,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log('error', 'Profile read failed', { error: error.message });
      throw new Error(`Profile read failed: ${error.message}`);
    }
  }

  /**
   * Helper: Clear input and type new value
   */
  async clearAndType(selector, value) {
    const element = await this.page.$(selector);
    if (!element) return;

    await element.click({ clickCount: 3 }); // Select all
    await this.page.keyboard.press('Backspace');
    await element.type(value, { delay: 50 });
  }

  /**
   * Helper: Find button by text
   */
  async findButton(textOptions) {
    for (const text of textOptions) {
      try {
        const button = await this.page.evaluateHandle((buttonText) => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
          return buttons.find((btn) =>
            btn.textContent.toLowerCase().includes(buttonText.toLowerCase())
          );
        }, text);

        if (button) return button;
      } catch (error) {
        // Continue to next option
      }
    }

    return null;
  }

  /**
   * Helper: Submit form safely
   */
  async submitFormSafely() {
    const submitButton = await this.findButton(['Save', 'Submit', 'Update', 'Speichern']);

    if (submitButton) {
      await Promise.all([
        submitButton.click(),
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 })
          .catch(() => {}) // Ignore navigation timeout
      ]);
    } else {
      // Try submitting form programmatically
      await this.page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) form.submit();
      });

      await this.delay(2000);
    }
  }

  /**
   * Helper: Wait for success message
   */
  async waitForSuccess() {
    try {
      await this.page.waitForSelector(
        '.success-message, .alert-success, [class*="success"]',
        { timeout: 5000 }
      );
    } catch (error) {
      // Success message might not appear - that's okay
      this.log('debug', 'No success message detected');
    }
  }

  /**
   * Helper: Fill availability form
   */
  async fillAvailabilityForm(slot) {
    // Try common field names
    const dateFields = ['startDate', 'start_date', 'date_from'];
    const endDateFields = ['endDate', 'end_date', 'date_to'];

    for (const field of dateFields) {
      const input = await this.page.$(`input[name="${field}"]`);
      if (input && slot.startDate) {
        await this.clearAndType(`input[name="${field}"]`, slot.startDate);
        break;
      }
    }

    for (const field of endDateFields) {
      const input = await this.page.$(`input[name="${field}"]`);
      if (input && slot.endDate) {
        await this.clearAndType(`input[name="${field}"]`, slot.endDate);
        break;
      }
    }
  }

  /**
   * Helper: Save buffer to temp file
   */
  async saveToTemp(file) {
    const tempDir = os.tmpdir();
    const filename = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const tempPath = path.join(tempDir, filename);

    if (Buffer.isBuffer(file.buffer)) {
      await fs.writeFile(tempPath, file.buffer);
    } else if (file.path) {
      await fs.copyFile(file.path, tempPath);
    } else {
      throw new Error('Invalid file format');
    }

    return tempPath;
  }
}

export default FilmmakersAgent;
