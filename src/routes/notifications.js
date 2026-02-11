const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect, setBusinessContext } = require('../middleware/auth');

// All routes require authentication and business context
router.use(protect);
router.use(setBusinessContext);

// Get notifications
router.get('/', notificationController.getNotifications);

// Get unread count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark as read
router.patch('/:id/read', notificationController.markAsRead);

// Mark all as read
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
