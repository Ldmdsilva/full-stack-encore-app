import * as React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'
import * as venuesApi from '@/lib/api/venues'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/hooks/useAsync'
import { parseApiError } from '@/lib/api/errors'
import type { SeatLayoutItem, Venue } from '@/lib/types'

interface SeatSection {
  code: string
  rows: string
  seatsPerRow: string
  priceMult: string
}

const DEFAULT_SECTIONS: SeatSection[] = [
  { code: 'STALLS', rows: 'A,B,C,D', seatsPerRow: '12', priceMult: '1.6' },
  { code: 'CIRCLE', rows: 'E,F,G', seatsPerRow: '12', priceMult: '1.15' },
  { code: 'BALCONY', rows: 'H,J', seatsPerRow: '12', priceMult: '0.85' },
]

// The server's SeatLayoutItem carries no price multiplier — that's a
// client-only UI convenience for previewing tiered pricing while designing
// a house. Reconstructing sections from an existing venue's flat seat list
// can recover the grouping (section code, rows, seats-per-row) but not the
// multiplier, so it defaults to 1.0 for an edited section.
function sectionsFromSeatLayout(seatLayout: SeatLayoutItem[]): SeatSection[] {
  const bySection = new Map<string, SeatLayoutItem[]>()
  for (const seat of seatLayout) {
    if (!bySection.has(seat.section)) bySection.set(seat.section, [])
    bySection.get(seat.section)!.push(seat)
  }

  const sections: SeatSection[] = []
  for (const [code, seats] of bySection) {
    const rowMap = new Map<string, number>()
    for (const seat of seats) {
      rowMap.set(seat.row, Math.max(rowMap.get(seat.row) ?? 0, seat.number))
    }
    const rows = Array.from(rowMap.keys())
    const seatsPerRow = rows.length > 0 ? Math.max(...rowMap.values()) : 0
    sections.push({ code, rows: rows.join(','), seatsPerRow: String(seatsPerRow), priceMult: '1.0' })
  }
  return sections
}

function buildSeatLayout(sections: SeatSection[]): SeatLayoutItem[] {
  const seats: SeatLayoutItem[] = []
  for (const section of sections) {
    const rows = section.rows
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)
    const perRow = parseInt(section.seatsPerRow, 10) || 0
    for (const row of rows) {
      for (let n = 1; n <= perRow; n++) {
        seats.push({ id: `${row}-${n}`, section: section.code || 'GENERAL', row, number: n })
      }
    }
  }
  return seats
}

export function AdminVenueFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const isEdit = Boolean(id && id !== 'new')

  const venueState = useAsync(
    () => (isEdit && id ? venuesApi.getById(id) : Promise.resolve<{ venue: Venue } | null>(null)),
    [id, isEdit],
  )

  const [name, setName] = React.useState('')
  const [city, setCity] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [sections, setSections] = React.useState<SeatSection[]>(DEFAULT_SECTIONS)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saving, setSaving] = React.useState(false)

  // Derive form state from the fetched venue once it lands — previously
  // this reset to DEFAULT_SECTIONS even when editing an existing venue,
  // silently discarding its real seat layout on every save. Adjusted
  // during render (React's documented alternative to an effect that only
  // mirrors another value) rather than in a useEffect, since the fetch
  // itself is what's async — not this synchronisation step.
  const [syncedFrom, setSyncedFrom] = React.useState<typeof venueState.data>(null)
  if (venueState.status === 'success' && venueState.data && venueState.data !== syncedFrom) {
    const existing = venueState.data.venue
    setSyncedFrom(venueState.data)
    setName(existing.name)
    setCity(existing.city)
    setAddress(existing.address)
    setSections(sectionsFromSeatLayout(existing.seatLayout))
  }

  const totalSeats = sections.reduce((sum, s) => {
    const rows = s.rows.split(',').filter(Boolean).length
    const perRow = parseInt(s.seatsPerRow) || 0
    return sum + rows * perRow
  }, 0)

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Venue name is required'
    if (!city.trim()) errs.city = 'City is required'
    if (!address.trim()) errs.address = 'Address is required'
    if (totalSeats === 0) errs.sections = 'Define at least one section with seats'
    if (totalSeats > 500) errs.sections = `Seat count (${totalSeats}) exceeds the 500-seat limit (ADR-002)`
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        city: city.trim(),
        address: address.trim(),
        seatLayout: buildSeatLayout(sections),
      }
      if (isEdit && id) {
        await venuesApi.update(id, payload)
        toast('Changes saved.', 'success')
      } else {
        await venuesApi.create(payload)
        toast('Venue created.', 'success')
      }
      navigate('/admin/venues')
    } catch (err) {
      toast(parseApiError(err).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateSection = (idx: number, field: keyof SeatSection, value: string) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)))
  }

  const addSection = () => {
    setSections((prev) => [...prev, { code: '', rows: '', seatsPerRow: '12', priceMult: '1.0' }])
  }

  const removeSection = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx))
  }

  if (isEdit && venueState.status === 'loading') {
    return <Spinner label="Loading venue…" className="py-32" />
  }

  if (isEdit && venueState.status === 'error') {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <ErrorState description={venueState.error.message} onRetry={venueState.retry} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-8">
        <button
          onClick={() => navigate('/admin/venues')}
          className="mb-4 flex items-center gap-1.5 text-[13px] text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to venues
        </button>
        <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
          {isEdit ? 'Edit venue' : 'New venue'}
        </p>
        <h1 className="mt-1 font-voice text-[36px] font-medium leading-tight tracking-[-0.02em]">
          {isEdit ? name || 'Edit venue' : 'Create venue'}
        </h1>
      </div>

      <div className="flex flex-col gap-8">
        {/* Identity */}
        <div>
          <h2 className="mb-4 border-b-[0.5px] border-border pb-2 text-[13px] font-medium uppercase tracking-wider text-text-muted">
            Details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Venue name"
              placeholder="The Half Moon"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
            />
            <Input
              label="City"
              placeholder="Colombo"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              error={errors.city}
            />
            <div className="sm:col-span-2">
              <Input
                label="Full address"
                placeholder="123 Galle Road, Colombo 03"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                error={errors.address}
              />
            </div>
          </div>
        </div>

        {/* Seat layout */}
        <div>
          <div className="mb-4 flex items-center justify-between border-b-[0.5px] border-border pb-2">
            <h2 className="text-[13px] font-medium uppercase tracking-wider text-text-muted">
              Seat layout
            </h2>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[12px] text-text-muted">
                {totalSeats} seats {totalSeats > 500 && '— exceeds 500 limit'}
              </span>
              <button
                type="button"
                onClick={addSection}
                className="flex items-center gap-1 text-[12px] text-stamp-red hover:underline"
              >
                <Plus className="size-3" /> Add section
              </button>
            </div>
          </div>

          {errors.sections && (
            <p className="mb-3 text-[13px] text-destructive">{errors.sections}</p>
          )}

          <div className="flex flex-col gap-3">
            {sections.map((s, idx) => (
              <div
                key={idx}
                className="grid gap-3 rounded-[var(--radius)] border-[0.5px] border-border bg-surface-sunk p-4 sm:grid-cols-4"
              >
                <Input
                  label="Section code"
                  placeholder="STALLS"
                  value={s.code}
                  onChange={(e) => updateSection(idx, 'code', e.target.value.toUpperCase())}
                />
                <Input
                  label="Rows (comma-sep)"
                  placeholder="A,B,C,D"
                  value={s.rows}
                  onChange={(e) => updateSection(idx, 'rows', e.target.value)}
                />
                <Input
                  label="Seats per row"
                  type="number"
                  min="1"
                  max="50"
                  value={s.seatsPerRow}
                  onChange={(e) => updateSection(idx, 'seatsPerRow', e.target.value)}
                />
                <div className="flex items-end gap-2">
                  <Input
                    label="Price mult."
                    type="number"
                    step="0.05"
                    min="0.5"
                    max="3"
                    value={s.priceMult}
                    onChange={(e) => updateSection(idx, 'priceMult', e.target.value)}
                    hint="Preview only"
                  />
                  <button
                    type="button"
                    onClick={() => removeSection(idx)}
                    className="mb-0.5 flex size-[42px] shrink-0 items-center justify-center rounded-[var(--radius)] border-[0.5px] border-stamp-red/20 text-stamp-red transition-colors hover:bg-stamp-red/10"
                    title="Remove section"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-2 text-[12px] text-text-muted">
            Maximum 500 seats per venue (see ADR-002). The price multiplier is a design preview
            only — actual seat prices are computed per event from its base price.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center justify-end gap-3 border-t-[0.5px] border-border pt-6">
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/venues')}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} isLoading={saving}>
          <Save className="size-4" />
          {isEdit ? 'Save changes' : 'Create venue'}
        </Button>
      </div>
    </div>
  )
}
