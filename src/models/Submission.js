const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
    {
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
        contactId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Contact',
        },
        data: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
            required: true,
        },
        metadata: {
            ip: String,
            userAgent: String,
        }
    },
    {
        timestamps: true,
    }
);

submissionSchema.index({ formId: 1, createdAt: -1 });

module.exports = mongoose.model('Submission', submissionSchema);
