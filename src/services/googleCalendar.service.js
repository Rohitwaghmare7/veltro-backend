const { google } = require('googleapis');
const Business = require('../models/Business');

/**
 * Get authenticated Google Calendar client for a business
 */
async function getCalendarClient(businessId) {
    const business = await Business.findById(businessId);
    
    if (!business?.integrations?.googleCalendar?.connected) {
        throw new Error('Google Calendar not connected');
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
        access_token: business.integrations.googleCalendar.accessToken,
        refresh_token: business.integrations.googleCalendar.refreshToken,
        expiry_date: business.integrations.googleCalendar.expiryDate
    });

    // Auto-refresh tokens when they expire
    oauth2Client.on('tokens', async (tokens) => {
        console.log('🔄 Refreshing Google Calendar tokens...');
        if (tokens.refresh_token) {
            business.integrations.googleCalendar.refreshToken = tokens.refresh_token;
        }
        business.integrations.googleCalendar.accessToken = tokens.access_token;
        business.integrations.googleCalendar.expiryDate = tokens.expiry_date;
        await business.save();
        console.log('✅ Google Calendar tokens refreshed');
    });

    return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Create a Google Calendar event for a booking
 */
async function createEvent(businessId, eventData) {
    try {
        console.log('📅 Creating Google Calendar event for business:', businessId);
        const calendar = await getCalendarClient(businessId);
        console.log('✅ Calendar client obtained');
        
        const event = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: eventData,
            sendUpdates: 'all' // Send email to attendees
        });

        console.log('✅ Google Calendar event created:', event.data.id);
        return event.data;
    } catch (error) {
        console.error('❌ Failed to create Google Calendar event:');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', JSON.stringify(error.errors || error.response?.data, null, 2));
        throw error;
    }
}

/**
 * Update a Google Calendar event
 */
async function updateEvent(businessId, eventId, eventData) {
    try {
        const calendar = await getCalendarClient(businessId);
        
        const event = await calendar.events.update({
            calendarId: 'primary',
            eventId: eventId,
            requestBody: eventData,
            sendUpdates: 'all' // Notify attendees of changes
        });

        console.log('✅ Google Calendar event updated:', eventId);
        return event.data;
    } catch (error) {
        console.error('❌ Failed to update Google Calendar event:', error.message);
        throw error;
    }
}

/**
 * Delete a Google Calendar event
 */
async function deleteEvent(businessId, eventId) {
    try {
        const calendar = await getCalendarClient(businessId);
        
        await calendar.events.delete({
            calendarId: 'primary',
            eventId: eventId,
            sendUpdates: 'all' // Notify attendees of cancellation
        });

        console.log('✅ Google Calendar event deleted:', eventId);
    } catch (error) {
        console.error('❌ Failed to delete Google Calendar event:', error.message);
        throw error;
    }
}

/**
 * Helper to calculate end time based on duration
 */
function calculateEndTime(startDateTime, durationMinutes = 60) {
    const start = new Date(startDateTime);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    return end.toISOString();
}

/**
 * Create event data from booking
 */
function createEventDataFromBooking(booking, business) {
    // Handle both field naming conventions (client* and customer*)
    const customerName = booking.customerName || booking.clientName;
    const customerEmail = booking.customerEmail || booking.clientEmail;
    const customerPhone = booking.customerPhone || booking.clientPhone;
    
    // Parse date and time properly
    // booking.date is a Date object or ISO string like "2026-02-13T00:00:00.000Z"
    // booking.timeSlot is a string like "03:00 PM" or "15:00"
    const bookingDate = new Date(booking.date);
    const year = bookingDate.getFullYear();
    const month = String(bookingDate.getMonth() + 1).padStart(2, '0');
    const day = String(bookingDate.getDate()).padStart(2, '0');
    
    // Parse time slot (handle both "03:00 PM" and "15:00" formats)
    let hours, minutes;
    const timeSlot = booking.timeSlot.trim();
    
    if (timeSlot.includes('AM') || timeSlot.includes('PM')) {
        // 12-hour format: "03:00 PM"
        const [time, period] = timeSlot.split(' ');
        const [h, m] = time.split(':');
        hours = parseInt(h);
        minutes = parseInt(m);
        
        if (period === 'PM' && hours !== 12) {
            hours += 12;
        } else if (period === 'AM' && hours === 12) {
            hours = 0;
        }
    } else {
        // 24-hour format: "15:00"
        const [h, m] = timeSlot.split(':');
        hours = parseInt(h);
        minutes = parseInt(m);
    }
    
    // Create ISO datetime strings
    const startDateTime = `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    const endDateTime = calculateEndTime(startDateTime, booking.duration || 60);

    return {
        summary: `${booking.serviceType} - ${customerName}`,
        description: `Booking #${booking._id}\n\nCustomer: ${customerName}\nEmail: ${customerEmail}\nPhone: ${customerPhone || 'N/A'}\n\nService: ${booking.serviceType}\nDuration: ${booking.duration || 60} minutes`,
        start: {
            dateTime: startDateTime,
            timeZone: business.timezone || 'UTC'
        },
        end: {
            dateTime: endDateTime,
            timeZone: business.timezone || 'UTC'
        },
        attendees: customerEmail ? [
            { email: customerEmail }
        ] : [],
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 24 * 60 }, // 1 day before
                { method: 'popup', minutes: 60 } // 1 hour before
            ]
        },
        colorId: '9' // Blue color for bookings
    };
}

module.exports = {
    getCalendarClient,
    createEvent,
    updateEvent,
    deleteEvent,
    calculateEndTime,
    createEventDataFromBooking
};
