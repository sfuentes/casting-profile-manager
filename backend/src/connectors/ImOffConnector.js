import { BrowserConnector } from './BrowserConnector.js';

/** A Date or date string as the `YYYY-MM-DD` an `input[type=date]` takes. */
const isoDay = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    + `-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * IM OFF Berlin
 * Platform ID: 12
 * Type: web automation
 * Region: DE
 */
export class ImOffConnector extends BrowserConnector {
  static manifest = Object.freeze({
    id: 12,
    key: 'im-off',
    name: 'IM OFF Berlin',
    authType: 'credentials',
    // The account field is `user_name`, not an email address - the form asks
    // for a user name, so the UI does too.
    credentialFields: [{
      name: 'username', type: 'text', required: true, label: 'Benutzername'
    },
    {
      name: 'password', type: 'password', required: true, label: 'Passwort'
    }],
    capabilities: ['verify', 'pullProfile', 'pushMedia', 'pushAvailability']
  });

  /**
   * Verified against the live site on 2026-08-30, logged in.
   *
   * The login lands straight on the profile form, which is spread over several
   * pages under /external/extras. Every control is addressed by its id: the
   * inputs carry no `name` attribute at all, so name-based selectors - the kind
   * every other connector here uses - would match nothing.
   *
   * There is nothing to parse and no API to listen to, so the whole importer is
   * this descriptor; BrowserConnector.readDeclaredProfile does the work.
   */
  static site = Object.freeze({
    baseUrl: 'https://app.im-off.de',
    loginPath: '/login',
    login: {
      user: 'input[name="user_name"]',
      password: 'input[name="password"], input[type="password"]',
      submitTexts: ['login', 'anmelden', 'einloggen']
    },
    paths: {
      profileEdit: '/external/extras',
      media: '/external/extras/photos',
      // Read off the live page on 2026-09-03, logged in. It is the only
      // calendar any connected platform turned out to have: Filmmakers has
      // none at all, JobWork has none, and Casting Network's "CN Kalender" is
      // an editorial list of festivals and film releases.
      availability: '/external/extras/calendar'
    },
    /**
     * The upload slots, in the order the page presents them. Each one takes a
     * single image/jpeg and says in its name what it is for, so a portrait
     * goes where portraits go.
     *
     * Writing back the rest of the profile is still not implemented: each page
     * saves through its own button and nobody has watched what that does.
     * Pictures are different - the slots are unambiguous, and keeping them in
     * step across platforms is the point of this app.
     */
    mediaFields: [
      { selector: 'input[name="picture_front1"]', type: 'portrait' },
      { selector: 'input[name="picture_front2"]', type: 'portrait' },
      { selector: 'input[name="picture_front3"]', type: 'portrait' },
      { selector: 'input[name="picture_full"]', type: 'fullbody' },
      { selector: 'input[name="picture_left"]', type: 'character' },
      { selector: 'input[name="picture_right"]', type: 'character' }
    ],
    profileRead: {
      pages: [
        {
          path: '/external/extras',
          fields: [
            { field: 'firstName', selector: '#first_name' },
            { field: 'lastName', selector: '#last_name' },
            { field: 'gender', selector: '#sex', kind: 'selected' },
            { field: 'dateOfBirth', selector: '#birthday' },
            { field: 'citizenship', selector: '#nationality_id', kind: 'selected' },
            { field: 'location', selector: '#city' },
            { field: 'contact.email', selector: '#email' },
            { field: 'contact.phone', selector: '#mobile' },
            { field: 'socialMedia.instagram', selector: '#instagram' },
            { field: 'socialMedia.website', selector: '#website' }
          ]
        },
        {
          path: '/external/extras/look',
          fields: [
            { field: 'height', selector: '#height' },
            { field: 'hairColor', selector: '#hair_color_id', kind: 'selected' },
            { field: 'eyeColor', selector: '#eye_color_id', kind: 'selected' }
          ]
        },
        {
          // Seven named slots, one picture each, all image/jpeg. The names say
          // what they are, which is what makes the setcard types honest here
          // rather than guessed.
          path: '/external/extras/photos',
          fields: [
            {
              field: 'setcard.photos', selector: 'img[src*="front1"]', kind: 'images', type: 'portrait', primary: true
            },
            {
              field: 'setcard.photos', selector: 'img[src*="front2"]', kind: 'images', type: 'portrait'
            },
            {
              field: 'setcard.photos', selector: 'img[src*="front3"]', kind: 'images', type: 'portrait'
            },
            {
              field: 'setcard.photos', selector: 'img[src*="full"]', kind: 'images', type: 'fullbody'
            },
            {
              field: 'setcard.photos', selector: 'img[src*="left"]', kind: 'images', type: 'character'
            },
            {
              field: 'setcard.photos', selector: 'img[src*="right"]', kind: 'images', type: 'character'
            },
            {
              field: 'setcard.photos', selector: 'img[src*="hands"]', kind: 'images', type: 'other'
            }
          ]
        },
        {
          path: '/external/extras/skills',
          fields: [
            // The native language is a select; the app stores languages as
            // { language, level } pairs, which is what this kind produces.
            { field: 'languages', selector: '#mother_tongue_id', kind: 'nativeLanguage' },
            // Free text, comma-separated. All three are simply skills here.
            { field: 'skills', selector: '#dialect', kind: 'list' },
            { field: 'skills', selector: '#instruments', kind: 'list' },
            { field: 'skills', selector: '#hobbies', kind: 'list' }
          ]
        }
      ]
    },
    // Writing back has not been looked at: the form saves through its own
    // buttons per page and nobody has watched what that does.
    profileFields: []
  });

  /**
   * Write block times into "Längere Abwesenheit".
   *
   * The page carries two things: a day grid where availability is dragged out
   * by hand, and this form - `#from`, `#to`, a Speichern button, and a table of
   * the periods already entered. The form is the one that matches what this app
   * has to say. It takes a period and nothing else, which is exactly the shape
   * `blockedPeriods.js` reduces the calendar to.
   *
   * Both inputs are `type="date"`, so they take `YYYY-MM-DD` and not the
   * `dd.mm.yyyy` the table displays. The Speichern button is `type="button"` -
   * the form is posted by the page's own script, so the button is clicked and
   * never the form submitted.
   *
   * Periods already in the table are skipped. This platform *lists* what it
   * holds, unlike the others whose availability pushes could only add, so a
   * second sync of the same calendar adds nothing rather than a second copy of
   * every absence.
   *
   * Nothing has been submitted to IM OFF. This has been run as a dry run only.
   */
  async pushAvailability(blocked, { dryRun = false } = {}) {
    return this.withRateLimit(() => this.withRetry(async () => {
      if (!this.isAuthenticated || !this.page) {
        throw new Error('Not authenticated. Call authenticate() first.');
      }

      await this.openPage(`${this.site.baseUrl}${this.site.paths.availability}`);

      const existing = await this.readAbsences();
      const wanted = (blocked || [])
        .map((item) => ({ from: isoDay(item.startDate), to: isoDay(item.endDate) }))
        .filter((item) => item.from && item.to);
      const missing = wanted.filter((item) => !existing
        .some((have) => have.from === item.from && have.to === item.to));

      this.log('info', `${dryRun ? 'Dry run:' : 'Pushing'} ${missing.length} block times to IM OFF`, {
        alreadyThere: wanted.length - missing.length
      });

      let written = 0;
      for (const period of missing) {
        // eslint-disable-next-line no-await-in-loop
        await this.page.evaluate((p) => {
          const set = (id, value) => {
            const el = document.getElementById(id);
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          };
          set('from', p.from);
          set('to', p.to);
        }, period);

        if (dryRun) break;

        // eslint-disable-next-line no-await-in-loop
        await this.page.click('#extras-form button.btn-save');
        // eslint-disable-next-line no-await-in-loop
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
          .catch(() => {});
        written += 1;
      }

      if (dryRun) {
        const screenshot = await this.captureFilledForm();

        return {
          success: true,
          dryRun: true,
          submitted: false,
          count: 0,
          planned: missing,
          alreadyThere: wanted.length - missing.length,
          screenshot,
          url: this.page.url()
        };
      }

      return {
        success: true,
        count: written,
        itemsSynced: written,
        details: { written: missing.slice(0, written), alreadyThere: wanted.length - missing.length }
      };
    }));
  }

  /**
   * The absence periods the page already lists, as `YYYY-MM-DD` pairs.
   *
   * The table's own column classes are not used: the account this was read on
   * has no absences, so the header is all that could be seen and the row markup
   * could not. The first two cells that parse as `dd.mm.yyyy` are the period -
   * a row that parses as nothing (the "keine Datensätze" placeholder) is
   * skipped. Worst case this finds nothing and a period is offered twice, which
   * is what every other connector here does unconditionally.
   */
  async readAbsences() {
    return this.page.$$eval('#extras_views_skills tbody tr', (rows) => rows
      .map((row) => [...row.querySelectorAll('td')]
        .map((cell) => /(\d{2})\.(\d{2})\.(\d{4})/.exec(cell.innerText || ''))
        .filter(Boolean)
        .map((m) => `${m[3]}-${m[2]}-${m[1]}`))
      .filter((dates) => dates.length >= 2)
      .map((dates) => ({ from: dates[0], to: dates[1] }))).catch(() => []);
  }
}

export default ImOffConnector;
