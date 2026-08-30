import { BrowserConnector } from './BrowserConnector.js';
import { findByCssOrText } from './selectors.js';
import { PlatformChangedError } from './errors.js';

/**
 * Wanted Platform Adapter
 * Platform ID: 9
 * Type: Web scraping (no public API)
 * Features: Profile, Jobs, Availability
 * Regions: DE, AT, CH
 */
export class WantedConnector extends BrowserConnector {
  static manifest = Object.freeze({
    id: 9,
    key: 'wanted',
    name: 'Wanted',
    authType: 'credentials',
    credentialFields: [{ name: 'username', type: 'text', required: true, label: 'Benutzername' },
      { name: 'password', type: 'password', required: true, label: 'Passwort' }],
    capabilities: ['verify', 'pushProfile', 'pushAvailability', 'pushMedia']
  });

  /**
   * Verified against the live login page on 2026-08-30 (URL supplied by the
   * project owner).
   *
   * The host is not wanted.de - that name does not resolve at all. The agency
   * runs on online.agentur-wanted.de, on the same "online casting solutions"
   * platform as Sarah Weiß Casting: identical field names, identical form
   * action. The account field is a user name, not an email address.
   *
   * `hint` is a third text field in the same form and is left alone: on this
   * kind of form it is usually a honeypot, and filling it is how a bot
   * announces itself.
   */
  static site = Object.freeze({
    baseUrl: 'https://online.agentur-wanted.de',
    loginPath: '/de/login/actor',
    login: {
      user: 'input[name="username"]',
      password: 'input[name="password"], input[type="password"]',
      submitTexts: ['anmelden', 'login', 'einloggen']
    },
    paths: {
      // NOT verified: reaching these needs an account, and nobody has logged
      // in. They are the paths the connector was originally written with.
   * NOT verified, and the host is doubtful: www.wanted.de does not resolve
   * from here (ERR_NAME_NOT_RESOLVED), so no page of this platform has ever
   * been loaded. Everything below is what the connector was originally written
   * with. The domain needs confirming before any of it can be trusted.
   */
  static site = Object.freeze({
    baseUrl: 'https://www.wanted.de',
    loginPath: '/login',
    login: {
      user: 'input[type="email"], input[name="email"], input[name="benutzername"]',
      password: 'input[type="password"], input[name="password"], input[name="passwort"]',
      submitTexts: ['anmelden', 'einloggen', 'login'],
      failureUrls: ['/anmelden']
    },
    paths: {
      profileEdit: '/profil/bearbeiten',
      availability: '/profil/verfuegbarkeit',
      media: '/profil/fotos'
    },
    // NOT verified either - see above.
    profileFields: [
      { field: 'biography', selector: 'textarea[name="biography"], textarea[name="biografie"], textarea[name="ueber_mich"]', kind: 'text' },
      { field: 'height', selector: 'input[name="height"], input[name="groesse"], input[name="koerpergroesse"]', kind: 'text' },
      { field: 'eyeColor', selector: 'select[name="eye_color"], select[name="augenfarbe"]', kind: 'select' },
      { field: 'hairColor', selector: 'select[name="hair_color"], select[name="haarfarbe"]', kind: 'select' }
    ]
  });
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

}

export default WantedConnector;
