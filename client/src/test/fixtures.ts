// Shared sample data for tests — shapes copied directly from src/lib/types.ts
// rather than invented, per the client API contract.
import type {
  AdminEvent,
  AdminStats,
  Booking,
  EventDetail,
  EventSummary,
  Seat,
  User,
  Venue,
} from '@/lib/types'

export const customerUser: User = {
  id: 'user-1',
  name: 'Alex Rivera',
  email: 'alex@example.com',
  phone: '0771234567',
  role: 'customer',
  createdAt: '2026-01-01T00:00:00.000Z',
}

export const adminUser: User = {
  id: 'user-admin',
  name: 'Jordan Blake',
  email: 'jordan@example.com',
  phone: '0777654321',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
}

export const venueA: Venue = {
  id: 'venue-1',
  name: 'The Half Moon',
  address: '123 Galle Road, Colombo 03',
  city: 'Colombo',
  capacity: 24,
  seatLayout: [
    { id: 'A-1', section: 'STALLS', row: 'A', number: 1 },
    { id: 'A-2', section: 'STALLS', row: 'A', number: 2 },
  ],
}

export const venueB: Venue = {
  id: 'venue-2',
  name: 'Marfa Hall',
  address: '9 Marine Drive',
  city: 'Galle',
  capacity: 12,
  seatLayout: [{ id: 'A-1', section: 'STALLS', row: 'A', number: 1 }],
}

function makeSeats(): Seat[] {
  const seats: Seat[] = []
  const rows: [string, ('available' | 'held' | 'booked')[]][] = [
    ['A', ['available', 'available', 'held', 'booked']],
    ['B', ['available', 'available', 'available', 'available']],
  ]
  for (const [row, statuses] of rows) {
    statuses.forEach((status, i) => {
      seats.push({
        id: `${row}-${i + 1}`,
        section: 'STALLS',
        row,
        number: i + 1,
        status,
        price: 6500,
      })
    })
  }
  return seats
}

export const eventSeats: Seat[] = makeSeats()

export const eventSummaryA: EventSummary = {
  id: 'event-1',
  title: 'The Marfa Sessions',
  artist: 'Phoebe Wren',
  genre: 'Folk',
  imageUrl: 'https://images.example.com/marfa.jpg',
  description: 'An intimate acoustic evening.',
  date: '2026-09-12T20:00:00.000Z',
  basePrice: 6500,
  venue: { id: venueA.id, name: venueA.name, city: venueA.city },
  status: 'scheduled',
  availableSeats: 6,
  totalSeats: 8,
}

export const eventSummaryB: EventSummary = {
  id: 'event-2',
  title: 'Night Choir',
  artist: 'The Hollow Choir',
  genre: 'Choral',
  date: '2026-10-01T19:00:00.000Z',
  basePrice: 4200,
  venue: { id: venueB.id, name: venueB.name, city: venueB.city },
  status: 'scheduled',
  availableSeats: 0,
  totalSeats: 12,
}

export const eventDetailA: EventDetail = {
  ...eventSummaryA,
  seats: eventSeats,
}

export const adminEventA: AdminEvent = {
  ...eventSummaryA,
  revenue: 45500,
  bookingCount: 7,
}

export const adminEventB: AdminEvent = {
  ...eventSummaryB,
  revenue: 0,
  bookingCount: 0,
}

export const bookingPending: Booking = {
  id: 'booking-1',
  reference: 'ENC-4471',
  userId: customerUser.id,
  user: { id: customerUser.id, name: customerUser.name, email: customerUser.email },
  event: { id: eventSummaryA.id, title: eventSummaryA.title, artist: eventSummaryA.artist, date: eventSummaryA.date, status: eventSummaryA.status },
  seats: [{ id: 'A-1', section: 'STALLS', row: 'A', number: 1, price: 6500 }],
  totalPrice: 6500,
  status: 'pending',
  holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  payment: null,
  createdAt: '2026-08-01T00:00:00.000Z',
}

export const bookingConfirmed: Booking = {
  ...bookingPending,
  id: 'booking-2',
  reference: 'ENC-9001',
  status: 'confirmed',
  holdExpiresAt: null,
  payment: {
    provider: 'stripe',
    sessionId: 'cs_test_123',
    paymentIntentId: 'pi_test_123',
    status: 'succeeded',
    amountMinor: 650000,
    currency: 'lkr',
    refundId: null,
  },
}

export const adminStats: AdminStats = {
  totalEvents: 2,
  upcomingEvents: 2,
  totalBookings: 10,
  confirmedBookings: 7,
  cancelledBookings: 3,
  totalRevenue: 45500,
  totalSeats: 20,
  bookedSeats: 14,
  availableSeats: 6,
  occupancyRate: 70,
}
