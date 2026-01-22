import express from 'express';
import {
  getOptions,
  getOption,
  addOption,
  updateOption,
  deleteOption,
} from '../controllers/optionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes are protected
router.use(protect);

router.route('/')
  .get(getOptions)
  .post(addOption);

router.route('/:id')
  .get(getOption)
  .put(updateOption)
  .delete(deleteOption);

export default router;
