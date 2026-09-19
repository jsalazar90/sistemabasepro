import https from 'https';

// Cache en memoria para la instancia serverless caliente
let bcvCache: {
  rate: number;
  date: string;
  source: string;
  timestamp: number;
} | null = null;

async function fetchFromBCVOfficial(): Promise<{ rate: number; date: string; source: string } | null> {
  return new Promise((resolve) => {
    const req = https.get('https://www.bcv.org.ve/', { rejectUnauthorized: false, timeout: 7000 }, (res: any) => {
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
    const timeoutId = setTimeout(() => controller.abort(), 5000);
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
  // Configuración de CORS para permitir peticiones desde cualquier origen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const force = req.query?.force === 'true';
  const now = Date.now();

  // Cache en memoria por 10 minutos
  if (!force && bcvCache && (now - bcvCache.timestamp < 10 * 60 * 1000)) {
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json({
      success: true,
      tasa: bcvCache.rate,
      fecha: bcvCache.date,
      fuente: bcvCache.source,
      cached: true,
      timestamp: new Date(bcvCache.timestamp).toISOString()
    });
  }

  // 1. Intentar portal oficial del BCV
  let result = await fetchFromBCVOfficial();

  // 2. Si el portal del BCV falla o tiene timeout, usar espejo DolarAPI
  if (!result) {
    result = await fetchFromMirrorApi();
  }

  if (result) {
    bcvCache = {
      ...result,
      timestamp: now
    };
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json({
      success: true,
      tasa: result.rate,
      fecha: result.date,
      fuente: result.source,
      cached: false,
      timestamp: new Date().toISOString()
    });
  }

  // Fallback con cache previa si existe
  if (bcvCache) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
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
}
