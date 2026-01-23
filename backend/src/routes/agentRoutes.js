import express from 'express';
import { protect } from '../middleware/auth.js';
import { checkAgentHealth } from '../controllers/agentController.js';

const router = express.Router();

/**
 * @route   GET /api/agent/health
 * @desc    Check agent health status
 * @access  Private
 */
router.get('/health', protect, checkAgentHealth);

export default router;
