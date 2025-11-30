// src/models/master/Tenant.js
const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema(
    {
        tenantId: { type: String, required: true, unique: true },
        organizationName: { type: String, required: true, trim: true },
        subdomain: { 
            type: String, required: true, unique: true, lowercase: true, trim: true, 
            match: /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/ 
        },
        databaseName: { type: String, required: true, unique: true },
        primaryAdminEmail: { type: String, required: true, lowercase: true, trim: true },
        contactName: { type: String, trim: true },
        contactPhone: { type: String, trim: true },
        plan: {
            type: { type: String, enum: ['free', 'trial', 'basic', 'premium', 'enterprise'], default: 'trial' },
            maxUsers: { type: Number, default: 10 },
            maxCampaigns: { type: Number, default: 5 },
            features: [String],
            billingCycle: { type: String, enum: ['monthly', 'yearly'] },
        },
        status: { type: String, enum: ['active', 'suspended', 'trial', 'cancelled', 'expired'], default: 'trial' },
        isActive: { type: Boolean, default: true },
        connectionConfig: { host: String, port: Number, username: String, password: String },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Superadmin', required: true },
        lastAccessedAt: { type: Date, default: Date.now },
        settings: {
            timezone: { type: String, default: 'UTC' },
            language: { type: String, default: 'en' },
            allowedDomains: [String],
            securityPolicy: {
                passwordMinLength: { type: Number, default: 8 },
                passwordRequireUppercase: { type: Boolean, default: true },
                passwordRequireNumbers: { type: Boolean, default: true },
                passwordRequireSpecialChars: { type: Boolean, default: true },
                sessionTimeout: { type: Number, default: 3600000 },
                maxLoginAttempts: { type: Number, default: 5 },
            },
        },
        stats: {
            totalUsers: { type: Number, default: 0 },
            totalCampaigns: { type: Number, default: 0 },
            storageUsed: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

tenantSchema.index({ status: 1, isActive: 1 });
tenantSchema.index({ createdAt: -1 });

tenantSchema.virtual('tenantAge').get(function () {
    return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

module.exports = {
    schema: tenantSchema,
    // Removed 'model' export to enforce usage via tenantDBManager
};