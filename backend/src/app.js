import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import authRoutes from './routes/auth.js';
import eventosRoutes from './routes/eventos.js';
import hogaresRoutes from './routes/hogares.js';
import usuariosRoutes from './routes/usuarios.js';
import catalogosRoutes from './routes/catalogos.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/eventos', eventosRoutes);
  app.use('/api/hogares', hogaresRoutes);
  app.use('/api/usuarios', usuariosRoutes);
  app.use('/api/catalogos', catalogosRoutes);

  app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'La foto es demasiado pesada. Intenta con una imagen más ligera.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Error interno del servidor.' });
  });

  return app;
}
