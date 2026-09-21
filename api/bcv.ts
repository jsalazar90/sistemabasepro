import https from 'https';

// Cache en memoria en la instancia serverless para ejecuciones cálidas
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (typeof res.status === 'function') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  // Parse query params
  const urlObj = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  const force = urlObj.searchParams.get('force') === 'true';
  const now = Date.now();

  const sendResponse = (statusCode: number, data: any, edgeCache: boolean = true) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    };

    if (edgeCache && statusCode === 200) {
      // 10 minutos en CDN Edge de Vercel, revalidación en segundo plano hasta 5 minutos
      headers['Cache-Control'] = 'public, s-maxage=600, stale-while-revalidate=300';
    } else {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }

    if (typeof res.setHeader === 'function') {
      for (const [k, v] of Object.entries(headers)) {
        res.setHeader(k, v);
      }
    }

    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(statusCode).json(data);
    }

    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(data));
  };

  // 1. Verificar cache en memoria si no se solicita refresco forzado
  if (!force && bcvCache && (now - bcvCache.timestamp < 10 * 60 * 1000)) {
    return sendResponse(200, {
      success: true,
      tasa: bcvCache.rate,
      fecha: bcvCache.date,
      fuente: bcvCache.source,
      cached: true,
      timestamp: new Date(bcvCache.timestamp).toISOString()
    });
  }

  // 2. Intentar directamente desde la página oficial del BCV
  let result = await fetchFromBCVOfficial();

  // 3. Fallback a API espejo si el portal del BCV presenta intermitencias
  if (!result) {
    result = await fetchFromMirrorApi();
  }

  if (result) {
    bcvCache = {
      ...result,
      timestamp: now
    };
    return sendResponse(200, {
      success: true,
      tasa: result.rate,
      fecha: result.date,
      fuente: result.source,
      cached: false,
      timestamp: new Date().toISOString()
    });
  }

  // 4. Si fallaron ambos pero tenemos un cache anterior, devolverlo como fallback
  if (bcvCache) {
    return sendResponse(200, {
      success: true,
      tasa: bcvCache.rate,
      fecha: bcvCache.date,
      fuente: bcvCache.source,
      cached: true,
      stale: true,
      timestamp: new Date(bcvCache.timestamp).toISOString()
    });
  }

  return sendResponse(502, {
    success: false,
    error: 'No se pudo obtener la tasa oficial del BCV en este momento. Verifique su conexión a internet.'
  }, false);
}
