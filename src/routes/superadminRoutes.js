// src/routes/superadminRoutes.js
const express = require('express');
const router = express.Router();
const superadminController = require('../controllers/superadminController');
const { requireSuperadmin } = require('../middleware/tenantContext');
const { authRateLimitMiddleware } = require('../middleware/rateLimiter');

// All routes require superadmin authentication
// TODO: Add authentication middleware in Phase 3
// router.use(authenticate);
router.use(requireSuperadmin);

// Tenant Management Routes
router.post('/tenants', authRateLimitMiddleware, superadminController.createTenant);
router.get('/tenants', superadminController.getAllTenants);
router.get('/tenants/:tenantId', superadminController.getTenantById);
router.put('/tenants/:tenantId', superadminController.updateTenant);
router.post('/tenants/:tenantId/suspend', superadminController.suspendTenant);
router.post('/tenants/:tenantId/activate', superadminController.activateTenant);
router.delete('/tenants/:tenantId', superadminController.deleteTenant);
router.get('/tenants/:tenantId/stats', superadminController.getTenantStats);

module.exports = router;
