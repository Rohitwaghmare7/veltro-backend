const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const Business = require('../models/Business');
const { sendEmail } = require('../services/email.service');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 25 * 1024 * 1024, // 25MB per file
        files: 10 // Max 10 files
    },
    fileFilter: (req, file, cb) => {
        // Allow all file types
        cb(null, true);
    }
});

// Export upload middleware
exports.uploadAttachments = upload.array('attachments', 10);

/**
 * @desc    Get all conversations for a business
 * @route   GET /api/inbox/conversations
 * @access  Private (Owner + Staff with inbox permission)
 */
exports.getConversations = async (req, res, next) => {
    try {
        const { status, search } = req.query;
        const businessId = req.businessId; // Use req.businessId set by middleware

        // Build query
        const query = { businessId };
        if (status) {
            query.status = status;
        }

        // Get conversations with contact details
        let conversations = await Conversation.find(query)
            .populate('contactId', 'name email phone notes tags source status')
            .sort({ lastMessageAt: -1 })
            .lean();

        // Search filter (if provided)
        if (search) {
            const searchLower = search.toLowerCase();
            conversations = conversations.filter((conv) => {
                const contact = conv.contactId;
                return (
                    contact.name?.toLowerCase().includes(searchLower) ||
                    contact.email?.toLowerCase().includes(searchLower) ||
                    contact.phone?.includes(search)
                );
            });
        }

        // Get last message for each conversation
        const conversationsWithLastMessage = await Promise.all(
            conversations.map(async (conv) => {
                const lastMessage = await Message.findOne({
                    conversationId: conv._id,
                })
                    .sort({ sentAt: -1 })
                    .lean();

                return {
                    ...conv,
                    lastMessage,
                };
            })
        );

        res.status(200).json({
            success: true,
            count: conversationsWithLastMessage.length,
            data: conversationsWithLastMessage,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get messages for a specific conversation
 * @route   GET /api/inbox/conversations/:id/messages
 * @access  Private (Owner + Staff with inbox permission)
 */
exports.getMessages = async (req, res, next) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId; // Use req.businessId set by middleware

        // Verify conversation belongs to business
        const conversation = await Conversation.findOne({
            _id: id,
            businessId,
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found',
            });
        }

        // Get all messages
        const messages = await Message.find({ conversationId: id })
            .sort({ sentAt: 1 })
            .lean();

        // Mark messages as read
        await Message.updateMany(
            {
                conversationId: id,
                direction: 'inbound',
                readAt: null,
            },
            {
                $set: { readAt: new Date() },
            }
        );

        // Reset unread count
        await Conversation.findByIdAndUpdate(id, {
            $set: { unreadCount: 0 },
        });

        res.status(200).json({
            success: true,
            count: messages.length,
            data: messages,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Send a reply in a conversation
 * @route   POST /api/inbox/conversations/:id/reply
 * @access  Private (Owner + Staff with reply permission)
 */
exports.sendReply = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { content, channel = 'email' } = req.body;
        const businessId = req.businessId;
        const attachments = req.files || []; // Get uploaded files

        console.log('📧 ========== SEND REPLY CALLED ==========');
        console.log('📧 Conversation ID:', id);
        console.log('📧 Content:', content);
        console.log('📧 Channel:', channel);
        console.log('📧 Business ID:', businessId);

        if (!content || content.trim() === '') {
            console.log('❌ Empty content');
            return res.status(400).json({
                success: false,
                message: 'Message content is required',
            });
        }

        // Verify conversation belongs to business
        const conversation = await Conversation.findOne({
            _id: id,
            businessId,
        }).populate('contactId');

        if (!conversation) {
            console.log('❌ Conversation not found');
            return res.status(404).json({
                success: false,
                message: 'Conversation not found',
            });
        }

        console.log('✅ Conversation found');
        console.log('✅ Contact email:', conversation.contactId.email);

        // Prepare attachment metadata
        const attachmentMetadata = attachments.map(file => ({
            filename: file.originalname,
            mimeType: file.mimetype,
            size: file.size
        }));

        // Create message
        const message = await Message.create({
            conversationId: id,
            direction: 'outbound',
            type: 'manual',
            content,
            channel,
            sentAt: new Date(),
            metadata: {
                attachments: attachmentMetadata.length > 0 ? attachmentMetadata : undefined
            }
        });

        // Pause automation for this conversation (staff replied)
        if (!conversation.automationPaused) {
            await Conversation.findByIdAndUpdate(id, {
                $set: {
                    automationPaused: true,
                    pausedAt: new Date(),
                    pausedBy: req.user._id,
                },
            });
        }

        // Update last message time
        await Conversation.findByIdAndUpdate(id, {
            $set: { lastMessageAt: new Date() },
        });

        // Get business for integration check
        const business = await Business.findById(businessId);

        console.log('📧 sendReply - Attempting to send email');
        console.log('📧 Channel:', channel);
        console.log('📧 Contact email:', conversation.contactId.email);
        console.log('📧 Gmail connected:', business.integrations?.gmail?.connected);
        console.log('📧 Gmail thread ID:', conversation.metadata?.gmailThreadId);

        // Send email - use Gmail API if connected and has thread, otherwise SMTP
        if (channel === 'email' && conversation.contactId.email) {
            // Prepare email attachments
            const emailAttachments = attachments.map(file => ({
                filename: file.originalname,
                content: file.buffer,
                contentType: file.mimetype
            }));

            // Check if Gmail integration is available
            if (business.integrations?.gmail?.connected) {
                console.log('📧 Using Gmail API for reply');
                const gmailService = require('../services/gmail.service');
                
                // Convert attachments to base64 for Gmail API
                const gmailAttachments = attachments.map(file => ({
                    filename: file.originalname,
                    mimeType: file.mimetype,
                    size: file.size,
                    data: file.buffer.toString('base64')
                }));

                try {
                    const emailData = {
                        to: conversation.contactId.email,
                        subject: `Message from ${business.name}`,
                        body: content.replace(/\n/g, '<br>'),
                        attachments: gmailAttachments.length > 0 ? gmailAttachments : undefined
                    };
                    
                    // Include thread ID if available (for replies to existing Gmail threads)
                    if (conversation.metadata?.gmailThreadId) {
                        emailData.threadId = conversation.metadata.gmailThreadId;
                        console.log('📧 Replying to existing Gmail thread:', emailData.threadId);
                    } else {
                        console.log('📧 Creating new Gmail thread');
                    }
                    
                    await gmailService.sendEmail(businessId, emailData);
                    console.log('✅ Reply sent via Gmail API');
                } catch (emailError) {
                    console.error('❌ Gmail API send failed:', emailError.message);
                    console.error('Gmail error details:', emailError);
                    // Fall back to SMTP
                    console.log('📧 Falling back to SMTP...');
                    try {
                        const result = await sendEmail({
                            to: conversation.contactId.email,
                            subject: `Message from ${business.name}`,
                            html: `
                                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                    <h2 style="color: #333;">Message from ${business.name}</h2>
                                    <p style="color: #666; line-height: 1.6; white-space: pre-wrap;">${content}</p>
                                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                                    <p style="color: #999; font-size: 12px;">
                                        This message was sent by ${req.user.name} from ${business.name}
                                    </p>
                                </div>
                            `,
                            attachments: emailAttachments.length > 0 ? emailAttachments : undefined
                        });
                        console.log('✅ Reply email sent via SMTP (fallback):', result);
                    } catch (smtpError) {
                        console.error('❌ SMTP fallback also failed:', smtpError.message);
                    }
                }
            } else {
                console.log('📧 Using SMTP for reply (no Gmail thread or not connected)');
                try {
                    const result = await sendEmail({
                        to: conversation.contactId.email,
                        subject: `Message from ${business.name}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #333;">Message from ${business.name}</h2>
                                <p style="color: #666; line-height: 1.6; white-space: pre-wrap;">${content}</p>
                                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                                <p style="color: #999; font-size: 12px;">
                                    This message was sent by ${req.user.name} from ${business.name}
                                </p>
                            </div>
                        `,
                        attachments: emailAttachments.length > 0 ? emailAttachments : undefined
                    });
                    console.log('✅ Reply email sent via SMTP:', result);
                } catch (emailError) {
                    console.error('❌ SMTP send failed:', emailError.message);
                    // Don't throw error - message is already saved in database
                    console.log('⚠️  Email failed but message saved in conversation');
                }
            }
        } else {
            console.log('⚠️  Email not sent - channel:', channel, 'contact email:', conversation.contactId.email);
        }

        // Emit socket event for real-time update
        if (req.io) {
            req.io.to(`business_${businessId}`).emit('new_message', {
                conversationId: id,
                message,
            });
        }

        res.status(201).json({
            success: true,
            data: message,
        });
    } catch (error) {
        // Handle multer errors
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size exceeds 25MB limit'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Maximum 10 files allowed'
            });
        }
        next(error);
    }
};

/**
 * @desc    Mark conversation as resolved
 * @route   PATCH /api/inbox/conversations/:id/resolve
 * @access  Private (Owner + Staff with inbox permission)
 */
exports.resolveConversation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId; // Use req.businessId set by middleware

        const conversation = await Conversation.findOneAndUpdate(
            { _id: id, businessId },
            { $set: { status: 'resolved' } },
            { new: true }
        ).populate('contactId', 'name email phone');

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found',
            });
        }

        res.status(200).json({
            success: true,
            data: conversation,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Reopen a resolved conversation
 * @route   PATCH /api/inbox/conversations/:id/reopen
 * @access  Private (Owner + Staff with inbox permission)
 */
exports.reopenConversation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId; // Use req.businessId set by middleware

        const conversation = await Conversation.findOneAndUpdate(
            { _id: id, businessId },
            { $set: { status: 'open' } },
            { new: true }
        ).populate('contactId', 'name email phone');

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found',
            });
        }

        res.status(200).json({
            success: true,
            data: conversation,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get linked bookings for a contact
 * @route   GET /api/inbox/contacts/:contactId/bookings
 * @access  Private (Owner + Staff with inbox permission)
 */
exports.getContactBookings = async (req, res, next) => {
    try {
        const { contactId } = req.params;
        const businessId = req.businessId; // Use req.businessId set by middleware
        const Booking = require('../models/Booking');

        const bookings = await Booking.find({
            businessId,
            contactId,
        })
            .sort({ date: -1 })
            .populate('assignedTo', 'name email')
            .lean();

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get linked form submissions for a contact
 * @route   GET /api/inbox/contacts/:contactId/submissions
 * @access  Private (Owner + Staff with inbox permission)
 */
exports.getContactSubmissions = async (req, res, next) => {
    try {
        const { contactId } = req.params;
        const businessId = req.businessId; // Use req.businessId set by middleware
        const Submission = require('../models/Submission');

        const submissions = await Submission.find({
            businessId,
            contactId,
        })
            .sort({ createdAt: -1 })
            .populate('formId', 'name')
            .lean();

        res.status(200).json({
            success: true,
            count: submissions.length,
            data: submissions,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Resume automation for a conversation
 * @route   PATCH /api/inbox/conversations/:id/resume-automation
 * @access  Private (Owner + Staff with inbox permission)
 */
exports.resumeAutomation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId; // Use req.businessId set by middleware

        const conversation = await Conversation.findOneAndUpdate(
            { _id: id, businessId },
            {
                $set: {
                    automationPaused: false,
                    pausedAt: null,
                    pausedBy: null,
                },
            },
            { new: true }
        ).populate('contactId', 'name email phone');

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found',
            });
        }

        res.status(200).json({
            success: true,
            data: conversation,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Send a form to a contact via email
 * @route   POST /api/inbox/send-form
 * @access  Private (Owner + Staff with inbox permission)
 */
exports.sendFormToContact = async (req, res, next) => {
    try {
        const { conversationId, contactEmail, contactName, formId } = req.body;
        const businessId = req.businessId;

        console.log('📧 sendFormToContact called with:', { conversationId, contactEmail, contactName, formId, businessId });

        if (!conversationId || !contactEmail || !formId) {
            console.log('❌ Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
            });
        }

        // Verify conversation belongs to business
        const conversation = await Conversation.findOne({
            _id: conversationId,
            businessId,
        });

        if (!conversation) {
            console.log('❌ Conversation not found:', conversationId);
            return res.status(404).json({
                success: false,
                message: 'Conversation not found',
            });
        }

        console.log('✅ Conversation found:', conversation._id);

        // Get form details
        const Form = require('../models/Form');
        const form = await Form.findOne({ _id: formId, businessId });

        if (!form) {
            console.log('❌ Form not found:', formId);
            return res.status(404).json({
                success: false,
                message: 'Form not found',
            });
        }

        console.log('✅ Form found:', form.title);

        // Get business details
        const business = await Business.findById(businessId);
        console.log('✅ Business found:', business.name);

        // Generate form link
        const formUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/form/${formId}`;

        // Create message in conversation
        const messageContent = `Form sent: ${form.title}\n\nLink: ${formUrl}`;
        
        const message = await Message.create({
            conversationId,
            direction: 'outbound',
            type: 'automated',
            content: messageContent,
            channel: 'email',
            sentAt: new Date(),
            metadata: {
                subject: `${form.title} - ${business.name}`,
                from: business.email || process.env.SMTP_FROM_EMAIL,
                to: contactEmail,
            },
        });

        console.log('✅ Message created in conversation:', message._id);

        // Update conversation last message time
        await Conversation.findByIdAndUpdate(conversationId, {
            $set: { lastMessageAt: new Date() },
        });

        console.log('✅ Conversation updated');

        // Send email with form link
        const emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Hi ${contactName || 'there'},</h2>
                <p style="color: #666; line-height: 1.6;">
                    ${business.name} has sent you a form to complete.
                </p>
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #333;">${form.title}</h3>
                    ${form.description ? `<p style="color: #666;">${form.description}</p>` : ''}
                </div>
                <a href="${formUrl}" 
                   style="display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0;">
                    Complete Form
                </a>
                <p style="color: #999; font-size: 14px; margin-top: 30px;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="${formUrl}" style="color: #7c3aed;">${formUrl}</a>
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #999; font-size: 12px;">
                    This email was sent by ${business.name}
                </p>
            </div>
        `;

        console.log('📧 Attempting to send form email to:', contactEmail);
        console.log('📧 Gmail connected:', business.integrations?.gmail?.connected);
        console.log('📧 Gmail thread ID:', conversation.metadata?.gmailThreadId);

        // Check if Gmail integration is available
        if (business.integrations?.gmail?.connected) {
            console.log('📧 Using Gmail API to send form');
            const gmailService = require('../services/gmail.service');
            try {
                const emailData = {
                    to: contactEmail,
                    subject: `${form.title} - ${business.name}`,
                    body: emailContent,
                };
                
                // Include thread ID if available (for replies to existing Gmail threads)
                if (conversation.metadata?.gmailThreadId) {
                    emailData.threadId = conversation.metadata.gmailThreadId;
                    console.log('📧 Sending form to existing Gmail thread:', emailData.threadId);
                } else {
                    console.log('📧 Creating new Gmail thread for form');
                }
                
                await gmailService.sendEmail(businessId, emailData);
                console.log('✅ Form email sent via Gmail API');
            } catch (emailError) {
                console.error('❌ Gmail API send failed:', emailError.message);
                console.error('Gmail error details:', emailError);
                // Fall back to SMTP
                console.log('📧 Falling back to SMTP...');
                try {
                    const result = await sendEmail({
                        to: contactEmail,
                        subject: `${form.title} - ${business.name}`,
                        html: emailContent,
                    });
                    console.log('✅ Form email sent via SMTP (fallback):', result);
                } catch (smtpError) {
                    console.error('❌ SMTP fallback also failed:', smtpError.message);
                    throw smtpError;
                }
            }
        } else {
            console.log('📧 Using SMTP to send form (Gmail not connected)');
            try {
                const result = await sendEmail({
                    to: contactEmail,
                    subject: `${form.title} - ${business.name}`,
                    html: emailContent,
                });
                console.log('✅ Form email sent via SMTP:', result);
            } catch (emailError) {
                console.error('❌ SMTP send failed:', emailError.message);
                throw emailError;
            }
        }

        // Emit socket event for real-time update
        if (req.io) {
            req.io.to(`business_${businessId}`).emit('conversation_update', {
                conversationId,
            });
        }

        console.log('✅ sendFormToContact completed successfully');

        res.status(200).json({
            success: true,
            message: 'Form sent successfully',
        });
    } catch (error) {
        console.error('❌ sendFormToContact error:', error);
        next(error);
    }
};


/**
 * @desc    Create a new conversation with a contact
 * @route   POST /api/inbox/create-conversation
 * @access  Private (Owner + Staff with inbox permission)
 */
exports.createConversation = async (req, res, next) => {
    try {
        const { email, name } = req.body;
        const businessId = req.businessId;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required',
            });
        }

        // Find or create contact
        let contact = await Contact.findOne({
            businessId,
            email: email.toLowerCase()
        });

        if (!contact) {
            contact = await Contact.create({
                businessId,
                email: email.toLowerCase(),
                name: name || email.split('@')[0],
                source: 'manual',
                status: 'new'
            });
        }

        // Check if conversation already exists
        let conversation = await Conversation.findOne({
            businessId,
            contactId: contact._id
        }).populate('contactId', 'name email phone notes tags source status');

        if (conversation) {
            return res.status(200).json({
                success: true,
                message: 'Conversation already exists',
                data: { conversation, isNew: false }
            });
        }

        // Create new conversation
        conversation = await Conversation.create({
            businessId,
            contactId: contact._id,
            channel: 'email',
            status: 'open',
            lastMessageAt: new Date()
        });

        // Create initial system message
        await Message.create({
            conversationId: conversation._id,
            direction: 'outbound',
            type: 'automated',
            content: `Conversation started with ${contact.name}`,
            channel: 'email',
            sentAt: new Date(),
            metadata: {
                isSystemMessage: true
            }
        });

        // Populate contact details
        await conversation.populate('contactId', 'name email phone notes tags source status');

        res.status(201).json({
            success: true,
            message: 'Conversation created successfully',
            data: { conversation, isNew: true }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete a conversation and its messages
 * @route   DELETE /api/inbox/conversations/:id
 * @access  Private (Owner + Staff with inbox permission)
 */
exports.deleteConversation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;

        // Verify conversation belongs to business
        const conversation = await Conversation.findOne({
            _id: id,
            businessId,
        });

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found',
            });
        }

        // Delete all messages in the conversation
        await Message.deleteMany({ conversationId: id });

        // Delete the conversation
        await Conversation.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Conversation deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Delete multiple conversations
 * @route   POST /api/inbox/conversations/bulk-delete
 * @access  Private (Owner + Staff with inbox permission)
 */
exports.bulkDeleteConversations = async (req, res, next) => {
    try {
        const { conversationIds } = req.body;
        const businessId = req.businessId;

        if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Conversation IDs are required',
            });
        }

        // Verify all conversations belong to business
        const conversations = await Conversation.find({
            _id: { $in: conversationIds },
            businessId,
        });

        if (conversations.length !== conversationIds.length) {
            return res.status(404).json({
                success: false,
                message: 'Some conversations not found',
            });
        }

        // Delete all messages for these conversations
        await Message.deleteMany({ conversationId: { $in: conversationIds } });

        // Delete the conversations
        await Conversation.deleteMany({ _id: { $in: conversationIds } });

        res.status(200).json({
            success: true,
            message: `${conversationIds.length} conversation(s) deleted successfully`,
        });
    } catch (error) {
        next(error);
    }
};
