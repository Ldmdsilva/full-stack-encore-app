import Event from '../models/Event.js';
import Venue from '../models/Venue.js';
import Booking from '../models/Booking.js';
import { AppError } from '../middleware/errorHandler.js';
import { broadcastEventCancelled } from '../sockets/seatSocketGateway.js';
import { refundPayment } from './paymentService.js';
import { notifyEventCancelled } from './notification/notificationService.js';
import { logger } from '../config/logger.js';

/**
 * Retrieve upcoming events with pagination and filtering (FR-7, FR-9)
 * @param {object} queryParams
 * @returns {Promise<{ events: Array, total: number, page: number, totalPages: number }>}
 */
export async function getEvents(queryParams = {}) {
  const {
    page = 1,
    limit = 10,
    artist,
    genre,
    from,
    to,
    venue,
  } = queryParams;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const filter = {
    status: 'scheduled',
  };

  // Date filtering: defaults to today and future (FR-7)
  const fromDate = from ? new Date(from) : new Date();
  if (isNaN(fromDate.getTime())) {
    throw new AppError('Invalid from date parameter', 400, 'INVALID_FILTER');
  }

  filter.date = { $gte: fromDate };

  if (to) {
    const toDate = new Date(to);
    if (isNaN(toDate.getTime())) {
      throw new AppError('Invalid to date parameter', 400, 'INVALID_FILTER');
    }
    filter.date.$lte = toDate;
  }

  // Artist search filter (FR-9)
  if (artist) {
    filter.artist = { $regex: artist.trim(), $options: 'i' };
  }

  // Genre filter
  if (genre) {
    filter.genre = genre.trim();
  }

  // Venue filter
  if (venue) {
    filter.venueRef = venue;
  }

  const [events, total] = await Promise.all([
    Event.find(filter)
      .populate('venueRef', 'name address city capacity')
      .sort({ date: 1 })
      .skip(skip)
      .limit(limitNum),
    Event.countDocuments(filter),
  ]);

  return {
    events,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  };
}

/**
 * Retrieve a single event with full seat map (FR-8, FR-13)
 * @param {string} id
 * @returns {Promise<{ event: object, seats: Array }>}
 */
export async function getEventById(id) {
  const event = await Event.findById(id).populate('venueRef', 'name address city capacity');
  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  return { event, seats: event.seats };
}

/**
 * Create a new event and inherit seat layout from venue (FR-10, FR-23)
 * @param {object} eventData
 * @returns {Promise<object>}
 */
export async function createEvent({ title, artist, genre, imageUrl, description, date, basePrice, venueRef }) {
  if (!title || !artist || !genre || !date || basePrice === undefined || !venueRef) {
    throw new AppError(
      'Title, artist, genre, date, basePrice, and venueRef are required',
      400,
      'VALIDATION_ERROR'
    );
  }

  const eventDate = new Date(date);
  if (isNaN(eventDate.getTime())) {
    throw new AppError('Invalid date format', 400, 'VALIDATION_ERROR');
  }

  if (eventDate <= new Date()) {
    throw new AppError('Event date must be in the future', 400, 'VALIDATION_ERROR', {
      field: 'date',
    });
  }

  const venue = await Venue.findById(venueRef);
  if (!venue) {
    throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
  }

  // Derive seat map from venue seatLayout (FR-10, FR-23)
  const seats = venue.seatLayout.map((seat) => ({
    id: seat.id,
    section: seat.section,
    row: seat.row,
    number: seat.number,
    status: 'available',
    price: Number(basePrice),
  }));

  const event = await Event.create({
    title: title.trim(),
    artist: artist.trim(),
    genre: genre.trim(),
    imageUrl: imageUrl?.trim(),
    description: description?.trim(),
    date: eventDate,
    basePrice: Number(basePrice),
    venueRef: venue._id,
    seats,
    status: 'scheduled',
  });

  return Event.findById(event._id).populate('venueRef', 'name address city capacity');
}

/**
 * Update an existing event (FR-11)
 * @param {string} id
 * @param {object} updateData
 * @returns {Promise<object>}
 */
export async function updateEvent(id, updateData) {
  // Prevent arbitrary alteration of seat array through generic update
  const safeUpdates = { ...updateData };
  delete safeUpdates.seats;

  if (safeUpdates.date) {
    const eventDate = new Date(safeUpdates.date);
    if (isNaN(eventDate.getTime())) {
      throw new AppError('Invalid date format', 400, 'VALIDATION_ERROR');
    }
    safeUpdates.date = eventDate;
  }

  const event = await Event.findByIdAndUpdate(id, safeUpdates, {
    returnDocument: 'after',
    runValidators: true,
  }).populate('venueRef', 'name address city capacity');

  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  return event;
}

/**
 * Cancel an event and broadcast update (FR-12, §C7.2)
 * @param {string} id
 */
export async function deleteEvent(id) {
  const event = await Event.findById(id).populate('venueRef', 'name city');
  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  // Refund every confirmed booking, then notify its customer (FR-29)
  const confirmedBookings = await Booking.find({ eventRef: id, status: 'confirmed' }).populate('userRef');

  for (const booking of confirmedBookings) {
    if (booking.payment?.paymentIntentId) {
      try {
        const refund = await refundPayment(booking.payment.paymentIntentId);
        booking.payment.refundId = refund.id;
      } catch (error) {
        logger.error({ err: error, reference: booking.reference }, '[EventService] Refund failed during event cancellation');
      }
    }
    booking.status = 'cancelled';
    await booking.save();

    if (booking.userRef) {
      notifyEventCancelled({ user: booking.userRef, booking, event });
    }
  }

  // Cancel any remaining pending (unpaid, held) bookings without a refund
  await Booking.updateMany(
    { eventRef: id, status: 'pending' },
    { $set: { status: 'cancelled' }, $unset: { holdExpiresAt: '' } }
  );

  // Mark event as cancelled
  event.status = 'cancelled';
  await event.save();

  // Broadcast cancellation via WebSocket
  broadcastEventCancelled(id);
}
