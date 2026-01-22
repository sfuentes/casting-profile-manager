import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['tv', 'film', 'theater', 'commercial', 'other'],
    default: 'other',
  },
  status: {
    type: String,
    enum: ['confirmed', 'pending', 'cancelled'],
    default: 'confirmed',
  },
  notes: {
    type: String,
  },
  contactPerson: {
    name: String,
    email: String,
    phone: String,
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'partial', 'not_paid'],
    default: 'pending',
  },
}, { timestamps: true });

const Booking = mongoose.model('Booking', BookingSchema);

export default Booking;
