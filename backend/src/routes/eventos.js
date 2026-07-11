import { Router } from 'express';
import { crear, listar, detalle, actualizar } from '../controllers/eventosController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(listar));
router.get('/:id', requireAuth, asyncHandler(detalle));
router.post('/', requireAuth, requireRole('admin'), asyncHandler(crear));
router.put('/:id', requireAuth, requireRole('admin'), asyncHandler(actualizar));

export default router;
