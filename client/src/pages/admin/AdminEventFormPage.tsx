import * as React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { EVENTS, VENUES, GENRES } from '@/lib/mockData'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface EventFormState {
  title: string
  artist: string
  date: string
  venueId: string
  basePrice: string
  genre: string
  description: string
  image: string
  status: 'scheduled' | 'cancelled'
}

function Textarea({
  label,
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }) {
  const id = React.useId()
  return (
    <div className="flex flex-col">
      {label && (
        <label htmlFor={id} className="mb-1.5 text-[13px] text-text-secondary">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={cn(
          'min-h-[100px] rounded-[var(--radius)] border-[0.5px] border-border bg-card px-3 py-2.5 text-[15px] resize-y',
          'placeholder:text-text-muted transition-colors',
          'focus-visible:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink',
          error && 'border-destructive',
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-[13px] text-destructive">{error}</p>}
    </div>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 border-b-[0.5px] border-border pb-2 text-[13px] font-medium uppercase tracking-wider text-text-muted">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>
}

export function AdminEventFormPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id && id !== 'new')
  const existing = isEdit ? EVENTS.find((e) => e.id === id) : undefined

  const [form, setForm] = React.useState<EventFormState>({
    title: existing?.title ?? '',
    artist: existing?.artist ?? '',
    date: existing ? existing.date.slice(0, 16) : '',
    venueId: existing?.venue.id ?? '',
    basePrice: existing ? String(existing.basePrice) : '',
    genre: existing?.genre ?? '',
    description: existing?.description ?? '',
    image: existing?.image ?? '',
    status: existing?.status ?? 'scheduled',
  })

  const [errors, setErrors] = React.useState<Partial<EventFormState>>({})
  const [saved, setSaved] = React.useState(false)

  const set = (key: keyof EventFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = (): boolean => {
    const errs: Partial<EventFormState> = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.artist.trim()) errs.artist = 'Artist is required'
    if (!form.date) errs.date = 'Date is required'
    if (!form.venueId) errs.venueId = 'Select a venue'
    if (!form.basePrice || Number(form.basePrice) <= 0) errs.basePrice = 'Enter a valid price'
    if (!form.genre.trim()) errs.genre = 'Genre is required'
    if (!form.description.trim()) errs.description = 'Description is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    // In a real app: POST/PATCH to API. For now, show success state.
    setSaved(true)
    setTimeout(() => {
      navigate('/admin/events')
    }, 1200)
  }

  const selectedVenue = VENUES.find((v) => v.id === form.venueId)

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/admin/events')}
          className="mb-4 flex items-center gap-1.5 text-[13px] text-text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to events
        </button>
        <p className="font-mono text-[11px] uppercase tracking-widest text-text-muted">
          {isEdit ? 'Edit event' : 'New event'}
        </p>
        <h1 className="mt-1 font-voice text-[36px] font-medium leading-tight tracking-[-0.02em]">
          {isEdit ? existing?.title ?? 'Edit event' : 'Create event'}
        </h1>
      </div>

      {saved && (
        <div className="mb-6 rounded-[var(--radius)] border-[0.5px] border-stage-green/30 bg-stage-green/10 px-4 py-3 text-[14px] text-stage-green">
          {isEdit ? 'Changes saved.' : 'Event created.'} Redirecting…
        </div>
      )}

      <div className="flex flex-col gap-8">
        <FormSection title="Identity">
          <Input
            label="Show title"
            placeholder="The Marfa Sessions"
            value={form.title}
            onChange={set('title')}
            error={errors.title}
          />
          <Input
            label="Artist / act"
            placeholder="Phoebe Wren"
            value={form.artist}
            onChange={set('artist')}
            error={errors.artist}
          />
          <Input
            label="Genre"
            placeholder="Folk, Soul, Post-rock…"
            value={form.genre}
            onChange={set('genre')}
            error={errors.genre}
          />
          <div>
            <Select
              label="Status"
              value={form.status}
              onChange={set('status')}
            >
              <option value="scheduled">Scheduled</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
          <FormRow>
            <Textarea
              label="Description"
              placeholder="A short paragraph shown on the event detail page."
              value={form.description}
              onChange={set('description')}
              error={errors.description}
            />
          </FormRow>
        </FormSection>

        <FormSection title="When &amp; where">
          <Input
            label="Date &amp; time"
            type="datetime-local"
            value={form.date}
            onChange={set('date')}
            error={errors.date}
          />
          <div>
            <Select
              label="Venue"
              value={form.venueId}
              onChange={set('venueId')}
            >
              <option value="">Select venue…</option>
              {VENUES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}, {v.city}
                </option>
              ))}
            </Select>
            {selectedVenue && (
              <p className="mt-1.5 font-mono text-[12px] text-text-muted">
                {selectedVenue.city}
              </p>
            )}
          </div>
        </FormSection>

        <FormSection title="Ticketing">
          <Input
            label="Base price (GBP)"
            type="number"
            min="1"
            step="0.50"
            placeholder="32.00"
            value={form.basePrice}
            onChange={set('basePrice')}
            error={errors.basePrice}
          />
          <div className="flex flex-col gap-1.5">
            <p className="text-[13px] text-text-secondary">Pricing tiers (auto)</p>
            <div className="rounded-[var(--radius)] border-[0.5px] border-border bg-surface-sunk px-3 py-2.5 text-[13px] text-text-muted">
              {form.basePrice ? (
                <>
                  <p className="font-mono">
                    Stalls: £{Math.round(Number(form.basePrice) * 1.6)}
                  </p>
                  <p className="font-mono">
                    Circle: £{Math.round(Number(form.basePrice) * 1.15)}
                  </p>
                  <p className="font-mono">
                    Balcony: £{Math.round(Number(form.basePrice) * 0.85)}
                  </p>
                </>
              ) : (
                <span>Enter a base price above</span>
              )}
            </div>
          </div>
          <FormRow>
            <Input
              label="Cover image URL"
              type="url"
              placeholder="https://images.unsplash.com/…"
              value={form.image}
              onChange={set('image')}
            />
          </FormRow>
          {form.image && (
            <FormRow>
              <div className="overflow-hidden rounded-[var(--radius)] border-[0.5px] border-border">
                <img
                  src={form.image}
                  alt="Event cover preview"
                  className="h-36 w-full object-cover"
                />
              </div>
            </FormRow>
          )}
        </FormSection>
      </div>

      {/* Footer actions */}
      <div className="mt-8 flex items-center justify-between border-t-[0.5px] border-border pt-6">
        {isEdit ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => navigate('/admin/events')}
          >
            <Trash2 className="size-4" />
            Delete event
          </Button>
        ) : (
          <div />
        )}
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/events')}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saved}>
            <Save className="size-4" />
            {isEdit ? 'Save changes' : 'Create event'}
          </Button>
        </div>
      </div>
    </div>
  )
}
