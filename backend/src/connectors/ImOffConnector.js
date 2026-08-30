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
    // Login only: nothing behind it has been seen.
    capabilities: ['verify']
  });

  /**
   * Verified against the live login page on 2026-08-30 (URL supplied by the
   * project owner).
   */
  static site = Object.freeze({
    baseUrl: 'https://app.im-off.de',
    loginPath: '/login',
    login: {
      user: 'input[name="user_name"]',
      password: 'input[name="password"], input[type="password"]',
      submitTexts: ['login', 'anmelden', 'einloggen']
    },
    paths: {},
    profileFields: []
  });
}

export default ImOffConnector;
