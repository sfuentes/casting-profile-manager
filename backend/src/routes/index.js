/**
 * @deprecated This file is not used. Routes are registered directly in src/index.js.
 * Kept for reference only.
 *
 * Active route registration happens in backend/src/index.js under /api/*
 * (not /api/v1/* as shown below).
 */

import authRoutes from './authRoutes.js';
import profileRoutes from './profileRoutes.js';
import bookingRoutes from './bookingRoutes.js';
import optionRoutes from './optionRoutes.js';
import availabilityRoutes from './availabilityRoutes.js';
import platformRoutes from './platformRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import syncRoutes from './syncRoutes.js';
import agentRoutes from './agentRoutes.js';
import { notFound } from '../middleware/errorHandler.js';

export const setupRoutes = (app) => {
  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/options', optionRoutes);
  app.use('/api/availability', availabilityRoutes);
  app.use('/api/platforms', platformRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/sync', syncRoutes);
  app.use('/api/agent', agentRoutes);

  // Health check route
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Handle 404 - Not Found
  app.use(notFound);
};
