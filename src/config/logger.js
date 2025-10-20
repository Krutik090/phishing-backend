// src/config/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('./environment');

// Define log directory path
const logDir = path.join(__dirname, '../../logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

// Custom format for production (JSON for log aggregation tools)
const productionFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Custom format for development (colorized console output)
const developmentFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.errors({ stack: true }),
    winston.format.printf(
        (info) => `${info.timestamp} [${info.level}]: ${info.message}${info.stack ? '\n' + info.stack : ''}`
    )
);

// Define transports
const transports = [];

// Console transport (always enabled)
transports.push(
    new winston.transports.Console({
        format: config.nodeEnv === 'production' ? productionFormat : developmentFormat,
    })
);

// ✅ ALWAYS ADD FILE TRANSPORTS (for testing)
// Remove the if condition temporarily
transports.push(
    new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
        format: winston.format.json(), // Always use JSON for files
    }),
    new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        maxsize: 5242880,
        maxFiles: 5,
        format: winston.format.json(),
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    levels,
    transports,
    exitOnError: false,
});

// Create a stream object for morgan (HTTP request logging)
logger.stream = {
    write: (message) => logger.http(message.trim()),
};

module.exports = logger;
