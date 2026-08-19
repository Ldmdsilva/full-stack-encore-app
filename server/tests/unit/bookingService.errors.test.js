import { describe, it, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import { createStripeMock, mockStripeModule } from '../helpers/mocks.js';
import Event from '../../src/models/Event.js';
import Venue from '../../src/models/Venue.js';
import Booking from '../../src/models/Booking.js';
import User from '../../src/models/User.js';

// Stripe must be mocked before the dynamic import of bookingService.js below.
const stripeMock = createStripeMock();
mockStripeModule(stripeMock);

let bookingService;

async function seedVenueAndUser() {
  const venue = await Venue.create({
    name: 'Coverage Hall',
    address: '1 Coverage Ave',
    city: 'Colombo',
    seatLayout: [
      { id: 'A-1', section: 'Main', row: 'A', number: 1 },
      { id: 'A-2', section: 'Main', row: 'A', number: 2 },
    ],
    capacity: 2,
  });
  const user = await User.create({
    name: 'Coverage User',
    email: 'coverage@test.com',
    passwordHash: 'hash',
    phone: '94771234567',
    role: 'customer',
  });
  return { venue, user };
}

describe('services/bookingService.js — error paths and guards (raises branch coverage)', () => {
  beforeAll(async () => {
    await connectTestDB();
    bookingService = await import('../../src/services/bookingService.js');
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    jest.clearAllMocks();
    stripeMock.checkout.sessions.create.mockImplementation(async () => ({
      id: `cs_test_${Math.random().toString(36).slice(2)}`,
      client_secret: `secret_${Math.random().toString(36).slice(2)}`,
      status: 'open',
      amount_total: 5000,
      currency: 'lkr',
    }));
  });

  describe('createBooking validation', () => {
    it('rejects a missing eventId/seatIds with 400 VALIDATION_ERROR', async () => {
      const { user } = await seedVenueAndUser();
      await expect(
        bookingService.createBooking({ userId: user._id.toString(), eventId: null, seatIds: [] })
      ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
    });

    it('rejects a non-existent event with 404 EVENT_NOT_FOUND', async () => {
      const { user } = await seedVenueAndUser();
      await expect(
        bookingService.createBooking({
          userId: user._id.toString(),
          eventId: '64b64b64b64b64b64b64b64b',
          seatIds: ['A-1'],
        })
      ).rejects.toMatchObject({ statusCode: 404, code: 'EVENT_NOT_FOUND' });
    });

    it('rejects booking on a cancelled event with 400 EVENT_INACTIVE', async () => {
      const { venue, user } = await seedVenueAndUser();
      const event = await Event.create({
        title: 'Cancelled Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 50 }],
        status: 'cancelled',
      });

      await expect(
        bookingService.createBooking({ userId: user._id.toString(), eventId: event._id.toString(), seatIds: ['A-1'] })
      ).rejects.toMatchObject({ statusCode: 400, code: 'EVENT_INACTIVE' });
    });

    it('rejects seat ids that do not exist on the event with 400 INVALID_SEATS', async () => {
      const { venue, user } = await seedVenueAndUser();
      const event = await Event.create({
        title: 'Valid Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 50 }],
        status: 'scheduled',
      });

      await expect(
        bookingService.createBooking({
          userId: user._id.toString(),
          eventId: event._id.toString(),
          seatIds: ['Z-99'],
        })
      ).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_SEATS' });
    });
  });

  describe('createBooking Booking.create failure handling', () => {
    it('rolls back the seat hold and rethrows on a non-duplicate-key Booking.create failure', async () => {
      const { venue, user } = await seedVenueAndUser();
      const event = await Event.create({
        title: 'Create-Failure Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 50 }],
        status: 'scheduled',
      });

      const createSpy = jest.spyOn(Booking, 'create').mockRejectedValueOnce(new Error('unexpected db error'));

      await expect(
        bookingService.createBooking({ userId: user._id.toString(), eventId: event._id.toString(), seatIds: ['A-1'] })
      ).rejects.toThrow('unexpected db error');

      createSpy.mockRestore();

      const updatedEvent = await Event.findById(event._id);
      expect(updatedEvent.seats[0].status).toBe('available');

      const count = await Booking.countDocuments({ eventRef: event._id });
      expect(count).toBe(0);
    });

    it('retries once with a regenerated reference on a duplicate-key (E11000) collision', async () => {
      const { venue, user } = await seedVenueAndUser();
      const event = await Event.create({
        title: 'Duplicate-Reference Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 50 }],
        status: 'scheduled',
      });

      const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      const createSpy = jest.spyOn(Booking, 'create').mockRejectedValueOnce(duplicateKeyError);

      const { booking } = await bookingService.createBooking({
        userId: user._id.toString(),
        eventId: event._id.toString(),
        seatIds: ['A-1'],
      });

      createSpy.mockRestore();

      expect(booking.status).toBe('pending');
      const count = await Booking.countDocuments({ eventRef: event._id });
      expect(count).toBe(1);
    });
  });

  describe('cancelBooking guards', () => {
    it('rejects cancelling a non-existent booking with 404 BOOKING_NOT_FOUND', async () => {
      const { user } = await seedVenueAndUser();
      await expect(
        bookingService.cancelBooking({ userId: user._id.toString(), bookingId: '64b64b64b64b64b64b64b64b', role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 404, code: 'BOOKING_NOT_FOUND' });
    });

    it('rejects cancelling another customer\'s booking with 403 FORBIDDEN', async () => {
      const { venue, user } = await seedVenueAndUser();
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@test.com',
        passwordHash: 'hash',
        phone: '94771234568',
        role: 'customer',
      });
      const event = await Event.create({
        title: 'Forbidden Cancel Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 50 }],
        status: 'scheduled',
      });
      const { booking } = await bookingService.createBooking({
        userId: user._id.toString(),
        eventId: event._id.toString(),
        seatIds: ['A-1'],
      });

      await expect(
        bookingService.cancelBooking({ userId: otherUser._id.toString(), bookingId: booking._id.toString(), role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    });

    it('is idempotent: cancelling an already-cancelled booking just returns it', async () => {
      const { venue, user } = await seedVenueAndUser();
      const event = await Event.create({
        title: 'Idempotent Cancel Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 50 }],
        status: 'scheduled',
      });
      const { booking } = await bookingService.createBooking({
        userId: user._id.toString(),
        eventId: event._id.toString(),
        seatIds: ['A-1'],
      });

      const first = await bookingService.cancelBooking({ userId: user._id.toString(), bookingId: booking._id.toString(), role: 'customer' });
      expect(first.status).toBe('cancelled');

      const second = await bookingService.cancelBooking({ userId: user._id.toString(), bookingId: booking._id.toString(), role: 'customer' });
      expect(second.status).toBe('cancelled');
    });

    it('rejects cancelling an expired booking with 400 BOOKING_NOT_CANCELLABLE', async () => {
      const { venue, user } = await seedVenueAndUser();
      const event = await Event.create({
        title: 'Expired Booking Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 50 }],
        status: 'scheduled',
      });
      const expiredBooking = await Booking.create({
        reference: 'ENC-ALREADY-EXPIRED',
        userRef: user._id,
        eventRef: event._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
        totalPrice: 50,
        status: 'expired',
      });

      await expect(
        bookingService.cancelBooking({ userId: user._id.toString(), bookingId: expiredBooking._id.toString(), role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 400, code: 'BOOKING_NOT_CANCELLABLE' });
    });

    it('rejects cancelling a booking for an event that has already started with 400 EVENT_STARTED', async () => {
      const { venue, user } = await seedVenueAndUser();
      const pastEvent = await Event.create({
        title: 'Already Started Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() - 3600000), // started an hour ago
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'held', price: 50 }],
        status: 'scheduled',
      });
      const pendingBooking = await Booking.create({
        reference: 'ENC-STARTED-EVENT',
        userRef: user._id,
        eventRef: pastEvent._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
        totalPrice: 50,
        status: 'pending',
        holdExpiresAt: new Date(Date.now() + 60000),
      });

      await expect(
        bookingService.cancelBooking({ userId: user._id.toString(), bookingId: pendingBooking._id.toString(), role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 400, code: 'EVENT_STARTED' });
    });

    it('an admin may cancel any customer\'s booking regardless of ownership', async () => {
      const { venue, user } = await seedVenueAndUser();
      const event = await Event.create({
        title: 'Admin Cancel Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 50 }],
        status: 'scheduled',
      });
      const { booking } = await bookingService.createBooking({
        userId: user._id.toString(),
        eventId: event._id.toString(),
        seatIds: ['A-1'],
      });

      const cancelled = await bookingService.cancelBooking({
        userId: '64b64b64b64b64b64b64b64b', // not the owner
        bookingId: booking._id.toString(),
        role: 'admin',
      });

      expect(cancelled.status).toBe('cancelled');
    });

    it('refunds via Stripe before flipping a confirmed booking to cancelled', async () => {
      const { venue, user } = await seedVenueAndUser();
      const event = await Event.create({
        title: 'Refund Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'booked', price: 50 }],
        status: 'scheduled',
      });
      const confirmedBooking = await Booking.create({
        reference: 'ENC-CONFIRMED-CANCEL',
        userRef: user._id,
        eventRef: event._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
        totalPrice: 50,
        status: 'confirmed',
        payment: { provider: 'stripe', paymentIntentId: 'pi_refund_test' },
      });

      const cancelled = await bookingService.cancelBooking({
        userId: user._id.toString(),
        bookingId: confirmedBooking._id.toString(),
        role: 'customer',
      });

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.payment.refundId).toBe('re_test_mock_refund');
      expect(stripeMock.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_refund_test' });

      const updatedEvent = await Event.findById(event._id);
      expect(updatedEvent.seats[0].status).toBe('available');
    });
  });

  describe('getBookingById', () => {
    it('rejects a non-existent booking with 404 BOOKING_NOT_FOUND', async () => {
      const { user } = await seedVenueAndUser();
      await expect(
        bookingService.getBookingById({ bookingId: '64b64b64b64b64b64b64b64b', userId: user._id.toString(), role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 404, code: 'BOOKING_NOT_FOUND' });
    });

    it('rejects a customer viewing another customer\'s booking with 403 FORBIDDEN', async () => {
      const { venue, user } = await seedVenueAndUser();
      const otherUser = await User.create({
        name: 'Viewer User',
        email: 'viewer@test.com',
        passwordHash: 'hash',
        phone: '94771234569',
        role: 'customer',
      });
      const event = await Event.create({
        title: 'View Guard Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 50 }],
        status: 'scheduled',
      });
      const { booking } = await bookingService.createBooking({
        userId: user._id.toString(),
        eventId: event._id.toString(),
        seatIds: ['A-1'],
      });

      await expect(
        bookingService.getBookingById({ bookingId: booking._id.toString(), userId: otherUser._id.toString(), role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    });

    it('allows the owner and an admin to view the booking', async () => {
      const { venue, user } = await seedVenueAndUser();
      const event = await Event.create({
        title: 'View Allowed Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000),
        basePrice: 50,
        venueRef: venue._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 50 }],
        status: 'scheduled',
      });
      const { booking } = await bookingService.createBooking({
        userId: user._id.toString(),
        eventId: event._id.toString(),
        seatIds: ['A-1'],
      });

      const asOwner = await bookingService.getBookingById({ bookingId: booking._id.toString(), userId: user._id.toString(), role: 'customer' });
      expect(asOwner.reference).toBe(booking.reference);

      const asAdmin = await bookingService.getBookingById({ bookingId: booking._id.toString(), userId: '64b64b64b64b64b64b64b64b', role: 'admin' });
      expect(asAdmin.reference).toBe(booking.reference);
    });
  });
});
