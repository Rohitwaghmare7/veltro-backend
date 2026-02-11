const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
    {
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
            required: true,
            index: true,
        },
        direction: {
            type: String,
            enum: ['inbound', 'outbound'],
            required: true,
        },
        type: {
            type: String,
            enum: ['manual', 'automated'],
            required: true,
            default: 'manual',
        },
        content: {
            type: String,
            required: true,
        },
        channel: {
            type: String,
            enum: ['email', 'sms'],
            required: true,
        },
        sentAt: {
            type: Date,
            default: Date.now,
        },
        readAt: {
            type: Date,
        },
        metadata: {
            subject: String, // For emails
            from: String,
            to: String,
        },
    },
    {
        timestamps: true,
    }
);

// Index for efficient queries
messageSchema.index({ conversationId: 1, sentAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
