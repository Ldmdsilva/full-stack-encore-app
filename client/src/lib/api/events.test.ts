import { describe, expect, it } from 'vitest'
import * as eventsApi from './events'
import { eventSummaryA } from '@/test/fixtures'

describe('events api', () => {
  it('lists events with pagination metadata', async () => {
    const result = await eventsApi.list({ page: 1, limit: 10 })
    expect(result.events.length).toBeGreaterThan(0)
  })

  it('fetches an event with its seats', async () => {
    const { event, seats } = await eventsApi.getById(eventSummaryA.id)
    expect(event.id).toBe(eventSummaryA.id)
    expect(seats.length).toBeGreaterThan(0)
  })

  it('rejects with EVENT_NOT_FOUND for an unknown id', async () => {
    await expect(eventsApi.getById('nope')).rejects.toMatchObject({ code: 'EVENT_NOT_FOUND' })
  })

  it('creates an event', async () => {
    const { event } = await eventsApi.create({
      title: 'New Show',
      artist: 'New Artist',
      genre: 'Folk',
      description: 'desc',
      date: '2026-12-01T20:00:00.000Z',
      basePrice: 5000,
      venueRef: 'venue-1',
    })
    expect(event.title).toBe('New Show')
  })

  it('updates an event', async () => {
    const { event } = await eventsApi.update(eventSummaryA.id, { status: 'cancelled' })
    expect(event.status).toBe('cancelled')
  })

  it('deletes an event', async () => {
    await expect(eventsApi.remove(eventSummaryA.id)).resolves.toBeUndefined()
  })
})
