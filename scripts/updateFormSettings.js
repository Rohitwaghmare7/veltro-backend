const path = require('path');
const dotenv = require('dotenv');

// Load .env from backend directory
const envPath = path.join(__dirname, '..', '.env');
console.log(`📁 Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('❌ Error loading .env file:', result.error.message);
    process.exit(1);
}

const mongoose = require('mongoose');
const Form = require('../src/models/Form');

async function updateFormSettings() {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('❌ MONGO_URI not found');
            process.exit(1);
        }

        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Find the form
        const form = await Form.findOne({ title: 'Testing Consulting Service' });
        
        if (!form) {
            console.error('❌ Form "Testing Consulting Service" not found');
            process.exit(1);
        }

        console.log(`📋 Found form: "${form.title}"`);
        console.log(`   ID: ${form._id}`);
        console.log(`   Current settings:`);
        console.log(`   - Linked Services: ${form.linkedServices.join(', ') || 'None'}`);
        console.log(`   - Auto-send: ${form.autoSendAfterBooking}`);
        console.log(`   - Active: ${form.isActive}`);
        console.log(`   - Send Delay: ${form.sendDelay} minutes\n`);

        // Update the form
        form.linkedServices = ['Consultation'];
        form.autoSendAfterBooking = true;
        form.sendDelay = 0;
        form.isActive = true;

        await form.save();

        console.log('✅ Form updated successfully!');
        console.log(`   New settings:`);
        console.log(`   - Linked Services: ${form.linkedServices.join(', ')}`);
        console.log(`   - Auto-send: ${form.autoSendAfterBooking}`);
        console.log(`   - Active: ${form.isActive}`);
        console.log(`   - Send Delay: ${form.sendDelay} minutes\n`);

        console.log('💡 Now create a booking with service "Consultation" to test!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

updateFormSettings();
