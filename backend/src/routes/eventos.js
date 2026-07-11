import { Router } from 'express';
import { crear, listar, detalle, metricas, stream, actualizar } from '../controllers/eventosController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, requireAuthQuery } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(listar));
router.get('/:id', requireAuth, asyncHandler(detalle));
router.get('/:id/metricas', requireAuth, asyncHandler(metricas));
router.get('/:id/stream', requireAuthQuery, stream);
router.post('/', requireAuth, requireRole('admin'), asyncHandler(crear));
router.put('/:id', requireAuth, requireRole('admin'), asyncHandler(actualizar));

export default router;
