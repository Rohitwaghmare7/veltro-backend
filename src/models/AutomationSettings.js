const mongoose = require('mongoose');

const automationSettingsSchema = new mongoose.Schema(
    {
        businessId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Business',
            required: true,
            unique: true,
        },
        automations: {
            NEW_CONTACT: {
                enabled: { type: Boolean, default: true },
                name: { type: String, default: 'Welcome Email' },
                description: { type: String, default: 'Send welcome email when a new contact is created' },
                emailSubject: { type: String, default: 'Welcome to {{businessName}}!' },
                emailTemplate: { type: String, default: '<p>Hi {{contactName}},</p><p>Thank you for reaching out to us! We\'re excited to connect with you.</p><p>Our team will review your message and get back to you shortly.</p><p>Best regards,<br>{{businessName}}</p>' },
            },
            BOOKING_CREATED: {
                enabled: { type: Boolean, default: true },
                name: { type: String, default: 'Booking Confirmation' },
                description: { type: String, default: 'Send confirmation email when a booking is created' },
                emailSubject: { type: String, default: 'Booking Confirmed - {{serviceType}}' },
                emailTemplate: { type: String, default: '<p>Hi {{contactName}},</p><p>Your booking has been confirmed!</p><p><strong>Service:</strong> {{serviceType}}<br><strong>Date:</strong> {{date}}<br><strong>Time:</strong> {{timeSlot}}</p><p>We look forward to seeing you!</p><p>Best regards,<br>{{businessName}}</p>' },
            },
            BOOKING_REMINDER: {
                enabled: { type: Boolean, default: true },
                name: { type: String, default: 'Booking Reminder' },
                description: { type: String, default: 'Send reminder email 24 hours before appointment' },
                emailSubject: { type: String, default: 'Reminder: Your appointment tomorrow' },
                emailTemplate: { type: String, default: '<p>Hi {{contactName}},</p><p>This is a friendly reminder about your upcoming appointment:</p><p><strong>Service:</strong> {{serviceType}}<br><strong>Date:</strong> {{date}}<br><strong>Time:</strong> {{timeSlot}}</p><p>See you soon!</p><p>Best regards,<br>{{businessName}}</p>' },
            },
            FORM_PENDING: {
                enabled: { type: Boolean, default: true },
                name: { type: String, default: 'Form Reminder' },
                description: { type: String, default: 'Send reminder for pending form submissions' },
                emailSubject: { type: String, default: 'Complete your form - {{formName}}' },
                emailTemplate: { type: String, default: '<p>Hi {{contactName}},</p><p>We noticed you haven\'t completed the form: <strong>{{formName}}</strong></p><p>Please take a moment to fill it out: <a href="{{formLink}}">Complete Form</a></p><p>Thank you!</p><p>Best regards,<br>{{businessName}}</p>' },
            },
            INVENTORY_LOW: {
                enabled: { type: Boolean, default: true },
                name: { type: String, default: 'Low Stock Alert' },
                description: { type: String, default: 'Notify when inventory falls below threshold' },
                emailSubject: { type: String, default: 'Low Stock Alert - {{itemName}}' },
                emailTemplate: { type: String, default: '<p>Hi,</p><p>The following item is running low:</p><p><strong>Item:</strong> {{itemName}}<br><strong>Current Stock:</strong> {{currentStock}}<br><strong>Threshold:</strong> {{threshold}}</p><p>Please restock soon.</p><p>Best regards,<br>{{businessName}}</p>' },
            },
        },
    },
    {
        timestamps: true,
    }
);

automationSettingsSchema.index({ businessId: 1 });

module.exports = mongoose.model('AutomationSettings', automationSettingsSchema);
