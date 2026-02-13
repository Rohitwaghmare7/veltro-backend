const AutomationLog = require('../models/AutomationLog');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Business = require('../models/Business');
const {
    sendEmail,
    welcomeEmail,
    bookingConfirmation,
    bookingReminder,
    formReminder,
    inventoryAlert,
} = require('./email.service');
const gmailService = require('./gmail.service');

/**
 * Send email using Gmail if connected, otherwise use SMTP
 */
const sendEmailSmart = async ({ businessId, to, subject, html, trigger, contactId }) => {
    try {
        // Check if Gmail is connected
        const business = await Business.findById(businessId);
        
        if (business?.integrations?.gmail?.connected) {
            console.log('📧 [AUTOMATION] Using Gmail to send email');
            try {
                const result = await gmailService.sendEmail(businessId, {
                    to,
                    subject,
                    body: html,
                });
                
                console.log('✅ [AUTOMATION] Sent via Gmail successfully');
                
                // Log to AutomationLog
                await AutomationLog.create({
                    trigger,
                    businessId,
                    contactId,
                    firedAt: new Date(),
                    type: 'email',
                    success: true,
                    metadata: {
                        messageId: result.id,
                        to,
                        subject,
                        via: 'gmail',
                    },
                });
                
                return { success: true, messageId: result.id, via: 'gmail' };
            } catch (gmailError) {
                console.error('❌ [AUTOMATION] Gmail send failed, falling back to SMTP:', gmailError.message);
                // Fall back to SMTP if Gmail fails
            }
        }
        
        // Use SMTP (either Gmail not connected or Gmail failed)
        console.log('📧 [AUTOMATION] Using SMTP to send email');
        const result = await sendEmail({
            to,
            subject,
            html,
            businessId,
            trigger,
            contactId,
        });
        
        return { ...result, via: 'smtp' };
    } catch (error) {
        console.error('❌ [AUTOMATION] All email methods failed:', error.message);
        
        // Log failure
        await AutomationLog.create({
            trigger,
            businessId,
            contactId,
            firedAt: new Date(),
            type: 'email',
            success: false,
            error: error.message,
        });
        
        return { success: false, error: error.message };
    }
};

/**
 * Automation Trigger Constants
 */
const TRIGGERS = {
    NEW_CONTACT: 'NEW_CONTACT',
    BOOKING_CREATED: 'BOOKING_CREATED',
    BOOKING_REMINDER: 'BOOKING_REMINDER',
    FORM_PENDING: 'FORM_PENDING',
    INVENTORY_LOW: 'INVENTORY_LOW',
    STAFF_REPLIED: 'STAFF_REPLIED',
};

/**
 * Check if automation is paused for a contact
 */
const isAutomationPaused = async (contactId) => {
    const conversation = await Conversation.findOne({ contactId });
    return conversation?.automationPaused || false;
};

/**
 * Main automation trigger function
 * @param {string} trigger - Trigger type from TRIGGERS constant
 * @param {object} payload - Data needed for the automation
 */
const fireAutomation = async (trigger, payload) => {
    try {
        const { businessId, contactId } = payload;

        // Check if automation is enabled for this business
        const AutomationSettings = require('../models/AutomationSettings');
        const settings = await AutomationSettings.findOne({ businessId });
        
        if (settings && settings.automations[trigger] && !settings.automations[trigger].enabled) {
            console.log(`⏸️  Automation ${trigger} is disabled for business ${businessId}`);
            return { success: false, reason: 'automation_disabled' };
        }

        // Check if automation is paused for this contact (except for system triggers)
        if (contactId && trigger !== TRIGGERS.STAFF_REPLIED && trigger !== TRIGGERS.INVENTORY_LOW) {
            const paused = await isAutomationPaused(contactId);
            if (paused) {
                console.log(`⏸️  Automation paused for contact ${contactId}, skipping ${trigger}`);
                return { success: false, reason: 'automation_paused' };
            }
        }

        console.log(`🤖 Firing automation: ${trigger}`);

        // Route to appropriate handler
        switch (trigger) {
            case TRIGGERS.NEW_CONTACT:
                return await handleNewContact(payload);

            case TRIGGERS.BOOKING_CREATED:
                return await handleBookingCreated(payload);

            case TRIGGERS.BOOKING_REMINDER:
                return await handleBookingReminder(payload);

            case TRIGGERS.FORM_PENDING:
                return await handleFormPending(payload);

            case TRIGGERS.INVENTORY_LOW:
                return await handleInventoryLow(payload);

            case TRIGGERS.STAFF_REPLIED:
                return await handleStaffReplied(payload);

            default:
                console.error(`❌ Unknown trigger: ${trigger}`);
                return { success: false, error: 'Unknown trigger' };
        }
    } catch (error) {
        console.error(`❌ Automation error [${trigger}]:`, error.message);

        // Log failure
        await AutomationLog.create({
            trigger,
            businessId: payload.businessId,
            contactId: payload.contactId,
            firedAt: new Date(),
            type: 'system',
            success: false,
            error: error.message,
        });

        return { success: false, error: error.message };
    }
};

/**
 * Handler: New Contact Created
 * Sends welcome email and creates conversation
 */
const handleNewContact = async (payload) => {
    const { businessId, contact, business } = payload;

    try {
        // Create or get conversation
        let conversation = await Conversation.findOne({
            businessId,
            contactId: contact._id,
        });

        if (!conversation) {
            conversation = await Conversation.create({
                businessId,
                contactId: contact._id,
                channel: contact.email ? 'email' : 'sms',
                status: 'open',
                lastMessageAt: new Date(),
                automationPaused: false,
            });
        }

        // Send welcome email
        if (contact.email) {
            // Get custom template from settings
            const AutomationSettings = require('../models/AutomationSettings');
            const settings = await AutomationSettings.findOne({ businessId });
            
            let subject, html;
            
            if (settings && settings.automations.NEW_CONTACT.emailSubject && settings.automations.NEW_CONTACT.emailTemplate) {
                // Use custom template
                const { replaceTemplateVariables, wrapEmailTemplate } = require('./email.service');
                const variables = {
                    contactName: contact.name,
                    businessName: business.name,
                };
                subject = replaceTemplateVariables(settings.automations.NEW_CONTACT.emailSubject, variables);
                html = wrapEmailTemplate(replaceTemplateVariables(settings.automations.NEW_CONTACT.emailTemplate, variables), business.name);
            } else {
                // Use default template
                const template = welcomeEmail(contact.name, business.name);
                subject = template.subject;
                html = template.html;
            }

            const result = await sendEmail({
                to: contact.email,
                subject,
                html,
                businessId,
                trigger: TRIGGERS.NEW_CONTACT,
                contactId: contact._id,
            });

            // Create message record
            if (result.success) {
                await Message.create({
                    conversationId: conversation._id,
                    direction: 'outbound',
                    type: 'automated',
                    content: `Welcome email sent to ${contact.name}`,
                    channel: 'email',
                    sentAt: new Date(),
                    metadata: {
                        subject,
                        to: contact.email,
                    },
                });
            }

            return result;
        }

        // TODO: Send SMS if no email
        return { success: true, message: 'Contact created, no email to send' };
    } catch (error) {
        throw error;
    }
};

/**
 * Handler: Booking Created
 * Sends confirmation email and schedules reminder
 */
const handleBookingCreated = async (payload) => {
    const { businessId, booking, contact, business } = payload;

    try {
        // Send booking confirmation
        if (contact.email) {
            // Get custom template from settings
            const AutomationSettings = require('../models/AutomationSettings');
            const settings = await AutomationSettings.findOne({ businessId });
            
            let subject, html;
            
            if (settings && settings.automations.BOOKING_CREATED.emailSubject && settings.automations.BOOKING_CREATED.emailTemplate) {
                // Use custom template
                const { replaceTemplateVariables, wrapEmailTemplate } = require('./email.service');
                const date = new Date(booking.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                });
                const variables = {
                    contactName: contact.name,
                    businessName: business.name,
                    serviceType: booking.serviceType,
                    date,
                    timeSlot: booking.timeSlot,
                    duration: booking.duration,
                    location: booking.location || 'TBD',
                };
                subject = replaceTemplateVariables(settings.automations.BOOKING_CREATED.emailSubject, variables);
                html = wrapEmailTemplate(replaceTemplateVariables(settings.automations.BOOKING_CREATED.emailTemplate, variables), business.name);
            } else {
                // Use default template
                const template = bookingConfirmation(booking, contact, business);
                subject = template.subject;
                html = template.html;
            }

            const result = await sendEmailSmart({
                to: contact.email,
                subject,
                html,
                businessId,
                trigger: TRIGGERS.BOOKING_CREATED,
                contactId: contact._id,
            });

            // Create message record
            if (result.success) {
                const conversation = await Conversation.findOne({
                    businessId,
                    contactId: contact._id,
                });

                if (conversation) {
                    await Message.create({
                        conversationId: conversation._id,
                        direction: 'outbound',
                        type: 'automated',
                        content: `Booking confirmation sent for ${booking.serviceType}`,
                        channel: 'email',
                        sentAt: new Date(),
                        metadata: {
                            subject,
                            to: contact.email,
                            bookingId: booking._id,
                        },
                    });
                }
            }

            return result;
        }

        return { success: true, message: 'Booking created, no email to send' };
    } catch (error) {
        throw error;
    }
};

/**
 * Handler: Booking Reminder (24h before)
 * Sends reminder email
 */
const handleBookingReminder = async (payload) => {
    const { businessId, booking, contact, business } = payload;

    try {
        if (contact.email) {
            const template = bookingReminder(booking, contact, business);

            const result = await sendEmail({
                to: contact.email,
                subject: template.subject,
                html: template.html,
                businessId,
                trigger: TRIGGERS.BOOKING_REMINDER,
                contactId: contact._id,
            });

            // Create message record
            if (result.success) {
                const conversation = await Conversation.findOne({
                    businessId,
                    contactId: contact._id,
                });

                if (conversation) {
                    await Message.create({
                        conversationId: conversation._id,
                        direction: 'outbound',
                        type: 'automated',
                        content: `Booking reminder sent for ${booking.serviceType}`,
                        channel: 'email',
                        sentAt: new Date(),
                        metadata: {
                            subject: template.subject,
                            to: contact.email,
                            bookingId: booking._id,
                        },
                    });
                }
            }

            return result;
        }

        return { success: true, message: 'Reminder skipped, no email' };
    } catch (error) {
        throw error;
    }
};

/**
 * Handler: Form Pending (24h+ without completion)
 * Sends form completion reminder
 */
const handleFormPending = async (payload) => {
    const { businessId, form, contact, business, formLink } = payload;

    try {
        if (contact.email) {
            const template = formReminder(form, contact, business, formLink);

            const result = await sendEmail({
                to: contact.email,
                subject: template.subject,
                html: template.html,
                businessId,
                trigger: TRIGGERS.FORM_PENDING,
                contactId: contact._id,
            });

            // Create message record
            if (result.success) {
                const conversation = await Conversation.findOne({
                    businessId,
                    contactId: contact._id,
                });

                if (conversation) {
                    await Message.create({
                        conversationId: conversation._id,
                        direction: 'outbound',
                        type: 'automated',
                        content: `Form reminder sent for ${form.title}`,
                        channel: 'email',
                        sentAt: new Date(),
                        metadata: {
                            subject: template.subject,
                            to: contact.email,
                            formId: form._id,
                        },
                    });
                }
            }

            return result;
        }

        return { success: true, message: 'Form reminder skipped, no email' };
    } catch (error) {
        throw error;
    }
};

/**
 * Handler: Inventory Low
 * Sends alert to business owner
 */
const handleInventoryLow = async (payload) => {
    const { businessId, item, business, ownerEmail } = payload;

    try {
        const template = inventoryAlert(item, business, ownerEmail);

        const result = await sendEmail({
            to: ownerEmail,
            subject: template.subject,
            html: template.html,
            businessId,
            trigger: TRIGGERS.INVENTORY_LOW,
        });

        // Mark alert as sent
        if (result.success && item._id) {
            const Inventory = require('../models/Inventory');
            await Inventory.findByIdAndUpdate(item._id, {
                $set: { alertSent: true },
            });
        }

        return result;
    } catch (error) {
        throw error;
    }
};

/**
 * Handler: Staff Replied
 * Pauses automation for this contact
 */
const handleStaffReplied = async (payload) => {
    const { businessId, contactId, userId } = payload;

    try {
        const conversation = await Conversation.findOneAndUpdate(
            { businessId, contactId },
            {
                $set: {
                    automationPaused: true,
                    pausedAt: new Date(),
                    pausedBy: userId,
                },
            },
            { new: true }
        );

        // Log the pause
        await AutomationLog.create({
            trigger: TRIGGERS.STAFF_REPLIED,
            businessId,
            contactId,
            firedAt: new Date(),
            type: 'system',
            success: true,
            metadata: {
                conversationId: conversation._id,
                pausedBy: userId,
            },
        });

        console.log(`⏸️  Automation paused for contact ${contactId}`);

        return { success: true, message: 'Automation paused' };
    } catch (error) {
        throw error;
    }
};

/**
 * Resume automation for a contact (manual action by owner)
 */
const resumeAutomation = async (businessId, contactId) => {
    try {
        const conversation = await Conversation.findOneAndUpdate(
            { businessId, contactId },
            {
                $set: {
                    automationPaused: false,
                    pausedAt: null,
                    pausedBy: null,
                },
            },
            { new: true }
        );

        console.log(`▶️  Automation resumed for contact ${contactId}`);

        return { success: true, conversation };
    } catch (error) {
        console.error('Error resuming automation:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get automation logs with filters
 */
const getAutomationLogs = async (businessId, filters = {}) => {
    try {
        const query = { businessId };

        if (filters.trigger) {
            query.trigger = filters.trigger;
        }

        if (filters.success !== undefined) {
            query.success = filters.success;
        }

        if (filters.startDate || filters.endDate) {
            query.firedAt = {};
            if (filters.startDate) {
                query.firedAt.$gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                query.firedAt.$lte = new Date(filters.endDate);
            }
        }

        const logs = await AutomationLog.find(query)
            .populate('contactId', 'name email')
            .sort({ firedAt: -1 })
            .limit(filters.limit || 100)
            .lean();

        return { success: true, logs };
    } catch (error) {
        console.error('Error fetching automation logs:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    TRIGGERS,
    fireAutomation,
    resumeAutomation,
    getAutomationLogs,
    isAutomationPaused,
};
