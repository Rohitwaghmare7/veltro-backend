const mongoose = require('mongoose');
const Business = require('./src/models/Business');

async function checkTokens() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://rohit98waghmare_db_user:rohit123@cluster0.wkrrf.mongodb.net/veltro?retryWrites=true&w=majority');
        
        const business = await Business.findById('698c715d097dc6765d7447f5');
        
        if (!business) {
            console.log('❌ Business not found');
            await mongoose.disconnect();
            return;
        }
        
        console.log('\n📧 Gmail Integration Status:');
        console.log('================================');
        
        if (!business.integrations?.gmail) {
            console.log('❌ No Gmail integration found');
            await mongoose.disconnect();
            return;
        }
        
        const gmail = business.integrations.gmail;
        
        console.log('Connected:', gmail.connected);
        console.log('Email:', gmail.email || 'Not set');
        console.log('Has accessToken:', !!gmail.accessToken);
        console.log('Has refreshToken:', !!gmail.refreshToken);
        
        if (gmail.accessToken) {
            const tokenPreview = gmail.accessToken.substring(0, 50);
            const hasColon = gmail.accessToken.includes(':');
            const colonCount = (gmail.accessToken.match(/:/g) || []).length;
            
            console.log('\n🔐 Token Format Analysis:');
            console.log('Token preview:', tokenPreview + '...');
            console.log('Has colon separator:', hasColon);
            console.log('Colon count:', colonCount);
            console.log('Expected format:', 'IV:encrypted (should have 1 colon)');
            
            if (colonCount === 1) {
                console.log('✅ Token format looks correct');
            } else if (colonCount === 0) {
                console.log('❌ Token is NOT encrypted (plain text or wrong format)');
                console.log('⚠️  Need to reconnect Gmail to encrypt tokens');
            } else {
                console.log('⚠️  Token format is unusual (multiple colons)');
            }
        }
        
        console.log('\n💡 Solution:');
        console.log('1. Go to Integrations page');
        console.log('2. Click "Disconnect" on Gmail');
        console.log('3. Click "Connect" again');
        console.log('4. Complete OAuth flow');
        console.log('5. Tokens will be properly encrypted');
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkTokens();
