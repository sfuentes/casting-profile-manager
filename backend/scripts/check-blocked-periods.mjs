#!/usr/bin/env node
/**
 * Checks for the calendar rule: only block times leave this app.
 *
 * The four platform connectors that push availability each write `item.notes`
 * into a notes field and `item.status` into a status select - one of them maps
 * a status to "gebucht". None of that is a platform's business, and none of it
 * can reach them if the entries they are handed do not carry it. That is what
 * is checked here: what comes out, and just as much, what does not.
 *
 *   node scripts/check-blocked-periods.mjs
 */
import { toBlockedPeriods, toBlockedFormItems, BLOCKING_TYPES } from '../src/connectors/blockedPeriods.js';

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

const now = new Date('2026-09-01T12:00:00');
const day = (d) => `2026-09-${String(d).padStart(2, '0')}`;
const spans = (periods) => periods.map((p) => [p.start.getDate(), p.end.getDate()]);

// ---- what is shared -------------------------------------------------------

check('an unavailable period becomes a block',
  spans(toBlockedPeriods([{ type: 'unavailable', startDate: day(10), endDate: day(12) }], { now })),
  [[10, 12]]);

check('an available period is not a block and is not shared',
  toBlockedPeriods([{ type: 'available', startDate: day(10), endDate: day(12) }], { now }),
  []);

check('partial availability blocks too, so the day is not advertised as free',
  spans(toBlockedPeriods([{ type: 'partially_available', startDate: day(10), endDate: day(10) }], { now })),
  [[10, 10]]);

check('a period that is over is history, not availability',
  toBlockedPeriods([{ type: 'unavailable', startDate: '2026-01-01', endDate: '2026-01-05' }], { now }),
  []);

// ---- what is never shared -------------------------------------------------

const withSecrets = toBlockedPeriods([{
  type: 'unavailable',
  startDate: day(10),
  endDate: day(11),
  reason: 'Dreh Tatort München',
  notes: 'Regie will Rückruf bis Freitag',
  syncedPlatforms: [{ platformId: 1 }]
}], { now });

check('a block carries a start and an end and nothing else',
  Object.keys(withSecrets[0]).sort(),
  ['end', 'start']);

check('the reason a period is blocked never leaves',
  JSON.stringify(withSecrets).includes('Tatort'),
  false);

check('the notes never leave',
  JSON.stringify(withSecrets).includes('Rückruf'),
  false);

check('the form items the connectors fill carry no notes and no status',
  Object.keys(toBlockedFormItems([{
    type: 'unavailable', startDate: day(10), endDate: day(11), notes: 'x', status: 'gebucht'
  }], { now })[0]).sort(),
  ['endDate', 'startDate']);

// ---- merging --------------------------------------------------------------

check('two touching blocks are one block, not two jobs',
  spans(toBlockedPeriods([
    { type: 'unavailable', startDate: day(10), endDate: day(12) },
    { type: 'unavailable', startDate: day(13), endDate: day(14) }
  ], { now })),
  [[10, 14]]);

check('overlapping blocks merge',
  spans(toBlockedPeriods([
    { type: 'unavailable', startDate: day(10), endDate: day(20) },
    { type: 'unavailable', startDate: day(12), endDate: day(14) }
  ], { now })),
  [[10, 20]]);

check('blocks far apart stay apart',
  spans(toBlockedPeriods([
    { type: 'unavailable', startDate: day(10), endDate: day(11) },
    { type: 'unavailable', startDate: day(20), endDate: day(21) }
  ], { now })),
  [[10, 11], [20, 21]]);

check('blocks are sorted even when the entries are not',
  spans(toBlockedPeriods([
    { type: 'unavailable', startDate: day(20), endDate: day(21) },
    { type: 'unavailable', startDate: day(10), endDate: day(11) }
  ], { now })),
  [[10, 11], [20, 21]]);

// ---- edges ----------------------------------------------------------------

check('an entry with no end date blocks its start day',
  spans(toBlockedPeriods([{ type: 'unavailable', startDate: day(10) }], { now })),
  [[10, 10]]);

check('a day-long block covers the whole day, not up to midnight',
  toBlockedPeriods([{ type: 'unavailable', startDate: day(10) }], { now })[0].end.getHours(),
  23);

check('a time of day is kept when the entry has one',
  toBlockedPeriods([{ type: 'unavailable', startDate: day(10), startTime: '14:30' }], { now })[0].start.getHours(),
  14);

check('an unparseable date is dropped rather than sent as Invalid Date',
  toBlockedPeriods([{ type: 'unavailable', startDate: 'irgendwann' }], { now }),
  []);

check('an end before the start is dropped',
  toBlockedPeriods([{ type: 'unavailable', startDate: day(12), endDate: day(10) }], { now }),
  []);

check('no entries is no blocks, not a crash',
  toBlockedPeriods(undefined),
  []);

check('the blocking states are named in one place',
  BLOCKING_TYPES,
  ['unavailable', 'partially_available']);

console.log(`\n${passed}/${passed + failed} passed.`);
process.exit(failed ? 1 : 0);
