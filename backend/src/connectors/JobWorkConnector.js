import { BrowserConnector } from './BrowserConnector.js';
import { findByCssOrText } from './selectors.js';
import { PlatformChangedError } from './errors.js';

/**
 * JobWork Platform Adapter
 * Platform ID: 5
 * Type: Web scraping (no public API available)
 * Features: Profile, Jobs, Networking
 * Regions: DE, AT, CH
 */
export class JobWorkConnector extends BrowserConnector {
  static manifest = Object.freeze({
    id: 5,
    key: 'jobwork',
    name: 'JobWork',
    authType: 'credentials',
    credentialFields: [{ name: 'email', type: 'email', required: true, label: 'E-Mail' },
      { name: 'password', type: 'password', required: true, label: 'Passwort' }],
    capabilities: ['verify', 'pushProfile', 'pushAvailability', 'pushMedia']
  });

  /**
   * Verified against the live site on 2026-08-30.
   *
   * The platform runs on jobwork.COM. jobwork.de only redirects, over plain
   * HTTP, and presents no usable certificate, so the previous
   * https://www.jobwork.de failed at the TLS handshake before any page loaded.
   * The account field is `identifier` with type="text" - the older email and
   * username names matched nothing and stay only as fallbacks. The form's own
   * button[type="submit"] is hidden; the visible control is "Weiter".
   */
  static site = Object.freeze({
    baseUrl: 'https://www.jobwork.com',
    loginPath: '/de/login',
    login: {
      user: 'input[name="identifier"], input[type="email"], input[name="email"], input[name="username"]',
      password: 'input[type="password"], input[name="password"]',
      submitTexts: ['weiter', 'anmelden', 'einloggen', 'login', 'sign in']
    },
    paths: {
      // NOT verified: reaching these needs an account, and nobody has logged in.
      profileEdit: '/profil/bearbeiten',
      availability: '/profil/verfuegbarkeit',
      media: '/profil/bilder'
    },
    // NOT verified either - see above. Left as they were found.
    profileFields: [
      { field: 'biography', selector: 'textarea[name="biography"], textarea[name="biografie"], textarea[name="ueber_mich"]', kind: 'text' },
      { field: 'height', selector: 'input[name="height"], input[name="groesse"]', kind: 'text' },
      { field: 'eyeColor', selector: 'select[name="eye_color"], select[name="augenfarbe"]', kind: 'select' },
      { field: 'hairColor', selector: 'select[name="hair_color"], select[name="haarfarbe"]', kind: 'select' }
    ]
  });
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

}

export default JobWorkConnector;
