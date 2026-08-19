import { apiClient, getWithRetry } from './client'
import type { LoginPayload, RegisterPayload, UpdateProfilePayload, User } from '../types'

export async function register(payload: RegisterPayload): Promise<{ user: User; token: string }> {
  const { data } = await apiClient.post('/auth/register', payload)
  return data
}

export async function login(payload: LoginPayload): Promise<{ user: User; token: string }> {
  const { data } = await apiClient.post('/auth/login', payload)
  return data
}

export async function getMe(): Promise<{ user: User }> {
  return getWithRetry('/users/me')
}

export async function updateMe(payload: UpdateProfilePayload): Promise<{ user: User }> {
  const { data } = await apiClient.patch('/users/me', payload)
  return data
}

export async function deleteMe(): Promise<void> {
  await apiClient.delete('/users/me')
}
