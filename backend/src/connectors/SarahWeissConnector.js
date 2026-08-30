import { BrowserConnector } from './BrowserConnector.js';

/**
 * Sarah Weiß Casting
 * Platform ID: 8
 * Type: web automation
 * Region: DE
 *
 * This agency was represented as a manual entry - something the user keeps by
 * hand, with nothing to log into. It does have a login, on the same "online
 * casting solutions" platform that agentur wanted runs on: the two login forms
 * are identical down to the field names and the form action.
 */
export class SarahWeissConnector extends BrowserConnector {
  static manifest = Object.freeze({
    id: 8,
    key: 'sarah-weiss',
    name: 'Sarah Weiß Casting',
    authType: 'credentials',
    // The form asks for a user name, not an email address.
    credentialFields: [{ name: 'username', type: 'text', required: true, label: 'Benutzername' },
      { name: 'password', type: 'password', required: true, label: 'Passwort' }],
    // Login only: nothing behind it has been seen.
    capabilities: ['verify']
  });

  /**
   * Verified against the live login page on 2026-08-30 (URL supplied by the
   * project owner).
   *
   * `hint` is a third text field in the same form. It is left alone: on this
   * kind of form it is usually a honeypot, and filling it is how a bot
   * announces itself.
   */
  static site = Object.freeze({
    baseUrl: 'https://online.castingagentur-weiss.de',
    loginPath: '/de/login/actor/',
    login: {
      user: 'input[name="username"]',
      password: 'input[name="password"], input[type="password"]',
      submitTexts: ['anmelden', 'login', 'einloggen']
    },
    paths: {},
    profileFields: []
  });
}

export default SarahWeissConnector;
