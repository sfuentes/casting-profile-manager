#!/usr/bin/env node
/**
 * Selector validity check.
 *
 * Six selectors in this repository were jQuery syntax (`button:contains("Add")`),
 * which `querySelectorAll` rejects with a SyntaxError. They failed on every run
 * against every site, and nothing caught it because the failure looked exactly
 * like a platform having changed its markup.
 *
 * This extracts every selector string the connectors pass to puppeteer and hands
 * it to a real Chromium. It proves only one thing - that the selector is legal
 * CSS - which is precisely the class of bug that is this repository's fault
 * rather than a platform's. Whether a selector matches anything on a live site
 * cannot be checked from here and must not be claimed.
 *
 *   node scripts/check-selectors.mjs
 *
 * Exits non-zero if any selector is invalid, so it can gate CI.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONNECTOR_DIR = path.join(here, '..', 'src', 'connectors');

/**
 * Puppeteer calls that take a selector as their first argument, plus the `css`
 * arrays passed to the helpers in selectors.js.
 */
/**
 * Selectors are extracted by walking the source with a quote-aware scanner
 * rather than by regex.
 *
 * Both obvious regexes are wrong here, and both fail *silently* by reporting a
 * clean run. `[^'"`]+` for the string body stops at the first inner quote, so
 * `input[name="email"]` is skipped - that dropped 80% of the selectors in this
 * file set. A lazy `\[[\s\S]*?\]` for the `css:` arrays stops at the first `]`,
 * which belongs to the attribute selector inside the array, not the array. A
 * checker that quietly examines the wrong thing is worse than no checker.
 */
const CALLS = [
  '.$$eval(',
  '.$eval(',
  '.$$(',
  '.$(',
  '.waitForSelector(',
  '.click(',
  '.select(',
  '.type(',
  '.hover(',
  '.focus(',
  '.tap('
];

const QUOTES = new Set(["'", '"', '`']);

/** Read the string literal starting at `i`; returns its value and end index. */
const readString = (source, i) => {
  const quote = source[i];
  let value = '';
  let j = i + 1;
  while (j < source.length) {
    const ch = source[j];
    if (ch === '\\') {
      value += source[j + 1] ?? '';
      j += 2;
      continue;
    }
    if (ch === quote) return { value, end: j };
    value += ch;
    j += 1;
  }
  return null; // unterminated
};

const collect = (source) => {
  const found = [];
  let cssArrayDepth = 0; // bracket depth inside a `css:` array, quotes excluded

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (QUOTES.has(ch)) {
      const str = readString(source, i);
      if (!str) break;

      const before = source.slice(Math.max(0, i - 20), i).trimEnd();
      const isCallArgument = CALLS.some((call) => before.endsWith(call));

      if (isCallArgument || cssArrayDepth > 0) found.push(str.value);
      i = str.end;
      continue;
    }

    // Track the `css: [ ... ]` arrays passed to the selectors.js helpers. Only
    // brackets outside string literals count, which is exactly what the regex
    // could not express.
    if (cssArrayDepth === 0 && ch === '[' && /css:\s*$/.test(source.slice(Math.max(0, i - 10), i))) {
      cssArrayDepth = 1;
    } else if (cssArrayDepth > 0) {
      if (ch === '[') cssArrayDepth += 1;
      else if (ch === ']') cssArrayDepth -= 1;
    }
  }

  // Template literals and variables cannot be checked statically; skipping them
  // is a known blind spot rather than a pass.
  return found.filter((s) => !s.includes('${'));
};

const run = async () => {
  const files = (await fs.readdir(CONNECTOR_DIR)).filter((f) => f.endsWith('.js')).sort();

  const selectors = [];
  for (const file of files) {
    const source = await fs.readFile(path.join(CONNECTOR_DIR, file), 'utf8');
    for (const selector of collect(source)) {
      selectors.push({ file, selector });
    }
  }

  if (selectors.length === 0) {
    console.error('No selectors found - the extraction pattern is probably wrong.');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    ...(process.env.PUPPETEER_EXECUTABLE_PATH && {
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
    }),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    const results = await page.evaluate((list) => {
      const frag = document.createDocumentFragment();
      return list.map((entry) => {
        try {
          frag.querySelector(entry.selector);
          return { ...entry, valid: true };
        } catch (error) {
          return { ...entry, valid: false, reason: error.message };
        }
      });
    }, selectors);

    const invalid = results.filter((r) => !r.valid);

    console.log(`Checked ${results.length} selectors across ${files.length} files.`);

    if (invalid.length > 0) {
      console.log('\nInvalid CSS - these can never match, on any site:\n');
      for (const entry of invalid) {
        console.log(`  ${entry.file}`);
        console.log(`    ${entry.selector}`);
        console.log(`    ${entry.reason}\n`);
      }
      process.exitCode = 1;
      return;
    }

    console.log('All selectors are valid CSS.');
    console.log('This does not mean they match anything on the live platforms.');
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
