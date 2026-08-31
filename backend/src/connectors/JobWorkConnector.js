import { BrowserConnector } from './BrowserConnector.js';
import { findByCssOrText } from './selectors.js';
import { PlatformChangedError } from './errors.js';
import { diffWorkHistory, describe, productionOf, yearOf } from './workHistory.js';

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
    // pushWorkHistory is new and, unlike the rest, has been driven: the
    // profile's sections each route to a real editor at
    // /@<handle>/edit/<section>, and a dry run filled every field of the
    // credits drawer - including the two listboxes - and pressed Abbrechen.
    capabilities: ['verify', 'pushProfile', 'pushAvailability', 'pushMedia', 'pullProfile', 'pushWorkHistory']
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
    /**
     * The credits editor, read off the live page on 2026-08-31.
     *
     * CLAUDE.md said this app had no form to write into - that /settings has
     * zero controls and editing happens in overlays. Half right, and the wrong
     * half is the part that mattered. Each section of the profile has a pencil
     * that routes to `/@<handle>/edit/<section>`, and those routes can also be
     * navigated to directly. `/edit/experiences` is a real editor: a list, a
     * category filter, and an "Hinzufügen" that opens a drawer holding a form
     * with named inputs.
     *
     * The names are the same vocabulary the GraphQL import already reads
     * (`profileExperienceRepeater` and its `profileExperience*` fields), so
     * reading and writing speak the same language.
     *
     * Three of the controls are not what they look like. Category, Jahr and
     * Jahr bis are Headless UI listboxes - a `div[aria-haspopup="listbox"]`
     * with a span for the current value - not `<select>`. `page.select` would
     * have found nothing and reported nothing, which is the failure this
     * project has already met once with a Radix radio group.
     */
    experience: {
      editPath: '/edit/experiences',
      drawer: '#app-drawer-main',
      // The add button is scoped by the section it belongs to: the page also
      // carries an "Auszeichnungen hinzufügen" button, and taking the first
      // match in DOM order opens the awards editor instead.
      section: 'Erfahrung',
      addTexts: ['hinzufügen'],
      submitTexts: ['hinzufügen'],
      cancelTexts: ['abbrechen'],
      fields: {
        production: 'meta.profileExperienceProduction.value',
        role: 'meta.profileExperienceRole.value',
        company: 'meta.profileExperienceChannel.value',
        director: 'meta.profileExperienceDirection.value'
      },
      listboxes: {
        category: 'meta.profileExperienceCategory.fieldName',
        yearFrom: 'meta.profileExperienceYearFrom.fieldName',
        yearTo: 'meta.profileExperienceYearTo.fieldName'
      },
      // What this app calls the categories its filter offers.
      categories: { tv: 'Fernsehen', film: 'Film', theater: 'Theater' }
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
   * The account's own handle, e.g. "@sebastian-fuentes".
   *
   * Every edit route is namespaced under it and it differs per user, so it is
   * read from the URL the app itself lands on rather than stored anywhere.
   */
  async profileHandle() {
    const { app } = this.site;
    if (!this.page.url().startsWith(app.baseUrl)) {
      await this.openPage(`${app.baseUrl}${app.profilePath}`);
    }
    const handle = (this.page.url().match(/\/(@[^/]+)\//) || [])[1];
    if (!handle) {
      throw new PlatformChangedError(
        'Could not read the account handle from the JobWork profile URL',
        { platform: 'jobwork' }
      );
    }
    return handle;
  }

  /**
   * Choose a value in one of the drawer's listboxes.
   *
   * These are Headless UI listboxes: a div that opens a list of
   * `[role="option"]`, with the chosen value shown in a span. Setting a value
   * on them does nothing, so the control is opened, the option is clicked, and
   * **the result is read back** - a click the component ignores would otherwise
   * be reported as a value that was set.
   */
  async chooseInListbox(fieldNameSelector, wanted) {
    const opened = await this.page.evaluate((marker) => {
      const hidden = document.querySelector(`input[name="${marker}"]`);
      if (!hidden) return false;
      let node = hidden.parentElement;
      for (let up = 0; up < 6 && node; up += 1) {
        const box = node.querySelector('[aria-haspopup="listbox"]');
        if (box) { box.click(); return true; }
        node = node.parentElement;
      }
      return false;
    }, fieldNameSelector);

    if (!opened) return false;

    await this.page.waitForSelector('[role="option"]', { timeout: 5000 }).catch(() => {});
    const clicked = await this.page.evaluate((text) => {
      const want = String(text).trim().toLowerCase();
      const option = [...document.querySelectorAll('[role="option"]')]
        .find((el) => (el.innerText || '').trim().toLowerCase() === want);
      if (!option) return false;
      option.click();
      return true;
    }, String(wanted));

    if (!clicked) {
      // Close the list again rather than leaving it open over the next field.
      await this.page.keyboard.press('Escape').catch(() => {});
      return false;
    }

    // Read it back. This is the check the Radix radio taught us to write.
    return this.page.evaluate((marker, text) => {
      const hidden = document.querySelector(`input[name="${marker}"]`);
      let node = hidden?.parentElement;
      for (let up = 0; up < 6 && node; up += 1) {
        const box = node.querySelector('[aria-haspopup="listbox"]');
        if (box) return (box.innerText || '').trim().toLowerCase() === String(text).trim().toLowerCase();
        node = node.parentElement;
      }
      return false;
    }, fieldNameSelector, String(wanted));
  }

  /** Click the button that belongs to a named section, not the first match. */
  async clickSectionButton(section, texts) {
    return this.page.evaluate((sectionName, wanted) => {
      const buttons = [...document.querySelectorAll('button')]
        .filter((el) => (el.offsetWidth || el.offsetHeight)
          && wanted.some((t) => (el.innerText || '').trim().toLowerCase().includes(t)));
      for (const button of buttons) {
        let node = button;
        for (let up = 0; up < 8 && node; up += 1) {
          node = node.parentElement;
          const text = (node?.innerText || '').replace(/\s+/g, ' ').trim();
          if (text.length > 40) {
            if (text.startsWith(sectionName)) { button.click(); return true; }
            break;
          }
        }
      }
      return false;
    }, section, texts);
  }

  /**
   * Add the credits JobWork does not have.
   *
   * The diff is done by `workHistory.js`, which is where the question "is this
   * the same credit" is answered for every platform. Only what is missing is
   * written; nothing already there is touched, and nothing is ever deleted.
   *
   * A dry run fills the drawer, photographs it and presses Abbrechen. On a
   * profile that is public, that is the only honest way to see what a push
   * would do before doing it.
   */
  async pushWorkHistory(profile, { dryRun = false, limit = null } = {}) {
    const spec = this.site.experience;

    return this.withRateLimit(() => this.withRetry(async () => {
      if (!this.isAuthenticated || !this.page) {
        throw new Error('Not authenticated. Call authenticate() first.');
      }

      const ours = profile?.workHistory || [];
      if (ours.length === 0) {
        return { success: true, dryRun, added: [], planned: [], count: 0,
          details: { message: 'No credits in the profile to push' } };
      }

      // What the platform already has, read the way the importer reads it.
      const current = this.constructor.readExperience(await this.captureProfilePayload());
      const { missing, shared } = diffWorkHistory(ours, current);

      const planned = limit ? missing.slice(0, limit) : missing;

      if (planned.length === 0) {
        return { success: true, dryRun, added: [], planned: [], count: 0,
          details: { message: `JobWork already has all ${shared.length} credits`, shared: shared.length } };
      }

      const handle = await this.profileHandle();
      await this.openPage(`${this.site.app.baseUrl}/${handle}${spec.editPath}`);
      await this.page.waitForFunction(
        () => document.body.innerText.trim().length > 200, { timeout: 20000 }
      ).catch(() => {});

      const added = [];
      const failed = [];

      for (const entry of planned) {
        const opened = await this.clickSectionButton(spec.section, spec.addTexts);
        if (!opened) {
          failed.push({ entry: describe(entry), reason: 'the "Hinzufügen" button for Erfahrung was not found' });
          continue;
        }

        await this.page.waitForSelector(`input[name="${spec.fields.production}"]`, { timeout: 10000 })
          .catch(() => {});

        const written = {};
        for (const [key, name] of Object.entries(spec.fields)) {
          const value = key === 'production' ? productionOf(entry) : entry[key];
          // JobWork writes "-" where it has nothing; passing that on would put
          // a dash into a field the actor left empty on the other platform.
          if (!value || value === '-') continue;
          written[key] = await this.writeField({ selector: `input[name="${name}"]`, kind: 'text' }, value);
        }

        const category = spec.categories[entry.type] || spec.categories.tv;
        written.category = await this.chooseInListbox(spec.listboxes.category, category);

        const year = yearOf(entry);
        if (year) written.yearFrom = await this.chooseInListbox(spec.listboxes.yearFrom, year);

        const unwritten = Object.entries(written).filter(([, ok]) => ok === false).map(([k]) => k);

        if (dryRun) {
          await this.captureFilledForm().catch(() => {});
          await this.clickDrawerButton(spec.cancelTexts);
          await this.page.waitForFunction(
            (name) => !document.querySelector(`input[name="${name}"]`),
            { timeout: 5000 }, spec.fields.production
          ).catch(() => {});
          added.push({ entry: describe(entry), category, year, unwritten });
          continue;
        }

        if (unwritten.length > 0) {
          // A field that did not take is a credit that would land incomplete on
          // a public profile. Back out rather than submit it.
          await this.clickDrawerButton(spec.cancelTexts);
          failed.push({ entry: describe(entry), reason: `could not fill: ${unwritten.join(', ')}` });
          continue;
        }

        const submitted = await this.clickDrawerButton(spec.submitTexts);
        if (!submitted) {
          failed.push({ entry: describe(entry), reason: 'no submit button in the drawer' });
          continue;
        }
        await this.page.waitForFunction(
          (name) => !document.querySelector(`input[name="${name}"]`),
          { timeout: 15000 }, spec.fields.production
        ).catch(() => {});
        added.push({ entry: describe(entry), category, year });
      }

      this.log('info', `${dryRun ? 'Dry run: ' : ''}${added.length} credit(s) ${dryRun ? 'would be' : ''} added to JobWork`, {
        planned: planned.length, failed: failed.length
      });

      return {
        success: added.length > 0 || planned.length === 0,
        dryRun,
        added: dryRun ? [] : added,
        planned: dryRun ? added : planned.map(describe),
        failed,
        count: dryRun ? 0 : added.length,
        details: {
          alreadyThere: shared.length,
          missing: missing.length,
          attempted: planned.length,
          failed
        }
      };
    }));
  }

  /** Click a button inside the drawer by its label. */
  async clickDrawerButton(texts) {
    return this.page.evaluate((drawerSelector, wanted) => {
      const drawer = document.querySelector(drawerSelector)?.closest('div[role], body > div, div') || document;
      const scope = drawer.querySelector?.(drawerSelector) ? drawer : document;
      const buttons = [...scope.querySelectorAll('button')]
        .filter((el) => el.offsetWidth || el.offsetHeight);
      // The drawer's own action buttons sit after its heading; match on the
      // label and take the last one, which is the drawer's rather than the
      // page's behind it.
      const matches = buttons.filter((el) => wanted
        .some((t) => (el.innerText || '').trim().toLowerCase() === t));
      const target = matches[matches.length - 1];
      if (!target) return false;
      target.click();
      return true;
    }, this.site.experience.drawer, texts);
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

      const media = this.constructor.readMedia(profile);
      if (media.photos.length) set('setcard', { photos: media.photos }, 'graphql:profile.mediaItems');
      if (media.avatar) set('avatar', media.avatar, 'graphql:profile.mediaItems');
      if (media.videos.length) set('videos', media.videos, 'graphql:profile.mediaItems');
      if (media.showreel) set('showreel', media.showreel, 'graphql:profile.mediaItems');

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

  /**
   * The pictures, from the same GraphQL payload the rest of the profile comes
   * from - no scraping of the carousel needed.
   *
   * Each item carries a uuid and the flags the platform itself uses:
   * isPortrait, isShowReel, isAboutMe. Those give the setcard its types
   * honestly, instead of inferring a type from an image's size on screen.
   *
   * The uuid is an Uploadcare id: the file lives at uc.jobwork.com/<uuid>/.
   * Only that reference is kept - the file stays where it is hosted.
   */
  static readMedia(profile) {
    const items = (profile.mediaItems || []).filter((item) => item.uuid);
    const url = (item) => `${this.MEDIA_BASE}/${item.convertedUuid || item.uuid}/`;

    const isVideo = (item) => item.type === 'VIDEO' || (item.mimeType || '').startsWith('video');

    const photos = items
      .filter((item) => !isVideo(item))
      .map((item) => ({
        url: url(item),
        title: item.title || item.name || '',
        type: item.isPortrait ? 'portrait' : 'other',
        isPrimary: Boolean(item.isPortrait)
      }));

    // Videos are found by their own type, not by the isShowReel flag. This
    // account's reel is called NewReel25_Short.mov and has isShowReel false -
    // going by the flag dropped it entirely, and the import looked complete.
    const videos = items.filter(isVideo).map((item) => ({
      url: url(item),
      title: item.title || item.name || '',
      type: item.isShowReel ? 'showreel' : 'other',
      platform: 'JobWork'
    }));

    const portrait = photos.find((photo) => photo.isPrimary) || photos[0];
    const reel = videos.find((video) => video.type === 'showreel') || videos[0];

    return {
      photos,
      videos,
      avatar: portrait?.url || null,
      showreel: reel ? { url: reel.url, platform: 'JobWork', description: reel.title } : null
    };
  }

  /** Where JobWork's uploaded files live. */
  static MEDIA_BASE = 'https://uc.jobwork.com';

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
