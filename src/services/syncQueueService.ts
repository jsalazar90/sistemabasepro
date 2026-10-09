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

  // Manejo relacional especializado para Facturas de Venta
  if (entity === 'facturas_venta') {
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const factRow: any = {
      id: targetId,
      empresa_id: payload.empresa_id,
      numero: payload.numero || '',
      control_numero: payload.control_numero || null,
      tipo_documento: payload.tipo_documento || 'factura',
      condicion: payload.condicion || 'contado',
      dias_credito: Number(payload.dias_credito) || 0,
      fecha_emision: payload.fecha_emision,
      fecha_vencimiento: payload.fecha_vencimiento,
      moneda: payload.moneda || 'USD',
      tasa_cambio: Number(payload.tasa_cambio) || 1.0,
      subtotal: Number(payload.subtotal) || 0,
      base_imponible: Number(payload.base_imponible) || Number(payload.subtotal) || 0,
      monto_exento: Number(payload.monto_exento) || 0,
      iva_porcentaje: Number(payload.iva_porcentaje) || 16,
      iva_monto: Number(payload.iva_monto) || 0,
      igtf_porcentaje: Number(payload.igtf_porcentaje) || 0,
      igtf_monto: Number(payload.igtf_monto) || 0,
      total: Number(payload.total) || 0,
      saldo_pendiente: Number(payload.saldo_pendiente) || 0,
      estado: payload.estado || 'emitida',
      notas: payload.notas || null
    };
    if (isUUID(payload.cliente_id)) factRow.cliente_id = payload.cliente_id;
    if (isUUID(payload.comprobante_id)) factRow.comprobante_id = payload.comprobante_id;
    if (isUUID(payload.banco_id)) factRow.banco_id = payload.banco_id;

    const { error: fErr } = await supabase.from('facturas_venta').upsert(factRow, { onConflict: 'id' });
    if (fErr) return false;

    if (rawItems.length > 0) {
      const itemsPayload = rawItems.map((it: any) => ({
        id: (it.id && isUUID(it.id)) ? it.id : crypto.randomUUID(),
        factura_id: targetId,
        producto_id: (it.producto_id && isUUID(it.producto_id)) ? it.producto_id : null,
        descripcion: it.descripcion || it.nombre || 'Artículo',
        cantidad: Number(it.cantidad) || 1,
        precio_unitario: Number(it.precio_unitario) || 0,
        exento: it.exento ?? false,
        subtotal: Number(it.subtotal) || 0,
        iva_monto: Number(it.iva_monto) || 0,
        total: Number(it.total) || 0,
        cuenta_ingreso_id: (it.cuenta_ingreso_id && isUUID(it.cuenta_ingreso_id)) ? it.cuenta_ingreso_id : null,
        cuenta_costo_id: (it.cuenta_costo_id && isUUID(it.cuenta_costo_id)) ? it.cuenta_costo_id : null,
        cuenta_inventario_id: (it.cuenta_inventario_id && isUUID(it.cuenta_inventario_id)) ? it.cuenta_inventario_id : null
      }));
      await supabase.from('facturas_venta_items').delete().eq('factura_id', targetId);
      await supabase.from('facturas_venta_items').insert(itemsPayload);
    }
    return true;
  }

  // Manejo relacional especializado para Facturas de Compra
  if (entity === 'facturas_compra') {
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    const compraRow: any = {
      id: targetId,
      empresa_id: payload.empresa_id,
      numero: payload.numero || '',
      control_numero: payload.control_numero || null,
      condicion: payload.condicion || 'contado',
      dias_credito: Number(payload.dias_credito) || 0,
      fecha_emision: payload.fecha_emision,
      fecha_vencimiento: payload.fecha_vencimiento,
      moneda: payload.moneda || 'USD',
      tasa_cambio: Number(payload.tasa_cambio) || 1.0,
      subtotal: Number(payload.subtotal) || 0,
      base_imponible: Number(payload.base_imponible) || Number(payload.subtotal) || 0,
      monto_exento: Number(payload.monto_exento) || 0,
      iva_porcentaje: Number(payload.iva_porcentaje) || 16,
      iva_monto: Number(payload.iva_monto) || 0,
      total: Number(payload.total) || 0,
      saldo_pendiente: Number(payload.saldo_pendiente) || 0,
      estado: payload.estado || 'emitida',
      notas: payload.notas || null
    };
    if (isUUID(payload.proveedor_id)) compraRow.proveedor_id = payload.proveedor_id;
    if (isUUID(payload.comprobante_id)) compraRow.comprobante_id = payload.comprobante_id;

    const { error: cErr } = await supabase.from('facturas_compra').upsert(compraRow, { onConflict: 'id' });
    if (cErr) return false;

    if (rawItems.length > 0) {
      const itemsPayload = rawItems.map((it: any) => ({
        id: (it.id && isUUID(it.id)) ? it.id : crypto.randomUUID(),
        factura_id: targetId,
        producto_id: (it.producto_id && isUUID(it.producto_id)) ? it.producto_id : null,
        codigo: it.codigo || it.producto_codigo || '',
        descripcion: it.descripcion || '',
        cantidad: Number(it.cantidad) || 1,
        costo_unitario: Number(it.costo_unitario) || 0,
        subtotal: Number(it.subtotal) || 0,
        total: Number(it.total) || 0
      }));
      await supabase.from('facturas_compra_items').delete().eq('factura_id', targetId);
      await supabase.from('facturas_compra_items').insert(itemsPayload);
    }
    return true;
  }

  // Sanitización general de claves foráneas no UUID para evitar errores 22P02 / 23503 en Postgres
  const sanitized = { ...payload };
  delete sanitized.items;
  Object.keys(sanitized).forEach(k => {
    if (k.endsWith('_id') && sanitized[k] && !isUUID(sanitized[k])) {
      sanitized[k] = null;
    }
  });

  const { error } = await supabase.from(entity).upsert(sanitized, { onConflict: 'id' });
  if (error) {
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
