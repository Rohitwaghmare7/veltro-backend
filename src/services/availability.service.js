const Booking = require('../models/Booking');
const Business = require('../models/Business');

/**
 * Check if a time slot is available for booking
 * @param {ObjectId} businessId - Business ID
 * @param {Date} date - Booking date
 * @param {String} timeSlot - Time slot (e.g., "10:00 AM")
 * @param {Number} duration - Duration in minutes
 * @param {ObjectId} excludeBookingId - Booking ID to exclude (for updates)
 * @returns {Object} { available: Boolean, reason: String }
 */
const checkSlotAvailability = async (businessId, date, timeSlot, duration = 60, excludeBookingId = null) => {
    try {
        // Parse the time slot
        const bookingDate = new Date(date);
        const [time, period] = timeSlot.split(' ');
        const [hours, minutes] = time.split(':').map(Number);
        
        // Convert to 24-hour format
        let hour24 = hours;
        if (period === 'PM' && hours !== 12) {
            hour24 = hours + 12;
        } else if (period === 'AM' && hours === 12) {
            hour24 = 0;
        }

        bookingDate.setHours(hour24, minutes, 0, 0);
        
        // Calculate end time
        const endTime = new Date(bookingDate.getTime() + duration * 60000);

        // Check for overlapping bookings
        const query = {
            businessId,
            date: {
                $gte: new Date(date).setHours(0, 0, 0, 0),
                $lt: new Date(date).setHours(23, 59, 59, 999),
            },
            status: { $in: ['pending', 'confirmed'] }, // Don't check cancelled/completed
        };

        if (excludeBookingId) {
            query._id = { $ne: excludeBookingId };
        }

        const existingBookings = await Booking.find(query).lean();

        // Check for time conflicts
        for (const booking of existingBookings) {
            const existingStart = new Date(booking.date);
            const [existingTime, existingPeriod] = booking.timeSlot.split(' ');
            const [existingHours, existingMinutes] = existingTime.split(':').map(Number);
            
            let existingHour24 = existingHours;
            if (existingPeriod === 'PM' && existingHours !== 12) {
                existingHour24 = existingHours + 12;
            } else if (existingPeriod === 'AM' && existingHours === 12) {
                existingHour24 = 0;
            }

            existingStart.setHours(existingHour24, existingMinutes, 0, 0);
            const existingEnd = new Date(existingStart.getTime() + (booking.duration || 60) * 60000);

            // Check for overlap
            if (
                (bookingDate >= existingStart && bookingDate < existingEnd) ||
                (endTime > existingStart && endTime <= existingEnd) ||
                (bookingDate <= existingStart && endTime >= existingEnd)
            ) {
                return {
                    available: false,
                    reason: 'Time slot is already booked',
                    conflictingBooking: booking._id,
                };
            }
        }

        return { available: true };
    } catch (error) {
        console.error('Error checking availability:', error);
        return {
            available: false,
            reason: 'Error checking availability',
            error: error.message,
        };
    }
};

/**
 * Get available time slots for a specific date
 * @param {ObjectId} businessId - Business ID
 * @param {Date} date - Date to check
 * @param {String} serviceType - Service type (optional, for service-specific hours)
 * @param {Number} duration - Duration in minutes
 * @returns {Array} Array of available time slots
 */
const getAvailableSlots = async (businessId, date, serviceType = null, duration = 60) => {
    try {
        const business = await Business.findById(businessId).lean();
        if (!business) {
            return { success: false, error: 'Business not found' };
        }

        const requestedDate = new Date(date);
        const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        // Get working hours for this day
        const workingHours = business.workingHours?.find(wh => wh.day === dayOfWeek);
        
        if (!workingHours || !workingHours.isOpen) {
            return { success: true, slots: [], message: 'Business is closed on this day' };
        }

        // Generate time slots based on working hours
        const slots = generateTimeSlots(
            workingHours.start,
            workingHours.end,
            duration
        );

        // Check availability for each slot
        const availableSlots = [];
        for (const slot of slots) {
            const check = await checkSlotAvailability(businessId, date, slot, duration);
            if (check.available) {
                availableSlots.push({
                    time: slot,
                    available: true,
                });
            }
        }

        return { success: true, slots: availableSlots };
    } catch (error) {
        console.error('Error getting available slots:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Generate time slots between start and end time
 * @param {String} startTime - Start time (e.g., "09:00 AM")
 * @param {String} endTime - End time (e.g., "05:00 PM")
 * @param {Number} interval - Interval in minutes
 * @returns {Array} Array of time slots
 */
const generateTimeSlots = (startTime, endTime, interval = 60) => {
    const slots = [];
    
    // Parse start time
    const [startTimeStr, startPeriod] = startTime.split(' ');
    const [startHours, startMinutes] = startTimeStr.split(':').map(Number);
    let startHour24 = startHours;
    if (startPeriod === 'PM' && startHours !== 12) {
        startHour24 = startHours + 12;
    } else if (startPeriod === 'AM' && startHours === 12) {
        startHour24 = 0;
    }

    // Parse end time
    const [endTimeStr, endPeriod] = endTime.split(' ');
    const [endHours, endMinutes] = endTimeStr.split(':').map(Number);
    let endHour24 = endHours;
    if (endPeriod === 'PM' && endHours !== 12) {
        endHour24 = endHours + 12;
    } else if (endPeriod === 'AM' && endHours === 12) {
        endHour24 = 0;
    }

    // Generate slots
    let currentHour = startHour24;
    let currentMinute = startMinutes || 0;

    while (
        currentHour < endHour24 ||
        (currentHour === endHour24 && currentMinute < (endMinutes || 0))
    ) {
        // Format time
        let displayHour = currentHour;
        let period = 'AM';
        
        if (currentHour >= 12) {
            period = 'PM';
            if (currentHour > 12) {
                displayHour = currentHour - 12;
            }
        }
        if (currentHour === 0) {
            displayHour = 12;
        }

        const timeSlot = `${displayHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')} ${period}`;
        slots.push(timeSlot);

        // Add interval
        currentMinute += interval;
        if (currentMinute >= 60) {
            currentHour += Math.floor(currentMinute / 60);
            currentMinute = currentMinute % 60;
        }
    }

    return slots;
};

/**
 * Get booking statistics for a date range
 * @param {ObjectId} businessId - Business ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} Booking statistics
 */
const getBookingStats = async (businessId, startDate, endDate) => {
    try {
        const bookings = await Booking.find({
            businessId,
            date: {
                $gte: startDate,
                $lte: endDate,
            },
        }).lean();

        const stats = {
            total: bookings.length,
            confirmed: bookings.filter(b => b.status === 'confirmed').length,
            pending: bookings.filter(b => b.status === 'pending').length,
            completed: bookings.filter(b => b.status === 'completed').length,
            noShow: bookings.filter(b => b.status === 'no-show').length,
            cancelled: bookings.filter(b => b.status === 'cancelled').length,
            byService: {},
        };

        // Group by service type
        bookings.forEach(booking => {
            if (!stats.byService[booking.serviceType]) {
                stats.byService[booking.serviceType] = 0;
            }
            stats.byService[booking.serviceType]++;
        });

        return { success: true, stats };
    } catch (error) {
        console.error('Error getting booking stats:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    checkSlotAvailability,
    getAvailableSlots,
    generateTimeSlots,
    getBookingStats,
};
