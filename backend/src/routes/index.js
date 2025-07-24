import authRoutes from './authRoutes.js';
import profileRoutes from './profileRoutes.js';
import bookingRoutes from './bookingRoutes.js';
import optionRoutes from './optionRoutes.js';
import availabilityRoutes from './availabilityRoutes.js';
import platformRoutes from './platformRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import { notFound } from '../middleware/errorHandler.js';

export const setupRoutes = (app) => {
  // API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/profile', profileRoutes);
  app.use('/api/v1/bookings', bookingRoutes);
  app.use('/api/v1/options', optionRoutes);
  app.use('/api/v1/availability', availabilityRoutes);
  app.use('/api/v1/platforms', platformRoutes);
  app.use('/api/v1/upload', uploadRoutes);

  // Health check route
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API documentation route
  app.get('/api/docs', (req, res) => {
    res.status(200).json({
      message: 'API Documentation',
      version: '1.0.0',
      endpoints: [
        { path: '/api/v1/auth', description: 'Authentication endpoints' },
        { path: '/api/v1/profile', description: 'Profile management' },
        { path: '/api/v1/bookings', description: 'Booking management' },
        { path: '/api/v1/options', description: 'Option management' },
        { path: '/api/v1/availability', description: 'Availability management' },
        { path: '/api/v1/platforms', description: 'Platform integration' },
        { path: '/api/v1/upload', description: 'File upload endpoints' },
      ]
    });
  });

  // Handle 404 - Not Found
  app.use(notFound);
};
