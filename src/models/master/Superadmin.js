// src/models/master/Superadmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const superadminSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            validate: [validator.isEmail, 'Please provide a valid email'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: 8,
            select: false, // Don't include password in queries by default
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        role: {
            type: String,
            default: 'superadmin',
            immutable: true,
        },
        
        // Permissions
        permissions: {
            canCreateTenants: {
                type: Boolean,
                default: true,
            },
            canDeleteTenants: {
                type: Boolean,
                default: true,
            },
            canViewAllTenants: {
                type: Boolean,
                default: true,
            },
            canManageSubscriptions: {
                type: Boolean,
                default: true,
            },
            canManageSuperadmins: {
                type: Boolean,
                default: false, // Only owner can manage other superadmins
            },
        },
        
        // Security
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLogin: {
            type: Date,
        },
        lastLoginIp: {
            type: String,
        },
        failedLoginAttempts: {
            type: Number,
            default: 0,
        },
        lockedUntil: {
            type: Date,
        },
        
        // Password Reset
        passwordResetToken: String,
        passwordResetExpires: Date,
        passwordChangedAt: Date,
        
        // Profile
        profile: {
            phone: String,
            avatar: String,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
superadminSchema.index({ email: 1 });
superadminSchema.index({ isActive: 1 });

// Pre-save middleware to hash password
superadminSchema.pre('save', async function (next) {
    // Only hash if password is modified
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        
        // Update passwordChangedAt
        if (!this.isNew) {
            this.passwordChangedAt = Date.now() - 1000; // Subtract 1s to ensure token is created after password change
        }
        
        next();
    } catch (error) {
        next(error);
    }
});

// Instance Methods

/**
 * Compare password with hashed password
 */
superadminSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Check if account is locked
 */
superadminSchema.methods.isLocked = function () {
    return !!(this.lockedUntil && this.lockedUntil > Date.now());
};

/**
 * Increment failed login attempts
 */
superadminSchema.methods.incrementLoginAttempts = async function () {
    // Reset if lock has expired
    if (this.lockedUntil && this.lockedUntil < Date.now()) {
        return await this.updateOne({
            $set: { failedLoginAttempts: 1 },
            $unset: { lockedUntil: 1 },
        });
    }
    
    // Increment attempts
    const updates = { $inc: { failedLoginAttempts: 1 } };
    
    // Lock account after 5 failed attempts
    const maxAttempts = 5;
    const lockTime = 2 * 60 * 60 * 1000; // 2 hours
    
    if (this.failedLoginAttempts + 1 >= maxAttempts && !this.isLocked()) {
        updates.$set = { lockedUntil: Date.now() + lockTime };
    }
    
    return await this.updateOne(updates);
};

/**
 * Reset failed login attempts
 */
superadminSchema.methods.resetLoginAttempts = async function () {
    return await this.updateOne({
        $set: { failedLoginAttempts: 0 },
        $unset: { lockedUntil: 1 },
    });
};

/**
 * Update last login
 */
superadminSchema.methods.updateLastLogin = async function (ip) {
    this.lastLogin = Date.now();
    this.lastLoginIp = ip;
    await this.save();
};

/**
 * Check if password was changed after token was issued
 */
superadminSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

module.exports = {
    schema: superadminSchema,
    model: mongoose.model('Superadmin', superadminSchema),
};
