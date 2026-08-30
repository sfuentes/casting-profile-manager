import puppeteer from 'puppeteer';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { PlatformConnector } from './PlatformConnector.js';
import { clickByCssOrText, findByCssOrText } from './selectors.js';
import { AuthError, PlatformChangedError } from './errors.js';

/**
 * Filmmakers Platform Adapter
 * Platform ID: 1
 * Type: Web scraping-based integration (no official API)
 * Features: Profile, Photos, Networking
 * Regions: EU, Global
 */
export class FilmmakersConnector extends PlatformConnector {
  static manifest = Object.freeze({
    id: 1,
    key: 'filmmakers',
    name: 'Filmmakers',
    authType: 'credentials',
    credentialFields: [{ name: 'email', type: 'email', required: true, label: 'E-Mail' },
      { name: 'password', type: 'password', required: true, label: 'Passwort' }],
    capabilities: ['verify', 'pushProfile', 'pushAvailability', 'pushMedia', 'pullProfile']
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

  async pullProfile() {
    return this.readProfile();
  }

  async close() {
    if (typeof this.cleanup === 'function') await this.cleanup();
  }

  constructor(platform, credentials) {
    super(platform, credentials);

    this.baseUrl = 'https://www.filmmakers.eu';
    // Verified against the live site on 2026-08-30: `/login` answers 404 and
    // renders the site's not-found page, which has no login form at all. The
    // real form is Devise's, at /users/sign_in, with fields user[email] and
    // user[password] (both carry type=email / type=password, which is what the
    // selectors below match on).
    this.loginPath = '/users/sign_in';
    this.browser = null;
    this.page = null;
    this.isAuthenticated = false;
  }

  /**
   * Initialize rate limiter with conservative limits for web scraping
   * Be respectful to the platform
   */
  initRateLimiter() {
    return new RateLimiterMemory({
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
        throw new AuthError('Missing Filmmakers credentials (email/password required)', {
          platform: 'filmmakers'
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

      // Set user agent to avoid bot detection
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
      await this.page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });
      await this.page.type('input[name="email"], input[type="email"]', this.credentials.email);
      await this.page.type('input[name="password"], input[type="password"]', this.credentials.password);

      // Submit the login form itself. Not a page-wide submit selector: the
      // header holds a submit button per interface language, and the first one
      // in the DOM would switch the site to English instead of logging in.
      const submitted = await this.submitFormOwning('input[name="password"], input[type="password"]');
      if (!submitted) {
        throw new PlatformChangedError(
          'The login form has no submit control',
          { platform: 'filmmakers' }
        );
      }
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // Check if login was successful.
      //
      // Not `url.includes('/login')`: Devise re-renders /users/sign_in on a
      // rejected password, and that string does not contain "login" - so the
      // old check called every failed login a success. Compare against the URL
      // we actually navigated to, and treat a password field that is still on
      // the page as the same evidence.
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
          { platform: 'filmmakers' }
        );
      }

      this.isAuthenticated = true;
      this.log('info', 'Successfully authenticated with Filmmakers');

      return true;

    } catch (error) {
      const failure = this.classifyFailure(error);
      this.log('error', 'Filmmakers authentication failed', {
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
        let firstItemError = null;

        // Process each availability item
        for (const item of availability) {
          try {
            // Structural selectors first, button label as the fallback. The
            // label used to be written as `button:contains("Add")`, which is
            // jQuery and made the whole selector string invalid CSS.
            const added = await clickByCssOrText(this.page, {
              css: ['[data-action="add-availability"]', '.add-availability-btn'],
              texts: ['add availability', 'add', 'verfügbarkeit hinzufügen', 'hinzufügen', 'neu'],
              timeout: 5000
            });

            if (!added) {
              throw new PlatformChangedError('No "add availability" control found on the availability page', {
                platform: 'filmmakers'
              });
            }

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
            firstItemError = firstItemError || itemError;
            this.log('warn', 'Failed to add availability item', {
              item,
              error: itemError.message
            });
          }
        }

        // Every item failed. A per-item catch that keeps going is right for a
        // single bad date; it is wrong when nothing worked at all, because the
        // caller would log a successful sync of zero items.
        if (successCount === 0 && availability.length > 0) {
          throw firstItemError || new PlatformChangedError(
            'No availability item could be added on Filmmakers',
            { platform: 'filmmakers' }
          );
        }

        this.log('info', `Pushed ${successCount}/${availability.length} availability items to Filmmakers`);

        return {
          success: true,
          count: successCount,
          total: availability.length,
          externalIds: [], // Filmmakers doesn't return IDs via scraping
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

        // Three lists, not one: what we were asked to write, what actually
        // landed, and what could not be found. A field whose input is missing
        // must never appear in updatedFields - this method used to report
        // height, eyeColor and hairColor as updated on a page that contained
        // none of them, and the sync log recorded the whole run as a success.
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

        // Update biography
        if (profile.biography) {
          await applyField('biography', 'textarea[name="biography"], textarea[name="bio"]', async () => {
            try {
              await this.page.waitForSelector('textarea[name="biography"], textarea[name="bio"]', { timeout: 5000 });
            } catch {
              return false;
            }
            await this.page.evaluate((sel) => {
              const textarea = document.querySelector(sel);
              if (textarea) textarea.value = '';
            }, 'textarea[name="biography"], textarea[name="bio"]');
            await this.page.type('textarea[name="biography"], textarea[name="bio"]', profile.biography);
            return true;
          });
        }

        // Update physical attributes
        if (profile.height) {
          await applyField('height', 'input[name="height"]', () => this.updateInputField('input[name="height"]', profile.height));
        }

        if (profile.eyeColor) {
          await applyField('eyeColor', 'select[name="eye_color"]', () => this.updateSelectField('select[name="eye_color"]', profile.eyeColor));
        }

        if (profile.hairColor) {
          await applyField('hairColor', 'select[name="hair_color"]', () => this.updateSelectField('select[name="hair_color"]', profile.hairColor));
        }

        // Submit the form that owns an edited field. Only worth attempting if
        // something was actually filled - and never via a page-wide submit
        // selector, which on this site matches the header's language switcher.
        let submitted = false;
        if (updatedFields.length > 0) {
          submitted = await this.submitFormOwning(updatedSelector);
          if (!submitted) {
            throw new PlatformChangedError(
              'Filled the profile form but found no submit control in it, so nothing was saved',
              { platform: 'filmmakers' }
            );
          }
          // Some forms save without navigating; a timeout here is not a failure.
          await this.page
            .waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
            .catch(() => {});
        }

        // Nothing landed at all: this is not the page the connector was written
        // against. Returning success here is what let a rotted selector look
        // like a completed sync.
        if (requestedFields.length > 0 && updatedFields.length === 0) {
          throw new PlatformChangedError(
            'No profile field was found on the Filmmakers edit page '
            + `(looked for: ${requestedFields.join(', ')})`,
            { platform: 'filmmakers' }
          );
        }

        this.log('info', 'Updated profile on Filmmakers', {
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
   * Read the actor profile back off Filmmakers.
   *
   * Written against the live pages on 2026-08-30. The edit form is the source
   * rather than the public profile page: its values sit in server-rendered form
   * controls with stable names, while the public page builds its layout in the
   * browser and exposes no label/value markup worth matching on.
   *
   * The data is spread over three form sections plus the vita list:
   *
   *   /actors/<slug>/edit                                physique, languages,
   *                                                      skills, about me
   *   /actors/<slug>/edit?section=contact_settings       first/last name, phone
   *   /actors/<slug>/edit?section=personal_information   gender, date of birth
   *   /actors/<slug>/edit?section=vita_entries           credits and training
   *
   * @returns {Promise<{fields: object, sources: object, missing: string[]}>}
   *   `fields` uses this app's Profile vocabulary, never Filmmakers' own field
   *   names. `sources` says which page each value came from, so a wrong value
   *   can be traced without a second scraping run.
   */
  async readProfile() {
    return this.withRateLimit(() => this.withRetry(async () => {
      if (!this.isAuthenticated || !this.page) {
        throw new Error('Not authenticated. Call authenticate() first.');
      }

      const slug = await this.findProfileSlug();
      const editUrl = `${this.baseUrl}/actors/${slug}/edit`;

      const fields = {};
      const sources = {};
      const missing = [];
      const set = (key, value, source) => {
        const empty = value === null || value === undefined || value === ''
          || (Array.isArray(value) && value.length === 0);
        if (empty) {
          missing.push(key);
          return;
        }
        fields[key] = value;
        sources[key] = source;
      };

      // ---- profile information: physique, languages, skills, about me ----
      await this.openPage(editUrl);

      set('height', await this.readValue('#actor_profile_height'), 'edit');
      set('eyeColor', (await this.readSelected('#actor_profile_eye_color'))[0], 'edit');
      set('hairColor', (await this.readSelected('#actor_profile_hair_color'))[0], 'edit');
      set('citizenship', (await this.readSelected('#actor_profile_nationalities')).join(', '), 'edit');
      set('location', await this.readValue('#actor_profile_residence_connections_attributes_0_place'), 'edit');
      set('biography', await this.readValue('input[name="actor_profile[about_me]"]'), 'edit');

      const instagram = await this.readValue('#actor_profile_instagram_username');
      if (instagram) set('socialMedia', { instagram }, 'edit');

      // Languages: the native one is a plain select, the rest live in a tag
      // widget whose hidden inputs hold "code#level" - the code only becomes
      // readable through that widget's own select ("eng" -> "Englisch").
      const languages = [];
      const nativeLanguage = (await this.readSelected('#actor_profile_native_language'))[0];
      if (nativeLanguage) languages.push({ language: nativeLanguage, level: 'Muttersprache' });
      for (const entry of await this.readTagged(
        'input[name="actor_profile[further_languages_hash][]"]',
        '#actor_profile_further_languages_select'
      )) {
        languages.push({ language: entry.name, level: entry.level });
      }
      set('languages', languages, 'edit');

      // Skills: the specializations select plus every talent tag widget. This
      // app stores skills as plain strings, so only the name is kept.
      const skills = [...await this.readSelected('#actor_profile_specializations')];
      const talents = [
        ...await this.readTagged('input[name="actor_profile[instruments_hash][]"]', '#actor_profile_instruments_select'),
        ...await this.readTagged('input[name="actor_profile[singing_hash][]"]', '#actor_profile_singing_select'),
        ...await this.readTagged('input[name="actor_profile[dances_hash][]"]', '#actor_profile_dances_select'),
        ...await this.readTagged('input[name="actor_profile[sports_hash][]"]', '#actor_profile_sports_select'),
        ...await this.readTagged('input[name="actor_profile[special_skills_hash][]"]', '#actor_profile_special_skills_select')
      ];
      for (const talent of talents) {
        if (talent.name && !skills.includes(talent.name)) skills.push(talent.name);
      }
      set('skills', skills, 'edit');

      // ---- contact section: the name and phone number ---------------------
      await this.openPage(`${editUrl}?section=contact_settings`);
      const firstName = await this.readValue('#actor_profile_first_name');
      const lastName = await this.readValue('#actor_profile_last_name');
      set('firstName', firstName, 'edit?section=contact_settings');
      set('lastName', lastName, 'edit?section=contact_settings');
      if (firstName && lastName) set('name', `${firstName} ${lastName}`, 'edit?section=contact_settings');

      // The number is stored without its country code; that lives in the
      // neighbouring select as "Deutschland (+49)". A bare "1721545908" is not
      // a phone number anyone can dial.
      const phone = await this.readValue('#actor_profile_phone_number');
      if (phone) {
        const country = (await this.readSelected('#actor_profile_phone_country'))[0] || '';
        const dialCode = country.match(/\(\+(\d+)\)/)?.[1];
        set('contact', { phone: dialCode ? `+${dialCode} ${phone}` : phone }, 'edit?section=contact_settings');
      }

      // ---- personal section: gender and date of birth ----------------------
      await this.openPage(`${editUrl}?section=personal_information`);
      set('gender', this.constructor.toProfileGender((await this.readSelected('#actor_profile_gender'))[0]), 'edit?section=personal_information');
      set('dateOfBirth', await this.readDateOfBirth(), 'edit?section=personal_information');

      // ---- vita: credits and training --------------------------------------
      await this.openPage(`${editUrl}?edit_links=true&section=vita_entries`);
      const vita = await this.readVitaEntries();
      set('workHistory', vita.workHistory, 'edit?section=vita_entries');
      set('education', vita.education, 'edit?section=vita_entries');

      // Nothing at all came back: the pages are not what this was written
      // against. Returning an empty import would look like an empty profile.
      if (Object.keys(fields).length === 0) {
        throw new PlatformChangedError(
          'Read the Filmmakers profile pages but found none of the expected fields',
          { platform: 'filmmakers' }
        );
      }

      this.log('info', 'Read profile from Filmmakers', {
        found: Object.keys(fields),
        missing
      });

      return {
        success: true,
        fields,
        sources,
        missing,
        details: { found: Object.keys(fields), missing }
      };
    }));
  }

  /**
   * The profile slug of the logged-in user, taken from the header link.
   *
   * Never hard-coded: the slug is the actor's name, so it differs per user and
   * changes when they rename themselves.
   */
  async findProfileSlug() {
    await this.openPage(`${this.baseUrl}/`);

    const slug = await this.page.$$eval('a[href*="/actors/"]', (els) => {
      const href = els
        .map((a) => a.getAttribute('href'))
        .find((h) => h && /\/actors\/[^/?#]+$/.test(h));
      return href ? href.split('/actors/').pop() : null;
    }).catch(() => null);

    if (!slug) {
      throw new PlatformChangedError(
        'Could not find the profile link in the header, so the profile URL is unknown',
        { platform: 'filmmakers' }
      );
    }
    return slug;
  }

  /** Navigate, tolerating the locale prefix Filmmakers redirects to. */
  async openPage(url) {
    await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  }

  /** Trimmed value of an input, or null when it is absent or empty. */
  async readValue(selector) {
    return this.page
      .$eval(selector, (el) => (el.value || '').trim() || null)
      .catch(() => null);
  }

  /** Texts of the selected options of a (possibly multiple) select. */
  async readSelected(selector) {
    return this.page
      .$eval(selector, (el) => [...el.selectedOptions].map((o) => o.text.trim()).filter(Boolean))
      .catch(() => []);
  }

  /** Values of a repeated hidden input, as a tag widget writes them. */
  async readList(selector) {
    return this.page
      .$$eval(selector, (els) => els.map((el) => (el.value || '').trim()).filter(Boolean))
      .catch(() => []);
  }

  /**
   * Read a tag widget: chosen values sit in repeated hidden inputs as
   * "code#level", and the code is only readable through the options of the
   * widget's own select.
   *
   * Note that `selectSelector` is resolved inside this method, so it is not
   * covered by scripts/check-selectors.mjs. That is tolerable here and nowhere
   * else: if it matches nothing the codes are returned as they are, which is
   * ugly but not wrong - it cannot throw and cannot silently drop an entry.
   */
  async readTagged(hashSelector, selectSelector) {
    const entries = await this.readList(hashSelector);
    if (entries.length === 0) return [];

    const labels = await this.page.$eval(selectSelector, (select) => {
      const map = {};
      for (const option of select.options) {
        if (option.value) map[option.value] = option.text.trim();
      }
      return map;
    }).catch(() => ({}));

    return entries.map((entry) => {
      const [code, level] = entry.split('#');
      return { name: labels[code] || code.trim(), level: (level || '').trim() };
    });
  }

  /**
   * Rails splits a date across three selects (1i year, 2i month, 3i day).
   * @returns {Promise<string|null>} ISO date, or null if the parts are not all there
   */
  async readDateOfBirth() {
    const year = await this.readValue('#actor_profile_date_of_birth_1i');
    const month = await this.readValue('#actor_profile_date_of_birth_2i');
    const day = await this.readValue('#actor_profile_date_of_birth_3i');
    if (!year || !month || !day) return null;

    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return Number.isNaN(new Date(iso).getTime()) ? null : iso;
  }

  /**
   * The vita list, split into work history and training.
   *
   * Categories are read from the heading ids (`vita-film-title`), not from the
   * heading text: the text is localised and the site serves German, English,
   * French and more, so matching on it would break for any user whose interface
   * language is not German.
   */
  async readVitaEntries() {
    const raw = await this.page.$$eval('.vita-entries--list', (lists) => lists.map((list) => {
      const heading = list.previousElementSibling;
      const entries = [...list.querySelectorAll('.vita-entries--entry')].map((entry) => ({
        date: (entry.querySelector('.vita-entries--entry-date')?.innerText || '').trim(),
        title: (entry.querySelector('.vita-entries--entry-title')?.innerText || '').trim(),
        body: (entry.querySelector('.vita-entries--entry-body')?.innerText || '').trim()
      }));
      return {
        categoryId: heading && heading.classList.contains('vita-entries--title')
          ? heading.getAttribute('id')
          : null,
        entries
      };
    })).catch(() => []);

    const TYPES = {
      'vita-film-title': 'film',
      'vita-fernsehen-title': 'tv',
      'vita-theater-title': 'theater',
      'vita-commercial-title': 'commercial'
    };

    const workHistory = [];
    const education = [];

    for (const { categoryId, entries } of raw) {
      for (const entry of entries) {
        if (!entry.title && !entry.body) continue;

        if (categoryId === 'vita-ausbildung-title') {
          // The date cell holds either a single year or a range ("2022 – 2026",
          // with an en dash), while the profile stores the two ends separately.
          const [startYear, endYear] = this.constructor.splitYears(entry.date);
          education.push({
            institution: entry.title,
            degree: entry.title,
            startYear,
            endYear,
            description: entry.body
          });
          continue;
        }

        workHistory.push({
          title: entry.title,
          production: entry.title,
          description: entry.body,
          year: entry.date,
          type: TYPES[categoryId] || 'other'
        });
      }
    }

    return { workHistory, education };
  }

  /**
   * Split a vita date cell into start and end year.
   * "2022 – 2026" -> ['2022', '2026'];  "2024" -> ['2024', '2024'].
   */
  static splitYears(text) {
    const parts = String(text || '').split(/[–—-]/).map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) return ['', ''];
    return [parts[0], parts[1] || parts[0]];
  }

  /**
   * Filmmakers' gender labels are free-form and localised; this app stores an
   * enum. Anything unrecognised becomes 'not_specified' rather than a value the
   * Profile schema would reject on save.
   */
  static toProfileGender(label) {
    if (!label) return null;
    const value = label.toLowerCase();
    if (/weiblich|female|woman/.test(value)) return 'female';
    if (/männlich|maennlich|male|man/.test(value)) return 'male';
    if (/divers|non-?binär|non-?binary|inter/.test(value)) return 'diverse';
    return 'not_specified';
  }

  /**
   * Update input field value.
   * @returns {Promise<boolean>} false when the field is not on the page - the
   *   caller must not count that as an update.
   */
  async updateInputField(selector, value) {
    const element = await this.page.$(selector);
    if (!element) return false;

    await this.page.evaluate((sel) => {
      const input = document.querySelector(sel);
      if (input) input.value = '';
    }, selector);
    await this.page.type(selector, String(value));
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
   * Give every failure a typed error, but leave the browser open.
   *
   * This used to call cleanup() here, which closed the page before the caller
   * could photograph it - the same bug as in authenticate(), for every sync
   * operation. ConnectorService captures forensics and then closes the
   * connector in a `finally`, so teardown is already covered.
   */
  async withRetry(fn, maxRetries = 3) {
    try {
      return await super.withRetry(fn, maxRetries);
    } catch (error) {
      throw this.classifyFailure(error);
    }
  }
}

export default FilmmakersConnector;
