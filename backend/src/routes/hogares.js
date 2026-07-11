import { Router } from 'express';
import { crear, listar, detalle, actualizar, eliminar } from '../controllers/hogaresController.js';
import { crear as crearIngreso } from '../controllers/ingresosController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { upload } from '../middleware/upload.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(listar));

router.get('/:id', requireAuth, asyncHandler(detalle));

router.post(
  '/',
  requireAuth,
  requireRole('agente', 'admin'),
  upload.fields([
    { name: 'foto_dueno', maxCount: 1 },
    { name: 'foto_fachada', maxCount: 1 },
  ]),
  asyncHandler(crear)
);

router.put(
  '/:id',
  requireAuth,
  requireRole('agente', 'admin'),
  upload.fields([
    { name: 'foto_dueno', maxCount: 1 },
    { name: 'foto_fachada', maxCount: 1 },
  ]),
  asyncHandler(actualizar)
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('agente', 'admin'),
  asyncHandler(eliminar)
);

router.post(
  '/:id/ingresos',
  requireAuth,
  requireRole('agente', 'admin'),
  asyncHandler(crearIngreso)
);

export default router;
