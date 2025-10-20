// src/middleware/errorHandler.js
const logger = require('../config/logger');
const config = require('../config/environment');

/**
 * Custom API Error class for consistent error handling
 */
class ApiError extends Error {
    constructor(statusCode, message, isOperational = true, stack = '') {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Global error handler middleware
 * SOC 2: Never expose sensitive system details in production
 */
const errorHandler = (err, req, res, next) => {
    let { statusCode = 500, message } = err;

    // Log error details for audit (SOC 2 Processing Integrity)
    logger.error({
        message: err.message,
        statusCode,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id || 'unauthenticated',
    });

    // In production, don't expose internal error details
    if (config.nodeEnv === 'production' && !err.isOperational) {
        statusCode = 500;
        message = 'Internal Server Error';
    }

    // Send error response
    res.status(statusCode).json({
        success: false,
        message,
        ...(config.nodeEnv === 'development' && { stack: err.stack }),
    });
};

/**
 * Catch-all for unhandled routes (404)
 */
const notFound = (req, res, next) => {
    const error = new ApiError(404, `Route ${req.originalUrl} not found`);
    next(error);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    errorHandler,
    notFound,
    asyncHandler,
    ApiError,
};
