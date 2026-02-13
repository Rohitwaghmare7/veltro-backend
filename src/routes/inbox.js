const express = require('express');
const router = express.Router();
const {
    getConversations,
    getMessages,
    sendReply,
    resolveConversation,
    reopenConversation,
    getContactBookings,
    getContactSubmissions,
    resumeAutomation,
    uploadAttachments,
} = require('../controllers/inboxController');
const { protect } = require('../middleware/auth');
const { requirePermission } = require('../middleware/role');

// All routes require authentication
router.use(protect);

// Get all conversations
router.get('/conversations', requirePermission('inbox'), getConversations);

// Get messages for a conversation
router.get('/conversations/:id/messages', requirePermission('inbox'), getMessages);

// Send a reply (with optional attachments)
router.post('/conversations/:id/reply', requirePermission('inbox'), uploadAttachments, sendReply);

// Mark conversation as resolved
router.patch('/conversations/:id/resolve', requirePermission('inbox'), resolveConversation);

// Reopen a resolved conversation
router.patch('/conversations/:id/reopen', requirePermission('inbox'), reopenConversation);

// Resume automation for a conversation
router.patch('/conversations/:id/resume-automation', requirePermission('inbox'), resumeAutomation);

// Get linked bookings for a contact
router.get('/contacts/:contactId/bookings', requirePermission('inbox'), getContactBookings);

// Get linked form submissions for a contact
router.get('/contacts/:contactId/submissions', requirePermission('inbox'), getContactSubmissions);

module.exports = router;
