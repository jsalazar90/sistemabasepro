import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Company } from '../context/CompanyContext';
import { isUUID, getLocal, setLocal, delLocal, DEFAULT_LOCAL_COMPANY } from './storageHelper';
import { formatCorrelativo } from '../utils/numberFormat';
import { DEFAULT_CUENTAS } from './contabilidadService';
import { DEFAULT_BANCOS, DEFAULT_MOVIMIENTOS_BANCOS } from './bancosService';
import { DEFAULT_LOCAL_CONTACTS } from './contactosService';
import { DEFAULT_CXC, DEFAULT_CXP, DEFAULT_COBRANZAS, DEFAULT_PAGOS_REALIZADOS } from './cxcCxpService';

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

