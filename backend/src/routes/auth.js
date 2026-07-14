import { Router } from 'express';
import { login, me, validarTokenInvitacion, establecerPassword } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.post('/login', asyncHandler(login));
router.get('/me', requireAuth, me);
router.get('/set-password/:token', asyncHandler(validarTokenInvitacion));
router.post('/set-password', asyncHandler(establecerPassword));

export default router;
