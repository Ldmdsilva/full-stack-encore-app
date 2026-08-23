import { describe, it, expect, beforeAll, beforeEach, afterAll, jest } from '@jest/globals';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import Venue from '../../src/models/Venue.js';
import Event from '../../src/models/Event.js';
import Booking from '../../src/models/Booking.js';
import User from '../../src/models/User.js';

/**
 * emailService.js and smsService.js must be mocked before the dynamic
 * imports of notificationService.js / paymentService.js below, since both
 * import `sendEmail`/`sendSms` directly (ADR-012: notifications are
 * fire-and-forget and must never be able to fail the operation that
 * triggered them).
 */
const sendEmailMock = jest.fn(async () => ({ messageId: 'mock-message-id' }));
const sendSmsMock = jest.fn(async () => ({ status: 'success', data: 'Sent' }));

jest.unstable_mockModule('../../src/services/notification/emailService.js', () => ({
  sendEmail: sendEmailMock,
}));
jest.unstable_mockModule('../../src/services/notification/smsService.js', () => ({
  sendSms: sendSmsMock,
}));

let notificationService;
let paymentService;

const user = { name: 'Fan One', email: 'fan@example.com', phone: '94771234567' };
const bookingFixture = {
  reference: 'ENC-1234',
  seats: [{ section: 'Stalls', row: 'A', number: 1, price: 6500 }],
  totalPrice: 6500,
};
const eventFixture = { title: 'Gig Night', artist: 'The Band', date: new Date() };
const venueFixture = { name: 'Grand Hall', city: 'Colombo' };

describe('notification/notificationService.js — fire-and-forget guarantees (ADR-012)', () => {
  beforeAll(async () => {
    notificationService = await import('../../src/services/notification/notificationService.js');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('notifyBookingConfirmed fires exactly one email and one SMS, addressed to the user', async () => {
    notificationService.notifyBookingConfirmed({
      user,
      booking: bookingFixture,
      event: eventFixture,
      venue: venueFixture,
    });

    // Fire-and-forget: give the internal (un-awaited) promises a tick to settle.
    await new Promise((resolve) => setImmediate(resolve));

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendSmsMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].to).toBe(user.email);
    expect(sendSmsMock.mock.calls[0][0]).toBe(user.phone);
  });

  it('a rejecting sendEmail never throws/propagates out of notifyBookingConfirmed, and the SMS still fires', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('SMTP connection refused'));

    expect(() =>
      notificationService.notifyBookingConfirmed({ user, booking: bookingFixture, event: eventFixture, venue: venueFixture })
    ).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
    expect(sendSmsMock).toHaveBeenCalledTimes(1);
  });

  it('a rejecting sendSms never throws/propagates out of notifyBookingConfirmed, and the email still fires', async () => {
    sendSmsMock.mockRejectedValueOnce(new Error('notify.lk unreachable'));

    expect(() =>
      notificationService.notifyBookingConfirmed({ user, booking: bookingFixture, event: eventFixture, venue: venueFixture })
    ).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('notifyVerifyEmail and notifyPasswordReset fire an email only, without throwing', async () => {
    expect(() =>
      notificationService.notifyVerifyEmail({ user, verifyUrl: 'https://encore.live/verify?token=abc' })
    ).not.toThrow();
    expect(() =>
      notificationService.notifyPasswordReset({ user, resetUrl: 'https://encore.live/reset?token=abc' })
    ).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it('notifyBookingCancelled, notifyEventCancelled, and notifyPaymentFailed each fire without throwing', async () => {
    expect(() => notificationService.notifyBookingCancelled({ user, booking: bookingFixture, refunded: true })).not.toThrow();
    expect(() => notificationService.notifyEventCancelled({ user, booking: bookingFixture, event: eventFixture })).not.toThrow();
    expect(() => notificationService.notifyPaymentFailed({ user, booking: bookingFixture })).not.toThrow();

    await new Promise((resolve) => setImmediate(resolve));
    expect(sendEmailMock).toHaveBeenCalledTimes(3);
    expect(sendSmsMock).toHaveBeenCalledTimes(3);
  });
});

describe('Confirming a booking end-to-end triggers exactly one notification pair (Phase 2.2 x Phase 3)', () => {
  beforeAll(async () => {
    await connectTestDB();
    paymentService = await import('../../src/services/paymentService.js');
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    jest.clearAllMocks();
  });

  async function seedConfirmedBookingScenario() {
    const venue = await Venue.create({
      name: 'Notify Hall',
      address: '1 Notify Ave',
      city: 'Colombo',
      seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
      capacity: 1,
    });
    const event = await Event.create({
      title: 'Notify Test Event',
      artist: 'Test Artist',
      genre: 'Rock',
      date: new Date(Date.now() + 86400000 * 3),
      basePrice: 50,
      venueRef: venue._id,
      seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, status: 'held', price: 50 }],
      status: 'scheduled',
    });
    const dbUser = await User.create({
      name: 'Notify User',
      email: 'notify@test.com',
      passwordHash: 'hash',
      phone: '94771234567',
      role: 'customer',
    });
    const booking = await Booking.create({
      reference: 'ENC-NOTIFY1',
      userRef: dbUser._id,
      eventRef: event._id,
      seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
      totalPrice: 50,
      status: 'pending',
      holdExpiresAt: new Date(Date.now() + 600000),
      payment: { provider: 'stripe', sessionId: 'cs_test_notify' },
    });

    return { venue, event, dbUser, booking };
  }

  it('handleCheckoutCompleted confirms the booking and fires exactly one email + one SMS', async () => {
    const { event, dbUser, booking } = await seedConfirmedBookingScenario();

    await paymentService.handleCheckoutCompleted({
      id: booking.payment.sessionId,
      payment_intent: 'pi_notify_1',
      amount_total: booking.totalPrice * 100,
      currency: 'lkr',
      metadata: { bookingId: booking._id.toString(), reference: booking.reference, userId: dbUser._id.toString() },
    });

    const updated = await Booking.findById(booking._id);
    expect(updated.status).toBe('confirmed');

    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent.seats.find((s) => s.id === 'A-1').status).toBe('booked');

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].to).toBe(dbUser.email);
    expect(sendSmsMock).toHaveBeenCalledTimes(1);
    expect(sendSmsMock.mock.calls[0][0]).toBe(dbUser.phone);
  });

  it('the booking is still confirmed even if both the email and SMS sends reject — notifications never block the confirmation', async () => {
    sendEmailMock.mockRejectedValueOnce(new Error('SMTP down'));
    sendSmsMock.mockRejectedValueOnce(new Error('notify.lk down'));

    const { dbUser, booking } = await seedConfirmedBookingScenario();

    await expect(
      paymentService.handleCheckoutCompleted({
        id: booking.payment.sessionId,
        payment_intent: 'pi_notify_2',
        amount_total: booking.totalPrice * 100,
        currency: 'lkr',
        metadata: { bookingId: booking._id.toString(), reference: booking.reference, userId: dbUser._id.toString() },
      })
    ).resolves.toBeUndefined();

    const updated = await Booking.findById(booking._id);
    expect(updated.status).toBe('confirmed');
  });
});
