import { Router } from 'express';
import { buscar } from '../controllers/codigosPostalesController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/:cp', requireAuth, asyncHandler(buscar));

export default router;
