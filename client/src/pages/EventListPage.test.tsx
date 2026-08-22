import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { EventListPage } from './EventListPage'
import { AuthProvider } from '@/context/AuthContext'
import { SocketProvider } from '@/context/SocketContext'
import { ToastProvider } from '@/components/ui/toast'

// EventListPage drives its filters through useSearchParams — MemoryRouter
// keeps that state internally rather than on the real `window.location`, so
// a sibling reading `useLocation()` is what makes it observable in a test.
function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function renderEventList() {
  return render(
    <MemoryRouter initialEntries={['/events']}>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <EventListPage />
            <LocationDisplay />
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('EventListPage', () => {
  it('lists events returned by the server', async () => {
    renderEventList()
    expect(await screen.findByText(/phoebe wren/i)).toBeInTheDocument()
  })

  it('shows an empty state when a filter matches nothing, with a way to clear it', async () => {
    const user = userEvent.setup()
    renderEventList()
    await screen.findByText(/phoebe wren/i)

    await user.selectOptions(screen.getByLabelText(/genre/i), 'Synth-pop')

    // The 300ms filter debounce plus a refetch can occasionally exceed RTL's
    // default 1000ms findBy timeout under a coverage-instrumented full-suite
    // run, so this one gets the same longer timeout as the debounce-driven
    // wait below.
    expect(await screen.findByText(/no concerts match your search/i, {}, { timeout: 2000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(await screen.findByText(/phoebe wren/i, {}, { timeout: 2000 })).toBeInTheDocument()
  })

  it('reflects filter changes in the URL so a search is shareable', async () => {
    const user = userEvent.setup()
    renderEventList()
    await screen.findByText(/phoebe wren/i)

    await user.selectOptions(screen.getByLabelText(/genre/i), 'Folk')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('genre=Folk'))

    await user.type(screen.getByLabelText(/search/i), 'Phoebe')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('q=Phoebe'), { timeout: 2000 })
  })
})
