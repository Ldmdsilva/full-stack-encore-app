import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { TicketStub } from '@/components/TicketStub'
import { formatStubDate } from '@/lib/formatters'
import type { EventSummary } from '@/lib/types'

function availability(e: EventSummary) {
  const ratio = e.availableSeats / e.totalSeats
  if (e.availableSeats === 0)
    return { variant: 'cancelled' as const, label: 'Sold out' }
  if (ratio <= 0.2)
    return { variant: 'pending' as const, label: 'Few left' }
  return { variant: 'neutral' as const, label: `${e.availableSeats} seats left` }
}

export function EventCard({ event }: { event: EventSummary }) {
  const navigate = useNavigate()
  const avail = availability(event)
  const go = () => navigate(`/events/${event.id}`)

  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-border bg-card shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]">
      <button
        onClick={go}
        className="relative block aspect-[16/10] overflow-hidden bg-surface-sunk text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink"
        aria-label={`View ${event.title} by ${event.artist}`}
      >
        <img
          src={event.imageUrl}
          alt=""
          className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className="eyebrow rounded-[var(--radius-pill)] bg-background/90 px-2.5 py-1 text-ink">
            {event.genre}
          </span>
        </div>
        <div className="absolute bottom-3 right-3">
          <Badge variant={avail.variant}>{avail.label}</Badge>
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div>
          <p className="text-[13px] text-text-muted">
            {event.venue.name} · {event.venue.city}
          </p>
        </div>
        <div className="mt-auto">
          <TicketStub
            variant="compact"
            eyebrow={formatStubDate(event.date)}
            title={event.artist}
            subtitle={event.title}
            serial={`ENC-${event.id.slice(-4).toUpperCase()}`}
            onClick={go}
          />
        </div>
      </div>
    </article>
  )
}
