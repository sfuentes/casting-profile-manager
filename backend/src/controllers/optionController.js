import Option from '../models/Option.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

// @desc    Get all options
// @route   GET /api/v1/options
// @access  Private
export const getOptions = async (req, res, next) => {
  try {
    const options = await Option.find({ user: req.user.id });

    res.status(200).json({
      success: true,
      count: options.length,
      data: options
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single option
// @route   GET /api/v1/options/:id
// @access  Private
export const getOption = async (req, res, next) => {
  try {
    const option = await Option.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!option) {
      throw new ApiError(`Option not found with id of ${req.params.id}`, 404);
    }

    res.status(200).json({
      success: true,
      data: option
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new option
// @route   POST /api/v1/options
// @access  Private
export const addOption = async (req, res, next) => {
  try {
    // Add user to req.body
    req.body.user = req.user.id;

    // Validate dates
    const { startDate, endDate } = req.body;
    if (new Date(endDate) < new Date(startDate)) {
      throw new ApiError('End date cannot be before start date', 400);
    }

    const option = await Option.create(req.body);

    res.status(201).json({
      success: true,
      data: option
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update option
// @route   PUT /api/v1/options/:id
// @access  Private
export const updateOption = async (req, res, next) => {
  try {
    let option = await Option.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!option) {
      throw new ApiError(`Option not found with id of ${req.params.id}`, 404);
    }

    // Validate dates if updating
    if (req.body.startDate && req.body.endDate) {
      if (new Date(req.body.endDate) < new Date(req.body.startDate)) {
        throw new ApiError('End date cannot be before start date', 400);
      }
    }

    option = await Option.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: option
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete option
// @route   DELETE /api/v1/options/:id
// @access  Private
export const deleteOption = async (req, res, next) => {
  try {
    const option = await Option.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!option) {
      throw new ApiError(`Option not found with id of ${req.params.id}`, 404);
    }

    await option.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Option deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
