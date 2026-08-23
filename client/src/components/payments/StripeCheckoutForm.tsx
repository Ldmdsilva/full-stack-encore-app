import * as React from 'react'
import { loadStripe, type Appearance } from '@stripe/stripe-js'
import { CheckoutElementsProvider, PaymentElement, useCheckoutElements } from '@stripe/react-stripe-js/checkout'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/toast'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

// Built from the ticket-stub design tokens in src/index.css so the Payment
// Element doesn't look bolted on (Phase 6).
const appearance: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#c8102e', // --stamp-red
    colorBackground: '#ffffff', // --surface
    colorText: '#1a1714', // --ink / --text-primary
    colorTextSecondary: '#55504a', // --text-secondary
    colorDanger: '#a32d2d', // --status-cancelled-fg
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    borderRadius: '8px', // --radius
    spacingUnit: '4px',
  },
}

interface StripeCheckoutFormProps {
  clientSecret: string
  bookingId: string
  eventId: string
  holdExpiresAt: string
}

/**
 * Embedded Stripe Checkout (Checkout Sessions API, `ui_mode: 'elements'`,
 * ADR-010) — the Payment Element renders inline inside the existing
 * checkout design rather than redirecting away from it.
 */
export function StripeCheckoutForm({ clientSecret, bookingId, eventId, holdExpiresAt }: StripeCheckoutFormProps) {
  return (
    <CheckoutElementsProvider stripe={stripePromise} options={{ clientSecret, elementsOptions: { appearance } }}>
      <CheckoutInner bookingId={bookingId} eventId={eventId} holdExpiresAt={holdExpiresAt} />
    </CheckoutElementsProvider>
  )
}

function useHoldCountdownSeconds(holdExpiresAt: string) {
  const target = React.useMemo(() => new Date(holdExpiresAt).getTime(), [holdExpiresAt])
  const [secondsLeft, setSecondsLeft] = React.useState(() => Math.max(0, Math.round((target - Date.now()) / 1000)))

  React.useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.round((target - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(interval)
  }, [target])

  return secondsLeft
}

function CheckoutInner({ bookingId, eventId, holdExpiresAt }: Omit<StripeCheckoutFormProps, 'clientSecret'>) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const result = useCheckoutElements()
  const [submitting, setSubmitting] = React.useState(false)
  const [confirmError, setConfirmError] = React.useState<string | null>(null)
  const secondsLeft = useHoldCountdownSeconds(holdExpiresAt)
  const hasExpiredRef = React.useRef(false)

  React.useEffect(() => {
    if (secondsLeft === 0 && !hasExpiredRef.current) {
      hasExpiredRef.current = true
      toast('Your seat hold expired', 'error')
      navigate(`/events/${eventId}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast/navigate are stable, eventId is constant for this checkout session
  }, [secondsLeft])

  if (result.type === 'loading') {
    return <Spinner label="Loading payment form…" className="py-12" />
  }

  if (result.type === 'error') {
    return (
      <p role="alert" className="mt-4 text-[13px] text-destructive">
        {result.error.message}
      </p>
    )
  }

  const { checkout } = result

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    setConfirmError(null)
    setSubmitting(true)

    try {
      const confirmResult = await checkout.confirm({ redirect: 'if_required' })
      if (confirmResult.type === 'success') {
        navigate(`/confirmation/${bookingId}`)
        return
      }
      // Payment declined/incomplete — the hold is still live, let the user retry.
      setConfirmError(confirmResult.error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  return (
    <form onSubmit={handlePay} className="mt-6">
      <div className="mb-3 flex items-center justify-between text-[12px] text-text-secondary">
        <span>Complete payment before your hold expires</span>
        <span className="font-mono text-stamp-red">
          {minutes}:{String(seconds).padStart(2, '0')}
        </span>
      </div>

      <PaymentElement />

      {confirmError && (
        <p role="alert" className="mt-3 text-[13px] text-destructive">
          {confirmError}
        </p>
      )}

      <Button type="submit" size="lg" fullWidth className="mt-4" isLoading={submitting} disabled={secondsLeft === 0}>
        {submitting ? 'Processing payment…' : 'Pay now'}
      </Button>
    </form>
  )
}
