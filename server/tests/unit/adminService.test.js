import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import * as adminService from '../../src/services/adminService.js';
import Venue from '../../src/models/Venue.js';
import Event from '../../src/models/Event.js';
import Booking from '../../src/models/Booking.js';
import User from '../../src/models/User.js';

describe('services/adminService.js — dashboard stats and admin event listing (FR-25)', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  async function seedScenario() {
    const venue = await Venue.create({
      name: 'Admin Stats Hall',
      address: '1 Stats Ave',
      city: 'Colombo',
      seatLayout: [
        { id: 'A-1', section: 'Main', row: 'A', number: 1 },
        { id: 'A-2', section: 'Main', row: 'A', number: 2 },
      ],
      capacity: 2,
    });
    const event = await Event.create({
      title: 'Stats Event',
      artist: 'Test Artist',
      genre: 'Rock',
      date: new Date(Date.now() + 86400000),
      basePrice: 50,
      venueRef: venue._id,
      seats: [
        { id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'booked', price: 50 },
        { id: 'A-2', section: 'Main', row: 'A', number: 2, status: 'available', price: 50 },
      ],
      status: 'scheduled',
    });
    const cancelledEvent = await Event.create({
      title: 'Cancelled Stats Event',
      artist: 'Test Artist',
      genre: 'Rock',
      date: new Date(Date.now() + 86400000 * 2),
      basePrice: 30,
      venueRef: venue._id,
      seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 30 }],
      status: 'cancelled',
    });
    const user = await User.create({
      name: 'Stats User',
      email: 'statsuser@test.com',
      passwordHash: 'hash',
      phone: '94771234567',
      role: 'customer',
    });
    await Booking.create({
      reference: 'ENC-STATS-CONFIRMED',
      userRef: user._id,
      eventRef: event._id,
      seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
      totalPrice: 50,
      status: 'confirmed',
    });
    await Booking.create({
      reference: 'ENC-STATS-CANCELLED',
      userRef: user._id,
      eventRef: event._id,
      seats: [{ id: 'A-2', section: 'Main', row: 'A', number: 2, price: 50 }],
      totalPrice: 50,
      status: 'cancelled',
    });

    return { venue, event, cancelledEvent, user };
  }

  describe('getStats', () => {
    it('returns zeroed stats when nothing exists yet', async () => {
      const stats = await adminService.getStats();
      expect(stats).toEqual({
        totalEvents: 0,
        upcomingEvents: 0,
        totalBookings: 0,
        confirmedBookings: 0,
        cancelledBookings: 0,
        totalRevenue: 0,
        totalSeats: 0,
        bookedSeats: 0,
        availableSeats: 0,
        occupancyRate: 0,
      });
    });

    it('aggregates totals, revenue, and occupancy across events and bookings', async () => {
      await seedScenario();

      const stats = await adminService.getStats();
      expect(stats.totalEvents).toBe(2);
      expect(stats.upcomingEvents).toBe(1); // only the scheduled one
      expect(stats.totalBookings).toBe(2);
      expect(stats.confirmedBookings).toBe(1);
      expect(stats.cancelledBookings).toBe(1);
      expect(stats.totalRevenue).toBe(50); // only the confirmed booking counts
      expect(stats.totalSeats).toBe(3); // 2 on the scheduled event + 1 on the cancelled event
      expect(stats.bookedSeats).toBe(1);
      expect(stats.availableSeats).toBe(2);
      expect(stats.occupancyRate).toBe(Math.round((1 / 3) * 100));
    });
  });

  describe('listAdminEvents', () => {
    it('lists every event including cancelled ones, with revenue and booking count derived from confirmed bookings', async () => {
      const { event, cancelledEvent } = await seedScenario();

      const result = await adminService.listAdminEvents({});
      expect(result.total).toBe(2);
      expect(result.events).toHaveLength(2);

      const scheduledSummary = result.events.find((e) => e.id === event._id.toString());
      expect(scheduledSummary.revenue).toBe(50);
      expect(scheduledSummary.bookingCount).toBe(1);

      const cancelledSummary = result.events.find((e) => e.id === cancelledEvent._id.toString());
      expect(cancelledSummary.status).toBe('cancelled');
      expect(cancelledSummary.revenue).toBe(0);
      expect(cancelledSummary.bookingCount).toBe(0);
    });

    it('paginates results', async () => {
      await seedScenario();
      const page1 = await adminService.listAdminEvents({ page: 1, limit: 1 });
      expect(page1.events).toHaveLength(1);
      expect(page1.totalPages).toBe(2);
    });
  });
});
