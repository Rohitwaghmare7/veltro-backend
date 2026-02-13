/**
 * System Email Service
 * Uses the owner's connected Gmail account (rohit98waghmare@gmail.com) to send all system emails
 * - Welcome emails
 * - Password reset emails
 * - Low stock alerts
 * - Other system notifications
 */

const { google } = require('googleapis');
const User = require('../models/User');
const Business = require('../models/Business');

/**
 * Get system Gmail credentials from the owner's account
 * Uses rohit98waghmare@gmail.com's connected Gmail
 */
const getSystemGmailCredentials = async () => {
    try {
        // Find the owner user (rohit98waghmare@gmail.com)
        const ownerUser = await User.findOne({ 
            email: 'rohit98waghmare@gmail.com',
            role: 'owner'
        });

        if (!ownerUser) {
            throw new Error('System owner account not found');
        }

        // Get the business and Gmail tokens
        const business = await Business.findById(ownerUser.businessId);
        
        if (!business?.integrations?.gmail?.accessToken) {
            throw new Error('System Gmail not connected. Please connect Gmail in the dashboard.');
        }

        return {
            accessToken: business.integrations.gmail.accessToken,
            refreshToken: business.integrations.gmail.refreshToken,
        };
    } catch (error) {
        console.error('Failed to get system Gmail credentials:', error.message);
        throw error;
    }
};

/**
 * Send email via system Gmail account
 */
const sendSystemEmail = async ({ to, subject, html }) => {
    try {
        // Get Gmail credentials from database
        const credentials = await getSystemGmailCredentials();

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({
            access_token: credentials.accessToken,
            refresh_token: credentials.refreshToken,
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Create email message
        const message = [
            `To: ${to}`,
            `From: Veltro <rohit98waghmare@gmail.com>`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            html
        ].join('\n');

        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const response = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
            },
        });

        console.log('✅ System email sent via Gmail API to:', to);
        return { success: true, messageId: response.data.id };

    } catch (error) {
        console.error('❌ System email send failed:', error.message);
        
        // If token expired, try to refresh
        if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired')) {
            console.error('⚠️  Gmail tokens expired. Please reconnect Gmail in the dashboard.');
        }
        
        throw error;
    }
};

/**
 * Send welcome email to new user
 */
const sendWelcomeEmail = async (userEmail, userName) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to Veltro! 🎉</h1>
                </div>
                <div class="content">
                    <p>Hi ${userName},</p>
                    <p>Thank you for joining Veltro! We're excited to have you on board.</p>
                    <p>Veltro is your all-in-one platform for managing your business operations:</p>
                    <ul>
                        <li>📧 Inbox - Manage customer communications</li>
                        <li>📅 Bookings - Schedule and track appointments</li>
                        <li>📝 Forms - Collect customer information</li>
                        <li>👥 Leads - Track and convert prospects</li>
                        <li>🤖 Automations - Save time with automated workflows</li>
                        <li>📊 Analytics - Monitor your business performance</li>
                    </ul>
                    <p>To get started, complete your business profile and set up your first services.</p>
                    <p style="text-align: center;">
                        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/onboarding" class="button">Complete Setup</a>
                    </p>
                    <p>If you have any questions or need help, feel free to reach out to our support team.</p>
                    <p>Best regards,<br>The Veltro Team</p>
                </div>
                <div class="footer">
                    <p>This email was sent to ${userEmail}</p>
                    <p>© ${new Date().getFullYear()} Veltro. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendSystemEmail({
        to: userEmail,
        subject: 'Welcome to Veltro - Let\'s Get Started! 🚀',
        html
    });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (userEmail, resetToken) => {
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 10px; }
                .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="content">
                    <h2>Password Reset Request</h2>
                    <p>You requested to reset your password for your Veltro account.</p>
                    <p>Click the button below to reset your password:</p>
                    <p style="text-align: center;">
                        <a href="${resetUrl}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
                    <p><strong>This link will expire in 1 hour.</strong></p>
                    <p>If you didn't request this, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} Veltro. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendSystemEmail({
        to: userEmail,
        subject: 'Reset Your Veltro Password',
        html
    });
};

/**
 * Send low stock alert
 */
const sendLowStockAlert = async (businessEmail, productName, currentStock, threshold) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin: 20px 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="content">
                    <h2>⚠️ Low Stock Alert</h2>
                    <div class="alert">
                        <p><strong>${productName}</strong> is running low on stock!</p>
                        <p>Current stock: <strong>${currentStock}</strong></p>
                        <p>Threshold: ${threshold}</p>
                    </div>
                    <p>Please restock this item soon to avoid running out.</p>
                    <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/inventory">View Inventory</a></p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendSystemEmail({
        to: businessEmail,
        subject: `Low Stock Alert: ${productName}`,
        html
    });
};

module.exports = {
    sendSystemEmail,
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendLowStockAlert,
};
