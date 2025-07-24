import mongoose from 'mongoose';
import validator from 'validator';

// Configuration constants
const PASSWORD_CONFIG = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
  PATTERNS: {
    UPPERCASE: /[A-Z]/,
    LOWERCASE: /[a-z]/,
    NUMBERS: /\d/,
    SPECIAL_CHARS: /[!@#$%^&*(),.?":{}|<>]/
  },
  COMMON_PATTERNS: [
    /(.)\1{2,}/, // Repeated characters
    /123456/, // Sequential numbers
    /abcdef/, // Sequential letters
    /qwerty/i, // Common keyboard patterns
    /password/i // Contains "password"
  ],
  STRENGTH_THRESHOLDS: {
    STRONG: 5,
    MEDIUM: 3
  }
};

const EMAIL_MAX_LENGTH = 254;
const FILE_DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const PAGINATION_MAX_LIMIT = 100;
const TIME_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

const ALLOWED_SORT_FIELDS = [
  'createdAt', '-createdAt',
  'updatedAt', '-updatedAt',
  'name', '-name',
  'email', '-email',
  'startDate', '-startDate',
  'endDate', '-endDate'
];

const DEFAULT_ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const DEFAULT_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];

// Helper function to create validation result objects
const createValidationResult = (isValid = false, errors = [], additionalProps = {}) => ({
  isValid,
  errors: Array.isArray(errors) ? errors : [errors],
  ...additionalProps
});

// Password validation helper functions
const validatePasswordLength = (password) => {
  const errors = [];
  if (password.length < PASSWORD_CONFIG.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters long`);
  }
  if (password.length > PASSWORD_CONFIG.MAX_LENGTH) {
    errors.push(`Password cannot exceed ${PASSWORD_CONFIG.MAX_LENGTH} characters`);
  }

  return errors;
};

const validatePasswordCharacters = (password) => {
  const errors = [];
  const { PATTERNS } = PASSWORD_CONFIG;

  if (!PATTERNS.UPPERCASE.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!PATTERNS.LOWERCASE.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!PATTERNS.NUMBERS.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!PATTERNS.SPECIAL_CHARS.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return errors;
};

const validatePasswordPatterns = (password) => {
  const hasCommonPattern = PASSWORD_CONFIG.COMMON_PATTERNS.some((pattern) => pattern.test(password));

  return hasCommonPattern ? ['Password contains common patterns that should be avoided'] : [];
};

const calculatePasswordStrength = (password) => {
  const { PATTERNS, STRENGTH_THRESHOLDS } = PASSWORD_CONFIG;

  // eslint-disable-next-line no-shadow
  const calculateScore = (password) => {
    const criteria = [
      () => PATTERNS.UPPERCASE.test(password),
      () => PATTERNS.LOWERCASE.test(password),
      () => PATTERNS.NUMBERS.test(password),
      () => PATTERNS.SPECIAL_CHARS.test(password),
      () => password.length >= 12,
      () => password.length >= 16
    ];

    return criteria.filter((criterion) => criterion()).length;
  };

  const score = calculateScore(password);

  if (score >= STRENGTH_THRESHOLDS.STRONG) return 'strong';
  if (score >= STRENGTH_THRESHOLDS.MEDIUM) return 'medium';

  return 'weak';
};

/**
 * Validate if a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @returns {boolean} - True if valid ObjectId, false otherwise
 */
export const validateObjectId = (id) => {
  if (!id) return false;

  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
};

/**
 * Validate multiple ObjectIds
 * @param {Array} ids - Array of IDs to validate
 * @returns {Object} - Object with valid and invalid IDs
 */
export const validateObjectIds = (ids) => {
  if (!Array.isArray(ids)) {
    return { valid: [], invalid: [ids] };
  }
  const valid = [];
  const invalid = [];
  ids.forEach((id) => {
    if (validateObjectId(id)) {
      valid.push(id);
    } else {
      invalid.push(id);
    }
  });

  return { valid, invalid };
};

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;

  return validator.isEmail(email) && email.length <= EMAIL_MAX_LENGTH;
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - Validation result with details
 */
export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return createValidationResult(false, 'Password is required', { strength: 'weak' });
  }

  const errors = [
    ...validatePasswordLength(password),
    ...validatePasswordCharacters(password),
    ...validatePasswordPatterns(password)
  ];

  const strength = calculatePasswordStrength(password);

  return createValidationResult(errors.length === 0, errors, { strength });
};

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @param {string} locale - Locale for validation (default: 'any')
 * @returns {boolean} - True if valid phone number
 */
export const validatePhone = (phone, locale = 'any') => {
  if (!phone) return true; // Phone is typically optional

  return validator.isMobilePhone(phone, locale, { strictMode: false });
};

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @param {Object} options - Validation options
 * @returns {boolean} - True if valid URL
 */
export const validateUrl = (url, options = {}) => {
  const defaultOptions = {
    protocols: ['http', 'https'],
    require_protocol: true,
    ...options
  };
  if (!url) return false;

  return validator.isURL(url, defaultOptions);
};

/**
 * Validate date string
 * @param {string} dateString - Date string to validate
 * @returns {Object} - Validation result
 */
export const validateDate = (dateString) => {
  if (!dateString) {
    return createValidationResult(false, 'Date is required', { date: null });
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return createValidationResult(false, 'Invalid date format', { date: null });
  }

  return createValidationResult(true, [], { date });
};

/**
 * Validate date range
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @returns {Object} - Validation result
 */
export const validateDateRange = (startDate, endDate) => {
  const startValidation = validateDate(startDate);
  const endValidation = validateDate(endDate);
  const errors = [];

  if (!startValidation.isValid) {
    errors.push(`Start date: ${startValidation.errors.join(', ')}`);
  }
  if (!endValidation.isValid) {
    errors.push(`End date: ${endValidation.errors.join(', ')}`);
  }

  if (startValidation.isValid && endValidation.isValid) {
    if (endValidation.date < startValidation.date) {
      errors.push('End date cannot be before start date');
    }
  }

  return createValidationResult(errors.length === 0, errors);
};

/**
 * Validate time string (HH:MM format)
 * @param {string} timeString - Time string to validate
 * @returns {Object} - Validation result
 */
export const validateTime = (timeString) => {
  if (!timeString) {
    return createValidationResult(false, 'Time is required');
  }

  if (!TIME_REGEX.test(timeString)) {
    return createValidationResult(false, 'Time must be in HH:MM format (24-hour)');
  }

  return createValidationResult(true);
};

/**
 * Validate time range
 * @param {string} startTime - Start time string
 * @param {string} endTime - End time string
 * @returns {Object} - Validation result
 */
export const validateTimeRange = (startTime, endTime) => {
  const startValidation = validateTime(startTime);
  const endValidation = validateTime(endTime);
  const errors = [];

  if (!startValidation.isValid) {
    errors.push(`Start time: ${startValidation.errors.join(', ')}`);
  }
  if (!endValidation.isValid) {
    errors.push(`End time: ${endValidation.errors.join(', ')}`);
  }

  if (startValidation.isValid && endValidation.isValid) {
    const startDate = new Date(`2000-01-01T${startTime}`);
    const endDate = new Date(`2000-01-01T${endTime}`);
    if (endDate <= startDate) {
      errors.push('End time must be after start time');
    }
  }

  return createValidationResult(errors.length === 0, errors);
};

/**
 * Validate numeric range
 * @param {number} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {Object} - Validation result
 */
export const validateNumericRange = (value, min, max) => {
  if (value === undefined || value === null) {
    return createValidationResult(false, 'Value is required');
  }

  const numValue = Number(value);
  if (isNaN(numValue)) {
    return createValidationResult(false, 'Value must be a number');
  }

  const errors = [];
  if (min !== undefined && numValue < min) {
    errors.push(`Value must be at least ${min}`);
  }
  if (max !== undefined && numValue > max) {
    errors.push(`Value cannot exceed ${max}`);
  }

  return createValidationResult(errors.length === 0, errors);
};

/**
 * Validate pagination parameters
 * @param {Object} params - Pagination parameters
 * @returns {Object} - Validated and sanitized parameters
 */
export const validatePagination = (params = {}) => {
  const { page = 1, limit = 10, sort = '-createdAt' } = params;
  const result = {
    page: Math.max(1, parseInt(page, 10) || 1),
    limit: Math.min(PAGINATION_MAX_LIMIT, Math.max(1, parseInt(limit, 10) || 10)),
    sort: String(sort),
    errors: []
  };

  if (!ALLOWED_SORT_FIELDS.includes(result.sort)) {
    result.sort = '-createdAt';
    result.errors.push('Invalid sort field, defaulting to -createdAt');
  }

  return result;
};

/**
 * Sanitize string input
 * @param {string} input - Input string to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} - Sanitized string
 */
export const sanitizeString = (input, options = {}) => {
  if (!input || typeof input !== 'string') return '';

  const {
    trim = true,
    escape = true,
    maxLength = null,
    allowedChars = null
  } = options;

  let sanitized = input;

  if (trim) {
    sanitized = sanitized.trim();
  }
  if (escape) {
    sanitized = validator.escape(sanitized);
  }
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  if (allowedChars) {
    const regex = new RegExp(`[^${allowedChars}]`, 'g');
    sanitized = sanitized.replace(regex, '');
  }

  return sanitized;
};

/**
 * Validate file upload
 * @param {Object} file - File object
 * @param {Object} options - Validation options
 * @returns {Object} - Validation result
 */
export const validateFile = (file, options = {}) => {
  const {
    maxSize = FILE_DEFAULT_MAX_SIZE,
    allowedTypes = DEFAULT_ALLOWED_FILE_TYPES,
    allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS,
    required = false
  } = options;

  if (!file) {
    return createValidationResult(!required, required ? 'File is required' : []);
  }

  const errors = [];

  if (file.size > maxSize) {
    errors.push(`File size cannot exceed ${maxSize / (1024 * 1024)}MB`);
  }

  if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
    errors.push(`File type must be one of: ${allowedTypes.join(', ')}`);
  }

  if (allowedExtensions.length > 0 && file.originalname) {
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)) {
      errors.push(`File extension must be one of: ${allowedExtensions.join(', ')}`);
    }
  }

  return createValidationResult(errors.length === 0, errors);
};

/**
 * Create a custom validator function
 * @param {Function} validatorFn - Custom validation function
 * @param {string} errorMessage - Error message for failed validation
 * @returns {Function} - Validator function
 */
export const createValidator = (validatorFn, errorMessage = 'Validation failed') => (value, options = {}) => {
  try {
    const isValid = validatorFn(value, options);

    return createValidationResult(Boolean(isValid), isValid ? [] : errorMessage);
  } catch (error) {
    return createValidationResult(false, error.message || errorMessage);
  }
};

export default {
  validateObjectId,
  validateObjectIds,
  validateEmail,
  validatePassword,
  validatePhone,
  validateUrl,
  validateDate,
  validateDateRange,
  validateTime,
  validateTimeRange,
  validateNumericRange,
  validatePagination,
  sanitizeString,
  validateFile,
  createValidator
};
