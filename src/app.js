// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser'); // npm install cookie-parser
const mongoSanitize = require('express-mongo-sanitize'); // npm install express-mongo-sanitize
const config = require('./config/environment');
const logger = require('./config/logger');
const requestLogger = require('./middleware/requestLogger');
const { rateLimitMiddleware } = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const superadminRoutes = require('./routes/superadminRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

// --- Trust proxy (for rate limiting by IP behind reverse proxy) ---
app.set('trust proxy', 1);

// --- Security Middleware ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
}));

// --- CORS Configuration (SOC 2 Security) ---
app.use(cors({
    origin: config.nodeEnv === 'development' 
        ? ['http://localhost:3000', 'http://localhost:5173'] // Vite default port
        : config.frontendUrl,
    credentials: true, // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// --- Body Parsing Middleware ---
app.use(express.json({ limit: '10kb' })); // Limit payload size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser(config.cookieSecret)); // Parse signed cookies

// --- Data Sanitization (prevent NoSQL injection) ---
app.use(mongoSanitize());

// --- Request Logging (SOC 2 Audit Trail) ---
app.use(requestLogger);

// --- Rate Limiting ---
app.use(rateLimitMiddleware);

app.use('/api/superadmin', superadminRoutes);
app.use('/api/auth', authRoutes);

// --- Health Check Endpoint ---
app.get('/api/health', (req, res) => {
    const connectionStats = tenantDBManager.getConnectionStats();
    
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        version: '1.0.0',
        database: {
            master: connectionStats.masterConnected ? 'connected' : 'disconnected',
            cachedTenantConnections: connectionStats.cachedTenantConnections,
            maxCachedConnections: connectionStats.maxCachedConnections,
        },
    });
});

// --- API Routes (uncomment when ready) ---
// const authRoutes = require('./routes/authRoutes');
// const userRoutes = require('./routes/userRoutes');
// app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes);

// --- 404 Handler ---
app.use(notFound);

// --- Global Error Handler ---
app.use(errorHandler);

module.exports = app;
