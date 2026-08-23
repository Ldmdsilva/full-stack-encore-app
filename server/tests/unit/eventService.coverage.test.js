import { describe, it, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import { createStripeMock, mockStripeModule } from '../helpers/mocks.js';
import Venue from '../../src/models/Venue.js';
import Event from '../../src/models/Event.js';
import Booking from '../../src/models/Booking.js';
import User from '../../src/models/User.js';

// eventService.deleteEvent refunds confirmed bookings via paymentService,
// which imports stripe — must be mocked before the dynamic import below.
const stripeMock = createStripeMock();
mockStripeModule(stripeMock);

let eventService;

describe('services/eventService.js — additional coverage (getEvents filters, updateEvent, deleteEvent refunds)', () => {
  let venue;

  beforeAll(async () => {
    await connectTestDB();
    eventService = await import('../../src/services/eventService.js');
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    jest.clearAllMocks();

    venue = await Venue.create({
      name: 'Coverage Venue',
      address: '1 Coverage St',
      city: 'Colombo',
      seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
      capacity: 1,
    });
  });

  describe('getEvents filtering', () => {
    it('rejects an invalid `from` date filter with 400 INVALID_FILTER', async () => {
      await expect(eventService.getEvents({ from: 'not-a-date' })).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_FILTER',
      });
    });

    it('rejects an invalid `to` date filter with 400 INVALID_FILTER', async () => {
      await expect(eventService.getEvents({ to: 'not-a-date' })).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_FILTER',
      });
    });

    it('filters by venue and by explicit `to` date', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 5);
      await eventService.createEvent({
        title: 'Filterable Gig',
        artist: 'Filter Band',
        genre: 'Rock',
        date: futureDate,
        basePrice: 40,
        venueRef: venue._id,
      });

      const byVenue = await eventService.getEvents({ venue: venue._id.toString() });
      expect(byVenue.events).toHaveLength(1);

      const byToDate = await eventService.getEvents({ to: new Date(Date.now() + 86400000 * 10).toISOString() });
      expect(byToDate.events.length).toBeGreaterThanOrEqual(1);

      const tooEarly = await eventService.getEvents({ to: new Date(Date.now() + 1000).toISOString() });
      expect(tooEarly.events).toHaveLength(0);
    });
  });

  describe('getEventById', () => {
    it('rejects a non-existent event with 404 EVENT_NOT_FOUND', async () => {
      await expect(eventService.getEventById('64b64b64b64b64b64b64b64b')).rejects.toMatchObject({
        statusCode: 404,
        code: 'EVENT_NOT_FOUND',
      });
    });
  });

  describe('createEvent venue guard', () => {
    it('rejects a non-existent venueRef with 404 VENUE_NOT_FOUND', async () => {
      await expect(
        eventService.createEvent({
          title: 'Orphan Event',
          artist: 'Nobody',
          genre: 'Rock',
          date: new Date(Date.now() + 86400000),
          basePrice: 40,
          venueRef: '64b64b64b64b64b64b64b64b',
        })
      ).rejects.toMatchObject({ statusCode: 404, code: 'VENUE_NOT_FOUND' });
    });
  });

  describe('updateEvent', () => {
    it('updates mutable fields but strips any attempt to overwrite seats directly', async () => {
      const event = await eventService.createEvent({
        title: 'Original Title',
        artist: 'Original Artist',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000 * 2),
        basePrice: 40,
        venueRef: venue._id,
      });

      const updated = await eventService.updateEvent(event._id, {
        title: 'Updated Title',
        seats: [{ id: 'HACKED', section: 'x', row: 'x', number: 1, status: 'booked', price: 0 }],
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.seats).toHaveLength(1);
      expect(updated.seats[0].id).toBe('A-1'); // untouched by the seats: [] in the update payload
    });

    it('rejects an invalid date on update', async () => {
      const event = await eventService.createEvent({
        title: 'Date Guard Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000 * 2),
        basePrice: 40,
        venueRef: venue._id,
      });

      await expect(eventService.updateEvent(event._id, { date: 'not-a-date' })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('rejects updating a non-existent event with 404 EVENT_NOT_FOUND', async () => {
      await expect(eventService.updateEvent('64b64b64b64b64b64b64b64b', { title: 'x' })).rejects.toMatchObject({
        statusCode: 404,
        code: 'EVENT_NOT_FOUND',
      });
    });
  });

  describe('deleteEvent', () => {
    it('rejects deleting a non-existent event with 404 EVENT_NOT_FOUND', async () => {
      await expect(eventService.deleteEvent('64b64b64b64b64b64b64b64b')).rejects.toMatchObject({
        statusCode: 404,
        code: 'EVENT_NOT_FOUND',
      });
    });

    it('refunds every confirmed booking and cancels pending ones without a refund, then marks the event cancelled', async () => {
      const event = await eventService.createEvent({
        title: 'Mass Cancel Event',
        artist: 'Test',
        genre: 'Rock',
        date: new Date(Date.now() + 86400000 * 2),
        basePrice: 40,
        venueRef: venue._id,
      });

      const user = await User.create({
        name: 'Cancel Target User',
        email: 'canceltarget@test.com',
        passwordHash: 'hash',
        phone: '94771234570',
        role: 'customer',
      });

      const confirmedBooking = await Booking.create({
        reference: 'ENC-MASS-CONFIRMED',
        userRef: user._id,
        eventRef: event._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 40 }],
        totalPrice: 40,
        status: 'confirmed',
        payment: { provider: 'stripe', paymentIntentId: 'pi_mass_cancel' },
      });

      const pendingBooking = await Booking.create({
        reference: 'ENC-MASS-PENDING',
        userRef: user._id,
        eventRef: event._id,
        seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 40 }],
        totalPrice: 40,
        status: 'pending',
        holdExpiresAt: new Date(Date.now() + 600000),
      });

      await eventService.deleteEvent(event._id);

      const cancelledEvent = await Event.findById(event._id);
      expect(cancelledEvent.status).toBe('cancelled');

      const refundedBooking = await Booking.findById(confirmedBooking._id);
      expect(refundedBooking.status).toBe('cancelled');
      expect(refundedBooking.payment.refundId).toBe('re_test_mock_refund');
      expect(stripeMock.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_mass_cancel' });

      const cancelledPending = await Booking.findById(pendingBooking._id);
      expect(cancelledPending.status).toBe('cancelled');
      expect(cancelledPending.holdExpiresAt).toBeUndefined();
    });
  });
});
