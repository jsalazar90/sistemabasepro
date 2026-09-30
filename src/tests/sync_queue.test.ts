import { describe, it, expect, beforeEach } from 'vitest';
import { 
  enqueueMutation, 
  getPendingQueue, 
  getPendingCount, 
  clearSyncQueue, 
  mergeWithPending, 
  SyncQueueItem 
} from '../services/syncQueueService';

describe('Motor de Sincronización Fuera de Línea (Outbox Pattern & Smart Merge)', () => {
  const testCompanyId = '00000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    await clearSyncQueue(testCompanyId);
  });

  it('debe encolar una mutación UPSERT correctamente', async () => {
    const payload = { id: 'inv-001', numero: 'FAC-0001', total: 150 };
    await enqueueMutation(testCompanyId, 'facturas_venta', 'UPSERT', payload);

    const pending = await getPendingQueue(testCompanyId);
    expect(pending.length).toBe(1);
    expect(pending[0].entity).toBe('facturas_venta');
    expect(pending[0].action).toBe('UPSERT');
    expect(pending[0].payload.id).toBe('inv-001');
    expect(pending[0].status).toBe('pending');
  });

  it('debe actualizar la mutación si se guarda el mismo registro varias veces fuera de línea', async () => {
    const payloadV1 = { id: 'inv-001', numero: 'FAC-0001', total: 100 };
    const payloadV2 = { id: 'inv-001', numero: 'FAC-0001', total: 250, notas: 'Ajuste de precio' };

    await enqueueMutation(testCompanyId, 'facturas_venta', 'UPSERT', payloadV1);
    await enqueueMutation(testCompanyId, 'facturas_venta', 'UPSERT', payloadV2);

    const pending = await getPendingQueue(testCompanyId);
    expect(pending.length).toBe(1);
    expect(pending[0].payload.total).toBe(250);
    expect(pending[0].payload.notas).toBe('Ajuste de precio');
  });

  it('debe calcular el conteo de elementos pendientes con precisión', async () => {
    await enqueueMutation(testCompanyId, 'facturas_venta', 'UPSERT', { id: 'inv-001' });
    await enqueueMutation(testCompanyId, 'productos', 'UPSERT', { id: 'prod-001' });
    await enqueueMutation(testCompanyId, 'contactos', 'DELETE', { id: 'cli-001' });

    const count = await getPendingCount(testCompanyId);
    expect(count).toBe(3);
  });

  it('Smart Merge: debe preservar un registro local pendiente y no permitir sobreescritura remota', () => {
    const remoteInvoices: any[] = [
      { id: 'inv-001', numero: 'FAC-0001', total: 100 },
      { id: 'inv-002', numero: 'FAC-0002', total: 200 }
    ];

    const pendingQueue: SyncQueueItem[] = [
      {
        id: 'q-1',
        empresaId: testCompanyId,
        entity: 'facturas_venta',
        action: 'UPSERT',
        payload: { id: 'inv-001', numero: 'FAC-0001', total: 175, notas: 'Editado offline' },
        createdAt: new Date().toISOString(),
        retries: 0,
        status: 'pending'
      }
    ];

    const merged = mergeWithPending(remoteInvoices, pendingQueue, 'facturas_venta');
    expect(merged.length).toBe(2);
    
    // El elemento inv-001 debe tener la versión local (total 175), no la remota (total 100)
    const inv1 = merged.find(i => i.id === 'inv-001');
    expect(inv1?.total).toBe(175);
    expect(inv1?.notas).toBe('Editado offline');
  });

  it('Smart Merge: debe agregar elementos creados exclusivamente fuera de línea', () => {
    const remoteProducts = [
      { id: 'prod-001', nombre: 'Arroz', stock_actual: 50 }
    ];

    const pendingQueue: SyncQueueItem[] = [
      {
        id: 'q-2',
        empresaId: testCompanyId,
        entity: 'productos',
        action: 'UPSERT',
        payload: { id: 'prod-999', nombre: 'Aceite Nuevo', stock_actual: 20 },
        createdAt: new Date().toISOString(),
        retries: 0,
        status: 'pending'
      }
    ];

    const merged = mergeWithPending(remoteProducts, pendingQueue, 'productos');
    expect(merged.length).toBe(2);
    expect(merged.some(p => p.id === 'prod-999')).toBe(true);
  });

  it('Smart Merge: debe excluir elementos que tienen un DELETE pendiente en la cola', () => {
    const remoteContacts = [
      { id: 'cli-001', name: 'Distribuidora Central' },
      { id: 'cli-002', name: 'Comercializadora Norte' }
    ];

    const pendingQueue: SyncQueueItem[] = [
      {
        id: 'q-3',
        empresaId: testCompanyId,
        entity: 'contactos',
        action: 'DELETE',
        payload: { id: 'cli-001' },
        createdAt: new Date().toISOString(),
        retries: 0,
        status: 'pending'
      }
    ];

    const merged = mergeWithPending(remoteContacts, pendingQueue, 'contactos');
    expect(merged.length).toBe(1);
    expect(merged[0].id).toBe('cli-002');
  });
});
