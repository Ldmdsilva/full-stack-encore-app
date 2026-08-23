import { formatLkr, formatEventDateTime } from '../utils/currency.js';

/**
 * All SMS copy leads with the brand name — notify.lk requires the app/brand
 * to appear in the message content for delivery — and carries no OTP-style
 * content (the DEMO sender gets suspended for that).
 */

export function bookingConfirmedSms({ booking, event, venue }) {
  const seatList = booking.seats.map((seat) => `${seat.row}-${seat.number}`).join(', ');
  const venueLabel = venue ? venue.name : '';
  return `Encore: Booking ${booking.reference} confirmed. ${event.artist}, ${formatEventDateTime(event.date)}, ${venueLabel}. Seats ${seatList}. Total ${formatLkr(booking.totalPrice)}. Show this reference at the door.`;
}

export function bookingCancelledSms({ booking }) {
  return `Encore: Booking ${booking.reference} cancelled. ${formatLkr(booking.totalPrice)} will be refunded to your card within 5-10 days.`;
}

export function eventCancelledSms({ event, booking }) {
  const dateLabel = new Date(event.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
  return `Encore: ${event.artist} on ${dateLabel} is cancelled. Booking ${booking.reference} is refunded in full.`;
}

export function paymentFailedSms({ booking }) {
  return `Encore: Payment for booking ${booking.reference} did not go through. Your seats are still held — retry from checkout before the hold expires.`;
}
