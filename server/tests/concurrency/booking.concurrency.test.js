import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import { createStripeMock, mockStripeModule } from '../helpers/mocks.js';
import Event from '../../src/models/Event.js';
import Venue from '../../src/models/Venue.js';
import Booking from '../../src/models/Booking.js';
import User from '../../src/models/User.js';

// Stripe must be mocked before the dynamic import of bookingService below —
// bookingService.createBooking opens a real Checkout Session per call, and
// 50 concurrent calls must not hit the real Stripe API. Every call resolves
// quickly with a fake session; idempotency behaviour itself isn't under
// test here (each booking uses a distinct reference).
const stripeMock = createStripeMock({
  checkout: {
    sessions: {
      create: () =>
        Promise.resolve({
          id: `cs_test_${Math.random().toString(36).slice(2)}`,
          client_secret: `secret_${Math.random().toString(36).slice(2)}`,
          status: 'open',
          amount_total: 7500,
          currency: 'lkr',
        }),
    },
  },
});
mockStripeModule(stripeMock);

let bookingService;

describe('Seat Booking Concurrency Guard Test (ADR-004, ADR-009, §D4.3, O7, FR-15)', () => {
  beforeAll(async () => {
    await connectTestDB();
    bookingService = await import('../../src/services/bookingService.js');
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('O7 & FR-15: exactly 1 request succeeds and 49 fail with 409 Conflict when 50 concurrent requests target the same single seat', async () => {
    // 1. Seed venue with 1 single seat
    const venue = await Venue.create({
      name: 'Single Seat Arena',
      address: '1 Concurrency Way',
      city: 'Colombo',
      seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
      capacity: 1,
    });

    // 2. Seed event referencing venue with 1 available seat
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const event = await Event.create({
      title: 'High Demand Concert',
      artist: 'Rock Legend',
      genre: 'Rock',
      date: futureDate,
      basePrice: 75,
      venueRef: venue._id,
      seats: [
        {
          id: 'A-1',
          section: 'Main',
          row: 'A',
          number: 1,
          status: 'available',
          price: 75,
        },
      ],
      status: 'scheduled',
    });

    // 3. Seed 50 distinct test users (phone required, unique per user)
    const userPromises = [];
    for (let i = 0; i < 50; i++) {
      userPromises.push(
        User.create({
          name: `User ${i}`,
          email: `user${i}@test.com`,
          passwordHash: 'dummyHash',
          phone: `94771${String(i).padStart(6, '0')}`,
          role: 'customer',
        })
      );
    }
    const users = await Promise.all(userPromises);

    // 4. Fire 50 simultaneous booking requests targeting the exact same seat 'A-1'
    const bookingPromises = users.map((user) =>
      bookingService
        .createBooking({
          userId: user._id.toString(),
          customerEmail: user.email,
          eventId: event._id.toString(),
          seatIds: ['A-1'],
        })
        .then((result) => ({ status: 'success', ...result }))
        .catch((error) => ({
          status: 'error',
          statusCode: error.statusCode,
          code: error.code,
        }))
    );

    const results = await Promise.all(bookingPromises);

    // 5. Assertions:
    // Exactly 1 request succeeded
    const successfulBookings = results.filter((r) => r.status === 'success');
    expect(successfulBookings).toHaveLength(1);
    expect(successfulBookings[0].clientSecret).toBeTruthy();

    // Exactly 49 requests failed with 409 Conflict (SEAT_UNAVAILABLE)
    const failedBookings = results.filter((r) => r.status === 'error');
    expect(failedBookings).toHaveLength(49);
    failedBookings.forEach((fail) => {
      expect(fail.statusCode).toBe(409);
      expect(fail.code).toBe('SEAT_UNAVAILABLE');
    });

    // Database assertions: exactly 1 Booking record exists, and it is `pending`
    // (ADR-009 — createBooking only ever opens a hold; a booking is confirmed
    // solely by the Stripe webhook, never here). The concurrency guarantee is
    // unchanged; only the terminal status differs from the pre-Stripe MVP.
    const bookingCount = await Booking.countDocuments({ eventRef: event._id });
    expect(bookingCount).toBe(1);

    const pendingCount = await Booking.countDocuments({ status: 'pending', eventRef: event._id });
    expect(pendingCount).toBe(1);

    // Database assertions: event seat status is now 'held', not 'booked'
    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent.seats[0].status).toBe('held');
  });
});
