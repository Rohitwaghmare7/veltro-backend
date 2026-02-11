const mongoose = require('mongoose');

const workingHoursSchema = new mongoose.Schema(
    {
        day: {
            type: String,
            enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            required: true,
        },
        start: { type: String, default: '09:00' },
        end: { type: String, default: '17:00' },
        isOpen: { type: Boolean, default: true },
    },
    { _id: false }
);

const businessSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Business name is required'],
            trim: true,
            maxlength: 100,
        },
        address: {
            street: { type: String, default: '' },
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            zipCode: { type: String, default: '' },
            country: { type: String, default: '' },
        },
        category: {
            type: String,
            enum: [
                'salon',
                'spa',
                'barbershop',
                'fitness',
                'healthcare',
                'consulting',
                'photography',
                'coaching',
                'real-estate',
                'other',
            ],
            default: 'other',
        },
        phone: {
            type: String,
            default: '',
        },
        email: {
            type: String,
            default: '',
        },
        website: {
            type: String,
            default: '',
        },
        logo: {
            type: String,
            default: '',
        },
        description: {
            type: String,
            default: '',
            maxlength: 500,
        },
        workingHours: {
            type: [workingHoursSchema],
            default: [
                { day: 'monday', start: '09:00', end: '17:00', isOpen: true },
                { day: 'tuesday', start: '09:00', end: '17:00', isOpen: true },
                { day: 'wednesday', start: '09:00', end: '17:00', isOpen: true },
                { day: 'thursday', start: '09:00', end: '17:00', isOpen: true },
                { day: 'friday', start: '09:00', end: '17:00', isOpen: true },
                { day: 'saturday', start: '10:00', end: '14:00', isOpen: false },
                { day: 'sunday', start: '10:00', end: '14:00', isOpen: false },
            ],
        },
        services: [
            {
                name: { type: String, required: true },
                duration: { type: Number, default: 30 }, // minutes
                price: { type: Number, default: 0 },
                description: String,
            }
        ],
        timezone: {
            type: String,
            default: 'Asia/Kolkata',
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        onboardingStep: {
            type: Number,
            default: 1,
            min: 1,
            max: 5,
        },
        isSetupComplete: {
            type: Boolean,
            default: false,
        },
        // Email Integration (Phase 3)
        emailConnected: {
            type: Boolean,
            default: false,
        },
        // Contact form fields (Phase 4)
        contactFormFields: {
            type: [String],
            default: ['name', 'email', 'phone', 'message'],
        },
        // Intake form config (Phase 4)
        intakeFormId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Form',
        },
        // Public booking slug
        bookingSlug: {
            type: String,
            unique: true,
            sparse: true,
        },
    },
    {
        timestamps: true,
    }
);

// Generate booking slug before save
businessSchema.pre('save', function (next) {
    if (!this.bookingSlug && this.name) {
        this.bookingSlug =
            this.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '') +
            '-' +
            Date.now().toString(36);
    }
    next();
});

module.exports = mongoose.model('Business', businessSchema);
