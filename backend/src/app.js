import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);

  return app;
}
