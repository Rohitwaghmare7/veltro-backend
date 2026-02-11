const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: true,
            index: true,
        },
        contactId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contact',
            required: true,
            index: true,
        },
        channel: {
            type: String,
            enum: ['email', 'sms', 'both'],
            default: 'email',
        },
        status: {
            type: String,
            enum: ['open', 'resolved'],
            default: 'open',
        },
        lastMessageAt: {
            type: Date,
            default: Date.now,
        },
        automationPaused: {
            type: Boolean,
            default: false,
        },
        pausedAt: {
            type: Date,
        },
        pausedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        unreadCount: {
            type: Number,
            default: 0,
        },
        summary: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient queries
conversationSchema.index({ businessId: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ contactId: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
