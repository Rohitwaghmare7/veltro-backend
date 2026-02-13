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
const Booking = require('../src/models/Booking');
const Contact = require('../src/models/Contact');
const Business = require('../src/models/Business');
const { sendLinkedForms } = require('../src/services/formSending.service');

async function testFormSending() {
    try {
        // Check if MONGO_URI is loaded
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('❌ MONGO_URI not found in environment variables');
            console.error('💡 Make sure you have a .env file in the backend directory with MONGO_URI set');
            console.error(`📁 Tried to load from: ${envPath}`);
            process.exit(1);
        }

        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Find the specific user's business
        const User = require('../src/models/User');
        const user = await User.findOne({ email: 'codewithrohit7@gmail.com' });
        
        if (!user) {
            console.error('❌ User codewithrohit7@gmail.com not found');
            process.exit(1);
        }
        
        console.log(`👤 User: ${user.name} (${user.email})`);
        console.log(`   ID: ${user._id}\n`);

        // Find business for this user
        let business = await Business.findOne({ ownerId: user._id });
        if (!business) {
            console.log('⚠️  No business found for this user, checking all businesses...');
            const allBusinesses = await Business.find().limit(5);
            console.log(`📊 Found ${allBusinesses.length} businesses in database:`);
            allBusinesses.forEach((b, i) => {
                console.log(`   ${i + 1}. ${b.name} (Owner: ${b.ownerId})`);
            });
            
            // Use the first business for testing
            business = allBusinesses[0];
            if (!business) {
                console.error('❌ No businesses found in database at all');
                process.exit(1);
            }
            console.log(`\n📊 Using business: ${business.name} (ID: ${business._id})\n`);
        } else {
            console.log(`📊 Business: ${business.name} (ID: ${business._id})\n`);
        }

        // Check for forms
        const allForms = await Form.find({ businessId: business._id });
        console.log(`📋 Total forms for this business: ${allForms.length}`);
        
        if (allForms.length === 0) {
            // Check all businesses
            console.log('⚠️  No forms found for this business, checking all businesses...');
            const allBusinessForms = await Form.find();
            console.log(`📋 Total forms in entire database: ${allBusinessForms.length}`);
            
            if (allBusinessForms.length > 0) {
                console.log('\n📋 Forms found in database:');
                for (const form of allBusinessForms) {
                    const formBusiness = await Business.findById(form.businessId);
                    console.log(`   - "${form.title}" (Business: ${formBusiness?.name || 'Unknown'})`);
                    console.log(`     Linked Services: ${form.linkedServices.join(', ') || 'None'}`);
                    console.log(`     Auto-send: ${form.autoSendAfterBooking ? 'Yes' : 'No'}`);
                    console.log(`     Active: ${form.isActive ? 'Yes' : 'No'}`);
                    console.log(`     Business ID: ${form.businessId}`);
                }
                
                // Use the business that has forms
                const formWithBusiness = allBusinessForms[0];
                business = await Business.findById(formWithBusiness.businessId);
                console.log(`\n📊 Switching to business with forms: ${business.name} (ID: ${business._id})\n`);
            }
        } else {
            allForms.forEach((form, index) => {
                console.log(`   ${index + 1}. "${form.title}"`);
                console.log(`      - Linked Services: ${form.linkedServices.join(', ') || 'None'}`);
                console.log(`      - Auto-send: ${form.autoSendAfterBooking ? 'Yes' : 'No'}`);
                console.log(`      - Active: ${form.isActive ? 'Yes' : 'No'}`);
            });
        }
        console.log('');

        // Check for bookings
        const recentBooking = await Booking.findOne({ businessId: business._id })
            .sort({ createdAt: -1 })
            .populate('contactId');
        
        if (!recentBooking) {
            console.error('❌ No bookings found in database');
            process.exit(1);
        }

        console.log(`📅 Most recent booking:`);
        console.log(`   - Service: ${recentBooking.serviceType}`);
        console.log(`   - Client: ${recentBooking.clientName} (${recentBooking.clientEmail})`);
        console.log(`   - Date: ${new Date(recentBooking.date).toLocaleDateString()}`);
        console.log(`   - Time: ${recentBooking.timeSlot}`);
        console.log('');

        // Check for matching forms
        const matchingForms = await Form.find({
            businessId: business._id,
            linkedServices: recentBooking.serviceType,
            autoSendAfterBooking: true,
            isActive: true,
        });

        console.log(`🔍 Forms matching booking service "${recentBooking.serviceType}":`);
        if (matchingForms.length === 0) {
            console.log('   ⚠️  No forms found with:');
            console.log(`      - linkedServices containing "${recentBooking.serviceType}"`);
            console.log('      - autoSendAfterBooking = true');
            console.log('      - isActive = true');
            console.log('');
            console.log('💡 To test form sending:');
            console.log('   1. Create a form in the dashboard');
            console.log(`   2. Link it to service: "${recentBooking.serviceType}"`);
            console.log('   3. Enable "Auto-send after Booking"');
            console.log('   4. Make sure the form is active');
        } else {
            console.log(`   ✅ Found ${matchingForms.length} matching form(s):`);
            matchingForms.forEach((form, index) => {
                console.log(`      ${index + 1}. "${form.title}" (ID: ${form._id})`);
            });
            console.log('');

            // Test sending
            console.log('📧 Testing form sending...\n');
            const result = await sendLinkedForms({
                businessId: business._id,
                booking: recentBooking,
                contact: recentBooking.contactId,
                business: business,
            });

            console.log('\n📊 Test Results:');
            console.log(`   - Success: ${result.success}`);
            console.log(`   - Forms Sent: ${result.formsSent}/${result.totalForms}`);
            if (result.results) {
                console.log('   - Details:');
                result.results.forEach((r, index) => {
                    console.log(`      ${index + 1}. ${r.formTitle}: ${r.success ? '✅ Sent' : '❌ Failed'}`);
                    if (r.error) {
                        console.log(`         Error: ${r.error}`);
                    }
                    if (r.messageId) {
                        console.log(`         Message ID: ${r.messageId}`);
                    }
                });
            }
        }

        console.log('\n✅ Test completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testFormSending();
