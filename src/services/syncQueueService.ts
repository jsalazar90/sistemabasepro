import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getLocal, setLocal, isUUID } from './storageHelper';

export interface SyncQueueItem {
  id: string; // UUID de la tarea en cola
  empresaId: string;
  entity: string; // 'facturas_venta' | 'facturas_compra' | 'contactos' | 'productos' | 'bancos' | 'movimientos_bancos' | 'comprobantes' | 'cxc' | 'cxp' | 'movimientos_inventario' | 'almacenes';
  action: 'UPSERT' | 'DELETE';
  payload: any;
  createdAt: string;
  retries: number;
  lastError?: string;
  status: 'pending' | 'processing' | 'failed';
}

const getQueueKey = (empresaId: string) => `app_sync_queue_${empresaId || 'default'}`;

/**
 * Encola una mutación en IndexedDB para sincronización diferida o resiliente.
 */
export async function enqueueMutation(
  empresaId: string,
  entity: string,
  action: 'UPSERT' | 'DELETE',
  payload: any
): Promise<SyncQueueItem> {
  const cid = empresaId || 'default';
  const queueKey = getQueueKey(cid);
  const queue = await getLocal<SyncQueueItem[]>(queueKey, []);

  const targetRecordId = payload?.id ? String(payload.id) : null;

  // Si ya existe una mutación pendiente para el mismo registro y entidad, la actualizamos
  const existingIdx = targetRecordId 
    ? queue.findIndex(q => q.entity === entity && q.payload?.id && String(q.payload.id) === targetRecordId)
    : -1;

  const newItem: SyncQueueItem = {
    id: crypto.randomUUID(),
    empresaId: cid,
    entity,
    action,
    payload,
    createdAt: new Date().toISOString(),
    retries: 0,
    status: 'pending'
  };

  let updatedQueue: SyncQueueItem[];
  if (existingIdx >= 0) {
    updatedQueue = [...queue];
    updatedQueue[existingIdx] = newItem;
  } else {
    updatedQueue = [...queue, newItem];
  }

  await setLocal(queueKey, updatedQueue);
  notifyQueueUpdate(cid, updatedQueue.filter(i => i.status === 'pending').length);

  // Si el navegador está en línea, intentar procesar la cola en segundo plano
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    setTimeout(() => {
      processSyncQueue(cid).catch(() => {});
    }, 100);
  }

  return newItem;
}

/**
 * Obtiene todas las mutaciones pendientes para una empresa.
 */
export async function getPendingQueue(empresaId?: string): Promise<SyncQueueItem[]> {
  const cid = empresaId || 'default';
  const queue = await getLocal<SyncQueueItem[]>(getQueueKey(cid), []);
  return queue.filter(q => q.status === 'pending' || q.status === 'processing');
}

/**
 * Obtiene el conteo de elementos pendientes de sincronizar.
 */
export async function getPendingCount(empresaId?: string): Promise<number> {
  const cid = empresaId || 'default';
  const pending = await getPendingQueue(cid);
  return pending.length;
}

/**
 * Limpia la cola de sincronización (utilidad de reset/mantenimiento).
 */
export async function clearSyncQueue(empresaId?: string): Promise<void> {
  const cid = empresaId || 'default';
  await setLocal(getQueueKey(cid), []);
  notifyQueueUpdate(cid, 0);
}

/**
 * Smart Merge: Combina registros descargados de Supabase con cambios locales pendientes en la cola.
 * Evita que una descarga remota elimine o sobreescriba registros generados fuera de línea.
 */
export function mergeWithPending<T extends { id?: any }>(
  remoteItems: T[],
  pendingQueue: SyncQueueItem[],
  entity: string
): T[] {
  if (!pendingQueue || pendingQueue.length === 0) return remoteItems;

  const entityQueue = pendingQueue.filter(q => q.entity === entity);
  if (entityQueue.length === 0) return remoteItems;

  let merged = [...remoteItems];

  for (const item of entityQueue) {
    const recordId = item.payload?.id ? String(item.payload.id) : null;
    if (!recordId) continue;

    if (item.action === 'DELETE') {
      merged = merged.filter(m => String(m.id) !== recordId);
    } else if (item.action === 'UPSERT') {
      const idx = merged.findIndex(m => String(m.id) === recordId);
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], ...item.payload };
      } else {
        merged.unshift(item.payload);
      }
    }
  }

  return merged;
}

/**
 * Notifica a la interfaz (SyncStatusBadge) mediante un CustomEvent del navegador.
 */
function notifyQueueUpdate(empresaId: string, pendingCount: number) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('erp_sync_queue_updated', {
      detail: { empresaId, pendingCount }
    }));
  }
}

/**
 * Procesa la cola de sincronización pendiente contra Supabase.
 */
export async function processSyncQueue(empresaId?: string): Promise<{
  processed: number;
  failed: number;
  remaining: number;
}> {
  const cid = empresaId || 'default';
  if (!isSupabaseConfigured || !supabase) {
    const count = await getPendingCount(cid);
    return { processed: 0, failed: 0, remaining: count };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const count = await getPendingCount(cid);
    return { processed: 0, failed: 0, remaining: count };
  }

  const queueKey = getQueueKey(cid);
  const queue = await getLocal<SyncQueueItem[]>(queueKey, []);
  if (!queue || queue.length === 0) return { processed: 0, failed: 0, remaining: 0 };

  let processed = 0;
  let failed = 0;
  const remainingQueue: SyncQueueItem[] = [];

  for (const item of queue) {
    if (item.status === 'failed' && item.retries >= 5) {
      remainingQueue.push(item);
      continue;
    }

    try {
      const ok = await executeRemoteMutation(item);
      if (ok) {
        processed++;
      } else {
        failed++;
        item.retries++;
        item.status = item.retries >= 5 ? 'failed' : 'pending';
        remainingQueue.push(item);
      }
    } catch (err: any) {
      failed++;
      item.retries++;
      item.lastError = err?.message || 'Error desconocido al sincronizar';
      item.status = item.retries >= 5 ? 'failed' : 'pending';
      remainingQueue.push(item);
    }
  }

  await setLocal(queueKey, remainingQueue);
  notifyQueueUpdate(cid, remainingQueue.filter(q => q.status === 'pending').length);

  return {
    processed,
    failed,
    remaining: remainingQueue.filter(q => q.status === 'pending').length
  };
}

/**
 * Ejecutor de mutaciones individuales contra Supabase.
 */
async function executeRemoteMutation(item: SyncQueueItem): Promise<boolean> {
  if (!supabase) return false;

  const { entity, action, payload } = item;
  const targetId = payload?.id;

  if (action === 'DELETE') {
    if (!targetId || !isUUID(targetId)) return true; // Nada que borrar en remoto si no es UUID
    const { error } = await supabase.from(entity).delete().eq('id', targetId);
    return !error;
  }

  // UPSERT
  if (!payload) return true;

  // Sanitización de claves foráneas no UUID para evitar errores 22P02 / 23503 en Postgres
  const sanitized = { ...payload };
  Object.keys(sanitized).forEach(k => {
    if (k.endsWith('_id') && sanitized[k] && !isUUID(sanitized[k])) {
      sanitized[k] = null;
    }
  });

  const { error } = await supabase.from(entity).upsert(sanitized, { onConflict: 'id' });
  if (error) {
    // Si fue conflicto o duplicado, intentar update directo
    if (error.code === '23505' || (error as any).status === 409) {
      const { error: updErr } = await supabase.from(entity).update(sanitized).eq('id', targetId);
      return !updErr;
    }
    return false;
  }

  return true;
}

// Suscribir automáticamente a eventos de red online en el navegador
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processSyncQueue().catch(() => {});
  });
}
