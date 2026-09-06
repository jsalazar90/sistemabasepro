import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer as createHttpServer } from 'http';
import path from 'path';

const PORT = 3000;
const app = express();

app.use(express.json());

// API health
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

async function startServer() {
  // Vite middleware (dev mode)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use('/data', express.static(path.join(process.cwd(), 'data')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = createHttpServer(app);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Servidor ERP corriendo en http://localhost:${PORT}\n`);
  });
}

startServer();
