const express = require('express');
const router = express.Router();
const { protect, setBusinessContext, authorizeStaff } = require('../middleware/auth');
const { getBookings, createBooking, updateBookingStatus, deleteBooking } = require('../controllers/bookingController');

router.use(protect);
router.use(setBusinessContext);

router.route('/')
    .get(authorizeStaff('canViewBookings'), getBookings)
    .post(authorizeStaff('canEditBookings'), createBooking);

router.patch('/:id/status', authorizeStaff('canEditBookings'), updateBookingStatus);
router.delete('/:id', authorizeStaff('canEditBookings'), deleteBooking);

module.exports = router;
