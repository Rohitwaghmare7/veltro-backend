const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requirePermission } = require('../middleware/role');
const {
    getOverview,
    getAlerts,
    getRecentActivity,
} = require('../controllers/dashboardController');

// All routes require authentication
router.use(protect);

// Get dashboard overview stats (owner only, sets businessId)
router.get('/overview', requirePermission('dashboard'), getOverview);

// Get key alerts (owner only, sets businessId)
router.get('/alerts', requirePermission('dashboard'), getAlerts);

// Get recent activity for charts (owner only, sets businessId)
router.get('/activity', requirePermission('dashboard'), getRecentActivity);

module.exports = router;
