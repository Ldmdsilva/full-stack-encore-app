import { emailLayout } from './layout.js';
import { formatLkr } from '../../utils/currency.js';

/**
 * @param {{ booking: object }} params
 * @returns {{ subject: string, html: string, text: string }}
 */
export function paymentFailedTemplate({ booking }) {
  const total = formatLkr(booking.totalPrice);
  const text = `Payment for booking ${booking.reference} (${total}) did not go through. Your seats are still held — return to checkout to try again before the hold expires.`;
  const bodyHtml = `<p style="color:#F5F1EA;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;">${text}</p>`;

  return {
    subject: `Payment failed — ${booking.reference}`,
    html: emailLayout({ title: 'Payment failed', bodyHtml }),
    text,
  };
}
