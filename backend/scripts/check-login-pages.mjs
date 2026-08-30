#!/usr/bin/env node
/**
 * Do the login selectors still match the real login pages?
 *
 * This is the check the project kept needing and did not have. Filmmakers'
 * connector pointed at a /login that answers 404; JobWork's pointed at a host
 * with no working certificate; Wanted's pointed at a domain that does not
 * resolve; Casting Networks' pointed at a marketing site. Every one of those
 * was invisible from here, because "valid CSS" says nothing about whether a
 * page has the element.
 *
 * It loads each browser connector's login page and asks three questions:
 * does the page load, does the account field match exactly one element, does
 * the password field. No credentials are involved and nothing is submitted -
 * this only reads public pages.
 *
 *   node scripts/check-login-pages.mjs             all browser connectors
 *   node scripts/check-login-pages.mjs jobwork     one, by manifest key
 *
 * Needs internet, so it is deliberately not part of `npm run check:connectors`:
 * a failure here can mean the platform changed, or that the machine running it
 * cannot reach the platform at all.
 */
import puppeteer from 'puppeteer';
import { listManifests, getConnectorByKey } from '../src/connectors/registry.js';

const wanted = process.argv.slice(2);

const connectors = listManifests()
  .map((manifest) => getConnectorByKey(manifest.key))
  .filter((Connector) => {
    if (!Connector || typeof Connector.site !== 'object') return false;
    return wanted.length === 0 || wanted.includes(Connector.manifest.key);
  });

if (connectors.length === 0) {
  console.error('No browser connectors matched.');
  process.exit(1);
}

const browser = await puppeteer.launch({
  ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
  }),
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
});

let passed = 0;
let failed = 0;

try {
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  for (const Connector of connectors) {
    const { manifest, site } = Connector;
    const url = `${site.baseUrl}${site.loginPath}`;
    const label = manifest.name.padEnd(20);

    let response;
    try {
      // eslint-disable-next-line no-await-in-loop
      response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    } catch (error) {
      failed += 1;
      console.log(`  FAIL  ${label} ${url}\n        unreachable: ${error.message.slice(0, 80)}`);
      continue;
    }

    // Single-page apps render their form after the bundle runs.
    // eslint-disable-next-line no-await-in-loop
    await page.waitForSelector(site.login.password, { timeout: 10000 }).catch(() => {});

    // eslint-disable-next-line no-await-in-loop
    const counts = await page.evaluate((login) => ({
      user: document.querySelectorAll(login.user).length,
      password: document.querySelectorAll(login.password).length
    }), site.login);

    const status = response?.status();
    const ok = status === 200 && counts.user >= 1 && counts.password >= 1;

    if (ok) {
      passed += 1;
      console.log(`  ok    ${label} ${status}  account:${counts.user} password:${counts.password}  ${page.url()}`);
    } else {
      failed += 1;
      console.log(`  FAIL  ${label} ${status}  account:${counts.user} password:${counts.password}  ${page.url()}`);
      console.log(`        account  ${site.login.user}`);
      console.log(`        password ${site.login.password}`);
    }
  }
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} login pages still match.`);
process.exit(failed ? 1 : 0);
