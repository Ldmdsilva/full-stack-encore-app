import { Router } from 'express';
import * as paymentController from '../controllers/paymentController.js';

const router = Router();

// Stripe webhook (ADR-011). Mounted directly at /api/payments/webhook in
// app.js ahead of express.json(), so the raw body reaches signature
// verification untouched — not JWT-protected, Stripe signs the payload.
router.post('/', paymentController.handleWebhook);

export default router;
