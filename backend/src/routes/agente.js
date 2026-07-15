import { Router } from 'express';
import { obtenerToken } from '../controllers/agenteController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.post('/token', requireAuth, asyncHandler(obtenerToken));

export default router;
