#!/usr/bin/env node
/**
 * Can every platform the registry knows actually be stored?
 *
 * The registry is the source of truth for what a platform is, and the client
 * already reads it that way. The Platform schema did not: its `authType` enum
 * allowed three values while the registry produced five, so schauspielervideos
 * ('apiKey') and the two manual agencies ('manual') could not be written at
 * all. `npm run add-platforms` builds the user's platform list *from the
 * registry*, so it threw on exactly the platforms it existed to create - and
 * nothing said so until someone tried.
 *
 * Nothing here is a list to maintain. The platforms come from the registry and
 * the rules come from the schema; if the two drift apart again, this fails.
 *
 *   node scripts/check-manifests.mjs
 */
import mongoose from 'mongoose';

// The model must load without a database and without a real key: it is the
// schema that is under test, not a connection.
process.env.CREDENTIAL_ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || 'a'.repeat(64);

const { listManifests } = await import('../src/connectors/registry.js');
const { default: Platform } = await import('../src/models/Platform.js');

let passed = 0;
let failed = 0;

const check = (name, ok, detail = '') => {
  if (ok) { passed += 1; console.log(`  ok    ${name}`); }
  else { failed += 1; console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`); }
};

const manifests = listManifests();
check('the registry has platforms to check', manifests.length > 0);

for (const manifest of manifests) {
  const doc = new Platform({
    user: new mongoose.Types.ObjectId(),
    platformId: manifest.id,
    name: manifest.name,
    authType: manifest.authType
  });
  const error = doc.validateSync();
  check(`${manifest.key}: can be stored as the registry declares it`,
    !error,
    error && Object.values(error.errors).map((e) => e.message).join('; '));
}

// Identity: two connectors claiming one id or key is a silent takeover, and the
// registry already throws on it - this states the expectation out loud.
const ids = manifests.map((m) => m.id);
const keys = manifests.map((m) => m.key);
check('every platform id is unique', new Set(ids).size === ids.length);
check('every platform key is unique', new Set(keys).size === keys.length);

for (const manifest of manifests) {
  check(`${manifest.key}: names its credential fields or asks for none`,
    Array.isArray(manifest.credentialFields));
  check(`${manifest.key}: declares its capabilities as a list`,
    Array.isArray(manifest.capabilities));
}

console.log(`\n${passed}/${passed + failed} passed.`);
process.exit(failed ? 1 : 0);
