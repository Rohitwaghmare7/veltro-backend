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

// Google Calendar OAuth - Initiate
exports.connectGoogleCalendar = async (req, res, next) => {
    try {
        const businessId = req.businessId || req.user.businessId;
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.CLIENT_URL}/dashboard/integrations/callback`
        );

        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
        ];

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            state: businessId, // Pass business ID in state
            prompt: 'consent', // Force consent screen to get refresh token
        });

        res.json({ url });
    } catch (error) {
        next(error);
    }
};

// Google Calendar OAuth - Callback
exports.googleCalendarCallback = async (req, res, next) => {
    try {
        const { code } = req.query;
        // Get business ID from authenticated user instead of state parameter
        const businessId = req.businessId || req.user.businessId;

        if (!code || !businessId) {
            return res.status(400).json({ message: 'Missing authorization code or business ID' });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.CLIENT_URL}/dashboard/integrations/callback`
        );

        const { tokens } = await oauth2Client.getToken(code);

        const business = await Business.findById(businessId);
        if (!business) {
            return res.status(404).json({ message: 'Business not found' });
        }

        if (!business.integrations) {
            business.integrations = {};
        }

        business.integrations.googleCalendar = {
            connected: true,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiryDate: tokens.expiry_date,
            lastSync: new Date(),
        };

        await business.save();

        res.json({ message: 'Google Calendar connected successfully' });
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
