import { describe, it, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import { createStripeMock, mockStripeModule } from '../helpers/mocks.js';
import Event from '../../src/models/Event.js';
import Booking from '../../src/models/Booking.js';
import Venue from '../../src/models/Venue.js';
import User from '../../src/models/User.js';

// Stripe must be mocked before the dynamic import of holdReaper.js below —
// releaseHold() expires the booking's Stripe Checkout Session.
const stripeMock = createStripeMock();
mockStripeModule(stripeMock);

// The socket gateway must also be mocked before the dynamic import, since
// getIO() has no real Socket.IO server in this test and we want to assert
// the broadcast actually happens rather than being silently swallowed by
// the gateway's own try/catch.
const socketMock = {
  broadcastSeatUpdate: jest.fn(),
  broadcastEventCancelled: jest.fn(),
  broadcastBookingUpdated: jest.fn(),
};
jest.unstable_mockModule('../../src/sockets/seatSocketGateway.js', () => socketMock);

let reapExpiredHolds;

async function seedEventWithSeats() {
  const venue = await Venue.create({
    name: 'Reaper Hall',
    address: '1 Timeout Ave',
    city: 'Colombo',
    seatLayout: [
      { id: 'A-1', section: 'Main', row: 'A', number: 1 },
      { id: 'A-2', section: 'Main', row: 'A', number: 2 },
    ],
    capacity: 2,
  });
  const event = await Event.create({
    title: 'Reaper Test Event',
    artist: 'Test Artist',
    genre: 'Rock',
    date: new Date(Date.now() + 86400000 * 5),
    basePrice: 50,
    venueRef: venue._id,
    seats: [
      { id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'held', price: 50 },
      { id: 'A-2', section: 'Main', row: 'A', number: 2, status: 'held', price: 50 },
    ],
    status: 'scheduled',
  });
  const user = await User.create({
    name: 'Reaper User',
    email: 'reaper@test.com',
    passwordHash: 'hash',
    phone: '94771234567',
    role: 'customer',
  });
  return { venue, event, user };
}

describe('jobs/holdReaper.js — expired hold release (Phase 2.3)', () => {
  beforeAll(async () => {
    await connectTestDB();
    ({ reapExpiredHolds } = await import('../../src/jobs/holdReaper.js'));
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    jest.clearAllMocks();
  });

  it('releases an expired pending hold: seats -> available, booking -> expired, Stripe session expired, and broadcasts', async () => {
    const { event, user } = await seedEventWithSeats();

    const expiredBooking = await Booking.create({
      reference: 'ENC-EXPIRED1',
      userRef: user._id,
      eventRef: event._id,
      seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
      totalPrice: 50,
      status: 'pending',
      holdExpiresAt: new Date(Date.now() - 1000), // already expired
      payment: { provider: 'stripe', sessionId: 'cs_test_expired' },
    });

    const released = await reapExpiredHolds(event._id);

    expect(released).toBe(1);

    const updatedBooking = await Booking.findById(expiredBooking._id);
    expect(updatedBooking.status).toBe('expired');
    expect(updatedBooking.holdExpiresAt).toBeUndefined();

    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent.seats.find((s) => s.id === 'A-1').status).toBe('available');
    // The other, unrelated seat is untouched
    expect(updatedEvent.seats.find((s) => s.id === 'A-2').status).toBe('held');

    expect(stripeMock.checkout.sessions.expire).toHaveBeenCalledWith('cs_test_expired');
    expect(socketMock.broadcastSeatUpdate).toHaveBeenCalledWith(event._id.toString(), ['A-1'], 'available');
  });

  it('leaves an unexpired pending hold untouched', async () => {
    const { event, user } = await seedEventWithSeats();

    const liveBooking = await Booking.create({
      reference: 'ENC-LIVE1',
      userRef: user._id,
      eventRef: event._id,
      seats: [{ id: 'A-2', section: 'Main', row: 'A', number: 2, price: 50 }],
      totalPrice: 50,
      status: 'pending',
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // an hour from now
    });

    const released = await reapExpiredHolds(event._id);

    expect(released).toBe(0);

    const untouchedBooking = await Booking.findById(liveBooking._id);
    expect(untouchedBooking.status).toBe('pending');

    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent.seats.find((s) => s.id === 'A-2').status).toBe('held');

    expect(socketMock.broadcastSeatUpdate).not.toHaveBeenCalled();
    expect(stripeMock.checkout.sessions.expire).not.toHaveBeenCalled();
  });

  it('reapExpiredHolds() with no eventId argument sweeps expired holds across all events', async () => {
    const { event, user } = await seedEventWithSeats();

    await Booking.create({
      reference: 'ENC-EXPIRED2',
      userRef: user._id,
      eventRef: event._id,
      seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
      totalPrice: 50,
      status: 'pending',
      holdExpiresAt: new Date(Date.now() - 5000),
    });

    const released = await reapExpiredHolds();
    expect(released).toBe(1);
  });
});
