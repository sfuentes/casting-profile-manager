import mongoose from 'mongoose';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';

const PlatformSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  platformId: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  connected: {
    type: Boolean,
    default: false,
  },
  lastSync: {
    type: Date,
  },
  lastTested: {
    type: Date,
  },
  testResult: {
    success: Boolean,
    message: String,
    timestamp: Date,
  },
  /**
   * How a platform is signed into, in the connector registry's own words.
   *
   * The registry is the source of truth for this and the client already reads
   * it that way - PlatformsView tests for 'manual' and 'apiKey' by name. This
   * enum did not, so three of the registry's own manifests could not be stored:
   * schauspielervideos ('apiKey') and the two manual agencies ('manual') failed
   * validation. That made `npm run add-platforms` - which builds this list from
   * the registry - throw on the platforms it was meant to create.
   *
   * 'api' stays because rows written by the seeder already use it.
   */
  authType: {
    type: String,
    enum: ['oauth', 'credentials', 'api', 'apiKey', 'manual'],
    required: true,
  },
  authData: {
    // Secret fields are encrypted at rest by the setter and decrypted by the
    // getter, so callers keep reading plain values and nothing in the app has
    // to remember to encrypt. Getters are safe to rely on here because no query
    // in this codebase uses .lean(), which would bypass them.
    token: { type: String, set: encryptSecret, get: decryptSecret },
    refreshToken: { type: String, set: encryptSecret, get: decryptSecret },
    expiresAt: Date,
    // Most platforms log in with an email address; a few use a username.
    // Both are declared because Mongoose silently drops undeclared paths -
    // an incoming `email` used to vanish on save, leaving the scraping
    // adapters to type `undefined` into the login form.
    // These are identifiers rather than secrets, so they stay readable: it
    // keeps them usable for support and lookups.
    email: String,
    username: String,
    password: { type: String, set: encryptSecret, get: decryptSecret },
    apiKey: { type: String, set: encryptSecret, get: decryptSecret },
  },
  syncSettings: {
    autoSync: {
      type: Boolean,
      default: false,
    },
    syncInterval: {
      type: String,
      enum: ['hourly', 'daily', 'weekly', 'manual'],
      default: 'daily',
    },
    syncAvailability: {
      type: Boolean,
      default: false,
    },
    syncPhotos: {
      type: Boolean,
      default: false,
    },
    syncProfile: {
      type: Boolean,
      default: true,
    },
  },
  meta: {
    hasAPI: Boolean,
    agentCapable: Boolean,
    connectionType: String,
    features: [String],
    regions: [String],
    description: String,
  },
}, {
  timestamps: true,

  // Getters must run so internal callers read decrypted credentials.
  toObject: { getters: true },

  // ...but responses must never carry them. Encrypting at rest achieves
  // nothing while the API hands the password back to the browser on every
  // platform request, which is what it did before. The client only needs to
  // know whether a credential is present, so send that instead of the value.
  toJSON: {
    getters: true,
    transform: (_doc, ret) => {
      if (ret.authData) {
        const { email, username, expiresAt } = ret.authData;
        ret.authData = {
          email,
          username,
          expiresAt,
          hasPassword: Boolean(ret.authData.password),
          hasApiKey: Boolean(ret.authData.apiKey),
          hasToken: Boolean(ret.authData.token)
        };
      }
      return ret;
    }
  }
});

// Create a compound index to ensure uniqueness per user and platform
PlatformSchema.index({ user: 1, platformId: 1 }, { unique: true });

const Platform = mongoose.model('Platform', PlatformSchema);

export default Platform;
