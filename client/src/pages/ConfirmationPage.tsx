import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TicketStub } from '@/components/TicketStub'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { useSocket } from '@/context/SocketContext'
import { useAsync } from '@/hooks/useAsync'
import * as bookingsApi from '@/lib/api/bookings'
import * as paymentsApi from '@/lib/api/payments'
import { formatPrice, formatStubDate } from '@/lib/formatters'
import type { Booking, BookingUpdatedPayload } from '@/lib/types'

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 30000

export function ConfirmationPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()
  const { socket } = useSocket()

  const { status, data, error, retry } = useAsync(
    () => (bookingId ? bookingsApi.getById(bookingId) : Promise.reject(new Error('Missing booking id'))),
    [bookingId],
  )

  // The booking is `pending` until its payment is confirmed — that can
  // land after this page has already mounted. There's no Stripe webhook in
  // this deployment, so confirmation is driven from here instead: each
  // check below calls `confirmPayment`, which reconciles the booking
  // against its own Checkout Session directly on Stripe (via the secret
  // key) and flips it to `confirmed` server-side if it's been paid. Listen
  // on the socket for a push, and poll as a fallback in case the socket is
  // down (§FR-16-ish). `booking` is adjusted during render (React's
  // documented alternative to an effect that only mirrors another value)
  // whenever the fetch produces a new booking object; the socket/poll
  // effect below then owns further updates to it via setBooking directly.
  const [booking, setBooking] = React.useState<Booking | null>(null)
  const [syncedFrom, setSyncedFrom] = React.useState<Booking | null>(null)
  if (status === 'success' && data.booking !== syncedFrom) {
    setSyncedFrom(data.booking)
    setBooking(data.booking)
  }

  React.useEffect(() => {
    if (!bookingId || !booking || booking.status !== 'pending') return
    const id = bookingId

    function handleBookingUpdated(payload: BookingUpdatedPayload) {
      if (payload.bookingId !== id) return
      paymentsApi.confirmPayment(id).then(({ booking: fresh }) => setBooking(fresh))
    }
    socket.on('booking:updated', handleBookingUpdated)

    const startedAt = Date.now()
    const interval = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        clearInterval(interval)
        return
      }
      try {
        const { booking: fresh } = await paymentsApi.confirmPayment(id)
        setBooking(fresh)
        if (fresh.status !== 'pending') clearInterval(interval)
      } catch {
        // Transient — the next tick (or the socket) will catch it up.
      }
    }, POLL_INTERVAL_MS)

    return () => {
      socket.off('booking:updated', handleBookingUpdated)
      clearInterval(interval)
    }
  }, [bookingId, booking, socket])

  if (status === 'loading') {
    return <Spinner label="Loading your booking…" className="py-32" />
  }

  if (status === 'error' || !booking) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h1 className="font-voice text-[32px] font-medium">Booking not found</h1>
        {error && <ErrorState description={error.message} onRetry={retry} className="mt-4" />}
        <Button className="mt-6" onClick={() => navigate('/bookings')}>
          View my tickets
        </Button>
      </div>
    )
  }

  if (booking.status === 'pending') {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--status-pending-bg)] text-[var(--status-pending-fg)]">
          <Clock className="size-6 animate-pulse" />
        </span>
        <h1 className="mt-4 font-voice text-[32px] font-medium tracking-[-0.02em]">
          Confirming payment…
        </h1>
        <p className="mt-2 text-text-secondary">
          Booking <span className="font-mono text-foreground">{booking.reference}</span> is
          awaiting confirmation from Stripe. This page will update automatically — no need to
          refresh.
        </p>
      </div>
    )
  }

  if (booking.status === 'cancelled' || booking.status === 'expired') {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-fg)]">
          <XCircle className="size-6" />
        </span>
        <h1 className="mt-4 font-voice text-[32px] font-medium tracking-[-0.02em]">
          {booking.status === 'expired' ? 'This hold expired.' : 'Booking cancelled.'}
        </h1>
        <p className="mt-2 text-text-secondary">
          Booking <span className="font-mono text-foreground">{booking.reference}</span>{' '}
          {booking.status === 'expired'
            ? 'was not paid for in time and the seats were released.'
            : 'has been cancelled.'}
        </p>
        <Button className="mt-6" onClick={() => navigate('/events')}>
          Browse concerts
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className="mb-8 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-fg)]">
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="mt-4 font-voice text-[36px] font-medium tracking-[-0.02em]">
          You're going.
        </h1>
        <p className="mt-2 text-text-secondary">
          Booking{' '}
          <span className="font-mono text-foreground">{booking.reference}</span>{' '}
          is confirmed. Keep this stub — it's your ticket.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {booking.seats.map((s) => (
          <TicketStub
            key={s.id}
            eyebrow={booking.event ? formatStubDate(booking.event.date) : ''}
            title={booking.event?.artist ?? 'Event'}
            subtitle={booking.event?.title ?? ''}
            fields={[
              { label: 'Section', value: s.section },
              { label: 'Seat', value: s.id },
              { label: 'Price', value: formatPrice(s.price) },
            ]}
            serial={booking.reference}
          />
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button variant="secondary" size="md" onClick={() => navigate('/bookings')}>
          View my tickets
        </Button>
        <Button variant="ghost" size="md" onClick={() => navigate('/events')}>
          Browse more concerts
        </Button>
      </div>
    </div>
  )
}
