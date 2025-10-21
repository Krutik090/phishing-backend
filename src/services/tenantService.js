// src/services/tenantService.js
const tenantDBManager = require('../config/tenantDatabase');
const logger = require('../config/logger');
const {
    generateTenantId,
    generateInvitationToken,
    generateDatabaseName,
    isValidSubdomain,
    sanitizeSubdomain,
} = require('../utils/helpers');
const { ApiError } = require('../middleware/errorHandler');

class TenantService {
    /**
     * Ensure indexes are created before transactions
     */
    async ensureIndexes() {
        try {
            const Tenant = tenantDBManager.masterConnection.model('Tenant');
            const Invitation = tenantDBManager.masterConnection.model('Invitation');

            await Tenant.createIndexes();
            await Invitation.createIndexes();

            logger.debug('✅ Master database indexes verified');
        } catch (error) {
            logger.warn(`Index creation warning: ${error.message}`);
        }
    }

    /**
     * Create new tenant with isolated database
     */
    async createTenant(tenantData, superadminId) {
        await this.ensureIndexes();

        const session = await tenantDBManager.masterConnection.startSession();
        let transactionCommitted = false;
        let tenantCreated = null;
        let invitationCreated = null;

        try {
            session.startTransaction();

            // 1. Validate input
            if (!tenantData.organizationName || !tenantData.subdomain || !tenantData.adminEmail) {
                throw new ApiError(400, 'Organization name, subdomain, and admin email are required');
            }

            // 2. Sanitize and validate subdomain
            const subdomain = sanitizeSubdomain(tenantData.subdomain);
            if (!isValidSubdomain(subdomain)) {
                throw new ApiError(400, 'Invalid subdomain format');
            }

            // 3. Check if subdomain already exists
            const Tenant = tenantDBManager.masterConnection.model('Tenant');
            const existingTenant = await Tenant.findOne({ subdomain }).session(session);
            if (existingTenant) {
                throw new ApiError(409, 'Subdomain already exists');
            }

            // 4. Check if email already invited
            const Invitation = tenantDBManager.masterConnection.model('Invitation');
            const existingInvitation = await Invitation.findOne({
                email: tenantData.adminEmail,
                status: 'pending',
            }).session(session);
            if (existingInvitation) {
                throw new ApiError(409, 'Email already has a pending invitation');
            }

            // 5. Generate tenant ID and database name
            const tenantId = generateTenantId();
            const dbName = generateDatabaseName(tenantId);

            logger.info(`Creating tenant: ${subdomain} (${tenantId})`);

            // 6. Create tenant record in master DB
            const tenant = new Tenant({
                tenantId,
                organizationName: tenantData.organizationName,
                subdomain,
                databaseName: dbName,
                primaryAdminEmail: tenantData.adminEmail,
                contactName: tenantData.contactName || '',
                contactPhone: tenantData.contactPhone || '',
                plan: {
                    type: tenantData.plan?.type || 'trial',
                    maxUsers: tenantData.plan?.maxUsers || 10,
                    maxCampaigns: tenantData.plan?.maxCampaigns || 5,
                    features: tenantData.plan?.features || [],
                },
                status: 'trial',
                isActive: true,
                createdBy: superadminId,
                settings: {
                    timezone: tenantData.timezone || 'UTC',
                    language: tenantData.language || 'en',
                    allowedDomains: tenantData.allowedDomains || [],
                },
            });

            await tenant.save({ session });
            tenantCreated = tenant;
            logger.info(`✅ Tenant record created: ${tenantId}`);

            // 7. Create invitation for primary admin
            const invitation = new Invitation({
                email: tenantData.adminEmail,
                tenantId: tenant._id,
                invitedBy: superadminId,
                invitedByModel: 'Superadmin',
                role: 'admin',
                status: 'pending',
                token: generateInvitationToken(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                metadata: {
                    department: tenantData.department || '',
                    jobTitle: tenantData.jobTitle || '',
                },
            });

            await invitation.save({ session });
            invitationCreated = invitation;
            logger.info(`✅ Invitation created for: ${tenantData.adminEmail}`);

            // 8. Commit transaction
            await session.commitTransaction();
            transactionCommitted = true;
            logger.info(`✅ Transaction committed successfully`);

            // 9. Create tenant database (AFTER transaction)
            try {
                const tenantConnection = await tenantDBManager.getTenantConnection(tenantId);
                await this.initializeTenantSchema(tenantConnection);
                logger.info(`✅ Tenant database initialized: ${dbName}`);
            } catch (dbError) {
                // Manual rollback: Delete tenant and invitation
                await Tenant.deleteOne({ tenantId });
                await Invitation.deleteOne({ _id: invitation._id });
                logger.error(`Failed to initialize tenant DB, rolled back: ${dbError.message}`);
                throw new ApiError(500, `Failed to initialize tenant database: ${dbError.message}`);
            }

            logger.info(`✅ Tenant creation completed: ${subdomain}`);

            // 10. Send invitation email (async)
            this.sendInvitationEmail(invitation, tenant).catch(err => {
                logger.error(`Failed to send invitation email: ${err.message}`);
            });

            return {
                success: true,
                tenant: {
                    id: tenant._id,
                    tenantId: tenant.tenantId,
                    organizationName: tenant.organizationName,
                    subdomain: tenant.subdomain,
                    status: tenant.status,
                    plan: tenant.plan,
                },
                invitation: {
                    email: invitation.email,
                    token: invitation.token,
                    expiresAt: invitation.expiresAt,
                },
                message: 'Tenant created successfully. Invitation sent to admin.',
            };

        } catch (error) {
            // Only abort if transaction is still active
            if (!transactionCommitted && session.inTransaction()) {
                await session.abortTransaction();
                logger.info('Transaction aborted');
            }
            logger.error(`❌ Tenant creation failed: ${error.message}`);
            throw error;
        } finally {
            session.endSession();
        }
    }


    /**
     * Initialize tenant database with collections and indexes
     */
    async initializeTenantSchema(connection) {
        try {
            // Import schemas
            const { schema: UserSchema } = require('../models/tenant/User');
            const { schema: CampaignSchema } = require('../models/tenant/Campaign');

            // Create models
            const User = connection.model('User', UserSchema);
            const Campaign = connection.model('Campaign', CampaignSchema);

            // Create indexes
            await User.createIndexes();
            await Campaign.createIndexes();

            logger.info('📚 Tenant schema initialized with all collections and indexes');

            return true;
        } catch (error) {
            logger.error(`Failed to initialize tenant schema: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get tenant by ID
     */
    async getTenantById(tenantId) {
        try {
            const Tenant = tenantDBManager.masterConnection.model('Tenant');
            const tenant = await Tenant.findOne({ tenantId });

            if (!tenant) {
                throw new ApiError(404, 'Tenant not found');
            }

            return tenant;
        } catch (error) {
            logger.error(`Failed to get tenant: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all tenants (with pagination)
     */
    async getAllTenants(page = 1, limit = 10, filters = {}) {
        try {
            const Tenant = tenantDBManager.masterConnection.model('Tenant');

            const query = {};
            if (filters.status) query.status = filters.status;
            if (filters.isActive !== undefined) query.isActive = filters.isActive;
            if (filters.search) {
                query.$or = [
                    { organizationName: { $regex: filters.search, $options: 'i' } },
                    { subdomain: { $regex: filters.search, $options: 'i' } },
                    { primaryAdminEmail: { $regex: filters.search, $options: 'i' } },
                ];
            }

            const skip = (page - 1) * limit;

            const [tenants, total] = await Promise.all([
                Tenant.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Tenant.countDocuments(query),
            ]);

            return {
                tenants,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            };
        } catch (error) {
            logger.error(`Failed to get tenants: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update tenant
     */
    async updateTenant(tenantId, updates, superadminId) {
        try {
            const Tenant = tenantDBManager.masterConnection.model('Tenant');

            // Prevent updating critical fields
            delete updates.tenantId;
            delete updates.databaseName;
            delete updates.createdBy;

            const tenant = await Tenant.findOneAndUpdate(
                { tenantId },
                { $set: updates },
                { new: true, runValidators: true }
            );

            if (!tenant) {
                throw new ApiError(404, 'Tenant not found');
            }

            logger.info(`✅ Tenant updated: ${tenantId}`);
            return tenant;

        } catch (error) {
            logger.error(`Failed to update tenant: ${error.message}`);
            throw error;
        }
    }

    /**
     * Suspend tenant
     */
    async suspendTenant(tenantId, superadminId) {
        try {
            const Tenant = tenantDBManager.masterConnection.model('Tenant');

            const tenant = await Tenant.findOneAndUpdate(
                { tenantId },
                {
                    $set: {
                        status: 'suspended',
                        isActive: false,
                    }
                },
                { new: true }
            );

            if (!tenant) {
                throw new ApiError(404, 'Tenant not found');
            }

            logger.info(`⚠️  Tenant suspended: ${tenantId}`);
            return tenant;

        } catch (error) {
            logger.error(`Failed to suspend tenant: ${error.message}`);
            throw error;
        }
    }

    /**
     * Activate tenant
     */
    async activateTenant(tenantId, superadminId) {
        try {
            const Tenant = tenantDBManager.masterConnection.model('Tenant');

            const tenant = await Tenant.findOneAndUpdate(
                { tenantId },
                {
                    $set: {
                        status: 'active',
                        isActive: true,
                    }
                },
                { new: true }
            );

            if (!tenant) {
                throw new ApiError(404, 'Tenant not found');
            }

            logger.info(`✅ Tenant activated: ${tenantId}`);
            return tenant;

        } catch (error) {
            logger.error(`Failed to activate tenant: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete tenant and all associated data
     */
    async deleteTenant(tenantId, superadminId) {
        try {
            const Tenant = tenantDBManager.masterConnection.model('Tenant');
            const tenant = await Tenant.findOne({ tenantId });

            if (!tenant) {
                throw new ApiError(404, 'Tenant not found');
            }

            logger.info(`🗑️  Deleting tenant: ${tenantId}`);

            // 1. Close tenant connection
            await tenantDBManager.closeTenantConnection(tenantId);

            // 2. Drop tenant database
            const mongoose = require('mongoose');
            const connectionString = require('../config/environment').tenantDbBaseUri.replace(
                '<DATABASE>',
                tenant.databaseName
            );

            const tempConnection = await mongoose.createConnection(connectionString);
            await tempConnection.dropDatabase();
            await tempConnection.close();

            logger.info(`✅ Tenant database dropped: ${tenant.databaseName}`);

            // 3. Delete tenant record from master
            await tenant.deleteOne();

            // 4. Delete related invitations
            const Invitation = tenantDBManager.masterConnection.model('Invitation');
            await Invitation.deleteMany({ tenantId: tenant._id });

            logger.info(`✅ Tenant deleted completely: ${tenantId}`);

            return {
                success: true,
                message: 'Tenant and all associated data deleted successfully',
            };

        } catch (error) {
            logger.error(`❌ Tenant deletion failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get tenant statistics
     */
    async getTenantStats(tenantId) {
        try {
            const tenant = await this.getTenantById(tenantId);
            const tenantConnection = await tenantDBManager.getTenantConnection(tenantId);

            const User = tenantConnection.model('User');
            const Campaign = tenantConnection.model('Campaign');

            const [totalUsers, activeUsers, totalCampaigns, activeCampaigns] = await Promise.all([
                User.countDocuments(),
                User.countDocuments({ isActive: true }),
                Campaign.countDocuments(),
                Campaign.countDocuments({ status: 'active' }),
            ]);

            return {
                tenant: {
                    organizationName: tenant.organizationName,
                    subdomain: tenant.subdomain,
                    status: tenant.status,
                    createdAt: tenant.createdAt,
                },
                stats: {
                    users: {
                        total: totalUsers,
                        active: activeUsers,
                    },
                    campaigns: {
                        total: totalCampaigns,
                        active: activeCampaigns,
                    },
                },
                limits: {
                    maxUsers: tenant.plan.maxUsers,
                    maxCampaigns: tenant.plan.maxCampaigns,
                },
            };

        } catch (error) {
            logger.error(`Failed to get tenant stats: ${error.message}`);
            throw error;
        }
    }

    /**
     * Send invitation email
     */
    async sendInvitationEmail(invitation, tenant) {
        try {
            const invitationUrl = `${require('../config/environment').frontendUrl}/register?token=${invitation.token}`;

            logger.info(`📧 Invitation URL: ${invitationUrl}`);
            logger.info(`   Email: ${invitation.email}`);
            logger.info(`   Organization: ${tenant.organizationName}`);

            // TODO: Implement actual email sending
            // await emailService.sendInvitationEmail({
            //     to: invitation.email,
            //     organizationName: tenant.organizationName,
            //     invitationUrl,
            // });

            return true;
        } catch (error) {
            logger.error(`Failed to send invitation email: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new TenantService();
