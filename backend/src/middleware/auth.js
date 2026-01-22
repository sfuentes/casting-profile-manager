import jwt from 'jsonwebtoken';
import { ApiError } from './errorHandler.js';
import User from '../models/User.js';

// Protect routes - requires authentication
export const protect = async (req, res, next) => {
  let token;

  // Get token from Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Get token from cookie
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Check if token exists
  if (!token) {
    return next(new ApiError('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new ApiError('User no longer exists', 401));
    }

    // Check if user changed password after token was issued
    if (user.passwordChangedAfter && user.passwordChangedAfter(decoded.iat)) {
      return next(new ApiError('User recently changed password. Please log in again', 401));
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    return next(new ApiError('Not authorized to access this route', 401));
  }
};

// Role-based authorization middleware
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(`Role ${req.user.role} is not authorized to access this route`, 403));
  }
  next();
};
