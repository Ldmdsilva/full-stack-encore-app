import * as React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'
import { VENUES } from '@/lib/mockData'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

export function AdminVenueFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id && id !== 'new')
  const existing = isEdit ? VENUES.find((v) => v.id === id) : undefined

  const [name, setName] = React.useState(existing?.name ?? '')
  const [city, setCity] = React.useState(existing?.city ?? '')
  const [address, setAddress] = React.useState(existing ? `${existing.name}, ${existing.city}` : '')
  const [sections, setSections] = React.useState<SeatSection[]>(DEFAULT_SECTIONS)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [saved, setSaved] = React.useState(false)

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

  const handleSave = () => {
    if (!validate()) return
    setSaved(true)
    setTimeout(() => navigate('/admin/venues'), 1200)
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
          {isEdit ? existing?.name ?? 'Edit venue' : 'Create venue'}
        </h1>
      </div>

      {saved && (
        <div className="mb-6 rounded-[var(--radius)] border-[0.5px] border-stage-green/30 bg-stage-green/10 px-4 py-3 text-[14px] text-stage-green">
          {isEdit ? 'Changes saved.' : 'Venue created.'} Redirecting…
        </div>
      )}

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
              placeholder="London"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              error={errors.city}
            />
            <div className="sm:col-span-2">
              <Input
                label="Full address"
                placeholder="Lower Richmond Road, Putney, London SW15 1EU"
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
            Maximum 500 seats per venue (see ADR-002). Price = event base price × multiplier.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center justify-end gap-3 border-t-[0.5px] border-border pt-6">
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/venues')}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saved}>
          <Save className="size-4" />
          {isEdit ? 'Save changes' : 'Create venue'}
        </Button>
      </div>
    </div>
  )
}
