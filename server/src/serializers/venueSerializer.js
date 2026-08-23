/**
 * Serialize a Venue document (or plain object) into the public API shape.
 * @param {object} venue
 * @returns {object}
 */
export function serializeVenue(venue) {
  if (!venue) return null;
  const obj = typeof venue.toJSON === 'function' ? venue.toJSON() : venue;

  return {
    id: (obj.id ?? obj._id)?.toString(),
    name: obj.name,
    address: obj.address,
    city: obj.city,
    capacity: obj.capacity,
    seatLayout: obj.seatLayout,
  };
}

/**
 * Serialize a venue reference down to the compact shape embedded in events/bookings.
 * @param {object} venue
 * @returns {{ id: string, name: string, city: string } | null}
 */
export function serializeVenueRef(venue) {
  if (!venue) return null;
  const obj = typeof venue.toJSON === 'function' ? venue.toJSON() : venue;

  return {
    id: (obj.id ?? obj._id)?.toString(),
    name: obj.name,
    city: obj.city,
  };
}
