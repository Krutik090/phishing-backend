// src/middleware/rateLimiter.js
const { RateLimiterMemory, RateLimiterMongo } = require('rate-limiter-flexible');
const mongoose = require('mongoose');
const logger = require('../config/logger');
const config = require('../config/environment');

// Use MongoDB for distributed rate limiting in production (multi-instance support)
// Use in-memory for development
const createRateLimiter = () => {
    if (config.nodeEnv === 'production' && mongoose.connection.readyState === 1) {
        return new RateLimiterMongo({
            storeClient: mongoose.connection,
            points: 100, // Number of requests
            duration: 15 * 60, // Per 15 minutes
            blockDuration: 15 * 60, // Block for 15 minutes if exceeded
        });
    }
    
    return new RateLimiterMemory({
        points: 100,
        duration: 15 * 60,
        blockDuration: 15 * 60,
    });
};

// General API rate limiter
const rateLimiter = createRateLimiter();

const rateLimitMiddleware = async (req, res, next) => {
    try {
        await rateLimiter.consume(req.ip);
        next();
    } catch (rejRes) {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many requests, please try again later.',
            retryAfter: Math.ceil(rejRes.msBeforeNext / 1000),
        });
    }
};

// Strict rate limiter for authentication endpoints (prevent brute force)
const authRateLimiter = new RateLimiterMemory({
    points: 5, // 5 attempts
    duration: 15 * 60, // per 15 minutes
    blockDuration: 60 * 60, // block for 1 hour
});

const authRateLimitMiddleware = async (req, res, next) => {
    try {
        await authRateLimiter.consume(req.ip);
        next();
    } catch (rejRes) {
        logger.warn(`Auth rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
        res.status(429).json({
            success: false,
            message: 'Too many login attempts. Please try again after 1 hour.',
        });
    }
};

module.exports = {
    rateLimitMiddleware,
    authRateLimitMiddleware,
};
