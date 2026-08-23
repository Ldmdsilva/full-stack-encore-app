import Booking from '../models/Booking.js';
import Event from '../models/Event.js';
import { broadcastSeatUpdate } from '../sockets/seatSocketGateway.js';
import { expireCheckoutSession } from '../services/paymentService.js';
import { logger } from '../config/logger.js';

const REAP_INTERVAL_MS = 60 * 1000;
let intervalHandle = null;

/**
 * Release one expired pending booking: seats held → available, booking →
 * expired, and its Stripe session (if any) expired. Guarded by a
 * conditional update so a webhook confirming the booking concurrently
 * can't be undone by the reaper.
 * @param {object} booking
 */
async function releaseHold(booking) {
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'pending' },
    { $set: { status: 'expired' }, $unset: { holdExpiresAt: '' } },
    { returnDocument: 'after' }
  );
  if (!updated) return; // confirmed/cancelled concurrently — nothing to release

  const seatIds = booking.seats.map((seat) => seat.id);
  await Event.updateOne(
    { _id: booking.eventRef },
    { $set: { 'seats.$[elem].status': 'available' } },
    { arrayFilters: [{ 'elem.id': { $in: seatIds }, 'elem.status': 'held' }] }
  );

  await expireCheckoutSession(booking.payment?.sessionId);
  broadcastSeatUpdate(booking.eventRef.toString(), seatIds, 'available');
}

/**
 * Release every expired hold, optionally scoped to a single event.
 * Exported as a plain function so it is directly unit-testable without
 * timers, and so `bookingService.createBooking` can reap a single event's
 * stale holds before attempting a new one.
 * @param {string} [eventId]
 * @returns {Promise<number>} number of holds released
 */
export async function reapExpiredHolds(eventId) {
  const filter = { status: 'pending', holdExpiresAt: { $lt: new Date() } };
  if (eventId) filter.eventRef = eventId;

  const expiredBookings = await Booking.find(filter);
  for (const booking of expiredBookings) {
    await releaseHold(booking);
  }
  return expiredBookings.length;
}

/**
 * Start the background sweep that releases expired holds every 60s.
 * @returns {NodeJS.Timeout}
 */
export function startHoldReaper() {
  if (intervalHandle) return intervalHandle;
  intervalHandle = setInterval(() => {
    reapExpiredHolds().catch((error) => logger.error({ err: error }, '[HoldReaper] Sweep failed'));
  }, REAP_INTERVAL_MS);
  return intervalHandle;
}

/**
 * Stop the background sweep (graceful shutdown).
 */
export function stopHoldReaper() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
