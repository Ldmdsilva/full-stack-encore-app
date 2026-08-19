import { Router } from 'express';
import * as bookingController from '../controllers/bookingController.js';
import * as paymentController from '../controllers/paymentController.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { validate } from '../middleware/validate.js';
import { bookingLimiter } from '../middleware/rateLimiter.js';
import { createBookingSchema } from '../validators/bookingValidators.js';

const router = Router();

// Customer bookings (FR-17, FR-18, FR-19)
router.post('/', verifyToken, bookingLimiter, validate(createBookingSchema), bookingController.createBooking);
router.get('/me', verifyToken, bookingController.getMyBookings);
router.get('/:id', verifyToken, bookingController.getBookingById);
router.post('/:id/payment-session', verifyToken, paymentController.createPaymentSession);
router.patch('/:id/cancel', verifyToken, bookingController.cancelBooking);

// Admin-only booking management (FR-24, FR-25)
router.get('/', verifyToken, requireRole('admin'), bookingController.getAllBookings);

export default router;
