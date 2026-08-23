// The client-side API contract (ADR-008 action item 2). Mirrors what the
// running server actually emits — see the divergence note in the project
// report's Evaluation section re: docs/pasted_text/design-tokens.css.
export type Role = 'customer' | 'admin'
export type SeatStatus = 'available' | 'held' | 'booked'
export type EventStatus = 'scheduled' | 'cancelled'
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired'

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: Role
  createdAt: string
}

export interface VenueRef {
  id: string
  name: string
  city: string
}

export interface SeatLayoutItem {
  id: string
  section: string
  row: string
  number: number
}

export interface Venue {
  id: string
  name: string
  address: string
  city: string
  capacity: number
  seatLayout: SeatLayoutItem[]
}

export interface Seat {
  id: string // e.g. "B-14"
  section: string
  row: string
  number: number
  status: SeatStatus
  price: number
}

export interface EventSummary {
  id: string
  title: string
  artist: string
  genre: string
  imageUrl?: string
  description?: string
  date: string // ISO 8601
  basePrice: number
  venue: VenueRef
  status: EventStatus
  availableSeats: number
  totalSeats: number
}

export interface EventDetail extends EventSummary {
  seats: Seat[]
}

export interface BookedSeat {
  id: string
  section: string
  row: string
  number: number
  price: number
}

export interface BookingPayment {
  provider: string
  sessionId: string | null
  paymentIntentId: string | null
  status: string | null
  amountMinor: number | null
  currency: string | null
  refundId: string | null
}

export interface Booking {
  id: string
  reference: string // e.g. "ENC-4471"
  userId: string
  user: { id: string; name: string; email: string } | null
  event: (Pick<EventSummary, 'id' | 'title' | 'artist' | 'date' | 'status'>) | null
  seats: BookedSeat[]
  totalPrice: number
  status: BookingStatus
  holdExpiresAt: string | null
  payment: BookingPayment | null
  createdAt: string
}

export interface AdminEvent extends EventSummary {
  revenue: number
  bookingCount: number
}

export interface AdminStats {
  totalEvents: number
  upcomingEvents: number
  totalBookings: number
  confirmedBookings: number
  cancelledBookings: number
  totalRevenue: number
  totalSeats: number
  bookedSeats: number
  availableSeats: number
  occupancyRate: number
}

// --- Request payloads ---

export interface RegisterPayload {
  name: string
  email: string
  password: string
  phone: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface UpdateProfilePayload {
  name?: string
  email?: string
  phone?: string
}

export interface CreateEventPayload {
  title: string
  artist: string
  genre: string
  imageUrl?: string
  description?: string
  date: string
  basePrice: number
  venueRef: string
}

export type UpdateEventPayload = Partial<CreateEventPayload> & { status?: EventStatus }

export interface CreateVenuePayload {
  name: string
  address: string
  city: string
  seatLayout: SeatLayoutItem[]
}

export type UpdateVenuePayload = Partial<CreateVenuePayload>

export interface CreateBookingPayload {
  eventId: string
  seatIds: string[]
}

export interface CreateBookingResponse {
  booking: Booking
  clientSecret: string
}

export interface PaymentSessionResponse {
  clientSecret: string
  publishableKey: string | null
}

// --- Error contract ---

// The codes the running server actually emits (audited directly against
// src/services, src/controllers, src/middleware, src/validators — the
// build spec at docs/pasted_text/design-tokens.css predates the server
// and lists different names, e.g. EMAIL_EXISTS/RATE_LIMITED; the running
// server wins, see the report's Evaluation section), plus a client-only
// NETWORK_ERROR for requests that never reached it.
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'EVENT_NOT_FOUND'
  | 'VENUE_NOT_FOUND'
  | 'BOOKING_NOT_FOUND'
  | 'DUPLICATE_EMAIL'
  | 'DUPLICATE_RESOURCE'
  | 'SEAT_UNAVAILABLE'
  | 'EVENT_INACTIVE'
  | 'EVENT_STARTED'
  | 'VENUE_IN_USE'
  | 'CAPACITY_EXCEEDED'
  | 'INVALID_SEATS'
  | 'INVALID_FILTER'
  | 'INVALID_IDENTIFIER'
  | 'INVALID_SIGNATURE'
  | 'BOOKING_NOT_PENDING'
  | 'BOOKING_NOT_CANCELLABLE'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_SERVER_ERROR'
  | 'NETWORK_ERROR'

export interface ApiError {
  code: ApiErrorCode
  message: string
  details?: unknown
}

// --- Socket.IO payloads (§C7.2) ---

export interface SeatsUpdatedPayload {
  eventId: string
  seatIds: string[]
  status: SeatStatus
}

export interface EventCancelledPayload {
  eventId: string
}

export interface BookingUpdatedPayload {
  bookingId: string
  status: BookingStatus
}

export interface ServerToClientEvents {
  'seats:updated': (payload: SeatsUpdatedPayload) => void
  'event:cancelled': (payload: EventCancelledPayload) => void
  'booking:updated': (payload: BookingUpdatedPayload) => void
  error: (payload: { code: string; message: string }) => void
}

export interface ClientToServerEvents {
  'join:event': (payload: { eventId: string }) => void
  'leave:event': (payload: { eventId: string }) => void
}
