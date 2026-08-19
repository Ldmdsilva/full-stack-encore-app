import { describe, expect, it } from 'vitest'
import * as adminApi from './admin'

describe('admin api', () => {
  it('fetches dashboard stats', async () => {
    const stats = await adminApi.stats()
    expect(stats.totalEvents).toBeGreaterThan(0)
    expect(typeof stats.occupancyRate).toBe('number')
  })

  it('lists events with pagination metadata', async () => {
    const result = await adminApi.listEvents({ page: 1, limit: 10 })
    expect(result.events.length).toBeGreaterThan(0)
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('totalPages')
  })
})
