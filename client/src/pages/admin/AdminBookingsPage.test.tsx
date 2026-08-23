import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminBookingsPage } from './AdminBookingsPage'
import { renderPage } from '@/test/utils'
import { bookingConfirmed, bookingPending } from '@/test/fixtures'

describe('AdminBookingsPage', () => {
  it('lists all bookings and filters by status', async () => {
    const user = userEvent.setup()
    renderPage(<AdminBookingsPage />, '/admin/bookings')
    await screen.findByText(bookingPending.reference)
    expect(screen.getByText(bookingConfirmed.reference)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/status/i), 'confirmed')
    expect(screen.getByText(bookingConfirmed.reference)).toBeInTheDocument()
    expect(screen.queryByText(bookingPending.reference)).not.toBeInTheDocument()
  })

  it('filters by a text search across fan, ref and event', async () => {
    const user = userEvent.setup()
    renderPage(<AdminBookingsPage />, '/admin/bookings')
    await screen.findByText(bookingPending.reference)

    await user.type(screen.getByLabelText(/search \(this page\)/i), bookingPending.reference)
    expect(screen.getByText(bookingPending.reference)).toBeInTheDocument()
    expect(screen.queryByText(bookingConfirmed.reference)).not.toBeInTheDocument()
  })
})
