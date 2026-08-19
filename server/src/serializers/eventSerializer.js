import { serializeVenueRef } from './venueSerializer.js';

/**
 * Serialize an Event document into the public summary shape shared by
 * event listings and the `event` half of the event-detail envelope.
 * Derives `availableSeats`/`totalSeats` from the seat array and never
 * includes the seat array itself — callers that need seats use
 * `serializeSeats` separately (§C7.1 keeps `{ event, seats }` distinct).
 * @param {object} event
 * @returns {object}
 */
export function serializeEventSummary(event) {
  if (!event) return null;
  const obj = typeof event.toJSON === 'function' ? event.toJSON() : event;
  const seats = obj.seats || [];

  return {
    id: (obj.id ?? obj._id)?.toString(),
    title: obj.title,
    artist: obj.artist,
    genre: obj.genre,
    imageUrl: obj.imageUrl,
    description: obj.description,
    date: obj.date,
    basePrice: obj.basePrice,
    venue: serializeVenueRef(obj.venueRef),
    status: obj.status,
    totalSeats: seats.length,
    availableSeats: seats.filter((s) => s.status === 'available').length,
  };
}

/**
 * Serialize an event's seat array for the `seats` half of the
 * event-detail envelope.
 * @param {Array<object>} seats
 * @returns {Array<object>}
 */
export function serializeSeats(seats = []) {
  return seats.map((seat) => ({
    id: seat.id,
    section: seat.section,
    row: seat.row,
    number: seat.number,
    status: seat.status,
    price: seat.price,
  }));
}
