import { BrowserConnector } from './BrowserConnector.js';

/**
 * UFA Base
 * Platform ID: 11
 * Type: web automation (Rails/Devise, same shape as Filmmakers and filmpool)
 * Region: DE
 */
export class UfaBaseConnector extends BrowserConnector {
  static manifest = Object.freeze({
    id: 11,
    key: 'ufa-base',
    name: 'UFA Base',
    authType: 'credentials',
    credentialFields: [{
      name: 'email', type: 'email', required: true, label: 'E-Mail'
    },
    {
      name: 'password', type: 'password', required: true, label: 'Passwort'
    }],
    // Login only: the pages behind it have never been seen. See FilmpoolConnector.
    capabilities: ['verify']
  });

  /**
   * Verified against the live login page on 2026-08-30 (URL supplied by the
   * project owner).
   *
   * The page also carries two hidden search submits outside the login form,
   * which is exactly why submitFormOwning scopes to the form holding the
   * password field rather than taking the first submit control on the page.
   */
  static site = Object.freeze({
    baseUrl: 'https://www.ufa-base.de',
    loginPath: '/users/sign_in',
    login: {
      user: 'input[name="user[email]"], input[type="email"]',
      password: 'input[name="user[password]"], input[type="password"]',
      // Second submit in the same form: "Sende mir einen Login-Link". Chosen
      // by label so a login attempt never turns into a mailed login link.
      submitBy: 'text',
      submitTexts: ['einloggen', 'login', 'anmelden']
    },
    paths: {},
    profileFields: []
  });
}

export default UfaBaseConnector;
