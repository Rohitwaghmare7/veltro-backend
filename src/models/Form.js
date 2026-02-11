const mongoose = require('mongoose');

const formSchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: true,
        },
        title: {
            type: String,
            required: [true, 'Form title is required'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        fields: [
            {
                id: String,
                type: {
                    type: String,
                    enum: ['text', 'textarea', 'number', 'email', 'phone', 'select', 'checkbox', 'date', 'multiselect'],
                    required: true,
                },
                label: { type: String, required: true },
                placeholder: String,
                required: { type: Boolean, default: false },
                options: [String], // For select/radio/multiselect
            }
        ],
        isActive: {
            type: Boolean,
            default: true,
        },
        submissionsCount: {
            type: Number,
            default: 0,
        },
        // Link to booking types
        linkedServices: [String], // Service names this form is linked to
        isRequiredForBooking: {
            type: Boolean,
            default: false,
        },
        autoSendAfterBooking: {
            type: Boolean,
            default: false,
        },
        sendDelay: {
            type: Number,
            default: 0, // Minutes after booking to send form
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Form', formSchema);
