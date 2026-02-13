const Form = require('../models/Form');
const Business = require('../models/Business');
const emailService = require('./email.service');
const gmailService = require('./gmail.service');

/**
 * Send email using Gmail if connected, otherwise use SMTP
 */
const sendEmailSmart = async ({ businessId, to, subject, html, trigger, contactId }) => {
    try {
        // Check if Gmail is connected
        const business = await Business.findById(businessId);
        
        if (business?.integrations?.gmail?.connected) {
            console.log('📧 [EMAIL] Using Gmail to send email');
            try {
                const result = await gmailService.sendEmail(businessId, {
                    to,
                    subject,
                    body: html, // Gmail service expects 'body' not 'html'
                });
                
                console.log('✅ [EMAIL] Sent via Gmail successfully');
                return { success: true, messageId: result.id, via: 'gmail' };
            } catch (gmailError) {
                console.error('❌ [EMAIL] Gmail send failed, falling back to SMTP:', gmailError.message);
                // Fall back to SMTP if Gmail fails
            }
        }
        
        // Use SMTP (either Gmail not connected or Gmail failed)
        console.log('📧 [EMAIL] Using SMTP to send email');
        const result = await emailService.sendEmail({
            to,
            subject,
            html,
            businessId,
            trigger,
            contactId,
        });
        
        return { ...result, via: 'smtp' };
    } catch (error) {
        console.error('❌ [EMAIL] All email methods failed:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Send forms linked to a service after booking
 * @param {Object} params - Parameters
 * @param {string} params.businessId - Business ID
 * @param {Object} params.booking - Booking object
 * @param {Object} params.contact - Contact object
 * @param {Object} params.business - Business object
 */
const sendLinkedForms = async ({ businessId, booking, contact, business }) => {
    try {
        console.log('📋 [FORM SENDING] Starting form sending process...');
        console.log(`📋 [FORM SENDING] Business ID: ${businessId}`);
        console.log(`📋 [FORM SENDING] Service Type: ${booking.serviceType}`);
        console.log(`📋 [FORM SENDING] Contact Email: ${contact.email}`);

        // Find forms linked to this service with auto-send enabled
        const forms = await Form.find({
            businessId,
            linkedServices: booking.serviceType,
            autoSendAfterBooking: true,
            isActive: true,
        });

        console.log(`📋 [FORM SENDING] Found ${forms.length} form(s) matching criteria`);

        if (forms.length === 0) {
            console.log('ℹ️ [FORM SENDING] No auto-send forms found for this service');
            return { success: true, formsSent: 0 };
        }

        console.log(`📨 [FORM SENDING] Preparing to send ${forms.length} form(s)`);
        forms.forEach((form, index) => {
            console.log(`   ${index + 1}. "${form.title}" (ID: ${form._id})`);
        });

        const results = [];

        for (const form of forms) {
            try {
                // Calculate send time based on delay
                const sendDelay = form.sendDelay || 0; // Minutes
                
                if (sendDelay > 0) {
                    console.log(`⏰ [FORM SENDING] Form "${form.title}" scheduled to send in ${sendDelay} minutes`);
                    // TODO: Implement delayed sending with job queue (Bull/Agenda)
                    // For now, we'll send immediately
                }

                // Generate form link
                const formLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/form/${form._id}`;
                console.log(`🔗 [FORM SENDING] Form link: ${formLink}`);

                // Prepare email content
                const emailSubject = `${business.name} - Please complete: ${form.title}`;
                const emailHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; }
                            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
                            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>${business.name}</h1>
                            </div>
                            <div class="content">
                                <h2>Hi ${contact.name},</h2>
                                <p>Thank you for booking with us! To help us prepare for your appointment, please complete the following form:</p>
                                
                                <div class="booking-details">
                                    <h3>Your Booking Details</h3>
                                    <p><strong>Service:</strong> ${booking.serviceType}</p>
                                    <p><strong>Date:</strong> ${new Date(booking.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    <p><strong>Time:</strong> ${booking.timeSlot}</p>
                                    ${booking.location ? `<p><strong>Location:</strong> ${booking.location}</p>` : ''}
                                </div>

                                <h3>${form.title}</h3>
                                <p>${form.description || 'Please take a moment to fill out this form before your appointment.'}</p>
                                
                                <center>
                                    <a href="${formLink}" class="button">Complete Form</a>
                                </center>
                                
                                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                                    Or copy and paste this link into your browser:<br>
                                    <a href="${formLink}">${formLink}</a>
                                </p>
                            </div>
                            <div class="footer">
                                <p>This is an automated message from ${business.name}</p>
                                ${business.email ? `<p>Questions? Contact us at ${business.email}</p>` : ''}
                            </div>
                        </div>
                    </body>
                    </html>
                `;

                console.log(`📧 [FORM SENDING] Sending email to ${contact.email}...`);
                console.log(`📧 [FORM SENDING] Subject: ${emailSubject}`);

                // Send email using smart method (Gmail or SMTP)
                const result = await sendEmailSmart({
                    businessId,
                    to: contact.email,
                    subject: emailSubject,
                    html: emailHtml,
                    trigger: 'FORM_AUTO_SEND',
                    contactId: contact._id,
                });

                results.push({
                    formId: form._id,
                    formTitle: form.title,
                    success: result.success,
                    messageId: result.messageId,
                    via: result.via,
                    error: result.error,
                });

                if (result.success) {
                    console.log(`✅ [FORM SENDING] Form "${form.title}" sent successfully via ${result.via.toUpperCase()} (Message ID: ${result.messageId})`);
                } else {
                    console.error(`❌ [FORM SENDING] Failed to send form "${form.title}": ${result.error}`);
                }
            } catch (error) {
                console.error(`❌ [FORM SENDING] Error sending form "${form.title}":`, error.message);
                console.error(error.stack);
                results.push({
                    formId: form._id,
                    formTitle: form.title,
                    success: false,
                    error: error.message,
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`📊 [FORM SENDING] Summary: ${successCount}/${forms.length} forms sent successfully`);
        console.log(`📊 [FORM SENDING] Results:`, JSON.stringify(results, null, 2));

        return {
            success: true,
            formsSent: successCount,
            totalForms: forms.length,
            results,
        };
    } catch (error) {
        console.error('❌ [FORM SENDING] Critical error in sendLinkedForms:', error.message);
        console.error(error.stack);
        return {
            success: false,
            error: error.message,
            formsSent: 0,
        };
    }
};

module.exports = {
    sendLinkedForms,
};
