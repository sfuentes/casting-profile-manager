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

const HEX_CHARS = KEY_BYTES * 2;

/**
 * Why the configured key cannot be used, or null when it is fine.
 *
 * Deliberately specific, and deliberately free of the value itself. On a
 * container that refuses to start, this one line is the entire evidence a
 * deploy leaves behind - and "missing or invalid" covers two problems with
 * completely different fixes: the variable never reaching the container, or
 * reaching it in the wrong format.
 *
 * The format traps are worth naming, because Buffer.from(x, 'hex') hides them:
 * it stops at the first character that is not hex and returns a short buffer,
 * so a base64 key, a value someone wrapped in quotes, and a truncated key all
 * arrive as the same unhelpful byte count.
 */
export const describeKeyProblem = () => {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;

  if (raw === undefined) {
    return 'CREDENTIAL_ENCRYPTION_KEY is not set: the variable never reached this '
      + 'container. Check that it exists in the deployment environment and is '
      + 'available at runtime, not only at build time.';
  }

  const value = raw.trim();

  if (value === '') {
    return 'CREDENTIAL_ENCRYPTION_KEY is set but empty.';
  }

  if (/^(["']).*\1$/.test(value)) {
    return 'CREDENTIAL_ENCRYPTION_KEY is wrapped in quotes. Store the bare value, '
      + 'without surrounding quotation marks.';
  }

  const firstNonHex = value.search(/[^0-9a-fA-F]/);
  if (firstNonHex !== -1) {
    const looksBase64 = /[+/=]/.test(value);

    return `CREDENTIAL_ENCRYPTION_KEY contains a non-hex character at position ${firstNonHex + 1} `
      + `of ${value.length}.${
        looksBase64
          ? ' The value looks base64-encoded; this key must be hex. Generate it with'
          + ' openssl rand -hex 32, not openssl rand -base64 32.'
          : ' Expected only the characters 0-9 and a-f.'}`;
  }

  if (value.length !== HEX_CHARS) {
    return `CREDENTIAL_ENCRYPTION_KEY is ${value.length} hex characters; `
      + `a ${KEY_BYTES}-byte key is exactly ${HEX_CHARS}.`;
  }

  return null;
};

/**
 * Resolve the encryption key. Cached because this runs on every field access.
 * @throws {Error} when the key is missing or malformed
 */
const getKey = () => {
  if (cachedKey) return cachedKey;

  const problem = describeKeyProblem();
  if (problem) {
    throw new Error(
      `${problem} Platform credentials cannot be stored or read without a valid key.`
    );
  }

  cachedKey = Buffer.from(process.env.CREDENTIAL_ENCRYPTION_KEY.trim(), 'hex');

  return cachedKey;
};

/** Test seam: forget the cached key so a changed env var takes effect. */
export const resetKeyCache = () => {
  cachedKey = null;
};

/** True once a usable key is configured. Never throws. */
export const isEncryptionConfigured = () => {
  try {
    getKey();

    return true;
  } catch {
    return false;
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
export const isEncrypted = (value) => typeof value === 'string' && value.startsWith(`${PREFIX}:`);

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
