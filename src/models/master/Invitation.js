// src/models/master/Invitation.js
const mongoose = require('mongoose');
const validator = require('validator');

const invitationSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true,
            validate: [validator.isEmail, 'Please provide a valid email'],
        },
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tenant',
            required: true,
        },
        invitedBy: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'invitedByModel',
            required: true,
        },
        invitedByModel: {
            type: String,
            required: true,
            enum: ['Superadmin', 'User'], // User model from tenant DB
        },
        role: {
            type: String,
            required: true,
            enum: ['admin', 'user', 'readonly'],
            default: 'user',
        },
        
        // Status
        status: {
            type: String,
            enum: ['pending', 'accepted', 'expired', 'revoked'],
            default: 'pending',
        },
        
        // Token
        token: {
            type: String,
            required: true,
            unique: true,
        },
        
        // Expiration
        expiresAt: {
            type: Date,
            required: true,
        },
        
        // Acceptance
        acceptedAt: Date,
        acceptedBy: mongoose.Schema.Types.ObjectId, // User ID after registration
        
        // Metadata
        metadata: {
            department: String,
            jobTitle: String,
            customFields: mongoose.Schema.Types.Mixed,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
invitationSchema.index({ tenantId: 1 });
invitationSchema.index({ status: 1, expiresAt: 1 });
invitationSchema.index({ createdAt: -1 });

// Virtual for checking if expired
invitationSchema.virtual('isExpired').get(function () {
    return this.expiresAt < Date.now();
});

// Virtual for checking if valid
invitationSchema.virtual('isValid').get(function () {
    return this.status === 'pending' && !this.isExpired;
});

// Instance Methods

/**
 * Mark invitation as accepted
 */
invitationSchema.methods.markAsAccepted = async function (userId) {
    this.status = 'accepted';
    this.acceptedAt = Date.now();
    this.acceptedBy = userId;
    await this.save();
};

/**
 * Revoke invitation
 */
invitationSchema.methods.revoke = async function () {
    this.status = 'revoked';
    await this.save();
};

/**
 * Check if invitation can be used
 */
invitationSchema.methods.canBeUsed = function () {
    return this.status === 'pending' && this.expiresAt > Date.now();
};

// Static Methods

/**
 * Find valid invitation by token
 */
invitationSchema.statics.findValidByToken = function (token) {
    return this.findOne({
        token,
        status: 'pending',
        expiresAt: { $gt: Date.now() },
    });
};

/**
 * Find pending invitations for tenant
 */
invitationSchema.statics.findPendingByTenant = function (tenantId) {
    return this.find({
        tenantId,
        status: 'pending',
        expiresAt: { $gt: Date.now() },
    });
};

/**
 * Expire old invitations
 */
invitationSchema.statics.expireOldInvitations = async function () {
    const result = await this.updateMany(
        {
            status: 'pending',
            expiresAt: { $lt: Date.now() },
        },
        {
            $set: { status: 'expired' },
        }
    );
    return result.modifiedCount;
};

// Pre-save middleware
invitationSchema.pre('save', function (next) {
    // Set default expiration (7 days from creation)
    if (this.isNew && !this.expiresAt) {
        this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    next();
});

module.exports = {
    schema: invitationSchema,
    model: mongoose.model('Invitation', invitationSchema),
};
