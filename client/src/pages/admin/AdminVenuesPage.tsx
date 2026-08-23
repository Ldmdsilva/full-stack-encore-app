import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import * as venuesApi from '@/lib/api/venues'
import * as adminApi from '@/lib/api/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { useAsync } from '@/hooks/useAsync'
import { parseApiError } from '@/lib/api/errors'
import { cn } from '@/lib/utils'
import type { Venue } from '@/lib/types'

export function AdminVenuesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = React.useState('')
  const [deleteTarget, setDeleteTarget] = React.useState<Venue | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)

  const venuesState = useAsync(() => venuesApi.list(), [], { isEmpty: (d) => d.venues.length === 0 })
  // Admin's own listing includes cancelled and past events, so it's the
  // accurate source for "is this venue safe to delete" — not the public
  // (future + scheduled only) GET /api/events.
  const eventsState = useAsync(() => adminApi.listEvents({ limit: 500 }), [])

  const venues = venuesState.status === 'success' || venuesState.status === 'empty' ? venuesState.data.venues : []
  const eventCountByVenue = React.useMemo(() => {
    const map = new Map<string, number>()
    if (eventsState.status === 'success') {
      for (const evt of eventsState.data.events) {
        map.set(evt.venue.id, (map.get(evt.venue.id) ?? 0) + 1)
      }
    }
    return map
  }, [eventsState])

  const filtered = venues.filter((v) => `${v.name} ${v.city}`.toLowerCase().includes(search.toLowerCase()))

  const closeModal = () => {
    if (deleting) return
    setDeleteTarget(null)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await venuesApi.remove(deleteTarget.id)
      setDeleteTarget(null)
      venuesState.retry()
    } catch (err) {
      const apiError = parseApiError(err)
      if (apiError.code === 'VENUE_IN_USE') {
        const details = apiError.details as { referencingEventsCount?: number } | undefined
        const count = details?.referencingEventsCount
        setDeleteError(
          count
            ? `Cannot delete "${deleteTarget.name}" — ${count} event${count === 1 ? '' : 's'} reference this venue.`
            : apiError.message,
        )
      } else {
        setDeleteError(apiError.message)
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
            Manage
          </p>
          <h1 className="mt-1 font-voice text-[36px] font-medium leading-tight tracking-[-0.02em]">
            Venues
          </h1>
        </div>
        <Button onClick={() => navigate('/admin/venues/new')} size="sm">
          <Plus className="size-4" />
          New venue
        </Button>
      </div>

      {/* Search */}
      <div className="mb-5 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-[34px] size-4 text-text-muted" />
        <Input
          label="Search venues"
          placeholder="Name or city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {venuesState.status === 'loading' && <Spinner label="Loading venues…" />}
      {venuesState.status === 'error' && (
        <ErrorState description={venuesState.error.message} onRetry={venuesState.retry} />
      )}
      {venuesState.status === 'empty' && (
        <EmptyState title="No venues yet" description="Create one above." />
      )}

      {venuesState.status === 'success' && (
        <>
          {/* Table */}
          <div className="rounded-[var(--radius-card)] border-[0.5px] border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b-[0.5px] border-border bg-surface-sunk">
                  <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-text-muted">
                    Venue
                  </th>
                  <th className="hidden px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-text-muted md:table-cell">
                    Capacity
                  </th>
                  <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-text-muted">
                    Events
                  </th>
                  <th className="px-4 py-3 text-right font-mono text-[11px] uppercase tracking-wider text-text-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-text-muted">
                      No venues match "{search}"
                    </td>
                  </tr>
                ) : (
                  filtered.map((v, i) => {
                    const eventCount = eventCountByVenue.get(v.id) ?? 0
                    return (
                      <tr
                        key={v.id}
                        className={cn(
                          'transition-colors hover:bg-surface-sunk/40',
                          i < filtered.length - 1 && 'border-b-[0.5px] border-border',
                        )}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium leading-tight">{v.name}</p>
                          <p className="mt-0.5 text-[11px] text-text-muted">{v.city}</p>
                        </td>
                        <td className="hidden px-4 py-3 text-right font-mono text-text-secondary md:table-cell">
                          {v.capacity} seats
                        </td>
                        <td className="px-4 py-3 text-right">
                          {eventCount > 0 ? (
                            <span className="font-mono text-[12px]">{eventCount}</span>
                          ) : (
                            <span className="text-[12px] text-text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/admin/venues/${v.id}/edit`}
                              className="flex size-8 items-center justify-center rounded-[6px] border-[0.5px] border-border bg-card text-text-secondary transition-colors hover:border-border-strong hover:text-foreground"
                              title="Edit venue"
                            >
                              <Pencil className="size-3.5" />
                            </Link>
                            <button
                              onClick={() => setDeleteTarget(v)}
                              className="flex size-8 items-center justify-center rounded-[6px] border-[0.5px] border-stamp-red/20 bg-stamp-red/5 text-stamp-red transition-colors hover:bg-stamp-red/15"
                              title="Delete venue"
                            >
                              <Trash2 className="size-3.5" />
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
            {filtered.length} {filtered.length === 1 ? 'venue' : 'venues'}
          </p>
        </>
      )}

      <Modal
        open={deleteTarget !== null}
        onClose={closeModal}
        title="Delete this venue?"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={closeModal} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete} isLoading={deleting}>
              Delete venue
            </Button>
          </>
        }
      >
        {deleteError ? (
          <p role="alert" className="text-destructive">
            {deleteError}
          </p>
        ) : (
          deleteTarget && (
            <p>
              <span className="font-medium text-foreground">{deleteTarget.name}</span> will be
              permanently deleted. This cannot be undone.
            </p>
          )
        )}
      </Modal>
    </div>
  )
}
