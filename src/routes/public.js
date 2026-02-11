const express = require('express');
const router = express.Router();
const { getPublicBookingPage, createPublicBooking } = require('../controllers/bookingController');
const { submitContactForm, getPublicContactFormConfig } = require('../controllers/leadController');

// Public booking page
router.get('/book/:slug', getPublicBookingPage);
router.post('/book/:slug', createPublicBooking);

// Public contact form
router.get('/contact/:slug', getPublicContactFormConfig);
router.post('/contact/:slug', submitContactForm);

module.exports = router;
