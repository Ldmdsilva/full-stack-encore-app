import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pencil, ToggleLeft, ToggleRight, Search } from 'lucide-react'
import { ADMIN_EVENTS, type AdminEvent } from '@/lib/adminMockData'
import { formatPrice, formatEventDate } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function AdminEventsPage() {
  const navigate = useNavigate()
  const [events, setEvents] = React.useState<AdminEvent[]>(ADMIN_EVENTS)
  const [search, setSearch] = React.useState('')

  const filtered = events.filter((e) =>
    `${e.title} ${e.artist} ${e.venue.name}`.toLowerCase().includes(search.toLowerCase()),
  )

  const toggleStatus = (id: string) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, status: e.status === 'scheduled' ? 'cancelled' : 'scheduled' }
          : e,
      ),
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
            Manage
          </p>
          <h1 className="mt-1 font-voice text-[36px] font-medium leading-tight tracking-[-0.02em]">
            Events
          </h1>
        </div>
        <Button onClick={() => navigate('/admin/events/new')} size="sm">
          <Plus className="size-4" />
          New event
        </Button>
      </div>

      {/* Search */}
      <div className="mb-5 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-[34px] size-4 text-text-muted" />
        <Input
          label="Search events"
          placeholder="Title, artist, venue…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-[var(--radius-card)] border-[0.5px] border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b-[0.5px] border-border bg-surface-sunk">
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-text-muted">
                Event
              </th>
              <th className="hidden px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-text-muted md:table-cell">
                Date
              </th>
              <th className="hidden px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-text-muted lg:table-cell">
                Revenue
              </th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-text-muted">
                Seats
              </th>
              <th className="px-4 py-3 text-center font-mono text-[11px] uppercase tracking-wider text-text-muted">
                Status
              </th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-text-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-text-muted">
                  No events match "{search}"
                </td>
              </tr>
            ) : (
              filtered.map((evt, i) => {
                const booked = evt.seats.filter((s) => s.status === 'booked').length
                const pct = Math.round((booked / evt.totalSeats) * 100)
                return (
                  <tr
                    key={evt.id}
                    className={cn(
                      'transition-colors hover:bg-surface-sunk/40',
                      i < filtered.length - 1 && 'border-b-[0.5px] border-border',
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{evt.title}</p>
                      <p className="mt-0.5 text-[11px] text-text-muted">{evt.artist}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-text-muted">
                        {evt.venue.name}, {evt.venue.city}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
                      {formatEventDate(evt.date)}
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono lg:table-cell">
                      {formatPrice(evt.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-mono text-[12px]">
                        {booked}/{evt.totalSeats}
                      </p>
                      <div className="mt-1 ml-auto h-1 w-16 overflow-hidden rounded-full bg-surface-sunk">
                        <div
                          className="h-full rounded-full bg-stage-green"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={evt.status === 'scheduled' ? 'confirmed' : 'cancelled'}
                      >
                        {evt.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/admin/events/${evt.id}/edit`}
                          className="flex size-8 items-center justify-center rounded-[6px] border-[0.5px] border-border bg-card text-text-secondary transition-colors hover:border-border-strong hover:text-foreground"
                          title="Edit event"
                        >
                          <Pencil className="size-3.5" />
                        </Link>
                        <button
                          onClick={() => toggleStatus(evt.id)}
                          className={cn(
                            'flex size-8 items-center justify-center rounded-[6px] border-[0.5px] transition-colors',
                            evt.status === 'scheduled'
                              ? 'border-stage-green/30 bg-stage-green/10 text-stage-green hover:bg-stage-green/20'
                              : 'border-stamp-red/30 bg-stamp-red/10 text-stamp-red hover:bg-stamp-red/20',
                          )}
                          title={evt.status === 'scheduled' ? 'Cancel event' : 'Re-schedule event'}
                        >
                          {evt.status === 'scheduled' ? (
                            <ToggleRight className="size-3.5" />
                          ) : (
                            <ToggleLeft className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 font-mono text-[12px] text-text-muted">
        {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
      </p>
    </div>
  )
}
