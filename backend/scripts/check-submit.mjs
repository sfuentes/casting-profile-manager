#!/usr/bin/env node
/**
 * Checks for submitFormOwning, against real Chromium and fixture markup.
 *
 * The rule it encodes came from JobWork: that login form's only
 * button[type="submit"] is hidden, and the work is done by a visible "Weiter"
 * button with no type attribute. Taking the first match in DOM order clicks the
 * hidden one, which throws - so the helper prefers a visible control. These
 * fixtures are the shapes that decision has to survive.
 *
 *   node scripts/check-submit.mjs
 */
import puppeteer from 'puppeteer';
import { BrowserConnector } from '../src/connectors/BrowserConnector.js';

class TestConnector extends BrowserConnector {
  static manifest = Object.freeze({
    id: 0,
    key: 'test',
    name: 'Test',
    authType: 'credentials',
    credentialFields: [],
    capabilities: []
  });

  static site = Object.freeze({
    baseUrl: 'http://127.0.0.1',
    loginPath: '/login',
    login: { user: 'input[name="identifier"]', password: 'input[type="password"]' },
    paths: {},
    profileFields: []
  });
}

const page404 = (body) => `<!doctype html><html><body>${body}</body></html>`;

const FIXTURES = {
  'a submit with its own formaction is never taken for the login (the UFA shape)': page404(`
    <a href="/users/sign_in" onclick="window.clicked='header-link'; return false"><span>Einloggen</span></a>
    <form action="/users/sign_in" onsubmit="window.submitted = true; return false">
      <input name="identifier" type="email">
      <input name="password" type="password">
      <button type="button" onclick="window.clicked='eye'"></button>
      <button type="submit" onclick="window.clicked='einloggen'">Einloggen</button>
      <button type="submit" formaction="/passwordless/users/sign_in"
              onclick="window.clicked='login-link'">Sende mir einen Login-Link</button>
    </form>`),

  'the login link is refused even when it comes first': page404(`
    <form action="/users/sign_in" onsubmit="window.submitted = true; return false">
      <input name="identifier" type="email">
      <input name="password" type="password">
      <button type="submit" formaction="/passwordless/users/sign_in"
              onclick="window.clicked='login-link'">Sende mir einen Login-Link</button>
      <button type="submit" onclick="window.clicked='einloggen'">Einloggen</button>
    </form>`),


  'visible button wins over a hidden submit (the JobWork shape)': page404(`
    <form onsubmit="window.submitted = true; return false">
      <button type="submit" style="display:none" onclick="window.clicked='hidden-submit'"></button>
      <input name="identifier" type="text">
      <input name="password" type="password">
      <button onclick="window.clicked='weiter'">Weiter</button>
    </form>`),

  'a plain visible submit is used when there is one': page404(`
    <form onsubmit="window.submitted = true; return false">
      <input name="password" type="password">
      <input type="submit" value="Anmelden" onclick="window.clicked='input-submit'">
    </form>`),

  'an icon button with no label is never mistaken for the submit': page404(`
    <form onsubmit="window.clicked='submitted'; return false">
      <button type="submit" style="display:none"></button>
      <input name="identifier" type="text">
      <input name="password" type="password">
      <button onclick="window.clicked='eye-toggle'; return false"></button>
      <button onclick="window.clicked='weiter'; return false">Weiter</button>
    </form>`),

  'a form whose only submit control is hidden is submitted anyway': page404(`
    <form onsubmit="window.clicked='submitted-programmatically'; return false">
      <input name="password" type="password">
      <button type="submit" style="display:none"></button>
    </form>`)
};

const EXPECTED = {
  'a submit with its own formaction is never taken for the login (the UFA shape)': 'einloggen',
  'the login link is refused even when it comes first': 'einloggen',
  'visible button wins over a hidden submit (the JobWork shape)': 'weiter',
  'a plain visible submit is used when there is one': 'input-submit',
  'an icon button with no label is never mistaken for the submit': 'weiter',
  'a form whose only submit control is hidden is submitted anyway': 'submitted-programmatically'
};

let passed = 0;
let failed = 0;

const browser = await puppeteer.launch({
  ...(process.env.PUPPETEER_EXECUTABLE_PATH && { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }),
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});

try {
  const page = await browser.newPage();
  const connector = new TestConnector({ platformId: 0 }, {});
  connector.page = page;

  for (const [name, html] of Object.entries(FIXTURES)) {
    // eslint-disable-next-line no-await-in-loop
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    // eslint-disable-next-line no-await-in-loop
    await page.evaluate(() => { window.clicked = null; });
    // eslint-disable-next-line no-await-in-loop
    const submitted = await connector.submitFormOwning('input[type="password"]');
    // eslint-disable-next-line no-await-in-loop
    const clicked = await page.evaluate(() => window.clicked || null);

    if (submitted && clicked === EXPECTED[name]) {
      passed += 1;
      console.log(`  ok    ${name}`);
    } else {
      failed += 1;
      console.log(`  FAIL  ${name}\n        expected ${EXPECTED[name]}, got ${clicked} (returned ${submitted})`);
    }
  }

  // Two plain submits and nothing structural to tell them apart: the caller's
  // labels decide. Without labels the function cannot know, and takes the first
  // - which is why the loop above does not cover this case.
  await page.setContent(page404(`
    <form action="/x" onsubmit="window.submitted = true; return false">
      <input name="password" type="password">
      <button type="submit" onclick="window.clicked='register'">Registrieren</button>
      <button type="submit" onclick="window.clicked='einloggen'">Einloggen</button>
    </form>`), { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { window.clicked = null; });
  await connector.submitFormOwning('input[type="password"]', ['einloggen', 'anmelden']);
  const labelled = await page.evaluate(() => window.clicked);
  if (labelled === 'einloggen') {
    passed += 1;
    console.log('  ok    with two plain submits the labels given decide');
  } else {
    failed += 1;
    console.log(`  FAIL  with two plain submits the labels given decide (clicked ${labelled})`);
  }

  // No form at all: the caller must be told, not left assuming it submitted.
  await page.setContent(page404('<input name="password" type="password">'), { waitUntil: 'domcontentloaded' });
  const orphan = await connector.submitFormOwning('input[type="password"]');
  if (orphan === false) {
    passed += 1;
    console.log('  ok    a field outside any form reports "not submitted"');
  } else {
    failed += 1;
    console.log(`  FAIL  a field outside any form reports "not submitted" (got ${orphan})`);
  }

  // ---- choosing an option ------------------------------------------------
  //
  // Casting Network's gender field is a Radix RadioGroup: the control is a
  // button[role="radio"] and the input beside it is invisible, carrying only
  // the value. Setting `checked` on that input changed the DOM and nothing
  // else - the circle stayed empty and the component's state, which is what
  // gets submitted, never moved. These fixtures are that shape, plus the case
  // that matters most: a click that does not take must be reported as such.

  await page.setContent(page404(`
    <div role="radiogroup">
      <button type="button" role="radio" value="m" aria-checked="false"
              onclick="this.setAttribute('aria-checked','true')"></button>
      <input type="radio" value="m" style="opacity:0">
      <button type="button" role="radio" value="w" aria-checked="false"></button>
      <input type="radio" value="w" style="opacity:0">
    </div>`), { waitUntil: 'domcontentloaded' });

  const aria = await connector.chooseOption('[role="radio"], input[type="radio"]', 'm');
  if (aria === true) {
    passed += 1;
    console.log('  ok    an ARIA radio button is clicked, not the invisible input');
  } else {
    failed += 1;
    console.log(`  FAIL  an ARIA radio button is clicked, not the invisible input (got ${aria})`);
  }

  // A control that swallows the click: the write did not take, and saying it
  // did is the whole failure mode this guards against.
  await page.setContent(page404(`
    <div role="radiogroup">
      <button type="button" role="radio" value="m" aria-checked="false"></button>
    </div>`), { waitUntil: 'domcontentloaded' });

  const ignored = await connector.chooseOption('[role="radio"]', 'm');
  if (ignored === false) {
    passed += 1;
    console.log('  ok    a click the component ignores is reported as not written');
  } else {
    failed += 1;
    console.log(`  FAIL  a click the component ignores is reported as not written (got ${ignored})`);
  }

  // Plain radios still work.
  await page.setContent(page404('<input type="radio" name="g" value="m"><input type="radio" name="g" value="w">'),
    { waitUntil: 'domcontentloaded' });
  const plain = await connector.chooseOption('input[type="radio"]', 'w');
  if (plain === true) {
    passed += 1;
    console.log('  ok    a plain radio group still works');
  } else {
    failed += 1;
    console.log(`  FAIL  a plain radio group still works (got ${plain})`);
  }

  // A selector that matches nothing must not throw.
  const missing = await connector.submitFormOwning('input[name="does-not-exist"]');
  if (missing === false) {
    passed += 1;
    console.log('  ok    a selector matching nothing reports "not submitted"');
  } else {
    failed += 1;
    console.log(`  FAIL  a selector matching nothing reports "not submitted" (got ${missing})`);
  }
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed.`);
process.exit(failed ? 1 : 0);
