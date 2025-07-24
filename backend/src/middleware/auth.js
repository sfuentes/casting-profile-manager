import jwt from 'jsonwebtoken';
import { ApiError } from './errorHandler.js';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        throw new ApiError('User not found', 401);
      }

      next();
    } catch (error) {
      next(new ApiError('Not authorized, token failed', 401));
    }
  }

  if (!token) {
    next(new ApiError('Not authorized, no token', 401));
  }
};
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errorHandler.js';
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
    return next(new AppError('Not authorized to access this route', 401));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }

    // Check if user changed password after token was issued
    if (user.passwordChangedAfter && user.passwordChangedAfter(decoded.iat)) {
      return next(new AppError('User recently changed password. Please log in again', 401));
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    return next(new AppError('Not authorized to access this route', 401));
  }
};

// Demo authentication middleware for development purposes
export const demoAuth = (req, res, next) => {
  // For demo purposes, we'll add a demo user to the request
  req.user = {
    id: '60d0fe4f5311236168a109ca', // Demo user ID
    name: 'Demo User',
    email: 'demo@example.com',
    role: 'user'
  };
  next();
};

// Role-based authorization middleware
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError(`Role ${req.user.role} is not authorized to access this route`, 403));
    }
    next();
  };
};
// For demo/development mode
export const demoAuth = (req, res, next) => {
  if (process.env.NODE_ENV === 'development' && req.headers.authorization === 'Bearer demo-token') {
    req.user = {
      id: 'demo-user-id',
      name: 'Demo User',
      email: 'demo@example.com',
      role: 'user'
    };
    return next();
  }

  return protect(req, res, next);
};
