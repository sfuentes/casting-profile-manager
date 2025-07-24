import mongoose from 'mongoose';

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
  authType: {
    type: String,
    enum: ['oauth', 'credentials', 'api'],
    required: true,
  },
  authData: {
    token: String,
    refreshToken: String,
    expiresAt: Date,
    username: String,
    password: String,
    apiKey: String,
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
}, { timestamps: true });

// Create a compound index to ensure uniqueness per user and platform
PlatformSchema.index({ user: 1, platformId: 1 }, { unique: true });

const Platform = mongoose.model('Platform', PlatformSchema);

export default Platform;
