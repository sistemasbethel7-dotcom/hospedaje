import { Router } from 'express';
import { login, me } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.post('/login', asyncHandler(login));
router.get('/me', requireAuth, me);

export default router;
