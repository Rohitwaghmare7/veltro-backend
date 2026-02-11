const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    business: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Business',
        required: true,
        index: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ['booking', 'message', 'form', 'automation', 'system', 'staff'],
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    link: {
        type: String, // URL to navigate to when clicked
    },
    read: {
        type: Boolean,
        default: false,
        index: true,
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed, // Additional data (booking ID, message ID, etc.)
    },
}, {
    timestamps: true,
});

// Index for efficient queries
notificationSchema.index({ business: 1, user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
