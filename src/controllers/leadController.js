const Contact = require('../models/Contact');

// @desc    Get all leads/contacts
// @route   GET /api/leads
// @access  Private
exports.getLeads = async (req, res, next) => {
    try {
        const { status, source } = req.query;
        const filter = { businessId: req.businessId };

        if (status) filter.status = status;
        if (source) filter.source = source;

        const leads = await Contact.find(filter)
            .sort({ createdAt: -1 })
            .populate('assignedTo', 'name');

        res.json({ success: true, data: leads, count: leads.length });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a lead manually
// @route   POST /api/leads
// @access  Private
exports.createLead = async (req, res, next) => {
    try {
        const { name, email, phone, source, notes, tags } = req.body;

        const lead = await Contact.create({
            businessId: req.businessId,
            name,
            email,
            phone,
            source: source || 'manual',
            notes,
            tags,
        });

        res.status(201).json({ success: true, data: lead });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a lead
// @route   PATCH /api/leads/:id
// @access  Private
exports.updateLead = async (req, res, next) => {
    try {
        const lead = await Contact.findOneAndUpdate(
            { _id: req.params.id, businessId: req.businessId },
            req.body,
            { new: true, runValidators: true }
        );

        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        res.json({ success: true, data: lead });
    } catch (error) {
        next(error);
    }
};

// @desc    Update lead status (for Kanban drag)
// @route   PATCH /api/leads/:id/status
// @access  Private
exports.updateLeadStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const lead = await Contact.findOneAndUpdate(
            { _id: req.params.id, businessId: req.businessId },
            { status },
            { new: true }
        );

        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        res.json({ success: true, data: lead });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a lead
// @route   DELETE /api/leads/:id
// @access  Private
exports.deleteLead = async (req, res, next) => {
    try {
        const lead = await Contact.findOneAndDelete({
            _id: req.params.id,
            businessId: req.businessId,
        });

        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        res.json({ success: true, message: 'Lead deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get contact form config (public)
// @route   GET /api/public/contact/:slug
// @access  Public
exports.getPublicContactFormConfig = async (req, res, next) => {
    try {
        const Business = require('../models/Business');
        const business = await Business.findOne({ bookingSlug: req.params.slug })
            .select('name contactFormFields');

        if (!business) {
            return res.status(404).json({ success: false, message: 'Business not found' });
        }

        res.json({ success: true, data: business });
    } catch (error) {
        next(error);
    }
};

// @desc    Submit contact form (public)
// @route   POST /api/public/contact/:slug
// @access  Public
exports.submitContactForm = async (req, res, next) => {
    try {
        const Business = require('../models/Business');
        const business = await Business.findOne({ bookingSlug: req.params.slug });

        if (!business) {
            return res.status(404).json({ success: false, message: 'Business not found' });
        }

        const { name, email, phone, message } = req.body;

        const lead = await Contact.create({
            businessId: business._id,
            name,
            email,
            phone,
            source: 'contact_form',
            notes: message,
        });

        res.status(201).json({ success: true, data: lead, message: 'Thank you! We\'ll get back to you soon.' });
    } catch (error) {
        next(error);
    }
};
