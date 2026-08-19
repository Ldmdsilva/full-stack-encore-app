import { describe, it, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import { createStripeMock, mockStripeModule, createNodemailerMock, mockNodemailerModule } from '../helpers/mocks.js';
import Event from '../../src/models/Event.js';
import Venue from '../../src/models/Venue.js';
import Booking from '../../src/models/Booking.js';
import User from '../../src/models/User.js';

const VALID_SIG = 'valid_test_signature';
const originalFetch = global.fetch;

// Stripe and nodemailer must both be mocked before app.js is dynamically
// imported below — app.js -> paymentRoutes -> paymentController ->
// paymentService -> stripe, and paymentService -> notificationService ->
// emailService -> nodemailer. SMS_ENABLED also defaults true, so global
// fetch (notify.lk) is stubbed in beforeEach to avoid a real network call.
const stripeMock = createStripeMock();
stripeMock.webhooks.constructEvent.mockImplementation((rawBody, signature) => {
  if (signature !== VALID_SIG) {
    throw new Error('Invalid Stripe signature');
  }
  return JSON.parse(rawBody.toString('utf8'));
});
mockStripeModule(stripeMock);

const { sendMailMock, nodemailerMock } = createNodemailerMock();
mockNodemailerModule(nodemailerMock);

let app;
let bookingService;

function webhookRequest(payload, signature = VALID_SIG) {
  // Send the JSON as a plain string, not a Buffer: superagent JSON.stringifies
  // any non-string body when the content-type is application/json, which
  // would double-encode a Buffer into `{"type":"Buffer","data":[...]}` and
  // corrupt the payload before it ever reaches express.raw() server-side.
  return request(app)
    .post('/api/payments/webhook')
    .set('stripe-signature', signature)
    .type('application/json')
    .send(JSON.stringify(payload));
}

async function seedPendingBooking(overrides = {}) {
  const venue = await Venue.create({
    name: 'Webhook Hall',
    address: '1 Webhook Ave',
    city: 'Colombo',
    seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
    capacity: 1,
  });
  const event = await Event.create({
    title: 'Webhook Test Event',
    artist: 'Test Artist',
    genre: 'Rock',
    date: new Date(Date.now() + 86400000 * 3),
    basePrice: 50,
    venueRef: venue._id,
    seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 50 }],
    status: 'scheduled',
  });
  const user = await User.create({
    name: 'Webhook User',
    email: 'webhook@test.com',
    passwordHash: 'hash',
    phone: '94771234567',
    role: 'customer',
  });

  const { booking } = await bookingService.createBooking({
    userId: user._id.toString(),
    customerEmail: user.email,
    eventId: event._id.toString(),
    seatIds: ['A-1'],
    ...overrides,
  });

  return { venue, event, user, booking };
}

describe('POST /api/payments/webhook (Phase 2.2, ADR-011)', () => {
  beforeAll(async () => {
    await connectTestDB();
    app = (await import('../../src/app.js')).default;
    bookingService = await import('../../src/services/bookingService.js');
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    jest.clearAllMocks();
    stripeMock.checkout.sessions.create.mockImplementation(async () => ({
      id: 'cs_test_webhook',
      client_secret: 'secret_webhook',
      status: 'open',
      amount_total: 5000,
      currency: 'lkr',
    }));
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', data: 'Sent' }),
    }));
  });

  it('checkout.session.completed with a valid signature confirms the booking: seats held -> booked, status pending -> confirmed', async () => {
    const { event, booking } = await seedPendingBooking();

    const stripeEvent = {
      id: 'evt_checkout_completed_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: booking.payment.sessionId,
          payment_intent: 'pi_test_1',
          amount_total: booking.totalPrice * 100,
          currency: 'lkr',
          metadata: {
            bookingId: booking._id.toString(),
            reference: booking.reference,
            userId: booking.userRef.toString(),
          },
        },
      },
    };

    const res = await webhookRequest(stripeEvent);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    const updatedBooking = await Booking.findById(booking._id);
    expect(updatedBooking.status).toBe('confirmed');
    expect(updatedBooking.payment.paymentIntentId).toBe('pi_test_1');
    expect(updatedBooking.holdExpiresAt).toBeUndefined();

    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent.seats.find((s) => s.id === 'A-1').status).toBe('booked');

    // One confirmation email fired as a side effect of the confirmation.
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it('a replayed event (same stripeEventId) is a no-op: still 200, booking status unchanged, no double email', async () => {
    const { booking } = await seedPendingBooking();
    const stripeEvent = {
      id: 'evt_replay_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: booking.payment.sessionId,
          payment_intent: 'pi_test_2',
          amount_total: booking.totalPrice * 100,
          currency: 'lkr',
          metadata: {
            bookingId: booking._id.toString(),
            reference: booking.reference,
            userId: booking.userRef.toString(),
          },
        },
      },
    };

    const first = await webhookRequest(stripeEvent);
    expect(first.status).toBe(200);

    const afterFirst = await Booking.findById(booking._id);
    expect(afterFirst.status).toBe('confirmed');
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    // Replay: identical event id — the WebhookEvent idempotency ledger
    // short-circuits before the handler runs again.
    const replay = await webhookRequest(stripeEvent);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual({ received: true });

    const afterReplay = await Booking.findById(booking._id);
    expect(afterReplay.status).toBe('confirmed');
    expect(afterReplay.payment.paymentIntentId).toBe('pi_test_2');

    // No second confirmation email was sent for the replay.
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it('a bad Stripe signature is rejected with 400 INVALID_SIGNATURE', async () => {
    const res = await webhookRequest(
      { id: 'evt_bad', type: 'checkout.session.completed', data: { object: {} } },
      'not_the_real_signature'
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('payment_intent.payment_failed leaves the booking pending and never confirms it', async () => {
    const { booking } = await seedPendingBooking();
    const stripeEvent = {
      id: 'evt_payment_failed_1',
      type: 'payment_intent.payment_failed',
      data: {
        object: { id: 'pi_fail_1', metadata: { bookingId: booking._id.toString() } },
      },
    };

    const res = await webhookRequest(stripeEvent);
    expect(res.status).toBe(200);

    const updated = await Booking.findById(booking._id);
    expect(updated.status).toBe('pending');
    expect(updated.holdExpiresAt).toBeTruthy();
  });

  it('checkout.session.expired releases the held seats and marks the booking expired', async () => {
    const { event, booking } = await seedPendingBooking();
    const stripeEvent = {
      id: 'evt_checkout_expired_1',
      type: 'checkout.session.expired',
      data: {
        object: { id: booking.payment.sessionId, metadata: { bookingId: booking._id.toString() } },
      },
    };

    const res = await webhookRequest(stripeEvent);
    expect(res.status).toBe(200);

    const updated = await Booking.findById(booking._id);
    expect(updated.status).toBe('expired');
    expect(updated.holdExpiresAt).toBeUndefined();

    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent.seats.find((s) => s.id === 'A-1').status).toBe('available');
  });
});
