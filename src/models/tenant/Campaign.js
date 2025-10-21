// src/models/tenant/Campaign.js
const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Campaign name is required'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        
        // Creator
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        
        // Status
        status: {
            type: String,
            enum: ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'],
            default: 'draft',
        },
        
        // Email Template
        emailTemplate: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'EmailTemplate',
        },
        
        // Targets
        targets: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Target',
        }],
        
        // Schedule
        schedule: {
            startDate: Date,
            endDate: Date,
            sendTime: String, // e.g., "09:00"
        },
        
        // Results/Stats
        results: {
            sent: {
                type: Number,
                default: 0,
            },
            delivered: {
                type: Number,
                default: 0,
            },
            opened: {
                type: Number,
                default: 0,
            },
            clicked: {
                type: Number,
                default: 0,
            },
            reported: {
                type: Number,
                default: 0,
            },
            failed: {
                type: Number,
                default: 0,
            },
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
campaignSchema.index({ createdBy: 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ createdAt: -1 });

module.exports = {
    schema: campaignSchema,
};
