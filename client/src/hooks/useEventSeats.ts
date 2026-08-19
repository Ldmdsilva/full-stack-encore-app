import * as React from 'react'
import * as eventsApi from '@/lib/api/events'
import { useSocket } from '@/context/SocketContext'
import { useToast } from '@/components/ui/toast'
import { parseApiError } from '@/lib/api/errors'
import type { ApiError, EventSummary, Seat, SeatStatus, SeatsUpdatedPayload } from '@/lib/types'

export const MAX_SEATS = 8

interface EventSeatsState {
  event: EventSummary | null
  seats: Seat[]
  selectedIds: string[]
  status: 'loading' | 'error' | 'ready'
  error: ApiError | null
}

type Action =
  | { type: 'LOADED'; event: EventSummary; seats: Seat[] }
  | { type: 'LOAD_FAILED'; error: ApiError }
  | { type: 'TOGGLE_SELECT'; seatId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'REMOTE_UPDATE'; seatIds: string[]; status: SeatStatus }
  | { type: 'RESYNC'; event: EventSummary; seats: Seat[] }

const initialState: EventSeatsState = {
  event: null,
  seats: [],
  selectedIds: [],
  status: 'loading',
  error: null,
}

function reducer(state: EventSeatsState, action: Action): EventSeatsState {
  switch (action.type) {
    case 'LOADED':
      return { ...state, event: action.event, seats: action.seats, status: 'ready', error: null }
    case 'RESYNC': {
      // Never trust cached selection across a reconnect gap — drop any
      // selected seat that is no longer available server-side (FR-16, R7).
      const availableIds = new Set(action.seats.filter((s) => s.status === 'available').map((s) => s.id))
      return {
        ...state,
        event: action.event,
        seats: action.seats,
        status: 'ready',
        error: null,
        selectedIds: state.selectedIds.filter((id) => availableIds.has(id)),
      }
    }
    case 'LOAD_FAILED':
      return { ...state, status: 'error', error: action.error }
    case 'TOGGLE_SELECT': {
      const seat = state.seats.find((s) => s.id === action.seatId)
      if (!seat || seat.status !== 'available') return state
      const isSelected = state.selectedIds.includes(action.seatId)
      if (isSelected) {
        return { ...state, selectedIds: state.selectedIds.filter((id) => id !== action.seatId) }
      }
      if (state.selectedIds.length >= MAX_SEATS) return state
      return { ...state, selectedIds: [...state.selectedIds, action.seatId] }
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectedIds: [] }
    case 'REMOTE_UPDATE': {
      const affected = new Set(action.seatIds)
      const seats = state.seats.map((seat) => (affected.has(seat.id) ? { ...seat, status: action.status } : seat))
      const selectedIds =
        action.status === 'available' ? state.selectedIds : state.selectedIds.filter((id) => !affected.has(id))
      return { ...state, seats, selectedIds }
    }
    default:
      return state
  }
}

/**
 * Owns one event's seat state end to end: initial fetch, the customer's
 * in-progress selection, and remote seat updates over the shared socket
 * (FR-13/14/15/16). Selection is capped at MAX_SEATS and only ever
 * contains seats the server currently reports as `available`.
 */
export function useEventSeats(eventId: string | undefined) {
  const [state, dispatch] = React.useReducer(reducer, initialState)
  const { socket, isConnected, reconnectCount, joinEvent, leaveEvent } = useSocket()
  const { toast } = useToast()
  const selectedIdsRef = React.useRef<string[]>([])
  selectedIdsRef.current = state.selectedIds

  const load = React.useCallback(async (kind: 'LOADED' | 'RESYNC') => {
    if (!eventId) return
    try {
      const { event, seats } = await eventsApi.getById(eventId)
      dispatch({ type: kind, event, seats })
    } catch (err) {
      dispatch({ type: 'LOAD_FAILED', error: parseApiError(err) })
    }
  }, [eventId])

  React.useEffect(() => {
    if (!eventId) return
    load('LOADED')
    joinEvent(eventId)
    return () => leaveEvent(eventId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the event id itself changes
  }, [eventId])

  const skipNextResync = React.useRef(true)
  React.useEffect(() => {
    if (skipNextResync.current) {
      skipNextResync.current = false
      return
    }
    load('RESYNC')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires only on reconnectCount changes
  }, [reconnectCount])

  React.useEffect(() => {
    if (!eventId) return

    function handleSeatsUpdated(payload: SeatsUpdatedPayload) {
      if (payload.eventId !== eventId) return

      if (payload.status !== 'available') {
        const dropped = payload.seatIds.filter((id) => selectedIdsRef.current.includes(id))
        if (dropped.length > 0) {
          toast(
            dropped.length === 1
              ? `Seat ${dropped[0]} was just taken by another customer.`
              : `Seats ${dropped.join(', ')} were just taken by another customer.`,
            'error',
          )
        }
      }

      dispatch({ type: 'REMOTE_UPDATE', seatIds: payload.seatIds, status: payload.status })
    }

    socket.on('seats:updated', handleSeatsUpdated)
    return () => {
      socket.off('seats:updated', handleSeatsUpdated)
    }
  }, [socket, eventId, toast])

  const toggleSeat = React.useCallback((seatId: string) => {
    dispatch({ type: 'TOGGLE_SELECT', seatId })
  }, [])

  const clearSelection = React.useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' })
  }, [])

  const retry = React.useCallback(() => load('LOADED'), [load])

  return {
    event: state.event,
    seats: state.seats,
    selectedIds: state.selectedIds,
    status: state.status,
    error: state.error,
    isConnected,
    toggleSeat,
    clearSelection,
    retry,
  }
}
