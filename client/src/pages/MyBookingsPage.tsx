import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TicketStub } from '@/components/TicketStub'
import { useToast } from '@/components/ui/toast'
import { useStore } from '@/lib/store'
import { formatEventDate, formatPrice, formatStubDate } from '@/lib/formatters'

export function MyBookingsPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, bookings, cancelBooking } = useStore()
  const [confirming, setConfirming] = React.useState<string | null>(null)

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <h1 className="font-voice text-[32px] font-medium">Sign in to see your tickets</h1>
        <p className="mt-2 text-text-secondary">
          Your bookings live in your account.
        </p>
        <Button className="mt-6" onClick={() => navigate('/login')}>
          Sign in
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-voice text-[36px] font-medium tracking-[-0.02em]">My tickets</h1>
      <p className="mt-1 text-text-secondary">
        Every stub you've booked, newest first.
      </p>

      {bookings.length === 0 ? (
        <div className="mt-10 rounded-[var(--radius-card)] border-[0.5px] border-dashed border-border-strong px-6 py-16 text-center">
          <h2 className="font-voice text-[24px] font-medium">
            You haven't booked any concerts yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[15px] text-text-secondary">
            When you book a show, your ticket stub appears here.
          </p>
          <Button className="mt-6" onClick={() => navigate('/events')}>
            Browse concerts
          </Button>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-5">
          {bookings.map((b) => (
            <li key={b.id}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] text-text-muted">
                  {formatEventDate(b.event.date)} · {b.seats.length}{' '}
                  {b.seats.length === 1 ? 'seat' : 'seats'} ·{' '}
                  {formatPrice(b.totalPrice)}
                </p>
                <Badge variant={b.status === 'confirmed' ? 'confirmed' : 'cancelled'}>
                  {b.status === 'confirmed' ? 'Confirmed' : 'Cancelled'}
                </Badge>
              </div>
              <TicketStub
                variant="compact"
                eyebrow={formatStubDate(b.event.date)}
                title={b.event.artist}
                subtitle={`${b.event.venue.name} · ${b.event.venue.city}`}
                serial={b.reference}
                onClick={() => navigate(`/confirmation/${b.id}`)}
              />
              {b.status === 'confirmed' && (
                <div className="mt-2 flex justify-end">
                  {confirming === b.id ? (
                    <div className="flex items-center gap-3 text-[13px]">
                      <span className="text-text-secondary">Cancel this booking?</span>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          cancelBooking(b.id)
                          setConfirming(null)
                          toast('Booking cancelled.', 'success')
                        }}
                      >
                        Yes, cancel
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                        Keep it
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirming(b.id)}
                    >
                      Cancel booking
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
