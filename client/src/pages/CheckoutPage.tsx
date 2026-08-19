import * as React from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { TicketStub } from '@/components/TicketStub'
import { StripeCheckoutForm } from '@/components/payments/StripeCheckoutForm'
import { useAsync } from '@/hooks/useAsync'
import * as eventsApi from '@/lib/api/events'
import * as bookingsApi from '@/lib/api/bookings'
import * as paymentsApi from '@/lib/api/payments'
import { parseApiError } from '@/lib/api/errors'
import { formatPrice, formatStubDate } from '@/lib/formatters'
import type { ApiError, Booking } from '@/lib/types'

export function CheckoutPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()

  const selectedIds: string[] = React.useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`encore_selection_${eventId}`) ?? '[]')
    } catch {
      return []
    }
  }, [eventId])

  // A booking created earlier in this tab that may still have a live hold
  // (e.g. the checkout page was reloaded) — resumed via payment-session
  // rather than creating a second booking.
  const resumableBookingId = React.useMemo(
    () => sessionStorage.getItem(`encore_booking_${eventId}`),
    [eventId],
  )

  const { status, data, error, retry } = useAsync(
    () => (eventId ? eventsApi.getById(eventId) : Promise.reject(new Error('Missing event id'))),
    [eventId],
  )

  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<ApiError | null>(null)
  // Populated on a real 409 SEAT_UNAVAILABLE from the server (ADR-004's
  // concurrency guard, now targeting `held` instead of `booked`).
  const [conflictSeatIds, setConflictSeatIds] = React.useState<string[]>([])
  const [booking, setBooking] = React.useState<Booking | null>(null)
  const [clientSecret, setClientSecret] = React.useState<string | null>(null)
  const [resuming, setResuming] = React.useState(Boolean(resumableBookingId))

  const persistBooking = (b: Booking) => {
    setBooking(b)
    sessionStorage.setItem(`encore_booking_${eventId}`, b.id)
  }

  // Resume an existing hold on mount rather than creating a second booking.
  React.useEffect(() => {
    if (!resumableBookingId) return
    let cancelled = false

    Promise.all([bookingsApi.getById(resumableBookingId), paymentsApi.createPaymentSession(resumableBookingId)])
      .then(([bookingResponse, sessionResponse]) => {
        if (cancelled) return
        setBooking(bookingResponse.booking)
        setClientSecret(sessionResponse.clientSecret)
      })
      .catch(() => {
        // Hold expired, already paid, or otherwise no longer resumable.
        if (!cancelled) sessionStorage.removeItem(`encore_booking_${eventId}`)
      })
      .finally(() => {
        if (!cancelled) setResuming(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resumableBookingId/eventId are stable for this page's lifetime
  }, [])

  // Guard: no selection means nothing to buy. Skipped once a booking has
  // been created (or is being resumed) — sessionStorage is cleared at that point.
  React.useEffect(() => {
    if (!booking && !resuming && status === 'success' && selectedIds.length === 0) {
      navigate(`/events/${eventId}`, { replace: true })
    }
  }, [status, selectedIds, eventId, navigate, booking, resuming])

  if (status === 'loading' || resuming) {
    return <Spinner label="Loading your selection…" className="py-32" />
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24">
        <ErrorState description={error.message} onRetry={retry} />
      </div>
    )
  }

  if (!eventId || (!booking && selectedIds.length === 0)) return null

  const event = data.event
  // Pre-submit: display seats from the current seat map (for the summary
  // panel only). Post-submit: display the server's own seat snapshot on the
  // booking, which is what actually gets charged.
  const previewSeats = data.seats.filter((s) => selectedIds.includes(s.id))
  const displaySeats: { id: string; section: string; price: number }[] = booking ? booking.seats : previewSeats
  // Never trust a client-computed total once the server has responded —
  // `booking.totalPrice` is authoritative from that point on.
  const previewTotal = previewSeats.reduce((sum, s) => sum + s.price, 0)
  const total = booking ? booking.totalPrice : previewTotal

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setConflictSeatIds([])
    setSubmitting(true)

    try {
      const response = await bookingsApi.create({ eventId, seatIds: selectedIds })
      persistBooking(response.booking)
      setClientSecret(response.clientSecret)
      sessionStorage.removeItem(`encore_selection_${eventId}`)
    } catch (err) {
      const apiError = parseApiError(err)
      if (apiError.code === 'SEAT_UNAVAILABLE') {
        const details = apiError.details as { seatIds?: string[] } | undefined
        setConflictSeatIds(details?.seatIds?.length ? details.seatIds : selectedIds)
        // Re-fetch so the seat map reflects server truth — nothing here is
        // retried automatically.
        retry()
      } else {
        setSubmitError(apiError)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const backToSeatMap = () => {
    sessionStorage.removeItem(`encore_selection_${eventId}`)
    navigate(`/events/${eventId}`)
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <Link
        to={`/events/${eventId}`}
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to seat map
      </Link>

      <h1 className="font-voice text-[36px] font-medium tracking-[-0.02em]">Checkout</h1>
      <p className="mt-1 text-text-secondary">Review your seats and confirm.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Payment */}
        <div className="order-2 lg:order-1">
          <div className="rounded-[var(--radius-card)] border-[0.5px] border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-[20px] font-medium">
              <Lock className="size-4 text-text-muted" /> Payment
            </h2>

            <div className="mt-4 flex items-start gap-2 rounded-[var(--radius)] bg-[var(--status-confirmed-bg)] px-3 py-2.5 text-[13px] text-[var(--status-confirmed-fg)]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <p>
                Test mode — Stripe processes this payment. Use card{' '}
                <span className="font-mono">4242 4242 4242 4242</span>.
              </p>
            </div>

            {conflictSeatIds.length > 0 && (
              <div role="alert" className="mt-4 rounded-[var(--radius)] border-[0.5px] border-stamp-red/30 bg-stamp-red/8 px-4 py-3 text-[13px]">
                <p className="font-medium text-stamp-red">That seat was just taken.</p>
                <p className="mt-1 text-text-secondary">
                  Seat{conflictSeatIds.length > 1 ? 's' : ''}{' '}
                  <span className="font-mono">{conflictSeatIds.join(', ')}</span>{' '}
                  {conflictSeatIds.length > 1 ? 'were' : 'was'} booked by another fan while you were checking out.
                  Go back and choose different seats.
                </p>
                <button
                  type="button"
                  onClick={backToSeatMap}
                  className="mt-2 text-[13px] font-medium text-stamp-red underline underline-offset-2"
                >
                  Back to seat map
                </button>
              </div>
            )}

            {submitError && (
              <p role="alert" className="mt-4 text-[13px] text-destructive">
                {submitError.message}
              </p>
            )}

            {!booking ? (
              <form onSubmit={submit}>
                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  className="mt-6"
                  isLoading={submitting}
                  disabled={conflictSeatIds.length > 0}
                >
                  {submitting ? 'Reserving your seats…' : `Continue to pay ${formatPrice(total)}`}
                </Button>
              </form>
            ) : (
              <div className="mt-6">
                <p className="text-[13px] text-text-secondary">
                  Booking <span className="font-mono text-foreground">{booking.reference}</span> created —
                  awaiting payment.
                </p>
                {clientSecret && booking.holdExpiresAt && (
                  <StripeCheckoutForm
                    clientSecret={clientSecret}
                    bookingId={booking.id}
                    eventId={eventId}
                    holdExpiresAt={booking.holdExpiresAt}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <aside className="order-1 lg:order-2">
          <div className="flex flex-col gap-3">
            <TicketStub
              eyebrow={formatStubDate(event.date)}
              title={event.artist}
              subtitle={`${event.venue.name} · ${event.venue.city}`}
              fields={[
                { label: 'Seats', value: String(displaySeats.length) },
                { label: 'Section', value: displaySeats[0]?.section ?? '—' },
                { label: 'Total', value: formatPrice(total) },
              ]}
              serial={booking?.reference ?? `ENC-${event.id.slice(-4).toUpperCase()}`}
            />
            <div className="rounded-[var(--radius-card)] border-[0.5px] border-border bg-card p-4">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                Seats
              </p>
              <ul className="flex flex-col gap-1.5">
                {displaySeats.map((s) => (
                  <li key={s.id} className="flex justify-between font-mono text-[13px]">
                    <span>
                      {s.id} <span className="text-text-muted">· {s.section}</span>
                    </span>
                    <span>{formatPrice(s.price)}</span>
                  </li>
                ))}
              </ul>
              {!booking && (
                <p className="mt-3 text-[11px] text-text-muted">
                  Final total confirmed by the server when your booking is created.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
