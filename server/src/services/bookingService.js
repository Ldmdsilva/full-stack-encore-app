import Event from '../models/Event.js';
import Booking from '../models/Booking.js';
import { AppError } from '../middleware/errorHandler.js';
import { broadcastSeatUpdate } from '../sockets/seatSocketGateway.js';

/**
 * Generate a unique, human-readable booking reference code (e.g., ENC-4471)
 * @returns {string}
 */
function generateBookingReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomPart = '';
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const timestampPart = Date.now().toString().slice(-4);
  return `ENC-${randomPart}${timestampPart}`;
}

/**
 * Create a new booking with atomic conditional seat locking (ADR-004, FR-15, FR-17)
 * Guarantees zero double-bookings under high concurrency.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.eventId
 * @param {Array<string>} params.seatIds
 * @returns {Promise<object>}
 */
export async function createBooking({ userId, eventId, seatIds }) {
  if (!eventId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
    throw new AppError(
      'eventId and a non-empty array of seatIds are required',
      400,
      'VALIDATION_ERROR'
    );
  }

  // Deduplicate seat IDs to prevent duplicate counts
  const uniqueSeatIds = [...new Set(seatIds.map((id) => String(id).trim()))];

  // 1. Fetch event to verify existence and compute server-authoritative seat prices
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  if (event.status !== 'scheduled') {
    throw new AppError('This event is no longer active for booking', 400, 'EVENT_INACTIVE');
  }

  // Check that all requested seat IDs exist in the event's seat layout
  const eventSeatMap = new Map(event.seats.map((s) => [s.id, s]));
  const missingSeats = uniqueSeatIds.filter((id) => !eventSeatMap.has(id));
  if (missingSeats.length > 0) {
    throw new AppError(
      'One or more requested seats do not exist for this event',
      400,
      'INVALID_SEATS',
      { missingSeats }
    );
  }

  // 2. ATOMIC CONDITIONAL UPDATE (ADR-004)
  // Match event only if ALL requested seats currently have status: 'available'
  const updateResult = await Event.updateOne(
    {
      _id: eventId,
      status: 'scheduled',
      seats: {
        $all: uniqueSeatIds.map((id) => ({
          $elemMatch: { id: id, status: 'available' },
        })),
      },
    },
    {
      $set: {
        'seats.$[elem].status': 'booked',
      },
    },
    {
      arrayFilters: [{ 'elem.id': { $in: uniqueSeatIds } }],
    }
  );

  // If matchedCount is 0, one or more seats were booked concurrently by another request
  if (updateResult.matchedCount === 0 || updateResult.modifiedCount === 0) {
    throw new AppError(
      'One or more selected seats are no longer available.',
      409,
      'SEAT_UNAVAILABLE',
      { seatIds: uniqueSeatIds }
    );
  }

  // 3. Compute total price server-side from stored seat prices (§C6.3)
  const totalPrice = uniqueSeatIds.reduce((sum, id) => {
    const seat = eventSeatMap.get(id);
    return sum + (seat?.price || event.basePrice);
  }, 0);

  // 4. Create the Booking document
  let reference = generateBookingReference();
  let booking;

  try {
    booking = await Booking.create({
      reference,
      userRef: userId,
      eventRef: eventId,
      seats: uniqueSeatIds,
      totalPrice,
      status: 'confirmed',
    });
  } catch (err) {
    // If reference collision occurs (very rare), regenerate reference and retry once
    if (err.code === 11000) {
      reference = `${generateBookingReference()}-${Math.floor(Math.random() * 100)}`;
      booking = await Booking.create({
        reference,
        userRef: userId,
        eventRef: eventId,
        seats: uniqueSeatIds,
        totalPrice,
        status: 'confirmed',
      });
    } else {
      // Rollback seat reservation if booking document creation fails
      await Event.updateOne(
        { _id: eventId },
        { $set: { 'seats.$[elem].status': 'available' } },
        { arrayFilters: [{ 'elem.id': { $in: uniqueSeatIds } }] }
      );
      throw err;
    }
  }

  // 5. Broadcast real-time update to all connected viewers of this event (§C7.2, ADR-003)
  broadcastSeatUpdate(eventId, uniqueSeatIds, 'booked');

  return booking;
}

/**
 * Cancel an existing booking (FR-19)
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.bookingId
 * @param {string} params.role
 * @returns {Promise<object>}
 */
export async function cancelBooking({ userId, bookingId, role }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  // Verify ownership unless admin (FR-19, NFR-3)
  if (role !== 'admin' && booking.userRef.toString() !== userId.toString()) {
    throw new AppError('Forbidden: you can only cancel your own bookings', 403, 'FORBIDDEN');
  }

  if (booking.status === 'cancelled') {
    return booking;
  }

  booking.status = 'cancelled';
  await booking.save();

  // Atomically release booked seats back to 'available'
  await Event.updateOne(
    { _id: booking.eventRef },
    {
      $set: {
        'seats.$[elem].status': 'available',
      },
    },
    {
      arrayFilters: [{ 'elem.id': { $in: booking.seats } }],
    }
  );

  // Broadcast seat release to connected clients
  broadcastSeatUpdate(booking.eventRef.toString(), booking.seats, 'available');

  return booking;
}

/**
 * Get bookings for the authenticated user (FR-18)
 * @param {string} userId
 * @param {object} queryParams
 * @returns {Promise<{ bookings: Array, total: number, page: number, totalPages: number }>}
 */
export async function getUserBookings(userId, queryParams = {}) {
  const { page = 1, limit = 10 } = queryParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [bookings, total] = await Promise.all([
    Booking.find({ userRef: userId })
      .populate('eventRef', 'title artist date venueRef status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Booking.countDocuments({ userRef: userId }),
  ]);

  return {
    bookings,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  };
}

/**
 * Get all bookings across events for Admin (FR-24, FR-25)
 * @param {object} queryParams
 * @returns {Promise<{ bookings: Array, total: number, page: number, totalPages: number }>}
 */
export async function getAllBookings(queryParams = {}) {
  const { eventId, page = 1, limit = 20 } = queryParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};
  if (eventId) {
    filter.eventRef = eventId;
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('userRef', 'name email')
      .populate('eventRef', 'title artist date venueRef status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    Booking.countDocuments(filter),
  ]);

  return {
    bookings,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  };
}
