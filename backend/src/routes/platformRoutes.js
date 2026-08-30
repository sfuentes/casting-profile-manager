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
  getPlatformCatalog,
  importPlatformProfile,
  applyImportedProfile,
} from '../controllers/platformController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Declared before '/:id' so it is not captured as an id.
router.route('/catalog')
  .get(getPlatformCatalog);

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

// Reading the profile back off the platform, and applying what the user picked.
router.route('/:id/profile')
  .get(importPlatformProfile);

router.route('/:id/profile/apply')
  .post(applyImportedProfile);

router.route('/bulk-sync')
  .post(bulkSyncToPlatforms);

export default router;
