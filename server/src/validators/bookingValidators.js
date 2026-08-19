import { z } from 'zod';

export const createBookingSchema = z.object({
  eventId: z.string().trim().min(1, 'eventId is required'),
  seatIds: z.array(z.string().trim().min(1)).min(1, 'At least one seat must be selected'),
});
