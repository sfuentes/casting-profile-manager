import express from 'express';
import {
  getBookings,
  getBooking,
  addBooking,
  updateBooking,
  deleteBooking,
} from '../controllers/bookingController.js';
import { demoAuth } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(demoAuth);

router.route('/')
  .get(getBookings)
  .post(addBooking);

router.route('/:id')
  .get(getBooking)
  .put(updateBooking)
  .delete(deleteBooking);

export default router;
