import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export const connectDB = async () => {
  try {
    // Build the URI from individual variables so that special characters in the
    // password (e.g. from `openssl rand -base64`) are safely URL-encoded.
    // Fall back to a pre-built MONGO_URI only when the individual credentials
    // are not available (local dev / custom setups).
    let uri;
    if (process.env.MONGO_ROOT_PASSWORD) {
      const username = encodeURIComponent(process.env.MONGO_ROOT_USERNAME || 'admin');
      const password = encodeURIComponent(process.env.MONGO_ROOT_PASSWORD);
      const host     = process.env.MONGO_HOST || 'mongodb';
      const port     = process.env.MONGO_PORT || '27017';
      const db       = process.env.MONGO_DB   || 'darsteller-manager';
      uri = `mongodb://${username}:${password}@${host}:${port}/${db}?authSource=admin`;
    } else {
      uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/darsteller-manager';
    }

    logger.info(`Connecting to MongoDB: ${uri.replace(/\/\/.*@/, '//***@')}`);
    const conn = await mongoose.connect(uri, {
      family: 4
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    return conn;
  } catch (error) {
    logger.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};
