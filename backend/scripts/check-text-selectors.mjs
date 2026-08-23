#!/usr/bin/env node
/**
 * Behavioural check for the text-matching helpers in src/connectors/selectors.js.
 *
 * The six invalid selectors were replaced with `findByCssOrText`, so that helper
 * now carries the availability paths of four platforms. It is exercised here
 * against fixture markup in a real Chromium: not the live sites, but enough to
 * show the helper finds a German button label, prefers a structural selector
 * when one exists, skips hidden and disabled controls, and returns null instead
 * of throwing when nothing matches.
 *
 *   node scripts/check-text-selectors.mjs
 */

import puppeteer from 'puppeteer';
import { findByCssOrText, findByText, findFirst } from '../src/connectors/selectors.js';

const FIXTURE = `
  <main>
    <button id="hidden" style="display:none">Hinzufügen</button>
    <button id="disabled" disabled>Hinzufügen</button>
    <a id="link" href="#">Verfügbarkeit hinzufügen</a>
    <button id="structural" data-action="add-availability">+</button>
    <input id="submit" type="submit" value="Speichern" />
    <button id="upper">  ADD   NEW  </button>
    <button id="aria" aria-label="Neu anlegen"><svg></svg></button>
  </main>
`;

const idOf = (page, handle) =>
  handle ? page.evaluate((el) => el.id, handle) : Promise.resolve(null);

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check('finds a German label on a link, skipping the hidden and disabled buttons', async (page) => {
  const el = await findByText(page, ['verfügbarkeit hinzufügen'], { timeout: 500 });
  return [await idOf(page, el), 'link'];
});

check('skips display:none and disabled elements when matching "hinzufügen"', async (page) => {
  const el = await findByText(page, ['hinzufügen'], { timeout: 500 });
  return [await idOf(page, el), 'link'];
});

check('prefers a structural selector over the label', async (page) => {
  const el = await findByCssOrText(page, {
    css: ['[data-action="add-availability"]'],
    texts: ['hinzufügen'],
    timeout: 500
  });
  return [await idOf(page, el), 'structural'];
});

check('falls back to the label when no structural selector matches', async (page) => {
  const el = await findByCssOrText(page, {
    css: ['[data-action="does-not-exist"]'],
    texts: ['hinzufügen'],
    timeout: 500
  });
  return [await idOf(page, el), 'link'];
});

check('matches an input by its value attribute', async (page) => {
  const el = await findByText(page, ['speichern'], { timeout: 500 });
  return [await idOf(page, el), 'submit'];
});

check('matching is case- and whitespace-insensitive', async (page) => {
  const el = await findByText(page, ['add new'], { timeout: 500 });
  return [await idOf(page, el), 'upper'];
});

check('matches an icon-only button by aria-label', async (page) => {
  const el = await findByText(page, ['neu anlegen'], { timeout: 500 });
  return [await idOf(page, el), 'aria'];
});

check('returns null rather than throwing when nothing matches', async (page) => {
  const el = await findByText(page, ['does not exist anywhere'], { timeout: 300 });
  return [el, null];
});

check('findFirst tries selectors in order', async (page) => {
  const el = await findFirst(page, ['#nope', '#submit', '#upper']);
  return [await idOf(page, el), 'submit'];
});

const run = async () => {
  const browser = await puppeteer.launch({
    ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
    }),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  let failures = 0;
  try {
    const page = await browser.newPage();
    await page.setContent(FIXTURE);

    for (const { name, fn } of checks) {
      try {
        const [actual, expected] = await fn(page);
        if (actual === expected) {
          console.log(`  ok    ${name}`);
        } else {
          console.log(`  FAIL  ${name}\n          expected ${expected}, got ${actual}`);
          failures += 1;
        }
      } catch (error) {
        console.log(`  ERROR ${name}\n          ${error.message}`);
        failures += 1;
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${checks.length - failures}/${checks.length} passed.`);
  if (failures > 0) process.exitCode = 1;
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
