import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  syncAvailability,
  syncMedia,
  syncProfile,
  getSyncHistory,
  getSyncStatus,
  retrySync,
  bulkSync
} from '../controllers/syncController.js';

const router = express.Router();

// All sync routes require authentication
router.use(protect);

/**
 * @route   POST /api/sync/availability/:platformId
 * @desc    Sync availability to a specific platform
 * @access  Private
 */
router.post('/availability/:platformId', syncAvailability);

/**
 * @route   POST /api/sync/media/:platformId
 * @desc    Sync media to a specific platform
 * @access  Private
 */
router.post('/media/:platformId', syncMedia);

/**
 * @route   POST /api/sync/profile/:platformId
 * @desc    Sync profile to a specific platform
 * @access  Private
 */
router.post('/profile/:platformId', syncProfile);

/**
 * @route   GET /api/sync/history
 * @desc    Get sync history for current user
 * @access  Private
 */
router.get('/history', getSyncHistory);

/**
 * @route   GET /api/sync/status/:platformId
 * @desc    Get sync status for a specific platform
 * @access  Private
 */
router.get('/status/:platformId', getSyncStatus);

/**
 * @route   POST /api/sync/retry/:syncLogId
 * @desc    Retry a failed sync
 * @access  Private
 */
router.post('/retry/:syncLogId', retrySync);

/**
 * @route   POST /api/sync/bulk
 * @desc    Sync to multiple platforms at once
 * @access  Private
 */
router.post('/bulk', bulkSync);

export default router;
