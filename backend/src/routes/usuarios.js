import { Router } from 'express';
import { listar, crear, actualizar, reenviarInvitacion } from '../controllers/usuariosController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), asyncHandler(listar));
router.post('/', requireAuth, requireRole('admin'), asyncHandler(crear));
router.put('/:id', requireAuth, requireRole('admin'), asyncHandler(actualizar));
router.post('/:id/reenviar-invitacion', requireAuth, requireRole('admin'), asyncHandler(reenviarInvitacion));

export default router;
