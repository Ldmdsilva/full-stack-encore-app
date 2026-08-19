import * as React from 'react'
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import * as bookingsApi from '@/lib/api/bookings'
import { formatPrice, formatEventDate } from '@/lib/formatters'
import { Input, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/utils'
import type { BookingStatus } from '@/lib/types'

type StatusFilter = 'all' | BookingStatus
const PAGE_SIZE = 20

const STATUS_VARIANT: Record<BookingStatus, 'confirmed' | 'pending' | 'cancelled' | 'expired'> = {
  confirmed: 'confirmed',
  pending: 'pending',
  cancelled: 'cancelled',
  expired: 'expired',
}

export function AdminBookingsPage() {
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')

  const { status, data, error, retry } = useAsync(() => bookingsApi.listAll({ page, limit: PAGE_SIZE }), [page], {
    isEmpty: (d) => d.bookings.length === 0,
  })

  const bookings = status === 'success' || status === 'empty' ? data.bookings : []

  const filtered = bookings.filter((b) => {
    const matchStatus = statusFilter === 'all' || b.status === statusFilter
    const matchSearch =
      !search ||
      `${b.user?.name ?? ''} ${b.user?.email ?? ''} ${b.reference} ${b.event?.title ?? ''} ${b.event?.artist ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

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
            label="Search (this page)"
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
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
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

      {status === 'loading' && <Spinner label="Loading bookings…" />}
      {status === 'error' && <ErrorState description={error.message} onRetry={retry} />}
      {status === 'empty' && <EmptyState title="No bookings yet" />}

      {status === 'success' && (
        <>
          {/* Summary bar */}
          <div className="mb-4 flex items-center gap-6">
            <p className="font-mono text-[12px] text-text-muted">
              {filtered.length} {filtered.length === 1 ? 'booking' : 'bookings'} on this page
            </p>
            <p className="font-mono text-[12px] text-text-muted">
              {formatPrice(totalRevenue)} revenue (confirmed, this page)
            </p>
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
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-text-muted">
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
                        (b.status === 'cancelled' || b.status === 'expired') && 'opacity-60',
                      )}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] text-text-secondary">
                        {b.reference}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium leading-tight">{b.user?.name ?? '—'}</p>
                        <p className="text-[11px] text-text-muted">{b.user?.email ?? ''}</p>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <p className="font-medium leading-tight">{b.event?.title ?? '—'}</p>
                        {b.event && (
                          <p className="text-[11px] text-text-muted">
                            {formatEventDate(b.event.date).split(',')[0]}
                          </p>
                        )}
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
                        <Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <Button variant="secondary" size="sm" disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <span className="font-mono text-[13px] text-text-muted">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
