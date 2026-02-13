const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const Booking = require('../src/models/Booking');
const User = require('../src/models/User');
const Business = require('../src/models/Business');

const addTestBookings = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected...');

        // Find user by email
        const user = await User.findOne({ email: 'codewithrohit7@gmail.com' });
        if (!user) {
            console.log('User not found with email: codewithrohit7@gmail.com');
            process.exit(1);
        }

        console.log('Found user:', user.name);

        // Find user's business
        const business = await Business.findOne({ owner: user._id });
        if (!business) {
            console.log('No business found for this user');
            process.exit(1);
        }

        console.log('Found business:', business.name);

        // Delete existing test bookings for this business
        await Booking.deleteMany({ businessId: business._id });
        console.log('Deleted existing bookings');

        // Create test bookings for different dates and times
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const testBookings = [
            // Today
            {
                businessId: business._id,
                clientName: 'John Smith',
                clientEmail: 'john.smith@example.com',
                clientPhone: '+1234567890',
                serviceType: 'Consultation',
                date: new Date(today),
                timeSlot: '09:00',
                duration: 60,
                status: 'confirmed',
                notes: 'Initial consultation meeting',
                createdBy: user._id
            },
            {
                businessId: business._id,
                clientName: 'Sarah Johnson',
                clientEmail: 'sarah.j@example.com',
                clientPhone: '+1234567891',
                serviceType: 'Follow-up',
                date: new Date(today),
                timeSlot: '11:00',
                duration: 30,
                status: 'confirmed',
                notes: 'Follow-up appointment',
                createdBy: user._id
            },
            {
                businessId: business._id,
                clientName: 'Mike Wilson',
                clientEmail: 'mike.w@example.com',
                clientPhone: '+1234567892',
                serviceType: 'Training Session',
                date: new Date(today),
                timeSlot: '14:00',
                duration: 90,
                status: 'pending',
                notes: 'First training session',
                createdBy: user._id
            },
            // Tomorrow
            {
                businessId: business._id,
                clientName: 'Emily Davis',
                clientEmail: 'emily.d@example.com',
                clientPhone: '+1234567893',
                serviceType: 'Consultation',
                date: new Date(today.getTime() + 24 * 60 * 60 * 1000),
                timeSlot: '10:00',
                duration: 60,
                status: 'confirmed',
                notes: 'New client consultation',
                createdBy: user._id
            },
            {
                businessId: business._id,
                clientName: 'David Brown',
                clientEmail: 'david.b@example.com',
                clientPhone: '+1234567894',
                serviceType: 'Review Meeting',
                date: new Date(today.getTime() + 24 * 60 * 60 * 1000),
                timeSlot: '15:00',
                duration: 45,
                status: 'confirmed',
                notes: 'Quarterly review',
                createdBy: user._id
            },
            // Day after tomorrow
            {
                businessId: business._id,
                clientName: 'Lisa Anderson',
                clientEmail: 'lisa.a@example.com',
                clientPhone: '+1234567895',
                serviceType: 'Workshop',
                date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
                timeSlot: '09:30',
                duration: 120,
                status: 'confirmed',
                notes: 'Team workshop session',
                createdBy: user._id
            },
            {
                businessId: business._id,
                clientName: 'Robert Taylor',
                clientEmail: 'robert.t@example.com',
                clientPhone: '+1234567896',
                serviceType: 'Consultation',
                date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000),
                timeSlot: '13:00',
                duration: 60,
                status: 'pending',
                notes: 'Initial consultation',
                createdBy: user._id
            },
            // 3 days from now
            {
                businessId: business._id,
                clientName: 'Jennifer Martinez',
                clientEmail: 'jennifer.m@example.com',
                clientPhone: '+1234567897',
                serviceType: 'Training Session',
                date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
                timeSlot: '10:30',
                duration: 90,
                status: 'confirmed',
                notes: 'Advanced training',
                createdBy: user._id
            },
            {
                businessId: business._id,
                clientName: 'James Wilson',
                clientEmail: 'james.w@example.com',
                clientPhone: '+1234567898',
                serviceType: 'Follow-up',
                date: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
                timeSlot: '16:00',
                duration: 30,
                status: 'confirmed',
                notes: 'Progress check',
                createdBy: user._id
            },
            // 4 days from now
            {
                businessId: business._id,
                clientName: 'Patricia Garcia',
                clientEmail: 'patricia.g@example.com',
                clientPhone: '+1234567899',
                serviceType: 'Consultation',
                date: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
                timeSlot: '11:00',
                duration: 60,
                status: 'confirmed',
                notes: 'New client meeting',
                createdBy: user._id
            },
            // 5 days from now
            {
                businessId: business._id,
                clientName: 'Christopher Lee',
                clientEmail: 'chris.l@example.com',
                clientPhone: '+1234567800',
                serviceType: 'Workshop',
                date: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
                timeSlot: '09:00',
                duration: 120,
                status: 'confirmed',
                notes: 'Weekend workshop',
                createdBy: user._id
            },
            {
                businessId: business._id,
                clientName: 'Amanda White',
                clientEmail: 'amanda.w@example.com',
                clientPhone: '+1234567801',
                serviceType: 'Review Meeting',
                date: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000),
                timeSlot: '14:30',
                duration: 45,
                status: 'pending',
                notes: 'Performance review',
                createdBy: user._id
            },
            // 6 days from now
            {
                businessId: business._id,
                clientName: 'Daniel Harris',
                clientEmail: 'daniel.h@example.com',
                clientPhone: '+1234567802',
                serviceType: 'Training Session',
                date: new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000),
                timeSlot: '10:00',
                duration: 90,
                status: 'confirmed',
                notes: 'Final training session',
                createdBy: user._id
            },
            // Past booking (completed)
            {
                businessId: business._id,
                clientName: 'Mary Thompson',
                clientEmail: 'mary.t@example.com',
                clientPhone: '+1234567803',
                serviceType: 'Consultation',
                date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
                timeSlot: '10:00',
                duration: 60,
                status: 'completed',
                notes: 'Completed consultation',
                createdBy: user._id
            },
            // Past booking (cancelled)
            {
                businessId: business._id,
                clientName: 'Thomas Clark',
                clientEmail: 'thomas.c@example.com',
                clientPhone: '+1234567804',
                serviceType: 'Follow-up',
                date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000),
                timeSlot: '15:00',
                duration: 30,
                status: 'cancelled',
                notes: 'Client cancelled',
                createdBy: user._id
            }
        ];

        // Insert bookings
        const createdBookings = await Booking.insertMany(testBookings);
        console.log(`\n✅ Successfully created ${createdBookings.length} test bookings!`);
        
        console.log('\nBookings summary:');
        console.log('- Today:', testBookings.filter(b => b.date.toDateString() === today.toDateString()).length);
        console.log('- This week:', testBookings.filter(b => b.date >= today && b.date < new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)).length);
        console.log('- Confirmed:', testBookings.filter(b => b.status === 'confirmed').length);
        console.log('- Pending:', testBookings.filter(b => b.status === 'pending').length);
        console.log('- Completed:', testBookings.filter(b => b.status === 'completed').length);
        console.log('- Cancelled:', testBookings.filter(b => b.status === 'cancelled').length);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

addTestBookings();
