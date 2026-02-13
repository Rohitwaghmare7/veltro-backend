// Quick test script to verify SendGrid configuration
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testSendGrid() {
    console.log('🧪 Testing SendGrid configuration...\n');
    
    // Show configuration (hide password)
    console.log('Configuration:');
    console.log('  SMTP_HOST:', process.env.SMTP_HOST);
    console.log('  SMTP_PORT:', process.env.SMTP_PORT);
    console.log('  SMTP_USER:', process.env.SMTP_USER);
    console.log('  SMTP_PASS:', process.env.SMTP_PASS ? `${process.env.SMTP_PASS.substring(0, 10)}...` : 'NOT SET');
    console.log('  SMTP_FROM_EMAIL:', process.env.SMTP_FROM_EMAIL);
    console.log('  SMTP_FROM_NAME:', process.env.SMTP_FROM_NAME);
    console.log('');

    // Create transporter
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        family: 4, // Force IPv4
        connectionTimeout: 10000,
        socketTimeout: 10000,
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        // Verify connection
        console.log('📡 Verifying SMTP connection...');
        await transporter.verify();
        console.log('✅ SMTP connection verified!\n');

        // Send test email
        console.log('📧 Sending test email...');
        const info = await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: process.env.SMTP_FROM_EMAIL, // Send to yourself
            subject: 'SendGrid Test Email - Veltro',
            html: `
                <h1>SendGrid Test Successful! 🎉</h1>
                <p>This is a test email from your Veltro backend.</p>
                <p>If you're reading this, SendGrid is configured correctly!</p>
                <hr>
                <p><small>Sent at: ${new Date().toISOString()}</small></p>
            `,
        });

        console.log('✅ Email sent successfully!');
        console.log('   Message ID:', info.messageId);
        console.log('   Response:', info.response);
        console.log('\n🎉 SendGrid is working perfectly!');
        console.log('   Check your inbox:', process.env.SMTP_FROM_EMAIL);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('\nFull error:', error);
        
        if (error.code === 'EAUTH') {
            console.error('\n💡 Authentication failed. Check:');
            console.error('   1. SMTP_USER should be exactly: apikey');
            console.error('   2. SMTP_PASS should be your SendGrid API key (starts with SG.)');
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
            console.error('\n💡 Connection failed. Check:');
            console.error('   1. SMTP_HOST should be: smtp.sendgrid.net');
            console.error('   2. SMTP_PORT should be: 587');
            console.error('   3. Your internet connection');
        }
    }
}

// Run the test
testSendGrid();
