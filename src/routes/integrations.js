const express = require('express');
const router = express.Router();
const {
    getIntegrationStatus,
    testConnection,
    configureIntegration,
    disconnectIntegration,
    connectGoogle,
    googleCallback,
    getFailedConnections,
    connectGmail,
    gmailCallback,
    disconnectGmail,
    getGmailStatus,
    syncGmail,
    sendGmailEmail,
    replyGmailEmail,
    getGmailAttachment,
    gmailWebhook,
} = require('../controllers/integrationController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

// Gmail webhook (no auth required - comes from Google)
router.post('/gmail/webhook', gmailWebhook);

// All other routes require authentication and owner role
router.use(protect);
router.use(authorize('owner'));

// Get all integration statuses
router.get('/status', getIntegrationStatus);

// Test connection
router.post('/:id/test', testConnection);

// Configure integration
router.post('/:id/configure', configureIntegration);

// Disconnect integration
router.post('/:id/disconnect', disconnectIntegration);

// Google Calendar OAuth
router.get('/google/connect', connectGoogle);
router.get('/google-calendar/callback', googleCallback);
router.get('/auth/google/callback', googleCallback); // Shared callback for both Gmail and Calendar

// Gmail OAuth
router.get('/gmail/connect', connectGmail);
router.get('/gmail/callback', gmailCallback);
router.delete('/gmail/disconnect', disconnectGmail);
router.get('/gmail/status', getGmailStatus);

// Gmail operations
router.post('/gmail/sync', syncGmail);
router.post('/gmail/send', sendGmailEmail);
router.post('/gmail/reply/:conversationId', replyGmailEmail);
router.get('/gmail/attachment/:messageId/:attachmentId', getGmailAttachment);

// Failed connections log
router.get('/failed', getFailedConnections);

module.exports = router;
