import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import * as venuesApi from './venues'

describe('venues api', () => {
  it('lists venues', async () => {
    const { venues } = await venuesApi.list()
    expect(venues.length).toBeGreaterThan(0)
  })

  it('fetches a single venue by id', async () => {
    const { venues } = await venuesApi.list()
    const { venue } = await venuesApi.getById(venues[0].id)
    expect(venue.id).toBe(venues[0].id)
  })

  it('rejects with VENUE_NOT_FOUND for an unknown id', async () => {
    await expect(venuesApi.getById('nope')).rejects.toMatchObject({ code: 'VENUE_NOT_FOUND' })
  })

  it('creates a venue', async () => {
    const { venue } = await venuesApi.create({
      name: 'New Hall',
      address: '1 Main St',
      city: 'Kandy',
      seatLayout: [{ id: 'A-1', section: 'STALLS', row: 'A', number: 1 }],
    })
    expect(venue.name).toBe('New Hall')
  })

  it('updates a venue', async () => {
    const { venues } = await venuesApi.list()
    const { venue } = await venuesApi.update(venues[0].id, { city: 'Jaffna' })
    expect(venue.city).toBe('Jaffna')
  })

  it('deletes a venue', async () => {
    const { venues } = await venuesApi.list()
    await expect(venuesApi.remove(venues[0].id)).resolves.toBeUndefined()
  })

  it('surfaces VENUE_IN_USE with a referencing-events count when deletion is blocked', async () => {
    server.use(
      http.delete('/api/venues/:id', () =>
        HttpResponse.json(
          { error: { code: 'VENUE_IN_USE', message: 'in use', details: { referencingEventsCount: 3 } } },
          { status: 409 },
        ),
      ),
    )
    await expect(venuesApi.remove('venue-1')).rejects.toMatchObject({
      code: 'VENUE_IN_USE',
      details: { referencingEventsCount: 3 },
    })
  })
})
