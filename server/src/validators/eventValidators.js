import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().trim().min(1, 'Event title is required'),
  artist: z.string().trim().min(1, 'Artist name is required'),
  genre: z.string().trim().min(1, 'Genre is required'),
  imageUrl: z.string().trim().url('imageUrl must be a valid URL').optional(),
  description: z.string().trim().optional(),
  date: z.coerce.date({ message: 'Invalid date format' }),
  basePrice: z.coerce.number().min(0, 'Base price cannot be negative'),
  venueRef: z.string().trim().min(1, 'Venue reference is required'),
});

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    artist: z.string().trim().min(1).optional(),
    genre: z.string().trim().min(1).optional(),
    imageUrl: z.string().trim().url('imageUrl must be a valid URL').optional(),
    description: z.string().trim().optional(),
    date: z.coerce.date({ message: 'Invalid date format' }).optional(),
    basePrice: z.coerce.number().min(0).optional(),
    venueRef: z.string().trim().min(1).optional(),
    status: z.enum(['scheduled', 'cancelled']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });
