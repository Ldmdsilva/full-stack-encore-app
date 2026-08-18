// The client-side API contract. Mirrors the SRS §3 type declarations.
export type Role = 'customer' | 'admin'
export type SeatStatus = 'available' | 'booked'
export type EventStatus = 'scheduled' | 'cancelled'
export type BookingStatus = 'confirmed' | 'cancelled'

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
  date: string // ISO 8601
  basePrice: number
  venue: { id: string; name: string; city: string }
  status: EventStatus
  availableSeats: number
  totalSeats: number
  genre: string
  image: string
}

export interface EventDetail extends EventSummary {
  seats: Seat[]
  description: string
}

export interface Booking {
  id: string
  reference: string // e.g. "ENC-4471"
  event: Pick<EventSummary, 'id' | 'title' | 'artist' | 'date'> & {
    venue: { id: string; name: string; city: string }
  }
  seats: Seat[]
  totalPrice: number
  status: BookingStatus
  createdAt: string
}
