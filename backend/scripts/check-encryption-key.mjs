/**
 * Diagnose CREDENTIAL_ENCRYPTION_KEY as the running container sees it.
 *
 *   docker exec <backend-container> node scripts/check-encryption-key.mjs
 *
 * The point is to distinguish "the variable never reached this process" from
 * "the value is the wrong shape" — the startup log used to collapse both into
 * one message, and the two have completely different fixes.
 *
 * The key is never printed. Length, a character position and a SHA-256 prefix
 * are enough to compare against what is configured in Coolify, and safe to
 * paste into a bug report.
 */
import crypto from 'crypto';
import { describeKeyProblem } from '../src/utils/crypto.js';

const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;

console.log('CREDENTIAL_ENCRYPTION_KEY');
if (raw === undefined) {
  console.log('  present in this process : NO');
  console.log('');
  console.log('  The variable did not reach the container. This is a Coolify /');
  console.log('  compose wiring problem, not a bad value — the value itself is');
  console.log('  never even read. Check that the backend service in');
  console.log('  docker-compose.coolify.yml declares it under `environment:`.');
  process.exit(1);
}

const trimmed = raw.trim();
console.log('  present in this process : yes');
console.log(`  characters              : ${raw.length}${raw.length === trimmed.length ? '' : ` (${trimmed.length} after trimming whitespace)`}`);
console.log(`  expected                : 64`);

const bad = trimmed.search(/[^0-9a-fA-F]/);
if (bad !== -1) {
  const ch = trimmed[bad];
  const shown = ch === '"' ? 'a double quote' : ch === "'" ? 'a single quote' : ch === ' ' ? 'a space' : `'${ch}'`;
  console.log(`  first non-hex character : position ${bad + 1} (${shown})`);
} else {
  console.log('  first non-hex character : none');
}

// A fingerprint of the key, not the key. Lets you confirm the container has the
// same value you pasted into Coolify without either of you reading it out.
console.log(`  sha256 fingerprint      : ${crypto.createHash('sha256').update(trimmed).digest('hex').slice(0, 16)}`);

const problem = describeKeyProblem();
console.log('');
if (problem) {
  console.log(`  USABLE: no — ${problem}`);
  process.exit(1);
}

// Prove it end to end rather than just validating the shape.
const { encryptSecret, decryptSecret, isEncrypted } = await import('../src/utils/crypto.js');
const sample = 'round-trip-probe';
const enc = encryptSecret(sample);
const ok = isEncrypted(enc) && decryptSecret(enc) === sample;
console.log(`  USABLE: ${ok ? 'yes — encrypt/decrypt round-trip passed' : 'no — round-trip FAILED'}`);
process.exit(ok ? 0 : 1);
