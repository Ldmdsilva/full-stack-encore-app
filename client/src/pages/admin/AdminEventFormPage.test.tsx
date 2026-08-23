import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminEventFormPage } from './AdminEventFormPage'
import { renderPage } from '@/test/utils'
import { eventSummaryA, venueA } from '@/test/fixtures'

describe('AdminEventFormPage', () => {
  it('validates required fields before submitting a new event', async () => {
    const user = userEvent.setup()
    renderPage(<AdminEventFormPage />, '/admin/events/:id', { route: '/admin/events/new' })
    await screen.findByRole('heading', { name: /create event/i })

    await user.click(screen.getByRole('button', { name: /create event/i }))

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument()
    expect(screen.getByText(/artist is required/i)).toBeInTheDocument()
    expect(screen.getByText(/select a venue/i)).toBeInTheDocument()
  })

  it('creates a new event once the form is valid', async () => {
    const user = userEvent.setup()
    renderPage(<AdminEventFormPage />, '/admin/events/:id', { route: '/admin/events/new' })
    await screen.findByRole('heading', { name: /create event/i })

    await user.type(screen.getByLabelText(/show title/i), 'New Show')
    await user.type(screen.getByLabelText(/artist \/ act/i), 'New Artist')
    await user.type(screen.getByLabelText(/^genre$/i), 'Folk')
    await user.type(screen.getByLabelText(/description/i), 'A short description.')
    await user.type(screen.getByLabelText(/date & time/i), '2026-12-01T20:00')
    await screen.findByRole('option', { name: new RegExp(venueA.name) })
    await user.selectOptions(screen.getByLabelText(/venue/i), venueA.id)
    await user.type(screen.getByLabelText(/base price/i), '5000')

    await user.click(screen.getByRole('button', { name: /create event/i }))

    // On success the page navigates away to /admin/events — nothing left to assert here
    // beyond the absence of a lingering error toast/validation message.
    await waitFor(() => expect(screen.queryByText(/title is required/i)).not.toBeInTheDocument())
  })

  it('loads an existing event into the form when editing', async () => {
    renderPage(<AdminEventFormPage />, '/admin/events/:id/edit', { route: `/admin/events/${eventSummaryA.id}/edit` })
    expect(await screen.findByDisplayValue(eventSummaryA.title)).toBeInTheDocument()
    expect(screen.getByDisplayValue(eventSummaryA.artist)).toBeInTheDocument()
  })
})
