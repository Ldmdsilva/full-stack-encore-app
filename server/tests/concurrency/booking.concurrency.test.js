import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import * as bookingService from '../../src/services/bookingService.js';
import Event from '../../src/models/Event.js';
import Venue from '../../src/models/Venue.js';
import Booking from '../../src/models/Booking.js';
import User from '../../src/models/User.js';

describe('Seat Booking Concurrency Guard Test (ADR-004, §D4.3, O7, FR-15)', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('O7 & FR-15: exactly 1 request succeeds (201) and 49 fail with 409 Conflict when 50 concurrent requests target the same single seat', async () => {
    // 1. Seed venue with 1 single seat
    const venue = await Venue.create({
      name: 'Single Seat Arena',
      address: '1 Concurrency Way',
      seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
      capacity: 1,
    });

    // 2. Seed event referencing venue with 1 available seat
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const event = await Event.create({
      title: 'High Demand Concert',
      artist: 'Rock Legend',
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

    // 3. Seed 50 distinct test users
    const userPromises = [];
    for (let i = 0; i < 50; i++) {
      userPromises.push(
        User.create({
          name: `User ${i}`,
          email: `user${i}@test.com`,
          passwordHash: 'dummyHash',
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
          eventId: event._id.toString(),
          seatIds: ['A-1'],
        })
        .then((booking) => ({ status: 'success', booking }))
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

    // Exactly 49 requests failed with 409 Conflict (SEAT_UNAVAILABLE)
    const failedBookings = results.filter((r) => r.status === 'error');
    expect(failedBookings).toHaveLength(49);
    failedBookings.forEach((fail) => {
      expect(fail.statusCode).toBe(409);
      expect(fail.code).toBe('SEAT_UNAVAILABLE');
    });

    // Database assertions: exactly 1 Booking record exists
    const bookingCount = await Booking.countDocuments({ eventRef: event._id });
    expect(bookingCount).toBe(1);

    // Database assertions: event seat status is now 'booked'
    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent.seats[0].status).toBe('booked');
  });
});
