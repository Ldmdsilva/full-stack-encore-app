import { sendEmail } from './emailService.js';
import { sendSms } from './smsService.js';
import { logger } from '../../config/logger.js';
import { welcomeTemplate } from '../../templates/email/welcome.js';
import { bookingConfirmedTemplate } from '../../templates/email/bookingConfirmed.js';
import { bookingCancelledTemplate } from '../../templates/email/bookingCancelled.js';
import { eventCancelledTemplate } from '../../templates/email/eventCancelled.js';
import { paymentFailedTemplate } from '../../templates/email/paymentFailed.js';
import {
  bookingConfirmedSms,
  bookingCancelledSms,
  eventCancelledSms,
  paymentFailedSms,
} from '../../templates/sms.js';

/**
 * Notifications are called *after* the triggering database write commits,
 * and are always fire-and-forget from the caller's perspective — a dead
 * SMTP host or notify.lk outage must never turn a paid booking into a 500
 * (ADR-012). Every function below is safe to call without `await`.
 */

async function safely(label, work) {
  try {
    await work();
  } catch (error) {
    logger.error({ err: error }, `[Notification] ${label} failed`);
  }
}

export function notifyWelcome(user) {
  safely('welcome email', async () => {
    const { subject, html, text } = welcomeTemplate({ name: user.name });
    await sendEmail({ to: user.email, subject, html, text });
  });
}

export function notifyBookingConfirmed({ user, booking, event, venue }) {
  safely('booking-confirmed email', async () => {
    const { subject, html, text } = bookingConfirmedTemplate({ booking, event, venue });
    await sendEmail({ to: user.email, subject, html, text });
  });
  safely('booking-confirmed sms', async () => {
    await sendSms(user.phone, bookingConfirmedSms({ booking, event, venue }));
  });
}

export function notifyBookingCancelled({ user, booking, refunded }) {
  safely('booking-cancelled email', async () => {
    const { subject, html, text } = bookingCancelledTemplate({ booking, refunded });
    await sendEmail({ to: user.email, subject, html, text });
  });
  safely('booking-cancelled sms', async () => {
    await sendSms(user.phone, bookingCancelledSms({ booking }));
  });
}

export function notifyEventCancelled({ user, booking, event }) {
  safely('event-cancelled email', async () => {
    const { subject, html, text } = eventCancelledTemplate({ event, booking });
    await sendEmail({ to: user.email, subject, html, text });
  });
  safely('event-cancelled sms', async () => {
    await sendSms(user.phone, eventCancelledSms({ event, booking }));
  });
}

export function notifyPaymentFailed({ user, booking }) {
  safely('payment-failed email', async () => {
    const { subject, html, text } = paymentFailedTemplate({ booking });
    await sendEmail({ to: user.email, subject, html, text });
  });
  safely('payment-failed sms', async () => {
    await sendSms(user.phone, paymentFailedSms({ booking }));
  });
}
