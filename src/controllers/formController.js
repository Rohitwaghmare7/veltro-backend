const Form = require('../models/Form');
const Submission = require('../models/Submission');
const Contact = require('../models/Contact'); // For linking submissions to contacts

// @desc    Get all forms logic
// @route   GET /api/forms
// @access  Private
exports.getForms = async (req, res, next) => {
    try {
        const forms = await Form.find({ businessId: req.businessId })
            .sort({ createdAt: -1 });

        res.json({ success: true, data: forms, count: forms.length });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single form logic
// @route   GET /api/forms/:id
// @access  Private
exports.getFormById = async (req, res, next) => {
    try {
        const form = await Form.findOne({ _id: req.params.id, businessId: req.businessId });

        if (!form) {
            return res.status(404).json({ success: false, message: 'Form not found' });
        }

        res.json({ success: true, data: form });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new form logic
// @route   POST /api/forms
// @access  Private
exports.createForm = async (req, res, next) => {
    try {
        const { 
            title, 
            description, 
            fields, 
            isActive,
            linkedServices,
            isRequiredForBooking,
            autoSendAfterBooking,
            sendDelay
        } = req.body;

        const form = await Form.create({
            businessId: req.businessId,
            title,
            description,
            fields,
            isActive: isActive !== undefined ? isActive : true,
            linkedServices: linkedServices || [],
            isRequiredForBooking: isRequiredForBooking || false,
            autoSendAfterBooking: autoSendAfterBooking || false,
            sendDelay: sendDelay || 0,
        });

        res.status(201).json({ success: true, data: form });
    } catch (error) {
        next(error);
    }
};

// @desc    Update form logic
// @route   PUT /api/forms/:id
// @access  Private
exports.updateForm = async (req, res, next) => {
    try {
        const form = await Form.findOneAndUpdate(
            { _id: req.params.id, businessId: req.businessId },
            req.body,
            { new: true, runValidators: true }
        );

        if (!form) {
            return res.status(404).json({ success: false, message: 'Form not found' });
        }

        res.json({ success: true, data: form });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete form logic
// @route   DELETE /api/forms/:id
// @access  Private
exports.deleteForm = async (req, res, next) => {
    try {
        const form = await Form.findOneAndDelete({ _id: req.params.id, businessId: req.businessId });

        if (!form) {
            return res.status(404).json({ success: false, message: 'Form not found' });
        }

        // Also delete submissions for this form? Maybe keep them or soft delete form?
        // For simplicity, let's keep submissions but they will be orphaned unless we cascade delete.
        // Let's delete submissions for now to keep it clean.
        await Submission.deleteMany({ formId: req.params.id });

        res.json({ success: true, message: 'Form deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all submissions for a form logic
// @route   GET /api/forms/:id/submissions
// @access  Private
exports.getSubmissions = async (req, res, next) => {
    try {
        // First ensure user owns the form
        const form = await Form.findOne({ _id: req.params.id, businessId: req.businessId });
        if (!form) {
            return res.status(404).json({ success: false, message: 'Form not found' });
        }

        const submissions = await Submission.find({ formId: req.params.id })
            .sort({ createdAt: -1 })
            .populate('contactId', 'name email');

        res.json({ success: true, data: submissions, count: submissions.length });
    } catch (error) {
        next(error);
    }
};

// @desc    Export form submissions as CSV
// @route   GET /api/forms/:id/export
// @access  Private
exports.exportSubmissions = async (req, res, next) => {
    try {
        // First ensure user owns the form
        const form = await Form.findOne({ _id: req.params.id, businessId: req.businessId });
        if (!form) {
            return res.status(404).json({ success: false, message: 'Form not found' });
        }

        const submissions = await Submission.find({ formId: req.params.id })
            .sort({ createdAt: -1 })
            .populate('contactId', 'name email')
            .lean();

        if (submissions.length === 0) {
            return res.status(404).json({ success: false, message: 'No submissions to export' });
        }

        // Build CSV
        const headers = ['Submission Date', 'Contact Name', 'Contact Email'];
        
        // Add field labels as headers
        form.fields.forEach(field => {
            headers.push(field.label);
        });

        const csvRows = [headers.join(',')];

        // Add data rows
        submissions.forEach(submission => {
            const row = [
                new Date(submission.createdAt).toLocaleString(),
                submission.contactId?.name || 'N/A',
                submission.contactId?.email || 'N/A',
            ];

            // Add field values
            form.fields.forEach(field => {
                // Handle Map object - convert to plain object if needed
                let value = '';
                if (submission.data instanceof Map) {
                    value = submission.data.get(field.id) || '';
                } else if (typeof submission.data === 'object') {
                    value = submission.data[field.id] || '';
                }
                
                // Handle arrays (for multiselect, checkbox)
                if (Array.isArray(value)) {
                    value = value.join(', ');
                }
                
                // Escape commas and quotes in CSV
                const escapedValue = String(value).replace(/"/g, '""');
                row.push(`"${escapedValue}"`);
            });

            csvRows.push(row.join(','));
        });

        const csv = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${form.title.replace(/[^a-z0-9]/gi, '_')}_submissions.csv"`);
        res.send(csv);
    } catch (error) {
        console.error('CSV Export Error:', error);
        next(error);
    }
};

// @desc    Get forms linked to a booking
// @route   GET /api/forms/booking/:bookingId
// @access  Private
exports.getBookingForms = async (req, res, next) => {
    try {
        const BookingForm = require('../models/BookingForm');
        const { bookingId } = req.params;

        const bookingForms = await BookingForm.find({
            bookingId,
            businessId: req.businessId,
        })
            .populate('formId', 'title description')
            .populate('submissionId')
            .sort({ createdAt: 1 })
            .lean();

        res.json({ success: true, data: bookingForms, count: bookingForms.length });
    } catch (error) {
        next(error);
    }
};


// === PUBLIC ENDPOINTS ===

// @desc    Get public form definition
// @route   GET /api/public/forms/:id
// @access  Public
exports.getPublicForm = async (req, res, next) => {
    try {
        const form = await Form.findById(req.params.id).populate('businessId', 'name email phone address website');

        if (!form || !form.isActive) {
            return res.status(404).json({ success: false, message: 'Form not found or inactive' });
        }

        // Return only necessary public info
        const publicForm = {
            id: form._id,
            title: form.title,
            description: form.description,
            fields: form.fields,
            business: form.businessId ? {
                name: form.businessId.name,
                email: form.businessId.email,
                phone: form.businessId.phone,
                address: form.businessId.address,
                website: form.businessId.website
            } : null
        };

        res.json({ success: true, data: publicForm });
    } catch (error) {
        next(error);
    }
};

// @desc    Submit form data
// @route   POST /api/public/forms/:id/submit
// @access  Public
exports.submitForm = async (req, res, next) => {
    try {
        const form = await Form.findById(req.params.id);

        if (!form || !form.isActive) {
            return res.status(404).json({ success: false, message: 'Form not found or inactive' });
        }

        const { data } = req.body; // Expecting data object with answers

        // Basic validation: Check required fields
        const missingFields = form.fields
            .filter(field => field.required && !data[field.id])
            .map(field => field.label);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Please fill in required fields: ${missingFields.join(', ')}`
            });
        }

        // MANDATORY: Extract email from form submission
        let emailField = form.fields.find(f => f.type === 'email');
        const email = emailField ? data[emailField.id] : null;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required to submit this form'
            });
        }

        // Extract other contact information
        let phoneField = form.fields.find(f => f.type === 'phone');
        let nameField = form.fields.find(f => f.label.toLowerCase().includes('name'));

        const phone = phoneField ? data[phoneField.id] : null;
        const name = nameField ? data[nameField.id] : email.split('@')[0]; // Use email prefix if no name

        // Find existing contact or create new one (ALWAYS create lead)
        let contact = await Contact.findOne({
            businessId: form.businessId,
            email: email
        });

        if (!contact) {
            // Create new contact/lead
            contact = await Contact.create({
                businessId: form.businessId,
                name: name,
                email: email,
                phone: phone,
                source: 'form_submission',
                status: 'new', // Mark as new lead
                notes: `Created from form submission: ${form.title}`,
                tags: ['Form Submission', form.title]
            });
        } else {
            // Update existing contact with any new information
            if (phone && !contact.phone) {
                contact.phone = phone;
            }
            if (name && name !== email.split('@')[0] && !contact.name) {
                contact.name = name;
            }
            // Add form submission tag if not already present
            if (!contact.tags.includes('Form Submission')) {
                contact.tags.push('Form Submission');
            }
            if (!contact.tags.includes(form.title)) {
                contact.tags.push(form.title);
            }
            await contact.save();
        }

        const contactId = contact._id;

        // Create conversation and message in inbox
        const Conversation = require('../models/Conversation');
        const Message = require('../models/Message');
        const Business = require('../models/Business');
        const { fireAutomation, TRIGGERS } = require('../services/automation.service');

        // Check if conversation already exists
        let conversation = await Conversation.findOne({
            businessId: form.businessId,
            contactId: contact._id,
        });

        const isNewContact = !conversation;

        if (!conversation) {
            // Create new conversation
            conversation = await Conversation.create({
                businessId: form.businessId,
                contactId: contact._id,
                channel: 'email',
                status: 'open',
                lastMessageAt: new Date(),
                automationPaused: false,
            });

            // Get business details for automation
            const business = await Business.findById(form.businessId);

            // Fire NEW_CONTACT automation (welcome email)
            if (business && business.isSetupComplete) {
                await fireAutomation(TRIGGERS.NEW_CONTACT, {
                    businessId: form.businessId,
                    contact: contact,
                    business,
                });
            }
        } else {
            // Update existing conversation
            await Conversation.findByIdAndUpdate(conversation._id, {
                $set: { lastMessageAt: new Date(), status: 'open' },
            });
        }

        // Create a message record for the form submission with formatted data
        const formattedData = Object.keys(data).map(fieldId => {
            const field = form.fields.find(f => f.id === fieldId);
            return field ? `${field.label}: ${data[fieldId]}` : null;
        }).filter(Boolean).join('\n');

        await Message.create({
            conversationId: conversation._id,
            direction: 'inbound',
            type: 'automated',
            content: `Form submitted: ${form.title}\n\n${formattedData}`,
            channel: 'email',
            sentAt: new Date(),
            metadata: {
                formId: form._id,
                formTitle: form.title,
                submissionData: data,
            },
        });

        const submission = await Submission.create({
            formId: form._id,
            businessId: form.businessId,
            contactId,
            data,
            metadata: {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            }
        });

        // Increment submission count
        await Form.findByIdAndUpdate(form._id, { $inc: { submissionsCount: 1 } });

        // Create notification for form submission
        try {
            const { createNotification } = require('./notificationController');
            const Business = require('../models/Business');
            
            const business = await Business.findById(form.businessId);
            if (business) {
                await createNotification(form.businessId, business.owner, {
                    type: 'form',
                    title: isNewContact ? 'New Lead from Form' : 'Form Submission',
                    message: `${name} submitted ${form.title}`,
                    link: '/dashboard/inbox',
                    metadata: { 
                        submissionId: submission._id,
                        formId: form._id,
                        contactId: contactId
                    }
                });
            }
        } catch (notifError) {
            console.error('Failed to create notification:', notifError);
        }

        res.status(201).json({ success: true, message: 'Form submitted successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Toggle form as default booking form
// @route   PATCH /api/forms/:id/toggle-default
// @access  Private
exports.toggleDefaultBookingForm = async (req, res, next) => {
    try {
        const form = await Form.findOne({ _id: req.params.id, businessId: req.businessId });

        if (!form) {
            return res.status(404).json({ success: false, message: 'Form not found' });
        }

        // If setting this form as default, unset all other forms
        if (!form.isDefaultBookingForm) {
            await Form.updateMany(
                { businessId: req.businessId, _id: { $ne: req.params.id } },
                { $set: { isDefaultBookingForm: false } }
            );
            form.isDefaultBookingForm = true;
        } else {
            // If unsetting, just toggle this form
            form.isDefaultBookingForm = false;
        }

        await form.save();

        res.json({ success: true, data: form });
    } catch (error) {
        next(error);
    }
};
