import mongoose from 'mongoose';

const AvailabilitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['available', 'partially_available', 'unavailable'],
    default: 'available',
    required: true,
  },
  reason: {
    type: String,
  },
  startDate: {
    type: Date,
    required: [true, 'Please add a start date'],
  },
  endDate: {
    type: Date,
    required: [true, 'Please add an end date'],
  },
  startTime: {
    type: String,
  },
  endTime: {
    type: String,
  },
  notes: {
    type: String,
  },
  preferredCallStart: {
    type: String,
  },
  preferredCallEnd: {
    type: String,
  },
  minimumNotice: {
    type: Number,
    default: 24,
  },
  synced: {
    type: Boolean,
    default: false,
  },
  syncedPlatforms: [{
    platformId: Number,
    syncedAt: Date,
    status: String,
  }],
}, { timestamps: true });

const Availability = mongoose.model('Availability', AvailabilitySchema);

export default Availability;
