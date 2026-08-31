#!/usr/bin/env node
/**
 * Checks for consent banners, against real Chromium and fixture markup.
 *
 * Two of these fixtures are the real thing. filmpool and UFA Base put one
 * button - "OK - verstanden" - over a notice that only necessary cookies are
 * set, and it covers the login form. Neither platform could be logged into:
 * filmpool never reached its submit and reported "still on the login page",
 * UFA's click on Einloggen was swallowed and came back as "Node is either not
 * clickable". One banner, two different-looking failures.
 *
 * The rule this pins down, in order:
 *   1. Decline if there is anything to decline.
 *   2. If a choice is offered and cannot be declined, click NOTHING. Consenting
 *      on the account holder's behalf is not this code's business, even when
 *      that means the page stays covered.
 *   3. Only if nothing is being asked - a notice with an acknowledgement - is
 *      it dismissed, because that grants nothing and is the only way past.
 *
 *   node scripts/check-consent.mjs
 */
import puppeteer from 'puppeteer';
import { BrowserConnector } from '../src/connectors/BrowserConnector.js';

class TestConnector extends BrowserConnector {
  static manifest = Object.freeze({
    id: 0, key: 'test', name: 'Test', authType: 'credentials',
    credentialFields: [], capabilities: []
  });
  static site = Object.freeze({
    baseUrl: 'http://127.0.0.1', loginPath: '/login',
    login: { user: 'input[name="u"]', password: 'input[type="password"]' },
    paths: {}, profileFields: []
  });
}

let passed = 0;
let failed = 0;
const check = (name, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed += 1; console.log(`  ok    ${name}`); }
  else { failed += 1; console.log(`  FAIL  ${name}\n        expected ${e}\n        got      ${a}`); }
};

const page404 = (body) => `<!doctype html><html><body>
  <script>window.clicked = null;</script>${body}</body></html>`;

// The banner filmpool and UFA Base actually serve.
const REAL_BANNER = page404(`
  <div id="cl-banner">
    <h4>Diese Website nutzt Cookies</h4>
    <div>Wir setzen <b>notwendige</b> Cookies damit diese Website genutzt werden kann.</div>
    <form action="/accept_cookies" method="post">
      <button name="button" type="submit" value="accept"
        onclick="window.clicked='ok-verstanden'; return false">OK - verstanden</button>
    </form>
  </div>`);

const FIXTURES = {
  'the filmpool / UFA notice is dismissed, because it asks nothing': {
    html: REAL_BANNER, dismissed: true, clicked: 'ok-verstanden'
  },
  'a banner offering a choice is declined': {
    html: page404(`
      <div>
        <button onclick="window.clicked='accept'">Alle akzeptieren</button>
        <button onclick="window.clicked='decline'">Ablehnen</button>
      </div>`),
    dismissed: true, clicked: 'decline'
  },
  'declining wins over an acknowledgement too': {
    html: page404(`
      <div>
        <button onclick="window.clicked='ok'">OK</button>
        <button onclick="window.clicked='decline'">Nur notwendige</button>
      </div>`),
    dismissed: true, clicked: 'decline'
  },
  'accept-only is left standing - consent is not ours to give': {
    html: page404(`<div><button onclick="window.clicked='accept'">Alle akzeptieren</button></div>`),
    dismissed: false, clicked: null
  },
  'accept next to an acknowledgement is left standing as well': {
    html: page404(`
      <div>
        <button onclick="window.clicked='accept'">Einverstanden</button>
        <button onclick="window.clicked='ok'">OK</button>
      </div>`),
    dismissed: false, clicked: null
  },
  'a page with no banner is left alone': {
    html: page404('<p>nothing here</p>'), dismissed: false, clicked: null
  },
  'a hidden banner is not clicked': {
    html: page404(`<div style="display:none"><button onclick="window.clicked='ok'">OK</button></div>`),
    dismissed: false, clicked: null
  }
};

const browser = await puppeteer.launch({
  headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
  for (const [name, fixture] of Object.entries(FIXTURES)) {
    const connector = new TestConnector({ platformId: 0, name: 'Test' }, {});
    const page = await browser.newPage();
    await page.setContent(fixture.html);
    connector.page = page;

    const dismissed = await connector.dismissConsentBanner();
    const clicked = await page.evaluate(() => window.clicked);

    check(name, { dismissed, clicked }, { dismissed: fixture.dismissed, clicked: fixture.clicked });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed.`);
process.exit(failed ? 1 : 0);
