// src/middleware/tenantContext.js
const tenantDBManager = require('../config/tenantDatabase');
const { ApiError } = require('./errorHandler');
const logger = require('../config/logger');

/**
 * Middleware to attach tenant DB for APIs, pulled from JWT user or subdomain
 */
const attachTenantDB = async (req, res, next) => {
    try {
        if (req.user && req.user.role === 'superadmin') {
            // Superadmin: master DB only
            req.db = tenantDBManager.masterConnection;
            return next();
        }
        const tenantId = req.user?.tenantId || null;
        if (!tenantId) throw new ApiError(400, 'Tenant context missing');
        req.db = await tenantDBManager.getTenantConnection(tenantId);
        req.tenantId = tenantId;
        logger.debug(`Tenant context attached: ${tenantId}`);
        next();
    } catch (err) {
        logger.error(`Tenant context error: ${err.message}`);
        next(new ApiError(500, 'Failed to establish tenant context'));
    }
};

/**
 * Middleware to require superadmin
 */
const requireSuperadmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'superadmin') {
        return next(new ApiError(403, 'Superadmin access required'));
    }
    req.db = tenantDBManager.masterConnection;
    next();
};

module.exports = { attachTenantDB, requireSuperadmin };
