// MSW request handlers mirroring the running server's REST contract (as
// captured in src/lib/types.ts and the src/lib/api/*.ts modules) closely
// enough to drive the test suite. Individual tests override a handler for a
// single case (a 409 conflict, an expired hold, ...) via `server.use(...)`;
// `setupTests.ts` resets to these defaults after every test.
import { http, HttpResponse } from 'msw'
import type {
  AdminEvent,
  AdminStats,
  Booking,
  EventSummary,
  Seat,
  User,
  Venue,
} from '@/lib/types'
import {
  adminEventA,
  adminEventB,
  adminStats,
  adminUser,
  bookingConfirmed,
  bookingPending,
  customerUser,
  eventSeats,
  eventSummaryA,
  eventSummaryB,
  venueA,
  venueB,
} from '@/test/fixtures'

const API = '/api'

function errorBody(code: string, message: string, details?: unknown) {
  return { error: { code, message, details } }
}

function userForToken(authHeader: string | null): User | null {
  if (authHeader === 'Bearer test-token') return customerUser
  if (authHeader === 'Bearer admin-token') return adminUser
  return null
}

const events: EventSummary[] = [eventSummaryA, eventSummaryB]
const eventSeatsById: Record<string, Seat[]> = {
  [eventSummaryA.id]: eventSeats,
  [eventSummaryB.id]: [],
}
const venues: Venue[] = [venueA, venueB]
const adminEvents: AdminEvent[] = [adminEventA, adminEventB]
const bookings: Booking[] = [bookingPending, bookingConfirmed]

export const handlers = [
  // --- auth ---
  http.post(`${API}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as { email?: string }
    if (body.email === 'taken@example.com') {
      return HttpResponse.json(errorBody('DUPLICATE_EMAIL', 'An account with this email already exists.'), {
        status: 409,
      })
    }
    return HttpResponse.json({ user: customerUser, token: 'test-token' }, { status: 201 })
  }),

  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string }
    if (body.email === customerUser.email && body.password === 'Password123') {
      return HttpResponse.json({ user: customerUser, token: 'test-token' }, { status: 200 })
    }
    if (body.email === adminUser.email && body.password === 'Password123') {
      return HttpResponse.json({ user: adminUser, token: 'admin-token' }, { status: 200 })
    }
    return HttpResponse.json(errorBody('INVALID_CREDENTIALS', 'Incorrect email or password.'), { status: 401 })
  }),

  http.get(`${API}/users/me`, ({ request }) => {
    const user = userForToken(request.headers.get('authorization'))
    if (!user) return HttpResponse.json(errorBody('UNAUTHORIZED', 'Please sign in to continue.'), { status: 401 })
    return HttpResponse.json({ user })
  }),

  http.patch(`${API}/users/me`, async ({ request }) => {
    const user = userForToken(request.headers.get('authorization'))
    if (!user) return HttpResponse.json(errorBody('UNAUTHORIZED', 'Please sign in to continue.'), { status: 401 })
    const patch = (await request.json()) as Partial<User>
    return HttpResponse.json({ user: { ...user, ...patch } })
  }),

  http.delete(`${API}/users/me`, () => new HttpResponse(null, { status: 204 })),

  // --- events ---
  http.get(`${API}/events`, ({ request }) => {
    const url = new URL(request.url)
    const artist = url.searchParams.get('artist')?.toLowerCase()
    const genre = url.searchParams.get('genre')
    const venue = url.searchParams.get('venue')
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '9')

    let filtered = events
    if (artist) {
      filtered = filtered.filter(
        (e) => e.artist.toLowerCase().includes(artist) || e.title.toLowerCase().includes(artist),
      )
    }
    if (genre) filtered = filtered.filter((e) => e.genre === genre)
    if (venue) filtered = filtered.filter((e) => e.venue.id === venue)

    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const start = (page - 1) * limit
    return HttpResponse.json({
      events: filtered.slice(start, start + limit),
      total,
      page,
      totalPages,
    })
  }),

  http.get(`${API}/events/:id`, ({ params }) => {
    const event = events.find((e) => e.id === params.id)
    if (!event) {
      return HttpResponse.json(errorBody('EVENT_NOT_FOUND', 'This event could not be found.'), { status: 404 })
    }
    return HttpResponse.json({ event, seats: eventSeatsById[event.id] ?? [] })
  }),

  http.post(`${API}/events`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      {
        event: {
          ...eventSummaryA,
          id: 'event-new',
          status: 'scheduled',
          availableSeats: 0,
          totalSeats: 0,
          ...body,
        },
      },
      { status: 201 },
    )
  }),

  http.patch(`${API}/events/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    const existing = events.find((e) => e.id === params.id) ?? eventSummaryA
    return HttpResponse.json({ event: { ...existing, ...body } })
  }),

  http.delete(`${API}/events/:id`, () => new HttpResponse(null, { status: 204 })),

  // --- venues ---
  http.get(`${API}/venues`, () => HttpResponse.json({ venues })),

  http.get(`${API}/venues/:id`, ({ params }) => {
    const venue = venues.find((v) => v.id === params.id)
    if (!venue) return HttpResponse.json(errorBody('VENUE_NOT_FOUND', 'This venue could not be found.'), { status: 404 })
    return HttpResponse.json({ venue })
  }),

  http.post(`${API}/venues`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ venue: { ...venueA, id: 'venue-new', ...body } }, { status: 201 })
  }),

  http.patch(`${API}/venues/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    const existing = venues.find((v) => v.id === params.id) ?? venueA
    return HttpResponse.json({ venue: { ...existing, ...body } })
  }),

  http.delete(`${API}/venues/:id`, ({ params }) => {
    if (params.id === 'venue-in-use') {
      return HttpResponse.json(
        errorBody('VENUE_IN_USE', 'This venue has events booked against it and cannot be deleted.', {
          referencingEventsCount: 2,
        }),
        { status: 409 },
      )
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // --- bookings ---
  http.post(`${API}/bookings`, () =>
    HttpResponse.json({ booking: bookingPending, clientSecret: 'pi_test_secret' }, { status: 201 }),
  ),

  http.get(`${API}/bookings/me`, () =>
    HttpResponse.json({ items: bookings, total: bookings.length, page: 1, limit: 10, totalPages: 1 }),
  ),

  http.get(`${API}/bookings/:id`, ({ params }) => {
    const booking = bookings.find((b) => b.id === params.id)
    if (!booking) {
      return HttpResponse.json(errorBody('BOOKING_NOT_FOUND', 'This booking could not be found.'), { status: 404 })
    }
    return HttpResponse.json({ booking })
  }),

  http.get(`${API}/bookings`, () =>
    HttpResponse.json({ items: bookings, total: bookings.length, page: 1, limit: 20, totalPages: 1 }),
  ),

  http.patch(`${API}/bookings/:id/cancel`, ({ params }) => {
    const booking = bookings.find((b) => b.id === params.id) ?? bookingPending
    return HttpResponse.json({ booking: { ...booking, status: 'cancelled' } })
  }),

  // --- payments ---
  http.post(`${API}/bookings/:id/payment-session`, () =>
    HttpResponse.json({ clientSecret: 'pi_test_resumed_secret', publishableKey: 'pk_test_x' }),
  ),

  // --- admin ---
  http.get(`${API}/admin/stats`, () => HttpResponse.json(adminStats satisfies AdminStats)),

  http.get(`${API}/admin/events`, () =>
    HttpResponse.json({ events: adminEvents, total: adminEvents.length, page: 1, totalPages: 1 }),
  ),

  // --- health ---
  http.get(`${API}/health`, () =>
    HttpResponse.json({ status: 'healthy', db: 'connected', uptime: 123, timestamp: new Date().toISOString() }),
  ),
]
