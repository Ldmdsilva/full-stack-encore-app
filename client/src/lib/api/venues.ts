import { apiClient, getWithRetry } from './client'
import type { CreateVenuePayload, UpdateVenuePayload, Venue } from '../types'

export async function list(): Promise<{ venues: Venue[] }> {
  return getWithRetry('/venues')
}

export async function getById(id: string): Promise<{ venue: Venue }> {
  return getWithRetry(`/venues/${id}`)
}

export async function create(payload: CreateVenuePayload): Promise<{ venue: Venue }> {
  const { data } = await apiClient.post('/venues', payload)
  return data
}

export async function update(id: string, payload: UpdateVenuePayload): Promise<{ venue: Venue }> {
  const { data } = await apiClient.patch(`/venues/${id}`, payload)
  return data
}

export async function remove(id: string): Promise<void> {
  await apiClient.delete(`/venues/${id}`)
}
