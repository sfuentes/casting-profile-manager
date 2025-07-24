import mongoose from 'mongoose';

const OptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Please add a title'],
  },
  production: {
    type: String,
  },
  role: {
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
  location: {
    type: String,
  },
  fee: {
    type: String,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'declined', 'expired'],
    default: 'pending',
  },
  notes: {
    type: String,
  },
  contactPerson: {
    name: String,
    email: String,
    phone: String,
  },
  expiryDate: {
    type: Date,
  },
}, { timestamps: true });

const Option = mongoose.model('Option', OptionSchema);

export default Option;
