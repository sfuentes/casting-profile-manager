import Booking from '../models/Booking.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

// @desc    Get all bookings
// @route   GET /api/v1/bookings
// @access  Private
export const getBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user.id });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single booking
// @route   GET /api/v1/bookings/:id
// @access  Private
export const getBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!booking) {
      throw new ApiError(`Booking not found with id of ${req.params.id}`, 404);
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new booking
// @route   POST /api/v1/bookings
// @access  Private
export const addBooking = async (req, res, next) => {
  try {
    // Add user to req.body
    req.body.user = req.user.id;

    // Validate dates
    const { startDate, endDate } = req.body;
    if (new Date(endDate) < new Date(startDate)) {
      throw new ApiError('End date cannot be before start date', 400);
    }

    const booking = await Booking.create(req.body);

    res.status(201).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update booking
// @route   PUT /api/v1/bookings/:id
// @access  Private
export const updateBooking = async (req, res, next) => {
  try {
    let booking = await Booking.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!booking) {
      throw new ApiError(`Booking not found with id of ${req.params.id}`, 404);
    }

    // Validate dates if updating
    if (req.body.startDate && req.body.endDate) {
      if (new Date(req.body.endDate) < new Date(req.body.startDate)) {
        throw new ApiError('End date cannot be before start date', 400);
      }
    }

    booking = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete booking
// @route   DELETE /api/v1/bookings/:id
// @access  Private
export const deleteBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!booking) {
      throw new ApiError(`Booking not found with id of ${req.params.id}`, 404);
    }

    await booking.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Booking deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
