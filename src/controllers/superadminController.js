// src/controllers/superadminController.js
const tenantService = require('../services/tenantService');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

/**
 * Create new tenant
 * POST /api/superadmin/tenants
 */
const createTenant = async (req, res, next) => {
    try {
        const tenantData = req.body;
        const superadminId = req.user.id;

        const result = await tenantService.createTenant(tenantData, superadminId);

        res.status(201).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all tenants
 * GET /api/superadmin/tenants
 */
const getAllTenants = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const filters = {
            status: req.query.status,
            isActive: req.query.isActive,
            search: req.query.search,
        };

        const result = await tenantService.getAllTenants(page, limit, filters);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get tenant by ID
 * GET /api/superadmin/tenants/:tenantId
 */
const getTenantById = async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const tenant = await tenantService.getTenantById(tenantId);

        res.status(200).json({
            success: true,
            data: tenant,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update tenant
 * PUT /api/superadmin/tenants/:tenantId
 */
const updateTenant = async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const updates = req.body;
        const superadminId = req.user.id;

        const tenant = await tenantService.updateTenant(tenantId, updates, superadminId);

        res.status(200).json({
            success: true,
            data: tenant,
            message: 'Tenant updated successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Suspend tenant
 * POST /api/superadmin/tenants/:tenantId/suspend
 */
const suspendTenant = async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const superadminId = req.user.id;

        const tenant = await tenantService.suspendTenant(tenantId, superadminId);

        res.status(200).json({
            success: true,
            data: tenant,
            message: 'Tenant suspended successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Activate tenant
 * POST /api/superadmin/tenants/:tenantId/activate
 */
const activateTenant = async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const superadminId = req.user.id;

        const tenant = await tenantService.activateTenant(tenantId, superadminId);

        res.status(200).json({
            success: true,
            data: tenant,
            message: 'Tenant activated successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete tenant
 * DELETE /api/superadmin/tenants/:tenantId
 */
const deleteTenant = async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const superadminId = req.user.id;

        const result = await tenantService.deleteTenant(tenantId, superadminId);

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get tenant statistics
 * GET /api/superadmin/tenants/:tenantId/stats
 */
const getTenantStats = async (req, res, next) => {
    try {
        const { tenantId } = req.params;
        const stats = await tenantService.getTenantStats(tenantId);

        res.status(200).json({
            success: true,
            data: stats,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createTenant,
    getAllTenants,
    getTenantById,
    updateTenant,
    suspendTenant,
    activateTenant,
    deleteTenant,
    getTenantStats,
};
