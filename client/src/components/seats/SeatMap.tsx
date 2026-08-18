import * as React from 'react'
import { Seat } from './Seat'
import type { Seat as SeatT } from '@/lib/types'

interface SeatMapProps {
  seats: SeatT[]
  selectedIds: string[]
  onToggle: (id: string) => void
  liveMessage: string
}

const SWATCH = 'inline-block size-3 rounded-[3px] align-middle'

export function SeatMap({ seats, selectedIds, onToggle, liveMessage }: SeatMapProps) {
  const refs = React.useRef<Map<string, HTMLButtonElement>>(new Map())
  const [activeIdx, setActiveIdx] = React.useState(0)

  const registerRef = (id: string, el: HTMLButtonElement | null) => {
    if (el) refs.current.set(id, el)
    else refs.current.delete(id)
  }

  // Group seats by row, preserving section order.
  const rows = React.useMemo(() => {
    const map = new Map<string, SeatT[]>()
    for (const s of seats) {
      if (!map.has(s.row)) map.set(s.row, [])
      map.get(s.row)!.push(s)
    }
    return Array.from(map.entries())
  }, [seats])

  const flat = seats
  const focusSeat = (idx: number) => {
    const clamped = Math.max(0, Math.min(flat.length - 1, idx))
    setActiveIdx(clamped)
    refs.current.get(flat[clamped].id)?.focus()
  }

  const onKeyNav = (e: React.KeyboardEvent, seat: SeatT) => {
    const i = flat.findIndex((s) => s.id === seat.id)
    const rowLen = rows.find(([, r]) => r.includes(seat))?.[1].length ?? 12
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        focusSeat(i + 1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        focusSeat(i - 1)
        break
      case 'ArrowDown':
        e.preventDefault()
        focusSeat(i + rowLen)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusSeat(i - rowLen)
        break
    }
  }

  return (
    <div>
      {/* Stage bar */}
      <div className="mb-6 rounded-[var(--radius)] bg-ink py-1.5 text-center font-mono text-[11px] tracking-[0.2em] text-marquee-gold">
        STAGE
      </div>

      <div
        role="group"
        aria-label="Seat selection map"
        className="flex flex-col items-center gap-1.5"
      >
        {rows.map(([row, rowSeats]) => (
          <div key={row} className="flex w-full items-center justify-center gap-1.5">
            <span className="w-4 shrink-0 text-right font-mono text-[11px] text-ash">
              {row}
            </span>
            <div
              className="grid flex-1 gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${rowSeats.length}, minmax(0, 1fr))`,
                maxWidth: `${rowSeats.length * 34}px`,
              }}
            >
              {rowSeats.map((seat) => {
                const globalIdx = flat.findIndex((s) => s.id === seat.id)
                return (
                  <Seat
                    key={seat.id}
                    seat={seat}
                    isSelected={selectedIds.includes(seat.id)}
                    tabIndex={globalIdx === activeIdx ? 0 : -1}
                    onToggle={onToggle}
                    onKeyNav={onKeyNav}
                    registerRef={registerRef}
                  />
                )
              })}
            </div>
            <span className="w-4 shrink-0" aria-hidden />
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-text-secondary">
        <span>
          <span className={`${SWATCH} bg-stage-green`} /> Available
        </span>
        <span>
          <span className={`${SWATCH} bg-marquee-gold`} /> Selected
        </span>
        <span>
          <span className={`${SWATCH} bg-seat-taken opacity-55`} /> Taken
        </span>
      </div>

      <div className="sr-only" aria-live="polite">
        {liveMessage}
      </div>
    </div>
  )
}
