import Event from '../models/Event.js';
import Venue from '../models/Venue.js';
import Booking from '../models/Booking.js';
import { AppError } from '../middleware/errorHandler.js';
import { broadcastEventCancelled } from '../sockets/seatSocketGateway.js';

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

  // Venue filter
  if (venue) {
    filter.venueRef = venue;
  }

  // Project events without the full seats array for faster listing response
  const [events, total] = await Promise.all([
    Event.find(filter)
      .select('-seats')
      .populate('venueRef', 'name address capacity')
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
  const event = await Event.findById(id).populate('venueRef', 'name address capacity');
  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  return {
    event: {
      _id: event._id,
      title: event.title,
      artist: event.artist,
      date: event.date,
      basePrice: event.basePrice,
      venueRef: event.venueRef,
      status: event.status,
    },
    seats: event.seats,
  };
}

/**
 * Create a new event and inherit seat layout from venue (FR-10, FR-23)
 * @param {object} eventData
 * @returns {Promise<object>}
 */
export async function createEvent({ title, artist, date, basePrice, venueRef }) {
  if (!title || !artist || !date || basePrice === undefined || !venueRef) {
    throw new AppError(
      'Title, artist, date, basePrice, and venueRef are required',
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
    date: eventDate,
    basePrice: Number(basePrice),
    venueRef: venue._id,
    seats,
    status: 'scheduled',
  });

  return event;
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
  }).populate('venueRef', 'name address capacity');

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
  const event = await Event.findById(id);
  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  // Mark event as cancelled
  event.status = 'cancelled';
  await event.save();

  // Mark associated bookings as cancelled
  await Booking.updateMany({ eventRef: id }, { status: 'cancelled' });

  // Broadcast cancellation via WebSocket
  broadcastEventCancelled(id);
}
