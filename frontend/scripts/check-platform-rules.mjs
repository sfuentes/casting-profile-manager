#!/usr/bin/env node
/**
 * Checks for the platform rules, now that they are out of the component.
 *
 * These used to be inline helpers in a 1,300-line view, where the only way to
 * exercise them was to run the app and look. Each case below is one that has
 * actually gone wrong:
 *
 *   - the automation predicates read fields that do not exist on what the API
 *     returns, so every check was permanently false and the summary tiles said
 *     0 agent-capable platforms while six connectors were registered;
 *   - previewImported met {language, level} objects and rendering one directly
 *     threw "Objects are not valid as a React child", taking the dialog down;
 *   - sourceLabel met both a bare locator string and the {platform, location}
 *     object that replaced it, and had to keep reading the old one.
 *
 *   node scripts/check-platform-rules.mjs
 */
import {
    isAutomated, isApiBased, canImportProfile, canSyncCredits, hasStoredCredentials,
    platformStatusColor, connectionTypeText, syncIntervalText,
    sourceLabel, previewImported, importFieldLabel
} from '../src/domain/platforms.js';

let passed = 0;
let failed = 0;

const check = (name, actual, expected) => {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) { passed += 1; console.log(`  ok    ${name}`); }
    else { failed += 1; console.log(`  FAIL  ${name}\n        expected ${e}\n        got      ${a}`); }
};

const days = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

// ---- what kind of integration a platform has -------------------------------

check('a credentials platform is automated', isAutomated({authType: 'credentials'}), true);
check('an apiKey platform is automated', isAutomated({authType: 'apiKey'}), true);
check('a manual platform is not', isAutomated({authType: 'manual'}), false);
check('a platform with no authType is not', isAutomated({}), false);
check('undefined is not automated, and does not throw', isAutomated(undefined), false);
check('only apiKey counts as API-based', [isApiBased({authType: 'apiKey'}), isApiBased({authType: 'credentials'})], [true, false]);

check('the connector decides whether import is offered',
    [canImportProfile({capabilities: ['verify', 'pullProfile']}), canImportProfile({capabilities: ['verify']})],
    [true, false]);
check('and whether the Vita button is offered',
    [canSyncCredits({capabilities: ['pushWorkHistory']}), canSyncCredits({capabilities: []})],
    [true, false]);

// ---- retrying a login without retyping the password ------------------------

check('a stored password means a test can be retried',
    hasStoredCredentials({authData: {hasPassword: true}}), true);
check('an api key counts too', hasStoredCredentials({authData: {hasApiKey: true}}), true);
check('presence flags absent means nothing to retry with',
    hasStoredCredentials({authData: {email: 'x@y.z'}}), false);
check('a platform with no record at all', hasStoredCredentials(undefined), false);

// ---- how fresh a connection looks ------------------------------------------

check('not connected is grey', platformStatusColor({connected: false}), 'gray');
check('connected and synced today is green',
    platformStatusColor({connected: true, lastSync: days(1)}), 'green');
check('connected but stale for over a week is yellow',
    platformStatusColor({connected: true, lastSync: days(9)}), 'yellow');
check('connected and never synced is green, not stale',
    platformStatusColor({connected: true}), 'green');

// ---- wording ---------------------------------------------------------------

check('the three auth kinds each read as something',
    ['manual', 'apiKey', 'credentials', 'oauth'].map((authType) => connectionTypeText({authType})),
    ['Manuell', 'API-Integration', 'Agent-basiert', 'Unbekannt']);
check('an unknown sync interval is passed through rather than blanked',
    [syncIntervalText('daily'), syncIntervalText('fortnightly')], ['Täglich', 'fortnightly']);
check('a field with no German label keeps its key', importFieldLabel('shoeSize'), 'shoeSize');
check('and one with a label gets it', importFieldLabel('eyeColor'), 'Augenfarbe');

// ---- where an imported value came from -------------------------------------

check('a source object names the platform and the place',
    sourceLabel({platform: 'jobwork', platformName: 'JobWork', location: 'graphql:profileAbout'}),
    'JobWork · graphql:profileAbout');
check('an older import stored a bare string and still reads',
    sourceLabel('edit?section=vita_entries'), 'edit?section=vita_entries');
check('no source renders nothing at all', sourceLabel(undefined), '');

// ---- previewing an imported value ------------------------------------------

check('languages are objects and must not reach React raw',
    previewImported([{language: 'Deutsch', level: 'Muttersprache'}, {language: 'Englisch', level: 'Fließend'}]),
    'Deutsch (Muttersprache), Englisch (Fließend)');
check('education entries are named by institution',
    previewImported([{institution: 'Actor Factory'}, {institution: 'UdK'}]),
    'Actor Factory · UdK');
check('a list of objects with no known shape is counted',
    previewImported([{production: 'GZSZ'}, {production: 'Tatort'}]), '2 Einträge');
check('plain strings are joined', previewImported(['Reiten', 'Klavier']), 'Reiten, Klavier');
check('an empty list is a dash', previewImported([]), '-');
check('an object is spelled out', previewImported({email: 'a@b.c'}), 'email: a@b.c');
check('a plain value is itself', previewImported(178), '178');

console.log(`\n${passed}/${passed + failed} passed.`);
process.exit(failed ? 1 : 0);
