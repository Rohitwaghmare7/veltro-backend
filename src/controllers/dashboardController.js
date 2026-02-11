const Booking = require('../models/Booking');
const Contact = require('../models/Contact');

// @desc    Get dashboard overview stats
// @route   GET /api/dashboard/overview
// @access  Private
exports.getDashboardOverview = async (req, res, next) => {
    try {
        const businessId = req.businessId;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Parallel aggregation
        const [
            todayBookings,
            upcomingBookings,
            completedCount,
            noShowCount,
            totalBookings,
            newLeads,
            openLeads,
            totalLeads,
            recentBookings,
            recentLeads,
        ] = await Promise.all([
            Booking.countDocuments({ businessId, date: { $gte: today, $lt: tomorrow } }),
            Booking.countDocuments({ businessId, date: { $gte: today, $lte: weekEnd }, status: { $in: ['pending', 'confirmed'] } }),
            Booking.countDocuments({ businessId, status: 'completed' }),
            Booking.countDocuments({ businessId, status: 'no-show' }),
            Booking.countDocuments({ businessId }),
            Contact.countDocuments({ businessId, createdAt: { $gte: last24h } }),
            Contact.countDocuments({ businessId, status: { $in: ['new', 'contacted', 'qualified'] } }),
            Contact.countDocuments({ businessId }),
            Booking.find({ businessId }).sort({ date: 1 }).limit(5).select('clientName serviceType date timeSlot status'),
            Contact.find({ businessId }).sort({ createdAt: -1 }).limit(5).select('name email source status createdAt'),
        ]);

        res.json({
            success: true,
            data: {
                bookings: {
                    today: todayBookings,
                    upcoming: upcomingBookings,
                    completed: completedCount,
                    noShow: noShowCount,
                    total: totalBookings,
                },
                leads: {
                    new: newLeads,
                    open: openLeads,
                    total: totalLeads,
                },
                recent: {
                    bookings: recentBookings,
                    leads: recentLeads,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get dashboard alerts
// @route   GET /api/dashboard/alerts
// @access  Private
exports.getDashboardAlerts = async (req, res, next) => {
    try {
        const businessId = req.businessId;
        const alerts = [];

        // Unconfirmed bookings
        const unconfirmed = await Booking.countDocuments({ businessId, status: 'pending' });
        if (unconfirmed > 0) {
            alerts.push({
                type: 'warning',
                title: `${unconfirmed} unconfirmed booking${unconfirmed > 1 ? 's' : ''}`,
                link: '/bookings?status=pending',
                icon: '📅',
            });
        }

        // New leads not contacted
        const newLeads = await Contact.countDocuments({ businessId, status: 'new' });
        if (newLeads > 0) {
            alerts.push({
                type: 'info',
                title: `${newLeads} new lead${newLeads > 1 ? 's' : ''} to follow up`,
                link: '/leads?status=new',
                icon: '👤',
            });
        }

        res.json({ success: true, data: alerts });
    } catch (error) {
        next(error);
    }
};
