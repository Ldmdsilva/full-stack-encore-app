import * as React from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Radio, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SeatMap } from '@/components/seats/SeatMap'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { useAuth } from '@/context/AuthContext'
import { useEventSeats, MAX_SEATS } from '@/hooks/useEventSeats'
import { formatEventDate, formatPrice, formatStubDate } from '@/lib/formatters'

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [liveMessage, setLiveMessage] = React.useState('')

  const { event, seats, selectedIds, status, error, isConnected, toggleSeat, retry } = useEventSeats(id)

  if (status === 'loading') {
    return <Spinner label="Loading event…" className="py-32" />
  }

  if (status === 'error' || !event) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-24 text-center">
        <ErrorState
          title="Concert not found"
          description={error?.message ?? 'This show may have finished or the link is wrong.'}
          onRetry={id ? retry : undefined}
        />
        <Button className="mt-2" onClick={() => navigate('/events')}>
          Browse concerts
        </Button>
      </div>
    )
  }

  const toggle = (seatId: string) => {
    const seat = seats.find((s) => s.id === seatId)
    const wasSelected = selectedIds.includes(seatId)
    toggleSeat(seatId)
    if (seat) setLiveMessage(wasSelected ? `Seat ${seatId} removed` : `Seat ${seatId} selected`)
  }

  const selectedSeats = seats.filter((s) => selectedIds.includes(s.id))
  const total = selectedSeats.reduce((sum, s) => sum + s.price, 0)

  const onContinue = () => {
    sessionStorage.setItem(
      `encore_selection_${event.id}`,
      JSON.stringify(selectedIds),
    )
    if (!user) {
      navigate('/login', { state: { from: `/checkout/${event.id}` } })
      return
    }
    navigate(`/checkout/${event.id}`)
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <Link
        to="/events"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All concerts
      </Link>

      {/* Header */}
      <header className="mb-8 grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
        <div>
          <p className="eyebrow text-stamp-red">{formatStubDate(event.date)}</p>
          <h1 className="mt-2 font-voice text-[40px] font-medium leading-[1.02] tracking-[-0.02em] sm:text-[52px]">
            {event.artist}
          </h1>
          <p className="mt-1 text-[20px] text-text-secondary">{event.title}</p>
          <p className="mt-3 max-w-xl text-[15px] leading-[1.7] text-text-secondary">
            {event.description}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-[var(--radius-card)] border-[0.5px] border-border bg-card p-5">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
              Venue
            </dt>
            <dd className="mt-1 text-[15px]">{event.venue.name}</dd>
            <dd className="text-[13px] text-text-muted">{event.venue.city}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
              Doors
            </dt>
            <dd className="mt-1 font-mono text-[14px]">
              {formatEventDate(event.date)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
              From
            </dt>
            <dd className="mt-1 font-mono text-[15px]">
              {formatPrice(event.basePrice)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
              Connection
            </dt>
            <dd className="mt-1 flex items-center gap-1.5 text-[13px]">
              <Radio
                className={isConnected ? 'size-3.5 text-stage-green' : 'size-3.5 text-ash'}
              />
              <span className={isConnected ? 'text-stage-green' : 'text-ash'}>
                {isConnected ? 'Live' : 'Connecting…'}
              </span>
            </dd>
          </div>
        </dl>
      </header>

      {/* Seat map + summary */}
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[var(--radius-card)] border-[0.5px] border-border bg-card p-5 sm:p-8">
          <SeatMap
            seats={seats}
            selectedIds={selectedIds}
            onToggle={toggle}
            liveMessage={liveMessage}
          />
        </div>

        {/* Selection summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[var(--radius-card)] border-[0.5px] border-border bg-card p-5">
            <h2 className="text-[18px] font-medium">Your selection</h2>
            {selectedSeats.length === 0 ? (
              <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">
                Tap a green seat to add it. You can pick up to {MAX_SEATS}.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {selectedSeats.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between rounded-[var(--radius)] bg-surface-sunk px-3 py-2"
                  >
                    <span className="font-mono text-[13px]">
                      {s.id}{' '}
                      <span className="text-text-muted">· {s.section}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[13px]">
                        {formatPrice(s.price)}
                      </span>
                      <button
                        onClick={() => toggle(s.id)}
                        aria-label={`Remove seat ${s.id}`}
                        className="text-text-muted hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex items-baseline justify-between border-t-[0.5px] border-border pt-4">
              <span className="text-[14px] text-text-secondary">Total</span>
              <span className="font-mono text-[20px]">{formatPrice(total)}</span>
            </div>
            {/* Shown for reference only — the server recomputes the total. */}
            <p className="mt-1 text-[11px] text-text-muted">
              Final total confirmed at checkout.
            </p>

            <Button
              fullWidth
              size="lg"
              className="mt-4"
              disabled={selectedSeats.length === 0}
              onClick={onContinue}
            >
              Continue to checkout
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
