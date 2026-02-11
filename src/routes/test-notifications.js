const express = require('express');
const router = express.Router();
const { protect, setBusinessContext } = require('../middleware/auth');
const { createNotification } = require('../controllers/notificationController');

// Test endpoint to create sample notifications
router.post('/create-samples', protect, setBusinessContext, async (req, res) => {
    try {
        const sampleNotifications = [
            {
                type: 'booking',
                title: 'New Booking Request',
                message: 'John Doe has requested a booking for tomorrow at 2 PM',
                link: '/dashboard/bookings',
            },
            {
                type: 'message',
                title: 'New Message',
                message: 'You have a new message from Sarah Smith',
                link: '/dashboard/inbox',
            },
            {
                type: 'form',
                title: 'Form Submission',
                message: 'New contact form submission received',
                link: '/dashboard/forms',
            },
            {
                type: 'automation',
                title: 'Automation Triggered',
                message: 'Welcome email sent to new contact',
                link: '/dashboard/automations',
            },
            {
                type: 'staff',
                title: 'New Staff Member',
                message: 'Jane Doe has joined your team',
                link: '/dashboard/team',
            },
            {
                type: 'system',
                title: 'System Update',
                message: 'Your business profile has been updated',
                link: '/dashboard/settings',
            },
        ];

        const created = [];
        for (const notif of sampleNotifications) {
            const notification = await createNotification(
                req.businessId,
                req.user.id,
                notif
            );
            created.push(notification);
        }

        res.json({
            message: 'Sample notifications created',
            count: created.length,
            notifications: created,
        });
    } catch (error) {
        console.error('Create sample notifications error:', error);
        res.status(500).json({ message: 'Failed to create sample notifications' });
    }
});

module.exports = router;
