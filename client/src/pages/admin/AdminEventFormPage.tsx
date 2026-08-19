import * as React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import * as eventsApi from '@/lib/api/events'
import * as venuesApi from '@/lib/api/venues'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Textarea } from '@/components/ui/Textarea'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/ErrorState'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/toast'
import { useAsync } from '@/hooks/useAsync'
import { parseApiError } from '@/lib/api/errors'
import type { EventStatus } from '@/lib/types'

interface EventFormState {
  title: string
  artist: string
  date: string
  venueRef: string
  basePrice: string
  genre: string
  description: string
  imageUrl: string
  status: EventStatus
}

const EMPTY_FORM: EventFormState = {
  title: '',
  artist: '',
  date: '',
  venueRef: '',
  basePrice: '',
  genre: '',
  description: '',
  imageUrl: '',
  status: 'scheduled',
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
  const { toast } = useToast()
  const isEdit = Boolean(id && id !== 'new')

  const eventState = useAsync(
    () => (isEdit && id ? eventsApi.getById(id) : Promise.resolve(null)),
    [id, isEdit],
  )
  const venuesState = useAsync(() => venuesApi.list(), [], { isEmpty: (d) => d.venues.length === 0 })

  const [form, setForm] = React.useState<EventFormState>(EMPTY_FORM)
  const [errors, setErrors] = React.useState<Partial<Record<keyof EventFormState, string>>>({})
  const [saving, setSaving] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  // Derive the form's initial values from the fetched event once it lands.
  // Adjusted during render (React's documented alternative to an effect
  // that only mirrors another value) rather than in a useEffect, since the
  // fetch itself is what's async — not this synchronisation step.
  const [syncedFrom, setSyncedFrom] = React.useState<typeof eventState.data>(null)
  if (eventState.status === 'success' && eventState.data && eventState.data !== syncedFrom) {
    const existing = eventState.data.event
    setSyncedFrom(eventState.data)
    setForm({
      title: existing.title,
      artist: existing.artist,
      date: existing.date.slice(0, 16),
      venueRef: existing.venue.id,
      basePrice: String(existing.basePrice),
      genre: existing.genre,
      description: existing.description ?? '',
      imageUrl: existing.imageUrl ?? '',
      status: existing.status,
    })
  }

  const set = (key: keyof EventFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof EventFormState, string>> = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    if (!form.artist.trim()) errs.artist = 'Artist is required'
    if (!form.date) errs.date = 'Date is required'
    if (!form.venueRef) errs.venueRef = 'Select a venue'
    if (!form.basePrice || Number(form.basePrice) <= 0) errs.basePrice = 'Enter a valid price'
    if (!form.genre.trim()) errs.genre = 'Genre is required'
    if (!form.description.trim()) errs.description = 'Description is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        artist: form.artist.trim(),
        genre: form.genre.trim(),
        imageUrl: form.imageUrl.trim() || undefined,
        description: form.description.trim(),
        date: new Date(form.date).toISOString(),
        basePrice: Number(form.basePrice),
        venueRef: form.venueRef,
      }
      if (isEdit && id) {
        await eventsApi.update(id, { ...payload, status: form.status })
        toast('Changes saved.', 'success')
      } else {
        await eventsApi.create(payload)
        toast('Event created.', 'success')
      }
      navigate('/admin/events')
    } catch (err) {
      toast(parseApiError(err).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await eventsApi.remove(id)
      toast('Event deleted.', 'success')
      navigate('/admin/events')
    } catch (err) {
      toast(parseApiError(err).message, 'error')
      setDeleting(false)
    }
  }

  const venues = venuesState.status === 'success' || venuesState.status === 'empty' ? venuesState.data.venues : []
  const selectedVenue = venues.find((v) => v.id === form.venueRef)

  if (isEdit && eventState.status === 'loading') {
    return <Spinner label="Loading event…" className="py-32" />
  }

  if (isEdit && eventState.status === 'error') {
    return (
      <div className="mx-auto max-w-2xl px-6 py-8">
        <ErrorState description={eventState.error.message} onRetry={eventState.retry} />
      </div>
    )
  }

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
          {isEdit ? form.title || 'Edit event' : 'Create event'}
        </h1>
      </div>

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
            list="genre-suggestions"
          />
          <datalist id="genre-suggestions">
            {['Folk', 'Soul', 'Contemporary', 'Synth-pop', 'Choral', 'Post-rock'].map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
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

        <FormSection title="When & where">
          <Input
            label="Date & time"
            type="datetime-local"
            value={form.date}
            onChange={set('date')}
            error={errors.date}
          />
          <div>
            <Select
              label="Venue"
              value={form.venueRef}
              onChange={set('venueRef')}
            >
              <option value="">Select venue…</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}, {v.city}
                </option>
              ))}
            </Select>
            {errors.venueRef && <p className="mt-1.5 text-[13px] text-destructive">{errors.venueRef}</p>}
            {selectedVenue && !errors.venueRef && (
              <p className="mt-1.5 font-mono text-[12px] text-text-muted">
                {selectedVenue.city}
              </p>
            )}
          </div>
        </FormSection>

        <FormSection title="Ticketing">
          <Input
            label="Base price (LKR)"
            type="number"
            min="1"
            step="0.50"
            placeholder="6500.00"
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
                    Stalls: Rs {Math.round(Number(form.basePrice) * 1.6)}
                  </p>
                  <p className="font-mono">
                    Circle: Rs {Math.round(Number(form.basePrice) * 1.15)}
                  </p>
                  <p className="font-mono">
                    Balcony: Rs {Math.round(Number(form.basePrice) * 0.85)}
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
              value={form.imageUrl}
              onChange={set('imageUrl')}
            />
          </FormRow>
          {form.imageUrl && (
            <FormRow>
              <div className="overflow-hidden rounded-[var(--radius)] border-[0.5px] border-border">
                <img
                  src={form.imageUrl}
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
            onClick={() => setDeleteOpen(true)}
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
          <Button size="sm" onClick={handleSave} isLoading={saving}>
            <Save className="size-4" />
            {isEdit ? 'Save changes' : 'Create event'}
          </Button>
        </div>
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => !deleting && setDeleteOpen(false)}
        title="Delete this event?"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete} isLoading={deleting}>
              Delete event
            </Button>
          </>
        }
      >
        <p>
          <span className="font-medium text-foreground">{form.title || 'This event'}</span> will
          be deleted. Confirmed bookings against it are refunded and their customers notified.
          This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
