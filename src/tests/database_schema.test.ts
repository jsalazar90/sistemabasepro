import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Auditoría de Esquema SQL y RPCs (Fase 4)', () => {
  const schemaPath = path.resolve(__dirname, '../database/schema.sql');
  const rpcPath = path.resolve(__dirname, '../database/functions_rpc.sql');
  const resetPath = path.resolve(__dirname, '../database/reset_data.sql');
  const cleanDbPath = path.resolve(__dirname, '../database/clean_db.ts');

  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const rpcContent = fs.readFileSync(rpcPath, 'utf8');
  const resetContent = fs.readFileSync(resetPath, 'utf8');
  const cleanDbContent = fs.readFileSync(cleanDbPath, 'utf8');

  // Lista canónica de las 31 tablas requeridas por la aplicación
  const requiredTables = [
    'empresas',
    'usuarios',
    'usuario_empresas',
    'cuentas_contables',
    'comprobantes_diario',
    'lineas_comprobante',
    'configuracion_contable',
    'plantillas_documentos',
    'auditoria_configuracion',
    'auditoria_logs',
    'contactos',
    'bancos',
    'movimientos_bancos',
    'solicitudes_banco',
    'almacenes',
    'categorias_producto',
    'productos',
    'movimientos_inventario',
    'servicios',
    'facturas_venta',
    'facturas_venta_items',
    'cuentas_cobrar_cxc',
    'cobranzas',
    'facturas_compra',
    'facturas_compra_items',
    'cuentas_pagar_cxp',
    'pagos_realizados',
    'terminales_pos',
    'lotes_pos',
    'lotes_pos_transacciones',
    'categorias_activos',
    'activos_fijos',
    'depreciaciones'
  ];

  it('debe definir las 31 tablas relacionales en schema.sql', () => {
    for (const table of requiredTables) {
      const pattern = new RegExp(`CREATE\\s+TABLE\\s+(IF\\s+NOT\\s+EXISTS\\s+)?${table}\\s*\\(`, 'i');
      expect(pattern.test(schemaContent), `Falta la tabla [${table}] en schema.sql`).toBe(true);
    }
  });

  it('debe incluir las funciones RPC atómicas en schema.sql y functions_rpc.sql', () => {
    expect(schemaContent).toContain('FUNCTION obtener_siguiente_correlativo');
    expect(schemaContent).toContain('FUNCTION registrar_factura_venta_atomica');
    expect(rpcContent).toContain('FUNCTION obtener_siguiente_correlativo');
    expect(rpcContent).toContain('FUNCTION registrar_factura_venta_atomica');
  });

  it('debe incluir bloqueo FOR UPDATE en la función obtener_siguiente_correlativo', () => {
    expect(schemaContent).toContain('FOR UPDATE');
    expect(rpcContent).toContain('FOR UPDATE');
  });

  it('debe contener todas las tablas operativas en reset_data.sql', () => {
    for (const table of requiredTables) {
      expect(resetContent).toContain(table);
    }
  });

  it('debe contener todas las tablas operativas en clean_db.ts', () => {
    for (const table of requiredTables) {
      expect(cleanDbContent).toContain(`'${table}'`);
    }
  });

  it('debe desactivar RLS en todas las tablas para compatibilidad de cliente frontend', () => {
    for (const table of requiredTables) {
      const pattern = new RegExp(`ALTER\\s+TABLE\\s+(IF\\s+EXISTS\\s+)?${table}\\s+DISABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
      expect(pattern.test(schemaContent), `Falta desactivar RLS en [${table}]`).toBe(true);
    }
  });
});
