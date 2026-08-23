import { describe, expect, it } from 'vitest'
import * as bookingsApi from './bookings'
import { bookingConfirmed, bookingPending } from '@/test/fixtures'

describe('bookings api', () => {
  it('lists the current user’s bookings', async () => {
    const result = await bookingsApi.listMine({ page: 1, limit: 10 })
    expect(result.bookings.map((b) => b.id)).toContain(bookingPending.id)
  })

  it('lists all bookings (admin)', async () => {
    const result = await bookingsApi.listAll({ page: 1, limit: 10 })
    expect(result.bookings.length).toBeGreaterThan(0)
  })

  it('fetches a booking by id', async () => {
    const { booking } = await bookingsApi.getById(bookingConfirmed.id)
    expect(booking.reference).toBe(bookingConfirmed.reference)
  })

  it('rejects with BOOKING_NOT_FOUND for an unknown id', async () => {
    await expect(bookingsApi.getById('nope')).rejects.toMatchObject({ code: 'BOOKING_NOT_FOUND' })
  })

  it('cancels a booking', async () => {
    const { booking } = await bookingsApi.cancel(bookingPending.id)
    expect(booking.status).toBe('cancelled')
  })

  it('creates a booking and receives a payment client secret', async () => {
    const result = await bookingsApi.create({ eventId: 'event-1', seatIds: ['A-1'] })
    expect(result.booking).toBeTruthy()
    expect(result.clientSecret).toBeTruthy()
  })
})
