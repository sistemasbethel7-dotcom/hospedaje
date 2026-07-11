import { Router } from 'express';
import { listar, listarActivos, crear, actualizar, eliminar } from '../controllers/catalogosController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.get('/activos', requireAuth, asyncHandler(listarActivos));
router.get('/', requireAuth, requireRole('admin'), asyncHandler(listar));
router.post('/', requireAuth, requireRole('admin'), asyncHandler(crear));
router.put('/:id', requireAuth, requireRole('admin'), asyncHandler(actualizar));
router.delete('/:id', requireAuth, requireRole('admin'), asyncHandler(eliminar));

export default router;
