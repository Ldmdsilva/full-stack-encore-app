import Event from '../models/Event.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import { broadcastSeatUpdate } from '../sockets/seatSocketGateway.js';
import { reapExpiredHolds } from '../jobs/holdReaper.js';
import { createCheckoutSession, refundPayment } from './paymentService.js';
import { notifyBookingCancelled } from './notification/notificationService.js';
import { env } from '../config/env.js';

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
 * Roll a set of seats back to 'available' (used when a downstream step
 * after the atomic hold fails).
 * @param {string} eventId
 * @param {Array<string>} seatIds
 */
async function rollbackSeatsToAvailable(eventId, seatIds) {
  await Event.updateOne(
    { _id: eventId },
    { $set: { 'seats.$[elem].status': 'available' } },
    { arrayFilters: [{ 'elem.id': { $in: seatIds } }] }
  );
}

/**
 * Create a new booking with atomic conditional seat locking (ADR-004, ADR-009, FR-15, FR-17)
 * Guarantees zero double-bookings under high concurrency. Seats move
 * available → held, the booking is created `pending` with a TTL hold, and a
 * Stripe Checkout Session is opened for the client to pay against. The
 * Stripe webhook (paymentService.handleCheckoutCompleted) is the
 * authoritative confirmation (ADR-011) — this function never marks a
 * booking `confirmed`.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.customerEmail]
 * @param {string} params.eventId
 * @param {Array<string>} params.seatIds
 * @returns {Promise<{ booking: object, clientSecret: string }>}
 */
export async function createBooking({ userId, customerEmail, eventId, seatIds }) {
  if (!eventId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
    throw new AppError(
      'eventId and a non-empty array of seatIds are required',
      400,
      'VALIDATION_ERROR'
    );
  }

  // Deduplicate seat IDs to prevent duplicate counts
  const uniqueSeatIds = [...new Set(seatIds.map((id) => String(id).trim()))];

  // 1. Reap any expired holds on this event first, so a stale hold never
  // blocks a legitimate booking.
  await reapExpiredHolds(eventId);

  // Fetch event to verify existence and compute server-authoritative seat prices
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

  // 2. ATOMIC CONDITIONAL UPDATE (ADR-004): available → held
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
        'seats.$[elem].status': 'held',
      },
    },
    {
      arrayFilters: [{ 'elem.id': { $in: uniqueSeatIds } }],
    }
  );

  // If matchedCount is 0, one or more seats were held/booked concurrently by another request
  if (updateResult.matchedCount === 0 || updateResult.modifiedCount === 0) {
    throw new AppError(
      'One or more selected seats are no longer available.',
      409,
      'SEAT_UNAVAILABLE',
      { seatIds: uniqueSeatIds }
    );
  }

  // 3. Compute total price server-side from stored seat prices (§C6.3) — never trust the client
  const seatSnapshots = uniqueSeatIds.map((id) => {
    const seat = eventSeatMap.get(id);
    return {
      id: seat.id,
      section: seat.section,
      row: seat.row,
      number: seat.number,
      price: seat.price ?? event.basePrice,
    };
  });
  const totalPrice = seatSnapshots.reduce((sum, seat) => sum + seat.price, 0);
  const holdExpiresAt = new Date(Date.now() + env.HOLD_TTL_MINUTES * 60 * 1000);

  // 4. Create the pending Booking document
  let reference = generateBookingReference();
  let booking;

  try {
    booking = await Booking.create({
      reference,
      userRef: userId,
      eventRef: eventId,
      seats: seatSnapshots,
      totalPrice,
      status: 'pending',
      holdExpiresAt,
    });
  } catch (err) {
    // If reference collision occurs (very rare), regenerate reference and retry once
    if (err.code === 11000) {
      reference = `${generateBookingReference()}-${Math.floor(Math.random() * 100)}`;
      booking = await Booking.create({
        reference,
        userRef: userId,
        eventRef: eventId,
        seats: seatSnapshots,
        totalPrice,
        status: 'pending',
        holdExpiresAt,
      });
    } else {
      // Rollback seat reservation if booking document creation fails
      await rollbackSeatsToAvailable(eventId, uniqueSeatIds);
      throw err;
    }
  }

  // 5. Open a Stripe Checkout Session for this hold
  let session;
  try {
    session = await createCheckoutSession({ booking, customerEmail });
  } catch (err) {
    // 6. Roll back on Stripe failure — release the hold and drop the booking
    await rollbackSeatsToAvailable(eventId, uniqueSeatIds);
    await Booking.deleteOne({ _id: booking._id });
    throw err;
  }

  booking.payment = {
    provider: 'stripe',
    sessionId: session.id,
    status: session.status,
    amountMinor: session.amount_total,
    currency: env.STRIPE_CURRENCY,
  };
  await booking.save();

  // 7. Broadcast real-time update to all connected viewers of this event (§C7.2, ADR-003)
  broadcastSeatUpdate(eventId, uniqueSeatIds, 'held');

  return { booking, clientSecret: session.client_secret };
}

/**
 * Cancel an existing booking (FR-19, FR-29). A confirmed booking is
 * refunded via Stripe *before* its status flips, so a refund failure
 * cannot leave a "cancelled but unrefunded" booking. Held or booked seats
 * are released back to 'available' either way.
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

  if (!['pending', 'confirmed'].includes(booking.status)) {
    throw new AppError('This booking can no longer be cancelled', 400, 'BOOKING_NOT_CANCELLABLE');
  }

  const event = await Event.findById(booking.eventRef);
  if (event && event.date <= new Date()) {
    throw new AppError('This event has already started and can no longer be cancelled', 400, 'EVENT_STARTED');
  }

  const wasConfirmed = booking.status === 'confirmed';
  let refunded = false;

  if (wasConfirmed && booking.payment?.paymentIntentId) {
    const refund = await refundPayment(booking.payment.paymentIntentId);
    booking.payment.refundId = refund.id;
    refunded = true;
  }

  booking.status = 'cancelled';
  booking.holdExpiresAt = undefined;
  await booking.save();

  const seatIds = booking.seats.map((seat) => seat.id);

  // Atomically release held/booked seats back to 'available'
  await Event.updateOne(
    { _id: booking.eventRef },
    {
      $set: {
        'seats.$[elem].status': 'available',
      },
    },
    {
      arrayFilters: [{ 'elem.id': { $in: seatIds } }],
    }
  );

  // Broadcast seat release to connected clients
  broadcastSeatUpdate(booking.eventRef.toString(), seatIds, 'available');

  if (wasConfirmed) {
    const user = await User.findById(booking.userRef);
    if (user) {
      notifyBookingCancelled({ user, booking, refunded });
    }
  }

  return booking;
}

/**
 * Get a single booking by id, scoped to its owner unless the caller is an admin.
 * @param {object} params
 * @param {string} params.bookingId
 * @param {string} params.userId
 * @param {string} params.role
 * @returns {Promise<object>}
 */
export async function getBookingById({ bookingId, userId, role }) {
  const booking = await Booking.findById(bookingId)
    .populate('userRef', 'name email')
    .populate('eventRef', 'title artist date venueRef status');

  if (!booking) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  if (role !== 'admin' && booking.userRef?._id?.toString() !== userId.toString()) {
    throw new AppError('Forbidden: you can only view your own bookings', 403, 'FORBIDDEN');
  }

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
