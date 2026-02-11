const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const { sendEmail } = require('../services/email.service');

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
        const businessId = req.businessId; // Use req.businessId set by middleware

        if (!content || content.trim() === '') {
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
            return res.status(404).json({
                success: false,
                message: 'Conversation not found',
            });
        }

        // Create message
        const message = await Message.create({
            conversationId: id,
            direction: 'outbound',
            type: 'manual',
            content,
            channel,
            sentAt: new Date(),
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

        // Send email if channel is email
        if (channel === 'email' && conversation.contactId.email) {
            await sendEmail({
                to: conversation.contactId.email,
                subject: `Message from ${req.user.name}`,
                html: `
                    <p>${content.replace(/\n/g, '<br>')}</p>
                    <hr>
                    <p><small>This message was sent from ${req.user.name}</small></p>
                `,
            });
        }

        // TODO: Send SMS if channel is sms

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
