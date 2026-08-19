import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { CheckoutPage } from './CheckoutPage'
import { renderRoutes } from '@/test/utils'
import { server } from '@/test/mocks/server'
import { eventSummaryA } from '@/test/fixtures'

const EVENT_ID = eventSummaryA.id

function EventDetailStub() {
  return <p>event-detail-page</p>
}

function renderCheckout() {
  return renderRoutes(
    [
      { path: '/checkout/:eventId', element: <CheckoutPage /> },
      { path: '/events/:id', element: <EventDetailStub /> },
    ],
    { route: `/checkout/${EVENT_ID}` },
  )
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('redirects back to the seat map when there is no selection and no booking', async () => {
    renderCheckout()
    await waitFor(() => expect(screen.getByText('event-detail-page')).toBeInTheDocument())
  })

  it('shows the seat conflict on a 409 and re-fetches the event without resubmitting the booking', async () => {
    sessionStorage.setItem(`encore_selection_${EVENT_ID}`, JSON.stringify(['A-1']))

    let getEventCalls = 0
    let createBookingCalls = 0
    server.use(
      http.get(`/api/events/:id`, () => {
        getEventCalls += 1
        return HttpResponse.json({
          event: eventSummaryA,
          seats: [{ id: 'A-1', section: 'STALLS', row: 'A', number: 1, status: 'available', price: 6500 }],
        })
      }),
      http.post('/api/bookings', () => {
        createBookingCalls += 1
        return HttpResponse.json(
          {
            error: {
              code: 'SEAT_UNAVAILABLE',
              message: 'Those seats were just taken.',
              details: { seatIds: ['A-1'] },
            },
          },
          { status: 409 },
        )
      }),
    )

    const user = userEvent.setup()
    renderCheckout()

    const payButton = await screen.findByRole('button', { name: /continue to pay/i })
    expect(getEventCalls).toBe(1)

    await user.click(payButton)

    expect(await screen.findByText(/that seat was just taken/i)).toBeInTheDocument()
    expect(screen.getAllByText('A-1', { exact: false }).length).toBeGreaterThan(0)

    // Re-fetches the seat map to resync (retry()) but never resubmits the hold.
    await waitFor(() => expect(getEventCalls).toBe(2))
    expect(createBookingCalls).toBe(1)

    // Nothing auto-retries the POST once the re-fetch settles.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(createBookingCalls).toBe(1)
  })

  it('clears an expired hold and returns to the seat map instead of resuming it', async () => {
    sessionStorage.setItem(`encore_booking_${EVENT_ID}`, 'booking-expired-does-not-exist')

    renderCheckout()

    await waitFor(() => expect(screen.getByText('event-detail-page')).toBeInTheDocument())
    expect(sessionStorage.getItem(`encore_booking_${EVENT_ID}`)).toBeNull()
  })
})
