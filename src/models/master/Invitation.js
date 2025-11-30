// src/models/master/Invitation.js
const mongoose = require('mongoose');
const validator = require('validator');

const invitationSchema = new mongoose.Schema(
    {
        email: {
            type: String, required: [true, 'Email is required'], lowercase: true, trim: true,
            validate: [validator.isEmail, 'Please provide a valid email']
        },
        tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
        invitedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'invitedByModel', required: true },
        invitedByModel: { type: String, required: true, enum: ['Superadmin', 'User'] },
        role: { type: String, required: true, enum: ['admin', 'user', 'readonly'], default: 'user' },
        status: { type: String, enum: ['pending', 'accepted', 'expired', 'revoked'], default: 'pending' },
        token: { type: String, required: true, unique: true },
        expiresAt: { type: Date, required: true },
        acceptedAt: Date,
        acceptedBy: mongoose.Schema.Types.ObjectId,
        metadata: { department: String, jobTitle: String, customFields: mongoose.Schema.Types.Mixed },
    },
    { timestamps: true }
);

invitationSchema.index({ tenantId: 1 });
invitationSchema.index({ status: 1, expiresAt: 1 });
invitationSchema.index({ createdAt: -1 });

invitationSchema.virtual('isExpired').get(function () { return this.expiresAt < Date.now(); });
invitationSchema.virtual('isValid').get(function () { return this.status === 'pending' && !this.isExpired; });

invitationSchema.methods.markAsAccepted = async function (userId) {
    this.status = 'accepted';
    this.acceptedAt = Date.now();
    this.acceptedBy = userId;
    await this.save();
};

invitationSchema.statics.findValidByToken = function (token) {
    return this.findOne({ token, status: 'pending', expiresAt: { $gt: Date.now() } });
};

invitationSchema.pre('save', function (next) {
    if (this.isNew && !this.expiresAt) {
        this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    next();
});

module.exports = {
    schema: invitationSchema,
    // Removed 'model' export
};