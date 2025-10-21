// src/server.js
const app = require('./app');
const config = require('./config/environment');
const logger = require('./config/logger');
const tenantDBManager = require('./config/tenantDatabase');

// Test logging
logger.info('🚀 Application starting...');
logger.debug('Debug mode enabled');

// --- Start Server ---
const startServer = async () => {
    try {
        // 1. Connect to Master Database
        logger.info('📡 Connecting to Master database...');
        await tenantDBManager.connectMaster();
        logger.info('✅ Master database connected successfully');

        // 2. Start HTTP Server
        const server = app.listen(config.port, () => {
            logger.info(`✅ Server running in ${config.nodeEnv} mode on port ${config.port}`);
            logger.info(`🌐 Frontend URL: ${config.frontendUrl}`);
            logger.info(`📊 Health check: http://localhost:${config.port}/api/health`);
        });

        // 3. Graceful Shutdown Handling
        const shutdown = async (signal) => {
            logger.info(`${signal} signal received: closing HTTP server`);
            
            server.close(async () => {
                logger.info('HTTP server closed');
                
                try {
                    // Close all database connections
                    await tenantDBManager.closeAllConnections();
                    logger.info('All database connections closed');
                    process.exit(0);
                } catch (error) {
                    logger.error(`Error during shutdown: ${error.message}`);
                    process.exit(1);
                }
            });

            // Force shutdown after 30 seconds
            setTimeout(() => {
                logger.error('Forced shutdown due to timeout');
                process.exit(1);
            }, 30000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error(`Uncaught Exception: ${error.message}`);
            logger.error(error.stack);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });

    } catch (error) {
        logger.error(`❌ Failed to start server: ${error.message}`);
        logger.error(error.stack);
        process.exit(1);
    }
};

startServer();
