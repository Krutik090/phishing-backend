// src/config/database.js
const mongoose = require('mongoose');
const config = require('./environment');
const logger = require('./logger');

const connectDB = async (retries = 5, delay = 5000) => {
    try {
        // Mongoose connection options for SOC 2 Security & Availability
        const options = {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4, // Use IPv4
        };

        await mongoose.connect(config.mongoUri, options);
        logger.info('✅ MongoDB Connected successfully.');

        // Connection event handlers (SOC 2 Monitoring)
        mongoose.connection.on('error', (err) => {
            logger.error(`MongoDB connection error: ${err.message}`);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('✅ MongoDB reconnected successfully.');
        });

    } catch (error) {
        logger.error(`MongoDB Connection Failed: ${error.message}`);
        
        if (retries > 0) {
            logger.info(`Retrying connection in ${delay / 1000} seconds... (${retries} attempts left)`);
            setTimeout(() => connectDB(retries - 1, delay), delay);
        } else {
            logger.error('❌ Max retries reached. Exiting application.');
            process.exit(1);
        }
    }
};

module.exports = connectDB;
