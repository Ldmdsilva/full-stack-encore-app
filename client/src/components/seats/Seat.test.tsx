import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Seat } from './Seat'
import type { Seat as SeatT } from '@/lib/types'

function makeSeat(overrides: Partial<SeatT> = {}): SeatT {
  return { id: 'A-1', section: 'STALLS', row: 'A', number: 1, status: 'available', price: 6500, ...overrides }
}

const noop = () => {}

describe('Seat', () => {
  it('renders an available seat as pressable and enabled', () => {
    render(
      <Seat
        seat={makeSeat({ status: 'available' })}
        isSelected={false}
        tabIndex={0}
        onToggle={noop}
        onKeyNav={noop}
        registerRef={noop}
      />,
    )
    const button = screen.getByRole('button')
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'false')
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveAccessibleName(/available/i)
  })

  it('renders a selected available seat with aria-pressed true', () => {
    render(
      <Seat
        seat={makeSeat({ status: 'available' })}
        isSelected
        tabIndex={0}
        onToggle={noop}
        onKeyNav={noop}
        registerRef={noop}
      />,
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders a held seat as disabled and announces it is on hold', () => {
    render(
      <Seat
        seat={makeSeat({ status: 'held' })}
        isSelected={false}
        tabIndex={-1}
        onToggle={noop}
        onKeyNav={noop}
        registerRef={noop}
      />,
    )
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleName(/on hold by another customer/i)
  })

  it('renders a booked seat as disabled', () => {
    render(
      <Seat
        seat={makeSeat({ status: 'booked' })}
        isSelected={false}
        tabIndex={-1}
        onToggle={noop}
        onKeyNav={noop}
        registerRef={noop}
      />,
    )
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleName(/unavailable/i)
  })

  it('calls onToggle when an available seat is clicked, but never for a taken seat', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()

    const { rerender } = render(
      <Seat
        seat={makeSeat({ status: 'available' })}
        isSelected={false}
        tabIndex={0}
        onToggle={onToggle}
        onKeyNav={noop}
        registerRef={noop}
      />,
    )
    await user.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledWith('A-1')

    onToggle.mockClear()
    rerender(
      <Seat
        seat={makeSeat({ status: 'booked' })}
        isSelected={false}
        tabIndex={0}
        onToggle={onToggle}
        onKeyNav={noop}
        registerRef={noop}
      />,
    )
    await user.click(screen.getByRole('button'))
    expect(onToggle).not.toHaveBeenCalled()
  })
})
