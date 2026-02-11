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
            .populate('assignedTo', 'name email');

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
        const { name, email, phone, source, notes, tags, assignedTo } = req.body;
        const Business = require('../models/Business');
        const { fireAutomation, TRIGGERS } = require('../services/automation.service');

        const lead = await Contact.create({
            businessId: req.businessId,
            name,
            email,
            phone,
            source: source || 'manual',
            notes,
            tags,
            assignedTo: assignedTo || undefined,
        });

        // Populate assignedTo for response
        await lead.populate('assignedTo', 'name email');

        // Get business details for automation
        const business = await Business.findById(req.businessId);

        // Fire NEW_CONTACT automation (welcome email)
        if (business && business.isSetupComplete && email) {
            await fireAutomation(TRIGGERS.NEW_CONTACT, {
                businessId: req.businessId,
                contact: lead,
                business,
            });
        }

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
        ).populate('assignedTo', 'name email');

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
