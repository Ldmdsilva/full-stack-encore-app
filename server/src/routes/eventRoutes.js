import { Router } from 'express';
import * as eventController from '../controllers/eventController.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';

const router = Router();

// Public event routes (FR-7, FR-8)
router.get('/', eventController.getEvents);
router.get('/:id', eventController.getEventById);

// Admin-only event routes (FR-10, FR-11, FR-12)
router.post('/', verifyToken, requireRole('admin'), eventController.createEvent);
router.patch('/:id', verifyToken, requireRole('admin'), eventController.updateEvent);
router.delete('/:id', verifyToken, requireRole('admin'), eventController.deleteEvent);

export default router;
