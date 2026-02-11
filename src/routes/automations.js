const express = require('express');
const router = express.Router();
const {
    getLogs,
    getStats,
    resumeAutomationForContact,
    getPausedConversations,
    getTriggers,
    getSettings,
    updateSettings,
} = require('../controllers/automationController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

// All routes require authentication
router.use(protect);

// Get automation settings (owner only)
router.get('/settings', authorize('owner'), getSettings);

// Update automation settings (owner only)
router.patch('/settings', authorize('owner'), updateSettings);

// Get automation logs (owner only)
router.get('/logs', authorize('owner'), getLogs);

// Get automation statistics (owner only)
router.get('/stats', authorize('owner'), getStats);

// Get available triggers
router.get('/triggers', getTriggers);

// Get paused conversations (owner only)
router.get('/paused', authorize('owner'), getPausedConversations);

// Resume automation for a contact (owner only)
router.post('/resume/:contactId', authorize('owner'), resumeAutomationForContact);

module.exports = router;
