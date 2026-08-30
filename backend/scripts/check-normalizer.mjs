#!/usr/bin/env node
/**
 * Checks for the import normaliser.
 *
 * The normaliser decides two things that matter: what an imported value becomes
 * in this app's vocabulary, and - just as important - when it refuses to guess
 * and asks the user instead. Both are checked here, with no network and no
 * database.
 *
 *   node scripts/check-normalizer.mjs
 */
import { normalizeProfileFields, applyResolutions, VOCABULARY } from '../src/connectors/profileNormalizer.js';

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

// ---- values that map ------------------------------------------------------
check('a full ISO timestamp becomes a plain date',
  normalizeProfileFields({ dateOfBirth: '1980-07-12T00:00:00.000Z' }).fields.dateOfBirth,
  '1980-07-12');

check('a height in metres becomes centimetres',
  normalizeProfileFields({ height: '1,78 m' }).fields.height,
  '178');

check('a height with a unit keeps only the number',
  normalizeProfileFields({ height: '178 cm' }).fields.height,
  '178');

check('a platform spelling maps to our language level',
  normalizeProfileFields({ languages: [{ language: 'Englisch', level: 'fliessend' }] }).fields.languages,
  [{ language: 'Englisch', level: 'Fließend' }]);

check('an English hair colour maps to the German one',
  normalizeProfileFields({ hairColor: 'brown' }).fields.hairColor,
  'braun');

check('an unknown work type falls back to other',
  normalizeProfileFields({ workHistory: [{ title: 'X', type: 'hoerspiel' }] }).fields.workHistory[0].type,
  'other');

check('duplicate skills are collapsed',
  normalizeProfileFields({ skills: ['Reiten', ' Reiten ', 'Fechten'] }).fields.skills,
  ['Reiten', 'Fechten']);

// ---- values that must NOT be guessed -------------------------------------
const unknownEye = normalizeProfileFields({ eyeColor: 'irisblau-meliert' });
check('an unrecognised eye colour is not stored',
  unknownEye.fields.eyeColor,
  undefined);
check('an unrecognised eye colour becomes a question with options',
  unknownEye.unmapped,
  [{ path: 'eyeColor', field: 'eyeColor', value: 'irisblau-meliert', options: VOCABULARY.eyeColor }]);

const unknownLevel = normalizeProfileFields({
  languages: [{ language: 'Spanisch', level: 'B2 nach GER' }]
});
check('an unrecognised language level is asked about, keeping the language',
  unknownLevel.unmapped.map((u) => [u.path, u.value, u.context]),
  [['languages.0.level', 'B2 nach GER', 'Spanisch']]);

check('an unparseable date is asked about rather than stored',
  normalizeProfileFields({ dateOfBirth: 'irgendwann 1980' }).unmapped.map((u) => u.path),
  ['dateOfBirth']);

check('a German date is understood',
  normalizeProfileFields({ dateOfBirth: '12.07.1980' }).fields.dateOfBirth,
  '1980-07-12');

check('a date is not shifted by the local timezone',
  normalizeProfileFields({ dateOfBirth: '1980-07-12T00:00:00.000Z' }).fields.dateOfBirth,
  '1980-07-12');

// ---- empty values never overwrite ----------------------------------------
check('empty values are dropped instead of overwriting the profile',
  Object.keys(normalizeProfileFields({ biography: '', skills: [], height: null }).fields),
  []);

// ---- the user's answers ---------------------------------------------------
const asked = normalizeProfileFields({ eyeColor: 'irisblau-meliert' });
check('an answer from the offered options is applied',
  applyResolutions(asked.fields, asked.unmapped, { eyeColor: 'blau' }).eyeColor,
  'blau');

check('__keep__ stores the platform wording verbatim',
  applyResolutions(asked.fields, asked.unmapped, { eyeColor: '__keep__' }).eyeColor,
  'irisblau-meliert');

check('an answer that was never offered is ignored',
  applyResolutions(asked.fields, asked.unmapped, { eyeColor: 'neongelb' }).eyeColor,
  undefined);

const askedLevel = normalizeProfileFields({ languages: [{ language: 'Spanisch', level: 'B2 nach GER' }] });
check('an answer about a language level lands on the right entry',
  applyResolutions(askedLevel.fields, askedLevel.unmapped, { 'languages.0.level': 'Gute Kenntnisse' }).languages,
  [{ language: 'Spanisch', level: 'Gute Kenntnisse' }]);

console.log(`\n${passed}/${passed + failed} passed.`);
process.exit(failed ? 1 : 0);
