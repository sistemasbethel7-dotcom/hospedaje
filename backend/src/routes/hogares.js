import { Router } from 'express';
import { crear } from '../controllers/hogaresController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { upload } from '../middleware/upload.js';

const router = Router();

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

export default router;
