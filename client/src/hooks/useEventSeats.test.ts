import { describe, expect, it } from 'vitest'
import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useEventSeats } from './useEventSeats'
import { ProvidersWrapper } from '@/test/utils'
import { server } from '@/test/mocks/server'
import { getLastFakeSocket } from '@/test/mocks/socket'
import { eventSummaryA } from '@/test/fixtures'

const EVENT_ID = eventSummaryA.id

describe('useEventSeats', () => {
  it('loads the event and seats, and connects the socket', async () => {
    const { result } = renderHook(() => useEventSeats(EVENT_ID), { wrapper: ProvidersWrapper })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.event?.id).toBe(EVENT_ID)
    expect(result.current.seats.length).toBeGreaterThan(0)
    await waitFor(() => expect(result.current.isConnected).toBe(true))
  })

  it('drops a selected seat, and toasts, when it is remotely taken', async () => {
    const { result } = renderHook(() => useEventSeats(EVENT_ID), { wrapper: ProvidersWrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    const availableSeat = result.current.seats.find((s) => s.status === 'available')
    if (!availableSeat) throw new Error('fixture must contain an available seat')

    act(() => result.current.toggleSeat(availableSeat.id))
    expect(result.current.selectedIds).toContain(availableSeat.id)

    const socket = getLastFakeSocket()
    act(() => {
      socket.trigger('seats:updated', { eventId: EVENT_ID, seatIds: [availableSeat.id], status: 'held' })
    })

    await waitFor(() => expect(result.current.selectedIds).not.toContain(availableSeat.id))
    expect(result.current.seats.find((s) => s.id === availableSeat.id)?.status).toBe('held')
    await screen.findByText(/was just taken by another customer/i)
  })

  it('keeps a selection that is unaffected by an unrelated remote update', async () => {
    const { result } = renderHook(() => useEventSeats(EVENT_ID), { wrapper: ProvidersWrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    const [seatOne, seatTwo] = result.current.seats.filter((s) => s.status === 'available')
    act(() => result.current.toggleSeat(seatOne.id))

    const socket = getLastFakeSocket()
    act(() => {
      socket.trigger('seats:updated', { eventId: EVENT_ID, seatIds: [seatTwo.id], status: 'booked' })
    })

    expect(result.current.selectedIds).toEqual([seatOne.id])
  })

  it('re-fetches the event when the socket reconnects', async () => {
    let getByIdCalls = 0
    server.use(
      http.get(`/api/events/:id`, ({ params }) => {
        getByIdCalls += 1
        return HttpResponse.json({
          event: { ...eventSummaryA, id: params.id },
          seats: [],
        })
      }),
    )

    const { result } = renderHook(() => useEventSeats(EVENT_ID), { wrapper: ProvidersWrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(getByIdCalls).toBe(1)

    const socket = getLastFakeSocket()
    act(() => socket.triggerReconnect())

    await waitFor(() => expect(getByIdCalls).toBe(2))
  })

  it('drops a selected seat that is no longer available after a reconnect resync', async () => {
    const availableId = 'A-1'
    let seatsResponse: { id: string; status: 'available' | 'held' | 'booked' }[] = [
      { id: availableId, status: 'available' },
    ]
    server.use(
      http.get(`/api/events/:id`, () =>
        HttpResponse.json({
          event: eventSummaryA,
          seats: seatsResponse.map((s) => ({ id: s.id, section: 'STALLS', row: 'A', number: 1, status: s.status, price: 6500 })),
        }),
      ),
    )

    const { result } = renderHook(() => useEventSeats(EVENT_ID), { wrapper: ProvidersWrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.toggleSeat(availableId))
    expect(result.current.selectedIds).toEqual([availableId])

    // Server truth changes across the reconnect gap without an explicit
    // seats:updated event (e.g. it fired while the socket was down).
    seatsResponse = [{ id: availableId, status: 'booked' }]
    const socket = getLastFakeSocket()
    act(() => socket.triggerReconnect())

    await waitFor(() => expect(result.current.selectedIds).toEqual([]))
  })
})
