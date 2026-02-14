const mongoose = require('mongoose');
const User = require('../src/models/User');
const Business = require('../src/models/Business');
const Booking = require('../src/models/Booking');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TEST_EMAIL = 'codewithrohit7@gmail.com';

async function addCurrentMonthBookings() {
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

        // Get current month start and end dates
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        console.log(`\n📅 Adding bookings for current month:`);
        console.log(`   From: ${currentMonthStart.toDateString()}`);
        console.log(`   To: ${currentMonthEnd.toDateString()}`);

        // Create 50 bookings for current month
        const bookings = [];
        const services = ['Haircut', 'Hair Coloring', 'Beard Trim', 'Facial', 'Massage', 'Manicure', 'Pedicure', 'Hair Styling', 'Deep Conditioning', 'Scalp Treatment'];
        const customerNames = [
            'John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Williams', 'David Brown', 
            'Emily Davis', 'Chris Wilson', 'Lisa Anderson', 'Tom Martinez', 'Anna Garcia',
            'Robert Taylor', 'Jennifer White', 'Michael Harris', 'Linda Clark', 'William Lewis',
            'Barbara Walker', 'James Robinson', 'Mary Hall', 'Richard Allen', 'Patricia Young',
            'Charles King', 'Susan Wright', 'Joseph Lopez', 'Karen Hill', 'Thomas Scott',
            'Nancy Green', 'Daniel Adams', 'Betty Baker', 'Matthew Nelson', 'Dorothy Carter',
            'Anthony Mitchell', 'Sandra Perez', 'Mark Roberts', 'Ashley Turner', 'Steven Phillips',
            'Kimberly Campbell', 'Paul Parker', 'Donna Evans', 'Andrew Edwards', 'Carol Collins',
            'Joshua Stewart', 'Michelle Sanchez', 'Kevin Morris', 'Amanda Rogers', 'Brian Reed',
            'Melissa Cook', 'George Morgan', 'Deborah Bell', 'Ronald Murphy', 'Stephanie Bailey'
        ];
        const customerEmails = customerNames.map((name, i) => 
            `${name.toLowerCase().replace(' ', '.')}${i}@example.com`
        );
        const customerPhones = customerNames.map((_, i) => 
            `+1${String(2000000000 + i).padStart(10, '0')}`
        );

        const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', 
                          '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];
        const durations = [30, 45, 60, 90, 120];

        // Get total days in current month
        const daysInMonth = currentMonthEnd.getDate();

        for (let i = 0; i < 50; i++) {
            // Distribute bookings across the month
            const dayOfMonth = Math.floor(Math.random() * daysInMonth) + 1;
            const bookingDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
            
            const customerIndex = i % customerNames.length;
            const serviceIndex = Math.floor(Math.random() * services.length);
            const timeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
            const duration = durations[Math.floor(Math.random() * durations.length)];

            // Determine status based on date
            let status;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            bookingDate.setHours(0, 0, 0, 0);

            if (bookingDate < today) {
                // Past bookings - mostly completed, some cancelled
                status = Math.random() > 0.15 ? 'completed' : 'cancelled';
            } else if (bookingDate.getTime() === today.getTime()) {
                // Today's bookings - mostly confirmed, some pending
                status = Math.random() > 0.3 ? 'confirmed' : 'pending';
            } else {
                // Future bookings - mix of confirmed and pending
                status = Math.random() > 0.4 ? 'confirmed' : 'pending';
            }

            bookings.push({
                businessId: business._id,
                clientName: customerNames[customerIndex],
                clientEmail: customerEmails[customerIndex],
                clientPhone: customerPhones[customerIndex],
                serviceType: services[serviceIndex],
                date: bookingDate,
                timeSlot: timeSlot,
                duration: duration,
                status: status,
                notes: i % 5 === 0 ? 'Customer requested specific stylist' : i % 7 === 0 ? 'First time customer' : '',
                createdAt: new Date(bookingDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Created within 7 days before booking
            });
        }

        await Booking.insertMany(bookings);
        console.log(`\n✅ Successfully added ${bookings.length} bookings for current month!`);

        // Show status breakdown
        const statusCounts = bookings.reduce((acc, booking) => {
            acc[booking.status] = (acc[booking.status] || 0) + 1;
            return acc;
        }, {});

        console.log('\n📊 Status Breakdown:');
        Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   • ${status}: ${count}`);
        });

        // Show date distribution
        const dateCounts = bookings.reduce((acc, booking) => {
            const date = booking.date.getDate();
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});

        console.log('\n📅 Bookings per day (showing days with bookings):');
        Object.entries(dateCounts)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .forEach(([day, count]) => {
                console.log(`   • Day ${day}: ${count} booking(s)`);
            });

        // Get total bookings for this business
        const totalBookings = await Booking.countDocuments({ businessId: business._id });
        console.log(`\n📈 Total bookings for ${business.name}: ${totalBookings}`);

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding bookings:', error);
        process.exit(1);
    }
}

addCurrentMonthBookings();
