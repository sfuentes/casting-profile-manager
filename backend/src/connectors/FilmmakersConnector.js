import { BrowserConnector } from './BrowserConnector.js';
import { clickByCssOrText } from './selectors.js';
import { PlatformChangedError } from './errors.js';

/**
 * Filmmakers Platform Adapter
 * Platform ID: 1
 * Type: Web scraping-based integration (no official API)
 * Features: Profile, Photos, Networking
 * Regions: EU, Global
 */
export class FilmmakersConnector extends BrowserConnector {
  static manifest = Object.freeze({
    id: 1,
    key: 'filmmakers',
    name: 'Filmmakers',
    authType: 'credentials',
    credentialFields: [{
      name: 'email', type: 'email', required: true, label: 'E-Mail'
    },
    {
      name: 'password', type: 'password', required: true, label: 'Passwort'
    }],
    // No pushAvailability. Read on 2026-09-03 while logged in: Filmmakers has no calendar
    // at all. Nothing the logged-in site links to mentions Termine,
    // Verfügbarkeit or a Kalender, and /profile/availability - the path this
    // descriptor carried - answers 404, as do /availability and /calendar.
    // The method below stays - it is groundwork, and the day this platform
    // grows a calendar it is most of the work already done - but declaring the
    // capability puts a button in the UI that can only ever fail.
    capabilities: ['verify', 'pushProfile', 'pushMedia', 'pullProfile']
  });

  /**
   * Verified against the live site on 2026-08-30.
   *
   * `/login` answers 404 and renders the site's not-found page; the real form
   * is Devise's, with the fields user[email] and user[password] - both carry
   * type=email / type=password, which is what the selectors below match.
   */
  static site = Object.freeze({
    baseUrl: 'https://www.filmmakers.eu',
    loginPath: '/users/sign_in',
    login: {
      user: 'input[name="email"], input[type="email"]',
      password: 'input[name="password"], input[type="password"]',
      submitTexts: ['einloggen', 'anmelden', 'login']
    },
    paths: {
      // The profile form lives under the actor's own slug, so it is resolved
      // per user in profileEditUrl() instead of being a fixed path here.
      availability: '/profile/availability',
      media: '/profile/photos'
    },
    /**
     * Read off the live edit form. The previous set - input[name="height"],
     * select[name="eye_color"] - exists nowhere on it; every field is
     * namespaced as actor_profile[...].
     *
     * Biography is deliberately absent: actor_profile[about_me] is a hidden
     * input behind a rich-text editor, and typing into a hidden field throws.
     * Writing it needs the editor, which nobody has looked at yet.
     */
    profileFields: [
      { field: 'height', selector: 'input[name="actor_profile[height]"]', kind: 'text' },
      { field: 'eyeColor', selector: 'select[name="actor_profile[eye_color]"]', kind: 'select' },
      { field: 'hairColor', selector: 'select[name="actor_profile[hair_color]"]', kind: 'select' }
    ]
  });

  /**
   * The edit form sits under the actor's slug (/actors/<slug>/edit), which
   * differs per user, so it is discovered from the logged-in header rather
   * than hard-coded.
   */
  async profileEditUrl() {
    return `${this.baseUrl}/actors/${await this.findProfileSlug()}/edit`;
  }

  async pullProfile() {
    return this.readProfile();
  }

  /**
   * Push availability data to Filmmakers
   * @param {Array} availability
   * @returns {Promise<Object>}
   */
  async pushAvailability(availability) {
    return this.withRateLimit(async () => this.withRetry(async () => {
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
    }));
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
    return this.withRateLimit(async () => this.withRetry(async () => {
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
    }));
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

      // ---- pictures --------------------------------------------------------
      //
      // The public profile is where the pictures are; the edit form only
      // offers upload controls. Filmmakers calls it a sedcard and says so in
      // its class names, which makes them a solid anchor: the large picture is
      // the primary one, the strip below it is the rest of the set.
      await this.openPage(`${this.baseUrl}/actors/${slug}`);
      const photos = [
        ...await this.readImages('.sedcard-image-link img', { type: 'portrait', primary: true, limit: 1 }),
        ...await this.readImages('.sedcard-media-pictures--item img', { type: 'other' })
      ];
      // The same picture appears large and as a thumbnail; keep the first.
      const seen = new Set();
      const unique = photos.filter((photo) => !seen.has(photo.url) && seen.add(photo.url));
      set('setcard', unique.length ? { photos: unique } : null, `/actors/${slug} (sedcard)`);
      if (unique[0]) set('avatar', unique[0].url, `/actors/${slug} (sedcard)`);

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

        const parsed = this.constructor.parseVitaBody(entry.body);
        workHistory.push({
          title: entry.title,
          // The title as rendered carries the format and the production status
          // - "Lenßen hilft - Der tote Goldesel (Serie)", "Traue niemandem -
          // Das Duo (AT) (Spielfilm)" - and the raw cell carries the line
          // breaks and indentation of the markup. Other platforms hold the bare
          // production name, and a credit cannot be recognised across two sites
          // while one of them spells it with its layout attached. The raw text
          // stays on `title`, so nothing is lost by cleaning this.
          production: this.constructor.cleanProductionTitle(entry.title),
          ...parsed,
          description: entry.body,
          year: entry.date,
          type: TYPES[categoryId] || 'other'
        });
      }
    }

    return { workHistory, education };
  }

  /**
   * The production name, without what the site prints around it.
   *
   * Filmmakers renders the format and the status into the title cell. Both are
   * dropped here and only here: this is Filmmakers' own way of writing a title,
   * so the knowledge belongs in Filmmakers' connector rather than in the
   * cross-platform matcher, which must not learn one site's habits.
   */
  static cleanProductionTitle(title) {
    let text = String(title || '').replace(/\s+/g, ' ').trim();
    // "In Entwicklung", "In Produktion" - a status, printed after the title.
    text = text.replace(/\s+In\s+(Entwicklung|Produktion|Post|Postproduktion)\s*$/i, '');
    // Trailing bracketed notes: the format ("(Serie)", "(Spielfilm)") and the
    // working-title marker "(AT)". Repeated, because titles carry both.
    let previous;
    do {
      previous = text;
      text = text.replace(/\s*\([^()]{1,20}\)\s*$/, '').trim();
    } while (text !== previous && text.length > 0);

    return text || String(title || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Pull the role, the director and the broadcaster out of a vita entry's body.
   *
   * Read off the live vita on 2026-08-31. The body is one block of text laid
   * out like this, with the line breaks being layout rather than structure:
   *
   *   Bösewicht, Jochen Bauer (ENR) Axel Hannemann Sender: Sat 1
   *   Chef Karl Lech (ENR) Matthias Paffgen Sender: Sat 1
   *   Diverse Nebenrollen (NR) Friederike Schröder Theater: Neue Kammerspiele
   *   Komparse (AR)
   *
   * The bracketed code is the size of the part (ENR, AR, NR ...). It is the
   * only reliable landmark in the string, so the role is what stands before it
   * and the director is what stands after it, up to a "Sender:" or "Theater:"
   * label if there is one.
   *
   * Everything here is a guess about someone's CV, so nothing is invented: a
   * body that does not carry the landmark yields no role rather than a wrong
   * one, and the untouched text stays on `description` either way.
   */
  static parseVitaBody(body) {
    const text = String(body || '').replace(/\s+/g, ' ').trim();
    if (!text) return {};

    const out = {};

    // "Sender: Sat 1" / "Theater: Neue Kammerspiele Kleinmachnow"
    const venue = text.match(/(?:Sender|Sendern|Theater|Produktion)\s*:\s*(.+)$/i);
    const head = venue ? text.slice(0, venue.index).trim() : text;
    if (venue) out.company = venue[1].trim();

    // The part-size code: one to four capitals in brackets.
    const marker = head.match(/\(([A-ZÄÖÜ]{1,4})\)/);
    if (!marker) return out;

    const role = head.slice(0, marker.index).trim().replace(/[,;]\s*$/, '');
    const director = head.slice(marker.index + marker[0].length).trim();

    if (role) out.role = role;
    if (director) out.director = director;

    return out;
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
}

export default FilmmakersConnector;
