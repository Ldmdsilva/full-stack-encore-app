/**
 * Serialize a Booking document into the public API shape.
 * `eventRef`/`userRef` may be a populated document, a bare ObjectId, or
 * absent — the serializer degrades to just the id string in that case.
 * @param {object} booking
 * @returns {object}
 */
export function serializeBooking(booking) {
  if (!booking) return null;
  const obj = typeof booking.toJSON === 'function' ? booking.toJSON() : booking;

  return {
    id: (obj.id ?? obj._id)?.toString(),
    reference: obj.reference,
    userId: serializeRefId(obj.userRef),
    user: serializePopulatedUser(obj.userRef),
    event: serializePopulatedEvent(obj.eventRef),
    // Showtime/Hold domain (ADR-014, additive) — parallel to `event` above,
    // which keeps working identically for legacy Event-based bookings.
    showtime: serializePopulatedShowtime(obj.showtimeRef),
    seats: (obj.seats || []).map((seat) => ({
      id: seat.id,
      section: seat.section,
      row: seat.row,
      number: seat.number,
      price: seat.price,
    })),
    totalPrice: obj.totalPrice,
    status: obj.status,
    holdExpiresAt: obj.holdExpiresAt ?? null,
    // Top-level, new-flow payment fields (ADR-014) — deliberately separate
    // from the nested `payment` object below, which stays as-is and is used
    // only by the legacy Checkout Session flow.
    paymentIntentId: obj.paymentIntentId ?? null,
    paymentStatus: obj.paymentStatus ?? null,
    payment: obj.payment
      ? {
          provider: obj.payment.provider,
          sessionId: obj.payment.sessionId ?? null,
          paymentIntentId: obj.payment.paymentIntentId ?? null,
          status: obj.payment.status ?? null,
          amountMinor: obj.payment.amountMinor ?? null,
          currency: obj.payment.currency ?? null,
          refundId: obj.payment.refundId ?? null,
        }
      : null,
    createdAt: obj.createdAt,
  };
}

function serializeRefId(ref) {
  if (!ref) return null;
  if (typeof ref === 'object' && (ref._id || ref.id)) {
    return (ref.id ?? ref._id).toString();
  }
  return ref.toString();
}

function serializePopulatedUser(userRef) {
  if (!userRef || typeof userRef !== 'object' || !userRef.name) return null;
  return {
    id: serializeRefId(userRef),
    name: userRef.name,
    email: userRef.email,
  };
}

function serializePopulatedEvent(eventRef) {
  if (!eventRef || typeof eventRef !== 'object' || !eventRef.title) return null;
  return {
    id: serializeRefId(eventRef),
    title: eventRef.title,
    artist: eventRef.artist,
    date: eventRef.date,
    status: eventRef.status,
  };
}

/**
 * Tolerant of a populated `showtimeRef` doc, a bare ObjectId, or absent —
 * same degrade-to-null-when-unpopulated pattern as `serializePopulatedEvent`
 * above. Doesn't require nested Film/Cinema population; only reports what's
 * actually available on the Showtime document itself.
 * @param {object} showtimeRef
 * @returns {object|null}
 */
function serializePopulatedShowtime(showtimeRef) {
  if (!showtimeRef || typeof showtimeRef !== 'object' || !showtimeRef.screenName) return null;
  return {
    id: serializeRefId(showtimeRef),
    screenName: showtimeRef.screenName,
    startsAt: showtimeRef.startsAt,
  };
}
