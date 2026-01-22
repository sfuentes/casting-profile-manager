import express from 'express';
import {
  getPlatforms,
  getPlatform,
  connectPlatform,
  disconnectPlatform,
  updatePlatformSettings,
  testPlatformConnection,
  syncToPlatform,
  bulkSyncToPlatforms,
  initiateOAuth,
  handleOAuthCallback,
} from '../controllers/platformController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.route('/')
  .get(getPlatforms);

router.route('/:id')
  .get(getPlatform);

router.route('/:id/connect')
  .post(connectPlatform);

router.route('/:id/disconnect')
  .post(disconnectPlatform);

router.route('/:id/settings')
  .put(updatePlatformSettings);

router.route('/:id/test')
  .post(testPlatformConnection);

router.route('/:id/sync')
  .post(syncToPlatform);

router.route('/bulk-sync')
  .post(bulkSyncToPlatforms);

router.route('/:id/oauth/initiate')
  .get(initiateOAuth);

router.route('/:id/oauth/callback')
  .get(handleOAuthCallback);

export default router;
