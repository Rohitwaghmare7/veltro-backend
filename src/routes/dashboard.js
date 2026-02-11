const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getDashboardOverview, getDashboardAlerts } = require('../controllers/dashboardController');

router.use(protect);

router.get('/overview', getDashboardOverview);
router.get('/alerts', getDashboardAlerts);

module.exports = router;
