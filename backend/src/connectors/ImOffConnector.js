import { BrowserConnector } from './BrowserConnector.js';

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
    credentialFields: [{ name: 'username', type: 'text', required: true, label: 'Benutzername' },
      { name: 'password', type: 'password', required: true, label: 'Passwort' }],
    capabilities: ['verify', 'pullProfile']
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
      profileEdit: '/external/extras'
    },
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
            { field: 'setcard.photos', selector: 'img[src*="front1"]', kind: 'images', type: 'portrait', primary: true },
            { field: 'setcard.photos', selector: 'img[src*="front2"]', kind: 'images', type: 'portrait' },
            { field: 'setcard.photos', selector: 'img[src*="front3"]', kind: 'images', type: 'portrait' },
            { field: 'setcard.photos', selector: 'img[src*="full"]', kind: 'images', type: 'fullbody' },
            { field: 'setcard.photos', selector: 'img[src*="left"]', kind: 'images', type: 'character' },
            { field: 'setcard.photos', selector: 'img[src*="right"]', kind: 'images', type: 'character' },
            { field: 'setcard.photos', selector: 'img[src*="hands"]', kind: 'images', type: 'other' }
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
}

export default ImOffConnector;
