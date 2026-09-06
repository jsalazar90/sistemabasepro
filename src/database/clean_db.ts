import * as dotenv from 'dotenv';
dotenv.config();

import { supabase, isSupabaseConfigured } from '../lib/supabase';

async function cleanDatabase() {
  console.log('================================================================');
  console.log('       INICIANDO LIMPIEZA TOTAL DE LA BASE DE DATOS SUPABASE    ');
  console.log('================================================================\n');

  if (!isSupabaseConfigured || !supabase) {
    console.error('❌ Supabase no está configurado en .env');
    return;
  }

  // Orden de borrado respetando las claves foráneas (hijos primero, padres después)
  const tables = [
    'cobranzas',
    'pagos_realizados',
    'cuentas_cobrar_cxc',
    'cuentas_pagar_cxp',
    'facturas_venta',
    'movimientos_bancos',
    'bancos',
    'contactos',
    'lineas_comprobante',
    'comprobantes_diario',
    'cuentas_contables',
    'configuracion_contable',
    'plantillas_documentos',
    'auditoria_configuracion',
    'servicios',
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
