const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const { google } = require('googleapis');
const Business = require('../models/Business');
const AutomationLog = require('../models/AutomationLog');

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Send email via Gmail API using business's connected Gmail account
 */
const sendViaGmailAPI = async (businessId, to, subject, html) => {
    try {
        const business = await Business.findById(businessId);
        
        if (!business?.integrations?.gmail?.accessToken) {
            throw new Error('Gmail not connected for this business');
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        oauth2Client.setCredentials({
            access_token: business.integrations.gmail.accessToken,
            refresh_token: business.integrations.gmail.refreshToken,
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Create email message
        const message = [
            `To: ${to}`,
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

        return { success: true, messageId: response.data.id };
    } catch (error) {
        console.error('Gmail API send failed:', error.message);
        throw error;
    }
};

// Create reusable transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL,
            pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
        },
        // Force IPv4 to avoid IPv6 connectivity issues on some hosting platforms
        family: 4,
        // Connection timeout
        connectionTimeout: 10000,
        // Socket timeout  
        socketTimeout: 10000,
        // Ignore TLS errors (not recommended for production, but helps with connectivity)
        tls: {
            rejectUnauthorized: false
        }
    });
};

/**
 * Replace template variables with actual values
 * @param {string} template - Template string with {{variable}} placeholders
 * @param {object} variables - Object with variable values
 * @returns {string} - Template with variables replaced
 */
const replaceTemplateVariables = (template, variables) => {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value || '');
    }
    return result;
};

/**
 * Wrap template content in HTML email wrapper
 */
const wrapEmailTemplate = (content, businessName) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="content">
                    ${content}
                </div>
                <div class="footer">
                    <p>This is an automated message from ${businessName}</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

/**
 * Send email with error handling and logging
 * Uses SendGrid API if available, falls back to SMTP
 */
const sendEmail = async ({ to, subject, html, businessId, trigger, contactId, attachments }) => {
    try {
        // Try SendGrid API first if API key is available
        let messageId = null;
        if (process.env.SENDGRID_API_KEY) {
            const msg = {
                to,
                from: {
                    email: process.env.SMTP_FROM_EMAIL,
                    name: process.env.SMTP_FROM_NAME || 'Veltro'
                },
                subject,
                html,
            };

            // Add attachments if provided
            if (attachments && attachments.length > 0) {
                msg.attachments = attachments.map(att => ({
                    content: att.content.toString('base64'),
                    filename: att.filename,
                    type: att.contentType,
                    disposition: 'attachment'
                }));
            }

            const response = await sgMail.send(msg);
            messageId = response[0]?.headers?.['x-message-id'] || 'sendgrid-api';
            console.log('✅ Email sent via SendGrid API to:', to);
        } else {
            // Fallback to SMTP
            const transporter = createTransporter();

            const mailOptions = {
                from: `${process.env.SMTP_FROM_NAME || 'Veltro'} <${process.env.SMTP_FROM_EMAIL}>`,
                to,
                subject,
                html,
            };

            // Add attachments if provided
            if (attachments && attachments.length > 0) {
                mailOptions.attachments = attachments;
            }

            const info = await transporter.sendMail(mailOptions);
            messageId = info.messageId;
            console.log('✅ Email sent via SMTP to:', to);
        }

        // Log successful automation
        if (trigger && businessId) {
            await AutomationLog.create({
                trigger,
                businessId,
                contactId,
                firedAt: new Date(),
                type: 'email',
                success: true,
                metadata: {
                    messageId,
                    to,
                    subject,
                },
            });
        }

        console.log('✅ Email sent successfully');
        return { success: true, messageId };
    } catch (error) {
        console.error('❌ Email send failed:', error.message);

        // Log failed automation
        if (trigger && businessId) {
            await AutomationLog.create({
                trigger,
                businessId,
                contactId,
                firedAt: new Date(),
                type: 'email',
                success: false,
                error: error.message,
            });
        }

        return { success: false, error: error.message };
    }
};

/**
 * Email Templates
 */

const welcomeEmail = (contactName, businessName) => {
    return {
        subject: `Welcome to ${businessName}!`,
        html: `
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
                        <h1>Welcome to ${businessName}!</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${contactName},</p>
                        <p>Thank you for reaching out to us! We're excited to connect with you.</p>
                        <p>Our team will review your message and get back to you shortly. In the meantime, feel free to explore our services or book an appointment directly.</p>
                        <p>We look forward to serving you!</p>
                        <p>Best regards,<br>The ${businessName} Team</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from ${businessName}</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };
};

const bookingConfirmation = (booking, contact, business) => {
    const date = new Date(booking.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return {
        subject: `Booking Confirmed - ${booking.serviceType}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                    .detail-label { font-weight: bold; color: #667eea; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Booking Confirmed!</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${contact.name},</p>
                        <p>Great news! Your booking has been confirmed.</p>
                        
                        <div class="booking-details">
                            <h3>Booking Details</h3>
                            <div class="detail-row">
                                <span class="detail-label">Service:</span>
                                <span>${booking.serviceType}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Date:</span>
                                <span>${date}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Time:</span>
                                <span>${booking.timeSlot}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Duration:</span>
                                <span>${booking.duration} minutes</span>
                            </div>
                            ${booking.location ? `
                            <div class="detail-row">
                                <span class="detail-label">Location:</span>
                                <span>${booking.location}</span>
                            </div>
                            ` : ''}
                        </div>

                        <p>We'll send you a reminder 24 hours before your appointment.</p>
                        <p>If you need to reschedule or have any questions, please don't hesitate to reach out.</p>
                        
                        <p>See you soon!</p>
                        <p>Best regards,<br>The ${business.name} Team</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated confirmation from ${business.name}</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };
};

const bookingReminder = (booking, contact, business) => {
    const date = new Date(booking.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return {
        subject: `Reminder: Your appointment tomorrow at ${booking.timeSlot}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .reminder-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>⏰ Appointment Reminder</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${contact.name},</p>
                        
                        <div class="reminder-box">
                            <strong>This is a friendly reminder about your upcoming appointment:</strong>
                            <p style="margin: 10px 0 0 0;">
                                <strong>${booking.serviceType}</strong><br>
                                Tomorrow, ${date}<br>
                                ${booking.timeSlot}
                                ${booking.location ? `<br>${booking.location}` : ''}
                            </p>
                        </div>

                        <p>We're looking forward to seeing you!</p>
                        <p>If you need to reschedule, please contact us as soon as possible.</p>
                        
                        <p>Best regards,<br>The ${business.name} Team</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated reminder from ${business.name}</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };
};

const formReminder = (form, contact, business, formLink) => {
    return {
        subject: `Reminder: Please complete your ${form.title}`,
        html: `
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
                        <h1>📋 Form Completion Reminder</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${contact.name},</p>
                        <p>We noticed you haven't completed your <strong>${form.title}</strong> yet.</p>
                        <p>This form is important for us to provide you with the best service possible. It will only take a few minutes to complete.</p>
                        <p style="text-align: center;">
                            <a href="${formLink}" class="button">Complete Form Now</a>
                        </p>
                        <p>If you have any questions or need assistance, please don't hesitate to reach out.</p>
                        <p>Thank you!</p>
                        <p>Best regards,<br>The ${business.name} Team</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated reminder from ${business.name}</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };
};

const inventoryAlert = (item, business, ownerEmail) => {
    return {
        subject: `⚠️ Low Stock Alert: ${item.name}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .alert-box { background: #fff3cd; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 5px; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>⚠️ Low Stock Alert</h1>
                    </div>
                    <div class="content">
                        <div class="alert-box">
                            <strong>Inventory Alert:</strong>
                            <p style="margin: 10px 0 0 0;">
                                <strong>${item.name}</strong> is running low!<br>
                                Current quantity: <strong>${item.quantity} ${item.unit}</strong><br>
                                Threshold: ${item.threshold} ${item.unit}
                            </p>
                        </div>

                        <p>Please restock this item soon to avoid running out.</p>
                        ${item.vendorEmail ? `<p>Vendor contact: ${item.vendorEmail}</p>` : ''}
                        
                        <p>Best regards,<br>Veltro Inventory System</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated alert from ${business.name}</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };
};

const staffInvite = (inviterName, businessName, inviteUrl) => {
    return {
        subject: `You've been invited to join ${businessName} on Veltro`,
        html: `
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
                        <h1>🎉 Team Invitation</h1>
                    </div>
                    <div class="content">
                        <p>Hello!</p>
                        <p>${inviterName} has invited you to join <strong>${businessName}</strong> on Veltro.</p>
                        <p>Veltro is a unified operations platform that helps service businesses manage leads, bookings, messaging, forms, and inventory all in one place.</p>
                        <p style="text-align: center;">
                            <a href="${inviteUrl}" class="button">Accept Invitation</a>
                        </p>
                        <p><small>This invitation link will expire in 48 hours.</small></p>
                        <p>If you have any questions, please contact ${inviterName}.</p>
                        <p>Welcome to the team!</p>
                    </div>
                    <div class="footer">
                        <p>This invitation was sent by ${businessName} via Veltro</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };
};

module.exports = {
    sendEmail,
    welcomeEmail,
    bookingConfirmation,
    bookingReminder,
    formReminder,
    inventoryAlert,
    staffInvite,
};

/**
 * Password Reset Email Template
 */
const passwordResetEmail = (name, resetUrl) => {
    return {
        subject: 'Password Reset Request',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
                    .button:hover { background: #5568d3; }
                    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${name},</p>
                        
                        <p>You requested to reset your password. Click the button below to create a new password:</p>
                        
                        <div style="text-align: center;">
                            <a href="${resetUrl}" class="button">Reset Password</a>
                        </div>
                        
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
                        
                        <div class="warning">
                            <strong>⚠️ Important:</strong>
                            <p style="margin: 10px 0 0 0;">
                                This link will expire in 1 hour for security reasons.<br>
                                If you didn't request this password reset, please ignore this email.
                            </p>
                        </div>
                        
                        <p>Best regards,<br>The Veltro Team</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated email from Veltro</p>
                        <p>If you're having trouble with the button above, copy and paste the URL into your browser.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
    };
};

module.exports = {
    sendEmail,
    welcomeEmail,
    bookingConfirmation,
    bookingReminder,
    formReminder,
    inventoryAlert,
    passwordResetEmail,
    staffInvite,
    replaceTemplateVariables,
    wrapEmailTemplate,
};
