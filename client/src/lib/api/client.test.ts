import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { apiClient, getWithRetry } from './client'
import { getToken, setToken } from '../tokenStore'

describe('getWithRetry', () => {
  it('retries a failing GET with backoff and resolves once the server recovers', async () => {
    let attempts = 0
    server.use(
      http.get('/api/health', () => {
        attempts += 1
        if (attempts < 3) return new HttpResponse(null, { status: 500 })
        return HttpResponse.json({ status: 'healthy', db: 'connected', uptime: 1, timestamp: 'now' })
      }),
    )

    const result = await getWithRetry<{ status: string }>('/health')
    expect(result.status).toBe('healthy')
    expect(attempts).toBe(3)
  })

  it('gives up after 3 attempts and throws', async () => {
    let attempts = 0
    server.use(
      http.get('/api/health', () => {
        attempts += 1
        return new HttpResponse(null, { status: 500 })
      }),
    )

    await expect(getWithRetry('/health')).rejects.toBeTruthy()
    expect(attempts).toBe(3)
  })
})

describe('apiClient response interceptor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    window.history.pushState({}, '', '/')
  })

  it('clears the token on a 401', async () => {
    // jsdom's `window.location.assign` is a non-configurable own property,
    // so it can't be spied on directly — staying on /login sidesteps the
    // interceptor's `window.location.assign('/login')` call (it's a no-op
    // there) while still exercising the token-clearing behaviour, which is
    // the part under test here.
    window.history.pushState({}, '', '/login')
    setToken('some-token')
    server.use(http.get('/api/health', () => HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: 'nope' } }, { status: 401 })))

    await expect(apiClient.get('/health')).rejects.toMatchObject({ code: 'UNAUTHORIZED' })

    expect(getToken()).toBeNull()
  })

  it('normalises every rejection into an ApiError shape', async () => {
    server.use(http.get('/api/health', () => HttpResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'oops' } }, { status: 500 })))
    await expect(apiClient.get('/health')).rejects.toEqual({ code: 'INTERNAL_SERVER_ERROR', message: 'oops', details: undefined })
  })
})
