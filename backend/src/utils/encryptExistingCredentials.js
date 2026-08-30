/**
 * One-off migration: encrypt platform credentials written before encryption
 * existed.
 *
 * Reading a legacy row already works - decryptSecret passes plaintext through -
 * so this is not required for correctness. It is required for the plaintext to
 * actually stop being in the database.
 *
 * Usage: node src/utils/encryptExistingCredentials.js [--dry-run]
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Platform from '../models/Platform.js';
import { connectDB } from '../config/database.js';
import { isEncrypted, describeKeyProblem } from './crypto.js';

dotenv.config();

const SECRET_FIELDS = ['password', 'apiKey', 'token', 'refreshToken'];

const run = async () => {
  const dryRun = process.argv.includes('--dry-run');

  // The same specific diagnosis the server prints: this script is usually run
  // to repair a deployment, and "not set or invalid" is exactly the ambiguity
  // that sends people looking in the wrong place.
  const keyProblem = describeKeyProblem();
  if (keyProblem) {
    console.error(`${keyProblem} Generate a key with: openssl rand -hex 32`);
    process.exit(1);
  }

  await connectDB();

  const platforms = await Platform.find({});
  let migrated = 0;
  let alreadyDone = 0;

  for (const platform of platforms) {
    // Compare raw stored values, not the getter output, which would already
    // look decrypted either way.
    const plaintextFields = SECRET_FIELDS.filter((field) => {
      const raw = platform.get(`authData.${field}`, null, { getters: false });
      return typeof raw === 'string' && raw !== '' && !isEncrypted(raw);
    });

    if (plaintextFields.length === 0) {
      alreadyDone++;
      continue;
    }

    console.log(
      `platform ${platform._id} (id ${platform.platformId}): ` +
      `${plaintextFields.join(', ')}${dryRun ? ' [dry run]' : ''}`
    );

    if (!dryRun) {
      // Re-assigning runs the encrypting setter. The getter hands back
      // plaintext, so this is a genuine re-encrypt rather than a double wrap.
      for (const field of plaintextFields) {
        platform.authData[field] = platform.authData[field];
        platform.markModified(`authData.${field}`);
      }
      await platform.save();
    }
    migrated++;
  }

  console.log(
    `\n${dryRun ? 'Would encrypt' : 'Encrypted'} ${migrated} platform(s); ` +
    `${alreadyDone} already encrypted or empty.`
  );

  await mongoose.connection.close();
  process.exit(0);
};

run().catch((error) => {
  console.error('Migration failed:', error.message);
  process.exit(1);
});
