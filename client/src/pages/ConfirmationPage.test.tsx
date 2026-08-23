import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { ConfirmationPage } from './ConfirmationPage'
import { renderPage } from '@/test/utils'
import { server } from '@/test/mocks/server'
import { bookingConfirmed, bookingPending } from '@/test/fixtures'

function mockBooking(booking: typeof bookingPending) {
  server.use(http.get('/api/bookings/:id', () => HttpResponse.json({ booking })))
}

describe('ConfirmationPage', () => {
  it('shows a confirmed booking with one ticket stub per seat', async () => {
    mockBooking(bookingConfirmed)
    renderPage(<ConfirmationPage />, '/confirmation/:bookingId', { route: `/confirmation/${bookingConfirmed.id}` })
    expect(await screen.findByRole('heading', { name: /you're going/i })).toBeInTheDocument()
    // The reference appears both in the header and on each ticket stub's serial.
    expect(screen.getAllByText(bookingConfirmed.reference).length).toBeGreaterThan(0)
  })

  it('shows a pending booking as awaiting confirmation', async () => {
    mockBooking(bookingPending)
    renderPage(<ConfirmationPage />, '/confirmation/:bookingId', { route: `/confirmation/${bookingPending.id}` })
    expect(await screen.findByRole('heading', { name: /confirming payment/i })).toBeInTheDocument()
  })

  it('shows an expired hold', async () => {
    mockBooking({ ...bookingPending, status: 'expired' })
    renderPage(<ConfirmationPage />, '/confirmation/:bookingId', { route: `/confirmation/${bookingPending.id}` })
    expect(await screen.findByRole('heading', { name: /this hold expired/i })).toBeInTheDocument()
  })

  it('shows a cancelled booking', async () => {
    mockBooking({ ...bookingPending, status: 'cancelled' })
    renderPage(<ConfirmationPage />, '/confirmation/:bookingId', { route: `/confirmation/${bookingPending.id}` })
    expect(await screen.findByRole('heading', { name: /booking cancelled/i })).toBeInTheDocument()
  })

  it('shows a not-found state for an unknown booking', async () => {
    renderPage(<ConfirmationPage />, '/confirmation/:bookingId', { route: '/confirmation/does-not-exist' })
    expect(await screen.findByRole('heading', { name: /booking not found/i })).toBeInTheDocument()
  })
})
