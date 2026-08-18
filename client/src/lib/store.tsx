import * as React from 'react'
import type { Booking, Role } from './types'

export interface User {
  name: string
  email: string
  role: Role
}

interface StoreCtx {
  user: User | null
  login: (email: string, name?: string) => void
  logout: () => void
  bookings: Booking[]
  addBooking: (b: Booking) => void
  cancelBooking: (id: string) => void
  isAdmin: boolean
}

const Ctx = React.createContext<StoreCtx | null>(null)

export function useStore() {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}

const USER_KEY = 'encore_user'
const BOOKINGS_KEY = 'encore_bookings'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(() => load(USER_KEY, null))
  const [bookings, setBookings] = React.useState<Booking[]>(() =>
    load(BOOKINGS_KEY, []),
  )

  React.useEffect(() => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }, [user])
  React.useEffect(() => {
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings))
  }, [bookings])

  const value: StoreCtx = {
    user,
    login: (email, name) => {
      const role: Role = email === 'admin@encore.live' ? 'admin' : 'customer'
      setUser({ email, name: name ?? email.split('@')[0].replace(/\W/g, ' '), role })
    },
    logout: () => setUser(null),
    bookings,
    addBooking: (b) => setBookings((prev) => [b, ...prev]),
    cancelBooking: (id) =>
      setBookings((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)),
      ),
    isAdmin: user?.role === 'admin',
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
