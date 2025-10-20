// src/server.js
const app = require('./app');
const connectDB = require('./config/database');
const config = require('./config/environment');
const logger = require('./config/logger'); // ✅ Only import your configured logger
const mongoose = require('mongoose');

// ✅ TEST LOGS (verify file logging works)
logger.info('🚀 Application starting...');
logger.error('❌ Test error - should appear in error.log');
logger.warn('⚠️  Test warning');
logger.debug('🐛 Test debug message');

// --- Start Server ---
const startServer = async () => {
    try {
        logger.info('📡 Attempting to connect to MongoDB...'); // ✅ Use logger
        await connectDB();
        logger.info('✅ MongoDB connected successfully'); // ✅ Use logger

        const server = app.listen(config.port, () => {
            logger.info(`✅ Server running in ${config.nodeEnv} mode on port ${config.port}`); // ✅ Use logger
        });

        // Graceful Shutdown Handling
        const shutdown = (signal) => {
            logger.info(`${signal} signal received: closing HTTP server`); // ✅ Use logger
            server.close(() => {
                logger.info('HTTP server closed'); // ✅ Use logger
                mongoose.connection.close(false, () => {
                    logger.info('MongoDB connection closed.'); // ✅ Use logger
                    process.exit(0);
                });
            });
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        logger.error(`❌ Failed to start server: ${error.message}`); // ✅ Use logger
        logger.error(error.stack); // ✅ Log full stack trace
        process.exit(1);
    }
};

startServer();
