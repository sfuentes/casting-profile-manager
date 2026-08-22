import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log format
const logFormat = winston.format.printf(
  ({
    level, message, timestamp, ...meta
  }) => `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`
);

// Create the logger
export const logger = winston.createLogger({
  // A failing log file must never crash the app - winston's default is to
  // emit an unhandled 'error' event on the logger.
  exitOnError: false,
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'darsteller-manager-api' },
  transports: [
    // Write logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        logFormat
      )
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        logFormat
      )
    })
  ]
});

// Always log to the console.
//
// This used to be added only outside production, which meant the container's
// stdout was empty and `docker logs` showed nothing at all - the logs existed
// solely as files inside the container. In a container stdout IS the log
// stream: it is what `docker logs`, Coolify's log view and any aggregator read.
// Writing only to files hid every production error behind a `docker exec`.
//
// Colour is for humans at a terminal; in production the output is likely to be
// parsed, so it is left plain there.
logger.add(new winston.transports.Console({
  format: process.env.NODE_ENV === 'production'
    ? winston.format.combine(
      winston.format.timestamp(),
      logFormat
    )
    : winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.timestamp(),
      logFormat
    )
}));

// Add a stream for Morgan
export const stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};
