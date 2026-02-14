const mongoose = require('mongoose');
const User = require('../src/models/User');
const Business = require('../src/models/Business');
const Booking = require('../src/models/Booking');
const Contact = require('../src/models/Contact');
const Form = require('../src/models/Form');
const Submission = require('../src/models/Submission');
const Inventory = require('../src/models/Inventory');
const Notification = require('../src/models/Notification');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TEST_EMAIL = 'codewithrohit7@gmail.com';

async function populateUserData() {
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

        // Clear existing test data
        console.log('\n🗑️  Clearing existing data...');
        await Booking.deleteMany({ businessId: business._id });
        await Contact.deleteMany({ businessId: business._id });
        await Form.deleteMany({ businessId: business._id });
        await Submission.deleteMany({ businessId: business._id });
        await Inventory.deleteMany({ businessId: business._id });
        await Notification.deleteMany({ business: business._id });

        // 1. CREATE BOOKINGS FOR CURRENT MONTH (varying per day)
        console.log('\n📅 Creating bookings for current month...');
        const bookings = [];
        const services = ['Haircut', 'Hair Coloring', 'Beard Trim', 'Facial', 'Massage', 'Manicure', 'Pedicure', 'Hair Treatment', 'Styling', 'Consultation'];
        const customerNames = [
            'John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Williams', 'David Brown', 
            'Emily Davis', 'Chris Wilson', 'Lisa Anderson', 'Alex Turner', 'Maria Garcia',
            'James Lee', 'Patricia Martinez', 'Robert Taylor', 'Jennifer White', 'Michael Harris',
            'Linda Clark', 'William Lewis', 'Barbara Walker', 'Richard Hall', 'Susan Allen',
            'Thomas Young', 'Nancy King', 'Daniel Wright', 'Karen Scott', 'Paul Green',
            'Betty Adams', 'Mark Baker', 'Sandra Nelson', 'Steven Carter', 'Dorothy Mitchell'
        ];
        const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];
        const statuses = ['confirmed', 'pending', 'completed', 'cancelled'];

        // Get current month details
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const today = now.getDate();

        console.log(`   Creating bookings for ${daysInMonth} days in ${now.toLocaleString('default', { month: 'long' })} ${currentYear}`);

        let bookingId = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            // Vary bookings per day (1-8 bookings)
            const bookingsPerDay = Math.floor(Math.random() * 8) + 1;
            
            for (let i = 0; i < bookingsPerDay; i++) {
                const bookingDate = new Date(currentYear, currentMonth, day);
                const customerIndex = bookingId % customerNames.length;
                const serviceIndex = Math.floor(Math.random() * services.length);
                const timeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
                const duration = [30, 45, 60, 90, 120][Math.floor(Math.random() * 5)];

                // Determine status based on date
                let status;
                if (day < today - 2) {
                    status = Math.random() > 0.15 ? 'completed' : 'cancelled';
                } else if (day < today) {
                    status = Math.random() > 0.2 ? 'completed' : 'cancelled';
                } else if (day === today) {
                    status = Math.random() > 0.3 ? 'confirmed' : 'pending';
                } else {
                    status = Math.random() > 0.4 ? 'confirmed' : 'pending';
                }

                bookings.push({
                    businessId: business._id,
                    clientName: customerNames[customerIndex],
                    clientEmail: `${customerNames[customerIndex].toLowerCase().replace(' ', '.')}@example.com`,
                    clientPhone: `+1555${String(bookingId).padStart(6, '0')}`,
                    serviceType: services[serviceIndex],
                    date: bookingDate,
                    timeSlot: timeSlot,
                    duration: duration,
                    status: status,
                    notes: i % 5 === 0 ? 'Customer requested specific preferences' : '',
                    createdAt: new Date(bookingDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
                });

                bookingId++;
            }
        }

        await Booking.insertMany(bookings);
        console.log(`✅ Created ${bookings.length} bookings across ${daysInMonth} days`);
        console.log(`   - Confirmed: ${bookings.filter(b => b.status === 'confirmed').length}`);
        console.log(`   - Pending: ${bookings.filter(b => b.status === 'pending').length}`);
        console.log(`   - Completed: ${bookings.filter(b => b.status === 'completed').length}`);
        console.log(`   - Cancelled: ${bookings.filter(b => b.status === 'cancelled').length}`);

        // 2. CREATE LEADS/CONTACTS (40 contacts)
        console.log('\n👥 Creating leads/contacts...');
        const contacts = [];
        const contactStatuses = ['new', 'contacted', 'qualified', 'booked', 'closed'];
        const contactSources = ['contact_form', 'booking', 'manual', 'form_submission', 'gmail_import'];

        for (let i = 0; i < 40; i++) {
            const nameIndex = i % customerNames.length;
            const statusIndex = Math.floor(Math.random() * contactStatuses.length);
            const sourceIndex = Math.floor(Math.random() * contactSources.length);

            contacts.push({
                businessId: business._id,
                name: customerNames[nameIndex] + (i >= customerNames.length ? ` ${Math.floor(i / customerNames.length) + 1}` : ''),
                email: `contact${i + 1}@example.com`,
                phone: `+1555${String(1000 + i).padStart(6, '0')}`,
                status: contactStatuses[statusIndex],
                source: contactSources[sourceIndex],
                notes: i % 4 === 0 ? 'Interested in premium services' : i % 3 === 0 ? 'Follow up next week' : '',
                tags: i % 3 === 0 ? ['vip'] : i % 2 === 0 ? ['follow-up'] : [],
                createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
            });
        }

        await Contact.insertMany(contacts);
        console.log(`✅ Created ${contacts.length} leads/contacts`);
        console.log(`   - New: ${contacts.filter(c => c.status === 'new').length}`);
        console.log(`   - Contacted: ${contacts.filter(c => c.status === 'contacted').length}`);
        console.log(`   - Qualified: ${contacts.filter(c => c.status === 'qualified').length}`);
        console.log(`   - Booked: ${contacts.filter(c => c.status === 'booked').length}`);
        console.log(`   - Closed: ${contacts.filter(c => c.status === 'closed').length}`);

        // 3. CREATE FORMS (8 forms with submissions)
        console.log('\n📝 Creating forms...');
        const formsData = [
            {
                title: 'Contact Form',
                description: 'General contact and inquiry form',
                fields: [
                    { id: 'name', type: 'text', label: 'Full Name', required: true },
                    { id: 'email', type: 'email', label: 'Email Address', required: true },
                    { id: 'phone', type: 'phone', label: 'Phone Number', required: false },
                    { id: 'message', type: 'textarea', label: 'Message', required: true },
                ],
                submissionsCount: 25,
            },
            {
                title: 'Appointment Request',
                description: 'Request an appointment online',
                fields: [
                    { id: 'name', type: 'text', label: 'Name', required: true },
                    { id: 'email', type: 'email', label: 'Email', required: true },
                    { id: 'service', type: 'select', label: 'Service', options: services, required: true },
                    { id: 'preferredDate', type: 'date', label: 'Preferred Date', required: true },
                ],
                submissionsCount: 30,
            },
            {
                title: 'Feedback Form',
                description: 'Share your experience',
                fields: [
                    { id: 'name', type: 'text', label: 'Name', required: true },
                    { id: 'rating', type: 'number', label: 'Rating (1-5)', required: true },
                    { id: 'feedback', type: 'textarea', label: 'Feedback', required: true },
                ],
                submissionsCount: 18,
            },
            {
                title: 'Newsletter Signup',
                description: 'Subscribe to our newsletter',
                fields: [
                    { id: 'email', type: 'email', label: 'Email Address', required: true },
                    { id: 'interests', type: 'text', label: 'Interests', required: false },
                ],
                submissionsCount: 45,
            },
            {
                title: 'Service Inquiry',
                description: 'Ask about our services',
                fields: [
                    { id: 'name', type: 'text', label: 'Name', required: true },
                    { id: 'email', type: 'email', label: 'Email', required: true },
                    { id: 'serviceType', type: 'select', label: 'Service', options: services, required: true },
                    { id: 'question', type: 'textarea', label: 'Question', required: true },
                ],
                submissionsCount: 20,
            },
            {
                title: 'Consultation Request',
                description: 'Book a free consultation',
                fields: [
                    { id: 'name', type: 'text', label: 'Name', required: true },
                    { id: 'email', type: 'email', label: 'Email', required: true },
                    { id: 'phone', type: 'phone', label: 'Phone', required: true },
                    { id: 'preferredTime', type: 'text', label: 'Preferred Time', required: false },
                ],
                submissionsCount: 15,
            },
            {
                title: 'VIP Membership',
                description: 'Join our VIP program',
                fields: [
                    { id: 'name', type: 'text', label: 'Full Name', required: true },
                    { id: 'email', type: 'email', label: 'Email', required: true },
                    { id: 'phone', type: 'phone', label: 'Phone', required: true },
                ],
                submissionsCount: 12,
            },
            {
                title: 'Gift Card Purchase',
                description: 'Purchase a gift card',
                fields: [
                    { id: 'buyerName', type: 'text', label: 'Your Name', required: true },
                    { id: 'buyerEmail', type: 'email', label: 'Your Email', required: true },
                    { id: 'recipientName', type: 'text', label: 'Recipient Name', required: true },
                    { id: 'amount', type: 'number', label: 'Amount', required: true },
                ],
                submissionsCount: 10,
            },
        ];

        const createdForms = [];
        let totalSubmissions = 0;

        for (const formData of formsData) {
            const form = await Form.create({
                businessId: business._id,
                title: formData.title,
                description: formData.description,
                fields: formData.fields,
                isActive: true,
                submissionsCount: formData.submissionsCount,
            });
            createdForms.push(form);

            // Create submissions
            const submissions = [];
            for (let i = 0; i < formData.submissionsCount; i++) {
                const data = new Map();
                const nameIndex = i % customerNames.length;

                formData.fields.forEach(field => {
                    if (field.id === 'name' || field.id === 'buyerName') data.set(field.id, customerNames[nameIndex]);
                    else if (field.id === 'email' || field.id === 'buyerEmail') data.set(field.id, `submission${i}@example.com`);
                    else if (field.id === 'phone') data.set(field.id, `+1555${String(2000 + i).padStart(6, '0')}`);
                    else if (field.id === 'message') data.set(field.id, 'I would like more information about your services.');
                    else if (field.id === 'service' || field.id === 'serviceType') data.set(field.id, services[i % services.length]);
                    else if (field.id === 'preferredDate') data.set(field.id, new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                    else if (field.id === 'rating') data.set(field.id, Math.floor(Math.random() * 2) + 4);
                    else if (field.id === 'feedback') data.set(field.id, 'Excellent service! Highly recommend.');
                    else if (field.id === 'interests') data.set(field.id, 'Promotions and new services');
                    else if (field.id === 'question') data.set(field.id, 'What are your pricing options?');
                    else if (field.id === 'preferredTime') data.set(field.id, 'Mornings preferred');
                    else if (field.id === 'recipientName') data.set(field.id, customerNames[(i + 5) % customerNames.length]);
                    else if (field.id === 'amount') data.set(field.id, [50, 100, 150, 200][i % 4]);
                });

                submissions.push({
                    formId: form._id,
                    businessId: business._id,
                    data: data,
                    createdAt: new Date(Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000),
                });
            }

            await Submission.insertMany(submissions);
            totalSubmissions += submissions.length;
        }

        console.log(`✅ Created ${createdForms.length} forms with ${totalSubmissions} total submissions`);

        // 4. CREATE INVENTORY (30 items with low stock alerts)
        console.log('\n📦 Creating inventory items...');
        const inventoryItems = [
            { name: 'Shampoo - Professional', category: 'Hair Care', quantity: 45, minQuantity: 10, unit: 'bottles', price: 25.99 },
            { name: 'Conditioner - Moisturizing', category: 'Hair Care', quantity: 38, minQuantity: 10, unit: 'bottles', price: 27.99 },
            { name: 'Hair Dye - Black', category: 'Hair Coloring', quantity: 4, minQuantity: 8, unit: 'boxes', price: 45.00 },
            { name: 'Hair Dye - Brown', category: 'Hair Coloring', quantity: 12, minQuantity: 8, unit: 'boxes', price: 45.00 },
            { name: 'Hair Dye - Blonde', category: 'Hair Coloring', quantity: 2, minQuantity: 8, unit: 'boxes', price: 45.00 },
            { name: 'Hair Dye - Red', category: 'Hair Coloring', quantity: 6, minQuantity: 8, unit: 'boxes', price: 45.00 },
            { name: 'Styling Gel', category: 'Styling', quantity: 22, minQuantity: 5, unit: 'bottles', price: 18.50 },
            { name: 'Hair Spray', category: 'Styling', quantity: 8, minQuantity: 10, unit: 'cans', price: 15.99 },
            { name: 'Mousse', category: 'Styling', quantity: 15, minQuantity: 8, unit: 'bottles', price: 16.99 },
            { name: 'Scissors - Professional', category: 'Tools', quantity: 8, minQuantity: 3, unit: 'pieces', price: 89.99 },
            { name: 'Combs Set', category: 'Tools', quantity: 25, minQuantity: 10, unit: 'sets', price: 12.99 },
            { name: 'Brushes Set', category: 'Tools', quantity: 18, minQuantity: 8, unit: 'sets', price: 15.99 },
            { name: 'Hair Dryer', category: 'Equipment', quantity: 4, minQuantity: 2, unit: 'pieces', price: 150.00 },
            { name: 'Straightener', category: 'Equipment', quantity: 3, minQuantity: 2, unit: 'pieces', price: 120.00 },
            { name: 'Curling Iron', category: 'Equipment', quantity: 5, minQuantity: 2, unit: 'pieces', price: 95.00 },
            { name: 'Towels - White', category: 'Supplies', quantity: 50, minQuantity: 20, unit: 'pieces', price: 8.99 },
            { name: 'Towels - Black', category: 'Supplies', quantity: 35, minQuantity: 20, unit: 'pieces', price: 8.99 },
            { name: 'Disposable Gloves', category: 'Supplies', quantity: 200, minQuantity: 50, unit: 'pairs', price: 0.25 },
            { name: 'Face Masks', category: 'Supplies', quantity: 5, minQuantity: 20, unit: 'boxes', price: 15.00 },
            { name: 'Aprons', category: 'Supplies', quantity: 12, minQuantity: 8, unit: 'pieces', price: 18.99 },
            { name: 'Nail Polish - Red', category: 'Nail Care', quantity: 18, minQuantity: 5, unit: 'bottles', price: 9.99 },
            { name: 'Nail Polish - Pink', category: 'Nail Care', quantity: 20, minQuantity: 5, unit: 'bottles', price: 9.99 },
            { name: 'Nail Polish Remover', category: 'Nail Care', quantity: 12, minQuantity: 8, unit: 'bottles', price: 7.99 },
            { name: 'Nail Files', category: 'Nail Care', quantity: 30, minQuantity: 15, unit: 'pieces', price: 2.99 },
            { name: 'Massage Oil - Lavender', category: 'Massage', quantity: 8, minQuantity: 5, unit: 'bottles', price: 22.50 },
            { name: 'Massage Oil - Eucalyptus', category: 'Massage', quantity: 10, minQuantity: 5, unit: 'bottles', price: 22.50 },
            { name: 'Facial Cream', category: 'Facial', quantity: 15, minQuantity: 8, unit: 'jars', price: 35.00 },
            { name: 'Face Masks - Clay', category: 'Facial', quantity: 3, minQuantity: 6, unit: 'jars', price: 28.00 },
            { name: 'Beard Oil', category: 'Beard Care', quantity: 1, minQuantity: 5, unit: 'bottles', price: 19.99 },
            { name: 'Beard Balm', category: 'Beard Care', quantity: 6, minQuantity: 5, unit: 'jars', price: 17.99 },
        ];

        const inventory = inventoryItems.map(item => ({
            businessId: business._id,
            ...item,
            lastRestocked: new Date(Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000),
        }));

        await Inventory.insertMany(inventory);
        const lowStockItems = inventory.filter(item => item.quantity < item.minQuantity);
        console.log(`✅ Created ${inventory.length} inventory items`);
        console.log(`   - Low stock items: ${lowStockItems.length}`);

        // 5. CREATE NOTIFICATIONS (including low stock notifications)
        console.log('\n🔔 Creating notifications...');
        const notifications = [];

        // Low stock notifications
        lowStockItems.forEach((item, index) => {
            notifications.push({
                business: business._id,
                user: user._id,
                type: 'system',
                title: 'Low Stock Alert',
                message: `${item.name} is running low (${item.quantity} ${item.unit} remaining, minimum: ${item.minQuantity})`,
                link: '/dashboard/inventory',
                read: index > 3, // First 4 unread
                createdAt: new Date(Date.now() - index * 6 * 60 * 60 * 1000),
            });
        });

        // Recent notifications (unread)
        for (let i = 0; i < 6; i++) {
            const types = ['booking', 'form', 'system', 'message'];
            const type = types[i % types.length];
            
            notifications.push({
                business: business._id,
                user: user._id,
                type: type,
                title: type === 'booking' ? 'New Booking' : type === 'form' ? 'Form Submission' : type === 'system' ? 'System Alert' : 'New Message',
                message: type === 'booking' ? `${customerNames[i]} booked ${services[i % services.length]}` : 
                         type === 'form' ? `New submission for ${formsData[i % formsData.length].title}` :
                         type === 'system' ? `Low stock alert for ${inventoryItems[i].name}` :
                         `New message from ${customerNames[i]}`,
                link: type === 'booking' ? '/dashboard/bookings' : 
                      type === 'form' ? '/dashboard/forms' :
                      type === 'system' ? '/dashboard/inventory' :
                      '/dashboard/inbox',
                read: false,
                createdAt: new Date(Date.now() - i * 3 * 60 * 60 * 1000),
            });
        }

        // Older notifications (read)
        for (let i = 0; i < 15; i++) {
            const types = ['booking', 'form', 'system', 'automation'];
            const type = types[i % types.length];
            
            notifications.push({
                business: business._id,
                user: user._id,
                type: type,
                title: type === 'booking' ? 'Booking Update' : type === 'form' ? 'Form Submission' : type === 'system' ? 'System Update' : 'Automation Triggered',
                message: type === 'booking' ? `${customerNames[i]} confirmed their appointment` : 
                         type === 'form' ? `Form submission received` :
                         type === 'system' ? `System maintenance completed` :
                         `Welcome email sent to new contacts`,
                link: '/dashboard',
                read: true,
                createdAt: new Date(Date.now() - (i + 10) * 6 * 60 * 60 * 1000),
            });
        }

        await Notification.insertMany(notifications);
        console.log(`✅ Created ${notifications.length} notifications`);
        console.log(`   - Unread: ${notifications.filter(n => !n.read).length}`);
        console.log(`   - Read: ${notifications.filter(n => n.read).length}`);

        // Summary
        console.log('\n' + '='.repeat(70));
        console.log('✅ DATA POPULATION COMPLETE!');
        console.log('='.repeat(70));
        console.log(`\n📊 Summary for ${TEST_EMAIL}:`);
        console.log(`   • Bookings: ${bookings.length} (across ${daysInMonth} days in current month)`);
        console.log(`   • Leads/Contacts: ${contacts.length}`);
        console.log(`   • Forms: ${createdForms.length} (with ${totalSubmissions} submissions)`);
        console.log(`   • Inventory Items: ${inventory.length} (${lowStockItems.length} low stock)`);
        console.log(`   • Notifications: ${notifications.length} (${notifications.filter(n => !n.read).length} unread)`);
        console.log('\n🎉 Dashboard is fully populated and ready for testing!\n');

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

populateUserData();
