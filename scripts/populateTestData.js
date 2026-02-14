const mongoose = require('mongoose');
const User = require('../src/models/User');
const Business = require('../src/models/Business');
const Booking = require('../src/models/Booking');
const Contact = require('../src/models/Contact');
const Form = require('../src/models/Form');
const Submission = require('../src/models/Submission');
const Inventory = require('../src/models/Inventory');
const Notification = require('../src/models/Notification');
const AutomationSettings = require('../src/models/AutomationSettings');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TEST_EMAIL = 'codewithrohit7@gmail.com';

async function populateTestData() {
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
        console.log('\n🗑️  Clearing existing test data...');
        await Booking.deleteMany({ business: business._id });
        await Contact.deleteMany({ business: business._id });
        await Form.deleteMany({ business: business._id });
        await Submission.deleteMany({ business: business._id });
        await Inventory.deleteMany({ business: business._id });
        await Notification.deleteMany({ user: user._id });
        await AutomationSettings.deleteMany({ business: business._id });
        await Conversation.deleteMany({ business: business._id });
        await Message.deleteMany({ business: business._id });

        // 1. CREATE BOOKINGS (30 bookings across different statuses and dates)
        console.log('\n📅 Creating bookings...');
        const bookings = [];
        const statuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        const services = ['Haircut', 'Hair Coloring', 'Beard Trim', 'Facial', 'Massage', 'Manicure', 'Pedicure'];
        const customerNames = ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Williams', 'David Brown', 'Emily Davis', 'Chris Wilson', 'Lisa Anderson'];
        const customerEmails = ['john@example.com', 'jane@example.com', 'mike@example.com', 'sarah@example.com', 'david@example.com', 'emily@example.com', 'chris@example.com', 'lisa@example.com'];
        const customerPhones = ['+1234567890', '+1234567891', '+1234567892', '+1234567893', '+1234567894', '+1234567895', '+1234567896', '+1234567897'];

        for (let i = 0; i < 30; i++) {
            const daysOffset = Math.floor(Math.random() * 60) - 30; // -30 to +30 days
            const bookingDate = new Date();
            bookingDate.setDate(bookingDate.getDate() + daysOffset);
            bookingDate.setHours(9 + Math.floor(Math.random() * 9), 0, 0, 0);

            const customerIndex = i % customerNames.length;
            const serviceIndex = Math.floor(Math.random() * services.length);
            const duration = [30, 45, 60, 90, 120][Math.floor(Math.random() * 5)];
            const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
            const timeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];

            let status;
            if (daysOffset < -5) status = 'completed';
            else if (daysOffset < 0) status = Math.random() > 0.3 ? 'completed' : 'cancelled';
            else if (daysOffset < 2) status = Math.random() > 0.2 ? 'confirmed' : 'pending';
            else status = Math.random() > 0.5 ? 'confirmed' : 'pending';

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
                notes: i % 3 === 0 ? 'Customer requested specific stylist' : '',
                createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            });
        }

        await Booking.insertMany(bookings);
        console.log(`✅ Created ${bookings.length} bookings`);

        // 2. CREATE CONTACTS (25 contacts across different statuses)
        console.log('\n👥 Creating contacts...');
        const contacts = [];
        const contactStatuses = ['new', 'contacted', 'qualified', 'booked', 'closed'];
        const contactSources = ['contact_form', 'booking', 'manual', 'form_submission', 'gmail_import'];
        const contactNames = ['Alex Turner', 'Maria Garcia', 'James Lee', 'Patricia Martinez', 'Robert Taylor', 'Jennifer White', 'Michael Harris', 'Linda Clark', 'William Lewis', 'Barbara Walker'];
        const contactEmails = ['alex.t@example.com', 'maria.g@example.com', 'james.l@example.com', 'patricia.m@example.com', 'robert.t@example.com', 'jennifer.w@example.com', 'michael.h@example.com', 'linda.c@example.com', 'william.l@example.com', 'barbara.w@example.com'];
        const contactPhones = ['+1555000001', '+1555000002', '+1555000003', '+1555000004', '+1555000005', '+1555000006', '+1555000007', '+1555000008', '+1555000009', '+1555000010'];

        for (let i = 0; i < 25; i++) {
            const nameIndex = i % contactNames.length;
            const statusIndex = Math.floor(Math.random() * contactStatuses.length);
            const sourceIndex = Math.floor(Math.random() * contactSources.length);

            contacts.push({
                businessId: business._id,
                name: contactNames[nameIndex],
                email: contactEmails[nameIndex],
                phone: contactPhones[nameIndex],
                status: contactStatuses[statusIndex],
                source: contactSources[sourceIndex],
                notes: i % 4 === 0 ? 'Interested in premium package' : '',
                tags: i % 3 === 0 ? ['vip', 'high-priority'] : i % 2 === 0 ? ['follow-up'] : [],
                createdAt: new Date(Date.now() - Math.random() * 45 * 24 * 60 * 60 * 1000),
            });
        }

        await Contact.insertMany(contacts);
        console.log(`✅ Created ${contacts.length} contacts`);

        // 3. CREATE FORMS (5 forms)
        console.log('\n📝 Creating forms...');
        const formsData = [
            {
                businessId: business._id,
                title: 'Contact Form',
                description: 'General contact and inquiry form',
                fields: [
                    { id: 'name', type: 'text', label: 'Full Name', required: true },
                    { id: 'email', type: 'email', label: 'Email Address', required: true },
                    { id: 'phone', type: 'phone', label: 'Phone Number', required: false },
                    { id: 'message', type: 'textarea', label: 'Message', required: true },
                ],
                isActive: true,
                submissionsCount: 15,
            },
            {
                businessId: business._id,
                title: 'Appointment Request',
                description: 'Request an appointment online',
                fields: [
                    { id: 'name', type: 'text', label: 'Name', required: true },
                    { id: 'email', type: 'email', label: 'Email', required: true },
                    { id: 'service', type: 'select', label: 'Service', options: services, required: true },
                    { id: 'preferredDate', type: 'date', label: 'Preferred Date', required: true },
                    { id: 'notes', type: 'textarea', label: 'Additional Notes', required: false },
                ],
                isActive: true,
                submissionsCount: 20,
                linkedServices: services,
                autoSendAfterBooking: true,
                sendDelay: 0,
            },
            {
                businessId: business._id,
                title: 'Feedback Form',
                description: 'Share your experience with us',
                fields: [
                    { id: 'name', type: 'text', label: 'Name', required: true },
                    { id: 'rating', type: 'number', label: 'Rating', required: true },
                    { id: 'feedback', type: 'textarea', label: 'Feedback', required: true },
                ],
                isActive: true,
                submissionsCount: 12,
            },
            {
                businessId: business._id,
                title: 'Newsletter Signup',
                description: 'Subscribe to our newsletter',
                fields: [
                    { id: 'email', type: 'email', label: 'Email Address', required: true },
                    { id: 'interests', type: 'multiselect', label: 'Interests', options: ['Promotions', 'New Services', 'Events'], required: false },
                ],
                isActive: true,
                submissionsCount: 30,
            },
            {
                businessId: business._id,
                title: 'Service Inquiry',
                description: 'Ask about our services',
                fields: [
                    { id: 'name', type: 'text', label: 'Name', required: true },
                    { id: 'email', type: 'email', label: 'Email', required: true },
                    { id: 'serviceType', type: 'select', label: 'Service Type', options: services, required: true },
                    { id: 'question', type: 'textarea', label: 'Your Question', required: true },
                ],
                isActive: true,
                submissionsCount: 10,
            },
        ];

        const createdForms = await Form.insertMany(formsData);
        console.log(`✅ Created ${createdForms.length} forms`);

        // Create submissions for each form
        console.log('\n📋 Creating form submissions...');
        let totalSubmissions = 0;
        
        for (let i = 0; i < createdForms.length; i++) {
            const form = createdForms[i];
            const submissionCount = formsData[i].submissionsCount;
            const submissions = [];

            for (let j = 0; j < submissionCount; j++) {
                const nameIndex = j % contactNames.length;
                const data = new Map();

                // Populate data based on form fields
                form.fields.forEach(field => {
                    if (field.id === 'name') data.set('name', contactNames[nameIndex]);
                    else if (field.id === 'email') data.set('email', contactEmails[nameIndex]);
                    else if (field.id === 'phone') data.set('phone', contactPhones[nameIndex]);
                    else if (field.id === 'message') data.set('message', 'I would like to book an appointment for next week.');
                    else if (field.id === 'service') data.set('service', services[j % services.length]);
                    else if (field.id === 'preferredDate') data.set('preferredDate', new Date(Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                    else if (field.id === 'notes') data.set('notes', j % 3 === 0 ? 'Prefer morning appointments' : '');
                    else if (field.id === 'rating') data.set('rating', Math.floor(Math.random() * 2) + 4);
                    else if (field.id === 'feedback') data.set('feedback', 'Great service! Very professional and friendly staff.');
                    else if (field.id === 'interests') data.set('interests', ['Promotions', 'New Services']);
                    else if (field.id === 'serviceType') data.set('serviceType', services[j % services.length]);
                    else if (field.id === 'question') data.set('question', 'What are your prices for this service?');
                });

                submissions.push({
                    formId: form._id,
                    businessId: business._id,
                    data: data,
                    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                });
            }

            await Submission.insertMany(submissions);
            totalSubmissions += submissions.length;
        }

        console.log(`✅ Created ${totalSubmissions} form submissions`);

        // 4. CREATE INVENTORY ITEMS (20 items with varying stock levels)
        console.log('\n📦 Creating inventory items...');
        const inventoryItems = [
            { name: 'Shampoo - Professional Grade', category: 'Hair Care', quantity: 45, minQuantity: 10, unit: 'bottles', price: 25.99 },
            { name: 'Conditioner - Moisturizing', category: 'Hair Care', quantity: 38, minQuantity: 10, unit: 'bottles', price: 27.99 },
            { name: 'Hair Dye - Black', category: 'Hair Coloring', quantity: 5, minQuantity: 8, unit: 'boxes', price: 45.00 },
            { name: 'Hair Dye - Brown', category: 'Hair Coloring', quantity: 12, minQuantity: 8, unit: 'boxes', price: 45.00 },
            { name: 'Hair Dye - Blonde', category: 'Hair Coloring', quantity: 3, minQuantity: 8, unit: 'boxes', price: 45.00 },
            { name: 'Styling Gel', category: 'Styling Products', quantity: 22, minQuantity: 5, unit: 'bottles', price: 18.50 },
            { name: 'Hair Spray', category: 'Styling Products', quantity: 15, minQuantity: 10, unit: 'cans', price: 15.99 },
            { name: 'Scissors - Professional', category: 'Tools', quantity: 8, minQuantity: 3, unit: 'pieces', price: 89.99 },
            { name: 'Combs Set', category: 'Tools', quantity: 25, minQuantity: 10, unit: 'sets', price: 12.99 },
            { name: 'Hair Dryer', category: 'Equipment', quantity: 4, minQuantity: 2, unit: 'pieces', price: 150.00 },
            { name: 'Towels - White', category: 'Supplies', quantity: 50, minQuantity: 20, unit: 'pieces', price: 8.99 },
            { name: 'Disposable Gloves', category: 'Supplies', quantity: 200, minQuantity: 50, unit: 'pairs', price: 0.25 },
            { name: 'Face Masks', category: 'Supplies', quantity: 6, minQuantity: 20, unit: 'boxes', price: 15.00 },
            { name: 'Nail Polish - Red', category: 'Nail Care', quantity: 18, minQuantity: 5, unit: 'bottles', price: 9.99 },
            { name: 'Nail Polish - Pink', category: 'Nail Care', quantity: 20, minQuantity: 5, unit: 'bottles', price: 9.99 },
            { name: 'Nail Polish Remover', category: 'Nail Care', quantity: 12, minQuantity: 8, unit: 'bottles', price: 7.99 },
            { name: 'Massage Oil - Lavender', category: 'Massage', quantity: 8, minQuantity: 5, unit: 'bottles', price: 22.50 },
            { name: 'Massage Oil - Eucalyptus', category: 'Massage', quantity: 10, minQuantity: 5, unit: 'bottles', price: 22.50 },
            { name: 'Facial Cream - Moisturizing', category: 'Facial', quantity: 15, minQuantity: 8, unit: 'jars', price: 35.00 },
            { name: 'Beard Oil', category: 'Beard Care', quantity: 2, minQuantity: 5, unit: 'bottles', price: 19.99 },
        ];

        const inventory = inventoryItems.map(item => ({
            businessId: business._id,
            ...item,
            lastRestocked: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        }));

        await Inventory.insertMany(inventory);
        console.log(`✅ Created ${inventory.length} inventory items`);

        // 5. CREATE NOTIFICATIONS (15 notifications)
        console.log('\n🔔 Creating notifications...');
        const notifications = [
            { business: business._id, user: user._id, type: 'booking', title: 'New Booking', message: 'John Doe booked Haircut for tomorrow at 10:00 AM', read: false, createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'booking', title: 'Booking Confirmed', message: 'Jane Smith confirmed their appointment', read: false, createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'system', title: 'Low Stock Alert', message: 'Hair Dye - Blonde is running low (3 boxes remaining)', read: false, createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'system', title: 'Low Stock Alert', message: 'Beard Oil is running low (2 bottles remaining)', read: false, createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'form', title: 'New Contact', message: 'Alex Turner submitted a contact form', read: true, createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'form', title: 'Form Submission', message: 'New submission for Contact Form', read: true, createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'booking', title: 'Booking Cancelled', message: 'Mike Johnson cancelled their appointment', read: true, createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'system', title: 'Low Stock Alert', message: 'Face Masks is running low (6 boxes remaining)', read: true, createdAt: new Date(Date.now() - 60 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'form', title: 'Contact Updated', message: 'Maria Garcia moved to Qualified status', read: true, createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'booking', title: 'Upcoming Appointment', message: 'Reminder: Sarah Williams has an appointment in 1 hour', read: true, createdAt: new Date(Date.now() - 84 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'form', title: 'Form Submission', message: 'New submission for Appointment Request', read: true, createdAt: new Date(Date.now() - 96 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'system', title: 'Stock Restocked', message: 'Shampoo - Professional Grade restocked (45 bottles)', read: true, createdAt: new Date(Date.now() - 108 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'form', title: 'New Contact', message: 'Patricia Martinez submitted a service inquiry', read: true, createdAt: new Date(Date.now() - 120 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'booking', title: 'Booking Completed', message: 'David Brown completed their appointment', read: true, createdAt: new Date(Date.now() - 132 * 60 * 60 * 1000) },
            { business: business._id, user: user._id, type: 'form', title: 'Form Submission', message: 'New submission for Feedback Form', read: true, createdAt: new Date(Date.now() - 144 * 60 * 60 * 1000) },
        ];

        await Notification.insertMany(notifications);
        console.log(`✅ Created ${notifications.length} notifications`);

        // 6. CREATE OR UPDATE AUTOMATION SETTINGS
        console.log('\n⚙️  Creating/updating automation settings...');
        const automationSettings = {
            businessId: business._id,
            automations: {
                NEW_CONTACT: {
                    enabled: true,
                    name: 'Welcome Email',
                    description: 'Send welcome email when a new contact is created',
                    emailSubject: `Welcome to ${business.name}!`,
                    emailTemplate: '<p>Hi {{contactName}},</p><p>Thank you for reaching out to us! We\'re excited to connect with you.</p><p>Our team will review your message and get back to you shortly.</p><p>Best regards,<br>{{businessName}}</p>',
                },
                BOOKING_CREATED: {
                    enabled: true,
                    name: 'Booking Confirmation',
                    description: 'Send confirmation email when a booking is created',
                    emailSubject: 'Booking Confirmed - {{serviceType}}',
                    emailTemplate: '<p>Hi {{contactName}},</p><p>Your booking has been confirmed!</p><p><strong>Service:</strong> {{serviceType}}<br><strong>Date:</strong> {{date}}<br><strong>Time:</strong> {{timeSlot}}</p><p>We look forward to seeing you!</p><p>Best regards,<br>{{businessName}}</p>',
                },
                BOOKING_REMINDER: {
                    enabled: true,
                    name: 'Booking Reminder',
                    description: 'Send reminder email 24 hours before appointment',
                    emailSubject: 'Reminder: Your appointment tomorrow',
                    emailTemplate: '<p>Hi {{contactName}},</p><p>This is a friendly reminder about your upcoming appointment:</p><p><strong>Service:</strong> {{serviceType}}<br><strong>Date:</strong> {{date}}<br><strong>Time:</strong> {{timeSlot}}</p><p>See you soon!</p><p>Best regards,<br>{{businessName}}</p>',
                },
                FORM_PENDING: {
                    enabled: false,
                    name: 'Form Reminder',
                    description: 'Send reminder for pending form submissions',
                    emailSubject: 'Complete your form - {{formName}}',
                    emailTemplate: '<p>Hi {{contactName}},</p><p>We noticed you haven\'t completed the form: <strong>{{formName}}</strong></p><p>Please take a moment to fill it out: <a href="{{formLink}}">Complete Form</a></p><p>Thank you!</p><p>Best regards,<br>{{businessName}}</p>',
                },
                INVENTORY_LOW: {
                    enabled: true,
                    name: 'Low Stock Alert',
                    description: 'Notify when inventory falls below threshold',
                    emailSubject: 'Low Stock Alert - {{itemName}}',
                    emailTemplate: '<p>Hi,</p><p>The following item is running low:</p><p><strong>Item:</strong> {{itemName}}<br><strong>Current Stock:</strong> {{currentStock}}<br><strong>Threshold:</strong> {{threshold}}</p><p>Please restock soon.</p><p>Best regards,<br>{{businessName}}</p>',
                },
            },
        };

        await AutomationSettings.findOneAndUpdate(
            { businessId: business._id },
            automationSettings,
            { upsert: true, new: true }
        );
        console.log(`✅ Created/updated automation settings`);

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('✅ TEST DATA POPULATION COMPLETE!');
        console.log('='.repeat(60));
        console.log(`\n📊 Summary for ${TEST_EMAIL}:`);
        console.log(`   • Bookings: ${bookings.length}`);
        console.log(`   • Contacts: ${contacts.length}`);
        console.log(`   • Forms: ${createdForms.length} (with ${totalSubmissions} total submissions)`);
        console.log(`   • Inventory Items: ${inventory.length}`);
        console.log(`   • Notifications: ${notifications.length} (${notifications.filter(n => !n.read).length} unread)`);
        console.log(`   • Automation Settings: Configured`);
        console.log('\n🎉 Dashboard is now ready for testing!\n');

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error populating test data:', error);
        process.exit(1);
    }
}

populateTestData();
