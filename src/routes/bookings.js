const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { requirePermission } = require('../middleware/role');
const {
    getBookings,
    getBookingById,
    createBooking,
    updateBooking,
    updateBookingStatus,
    deleteBooking,
    checkAvailability,
    getAvailableSlotsForDate,
    getBookingStatistics,
} = require('../controllers/bookingController');

// All routes require authentication
router.use(protect);

// Get booking statistics
router.get('/stats', requirePermission('bookings'), getBookingStatistics);

// Check availability
router.post('/check-availability', requirePermission('bookings'), checkAvailability);

// Get available slots
router.get('/available-slots', requirePermission('bookings'), getAvailableSlotsForDate);

// Get all bookings and create booking
router.route('/')
    .get(requirePermission('bookings'), getBookings)
    .post(requirePermission('bookings'), createBooking);

// Get, update, and delete specific booking
router.route('/:id')
    .get(requirePermission('bookings'), getBookingById)
    .put(requirePermission('bookings'), updateBooking);

// Update booking status
router.patch('/:id/status', requirePermission('bookings'), updateBookingStatus);

// Delete booking
router.delete('/:id', requirePermission('bookings'), deleteBooking);

module.exports = router;
