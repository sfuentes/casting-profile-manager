import { PlatformConnector } from './PlatformConnector.js';

/**
 * Backstage
 * Platform ID: 14
 * Regions: US, UK
 *
 * Recorded, not automated - and for two independent reasons, either of which
 * would be enough on its own.
 *
 * **The sign-in is Google OAuth.** Driving it would mean typing the account
 * holder's Google password into a Google form. That password is not a platform
 * credential like the others this app stores: it is the key to their identity,
 * their mail and everything else signed in with it. This app encrypts platform
 * passwords because connectors have to replay them into a login form; a Google
 * password is not something to take custody of on those terms, and Google
 * treats automated sign-in as an account compromise and locks the account.
 *
 * **The site is behind Cloudflare bot protection.** Checked on 2026-08-31: the
 * first request to www.backstage.com answered 200, every request after it
 * answered 403 with "Sorry, you have been blocked", and a fresh browser was
 * blocked on its very first page load. So the login page could not even be
 * read, let alone driven - and working around a bot check is not something
 * this project does. It is also how accounts get suspended, which is the
 * user's account, not ours.
 *
 * Nothing below is guessed. There is no `site` descriptor with a login path,
 * because no login page has been seen: the paths a first attempt tried
 * (/login, /users/sign_in, /account/login and six more) were guesses and all
 * of them answered 403 - which says nothing about whether they exist.
 *
 * What this connector does is make Backstage a platform the app knows about,
 * so it appears in the list, carries its profile URL, and is kept by hand -
 * the same arrangement as the two agencies. It declares no capabilities, so
 * every sync path refuses it with a NotSupportedError that names the reason
 * rather than a browser failing somewhere deep in a login.
 */
export class BackstageConnector extends PlatformConnector {
  static manifest = Object.freeze({
    id: 14,
    key: 'backstage',
    name: 'Backstage',
    // Accurate rather than convenient: the sign-in really is OAuth. It is not
    // an OAuth integration this app holds tokens for - see above.
    authType: 'oauth',
    // Nothing is asked for. There is no credential this app could accept here
    // that it would be right to accept.
    credentialFields: [],
    // Deliberately empty. Declaring anything else would put a button in the UI
    // whose only possible outcome is a Cloudflare block page.
    capabilities: []
  });

  /** Kept for the UI to link to; no path below it has been verified. */
  static site = Object.freeze({
    baseUrl: 'https://www.backstage.com',
    paths: {},
    profileFields: []
  });

  /**
   * Recording, not verifying.
   *
   * The message says plainly that nothing was logged into. A platform this app
   * cannot reach must not come back looking like a successful login - that is
   * the failure mode this project keeps finding and removing.
   */
  async verify() {
    return {
      ok: true,
      verified: false,
      message: 'Backstage is maintained by hand: it signs in with Google and '
        + 'sits behind bot protection, so this app does not log in for you.'
    };
  }
}

export default BackstageConnector;
