const Booking = require('../models/Booking');
const Business = require('../models/Business');
const Contact = require('../models/Contact');

// @desc    Get all bookings for the business
// @route   GET /api/bookings
// @access  Private
exports.getBookings = async (req, res, next) => {
    try {
        const { status, from, to } = req.query;
        const filter = { businessId: req.businessId };

        if (status) filter.status = status;
        if (from || to) {
            filter.date = {};
            if (from) filter.date.$gte = new Date(from);
            if (to) filter.date.$lte = new Date(to);
        }

        const bookings = await Booking.find(filter)
            .sort({ date: 1, timeSlot: 1 })
            .populate('contactId', 'name email phone');

        res.json({ success: true, data: bookings, count: bookings.length });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a booking (internal)
// @route   POST /api/bookings
// @access  Private
exports.createBooking = async (req, res, next) => {
    try {
        const { clientName, clientEmail, clientPhone, serviceType, date, timeSlot, duration, location, notes } = req.body;

        // Find or create contact
        let contact = await Contact.findOne({
            businessId: req.businessId,
            email: clientEmail,
        });

        if (!contact) {
            contact = await Contact.create({
                businessId: req.businessId,
                name: clientName,
                email: clientEmail,
                phone: clientPhone,
                source: 'booking',
                status: 'booked',
            });
        } else {
            contact.status = 'booked';
            await contact.save();
        }

        const booking = await Booking.create({
            businessId: req.businessId,
            contactId: contact._id,
            clientName,
            clientEmail,
            clientPhone,
            serviceType,
            date,
            timeSlot,
            duration: duration || 60,
            location,
            notes,
        });

        res.status(201).json({ success: true, data: booking });
    } catch (error) {
        next(error);
    }
};

// @desc    Update booking status
// @route   PATCH /api/bookings/:id/status
// @access  Private
exports.updateBookingStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findOne({
            _id: req.params.id,
            businessId: req.businessId,
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        booking.status = status;
        if (status === 'confirmed') booking.confirmedAt = new Date();
        await booking.save();

        res.json({ success: true, data: booking });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a booking
// @route   DELETE /api/bookings/:id
// @access  Private (owner)
exports.deleteBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findOneAndDelete({
            _id: req.params.id,
            businessId: req.businessId,
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        res.json({ success: true, message: 'Booking deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Public booking — get business info + availability
// @route   GET /api/public/book/:slug
// @access  Public
exports.getPublicBookingPage = async (req, res, next) => {
    try {
        const business = await Business.findOne({ bookingSlug: req.params.slug })
            .select('name category address workingHours contactEmail phone services');

        if (!business) {
            return res.status(404).json({ success: false, message: 'Business not found' });
        }

        res.json({ success: true, data: business });
    } catch (error) {
        next(error);
    }
};

// @desc    Public booking — create booking (no auth)
// @route   POST /api/public/book/:slug
// @access  Public
exports.createPublicBooking = async (req, res, next) => {
    try {
        const business = await Business.findOne({ bookingSlug: req.params.slug });
        if (!business) {
            return res.status(404).json({ success: false, message: 'Business not found' });
        }

        const { clientName, clientEmail, clientPhone, serviceType, date, timeSlot, duration } = req.body;

        // Find or create contact
        let contact = await Contact.findOne({ businessId: business._id, email: clientEmail });
        if (!contact) {
            contact = await Contact.create({
                businessId: business._id,
                name: clientName,
                email: clientEmail,
                phone: clientPhone,
                source: 'booking',
                status: 'booked',
            });
        }

        const booking = await Booking.create({
            businessId: business._id,
            contactId: contact._id,
            clientName,
            clientEmail,
            clientPhone,
            serviceType,
            date,
            timeSlot,
            duration: duration || 60,
        });

        res.status(201).json({ success: true, data: booking, message: 'Booking created successfully!' });
    } catch (error) {
        next(error);
    }
};
