import * as holdService from '../services/holdService.js';

/**
 * POST /api/holds (§C7.1). Creates the Hold only — no Stripe call (D12).
 * Response shape matches the SRS contract exactly: `{holdId, expiresAt,
 * amountMinor, currency}`.
 */
export async function createHold(req, res, next) {
  try {
    const { showtimeId, seatIds } = req.body;
    const hold = await holdService.createHold({ userId: req.user.id, showtimeId, seatIds });
    return res.status(201).json({
      holdId: hold._id.toString(),
      expiresAt: hold.expiresAt,
      amountMinor: hold.amountMinor,
      currency: hold.currency,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/holds/:id. Not itself part of §C7.1's documented table, but
 * needed for a client to reload/reconcile an in-progress hold (e.g. after a
 * page refresh) without re-deriving state purely from sockets.
 */
export async function getHold(req, res, next) {
  try {
    const hold = await holdService.getHoldById(req.params.id, {
      userId: req.user.id,
      role: req.user.role,
    });
    return res.status(200).json({
      holdId: hold._id.toString(),
      showtimeId: hold.showtimeRef.toString(),
      seatIds: hold.seatIds,
      seatSnapshot: hold.seatSnapshot,
      totalPrice: hold.totalPrice,
      amountMinor: hold.amountMinor,
      currency: hold.currency,
      status: hold.status,
      expiresAt: hold.expiresAt,
      paymentIntentId: hold.paymentIntentId || null,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/holds/:id/payment-intent (§C7.1, D12). Creates (or, on retry,
 * re-retrieves) the Stripe PaymentIntent for an existing hold — a distinct
 * follow-up call from hold creation.
 */
export async function createPaymentIntentForHold(req, res, next) {
  try {
    const result = await holdService.createPaymentIntentForHold({
      holdId: req.params.id,
      userId: req.user.id,
    });
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/holds/:id (§C7.1). Releases the hold's seats; 204 with no
 * body, matching the SRS contract exactly. Idempotent.
 */
export async function releaseHold(req, res, next) {
  try {
    await holdService.releaseHold({
      holdId: req.params.id,
      userId: req.user.id,
      role: req.user.role,
    });
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
}
