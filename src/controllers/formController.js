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
        const { title, description, fields, isActive } = req.body;

        const form = await Form.create({
            businessId: req.businessId,
            title,
            description,
            fields,
            isActive: isActive !== undefined ? isActive : true,
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


// === PUBLIC ENDPOINTS ===

// @desc    Get public form definition
// @route   GET /api/public/forms/:id
// @access  Public
exports.getPublicForm = async (req, res, next) => {
    try {
        const form = await Form.findById(req.params.id);

        if (!form || !form.isActive) {
            return res.status(404).json({ success: false, message: 'Form not found or inactive' });
        }

        // Return only necessary public info
        const publicForm = {
            id: form._id,
            title: form.title,
            description: form.description,
            fields: form.fields,
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

        // Try to match submission to existing contact or create new one if email/phone provided
        let contactId = null;
        let emailField = form.fields.find(f => f.type === 'email');
        let phoneField = form.fields.find(f => f.type === 'phone');
        let nameField = form.fields.find(f => f.label.toLowerCase().includes('name')); // Heuristic

        const email = emailField ? data[emailField.id] : null;
        const phone = phoneField ? data[phoneField.id] : null;
        const name = nameField ? data[nameField.id] : 'Form Submission';

        if (email || phone) {
            // Find existing contact
            let contact = await Contact.findOne({
                businessId: form.businessId,
                $or: [
                    { email: email },
                    { phone: phone }
                ].filter(Boolean) // Remove nulls
            });

            if (!contact) {
                // Create new contact
                contact = await Contact.create({
                    businessId: form.businessId,
                    name: name,
                    email: email,
                    phone: phone,
                    source: 'contact_form',
                    notes: `Created from form submission: ${form.title}`,
                    tags: ['Form Submission']
                });
            }
            contactId = contact._id;
        }

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
        // Using $inc is safer for concurrency
        await Form.findByIdAndUpdate(form._id, { $inc: { submissionsCount: 1 } });

        res.status(201).json({ success: true, message: 'Form submitted successfully' });
    } catch (error) {
        next(error);
    }
};
