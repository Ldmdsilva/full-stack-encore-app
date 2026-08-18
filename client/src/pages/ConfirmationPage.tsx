import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TicketStub } from '@/components/TicketStub'
import { useStore } from '@/lib/store'
import { formatPrice, formatStubDate } from '@/lib/formatters'

export function ConfirmationPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()
  const { bookings } = useStore()
  const booking = bookings.find((b) => b.id === bookingId)

  if (!booking) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h1 className="font-voice text-[32px] font-medium">Booking not found</h1>
        <Button className="mt-6" onClick={() => navigate('/bookings')}>
          View my tickets
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
            eyebrow={formatStubDate(booking.event.date)}
            title={booking.event.artist}
            subtitle={`${booking.event.venue.name} · ${booking.event.venue.city}`}
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
