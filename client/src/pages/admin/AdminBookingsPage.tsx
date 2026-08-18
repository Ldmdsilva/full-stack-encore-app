import * as React from 'react'
import { Search, X } from 'lucide-react'
import { ALL_BOOKINGS } from '@/lib/adminMockData'
import { formatPrice, formatEventDate } from '@/lib/formatters'
import { Input, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type StatusFilter = 'all' | 'confirmed' | 'cancelled'

export function AdminBookingsPage() {
  type AdminBooking = (typeof ALL_BOOKINGS)[number]
  const [bookings, setBookings] = React.useState<AdminBooking[]>(ALL_BOOKINGS)
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')

  const filtered = bookings.filter((b) => {
    const matchStatus = statusFilter === 'all' || b.status === statusFilter
    const matchSearch =
      !search ||
      `${b.customerName} ${b.customerEmail} ${b.reference} ${b.event.title} ${b.event.artist}`
        .toLowerCase()
        .includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const cancelBooking = (id: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' as const } : b)),
    )
  }

  const totalRevenue = filtered
    .filter((b) => b.status === 'confirmed')
    .reduce((s, b) => s + b.totalPrice, 0)

  const hasFilters = search || statusFilter !== 'all'

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
          Manage
        </p>
        <h1 className="mt-1 font-voice text-[36px] font-medium leading-tight tracking-[-0.02em]">
          Bookings
        </h1>
      </div>

      {/* Filter row */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-[34px] size-4 text-text-muted" />
          <Input
            label="Search"
            placeholder="Fan name, ref, event…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="w-40"
        >
          <option value="all">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setSearch('')
              setStatusFilter('all')
            }}
            className="shrink-0"
          >
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Summary bar */}
      <div className="mb-4 flex items-center gap-6">
        <p className="font-mono text-[12px] text-text-muted">
          {filtered.length} {filtered.length === 1 ? 'booking' : 'bookings'}
        </p>
        {statusFilter !== 'cancelled' && (
          <p className="font-mono text-[12px] text-text-muted">
            {formatPrice(totalRevenue)} revenue
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-[var(--radius-card)] border-[0.5px] border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b-[0.5px] border-border bg-surface-sunk">
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-text-muted">
                Ref
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-text-muted">
                Fan
              </th>
              <th className="hidden px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-text-muted md:table-cell">
                Event
              </th>
              <th className="hidden px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-text-muted lg:table-cell">
                Seats
              </th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-text-muted">
                Total
              </th>
              <th className="px-4 py-3 text-center font-mono text-[11px] uppercase tracking-wider text-text-muted">
                Status
              </th>
              <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-text-muted">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                  No bookings match your search
                </td>
              </tr>
            ) : (
              filtered.map((b, i) => (
                <tr
                  key={b.id}
                  className={cn(
                    'transition-colors hover:bg-surface-sunk/40',
                    i < filtered.length - 1 && 'border-b-[0.5px] border-border',
                    b.status === 'cancelled' && 'opacity-60',
                  )}
                >
                  <td className="px-4 py-3 font-mono text-[12px] text-text-secondary">
                    {b.reference}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium leading-tight">{b.customerName}</p>
                    <p className="text-[11px] text-text-muted">{b.customerEmail}</p>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <p className="font-medium leading-tight">{b.event.title}</p>
                    <p className="text-[11px] text-text-muted">
                      {formatEventDate(b.event.date).split(',')[0]}
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="font-mono text-[12px] text-text-secondary">
                      {b.seats.map((s) => s.id).join(', ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatPrice(b.totalPrice)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant={b.status === 'confirmed' ? 'confirmed' : 'cancelled'}
                    >
                      {b.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {b.status === 'confirmed' ? (
                      <button
                        onClick={() => cancelBooking(b.id)}
                        className="rounded-[6px] border-[0.5px] border-stamp-red/30 bg-stamp-red/8 px-2.5 py-1 text-[12px] text-stamp-red transition-colors hover:bg-stamp-red/15"
                      >
                        Cancel
                      </button>
                    ) : (
                      <span className="text-[12px] text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
