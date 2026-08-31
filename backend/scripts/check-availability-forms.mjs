#!/usr/bin/env node
/**
 * The calendar rule, checked where it actually has to hold: in the form
 * fillers the platform connectors run, against real Chromium.
 *
 * blockedPeriods.js is where the reduction happens, but a redactor nobody uses
 * protects nothing. Each connector that fills an availability form is handed a
 * block time here and the resulting page is read back. The notes field must be
 * empty and the status select untouched - on every connector, including ones
 * added after this was written, because the list comes from the registry.
 *
 * The same fillers are run once with a raw calendar entry as well. That run is
 * expected to leak, and it is here so that a green result means the reduction
 * is doing something rather than the fixture having no fields to fill.
 *
 *   node scripts/check-availability-forms.mjs
 */
import puppeteer from 'puppeteer';
import { listManifests, getConnector } from '../src/connectors/registry.js';
import { toBlockedFormItems } from '../src/connectors/blockedPeriods.js';

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

/**
 * Every field name the four fillers reach for, in one form. A filler that
 * writes anything anywhere will show up here.
 */
const FIXTURE = `<!doctype html><html><body><form>
  <input name="start_date"><input name="end_date">
  <input name="von"><input name="bis">
  <input name="from"><input name="to">
  <select name="status">
    <option value="" selected></option>
    <option value="gebucht">gebucht</option>
    <option value="nicht_verfuegbar">nicht verfügbar</option>
    <option value="option">Option</option>
  </select>
  <select name="typ"><option value="" selected></option><option value="gebucht">gebucht</option></select>
  <select name="type"><option value="" selected></option><option value="booking">booking</option></select>
  <select name="verfuegbarkeit"><option value="" selected></option><option value="gebucht">gebucht</option></select>
  <textarea name="notes"></textarea>
  <textarea name="notizen"></textarea>
  <textarea name="bemerkung"></textarea>
  <textarea name="description"></textarea>
</form></body></html>`;

/** What the page holds after a filler has run. */
const readBack = (page) => page.evaluate(() => ({
  dates: [...document.querySelectorAll('input')].map((el) => el.value).filter(Boolean),
  statuses: [...document.querySelectorAll('select')].map((el) => el.value).filter(Boolean),
  notes: [...document.querySelectorAll('textarea')].map((el) => el.value).filter(Boolean)
}));

// A booking with everything a platform must not learn.
const RAW_ENTRY = {
  type: 'unavailable',
  status: 'gebucht',
  startDate: new Date('2099-09-10'),
  endDate: new Date('2099-09-12'),
  reason: 'Dreh Tatort München',
  notes: 'Regie will Rückruf bis Freitag'
};

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

try {
  // Derived, not listed: a connector added later is checked without editing this.
  const fillers = listManifests()
    .map((manifest) => ({ manifest, Connector: getConnector(manifest.id) }))
    .filter(({ Connector }) => typeof Connector?.prototype?.fillAvailabilityForm === 'function');

  check('the registry still has availability fillers to check', fillers.length > 0, true);

  const [blocked] = toBlockedFormItems([RAW_ENTRY], { now: new Date('2099-01-01') });

  for (const { manifest, Connector } of fillers) {
    const connector = new Connector({ platformId: manifest.id, name: manifest.name }, {});
    const page = await browser.newPage();
    connector.page = page;

    // What the connector receives today: a block time and nothing else.
    await page.setContent(FIXTURE);
    await connector.fillAvailabilityForm(blocked);
    const after = await readBack(page);

    check(`${manifest.key}: the block time itself is written`, after.dates.length > 0, true);
    check(`${manifest.key}: no note reaches the platform`, after.notes, []);
    check(`${manifest.key}: no booking status reaches the platform`, after.statuses, []);

    // The same filler, handed the raw entry, to prove the fixture can leak.
    await page.setContent(FIXTURE);
    await connector.fillAvailabilityForm(RAW_ENTRY);
    const leaked = await readBack(page);

    check(`${manifest.key}: the raw entry would have leaked, so this check bites`,
      leaked.notes.length > 0 || leaked.statuses.length > 0, true);

    await page.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${passed}/${passed + failed} passed.`);
process.exit(failed ? 1 : 0);
