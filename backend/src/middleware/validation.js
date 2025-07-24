import validator from 'validator';
import { body, validationResult } from 'express-validator';

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }

  next();
};

// Custom validators
const customValidators = {
  isStrongPassword: (value) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumbers = /\d/.test(value);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);

    return value.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
  },

  isValidName: (value) => {
    const nameRegex = /^[a-zA-Z\s'-]{2,50}$/;

    return nameRegex.test(value);
  },

  isValidPhone: (value) => {
    if (!value) return true; // Phone is optional

    return validator.isMobilePhone(value, 'any', { strictMode: false });
  }
};

// Registration validation rules
export const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .custom(customValidators.isValidName)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email is too long'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .custom(customValidators.isStrongPassword)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('confirmPassword')
    .notEmpty()
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }

      return true;
    }),

  body('phone')
    .optional()
    .trim()
    .custom(customValidators.isValidPhone)
    .withMessage('Please provide a valid phone number'),

  body('role')
    .optional()
    .isIn(['user', 'admin', 'moderator'])
    .withMessage('Role must be either user, admin, or moderator'),

  body('acceptTerms')
    .optional()
    .isBoolean()
    .withMessage('Accept terms must be a boolean value'),

  handleValidationErrors
];

// Login validation rules
export const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1 })
    .withMessage('Password cannot be empty'),

  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('Remember me must be a boolean value'),

  handleValidationErrors
];

// Password update validation rules
export const validatePasswordUpdate = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .custom(customValidators.isStrongPassword)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('confirmNewPassword')
    .notEmpty()
    .withMessage('New password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('New password confirmation does not match new password');
      }

      return true;
    }),

  handleValidationErrors
];

// Profile update validation rules
export const validateProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .custom(customValidators.isValidName)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email is too long'),

  body('phone')
    .optional()
    .trim()
    .custom(customValidators.isValidPhone)
    .withMessage('Please provide a valid phone number'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location cannot exceed 100 characters'),

  handleValidationErrors
];

// Forgot password validation rules
export const validateForgotPassword = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  handleValidationErrors
];

// Reset password validation rules
export const validateResetPassword = [
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .custom(customValidators.isStrongPassword)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('confirmPassword')
    .notEmpty()
    .withMessage('Password confirmation is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }

      return true;
    }),

  handleValidationErrors
];

// Email validation rules
export const validateEmail = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email is too long'),

  handleValidationErrors
];

// Generic validation for common fields
export const validateCommonFields = {
  id: body('id')
    .isMongoId()
    .withMessage('Invalid ID format'),

  limit: body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  page: body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  sort: body('sort')
    .optional()
    .isIn(['name', 'email', 'createdAt', 'updatedAt', '-name', '-email', '-createdAt', '-updatedAt'])
    .withMessage('Invalid sort field')
};

// Custom validation middleware for file uploads
export const validateFileUpload = (fieldName, options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif'],
    required = false
  } = options;

  return (req, res, next) => {
    const file = req.files?.[fieldName] || req.file;

    if (!file && required) {
      return res.status(400).json({
        success: false,
        message: `${fieldName} is required`
      });
    }

    if (file) {
      // Check file size
      if (file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: `${fieldName} size cannot exceed ${maxSize / (1024 * 1024)}MB`
        });
      }

      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: `${fieldName} must be one of: ${allowedTypes.join(', ')}`
        });
      }
    }

    next();
  };
};

// Sanitization middleware
export const sanitizeInput = (req, res, next) => {
  // Recursively sanitize all string values in req.body
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = validator.escape(obj[key].trim());
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  next();
};

export default {
  validateRegister,
  validateLogin,
  validatePasswordUpdate,
  validateProfileUpdate,
  validateForgotPassword,
  validateResetPassword,
  validateEmail,
  validateCommonFields,
  validateFileUpload,
  sanitizeInput,
  handleValidationErrors
};
