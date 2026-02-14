const mongoose = require('mongoose');
const User = require('../src/models/User');
const Business = require('../src/models/Business');
const Notification = require('../src/models/Notification');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TEST_EMAIL = 'codewithrohit7@gmail.com';

async function addTestNotifications() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Find user and business
        const user = await User.findOne({ email: TEST_EMAIL });
        if (!user) {
            console.error('❌ User not found with email:', TEST_EMAIL);
            process.exit(1);
        }

        const business = await Business.findOne({ owner: user._id });
        if (!business) {
            console.error('❌ Business not found for user');
            process.exit(1);
        }

        console.log(`✅ Found user: ${user.name} (${user.email})`);
        console.log(`✅ Found business: ${business.name}`);

        // Delete existing notifications for this user
        await Notification.deleteMany({ business: business._id, user: user._id });
        console.log('🗑️  Cleared existing notifications');

        // Create test notifications
        const notifications = [
            {
                business: business._id,
                user: user._id,
                type: 'booking',
                title: 'New Booking Received',
                message: 'John Doe has booked a Haircut for tomorrow at 10:00 AM',
                link: '/dashboard/bookings',
                read: false,
                metadata: { bookingId: 'test123' }
            },
            {
                business: business._id,
                user: user._id,
                type: 'message',
                title: 'New Message',
                message: 'Sarah Williams sent you a message about her appointment',
                link: '/dashboard/inbox',
                read: false,
                metadata: { conversationId: 'test456' }
            },
            {
                business: business._id,
                user: user._id,
                type: 'form',
                title: 'Form Submission',
                message: 'New contact form submission from Mike Johnson',
                link: '/dashboard/forms',
                read: false,
                metadata: { formId: 'test789' }
            },
            {
                business: business._id,
                user: user._id,
                type: 'system',
                title: 'Low Stock Alert',
                message: '3 items are running low on stock',
                link: '/dashboard/inventory',
                read: false
            },
            {
                business: business._id,
                user: user._id,
                type: 'booking',
                title: 'Booking Confirmed',
                message: 'Emily Davis confirmed her booking for Hair Coloring',
                link: '/dashboard/bookings',
                read: true,
                metadata: { bookingId: 'test101' }
            },
            {
                business: business._id,
                user: user._id,
                type: 'automation',
                title: 'Automation Triggered',
                message: 'Welcome email sent to 5 new contacts',
                link: '/dashboard/automations',
                read: true
            },
            {
                business: business._id,
                user: user._id,
                type: 'system',
                title: 'Weekly Report Ready',
                message: 'Your weekly performance report is now available',
                link: '/dashboard',
                read: true
            },
            {
                business: business._id,
                user: user._id,
                type: 'booking',
                title: 'Booking Cancelled',
                message: 'Tom Martinez cancelled his appointment',
                link: '/dashboard/bookings',
                read: true,
                metadata: { bookingId: 'test202' }
            }
        ];

        // Insert notifications with slight time delays
        for (let i = 0; i < notifications.length; i++) {
            const notif = new Notification(notifications[i]);
            // Set createdAt to be in the past (most recent first)
            notif.createdAt = new Date(Date.now() - (i * 3600000)); // 1 hour apart
            await notif.save();
        }

        console.log(`\n✅ Created ${notifications.length} test notifications`);
        console.log(`   - ${notifications.filter(n => !n.read).length} unread`);
        console.log(`   - ${notifications.filter(n => n.read).length} read`);

        console.log('\n📊 Notification breakdown:');
        const types = notifications.reduce((acc, n) => {
            acc[n.type] = (acc[n.type] || 0) + 1;
            return acc;
        }, {});
        Object.entries(types).forEach(([type, count]) => {
            console.log(`   - ${type}: ${count}`);
        });

        console.log('\n✅ Test notifications added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addTestNotifications();
