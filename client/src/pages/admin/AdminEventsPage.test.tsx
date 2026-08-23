import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminEventsPage } from './AdminEventsPage'
import { renderPage } from '@/test/utils'
import { adminEventA, adminEventB } from '@/test/fixtures'

describe('AdminEventsPage', () => {
  it('lists events with a search filter', async () => {
    const user = userEvent.setup()
    renderPage(<AdminEventsPage />, '/admin/events')
    await screen.findByText(adminEventA.title)
    expect(screen.getByText(adminEventB.title)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/search events/i), adminEventA.artist)
    expect(screen.getByText(adminEventA.title)).toBeInTheDocument()
    expect(screen.queryByText(adminEventB.title)).not.toBeInTheDocument()
  })

  it('opens and cancels the delete confirmation modal', async () => {
    const user = userEvent.setup()
    renderPage(<AdminEventsPage />, '/admin/events')
    await screen.findByText(adminEventA.title)

    await user.click(screen.getAllByTitle('Delete event')[0])
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('toggles an event between scheduled and cancelled', async () => {
    const user = userEvent.setup()
    renderPage(<AdminEventsPage />, '/admin/events')
    await screen.findByText(adminEventA.title)

    await user.click(screen.getAllByTitle(/cancel event|re-schedule event/i)[0])
    await waitFor(() => expect(screen.getAllByTitle(/cancel event|re-schedule event/i)[0]).toBeEnabled())
  })
})
