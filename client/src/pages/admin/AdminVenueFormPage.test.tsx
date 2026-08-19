import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminVenueFormPage } from './AdminVenueFormPage'
import { renderPage } from '@/test/utils'
import { venueA } from '@/test/fixtures'

describe('AdminVenueFormPage', () => {
  it('validates required fields before submitting a new venue', async () => {
    const user = userEvent.setup()
    renderPage(<AdminVenueFormPage />, '/admin/venues/:id', { route: '/admin/venues/new' })
    await screen.findByRole('heading', { name: /create venue/i })

    await user.click(screen.getByRole('button', { name: /create venue/i }))

    expect(await screen.findByText(/venue name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/city is required/i)).toBeInTheDocument()
  })

  it('rejects a seat layout over the 500-seat limit', async () => {
    const user = userEvent.setup()
    renderPage(<AdminVenueFormPage />, '/admin/venues/:id', { route: '/admin/venues/new' })
    await screen.findByRole('heading', { name: /create venue/i })

    await user.type(screen.getByLabelText(/venue name/i), 'Big Arena')
    await user.type(screen.getByLabelText(/^city$/i), 'Colombo')
    await user.type(screen.getByLabelText(/full address/i), '1 Main St')

    const seatsPerRowInputs = screen.getAllByLabelText(/seats per row/i)
    await user.clear(seatsPerRowInputs[0])
    await user.type(seatsPerRowInputs[0], '50')
    const rowsInputs = screen.getAllByLabelText(/rows \(comma-sep\)/i)
    await user.clear(rowsInputs[0])
    await user.type(rowsInputs[0], 'A,B,C,D,E,F,G,H,J,K,L')

    await user.click(screen.getByRole('button', { name: /create venue/i }))
    expect(await screen.findByText(/exceeds the 500-seat limit/i)).toBeInTheDocument()
  })

  it('creates a venue with the default seat sections', async () => {
    const user = userEvent.setup()
    renderPage(<AdminVenueFormPage />, '/admin/venues/:id', { route: '/admin/venues/new' })
    await screen.findByRole('heading', { name: /create venue/i })

    await user.type(screen.getByLabelText(/venue name/i), 'Small Hall')
    await user.type(screen.getByLabelText(/^city$/i), 'Galle')
    await user.type(screen.getByLabelText(/full address/i), '1 Main St')

    await user.click(screen.getByRole('button', { name: /create venue/i }))
    await waitFor(() => expect(screen.queryByText(/venue name is required/i)).not.toBeInTheDocument())
  })

  it('loads an existing venue into the form when editing', async () => {
    renderPage(<AdminVenueFormPage />, '/admin/venues/:id/edit', { route: `/admin/venues/${venueA.id}/edit` })
    expect(await screen.findByDisplayValue(venueA.name)).toBeInTheDocument()
    expect(screen.getByDisplayValue(venueA.city)).toBeInTheDocument()
  })

  it('adds and removes seat sections', async () => {
    const user = userEvent.setup()
    renderPage(<AdminVenueFormPage />, '/admin/venues/:id', { route: '/admin/venues/new' })
    await screen.findByRole('heading', { name: /create venue/i })

    const before = screen.getAllByLabelText(/section code/i).length
    await user.click(screen.getByRole('button', { name: /add section/i }))
    expect(screen.getAllByLabelText(/section code/i)).toHaveLength(before + 1)

    await user.click(screen.getAllByTitle('Remove section')[0])
    expect(screen.getAllByLabelText(/section code/i)).toHaveLength(before)
  })
})
