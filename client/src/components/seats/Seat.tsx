import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/formatters'
import type { Seat as SeatT } from '@/lib/types'

interface SeatProps {
  seat: SeatT
  isSelected: boolean
  tabIndex: number
  onToggle: (id: string) => void
  onKeyNav: (e: React.KeyboardEvent, seat: SeatT) => void
  registerRef: (id: string, el: HTMLButtonElement | null) => void
}

export function Seat({
  seat,
  isSelected,
  tabIndex,
  onToggle,
  onKeyNav,
  registerRef,
}: SeatProps) {
  const taken = seat.status === 'booked'
  const state = taken ? 'unavailable' : isSelected ? 'selected' : 'available'

  return (
    <button
      ref={(el) => registerRef(seat.id, el)}
      type="button"
      tabIndex={tabIndex}
      disabled={taken}
      aria-disabled={taken}
      aria-pressed={isSelected}
      aria-label={`Seat ${seat.id}, row ${seat.row}, ${formatPrice(seat.price)}, ${state}`}
      onClick={() => !taken && onToggle(seat.id)}
      onKeyDown={(e) => onKeyNav(e, seat)}
      className={cn(
        'relative flex aspect-square items-center justify-center rounded-[4px] border-none text-[9px] font-medium transition-[background-color] duration-150',
        taken && 'cursor-not-allowed bg-seat-taken text-ink/40 opacity-55',
        !taken && !isSelected && 'cursor-pointer bg-stage-green text-white/85 hover:brightness-110',
        isSelected && 'cursor-pointer bg-marquee-gold text-ink',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
      )}
    >
      {/* Non-colour state cue for accessibility (NFR-11) */}
      {isSelected && (
        <span className="absolute inset-1 rounded-[2px] ring-2 ring-inset ring-ink/60" aria-hidden />
      )}
      <span className="relative">{seat.number}</span>
    </button>
  )
}
