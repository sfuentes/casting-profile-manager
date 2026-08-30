import { BrowserConnector } from './BrowserConnector.js';
import { clickByCssOrText } from './selectors.js';
import { PlatformChangedError } from './errors.js';

/**
 * Casting Network Platform Adapter
 * Platform ID: 2
 * Type: Web scraping-based integration (no official public API)
 * Features: Profile, Photos, Submissions, Availability
 * Regions: US, CA, UK
 */
export class CastingNetworkConnector extends BrowserConnector {
  static manifest = Object.freeze({
    id: 2,
    key: 'casting-network',
    name: 'Casting Network',
    authType: 'credentials',
    credentialFields: [{ name: 'email', type: 'email', required: true, label: 'E-Mail' },
      { name: 'password', type: 'password', required: true, label: 'Passwort' }],
    capabilities: ['verify', 'pushProfile', 'pushAvailability', 'pushMedia']
  });

  /**
   * Verified against the live login page on 2026-08-30 (URL supplied by the
   * project owner).
   *
   * The login is not on home.castingnetworks.com - that host redirects to the
   * marketing site. It lives in the app at app.castingnetworks.com/login/,
   * which is a single-page app: its form is not in the delivered HTML and only
   * exists once the bundle has run. The account field is `email` but carries
   * type="text", so a type-based selector alone would miss it.
   */
  static site = Object.freeze({
    baseUrl: 'https://app.castingnetworks.com',
    loginPath: '/login/',
    login: {
      user: 'input[name="email"], input[id="email"]',
      password: 'input[name="password"], input[type="password"]',
      submitTexts: ['log in', 'login', 'sign in']
    },
    paths: {
      // NOT verified: reaching these needs an account, and nobody has logged
      // in. They are the paths the connector was originally written with.
      profileEdit: '/talent/profile/edit',
      availability: '/talent/schedule',
      media: '/talent/photos'
    },
    // NOT verified either - see above.
    profileFields: [
      { field: 'biography', selector: 'textarea[name="biography"], textarea[name="about"]', kind: 'text', wait: true },
      { field: 'height', selector: 'input[name="height"]', kind: 'text' },
      { field: 'weight', selector: 'input[name="weight"]', kind: 'text' },
      { field: 'eyeColor', selector: 'select[name="eye_color"]', kind: 'select' },
      { field: 'hairColor', selector: 'select[name="hair_color"]', kind: 'select' }
    ]
  });
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

}

export default CastingNetworkConnector;
