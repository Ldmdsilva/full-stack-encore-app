import { env } from '../config/env.js';
import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication routes (NFR-5)
 * Limits repeated requests from the same IP to prevent brute-force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 1000 : 20, // Allow more in tests, limit to 20 in production/dev
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
  },
});

/**
 * Rate limiter for booking creation (a seat hold is now a resource that can
 * be exhausted). Kept high in tests so the D4.3 concurrency burst is
 * governed only by the atomic seat guard, not by this limiter.
 */
export const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 10000 : 30, // Allow more in tests, limit to 30 in production/dev
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many booking attempts. Please try again after 15 minutes.',
    },
  },
});
