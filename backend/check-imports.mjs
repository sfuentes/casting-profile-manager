import { readdirSync, statSync } from 'fs';
import { pathToFileURL } from 'url';
const SKIP = new Set([
  'src/index.js',
  'src/utils/seeder.js',
  'src/utils/encryptExistingCredentials.js',
  'src/utils/addPlatformsToExistingUsers.js',
  'src/utils/fixPlatformAuthTypes.js',
]);
const files = [];
(function walk(d){
  for (const e of readdirSync(d)) {
    const p = d + '/' + e;
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.js')) files.push(p);
  }
})('src');
let ok = 0, fail = 0; const skipped = [];
for (const f of files.sort()) {
  if (SKIP.has(f)) { skipped.push(f); continue; }
  try { await import(pathToFileURL(f).href); ok++; }
  catch (e) { fail++; console.log('FAIL ' + f + ' :: ' + e.constructor.name + ': ' + e.message.split('\n')[0]); }
}
console.log('\n' + ok + ' OK / ' + fail + ' FAILED / ' + skipped.length + ' skipped of ' + files.length);
console.log('skipped (top-level side effects): ' + skipped.join(', '));
process.exit(fail ? 1 : 0);
