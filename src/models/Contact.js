const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: true,
        },
        name: {
            type: String,
            required: [true, 'Contact name is required'],
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        source: {
            type: String,
            enum: ['contact_form', 'booking', 'manual', 'form_submission', 'gmail_import'],
            default: 'manual',
        },
        status: {
            type: String,
            enum: ['new', 'contacted', 'qualified', 'booked', 'closed'],
            default: 'new',
        },
        conversationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Conversation',
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        tags: [String],
        notes: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

contactSchema.index({ businessId: 1, status: 1 });
contactSchema.index({ businessId: 1, email: 1 });

module.exports = mongoose.model('Contact', contactSchema);
