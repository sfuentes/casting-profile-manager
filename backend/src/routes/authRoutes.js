import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updatePassword,
  updateDetails,
  verifyEmail,
  refreshToken,
  deleteAccount
} from '../controllers/authController.js';
import { protect, authorize } from '../middleware/auth.js';
import { validateRegister, validateLogin, validatePasswordUpdate } from '../middleware/validation.js';

const router = express.Router();

// Rate limiting for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public authentication routes
router.post('/register', authLimiter, validateRegister, register);
router.post('/login', authLimiter, validateLogin, login);
router.post('/logout', logout);

// Email verification
router.get('/verify-email/:token', verifyEmail);

// Password reset routes
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.put('/reset-password/:resetToken', passwordResetLimiter, resetPassword);

// Token refresh
router.post('/refresh-token', refreshToken);

// Protected routes - require authentication
router.use(protect); // All routes after this middleware require authentication

// User profile routes
router.get('/me', getMe);
router.put('/update-details', validateRegister, updateDetails);
router.put('/update-password', validatePasswordUpdate, updatePassword);
router.delete('/delete-account', deleteAccount);

// Admin only routes
router.get('/admin/users', authorize('admin'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin users endpoint - implement in controller'
  });
});

// Health check for auth service
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication service is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;