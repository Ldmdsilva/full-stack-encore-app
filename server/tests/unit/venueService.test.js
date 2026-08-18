import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import * as venueService from '../../src/services/venueService.js';
import Event from '../../src/models/Event.js';

describe('venueService Unit Tests (FR-22, ADR-002)', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('FR-22: creates a venue and computes capacity from layout', async () => {
    const venue = await venueService.createVenue({
      name: 'Electric Arena',
      address: '10 Rock Boulevard',
      seatLayout: [
        { id: 'S-1', section: 'Standing', row: 'GA', number: 1 },
        { id: 'S-2', section: 'Standing', row: 'GA', number: 2 },
      ],
    });

    expect(venue._id).toBeDefined();
    expect(venue.name).toBe('Electric Arena');
    expect(venue.capacity).toBe(2);
  });

  it('FR-22: rejects venue creation if seat layout exceeds 500 seats (ADR-002)', async () => {
    const massiveLayout = Array.from({ length: 501 }, (_, i) => ({
      id: `S-${i}`,
      section: 'Main',
      row: 'A',
      number: i + 1,
    }));

    await expect(
      venueService.createVenue({
        name: 'Huge Stadium',
        address: '99 Giant Ave',
        seatLayout: massiveLayout,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CAPACITY_EXCEEDED',
    });
  });

  it('FR-22: fetches venue by ID and lists all venues', async () => {
    const created = await venueService.createVenue({
      name: 'Acoustic Room',
      address: '5 Jazz Street',
      seatLayout: [{ id: 'J-1', section: 'Front', row: 'A', number: 1 }],
    });

    const found = await venueService.getVenueById(created._id);
    expect(found.name).toBe('Acoustic Room');

    const all = await venueService.getAllVenues();
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it('FR-22: prevents venue deletion when events reference it (409 Conflict)', async () => {
    const venue = await venueService.createVenue({
      name: 'Busy Venue',
      address: '22 Broadway',
      seatLayout: [{ id: 'B-1', section: 'Main', row: 'A', number: 1 }],
    });

    await Event.create({
      title: 'Referencing Concert',
      artist: 'Band X',
      date: new Date(Date.now() + 86400000),
      basePrice: 50,
      venueRef: venue._id,
      seats: [{ id: 'B-1', section: 'Main', row: 'A', number: 1, status: 'available', price: 50 }],
      status: 'scheduled',
    });

    await expect(venueService.deleteVenue(venue._id)).rejects.toMatchObject({
      statusCode: 409,
      code: 'VENUE_IN_USE',
    });
  });

  it('FR-22: successfully deletes unreferenced venue', async () => {
    const venue = await venueService.createVenue({
      name: 'Empty Venue',
      address: '1 Solitary Lane',
      seatLayout: [{ id: 'E-1', section: 'Main', row: 'A', number: 1 }],
    });

    await venueService.deleteVenue(venue._id);
    await expect(venueService.getVenueById(venue._id)).rejects.toMatchObject({
      statusCode: 404,
      code: 'VENUE_NOT_FOUND',
    });
  });
});
