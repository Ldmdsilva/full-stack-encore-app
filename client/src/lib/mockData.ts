import type { EventDetail, Seat } from './types'

// Deterministic pseudo-random so seat maps are stable across renders.
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

// Build a seat map: sections A–C, rows within, numbered seats. A slice
// is pre-booked so the map reads as a real, partly-sold house.
function buildSeats(seed: number, basePrice: number): Seat[] {
  const rand = seeded(seed)
  const sections = [
    { code: 'STALLS', rows: ['A', 'B', 'C', 'D'], perRow: 12, mult: 1.6 },
    { code: 'CIRCLE', rows: ['E', 'F', 'G'], perRow: 12, mult: 1.15 },
    { code: 'BALCONY', rows: ['H', 'J'], perRow: 12, mult: 0.85 },
  ]
  const seats: Seat[] = []
  for (const section of sections) {
    for (const row of section.rows) {
      for (let n = 1; n <= section.perRow; n++) {
        seats.push({
          id: `${row}-${n}`,
          section: section.code,
          row,
          number: n,
          status: rand() < 0.34 ? 'booked' : 'available',
          price: Math.round(basePrice * section.mult),
        })
      }
    }
  }
  return seats
}

const raw: Omit<EventDetail, 'seats' | 'availableSeats' | 'totalSeats'>[] = [
  {
    id: 'evt-phoebe',
    title: 'The Marfa Sessions',
    artist: 'Phoebe Wren',
    date: '2026-09-12T20:00:00',
    basePrice: 32,
    venue: { id: 'v1', name: 'The Half Moon', city: 'London' },
    status: 'scheduled',
    genre: 'Folk',
    description:
      'A candlelit evening of desert-country songwriting, recorded live to tape. Phoebe Wren brings the full seven-piece band and a string section for one night only.',
    image:
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&h=800&fit=crop&auto=format',
  },
  {
    id: 'evt-kojo',
    title: 'Nightbus, Live',
    artist: 'Kojo & the Meridian',
    date: '2026-09-19T21:00:00',
    basePrice: 28,
    venue: { id: 'v2', name: 'Corn Exchange', city: 'Bristol' },
    status: 'scheduled',
    genre: 'Soul',
    description:
      'Late-night soul and low-slung funk from a band built for the small hours. Support from the Meridian horns.',
    image:
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&h=800&fit=crop&auto=format',
  },
  {
    id: 'evt-atlas',
    title: 'Cartography',
    artist: 'Atlas Quartet',
    date: '2026-10-03T19:30:00',
    basePrice: 40,
    venue: { id: 'v3', name: 'St. George’s', city: 'Bristol' },
    status: 'scheduled',
    genre: 'Contemporary',
    description:
      'The Atlas Quartet map new terrain across four movements, pairing minimalist string writing with field recordings gathered on tour.',
    image:
      'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=1200&h=800&fit=crop&auto=format',
  },
  {
    id: 'evt-vela',
    title: 'Neon Meridian Tour',
    artist: 'Vela',
    date: '2026-10-11T20:30:00',
    basePrice: 36,
    venue: { id: 'v4', name: 'Electric Ballroom', city: 'London' },
    status: 'scheduled',
    genre: 'Synth-pop',
    description:
      'Vela returns with a wall of analogue synths and a light rig built for the record. Expect the new album front to back.',
    image:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&h=800&fit=crop&auto=format',
  },
  {
    id: 'evt-oak',
    title: 'Hymnal',
    artist: 'The Oak Choir',
    date: '2026-10-18T19:00:00',
    basePrice: 24,
    venue: { id: 'v5', name: 'Union Chapel', city: 'London' },
    status: 'scheduled',
    genre: 'Choral',
    description:
      'Forty voices under a vaulted roof. A programme of new commissions and reworked standards, sung in the round.',
    image:
      'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=1200&h=800&fit=crop&auto=format',
  },
  {
    id: 'evt-riven',
    title: 'Static Bloom',
    artist: 'Riven',
    date: '2026-10-25T21:00:00',
    basePrice: 30,
    venue: { id: 'v2', name: 'Corn Exchange', city: 'Bristol' },
    status: 'scheduled',
    genre: 'Post-rock',
    description:
      'Instrumental crescendos and slow-building noise from a band that treats volume as an instrument.',
    image:
      'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&h=800&fit=crop&auto=format',
  },
]

export const EVENTS: EventDetail[] = raw.map((e, i) => {
  const seats = buildSeats(i * 97 + 7, e.basePrice)
  return {
    ...e,
    seats,
    totalSeats: seats.length,
    availableSeats: seats.filter((s) => s.status === 'available').length,
  }
})

export function getEvent(id: string): EventDetail | undefined {
  const e = EVENTS.find((ev) => ev.id === id)
  if (!e) return undefined
  // Return a deep-ish clone so seat mutations don't leak between views.
  return { ...e, seats: e.seats.map((s) => ({ ...s })) }
}

export const VENUES = Array.from(
  new Map(EVENTS.map((e) => [e.venue.id, e.venue])).values(),
)

export const GENRES = Array.from(new Set(EVENTS.map((e) => e.genre))).sort()
