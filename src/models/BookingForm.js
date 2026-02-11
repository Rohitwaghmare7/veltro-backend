const mongoose = require('mongoose');

const bookingFormSchema = new mongoose.Schema(
    {
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            required: true,
            index: true,
        },
        formId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Form',
            required: true,
        },
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'sent', 'completed', 'overdue'],
            default: 'pending',
        },
        sentAt: Date,
        completedAt: Date,
        submissionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Submission',
        },
        reminderSent: {
            type: Boolean,
            default: false,
        },
        reminderSentAt: Date,
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient queries
bookingFormSchema.index({ bookingId: 1, formId: 1 }, { unique: true });
bookingFormSchema.index({ businessId: 1, status: 1 });

module.exports = mongoose.model('BookingForm', bookingFormSchema);
