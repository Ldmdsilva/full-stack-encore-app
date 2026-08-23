import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import { createStripeMock, mockStripeModule } from '../helpers/mocks.js';
import Venue from '../../src/models/Venue.js';
import Event from '../../src/models/Event.js';
import User from '../../src/models/User.js';

// Stripe must be mocked before the dynamic import of bookingService below,
// since bookingService -> paymentService -> config/stripe.js -> 'stripe'.
const stripeMock = createStripeMock();
mockStripeModule(stripeMock);

let eventService;
let bookingService;
let authService;

describe('Event & Booking Services Extended Coverage (§D4.1, §D4.2)', () => {
  let venue;
  let user;

  beforeAll(async () => {
    await connectTestDB();
    eventService = await import('../../src/services/eventService.js');
    bookingService = await import('../../src/services/bookingService.js');
    authService = await import('../../src/services/authService.js');
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    stripeMock.checkout.sessions.create.mockClear();

    venue = await Venue.create({
      name: 'Hall Alpha',
      address: '100 Music Road',
      city: 'Colombo',
      seatLayout: [
        { id: 'S-1', section: 'Balcony', row: 'A', number: 1 },
        { id: 'S-2', section: 'Balcony', row: 'A', number: 2 },
      ],
      capacity: 2,
    });

    // register() now returns { message } only (202, no user/token — D14),
    // so fetch the created User document directly to get its id/email.
    await authService.register({
      name: 'Test Customer',
      email: 'customer.test@encore.com',
      password: 'password123',
      phone: '0771234567',
    });
    user = await User.findOne({ email: 'customer.test@encore.com' });
  });

  it('FR-10: creates event inheriting venue layout with prices set to basePrice', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 5);
    const event = await eventService.createEvent({
      title: 'Jazz Fest',
      artist: 'Miles Tribute',
      genre: 'Jazz',
      date: futureDate,
      basePrice: 60,
      venueRef: venue._id,
    });

    expect(event.seats).toHaveLength(2);
    expect(event.seats[0].price).toBe(60);
    expect(event.seats[0].status).toBe('available');
    expect(event.genre).toBe('Jazz');
  });

  it('FR-10: rejects event creation with past date', async () => {
    const pastDate = new Date(Date.now() - 86400000);
    await expect(
      eventService.createEvent({
        title: 'Old Gig',
        artist: 'Old Band',
        genre: 'Rock',
        date: pastDate,
        basePrice: 50,
        venueRef: venue._id,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('FR-10: rejects event creation with a missing genre', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 2);
    await expect(
      eventService.createEvent({
        title: 'No Genre Gig',
        artist: 'Mystery Band',
        date: futureDate,
        basePrice: 50,
        venueRef: venue._id,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('FR-9: searches events by artist name and pagination', async () => {
    const d1 = new Date(Date.now() + 86400000 * 3);
    const d2 = new Date(Date.now() + 86400000 * 6);

    await eventService.createEvent({
      title: 'Indie Night',
      artist: 'Arctic Monks',
      genre: 'Indie',
      date: d1,
      basePrice: 45,
      venueRef: venue._id,
    });

    await eventService.createEvent({
      title: 'Pop Blast',
      artist: 'Dua Lipa Tribute',
      genre: 'Pop',
      date: d2,
      basePrice: 55,
      venueRef: venue._id,
    });

    const searchResult = await eventService.getEvents({ artist: 'Arctic' });
    expect(searchResult.events).toHaveLength(1);
    expect(searchResult.events[0].artist).toBe('Arctic Monks');
  });

  it('FR-12: cancels event and updates status', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 4);
    const event = await eventService.createEvent({
      title: 'To Cancel',
      artist: 'Ghost Band',
      genre: 'Rock',
      date: futureDate,
      basePrice: 30,
      venueRef: venue._id,
    });

    await eventService.deleteEvent(event._id);
    const cancelled = await Event.findById(event._id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('FR-18 & FR-24: queries user bookings and admin all bookings for a pending (held) booking', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 7);
    const event = await eventService.createEvent({
      title: 'VIP Gala',
      artist: 'Chamber Orchestra',
      genre: 'Classical',
      date: futureDate,
      basePrice: 120,
      venueRef: venue._id,
    });

    const { booking, clientSecret } = await bookingService.createBooking({
      userId: user.id,
      customerEmail: user.email,
      eventId: event._id,
      seatIds: ['S-1'],
    });

    // ADR-009: createBooking only ever opens a hold + Stripe session; the
    // booking is `pending` until the webhook confirms it.
    expect(booking.status).toBe('pending');
    expect(clientSecret).toBeTruthy();
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledTimes(1);

    const eventAfterHold = await Event.findById(event._id);
    expect(eventAfterHold.seats.find((s) => s.id === 'S-1').status).toBe('held');

    const userBookings = await bookingService.getUserBookings(user.id);
    expect(userBookings.items).toHaveLength(1);
    expect(userBookings.total).toBe(1);
    expect(userBookings.items[0].status).toBe('pending');
    expect(userBookings.limit).toBe(10);

    const allBookings = await bookingService.getAllBookings({ eventId: event._id });
    expect(allBookings.items).toHaveLength(1);
    expect(allBookings.limit).toBe(20);
  });
});
