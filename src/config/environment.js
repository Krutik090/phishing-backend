// src/config/environment.js
const dotenv = require('dotenv');
dotenv.config();

const config = {
    // Server
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    
    // Database
    masterDbUri: process.env.MASTER_DB_URI || '',
    tenantDbBaseUri: process.env.TENANT_DB_BASE_URI || '',
    
    // JWT
    jwtSecret: process.env.JWT_SECRET || '',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    
    // Security
    cookieSecret: process.env.COOKIE_SECRET || '',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    
    // Email
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASSWORD || '',
        from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
    },
};

// Validation for production
if (config.nodeEnv === 'production') {
    const requiredVars = [
        'masterDbUri',
        'tenantDbBaseUri',
        'jwtSecret',
        'jwtRefreshSecret',
        'cookieSecret',
    ];
    
    const missingVars = requiredVars.filter(key => !config[key]);
    
    if (missingVars.length > 0) {
        console.error(`FATAL: Missing required environment variables: ${missingVars.join(', ')}`);
        process.exit(1);
    }

    // Validate JWT secret strength
    if (config.jwtSecret.length < 32 || config.jwtRefreshSecret.length < 32) {
        console.error('FATAL: JWT secrets must be at least 32 characters in production');
        process.exit(1);
    }
}

// Warnings for development
if (config.nodeEnv === 'development') {
    if (!config.jwtSecret) {
        console.warn('⚠️  WARNING: Using default JWT_SECRET. Set in .env for security.');
    }
    if (!config.masterDbUri) {
        console.warn('⚠️  WARNING: MASTER_DB_URI not set. Using default.');
    }
}

module.exports = config;
