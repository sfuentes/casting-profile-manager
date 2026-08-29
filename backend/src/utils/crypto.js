import crypto from 'crypto';

/**
 * Symmetric encryption for platform credentials at rest.
 *
 * These are the user's real passwords for third-party casting sites. Unlike the
 * user's own account password - which is hashed and never needs recovering -
 * these must be decryptable, because the connectors replay them into a login
 * form. So they are encrypted, not hashed, and the key lives outside the
 * database.
 *
 * AES-256-GCM is used for authentication as well as secrecy: a tampered
 * ciphertext fails to decrypt rather than silently yielding garbage that would
 * then be typed into someone's login form.
 */

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1';
const IV_BYTES = 12; // 96 bits, the size GCM is specified for
const KEY_BYTES = 32;

let cachedKey = null;

/**
 * Resolve the encryption key. Cached because this runs on every field access.
 * @throws {Error} when the key is missing or malformed
 */
const getKey = () => {
  if (cachedKey) return cachedKey;

  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY is not set. Platform credentials cannot be ' +
      'stored or read without it. Generate one with: openssl rand -hex 32'
    );
  }

  const trimmed = raw.trim();

  // Buffer.from(x, 'hex') is lenient: it decodes up to the first character that
  // is not a hex digit and returns the prefix, with no error. A quoted value, a
  // base64 key, or a single typo therefore all arrive here as "wrong length"
  // and used to surface as the same unhelpful "missing or invalid". Find the
  // offending character first so the message can name the actual problem.
  const badIndex = trimmed.search(/[^0-9a-fA-F]/);
  if (badIndex !== -1) {
    throw new Error(
      `CREDENTIAL_ENCRYPTION_KEY contains a non-hexadecimal character at ` +
      `position ${badIndex + 1} of ${trimmed.length}. Expected ${KEY_BYTES * 2} ` +
      'hex characters (0-9, a-f) and nothing else - no quotes, no whitespace, ' +
      'not base64. Generate one with: openssl rand -hex 32'
    );
  }

  if (trimmed.length !== KEY_BYTES * 2) {
    throw new Error(
      `CREDENTIAL_ENCRYPTION_KEY is ${trimmed.length} hex characters; ` +
      `expected exactly ${KEY_BYTES * 2} (${KEY_BYTES} bytes). ` +
      'Generate one with: openssl rand -hex 32'
    );
  }

  const key = Buffer.from(trimmed, 'hex');
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `CREDENTIAL_ENCRYPTION_KEY must be ${KEY_BYTES} bytes as hex ` +
      `(${KEY_BYTES * 2} characters); got ${key.length} bytes. ` +
      'Generate one with: openssl rand -hex 32'
    );
  }

  cachedKey = key;
  return cachedKey;
};

/** Test seam: forget the cached key so a changed env var takes effect. */
export const resetKeyCache = () => {
  cachedKey = null;
};

/** True once a usable key is configured. Never throws. */
export const isEncryptionConfigured = () => getKeyProblem() === null;

/**
 * Why the key is unusable, or null when it is fine. Never throws.
 *
 * The value itself is never included: the message reports lengths and a
 * position so a misconfiguration is diagnosable from the container log without
 * printing the key into it.
 */
export const getKeyProblem = () => {
  try {
    getKey();
    return null;
  } catch (error) {
    return error.message;
  }
};

/**
 * Encrypt a secret. Returns `enc:v1:<iv>:<tag>:<ciphertext>`, all base64.
 * Empty and non-string values pass through untouched so optional fields stay
 * empty rather than becoming ciphertext of "".
 */
export const encryptSecret = (plaintext) => {
  if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext;
  if (typeof plaintext !== 'string') return plaintext;
  if (isEncrypted(plaintext)) return plaintext; // already encrypted; do not double-wrap

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64')
  ].join(':');
};

/** Whether a value carries our envelope. */
export const isEncrypted = (value) =>
  typeof value === 'string' && value.startsWith(`${PREFIX}:`);

/**
 * Decrypt a value produced by encryptSecret.
 *
 * Values without the envelope are returned unchanged: rows written before
 * encryption existed hold plaintext, and they must keep working until they are
 * migrated or re-saved.
 */
export const decryptSecret = (value) => {
  if (!isEncrypted(value)) return value;

  const parts = value.split(':');
  if (parts.length !== 5) {
    throw new Error('Encrypted credential is malformed');
  }

  const [, , ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final()
  ]).toString('utf8');
};
