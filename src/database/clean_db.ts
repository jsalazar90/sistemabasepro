import * as dotenv from 'dotenv';
dotenv.config();

import { supabase, isSupabaseConfigured } from '../lib/supabase';

async function cleanDatabase() {
  console.log('================================================================');
  console.log('       INICIANDO LIMPIEZA TOTAL DE LA BASE DE DATOS SUPABASE    ');
  console.log('       (31 Tablas Relacionales en Orden de Claves Foráneas)     ');
  console.log('================================================================\n');

  if (!isSupabaseConfigured || !supabase) {
    console.error('❌ Supabase no está configurado en .env');
    return;
  }

  // Orden de borrado respetando las claves foráneas (hijos primero, padres después)
  const tables = [
    // 1. Renglones y transacciones hijas
    'lotes_pos_transacciones',
    'lotes_pos',
    'terminales_pos',
    'facturas_venta_items',
    'facturas_compra_items',
    'movimientos_inventario',
    'depreciaciones',
    'lineas_comprobante',
    'auditoria_logs',
    'auditoria_configuracion',
    
    // 2. Documentos operacionales
    'cobranzas',
    'pagos_realizados',
    'cuentas_cobrar_cxc',
    'cuentas_pagar_cxp',
    'facturas_venta',
    'facturas_compra',
    'solicitudes_banco',
    'movimientos_bancos',
    'comprobantes_diario',
    
    // 3. Catálogos y maestros
    'productos',
    'categorias_producto',
    'almacenes',
    'servicios',
    'activos_fijos',
    'categorias_activos',
    'bancos',
    'contactos',
    'cuentas_contables',
    'plantillas_documentos',
    'configuracion_contable',
    
    // 4. Seguridad y Tenancy
    'usuario_empresas',
    'usuarios',
    'empresas'
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).delete().neq('id', '___non_existent_id___');
      if (error) {
        console.log(`⚠️ Tabla [${table}]: ${error.message}`);
      } else {
        console.log(`🧹 Tabla [${table}]: Vaciada correctamente.`);
      }
    } catch (err: any) {
      console.log(`⚠️ Tabla [${table}]: Error al limpiar: ${err.message || err}`);
    }
  }

  console.log('\n================================================================');
  console.log('🎉 BASE DE DATOS LIMPIA: Lista para iniciar nuevas operaciones.');
  console.log('================================================================\n');
}

cleanDatabase();
