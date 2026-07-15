import { Router } from 'express';
import { obtenerToken, obtenerConfigController, actualizarConfigController } from '../controllers/agenteController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.post('/token', requireAuth, asyncHandler(obtenerToken));
router.get('/config', requireAuth, asyncHandler(obtenerConfigController));
router.put('/config', requireAuth, requireRole('admin'), asyncHandler(actualizarConfigController));

export default router;
