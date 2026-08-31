import mongoose from 'mongoose';

const SyncLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  platform: {
    type: Number,
    required: true,
    index: true
  },
  operation: {
    type: String,
    enum: ['push_availability', 'push_media', 'push_profile', 'pull_availability', 'pull_profile'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'partial'],
    default: 'pending',
    index: true
  },
  itemsProcessed: {
    type: Number,
    default: 0
  },
  itemsTotal: {
    type: Number,
    default: 0
  },
  /**
   * A dry run filled the forms, photographed the page and submitted nothing.
   * It is recorded because it is the evidence a push was checked before it was
   * published - but it must never be counted as a sync, which is why it is a
   * field of its own rather than a note in `metadata`. `getPlatformStatus`
   * skips these: "what happened to this platform last" means what was actually
   * written to it.
   */
  dryRun: {
    type: Boolean,
    default: false
  },
  error: {
    message: String,
    code: String,
    stack: String
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  duration: Number, // Duration in milliseconds
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Calculate duration before save
SyncLogSchema.pre('save', function(next) {
  if (this.completedAt && this.startedAt) {
    this.duration = this.completedAt - this.startedAt;
  }
  next();
});

// Index for efficient querying
SyncLogSchema.index({ user: 1, platform: 1, createdAt: -1 });
SyncLogSchema.index({ status: 1, createdAt: -1 });

// Static method to get recent sync history
SyncLogSchema.statics.getRecentHistory = function(userId, limit = 20) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get platform sync status
SyncLogSchema.statics.getPlatformStatus = function(userId, platformId) {
  return this.findOne({
    user: userId,
    platform: platformId,
    dryRun: { $ne: true }
  })
    .sort({ createdAt: -1 })
    .lean();
};

// Static method to get failed syncs that can be retried
SyncLogSchema.statics.getFailedSyncs = function(userId, maxAge = 24 * 60 * 60 * 1000) {
  const cutoffDate = new Date(Date.now() - maxAge);
  return this.find({
    user: userId,
    status: 'failed',
    createdAt: { $gte: cutoffDate }
  })
    .sort({ createdAt: -1 })
    .lean();
};

const SyncLog = mongoose.model('SyncLog', SyncLogSchema);

export default SyncLog;
