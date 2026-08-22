import { stripe } from '../config/stripe.js';
import { env } from '../config/env.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import WebhookEvent from '../models/WebhookEvent.js';
import Event from '../models/Event.js';
import { AppError } from '../middleware/errorHandler.js';
import { broadcastSeatUpdate, broadcastBookingUpdated } from '../sockets/seatSocketGateway.js';
import {
  notifyBookingConfirmed,
  notifyPaymentFailed,
} from './notification/notificationService.js';

/**
 * Convert a major-unit LKR amount (e.g. 6500.00) into the minor-unit
 * integer Stripe expects for a two-decimal currency.
 * @param {number} amount
 * @returns {number}
 */
export function toMinorUnits(amount) {
  return Math.round(amount * 100);
}

// Stripe rejects Checkout Sessions whose `expires_at` is under 30 minutes
// out from creation, which is shorter than our seat-hold TTL can be. The
// seat hold itself still expires on schedule — holdReaper proactively calls
// `expireCheckoutSession` at that point — so clamping this to Stripe's floor
// just keeps session creation from failing; it doesn't extend the hold.
const STRIPE_MIN_SESSION_MINUTES = 31;

/**
 * Create a Stripe Checkout Session (embedded Payment Element, ADR-010) for
 * a pending booking's hold.
 * @param {object} params
 * @param {object} params.booking
 * @param {string} [params.customerEmail]
 * @returns {Promise<import('stripe').Stripe.Checkout.Session>}
 */
export async function createCheckoutSession({ booking, customerEmail }) {
  const holdExpiresAtEpoch = Math.floor(new Date(booking.holdExpiresAt).getTime() / 1000);
  const minExpiresAtEpoch = Math.floor(Date.now() / 1000) + STRIPE_MIN_SESSION_MINUTES * 60;

  return stripe.checkout.sessions.create(
    {
      mode: 'payment',
      ui_mode: 'elements',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: env.STRIPE_CURRENCY,
            unit_amount: toMinorUnits(booking.totalPrice),
            product_data: { name: `Encore booking ${booking.reference}` },
          },
          quantity: 1,
        },
      ],
      customer_email: customerEmail,
      return_url: `${env.CLIENT_URL}/confirmation/${booking._id}`,
      expires_at: Math.max(holdExpiresAtEpoch, minExpiresAtEpoch),
      metadata: {
        bookingId: booking._id.toString(),
        reference: booking.reference,
        userId: booking.userRef.toString(),
      },
      // Copy the same metadata onto the resulting PaymentIntent so the
      // payment_intent.* belt-and-braces webhook paths can find the booking.
      payment_intent_data: {
        metadata: {
          bookingId: booking._id.toString(),
          reference: booking.reference,
          userId: booking.userRef.toString(),
        },
      },
    },
    { idempotencyKey: booking.reference }
  );
}

/**
 * Re-issue a client secret for a booking that is still `pending` with a
 * live hold, e.g. after the customer reloads checkout.
 * @param {object} params
 * @param {string} params.bookingId
 * @param {string} params.userId
 * @returns {Promise<{ clientSecret: string, publishableKey: string }>}
 */
export async function createPaymentSessionForBooking({ bookingId, userId }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }

  if (booking.userRef.toString() !== userId.toString()) {
    throw new AppError('Forbidden: you can only pay for your own bookings', 403, 'FORBIDDEN');
  }

  if (booking.status !== 'pending' || !booking.holdExpiresAt || booking.holdExpiresAt < new Date()) {
    throw new AppError('This booking is no longer awaiting payment', 409, 'BOOKING_NOT_PENDING');
  }

  const user = await User.findById(userId);
  const session = await createCheckoutSession({ booking, customerEmail: user?.email });

  booking.payment = {
    ...booking.payment?.toObject?.(),
    provider: 'stripe',
    sessionId: session.id,
    status: session.status,
  };
  await booking.save();

  return { clientSecret: session.client_secret, publishableKey: env.STRIPE_PUBLISHABLE_KEY };
}

/**
 * Reconcile a booking's payment status directly against Stripe instead of
 * waiting on a webhook: retrieves the booking's own Checkout Session by id
 * and, if Stripe reports it paid, runs the same confirmation path
 * `handleCheckoutCompleted` would have run. Safe to call repeatedly —
 * `confirmPendingBooking` only acts while the booking is still `pending`,
 * so the client can poll this in place of a passive status read.
 * @param {object} params
 * @param {string} params.bookingId
 * @param {string} params.userId
 * @param {string} params.role
 * @returns {Promise<object>} the booking, current as of this call
 */
export async function reconcileCheckoutSession({ bookingId, userId, role }) {
  const populateOptions = [
    { path: 'userRef', select: 'name email' },
    { path: 'eventRef', select: 'title artist date venueRef status' },
  ];

  let booking = await Booking.findById(bookingId).populate(populateOptions);
  if (!booking) {
    throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
  }
  if (role !== 'admin' && booking.userRef?._id?.toString() !== userId.toString()) {
    throw new AppError('Forbidden: you can only view your own bookings', 403, 'FORBIDDEN');
  }

  const sessionId = booking.payment?.sessionId;
  if (booking.status === 'pending' && sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] });

    if (session.payment_status === 'paid') {
      const paymentIntentId =
        typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
      await confirmPendingBooking(bookingId, {
        'payment.sessionId': session.id,
        'payment.paymentIntentId': paymentIntentId,
        'payment.amountMinor': session.amount_total,
        'payment.currency': session.currency,
      });
      booking = await Booking.findById(bookingId).populate(populateOptions);
    }
  }

  return booking;
}

/**
 * Expire a live Stripe Checkout Session; a no-op if it is already gone.
 * @param {string} [sessionId]
 */
export async function expireCheckoutSession(sessionId) {
  if (!sessionId) return;
  try {
    await stripe.checkout.sessions.expire(sessionId);
  } catch {
    // Already completed/expired on Stripe's side — nothing to do.
  }
}

/**
 * Refund a captured payment by its PaymentIntent id.
 * @param {string} paymentIntentId
 */
export async function refundPayment(paymentIntentId) {
  return stripe.refunds.create({ payment_intent: paymentIntentId });
}

/**
 * Parse an incoming Stripe webhook payload (ADR-011).
 *
 * No signature verification: this deployment has no STRIPE_WEBHOOK_SECRET,
 * so the payload is trusted as-is rather than checked against Stripe's
 * signature header.
 * @param {Buffer} rawBody
 * @returns {import('stripe').Stripe.Event}
 */
export function verifyWebhookSignature(rawBody) {
  return JSON.parse(rawBody.toString('utf8'));
}

/**
 * Idempotency ledger check (ADR-011): records the Stripe event id and
 * returns `true` the first time it is seen, `false` on a replay.
 * @param {import('stripe').Stripe.Event} stripeEvent
 * @returns {Promise<boolean>}
 */
export async function recordWebhookEvent(stripeEvent) {
  try {
    await WebhookEvent.create({ stripeEventId: stripeEvent.id, type: stripeEvent.type });
    return true;
  } catch (error) {
    if (error.code === 11000) return false;
    throw error;
  }
}

async function releaseHeldSeats(booking, status) {
  const seatIds = booking.seats.map((seat) => seat.id);
  await Event.updateOne(
    { _id: booking.eventRef },
    { $set: { 'seats.$[elem].status': status } },
    { arrayFilters: [{ 'elem.id': { $in: seatIds } }] }
  );
  broadcastSeatUpdate(booking.eventRef.toString(), seatIds, status);
  return seatIds;
}

/**
 * Confirm a `pending` booking (shared by the `checkout.session.completed`
 * and `payment_intent.succeeded` webhook paths): pending → confirmed, seats
 * held → booked. Guarded so whichever event arrives first wins and the
 * other becomes a no-op — never a double-confirmation.
 * @param {string} bookingId
 * @param {object} paymentFields - fields to set under `booking.payment`
 */
async function confirmPendingBooking(bookingId, paymentFields) {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: 'pending' },
    {
      $set: {
        status: 'confirmed',
        'payment.provider': 'stripe',
        'payment.status': 'succeeded',
        ...paymentFields,
      },
      $unset: { holdExpiresAt: '' },
    },
    { returnDocument: 'after' }
  );
  if (!booking) return; // already confirmed/expired — replay or race, nothing to do

  await releaseHeldSeats(booking, 'booked');
  broadcastBookingUpdated(booking.userRef.toString(), { id: booking._id.toString(), status: booking.status });

  const [user, event] = await Promise.all([
    User.findById(booking.userRef),
    Event.findById(booking.eventRef).populate('venueRef', 'name city'),
  ]);
  if (user && event) {
    notifyBookingConfirmed({ user, booking, event, venue: event.venueRef });
  }
}

/**
 * `checkout.session.completed`: pending → confirmed, seats held → booked.
 * @param {object} session - Stripe Checkout Session
 */
export async function handleCheckoutCompleted(session) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;

  await confirmPendingBooking(bookingId, {
    'payment.sessionId': session.id,
    'payment.paymentIntentId': paymentIntentId,
    'payment.amountMinor': session.amount_total,
    'payment.currency': session.currency,
  });
}

/**
 * `payment_intent.succeeded`: belt-and-braces confirmation path in case
 * `checkout.session.completed` doesn't land.
 * @param {object} paymentIntent - Stripe PaymentIntent
 */
export async function handlePaymentIntentSucceeded(paymentIntent) {
  const bookingId = paymentIntent.metadata?.bookingId;
  if (!bookingId) return;

  await confirmPendingBooking(bookingId, {
    'payment.paymentIntentId': paymentIntent.id,
    'payment.amountMinor': paymentIntent.amount,
    'payment.currency': paymentIntent.currency,
  });
}

/**
 * `payment_intent.payment_failed`: the hold stays live so the user can
 * retry; only a notification fires.
 * @param {object} paymentIntent - Stripe PaymentIntent
 */
export async function handlePaymentFailed(paymentIntent) {
  const bookingId = paymentIntent.metadata?.bookingId;
  const booking = bookingId
    ? await Booking.findOne({ _id: bookingId, status: 'pending' })
    : await Booking.findOne({ 'payment.paymentIntentId': paymentIntent.id, status: 'pending' });
  if (!booking) return;

  const user = await User.findById(booking.userRef);
  if (user) {
    notifyPaymentFailed({ user, booking });
  }
}

/**
 * `checkout.session.expired`: pending → expired, seats held → available.
 * @param {object} session - Stripe Checkout Session
 */
export async function handleCheckoutExpired(session) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;

  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: 'pending' },
    { $set: { status: 'expired' }, $unset: { holdExpiresAt: '' } },
    { returnDocument: 'after' }
  );
  if (!booking) return;

  await releaseHeldSeats(booking, 'available');
}

/**
 * `charge.refunded`: record the refund id. No state change — cancellation
 * already moved the booking's status.
 * @param {object} charge - Stripe Charge
 */
export async function handleChargeRefunded(charge) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  await Booking.updateOne({ 'payment.paymentIntentId': paymentIntentId }, { $set: { 'payment.refundId': charge.id } });
}
