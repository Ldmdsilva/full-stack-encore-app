import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { Input, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { EventCard } from '@/components/EventCard'
import { EVENTS, VENUES, GENRES } from '@/lib/mockData'

export function EventListPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const venue = params.get('venue') ?? ''
  const genre = params.get('genre') ?? ''

  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''

  const [search, setSearch] = React.useState(q)

  // Debounce the free-text search into the URL (shareable, survives refresh).
  React.useEffect(() => {
    const t = setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (search) next.set('q', search)
          else next.delete('q')
          return next
        },
        { replace: true },
      )
    }, 300)
    return () => clearTimeout(t)
  }, [search, setParams])

  const setParam = (key: string, value: string) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  const filtered = EVENTS.filter((e) => {
    const matchQ =
      !q ||
      `${e.artist} ${e.title}`.toLowerCase().includes(q.toLowerCase())
    const matchVenue = !venue || e.venue.id === venue
    const matchGenre = !genre || e.genre === genre
    const eventDate = new Date(e.date)
    const matchFrom = !from || eventDate >= new Date(from)
    const matchTo = !to || eventDate <= new Date(to + 'T23:59:59')
    return matchQ && matchVenue && matchGenre && matchFrom && matchTo
  })

  const hasFilters = q || venue || genre || from || to
  const clear = () => {
    setSearch('')
    setParams({}, { replace: true })
  }

  return (
    <>
      {/* Hero */}
      <section className="border-b-[0.5px] border-border">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
          <p className="eyebrow text-stamp-red">Now on sale · Autumn 2026</p>
          <h1 className="mt-4 max-w-3xl font-voice text-[44px] font-medium leading-[1.02] tracking-[-0.02em] sm:text-[64px]">
            Every seat is a{' '}
            <span className="italic text-stamp-red">ticket</span> you can
            almost tear.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-[1.7] text-text-secondary">
            Live seat maps, honest availability, and a printed-stub confirmation
            for every show. Pick your seat and watch the house fill in real time.
          </p>
        </div>
      </section>

      {/* Filter bar */}
      <section className="sticky top-16 z-30 border-b-[0.5px] border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 md:flex-row md:items-end">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-[34px] size-4 text-text-muted" />
            <Input
              label="Search"
              placeholder="Artist or show name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            label="Venue"
            value={venue}
            onChange={(e) => setParam('venue', e.target.value)}
            className="md:w-48"
          >
            <option value="">All venues</option>
            {VENUES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
          <Select
            label="Genre"
            value={genre}
            onChange={(e) => setParam('genre', e.target.value)}
            className="md:w-44"
          >
            <option value="">All genres</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
          <Input
            label="From"
            type="date"
            value={from}
            onChange={(e) => setParam('from', e.target.value)}
            className="md:w-40"
          />
          <Input
            label="To"
            type="date"
            value={to}
            onChange={(e) => setParam('to', e.target.value)}
            className="md:w-40"
          />
          {hasFilters && (
            <Button variant="ghost" size="md" onClick={clear} className="shrink-0">
              <X className="size-4" />
              Clear
            </Button>
          )}
        </div>
      </section>

      {/* Results */}
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-[22px] font-medium">Upcoming concerts</h2>
          <p className="font-mono text-[13px] text-text-muted">
            {filtered.length} {filtered.length === 1 ? 'show' : 'shows'}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border-[0.5px] border-dashed border-border-strong px-6 py-16 text-center">
            <h3 className="font-voice text-[24px] font-medium">
              No concerts match your search
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-[15px] text-text-secondary">
              Try a different artist, venue, or genre — or clear your filters to
              see everything on sale.
            </p>
            <Button variant="secondary" size="md" onClick={clear} className="mt-6">
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
