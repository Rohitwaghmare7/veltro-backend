const dotenv = require('dotenv');
const path = require('path');
const sendEmail = require('../src/utils/sendEmail');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const testEmail = async () => {
    try {
        console.log('Testing email configuration...');
        console.log(`Host: ${process.env.SMTP_HOST}`);
        console.log(`User: ${process.env.SMTP_USER}`);

        await sendEmail({
            email: process.env.SMTP_USER, // Send to self
            subject: 'Thierobbs Email Test 🚀',
            message: 'If you see this email, your SMTP configuration is working correctly!',
        });

        console.log('✅ Email sent successfully!');
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        if (error.code === 'EAUTH') {
            console.error('Hint: Make sure you are using an App Password if using Gmail.');
        }
    }
};

testEmail();
