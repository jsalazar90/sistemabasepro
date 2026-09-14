/**
 * Servicio para gestión y persistencia de Tasas de Cambio Oficiales (BCV) por día
 */

import { getTodayLocalDate } from '../utils/dateUtils';

export interface TasaCambioDia {
  id: string;
  fecha: string; // YYYY-MM-DD
  tasa: number;  // Bs. por USD
  fuente?: string; // 'BCV'
  created_at?: string;
}

const STORAGE_KEY = 'sistema_tasas_cambio_bcv';

export function getStoredTasas(): TasaCambioDia[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const today = getTodayLocalDate();
      const initial: TasaCambioDia[] = [
        {
          id: `tasa_${today}`,
          fecha: today,
          tasa: 36.50,
          fuente: 'BCV',
          created_at: new Date().toISOString()
        }
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredTasa(fecha: string, tasa: number, fuente: string = 'BCV'): TasaCambioDia[] {
  if (!fecha || isNaN(tasa) || tasa <= 0) return getStoredTasas();

  const current = getStoredTasas();
  const existingIdx = current.findIndex(t => t.fecha === fecha);
  const now = new Date().toISOString();

  let updated: TasaCambioDia[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = {
      ...updated[existingIdx],
      tasa,
      fuente,
      created_at: now
    };
  } else {
    updated = [
      {
        id: `tasa_${fecha}_${Date.now()}`,
        fecha,
        tasa,
        fuente,
        created_at: now
      },
      ...current
    ];
  }

  // Ordenar de más reciente a más antigua
  updated.sort((a, b) => b.fecha.localeCompare(a.fecha));

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('tasa-cambio-updated', { detail: { fecha, tasa } }));
  } catch (e) {
    console.error('Error saving tasa:', e);
  }

  return updated;
}

export function deleteStoredTasa(fecha: string): TasaCambioDia[] {
  const current = getStoredTasas();
  const filtered = current.filter(t => t.fecha !== fecha);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('tasa-cambio-updated', { detail: { fecha } }));
  } catch (e) {
    console.error('Error deleting tasa:', e);
  }
  return filtered;
}

export function getTasaForDate(fecha?: string): number {
  const targetDate = fecha || getTodayLocalDate();
  const list = getStoredTasas();

  // 1. Coincidencia exacta con la fecha
  const exact = list.find(t => t.fecha === targetDate);
  if (exact && exact.tasa > 0) return exact.tasa;

  // 2. Tasa más reciente anterior a esa fecha
  const prior = list
    .filter(t => t.fecha <= targetDate && t.tasa > 0)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (prior.length > 0) return prior[0].tasa;

  // 3. Tasa más reciente disponible
  if (list.length > 0 && list[0].tasa > 0) return list[0].tasa;

  return 36.50;
}

export interface LiveBcvResult {
  success: boolean;
  tasa?: number;
  fecha?: string;
  fuente?: string;
  error?: string;
}

/**
 * Consulta la tasa oficial en vivo directamente desde la página del Banco Central de Venezuela (BCV)
 * y actualiza automáticamente el almacenamiento local y notifica a las vistas del sistema.
 */
export async function fetchLiveBcvRate(force: boolean = false): Promise<LiveBcvResult> {
  // 1. Intentar a través del endpoint backend del ERP (conecta directamente con bcv.org.ve)
  try {
    const res = await fetch(`/api/bcv${force ? '?force=true' : ''}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Number(data.tasa) > 0) {
        const fecha = data.fecha || getTodayLocalDate();
        const tasa = Number(Number(data.tasa).toFixed(4));
        const fuente = data.fuente || 'BCV';
        saveStoredTasa(fecha, tasa, fuente);
        return {
          success: true,
          tasa,
          fecha,
          fuente
        };
      }
    }
  } catch (err) {
    console.warn('Endpoint /api/bcv falló, intentando respaldo...', err);
  }

  // 2. Fallback de cliente directo (si el backend no está disponible)
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    if (res.ok) {
      const data: any = await res.json();
      const rate = Number(data.promedio || data.venta || data.precio);
      if (rate > 0) {
        const fecha = (data.fechaActualizacion ? data.fechaActualizacion.split('T')[0] : '') || getTodayLocalDate();
        const fuente = 'BCV (Oficial)';
        saveStoredTasa(fecha, Number(rate.toFixed(4)), fuente);
        return {
          success: true,
          tasa: Number(rate.toFixed(4)),
          fecha,
          fuente
        };
      }
    }
  } catch (err) {
    console.error('Error al consultar respaldo de tasa BCV:', err);
  }

  return {
    success: false,
    error: 'No se pudo conectar con el Banco Central de Venezuela. Verifique su conexión a internet.'
  };
}
