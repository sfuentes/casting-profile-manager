import { BrowserConnector } from './BrowserConnector.js';

/**
 * Casting Network (casting-network.de)
 * Platform ID: 13
 * Type: web automation
 * Region: DE
 *
 * Not the same platform as id 2, whose connector drives
 * app.castingnetworks.com - that is Casting Networks, the international one.
 * The names are one letter apart and the two are unrelated: this is the German
 * site that has been running since 2005, with its own account and its own
 * login. Keeping them as separate connectors is the honest arrangement; a user
 * may well have an account on both.
 */
export class CastingNetworkDeConnector extends BrowserConnector {
  static manifest = Object.freeze({
    id: 13,
    key: 'casting-network-de',
    name: 'Casting Network (DE)',
    authType: 'credentials',
    credentialFields: [{ name: 'email', type: 'email', required: true, label: 'E-Mail' },
      { name: 'password', type: 'password', required: true, label: 'Passwort' }],
    // Login only. The pages behind it have not been seen, so nothing behind it
    // is offered - a profile import will be added once someone has logged in
    // and the connector has been written against what is actually there.
    capabilities: ['verify']
  });

  /**
   * Verified against the live login page on 2026-08-30 (URL supplied by the
   * project owner).
   *
   * A plain server-rendered form: it posts to /authenticate and carries a
   * typed submit input, so nothing exotic is needed to send it.
   */
  static site = Object.freeze({
    baseUrl: 'https://www.casting-network.de',
    loginPath: '/login',
    login: {
      user: 'input[name="email"], input[type="email"]',
      password: 'input[name="password"], input[type="password"]',
      submitTexts: ['login', 'anmelden', 'einloggen']
    },
    paths: {},
    profileFields: []
  });
}

export default CastingNetworkDeConnector;
