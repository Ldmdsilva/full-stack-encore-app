import * as paymentService from '../services/paymentService.js';
import { serializeBooking } from '../serializers/bookingSerializer.js';
import { logger } from '../config/logger.js';

export async function createPaymentSession(req, res, next) {
  try {
    const result = await paymentService.createPaymentSessionForBooking({
      bookingId: req.params.id,
      userId: req.user.id,
    });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Reconcile a booking's payment status directly against Stripe (no webhook
 * required) — called by the client in place of a passive booking-status
 * poll while a checkout is `pending`.
 */
export async function confirmPayment(req, res, next) {
  try {
    const booking = await paymentService.reconcileCheckoutSession({
      bookingId: req.params.id,
      userId: req.user.id,
      role: req.user.role,
    });
    return res.status(200).json({ booking: serializeBooking(booking) });
  } catch (error) {
    next(error);
  }
}

/**
 * Stripe webhook receiver (ADR-011). Mounted with `express.raw()` so the
 * body reaches `verifyWebhookSignature` untouched by the JSON parser.
 */
export async function handleWebhook(req, res) {
  let stripeEvent;
  try {
    stripeEvent = paymentService.verifyWebhookSignature(req.body, req.headers['stripe-signature']);
  } catch (error) {
    logger.warn({ err: error }, '[Webhook] Signature verification failed');
    return res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid Stripe webhook signature' } });
  }

  try {
    const isFirstDelivery = await paymentService.recordWebhookEvent(stripeEvent);
    if (!isFirstDelivery) {
      return res.status(200).json({ received: true }); // replayed event — already processed
    }

    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await paymentService.handleCheckoutCompleted(stripeEvent.data.object);
        break;
      case 'payment_intent.succeeded':
        await paymentService.handlePaymentIntentSucceeded(stripeEvent.data.object);
        break;
      case 'payment_intent.payment_failed':
        await paymentService.handlePaymentFailed(stripeEvent.data.object);
        break;
      case 'checkout.session.expired':
        await paymentService.handleCheckoutExpired(stripeEvent.data.object);
        break;
      case 'charge.refunded':
        await paymentService.handleChargeRefunded(stripeEvent.data.object);
        break;
      default:
        break; // event types we don't act on
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    logger.error({ err: error, eventType: stripeEvent.type }, '[Webhook] Handler failed');
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to process webhook event' } });
  }
}
