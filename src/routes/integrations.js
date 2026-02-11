const express = require('express');
const router = express.Router();
const {
    getIntegrationStatus,
    testConnection,
    configureIntegration,
    disconnectIntegration,
    connectGoogleCalendar,
    googleCalendarCallback,
    getFailedConnections,
} = require('../controllers/integrationController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

// All routes require authentication and owner role
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
router.get('/google-calendar/connect', connectGoogleCalendar);
router.get('/google-calendar/callback', googleCalendarCallback);

// Failed connections log
router.get('/failed', getFailedConnections);

module.exports = router;
