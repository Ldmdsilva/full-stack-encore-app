import { z } from 'zod';

const seatLayoutItemSchema = z.object({
  id: z.string().trim().min(1),
  section: z.string().trim().min(1),
  row: z.string().trim().min(1),
  number: z.coerce.number().int().positive(),
});

export const createVenueSchema = z.object({
  name: z.string().trim().min(1, 'Venue name is required'),
  address: z.string().trim().min(1, 'Venue address is required'),
  city: z.string().trim().min(1, 'Venue city is required'),
  seatLayout: z.array(seatLayoutItemSchema).min(1).max(500, 'Seat layout cannot exceed 500 seats (ADR-002)'),
});

export const updateVenueSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    address: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    seatLayout: z.array(seatLayoutItemSchema).min(1).max(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
