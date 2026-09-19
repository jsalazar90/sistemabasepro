import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Company } from '../context/CompanyContext';
import { getTodayLocalDate } from '../utils/dateUtils';
import { formatCorrelativo } from '../utils/numberFormat';
import { get, set, del } from 'idb-keyval';

export const isUUID = (str?: string | null) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

// Helper IndexedDB storage (Reemplazando localStorage para soportar +5MB sin QuotaExceededError)
async function getLocal<T>(key: string, defaultVal: T): Promise<T> {
  try {
    const val = await get(key);
    return val !== undefined ? val : defaultVal;
  } catch {
    return defaultVal;
  }
}

async function setLocal<T>(key: string, val: T): Promise<void> {
  try {
    await set(key, val);
  } catch (e) {
    console.error('Error saving to IndexedDB:', e);
  }
}

async function delLocal(key: string): Promise<void> {
  try {
    await del(key);
  } catch {}
}

export const DEFAULT_LOCAL_COMPANY: Company = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Mi Nueva Empresa',
  taxId: 'J-00000000-0',
  nombre: 'Mi Nueva Empresa',
  rif: 'J-00000000-0',
  direccion: '',
  telefono: '',
  email: '',
  logo: '',
  monedaPrincipal: 'USD',
  monedaSecundaria: 'VES',
  tipoContribuyente: 'ordinario',
  tipoEmpresa: 'comercial',
  anoInicio: String(new Date().getFullYear()),
  workingYear: String(new Date().getFullYear()),
  habilitarPOS: true,
  habilitarVendedores: true,
  habilitarPedidos: true,
  habilitarTasaReferencial: true,
};

// ============================================================================
// 1. EMPRESAS
// ============================================================================

export async function dbFetchEmpresas(): Promise<Company[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      // Verificar si existe sesión autenticada antes de consultar Supabase (cumplimiento RLS)
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        const { data, error } = await supabase.from('empresas').select('*').order('created_at', { ascending: true });
        if (!error && data && data.length > 0) {
          const mapped = (data || []).map((row: any) => ({
            id: row.id,
            name: row.nombre,
            taxId: row.rif,
            nombre: row.nombre,
            rif: row.rif,
            anoInicio: row.ano_inicio || row.working_year || String(new Date().getFullYear()),
            workingYear: row.working_year || String(new Date().getFullYear()),
            direccion: row.direccion || '',
            telefono: row.telefono || '',
            email: row.email || '',
            logo: row.logo || '',
            monedaPrincipal: row.moneda_principal || 'USD',
            monedaSecundaria: row.moneda_secundaria || 'VES',
            tipoContribuyente: row.tipo_contribuyente || 'ordinario',
            tipoEmpresa: row.tipo_empresa || 'comercial',
            habilitarPOS: row.habilitar_pos ?? true,
            habilitarVendedores: row.habilitar_vendedores ?? true,
            habilitarPedidos: row.habilitar_pedidos ?? true,
            habilitarTasaReferencial: row.habilitar_tasa_referencial ?? false,
          }));
          await setLocal('erp_local_empresas', mapped);
          return mapped;
        }
        if (!error && (!data || data.length === 0)) {
          await dbSaveEmpresa(DEFAULT_LOCAL_COMPANY);
          return [DEFAULT_LOCAL_COMPANY];
        }
      }
    } catch (err: any) {
      console.warn('Error al consultar empresas de Supabase, usando local:', err);
    }
  }

  // Fallback localStorage
  const local = await getLocal<Company[]>('erp_local_empresas', [DEFAULT_LOCAL_COMPANY]);
  if (!local || local.length === 0) {
    await setLocal('erp_local_empresas', [DEFAULT_LOCAL_COMPANY]);
    return [DEFAULT_LOCAL_COMPANY];
  }
  return local;
}

export async function dbSaveEmpresa(empresa: any): Promise<{ success: boolean; error?: string }> {
  const compId = (empresa.id && isUUID(empresa.id)) ? empresa.id : crypto.randomUUID();
  const localList = await getLocal<Company[]>('erp_local_empresas', [DEFAULT_LOCAL_COMPANY]);
  const formatted: Company = {
    id: compId,
    name: empresa.nombre || empresa.name || 'Empresa Local',
    taxId: empresa.rif || empresa.taxId || 'J-00000000-0',
    nombre: empresa.nombre || empresa.name || 'Empresa Local',
    rif: empresa.rif || empresa.taxId || 'J-00000000-0',
    direccion: empresa.direccion || '',
    telefono: empresa.telefono || '',
    email: empresa.email || '',
    logo: empresa.logo || '',
    monedaPrincipal: empresa.monedaPrincipal || 'USD',
    monedaSecundaria: empresa.monedaSecundaria || 'VES',
    tipoContribuyente: empresa.tipoContribuyente || 'ordinario',
    tipoEmpresa: empresa.tipoEmpresa || 'comercial',
    anoInicio: empresa.anoInicio || empresa.workingYear || String(new Date().getFullYear()),
    workingYear: empresa.workingYear || empresa.anoInicio || String(new Date().getFullYear()),
    habilitarPOS: empresa.habilitarPOS ?? true,
    habilitarVendedores: empresa.habilitarVendedores ?? true,
    habilitarPedidos: empresa.habilitarPedidos ?? true,
    habilitarTasaReferencial: empresa.habilitarTasaReferencial ?? false,
  };

  const existingIdx = localList.findIndex(c => c.id === compId);
  let updatedList: Company[];
  if (existingIdx >= 0) {
    updatedList = [...localList];
    updatedList[existingIdx] = { ...updatedList[existingIdx], ...formatted };
  } else {
    updatedList = [...localList, formatted];
  }
  await setLocal('erp_local_empresas', updatedList);

  if (isSupabaseConfigured && supabase) {
    try {
      // Si no hay sesión de Supabase Auth activa, no intentar escribir en Supabase (evita 401)
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        return { success: true };
      }

      const payload = {
        id: compId,
        nombre: formatted.nombre,
        rif: formatted.rif,
        direccion: formatted.direccion,
        telefono: formatted.telefono,
        email: formatted.email,
        logo: formatted.logo,
        moneda_principal: formatted.monedaPrincipal,
        moneda_secundaria: formatted.monedaSecundaria,
        tipo_contribuyente: formatted.tipoContribuyente,
        tipo_empresa: formatted.tipoEmpresa,
        habilitar_pos: formatted.habilitarPOS,
        habilitar_vendedores: formatted.habilitarVendedores,
        habilitar_pedidos: formatted.habilitarPedidos,
        habilitar_tasa_referencial: formatted.habilitarTasaReferencial,
        updated_at: new Date().toISOString()
      };
      await supabase.from('empresas').upsert(payload);

      // --- ASIGNACIÓN AUTOMÁTICA DEL MASTER A LA EMPRESA ---
      // Aseguramos que jhoansg@gmail.com quede explícitamente asignado a la data de la empresa
      const masterEmails = ['jhoansg@gmail.com'];
      const { data: masterUsers } = await supabase.from('usuarios').select('id, email').in('email', masterEmails);
      
      if (masterUsers && masterUsers.length > 0) {
        for (const mu of masterUsers) {
          try {
            await supabase.from('usuario_empresas').upsert({
              usuario_id: mu.id,
              empresa_id: compId,
              role: 'Master',
              activo: true,
              permissions: { view: true, create: true, delete: true }
            });
          } catch (e) {
             console.warn(`No se pudo enlazar automáticamente al usuario ${mu.email} con la empresa ${compId}`, e);
          }
        }
      }
    } catch (e) {
      console.warn("Fallo al guardar empresa en Supabase:", e);
    }
  }
  return { success: true };
}

export async function dbDeleteEmpresa(id: string): Promise<{ success: boolean; error?: string }> {
  const localList = await getLocal<Company[]>('erp_local_empresas', [DEFAULT_LOCAL_COMPANY]);
  const filtered = localList.filter(c => c.id !== id);
  await setLocal('erp_local_empresas', filtered.length > 0 ? filtered : [DEFAULT_LOCAL_COMPANY]);

  // Limpiar cachés locales de esta empresa
  const localKeys = [
    `erp_local_contactos_${id}`,
    `erp_local_cuentas_${id}`,
    `erp_local_bancos_${id}`,
    `erp_local_cxc_${id}`,
    `erp_local_cxp_${id}`,
    `erp_local_cobranzas_${id}`,
    `erp_local_pagos_${id}`,
    `erp_local_comprobantes_${id}`,
    `app_products_${id}`,
    `app_categorias_producto_${id}`,
    `app_almacenes_${id}`,
    `app_movimientos_inv_${id}`,
    `app_facturas_venta_${id}`,
    `app_facturas_compra_${id}`,
    `app_terminales_pos_${id}`,
    `app_lotes_pos_${id}`,
    `app_activos_fijos_${id}`,
    `app_categorias_activos_${id}`,
    `app_depreciaciones_${id}`,
    `app_servicios_${id}`,
    `erp_local_solicitudes_banco_${id}`,
    `app_config_contable_${id}`
  ];
  for (const k of localKeys) {
    try { await delLocal(k); } catch {}
  }

  if (isSupabaseConfigured && supabase && isUUID(id)) {
    try {
      // 1. Limpieza de sub-items que no tienen empresa_id directa (referencian al padre)
      // Lotes POS -> Transacciones
      try {
        const { data: lotes } = await supabase.from('lotes_pos').select('id').eq('empresa_id', id);
        if (lotes && lotes.length > 0) {
          const ids = lotes.map(l => l.id);
          await supabase.from('lotes_pos_transacciones').delete().in('lote_id', ids);
        }
      } catch {}

      // Facturas Venta -> Items
      try {
        const { data: facs } = await supabase.from('facturas_venta').select('id').eq('empresa_id', id);
        if (facs && facs.length > 0) {
          const ids = facs.map(f => f.id);
          await supabase.from('facturas_venta_items').delete().in('factura_id', ids);
        }
      } catch {}

      // Facturas Compra -> Items
      try {
        const { data: compras } = await supabase.from('facturas_compra').select('id').eq('empresa_id', id);
        if (compras && compras.length > 0) {
          const ids = compras.map(c => c.id);
          await supabase.from('facturas_compra_items').delete().in('factura_id', ids);
        }
      } catch {}

      // Comprobantes Diario -> Líneas
      try {
        const { data: comps } = await supabase.from('comprobantes_diario').select('id').eq('empresa_id', id);
        if (comps && comps.length > 0) {
          const ids = comps.map(c => c.id);
          await supabase.from('lineas_comprobante').delete().in('comprobante_id', ids);
        }
      } catch {}

      // 2. Romper posible autoreferencia en cuentas contables antes de borrar
      try {
        await supabase.from('cuentas_contables').update({ cuenta_padre_id: null }).eq('empresa_id', id);
      } catch {}

      // 3. Limpieza de tablas directas con empresa_id (en orden de dependencias)
      const directTables = [
        'cobranzas',
        'pagos_realizados',
        'cuentas_cobrar_cxc',
        'cuentas_pagar_cxp',
        'comprobantes_retencion',
        'facturas_venta',
        'facturas_compra',
        'movimientos_inventario',
        'depreciaciones',
        'activos_fijos',
        'categorias_activos',
        'productos',
        'categorias_producto',
        'almacenes',
        'movimientos_bancos',
        'solicitudes_banco',
        'bancos',
        'contactos',
        'terminales_pos',
        'lotes_pos',
        'comprobantes_diario',
        'cuentas_contables',
        'configuracion_contable',
        'pedidos',
        'servicios',
        'usuario_empresas'
      ];

      for (const tbl of directTables) {
        try {
          await supabase.from(tbl).delete().eq('empresa_id', id);
        } catch {}
      }

      // 4. Finalmente borrar la empresa
      const { error: delError } = await supabase.from('empresas').delete().eq('id', id);
      if (delError) {
        console.warn("Aviso al eliminar empresa en Supabase:", delError);
        return { success: false, error: delError.message };
      }
    } catch (err: any) {
      console.error("Excepción al eliminar empresa en Supabase:", err);
      return { success: false, error: err?.message || 'Error al eliminar empresa en Supabase' };
    }
  }
  return { success: true };
}

// ============================================================================
// PLAN DE CUENTAS NIIF COMPLETO PARA BALANCES Y AUDITORÍAS (59+ CUENTAS)
// Cuadrado exacto: Activos = Pasivos ($1,149,850) + Patrimonio ($625,000) = $1,774,850
// Incluye sobregiro bancario negativo y cuentas de valuación de activos para paginación multi-hoja
// ============================================================================
export const SAMPLE_FULL_BALANCE_CUENTAS = [
  // 1. ACTIVOS
  { id: "1", codigo: "1", nombre: "ACTIVO", nivel: 1, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1", codigo: "1.1", nombre: "Activo Corriente", nivel: 2, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  
  // 1.1.01 Disponible / Efectivo
  { id: "1.1.01", codigo: "1.1.01", nombre: "Efectivo y Equivalentes de Efectivo", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.01.001", codigo: "1.1.01.001", nombre: "Caja Chica Administración", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.002", codigo: "1.1.01.002", nombre: "Caja Chica Ventas & Tiendas", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.003", codigo: "1.1.01.003", nombre: "Caja Bóveda Principal Moneda Extranjera", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.004", codigo: "1.1.01.004", nombre: "Banesco Banco Universal (Cuenta Cte)", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.005", codigo: "1.1.01.005", nombre: "Banco Mercantil (Sobregiro Operativo NIIF)", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.006", codigo: "1.1.01.006", nombre: "BBVA Banco Provincial (Cuenta Cte)", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.007", codigo: "1.1.01.007", nombre: "Banco Nacional de Crédito BNC", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.008", codigo: "1.1.01.008", nombre: "JPMorgan Chase Bank (USD Operaciones)", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.009", codigo: "1.1.01.009", nombre: "Fondos de Inversión Líquida a Corto Plazo", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 1.1.02 Inversiones Temporales
  { id: "1.1.02", codigo: "1.1.02", nombre: "Inversiones Financieras a Corto Plazo", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.02.001", codigo: "1.1.02.001", nombre: "Certificados de Depósito a Plazo Fijo", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.02.002", codigo: "1.1.02.002", nombre: "Bonos Soberanos e Inversiones Negociables", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 1.1.03 Exigible / Cuentas por Cobrar
  { id: "1.1.03", codigo: "1.1.03", nombre: "Deudores Comerciales y Cuentas por Cobrar", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.03.001", codigo: "1.1.03.001", nombre: "Clientes Nacionales al Día", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.03.002", codigo: "1.1.03.002", nombre: "Clientes en Gestión de Cobranza Morosa", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.03.003", codigo: "1.1.03.003", nombre: "Provisión para Cuentas Incobrables", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.03.004", codigo: "1.1.03.004", nombre: "Cuentas por Cobrar a Empresas Filiales", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.03.005", codigo: "1.1.03.005", nombre: "Cuentas por Cobrar a Empleados y Préstamos", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.03.006", codigo: "1.1.03.006", nombre: "Anticipos a Proveedores y Contratistas", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.03.007", codigo: "1.1.03.007", nombre: "Reclamaciones a Compañías de Seguros", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 1.1.04 Inventarios
  { id: "1.1.04", codigo: "1.1.04", nombre: "Inventarios y Mercancías", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.04.001", codigo: "1.1.04.001", nombre: "Inventario de Mercancía para la Venta", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.04.002", codigo: "1.1.04.002", nombre: "Mercancías en Tránsito e Importación", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.04.003", codigo: "1.1.04.003", nombre: "Inventario de Repuestos y Accesorios", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.04.004", codigo: "1.1.04.004", nombre: "Inventario de Materiales de Embalaje", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 1.1.05 Otros Activos Corrientes
  { id: "1.1.05", codigo: "1.1.05", nombre: "Otros Activos Corrientes y Pagos Anticipados", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.05.001", codigo: "1.1.05.001", nombre: "Crédito Fiscal IVA por Compensar", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.05.002", codigo: "1.1.05.002", nombre: "Retenciones de IVA Soportadas en Ventas", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.05.003", codigo: "1.1.05.003", nombre: "Anticipos de ISLR Declarados", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.05.004", codigo: "1.1.05.004", nombre: "Seguros de Flota Pagados por Anticipado", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.05.005", codigo: "1.1.05.005", nombre: "Alquileres de Sedes Pagados por Anticipado", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 1.2 ACTIVO NO CORRIENTE
  { id: "1.2", codigo: "1.2", nombre: "Activo No Corriente", nivel: 2, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.2.01", codigo: "1.2.01", nombre: "Propiedad, Planta y Equipos (Fijos)", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.2.01.001", codigo: "1.2.01.001", nombre: "Terrenos Industriales y Urbanos", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.002", codigo: "1.2.01.002", nombre: "Edificaciones Comerciales y Galpón Principal", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.003", codigo: "1.2.01.003", nombre: "Depreciación Acumulada de Edificaciones", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.004", codigo: "1.2.01.004", nombre: "Maquinarias y Equipos Industriales", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.005", codigo: "1.2.01.005", nombre: "Depreciación Acumulada de Maquinarias", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.006", codigo: "1.2.01.006", nombre: "Vehículos y Camiones de Carga Pesada", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.007", codigo: "1.2.01.007", nombre: "Depreciación Acumulada de Vehículos", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.008", codigo: "1.2.01.008", nombre: "Equipos de Computación, Redes y Servidores", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.009", codigo: "1.2.01.009", nombre: "Depreciación Acumulada Equipos de Computación", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.010", codigo: "1.2.01.010", nombre: "Mobiliario, Muebles y Enseres de Oficina", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.011", codigo: "1.2.01.011", nombre: "Depreciación Acumulada de Mobiliario", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 1.2.02 Intangibles y Diferidos
  { id: "1.2.02", codigo: "1.2.02", nombre: "Activos Intangibles y Diferidos", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.2.02.001", codigo: "1.2.02.001", nombre: "Licencias de Software y Sistemas ERP", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.02.002", codigo: "1.2.02.002", nombre: "Amortización Acumulada de Software", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.02.003", codigo: "1.2.02.003", nombre: "Marcas Registradas y Patentes", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.02.004", codigo: "1.2.02.004", nombre: "Depósitos en Garantía a Largo Plazo", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 2. PASIVOS
  { id: "2", codigo: "2", nombre: "PASIVO", nivel: 1, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1", codigo: "2.1", nombre: "Pasivo Corriente", nivel: 2, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },

  // 2.1.01 Comerciales
  { id: "2.1.01", codigo: "2.1.01", nombre: "Cuentas y Obligaciones Comerciales por Pagar", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1.01.001", codigo: "2.1.01.001", nombre: "Proveedores Nacionales Comerciales", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.01.002", codigo: "2.1.01.002", nombre: "Proveedores del Exterior e Importaciones", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.01.003", codigo: "2.1.01.003", nombre: "Contratistas y Servicios Especializados por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.01.004", codigo: "2.1.01.004", nombre: "Facturas Pendientes de Recibir / Provisiones", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 2.1.02 Laborales
  { id: "2.1.02", codigo: "2.1.02", nombre: "Obligaciones Laborales y con el Personal", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1.02.001", codigo: "2.1.02.001", nombre: "Sueldos y Salarios por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.02.002", codigo: "2.1.02.002", nombre: "Vacaciones y Bono Vacacional Acumulado", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.02.003", codigo: "2.1.02.003", nombre: "Utilidades y Bonificaciones de Fin de Año", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.02.004", codigo: "2.1.02.004", nombre: "Prestaciones Sociales Acumuladas Corrientes", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.02.005", codigo: "2.1.02.005", nombre: "Aportes Patronales IVSS / FAOV / INCES", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 2.1.03 Fiscales
  { id: "2.1.03", codigo: "2.1.03", nombre: "Tributos e Impuestos por Pagar", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1.03.001", codigo: "2.1.03.001", nombre: "Débito Fiscal IVA por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.03.002", codigo: "2.1.03.002", nombre: "Retenciones de IVA por Enterar al Fisco", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.03.003", codigo: "2.1.03.003", nombre: "Retenciones de ISLR por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.03.004", codigo: "2.1.03.004", nombre: "Impuesto Sobre la Renta (ISLR) por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.03.005", codigo: "2.1.03.005", nombre: "Impuestos Municipales / Patente de Comercio", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 2.1.04 Financieros y Anticipos
  { id: "2.1.04", codigo: "2.1.04", nombre: "Préstamos y Créditos a Corto Plazo", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1.04.001", codigo: "2.1.04.001", nombre: "Pagarés y Créditos Bancarios a Corto Plazo", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.04.002", codigo: "2.1.04.002", nombre: "Porción Circulante de Deuda a Largo Plazo", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.04.003", codigo: "2.1.04.003", nombre: "Intereses Devengados por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.04.004", codigo: "2.1.04.004", nombre: "Anticipos Recibidos de Clientes", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 2.2 PASIVO NO CORRIENTE
  { id: "2.2", codigo: "2.2", nombre: "Pasivo No Corriente", nivel: 2, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.2.01", codigo: "2.2.01", nombre: "Deudas y Obligaciones a Largo Plazo", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.2.01.001", codigo: "2.2.01.001", nombre: "Préstamos Bancarios Comerciales a Largo Plazo", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.2.01.002", codigo: "2.2.01.002", nombre: "Hipotecas por Pagar sobre Inmueble Sede", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.2.01.003", codigo: "2.2.01.003", nombre: "Bonos Financieros y Títulos de Deuda", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.2.01.004", codigo: "2.2.01.004", nombre: "Provisión para Indemnizaciones Laborales a Largo Plazo", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 3. PATRIMONIO NETO
  { id: "3", codigo: "3", nombre: "PATRIMONIO", nivel: 1, tipo: "Grupo", grupo: "Patrimonio", naturaleza: "Acreedora" },
  { id: "3.1", codigo: "3.1", nombre: "Patrimonio Neto y Reservas", nivel: 2, tipo: "Grupo", grupo: "Patrimonio", naturaleza: "Acreedora" },
  { id: "3.1.01.001", codigo: "3.1.01.001", nombre: "Capital Social Suscrito y Pagado", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "3.1.01.002", codigo: "3.1.01.002", nombre: "Aportes de Accionistas para Futuros Aumentos", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "3.1.02.001", codigo: "3.1.02.001", nombre: "Reserva Legal (10% Código de Comercio)", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "3.1.02.002", codigo: "3.1.02.002", nombre: "Reserva Estatutaria y Facultativa", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "3.1.03.001", codigo: "3.1.03.001", nombre: "Utilidades Retenidas de Ejercicios Anteriores", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "3.1.03.002", codigo: "3.1.03.002", nombre: "Superávit por Revaluación de Activos Fijos", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "3.1.03.003", codigo: "3.1.03.003", nombre: "Resultado del Ejercicio Actual (Utilidad Neta)", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 4. INGRESOS
  { id: "4", codigo: "4", nombre: "INGRESOS", nivel: 1, tipo: "Grupo", grupo: "Ingresos", naturaleza: "Acreedora" },
  { id: "4.1", codigo: "4.1", nombre: "Ingresos por Ventas y Servicios", nivel: 2, tipo: "Grupo", grupo: "Ingresos", naturaleza: "Acreedora" },
  { id: "4.1.01.001", codigo: "4.1.01.001", nombre: "Ventas de Mercancías Nacionales", nivel: 4, tipo: "Movimiento", grupo: "Ingresos", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "4.1.01.002", codigo: "4.1.01.002", nombre: "Ganancia en Diferencial Cambiario", nivel: 4, tipo: "Movimiento", grupo: "Ingresos", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 5. GASTOS Y COSTOS
  { id: "5", codigo: "5", nombre: "GASTOS Y COSTOS", nivel: 1, tipo: "Grupo", grupo: "Gastos", naturaleza: "Deudora" },
  { id: "5.1", codigo: "5.1", nombre: "Gastos Operativos y de Administración", nivel: 2, tipo: "Grupo", grupo: "Gastos", naturaleza: "Deudora" },
  { id: "5.1.01.001", codigo: "5.1.01.001", nombre: "Sueldos, Salarios y Beneficios al Personal", nivel: 4, tipo: "Movimiento", grupo: "Gastos", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "5.1.01.002", codigo: "5.1.01.002", nombre: "Servicios Básicos (Electricidad, Agua, Internet)", nivel: 4, tipo: "Movimiento", grupo: "Gastos", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "5.1.01.003", codigo: "5.1.01.003", nombre: "Pérdida en Diferencial Cambiario", nivel: 4, tipo: "Movimiento", grupo: "Gastos", naturaleza: "Deudora", saldo: 0, saldoActual: 0 }
];

const DEFAULT_CUENTAS: any[] = [];

const DEFAULT_BANCOS: any[] = [];

// ============================================================================
// 9. CONTACTOS (CLIENTES, PROVEEDORES, EMPLEADOS, ACCIONISTAS, INTERCOMPAÑÍAS, ALIADOS)
// ============================================================================

export const DEFAULT_LOCAL_CONTACTS: any[] = [];

export async function dbFetchContactos(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase.from('contactos').select('*').eq('empresa_id', empresaId).order('name', { ascending: true });
      if (!error && data) {
        const localList = await getLocal<any[]>(`erp_local_contactos_${cid}`, []);
        return (data || []).map((row: any) => {
          const localItem = localList.find((l: any) => l.id === row.id || (l.taxId && l.taxId === row.tax_id));
          return {
            id: row.id,
            name: row.name,
            taxId: row.tax_id,
            type: row.type || 'customer',
            email: row.email || '',
            phone: row.phone || '',
            address: row.address || '',
            tipoContribuyente: row.tipo_contribuyente || 'ordinario',
            saldo: Number(row.saldo) || 0,
            saldoCxp: Number(row.saldo_cxp) || 0,
            debitAccount: row.debit_account || localItem?.debitAccount || '',
            creditAccount: row.credit_account || localItem?.creditAccount || '',
            expenseAccount: row.expense_account || localItem?.expenseAccount || '',
            employeeType: row.employee_type || undefined,
            comisionPorcentaje: Number(row.comision_porcentaje) || 0,
            personaContacto: row.persona_contacto || '',
            bancoPago: row.banco_pago || '',
            pagoMovil: row.pago_movil || '',
            activo: row.activo ?? true
          };
        });
      }
    } catch (e) {
      console.warn('Error dbFetchContactos desde Supabase:', e);
    }
  }
  return await getLocal<any[]>(`erp_local_contactos_${cid}`, DEFAULT_LOCAL_CONTACTS);
}

export async function dbSaveContacto(contacto: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_contactos_${cid}`, DEFAULT_LOCAL_CONTACTS);
  const contactId = (contacto.id && isUUID(contacto.id)) ? contacto.id : crypto.randomUUID();
  const formatted = {
    id: contactId,
    name: contacto.name,
    taxId: contacto.taxId || contacto.rif || 'J-00000000-0',
    type: contacto.type || 'customer',
    email: contacto.email || '',
    phone: contacto.phone || '',
    address: contacto.address || '',
    tipoContribuyente: contacto.tipoContribuyente || 'ordinario',
    saldo: Number(contacto.saldo) || 0,
    saldoCxp: Number(contacto.saldoCxp) || 0,
    debitAccount: contacto.debitAccount || '',
    creditAccount: contacto.creditAccount || '',
    expenseAccount: contacto.expenseAccount || '',
    employeeType: contacto.employeeType || undefined,
    comisionPorcentaje: Number(contacto.comisionPorcentaje) || 0,
    personaContacto: contacto.personaContacto || '',
    bancoPago: contacto.bancoPago || '',
    pagoMovil: contacto.pagoMovil || '',
    activo: contacto.activo ?? true
  };
  const idx = list.findIndex(c => c.id === formatted.id || (contacto.id && c.id === contacto.id));
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...formatted };
  } else {
    list.push(formatted);
  }
  await setLocal(`erp_local_contactos_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const payload: any = {
        id: formatted.id,
        empresa_id: empresaId,
        name: formatted.name,
        tax_id: formatted.taxId,
        type: formatted.type,
        email: formatted.email,
        phone: formatted.phone,
        address: formatted.address,
        tipo_contribuyente: formatted.tipoContribuyente,
        saldo: formatted.saldo,
        saldo_cxp: formatted.saldoCxp,
        debit_account: isUUID(formatted.debitAccount) ? formatted.debitAccount : null,
        credit_account: isUUID(formatted.creditAccount) ? formatted.creditAccount : null,
        expense_account: isUUID(formatted.expenseAccount) ? formatted.expenseAccount : null,
        employee_type: formatted.employeeType || null,
        comision_porcentaje: formatted.comisionPorcentaje,
        persona_contacto: formatted.personaContacto || null,
        banco_pago: formatted.bancoPago || null,
        pago_movil: formatted.pagoMovil || null,
        activo: formatted.activo
      };
      const { error } = await supabase.from('contactos').upsert(payload, { onConflict: 'id' });
      if (error && (error.code === '23505' || (error as any).status === 409)) {
        await supabase.from('contactos').update(payload).eq('id', formatted.id);
      } else if (error) {
        console.warn('Advertencia al guardar contacto en Supabase:', error.message);
      }
    } catch (e) {
      console.warn('Error de red al guardar contacto en Supabase:', e);
    }
  }
  return true;
}

export async function dbDeleteContacto(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_contactos_${cid}`, DEFAULT_LOCAL_CONTACTS);
  await setLocal(`erp_local_contactos_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase && isUUID(id)) {
    try {
      await supabase.from('contactos').delete().eq('id', id);
    } catch {}
  }
  return true;
}

export async function dbClearContactos(empresaId: string, filterType?: 'customer' | 'supplier'): Promise<boolean> {
  const cid = empresaId || 'default';
  const localList = await getLocal<any[]>(`erp_local_contactos_${cid}`, []);
  let updatedList: any[] = [];
  if (filterType === 'customer') {
    updatedList = localList.filter(c => c.type !== 'customer');
  } else if (filterType === 'supplier') {
    updatedList = localList.filter(c => c.type !== 'supplier' && c.type !== 'both');
  } else {
    updatedList = [];
  }
  await setLocal(`erp_local_contactos_${cid}`, updatedList);

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      let query = supabase.from('contactos').delete().eq('empresa_id', empresaId);
      if (filterType === 'customer') {
        query = query.eq('type', 'customer');
      } else if (filterType === 'supplier') {
        query = query.in('type', ['supplier', 'both']);
      }
      await query;
    } catch (e) {
      console.error('Error dbClearContactos:', e);
    }
  }
  return true;
}

// ============================================================================
// 10. USUARIOS Y PERMISOS RBAC
// ============================================================================

export async function dbGetMasterClaveOperaciones(): Promise<string> {
  // 1. Intentar desde almacenamiento local persistente
  try {
    const directKey = await getLocal<string>('erp_master_clave_operaciones', '');
    if (directKey && directKey.trim()) return directKey.trim();
  } catch {}

  if (typeof localStorage !== 'undefined') {
    const lsKey = localStorage.getItem('sistema_master_clave_operaciones');
    if (lsKey && lsKey.trim()) return lsKey.trim();
  }

  // 2. Intentar desde usuarios locales con rol Master
  try {
    const localUsers = await getLocal<any[]>('erp_local_usuarios', []);
    const master = (localUsers || []).find((u: any) => u.role === 'Master' && (u.claveOperaciones || u.clave_operaciones));
    if (master) {
      const key = (master.claveOperaciones || master.clave_operaciones || '').trim();
      if (key) return key;
    }
  } catch {}

  // 3. Fallback universal por defecto
  return '19072828';
}

export async function dbSaveMasterClaveOperaciones(newClave: string): Promise<boolean> {
  const cleanKey = (newClave || '').trim();
  if (!cleanKey) return false;

  try {
    // 1. Guardar en IndexedDB y localStorage
    await setLocal('erp_master_clave_operaciones', cleanKey);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sistema_master_clave_operaciones', cleanKey);
    }

    // 2. Actualizar en la lista local de usuarios
    const localUsers = await getLocal<any[]>('erp_local_usuarios', []);
    const updated = (localUsers || []).map((u: any) => {
      if (u.role === 'Master') {
        return { ...u, claveOperaciones: cleanKey, clave_operaciones: cleanKey };
      }
      return u;
    });
    await setLocal('erp_local_usuarios', updated);

    // 3. Intentar persistir en Supabase si la columna clave_operaciones existe
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('usuarios').update({ clave_operaciones: cleanKey }).eq('role', 'Master');
      } catch (err) {
        console.warn('Nota: usuarios.clave_operaciones aún no existe en Supabase, guardado en almacenamiento local redundante.', err);
      }
    }
    return true;
  } catch (e) {
    console.error('Error dbSaveMasterClaveOperaciones:', e);
    return false;
  }
}

export async function dbFetchUsuarios(): Promise<any[]> {
  const local = await getLocal<any[]>('erp_local_usuarios', []);
  const localMap = new Map<string, any>((local || []).map(u => [u.email?.toLowerCase(), u]));
  const globalMasterClave = await dbGetMasterClaveOperaciones();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('usuarios').select('*').order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        const mappedUsers = (data || []).map((u: any) => {
          const localUser = localMap.get(u.email?.toLowerCase());
          const claveOp = u.clave_operaciones || localUser?.claveOperaciones || localUser?.clave_operaciones || (u.role === 'Master' ? globalMasterClave : undefined);
          return {
            id: u.id,
            email: u.email,
            name: u.nombre || u.email.split('@')[0],
            // ⚠️ IMPORTANTE DE SEGURIDAD: Nunca devolvemos el password_hash remoto al frontend
            password: localUser?.password || null, 
            claveOperaciones: claveOp,
            role: u.role || 'Operador',
            activo: u.activo !== false,
            companyRoles: localUser?.companyRoles || {},
            companyConfigs: localUser?.companyConfigs || {}
          };
        });
        await setLocal('erp_local_usuarios', mappedUsers);
        return mappedUsers;
      }
    } catch {}
  }

  const cleanLocal = (local || []).filter((u: any) => u.email?.toLowerCase() !== 'jefe@halleyerp.com');
  if (cleanLocal.length !== (local || []).length) {
    await setLocal('erp_local_usuarios', cleanLocal);
  }

  if (!cleanLocal || cleanLocal.length === 0) {
    const defaultMaster = {
      id: "u-master-jhoan",
      email: "jhoansg@gmail.com",
      name: "Jhoan SG",
      role: "Master",
      activo: true,
      companyRoles: { "*": "Master" },
      companyConfigs: {}
    };
    await setLocal('erp_local_usuarios', [defaultMaster]);
    return [defaultMaster];
  }
  return cleanLocal;
}

export async function dbSaveUsuario(usuario: any): Promise<boolean> {
  const list = await getLocal<any[]>('erp_local_usuarios', []);
  const formatted = {
    id: (usuario.id && isUUID(usuario.id)) ? usuario.id : crypto.randomUUID(),
    email: usuario.email.trim().toLowerCase(),
    name: usuario.name || usuario.nombre || usuario.email.split('@')[0],
    password: usuario.password || usuario.password_hash || '123456',
    claveOperaciones: usuario.claveOperaciones || usuario.clave_operaciones || (usuario.role === 'Master' ? await dbGetMasterClaveOperaciones() : undefined),
    role: usuario.role || 'Operador',
    activo: usuario.activo !== false
  };

  // Si es Master y trae claveOperaciones, guardar también como clave global
  if (formatted.role === 'Master' && formatted.claveOperaciones) {
    try {
      await setLocal('erp_master_clave_operaciones', formatted.claveOperaciones);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sistema_master_clave_operaciones', formatted.claveOperaciones);
      }
    } catch {}
  }

  const idx = list.findIndex(u => u.id === formatted.id || u.email === formatted.email);
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  await setLocal('erp_local_usuarios', list);

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Intentar upsert incluyendo clave_operaciones
      const payloadWithClave = {
        id: formatted.id,
        email: formatted.email,
        nombre: formatted.name,
        password_hash: formatted.password,
        clave_operaciones: formatted.claveOperaciones,
        role: formatted.role,
        activo: formatted.activo
      };
      const { error } = await supabase.from('usuarios').upsert(payloadWithClave);
      if (error) {
        // 2. Si falló (ej. columna clave_operaciones no existe en Supabase), reintentar sin clave_operaciones
        // para asegurar que el resto de los datos (password, nombre, role, activo) sí se guarden
        const payloadWithoutClave = {
          id: formatted.id,
          email: formatted.email,
          nombre: formatted.name,
          password_hash: formatted.password,
          role: formatted.role,
          activo: formatted.activo
        };
        await supabase.from('usuarios').upsert(payloadWithoutClave);
      }
    } catch (err) {
      console.warn('Error al sincronizar usuario con Supabase:', err);
    }
  }
  return true;
}

export async function dbDeleteUsuario(idOrEmail: string): Promise<boolean> {
  const list = await getLocal<any[]>('erp_local_usuarios', []);
  const filtered = list.filter(u => u.id !== idOrEmail && u.email !== idOrEmail);
  await setLocal('erp_local_usuarios', filtered);

  if (isSupabaseConfigured && supabase) {
    try {
      if (idOrEmail.includes('@')) {
        await supabase.from('usuarios').delete().eq('email', idOrEmail.toLowerCase());
      } else {
        await supabase.from('usuarios').delete().eq('id', idOrEmail);
      }
    } catch {}
  }
  return true;
}

export async function dbVerifyMasterClaveOperaciones(claveInput: string): Promise<{ success: boolean; masterUser?: any }> {
  if (!claveInput) return { success: false };
  const trimmed = String(claveInput).trim();
  if (!trimmed) return { success: false };

  // 1. Clave de emergencia / super-fallback
  if (trimmed === '19072828') {
    return { success: true, masterUser: { name: 'Administrador Master', role: 'Master' } };
  }

  // 2. Clave maestra directa (IndexedDB y localStorage)
  try {
    const directMasterKey = await dbGetMasterClaveOperaciones();
    if (directMasterKey && directMasterKey === trimmed) {
      return { success: true, masterUser: { name: 'Administrador Master', role: 'Master' } };
    }
  } catch {}

  // 3. Usuarios Master en Supabase o en caché local
  try {
    const allUsers = await dbFetchUsuarios();
    const localUsers = await getLocal<any[]>('erp_local_usuarios', []);
    const combined = [...(allUsers || []), ...(localUsers || [])];

    const masterUsers = combined.filter(u => u.role === 'Master' && u.activo !== false);

    const matched = masterUsers.find(u => 
      (u.claveOperaciones && String(u.claveOperaciones).trim() === trimmed) ||
      (u.clave_operaciones && String(u.clave_operaciones).trim() === trimmed) ||
      (u.password && String(u.password).trim() === trimmed) ||
      (u.password_hash && String(u.password_hash).trim() === trimmed)
    );

    if (matched) {
      return { success: true, masterUser: matched };
    }
  } catch (e) {
    console.error('Error verifying master operations key:', e);
  }

  return { success: false };
}

export async function dbFetchUsuarioEmpresas(usuarioId?: string, empresaId?: string): Promise<any[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('usuario_empresas').select('*');
      if (usuarioId) query = query.eq('usuario_id', usuarioId);
      if (empresaId) query = query.eq('empresa_id', empresaId);
      const { data, error } = await query;
      if (!error && data) return data;
    } catch {}
  }
  return [];
}

export async function dbSaveUsuarioEmpresa(record: any): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      const uId = record.usuario_id || record.usuarioId;
      const eId = record.empresa_id || record.empresaId;
      if (!uId || !eId) return true;

      const payload = {
        id: (record.id && isUUID(record.id)) ? record.id : crypto.randomUUID(),
        usuario_id: uId,
        empresa_id: eId,
        role: record.role || 'Operador',
        vendedor_id: isUUID(record.vendedor_id || record.vendedorId) ? (record.vendedor_id || record.vendedorId) : null,
        vendedor_nombre: record.vendedor_nombre || record.vendedorNombre || null,
        permissions: record.permissions || {},
        activo: record.activo !== false
      };
      await supabase.from('usuario_empresas').upsert(payload, { onConflict: 'usuario_id,empresa_id' });
    } catch {}
  }
  return true;
}

export async function dbDeleteUsuarioEmpresa(usuarioId: string, empresaId: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('usuario_empresas').delete().eq('usuario_id', usuarioId).eq('empresa_id', empresaId);
    } catch {}
  }
  return true;
}

// ============================================================================
// 11. CUENTAS CONTABLES NIIF
// ============================================================================

export async function dbFetchCuentasContables(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase.from('cuentas_contables').select('*').eq('empresa_id', empresaId).order('codigo', { ascending: true });
      if (!error && data) {
        const mapped = (data || []).map((row: any) => ({
          id: row.id,
          codigo: row.codigo,
          nombre: row.nombre,
          tipo: row.tipo || 'Movimiento',
          naturaleza: row.naturaleza || 'Deudora',
          grupo: row.grupo || 'Activo',
          nivel: Number(row.nivel) || 1,
          cuentaPadreId: row.cuenta_padre_id,
          saldoActual: Number(row.saldo_actual) || 0,
          activo: row.activo ?? true
        }));
        await setLocal(`erp_local_cuentas_${cid}`, mapped);
        return mapped;
      }
    } catch {}
  }
  const local = await getLocal<any[]>(`erp_local_cuentas_${cid}`, []);
  return (local || []).map(c => ({ ...c, saldo: 0, saldoActual: 0 }));
}

export async function dbResetToFullDemoCuentas(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  await setLocal(`erp_local_cuentas_${cid}`, []);
  return [];
}

export async function dbSaveCuentaContable(cuenta: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_cuentas_${cid}`, []);
  const existingIdx = list.findIndex(c => (cuenta.id && c.id === cuenta.id) || c.codigo === cuenta.codigo);
  const accountId = (cuenta.id && isUUID(cuenta.id))
    ? cuenta.id
    : (existingIdx >= 0 && isUUID(list[existingIdx].id) ? list[existingIdx].id : crypto.randomUUID());

  const formatted = {
    id: accountId,
    codigo: cuenta.codigo,
    nombre: cuenta.nombre,
    tipo: cuenta.tipo || 'Movimiento',
    naturaleza: cuenta.naturaleza || 'Deudora',
    grupo: cuenta.grupo || (cuenta.codigo.startsWith('1') ? 'Activo' : cuenta.codigo.startsWith('2') ? 'Pasivo' : cuenta.codigo.startsWith('3') ? 'Patrimonio' : cuenta.codigo.startsWith('4') ? 'Ingresos' : 'Gastos'),
    nivel: Number(cuenta.nivel) || (cuenta.codigo.split('.').length),
    cuentaPadreId: (cuenta.cuentaPadreId && isUUID(cuenta.cuentaPadreId)) ? cuenta.cuentaPadreId : null,
    saldoActual: Number(cuenta.saldoActual || cuenta.saldo) || 0,
    activo: cuenta.activo ?? true
  };
  if (existingIdx >= 0) list[existingIdx] = { ...list[existingIdx], ...formatted };
  else list.push(formatted);
  await setLocal(`erp_local_cuentas_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const payload: any = {
        id: formatted.id,
        empresa_id: empresaId,
        codigo: formatted.codigo,
        nombre: formatted.nombre,
        tipo: formatted.tipo || 'Movimiento',
        naturaleza: formatted.naturaleza || 'Deudora',
        grupo: formatted.grupo || 'Activo',
        nivel: formatted.nivel || 1,
        cuenta_padre_id: formatted.cuentaPadreId,
        saldo_actual: formatted.saldoActual,
        activo: formatted.activo
      };
      const { error: upsertErr } = await supabase.from('cuentas_contables').upsert(payload, { onConflict: 'empresa_id,codigo' });
      if (upsertErr && payload.cuenta_padre_id) {
        payload.cuenta_padre_id = null;
        await supabase.from('cuentas_contables').upsert(payload, { onConflict: 'empresa_id,codigo' });
      }
    } catch (e) {
      console.warn('Error dbSaveCuentaContable Supabase:', e);
    }
  }
  return true;
}

export async function dbDeleteCuentaContable(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_cuentas_${cid}`, []);
  await setLocal(`erp_local_cuentas_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase && isUUID(id)) {
    try {
      await supabase.from('cuentas_contables').delete().eq('id', id);
    } catch {}
  }
  return true;
}

export async function dbClearCuentasContables(empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  await setLocal(`erp_local_cuentas_${cid}`, []);

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { error } = await supabase.from('cuentas_contables').delete().eq('empresa_id', empresaId);
      if (error) console.error('Error dbClearCuentasContables Supabase:', error);
    } catch (e) {
      console.error('Error dbClearCuentasContables:', e);
    }
  }
  return true;
}

// ============================================================================
// 12. BANCOS Y TESORERÍA
// ============================================================================

export async function dbFetchBancos(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase.from('bancos').select('*').eq('empresa_id', empresaId).order('banco', { ascending: true });
      if (!error && data) {
        const localList = await getLocal<any[]>(`erp_local_bancos_${cid}`, []);
        return (data || []).map((row: any) => {
          const localItem = localList.find((l: any) => l.id === row.id);
          return {
            id: row.id,
            banco: row.banco,
            numeroCuenta: row.numero_cuenta,
            cuenta: row.numero_cuenta,
            numero_cuenta: row.numero_cuenta,
            tipo: row.tipo || 'Corriente',
            moneda: row.moneda || 'Bolivares',
            saldo: Number(row.saldo) || 0,
            tasa: Number(row.tasa) || 1.0,
            cuentaContableId: row.cuenta_contable_id || localItem?.cuentaContableId || '1.1.3',
            cuenta_contable_id: row.cuenta_contable_id || localItem?.cuenta_contable_id || '1.1.3',
            activo: row.activo ?? true
          };
        });
      }
    } catch (e) {
      console.warn('Error dbFetchBancos desde Supabase:', e);
    }
  }
  const local = await getLocal<any[]>(`erp_local_bancos_${cid}`, DEFAULT_BANCOS);
  if (!local || local.length === 0) {
    await setLocal(`erp_local_bancos_${cid}`, DEFAULT_BANCOS);
    return DEFAULT_BANCOS;
  }
  return local;
}

export async function dbSaveBanco(banco: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_bancos_${cid}`, DEFAULT_BANCOS);
  const bancoId = (banco.id && isUUID(banco.id)) ? banco.id : crypto.randomUUID();
  const formatted = {
    id: bancoId,
    banco: banco.banco,
    numeroCuenta: banco.cuenta || banco.numeroCuenta || banco.numero_cuenta || '0000-0000-0000-0000',
    cuenta: banco.cuenta || banco.numeroCuenta || banco.numero_cuenta || '0000-0000-0000-0000',
    numero_cuenta: banco.cuenta || banco.numeroCuenta || banco.numero_cuenta || '0000-0000-0000-0000',
    tipo: banco.tipo || 'Corriente',
    moneda: banco.moneda || 'USD',
    saldo: Number(banco.saldo) || 0,
    tasa: Number(banco.tasa) || 1.0,
    cuentaContableId: banco.cuenta_contable_id || banco.cuentaContableId || '1.1.3',
    cuenta_contable_id: banco.cuenta_contable_id || banco.cuentaContableId || '1.1.3',
    activo: banco.activo ?? true
  };
  const idx = list.findIndex(b => b.id === formatted.id || (banco.id && b.id === banco.id));
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  await setLocal(`erp_local_bancos_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const payload: any = {
        id: formatted.id,
        empresa_id: empresaId,
        banco: formatted.banco,
        numero_cuenta: formatted.numeroCuenta,
        moneda: formatted.moneda,
        saldo: formatted.saldo,
        tasa: formatted.tasa,
        cuenta_contable_id: isUUID(formatted.cuentaContableId) ? formatted.cuentaContableId : null,
        activo: formatted.activo
      };
      await supabase.from('bancos').upsert(payload, { onConflict: 'id' });
    } catch (e) {
      console.warn('Error al guardar banco en Supabase:', e);
    }
  }
  return true;
}

export async function dbDeleteBanco(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_bancos_${cid}`, DEFAULT_BANCOS);
  await setLocal(`erp_local_bancos_${cid}`, list.filter(b => b.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      if (isUUID(id)) { await supabase.from('bancos').delete().eq('id', id); }
    } catch {}
  }
  return true;
}

// ============================================================================
// 13. MOVIMIENTOS BANCARIOS
// ============================================================================

export async function dbFetchMovimientosBancos(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data, error } = await supabase.from('movimientos_bancos').select('*').eq('empresa_id', empresaId).order('fecha', { ascending: true });
      if (!error && data) {
        return (data || []).map((row: any) => ({
          id: row.id,
          bancoId: row.banco_id,
          banco_id: row.banco_id,
          fecha: row.fecha,
          ref: row.ref || '',
          descripcion: row.descripcion,
          tipo: row.tipo,
          monto: Number(row.monto) || 0,
          tasa: Number(row.tasa) || 1.0,
          comprobanteId: row.comprobante_id || '',
          comprobante_id: row.comprobante_id || '',
          estado: row.estado || 'conciliado',
          notas: row.notas || '',
          created_at: row.created_at,
          createdAt: row.created_at
        }));
      }
    } catch {}
  }
  return await getLocal<any[]>(`erp_local_movimientos_bancos_${cid}`, []);
}

export async function dbSaveMovimientoBanco(mov: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_movimientos_bancos_${cid}`, []);
  const validId = isUUID(mov.id) ? mov.id : crypto.randomUUID();
  const validBancoId = isUUID(mov.banco_id || mov.bancoId) ? (mov.banco_id || mov.bancoId) : null;
  const validComprobanteId = isUUID(mov.comprobante_id || mov.comprobanteId) ? (mov.comprobante_id || mov.comprobanteId) : null;

  const formatted = {
    id: validId,
    bancoId: mov.banco_id || mov.bancoId,
    banco_id: mov.banco_id || mov.bancoId,
    fecha: mov.fecha || getTodayLocalDate(),
    ref: mov.ref || '',
    descripcion: mov.descripcion || '',
    tipo: mov.tipo || 'ingreso',
    monto: Number(mov.monto) || 0,
    montoBs: mov.montoBs !== undefined && mov.montoBs !== null && mov.montoBs !== '' ? Number(mov.montoBs) : undefined,
    tasa: Number(mov.tasa) || 1.0,
    comprobanteId: validComprobanteId,
    comprobante_id: validComprobanteId,
    estado: mov.estado || 'conciliado',
    notas: mov.notas || ''
  };
  const idx = list.findIndex(m => m.id === formatted.id || (mov.id && m.id === mov.id));
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  await setLocal(`erp_local_movimientos_bancos_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      let finalBancoId = validBancoId;
      if (!finalBancoId) {
        const { data: bList } = await supabase.from('bancos').select('id').eq('empresa_id', empresaId).limit(1);
        if (bList && bList.length > 0) {
          finalBancoId = bList[0].id;
        }
      }

      if (!finalBancoId) {
        // Si no hay banco registrado en Supabase, no podemos enviar el registro para evitar violación not-null en banco_id
        return true;
      }

      const payload: any = {
        id: validId,
        empresa_id: empresaId,
        banco_id: finalBancoId,
        fecha: formatted.fecha,
        ref: formatted.ref,
        descripcion: formatted.descripcion,
        tipo: formatted.tipo,
        monto: formatted.monto,
        tasa: formatted.tasa,
        estado: formatted.estado,
        notas: formatted.notas
      };
      if (validComprobanteId) {
        try {
          const { data: compExists } = await supabase.from('comprobantes_diario').select('id').eq('id', validComprobanteId).limit(1);
          if (compExists && compExists.length > 0) {
            payload.comprobante_id = validComprobanteId;
          }
        } catch {}
      }

      let { error } = await supabase.from('movimientos_bancos').upsert(payload, { onConflict: 'id' });
      if (error && error.code === '23503' && payload.comprobante_id) {
        delete payload.comprobante_id;
        const retry = await supabase.from('movimientos_bancos').upsert(payload, { onConflict: 'id' });
        error = retry.error;
      }
      if (error && (error.code === '23505' || (error as any).status === 409)) {
        const updateRes = await supabase.from('movimientos_bancos').update(payload).eq('id', validId);
        error = updateRes.error;
      }
      if (error) console.error('Error dbSaveMovimientoBanco Supabase:', error);
    } catch (err) {
      console.error('Exception dbSaveMovimientoBanco Supabase:', err);
    }
  }
  return true;
}

export async function dbDeleteMovimientoBanco(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_movimientos_bancos_${cid}`, []);
  await setLocal(`erp_local_movimientos_bancos_${cid}`, list.filter(m => m.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      if (isUUID(id)) { await supabase.from('movimientos_bancos').delete().eq('id', id); }
    } catch {}
  }
  return true;
}

// ============================================================================
// 13. CONFIGURACIÓN CONTABLE, SERIES Y CORRELATIVOS, RÉGIMEN FISCAL
// ============================================================================

export async function dbFetchConfiguracionContable(empresaId: string): Promise<any | null> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data, error } = await supabase
        .from('configuracion_contable')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          empresaId: data.empresa_id,
          cuentaInventario: data.cuenta_inventario || '',
          cuentaCostoVentas: data.cuenta_costo_ventas || '',
          cuentaVentas: data.cuenta_ventas || '',
          cuentaGastos: data.cuenta_gastos || '',
          cuentaAnticipoRecibido: data.cuenta_anticipo_recibido || '',
          cuentaAnticipoOtorgado: data.cuenta_anticipo_otorgado || '',
          cuentaCxc: data.cuenta_cxc || '',
          cuentaCxp: data.cuenta_cxp || '',
          cuentaDebitoFiscal: data.cuenta_debito_fiscal || '',
          cuentaCreditoFiscal: data.cuenta_credito_fiscal || '',
          cuentaIvaRetenidoVentas: data.cuenta_iva_retenido_ventas || '',
          cuentaIvaRetenidoCompras: data.cuenta_iva_retenido_compras || '',
          cuentaIslrRetenidoVentas: data.cuenta_islr_retenido_ventas || '',
          cuentaIslrRetenidoCompras: data.cuenta_islr_retenido_compras || '',
          cuentaGananciaDiferencialCambiario: data.cuenta_ganancia_diferencial || '',
          cuentaPerdidaDiferencialCambiario: data.cuenta_perdida_diferencial || '',
          cuentaUtilidadAnteriores: data.cuenta_utilidad_anteriores || '',
          mesCierre: data.mes_cierre || '12',
          workingYear: data.working_year || String(new Date().getFullYear()),
          iva: Number(data.iva ?? 16),
          igtf: Number(data.igtf ?? 3),
          retencionIva: Number(data.retencion_iva ?? 75),
          retencionIslr: Number(data.retencion_islr ?? 2),
          prefijoFactura: data.prefijo_factura ?? '',
          correlativoFactura: formatCorrelativo(data.correlativo_factura, 6),
          prefijoCotizacion: data.prefijo_cotizacion ?? '',
          correlativoCotizacion: formatCorrelativo(data.correlativo_cotizacion, 6),
          prefijoNotaEntrega: data.prefijo_nota_entrega ?? '',
          correlativoNotaEntrega: formatCorrelativo(data.correlativo_nota_entrega, 6),
          prefijoRecibo: data.prefijo_recibo ?? 'REC-',
          correlativoRecibo: formatCorrelativo(data.correlativo_recibo, 6),
          diasVencimientoDefault: Number(data.dias_vencimiento_default ?? 15),
          notasDefault: data.notas_default || '',
          comisionMode: data.comision_mode || 'emitidas',
          activeServiceTemplate: data.active_service_template || 'Estándar',
          activeInventoryTemplate: data.active_inventory_template || 'Estándar',
          usaMaquinaFiscal: data.usa_maquina_fiscal ?? false,
          marcaMaquinaFiscal: data.marca_maquina_fiscal || 'bixolon'
        };
      }
    } catch {}
  }
  return await getLocal<any | null>(`erp_local_config_${cid}`, {
    empresaId: cid,
    cuentaVentas: '',
    cuentaGastos: '',
    cuentaCxc: '',
    cuentaCxp: '',
    cuentaDebitoFiscal: '',
    cuentaCreditoFiscal: '',
    cuentaGananciaDiferencialCambiario: '',
    cuentaPerdidaDiferencialCambiario: '',
    mesCierre: '12',
    workingYear: String(new Date().getFullYear()),
    iva: 16,
    igtf: 3,
    retencionIva: 75,
    retencionIslr: 2,
    prefijoFactura: '',
    correlativoFactura: '000001',
    prefijoCotizacion: '',
    correlativoCotizacion: '000001',
    prefijoNotaEntrega: '',
    correlativoNotaEntrega: '000001',
    prefijoRecibo: 'REC-',
    correlativoRecibo: '000001',
    diasVencimientoDefault: 15,
    notasDefault: '',
    comisionMode: 'emitidas'
  });
}

export async function dbSaveConfiguracionContable(config: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const existing = await getLocal<any>(`erp_local_config_${cid}`, {});
  const merged = { ...existing, ...config, empresaId: cid };
  await setLocal(`erp_local_config_${cid}`, merged);

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const cuentasList = await getLocal<any[]>(`erp_local_cuentas_${cid}`, []);
      const toUUIDOrNull = (val: any) => {
        if (!val) return null;
        if (isUUID(val)) return val;
        const found = cuentasList.find(c => c.codigo === String(val) || c.id === String(val));
        if (found && isUUID(found.id)) return found.id;
        return null;
      };

      const configId = (config.id && isUUID(config.id))
        ? config.id
        : (existing?.id && isUUID(existing.id) ? existing.id : crypto.randomUUID());

      const payload = {
        id: configId,
        empresa_id: empresaId,
        cuenta_inventario: toUUIDOrNull(config.cuentaInventario),
        cuenta_costo_ventas: toUUIDOrNull(config.cuentaCostoVentas),
        cuenta_ventas: toUUIDOrNull(config.cuentaVentas),
        cuenta_gastos: toUUIDOrNull(config.cuentaGastos),
        cuenta_anticipo_recibido: toUUIDOrNull(config.cuentaAnticipoRecibido),
        cuenta_anticipo_otorgado: toUUIDOrNull(config.cuentaAnticipoOtorgado),
        cuenta_cxc: toUUIDOrNull(config.cuentaCxc),
        cuenta_cxp: toUUIDOrNull(config.cuentaCxp),
        cuenta_debito_fiscal: toUUIDOrNull(config.cuentaDebitoFiscal),
        cuenta_credito_fiscal: toUUIDOrNull(config.cuentaCreditoFiscal),
        cuenta_iva_retenido_ventas: toUUIDOrNull(config.cuentaIvaRetenidoVentas),
        cuenta_iva_retenido_compras: toUUIDOrNull(config.cuentaIvaRetenidoCompras),
        cuenta_islr_retenido_ventas: toUUIDOrNull(config.cuentaIslrRetenidoVentas),
        cuenta_islr_retenido_compras: toUUIDOrNull(config.cuentaIslrRetenidoCompras),
        cuenta_ganancia_diferencial: toUUIDOrNull(config.cuentaGananciaDiferencialCambiario || config.cuentaGananciaDiferencial),
        cuenta_perdida_diferencial: toUUIDOrNull(config.cuentaPerdidaDiferencialCambiario || config.cuentaPerdidaDiferencial),
        cuenta_utilidad_anteriores: toUUIDOrNull(config.cuentaUtilidadAnteriores),
        mes_cierre: String(config.mesCierre || '12'),
        working_year: String(config.workingYear || new Date().getFullYear()),
        iva: config.iva !== undefined ? Number(config.iva) : 16,
        igtf: config.igtf !== undefined ? Number(config.igtf) : 3,
        retencion_iva: config.retencionIva !== undefined ? Number(config.retencionIva) : 75,
        retencion_islr: config.retencionIslr !== undefined ? Number(config.retencionIslr) : 2,
        prefijo_factura: config.prefijoFactura ?? '',
        correlativo_factura: config.correlativoFactura ? String(config.correlativoFactura).trim() : '000001',
        prefijo_cotizacion: config.prefijoCotizacion ?? '',
        correlativo_cotizacion: config.correlativoCotizacion ? String(config.correlativoCotizacion).trim() : '000001',
        prefijo_nota_entrega: config.prefijoNotaEntrega ?? '',
        correlativo_nota_entrega: config.correlativoNotaEntrega ? String(config.correlativoNotaEntrega).trim() : '000001',
        prefijo_recibo: config.prefijoRecibo ?? 'REC-',
        correlativo_recibo: config.correlativoRecibo ? String(config.correlativoRecibo).trim() : '000001',
        dias_vencimiento_default: config.diasVencimientoDefault !== undefined ? Number(config.diasVencimientoDefault) : 15,
        notas_default: config.notasDefault ?? '',
        comision_mode: config.comisionMode ?? 'emitidas',
        active_service_template: config.activeServiceTemplate ?? 'Estándar',
        active_inventory_template: config.activeInventoryTemplate ?? 'Estándar',
        usa_maquina_fiscal: config.usaMaquinaFiscal !== undefined ? Boolean(config.usaMaquinaFiscal) : false,
        marca_maquina_fiscal: config.marcaMaquinaFiscal ?? 'bixolon',
        puerto_maquina_fiscal: config.puertoMaquinaFiscal ?? '',
        formato_impresion: config.formatoImpresion ?? 'estandar',
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('configuracion_contable').upsert(payload, { onConflict: 'empresa_id' });
      if (error) console.error('Error dbSaveConfiguracionContable Supabase:', error);
    } catch (e) {
      console.error('Error dbSaveConfiguracionContable:', e);
    }
  }
  return true;
}

// ============================================================================
// 14. CUENTAS POR COBRAR (CXC)
// ============================================================================

export const DEFAULT_CXC: any[] = [];

export const DEFAULT_MOVIMIENTOS_BANCOS: any[] = [];

export async function dbResetAllTestData(empresaId?: string): Promise<void> {
  const cid = empresaId || 'default';
  await setLocal(`erp_local_cxc_${cid}`, DEFAULT_CXC);
  await setLocal(`erp_local_cxp_${cid}`, DEFAULT_CXP);
  await setLocal(`erp_local_cobranzas_${cid}`, DEFAULT_COBRANZAS);
  await setLocal(`erp_local_pagos_${cid}`, DEFAULT_PAGOS_REALIZADOS);
  await setLocal(`erp_local_contactos_${cid}`, DEFAULT_LOCAL_CONTACTS);
  await setLocal(`erp_local_bancos_${cid}`, DEFAULT_BANCOS);
  await setLocal(`erp_local_movimientos_bancos_${cid}`, DEFAULT_MOVIMIENTOS_BANCOS);
}

export async function dbFetchCxc(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      let { data, error } = await supabase
        .from('cuentas_cobrar_cxc')
        .select(`
          *,
          cliente:contactos(id, name, tax_id, phone, address)
        `)
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false });

      if (error) {
        await new Promise(r => setTimeout(r, 400));
        const retry = await supabase
          .from('cuentas_cobrar_cxc')
          .select(`
            *,
            cliente:contactos(id, name, tax_id, phone, address)
          `)
          .eq('empresa_id', empresaId)
          .order('fecha', { ascending: false });
        data = retry.data;
        error = retry.error;
      }

      if (!error && data) {
        const mappedFromDb = (data || []).map((row: any) => {
          const desc = row.descripcion || '';
          const matchFac = desc.match(/(?:Factura(?:\s+de\s+Venta)?|Fact\.?)\s+([A-Za-z0-9\-_]+)/i);
          const facturaNumero = matchFac ? matchFac[1] : (row.factura_id || '');

          const matchClient = desc.match(/Cliente:\s*([^[–\-]+)(?:\[([A-Za-z0-9\-]+)\])?/i);
          const clientNameFromDesc = matchClient ? matchClient[1].trim() : '';
          const clientRifFromDesc = matchClient && matchClient[2] ? matchClient[2].trim() : '';

          const clienteNombre = row.cliente?.name || clientNameFromDesc || '';
          const clienteRif = row.cliente?.tax_id || clientRifFromDesc || '';

          return {
            id: row.id,
            factura_id: facturaNumero || row.factura_id || '',
            factura: facturaNumero || row.factura_id || '',
            numero: facturaNumero || row.factura_id || '',
            cliente_id: row.cliente_id || '',
            cliente: clienteNombre,
            cliente_nombre: clienteNombre,
            cliente_rif: clienteRif,
            taxId: clienteRif,
            categoria: row.categoria || 'clientes',
            fecha: row.fecha,
            fecha_emision: row.fecha,
            vencimiento: row.vencimiento,
            fecha_vencimiento: row.vencimiento,
            descripcion: row.descripcion,
            tipo: row.tipo || 'factura',
            total: Number(row.total) || 0,
            monto: Number(row.total) || 0,
            monto_total: Number(row.total) || 0,
            saldo: Number(row.saldo) || 0,
            saldo_pendiente: Number(row.saldo) || 0,
            moneda: row.moneda || 'USD',
            tasa: Number(row.tasa) || 1.0,
            tasa_cambio: Number(row.tasa) || 1.0,
            estado: (Number(row.saldo) || 0) <= 0.009 ? 'cobrada' : 'pendiente'
          };
        });

        // Sincronizar con local para no perder datos en offline
        await setLocal(`erp_local_cxc_${cid}`, mappedFromDb);
        return mappedFromDb;
      }
    } catch (err) {
      console.error("Error dbFetchCxc Supabase:", err);
    }
  }
  const local = await getLocal<any[]>(`erp_local_cxc_${cid}`, DEFAULT_CXC);
  if (!local || local.length === 0) {
    await setLocal(`erp_local_cxc_${cid}`, DEFAULT_CXC);
    return DEFAULT_CXC;
  }
  return local;
}

export async function dbSaveCxc(cxc: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_cxc_${cid}`, []);
  const validId = isUUID(cxc.id) ? cxc.id : crypto.randomUUID();
  const validFacturaId = isUUID(cxc.factura_id) ? cxc.factura_id : (isUUID(cxc.factura_db_id) ? cxc.factura_db_id : null);
  const validClienteId = isUUID(cxc.cliente_id) ? cxc.cliente_id : null;

  const facNumero = cxc.factura || cxc.numero || cxc.factura_id || '';
  const clienteNom = cxc.cliente_nombre || cxc.cliente || cxc.clienteNombre || '';
  const clienteRif = cxc.cliente_rif || cxc.taxId || '';
  const desc = cxc.descripcion || (facNumero ? `Factura de Venta ${facNumero}${clienteNom ? ` - Cliente: ${clienteNom}` : ''}${clienteRif ? ` [${clienteRif}]` : ''}` : 'Cuenta por Cobrar');

  const formatted = {
    ...cxc,
    id: validId,
    factura_id: facNumero || validFacturaId || '',
    factura: facNumero,
    numero: facNumero,
    cliente_id: validClienteId || cxc.cliente_id || '',
    cliente: clienteNom,
    cliente_nombre: clienteNom,
    cliente_rif: clienteRif,
    taxId: clienteRif,
    categoria: cxc.categoria || 'clientes',
    fecha: cxc.fecha || cxc.fecha_emision || cxc.fechaEmision || getTodayLocalDate(),
    fecha_emision: cxc.fecha_emision || cxc.fecha || getTodayLocalDate(),
    vencimiento: cxc.vencimiento || cxc.fecha_vencimiento || cxc.fechaVencimiento || cxc.fecha || getTodayLocalDate(),
    descripcion: desc,
    tipo: cxc.tipo || 'factura',
    total: Number(cxc.total !== undefined ? cxc.total : cxc.monto_total) || 0,
    monto_total: Number(cxc.monto_total !== undefined ? cxc.monto_total : cxc.total) || 0,
    saldo: Number(cxc.saldo !== undefined ? cxc.saldo : cxc.saldo_pendiente !== undefined ? cxc.saldo_pendiente : cxc.total) || 0,
    saldo_pendiente: Number(cxc.saldo_pendiente !== undefined ? cxc.saldo_pendiente : cxc.saldo !== undefined ? cxc.saldo : cxc.total) || 0,
    moneda: cxc.moneda || 'USD',
    tasa: Number(cxc.tasa || cxc.tasa_cambio) || 1.0,
    tasa_cambio: Number(cxc.tasa_cambio || cxc.tasa) || 1.0,
    estado: (Number(cxc.saldo !== undefined ? cxc.saldo : cxc.total) || 0) <= 0.009 ? 'cobrada' : 'pendiente',
    metadata: cxc.metadata || {}
  };
  const idx = list.findIndex(c => c.id === formatted.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  await setLocal(`erp_local_cxc_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const payload: any = {
        id: validId,
        empresa_id: empresaId,
        categoria: formatted.categoria,
        fecha: formatted.fecha,
        vencimiento: formatted.vencimiento,
        descripcion: formatted.descripcion,
        tipo: formatted.tipo,
        total: formatted.total,
        saldo: formatted.saldo,
        moneda: formatted.moneda,
        tasa: formatted.tasa
      };
      if (validClienteId) payload.cliente_id = validClienteId;
      if (validFacturaId) payload.factura_id = validFacturaId;

      let { error } = await supabase.from('cuentas_cobrar_cxc').upsert(payload, { onConflict: 'id' });
      if (error && error.code === '23503') {
        // En caso de conflicto de clave foránea (cliente o factura no confirmada aún), guardar sin FK para no perder el registro
        console.warn('Foreign key violation in dbSaveCxc, reintentando con fallback seguro:', error.message);
        const fallbackPayload = { ...payload };
        delete fallbackPayload.factura_id;
        delete fallbackPayload.cliente_id;
        const retryRes = await supabase.from('cuentas_cobrar_cxc').upsert(fallbackPayload, { onConflict: 'id' });
        error = retryRes.error;
        if (retryRes.error) console.error('Error in retry dbSaveCxc Supabase:', retryRes.error);
        else console.log('Guardado exitoso de CxC en Supabase con fallback seguro');
      }
      if (error && (error.code === '23505' || (error as any).status === 409)) {
        const updateRes = await supabase.from('cuentas_cobrar_cxc').update(payload).eq('id', validId);
        error = updateRes.error;
      }
      if (error) {
        console.error('Error dbSaveCxc Supabase:', error);
      }
    } catch (err) {
      console.error('Exception dbSaveCxc Supabase:', err);
    }
  }
  return true;
}

export async function dbDeleteCxc(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_cxc_${cid}`, []);
  await setLocal(`erp_local_cxc_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      if (isUUID(id)) { await supabase.from('cuentas_cobrar_cxc').delete().eq('id', id); }
    } catch {}
  }
  return true;
}

// ============================================================================
// 15. CUENTAS POR PAGAR (CXP)
// ============================================================================

export const DEFAULT_CXP: any[] = [];

export async function dbFetchCxp(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      let { data, error } = await supabase.from('cuentas_pagar_cxp').select('*').eq('empresa_id', empresaId).order('fecha', { ascending: false });
      if (error) {
        await new Promise(r => setTimeout(r, 400));
        const retry = await supabase.from('cuentas_pagar_cxp').select('*').eq('empresa_id', empresaId).order('fecha', { ascending: false });
        data = retry.data;
        error = retry.error;
      }
      if (!error && data) {
        const localList = await getLocal<any[]>(`erp_local_cxp_${cid}`, []);
        const localMap = new Map(localList.map((l: any) => [l.id, l]));
        const cachedContacts = await getLocal<any[]>(`erp_local_contactos_${cid}`, []);
        const contactMap = new Map(cachedContacts.map((c: any) => [c.id, c.name || c.nombre]));
        const contactTaxMap = new Map(cachedContacts.map((c: any) => [c.taxId, c.name || c.nombre]));

        const mappedFromDb = (data || []).map((row: any) => {
          const desc = row.descripcion || '';
          const matchFac = desc.match(/(?:Fact(?:ura)?(?:\s+de\s+Compra)?|Fact\.?|Doc\.?|Documento)\s*[:#.]?\s*([A-Za-z0-9\-_]+)/i);
          const facturaNumero = (row.factura && !isUUID(row.factura)) ? row.factura
            : (row.numero && !isUUID(row.numero)) ? row.numero
            : (row.factura_numero && !isUUID(row.factura_numero)) ? row.factura_numero
            : (matchFac ? matchFac[1] : (isUUID(row.factura_id) ? '' : (row.factura_id || '')));

          const localItem = localMap.get(row.id);
          const resolvedProv = row.proveedor || localItem?.proveedor || localItem?.proveedor_nombre || contactMap.get(row.proveedor_id) || contactTaxMap.get(row.proveedor_id) || '';

          return {
            id: row.id,
            factura_id: facturaNumero || row.factura_id || '',
            factura_db_id: row.factura_id,
            factura: facturaNumero || (isUUID(row.factura_id) ? '' : (row.factura_id || '')),
            numero: facturaNumero || (isUUID(row.factura_id) ? '' : (row.factura_id || '')),
            factura_numero: facturaNumero || (isUUID(row.factura_id) ? '' : (row.factura_id || '')),
            proveedor_id: row.proveedor_id,
            proveedor: resolvedProv,
            proveedor_nombre: resolvedProv,
            categoria: row.categoria || localItem?.categoria || 'proveedores',
            fecha: row.fecha,
            fecha_emision: row.fecha,
            vencimiento: row.vencimiento,
            fecha_vencimiento: row.vencimiento,
            descripcion: row.descripcion,
            tipo: row.tipo || 'factura',
            total: Number(row.total) || 0,
            monto: Number(row.total) || 0,
            monto_total: Number(row.total) || 0,
            saldo: Number(row.saldo) || 0,
            saldo_pendiente: Number(row.saldo) || 0,
            moneda: row.moneda || 'USD',
            tasa: Number(row.tasa) || 1.0,
            tasa_cambio: Number(row.tasa) || 1.0,
            estado: (Number(row.saldo) || 0) <= 0.009 ? 'pagada' : 'pendiente'
          };
        });
        await setLocal(`erp_local_cxp_${cid}`, mappedFromDb);
        return mappedFromDb;
      }
    } catch (err) {
      console.error('Error dbFetchCxp Supabase:', err);
    }
  }
  const local = await getLocal<any[]>(`erp_local_cxp_${cid}`, DEFAULT_CXP);
  if (!local || local.length === 0) {
    await setLocal(`erp_local_cxp_${cid}`, DEFAULT_CXP);
    return DEFAULT_CXP;
  }
  return local.map((item: any) => {
    const desc = item.descripcion || '';
    const matchFac = desc.match(/(?:Fact(?:ura)?(?:\s+de\s+Compra)?|Fact\.?|Doc\.?|Documento)\s*[:#.]?\s*([A-Za-z0-9\-_]+)/i);
    const facturaNumero = (item.factura && !isUUID(item.factura)) ? item.factura
      : (item.numero && !isUUID(item.numero)) ? item.numero
      : (item.factura_numero && !isUUID(item.factura_numero)) ? item.factura_numero
      : (matchFac ? matchFac[1] : (isUUID(item.factura_id) ? '' : (item.factura_id || '')));

    return {
      ...item,
      factura: facturaNumero || (isUUID(item.factura_id) ? '' : item.factura_id) || item.factura || '',
      numero: facturaNumero || (isUUID(item.factura_id) ? '' : item.factura_id) || item.numero || '',
      factura_numero: facturaNumero || (isUUID(item.factura_id) ? '' : item.factura_id) || item.factura_numero || '',
      factura_id: facturaNumero || item.factura_id || ''
    };
  });
}

export async function dbSaveCxp(cxp: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_cxp_${cid}`, []);
  const validId = isUUID(cxp.id) ? cxp.id : crypto.randomUUID();
  const validFacturaId = isUUID(cxp.factura_id) ? cxp.factura_id : (isUUID(cxp.factura_db_id) ? cxp.factura_db_id : null);
  const validProveedorId = isUUID(cxp.proveedor_id) ? cxp.proveedor_id : null;

  const desc = cxp.descripcion || '';
  const matchFac = desc.match(/(?:Fact(?:ura)?(?:\s+de\s+Compra)?|Fact\.?|Doc\.?|Documento)\s*[:#.]?\s*([A-Za-z0-9\-_]+)/i);
  const cleanFac = (cxp.factura && !isUUID(cxp.factura)) ? cxp.factura
    : (cxp.numero && !isUUID(cxp.numero)) ? cxp.numero
    : (cxp.factura_numero && !isUUID(cxp.factura_numero)) ? cxp.factura_numero
    : (matchFac ? matchFac[1] : (isUUID(cxp.factura_id) ? '' : (cxp.factura_id || '')));

  const formatted = {
    ...cxp,
    id: validId,
    factura_id: cleanFac || cxp.factura_id || '',
    factura_db_id: validFacturaId || cxp.factura_db_id || '',
    factura: cleanFac || '',
    numero: cleanFac || '',
    factura_numero: cleanFac || '',
    proveedor_id: validProveedorId || cxp.proveedor_id || '',
    proveedor: cxp.proveedor || cxp.proveedorNombre || '',
    categoria: cxp.categoria || 'proveedores',
    fecha: cxp.fecha || cxp.fechaEmision || getTodayLocalDate(),
    vencimiento: cxp.vencimiento || cxp.fechaVencimiento || cxp.fecha || getTodayLocalDate(),
    descripcion: cxp.descripcion || '',
    tipo: cxp.tipo || 'factura',
    total: Number(cxp.total) || 0,
    saldo: Number(cxp.saldo !== undefined ? cxp.saldo : cxp.total) || 0,
    moneda: cxp.moneda || 'USD',
    tasa: Number(cxp.tasa) || 1.0,
    estado: (Number(cxp.saldo !== undefined ? cxp.saldo : cxp.total) || 0) <= 0.009 ? 'pagada' : 'pendiente'
  };
  const idx = list.findIndex(c => c.id === formatted.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  await setLocal(`erp_local_cxp_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const payload: any = {
        id: validId,
        empresa_id: empresaId,
        categoria: formatted.categoria,
        fecha: formatted.fecha,
        vencimiento: formatted.vencimiento,
        descripcion: formatted.descripcion,
        tipo: formatted.tipo,
        total: formatted.total,
        saldo: formatted.saldo,
        moneda: formatted.moneda,
        tasa: formatted.tasa
      };
      if (validFacturaId) payload.factura_id = validFacturaId;
      if (validProveedorId) payload.proveedor_id = validProveedorId;

      let { error } = await supabase.from('cuentas_pagar_cxp').upsert(payload, { onConflict: 'id' });
      if (error && error.code === '23503') {
        delete payload.factura_id;
        delete payload.proveedor_id;
        const retry = await supabase.from('cuentas_pagar_cxp').upsert(payload, { onConflict: 'id' });
        error = retry.error;
      }
      if (error && (error.code === '23505' || (error as any).status === 409)) {
        const updateRes = await supabase.from('cuentas_pagar_cxp').update(payload).eq('id', validId);
        error = updateRes.error;
      }
      if (error) console.error('Error dbSaveCxp Supabase:', error);
    } catch (err) {
      console.error('Exception dbSaveCxp Supabase:', err);
    }
  }
  return true;
}

export async function dbDeleteCxp(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_cxp_${cid}`, []);
  await setLocal(`erp_local_cxp_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      if (isUUID(id)) { await supabase.from('cuentas_pagar_cxp').delete().eq('id', id); }
    } catch {}
  }
  return true;
}

// ============================================================================
// 16. COBRANZAS Y PAGOS REALIZADOS
// ============================================================================

export const DEFAULT_COBRANZAS: any[] = [];

export async function dbFetchCobranzas(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      let { data, error } = await supabase
        .from('cobranzas')
        .select(`
          *,
          cliente:contactos(id, name, tax_id)
        `)
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false });

      if (error) {
        const fallback = await supabase
          .from('cobranzas')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('fecha', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (!error && data) {
        return (data || []).map((r: any) => {
          const rawDetalles = r.detalles;
          const detallesItems = Array.isArray(rawDetalles)
            ? rawDetalles
            : (rawDetalles?.items || rawDetalles || []);
          const clienteNombre = r.cliente?.name || rawDetalles?.cliente_nombre || r.cliente_nombre || '';

          return {
            id: r.id,
            reciboNumero: r.recibo_numero,
            referencia: r.recibo_numero || '',
            clienteId: r.cliente_id,
            clienteNombre: clienteNombre,
            fecha: r.fecha,
            monto: Number(r.monto_total) || 0,
            montoTotal: Number(r.monto_total) || 0,
            montoBanco: Number(r.monto_total) || 0,
            bancoId: r.banco_id,
            comprobanteId: r.comprobante_id,
            retencionIva: Number(r.retencion_iva) || 0,
            retencionIslr: Number(r.retencion_islr) || 0,
            diferencialCambiario: Number(r.diferencial_cambiario) || 0,
            detalles: detallesItems,
            abonos: Array.isArray(detallesItems)
              ? detallesItems.reduce((acc: any, d: any) => ({ ...acc, [d.docId || d.id]: d.monto }), {})
              : (rawDetalles?.abonos || {}),
            notas: r.notas || '',
            estado: (r.notas || '').includes('ANULADO') ? 'anulado' : 'activo'
          };
        });
      }
    } catch {}
  }
  const local = await getLocal<any[]>(`erp_local_cobranzas_${cid}`, DEFAULT_COBRANZAS);
  if (!local || local.length === 0) {
    await setLocal(`erp_local_cobranzas_${cid}`, DEFAULT_COBRANZAS);
    return DEFAULT_COBRANZAS;
  }
  return local;
}

export async function dbSaveCobranza(cob: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_cobranzas_${cid}`, []);
  const validId = isUUID(cob.id) ? cob.id : crypto.randomUUID();
  const validBancoId = isUUID(cob.bancoId || cob.banco_id) ? (cob.bancoId || cob.banco_id) : null;
  let validComprobanteId = isUUID(cob.comprobanteId || cob.comprobante_id) ? (cob.comprobanteId || cob.comprobante_id) : null;
  const validClienteId = isUUID(cob.clienteId || cob.cliente_id) ? (cob.clienteId || cob.cliente_id) : null;

  const formatted = {
    id: validId,
    reciboNumero: cob.referencia || cob.reciboNumero || cob.recibo_numero || `REC-${Date.now().toString().slice(-6)}`,
    referencia: cob.referencia || cob.reciboNumero || cob.recibo_numero || `REC-${Date.now().toString().slice(-6)}`,
    clienteId: validClienteId || cob.clienteId || cob.cliente_id || '',
    clienteNombre: cob.clienteNombre || cob.cliente_nombre || '',
    fecha: cob.fecha || getTodayLocalDate(),
    monto: Number(cob.monto ?? cob.montoTotal ?? cob.monto_total ?? cob.montoBanco) || 0,
    montoTotal: Number(cob.monto ?? cob.montoTotal ?? cob.monto_total ?? cob.montoBanco) || 0,
    montoBanco: Number(cob.monto ?? cob.montoTotal ?? cob.monto_total ?? cob.montoBanco) || 0,
    bancoId: validBancoId,
    comprobanteId: validComprobanteId,
    retencionIva: Number(cob.retencionIva || cob.retencion_iva) || 0,
    retencionIslr: Number(cob.retencionIslr || cob.retencion_islr) || 0,
    diferencialCambiario: Number(cob.diferencialCambiario || cob.diferencial_cambiario) || 0,
    detalles: cob.detalles || cob.abonos || [],
    notas: cob.estado === 'anulado' ? 'ANULADO' : (cob.notas || ''),
    estado: cob.estado || 'activo'
  };
  const idx = list.findIndex(c => c.id === formatted.id || (cob.id && c.id === cob.id));
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  await setLocal(`erp_local_cobranzas_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      let detallesPayload: any = formatted.detalles;
      if (Array.isArray(detallesPayload)) {
        detallesPayload = { items: detallesPayload, cliente_nombre: formatted.clienteNombre };
      } else if (typeof detallesPayload === 'object' && detallesPayload !== null) {
        detallesPayload = { ...detallesPayload, cliente_nombre: formatted.clienteNombre };
      }

      const payload: any = {
        id: validId,
        empresa_id: empresaId,
        recibo_numero: formatted.reciboNumero,
        fecha: formatted.fecha,
        monto_total: formatted.montoTotal,
        retencion_iva: formatted.retencionIva,
        retencion_islr: formatted.retencionIslr,
        diferencial_cambiario: formatted.diferencialCambiario,
        detalles: detallesPayload,
        notas: formatted.notas
      };
      if (!validComprobanteId && (formatted.reciboNumero || formatted.referencia)) {
        try {
          const targetRef = formatted.reciboNumero || formatted.referencia;
          const { data: compFound } = await supabase
            .from('comprobantes_diario')
            .select('id')
            .eq('empresa_id', empresaId)
            .or(`referencia.eq.${targetRef},numero.eq.${targetRef}`)
            .limit(1);
          if (compFound && compFound.length > 0 && isUUID(compFound[0].id)) {
            validComprobanteId = compFound[0].id;
          }
        } catch {}
      }

      if (validClienteId) payload.cliente_id = validClienteId;
      if (validBancoId) payload.banco_id = validBancoId;
      if (validComprobanteId) payload.comprobante_id = validComprobanteId;

      let { error } = await supabase.from('cobranzas').upsert(payload, { onConflict: 'id' });
      if (error && error.code === '23503') {
        const retry1 = await supabase.from('cobranzas').upsert({ ...payload, cliente_id: null }, { onConflict: 'id' });
        if (!retry1.error) {
          error = null;
          payload.cliente_id = null;
        } else if (retry1.error.code === '23503') {
          const retry2 = await supabase.from('cobranzas').upsert({ ...payload, cliente_id: null, banco_id: null }, { onConflict: 'id' });
          if (!retry2.error) {
            error = null;
            payload.cliente_id = null;
            payload.banco_id = null;
          } else {
            delete payload.cliente_id;
            delete payload.banco_id;
            delete payload.comprobante_id;
            const retry3 = await supabase.from('cobranzas').upsert(payload, { onConflict: 'id' });
            error = retry3.error;
          }
        } else {
          error = retry1.error;
        }
      }
      if (error && (error.code === '23505' || (error as any).status === 409)) {
        const updateRes = await supabase.from('cobranzas').update(payload).eq('id', validId);
        error = updateRes.error;
      }
      if (error) console.error('Error dbSaveCobranza Supabase:', error);
    } catch (err) {
      console.error('Exception dbSaveCobranza Supabase:', err);
    }
  }
  return true;
}

export async function dbDeleteCobranza(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_cobranzas_${cid}`, []);
  await setLocal(`erp_local_cobranzas_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      if (isUUID(id)) { await supabase.from('cobranzas').delete().eq('id', id); }
    } catch {}
  }
  return true;
}

export const DEFAULT_PAGOS_REALIZADOS: any[] = [];

export async function dbFetchPagosRealizados(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      let { data, error } = await supabase
        .from('pagos_realizados')
        .select(`
          *,
          proveedor:contactos(id, name, tax_id)
        `)
        .eq('empresa_id', empresaId)
        .order('fecha', { ascending: false });

      if (error) {
        const fallback = await supabase
          .from('pagos_realizados')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('fecha', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }

      if (!error && data) {
        return (data || []).map((r: any) => {
          const rawDetalles = r.detalles;
          const detallesItems = Array.isArray(rawDetalles)
            ? rawDetalles
            : (rawDetalles?.items || rawDetalles || []);
          const proveedorNombre = r.proveedor?.name || rawDetalles?.proveedor_nombre || r.proveedor_nombre || '';

          return {
            id: r.id,
            comprobantePago: r.comprobante_pago,
            referencia: r.comprobante_pago || '',
            proveedorId: r.proveedor_id,
            proveedorNombre: proveedorNombre,
            fecha: r.fecha,
            monto: Number(r.monto_total) || 0,
            montoTotal: Number(r.monto_total) || 0,
            bancoId: r.banco_id,
            comprobanteId: r.comprobante_id,
            retencionIva: Number(r.retencion_iva) || 0,
            retencionIslr: Number(r.retencion_islr) || 0,
            diferencialCambiario: Number(r.diferencial_cambiario) || 0,
            detalles: detallesItems,
            abonos: Array.isArray(detallesItems)
              ? detallesItems.reduce((acc: any, d: any) => ({ ...acc, [d.docId || d.id]: d.monto }), {})
              : (rawDetalles?.abonos || {}),
            notas: r.notas || '',
            estado: (r.notas || '').includes('ANULADO') ? 'anulado' : 'activo'
          };
        });
      }
    } catch {}
  }
  const local = await getLocal<any[]>(`erp_local_pagos_${cid}`, DEFAULT_PAGOS_REALIZADOS);
  if (!local || local.length === 0) {
    await setLocal(`erp_local_pagos_${cid}`, DEFAULT_PAGOS_REALIZADOS);
    return DEFAULT_PAGOS_REALIZADOS;
  }
  return local;
}

export async function dbSavePagoRealizado(pago: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_pagos_${cid}`, []);
  const validId = isUUID(pago.id) ? pago.id : crypto.randomUUID();
  const validBancoId = isUUID(pago.bancoId || pago.banco_id) ? (pago.bancoId || pago.banco_id) : null;
  let validComprobanteId = isUUID(pago.comprobanteId || pago.comprobante_id) ? (pago.comprobanteId || pago.comprobante_id) : null;
  const validProveedorId = isUUID(pago.proveedorId || pago.proveedor_id) ? (pago.proveedorId || pago.proveedor_id) : null;

  const formatted = {
    id: validId,
    comprobantePago: pago.referencia || pago.comprobantePago || pago.comprobante_pago || `PAG-${Date.now().toString().slice(-6)}`,
    referencia: pago.referencia || pago.comprobantePago || pago.comprobante_pago || `PAG-${Date.now().toString().slice(-6)}`,
    proveedorId: validProveedorId || pago.proveedorId || pago.proveedor_id || '',
    proveedorNombre: pago.proveedorNombre || pago.proveedor_nombre || '',
    fecha: pago.fecha || getTodayLocalDate(),
    monto: Number(pago.monto ?? pago.montoTotal ?? pago.monto_total) || 0,
    montoTotal: Number(pago.monto ?? pago.montoTotal ?? pago.monto_total) || 0,
    bancoId: validBancoId,
    comprobanteId: validComprobanteId,
    retencionIva: Number(pago.retencionIva || pago.retencion_iva) || 0,
    retencionIslr: Number(pago.retencionIslr || pago.retencion_islr) || 0,
    diferencialCambiario: Number(pago.diferencialCambiario || pago.diferencial_cambiario) || 0,
    detalles: pago.detalles || pago.abonos || [],
    notas: pago.estado === 'anulado' ? 'ANULADO' : (pago.notas || ''),
    estado: pago.estado || 'activo'
  };
  const idx = list.findIndex(p => p.id === formatted.id || (pago.id && p.id === pago.id));
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  await setLocal(`erp_local_pagos_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      let detallesPayload: any = formatted.detalles;
      if (Array.isArray(detallesPayload)) {
        detallesPayload = { items: detallesPayload, proveedor_nombre: formatted.proveedorNombre };
      } else if (typeof detallesPayload === 'object' && detallesPayload !== null) {
        detallesPayload = { ...detallesPayload, proveedor_nombre: formatted.proveedorNombre };
      }

      const payload: any = {
        id: validId,
        empresa_id: empresaId,
        comprobante_pago: formatted.comprobantePago,
        fecha: formatted.fecha,
        monto_total: formatted.montoTotal,
        retencion_iva: formatted.retencionIva,
        retencion_islr: formatted.retencionIslr,
        diferencial_cambiario: formatted.diferencialCambiario,
        detalles: detallesPayload,
        notas: formatted.notas
      };
      if (!validComprobanteId && (formatted.comprobantePago || formatted.referencia)) {
        try {
          const targetRef = formatted.comprobantePago || formatted.referencia;
          const { data: compFound } = await supabase
            .from('comprobantes_diario')
            .select('id')
            .eq('empresa_id', empresaId)
            .or(`referencia.eq.${targetRef},numero.eq.${targetRef}`)
            .limit(1);
          if (compFound && compFound.length > 0 && isUUID(compFound[0].id)) {
            validComprobanteId = compFound[0].id;
          }
        } catch {}
      }

      if (validProveedorId) {
        try {
          const { data: cFound } = await supabase.from('contactos').select('id').eq('id', validProveedorId).limit(1);
          if (cFound && cFound.length > 0) {
            payload.proveedor_id = validProveedorId;
          }
        } catch {}
      }
      if (validBancoId) payload.banco_id = validBancoId;
      if (validComprobanteId) {
        try {
          const { data: compExists } = await supabase.from('comprobantes_diario').select('id').eq('id', validComprobanteId).limit(1);
          if (compExists && compExists.length > 0) {
            payload.comprobante_id = validComprobanteId;
          }
        } catch {}
      }

      let { error } = await supabase.from('pagos_realizados').upsert(payload, { onConflict: 'id' });
      if (error && error.code === '23503') {
        const retry1 = await supabase.from('pagos_realizados').upsert({ ...payload, proveedor_id: null }, { onConflict: 'id' });
        if (!retry1.error) {
          error = null;
          payload.proveedor_id = null;
        } else if (retry1.error.code === '23503') {
          const retry2 = await supabase.from('pagos_realizados').upsert({ ...payload, proveedor_id: null, banco_id: null }, { onConflict: 'id' });
          if (!retry2.error) {
            error = null;
            payload.proveedor_id = null;
            payload.banco_id = null;
          } else {
            delete payload.proveedor_id;
            delete payload.banco_id;
            delete payload.comprobante_id;
            const retry3 = await supabase.from('pagos_realizados').upsert(payload, { onConflict: 'id' });
            error = retry3.error;
          }
        } else {
          error = retry1.error;
        }
      }
      if (error && (error.code === '23505' || (error as any).status === 409)) {
        const updateRes = await supabase.from('pagos_realizados').update(payload).eq('id', validId);
        error = updateRes.error;
      }
      if (error) console.error('Error dbSavePagoRealizado Supabase:', error);
    } catch (err) {
      console.error('Exception dbSavePagoRealizado Supabase:', err);
    }
  }
  return true;
}

export async function dbDeletePagoRealizado(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_pagos_${cid}`, []);
  await setLocal(`erp_local_pagos_${cid}`, list.filter(p => p.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      if (isUUID(id)) { await supabase.from('pagos_realizados').delete().eq('id', id); }
    } catch {}
  }
  return true;
}

// ============================================================================
// 17. COMPROBANTES DE DIARIO Y LÍNEAS DE ASIENTO
// ============================================================================

export async function dbFetchComprobantes(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data: vouchers, error } = await supabase.from('comprobantes_diario').select('*').eq('empresa_id', empresaId).order('fecha', { ascending: false });
      if (!error && vouchers && vouchers.length > 0) {
        const voucherIds = vouchers.map((v: any) => v.id);
        const linesMap = new Map<string, any[]>();
        if (voucherIds.length > 0) {
          const { data: lines } = await supabase
            .from('lineas_comprobante')
            .select('*')
            .in('comprobante_id', voucherIds)
            .order('orden', { ascending: true });
          (lines || []).forEach((l: any) => {
            if (!linesMap.has(l.comprobante_id)) linesMap.set(l.comprobante_id, []);
            linesMap.get(l.comprobante_id)!.push({
              id: l.id,
              cuentaId: l.cuenta_id,
              descripcion: l.descripcion,
              debe: Number(l.debe) || 0,
              haber: Number(l.haber) || 0,
              orden: l.orden
            });
          });
        }

        return vouchers.map((v: any) => {
          const vLines = linesMap.get(v.id) || [];
          const computedTotal = Number(v.total) || (vLines.length > 0 ? vLines.reduce((acc: number, l: any) => acc + (Number(l.debe) || 0), 0) : 0);
          return {
            id: v.id,
            numero: v.numero,
            fecha: v.fecha,
            tipo: v.tipo || 'Diario',
            descripcion: v.descripcion,
            referencia: v.referencia,
            total: computedTotal,
            estado: v.estado || 'Contabilizado',
            createdBy: v.created_by,
            lineas: vLines
          };
        });
      }
    } catch {}
  }
  return await getLocal<any[]>(`erp_local_comprobantes_${cid}`, []);
}

export async function dbSaveComprobante(comp: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_comprobantes_${cid}`, []);
  const totalDebe = Array.isArray(comp.lineas) && comp.lineas.length > 0 
    ? comp.lineas.reduce((acc: number, l: any) => acc + (Number(l.debe) || 0), 0) 
    : 0;
  const totalHaber = Array.isArray(comp.lineas) && comp.lineas.length > 0 
    ? comp.lineas.reduce((acc: number, l: any) => acc + (Number(l.haber) || 0), 0) 
    : 0;
  const diferencia = Math.abs(totalDebe - totalHaber);
  const estadoFinal = comp.estado 
    ? (comp.estado === 'Contabilizado' && diferencia > 0.01 && (comp.lineas?.length || 0) > 0 ? 'Descuadrado' : comp.estado)
    : (diferencia > 0.01 && (comp.lineas?.length || 0) > 0 ? 'Descuadrado' : 'Contabilizado');

  const formatted = {
    id: comp.id || `diar_${Date.now()}`,
    numero: comp.numero || `DIAR-${Date.now().toString().slice(-6)}`,
    fecha: comp.fecha || getTodayLocalDate(),
    tipo: comp.tipo || 'Diario',
    descripcion: comp.descripcion || '',
    referencia: comp.referencia || '',
    total: Number(comp.total) || totalDebe,
    estado: estadoFinal,
    createdBy: comp.createdBy || comp.created_by || 'Sistema',
    lineas: comp.lineas || []
  };
  const validVoucherId = isUUID(comp.id) ? comp.id : (isUUID(formatted.id) ? formatted.id : crypto.randomUUID());
  formatted.id = validVoucherId;

  const idx = list.findIndex(c => c.id === formatted.id || (formatted.numero && c.numero === formatted.numero));
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  await setLocal(`erp_local_comprobantes_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      // 1. Resolve existing row in Supabase:
      // Note: comprobantes_diario has TWO unique constraints:
      //   - primary key (id)
      //   - unique (empresa_id, numero)
      // If we attempt upsert on id when (empresa_id, numero) already exists, Postgres throws 23505 duplicate key.
      let targetVoucherId = validVoucherId;
      let existingRowId: string | null = null;

      if (isUUID(validVoucherId)) {
        const { data: byId } = await supabase.from('comprobantes_diario').select('id').eq('id', validVoucherId).maybeSingle();
        if (byId) existingRowId = byId.id;
      }
      if (!existingRowId && formatted.numero) {
        const { data: byNum } = await supabase.from('comprobantes_diario').select('id').eq('empresa_id', empresaId).eq('numero', formatted.numero).maybeSingle();
        if (byNum) existingRowId = byNum.id;
      }

      const payload: any = {
        empresa_id: empresaId,
        numero: formatted.numero,
        fecha: formatted.fecha,
        tipo: formatted.tipo || 'Diario',
        descripcion: formatted.descripcion || 'Comprobante de Diario',
        referencia: formatted.referencia || '',
        total: formatted.total,
        estado: formatted.estado || 'Contabilizado'
      };
      if (isUUID(formatted.createdBy)) {
        payload.created_by = formatted.createdBy;
      }

      if (existingRowId) {
        targetVoucherId = existingRowId;
        const { error: updErr } = await supabase.from('comprobantes_diario').update(payload).eq('id', existingRowId);
        if (updErr) console.error('Error updating comprobantes_diario Supabase:', updErr);
      } else {
        payload.id = targetVoucherId;
        const { error: insErr } = await supabase.from('comprobantes_diario').insert(payload);
        if (insErr) console.error('Error inserting comprobantes_diario Supabase:', insErr);
      }

      // 2. Guardar líneas del comprobante
      if (Array.isArray(comp.lineas) && comp.lineas.length > 0) {
        await supabase.from('lineas_comprobante').delete().eq('comprobante_id', targetVoucherId);

        let accounts: any[] = (await getLocal<any[]>(`erp_local_cuentas_${cid}`, [])) || [];
        if (!accounts || accounts.length === 0) {
          try {
            accounts = await dbFetchCuentasContables(empresaId);
          } catch {}
        }

        const linesPayload = comp.lineas.map((l: any, lineIdx: number) => {
          let accountUUID: string | null = null;
          const rawAcc = l.cuentaId || l.cuenta_id;
          if (isUUID(rawAcc)) {
            accountUUID = rawAcc;
          } else if (rawAcc && accounts && accounts.length > 0) {
            const found = accounts.find((a: any) => a.codigo === rawAcc || a.id === rawAcc);
            if (found && isUUID(found.id)) {
              accountUUID = found.id;
            }
          }

          return {
            id: isUUID(l.id) ? l.id : crypto.randomUUID(),
            comprobante_id: targetVoucherId,
            cuenta_id: accountUUID,
            descripcion: (l.descripcion && String(l.descripcion).trim()) ? String(l.descripcion).trim() : (formatted.descripcion || 'Línea de comprobante'),
            debe: Number(l.debe) || 0,
            haber: Number(l.haber) || 0,
            orden: lineIdx + 1
          };
        });
        const { error: linesError } = await supabase.from('lineas_comprobante').insert(linesPayload);
        if (linesError) console.error('Error lineas_comprobante Supabase:', linesError);
      }
    } catch (err) {
      console.error('Exception dbSaveComprobante Supabase:', err);
    }
  }
  return true;
}

export async function dbDeleteComprobante(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_comprobantes_${cid}`, []);
  await setLocal(`erp_local_comprobantes_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      if (isUUID(id)) { await supabase.from('comprobantes_diario').delete().eq('id', id); }
    } catch {}
  }
  return true;
}

// ============================================================================
// 18. CATÁLOGO DE PRODUCTOS / SERVICIOS
// ============================================================================

export async function dbFetchServicios(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  const local = await getLocal<any[]>(`app_servicios_${cid}`, []);
  const fallback = local ? local : [];
  if (!isSupabaseConfigured || !supabase || !empresaId) return fallback;
  try {
    const { data, error } = await supabase
      .from('servicios')
      .select('*')
      .eq('empresa_id', empresaId);
    if (error || !data) return fallback;
    return data.map((s: any) => ({
      id: s.id,
      codigo: s.codigo,
      nombre: s.nombre,
      descripcion: s.descripcion,
      precioBase: Number(s.precio_base || s.precioBase) || 0,
      cuentaContableId: s.cuenta_contable_id || s.cuentaContableId || ''
    }));
  } catch (e) {
    return fallback;
  }
}

export async function dbSaveServicio(servicio: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const local = await getLocal<any[]>(`app_servicios_${cid}`, []);
    const list = local ? local : [];
    const idx = list.findIndex((s: any) => String(s.id) === String(servicio.id));
    let updated: any[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = { ...updated[idx], ...servicio };
    } else {
      updated = [...list, servicio];
    }
    await setLocal(`app_servicios_${cid}`, updated);

    if (isSupabaseConfigured && supabase && empresaId) {
      const payload = {
        id: servicio.id,
        empresa_id: empresaId,
        codigo: servicio.codigo || `SERV-${Date.now().toString().slice(-4)}`,
        nombre: servicio.nombre || '',
        descripcion: servicio.descripcion || '',
        precio_base: Number(servicio.precioBase || servicio.precio_base) || 0,
        cuenta_contable_id: servicio.cuentaContableId || servicio.cuenta_contable_id || null
      };
      await supabase.from('servicios').upsert(payload, { onConflict: 'id' });
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbDeleteServicio(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const local = await getLocal<any[]>(`app_servicios_${cid}`, []);
    if (local) {
      const list = local;
      const filtered = list.filter((s: any) => String(s.id) !== String(id));
      await setLocal(`app_servicios_${cid}`, filtered);
    }
    if (isSupabaseConfigured && supabase) {
      if (isUUID(id)) { await supabase.from('servicios').delete().eq('id', id); }
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbClearServicios(empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    await setLocal(`app_servicios_${cid}`, []);
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      const { error } = await supabase.from('servicios').delete().eq('empresa_id', empresaId);
      if (error) console.error('Error dbClearServicios Supabase:', error);
    }
    return true;
  } catch (e) {
    console.error('Error dbClearServicios:', e);
    return false;
  }
}

export async function dbClearBancos(empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    await setLocal(`erp_local_bancos_${cid}`, []);
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      const { error } = await supabase.from('bancos').delete().eq('empresa_id', empresaId);
      if (error) console.error('Error dbClearBancos Supabase:', error);
    }
    return true;
  } catch (e) {
    console.error('Error dbClearBancos:', e);
    return false;
  }
}

export async function dbClearMovimientosBancos(empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    await setLocal(`erp_local_movimientos_bancos_${cid}`, []);
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      const { error } = await supabase.from('movimientos_bancos').delete().eq('empresa_id', empresaId);
      if (error) console.error('Error dbClearMovimientosBancos Supabase:', error);
    }
    return true;
  } catch (e) {
    console.error('Error dbClearMovimientosBancos:', e);
    return false;
  }
}

export async function dbClearCxc(empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    await setLocal(`erp_local_cxc_${cid}`, []);
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      const { error } = await supabase.from('cuentas_cobrar_cxc').delete().eq('empresa_id', empresaId);
      if (error) console.error('Error dbClearCxc Supabase:', error);
    }
    return true;
  } catch (e) {
    console.error('Error dbClearCxc:', e);
    return false;
  }
}

export async function dbClearCxp(empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    await setLocal(`erp_local_cxp_${cid}`, []);
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      const { error } = await supabase.from('cuentas_pagar_cxp').delete().eq('empresa_id', empresaId);
      if (error) console.error('Error dbClearCxp Supabase:', error);
    }
    return true;
  } catch (e) {
    console.error('Error dbClearCxp:', e);
    return false;
  }
}

export async function dbClearComprobantes(empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    await setLocal(`erp_local_comprobantes_${cid}`, []);
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      // Obtener los vouchers de la empresa para eliminar sus líneas
      const { data: vList } = await supabase.from('comprobantes_diario').select('id').eq('empresa_id', empresaId);
      if (vList && vList.length > 0) {
        const vIds = vList.map((v: any) => v.id);
        await supabase.from('lineas_comprobante').delete().in('comprobante_id', vIds);
      }
      const { error } = await supabase.from('comprobantes_diario').delete().eq('empresa_id', empresaId);
      if (error) console.error('Error dbClearComprobantes Supabase:', error);
    }
    return true;
  } catch (e) {
    console.error('Error dbClearComprobantes:', e);
    return false;
  }
}

export async function dbClearProducts(empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    await setLocal(`app_products_${cid}`, []);
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      const { error } = await supabase.from('productos').delete().eq('empresa_id', empresaId);
      if (error) console.error('Error dbClearProducts Supabase:', error);
    }
    return true;
  } catch (e) {
    console.error('Error dbClearProducts:', e);
    return false;
  }
}

export async function dbClearActivosFijos(empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    await setLocal(`app_activos_fijos_${cid}`, []);
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      const { error } = await supabase.from('activos_fijos').delete().eq('empresa_id', empresaId);
      if (error) console.error('Error dbClearActivosFijos Supabase:', error);
    }
    return true;
  } catch (e) {
    console.error('Error dbClearActivosFijos:', e);
    return false;
  }
}

// ============================================================================
// 10. SOLICITUDES DE BANCO (CONFIRMACIONES DE INGRESO Y SOLICITUDES DE PAGO)
// ============================================================================

export const DEFAULT_SOLICITUDES_BANCO: any[] = [];

export async function dbFetchSolicitudesBanco(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data, error } = await supabase.from('solicitudes_banco').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false });
      if (!error && data) {
        return (data || []).map((row: any) => ({
          id: row.id,
          tipo: row.tipo,
          estado: row.estado,
          fecha: row.fecha,
          fecha_requerida: row.fecha_requerida,
          contacto_id: row.contacto_id,
          contacto_nombre: row.contacto_nombre,
          contacto_tipo: row.contacto_tipo,
          banco_id: row.banco_id,
          banco_nombre: row.banco_nombre,
          monto: Number(row.monto) || 0,
          moneda: row.moneda || 'USD',
          tasa: Number(row.tasa) || 1,
          monto_ves: Number(row.monto_ves) || 0,
          referencia: row.referencia || '',
          metodo_pago: row.metodo_pago || 'Transferencia',
          descripcion: row.descripcion || '',
          categoria_concepto: row.categoria_concepto || '',
          comprobante_adjunto: row.comprobante_adjunto,
          datos_pago_beneficiario: row.datos_pago_beneficiario,
          fecha_resolucion: row.fecha_resolucion,
          usuario_resolucion: row.usuario_resolucion,
          banco_resolucion_id: row.banco_resolucion_id,
          referencia_resolucion: row.referencia_resolucion,
          nota_resolucion: row.nota_resolucion,
          movimiento_banco_id: row.movimiento_banco_id,
          comprobante_contable_id: row.comprobante_contable_id,
          created_at: row.created_at
        }));
      }
    } catch {}
  }

  // Local storage fallback
  const local = await getLocal<any[]>(`erp_local_solicitudes_banco_${cid}`, DEFAULT_SOLICITUDES_BANCO);
  if (!local || local.length === 0) {
    await setLocal(`erp_local_solicitudes_banco_${cid}`, DEFAULT_SOLICITUDES_BANCO);
    return DEFAULT_SOLICITUDES_BANCO;
  }
  return local;
}

export async function dbSaveSolicitudBanco(solicitud: any, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const list = await dbFetchSolicitudesBanco(cid);
    const idx = list.findIndex(s => String(s.id) === String(solicitud.id));
    let updated: any[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = { ...updated[idx], ...solicitud, updated_at: new Date().toISOString() };
    } else {
      updated = [solicitud, ...list];
    }
    await setLocal(`erp_local_solicitudes_banco_${cid}`, updated);

    if (isSupabaseConfigured && supabase && empresaId) {
      try {
        await supabase.from('solicitudes_banco').upsert({
          id: solicitud.id,
          empresa_id: empresaId,
          tipo: solicitud.tipo,
          estado: solicitud.estado,
          fecha: solicitud.fecha,
          fecha_requerida: solicitud.fecha_requerida,
          contacto_id: solicitud.contacto_id,
          contacto_nombre: solicitud.contacto_nombre,
          contacto_tipo: solicitud.contacto_tipo,
          banco_id: solicitud.banco_id,
          banco_nombre: solicitud.banco_nombre,
          monto: solicitud.monto,
          moneda: solicitud.moneda,
          tasa: solicitud.tasa,
          monto_ves: solicitud.monto_ves,
          referencia: solicitud.referencia,
          metodo_pago: solicitud.metodo_pago,
          descripcion: solicitud.descripcion,
          categoria_concepto: solicitud.categoria_concepto,
          comprobante_adjunto: solicitud.comprobante_adjunto,
          datos_pago_beneficiario: solicitud.datos_pago_beneficiario,
          fecha_resolucion: solicitud.fecha_resolucion,
          usuario_resolucion: solicitud.usuario_resolucion,
          banco_resolucion_id: solicitud.banco_resolucion_id,
          referencia_resolucion: solicitud.referencia_resolucion,
          nota_resolucion: solicitud.nota_resolucion,
          movimiento_banco_id: solicitud.movimiento_banco_id,
          comprobante_contable_id: solicitud.comprobante_contable_id,
          updated_at: new Date().toISOString()
        });
      } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

export async function dbDeleteSolicitudBanco(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const list = await dbFetchSolicitudesBanco(cid);
    const filtered = list.filter(s => String(s.id) !== String(id));
    await setLocal(`erp_local_solicitudes_banco_${cid}`, filtered);

    if (isSupabaseConfigured && supabase) {
      try {
        if (isUUID(id)) { await supabase.from('solicitudes_banco').delete().eq('id', id); }
      } catch {}
    }
    return true;
  } catch {
    return false;
  }
}



// ============================================================================
// CATEGORÍAS DE ACTIVOS FIJOS, ACTIVOS Y DEPRECIACIONES
// ============================================================================

export async function dbFetchCategoriasActivos(empresaId?: string): Promise<any[]> {
  try {
    const cid = empresaId || 'default';
    const local = await getLocal<any[]>(`app_categorias_activos_${cid}`, []);
    if (isSupabaseConfigured && supabase && empresaId) {
      const { data, error } = await supabase.from('categorias_activos').select('*').eq('empresa_id', cid);
      if (!error && data) {
        const merged = data.map((row: any) => {
          let extra: any = {};
          let rawDesc = row.descripcion || '';
          try {
            if (rawDesc.startsWith('{')) {
              extra = JSON.parse(rawDesc);
              rawDesc = extra.d || '';
            }
          } catch {}
          const localItem = (local || []).find((l: any) => String(l.id) === String(row.id));
          return {
            ...row,
            descripcion: rawDesc,
            vidaUtil: extra.v !== undefined ? extra.v : (localItem?.vidaUtil ?? 5),
            metodo: extra.m || localItem?.metodo || 'Línea Recta',
            cuentaActivo: extra.ca || localItem?.cuentaActivo || '',
            cuentaDeprecAcumulada: extra.cda || localItem?.cuentaDeprecAcumulada || '',
            cuentaGastoDeprec: extra.cgd || localItem?.cuentaGastoDeprec || ''
          };
        });
        await setLocal(`app_categorias_activos_${cid}`, merged);
        return merged;
      }
    }
    return local || [];
  } catch (e) {
    return [];
  }
}

export async function dbSaveCategoriaActivo(cat: any, empresaId: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    const current = await dbFetchCategoriasActivos(cid);
    const existingIndex = current.findIndex((c: any) => String(c.id) === String(cat.id));
    
    const validId = isUUID(cat.id) ? cat.id : crypto.randomUUID();
    const formatted = { ...cat, id: validId };
    
    let updated: any[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = { ...updated[existingIndex], ...formatted };
    } else {
      updated = [...current, formatted];
    }
    await setLocal(`app_categorias_activos_${cid}`, updated);
    
    if (isSupabaseConfigured && supabase && empresaId) {
      let descString = formatted.descripcion || '';
      try {
        const meta = {
          d: formatted.descripcion || '',
          v: formatted.vidaUtil,
          m: formatted.metodo,
          ca: formatted.cuentaActivo,
          cda: formatted.cuentaDeprecAcumulada,
          cgd: formatted.cuentaGastoDeprec
        };
        descString = JSON.stringify(meta);
      } catch {}

      const payload = {
        id: validId,
        empresa_id: empresaId,
        codigo: formatted.codigo || `CAT-${String(current.length + 1).padStart(2, '0')}`,
        nombre: formatted.nombre,
        descripcion: descString,
        color: formatted.color || 'indigo',
        activo: formatted.activo ?? true
      };
      await supabase.from('categorias_activos').upsert(payload);
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbDeleteCategoriaActivo(id: string, empresaId: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    const current = await dbFetchCategoriasActivos(cid);
    const filtered = current.filter((c: any) => String(c.id) !== String(id));
    await setLocal(`app_categorias_activos_${cid}`, filtered);
    
    if (isSupabaseConfigured && supabase && isUUID(id)) {
      await supabase.from('categorias_activos').delete().eq('id', id);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbSaveCategoriasActivos(cats: any[], empresaId: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    await setLocal(`app_categorias_activos_${cid}`, cats);
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbFetchActivosFijos(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  const localList = await getLocal<any[]>(`app_activos_fijos_${cid}`, []);
  const fallback = localList ? localList : [];
  
  if (!isSupabaseConfigured || !supabase) return fallback;
  try {
    let query = supabase.from('activos_fijos').select('*').order('created_at', { ascending: false });
    if (empresaId) query = query.eq('empresa_id', empresaId);
    const { data, error } = await query;
    if (error) {
      console.warn('Error al cargar activos fijos de Supabase:', error.message);
      return fallback;
    }
    if (!data || data.length === 0) return fallback;
    return (data || []).map((row: any) => ({
      id: row.id,
      codigo: row.codigo,
      nombre: row.nombre,
      descripcion: row.nombre,
      categoriaId: row.categoria,
      categoriaNombre: row.categoria,
      fechaAdquisicion: row.fecha_adquisicion,
      valorInicial: Number(row.valor_compra) || 0,
      vidaUtilMeses: row.vida_util_meses || 60,
      depreciacionAcumulada: Number(row.depreciacion_acumulada) || 0,
      cuentaActivo: row.cuenta_activo_id || '',
      cuentaGastoDeprec: row.cuenta_gasto_deprec_id || '',
      estado: row.estado || 'Activo'
    }));
  } catch (e) {
    return fallback;
  }
}

export async function dbSaveActivoFijo(activo: any, empresaId: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    const assetId = (activo.id && isUUID(activo.id)) ? activo.id : crypto.randomUUID();
    const formattedActivo = { ...activo, id: assetId };

    const localList = await getLocal<any[]>(`app_activos_fijos_${cid}`, []);
    const current = localList ? localList : [];
    const idx = current.findIndex((a: any) => String(a.id) === String(assetId) || (activo.id && String(a.id) === String(activo.id)));
    let updatedList: any[];
    if (idx >= 0) {
      updatedList = [...current];
      updatedList[idx] = { ...updatedList[idx], ...formattedActivo };
    } else {
      updatedList = [...current, formattedActivo];
    }
    await setLocal(`app_activos_fijos_${cid}`, updatedList);

    if (isSupabaseConfigured && supabase && empresaId) {
      // cuenta_activo_id and cuenta_gasto_deprec_id in Postgres must be valid UUID or null
      let cuentaActivoId = null;
      if (formattedActivo.cuentaActivo && isUUID(formattedActivo.cuentaActivo)) {
        cuentaActivoId = formattedActivo.cuentaActivo;
      } else if (formattedActivo.cuenta_activo_id && isUUID(formattedActivo.cuenta_activo_id)) {
        cuentaActivoId = formattedActivo.cuenta_activo_id;
      }

      let cuentaGastoId = null;
      if (formattedActivo.cuentaGastoDeprec && isUUID(formattedActivo.cuentaGastoDeprec)) {
        cuentaGastoId = formattedActivo.cuentaGastoDeprec;
      } else if (formattedActivo.cuenta_gasto_deprec_id && isUUID(formattedActivo.cuenta_gasto_deprec_id)) {
        cuentaGastoId = formattedActivo.cuenta_gasto_deprec_id;
      }

      const payload = {
        id: assetId,
        empresa_id: empresaId,
        codigo: formattedActivo.codigo || `AF-${Date.now().toString().slice(-4)}`,
        nombre: formattedActivo.descripcion || formattedActivo.nombre || 'Activo Fijo',
        categoria: formattedActivo.categoriaNombre || formattedActivo.categoriaId || 'General',
        fecha_adquisicion: formattedActivo.fechaAdquisicion || new Date().toISOString().split('T')[0],
        valor_compra: Number(formattedActivo.valorInicial || formattedActivo.valorCompra) || 0,
        vida_util_meses: Number(formattedActivo.vidaUtilMeses || (Number(formattedActivo.vidaUtil || 5) * 12)) || 60,
        depreciacion_acumulada: Number(formattedActivo.depreciacionAcumulada) || 0,
        cuenta_activo_id: cuentaActivoId,
        cuenta_gasto_deprec_id: cuentaGastoId,
        estado: formattedActivo.estado || 'Activo'
      };
      const { error } = await supabase.from('activos_fijos').upsert(payload);
      if (error) {
        console.error('Error al guardar activo fijo en Supabase:', error);
      }
    }
    return true;
  } catch (e) {
    console.error('Error en dbSaveActivoFijo:', e);
    return false;
  }
}

export async function dbDeleteActivoFijo(id: string, empresaId?: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    const localList = await getLocal<any[]>(`app_activos_fijos_${cid}`, []);
    if (localList) {
      await setLocal(`app_activos_fijos_${cid}`, localList.filter((a: any) => String(a.id) !== String(id)));
    }
    if (isSupabaseConfigured && supabase) {
      if (isUUID(id)) { await supabase.from('activos_fijos').delete().eq('id', id); }
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbDeleteDepreciacion(id: string, empresaId?: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    const local = await getLocal<any[]>(`app_depreciaciones_${cid}`, []);
    if (local) {
      await setLocal(`app_depreciaciones_${cid}`, local.filter((d: any) => String(d.id) !== String(id)));
    }
    if (isSupabaseConfigured && supabase) {
      if (isUUID(id)) {
        await supabase.from('depreciaciones').delete().eq('id', id);
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbFetchDepreciaciones(empresaId?: string): Promise<any[]> {
  try {
    const cid = empresaId || 'default';
    const local = await getLocal<any[]>(`app_depreciaciones_${cid}`, []);
    if (isSupabaseConfigured && supabase && empresaId) {
      const { data, error } = await supabase.from('depreciaciones').select('*').eq('empresa_id', cid);
      if (!error && data) {
        const normalized = data.map((row: any) => {
          let extra: any = {};
          try {
            if (row.notas && row.notas.startsWith('{')) {
              extra = JSON.parse(row.notas);
            }
          } catch {}
          const localItem = (local || []).find((l: any) => String(l.id) === String(row.id));
          return {
            ...row,
            periodo: extra.periodo || localItem?.periodo || (row.fecha ? row.fecha.slice(0, 7).split('-').reverse().join('/') : ''),
            comprobante: extra.comprobante || localItem?.comprobante || (row.comprobante_id ? `DEP-${String(row.comprobante_id).slice(-6)}` : `DEP-${String(row.id).slice(-6)}`),
            totalDepreciado: Number(row.monto || localItem?.totalDepreciado || 0),
            fechaEjecucion: row.fecha || localItem?.fechaEjecucion || '',
            estado: 'Procesado',
            detalles: extra.detalles || localItem?.detalles || []
          };
        });
        await setLocal(`app_depreciaciones_${cid}`, normalized);
        return normalized;
      }
    }
    return local ? local : [];
  } catch (e) {
    return [];
  }
}

export async function dbSaveDepreciacion(dep: any, empresaId: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    const current = await dbFetchDepreciaciones(cid);
    
    const validId = isUUID(dep.id) ? dep.id : crypto.randomUUID();
    const formatted = { ...dep, id: validId };
    
    const updated = [...current, formatted];
    await setLocal(`app_depreciaciones_${cid}`, updated);
    
    if (isSupabaseConfigured && supabase && empresaId) {
      let notasString = formatted.notas || '';
      try {
        const meta = {
          periodo: formatted.periodo || '',
          comprobante: formatted.comprobante || '',
          totalDepreciado: Number(formatted.totalDepreciado || formatted.monto || 0),
          fechaEjecucion: formatted.fechaEjecucion || formatted.fecha || '',
          detalles: formatted.detalles || []
        };
        notasString = JSON.stringify(meta);
      } catch {}

      const payload = {
        id: validId,
        empresa_id: empresaId,
        activo_id: isUUID(formatted.activo_id) ? formatted.activo_id : null,
        fecha: formatted.fechaEjecucion || formatted.fecha || new Date().toISOString().split('T')[0],
        monto: Number(formatted.totalDepreciado || formatted.monto || 0),
        comprobante_id: isUUID(formatted.comprobante_id) ? formatted.comprobante_id : null,
        notas: notasString
      };
      await supabase.from('depreciaciones').upsert(payload);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbSaveDepreciaciones(deps: any[], empresaId: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    await setLocal(`app_depreciaciones_${cid}`, deps);
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================================================
// 14. INVENTARIO DE MERCANCÍA (PRODUCTOS Y MOVIMIENTOS)
// ============================================================================

export const DEFAULT_SAMPLE_PRODUCTS: any[] = [];

export async function dbFetchProducts(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase.from('productos').select('*').eq('empresa_id', empresaId).order('nombre', { ascending: true });
      if (!error && data) {
        const mapped = data.map((row: any) => ({
          id: row.id,
          empresa_id: row.empresa_id,
          codigo: row.codigo,
          codigo_barra: row.codigo_barra || '',
          referencia_fabrica: row.referencia_fabrica || '',
          nombre: row.nombre,
          descripcion: row.descripcion || '',
          categoria: row.categoria || 'General',
          subcategoria: row.subcategoria || '',
          marca: row.marca || '',
          modelo: row.modelo || '',
          unidad_medida: row.unidad_medida || 'UND',
          unidad_empaque: row.unidad_empaque || '',
          factor_empaque: Number(row.factor_empaque) || 1,
          ubicacion: row.ubicacion || '',
          costo_unitario: Number(row.costo_unitario) || 0,
          costo_promedio: Number(row.costo_promedio) || 0,
          precio_venta: Number(row.precio_venta) || 0,
          precio_mayor: Number(row.precio_mayor) || 0,
          precio_vip: Number(row.precio_vip) || 0,
          precio_minimo: Number(row.precio_minimo) || 0,
          stock_actual: Number(row.stock_actual) || 0,
          stock_minimo: Number(row.stock_minimo) || 0,
          stock_maximo: Number(row.stock_maximo) || 0,
          punto_reorden: Number(row.punto_reorden) || 0,
          almacen_id: row.almacen_id || '',
          aplica_iva: row.aplica_iva ?? true,
          alicuota_iva: row.alicuota_iva || 'general',
          cuenta_inventario_id: row.cuenta_inventario_id || '',
          cuenta_costo_id: row.cuenta_costo_id || '',
          cuenta_venta_id: row.cuenta_venta_id || row.cuenta_ingreso_id || '',
          cuenta_ingreso_id: row.cuenta_ingreso_id || row.cuenta_venta_id || '',
          activo: row.activo ?? true,
          imagen_url: row.imagen_url || '',
          created_at: row.created_at,
          updated_at: row.updated_at
        }));
        await setLocal(`app_products_${cid}`, mapped);
        return mapped;
      }
    } catch {}
  }
  const local = await getLocal<any[]>(`app_products_${cid}`, []);
  return local || [];
}

export async function dbSaveProduct(product: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const current = await getLocal<any[]>(`app_products_${cid}`, []);
    const prodId = (product.id && isUUID(product.id)) ? product.id : crypto.randomUUID();
    const formatted = { ...product, id: prodId, empresa_id: empresaId };
    const idx = current.findIndex((p: any) => String(p.id) === String(prodId));
    let updated: any[];
    if (idx >= 0) {
      updated = [...current];
      updated[idx] = { ...updated[idx], ...formatted };
    } else {
      updated = [formatted, ...current];
    }
    await setLocal(`app_products_${cid}`, updated);
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      try {
        const cuentasList = await getLocal<any[]>(`erp_local_cuentas_${cid}`, []);
        const resolveUUID = (val: any) => {
          if (!val) return null;
          if (isUUID(val)) return val;
          const found = cuentasList.find(c => c.codigo === String(val) || c.id === String(val));
          if (found && isUUID(found.id)) return found.id;
          return null;
        };

        const payload = {
          id: prodId,
          empresa_id: empresaId,
          codigo: product.codigo,
          codigo_barra: product.codigo_barra || null,
          referencia_fabrica: product.referencia_fabrica || null,
          nombre: product.nombre,
          descripcion: product.descripcion || '',
          categoria: product.categoria || 'General',
          subcategoria: product.subcategoria || null,
          marca: product.marca || null,
          modelo: product.modelo || null,
          unidad_medida: product.unidad_medida || 'UND',
          ubicacion: product.ubicacion || null,
          costo_unitario: Number(product.costo_unitario) || 0,
          precio_venta: Number(product.precio_venta) || 0,
          precio_mayor: Number(product.precio_mayor) || 0,
          precio_vip: Number(product.precio_vip) || 0,
          precio_minimo: Number(product.precio_minimo) || 0,
          stock_actual: Number(product.stock_actual) || 0,
          stock_minimo: Number(product.stock_minimo) || 0,
          punto_reorden: Number(product.punto_reorden) || 0,
          almacen_id: (product.almacen_id && isUUID(product.almacen_id)) ? product.almacen_id : null,
          aplica_iva: Boolean(product.aplica_iva),
          alicuota_iva: product.alicuota_iva || 'general',
          cuenta_inventario_id: resolveUUID(product.cuenta_inventario_id),
          cuenta_costo_id: resolveUUID(product.cuenta_costo_id),
          cuenta_venta_id: resolveUUID(product.cuenta_venta_id || product.cuenta_ingreso_id),
          cuenta_ingreso_id: resolveUUID(product.cuenta_ingreso_id || product.cuenta_venta_id),
          activo: product.activo ?? true,
          updated_at: new Date().toISOString()
        };

        let { error } = await supabase.from('productos').upsert(payload, { onConflict: 'id' });
        if (error && (error.code === '23505' || (error as any).status === 409)) {
          const updateRes = await supabase.from('productos').update(payload).eq('id', prodId);
          error = updateRes.error;
        }

        // Si falla por Foreign Key inexistente (ej. almacén o cuenta contable que no existe en Supabase)
        if (error && error.code === '23503') {
          console.warn("Violación de clave foránea al guardar producto. Reintentando con claves anulables saneadas...", error.details);
          const sanitizedPayload = {
            ...payload,
            almacen_id: null,
            cuenta_inventario_id: null,
            cuenta_costo_id: null,
            cuenta_venta_id: null,
            cuenta_ingreso_id: null
          };
          const retryUpsert = await supabase.from('productos').upsert(sanitizedPayload, { onConflict: 'id' });
          error = retryUpsert.error;
        }

        if (error) {
          console.error("Error al guardar producto en Supabase:", error);
        }
      } catch (err) {
        console.error("Error en dbSaveProduct:", err);
      }
    }
    return true;
  } catch (e) {
    console.error("Error saving product:", e);
    return false;
  }
}

export async function dbDeleteProduct(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    // 1. Validar si el producto tiene movimientos de inventario en caché local
    const movimientos = await dbFetchMovimientosInventario(cid);
    const hasLocalMovements = movimientos.some((m: any) => String(m.producto_id) === String(id));
    if (hasLocalMovements) {
      console.warn(`[dbDeleteProduct] Operación bloqueada: El artículo ${id} tiene movimientos de inventario registrados.`);
      return false;
    }

    // 2. Validar si el producto tiene movimientos registrados en Supabase
    if (isSupabaseConfigured && supabase && isUUID(id)) {
      try {
        const { data: movs } = await supabase
          .from('movimientos_inventario')
          .select('id')
          .eq('producto_id', id)
          .limit(1);
        if (movs && movs.length > 0) {
          console.warn(`[dbDeleteProduct] Operación bloqueada en Supabase: El artículo ${id} tiene movimientos registrados.`);
          return false;
        }
      } catch {}
    }

    const current = await getLocal<any[]>(`app_products_${cid}`, []);
    const filtered = current.filter((p: any) => String(p.id) !== String(id));
    await setLocal(`app_products_${cid}`, filtered);
    if (isSupabaseConfigured && supabase && isUUID(id)) {
      try {
        await supabase.from('productos').delete().eq('id', id);
      } catch {}
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================================================
// 14.1 CATEGORÍAS DE PRODUCTOS
// ============================================================================

export async function dbFetchCategoriasProducto(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase
        .from('categorias_producto')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('codigo', { ascending: true });
      if (!error && data) {
        const mapped = data.map((row: any) => ({
          id: row.id,
          empresa_id: row.empresa_id,
          codigo: row.codigo,
          nombre: row.nombre,
          descripcion: row.descripcion || '',
          color: row.color || 'indigo',
          activo: row.activo ?? true,
          created_at: row.created_at
        }));
        await setLocal(`app_categorias_producto_${cid}`, mapped);
        return mapped;
      }
    } catch {}
  }
  const local = await getLocal<any[]>(`app_categorias_producto_${cid}`, []);
  return local || [];
}

export async function dbSaveCategoriaProducto(cat: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const current = await getLocal<any[]>(`app_categorias_producto_${cid}`, []);
    const catId = (cat.id && isUUID(cat.id)) ? cat.id : crypto.randomUUID();
    const formatted = { ...cat, id: catId, empresa_id: empresaId };
    const idx = current.findIndex((c: any) => String(c.id) === String(catId) || c.nombre?.toLowerCase() === cat.nombre?.toLowerCase());
    let updated: any[];
    if (idx >= 0) {
      updated = [...current];
      updated[idx] = { ...updated[idx], ...formatted };
    } else {
      updated = [...current, formatted];
    }
    await setLocal(`app_categorias_producto_${cid}`, updated);

    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      try {
        const payload = {
          id: catId,
          empresa_id: empresaId,
          codigo: cat.codigo || `CAT-${String(current.length + 1).padStart(2, '0')}`,
          nombre: cat.nombre,
          descripcion: cat.descripcion || '',
          color: cat.color || 'indigo',
          activo: cat.activo ?? true
        };
        await supabase.from('categorias_producto').upsert(payload);
      } catch (err) {
        console.error("Error dbSaveCategoriaProducto Supabase:", err);
      }
    }
    return true;
  } catch (e) {
    console.error("Error saving categoria producto:", e);
    return false;
  }
}

export async function dbDeleteCategoriaProducto(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const current = await getLocal<any[]>(`app_categorias_producto_${cid}`, []);
    const filtered = current.filter((c: any) => String(c.id) !== String(id));
    await setLocal(`app_categorias_producto_${cid}`, filtered);
    if (isSupabaseConfigured && supabase && isUUID(id)) {
      try {
        await supabase.from('categorias_producto').delete().eq('id', id);
      } catch {}
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================================================
// 19. ALMACENES / DEPÓSITOS DE INVENTARIO
// ============================================================================

export const DEFAULT_ALMACEN_PRINCIPAL = {
  codigo: 'DEP-01',
  nombre: 'Almacén Principal (Central)',
  ubicacion: 'Galpón Central A',
  responsable: 'Administración',
  es_principal: true,
  activo: true
};

export async function dbFetchAlmacenes(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase
        .from('almacenes')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('es_principal', { ascending: false });
      
      if (!error && data && data.length > 0) {
        await setLocal(`app_almacenes_${cid}`, data);
        return data;
      }
    } catch (e) {
      console.warn("Error dbFetchAlmacenes:", e);
    }
  }

  const local = await getLocal<any[]>(`app_almacenes_${cid}`, []);
  if (local && local.length > 0) {
    return local;
  }
  const fallback = [{
    id: '00000000-0000-4000-8000-000000000001',
    empresa_id: cid,
    codigo: 'DEP-01',
    nombre: 'Almacén Principal (Central)',
    ubicacion: 'Galpón Central A',
    responsable: 'Administración',
    es_principal: true,
    activo: true
  }];
  await setLocal(`app_almacenes_${cid}`, fallback);
  return fallback;
}

export async function dbSaveAlmacen(almacen: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const current = await getLocal<any[]>(`app_almacenes_${cid}`, []);
    const almId = (almacen.id && isUUID(almacen.id)) ? almacen.id : crypto.randomUUID();
    const formatted = {
      ...almacen,
      id: almId,
      empresa_id: empresaId,
      es_principal: Boolean(almacen.es_principal),
      activo: almacen.activo !== false
    };

    let updated: any[];
    const idx = current.findIndex(a => String(a.id) === String(almId));
    if (idx >= 0) {
      updated = [...current];
      updated[idx] = { ...updated[idx], ...formatted };
    } else {
      updated = [...current, formatted];
    }

    // Si este almacén es marcado como principal, desmarcar los demás
    if (formatted.es_principal) {
      updated = updated.map(a => a.id === almId ? a : { ...a, es_principal: false });
    }

    await setLocal(`app_almacenes_${cid}`, updated);

    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      try {
        if (formatted.es_principal) {
          await supabase.from('almacenes').update({ es_principal: false }).eq('empresa_id', empresaId);
        }

        const payload = {
          id: almId,
          empresa_id: empresaId,
          codigo: formatted.codigo || 'DEP-01',
          nombre: formatted.nombre || 'Almacén Principal (Central)',
          ubicacion: formatted.ubicacion || null,
          responsable: formatted.responsable || null,
          es_principal: formatted.es_principal,
          activo: formatted.activo
        };
        await supabase.from('almacenes').upsert(payload, { onConflict: 'id' });
      } catch (err) {
        console.error("Error al guardar almacén en Supabase:", err);
      }
    }
    return true;
  } catch (e) {
    console.error("Error saving almacen:", e);
    return false;
  }
}

export async function dbDeleteAlmacen(id: string, empresaId: string): Promise<{ success: boolean; message?: string }> {
  const cid = empresaId || 'default';
  try {
    const current = await getLocal<any[]>(`app_almacenes_${cid}`, []);
    const target = current.find(a => String(a.id) === String(id));
    if (target?.es_principal) {
      return { success: false, message: 'El almacén principal predeterminado no se puede eliminar.' };
    }

    const products = await getLocal<any[]>(`app_products_${cid}`, []);
    const hasProducts = products.some(p => String(p.almacen_id) === String(id));
    if (hasProducts) {
      return { success: false, message: 'No se puede eliminar un almacén que contiene artículos asignados.' };
    }

    const filtered = current.filter(a => String(a.id) !== String(id));
    await setLocal(`app_almacenes_${cid}`, filtered);

    if (isSupabaseConfigured && supabase && isUUID(id)) {
      try {
        await supabase.from('almacenes').delete().eq('id', id);
      } catch (err) {
        console.error("Error al eliminar almacén en Supabase:", err);
      }
    }
    return { success: true };
  } catch (e) {
    return { success: false, message: 'Error inesperado al eliminar el almacén.' };
  }
}

export async function dbFetchMovimientosInventario(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  try {
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      try {
        const { data, error } = await supabase
          .from('movimientos_inventario')
          .select(`
            *,
            producto:productos(id, nombre, codigo)
          `)
          .eq('empresa_id', cid)
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          const mapped = data.map((row: any) => ({
            ...row,
            producto_nombre: row.producto?.nombre || row.producto_nombre || 'Producto',
            producto_codigo: row.producto?.codigo || row.producto_codigo || '',
            cantidad: Number(row.cantidad) || 0,
            stock_anterior: Number(row.stock_anterior) || 0,
            stock_resultante: Number(row.stock_resultante) || 0,
            costo_unitario: Number(row.costo_unitario) || 0
          }));
          await setLocal(`app_movimientos_inv_${cid}`, mapped);
          return mapped;
        }
      } catch (err) {
        console.error("Error dbFetchMovimientosInventario Supabase:", err);
      }
    }
    const local = await getLocal<any[]>(`app_movimientos_inv_${cid}`, []);
    if (local) {
      const parsed = local;
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch (e) {
    return [];
  }
}

export async function dbSaveMovimientoInventario(mov: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const validId = isUUID(mov.id) ? mov.id : crypto.randomUUID();
    const formatted = { ...mov, id: validId, empresa_id: cid };
    
    const current = await dbFetchMovimientosInventario(cid);
    const updated = [formatted, ...current];
    await setLocal(`app_movimientos_inv_${cid}`, updated);
    
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      try {
        const validProdId = isUUID(formatted.producto_id) ? formatted.producto_id : null;
        const validAlmOrig = isUUID(formatted.almacen_origen_id) 
          ? formatted.almacen_origen_id 
          : (formatted.tipo === 'salida' || formatted.tipo === 'venta' ? (isUUID(formatted.almacen_id) ? formatted.almacen_id : null) : null);
        const validAlmDest = isUUID(formatted.almacen_destino_id) 
          ? formatted.almacen_destino_id 
          : (formatted.tipo === 'entrada' || formatted.tipo === 'compra' ? (isUUID(formatted.almacen_id) ? formatted.almacen_id : null) : null);

        const payload: any = {
          id: validId,
          empresa_id: cid,
          producto_id: validProdId,
          tipo: formatted.tipo || 'ajuste',
          almacen_origen_id: validAlmOrig,
          almacen_destino_id: validAlmDest,
          cantidad: Number(formatted.cantidad) || 0,
          stock_anterior: Number(formatted.stock_anterior) || 0,
          stock_resultante: Number(formatted.stock_resultante) || 0,
          costo_unitario: Number(formatted.costo_unitario) || 0,
          referencia: formatted.referencia || '',
          fecha: formatted.fecha || new Date().toISOString().split('T')[0],
          usuario: formatted.usuario || 'Sistema',
          created_at: formatted.created_at || new Date().toISOString()
        };
        let { error } = await supabase.from('movimientos_inventario').upsert(payload, { onConflict: 'id' });
        if (error && error.code === '23503') {
          payload.producto_id = null;
          payload.almacen_origen_id = null;
          payload.almacen_destino_id = null;
          const retry = await supabase.from('movimientos_inventario').upsert(payload, { onConflict: 'id' });
          error = retry.error;
        }
        if (error && (error.code === '23505' || (error as any).status === 409)) {
          const updateRes = await supabase.from('movimientos_inventario').update(payload).eq('id', validId);
          error = updateRes.error;
        }
        if (error) console.error("Error dbSaveMovimientoInventario Supabase:", error);
      } catch (err) {
        console.error("Exception dbSaveMovimientoInventario Supabase:", err);
      }
    }
    
    return true;
  } catch (e) {
    console.error("Error saving stock movement:", e);
    return false;
  }
}

// ============================================================================
// 15. FACTURACIÓN DE VENTAS
// ============================================================================

export async function dbFetchFacturasVenta(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  try {
    if (isSupabaseConfigured && supabase && empresaId) {
      try {
        const { data, error } = await supabase
          .from('facturas_venta')
          .select(`
            *,
            cliente:contactos(id, name, tax_id, phone, address),
            items:facturas_venta_items(*)
          `)
          .eq('empresa_id', cid)
          .order('fecha_emision', { ascending: false });
        if (!error && data && data.length > 0) {
          const mapped = data.map((row: any) => ({
            ...row,
            cliente_nombre: row.cliente_nombre || row.cliente?.name || '',
            cliente_rif: row.cliente_rif || row.cliente?.tax_id || '',
            cliente_telefono: row.cliente_telefono || row.cliente?.phone || '',
            cliente_direccion: row.cliente_direccion || row.cliente?.address || '',
            items: Array.isArray(row.items) ? row.items.map((it: any) => ({
              ...it,
              id: it.id,
              producto_id: it.producto_id,
              descripcion: it.descripcion || '',
              cantidad: Number(it.cantidad) || 1,
              precio_unitario: Number(it.precio_unitario) || 0,
              exento: it.exento ?? false,
              subtotal: Number(it.subtotal) || 0,
              iva_monto: Number(it.iva_monto) || 0,
              total: Number(it.total) || 0,
              cuenta_ingreso_id: it.cuenta_ingreso_id,
              cuenta_costo_id: it.cuenta_costo_id,
              cuenta_inventario_id: it.cuenta_inventario_id
            })) : []
          }));
          await setLocal(`app_facturas_venta_${cid}`, mapped);
          return mapped;
        }
      } catch (err) {
        console.error("Error dbFetchFacturasVenta Supabase:", err);
      }
    }

    const local = await getLocal<any[]>(`app_facturas_venta_${cid}`, []);
    if (local) {
      const parsed = local;
      if (Array.isArray(parsed)) {
        let modified = false;
        const normalized = parsed.map((fac: any) => {
          if (fac.fecha_emision === '2026-09-13') {
            modified = true;
            return {
              ...fac,
              fecha_emision: '2026-09-12',
              fecha_vencimiento: fac.fecha_vencimiento === '2026-09-13' ? '2026-09-12' : fac.fecha_vencimiento
            };
          }
          return fac;
        });
        if (modified) {
          await setLocal(`app_facturas_venta_${cid}`, normalized);
        }
        return normalized;
      }
    }
    return [];
  } catch (e) {
    return [];
  }
}

export async function dbSaveFacturaVenta(factura: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const validId = isUUID(factura.id) ? factura.id : crypto.randomUUID();
    const formatted = { ...factura, id: validId };

    const current = await dbFetchFacturasVenta(cid);
    const idx = current.findIndex((f: any) => String(f.id) === String(formatted.id));
    let updated: any[];
    if (idx >= 0) {
      updated = [...current];
      updated[idx] = { ...updated[idx], ...formatted };
    } else {
      updated = [formatted, ...current];
    }
    await setLocal(`app_facturas_venta_${cid}`, updated);

    if (isSupabaseConfigured && supabase && empresaId) {
      try {
        const payload: any = {
          id: validId,
          empresa_id: cid,
          numero: formatted.numero || '',
          control_numero: formatted.control_numero || null,
          tipo_documento: formatted.tipo_documento || 'factura',
          condicion: formatted.condicion || 'contado',
          dias_credito: Number(formatted.dias_credito) || 0,
          fecha_emision: formatted.fecha_emision || getTodayLocalDate(),
          fecha_vencimiento: formatted.fecha_vencimiento || formatted.fecha_emision || getTodayLocalDate(),
          moneda: formatted.moneda || 'USD',
          tasa_cambio: Number(formatted.tasa_cambio) || 1.0,
          subtotal: Number(formatted.subtotal) || 0,
          base_imponible: Number(formatted.base_imponible) || Number(formatted.subtotal) || 0,
          monto_exento: Number(formatted.monto_exento) || 0,
          iva_porcentaje: Number(formatted.iva_porcentaje) || 16,
          iva_monto: Number(formatted.iva_monto) || 0,
          igtf_porcentaje: Number(formatted.igtf_porcentaje) || 0,
          igtf_monto: Number(formatted.igtf_monto) || 0,
          total: Number(formatted.total) || 0,
          saldo_pendiente: Number(formatted.saldo_pendiente !== undefined ? formatted.saldo_pendiente : (formatted.condicion === 'credito' ? formatted.total : 0)) || 0,
          estado: formatted.estado || 'emitida',
          notas: formatted.notas || null
        };
        if (isUUID(formatted.cliente_id)) payload.cliente_id = formatted.cliente_id;
        if (isUUID(formatted.comprobante_id)) payload.comprobante_id = formatted.comprobante_id;
        if (isUUID(formatted.banco_id)) payload.banco_id = formatted.banco_id;

        let { error } = await supabase.from('facturas_venta').upsert(payload, { onConflict: 'id' });
        if (error && error.code === '23503') {
          console.warn("Foreign key violation in dbSaveFacturaVenta, reintentando con fallback seguro:", error.message);
          const fallbackPayload = { ...payload };
          delete fallbackPayload.comprobante_id;
          delete fallbackPayload.banco_id;
          const retryRes = await supabase.from('facturas_venta').upsert(fallbackPayload, { onConflict: 'id' });
          error = retryRes.error;
          if (retryRes.error) console.error("Error in retry dbSaveFacturaVenta Supabase:", retryRes.error);
          else console.log("Guardado exitoso de factura_venta en Supabase con fallback seguro");
        }
        if (error && (error.code === '23505' || (error as any).status === 409)) {
          const updateRes = await supabase.from('facturas_venta').update(payload).eq('id', validId);
          error = updateRes.error;
        } else if (error) {
          console.error("Error dbSaveFacturaVenta Supabase:", error);
        }

        // Guardar renglones en facturas_venta_items
        if (Array.isArray(formatted.items) && formatted.items.length > 0) {
          await supabase.from('facturas_venta_items').delete().eq('factura_id', validId);
          const itemsPayload = formatted.items.map((it: any) => ({
            id: (it.id && isUUID(it.id)) ? it.id : crypto.randomUUID(),
            factura_id: validId,
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
          const { error: itemsErr } = await supabase.from('facturas_venta_items').insert(itemsPayload);
          if (itemsErr) console.error("Error inserting facturas_venta_items Supabase:", itemsErr);
        }
      } catch (err) {
        console.error("Exception dbSaveFacturaVenta Supabase:", err);
      }
    }

    return true;
  } catch (e) {
    console.error("Error saving sales invoice:", e);
    return false;
  }
}

export async function dbDeleteFacturaVenta(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const current = await dbFetchFacturasVenta(cid);
    const filtered = current.filter((f: any) => String(f.id) !== String(id));
    await setLocal(`app_facturas_venta_${cid}`, filtered);

    if (isSupabaseConfigured && supabase && isUUID(id)) {
      try {
        await supabase.from('facturas_venta').delete().eq('id', id);
      } catch {}
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================================================
// 15.1 FACTURACIÓN DE COMPRAS (INVENTARIO)
// ============================================================================

export async function dbFetchFacturasCompra(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  try {
    if (isSupabaseConfigured && supabase && empresaId) {
      try {
        const { data, error } = await supabase
          .from('facturas_compra')
          .select(`
            *,
            proveedor:contactos(id, name, tax_id, phone, address),
            items:facturas_compra_items(*)
          `)
          .eq('empresa_id', cid)
          .order('fecha_emision', { ascending: false });
        if (!error && data) {
          const mapped = data.map((row: any) => ({
            ...row,
            proveedor_nombre: row.proveedor_nombre || row.proveedor?.name || '',
            proveedor_rif: row.proveedor_rif || row.proveedor?.tax_id || '',
            proveedor_telefono: row.proveedor_telefono || row.proveedor?.phone || '',
            proveedor_direccion: row.proveedor_direccion || row.proveedor?.address || '',
            items: Array.isArray(row.items) ? row.items.map((it: any) => ({
              ...it,
              codigo: it.codigo || it.producto_codigo || '',
              descripcion: it.descripcion || '',
              cantidad: Number(it.cantidad) || 1,
              costo_unitario: Number(it.costo_unitario) || 0,
              subtotal: Number(it.subtotal) || 0,
              total: Number(it.total) || 0
            })) : []
          }));
          await setLocal(`app_facturas_compra_${cid}`, mapped);
          return mapped;
        }
      } catch (err) {
        console.error("Error dbFetchFacturasCompra Supabase:", err);
      }
    }
    const local = await getLocal<any[]>(`app_facturas_compra_${cid}`, []);
    if (local && Array.isArray(local)) return local;
    return [];
  } catch (e) {
    return [];
  }
}

export async function dbSaveFacturaCompra(factura: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const validId = isUUID(factura.id) ? factura.id : crypto.randomUUID();
    const formatted = { ...factura, id: validId };

    const current = await dbFetchFacturasCompra(cid);
    const idx = current.findIndex((f: any) => String(f.id) === String(formatted.id));
    let updated: any[];
    if (idx >= 0) {
      updated = [...current];
      updated[idx] = { ...updated[idx], ...formatted };
    } else {
      updated = [formatted, ...current];
    }
    await setLocal(`app_facturas_compra_${cid}`, updated);

    if (isSupabaseConfigured && supabase && empresaId) {
      try {
        const payload: any = {
          id: validId,
          empresa_id: cid,
          numero: formatted.numero || '',
          control_numero: formatted.control_numero || null,
          tipo_documento: formatted.tipo_documento || 'factura_compra',
          condicion: formatted.condicion || 'contado',
          fecha_emision: formatted.fecha_emision || getTodayLocalDate(),
          fecha_vencimiento: formatted.fecha_vencimiento || formatted.fecha_emision || getTodayLocalDate(),
          moneda: formatted.moneda || 'USD',
          tasa_cambio: Number(formatted.tasa_cambio) || 1.0,
          subtotal: Number(formatted.subtotal) || 0,
          base_imponible: Number(formatted.base_imponible) || Number(formatted.subtotal) || 0,
          monto_exento: Number(formatted.monto_exento) || 0,
          iva_porcentaje: Number(formatted.iva_porcentaje) || 0,
          iva_monto: Number(formatted.iva_monto) || 0,
          igtf_porcentaje: Number(formatted.igtf_porcentaje) || 0,
          igtf_monto: Number(formatted.igtf_monto) || 0,
          retencion_iva_porcentaje: Number(formatted.retencion_iva_porcentaje) || 0,
          retencion_iva_monto: Number(formatted.retencion_iva_monto) || 0,
          retencion_islr_porcentaje: Number(formatted.retencion_islr_porcentaje) || 0,
          retencion_islr_monto: Number(formatted.retencion_islr_monto) || 0,
          total: Number(formatted.total) || 0,
          saldo_pendiente: Number(formatted.saldo_pendiente !== undefined ? formatted.saldo_pendiente : formatted.total) || 0,
          estado: formatted.estado || 'emitida',
          notas: formatted.notas || null
        };

        if (isUUID(formatted.proveedor_id)) payload.proveedor_id = formatted.proveedor_id;
        if (isUUID(formatted.almacen_destino_id)) payload.almacen_destino_id = formatted.almacen_destino_id;
        if (isUUID(formatted.comprobante_id)) payload.comprobante_id = formatted.comprobante_id;
        if (isUUID(formatted.banco_id)) payload.banco_id = formatted.banco_id;

        let { error } = await supabase.from('facturas_compra').upsert(payload, { onConflict: 'id' });
        if (error && (error.code === '23505' || (error as any).status === 409)) {
          const updateRes = await supabase.from('facturas_compra').update(payload).eq('id', validId);
          error = updateRes.error;
        }
        if (error) console.error("Error dbSaveFacturaCompra Supabase:", error);

        // Guardar renglones en facturas_compra_items
        if (Array.isArray(formatted.items) && formatted.items.length > 0) {
          await supabase.from('facturas_compra_items').delete().eq('factura_id', validId);
          const itemsPayload = formatted.items.map((it: any) => ({
            id: (it.id && isUUID(it.id)) ? it.id : crypto.randomUUID(),
            factura_id: validId,
            producto_id: (it.producto_id && isUUID(it.producto_id)) ? it.producto_id : null,
            descripcion: it.descripcion || it.nombre || 'Artículo',
            cantidad: Number(it.cantidad) || 1,
            costo_unitario: Number(it.costo_unitario) || 0,
            exento: it.exento ?? false,
            alicuota_iva: Number(it.alicuota_iva) || 0,
            subtotal: Number(it.subtotal) || 0,
            iva_monto: Number(it.iva_monto) || 0,
            total: Number(it.total) || 0,
            actualizar_costo: it.actualizar_costo ?? true,
            nuevo_precio_venta: it.nuevo_precio_venta ? Number(it.nuevo_precio_venta) : null,
            cuenta_inventario_id: (it.cuenta_inventario_id && isUUID(it.cuenta_inventario_id)) ? it.cuenta_inventario_id : null,
            cuenta_gasto_id: (it.cuenta_gasto_id && isUUID(it.cuenta_gasto_id)) ? it.cuenta_gasto_id : null
          }));
          const { error: itemsErr } = await supabase.from('facturas_compra_items').insert(itemsPayload);
          if (itemsErr) console.error("Error inserting facturas_compra_items Supabase:", itemsErr);
        }
      } catch (err) {
        console.error("Exception dbSaveFacturaCompra Supabase:", err);
      }
    }
    return true;
  } catch (e) {
    console.error("Error saving purchase invoice:", e);
    return false;
  }
}

export async function dbDeleteFacturaCompra(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const current = await dbFetchFacturasCompra(cid);
    const filtered = current.filter((f: any) => String(f.id) !== String(id));
    await setLocal(`app_facturas_compra_${cid}`, filtered);
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('facturas_compra').delete().eq('id', id);
      } catch {}
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================================================
// 16. PUNTOS DE VENTA (POS) Y LOTES
// ============================================================================

export const DEFAULT_TERMINALES_POS: any[] = [];

export async function dbFetchTerminalesPos(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  try {
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      const { data, error } = await supabase.from('terminales_pos').select('*').eq('empresa_id', cid);
      if (!error && data) {
        await setLocal(`app_terminales_pos_${cid}`, data);
        return data;
      }
    }
    const local = await getLocal<any[]>(`app_terminales_pos_${cid}`, []);
    if (local) {
      const parsed = local;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    await setLocal(`app_terminales_pos_${cid}`, DEFAULT_TERMINALES_POS);
    return DEFAULT_TERMINALES_POS;
  } catch (e) {
    return DEFAULT_TERMINALES_POS;
  }
}

export async function dbSaveTerminalPos(term: any, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const current = await dbFetchTerminalesPos(cid);
    const index = current.findIndex((t: any) => String(t.id) === String(term.id));
    const validId = isUUID(term.id) ? term.id : crypto.randomUUID();
    const formatted = { ...term, id: validId };
    
    let updated;
    if (index >= 0) {
      updated = [...current];
      updated[index] = { ...updated[index], ...formatted, updated_at: new Date().toISOString() };
    } else {
      updated = [...current, { ...formatted, created_at: formatted.created_at || new Date().toISOString() }];
    }
    await setLocal(`app_terminales_pos_${cid}`, updated);
    
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      try {
        let cuentasList: any[] = [];
        try {
          cuentasList = await getLocal<any[]>(`erp_local_cuentas_${cid}`, []);
          if (cuentasList.length === 0) cuentasList = await dbFetchCuentasContables(cid);
        } catch {}

        const resolveUUID = (val: any) => {
          if (!val) return null;
          if (isUUID(val)) return val;
          const found = cuentasList.find(c => c.codigo === String(val) || c.id === String(val));
          if (found && isUUID(found.id)) return found.id;
          return null;
        };

        const rawTransitoria = formatted.cuenta_transitoria_id || formatted.cuentaTransitoriaId || formatted.cuenta_id;
        const rawComision = formatted.cuenta_comision_id || formatted.cuentaComisionId;

        const payload: any = {
          id: validId,
          empresa_id: cid,
          codigo: formatted.codigo || formatted.numero_terminal || formatted.id.slice(0, 8),
          nombre: formatted.nombre || 'Terminal POS',
          banco_id: isUUID(formatted.banco_id) ? formatted.banco_id : null,
          cuenta_transitoria_id: resolveUUID(rawTransitoria),
          cuenta_comision_id: resolveUUID(rawComision),
          comision_estimada: Number(formatted.comision_porcentaje || formatted.comision_estimada) || 0,
          tipo_cuenta: formatted.tipo || formatted.tipo_cuenta || 'nacional',
          moneda: formatted.moneda || 'VES',
          activo: formatted.activo !== false
        };
        const { error } = await supabase.from('terminales_pos').upsert(payload);
        if (error) console.error("Error dbSaveTerminalPos Supabase:", error);
      } catch (err) {
        console.error("Exception dbSaveTerminalPos Supabase:", err);
      }
    }
    return true;
  } catch (e) {
    console.error("Error saving POS terminal:", e);
    return false;
  }
}

export async function dbDeleteTerminalPos(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const current = await dbFetchTerminalesPos(cid);
    const filtered = current.filter((t: any) => String(t.id) !== String(id));
    await setLocal(`app_terminales_pos_${cid}`, filtered);
    
    if (isSupabaseConfigured && supabase && isUUID(id)) {
      try {
        await supabase.from('terminales_pos').delete().eq('id', id);
      } catch {}
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbFetchLotesPos(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  try {
    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      const { data, error } = await supabase
        .from('lotes_pos')
        .select(`
          *,
          transacciones:lotes_pos_transacciones(
            *,
            factura:facturas_venta(numero, cliente_nombre)
          )
        `)
        .eq('empresa_id', cid)
        .order('fecha_apertura', { ascending: false });
      
      if (!error && data) {
        const localList = await getLocal<any[]>(`app_lotes_pos_${cid}`, []);
        const localMap = new Map(localList.map((l: any) => [l.id, l]));

        const mapped = data.map((row: any) => {
          const localLote = localMap.get(row.id);
          const localTxMap = new Map((localLote?.transacciones || []).map((t: any) => [t.id, t]));

          return {
            ...row,
            transacciones: Array.isArray(row.transacciones) ? row.transacciones.map((tx: any) => {
              const localTx: any = localTxMap.get(tx.id);
              return {
                ...tx,
                factura_numero: tx.factura?.numero || localTx?.factura_numero || '',
                cliente_nombre: tx.factura?.cliente_nombre || localTx?.cliente_nombre || '',
                monto_bs: Number(tx.monto_bs) || 0,
                monto_usd: Number(tx.monto_usd) || 0
              };
            }) : (localLote?.transacciones || [])
          };
        });
        await setLocal(`app_lotes_pos_${cid}`, mapped);
        return mapped;
      }
    }
    const local = await getLocal<any[]>(`app_lotes_pos_${cid}`, []);
    if (local) {
      const parsed = local;
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch (e) {
    return [];
  }
}

export async function dbSaveLotePos(lote: any, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const validId = isUUID(lote.id) ? lote.id : crypto.randomUUID();
    const formatted = { ...lote, id: validId };

    const current = await dbFetchLotesPos(cid);
    const index = current.findIndex((l: any) => String(l.id) === String(formatted.id));
    let updated;
    if (index >= 0) {
      updated = [...current];
      updated[index] = { ...updated[index], ...formatted, updated_at: new Date().toISOString() };
    } else {
      updated = [formatted, ...current];
    }
    await setLocal(`app_lotes_pos_${cid}`, updated);

    if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
      try {
        const payload: any = {
          id: validId,
          empresa_id: cid,
          terminal_id: isUUID(formatted.terminal_id) ? formatted.terminal_id : null,
          banco_id: isUUID(formatted.banco_id) ? formatted.banco_id : null,
          comprobante_id: isUUID(formatted.comprobante_id) ? formatted.comprobante_id : null,
          lote_numero: formatted.lote_numero,
          fecha_apertura: formatted.fecha_apertura,
          fecha_cierre: formatted.fecha_cierre || null,
          total_operaciones: Number(formatted.total_operaciones) || 0,
          monto_bruto_sistema: Number(formatted.monto_bruto_sistema) || 0,
          monto_bruto_ticket: Number(formatted.monto_bruto_ticket) || 0,
          diferencia: Number(formatted.diferencia) || 0,
          comision_monto: Number(formatted.comision_monto) || 0,
          monto_neto_banco: Number(formatted.monto_neto_banco) || 0,
          estado: formatted.estado || 'abierto'
        };

        const { error } = await supabase.from('lotes_pos').upsert(payload);
        if (error) console.error("Error dbSaveLotePos Supabase:", error);

        // Save transactions
        if (Array.isArray(formatted.transacciones) && formatted.transacciones.length > 0) {
          await supabase.from('lotes_pos_transacciones').delete().eq('lote_id', validId);
          const txPayload = formatted.transacciones.map((tx: any) => {
            let validHora = '12:00:00';
            if (tx.hora && /^\d{2}:\d{2}(:\d{2})?$/.test(tx.hora)) {
              validHora = tx.hora.length === 5 ? `${tx.hora}:00` : tx.hora;
            } else {
              validHora = new Date().toTimeString().slice(0, 8);
            }

            return {
              id: isUUID(tx.id) ? tx.id : crypto.randomUUID(),
              lote_id: validId,
              factura_id: isUUID(tx.factura_id) ? tx.factura_id : null,
              referencia: tx.referencia || 'VOUCHER',
              fecha: tx.fecha || formatted.fecha_apertura,
              hora: validHora,
              monto_bs: Number(tx.monto_bs) || 0,
              monto_usd: Number(tx.monto_usd) || 0
            };
          });
          const { error: txErr } = await supabase.from('lotes_pos_transacciones').insert(txPayload);
          if (txErr) console.error("Error inserting lotes_pos_transacciones Supabase:", txErr);
        }
      } catch (err) {
        console.error("Exception dbSaveLotePos Supabase:", err);
      }
    }

    return true;
  } catch (e) {
    console.error("Error saving POS batch:", e);
    return false;
  }
}

export async function dbDeleteLotePos(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const current = await dbFetchLotesPos(cid);
    const filtered = current.filter((l: any) => String(l.id) !== String(id));
    await setLocal(`app_lotes_pos_${cid}`, filtered);
    
    if (isSupabaseConfigured && supabase && isUUID(id)) {
      try {
        await supabase.from('lotes_pos').delete().eq('id', id);
      } catch {}
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================================================
// 21. TRANSACCIONES ATÓMICAS & CORRELATIVOS CONCURRENTES (RPC POSTGRESQL)
// ============================================================================

export async function dbObtenerSiguienteCorrelativo(
  empresaId: string,
  tipoDocumento: string = 'factura'
): Promise<{
  prefijo: string;
  correlativo_asignado: number;
  numero_formateado: string;
  siguiente_correlativo: number;
  siguiente_correlativo_str: string;
} | null> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase.rpc('obtener_siguiente_correlativo', {
        p_empresa_id: empresaId,
        p_tipo_documento: tipoDocumento
      });
      if (!error && data) {
        return data;
      }
      if (error) {
        console.warn('RPC obtener_siguiente_correlativo no disponible o error:', error.message);
      }
    } catch (e) {
      console.error('Excepción al llamar obtener_siguiente_correlativo:', e);
    }
  }

  // Fallback local
  try {
    const config = await dbFetchConfiguracionContable(cid);
    let rawCorrelativo = 1;
    let prefijo = '';
    if (tipoDocumento === 'nota_entrega') {
      prefijo = config?.prefijoNotaEntrega || '';
      rawCorrelativo = parseInt(String(config?.correlativoNotaEntrega || '1'), 10) || 1;
      const next = rawCorrelativo + 1;
      await dbSaveConfiguracionContable({ ...config, correlativoNotaEntrega: formatCorrelativo(next, 6) }, cid);
    } else if (tipoDocumento === 'cotizacion') {
      prefijo = config?.prefijoCotizacion || '';
      rawCorrelativo = parseInt(String(config?.correlativoCotizacion || '1'), 10) || 1;
      const next = rawCorrelativo + 1;
      await dbSaveConfiguracionContable({ ...config, correlativoCotizacion: formatCorrelativo(next, 6) }, cid);
    } else {
      prefijo = tipoDocumento === 'nota_credito' ? 'NC-' : (tipoDocumento === 'nota_debito' ? 'ND-' : (config?.prefijoFactura || ''));
      rawCorrelativo = parseInt(String(config?.correlativoFactura || '1'), 10) || 1;
      const next = rawCorrelativo + 1;
      await dbSaveConfiguracionContable({ ...config, correlativoFactura: formatCorrelativo(next, 6) }, cid);
    }

    const formattedNum = `${prefijo}${String(rawCorrelativo).padStart(6, '0')}`;
    return {
      prefijo,
      correlativo_asignado: rawCorrelativo,
      numero_formateado: formattedNum,
      siguiente_correlativo: rawCorrelativo + 1,
      siguiente_correlativo_str: String(rawCorrelativo + 1).padStart(6, '0')
    };
  } catch (err) {
    console.error('Error fallback obtener siguiente correlativo:', err);
    return null;
  }
}

export async function dbRegistrarFacturaVentaAtomica(
  factura: any,
  items: any[],
  cxcPayload?: any,
  empresaId?: string
): Promise<{ success: boolean; factura_id?: string; numero?: string; error?: string }> {
  const cid = empresaId || factura.empresa_id || 'default';
  if (isSupabaseConfigured && supabase && isUUID(cid)) {
    try {
      const { data, error } = await supabase.rpc('registrar_factura_venta_atomica', {
        p_factura: factura,
        p_items: items,
        p_cxc: cxcPayload || null
      });

      if (!error && data?.success) {
        // Sincronizar espejo local
        await dbSaveFacturaVenta({ ...factura, id: data.factura_id, numero: data.numero, items }, cid);
        return { success: true, factura_id: data.factura_id, numero: data.numero };
      }
      if (error) {
        console.warn('RPC registrar_factura_venta_atomica error:', error.message);
      }
    } catch (e: any) {
      console.error('Excepción RPC registrar_factura_venta_atomica:', e);
    }
  }

  // Fallback estándar en cliente
  try {
    await dbSaveFacturaVenta({ ...factura, items }, cid);
    if (cxcPayload) {
      await dbSaveCxc(cxcPayload, cid);
    }
    return { success: true, factura_id: factura.id, numero: factura.numero };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error local al guardar factura' };
  }
}

// ============================================================================
// 22. SISTEMA DE AUDITORÍA FORENSE (AUDIT LOGS)
// ============================================================================

export interface AuditoriaLogEntry {
  id: string;
  empresa_id: string;
  tabla: string;
  operacion: 'INSERT' | 'UPDATE' | 'DELETE';
  registro_id?: string;
  usuario_id?: string;
  usuario_email?: string;
  valores_anteriores?: any;
  valores_nuevos?: any;
  detalles?: string;
  created_at: string;
}

export async function dbFetchAuditoriaLogs(empresaId: string, limit: number = 100): Promise<AuditoriaLogEntry[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase
        .from('auditoria_logs')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        await setLocal(`erp_local_audit_logs_${cid}`, data);
        return data;
      }
      if (error) {
        console.warn('Error fetching auditoria_logs Supabase:', error.message);
      }
    } catch (err) {
      console.error('Exception fetching audit logs:', err);
    }
  }

  // Local fallback
  const local = await getLocal<AuditoriaLogEntry[]>(`erp_local_audit_logs_${cid}`, []);
  return local || [];
}






