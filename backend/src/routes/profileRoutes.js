import express from 'express';
import {
  getProfile,
  updateProfile,
  addWorkHistory,
  updateWorkHistory,
  deleteWorkHistory,
  addEducation,
  updateEducation,
  deleteEducation,
  syncProfileToPlatforms,
} from '../controllers/profileController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.route('/')
  .get(getProfile)
  .put(updateProfile);

router.route('/work-history')
  .post(addWorkHistory);

router.route('/work-history/:id')
  .put(updateWorkHistory)
  .delete(deleteWorkHistory);

router.route('/education')
  .post(addEducation);

router.route('/education/:id')
  .put(updateEducation)
  .delete(deleteEducation);

router.post('/sync', syncProfileToPlatforms);

export default router;
