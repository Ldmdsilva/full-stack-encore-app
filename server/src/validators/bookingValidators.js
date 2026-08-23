import { z } from 'zod';

export const createBookingSchema = z.object({
  eventId: z.string().trim().min(1, 'eventId is required'),
  seatIds: z.array(z.string().trim().min(1)).min(1, 'At least one seat must be selected'),
});

// ADR-014 / §C7.1: the confirm endpoint accepts ONLY `{holdId}`. `.strict()`
// is critical — an unexpected field (an `amount`, a `status`, a
// `paymentIntentId`, or anything else) must be REJECTED with 400
// VALIDATION_ERROR, never silently stripped and ignored (R23).
export const confirmBookingSchema = z.object({
  holdId: z.string().trim().min(1, 'holdId is required'),
}).strict();
