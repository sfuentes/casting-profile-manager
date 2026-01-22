import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

export const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/darsteller-manager';
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
