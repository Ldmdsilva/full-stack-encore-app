import type { Booking, EventDetail } from './types'
import { EVENTS } from './mockData'

// Admin-side extended event type with editable fields
export interface AdminEvent extends EventDetail {
  revenue: number
  bookingCount: number
}

function buildAdminEvents(): AdminEvent[] {
  return EVENTS.map((e) => {
    const bookedSeats = e.seats.filter((s) => s.status === 'booked')
    const revenue = bookedSeats.reduce((sum, s) => sum + s.price, 0)
    return { ...e, revenue, bookingCount: Math.floor(bookedSeats.length / 2.4) }
  })
}

export const ADMIN_EVENTS: AdminEvent[] = buildAdminEvents()

// Fan names and emails for realistic booking data
const fans = [
  { name: 'Miriam Osei', email: 'miriam.osei@mail.com' },
  { name: 'Theo Blackwell', email: 'theo.b@proton.me' },
  { name: 'Sian Adeyemi', email: 'sian.adeyemi@gmail.com' },
  { name: 'Callum Reid', email: 'c.reid@outlook.com' },
  { name: 'Priya Nair', email: 'priya.nair@fastmail.com' },
  { name: 'Marcus Florin', email: 'marcus_f@gmail.com' },
  { name: 'Esme Yates', email: 'esmeyates@icloud.com' },
  { name: 'Kwame Asante', email: 'kwame.asante@hotmail.com' },
  { name: 'Lena Dvoák', email: 'lena.dvorak@gmail.com' },
  { name: 'Sam Holbrook', email: 'samholbrook@me.com' },
  { name: 'Adaeze Onu', email: 'adaeze.onu@yahoo.com' },
  { name: 'Javier Mora', email: 'javier.mora@gmail.com' },
]

function ref(n: number) {
  return `ENC-${String(n).padStart(4, '0')}`
}

function offsetDate(iso: string, daysBack: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() - daysBack)
  return d.toISOString()
}

// Build a deterministic set of all-customer bookings for the admin view
export const ALL_BOOKINGS: (Booking & { customerName: string; customerEmail: string })[] =
  EVENTS.flatMap((evt, ei) => {
    const bookedSeats = evt.seats.filter((s) => s.status === 'booked')
    const chunks: typeof bookedSeats[] = []
    for (let i = 0; i < bookedSeats.length; i += 2) {
      chunks.push(bookedSeats.slice(i, Math.min(i + 2, bookedSeats.length)))
    }
    return chunks.slice(0, 4).map((seats, bi) => {
      const fan = fans[(ei * 4 + bi) % fans.length]
      const totalPrice = seats.reduce((s, seat) => s + seat.price, 0)
      const status = bi === 3 && ei % 3 === 0 ? 'cancelled' : 'confirmed'
      return {
        id: `adm-${evt.id}-${bi}`,
        reference: ref(ei * 10 + bi + 1000),
        event: {
          id: evt.id,
          title: evt.title,
          artist: evt.artist,
          date: evt.date,
          venue: evt.venue,
        },
        seats,
        totalPrice,
        status,
        createdAt: offsetDate(evt.date, 40 - bi * 5),
        customerName: fan.name,
        customerEmail: fan.email,
      }
    })
  })

export function getAdminStats() {
  const totalRevenue = ALL_BOOKINGS.filter((b) => b.status === 'confirmed').reduce(
    (s, b) => s + b.totalPrice,
    0,
  )
  const confirmed = ALL_BOOKINGS.filter((b) => b.status === 'confirmed').length
  const cancelled = ALL_BOOKINGS.filter((b) => b.status === 'cancelled').length
  const totalSeats = EVENTS.reduce((s, e) => s + e.totalSeats, 0)
  const bookedSeats = EVENTS.reduce(
    (s, e) => s + e.seats.filter((seat) => seat.status === 'booked').length,
    0,
  )
  return {
    totalEvents: EVENTS.length,
    upcomingEvents: EVENTS.filter((e) => e.status === 'scheduled').length,
    totalBookings: ALL_BOOKINGS.length,
    confirmedBookings: confirmed,
    cancelledBookings: cancelled,
    totalRevenue,
    totalSeats,
    bookedSeats,
    availableSeats: totalSeats - bookedSeats,
    occupancyRate: Math.round((bookedSeats / totalSeats) * 100),
  }
}
