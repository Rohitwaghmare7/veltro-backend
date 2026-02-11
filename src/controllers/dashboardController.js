const Booking = require('../models/Booking');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Inventory = require('../models/Inventory');
const Submission = require('../models/Submission');

// @desc    Get dashboard overview stats
// @route   GET /api/dashboard/overview
// @access  Private (Owner only)
exports.getOverview = async (req, res, next) => {
    try {
        const businessId = req.businessId;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const next7Days = new Date(today);
        next7Days.setDate(next7Days.getDate() + 7);
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Bookings stats
        const [todayBookings, upcomingBookings, completedBookings, noShowBookings] = await Promise.all([
            Booking.countDocuments({
                businessId,
                date: { $gte: today, $lt: tomorrow },
                status: { $in: ['pending', 'confirmed'] }
            }),
            Booking.countDocuments({
                businessId,
                date: { $gte: tomorrow, $lte: next7Days },
                status: { $in: ['pending', 'confirmed'] }
            }),
            Booking.countDocuments({
                businessId,
                status: 'completed'
            }),
            Booking.countDocuments({
                businessId,
                status: 'no-show'
            })
        ]);

        // Leads stats
        const [new24hLeads, openConversations, unansweredMessages] = await Promise.all([
            Contact.countDocuments({
                businessId,
                createdAt: { $gte: last24h }
            }),
            Conversation.countDocuments({
                businessId,
                status: 'open'
            }),
            Conversation.countDocuments({
                businessId,
                status: 'open',
                unreadCount: { $gt: 0 }
            })
        ]);

        // Forms stats (using Submission model)
        const allSubmissions = await Submission.find({ businessId }).lean();
        const pendingForms = allSubmissions.filter(s => !s.submittedAt).length;
        const completedForms = allSubmissions.filter(s => s.submittedAt).length;
        
        // Overdue forms: created more than 24h ago but not submitted
        const overdueForms = allSubmissions.filter(s => {
            if (s.submittedAt) return false;
            const createdAt = new Date(s.createdAt);
            const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);
            return hoursSinceCreated > 24;
        }).length;

        // Inventory stats
        const lowStockItems = await Inventory.find({
            businessId,
            $expr: { $lte: ['$quantity', '$threshold'] }
        }).select('name quantity threshold unit').lean();

        res.json({
            success: true,
            data: {
                bookings: {
                    today: todayBookings,
                    upcoming: upcomingBookings,
                    completed: completedBookings,
                    noShow: noShowBookings
                },
                leads: {
                    new24h: new24hLeads,
                    openConversations,
                    unanswered: unansweredMessages
                },
                forms: {
                    pending: pendingForms,
                    overdue: overdueForms,
                    completed: completedForms
                },
                inventory: {
                    lowStock: lowStockItems
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get key alerts for dashboard
// @route   GET /api/dashboard/alerts
// @access  Private (Owner only)
exports.getAlerts = async (req, res, next) => {
    try {
        const businessId = req.businessId;
        const alerts = [];
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Check for unanswered messages
        const unansweredCount = await Conversation.countDocuments({
            businessId,
            status: 'open',
            unreadCount: { $gt: 0 },
            lastMessageAt: { $lt: last24h }
        });

        if (unansweredCount > 0) {
            alerts.push({
                id: 'unanswered-messages',
                type: 'message',
                severity: 'high',
                title: `${unansweredCount} Unanswered Messages`,
                description: 'Some messages have been waiting for more than 24 hours',
                link: '/dashboard/inbox',
                createdAt: now.toISOString()
            });
        }

        // Check for unconfirmed bookings
        const unconfirmedCount = await Booking.countDocuments({
            businessId,
            status: 'pending',
            createdAt: { $lt: last24h }
        });

        if (unconfirmedCount > 0) {
            alerts.push({
                id: 'unconfirmed-bookings',
                type: 'booking',
                severity: 'medium',
                title: `${unconfirmedCount} Unconfirmed Bookings`,
                description: 'These bookings need confirmation',
                link: '/dashboard/bookings',
                createdAt: now.toISOString()
            });
        }

        // Check for overdue forms
        const allSubmissions = await Submission.find({ businessId }).lean();
        const overdueCount = allSubmissions.filter(s => {
            if (s.submittedAt) return false;
            const createdAt = new Date(s.createdAt);
            const hoursSinceCreated = (now - createdAt) / (1000 * 60 * 60);
            return hoursSinceCreated > 24;
        }).length;

        if (overdueCount > 0) {
            alerts.push({
                id: 'overdue-forms',
                type: 'form',
                severity: 'medium',
                title: `${overdueCount} Overdue Forms`,
                description: 'Forms pending for more than 24 hours',
                link: '/dashboard/forms',
                createdAt: now.toISOString()
            });
        }

        // Check for low stock items
        const lowStockCount = await Inventory.countDocuments({
            businessId,
            $expr: { $lte: ['$quantity', '$threshold'] }
        });

        if (lowStockCount > 0) {
            alerts.push({
                id: 'low-stock',
                type: 'inventory',
                severity: 'high',
                title: `${lowStockCount} Low Stock Items`,
                description: 'Items need restocking',
                link: '/dashboard/inventory',
                createdAt: now.toISOString()
            });
        }

        res.json({
            success: true,
            data: alerts
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get recent activity for charts (last 7 days)
// @route   GET /api/dashboard/activity
// @access  Private (Owner only)
exports.getRecentActivity = async (req, res, next) => {
    try {
        const businessId = req.businessId;
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Get bookings by day for last 7 days
        const bookingsByDay = await Booking.aggregate([
            {
                $match: {
                    businessId,
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Get new contacts by day for last 7 days
        const contactsByDay = await Contact.aggregate([
            {
                $match: {
                    businessId,
                    createdAt: { $gte: sevenDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Get form submissions by day for last 7 days
        const submissionsByDay = await Submission.aggregate([
            {
                $match: {
                    businessId,
                    submittedAt: { $gte: sevenDaysAgo, $ne: null }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Create array of last 7 days
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            
            days.push({
                date: dateStr,
                day: dayName,
                bookings: bookingsByDay.find(b => b._id === dateStr)?.count || 0,
                contacts: contactsByDay.find(c => c._id === dateStr)?.count || 0,
                submissions: submissionsByDay.find(s => s._id === dateStr)?.count || 0
            });
        }

        // Get booking status distribution
        const bookingStatusDistribution = await Booking.aggregate([
            { $match: { businessId } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get lead source distribution
        const leadSourceDistribution = await Contact.aggregate([
            { $match: { businessId } },
            {
                $group: {
                    _id: '$source',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                dailyActivity: days,
                bookingStatus: bookingStatusDistribution.map(item => ({
                    status: item._id,
                    count: item.count
                })),
                leadSources: leadSourceDistribution.map(item => ({
                    source: item._id,
                    count: item.count
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};
