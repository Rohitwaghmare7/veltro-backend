const mongoose = require('mongoose');
const Business = require('./src/models/Business');
const User = require('./src/models/User');

async function findBusiness() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://rohit98waghmare_db_user:rohit123@cluster0.wkrrf.mongodb.net/veltro?retryWrites=true&w=majority');
        
        // Find user by email
        const user = await User.findOne({ email: 'shaikhrafat25@gmail.com' });
        
        if (!user) {
            console.log('❌ User not found');
            await mongoose.disconnect();
            return;
        }
        
        console.log('\n👤 User Found:');
        console.log('Email:', user.email);
        console.log('Business ID:', user.businessId);
        
        // Find business
        const business = await Business.findById(user.businessId);
        
        if (!business) {
            console.log('❌ Business not found');
            await mongoose.disconnect();
            return;
        }
        
        console.log('\n🏢 Business Found:');
        console.log('Name:', business.name);
        console.log('ID:', business._id);
        
        console.log('\n📧 Gmail Integration:');
        if (business.integrations?.gmail) {
            const gmail = business.integrations.gmail;
            console.log('Connected:', gmail.connected);
            console.log('Email:', gmail.email || 'Not set');
            console.log('Has accessToken:', !!gmail.accessToken);
            console.log('Has refreshToken:', !!gmail.refreshToken);
            
            if (gmail.accessToken) {
                const hasColon = gmail.accessToken.includes(':');
                const colonCount = (gmail.accessToken.match(/:/g) || []).length;
                
                console.log('\n🔐 Token Format:');
                console.log('Has colon:', hasColon);
                console.log('Colon count:', colonCount);
                
                if (colonCount === 1) {
                    console.log('✅ Token format is correct (encrypted)');
                } else if (colonCount === 0) {
                    console.log('❌ Token is NOT encrypted (plain text)');
                    console.log('\n💡 Solution: Disconnect and reconnect Gmail');
                } else {
                    console.log('⚠️  Unusual token format');
                }
            }
        } else {
            console.log('❌ No Gmail integration configured');
        }
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

findBusiness();
