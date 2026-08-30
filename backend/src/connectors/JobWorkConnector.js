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
    capabilities: ['verify', 'pushProfile', 'pushAvailability', 'pushMedia', 'pullProfile']
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
    // The logged-in app lives on its own host and is fed by GraphQL. Reading
    // the response the app itself receives beats parsing the page: there is no
    // edit form to read named fields from (/settings has zero form controls -
    // editing happens in overlays), and the rendered markup is generated
    // utility classes with nothing stable to match on.
    app: {
      baseUrl: 'https://app.jobwork.com',
      profilePath: '/you',
      graphqlUrl: 'api.jobwork.com/graphql'
    },
    paths: {
      // NOT verified: reaching these needs an account, and nobody has logged in.
      profileEdit: '/profil/bearbeiten',
      availability: '/profil/verfuegbarkeit',
      media: '/profil/bilder'
    },
    /**
     * profile.meta[] is a flat list of { fieldName, value } pairs. This maps the
     * ones with an equivalent here; JobWork's shoe size, dress size, figure,
     * tattoos and body measurements have no field in this profile and are left
     * where they are rather than invented into one.
     */
    meta: {
      biography: 'profileAbout',
      location: 'profileLocation',
      height: 'profileHeight',
      weight: 'profileWeight',
      gender: 'profileGender',
      dateOfBirth: 'profileBirthday',
      eyeColor: 'profileEyeColor',
      hairColor: 'profileHairColor',
      actingAge: 'profilePlayingAge'
    },
    // NOT verified either - see above. Left as they were found.
    profileFields: [
      { field: 'biography', selector: 'textarea[name="biography"], textarea[name="biografie"], textarea[name="ueber_mich"]', kind: 'text' },
      { field: 'height', selector: 'input[name="height"], input[name="groesse"]', kind: 'text' },
      { field: 'eyeColor', selector: 'select[name="eye_color"], select[name="augenfarbe"]', kind: 'select' },
      { field: 'hairColor', selector: 'select[name="hair_color"], select[name="haarfarbe"]', kind: 'select' }
    ]
  });
  async pullProfile() {
    return this.readProfile();
  }

  /**
   * Read the profile by listening to the app's own GraphQL traffic.
   *
   * JobWork's logged-in app is a single-page app on app.jobwork.com that gets
   * everything from api.jobwork.com/graphql. There is nothing to scrape: the
   * profile page carries no form fields, /settings carries none either
   * (editing happens in overlays), and the rendered markup is utility classes
   * with no stable hook. What the app receives, though, is exactly the data -
   * so the connector opens the page and reads the same response the app reads.
   *
   * Values arrive as the platform's own words ("braun", a full ISO birthday, a
   * height in centimetres). They are passed on unchanged: turning them into
   * this app's vocabulary is the normaliser's job, and anything it cannot map
   * becomes a question for the user rather than a guess here.
   */
  async readProfile() {
    return this.withRateLimit(() => this.withRetry(async () => {
      if (!this.isAuthenticated || !this.page) {
        throw new Error('Not authenticated. Call authenticate() first.');
      }

      const profile = await this.captureProfilePayload();

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

      const meta = this.site.meta;
      for (const [field, fieldName] of Object.entries(meta)) {
        set(field, this.constructor.metaValue(profile, fieldName), `graphql:${fieldName}`);
      }

      set('languages', this.constructor.readLanguages(profile), 'graphql:profileLanguageRepeater');
      set('skills', this.constructor.readSkills(profile), 'graphql:profile*Repeater');
      set('workHistory', this.constructor.readExperience(profile), 'graphql:profileExperienceRepeater');
      set('education', this.constructor.readEducation(profile), 'graphql:profileEducationRepeater');

      if (Object.keys(fields).length === 0) {
        throw new PlatformChangedError(
          'The JobWork profile response carried none of the expected fields',
          { platform: 'jobwork' }
        );
      }

      this.log('info', 'Read profile from JobWork', {
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
   * Open the profile page and keep the GraphQL response that carries it.
   *
   * The app fires a dozen GraphQL calls on that page - jobs, membership,
   * billing, unread counts. The profile is the one whose `data` has a
   * `profile` key; the rest are ignored rather than guessed at by size or
   * order.
   */
  async captureProfilePayload() {
    const { app } = this.site;
    const payloads = [];

    const listener = async (response) => {
      if (!response.url().includes(app.graphqlUrl)) return;
      const body = await response.json().catch(() => null);
      if (body?.data?.profile) payloads.push(body.data.profile);
    };

    this.page.on('response', listener);
    try {
      await this.openPage(`${app.baseUrl}${app.profilePath}`);
      // The app renders, then fetches. Wait for the payload rather than for a
      // fixed delay, and give up with a clear error instead of hanging.
      const deadline = Date.now() + 25000;
      while (payloads.length === 0 && Date.now() < deadline) {
        // eslint-disable-next-line no-await-in-loop
        await this.delay(500);
      }
    } finally {
      this.page.off('response', listener);
    }

    if (payloads.length === 0) {
      throw new PlatformChangedError(
        'No GraphQL response carrying a profile arrived on the profile page',
        { platform: 'jobwork' }
      );
    }

    // The last one wins: the app refetches, and later is fresher.
    return payloads[payloads.length - 1];
  }

  /**
   * Turn JobWork's option keys into the word they stand for.
   *
   * Selects do not carry their label - they carry a key: profileEyeColorBrown,
   * profileGenderMale, profileLanguageLevelNative. Handing those to the
   * normaliser produced five "we cannot map this" questions for values the
   * platform states perfectly clearly, so the field's own prefix is stripped
   * and the remainder passed on: "Brown", "Male", "Native". The normaliser
   * already knows those words, and anything genuinely unknown still reaches
   * the user as a question rather than a guess.
   *
   * A key that is only a number (profileDialect3) is dropped: without
   * JobWork's option table it means nothing, and inventing a meaning for it
   * would be worse than admitting we do not have one.
   */
  static decodeOption(fieldName, value) {
    if (typeof value !== 'string') return value;

    // The key does not always carry the whole field name: the category field
    // is profileExperienceCategory while its options are
    // profileExperienceTelevision, so they only share "profileExperience".
    // Strip whatever the two do share.
    let shared = 0;
    while (shared < fieldName.length && shared < value.length
      && fieldName[shared] === value[shared]) shared += 1;

    // Nothing meaningful in common: this is an ordinary value ("178",
    // "Berlin, Deutschland"), not an option key.
    if (shared < 'profile'.length) return value;

    const suffix = value.slice(shared).trim();
    // A key that is only a number (profileDialect3) means nothing without
    // JobWork's option table, and inventing a meaning would be worse than
    // admitting we do not have one.
    if (suffix === '' || /^\d+$/.test(suffix)) return null;
    return suffix;
  }

  /** Language keys are ISO-ish: profileLanguageDe -> Deutsch. */
  static LANGUAGE_NAMES = Object.freeze({
    de: 'Deutsch',
    en: 'Englisch',
    fr: 'Französisch',
    es: 'Spanisch',
    it: 'Italienisch',
    tr: 'Türkisch',
    ru: 'Russisch',
    pl: 'Polnisch',
    pt: 'Portugiesisch',
    nl: 'Niederländisch'
  });

  /**
   * The value of one top-level meta field, with option keys decoded.
   *
   * Some values are structural rather than readable: the playing age arrives
   * as "[8,3]", a pair of indices into a scale this connector does not have.
   * Those are dropped rather than written into a text field.
   */
  static metaValue(profile, fieldName) {
    const entry = (profile.meta || []).find((m) => m.fieldName === fieldName);
    const value = entry?.value;
    if (typeof value !== 'string') return value ?? null;

    const trimmed = value.trim();
    if (/^\[.*\]$/.test(trimmed)) return null;

    return this.decodeOption(fieldName, trimmed);
  }

  /**
   * Repeaters hold one flat list of values for every row at once; `repeaterSet`
   * says which row a value belongs to. This regroups them into rows keyed by
   * their field name.
   */
  static repeaterRows(profile, fieldName) {
    const entry = (profile.meta || []).find((m) => m.fieldName === fieldName);
    const rows = new Map();

    for (const value of entry?.values || []) {
      if (!rows.has(value.repeaterSet)) rows.set(value.repeaterSet, {});
      rows.get(value.repeaterSet)[value.fieldName] = typeof value.value === 'string'
        ? value.value.trim()
        : value.value;
    }

    return [...rows.values()];
  }

  static readLanguages(profile) {
    return this.repeaterRows(profile, 'profileLanguageRepeater')
      .map((row) => {
        const code = this.decodeOption('profileLanguage', row.profileLanguage);
        const level = this.decodeOption('profileLanguageLevel', row.profileLanguageLevel);
        return {
          language: this.LANGUAGE_NAMES[(code || '').toLowerCase()] || code,
          // "Native", "Fluent", "Basic" - words the normaliser already maps.
          level: level || ''
        };
      })
      .filter((entry) => entry.language);
  }

  /**
   * Dances, instruments and dialects all become plain skills here - this
   * profile has one list, not three.
   */
  static readSkills(profile) {
    const skills = [];
    for (const repeater of ['profileDanceRepeater', 'profileInstrumentRepeater', 'profileDialectRepeater']) {
      for (const row of this.repeaterRows(profile, repeater)) {
        for (const [fieldName, value] of Object.entries(row)) {
          const decoded = this.decodeOption(fieldName, value);
          if (decoded && !skills.includes(decoded)) skills.push(decoded);
        }
      }
    }
    return skills;
  }

  /**
   * JobWork's category keys, in this app's work-history vocabulary. The keys
   * are English (profileExperienceTelevision); the German words are kept in
   * case the platform ever sends labels instead.
   */
  static WORK_TYPES = Object.freeze({
    television: 'tv',
    fernsehen: 'tv',
    serie: 'tv',
    series: 'tv',
    film: 'film',
    movie: 'film',
    cinema: 'film',
    kinofilm: 'film',
    spielfilm: 'film',
    kurzfilm: 'film',
    shortfilm: 'film',
    theater: 'theater',
    theatre: 'theater',
    bühne: 'theater',
    commercial: 'commercial',
    advertising: 'commercial',
    werbung: 'commercial'
  });

  static readExperience(profile) {
    return this.repeaterRows(profile, 'profileExperienceRepeater').map((row) => {
      const category = (this.decodeOption('profileExperienceCategory', row.profileExperienceCategory) || '')
        .toLowerCase();
      const type = Object.entries(this.WORK_TYPES)
        .find(([word]) => category.includes(word))?.[1] || 'other';

      const from = row.profileExperienceYearFrom || '';
      const to = row.profileExperienceUntilToday === 'true' ? 'heute' : (row.profileExperienceYearTo || '');
      const year = to && to !== from ? `${from} – ${to}` : from;

      return {
        title: row.profileExperienceProduction,
        production: row.profileExperienceProduction,
        role: row.profileExperienceRole,
        director: row.profileExperienceDirection,
        company: row.profileExperienceChannel || row.profileExperienceTheater,
        year,
        description: this.decodeOption('profileExperienceCategory', row.profileExperienceCategory) || '',
        type
      };
    }).filter((entry) => entry.production || entry.role);
  }

  static readEducation(profile) {
    return this.repeaterRows(profile, 'profileEducationRepeater').map((row) => ({
      institution: row.profileEducationInstitution,
      degree: row.profileEducationDegree,
      startYear: row.profileEducationYearFrom || '',
      endYear: row.profileEducationUntilToday === 'true' ? 'heute' : (row.profileEducationYearTo || ''),
      description: ''
    })).filter((entry) => entry.institution || entry.degree);
  }

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
