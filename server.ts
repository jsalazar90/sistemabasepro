import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer as createHttpServer } from 'http';
import https from 'https';
import path from 'path';

const PORT = 3000;
const app = express();

app.use(express.json());

// API health
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Cache de tasa BCV en memoria (10 minutos)
let bcvCache: {
  rate: number;
  date: string;
  source: string;
  timestamp: number;
} | null = null;

async function fetchFromBCVOfficial(): Promise<{ rate: number; date: string; source: string } | null> {
  return new Promise((resolve) => {
    const req = https.get('https://www.bcv.org.ve/', { rejectUnauthorized: false, timeout: 9000 }, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => {
        try {
          const dolarBlock = data.match(/id=["']dolar["'][\s\S]*?<strong[^>]*>\s*([0-9.,]+)\s*<\/strong>/i);
          let rate: number | null = null;
          if (dolarBlock) {
            const clean = dolarBlock[1].replace(/\./g, '').replace(',', '.').trim();
            rate = parseFloat(clean);
          }

          const fechaMatch = data.match(/Fecha Valor:[\s\S]*?content=["']([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
          const date = fechaMatch ? fechaMatch[1] : new Date().toISOString().split('T')[0];

          if (rate && rate > 0) {
            resolve({ rate, date, source: 'Banco Central de Venezuela (bcv.org.ve)' });
            return;
          }
          resolve(null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function fetchFromMirrorApi(): Promise<{ rate: number; date: string; source: string } | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data && (data.promedio || data.venta || data.precio)) {
      const rate = Number(data.promedio || data.venta || data.precio);
      const date = (data.fechaActualizacion ? data.fechaActualizacion.split('T')[0] : '') || new Date().toISOString().split('T')[0];
      if (rate > 0) {
        return { rate, date, source: 'DolarAPI Oficial (Espejo BCV)' };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Endpoint para consultar tasa oficial BCV en vivo
app.get('/api/bcv', async (req, res) => {
  const force = req.query.force === 'true';
  const now = Date.now();

  if (!force && bcvCache && (now - bcvCache.timestamp < 10 * 60 * 1000)) {
    return res.json({
      success: true,
      tasa: bcvCache.rate,
      fecha: bcvCache.date,
      fuente: bcvCache.source,
      cached: true,
      timestamp: new Date(bcvCache.timestamp).toISOString()
    });
  }

  // 1. Intentar directamente desde la página oficial del BCV
  let result = await fetchFromBCVOfficial();

  // 2. Si el portal del BCV presenta intermitencias o bloqueos, usar API espejo en vivo
  if (!result) {
    result = await fetchFromMirrorApi();
  }

  if (result) {
    bcvCache = {
      ...result,
      timestamp: now
    };
    return res.json({
      success: true,
      tasa: result.rate,
      fecha: result.date,
      fuente: result.source,
      cached: false,
      timestamp: new Date().toISOString()
    });
  }

  if (bcvCache) {
    return res.json({
      success: true,
      tasa: bcvCache.rate,
      fecha: bcvCache.date,
      fuente: bcvCache.source,
      cached: true,
      stale: true,
      timestamp: new Date(bcvCache.timestamp).toISOString()
    });
  }

  return res.status(502).json({
    success: false,
    error: 'No se pudo obtener la tasa oficial del BCV en este momento. Verifique su conexión a internet.'
  });
});

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
