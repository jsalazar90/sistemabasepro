import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { 
  dbActualizarStockAtomico, 
  dbActualizarStockLoteAtomico,
  StockBatchItem
} from '../services/inventarioService';
import { setLocal, getLocal } from '../services/storageHelper';
import { clearSyncQueue, getPendingQueue } from '../services/syncQueueService';

describe('Control de Inventario Atómico y Prevención de Condiciones de Carrera (Fase 6)', () => {
  const testCompanyId = '00000000-0000-0000-0000-000000000001';
  const schemaPath = path.resolve(__dirname, '../database/schema.sql');
  const rpcPath = path.resolve(__dirname, '../database/functions_rpc.sql');

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const rpcContent = fs.readFileSync(rpcPath, 'utf8');

  beforeEach(async () => {
    await clearSyncQueue(testCompanyId);
    // Reset test products in local storage
    const initialProducts = [
      {
        id: 'prod-001',
        empresa_id: testCompanyId,
        codigo: 'ART-001',
        nombre: 'Harina de Maíz 1kg',
        stock_actual: 50,
        costo_unitario: 1.00,
        costo_promedio: 1.00,
        precio_venta: 1.50
      },
      {
        id: 'prod-002',
        empresa_id: testCompanyId,
        codigo: 'ART-002',
        nombre: 'Arroz Blanco 1kg',
        stock_actual: 10,
        costo_unitario: 1.20,
        costo_promedio: 1.20,
        precio_venta: 1.80
      }
    ];
    await setLocal(`app_products_${testCompanyId}`, initialProducts);
    await setLocal(`app_movimientos_inv_${testCompanyId}`, []);
  });

  describe('1. Verificación de Esquema SQL y Funciones RPC', () => {
    it('debe definir la función actualizar_stock_atomico en schema.sql y functions_rpc.sql', () => {
      expect(schemaContent).toContain('FUNCTION actualizar_stock_atomico');
      expect(rpcContent).toContain('FUNCTION actualizar_stock_atomico');
    });

    it('debe definir la función actualizar_stock_lote_atomico en schema.sql y functions_rpc.sql', () => {
      expect(schemaContent).toContain('FUNCTION actualizar_stock_lote_atomico');
      expect(rpcContent).toContain('FUNCTION actualizar_stock_lote_atomico');
    });

    it('debe incluir bloqueo pesimista FOR UPDATE para evitar condiciones de carrera', () => {
      expect(schemaContent).toContain('FROM productos');
      expect(schemaContent).toContain('FOR UPDATE');
      expect(rpcContent).toContain('FOR UPDATE');
    });

    it('debe implementar validación de existencias negativas y protección de sobreventa', () => {
      expect(schemaContent).toContain('stock_resultante < 0 AND NOT p_permitir_negativo');
      expect(rpcContent).toContain('stock_resultante < 0 AND NOT p_permitir_negativo');
    });

    it('debe recalcular el Costo Promedio Ponderado en compras', () => {
      expect(schemaContent).toContain('v_nuevo_costo_promedio := ((GREATEST(0, v_stock_anterior)');
      expect(rpcContent).toContain('v_nuevo_costo_promedio := ((GREATEST(0, v_stock_anterior)');
    });
  });

  describe('2. Operaciones Atómicas Individuales (Local-First Fallback)', () => {
    it('debe descontar stock correctamente en una venta', async () => {
      const result = await dbActualizarStockAtomico(
        testCompanyId,
        'prod-001',
        10,
        'venta',
        { referencia: 'FAC-0001', usuario: 'Vendedor 1' }
      );

      expect(result.success).toBe(true);
      expect(result.stock_anterior).toBe(50);
      expect(result.stock_resultante).toBe(40);

      const products = await getLocal<any[]>(`app_products_${testCompanyId}`, []);
      const prod = products?.find(p => p.id === 'prod-001');
      expect(prod?.stock_actual).toBe(40);
    });

    it('debe registrar el movimiento Kardex y encolar en la cola Outbox', async () => {
      await dbActualizarStockAtomico(
        testCompanyId,
        'prod-001',
        5,
        'venta',
        { referencia: 'FAC-0002' }
      );

      const movs = await getLocal<any[]>(`app_movimientos_inv_${testCompanyId}`, []);
      expect(movs?.length).toBe(1);
      expect(movs?.[0].producto_id).toBe('prod-001');
      expect(movs?.[0].cantidad).toBe(5);
      expect(movs?.[0].stock_anterior).toBe(50);
      expect(movs?.[0].stock_resultante).toBe(45);

      const queue = await getPendingQueue(testCompanyId);
      expect(queue.some(q => q.entity === 'productos')).toBe(true);
      expect(queue.some(q => q.entity === 'movimientos_inventario')).toBe(true);
    });

    it('debe rechazar ventas cuando el stock es insuficiente y permitirNegativo es false', async () => {
      const result = await dbActualizarStockAtomico(
        testCompanyId,
        'prod-002',
        15, // Stock actual es 10
        'venta',
        { permitirNegativo: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Stock insuficiente');

      // El stock no debe alterarse
      const products = await getLocal<any[]>(`app_products_${testCompanyId}`, []);
      const prod = products?.find(p => p.id === 'prod-002');
      expect(prod?.stock_actual).toBe(10);
    });

    it('debe permitir stock negativo solo cuando se especifica permitirNegativo: true', async () => {
      const result = await dbActualizarStockAtomico(
        testCompanyId,
        'prod-002',
        15,
        'venta',
        { permitirNegativo: true }
      );

      expect(result.success).toBe(true);
      expect(result.stock_resultante).toBe(-5);

      const products = await getLocal<any[]>(`app_products_${testCompanyId}`, []);
      const prod = products?.find(p => p.id === 'prod-002');
      expect(prod?.stock_actual).toBe(-5);
    });

    it('debe aumentar stock y recalcular Costo Promedio Ponderado en compras', async () => {
      // prod-001: 50 unidades a $1.00 = $50.00
      // Compramos 50 unidades a $2.00 = $100.00
      // Total 100 unidades por $150.00 => Nuevo costo promedio: $1.50
      const result = await dbActualizarStockAtomico(
        testCompanyId,
        'prod-001',
        50,
        'compra',
        { costoUnitario: 2.00, actualizarCosto: true }
      );

      expect(result.success).toBe(true);
      expect(result.stock_resultante).toBe(100);
      expect(result.costo_promedio).toBeCloseTo(1.50, 2);

      const products = await getLocal<any[]>(`app_products_${testCompanyId}`, []);
      const prod = products?.find(p => p.id === 'prod-001');
      expect(prod?.stock_actual).toBe(100);
      expect(prod?.costo_promedio).toBeCloseTo(1.50, 2);
      expect(prod?.costo_unitario).toBe(2.00);
    });
  });

  describe('3. Operaciones de Lote Atómico (Batch Inventory)', () => {
    it('debe procesar un lote completo de ventas exitosamente', async () => {
      const batch: StockBatchItem[] = [
        { producto_id: 'prod-001', cantidad: 10 },
        { producto_id: 'prod-002', cantidad: 5 }
      ];

      const res = await dbActualizarStockLoteAtomico(testCompanyId, batch, 'venta');
      expect(res.success).toBe(true);
      expect(res.items_procesados).toBe(2);

      const products = await getLocal<any[]>(`app_products_${testCompanyId}`, []);
      expect(products?.find(p => p.id === 'prod-001')?.stock_actual).toBe(40);
      expect(products?.find(p => p.id === 'prod-002')?.stock_actual).toBe(5);
    });

    it('debe rechazar el lote si cualquier artículo carece de existencias (All-or-Nothing)', async () => {
      const batch: StockBatchItem[] = [
        { producto_id: 'prod-001', cantidad: 10 },
        { producto_id: 'prod-002', cantidad: 999 } // Excede stock disponible (10)
      ];

      const res = await dbActualizarStockLoteAtomico(testCompanyId, batch, 'venta', { permitirNegativo: false });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Stock insuficiente');

      // Ningún producto debe haber sido alterado
      const products = await getLocal<any[]>(`app_products_${testCompanyId}`, []);
      expect(products?.find(p => p.id === 'prod-001')?.stock_actual).toBe(50);
      expect(products?.find(p => p.id === 'prod-002')?.stock_actual).toBe(10);
    });
  });
});
