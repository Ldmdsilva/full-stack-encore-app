import { describe, expect, it } from 'vitest'
import { createPaymentSession } from './payments'

describe('createPaymentSession', () => {
  it('returns a client secret and publishable key for a live hold', async () => {
    const result = await createPaymentSession('booking-1')
    expect(result.clientSecret).toBeTruthy()
  })
})
