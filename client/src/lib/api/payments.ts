import { apiClient } from './client'
import type { PaymentSessionResponse } from '../types'

/**
 * Re-issue a client secret for a booking whose hold is still live, e.g.
 * after the customer reloads checkout.
 */
export async function createPaymentSession(bookingId: string): Promise<PaymentSessionResponse> {
  const { data } = await apiClient.post(`/bookings/${bookingId}/payment-session`)
  return data
}
