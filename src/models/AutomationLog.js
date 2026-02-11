const mongoose = require('mongoose');

const automationLogSchema = new mongoose.Schema(
    {
        trigger: {
            type: String,
            required: true,
            enum: [
                'NEW_CONTACT',
                'BOOKING_CREATED',
                'BOOKING_REMINDER',
                'FORM_PENDING',
                'INVENTORY_LOW',
                'STAFF_REPLIED',
            ],
        },
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: true,
            index: true,
        },
        contactId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contact',
        },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
        },
        inventoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Inventory',
        },
        firedAt: {
            type: Date,
            default: Date.now,
        },
        type: {
            type: String,
            enum: ['email', 'sms', 'system'],
            required: true,
        },
        success: {
            type: Boolean,
            default: true,
        },
        error: {
            type: String,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
        },
    },
    {
        timestamps: true,
    }
);

// Index for efficient queries
automationLogSchema.index({ businessId: 1, firedAt: -1 });
automationLogSchema.index({ trigger: 1, success: 1 });

module.exports = mongoose.model('AutomationLog', automationLogSchema);
