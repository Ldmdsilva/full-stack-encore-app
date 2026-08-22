import { apiClient } from './client'
import type { Booking, PaymentSessionResponse } from '../types'

/**
 * Re-issue a client secret for a booking whose hold is still live, e.g.
 * after the customer reloads checkout.
 */
export async function createPaymentSession(bookingId: string): Promise<PaymentSessionResponse> {
  const { data } = await apiClient.post(`/bookings/${bookingId}/payment-session`)
  return data
}

/**
 * Reconcile a booking's payment status directly against Stripe — no
 * webhook required. Safe to call repeatedly; a no-op once the booking is
 * no longer `pending`.
 */
export async function confirmPayment(bookingId: string): Promise<{ booking: Booking }> {
  const { data } = await apiClient.post(`/bookings/${bookingId}/confirm-payment`)
  return data
}
