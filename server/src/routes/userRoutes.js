import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// Protected user routes (FR-5, FR-6)
router.get('/me', verifyToken, userController.getMe);
router.patch('/me', verifyToken, userController.updateMe);
router.delete('/me', verifyToken, userController.deleteMe);

export default router;
