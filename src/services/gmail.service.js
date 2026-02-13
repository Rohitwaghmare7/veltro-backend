const { google } = require('googleapis');
const { encryptToken, decryptToken } = require('./encryption.service');
const Business = require('../models/Business');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');

class GmailService {
    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.CLIENT_URL}/dashboard/integrations/gmail-callback`
        );
    }

    /**
     * Generate OAuth URL for Gmail connection
     */
    getAuthUrl(businessId, returnTo = 'dashboard') {
        const scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify'
        ];

        // Encode state with businessId and return location
        const state = JSON.stringify({ businessId, return: returnTo });

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            state: state,
            prompt: 'consent' // Force consent to get refresh token
        });
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCode(code) {
        const { tokens } = await this.oauth2Client.getToken(code);
        return tokens;
    }

    /**
     * Get authenticated Gmail client with automatic token refresh
     */
    async getAuthClient(businessId) {
        const business = await Business.findById(businessId);

        if (!business?.integrations?.gmail?.accessToken) {
            throw new Error('Gmail not connected');
        }

        // Decrypt tokens
        const accessToken = decryptToken(business.integrations.gmail.accessToken);
        const refreshToken = decryptToken(business.integrations.gmail.refreshToken);

        this.oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        // Check if token expired
        const now = Date.now();
        if (business.integrations.gmail.tokenExpiry && business.integrations.gmail.tokenExpiry < now) {
            try {
                // Refresh token
                const { credentials } = await this.oauth2Client.refreshAccessToken();

                // Store new token
                business.integrations.gmail.accessToken = encryptToken(credentials.access_token);
                business.integrations.gmail.tokenExpiry = credentials.expiry_date;
                await business.save();

                this.oauth2Client.setCredentials(credentials);
            } catch (error) {
                // Refresh token invalid - mark as disconnected
                business.integrations.gmail.connected = false;
                business.integrations.gmail.syncError = 'Token refresh failed. Please reconnect.';
                await business.save();
                throw new Error('Gmail token expired. Please reconnect.');
            }
        }

        return this.oauth2Client;
    }

    /**
     * Get Gmail API client
     */
    async getGmailClient(businessId) {
        const auth = await this.getAuthClient(businessId);
        return google.gmail({ version: 'v1', auth });
    }

    /**
     * Sync emails from Gmail
     */
    async syncEmails(businessId) {
        try {
            const business = await Business.findById(businessId);
            business.integrations.gmail.syncStatus = 'syncing';
            await business.save();

            const gmail = await this.getGmailClient(businessId);
            const isInitialSync = !business.integrations.gmail.historyId;

            if (isInitialSync) {
                await this.initialSync(businessId, gmail);
            } else {
                await this.incrementalSync(businessId, gmail);
            }

            business.integrations.gmail.lastSync = new Date();
            business.integrations.gmail.syncStatus = 'idle';
            business.integrations.gmail.syncError = null;
            await business.save();

            return { success: true };
        } catch (error) {
            const business = await Business.findById(businessId);
            business.integrations.gmail.syncStatus = 'error';
            business.integrations.gmail.syncError = error.message;
            await business.save();
            throw error;
        }
    }

    /**
     * Initial sync - fetch recent threads (last 5 days only)
     */
    async initialSync(businessId, gmail) {
        // Calculate date 5 days ago
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const afterDate = Math.floor(fiveDaysAgo.getTime() / 1000); // Unix timestamp

        // Fetch threads from last 5 days only
        const response = await gmail.users.threads.list({
            userId: 'me',
            maxResults: 100,
            q: `(in:inbox OR in:sent) after:${afterDate}`
        });

        if (response.data.threads) {
            for (const thread of response.data.threads) {
                await this.processThread(businessId, thread.id);
            }
        }

        // Store historyId for incremental sync
        const profile = await gmail.users.getProfile({ userId: 'me' });
        const business = await Business.findById(businessId);
        business.integrations.gmail.historyId = profile.data.historyId;
        await business.save();
    }

    /**
     * Incremental sync using History API
     */
    async incrementalSync(businessId, gmail) {
        const business = await Business.findById(businessId);

        try {
            const response = await gmail.users.history.list({
                userId: 'me',
                startHistoryId: business.integrations.gmail.historyId,
                historyTypes: ['messageAdded', 'messageDeleted']
            });

            if (response.data.history) {
                for (const record of response.data.history) {
                    if (record.messagesAdded) {
                        for (const msg of record.messagesAdded) {
                            // Get full message details
                            const fullMsg = await gmail.users.messages.get({
                                userId: 'me',
                                id: msg.message.id,
                                format: 'full'
                            });
                            await this.processMessageFromHistory(businessId, fullMsg.data);
                        }
                    }
                }
            }

            // Update historyId
            if (response.data.historyId) {
                business.integrations.gmail.historyId = response.data.historyId;
                await business.save();
            }
        } catch (error) {
            // If history is invalid, do full sync
            if (error.code === 404) {
                await this.initialSync(businessId, gmail);
            } else {
                throw error;
            }
        }
    }

    /**
     * Process a single thread
     */
    async processThread(businessId, threadId) {
        const gmail = await this.getGmailClient(businessId);

        // Fetch full thread details
        const thread = await gmail.users.threads.get({
            userId: 'me',
            id: threadId,
            format: 'full'
        });

        const messages = thread.data.messages;
        if (!messages || messages.length === 0) return;

        // Extract participants
        const business = await Business.findById(businessId);
        let businessEmail = business.integrations.gmail.email;

        // Fallback: Fetch email if missing
        if (!businessEmail) {
            const profile = await gmail.users.getProfile({ userId: 'me' });
            businessEmail = profile.data.emailAddress;
            business.integrations.gmail.email = businessEmail;
            await business.save();
        }

        const participants = this.extractParticipants(messages);

        // Find contact (not business owner)
        const contactEmail = participants.find(p => p && businessEmail && p.toLowerCase() !== businessEmail.toLowerCase());
        if (!contactEmail) return; // Skip if no external contact

        // Find or create contact
        let contact = await Contact.findOne({
            businessId,
            email: contactEmail
        });

        if (!contact) {
            const contactName = this.extractNameFromEmail(messages, contactEmail);
            contact = await Contact.create({
                businessId,
                email: contactEmail,
                name: contactName || contactEmail.split('@')[0],
                source: 'gmail_import'
            });
        }

        // Find or create conversation
        let conversation = await Conversation.findOne({
            businessId,
            contactId: contact._id,
            'metadata.gmailThreadId': threadId
        });

        if (!conversation) {
            const subject = this.getHeader(messages[0].payload.headers, 'Subject');
            conversation = await Conversation.create({
                businessId,
                contactId: contact._id,
                channel: 'email',
                status: 'open',
                metadata: {
                    gmailThreadId: threadId,
                    subject: subject || '(No Subject)',
                    participants
                }
            });
        }

        // Process each message in thread
        for (const msg of messages) {
            await this.processMessage(businessId, conversation._id, msg);
        }
    }

    /**
     * Process message from history API
     */
    async processMessageFromHistory(businessId, gmailMessage) {
        // Check if message already exists
        const existing = await Message.findOne({
            'metadata.gmailMessageId': gmailMessage.id
        });
        if (existing) return;

        // Get thread to find/create conversation
        const threadId = gmailMessage.threadId;
        await this.processThread(businessId, threadId);
    }

    /**
     * Process a single message
     */
    async processMessage(businessId, conversationId, gmailMessage) {
        // Check if already processed
        const existing = await Message.findOne({
            'metadata.gmailMessageId': gmailMessage.id
        });
        if (existing) return;

        const headers = gmailMessage.payload.headers;
        const from = this.getHeader(headers, 'From');
        const to = this.getHeader(headers, 'To');
        const subject = this.getHeader(headers, 'Subject');
        const date = this.getHeader(headers, 'Date');
        const messageId = this.getHeader(headers, 'Message-ID');
        const inReplyTo = this.getHeader(headers, 'In-Reply-To');
        const references = this.getHeader(headers, 'References');

        // Determine direction
        const business = await Business.findById(businessId);
        let businessEmail = business.integrations.gmail.email;

        // Fallback: Fetch email if missing
        if (!businessEmail) {
            const gmail = await this.getGmailClient(businessId);
            const profile = await gmail.users.getProfile({ userId: 'me' });
            businessEmail = profile.data.emailAddress;
            business.integrations.gmail.email = businessEmail;
            await business.save();
        }

        const direction = from && businessEmail && from.toLowerCase().includes(businessEmail.toLowerCase()) ? 'outbound' : 'inbound';

        // Extract body
        const body = this.extractBody(gmailMessage.payload);

        // Extract attachments
        const attachments = this.extractAttachments(gmailMessage.payload);

        // Check if message is unread
        const isUnread = !gmailMessage.labelIds?.includes('UNREAD');

        // Create message
        const message = await Message.create({
            conversationId,
            direction,
            type: 'manual',
            content: body.text || body.html || '',
            channel: 'email',
            sentAt: new Date(date),
            readAt: isUnread ? new Date() : null,
            metadata: {
                gmailMessageId: gmailMessage.id,
                gmailThreadId: gmailMessage.threadId,
                subject,
                from,
                to,
                messageId,
                inReplyTo,
                references,
                attachments,
                labels: gmailMessage.labelIds || []
            }
        });

        // Update conversation
        const conversation = await Conversation.findById(conversationId);
        if (direction === 'inbound' && !isUnread) {
            conversation.unreadCount = (conversation.unreadCount || 0) + 1;

            // Create notification for new inbound email
            // Get business owner to notify
            const business = await Business.findById(businessId);
            if (business && business.owner) {
                await Notification.create({
                    business: businessId,
                    user: business.owner,
                    type: 'message',
                    title: 'New Email',
                    message: `From: ${from}\nSubject: ${subject}`,
                    link: `/dashboard/inbox`,
                    metadata: {
                        conversationId,
                        messageId: message._id,
                        from,
                        subject,
                        source: 'gmail'
                    }
                }).catch(err => {
                    console.error('Failed to create notification:', err.message);
                });
            }
        }
        conversation.lastMessageAt = new Date(date);
        conversation.status = 'open';
        await conversation.save();
    }

    /**
     * Extract participants from messages
     */
    extractParticipants(messages) {
        const participants = new Set();

        for (const msg of messages) {
            const from = this.getHeader(msg.payload.headers, 'From');
            const to = this.getHeader(msg.payload.headers, 'To');
            const cc = this.getHeader(msg.payload.headers, 'Cc');

            if (from) {
                const email = this.extractEmail(from);
                if (email) participants.add(email);
            }
            if (to) {
                const emails = to.split(',').map(e => this.extractEmail(e.trim())).filter(Boolean);
                emails.forEach(e => participants.add(e));
            }
            if (cc) {
                const emails = cc.split(',').map(e => this.extractEmail(e.trim())).filter(Boolean);
                emails.forEach(e => participants.add(e));
            }
        }

        return Array.from(participants);
    }

    /**
     * Extract email address from "Name <email@example.com>" format
     */
    extractEmail(str) {
        const match = str.match(/<(.+?)>/);
        return match ? match[1] : str;
    }

    /**
     * Extract name from email header
     */
    extractNameFromEmail(messages, email) {
        for (const msg of messages) {
            const from = this.getHeader(msg.payload.headers, 'From');
            if (from && from.includes(email)) {
                const match = from.match(/^(.+?)\s*</);
                if (match) {
                    return match[1].replace(/['"]/g, '').trim();
                }
            }
        }
        return null;
    }

    /**
     * Get header value
     */
    getHeader(headers, name) {
        const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
        return header ? header.value : '';
    }

    /**
     * Extract email body
     */
    extractBody(payload) {
        let text = '';
        let html = '';

        if (payload.body?.data) {
            const decoded = Buffer.from(payload.body.data, 'base64').toString('utf-8');
            if (payload.mimeType === 'text/html') {
                html = decoded;
            } else {
                text = decoded;
            }
        }

        if (payload.parts) {
            for (const part of payload.parts) {
                if (part.mimeType === 'text/plain' && part.body?.data) {
                    text = Buffer.from(part.body.data, 'base64').toString('utf-8');
                } else if (part.mimeType === 'text/html' && part.body?.data) {
                    html = Buffer.from(part.body.data, 'base64').toString('utf-8');
                } else if (part.parts) {
                    const nested = this.extractBody(part);
                    text = text || nested.text;
                    html = html || nested.html;
                }
            }
        }

        return { text, html };
    }

    /**
     * Extract attachments
     */
    extractAttachments(payload) {
        const attachments = [];

        const processPartForAttachments = (part) => {
            if (part.filename && part.body?.attachmentId) {
                attachments.push({
                    filename: part.filename,
                    mimeType: part.mimeType,
                    size: part.body.size,
                    attachmentId: part.body.attachmentId
                });
            }

            if (part.parts) {
                part.parts.forEach(processPartForAttachments);
            }
        };

        if (payload.parts) {
            payload.parts.forEach(processPartForAttachments);
        }

        return attachments;
    }

    /**
     * Send email via Gmail API
     */
    async sendEmail(businessId, { to, subject, body, threadId, inReplyTo, references, attachments = [] }) {
        const gmail = await this.getGmailClient(businessId);

        // Build MIME message
        const boundary = 'boundary_' + Date.now();
        let message = [
            'MIME-Version: 1.0',
            `To: ${to}`,
            `Subject: ${subject}`,
        ];

        // Add threading headers if reply
        if (inReplyTo) {
            message.push(`In-Reply-To: ${inReplyTo}`);
        }
        if (references) {
            message.push(`References: ${references}`);
        }

        // Add content
        if (attachments && attachments.length > 0) {
            message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
            message.push('');

            // Add body part
            message.push(`--${boundary}`);
            message.push('Content-Type: text/html; charset=UTF-8');
            message.push('');
            message.push(body);

            // Add attachments
            for (const att of attachments) {
                if (att.size > 26214400) { // 25MB limit
                    throw new Error(`Attachment ${att.filename} exceeds 25MB limit`);
                }

                message.push(`--${boundary}`);
                message.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
                message.push('Content-Transfer-Encoding: base64');
                message.push(`Content-Disposition: attachment; filename="${att.filename}"`);
                message.push('');
                message.push(att.data);
            }

            message.push(`--${boundary}--`);
        } else {
            message.push('Content-Type: text/html; charset=UTF-8');
            message.push('');
            message.push(body);
        }

        // Encode message
        const encodedMessage = Buffer.from(message.join('\n'))
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        // Send via Gmail API
        const result = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
                threadId: threadId || undefined
            }
        });

        return result.data;
    }

    /**
     * Setup Gmail watch for push notifications
     */
    async setupWatch(businessId) {
        const gmail = await this.getGmailClient(businessId);

        const result = await gmail.users.watch({
            userId: 'me',
            requestBody: {
                topicName: process.env.GMAIL_PUBSUB_TOPIC,
                labelIds: ['INBOX', 'SENT']
            }
        });

        // Store expiration
        const business = await Business.findById(businessId);
        business.integrations.gmail.watchExpiration = result.data.expiration;
        await business.save();

        return result.data;
    }

    /**
     * Stop Gmail watch
     */
    async stopWatch(businessId) {
        try {
            const gmail = await this.getGmailClient(businessId);
            await gmail.users.stop({ userId: 'me' });
        } catch (error) {
            // Ignore errors - watch may already be stopped
            console.log('Stop watch error (ignored):', error.message);
        }
    }

    /**
     * Download attachment
     */
    async getAttachment(businessId, messageId, attachmentId) {
        const gmail = await this.getGmailClient(businessId);

        const result = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId,
            id: attachmentId
        });

        return result.data;
    }
}

module.exports = new GmailService();
