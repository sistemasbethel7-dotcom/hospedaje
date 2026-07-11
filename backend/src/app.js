import express from 'express';
import cors from 'cors';
import path from 'node:path';
import authRoutes from './routes/auth.js';
import hogaresRoutes from './routes/hogares.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/hogares', hogaresRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: 'Error interno del servidor.' });
  });

  return app;
}
