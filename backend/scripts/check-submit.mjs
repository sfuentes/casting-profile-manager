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
import { PlatformConnector } from '../src/connectors/PlatformConnector.js';

class TestConnector extends PlatformConnector {
  static manifest = Object.freeze({
    id: 0,
    key: 'test',
    name: 'Test',
    authType: 'credentials',
    credentialFields: [],
    capabilities: []
  });
}

const page404 = (body) => `<!doctype html><html><body>${body}</body></html>`;

const FIXTURES = {
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

  'a form whose only submit control is hidden is submitted anyway': page404(`
    <form onsubmit="window.clicked='submitted-programmatically'; return false">
      <input name="password" type="password">
      <button type="submit" style="display:none"></button>
    </form>`)
};

const EXPECTED = {
  'visible button wins over a hidden submit (the JobWork shape)': 'weiter',
  'a plain visible submit is used when there is one': 'input-submit',
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
