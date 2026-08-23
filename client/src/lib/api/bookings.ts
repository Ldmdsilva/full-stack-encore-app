import { apiClient, getWithRetry } from './client'
import type { Booking, CreateBookingPayload, CreateBookingResponse } from '../types'

export interface ListBookingsParams {
  page?: number
  limit?: number
}

export interface ListBookingsResponse {
  items: Booking[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ListAllBookingsParams extends ListBookingsParams {
  eventId?: string
}

/**
 * Create a booking (opens a seat hold + Stripe Checkout Session). Never
 * retried — a retried hold attempt could double-submit against the atomic
 * seat guard or open a duplicate Stripe session (§C7.3).
 */
export async function create(payload: CreateBookingPayload): Promise<CreateBookingResponse> {
  const { data } = await apiClient.post('/bookings', payload)
  return data
}

export async function getById(id: string): Promise<{ booking: Booking }> {
  return getWithRetry(`/bookings/${id}`)
}

export async function listMine(params: ListBookingsParams = {}): Promise<ListBookingsResponse> {
  return getWithRetry('/bookings/me', { params })
}

export async function listAll(params: ListAllBookingsParams = {}): Promise<ListBookingsResponse> {
  return getWithRetry('/bookings', { params })
}

export async function cancel(id: string): Promise<{ booking: Booking }> {
  const { data } = await apiClient.patch(`/bookings/${id}/cancel`)
  return data
}
