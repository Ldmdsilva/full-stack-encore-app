import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { VENUES } from '@/lib/mockData'
import { EVENTS } from '@/lib/mockData'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface VenueRow {
  id: string
  name: string
  city: string
  address: string
  capacity: number
  eventCount: number
}

function buildVenueRows(): VenueRow[] {
  return VENUES.map((v) => ({
    id: v.id,
    name: v.name,
    city: v.city,
    address: `${v.name}, ${v.city}`,
    capacity: 108, // 9 rows × 12 seats from mockData
    eventCount: EVENTS.filter((e) => e.venue.id === v.id).length,
  }))
}

export function AdminVenuesPage() {
  const navigate = useNavigate()
  const [venues, setVenues] = React.useState<VenueRow[]>(buildVenueRows)
  const [search, setSearch] = React.useState('')
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const filtered = venues.filter((v) =>
    `${v.name} ${v.city}`.toLowerCase().includes(search.toLowerCase()),
  )

  const handleDelete = (id: string) => {
    const venue = venues.find((v) => v.id === id)
    if (venue && venue.eventCount > 0) {
      alert(`Cannot delete "${venue.name}" — ${venue.eventCount} event(s) reference this venue.`)
      setDeletingId(null)
      return
    }
    setVenues((prev) => prev.filter((v) => v.id !== id))
    setDeletingId(null)
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
                  {search ? `No venues match "${search}"` : 'No venues yet. Create one above.'}
                </td>
              </tr>
            ) : (
              filtered.map((v, i) => (
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
                    {v.eventCount > 0 ? (
                      <span className="font-mono text-[12px]">{v.eventCount}</span>
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
                      {deletingId === v.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDelete(v.id)}
                            className="rounded-[6px] border-[0.5px] border-stamp-red/40 bg-stamp-red/10 px-2.5 py-1 text-[12px] text-stamp-red hover:bg-stamp-red/20"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="text-[12px] text-text-muted hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            v.eventCount > 0
                              ? alert(`Cannot delete "${v.name}" — ${v.eventCount} event(s) reference this venue.`)
                              : setDeletingId(v.id)
                          }
                          className={cn(
                            'flex size-8 items-center justify-center rounded-[6px] border-[0.5px] transition-colors',
                            v.eventCount > 0
                              ? 'cursor-not-allowed border-border text-seat-taken'
                              : 'border-stamp-red/20 bg-stamp-red/5 text-stamp-red hover:bg-stamp-red/15',
                          )}
                          title={v.eventCount > 0 ? 'Cannot delete — events reference this venue' : 'Delete venue'}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-mono text-[12px] text-text-muted">
        {filtered.length} {filtered.length === 1 ? 'venue' : 'venues'}
      </p>
    </div>
  )
}
