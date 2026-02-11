const cron = require('node-cron');
const Booking = require('../models/Booking');
const Form = require('../models/Form');
const Submission = require('../models/Submission');
const Inventory = require('../models/Inventory');
const Contact = require('../models/Contact');
const Business = require('../models/Business');
const User = require('../models/User');
const { fireAutomation, TRIGGERS } = require('./automation.service');

/**
 * Check for bookings that need reminders (24h before)
 * Runs every hour
 */
const checkBookingReminders = cron.schedule('0 * * * *', async () => {
    try {
        console.log('🔔 Checking for booking reminders...');

        const now = new Date();
        const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const twentyFiveHoursFromNow = new Date(now.getTime() + 25 * 60 * 60 * 1000);

        // Find bookings that are 24-25 hours away and haven't been reminded
        const bookings = await Booking.find({
            date: {
                $gte: twentyFourHoursFromNow,
                $lt: twentyFiveHoursFromNow,
            },
            status: { $in: ['pending', 'confirmed'] },
            reminderSent: { $ne: true },
        })
            .populate('contactId')
            .populate('businessId')
            .lean();

        console.log(`📋 Found ${bookings.length} bookings needing reminders`);

        for (const booking of bookings) {
            if (!booking.contactId || !booking.businessId) {
                console.log(`⚠️  Skipping booking ${booking._id} - missing contact or business`);
                continue;
            }

            // Fire reminder automation
            await fireAutomation(TRIGGERS.BOOKING_REMINDER, {
                businessId: booking.businessId._id,
                booking,
                contact: booking.contactId,
                business: booking.businessId,
            });

            // Mark reminder as sent
            await Booking.findByIdAndUpdate(booking._id, {
                $set: { reminderSent: true },
            });
        }

        console.log('✅ Booking reminders check complete');
    } catch (error) {
        console.error('❌ Error checking booking reminders:', error.message);
    }
});

/**
 * Check for pending forms (24h+ without completion)
 * Runs every 6 hours
 */
const checkPendingForms = cron.schedule('0 */6 * * *', async () => {
    try {
        console.log('📋 Checking for pending forms...');

        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Find bookings with pending forms that were created 24h+ ago
        const bookings = await Booking.find({
            formsStatus: 'sent',
            createdAt: { $lt: twentyFourHoursAgo },
            formReminderSent: { $ne: true },
        })
            .populate('contactId')
            .populate('businessId')
            .lean();

        console.log(`📋 Found ${bookings.length} bookings with pending forms`);

        for (const booking of bookings) {
            if (!booking.contactId || !booking.businessId) {
                continue;
            }

            // Get the form details
            const form = await Form.findOne({
                businessId: booking.businessId._id,
                linkedBookingTypes: booking.serviceType,
            }).lean();

            if (!form) {
                continue;
            }

            // Generate form link
            const formLink = `${process.env.CLIENT_URL}/form/${form._id}?booking=${booking._id}`;

            // Fire form reminder automation
            await fireAutomation(TRIGGERS.FORM_PENDING, {
                businessId: booking.businessId._id,
                form,
                contact: booking.contactId,
                business: booking.businessId,
                formLink,
            });

            // Mark reminder as sent
            await Booking.findByIdAndUpdate(booking._id, {
                $set: { formReminderSent: true },
            });
        }

        console.log('✅ Pending forms check complete');
    } catch (error) {
        console.error('❌ Error checking pending forms:', error.message);
    }
});

/**
 * Check inventory levels and send alerts
 * Runs every 12 hours
 */
const checkInventoryLevels = cron.schedule('0 */12 * * *', async () => {
    try {
        console.log('📦 Checking inventory levels...');

        // Find items at or below threshold that haven't been alerted
        const items = await Inventory.find({
            $expr: { $lte: ['$quantity', '$threshold'] },
            alertSent: { $ne: true },
        })
            .populate('businessId')
            .lean();

        console.log(`📦 Found ${items.length} items below threshold`);

        for (const item of items) {
            if (!item.businessId) {
                continue;
            }

            // Get business owner email
            const owner = await User.findOne({
                businessId: item.businessId._id,
                role: 'owner',
            }).lean();

            if (!owner || !owner.email) {
                console.log(`⚠️  No owner email found for business ${item.businessId._id}`);
                continue;
            }

            // Fire inventory alert automation
            await fireAutomation(TRIGGERS.INVENTORY_LOW, {
                businessId: item.businessId._id,
                item,
                business: item.businessId,
                ownerEmail: owner.email,
            });
        }

        console.log('✅ Inventory check complete');
    } catch (error) {
        console.error('❌ Error checking inventory:', error.message);
    }
});

/**
 * Clean up old automation logs (keep last 90 days)
 * Runs daily at 2 AM
 */
const cleanupOldLogs = cron.schedule('0 2 * * *', async () => {
    try {
        console.log('🧹 Cleaning up old automation logs...');

        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        const AutomationLog = require('../models/AutomationLog');
        const result = await AutomationLog.deleteMany({
            firedAt: { $lt: ninetyDaysAgo },
        });

        console.log(`✅ Deleted ${result.deletedCount} old automation logs`);
    } catch (error) {
        console.error('❌ Error cleaning up logs:', error.message);
    }
});

/**
 * Start all scheduled jobs
 */
const startScheduler = () => {
    console.log('⏰ Starting scheduler service...');

    checkBookingReminders.start();
    console.log('  ✅ Booking reminders: Every hour');

    checkPendingForms.start();
    console.log('  ✅ Pending forms: Every 6 hours');

    checkInventoryLevels.start();
    console.log('  ✅ Inventory levels: Every 12 hours');

    cleanupOldLogs.start();
    console.log('  ✅ Log cleanup: Daily at 2 AM');

    console.log('⏰ Scheduler service started successfully\n');
};

/**
 * Stop all scheduled jobs
 */
const stopScheduler = () => {
    console.log('⏰ Stopping scheduler service...');

    checkBookingReminders.stop();
    checkPendingForms.stop();
    checkInventoryLevels.stop();
    cleanupOldLogs.stop();

    console.log('⏰ Scheduler service stopped\n');
};

module.exports = {
    startScheduler,
    stopScheduler,
};
