// src/models/tenant/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema(
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
            select: false, // Don't include in queries by default
        },
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
        },
        
        // Role-Based Access Control
        role: {
            type: String,
            required: true,
            enum: ['admin', 'user', 'readonly'],
            default: 'user',
        },
        permissions: {
            type: [String],
            default: [],
            // Examples: 'campaigns.create', 'campaigns.edit', 'campaigns.delete', 'reports.view'
        },
        
        // Profile
        profile: {
            phone: {
                type: String,
                trim: true,
            },
            department: {
                type: String,
                trim: true,
            },
            jobTitle: {
                type: String,
                trim: true,
            },
            avatar: {
                type: String, // URL to avatar image
            },
            bio: {
                type: String,
                maxlength: 500,
            },
        },
        
        // Security & Verification
        isActive: {
            type: Boolean,
            default: true,
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        emailVerificationToken: String,
        emailVerificationExpires: Date,
        
        // Password Reset
        passwordResetToken: String,
        passwordResetExpires: Date,
        passwordChangedAt: Date,
        
        // Login Security
        lastLogin: Date,
        lastLoginIp: String,
        loginAttempts: {
            type: Number,
            default: 0,
        },
        lockUntil: Date,
        
        // Two-Factor Authentication (future)
        twoFactorEnabled: {
            type: Boolean,
            default: false,
        },
        twoFactorSecret: String,
        
        // Metadata
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        invitationToken: String, // Link back to invitation
    },
    {
        timestamps: true,
    }
);

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for account lock status
userSchema.virtual('isLocked').get(function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function (next) {
    // Only hash if password is modified
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        
        // Update passwordChangedAt
        if (!this.isNew) {
            this.passwordChangedAt = Date.now() - 1000;
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
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Check if account is locked
 */
userSchema.methods.isAccountLocked = function () {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

/**
 * Increment failed login attempts
 */
userSchema.methods.incrementLoginAttempts = async function () {
    // Reset if lock has expired
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return await this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 },
        });
    }
    
    // Increment attempts
    const updates = { $inc: { loginAttempts: 1 } };
    
    // Lock account after 5 failed attempts
    const maxAttempts = 5;
    const lockTime = 2 * 60 * 60 * 1000; // 2 hours
    
    if (this.loginAttempts + 1 >= maxAttempts && !this.isAccountLocked()) {
        updates.$set = { lockUntil: Date.now() + lockTime };
    }
    
    return await this.updateOne(updates);
};

/**
 * Reset failed login attempts
 */
userSchema.methods.resetLoginAttempts = async function () {
    return await this.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 },
    });
};

/**
 * Update last login
 */
userSchema.methods.updateLastLogin = async function (ip) {
    this.lastLogin = Date.now();
    this.lastLoginIp = ip;
    this.loginAttempts = 0;
    this.lockUntil = undefined;
    await this.save();
};

/**
 * Check if password was changed after token was issued
 */
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

/**
 * Get user's effective permissions
 */
userSchema.methods.getEffectivePermissions = function () {
    // Role-based default permissions
    const rolePermissions = {
        admin: [
            'campaigns.*',
            'templates.*',
            'users.view',
            'users.create',
            'users.edit',
            'reports.*',
            'settings.view',
            'settings.edit',
        ],
        user: [
            'campaigns.view',
            'campaigns.create',
            'campaigns.edit',
            'templates.view',
            'templates.create',
            'reports.view',
        ],
        readonly: [
            'campaigns.view',
            'templates.view',
            'reports.view',
        ],
    };
    
    // Merge role permissions with custom permissions
    const basePermissions = rolePermissions[this.role] || [];
    return [...new Set([...basePermissions, ...this.permissions])];
};

/**
 * Check if user has specific permission
 */
userSchema.methods.hasPermission = function (permission) {
    const permissions = this.getEffectivePermissions();
    
    // Check exact match
    if (permissions.includes(permission)) return true;
    
    // Check wildcard match (e.g., 'campaigns.*' matches 'campaigns.create')
    const [resource, action] = permission.split('.');
    return permissions.includes(`${resource}.*`);
};

// Static Methods

/**
 * Find user by email
 */
userSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase() });
};

/**
 * Find active users
 */
userSchema.statics.findActiveUsers = function () {
    return this.find({ isActive: true }).select('-password');
};

/**
 * Count users by role
 */
userSchema.statics.countByRole = function (role) {
    return this.countDocuments({ role, isActive: true });
};

module.exports = {
    schema: userSchema,
};
