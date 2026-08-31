#!/usr/bin/env node
/**
 * Checks the media plan: which file goes into which slot, and what a dry run
 * reports. Real Chromium, fixture markup, nothing uploaded anywhere.
 *
 * The plan is the part worth checking without a platform. It decides that a
 * picture is not offered to two slots, that a slot taking image/jpeg does not
 * get an AVIF, that a video slot draws from the videos rather than the
 * setcard, and that a slot which wants a link is handed the address instead of
 * a downloaded file. Each of those was a way to report a successful upload
 * that the platform had rejected.
 *
 *   node scripts/check-media-plan.mjs
 */
import puppeteer from 'puppeteer';
import { BrowserConnector } from '../src/connectors/BrowserConnector.js';

let passed = 0;
let failed = 0;

const check = (name, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}\n        expected ${e}\n        got      ${a}`);
  }
};

class TestConnector extends BrowserConnector {
  static manifest = Object.freeze({
    id: 0, key: 'test', name: 'Test', authType: 'credentials',
    credentialFields: [], capabilities: ['pushMedia']
  });

  static site = Object.freeze({
    baseUrl: 'http://127.0.0.1',
    loginPath: '/login',
    login: { user: 'input[name="u"]', password: 'input[type="password"]' },
    paths: { media: '/media' },
    profileFields: [],
    mediaFields: [
      { selector: 'input[name="portrait1"]', type: 'portrait' },
      { selector: 'input[name="portrait2"]', type: 'portrait' },
      { selector: 'input[name="any_picture"]' },
      { selector: 'input[name="reel_file"]', kind: 'video', type: 'showreel' },
      { selector: 'input[name="reel_link"]', kind: 'video', write: 'url' }
    ]
  });

  // The fixture is already on the page; a dry run must not navigate away from it.
  async openPage() { return this.page; }
}

const FIXTURE = `<!doctype html><html><body><form>
  <input type="file" name="portrait1" accept="image/jpeg">
  <input type="file" name="portrait2" accept="image/jpeg,image/png">
  <input type="file" name="any_picture">
  <input type="file" name="reel_file" accept="video/mp4">
  <input type="text" name="reel_link">
</form></body></html>`;

const PROFILE = {
  setcard: {
    photos: [
      { url: 'https://p/one.jpg', type: 'portrait' },
      { url: 'https://p/two.jpg', type: 'portrait' },
      { url: 'https://p/three.avif', type: 'fullbody' }
    ]
  },
  showreel: { url: 'https://v/reel.mp4', description: 'Showreel' },
  videos: [
    { url: 'https://v/reel.mp4', type: 'showreel' },
    { url: 'https://vimeo.com/12345', title: 'Szene', type: 'scene' }
  ]
};

const browser = await puppeteer.launch({
  headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
  const connector = new TestConnector({ platformId: 0, name: 'Test' }, {});
  const page = await browser.newPage();
  await page.setContent(FIXTURE);
  connector.page = page;
  connector.isAuthenticated = true;

  const result = await connector.pushMedia(PROFILE, { dryRun: true });
  const plan = result.planned;
  const at = (name) => plan.find((step) => step.slot.includes(name));

  check('a dry run uploads nothing', result.uploaded, []);
  check('a dry run says so', result.dryRun, true);

  check('the first portrait slot gets a portrait',
    at('portrait1')?.url, 'https://p/one.jpg');
  check('the second portrait slot gets a different portrait, not the same one twice',
    at('portrait2')?.url, 'https://p/two.jpg');
  check('a slot with no type takes what is left',
    at('any_picture')?.url, 'https://p/three.avif');

  check('a video slot draws from the videos, not the setcard',
    at('reel_file')?.url, 'https://v/reel.mp4');
  check('a video slot is planned as a video',
    at('reel_file')?.kind, 'video');
  check('a link slot is handed the address, not a file',
    at('reel_link')?.write, 'url');
  check('the link slot gets the video the file slot did not take',
    at('reel_link')?.url, 'https://vimeo.com/12345');
  check('the showreel is not offered twice, once from showreel and once from videos',
    plan.filter((step) => step.url === 'https://v/reel.mp4').length, 1);

  // Acceptance, read off the controls rather than assumed.
  check('a slot that takes image/jpeg rejects an AVIF',
    result.rejected.map((step) => step.url), []);

  const strict = new TestConnector({ platformId: 0, name: 'Test' }, {});
  const strictPage = await browser.newPage();
  await strictPage.setContent(`<!doctype html><html><body><form>
    <input type="file" name="portrait1" accept="image/jpeg">
  </form></body></html>`);
  strict.page = strictPage;
  strict.isAuthenticated = true;
  const avifOnly = await strict.pushMedia({
    setcard: { photos: [{ url: 'https://p/only.avif', type: 'portrait' }] }
  }, { dryRun: true });

  check('an AVIF planned into a JPEG-only slot is rejected, not uploaded',
    avifOnly.rejected.map((step) => step.url), ['https://p/only.avif']);
  check('and it is not in the accepted plan', avifOnly.planned, []);

  const empty = await strict.pushMedia({ setcard: { photos: [] } }, { dryRun: true });
  check('a profile with nothing to send is not an error', empty.success, true);

  await strictPage.close();
  await page.close();
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed.`);
process.exit(failed ? 1 : 0);
