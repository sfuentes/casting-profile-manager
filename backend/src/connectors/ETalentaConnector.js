import { BrowserConnector } from './BrowserConnector.js';

/**
 * e-TALENTA
 * Platform ID: 4
 * Type: web automation
 * Regions: EU, DE, AT, CH
 *
 * This was an API adapter: 430 lines of axios calls against
 * api.e-talenta.eu, using ETALENTA_CLIENT_ID and ETALENTA_CLIENT_SECRET that
 * nobody has, for an API this project has no access to. It could not work, and
 * CLAUDE.md said so. What the platform does have is a normal web login, which
 * has now been read, so the connector drives that instead. The API code is in
 * the history if access ever appears.
 */
export class ETalentaConnector extends BrowserConnector {
  static manifest = Object.freeze({
    id: 4,
    key: 'e-talenta',
    name: 'e-TALENTA',
    authType: 'credentials',
    credentialFields: [{ name: 'username', type: 'text', required: true, label: 'Benutzername' },
      { name: 'password', type: 'password', required: true, label: 'Passwort' }],
    // Only the login has been established. The previous manifest claimed
    // pushProfile, pushAvailability and pushMedia against an API it could not
    // reach - three buttons in the UI that could only ever fail.
    capabilities: ['verify']
  });

  /**
   * Verified against the live login page on 2026-08-30 (URL supplied by the
   * project owner).
   *
   * The account field is `username` with type="text". The page also offers a
   * passkey button, which is not something this connector can use.
   */
  static site = Object.freeze({
    baseUrl: 'https://www.etalenta.eu',
    loginPath: '/login/login',
    login: {
      user: 'input[name="username"], input[id="username"]',
      password: 'input[name="password"], input[type="password"]',
      submitTexts: ['login', 'anmelden', 'einloggen']
    },
    // Nothing behind the login has been seen.
    paths: {},
    profileFields: []
  });
}

export default ETalentaConnector;
