import Venue from '../models/Venue.js';
import Event from '../models/Event.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Retrieve all venues (FR-22)
 * @returns {Promise<Array>}
 */
export async function getAllVenues() {
  const venues = await Venue.find().sort({ name: 1 });
  return venues;
}

/**
 * Retrieve a single venue by ID (FR-22)
 * @param {string} id
 * @returns {Promise<object>}
 */
export async function getVenueById(id) {
  const venue = await Venue.findById(id);
  if (!venue) {
    throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
  }
  return venue;
}

/**
 * Create a new venue with seat layout (FR-22, ADR-002)
 * @param {object} venueData
 * @param {string} venueData.name
 * @param {string} venueData.address
 * @param {Array} venueData.seatLayout
 * @returns {Promise<object>}
 */
export async function createVenue({ name, address, city, seatLayout }) {
  if (!name || !address || !city || !seatLayout) {
    throw new AppError('Name, address, city, and seatLayout are required', 400, 'VALIDATION_ERROR');
  }

  if (!Array.isArray(seatLayout) || seatLayout.length === 0) {
    throw new AppError('Seat layout must be a non-empty array', 400, 'VALIDATION_ERROR');
  }

  if (seatLayout.length > 500) {
    throw new AppError('Seat layout cannot exceed 500 seats (ADR-002)', 400, 'CAPACITY_EXCEEDED');
  }

  const venue = await Venue.create({
    name: name.trim(),
    address: address.trim(),
    city: city.trim(),
    seatLayout,
    capacity: seatLayout.length,
  });

  return venue;
}

/**
 * Update an existing venue (FR-22)
 * @param {string} id
 * @param {object} updateData
 * @returns {Promise<object>}
 */
export async function updateVenue(id, updateData) {
  if (updateData.seatLayout) {
    if (!Array.isArray(updateData.seatLayout) || updateData.seatLayout.length === 0) {
      throw new AppError('Seat layout must be a non-empty array', 400, 'VALIDATION_ERROR');
    }
    if (updateData.seatLayout.length > 500) {
      throw new AppError('Seat layout cannot exceed 500 seats', 400, 'CAPACITY_EXCEEDED');
    }
    updateData.capacity = updateData.seatLayout.length;
  }

  const venue = await Venue.findByIdAndUpdate(id, updateData, {
    returnDocument: 'after',
    runValidators: true,
  });

  if (!venue) {
    throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
  }

  return venue;
}

/**
 * Delete a venue (FR-22)
 * Blocks deletion if any events reference this venue (§C7.1)
 * @param {string} id
 */
export async function deleteVenue(id) {
  const venue = await Venue.findById(id);
  if (!venue) {
    throw new AppError('Venue not found', 404, 'VENUE_NOT_FOUND');
  }

  const referencingEvents = await Event.countDocuments({ venueRef: id });
  if (referencingEvents > 0) {
    throw new AppError(
      'Cannot delete venue because one or more events reference it',
      409,
      'VENUE_IN_USE',
      { referencingEventsCount: referencingEvents }
    );
  }

  await Venue.findByIdAndDelete(id);
}
