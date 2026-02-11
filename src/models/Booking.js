const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: true,
        },
        contactId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contact',
        },
        clientName: {
            type: String,
            required: [true, 'Client name is required'],
            trim: true,
        },
        clientEmail: {
            type: String,
            required: [true, 'Client email is required'],
            trim: true,
            lowercase: true,
        },
        clientPhone: {
            type: String,
            trim: true,
        },
        serviceType: {
            type: String,
            required: [true, 'Service type is required'],
            trim: true,
        },
        date: {
            type: Date,
            required: [true, 'Booking date is required'],
        },
        timeSlot: {
            type: String,
            required: [true, 'Time slot is required'],
        },
        duration: {
            type: Number,
            default: 60, // minutes
        },
        location: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'completed', 'no-show', 'cancelled'],
            default: 'pending',
        },
        formsStatus: {
            type: String,
            enum: ['pending', 'sent', 'completed'],
            default: 'pending',
        },
        confirmedAt: Date,
        notes: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index for fast queries
bookingSchema.index({ businessId: 1, date: 1 });
bookingSchema.index({ businessId: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
