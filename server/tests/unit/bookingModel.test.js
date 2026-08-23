import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import mongoose from 'mongoose';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import Booking from '../../src/models/Booking.js';

/**
 * Booking model — cross-reference validation and new sparse-unique fields
 * added additively for the showtime/hold-based flow (ADR-014, Phase P5
 * stage 1). The legacy Event-flow shape (eventRef, no showtimeRef) must
 * continue to validate exactly as before — that is the critical regression
 * check here.
 */
describe('models/Booking.js (ADR-014 additive fields)', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  function baseFields(overrides = {}) {
    return {
      reference: `ENC-${new mongoose.Types.ObjectId().toString().slice(-6)}`,
      userRef: new mongoose.Types.ObjectId(),
      seats: [{ id: 'A-1', section: 'Main', row: 'A', number: 1, price: 50 }],
      totalPrice: 50,
      ...overrides,
    };
  }

  describe('exactly-one-of eventRef/showtimeRef invariant', () => {
    it('validates fine with only eventRef set (legacy shape — regression check)', async () => {
      const booking = new Booking(baseFields({ eventRef: new mongoose.Types.ObjectId() }));
      await expect(booking.validate()).resolves.toBeUndefined();
    });

    it('validates fine with only showtimeRef set (new shape)', async () => {
      const booking = new Booking(baseFields({ showtimeRef: new mongoose.Types.ObjectId() }));
      await expect(booking.validate()).resolves.toBeUndefined();
    });

    it('fails validation when both eventRef and showtimeRef are set', async () => {
      const booking = new Booking(
        baseFields({ eventRef: new mongoose.Types.ObjectId(), showtimeRef: new mongoose.Types.ObjectId() })
      );
      await expect(booking.validate()).rejects.toThrow(/Exactly one of eventRef or showtimeRef/);
    });

    it('fails validation when neither eventRef nor showtimeRef is set', async () => {
      const booking = new Booking(baseFields());
      await expect(booking.validate()).rejects.toThrow(/Exactly one of eventRef or showtimeRef/);
    });
  });

  describe('holdRef sparse-unique index', () => {
    it('allows two bookings that both omit holdRef to coexist', async () => {
      await Booking.create(baseFields({ eventRef: new mongoose.Types.ObjectId() }));
      await expect(
        Booking.create(baseFields({ eventRef: new mongoose.Types.ObjectId() }))
      ).resolves.toBeDefined();
    });

    it('rejects a second booking sharing the same holdRef', async () => {
      const holdRef = new mongoose.Types.ObjectId();
      await Booking.create(baseFields({ showtimeRef: new mongoose.Types.ObjectId(), holdRef }));
      await expect(
        Booking.create(baseFields({ showtimeRef: new mongoose.Types.ObjectId(), holdRef }))
      ).rejects.toMatchObject({ code: 11000 });
    });
  });

  describe('paymentIntentId (top-level) sparse-unique index', () => {
    it('allows two bookings that both omit the top-level paymentIntentId to coexist', async () => {
      await Booking.create(baseFields({ eventRef: new mongoose.Types.ObjectId() }));
      await expect(
        Booking.create(baseFields({ eventRef: new mongoose.Types.ObjectId() }))
      ).resolves.toBeDefined();
    });

    it('rejects a second booking sharing the same top-level paymentIntentId', async () => {
      await Booking.create(
        baseFields({ showtimeRef: new mongoose.Types.ObjectId(), paymentIntentId: 'pi_shared_1' })
      );
      await expect(
        Booking.create(baseFields({ showtimeRef: new mongoose.Types.ObjectId(), paymentIntentId: 'pi_shared_1' }))
      ).rejects.toMatchObject({ code: 11000 });
    });

    it('does not collide with the legacy nested payment.paymentIntentId field', async () => {
      await Booking.create(
        baseFields({
          eventRef: new mongoose.Types.ObjectId(),
          payment: { provider: 'stripe', paymentIntentId: 'pi_legacy_nested' },
        })
      );
      await expect(
        Booking.create(
          baseFields({
            eventRef: new mongoose.Types.ObjectId(),
            payment: { provider: 'stripe', paymentIntentId: 'pi_legacy_nested' },
          })
        )
      ).resolves.toBeDefined();
    });
  });

  describe('paymentStatus default', () => {
    it('is left undefined/absent on a legacy-shaped booking rather than defaulting', async () => {
      const booking = await Booking.create(baseFields({ eventRef: new mongoose.Types.ObjectId() }));
      expect(booking.paymentStatus).toBeUndefined();
    });
  });
});
