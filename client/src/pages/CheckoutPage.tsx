import * as React from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Lock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TicketStub } from '@/components/TicketStub'
import { useToast } from '@/components/ui/toast'
import { useStore } from '@/lib/store'
import { getEvent } from '@/lib/mockData'
import { formatPrice, formatStubDate } from '@/lib/formatters'
import type { Booking } from '@/lib/types'

const TEST_CARD = '4242 4242 4242 4242'

export function CheckoutPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, addBooking } = useStore()

  const event = React.useMemo(() => (eventId ? getEvent(eventId) : undefined), [eventId])
  const selectedIds: string[] = React.useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`encore_selection_${eventId}`) ?? '[]')
    } catch {
      return []
    }
  }, [eventId])

  const [name, setName] = React.useState(user?.name ?? '')
  const [card, setCard] = React.useState('')
  const [cardError, setCardError] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  // Simulates a 409 Conflict when another client books a seat during checkout.
  const [conflictSeats, setConflictSeats] = React.useState<string[]>([])

  // Guard: no selection means nothing to buy.
  React.useEffect(() => {
    if (event && selectedIds.length === 0) navigate(`/events/${event.id}`, { replace: true })
  }, [event, selectedIds, navigate])

  if (!event || selectedIds.length === 0) return null

  const seats = event.seats.filter((s) => selectedIds.includes(s.id))
  const total = seats.reduce((sum, s) => sum + s.price, 0)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (card.replace(/\s/g, '') !== TEST_CARD.replace(/\s/g, '')) {
      setCardError(`Use the test card ${TEST_CARD} for this simulated payment.`)
      return
    }
    setCardError('')
    setConflictSeats([])
    setSubmitting(true)

    // 1-in-5 chance of a simulated 409 conflict (mirrors the ADR-004 concurrency guard).
    // Use the test card ending in 0001 to always trigger a conflict for demo purposes.
    const triggerConflict = card.replace(/\s/g, '').endsWith('0001') || Math.random() < 0.2
    if (triggerConflict && seats.length > 0) {
      setTimeout(() => {
        const contested = [seats[0].id]
        setConflictSeats(contested)
        setSubmitting(false)
      }, 900)
      return
    }

    // Simulate the POST /api/bookings round trip.
    setTimeout(() => {
      const ref = `ENC-${Math.floor(1000 + Math.random() * 8999)}`
      const booking: Booking = {
        id: `bk-${Date.now()}`,
        reference: ref,
        event: {
          id: event.id,
          title: event.title,
          artist: event.artist,
          date: event.date,
          venue: event.venue,
        },
        seats,
        totalPrice: total,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      }
      addBooking(booking)
      sessionStorage.removeItem(`encore_selection_${event.id}`)
      navigate(`/confirmation/${booking.id}`, { replace: true })
    }, 900)
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <Link
        to={`/events/${event.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to seat map
      </Link>

      <h1 className="font-voice text-[36px] font-medium tracking-[-0.02em]">Checkout</h1>
      <p className="mt-1 text-text-secondary">Review your seats and confirm.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Payment */}
        <form onSubmit={submit} className="order-2 lg:order-1">
          <div className="rounded-[var(--radius-card)] border-[0.5px] border-border bg-card p-6">
            <h2 className="flex items-center gap-2 text-[20px] font-medium">
              <Lock className="size-4 text-text-muted" /> Payment
            </h2>

            <div className="mt-4 flex items-start gap-2 rounded-[var(--radius)] bg-[var(--status-confirmed-bg)] px-3 py-2.5 text-[13px] text-[var(--status-confirmed-fg)]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              <p>
                Simulated payment — no real card details are collected or
                transmitted. Use{' '}
                <span className="font-mono">{TEST_CARD}</span>.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              <Input
                label="Cardholder name"
                placeholder="Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Card number"
                placeholder="4242 4242 4242 4242"
                inputMode="numeric"
                value={card}
                onChange={(e) => setCard(e.target.value)}
                error={cardError}
                className="font-mono"
                required
              />
            </div>

            {conflictSeats.length > 0 && (
              <div role="alert" className="mt-4 rounded-[var(--radius)] border-[0.5px] border-stamp-red/30 bg-stamp-red/8 px-4 py-3 text-[13px]">
                <p className="font-medium text-stamp-red">That seat was just taken.</p>
                <p className="mt-1 text-text-secondary">
                  Seat{conflictSeats.length > 1 ? 's' : ''}{' '}
                  <span className="font-mono">{conflictSeats.join(', ')}</span>{' '}
                  {conflictSeats.length > 1 ? 'were' : 'was'} booked by another fan while you were checking out.
                  Go back and choose different seats.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.removeItem(`encore_selection_${event!.id}`)
                    window.history.back()
                  }}
                  className="mt-2 text-[13px] font-medium text-stamp-red underline underline-offset-2"
                >
                  Back to seat map
                </button>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              fullWidth
              className="mt-6"
              isLoading={submitting}
              disabled={conflictSeats.length > 0}
            >
              {submitting ? 'Confirming…' : `Pay ${formatPrice(total)}`}
            </Button>
          </div>
        </form>

        {/* Summary */}
        <aside className="order-1 lg:order-2">
          <div className="flex flex-col gap-3">
            <TicketStub
              eyebrow={formatStubDate(event.date)}
              title={event.artist}
              subtitle={`${event.venue.name} · ${event.venue.city}`}
              fields={[
                { label: 'Seats', value: String(seats.length) },
                { label: 'Section', value: seats[0]?.section ?? '—' },
                { label: 'Total', value: formatPrice(total) },
              ]}
              serial={`ENC-${event.id.slice(-4).toUpperCase()}`}
            />
            <div className="rounded-[var(--radius-card)] border-[0.5px] border-border bg-card p-4">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                Seats
              </p>
              <ul className="flex flex-col gap-1.5">
                {seats.map((s) => (
                  <li key={s.id} className="flex justify-between font-mono text-[13px]">
                    <span>
                      {s.id} <span className="text-text-muted">· {s.section}</span>
                    </span>
                    <span>{formatPrice(s.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
