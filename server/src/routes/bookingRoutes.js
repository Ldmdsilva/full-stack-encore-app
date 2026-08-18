import { Router } from 'express';
import * as bookingController from '../controllers/bookingController.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';

const router = Router();

// Customer bookings (FR-17, FR-18, FR-19)
router.post('/', verifyToken, bookingController.createBooking);
router.get('/me', verifyToken, bookingController.getMyBookings);
router.patch('/:id/cancel', verifyToken, bookingController.cancelBooking);

// Admin-only booking management (FR-24, FR-25)
router.get('/', verifyToken, requireRole('admin'), bookingController.getAllBookings);

export default router;
