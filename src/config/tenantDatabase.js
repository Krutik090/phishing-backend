// src/config/tenantDatabase.js
const mongoose = require('mongoose');
const config = require('./environment');
const logger = require('./logger');

// Import Tenant Schemas
const { schema: UserSchema } = require('../models/tenant/User');
const { schema: CampaignSchema } = require('../models/tenant/Campaign');

/**
 * Multi-Tenant Database Manager
 * Manages connections to master database and tenant-specific databases
 */
class TenantDatabaseManager {
    constructor() {
        this.connections = new Map(); // Cache for tenant connections
        this.masterConnection = null;
        this.maxCachedConnections = 50; // Limit cached connections
        this.modelsInitialized = false;
    }

    /**
     * Connect to master database
     */
    async connectMaster() {
        if (this.masterConnection && this.masterConnection.readyState === 1) {
            return this.masterConnection;
        }

        try {
            this.masterConnection = await mongoose.createConnection(config.masterDbUri, {
                maxPoolSize: 10,
                minPoolSize: 2,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                family: 4,
            }).asPromise(); // Ensure promise return

            // Event handlers
            this.masterConnection.on('connected', () => {
                logger.info('✅ Master database connected');
            });

            this.masterConnection.on('error', (err) => {
                logger.error(`❌ Master DB error: ${err.message}`);
            });

            this.masterConnection.on('disconnected', () => {
                logger.warn('⚠️  Master database disconnected');
            });

            logger.info('✅ Master database connection established');

            // Initialize master database models
            await this.initializeMasterModels();

            return this.masterConnection;

        } catch (error) {
            logger.error(`❌ Master DB connection failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Initialize master database models
     */
    async initializeMasterModels() {
        if (this.modelsInitialized) {
            return;
        }

        try {
            // Import schemas
            const { schema: TenantSchema } = require('../models/master/Tenant');
            const { schema: SuperadminSchema } = require('../models/master/Superadmin');
            const { schema: InvitationSchema } = require('../models/master/Invitation');

            // Register models with master connection (check if exists first)
            if (!this.masterConnection.models['Tenant']) this.masterConnection.model('Tenant', TenantSchema);
            if (!this.masterConnection.models['Superadmin']) this.masterConnection.model('Superadmin', SuperadminSchema);
            if (!this.masterConnection.models['Invitation']) this.masterConnection.model('Invitation', InvitationSchema);

            this.modelsInitialized = true;
            logger.info('✅ Master database models initialized');

        } catch (error) {
            logger.error(`❌ Failed to initialize master models: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get tenant connection from cache or create new one
     * @param {String} tenantId - Unique tenant identifier
     * @returns {Connection} Mongoose connection to tenant database
     */
    async getTenantConnection(tenantId) {
        // Check cache
        if (this.connections.has(tenantId)) {
            const connection = this.connections.get(tenantId);
            if (connection.readyState === 1) {
                logger.debug(`Using cached connection for tenant: ${tenantId}`);
                return connection;
            } else {
                this.connections.delete(tenantId);
            }
        }

        try {
            // Fetch tenant metadata from master DB
            const tenant = await this.getTenantMetadata(tenantId);

            if (!tenant) {
                throw new Error(`Tenant ${tenantId} not found`);
            }

            if (!tenant.isActive) {
                throw new Error(`Tenant ${tenantId} is not active`);
            }

            // Build connection string
            const dbName = tenant.databaseName || `tenant_${tenantId}`;
            const connectionString = config.tenantDbBaseUri.replace('<DATABASE>', dbName);

            // Create connection
            const connection = await mongoose.createConnection(connectionString, {
                maxPoolSize: 5,
                minPoolSize: 1,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                family: 4,
            }).asPromise();

            // Register Tenant Models on this specific connection
            this.registerTenantModels(connection);

            // Event handlers
            connection.on('connected', () => {
                logger.info(`✅ Tenant database connected: ${dbName}`);
            });

            connection.on('error', (err) => {
                logger.error(`❌ Tenant DB error (${dbName}): ${err.message}`);
            });

            connection.on('disconnected', () => {
                logger.warn(`⚠️  Tenant database disconnected: ${dbName}`);
                this.connections.delete(tenantId);
            });

            // Cache connection
            this.connections.set(tenantId, connection);

            // Update last accessed timestamp (async, don't await)
            this.updateTenantLastAccess(tenantId).catch(err => 
                logger.warn(`Failed to update last access: ${err.message}`)
            );

            // Enforce cache size limit
            if (this.connections.size > this.maxCachedConnections) {
                await this.cleanupOldestConnection();
            }

            return connection;

        } catch (error) {
            logger.error(`❌ Failed to get tenant connection: ${error.message}`);
            throw error;
        }
    }

    /**
     * Register schema definitions on a tenant connection
     * @param {Connection} connection - The tenant mongoose connection
     */
    registerTenantModels(connection) {
        if (!connection.models['User']) {
            connection.model('User', UserSchema);
        }
        if (!connection.models['Campaign']) {
            connection.model('Campaign', CampaignSchema);
        }
        // Add other tenant models here as you build them
    }

    /**
     * Get tenant metadata from master database
     */
    async getTenantMetadata(tenantId) {
        try {
            if (!this.masterConnection) {
                await this.connectMaster();
            }

            const Tenant = this.masterConnection.model('Tenant');
            const tenant = await Tenant.findOne({ tenantId, isActive: true }).lean();

            return tenant;
        } catch (error) {
            logger.error(`❌ Failed to fetch tenant metadata: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update tenant's last accessed timestamp
     */
    async updateTenantLastAccess(tenantId) {
        try {
            const Tenant = this.masterConnection.model('Tenant');
            await Tenant.updateOne(
                { tenantId },
                { lastAccessedAt: new Date() }
            );
        } catch (error) {
            logger.warn(`Failed to update tenant last access: ${error.message}`);
        }
    }

    /**
     * Close specific tenant connection
     */
    async closeTenantConnection(tenantId) {
        const connection = this.connections.get(tenantId);
        if (connection) {
            await connection.close();
            this.connections.delete(tenantId);
            logger.info(`🔌 Closed connection for tenant: ${tenantId}`);
        }
    }

    /**
     * Remove oldest connection from cache
     */
    async cleanupOldestConnection() {
        try {
            const firstKey = this.connections.keys().next().value;
            if (firstKey) {
                await this.closeTenantConnection(firstKey);
                logger.info(`🧹 Cleaned up oldest connection: ${firstKey}`);
            }
        } catch (error) {
            logger.warn(`Failed to cleanup connection: ${error.message}`);
        }
    }

    /**
     * Close all connections (graceful shutdown)
     */
    async closeAllConnections() {
        try {
            // Close all tenant connections
            for (const [tenantId, connection] of this.connections) {
                await connection.close();
                logger.info(`🔌 Closed tenant connection: ${tenantId}`);
            }
            this.connections.clear();

            // Close master connection
            if (this.masterConnection) {
                await this.masterConnection.close();
                this.masterConnection = null;
                this.modelsInitialized = false;
                logger.info('🔌 Master database connection closed');
            }

            logger.info('✅ All database connections closed successfully');
        } catch (error) {
            logger.error(`❌ Error closing connections: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get connection statistics
     */
    getConnectionStats() {
        return {
            masterConnected: this.masterConnection?.readyState === 1,
            modelsInitialized: this.modelsInitialized,
            cachedTenantConnections: this.connections.size,
            maxCachedConnections: this.maxCachedConnections,
        };
    }
}

// Singleton instance
const tenantDBManager = new TenantDatabaseManager();

module.exports = tenantDBManager;