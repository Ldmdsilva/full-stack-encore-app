import { getWithRetry } from './client'
import type { AdminEvent, AdminStats } from '../types'

export interface ListAdminEventsParams {
  page?: number
  limit?: number
}

export interface ListAdminEventsResponse {
  events: AdminEvent[]
  total: number
  page: number
  totalPages: number
}

export async function stats(): Promise<AdminStats> {
  return getWithRetry('/admin/stats')
}

export async function listEvents(params: ListAdminEventsParams = {}): Promise<ListAdminEventsResponse> {
  return getWithRetry('/admin/events', { params })
}
