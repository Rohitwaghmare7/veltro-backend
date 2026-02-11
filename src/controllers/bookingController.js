const Booking = require('../models/Booking');
const Business = require('../models/Business');
const Contact = require('../models/Contact');
const { checkSlotAvailability, getAvailableSlots, getBookingStats } = require('../services/availability.service');
const googleCalendarService = require('../services/googleCalendar.service');

// @desc    Get all bookings for the business
// @route   GET /api/bookings
// @access  Private
exports.getBookings = async (req, res, next) => {
    try {
        const { status, from, to, serviceType, assignedTo } = req.query;
        const filter = { businessId: req.businessId };

        if (status) filter.status = status;
        if (serviceType) filter.serviceType = serviceType;
        if (assignedTo) filter.assignedTo = assignedTo;
        if (from || to) {
            filter.date = {};
            if (from) filter.date.$gte = new Date(from);
            if (to) filter.date.$lte = new Date(to);
        }

        const bookings = await Booking.find(filter)
            .sort({ date: 1, timeSlot: 1 })
            .populate('contactId', 'name email phone')
            .populate('assignedTo', 'name email');

        res.json({ success: true, data: bookings, count: bookings.length });
    } catch (error) {
        next(error);
    }
};

// @desc    Get a single booking by ID
// @route   GET /api/bookings/:id
// @access  Private
exports.getBookingById = async (req, res, next) => {
    try {
        const booking = await Booking.findOne({
            _id: req.params.id,
            businessId: req.businessId,
        })
            .populate('contactId', 'name email phone source status')
            .populate('assignedTo', 'name email');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        res.json({ success: true, data: booking });
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
        const { fireAutomation, TRIGGERS } = require('../services/automation.service');

        // Check availability first
        const availabilityCheck = await checkSlotAvailability(
            req.businessId,
            date,
            timeSlot,
            duration || 60
        );

        if (!availabilityCheck.available) {
            return res.status(400).json({
                success: false,
                message: availabilityCheck.reason || 'Time slot is not available',
            });
        }

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
            status: 'confirmed',
            confirmedAt: new Date(),
        });

        // Populate contact for response
        await booking.populate('contactId');

        // Get business details
        const business = await Business.findById(req.businessId);

        // Sync with Google Calendar if connected
        if (business?.integrations?.googleCalendar?.connected) {
            try {
                console.log('🔄 Attempting to create Google Calendar event...');
                const eventData = googleCalendarService.createEventDataFromBooking(booking, business);
                console.log('📝 Event data prepared:', JSON.stringify(eventData, null, 2));
                const event = await googleCalendarService.createEvent(req.businessId, eventData);
                booking.googleCalendarEventId = event.id;
                await booking.save();
                console.log('✅ Google Calendar event created successfully:', event.id);
            } catch (error) {
                console.error('❌ Failed to create Google Calendar event:');
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
                console.error('Full error:', error);
                // Don't fail the booking if calendar sync fails
            }
        } else {
            console.log('ℹ️ Google Calendar not connected, skipping sync');
        }

        // Fire BOOKING_CREATED automation (confirmation email)
        if (business && business.isSetupComplete) {
            await fireAutomation(TRIGGERS.BOOKING_CREATED, {
                businessId: req.businessId,
                booking,
                contact,
                business,
            });
        }

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
        }).populate('contactId');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        const oldStatus = booking.status;
        booking.status = status;
        
        if (status === 'confirmed' && oldStatus !== 'confirmed') {
            booking.confirmedAt = new Date();
        }
        
        await booking.save();

        res.json({ success: true, data: booking });
    } catch (error) {
        next(error);
    }
};

// @desc    Update booking details
// @route   PUT /api/bookings/:id
// @access  Private
exports.updateBooking = async (req, res, next) => {
    try {
        const { date, timeSlot, duration, serviceType, location, notes, assignedTo } = req.body;
        
        const booking = await Booking.findOne({
            _id: req.params.id,
            businessId: req.businessId,
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // If date or time is changing, check availability
        if ((date && date !== booking.date.toISOString()) || (timeSlot && timeSlot !== booking.timeSlot)) {
            const checkDate = date || booking.date;
            const checkSlot = timeSlot || booking.timeSlot;
            const checkDuration = duration || booking.duration;

            const availabilityCheck = await checkSlotAvailability(
                req.businessId,
                checkDate,
                checkSlot,
                checkDuration,
                booking._id // Exclude current booking from check
            );

            if (!availabilityCheck.available) {
                return res.status(400).json({
                    success: false,
                    message: availabilityCheck.reason || 'Time slot is not available',
                });
            }
        }

        // Update fields
        if (date) booking.date = date;
        if (timeSlot) booking.timeSlot = timeSlot;
        if (duration) booking.duration = duration;
        if (serviceType) booking.serviceType = serviceType;
        if (location) booking.location = location;
        if (notes !== undefined) booking.notes = notes;
        if (assignedTo !== undefined) booking.assignedTo = assignedTo || null;

        await booking.save();
        await booking.populate('contactId');
        await booking.populate('assignedTo');

        // Update Google Calendar event if connected and event exists
        const business = await Business.findById(req.businessId);
        if (booking.googleCalendarEventId && business?.integrations?.googleCalendar?.connected) {
            try {
                const eventData = googleCalendarService.createEventDataFromBooking(booking, business);
                await googleCalendarService.updateEvent(req.businessId, booking.googleCalendarEventId, eventData);
            } catch (error) {
                console.error('Failed to update Google Calendar event:', error.message);
                // Don't fail the booking update if calendar sync fails
            }
        }

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
        const booking = await Booking.findOne({
            _id: req.params.id,
            businessId: req.businessId,
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Delete Google Calendar event if connected and event exists
        const business = await Business.findById(req.businessId);
        if (booking.googleCalendarEventId && business?.integrations?.googleCalendar?.connected) {
            try {
                await googleCalendarService.deleteEvent(req.businessId, booking.googleCalendarEventId);
            } catch (error) {
                console.error('Failed to delete Google Calendar event:', error.message);
                // Continue with booking deletion even if calendar sync fails
            }
        }

        await booking.deleteOne();

        res.json({ success: true, message: 'Booking deleted' });
    } catch (error) {
        next(error);
    }
};

// @desc    Check availability for a time slot
// @route   POST /api/bookings/check-availability
// @access  Private
exports.checkAvailability = async (req, res, next) => {
    try {
        const { date, timeSlot, duration } = req.body;

        if (!date || !timeSlot) {
            return res.status(400).json({
                success: false,
                message: 'Date and time slot are required',
            });
        }

        const result = await checkSlotAvailability(
            req.businessId,
            date,
            timeSlot,
            duration || 60
        );

        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
};

// @desc    Get available slots for a date
// @route   GET /api/bookings/available-slots
// @access  Private
exports.getAvailableSlotsForDate = async (req, res, next) => {
    try {
        const { date, serviceType, duration } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date is required',
            });
        }

        const result = await getAvailableSlots(
            req.businessId,
            date,
            serviceType,
            duration ? parseInt(duration) : 60
        );

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.json(result);
    } catch (error) {
        next(error);
    }
};

// @desc    Get booking statistics
// @route   GET /api/bookings/stats
// @access  Private
exports.getBookingStatistics = async (req, res, next) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const result = await getBookingStats(req.businessId, start, end);

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.json(result);
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
            .select('name category address workingHours email phone services isSetupComplete');

        if (!business) {
            return res.status(404).json({ success: false, message: 'Business not found' });
        }

        if (!business.isSetupComplete) {
            return res.status(403).json({ success: false, message: 'Business is not accepting bookings yet' });
        }

        res.json({ success: true, data: business });
    } catch (error) {
        next(error);
    }
};

// @desc    Public booking — get available slots for a date
// @route   GET /api/public/book/:slug/available-slots
// @access  Public
exports.getPublicAvailableSlots = async (req, res, next) => {
    try {
        const business = await Business.findOne({ bookingSlug: req.params.slug });
        
        if (!business) {
            return res.status(404).json({ success: false, message: 'Business not found' });
        }

        const { date, serviceType, duration } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date is required',
            });
        }

        const result = await getAvailableSlots(
            business._id,
            date,
            serviceType,
            duration ? parseInt(duration) : 60
        );

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.json(result);
    } catch (error) {
        next(error);
    }
};

// @desc    Public booking — create booking (no auth)
// @route   POST /api/public/book/:slug
// @access  Public
exports.createPublicBooking = async (req, res, next) => {
    try {
        const { fireAutomation, TRIGGERS } = require('../services/automation.service');

        const business = await Business.findOne({ bookingSlug: req.params.slug });
        if (!business) {
            return res.status(404).json({ success: false, message: 'Business not found' });
        }

        if (!business.isSetupComplete) {
            return res.status(403).json({ success: false, message: 'Business is not accepting bookings yet' });
        }

        const { clientName, clientEmail, clientPhone, serviceType, date, timeSlot, duration } = req.body;

        // Validate required fields
        if (!clientName || !clientEmail || !serviceType || !date || !timeSlot) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
            });
        }

        // Check availability
        const availabilityCheck = await checkSlotAvailability(
            business._id,
            date,
            timeSlot,
            duration || 60
        );

        if (!availabilityCheck.available) {
            return res.status(400).json({
                success: false,
                message: availabilityCheck.reason || 'Time slot is not available',
            });
        }

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
        } else {
            contact.status = 'booked';
            await contact.save();
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
            status: 'confirmed',
            confirmedAt: new Date(),
        });

        // Populate contact
        await booking.populate('contactId');

        // Sync with Google Calendar if connected
        if (business?.integrations?.googleCalendar?.connected) {
            try {
                const eventData = googleCalendarService.createEventDataFromBooking(booking, business);
                const event = await googleCalendarService.createEvent(business._id, eventData);
                booking.googleCalendarEventId = event.id;
                await booking.save();
            } catch (error) {
                console.error('Failed to create Google Calendar event:', error.message);
                // Don't fail the booking if calendar sync fails
            }
        }

        // Fire BOOKING_CREATED automation (confirmation email)
        if (business.isSetupComplete) {
            await fireAutomation(TRIGGERS.BOOKING_CREATED, {
                businessId: business._id,
                booking,
                contact,
                business,
            });
        }

        res.status(201).json({ 
            success: true, 
            data: booking, 
            message: 'Booking created successfully! Check your email for confirmation.' 
        });
    } catch (error) {
        next(error);
    }
};
