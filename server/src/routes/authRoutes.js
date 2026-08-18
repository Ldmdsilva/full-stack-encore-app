import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public auth routes with rate limiting (§C7.1, NFR-5)
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

export default router;
