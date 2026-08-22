import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { xssSanitize } from './middleware/xssSanitize.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Import utilities and config
import { connectDB } from './config/database.js';
import { isEncryptionConfigured } from './utils/crypto.js';
import { logger, stream } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import platformRoutes from './routes/platformRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import availabilityRoutes from './routes/availabilityRoutes.js';
import optionRoutes from './routes/optionRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import syncRoutes from './routes/syncRoutes.js';
import agentRoutes from './routes/agentRoutes.js';

// Load environment variables
dotenv.config();

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Credential encryption key
// Platform credentials are encrypted at rest, so without this key the app can
// neither store new ones nor read existing ones. Refuse to start in production
// rather than failing later, per user, on the first sync attempt.
if (!isEncryptionConfigured()) {
  const message =
    'CREDENTIAL_ENCRYPTION_KEY is missing or invalid. Platform credentials ' +
    'cannot be encrypted. Generate one with: openssl rand -hex 32';
  if (process.env.NODE_ENV === 'production') {
    logger.error(message);
    process.exit(1);
  }
  logger.warn(`${message} (continuing outside production)`);
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Proxy trust
// In production the app runs behind Coolify's Traefik proxy, so the real client
// IP arrives in the X-Forwarded-For header rather than on the socket. Without
// this setting express-rate-limit throws a ValidationError, and every request
// would be keyed to the proxy's own IP - collapsing all clients into a single
// rate-limit bucket.
//
// Trust a hop COUNT, never `true`. With `true` Express believes the leftmost
// X-Forwarded-For entry, which is supplied by the client and therefore
// spoofable: anyone could forge an IP and bypass the rate limiter. A count
// makes Express read the entry the proxy itself appended.
//
// Default: 1 hop in production (Traefik), disabled elsewhere so local
// development and tests see the real socket address. Raise TRUST_PROXY_HOPS if
// you put another proxy (e.g. Cloudflare) in front of Coolify.
const trustProxyHops = parseInt(process.env.TRUST_PROXY_HOPS, 10);
app.set(
  'trust proxy',
  Number.isInteger(trustProxyHops)
    ? trustProxyHops
    : process.env.NODE_ENV === 'production' ? 1 : false
);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 600000, // 10 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes
app.use('/api', limiter);

// CORS configuration
// In production, FRONTEND_URL may be a single URL or a comma-separated list.
// If FRONTEND_URL is not set, allow all origins so the app is not silently broken.
const productionOrigin = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((u) => u.trim())
  : true;

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? productionOrigin
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security middleware
app.use(xssSanitize()); // Prevent XSS attacks
app.use(mongoSanitize()); // Prevent NoSQL injection

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream }));
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/platforms', platformRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/options', optionRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/agent', agentRoutes);

// Welcome route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Platform Integration API',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    documentation: '/api/docs',
  });
});

// Handle 404 for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global error handling middleware
app.use(errorHandler);

// Graceful shutdown function
const gracefulShutdown = (server) => (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown:', err);
      process.exit(1);
    }

    logger.info('Server closed successfully');
    process.exit(0);
  });
};

// Start server
const startServer = async () => {
  try {
    // Connect to database (skip in test environment)
    if (process.env.NODE_ENV !== 'test') {
      await connectDB();
      logger.info('Connected to MongoDB successfully');
    }

    // Start the server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      logger.info(`📱 API available at http://localhost:${PORT}`);
      logger.info(`🔍 Health check at http://localhost:${PORT}/health`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', gracefulShutdown(server));
    process.on('SIGINT', gracefulShutdown(server));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      logger.error('Unhandled Promise Rejection:', err);
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
