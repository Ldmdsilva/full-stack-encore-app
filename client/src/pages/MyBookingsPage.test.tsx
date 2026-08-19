import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MyBookingsPage } from './MyBookingsPage'
import { renderPage } from '@/test/utils'
import { server } from '@/test/mocks/server'
import { bookingPending } from '@/test/fixtures'

describe('MyBookingsPage', () => {
  it('lists the current bookings', async () => {
    renderPage(<MyBookingsPage />, '/bookings')
    expect(await screen.findByText(bookingPending.reference)).toBeInTheDocument()
  })

  it('shows an empty state with no bookings', async () => {
    server.use(http.get('/api/bookings/me', () => HttpResponse.json({ bookings: [], total: 0, page: 1, totalPages: 1 })))
    renderPage(<MyBookingsPage />, '/bookings')
    expect(await screen.findByText(/haven't booked any concerts/i)).toBeInTheDocument()
  })

  it('cancels a pending booking through the confirmation modal', async () => {
    const user = userEvent.setup()
    renderPage(<MyBookingsPage />, '/bookings')
    await screen.findByText(bookingPending.reference)

    await user.click(screen.getAllByRole('button', { name: /cancel booking/i })[0])
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /yes, cancel/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
