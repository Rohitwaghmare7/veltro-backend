const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: true,
        },
        name: {
            type: String,
            required: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
        },
        permissions: {
            canViewBookings: { type: Boolean, default: true },
            canEditBookings: { type: Boolean, default: false },
            canViewLeads: { type: Boolean, default: true },
            canEditLeads: { type: Boolean, default: false },
            canViewInbox: { type: Boolean, default: true },
            canSendEmails: { type: Boolean, default: false },
            canManageInventory: { type: Boolean, default: false },
            canViewReports: { type: Boolean, default: false },
            canManageAutomations: { type: Boolean, default: false },
        },
        inviteToken: {
            type: String,
        },
        inviteStatus: {
            type: String,
            enum: ['pending', 'accepted', 'expired'],
            default: 'pending',
        },
        invitedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Staff', staffSchema);
