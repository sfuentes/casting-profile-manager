import crypto from 'crypto';
import User from '../models/User.js';
import Platform from '../models/Platform.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { asyncHandler as catchAsync } from '../middleware/asyncHandler.js';
// import sendEmail from '../utils/sendEmail.js';

// Default platforms to add for all new users
const DEFAULT_PLATFORMS = [
  {
    platformId: 1,
    name: 'Filmmakers',
    authType: 'oauth',
    connected: false,
    meta: {
      hasAPI: true,
      agentCapable: true,
      connectionType: 'oauth',
      features: ['profile', 'media', 'bookings'],
      regions: ['DE', 'AT', 'CH'],
      description: 'Largest casting platform in German-speaking region'
    }
  },
  {
    platformId: 2,
    name: 'Casting Network',
    authType: 'api',
    connected: false,
    meta: {
      hasAPI: true,
      agentCapable: true,
      connectionType: 'api_key',
      features: ['profile', 'media', 'bookings', 'recommendations'],
      regions: ['US', 'UK', 'CA', 'AU'],
      description: 'International casting platform for professional actors'
    }
  },
  {
    platformId: 3,
    name: 'Schauspielervideos',
    authType: 'api',
    connected: false,
    meta: {
      hasAPI: true,
      agentCapable: true,
      connectionType: 'api_key',
      features: ['profile', 'videos', 'photos', 'showreel'],
      regions: ['DE', 'AT', 'CH'],
      description: 'German actor video platform'
    }
  },
  {
    platformId: 4,
    name: 'e-TALENTA',
    authType: 'api',
    connected: false,
    meta: {
      hasAPI: true,
      agentCapable: true,
      connectionType: 'api_key',
      features: ['profile', 'photos', 'availability', 'castings'],
      regions: ['EU', 'DE', 'AT', 'CH'],
      description: 'European casting network'
    }
  },
  {
    platformId: 5,
    name: 'JobWork',
    authType: 'oauth',
    connected: false,
    meta: {
      hasAPI: true,
      agentCapable: true,
      connectionType: 'oauth',
      features: ['profile', 'jobs', 'networking'],
      regions: ['DE', 'AT', 'CH'],
      description: 'Platform for commercial and model castings'
    }
  },
  {
    platformId: 6,
    name: 'Agentur Iris Müller',
    authType: 'credentials',
    connected: false,
    meta: {
      hasAPI: false,
      agentCapable: false,
      connectionType: 'manual',
      features: ['profile', 'representation'],
      regions: ['DE'],
      description: 'Traditional talent agency'
    }
  },
  {
    platformId: 7,
    name: 'Agentur Connection',
    authType: 'api',
    connected: false,
    meta: {
      hasAPI: true,
      agentCapable: false,
      connectionType: 'api',
      features: ['profile', 'representation', 'bookings'],
      regions: ['DE', 'AT'],
      description: 'Professional talent agency'
    }
  },
  {
    platformId: 8,
    name: 'Agentur Sarah Weiss',
    authType: 'credentials',
    connected: false,
    meta: {
      hasAPI: false,
      agentCapable: false,
      connectionType: 'manual',
      features: ['profile', 'representation'],
      regions: ['DE'],
      description: 'Boutique talent agency'
    }
  },
  {
    platformId: 9,
    name: 'Wanted',
    authType: 'oauth',
    connected: false,
    meta: {
      hasAPI: true,
      agentCapable: true,
      connectionType: 'oauth',
      features: ['profile', 'jobs', 'availability'],
      regions: ['DE', 'AT', 'CH'],
      description: 'Entertainment job portal'
    }
  }
];

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRE || 30) * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  // Add secure flag in production
  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  // Update last login time
  user.lastLogin = Date.now();
  user.save({ validateBeforeSave: false });

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
export const register = catchAsync(async (req, res, next) => {
  const {
    name, email, password, role
  } = req.body;

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role
  });

  // Create verification token
  const verificationToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to verificationToken field
  user.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  await user.save({ validateBeforeSave: false });

  // Create default platforms for the new user
  try {
    const platformsToCreate = DEFAULT_PLATFORMS.map(platform => ({
      ...platform,
      user: user._id
    }));
    await Platform.insertMany(platformsToCreate);
    logger.info(`Created ${platformsToCreate.length} default platforms for user ${user.email}`);
  } catch (platformError) {
    logger.error('Failed to create default platforms:', platformError);
    // Continue with registration even if platform creation fails
  }

  // Create verification url
  const verificationUrl = `${req.protocol}://${req.get(
    'host'
  )}/api/auth/verifyemail/${verificationToken}`;

  const message = `You are receiving this email because you need to verify your email address. Please make a GET request to: \n\n ${verificationUrl}`;

  try {
    // In a real implementation, we would send an email here
    // await sendEmail({
    //   email: user.email,
    //   subject: 'Email verification',
    //   message
    // });

    res.status(200).json({
      success: true,
      message: 'Email verification token sent to email',
      verificationUrl // Only included for development testing
    });
  } catch (err) {
    user.emailVerificationToken = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ApiError('Email could not be sent', 500));
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email & password
  if (!email || !password) {
    return next(new ApiError('Please provide an email and password', 400));
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ApiError('Invalid credentials', 401));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ApiError('Invalid credentials', 401));
  }

  // Send token response
  sendTokenResponse(user, 200, res);
});

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
export const logout = catchAsync(async (req, res, next) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
export const updateDetails = catchAsync(async (req, res, next) => {
  const fieldsToUpdate = {
    name: req.body.name,
    email: req.body.email
  };

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
export const updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');

  // Check current password
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return next(new ApiError('Password is incorrect', 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
export const forgotPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(new ApiError('There is no user with that email', 404));
  }

  // Get reset token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  user.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire
  user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  await user.save({ validateBeforeSave: false });

  // Create reset url
  const resetUrl = `${req.protocol}://${req.get(
    'host'
  )}/api/auth/resetpassword/${resetToken}`;

  const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

  try {
    // In a real implementation, we would send an email here
    // await sendEmail({
    //   email: user.email,
    //   subject: 'Password reset token',
    //   message
    // });

    res.status(200).json({
      success: true,
      message: 'Email sent',
      resetUrl // Only included for development testing
    });
  } catch (err) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save({ validateBeforeSave: false });

    return next(new ApiError('Email could not be sent', 500));
  }
});

// @desc    Reset password
// @route   PUT /api/auth/resetpassword/:resettoken
// @access  Public
export const resetPassword = catchAsync(async (req, res, next) => {
  // Get hashed token
  const resetPasswordToken = crypto
    .createHash('sha256')
    .update(req.params.resettoken)
    .digest('hex');

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ApiError('Invalid token', 400));
  }

  // Set new password
  user.password = req.body.password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// @desc    Verify email
// @route   GET /api/auth/verifyemail/:token
// @access  Public
export const verifyEmail = catchAsync(async (req, res, next) => {
  // Get hashed token
  const emailVerificationToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    emailVerificationToken
  });

  if (!user) {
    return next(new ApiError('Invalid token', 400));
  }

  // Mark email as verified
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    message: 'Email verified successfully'
  });
});

export const refreshToken = catchAsync(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: 'Refresh token endpoint - implement in controller'
  });
});

export const deleteAccount = catchAsync(async (req, res, next) => {
  res.status(200).json({
    success: true,
    message: 'Delete account endpoint - implement in controller'
  });
});
