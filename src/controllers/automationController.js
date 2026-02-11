const { getAutomationLogs, resumeAutomation, TRIGGERS } = require('../services/automation.service');
const AutomationLog = require('../models/AutomationLog');
const Conversation = require('../models/Conversation');

/**
 * @desc    Get automation logs
 * @route   GET /api/automations/logs
 * @access  Private (Owner only)
 */
const getLogs = async (req, res, next) => {
    try {
        const { trigger, success, startDate, endDate, limit } = req.query;

        const filters = {
            trigger,
            success: success === 'true' ? true : success === 'false' ? false : undefined,
            startDate,
            endDate,
            limit: limit ? parseInt(limit) : 100,
        };

        // Use req.businessId if available (from setBusinessContext), otherwise fallback to user's business
        const businessId = req.businessId || req.user.businessId;
        const result = await getAutomationLogs(businessId, filters);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.error,
            });
        }

        res.status(200).json({
            success: true,
            count: result.logs.length,
            data: result.logs,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get automation statistics
 * @route   GET /api/automations/stats
 * @access  Private (Owner only)
 */
const getStats = async (req, res, next) => {
    try {
        // Use req.businessId if available (from setBusinessContext), otherwise fallback to user's business
        const businessId = req.businessId || req.user.businessId;

        // Get all logs for this business
        const allLogs = await AutomationLog.find({ businessId });
        
        // Calculate totals
        const totalExecutions = allLogs.length;
        const successCount = allLogs.filter(log => log.success).length;
        const failureCount = allLogs.filter(log => !log.success).length;

        // Get counts by trigger type
        const byTrigger = {};
        allLogs.forEach(log => {
            if (!byTrigger[log.trigger]) {
                byTrigger[log.trigger] = 0;
            }
            byTrigger[log.trigger]++;
        });

        // Get recent activity (last 7 days)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const recentActivity = await AutomationLog.aggregate([
            {
                $match: {
                    businessId,
                    firedAt: { $gte: sevenDaysAgo },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$firedAt' },
                    },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Get paused conversations count
        const pausedCount = await Conversation.countDocuments({
            businessId,
            automationPaused: true,
        });

        res.status(200).json({
            success: true,
            data: {
                totalExecutions,
                successCount,
                failureCount,
                byTrigger,
                recentActivity,
                pausedConversations: pausedCount,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Resume automation for a contact
 * @route   POST /api/automations/resume/:contactId
 * @access  Private (Owner only)
 */
const resumeAutomationForContact = async (req, res, next) => {
    try {
        const { contactId } = req.params;
        // Use req.businessId if available (from setBusinessContext), otherwise fallback to user's business
        const businessId = req.businessId || req.user.businessId;

        const result = await resumeAutomation(businessId, contactId);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: result.error,
            });
        }

        res.status(200).json({
            success: true,
            message: 'Automation resumed for contact',
            data: result.conversation,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get list of paused conversations
 * @route   GET /api/automations/paused
 * @access  Private (Owner only)
 */
const getPausedConversations = async (req, res, next) => {
    try {
        // Use req.businessId if available (from setBusinessContext), otherwise fallback to user's business
        const businessId = req.businessId || req.user.businessId;

        const conversations = await Conversation.find({
            businessId,
            automationPaused: true,
        })
            .populate('contactId', 'name email phone')
            .populate('pausedBy', 'name')
            .sort({ pausedAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            count: conversations.length,
            data: conversations,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get available automation triggers
 * @route   GET /api/automations/triggers
 * @access  Private
 */
const getTriggers = async (req, res, next) => {
    try {
        const triggers = Object.entries(TRIGGERS).map(([key, value]) => ({
            key,
            value,
            description: getTriggerDescription(value),
        }));

        res.status(200).json({
            success: true,
            data: triggers,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Helper: Get human-readable trigger descriptions
 */
const getTriggerDescription = (trigger) => {
    const descriptions = {
        NEW_CONTACT: 'Sends welcome email when a new contact is created',
        BOOKING_CREATED: 'Sends confirmation email when a booking is made',
        BOOKING_REMINDER: 'Sends reminder 24 hours before appointment',
        FORM_PENDING: 'Sends reminder if form not completed after 24 hours',
        INVENTORY_LOW: 'Alerts owner when inventory reaches threshold',
        STAFF_REPLIED: 'Pauses automation when staff manually replies',
    };

    return descriptions[trigger] || 'Unknown trigger';
};

module.exports = {
    getLogs,
    getStats,
    resumeAutomationForContact,
    getPausedConversations,
    getTriggers,
};

/**
 * @desc    Get automation settings for business
 * @route   GET /api/automations/settings
 * @access  Private (Owner only)
 */
const getSettings = async (req, res, next) => {
    try {
        const AutomationSettings = require('../models/AutomationSettings');
        // Use req.businessId if available (from setBusinessContext), otherwise fallback to user's business
        const businessId = req.businessId || req.user.businessId;

        let settings = await AutomationSettings.findOne({ businessId });

        // Create default settings if none exist
        if (!settings) {
            settings = await AutomationSettings.create({ businessId });
        }

        res.status(200).json({
            success: true,
            data: settings,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Update automation settings
 * @route   PATCH /api/automations/settings
 * @access  Private (Owner only)
 */
const updateSettings = async (req, res, next) => {
    try {
        const AutomationSettings = require('../models/AutomationSettings');
        // Use req.businessId if available (from setBusinessContext), otherwise fallback to user's business
        const businessId = req.businessId || req.user.businessId;
        const { automations } = req.body;

        let settings = await AutomationSettings.findOne({ businessId });

        if (!settings) {
            settings = await AutomationSettings.create({
                businessId,
                automations,
            });
        } else {
            // Merge the updates with existing settings
            Object.keys(automations).forEach((key) => {
                if (settings.automations[key]) {
                    settings.automations[key] = {
                        ...settings.automations[key],
                        ...automations[key],
                    };
                }
            });
            
            settings.markModified('automations');
            await settings.save();
        }

        res.status(200).json({
            success: true,
            data: settings,
            message: 'Automation settings updated',
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getLogs,
    getStats,
    resumeAutomationForContact,
    getPausedConversations,
    getTriggers,
    getSettings,
    updateSettings,
};
