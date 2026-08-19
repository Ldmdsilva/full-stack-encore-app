import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SeatMap } from './SeatMap'
import type { Seat as SeatT } from '@/lib/types'

const seats: SeatT[] = [
  { id: 'A-1', section: 'STALLS', row: 'A', number: 1, status: 'available', price: 6500 },
  { id: 'A-2', section: 'STALLS', row: 'A', number: 2, status: 'held', price: 6500 },
  { id: 'A-3', section: 'STALLS', row: 'A', number: 3, status: 'booked', price: 6500 },
  { id: 'B-1', section: 'STALLS', row: 'B', number: 1, status: 'available', price: 6500 },
]

describe('SeatMap', () => {
  it('groups seats by row and renders one button per seat', () => {
    render(<SeatMap seats={seats} selectedIds={[]} onToggle={vi.fn()} liveMessage="" />)
    expect(screen.getAllByRole('button')).toHaveLength(seats.length)
    expect(screen.getByRole('group', { name: /seat selection map/i })).toBeInTheDocument()
  })

  it('marks selected seats as pressed', () => {
    render(<SeatMap seats={seats} selectedIds={['A-1']} onToggle={vi.fn()} liveMessage="" />)
    expect(screen.getByRole('button', { name: /seat a-1/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /seat b-1/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onToggle with the clicked available seat id', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<SeatMap seats={seats} selectedIds={[]} onToggle={onToggle} liveMessage="" />)
    await user.click(screen.getByRole('button', { name: /seat a-1/i }))
    expect(onToggle).toHaveBeenCalledWith('A-1')
  })

  it('does not toggle held or booked seats', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<SeatMap seats={seats} selectedIds={[]} onToggle={onToggle} liveMessage="" />)
    await user.click(screen.getByRole('button', { name: /seat a-2/i }))
    await user.click(screen.getByRole('button', { name: /seat a-3/i }))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('renders the live region for screen-reader seat updates', () => {
    render(<SeatMap seats={seats} selectedIds={[]} onToggle={vi.fn()} liveMessage="Seat A-1 selected" />)
    expect(screen.getByText('Seat A-1 selected')).toBeInTheDocument()
  })

  it('moves focus across rows with arrow keys', async () => {
    const user = userEvent.setup()
    render(<SeatMap seats={seats} selectedIds={[]} onToggle={vi.fn()} liveMessage="" />)
    const first = screen.getByRole('button', { name: /seat a-1/i })
    first.focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: /seat a-2/i })).toHaveFocus()
  })
})
