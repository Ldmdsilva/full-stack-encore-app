import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/db.js';
import * as venueService from '../../src/services/venueService.js';

describe('services/venueService.js — additional coverage (updateVenue, edge guards)', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('createVenue rejects a non-array seatLayout with 400 VALIDATION_ERROR', async () => {
    await expect(
      venueService.createVenue({ name: 'Bad Layout Hall', address: '1 Bad Ave', city: 'Colombo', seatLayout: 'not-an-array' })
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('deleteVenue rejects a non-existent venue with 404 VENUE_NOT_FOUND', async () => {
    await expect(venueService.deleteVenue('64b64b64b64b64b64b64b64b')).rejects.toMatchObject({
      statusCode: 404,
      code: 'VENUE_NOT_FOUND',
    });
  });

  describe('updateVenue', () => {
    it('updates a mutable field without touching seatLayout/capacity', async () => {
      const venue = await venueService.createVenue({
        name: 'Update Hall',
        address: '1 Update Ave',
        city: 'Colombo',
        seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
      });

      const updated = await venueService.updateVenue(venue._id, { name: 'Renamed Hall' });
      expect(updated.name).toBe('Renamed Hall');
      expect(updated.capacity).toBe(1);
    });

    it('recomputes capacity when seatLayout is replaced', async () => {
      const venue = await venueService.createVenue({
        name: 'Resize Hall',
        address: '1 Resize Ave',
        city: 'Colombo',
        seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
      });

      const updated = await venueService.updateVenue(venue._id, {
        seatLayout: [
          { id: 'A-1', section: 'Main', row: 'A', number: 1 },
          { id: 'A-2', section: 'Main', row: 'A', number: 2 },
        ],
      });
      expect(updated.capacity).toBe(2);
    });

    it('rejects an empty seatLayout on update with 400 VALIDATION_ERROR', async () => {
      const venue = await venueService.createVenue({
        name: 'Empty Update Hall',
        address: '1 Empty Ave',
        city: 'Colombo',
        seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
      });

      await expect(venueService.updateVenue(venue._id, { seatLayout: [] })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    });

    it('rejects an oversized seatLayout on update with 400 CAPACITY_EXCEEDED', async () => {
      const venue = await venueService.createVenue({
        name: 'Oversize Update Hall',
        address: '1 Oversize Ave',
        city: 'Colombo',
        seatLayout: [{ id: 'A-1', section: 'Main', row: 'A', number: 1 }],
      });

      const massiveLayout = Array.from({ length: 501 }, (_, i) => ({ id: `S-${i}`, section: 'Main', row: 'A', number: i + 1 }));
      await expect(venueService.updateVenue(venue._id, { seatLayout: massiveLayout })).rejects.toMatchObject({
        statusCode: 400,
        code: 'CAPACITY_EXCEEDED',
      });
    });

    it('rejects updating a non-existent venue with 404 VENUE_NOT_FOUND', async () => {
      await expect(venueService.updateVenue('64b64b64b64b64b64b64b64b', { name: 'Ghost' })).rejects.toMatchObject({
        statusCode: 404,
        code: 'VENUE_NOT_FOUND',
      });
    });
  });
});
