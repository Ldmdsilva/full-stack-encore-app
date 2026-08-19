import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { AdminVenuesPage } from './AdminVenuesPage'
import { renderPage } from '@/test/utils'
import { server } from '@/test/mocks/server'
import { venueA, venueB } from '@/test/fixtures'

describe('AdminVenuesPage', () => {
  it('lists venues with a search filter', async () => {
    const user = userEvent.setup()
    renderPage(<AdminVenuesPage />, '/admin/venues')
    await screen.findByText(venueA.name)
    expect(screen.getByText(venueB.name)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/search venues/i), venueA.city)
    expect(screen.getByText(venueA.name)).toBeInTheDocument()
    expect(screen.queryByText(venueB.name)).not.toBeInTheDocument()
  })

  it('surfaces VENUE_IN_USE instead of deleting when the venue has events', async () => {
    server.use(
      http.delete('/api/venues/:id', () =>
        HttpResponse.json(
          { error: { code: 'VENUE_IN_USE', message: 'in use', details: { referencingEventsCount: 2 } } },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage(<AdminVenuesPage />, '/admin/venues')
    await screen.findByText(venueA.name)

    await user.click(screen.getAllByTitle('Delete venue')[0])
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^delete venue$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/2 events reference this venue/i))
  })
})
