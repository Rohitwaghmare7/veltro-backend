require('dotenv').config();
const mongoose = require('mongoose');
const Business = require('./src/models/Business');
const Contact = require('./src/models/Contact');
const Conversation = require('./src/models/Conversation');
const Message = require('./src/models/Message');
const User = require('./src/models/User');

async function checkGmailSync() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        console.log('\n🔍 Checking Gmail Sync Status\n');
        console.log('================================\n');
        
        // Find user
        const user = await User.findOne({ email: 'shaikhrafat25@gmail.com' });
        if (!user) {
            console.log('❌ User not found. Please register first.');
            await mongoose.disconnect();
            return;
        }
        
        console.log('✅ User found:', user.email);
        console.log('   Business ID:', user.businessId);
        
        // Find business
        const business = await Business.findById(user.businessId);
        if (!business) {
            console.log('❌ Business not found');
            await mongoose.disconnect();
            return;
        }
        
        console.log('✅ Business found:', business.name);
        
        // Check Gmail integration
        if (!business.integrations?.gmail?.connected) {
            console.log('❌ Gmail not connected');
            console.log('\n💡 To connect Gmail:');
            console.log('   1. Go to http://localhost:3000/dashboard/integrations');
            console.log('   2. Click "Connect" on Gmail');
            console.log('   3. Complete OAuth flow');
            await mongoose.disconnect();
            return;
        }
        
        console.log('✅ Gmail connected:', business.integrations.gmail.email);
        console.log('   Last sync:', business.integrations.gmail.lastSync || 'Never');
        console.log('   Sync status:', business.integrations.gmail.syncStatus || 'idle');
        
        // Check for Gmail contacts
        const gmailContacts = await Contact.find({
            businessId: user.businessId,
            source: 'gmail_import'
        }).countDocuments();
        
        console.log('\n📧 Gmail Data:');
        console.log('   Contacts from Gmail:', gmailContacts);
        
        // Check for Gmail conversations
        const gmailConversations = await Conversation.find({
            businessId: user.businessId,
            'metadata.gmailThreadId': { $exists: true }
        }).countDocuments();
        
        console.log('   Conversations from Gmail:', gmailConversations);
        
        // Check for Gmail messages
        const gmailMessages = await Message.find({
            'metadata.gmailMessageId': { $exists: true }
        }).countDocuments();
        
        console.log('   Messages from Gmail:', gmailMessages);
        
        // Show sample conversation
        if (gmailConversations > 0) {
            console.log('\n📬 Sample Gmail Conversation:');
            const sampleConv = await Conversation.findOne({
                businessId: user.businessId,
                'metadata.gmailThreadId': { $exists: true }
            }).populate('contactId');
            
            if (sampleConv) {
                console.log('   Subject:', sampleConv.metadata?.subject || 'No subject');
                console.log('   Contact:', sampleConv.contactId?.name);
                console.log('   Email:', sampleConv.contactId?.email);
                console.log('   Status:', sampleConv.status);
                console.log('   Last message:', new Date(sampleConv.lastMessageAt).toLocaleString());
            }
        }
        
        // Summary
        console.log('\n📊 Summary:');
        if (gmailContacts === 0 && gmailConversations === 0 && gmailMessages === 0) {
            console.log('⚠️  No Gmail data found. Sync may not have run yet.');
            console.log('\n💡 To sync Gmail:');
            console.log('   1. Go to http://localhost:3000/dashboard/integrations');
            console.log('   2. Click "Sync Now" on Gmail card');
            console.log('   3. Wait 10-30 seconds');
            console.log('   4. Check inbox for Gmail conversations');
        } else {
            console.log('✅ Gmail sync is working!');
            console.log('   - Contacts created from emails');
            console.log('   - Conversations grouped by thread');
            console.log('   - Messages stored with metadata');
            console.log('\n💡 View in app:');
            console.log('   Go to http://localhost:3000/dashboard/inbox');
            console.log('   Look for conversations with [Gmail] badge');
        }
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkGmailSync();
