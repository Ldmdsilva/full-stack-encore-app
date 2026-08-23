import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { axe } from 'jest-axe'
import { EventListPage } from '@/pages/EventListPage'
import { EventDetailPage } from '@/pages/EventDetailPage'
import { LoginPage } from '@/pages/LoginPage'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { renderPage } from '@/test/utils'
import { eventSummaryA } from '@/test/fixtures'

const EVENT_ID = eventSummaryA.id

describe('accessibility (jest-axe)', () => {
  it('EventListPage has no axe violations once loaded', async () => {
    const { container } = renderPage(<EventListPage />, '/events')
    await screen.findByText(/phoebe wren/i)

    expect(await axe(container)).toHaveNoViolations()
  })

  it('EventDetailPage has no axe violations once the seat map loads', async () => {
    const { container } = renderPage(<EventDetailPage />, '/events/:id', { route: `/events/${EVENT_ID}` })
    await screen.findByRole('group', { name: /seat selection map/i })

    expect(await axe(container)).toHaveNoViolations()
  })

  it('LoginPage has no axe violations, in both sign-in and register mode', async () => {
    const { container, unmount } = renderPage(<LoginPage />, '/login')
    await screen.findByRole('heading', { name: /sign in to encore/i })
    expect(await axe(container)).toHaveNoViolations()
    unmount()

    const { container: registerContainer } = renderPage(<LoginPage />, '/register')
    await screen.findByRole('heading', { name: /create an account/i })
    expect(await axe(registerContainer)).toHaveNoViolations()
  })

  it('CheckoutPage has no axe violations for a live seat selection', async () => {
    sessionStorage.setItem(`encore_selection_${EVENT_ID}`, JSON.stringify(['A-1']))
    const { container } = renderPage(<CheckoutPage />, '/checkout/:eventId', { route: `/checkout/${EVENT_ID}` })
    await waitFor(() => expect(screen.getByRole('heading', { name: /checkout/i })).toBeInTheDocument())

    expect(await axe(container)).toHaveNoViolations()
  })
})
