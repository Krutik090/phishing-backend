// src/middleware/requestLogger.js
const morgan = require('morgan');
const logger = require('../config/logger');

// Install morgan: npm install morgan

// Custom token to exclude sensitive data (passwords, tokens)
morgan.token('sanitized-body', (req) => {
    if (!req.body || Object.keys(req.body).length === 0) return '';
    
    const sanitized = { ...req.body };
    const sensitiveFields = ['password', 'token', 'ssn', 'creditCard', 'confirmPassword'];
    
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '***REDACTED***';
        }
    });
    
    return JSON.stringify(sanitized);
});

// Custom format for development
const devFormat = ':method :url :status :response-time ms - :sanitized-body';

// Custom format for production (more detailed for audit)
const prodFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms';

const requestLogger = morgan(
    process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
    {
        stream: logger.stream,
        skip: (req) => req.url === '/api/health', // Skip health check logs
    }
);

module.exports = requestLogger;
