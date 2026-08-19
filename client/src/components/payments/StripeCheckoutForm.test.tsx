// '@stripe/react-stripe-js/checkout' is mocked globally in setupTests.ts —
// `useCheckoutElements` there is already a vi.fn(), so each scenario below
// just points its return value at the state under test instead of trying to
// drive Stripe's real Payment Element.
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useCheckoutElements, type StripeUseCheckoutElementsResult } from '@stripe/react-stripe-js/checkout'
import { StripeCheckoutForm } from './StripeCheckoutForm'
import { ToastProvider } from '@/components/ui/toast'

const mockedUseCheckoutElements = vi.mocked(useCheckoutElements)

// The real `checkout` value is the full Stripe Checkout Elements SDK surface
// (dozens of members); CheckoutInner only ever calls `.confirm(...)`, so the
// test double only implements that and is cast into shape at the boundary.
function successResult(confirm: (...args: unknown[]) => unknown): StripeUseCheckoutElementsResult {
  return { type: 'success', checkout: { confirm } } as unknown as StripeUseCheckoutElementsResult
}

function Destination({ label }: { label: string }) {
  return <p>{label}</p>
}

function renderForm(holdExpiresAt: string) {
  return render(
    <MemoryRouter initialEntries={['/checkout/event-1']}>
      <ToastProvider>
        <Routes>
          <Route
            path="/checkout/event-1"
            element={
              <StripeCheckoutForm
                clientSecret="cs_test"
                bookingId="booking-1"
                eventId="event-1"
                holdExpiresAt={holdExpiresAt}
              />
            }
          />
          <Route path="/confirmation/:bookingId" element={<Destination label="confirmation" />} />
          <Route path="/events/:id" element={<Destination label="event-detail" />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

const future = () => new Date(Date.now() + 5 * 60 * 1000).toISOString()

describe('StripeCheckoutForm', () => {
  it('shows a spinner while the Payment Element is loading', () => {
    mockedUseCheckoutElements.mockReturnValue({ type: 'loading' })
    renderForm(future())
    expect(screen.getByText(/loading payment form/i)).toBeInTheDocument()
  })

  it('shows an error if the Payment Element fails to initialise', () => {
    mockedUseCheckoutElements.mockReturnValue({ type: 'error', error: { message: 'Could not load payment form.' } })
    renderForm(future())
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load payment form.')
  })

  it('navigates to the confirmation page once payment confirms successfully', async () => {
    const confirm = vi.fn().mockResolvedValue({ type: 'success' })
    mockedUseCheckoutElements.mockReturnValue(successResult(confirm))
    const user = userEvent.setup()
    renderForm(future())

    await user.click(screen.getByRole('button', { name: /pay now/i }))
    expect(confirm).toHaveBeenCalledWith({ redirect: 'if_required' })
    await waitFor(() => expect(screen.getByText('confirmation')).toBeInTheDocument())
  })

  it('shows the decline reason and stays on the page when payment is not successful', async () => {
    const confirm = vi.fn().mockResolvedValue({ type: 'failed', error: { message: 'Your card was declined.' } })
    mockedUseCheckoutElements.mockReturnValue(successResult(confirm))
    const user = userEvent.setup()
    renderForm(future())

    await user.click(screen.getByRole('button', { name: /pay now/i }))
    expect(await screen.findByText('Your card was declined.')).toBeInTheDocument()
  })

  it('redirects back to the event page when the hold has already expired', async () => {
    mockedUseCheckoutElements.mockReturnValue(successResult(vi.fn()))
    const past = new Date(Date.now() - 1000).toISOString()
    renderForm(past)

    await waitFor(() => expect(screen.getByText('event-detail')).toBeInTheDocument())
  })
})
