import { BrowserConnector } from './BrowserConnector.js';

/**
 * filmpool Casting
 * Platform ID: 10
 * Type: web automation (Rails/Devise, same shape as Filmmakers)
 * Region: DE
 */
export class FilmpoolConnector extends BrowserConnector {
  static manifest = Object.freeze({
    id: 10,
    key: 'filmpool',
    name: 'filmpool Casting',
    authType: 'credentials',
    credentialFields: [{
      name: 'email', type: 'email', required: true, label: 'E-Mail'
    },
    {
      name: 'password', type: 'password', required: true, label: 'Passwort'
    }],
    // Only what has actually been established. The login page was read on
    // 2026-08-30; nothing behind it has been seen, so nothing behind it is
    // offered. Declaring pushProfile here would put a button in the UI that
    // could only fail.
    capabilities: ['verify']
  });

  /**
   * Verified against the live login page on 2026-08-30 (URL supplied by the
   * project owner, not guessed).
   *
   * Devise, like Filmmakers: fields user[email] and user[password], form
   * posting back to /users/sign_in.
   */
  static site = Object.freeze({
    baseUrl: 'https://www.filmpool-casting.de',
    loginPath: '/users/sign_in',
    login: {
      user: 'input[name="user[email]"], input[type="email"]',
      password: 'input[name="user[password]"], input[type="password"]',
      // The same form carries a second submit button, "Sende mir einen
      // Login-Link". Clicking that would mail the account holder a link
      // instead of logging in, so the button is chosen by its label.
      submitBy: 'text',
      submitTexts: ['einloggen', 'login', 'anmelden']
    },
    // Nothing beyond the login has been seen; there are deliberately no paths
    // or profile fields to guess at.
    paths: {},
    profileFields: []
  });
}

export default FilmpoolConnector;
