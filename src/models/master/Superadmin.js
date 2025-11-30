// src/models/master/Superadmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const superadminSchema = new mongoose.Schema(
    {
        email: { 
            type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true, 
            validate: [validator.isEmail, 'Please provide a valid email'] 
        },
        password: { type: String, required: [true, 'Password is required'], minlength: 8, select: false },
        name: { type: String, required: [true, 'Name is required'], trim: true },
        role: { type: String, default: 'superadmin', immutable: true },
        permissions: {
            canCreateTenants: { type: Boolean, default: true },
            canDeleteTenants: { type: Boolean, default: true },
            canViewAllTenants: { type: Boolean, default: true },
            canManageSubscriptions: { type: Boolean, default: true },
            canManageSuperadmins: { type: Boolean, default: false },
        },
        isActive: { type: Boolean, default: true },
        lastLogin: { type: Date },
        lastLoginIp: { type: String },
        failedLoginAttempts: { type: Number, default: 0 },
        lockedUntil: { type: Date },
        passwordResetToken: String,
        passwordResetExpires: Date,
        passwordChangedAt: Date,
        profile: { phone: String, avatar: String },
    },
    { timestamps: true }
);

superadminSchema.index({ email: 1 });
superadminSchema.index({ isActive: 1 });

superadminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        if (!this.isNew) this.passwordChangedAt = Date.now() - 1000;
        next();
    } catch (error) { next(error); }
});

superadminSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = {
    schema: superadminSchema,
    // Removed 'model' export
};