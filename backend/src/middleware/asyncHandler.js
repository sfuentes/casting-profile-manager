import mongoose from 'mongoose';

/**
 * Async handler middleware to wrap async route handlers and catch errors
 * This eliminates the need for try-catch blocks in every async controller
 *
 * @param {Function} fn - The async function to wrap
 * @returns {Function} - Express middleware function
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        // Execute the async function and catch any errors
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Higher-order function that creates an async handler with custom error handling
 *
 * @param {Function} fn - The async function to wrap
 * @param {Object} options - Configuration options
 * @param {Function} options.onError - Custom error handler
 * @param {boolean} options.logErrors - Whether to log errors (default: true)
 * @returns {Function} - Express middleware function
 */
export const createAsyncHandler = (fn, options = {}) => {
    const { onError, logErrors = true } = options;

    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((error) => {
            if (logErrors) {
                console.error('Async handler error:', {
                    error: error.message,
                    stack: error.stack,
                    url: req.originalUrl,
                    method: req.method,
                    userId: req.user?.id,
                    timestamp: new Date().toISOString()
                });
            }

            if (onError) {
                return onError(error, req, res, next);
            }

            next(error);
        });
    };
};

/**
 * Specialized async handler for database operations
 * Includes automatic transaction rollback on error
 *
 * @param {Function} fn - The async function to wrap
 * @param {Object} options - Configuration options
 * @returns {Function} - Express middleware function
 */
export const dbAsyncHandler = (fn, options = {}) => {
    const { useTransaction = false } = options;

    return asyncHandler(async (req, res, next) => {
        if (useTransaction) {
            const session = await mongoose.startSession();
            session.startTransaction();

            try {
                req.session = session;
                const result = await fn(req, res, next);
                await session.commitTransaction();
                return result;
            } catch (error) {
                await session.abortTransaction();
                throw error;
            } finally {
                session.endSession();
            }
        } else {
            return await fn(req, res, next);
        }
    });
};

export default asyncHandler;