import type { Seat } from './types'

export function formatPrice(n: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(n)
}

// "Fri 12 Sep 2026, 20:00"
export function formatEventDate(iso: string): string {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
  return `${date}, ${time}`
}

// "FRI · 12 SEP · 20:00" — the mono eyebrow on the stub
export function formatStubDate(iso: string): string {
  const d = new Date(iso)
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
    .format(d)
    .toUpperCase()
  const day = new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(d)
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short' })
    .format(d)
    .toUpperCase()
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
  return `${weekday} · ${day} ${month} · ${time}`
}

export function formatSeatLabel(seat: Seat): string {
  return seat.id
}
