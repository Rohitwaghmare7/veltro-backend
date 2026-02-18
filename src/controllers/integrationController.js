const Business = require('../models/Business');
const { google } = require('googleapis');

// Get all integration statuses
exports.getIntegrationStatus = async (req, res, next) => {
    try {
        const businessId = req.businessId || req.user.businessId;
        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        const integrations = {
            email: {
                id: 'email',
                name: 'Email (SMTP)',
                status: business.integrations?.email?.connected ? 'connected' : 'disconnected',
                lastSync: business.integrations?.email?.lastSync,
                error: business.integrations?.email?.error,
            },
            gmail: {
                id: 'gmail',
                name: 'Gmail',
                status: business.integrations?.gmail?.connected ? 'connected' : 'disconnected',
                lastSync: business.integrations?.gmail?.lastSync,
                error: business.integrations?.gmail?.syncError,
                email: business.integrations?.gmail?.email,
            },
            'google-calendar': {
                id: 'google-calendar',
                name: 'Google Calendar',
                status: business.integrations?.googleCalendar?.connected ? 'connected' : 'disconnected',
                lastSync: business.integrations?.googleCalendar?.lastSync,
                error: business.integrations?.googleCalendar?.error,
            },
            sms: {
                id: 'sms',
                name: 'SMS (Twilio)',
                status: business.integrations?.sms?.connected ? 'connected' : 'disconnected',
                lastSync: business.integrations?.sms?.lastSync,
                error: business.integrations?.sms?.error,
            },
            cloudinary: {
                id: 'cloudinary',
                name: 'Cloudinary',
                status: business.integrations?.cloudinary?.connected ? 'connected' : 'disconnected',
                lastSync: business.integrations?.cloudinary?.lastSync,
                error: business.integrations?.cloudinary?.error,
            },
        };

        res.json(integrations);
    } catch (error) {
        next(error);
    }
};

// Test integration connection
exports.testConnection = async (req, res, next) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId || req.user.businessId;
        const business = await Business.findById(businessId);

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        let testResult = { success: false, message: 'Integration not configured' };

        switch (id) {
            case 'email':
                // Email is always connected if SMTP is configured
                testResult = { success: true, message: 'Email connection is working' };
                break;

            case 'google-calendar':
                if (business.integrations?.googleCalendar?.accessToken) {
                    try {
                        const oauth2Client = new google.auth.OAuth2(
                            process.env.GOOGLE_CLIENT_ID,
                            process.env.GOOGLE_CLIENT_SECRET,
                            process.env.GOOGLE_REDIRECT_URI
                        );
                        oauth2Client.setCredentials({
                            access_token: business.integrations.googleCalendar.accessToken,
                            refresh_token: business.integrations.googleCalendar.refreshToken,
                        });

                        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
                        await calendar.calendarList.list();

                        testResult = { success: true, message: 'Google Calendar connection is working' };
                    } catch (error) {
                        testResult = { success: false, message: 'Google Calendar connection failed: ' + error.message };
                    }
                }
                break;

            case 'gmail':
                if (business.integrations?.gmail?.accessToken) {
                    try {
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
                        await gmail.users.getProfile({ userId: 'me' });

                        testResult = { success: true, message: 'Gmail connection is working' };
                    } catch (error) {
                        testResult = { success: false, message: 'Gmail connection failed: ' + error.message };
                    }
                }
                break;

            case 'sms':
                if (business.integrations?.sms?.accountSid && business.integrations?.sms?.authToken) {
                    testResult = { success: true, message: 'SMS configuration is valid' };
                }
                break;

            case 'cloudinary':
                if (business.integrations?.cloudinary?.cloudName && business.integrations?.cloudinary?.apiKey) {
                    testResult = { success: true, message: 'Cloudinary configuration is valid' };
                }
                break;

            default:
                return res.status(400).json({ message: 'Invalid integration ID' });
        }

        res.json(testResult);
    } catch (error) {
        next(error);
    }
};

// Configure integration
exports.configureIntegration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId || req.user.businessId;
        const business = await Business.findById(businessId);

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (!business.integrations) {
            business.integrations = {};
        }

        switch (id) {
            case 'cloudinary':
                business.integrations.cloudinary = {
                    connected: true,
                    cloudName: req.body.cloudName,
                    apiKey: req.body.apiKey,
                    apiSecret: req.body.apiSecret,
                    lastSync: new Date(),
                };
                break;

            case 'sms':
                business.integrations.sms = {
                    connected: true,
                    accountSid: req.body.accountSid,
                    authToken: req.body.authToken,
                    phoneNumber: req.body.phoneNumber,
                    lastSync: new Date(),
                };
                break;

            default:
                return res.status(400).json({ message: 'Invalid integration ID' });
        }

        await business.save();

        res.json({ message: 'Integration configured successfully', integration: business.integrations[id] });
    } catch (error) {
        next(error);
    }
};

// Disconnect integration
exports.disconnectIntegration = async (req, res, next) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId || req.user.businessId;
        const business = await Business.findById(businessId);

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (!business.integrations) {
            return res.status(400).json({ message: 'No integrations configured' });
        }

        const integrationKey = id === 'google-calendar' ? 'googleCalendar' : id;

        if (business.integrations[integrationKey]) {
            business.integrations[integrationKey] = {
                connected: false,
                lastSync: undefined,
                error: undefined,
            };
            await business.save();
        }

        res.json({ message: 'Integration disconnected successfully' });
    } catch (error) {
        next(error);
    }
};

// Google OAuth - Initiate
exports.connectGoogle = async (req, res, next) => {
    try {
        const businessId = req.businessId || req.user.businessId;
        const returnTo = req.query.return || 'dashboard'; // Check where to return after OAuth
        
        // Use URI 1 from Google Cloud Console: /api/auth/google/callback
        // But since integrations routes are mounted at /api/integrations, we need to create a separate route
        // For now, let's use the dashboard callback which already works
        const callbackUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/integrations/callback`;
        
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            callbackUrl
        );

        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.labels',
        ];

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            state: JSON.stringify({ businessId, return: returnTo }), // Pass business ID and return destination in state
            prompt: 'consent', // Force consent screen to get refresh token
        });

        res.json({ url });
    } catch (error) {
        next(error);
    }
};

// Google OAuth - Callback
exports.googleCallback = async (req, res, next) => {
    try {
        const { code, state } = req.query;
        
        // Parse state parameter
        let businessId, returnTo;
        try {
            const stateData = JSON.parse(state);
            businessId = stateData.businessId;
            returnTo = stateData.return || 'dashboard';
        } catch (e) {
            // Fallback for old format (just businessId)
            businessId = state || req.businessId || req.user.businessId;
            returnTo = 'dashboard';
        }

        if (!code || !businessId) {
            return res.status(400).json({ message: 'Missing authorization code or business ID' });
        }

        // Use the dashboard callback URL (URI 2 in Google Cloud Console)
        const callbackUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/integrations/callback`;

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            callbackUrl
        );

        const { tokens } = await oauth2Client.getToken(code);

        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (!business.integrations) {
            business.integrations = {};
        }

        // Store tokens for both integrations since they use the same OAuth app
        const integrationData = {
            connected: true,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiryDate: tokens.expiry_date,
            lastSync: new Date(),
        };

        business.integrations.googleCalendar = { ...integrationData };
        business.integrations.gmail = { ...integrationData };

        await business.save();

        // Return success - frontend callback page will handle the redirect
        res.json({ message: 'Google Account connected successfully' });
    } catch (error) {
        next(error);
    }
};

// Get failed connections log
exports.getFailedConnections = async (req, res, next) => {
    try {
        const businessId = req.businessId || req.user.businessId;
        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        const failedConnections = [];

        if (business.integrations) {
            Object.entries(business.integrations).forEach(([key, value]) => {
                if (value.error) {
                    failedConnections.push({
                        integration: key,
                        error: value.error,
                        timestamp: value.lastSync || new Date(),
                    });
                }
            });
        }

        res.json(failedConnections);
    } catch (error) {
        next(error);
    }
};

// Gmail Integration Endpoints
const gmailService = require('../services/gmail.service');
const { encryptToken } = require('../services/encryption.service');

// Initiate Gmail OAuth flow
exports.connectGmail = async (req, res, next) => {
    try {
        const businessId = req.businessId || req.user.businessId;
        const returnTo = req.query.return || 'dashboard'; // Check where to return after OAuth
        const url = gmailService.getAuthUrl(businessId, returnTo);
        res.json({ url });
    } catch (error) {
        next(error);
    }
};

// Gmail OAuth callback
exports.gmailCallback = async (req, res, next) => {
    try {
        const { code, state } = req.query;
        
        // Parse state parameter
        let businessId, returnTo;
        try {
            const stateData = JSON.parse(state);
            businessId = stateData.businessId;
            returnTo = stateData.return || 'dashboard';
        } catch (e) {
            // Fallback for old format (just businessId)
            businessId = state || req.businessId || req.user.businessId;
            returnTo = 'dashboard';
        }

        if (!code || !businessId) {
            return res.status(400).json({ message: 'Missing authorization code or business ID' });
        }

        // Exchange code for tokens
        const tokens = await gmailService.exchangeCode(code);

        // Get user's email address
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.CLIENT_URL}/dashboard/integrations/gmail-callback`
        );
        oauth2Client.setCredentials(tokens);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: 'me' });

        // Store encrypted tokens
        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (!business.integrations) {
            business.integrations = {};
        }

        business.integrations.gmail = {
            connected: true,
            email: profile.data.emailAddress,
            accessToken: encryptToken(tokens.access_token),
            refreshToken: encryptToken(tokens.refresh_token),
            tokenExpiry: tokens.expiry_date,
            lastSync: null,
            historyId: null,
            watchExpiration: null,
            syncStatus: 'idle',
            syncError: null
        };

        await business.save();

        // Trigger initial sync in background
        gmailService.syncEmails(businessId).catch(err => {
            console.error('Initial Gmail sync failed:', err);
        });

        // Setup watch for push notifications
        if (process.env.GMAIL_PUBSUB_TOPIC) {
            gmailService.setupWatch(businessId).catch(err => {
                console.error('Gmail watch setup failed:', err);
            });
        }

        res.json({ 
            message: 'Gmail connected successfully',
            email: profile.data.emailAddress
        });
    } catch (error) {
        next(error);
    }
};

// Disconnect Gmail
exports.disconnectGmail = async (req, res, next) => {
    try {
        const businessId = req.businessId || req.user.businessId;
        const business = await Business.findById(businessId);

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        // Stop watch
        await gmailService.stopWatch(businessId).catch(err => {
            console.log('Stop watch error (ignored):', err.message);
        });

        // Clear tokens
        business.integrations.gmail = {
            connected: false,
            email: null,
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null,
            lastSync: null,
            historyId: null,
            watchExpiration: null,
            syncStatus: 'idle',
            syncError: null
        };

        await business.save();

        res.json({ message: 'Gmail disconnected successfully' });
    } catch (error) {
        next(error);
    }
};

// Get Gmail status
exports.getGmailStatus = async (req, res, next) => {
    try {
        const businessId = req.businessId || req.user.businessId;
        const business = await Business.findById(businessId);

        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        const gmail = business.integrations?.gmail || {};
        
        res.json({
            connected: gmail.connected || false,
            email: gmail.email || null,
            lastSync: gmail.lastSync || null,
            syncStatus: gmail.syncStatus || 'idle',
            syncError: gmail.syncError || null
        });
    } catch (error) {
        next(error);
    }
};

// Manual sync trigger
exports.syncGmail = async (req, res, next) => {
    try {
        const businessId = req.businessId || req.user.businessId;
        const business = await Business.findById(businessId);

        if (!business?.integrations?.gmail?.connected) {
            return res.status(400).json({ message: 'Gmail not connected' });
        }

        // Trigger sync
        const result = await gmailService.syncEmails(businessId);

        // Get updated stats
        const updatedBusiness = await Business.findById(businessId);
        
        res.json({
            message: 'Sync completed successfully',
            lastSync: updatedBusiness.integrations.gmail.lastSync,
            syncStatus: updatedBusiness.integrations.gmail.syncStatus
        });
    } catch (error) {
        next(error);
    }
};

// Send email via Gmail
exports.sendGmailEmail = async (req, res, next) => {
    try {
        const businessId = req.businessId || req.user.businessId;
        const { to, subject, body, attachments } = req.body;

        if (!to || !subject || !body) {
            return res.status(400).json({ message: 'Missing required fields: to, subject, body' });
        }

        const result = await gmailService.sendEmail(businessId, {
            to,
            subject,
            body,
            attachments
        });

        res.json({
            message: 'Email sent successfully',
            messageId: result.id,
            threadId: result.threadId
        });
    } catch (error) {
        next(error);
    }
};

// Reply to email thread
exports.replyGmailEmail = async (req, res, next) => {
    try {
        const businessId = req.businessId || req.user.businessId;
        const { conversationId } = req.params;
        const { body, attachments } = req.body;

        if (!body) {
            return res.status(400).json({ message: 'Missing required field: body' });
        }

        // Get conversation to find thread and last message
        const Conversation = require('../models/Conversation');
        const Message = require('../models/Message');
        
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        const threadId = conversation.metadata?.gmailThreadId;
        if (!threadId) {
            return res.status(400).json({ message: 'Not a Gmail conversation' });
        }

        // Get last message for threading headers
        const lastMessage = await Message.findOne({ conversationId })
            .sort({ sentAt: -1 })
            .limit(1);

        const inReplyTo = lastMessage?.metadata?.messageId;
        const references = lastMessage?.metadata?.references || lastMessage?.metadata?.messageId;

        // Get contact email
        const Contact = require('../models/Contact');
        const contact = await Contact.findById(conversation.contactId);
        
        // Get subject from conversation
        const subject = 'Re: ' + (conversation.metadata?.subject || '(No Subject)');

        const result = await gmailService.sendEmail(businessId, {
            to: contact.email,
            subject,
            body,
            threadId,
            inReplyTo,
            references,
            attachments
        });

        // Store sent message
        await Message.create({
            conversationId,
            direction: 'outbound',
            type: 'manual',
            content: body,
            channel: 'email',
            sentAt: new Date(),
            metadata: {
                gmailMessageId: result.id,
                gmailThreadId: result.threadId,
                subject,
                from: (await Business.findById(businessId)).integrations.gmail.email,
                to: contact.email
            }
        });

        res.json({
            message: 'Reply sent successfully',
            messageId: result.id,
            threadId: result.threadId
        });
    } catch (error) {
        next(error);
    }
};

// Get attachment
exports.getGmailAttachment = async (req, res, next) => {
    try {
        const businessId = req.businessId || req.user.businessId;
        const { messageId, attachmentId } = req.params;

        const attachment = await gmailService.getAttachment(businessId, messageId, attachmentId);

        // Get attachment metadata from message
        const Message = require('../models/Message');
        const message = await Message.findOne({ 'metadata.gmailMessageId': messageId });
        const attMetadata = message?.metadata?.attachments?.find(a => a.attachmentId === attachmentId);

        if (!attMetadata) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        // Decode base64 data
        const data = Buffer.from(attachment.data, 'base64url');

        res.setHeader('Content-Type', attMetadata.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${attMetadata.filename}"`);
        res.send(data);
    } catch (error) {
        next(error);
    }
};

// Gmail webhook handler
exports.gmailWebhook = async (req, res, next) => {
    try {
        // Acknowledge immediately
        res.status(200).send('OK');

        // Process webhook in background
        const message = req.body.message;
        if (!message || !message.data) {
            return;
        }

        // Decode base64 data
        const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
        const emailAddress = data.emailAddress;
        const historyId = data.historyId;

        // Find business by email
        const business = await Business.findOne({ 'integrations.gmail.email': emailAddress });
        if (!business) {
            console.log('No business found for email:', emailAddress);
            return;
        }

        // Trigger incremental sync
        gmailService.syncEmails(business._id).catch(err => {
            console.error('Webhook sync failed:', err);
        });
    } catch (error) {
        console.error('Webhook processing error:', error);
    }
};
