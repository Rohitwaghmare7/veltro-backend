const express = require('express');
const router = express.Router();
const { 
    getPublicBookingPage, 
    createPublicBooking,
    getPublicAvailableSlots,
} = require('../controllers/bookingController');

// Public booking page
router.get('/book/:slug', getPublicBookingPage);
router.get('/book/:slug/available-slots', getPublicAvailableSlots);
router.post('/book/:slug', createPublicBooking);

module.exports = router;
