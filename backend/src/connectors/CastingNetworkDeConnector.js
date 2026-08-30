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
    // The import reads the account page, which is where this platform keeps
    // the personal data. Pushing back is not offered: nothing has been written
    // to this site and nobody has watched what its save buttons do.
    capabilities: ['verify', 'pullProfile']
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
    /**
     * Read from the account page, which is where this platform keeps the
     * personal data. Verified logged in on 2026-08-30: name, address, phone
     * and email are filled in there.
     *
     * The actor profile at /mein-cn/schauspielprofil is deliberately not read.
     * That page currently says "Schauspielprofil anlegen" - the profile does
     * not exist for this account yet, and every field on it is empty. Its
     * inputs are named client_first_name and so on, but nobody has seen the
     * page in its filled state, and a descriptor written against a creation
     * form would quietly report "nothing there" if the filled one differs.
     * It gets added when there is a profile to check it against.
     */
    profileRead: {
      pages: [
        {
          path: '/mein-cn/konto',
          fields: [
            { field: 'firstName', selector: 'input[name="first_name"]' },
            { field: 'lastName', selector: 'input[name="last_name"]' },
            { field: 'location', selector: 'input[name="city"]' },
            { field: 'contact.email', selector: 'input[name="email"]' },
            { field: 'contact.phone', selector: 'input[name="phone"]' },
            {
              field: 'contact.address',
              kind: 'join',
              selectors: ['input[name="street"]', 'input[name="postal_code"]', 'input[name="city"]'],
              // street, postcode town
              separators: [', ', ' ']
            }
          ]
        }
      ]
    },
    profileFields: []
  });
}

export default CastingNetworkDeConnector;
