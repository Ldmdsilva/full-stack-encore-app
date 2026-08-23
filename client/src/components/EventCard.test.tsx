import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EventCard } from './EventCard'
import { eventSummaryA, eventSummaryB } from '@/test/fixtures'

function renderCard(event: Parameters<typeof EventCard>[0]['event']) {
  return render(
    <MemoryRouter>
      <EventCard event={event} />
    </MemoryRouter>,
  )
}

describe('EventCard', () => {
  it('shows remaining seat count when plenty are available', () => {
    renderCard(eventSummaryA)
    expect(screen.getByText(`${eventSummaryA.availableSeats} seats left`)).toBeInTheDocument()
  })

  it('shows "Sold out" when there are no seats left', () => {
    renderCard(eventSummaryB)
    expect(screen.getByText('Sold out')).toBeInTheDocument()
  })

  it('shows "Few left" once availability drops to 20% or below', () => {
    renderCard({ ...eventSummaryA, availableSeats: 1, totalSeats: 10 })
    expect(screen.getByText('Few left')).toBeInTheDocument()
  })

  it('links to the event detail page', () => {
    renderCard(eventSummaryA)
    expect(
      screen.getByRole('button', { name: `View ${eventSummaryA.title} by ${eventSummaryA.artist}` }),
    ).toBeInTheDocument()
  })
})
