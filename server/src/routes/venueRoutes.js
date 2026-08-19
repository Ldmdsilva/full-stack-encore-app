import { Router } from 'express';
import * as venueController from '../controllers/venueController.js';
import { verifyToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { validate } from '../middleware/validate.js';
import { createVenueSchema, updateVenueSchema } from '../validators/venueValidators.js';

const router = Router();

// Public venue listings (FR-22)
router.get('/', venueController.getAllVenues);
router.get('/:id', venueController.getVenueById);

// Admin-only venue management (FR-22)
router.post('/', verifyToken, requireRole('admin'), validate(createVenueSchema), venueController.createVenue);
router.patch('/:id', verifyToken, requireRole('admin'), validate(updateVenueSchema), venueController.updateVenue);
router.delete('/:id', verifyToken, requireRole('admin'), venueController.deleteVenue);

export default router;
