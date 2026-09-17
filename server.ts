import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDb } from './server/db.ts';
import menuRouter from './server/routes/menu.ts';
import inventoryRouter from './server/routes/inventory.ts';
import ordersRouter from './server/routes/orders.ts';
import staffRouter from './server/routes/staff.ts';
import tipsRouter from './server/routes/tips.ts';
import reservationsRouter from './server/routes/reservations.ts';
import statsRouter from './server/routes/stats.ts';
import seatingRouter from './server/routes/seating.ts';

async function startServer() {
  // Initialize SQLite database
  await getDb();
  console.log('SQLite database initialized successfully');

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/menu', menuRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/tips', tipsRouter);
  app.use('/api/reservations', reservationsRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/seating', seatingRouter);

  // Vite middleware in development vs static serving in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Restaurant Management Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
