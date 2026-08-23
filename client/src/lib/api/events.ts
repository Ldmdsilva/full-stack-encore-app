import { apiClient, getWithRetry } from './client'
import type { CreateEventPayload, EventSummary, Seat, UpdateEventPayload } from '../types'

export interface ListEventsParams {
  page?: number
  limit?: number
  artist?: string
  genre?: string
  from?: string
  to?: string
  venue?: string
}

export interface ListEventsResponse {
  events: EventSummary[]
  total: number
  page: number
  totalPages: number
}

export async function list(params: ListEventsParams = {}): Promise<ListEventsResponse> {
  return getWithRetry('/events', { params })
}

export async function getById(id: string): Promise<{ event: EventSummary; seats: Seat[] }> {
  return getWithRetry(`/events/${id}`)
}

export async function create(payload: CreateEventPayload): Promise<{ event: EventSummary }> {
  const { data } = await apiClient.post('/events', payload)
  return data
}

export async function update(id: string, payload: UpdateEventPayload): Promise<{ event: EventSummary }> {
  const { data } = await apiClient.patch(`/events/${id}`, payload)
  return data
}

export async function remove(id: string): Promise<void> {
  await apiClient.delete(`/events/${id}`)
}
