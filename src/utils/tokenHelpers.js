// src/utils/tokenHelpers.js
const jwt = require('jsonwebtoken');
const config = require('../config/environment');

/**
 * Generate JWT access and refresh tokens
 */
const generateTokens = (payload) => {
    const accessToken = jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
    });

    const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, {
        expiresIn: config.jwtRefreshExpiresIn,
    });

    return { accessToken, refreshToken };
};

/**
 * Set secure httpOnly cookies for tokens (SOC 2 Security)
 * Never store JWT in localStorage - vulnerable to XSS
 */
const setTokenCookies = (res, accessToken, refreshToken) => {
    const cookieOptions = {
        httpOnly: true, // Prevents XSS attacks
        secure: config.nodeEnv === 'production', // HTTPS only in production
        sameSite: 'strict', // CSRF protection
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    res.cookie('accessToken', accessToken, {
        ...cookieOptions,
        maxAge: 60 * 60 * 1000, // 1 hour
    });

    res.cookie('refreshToken', refreshToken, cookieOptions);
};

/**
 * Clear authentication cookies
 */
const clearTokenCookies = (res) => {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
};

/**
 * Verify JWT token
 */
const verifyToken = (token, secret) => {
    try {
        return jwt.verify(token, secret);
    } catch (error) {
        return null;
    }
};

module.exports = {
    generateTokens,
    setTokenCookies,
    clearTokenCookies,
    verifyToken,
};
