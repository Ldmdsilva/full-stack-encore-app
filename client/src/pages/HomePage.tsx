import * as React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, Radio, MapPin, Clock, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EventCard } from '@/components/EventCard'
import { TicketStub } from '@/components/TicketStub'
import { EVENTS } from '@/lib/mockData'
import { formatStubDate, formatEventDate, formatPrice } from '@/lib/formatters'

// Pulse dot — the live-sync indicator used across the hero
function PulseDot({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex size-2 ${className}`}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-stage-green opacity-60" />
      <span className="relative inline-flex size-2 rounded-full bg-stage-green" />
    </span>
  )
}

// Perforated tear-line divider
function TearLine() {
  return (
    <div className="relative flex items-center py-2" aria-hidden>
      <div className="flex-1 border-t-2 border-dashed border-border-strong/40" />
      <span className="mx-4 flex size-6 items-center justify-center rounded-full bg-ink">
        <Ticket className="size-3 text-marquee-gold" />
      </span>
      <div className="flex-1 border-t-2 border-dashed border-border-strong/40" />
    </div>
  )
}

// Stat pill used in the hero
function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius)] border-[0.5px] border-border bg-card px-5 py-3 shadow-[var(--shadow-card)]">
      <span className="font-mono text-[22px] font-medium leading-none tracking-[-0.02em]">
        {value}
      </span>
      <span className="mt-1 text-[11px] text-text-muted">{label}</span>
    </div>
  )
}

const featuredEvents = EVENTS.slice(0, 3)
const heroEvent = EVENTS[3] // Vela — synth-pop, good image

export function HomePage() {
  const navigate = useNavigate()
  const totalSeats = EVENTS.reduce((s, e) => s + e.availableSeats, 0)

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b-[0.5px] border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:py-24 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          {/* Left: headline + CTA */}
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border-[0.5px] border-stage-green/30 bg-stage-green/10 px-3 py-1.5">
              <PulseDot />
              <span className="font-mono text-[11px] uppercase tracking-widest text-stage-green">
                Live seat maps · Autumn 2026
              </span>
            </div>

            <h1 className="mt-2 font-voice text-[48px] font-medium leading-[1.0] tracking-[-0.025em] sm:text-[64px] lg:text-[72px]">
              Pick your seat,{' '}
              <em className="not-italic text-stamp-red">not just</em> your
              show.
            </h1>

            <p className="mt-5 max-w-lg text-[18px] leading-[1.7] text-text-secondary">
              Encore shows you every seat in the house — live, as they sell.
              Book what you actually want, get a printed ticket stub, and watch
              the house fill in real time.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => navigate('/events')}>
                Browse concerts
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="secondary" size="lg" onClick={() => navigate('/login')}>
                Create account
              </Button>
            </div>

            {/* Stat row */}
            <div className="mt-10 flex flex-wrap gap-3">
              <StatPill value={String(EVENTS.length)} label="shows on sale" />
              <StatPill value={totalSeats.toLocaleString()} label="seats available" />
              <StatPill value="<1s" label="seat-sync time" />
            </div>
          </div>

          {/* Right: hero ticket stub */}
          <div className="relative flex flex-col items-center">
            {/* Shadow stack illusion */}
            <div className="absolute inset-x-4 top-3 h-full rounded-[var(--radius-card)] bg-ink/10" />
            <div className="absolute inset-x-2 top-1.5 h-full rounded-[var(--radius-card)] bg-ink/6" />

            <TicketStub
              eyebrow={formatStubDate(heroEvent.date)}
              title={heroEvent.artist}
              subtitle={heroEvent.title}
              fields={[
                { label: 'Venue', value: heroEvent.venue.name },
                { label: 'From', value: formatPrice(heroEvent.basePrice) },
                { label: 'Seats', value: `${heroEvent.availableSeats} left` },
              ]}
              serial={`ENC-${heroEvent.id.slice(-4).toUpperCase()}`}
              onClick={() => navigate(`/events/${heroEvent.id}`)}
              className="relative w-full max-w-sm"
            />

            {/* Live indicator below stub */}
            <div className="mt-3 flex items-center gap-2 text-[12px] text-text-muted">
              <PulseDot />
              <span>Seat map updating live</span>
              <Radio className="size-3 text-stage-green" />
            </div>

            {/* Floating seat-taken notification */}
            <div className="mt-4 flex items-center gap-2.5 rounded-[var(--radius)] border-[0.5px] border-border bg-card px-4 py-2.5 shadow-[var(--shadow-lift)]">
              <span className="size-2 rounded-full bg-seat-taken" aria-hidden />
              <p className="font-mono text-[12px] text-text-secondary">
                Seat D-7 just taken by another fan
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ─────────────────────────────────────────────── */}
      <section className="border-b-[0.5px] border-border bg-surface-sunk/60">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mb-10 text-center">
            <p className="eyebrow text-stamp-red">The process</p>
            <h2 className="mt-3 font-voice text-[36px] font-medium tracking-[-0.02em]">
              Book in three moves
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                icon: MapPin,
                title: 'Find your show',
                body: 'Browse upcoming concerts by artist, venue, genre, or date. Every event shows real-time seat count — no false "only 2 left" pressure.',
              },
              {
                step: '02',
                icon: Ticket,
                title: 'Pick your seats',
                body: 'Tap a seat on the live map to select it. Green means available. If another fan takes it while you browse, it turns grey immediately — no surprises at checkout.',
              },
              {
                step: '03',
                icon: Clock,
                title: 'Get your stub',
                body: "Confirm with the test card and your printed ticket stub appears instantly. One stub per seat, with section, row, and a real barcode. That's your ticket.",
              },
            ].map(({ step, icon: Icon, title, body }) => (
              <div
                key={step}
                className="relative rounded-[var(--radius-card)] border-[0.5px] border-border bg-card p-6 shadow-[var(--shadow-card)]"
              >
                <div className="mb-4 flex items-start justify-between">
                  <span className="flex size-10 items-center justify-center rounded-[6px] bg-ink">
                    <Icon className="size-5 text-marquee-gold" />
                  </span>
                  <span className="font-mono text-[32px] font-medium leading-none text-border-strong/60">
                    {step}
                  </span>
                </div>
                <h3 className="text-[18px] font-medium">{title}</h3>
                <p className="mt-2 text-[14px] leading-[1.65] text-text-secondary">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Featured events ──────────────────────────────────────────── */}
      <section className="border-b-[0.5px] border-border">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mb-8 flex items-baseline justify-between">
            <div>
              <p className="eyebrow text-stamp-red">On sale now</p>
              <h2 className="mt-2 font-voice text-[36px] font-medium tracking-[-0.02em]">
                Upcoming shows
              </h2>
            </div>
            <Link
              to="/events"
              className="flex items-center gap-1 text-[14px] text-stamp-red transition-opacity hover:opacity-75"
            >
              All concerts <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredEvents.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── The stub — product statement ─────────────────────────────── */}
      <section className="border-b-[0.5px] border-border">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <TearLine />

          <div className="mt-12 grid items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="eyebrow text-ash">The signature</p>
              <h2 className="mt-3 font-voice text-[40px] font-medium leading-[1.05] tracking-[-0.025em]">
                A ticket you can almost tear.
              </h2>
              <p className="mt-4 text-[16px] leading-[1.75] text-text-secondary">
                Every booking produces a printed ticket stub — ink panel, dashed
                tear-line, barcode. The kind of thing you'd find folded in a
                jacket pocket years later and remember exactly where you stood.
              </p>
              <p className="mt-3 text-[16px] leading-[1.75] text-text-secondary">
                One stub per seat. Section, row, price, and a serial number tied
                to your booking reference. No scanning app needed — just the
                reference on the door.
              </p>
              <Button
                className="mt-7"
                variant="secondary"
                size="md"
                onClick={() => navigate('/events')}
              >
                Find a show to book
              </Button>
            </div>

            {/* Stacked stubs */}
            <div className="relative flex flex-col gap-3 lg:pl-6">
              {EVENTS.slice(0, 3).map((evt, i) => (
                <div
                  key={evt.id}
                  className="transition-transform duration-200 hover:-translate-y-1"
                  style={{ zIndex: 3 - i }}
                >
                  <TicketStub
                    variant="compact"
                    eyebrow={formatStubDate(evt.date)}
                    title={evt.artist}
                    subtitle={`${evt.venue.name} · ${evt.venue.city}`}
                    serial={`ENC-${evt.id.slice(-4).toUpperCase()}`}
                    onClick={() => navigate(`/events/${evt.id}`)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Dark CTA ─────────────────────────────────────────────────── */}
      <section className="bg-ink">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center">
          <p className="eyebrow text-marquee-gold">Ready when you are</p>
          <h2 className="mt-4 font-voice text-[44px] font-medium leading-[1.02] tracking-[-0.025em] text-ticket-paper sm:text-[56px]">
            The house is filling.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[17px] leading-[1.7] text-ticket-paper/60">
            Seats sell while you read this. Pick yours before the map turns grey.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-stamp-red text-ticket-paper hover:bg-stamp-red/90"
              onClick={() => navigate('/events')}
            >
              Browse concerts
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="text-ticket-paper/70 hover:text-ticket-paper"
              onClick={() => navigate('/login')}
            >
              Create account
            </Button>
          </div>

          {/* Venue list */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[
              'The Half Moon · London',
              'Corn Exchange · Bristol',
              "St. George’s · Bristol",
              'Electric Ballroom · London',
              'Union Chapel · London',
            ].map((v) => (
              <span key={v} className="font-mono text-[11px] text-ticket-paper/30 uppercase tracking-wider">
                {v}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
