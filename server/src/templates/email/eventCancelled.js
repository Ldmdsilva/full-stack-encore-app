import { emailLayout } from './layout.js';
import { formatLkr, formatEventDateTime } from '../../utils/currency.js';

/**
 * @param {{ event: object, booking: object }} params
 * @returns {{ subject: string, html: string, text: string }}
 */
export function eventCancelledTemplate({ event, booking }) {
  const dateLabel = formatEventDateTime(event.date);
  const total = formatLkr(booking.totalPrice);
  const text = `${event.title} on ${dateLabel} is cancelled. Booking ${booking.reference} is refunded in full (${total}).`;
  const bodyHtml = `<p style="color:#F5F1EA;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;">${text}</p>`;

  return {
    subject: `${event.title} has been cancelled`,
    html: emailLayout({ title: 'Event cancelled', bodyHtml }),
    text,
  };
}
