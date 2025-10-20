// src/config/environment.js
const dotenv = require('dotenv');
dotenv.config();

const config = {
    port: process.env.PORT || 5000,
    mongoUri: process.env.MONGODB_URI || '',
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '', // Add refresh token support
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    cookieSecret: process.env.COOKIE_SECRET || '', // For signed cookies
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12, // Configurable salt rounds
};

// Strict validation for production
if (config.nodeEnv === 'production') {
    const requiredVars = ['mongoUri', 'jwtSecret', 'jwtRefreshSecret', 'cookieSecret'];
    const missingVars = requiredVars.filter(key => !config[key]);
    
    if (missingVars.length > 0) {
        console.error(`FATAL: Missing required environment variables: ${missingVars.join(', ')}`);
        process.exit(1);
    }

    // Validate JWT secret strength (minimum 32 characters for SOC 2)
    if (config.jwtSecret.length < 32) {
        console.error('FATAL: JWT_SECRET must be at least 32 characters for production.');
        process.exit(1);
    }
}

// Warn if using default values in development
if (config.nodeEnv === 'development' && !config.jwtSecret) {
    console.warn('⚠️  WARNING: Using fallback JWT_SECRET. Set in .env for security.');
}

module.exports = config;
