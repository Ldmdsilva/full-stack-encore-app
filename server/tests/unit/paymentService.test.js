import { describe, it, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import { createStripeMock, mockStripeModule } from '../helpers/mocks.js';
import Event from '../../src/models/Event.js';
import Venue from '../../src/models/Venue.js';
import Booking from '../../src/models/Booking.js';
import User from '../../src/models/User.js';
import WebhookEvent from '../../src/models/WebhookEvent.js';

// Stripe must be mocked before the dynamic import of paymentService.js (and
// bookingService.js, which calls into it) below.
const stripeMock = createStripeMock();
mockStripeModule(stripeMock);

let paymentService;
let bookingService;

describe('services/paymentService.js (Phase 2, ADR-010, ADR-011)', () => {
  beforeAll(async () => {
    await connectTestDB();
    paymentService = await import('../../src/services/paymentService.js');
    bookingService = await import('../../src/services/bookingService.js');
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    jest.clearAllMocks();
    // Restore the default (fast, always-resolving) implementations after any
    // per-test override via mockRejectedValueOnce/mockResolvedValueOnce.
    stripeMock.checkout.sessions.create.mockImplementation(async () => ({
      id: 'cs_test_mock_session',
      client_secret: 'secret_mock_client_secret',
      status: 'open',
      amount_total: 0,
      currency: 'lkr',
    }));
  });

  describe('toMinorUnits', () => {
    it('converts a major-unit LKR amount to the integer minor-unit form Stripe expects', () => {
      expect(paymentService.toMinorUnits(6500)).toBe(650000);
      expect(paymentService.toMinorUnits(0)).toBe(0);
      expect(paymentService.toMinorUnits(99.5)).toBe(9950);
    });

    it('rounds fractional minor units rather than truncating or throwing', () => {
      expect(paymentService.toMinorUnits(10.005)).toBe(1001); // 1000.5 -> rounds to 1001
    });
  });

  describe('createCheckoutSession', () => {
    it('creates a session in the configured currency with an idempotency key equal to the booking reference', async () => {
      const booking = {
        _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        reference: 'ENC-TEST01',
        totalPrice: 6500,
        holdExpiresAt: new Date(Date.now() + 600000),
        userRef: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      };

      await paymentService.createCheckoutSession({ booking, customerEmail: 'fan@example.com' });

      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
      const [payload, options] = stripeMock.checkout.sessions.create.mock.calls[0];

      expect(payload.line_items[0].price_data.currency).toBe('lkr');
      expect(payload.line_items[0].price_data.unit_amount).toBe(650000); // 6500 * 100
      expect(payload.customer_email).toBe('fan@example.com');
      expect(payload.metadata).toMatchObject({ bookingId: booking._id, reference: booking.reference });
      expect(options).toEqual({ idempotencyKey: 'ENC-TEST01' });
    });
  });

  describe('createPaymentSessionForBooking', () => {
    it('re-issues a client secret for a still-pending booking with a live hold', async () => {
      const venue = await Venue.create({
        name: 'Resume Hall',
        address: '1 Resume Ave',
        city: 'Colombo',
        seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
        capacity: 1,
      });
      const event = await Event.create({
        title: 'Resume Event',
        artist: 'Test Artist',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'held', price: 50 }],
        status: 'scheduled',
      });
      const user = await User.create({
        name: 'Resume User',
        email: 'resume@test.com',
        passwordHash: 'hash',
        phone: '94771234567',
        role: 'customer',
      });
      const booking = await Booking.create({
        reference: 'ENC-RESUME1',
        userRef: user._id,
        eventRef: event._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
        totalPrice: 50,
        status: 'pending',
        holdExpiresAt: new Date(Date.now() + 600000),
      });

      const result = await paymentService.createPaymentSessionForBooking({
        bookingId: booking._id.toString(),
        userId: user._id.toString(),
      });

      expect(result.clientSecret).toBe('secret_mock_client_secret');
      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);
    });

    it('rejects with 409 BOOKING_NOT_PENDING when the hold has already expired', async () => {
      const venue = await Venue.create({
        name: 'Expired Hall',
        address: '1 Expired Ave',
        city: 'Colombo',
        seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
        capacity: 1,
      });
      const event = await Event.create({
        title: 'Expired Event',
        artist: 'Test Artist',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'held', price: 50 }],
        status: 'scheduled',
      });
      const user = await User.create({
        name: 'Expired User',
        email: 'expired@test.com',
        passwordHash: 'hash',
        phone: '94771234567',
        role: 'customer',
      });
      const booking = await Booking.create({
        reference: 'ENC-EXPIRED9',
        userRef: user._id,
        eventRef: event._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
        totalPrice: 50,
        status: 'pending',
        holdExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        paymentService.createPaymentSessionForBooking({ bookingId: booking._id.toString(), userId: user._id.toString() })
      ).rejects.toMatchObject({ statusCode: 409, code: 'BOOKING_NOT_PENDING' });
    });
  });

  describe('reconcileCheckoutSession', () => {
    it('rejects with 404 BOOKING_NOT_FOUND when the booking does not exist', async () => {
      await expect(
        paymentService.reconcileCheckoutSession({
          bookingId: new mongoose.Types.ObjectId().toString(),
          userId: new mongoose.Types.ObjectId().toString(),
          role: 'customer',
        })
      ).rejects.toMatchObject({ statusCode: 404, code: 'BOOKING_NOT_FOUND' });
      expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
    });

    it('rejects with 403 FORBIDDEN when the requester is not the booking owner', async () => {
      const owner = await User.create({
        name: 'Owner',
        email: 'owner@test.com',
        passwordHash: 'hash',
        phone: '94771234567',
        role: 'customer',
      });
      const booking = await Booking.create({
        reference: 'ENC-FORBID1',
        userRef: owner._id,
        eventRef: new mongoose.Types.ObjectId(),
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
        totalPrice: 50,
        status: 'pending',
        holdExpiresAt: new Date(Date.now() + 600000),
        payment: { provider: 'stripe', sessionId: 'cs_test_forbidden' },
      });

      await expect(
        paymentService.reconcileCheckoutSession({
          bookingId: booking._id.toString(),
          userId: new mongoose.Types.ObjectId().toString(),
          role: 'customer',
        })
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
      expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
    });

    it('returns the booking as-is without contacting Stripe once it is no longer pending', async () => {
      const user = await User.create({
        name: 'Already Confirmed',
        email: 'already-confirmed@test.com',
        passwordHash: 'hash',
        phone: '94771234567',
        role: 'customer',
      });
      const booking = await Booking.create({
        reference: 'ENC-DONE0001',
        userRef: user._id,
        eventRef: new mongoose.Types.ObjectId(),
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
        totalPrice: 50,
        status: 'confirmed',
        payment: { provider: 'stripe', sessionId: 'cs_test_already_confirmed', status: 'succeeded' },
      });

      const result = await paymentService.reconcileCheckoutSession({
        bookingId: booking._id.toString(),
        userId: user._id.toString(),
        role: 'customer',
      });

      expect(result.status).toBe('confirmed');
      expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
    });

    it('leaves a pending booking unconfirmed when Stripe reports the session unpaid', async () => {
      const user = await User.create({
        name: 'Still Paying',
        email: 'still-paying@test.com',
        passwordHash: 'hash',
        phone: '94771234567',
        role: 'customer',
      });
      const booking = await Booking.create({
        reference: 'ENC-UNPAID01',
        userRef: user._id,
        eventRef: new mongoose.Types.ObjectId(),
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
        totalPrice: 50,
        status: 'pending',
        holdExpiresAt: new Date(Date.now() + 600000),
        payment: { provider: 'stripe', sessionId: 'cs_test_unpaid' },
      });
      stripeMock.checkout.sessions.retrieve.mockResolvedValueOnce({
        id: 'cs_test_unpaid',
        payment_status: 'unpaid',
      });

      const result = await paymentService.reconcileCheckoutSession({
        bookingId: booking._id.toString(),
        userId: user._id.toString(),
        role: 'customer',
      });

      expect(stripeMock.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_test_unpaid', {
        expand: ['payment_intent'],
      });
      expect(result.status).toBe('pending');
    });

    it('confirms the booking and releases the held seat when Stripe reports the session paid', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ status: 'success', data: 'Sent' }) }));

      const venue = await Venue.create({
        name: 'Reconcile Hall',
        address: '1 Reconcile Ave',
        city: 'Colombo',
        seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
        capacity: 1,
      });
      const event = await Event.create({
        title: 'Reconcile Event',
        artist: 'Test Artist',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'held', price: 50 }],
        status: 'scheduled',
      });
      const user = await User.create({
        name: 'Reconcile User',
        email: 'reconcile@test.com',
        passwordHash: 'hash',
        phone: '94771234567',
        role: 'customer',
      });
      const booking = await Booking.create({
        reference: 'ENC-PAID0001',
        userRef: user._id,
        eventRef: event._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
        totalPrice: 50,
        status: 'pending',
        holdExpiresAt: new Date(Date.now() + 600000),
        payment: { provider: 'stripe', sessionId: 'cs_test_paid' },
      });
      stripeMock.checkout.sessions.retrieve.mockResolvedValueOnce({
        id: 'cs_test_paid',
        payment_status: 'paid',
        payment_intent: 'pi_test_reconcile',
        amount_total: 5000,
        currency: 'lkr',
      });

      const result = await paymentService.reconcileCheckoutSession({
        bookingId: booking._id.toString(),
        userId: user._id.toString(),
        role: 'customer',
      });

      expect(result.status).toBe('confirmed');
      expect(result.payment.paymentIntentId).toBe('pi_test_reconcile');
      expect(result.holdExpiresAt).toBeUndefined();

      const updatedEvent = await Event.findById(event._id);
      expect(updatedEvent.seats.find((s) => s.id === 'A-1').status).toBe('booked');

      global.fetch = originalFetch;
    });
  });

  describe('expireCheckoutSession', () => {
    it('is a no-op when no sessionId is given', async () => {
      await expect(paymentService.expireCheckoutSession(undefined)).resolves.toBeUndefined();
      expect(stripeMock.checkout.sessions.expire).not.toHaveBeenCalled();
    });

    it('never throws even if Stripe reports the session already expired/completed', async () => {
      stripeMock.checkout.sessions.expire.mockRejectedValueOnce(new Error('Session already expired'));
      await expect(paymentService.expireCheckoutSession('cs_test_gone')).resolves.toBeUndefined();
    });
  });

  describe('refundPayment', () => {
    it('creates a Stripe refund for the given payment intent', async () => {
      const refund = await paymentService.refundPayment('pi_test_123');
      expect(stripeMock.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_test_123' });
      expect(refund.id).toBe('re_test_mock_refund');
    });
  });

  describe('createIntent (ADR-014 / D12)', () => {
    it('creates a PaymentIntent with the amount/currency/metadata.holdId and an idempotency key equal to the holdId', async () => {
      const intent = await paymentService.createIntent({
        holdId: 'hold_test_1',
        amountMinor: 650000,
        currency: 'lkr',
      });

      expect(stripeMock.paymentIntents.create).toHaveBeenCalledTimes(1);
      const [payload, options] = stripeMock.paymentIntents.create.mock.calls[0];

      expect(payload.amount).toBe(650000);
      expect(payload.currency).toBe('lkr');
      expect(payload.metadata).toEqual({ holdId: 'hold_test_1' });
      expect(payload.automatic_payment_methods).toEqual({ enabled: true });
      expect(options).toEqual({ idempotencyKey: 'hold_test_1' });
      expect(intent.id).toBe('pi_test_mock_intent');
    });
  });

  describe('cancelIntent', () => {
    it('cancels the PaymentIntent by id', async () => {
      const result = await paymentService.cancelIntent('pi_test_456');
      expect(stripeMock.paymentIntents.cancel).toHaveBeenCalledWith('pi_test_456');
      expect(result.id).toBe('pi_test_456');
      expect(result.status).toBe('canceled');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('delegates to stripe.webhooks.constructEvent', () => {
      stripeMock.webhooks.constructEvent.mockReturnValueOnce({ id: 'evt_1', type: 'checkout.session.completed' });
      const event = paymentService.verifyWebhookSignature(Buffer.from('{}'), 'sig_header');
      const [rawBodyArg, sigArg] = stripeMock.webhooks.constructEvent.mock.calls[0];
      expect(rawBodyArg).toEqual(Buffer.from('{}'));
      expect(sigArg).toBe('sig_header');
      expect(event.id).toBe('evt_1');
    });

    it('throws when the signature is invalid', () => {
      stripeMock.webhooks.constructEvent.mockImplementationOnce(() => {
        throw new Error('Invalid signature');
      });
      expect(() => paymentService.verifyWebhookSignature(Buffer.from('{}'), 'bad_sig')).toThrow('Invalid signature');
    });
  });

  describe('recordWebhookEvent (idempotency ledger, ADR-011)', () => {
    it('returns true on first delivery and false on a replay of the same event id', async () => {
      const stripeEvent = { id: 'evt_replay_test', type: 'checkout.session.completed' };

      const first = await paymentService.recordWebhookEvent(stripeEvent);
      expect(first).toBe(true);

      const replay = await paymentService.recordWebhookEvent(stripeEvent);
      expect(replay).toBe(false);

      const count = await WebhookEvent.countDocuments({ stripeEventId: 'evt_replay_test' });
      expect(count).toBe(1);
    });
  });

  describe('createPaymentSessionForBooking — error paths', () => {
    it('rejects with 404 BOOKING_NOT_FOUND when the booking does not exist', async () => {
      await expect(
        paymentService.createPaymentSessionForBooking({
          bookingId: '000000000000000000000000',
          userId: '000000000000000000000001',
        })
      ).rejects.toMatchObject({ statusCode: 404, code: 'BOOKING_NOT_FOUND' });
    });

    it('rejects with 403 FORBIDDEN when the caller does not own the booking', async () => {
      const venue = await Venue.create({
        name: 'Forbidden Hall',
        address: '1 Forbidden Ave',
        city: 'Colombo',
        seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
        capacity: 1,
      });
      const event = await Event.create({
        title: 'Forbidden Event',
        artist: 'Test Artist',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'held', price: 50 }],
        status: 'scheduled',
      });
      const owner = await User.create({
        name: 'Owner',
        email: 'owner@test.com',
        passwordHash: 'hash',
        phone: '94771234567',
        role: 'customer',
      });
      const booking = await Booking.create({
        reference: 'ENC-FORBID1',
        userRef: owner._id,
        eventRef: event._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
        totalPrice: 50,
        status: 'pending',
        holdExpiresAt: new Date(Date.now() + 600000),
      });

      await expect(
        paymentService.createPaymentSessionForBooking({
          bookingId: booking._id.toString(),
          userId: '000000000000000000000099',
        })
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    });
  });

  describe('recordWebhookEvent — non-duplicate errors', () => {
    it('rethrows an error that is not the E11000 duplicate-key error', async () => {
      const originalCreate = WebhookEvent.create;
      WebhookEvent.create = jest.fn(async () => {
        throw new Error('Unexpected database error');
      });

      await expect(
        paymentService.recordWebhookEvent({ id: 'evt_boom', type: 'checkout.session.completed' })
      ).rejects.toThrow('Unexpected database error');

      WebhookEvent.create = originalCreate;
    });
  });

  describe('handlePaymentIntentSucceeded (belt-and-braces confirmation path)', () => {
    it('confirms a pending booking and books its held seats', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ status: 'success', data: 'Sent' }) }));

      const venue = await Venue.create({
        name: 'Belt-and-Braces Hall',
        address: '1 Belt Ave',
        city: 'Colombo',
        seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
        capacity: 1,
      });
      const event = await Event.create({
        title: 'Belt-and-Braces Event',
        artist: 'Test Artist',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'held', price: 50 }],
        status: 'scheduled',
      });
      const user = await User.create({
        name: 'PI User',
        email: 'pi-user@test.com',
        passwordHash: 'hash',
        phone: '94771234567',
        role: 'customer',
      });
      const booking = await Booking.create({
        reference: 'ENC-PIOK001',
        userRef: user._id,
        eventRef: event._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
        totalPrice: 50,
        status: 'pending',
        holdExpiresAt: new Date(Date.now() + 600000),
      });

      await paymentService.handlePaymentIntentSucceeded({
        id: 'pi_test_success',
        amount: 5000,
        currency: 'lkr',
        metadata: { bookingId: booking._id.toString() },
      });

      const updated = await Booking.findById(booking._id);
      expect(updated.status).toBe('confirmed');
      expect(updated.payment.paymentIntentId).toBe('pi_test_success');
      expect(updated.holdExpiresAt).toBeUndefined();

      const updatedEvent = await Event.findById(event._id);
      expect(updatedEvent.seats[0].status).toBe('booked');

      global.fetch = originalFetch;
    });

    it('is a no-op when the PaymentIntent metadata has no bookingId', async () => {
      await expect(paymentService.handlePaymentIntentSucceeded({ id: 'pi_no_meta', metadata: {} })).resolves.toBeUndefined();
    });
  });

  describe('handleChargeRefunded', () => {
    it('records the refund id on the booking matching the PaymentIntent', async () => {
      const venue = await Venue.create({
        name: 'Refund Hall',
        address: '1 Refund Ave',
        city: 'Colombo',
        seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
        capacity: 1,
      });
      const event = await Event.create({
        title: 'Refund Event',
        artist: 'Test Artist',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'booked', price: 50 }],
        status: 'scheduled',
      });
      const user = await User.create({
        name: 'Refund User',
        email: 'refund-user@test.com',
        passwordHash: 'hash',
        phone: '94771234567',
        role: 'customer',
      });
      const booking = await Booking.create({
        reference: 'ENC-REFUND1',
        userRef: user._id,
        eventRef: event._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
        totalPrice: 50,
        status: 'cancelled',
        payment: { provider: 'stripe', paymentIntentId: 'pi_test_refunded' },
      });

      await paymentService.handleChargeRefunded({ id: 'ch_test_refund', payment_intent: 'pi_test_refunded' });

      const updated = await Booking.findById(booking._id);
      expect(updated.payment.refundId).toBe('ch_test_refund');
    });

    it('is a no-op when the charge has no payment_intent', async () => {
      await expect(paymentService.handleChargeRefunded({ id: 'ch_no_pi' })).resolves.toBeUndefined();
    });
  });

  describe('rollback on Stripe failure (bookingService.createBooking, Phase 2.1 step 6)', () => {
    it('releases the seat hold and deletes the pending booking if Stripe session creation fails', async () => {
      const venue = await Venue.create({
        name: 'Fail Hall',
        address: '1 Fail Ave',
        city: 'Colombo',
        seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
        capacity: 1,
      });
      const event = await Event.create({
        title: 'Stripe Failure Event',
        artist: 'Test Artist',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 50 }],
        status: 'scheduled',
      });
      const user = await User.create({
        name: 'Fail User',
        email: 'failuser@test.com',
        passwordHash: 'hash',
        phone: '94771234567',
        role: 'customer',
      });

      stripeMock.checkout.sessions.create.mockRejectedValueOnce(new Error('Stripe API is down'));

      await expect(
        bookingService.createBooking({
          userId: user._id.toString(),
          customerEmail: user.email,
          eventId: event._id.toString(),
          seatIds: ['A-1'],
        })
      ).rejects.toThrow('Stripe API is down');

      const updatedEvent = await Event.findById(event._id);
      expect(updatedEvent.seats[0].status).toBe('available');

      const bookingCount = await Booking.countDocuments({ eventRef: event._id });
      expect(bookingCount).toBe(0);
    });
  });
});
