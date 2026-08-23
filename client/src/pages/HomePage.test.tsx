import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { HomePage } from './HomePage'
import { renderPage } from '@/test/utils'
import { server } from '@/test/mocks/server'

describe('HomePage', () => {
  it('renders the hero and featured events once loaded', async () => {
    renderPage(<HomePage />, '/')
    expect(await screen.findByRole('heading', { level: 1, name: /pick your seat/i })).toBeInTheDocument()
    expect(await screen.findAllByText(/phoebe wren/i)).not.toHaveLength(0)
  })

  it('shows an empty state when there are no shows on sale', async () => {
    server.use(http.get('/api/events', () => HttpResponse.json({ events: [], total: 0, page: 1, totalPages: 1 })))
    renderPage(<HomePage />, '/')
    // Rendered in both the hero slot and the "Upcoming shows" section.
    expect(await screen.findAllByText(/no shows on sale yet/i)).toHaveLength(2)
  })
})
