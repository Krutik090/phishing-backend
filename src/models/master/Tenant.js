// src/models/master/Tenant.js
const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
    {
        tenantId: {
            type: String,
            required: true,
            unique: true,
        },
        organizationName: {
            type: String,
            required: true,
            trim: true,
        },
        subdomain: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/,
        },
        databaseName: {
            type: String,
            required: true,
            unique: true,
        },
        
        // Contact Information
        primaryAdminEmail: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        contactName: {
            type: String,
            trim: true,
        },
        contactPhone: {
            type: String,
            trim: true,
        },
        
        // Subscription Plan
        plan: {
            type: {
                type: String,
                enum: ['free', 'trial', 'basic', 'premium', 'enterprise'],
                default: 'trial',
            },
            maxUsers: {
                type: Number,
                default: 10,
            },
            maxCampaigns: {
                type: Number,
                default: 5,
            },
            features: [String],
            billingCycle: {
                type: String,
                enum: ['monthly', 'yearly'],
            },
        },
        
        // Status
        status: {
            type: String,
            enum: ['active', 'suspended', 'trial', 'cancelled', 'expired'],
            default: 'trial',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        
        // Database Connection Info (optional - for custom DB servers)
        connectionConfig: {
            host: String,
            port: Number,
            username: String,
            password: String, // Should be encrypted
        },
        
        // Metadata
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Superadmin',
            required: true,
        },
        lastAccessedAt: {
            type: Date,
            default: Date.now,
        },
        
        // Settings
        settings: {
            timezone: {
                type: String,
                default: 'UTC',
            },
            language: {
                type: String,
                default: 'en',
            },
            allowedDomains: [String], // Email domain whitelist
            securityPolicy: {
                passwordMinLength: {
                    type: Number,
                    default: 8,
                },
                passwordRequireUppercase: {
                    type: Boolean,
                    default: true,
                },
                passwordRequireNumbers: {
                    type: Boolean,
                    default: true,
                },
                passwordRequireSpecialChars: {
                    type: Boolean,
                    default: true,
                },
                sessionTimeout: {
                    type: Number,
                    default: 3600000, // 1 hour in ms
                },
                maxLoginAttempts: {
                    type: Number,
                    default: 5,
                },
            },
        },
        
        // Usage Statistics
        stats: {
            totalUsers: {
                type: Number,
                default: 0,
            },
            totalCampaigns: {
                type: Number,
                default: 0,
            },
            storageUsed: {
                type: Number,
                default: 0, // in bytes
            },
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
tenantSchema.index({ status: 1, isActive: 1 });
tenantSchema.index({ createdAt: -1 });

// Virtual for tenant age
tenantSchema.virtual('tenantAge').get(function () {
    return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24)); // days
});

// Methods
tenantSchema.methods.isTrialExpired = function () {
    if (this.status !== 'trial') return false;
    const trialDays = 14;
    const trialAge = Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
    return trialAge > trialDays;
};

tenantSchema.methods.canAddUser = function () {
    return this.stats.totalUsers < this.plan.maxUsers;
};

tenantSchema.methods.canAddCampaign = function () {
    return this.stats.totalCampaigns < this.plan.maxCampaigns;
};

// Statics
tenantSchema.statics.findBySubdomain = function (subdomain) {
    return this.findOne({ subdomain, isActive: true });
};

tenantSchema.statics.findActiveTenants = function () {
    return this.find({ status: 'active', isActive: true });
};

module.exports = {
    schema: tenantSchema,
    model: mongoose.model('Tenant', tenantSchema),
};
