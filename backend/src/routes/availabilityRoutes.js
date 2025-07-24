import express from 'express';
import {
  getAvailability,
  getAvailabilityItem,
  addAvailability,
  updateAvailabilityItem,
  deleteAvailability,
  syncAvailabilityToPlatforms,
} from '../controllers/availabilityController.js';
import { demoAuth } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(demoAuth);

router.route('/')
  .get(getAvailability)
  .post(addAvailability);

router.route('/:id')
  .get(getAvailabilityItem)
  .put(updateAvailabilityItem)
  .delete(deleteAvailability);

router.post('/sync', syncAvailabilityToPlatforms);

export default router;
