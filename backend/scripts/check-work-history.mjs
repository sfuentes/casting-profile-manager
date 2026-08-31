#!/usr/bin/env node
/**
 * Checks for reconciling credits across platforms.
 *
 * The cases here are taken from the real account, because they are the ones
 * that decide the design. "GZSZ" appears twice in the same year with two
 * different roles - two jobs, not one - so production alone cannot identify a
 * credit. And the same credit is spelled differently on two sites, so an exact
 * string match cannot identify one either.
 *
 * Getting it wrong is not symmetric: merging two credits loses a job from a CV
 * quietly, splitting one writes a duplicate onto a public profile that someone
 * then has to delete by hand.
 *
 *   node scripts/check-work-history.mjs
 */
import {
  canonical, isSameCredit, diffWorkHistory, mergeWorkHistory, describe,
  nearMatches, reconcileWorkHistory, applyCreditResolutions, ADD_AS_NEW, editDistance
} from '../src/connectors/workHistory.js';

let passed = 0;
let failed = 0;

const check = (name, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed += 1; console.log(`  ok    ${name}`); }
  else { failed += 1; console.log(`  FAIL  ${name}\n        expected ${e}\n        got      ${a}`); }
};

// ---- what counts as the same credit ---------------------------------------

check('the same credit spelled with a different dash and case still matches',
  isSameCredit(
    { production: 'GZSZ - Das Maß ist Voll', role: 'Party Gast', year: '2025' },
    { production: 'GZSZ – Das Maß ist voll', role: 'Party  Gast', year: '2025' }),
  true);

check('one production, two roles, is two credits',
  isSameCredit(
    { production: 'GZSZ', role: 'Komparse - Besucher', year: '2025' },
    { production: 'GZSZ', role: 'Kinobesitzer', year: '2025' }),
  false);

check('the same role in a different year is a different credit',
  isSameCredit(
    { production: 'Tatort', role: 'Nachbar', year: '2024' },
    { production: 'Tatort', role: 'Nachbar', year: '2025' }),
  false);

check('a missing year on one side does not split a credit in two',
  isSameCredit(
    { production: 'Tatort', role: 'Nachbar', year: '2024' },
    { production: 'Tatort', role: 'Nachbar' }),
  true);

check('a platform that calls the production "title" is understood',
  isSameCredit(
    { title: 'Dünentod 8 / 9', role: 'Komparse - Dorfbewohner', year: '2025' },
    { production: 'Dünentod 8 / 9', role: 'Komparse - Dorfbewohner', year: '2025' }),
  true);

check('accents are not folded away - that would be a guess',
  isSameCredit({ production: 'Dünentod', role: 'x' }, { production: 'Dunentod', role: 'x' }),
  false);

check('an entry with no production matches nothing',
  isSameCredit({ role: 'Nachbar', year: '2024' }, { role: 'Nachbar', year: '2024' }),
  false);

check('a year inside a range is read',
  isSameCredit({ production: 'X', role: 'y', year: '2025 - 2025' }, { production: 'X', role: 'y', year: '2025' }),
  true);

check('a role on one side only does not split a credit either',
  isSameCredit(
    { production: 'Berlin Tag und Nacht', year: '2022' },
    { production: 'Berlin Tag und Nacht', role: 'Komparse', year: '2022' }),
  true);

check('but two named roles in one production stay two credits',
  isSameCredit(
    { production: 'GZSZ', role: 'Kinobesitzer', year: '2025' },
    { production: 'GZSZ', role: 'Komparse - Besucher', year: '2025' }),
  false);

// ---- the diff -------------------------------------------------------------

const ours = [
  { production: 'GZSZ', role: 'Kinobesitzer', year: '2025' },
  { production: 'Tatort', role: 'Nachbar', year: '2024' },
  { production: 'Ein Hof zum Verlieben', role: 'Familien Vater', year: '2025' }
];
const theirs = [
  { production: 'GZSZ', role: 'Kinobesitzer', year: '2025' },
  { production: 'GZSZ', role: 'Komparse - Besucher', year: '2025' },
  { production: 'Ein Hof zum Verlieben', role: 'Familien Vater', year: '2025' }
];
const diff = diffWorkHistory(ours, theirs);

check('what the platform lacks is what would be added',
  diff.missing.map((e) => e.production), ['Tatort']);
check('what both have is left alone',
  diff.shared.map((e) => e.production), ['GZSZ', 'Ein Hof zum Verlieben']);
check('what only the platform has is reported, not pushed',
  diff.theirsOnly.map((e) => e.role), ['Komparse - Besucher']);

check('two identical credits on our side do not both match one of theirs',
  diffWorkHistory(
    [{ production: 'X', role: 'y', year: '2025' }, { production: 'X', role: 'y', year: '2025' }],
    [{ production: 'X', role: 'y', year: '2025' }]
  ).missing.length,
  1);

check('nothing to compare is not a crash', diffWorkHistory().missing, []);

check('an entry without a production is never pushed',
  diffWorkHistory([{ role: 'Nachbar' }], []).missing, []);

// ---- merging several platforms --------------------------------------------

const merged = mergeWorkHistory([
  [{ production: 'GZSZ', role: 'Kinobesitzer', year: '2025', company: 'RTL' }],
  [{ production: 'GZSZ', role: 'Kinobesitzer', year: '2025', director: 'Regie Name' }],
  [{ production: 'Tatort', role: 'Nachbar', year: '2024' }]
]);

check('the same credit from two platforms is one credit', merged.length, 2);
check('a field only one platform carries survives the merge',
  [merged[0].company, merged[0].director], ['RTL', 'Regie Name']);
check('a placeholder dash does not overwrite a real value',
  mergeWorkHistory([
    [{ production: 'X', role: 'y', company: 'RTL' }],
    [{ production: 'X', role: 'y', company: '-' }]
  ])[0].company,
  'RTL');
check('a placeholder dash is filled in by a real value',
  mergeWorkHistory([
    [{ production: 'X', role: 'y', company: '-' }],
    [{ production: 'X', role: 'y', company: 'SAT1' }]
  ])[0].company,
  'SAT1');

check('a credit reads back as one line',
  describe({ production: 'Lenßen hilft', role: 'Sascha Krüger', year: '2025', company: 'SAT1' }),
  '2025 Lenßen hilft als Sascha Krüger (SAT1)');

check('canonical collapses spacing and punctuation', canonical(' GZSZ –  Das Maß! '), 'gzsz das maß');

// ---- what cannot be decided is asked, not guessed ---------------------------

const mine = [
  { production: 'Jefferey Bernard fühlt sich nicht', role: 'Diverse Nebenrollen', year: '2025' },
  { production: 'Berlin Tag und Nacht - 2985', role: 'Inkasso Mitarbeiter', year: '2023' },
  { production: 'Ein völlig neuer Film', role: 'Hauptrolle', year: '2026' },
  { production: 'Lenßen hilft - Der tote Goldesel', role: 'Bösewicht, Jochen Bauer', year: '2024' }
];
const platform = [
  { production: 'Jeffrey Bernard fühlt sich nicht', role: 'Diverse Nebenrollen', year: '2025' },
  { production: 'Berlin Tag und Nacht', role: 'Inkasso Mitarbeiter', year: '2023' },
  { production: 'Lenßen hilft - Der tote Goldesel', role: 'Jochen Bach', year: '2024' }
];
const plan = reconcileWorkHistory(mine, platform);

check('a credit nothing resembles is added without asking',
  plan.missing.map((e) => e.production), ['Ein völlig neuer Film']);

check('a one-letter difference in the title is asked about, not merged',
  plan.questions.some((q) => q.credit.includes('Jefferey')), true);

check('an episode number against a bare series title is asked about',
  plan.questions.some((q) => q.credit.includes('2985')), true);

check('the same production with a different role is asked about',
  plan.questions.some((q) => q.credit.includes('Goldesel')), true);

check('every question offers the credit it might be, and "add anyway"',
  plan.questions[0].options.map((o) => o.value), ['same:0', ADD_AS_NEW]);

check('a question says why it is being asked',
  plan.questions.find((q) => q.credit.includes('2985')).options[0].reason,
  'one title is part of the other');

check('an uncertain credit is never quietly in the additions', plan.missing.length, 1);

// ---- the answers ----------------------------------------------------------

check('no answer adds nothing - a question left alone changes nothing',
  applyCreditResolutions(plan.questions, {}).add, []);

check('"add anyway" adds exactly that credit',
  applyCreditResolutions(plan.questions, { [plan.questions[0].path]: ADD_AS_NEW })
    .add.map((e) => e.production), ['Jefferey Bernard fühlt sich nicht']);

check('answering "it is the same credit" adds nothing',
  applyCreditResolutions(plan.questions, { [plan.questions[0].path]: 'same:0' }).add, []);

check('an answer that was never offered is ignored',
  applyCreditResolutions(plan.questions, { [plan.questions[0].path]: 'same:99' }).add, []);

check('a year both sides record and disagree on is not an open question',
  nearMatches({ production: 'Tatort', role: 'A', year: '2024' },
    [{ production: 'Tatort', role: 'B', year: '2025' }]), []);

check('a credit that matches outright is never also a question',
  nearMatches({ production: 'X', role: 'y', year: '2025' },
    [{ production: 'X', role: 'y', year: '2025' }]), []);

check('edit distance gives up rather than running long',
  editDistance('abcdefgh', 'zzzzzzzz', 2) > 2, true);

console.log(`\n${passed}/${passed + failed} passed.`);
process.exit(failed ? 1 : 0);
