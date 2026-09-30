import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isUUID, getLocal, setLocal, getTodayLocalDate } from './storageHelper';
import { enqueueMutation, getPendingQueue, mergeWithPending } from './syncQueueService';

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
        const pending = await getPendingQueue(cid);
        const merged = mergeWithPending(mapped, pending, 'productos');
        await setLocal(`app_products_${cid}`, merged);
        return merged;
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
          await enqueueMutation(cid, 'productos', 'UPSERT', formatted);
        }
      } catch (err) {
        console.error("Error en dbSaveProduct:", err);
        await enqueueMutation(cid, 'productos', 'UPSERT', formatted);
      }
    } else {
      await enqueueMutation(cid, 'productos', 'UPSERT', formatted);
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
      } catch {
        await enqueueMutation(cid, 'productos', 'DELETE', { id });
      }
    } else {
      await enqueueMutation(cid, 'productos', 'DELETE', { id });
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
          const pending = await getPendingQueue(cid);
          const merged = mergeWithPending(mapped, pending, 'movimientos_inventario');
          await setLocal(`app_movimientos_inv_${cid}`, merged);
          return merged;
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
        if (error) {
          console.error("Error dbSaveMovimientoInventario Supabase:", error);
          await enqueueMutation(cid, 'movimientos_inventario', 'UPSERT', formatted);
        }
      } catch (err) {
        console.error("Exception dbSaveMovimientoInventario Supabase:", err);
        await enqueueMutation(cid, 'movimientos_inventario', 'UPSERT', formatted);
      }
    } else {
      await enqueueMutation(cid, 'movimientos_inventario', 'UPSERT', formatted);
    }
    
    return true;
  } catch (e) {
    console.error("Error saving stock movement:", e);
    return false;
  }
}

// ============================================================================
// 14.2 CONTROL ATÓMICO DE STOCK (RPC POSTGRESQL + LOCAL-FIRST FALLBACK)
// ============================================================================

export interface StockAtomicOptions {
  costoUnitario?: number;
  actualizarCosto?: boolean;
  almacenOrigenId?: string;
  almacenDestinoId?: string;
  referencia?: string;
  usuario?: string;
  permitirNegativo?: boolean;
}

export interface StockAtomicResult {
  success: boolean;
  producto_id?: string;
  stock_anterior?: number;
  stock_resultante?: number;
  costo_promedio?: number;
  movimiento_id?: string;
  error?: string;
}

export interface StockBatchItem {
  producto_id: string;
  cantidad: number;
  costo_unitario?: number;
  actualizar_costo?: boolean;
  almacen_origen_id?: string;
  almacen_destino_id?: string;
}

export interface StockBatchOptions {
  referencia?: string;
  usuario?: string;
  permitirNegativo?: boolean;
}

export interface StockBatchResult {
  success: boolean;
  items_procesados?: number;
  error?: string;
}

export async function dbActualizarStockAtomico(
  empresaId: string,
  productoId: string,
  cantidad: number,
  tipo: string = 'venta',
  options?: StockAtomicOptions
): Promise<StockAtomicResult> {
  const cid = empresaId || 'default';
  const cantAbs = Math.abs(Number(cantidad) || 0);
  const esSalida = ['venta', 'salida', 'traslado_salida'].includes(tipo);

  // 1. Intentar ejecución atómica mediante RPC en Supabase / PostgreSQL
  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase.rpc('actualizar_stock_atomico', {
        p_empresa_id: empresaId,
        p_producto_id: productoId,
        p_cantidad: cantidad,
        p_tipo: tipo,
        p_costo_unitario: options?.costoUnitario ?? null,
        p_actualizar_costo: options?.actualizarCosto ?? false,
        p_almacen_origen_id: options?.almacenOrigenId ?? null,
        p_almacen_destino_id: options?.almacenDestinoId ?? null,
        p_referencia: options?.referencia ?? '',
        p_usuario: options?.usuario ?? 'Sistema',
        p_permitir_negativo: options?.permitirNegativo ?? false
      });

      if (!error && data) {
        if (data.success) {
          // Actualizar caché local de productos
          const products = await getLocal<any[]>(`app_products_${cid}`, []);
          const idx = products.findIndex((p: any) => String(p.id) === String(productoId));
          if (idx >= 0) {
            products[idx] = {
              ...products[idx],
              stock_actual: Number(data.stock_resultante),
              costo_promedio: Number(data.costo_promedio)
            };
            await setLocal(`app_products_${cid}`, products);
          }
          return {
            success: true,
            producto_id: productoId,
            stock_anterior: Number(data.stock_anterior),
            stock_resultante: Number(data.stock_resultante),
            costo_promedio: Number(data.costo_promedio),
            movimiento_id: data.movimiento_id
          };
        } else {
          return {
            success: false,
            error: data.error || 'Error al actualizar stock atómico en base de datos'
          };
        }
      }
    } catch (e: any) {
      console.warn('[dbActualizarStockAtomico] RPC falló o no disponible, aplicando fallback local:', e?.message || e);
    }
  }

  // 2. Fallback Local-First / Modo Offline
  try {
    const products = await getLocal<any[]>(`app_products_${cid}`, []);
    const idx = products.findIndex((p: any) => String(p.id) === String(productoId));
    if (idx < 0) {
      return {
        success: false,
        error: `Producto no encontrado: ${productoId}`
      };
    }

    const prod = products[idx];
    const stockAnterior = Number(prod.stock_actual) || 0;
    let stockResultante: number;
    let nuevoCostoUnitario = Number(prod.costo_unitario) || 0;
    let nuevoCostoPromedio = Number(prod.costo_promedio) || nuevoCostoUnitario;

    if (esSalida) {
      stockResultante = stockAnterior - cantAbs;
      if (stockResultante < 0 && !options?.permitirNegativo) {
        return {
          success: false,
          error: `Stock insuficiente para ${prod.nombre || productoId}. Disponible: ${stockAnterior}, Requerido: ${cantAbs}`
        };
      }
    } else {
      stockResultante = stockAnterior + cantAbs;
      if (options?.costoUnitario !== undefined && options.costoUnitario !== null && options.costoUnitario > 0) {
        if (options.actualizarCosto) {
          nuevoCostoUnitario = Number(options.costoUnitario);
        }
        if (stockResultante > 0) {
          nuevoCostoPromedio = ((Math.max(0, stockAnterior) * nuevoCostoPromedio) + (cantAbs * Number(options.costoUnitario))) / (Math.max(0, stockAnterior) + cantAbs);
        }
      }
    }

    // Actualizar producto local
    const updatedProd = {
      ...prod,
      stock_actual: stockResultante,
      costo_unitario: nuevoCostoUnitario,
      costo_promedio: nuevoCostoPromedio,
      updated_at: new Date().toISOString()
    };
    products[idx] = updatedProd;
    await setLocal(`app_products_${cid}`, products);

    // Generar movimiento Kardex local
    const movId = (crypto as any).randomUUID ? crypto.randomUUID() : `mov-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const movRecord = {
      id: movId,
      empresa_id: cid,
      producto_id: productoId,
      producto_nombre: prod.nombre,
      producto_codigo: prod.codigo,
      tipo,
      almacen_origen_id: options?.almacenOrigenId || null,
      almacen_destino_id: options?.almacenDestinoId || null,
      cantidad: cantAbs,
      stock_anterior: stockAnterior,
      stock_resultante: stockResultante,
      costo_unitario: options?.costoUnitario ?? prod.costo_unitario ?? 0,
      referencia: options?.referencia || '',
      fecha: getTodayLocalDate ? getTodayLocalDate() : new Date().toISOString().split('T')[0],
      usuario: options?.usuario || 'Sistema',
      created_at: new Date().toISOString()
    };

    const movs = await getLocal<any[]>(`app_movimientos_inv_${cid}`, []);
    await setLocal(`app_movimientos_inv_${cid}`, [movRecord, ...(movs || [])]);

    // Encolar mutaciones a la cola Outbox para sincronización asíncrona
    await enqueueMutation(cid, 'productos', 'UPSERT', updatedProd);
    await enqueueMutation(cid, 'movimientos_inventario', 'UPSERT', movRecord);

    return {
      success: true,
      producto_id: productoId,
      stock_anterior: stockAnterior,
      stock_resultante: stockResultante,
      costo_promedio: nuevoCostoPromedio,
      movimiento_id: movId
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error inesperado al actualizar stock local'
    };
  }
}

export async function dbActualizarStockLoteAtomico(
  empresaId: string,
  items: StockBatchItem[],
  tipo: string = 'venta',
  options?: StockBatchOptions
): Promise<StockBatchResult> {
  const cid = empresaId || 'default';

  // 1. Intentar ejecución atómica por RPC en Supabase
  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase.rpc('actualizar_stock_lote_atomico', {
        p_empresa_id: empresaId,
        p_items: items,
        p_tipo: tipo,
        p_referencia: options?.referencia ?? '',
        p_usuario: options?.usuario ?? 'Sistema',
        p_permitir_negativo: options?.permitirNegativo ?? false
      });

      if (!error && data) {
        if (data.success) {
          return {
            success: true,
            items_procesados: Number(data.items_procesados) || items.length
          };
        } else {
          return {
            success: false,
            error: data.error || 'Error al procesar lote atómico en base de datos'
          };
        }
      }
    } catch (e: any) {
      console.warn('[dbActualizarStockLoteAtomico] RPC falló, aplicando fallback local:', e?.message || e);
    }
  }

  // 2. Fallback Local-First con validación atómica previa (All-or-Nothing)
  try {
    const products = await getLocal<any[]>(`app_products_${cid}`, []);
    const esSalida = ['venta', 'salida', 'traslado_salida'].includes(tipo);

    // Validación preventiva de existencias si no se permite negativo
    if (esSalida && !options?.permitirNegativo) {
      for (const it of items) {
        const p = products.find((prod: any) => String(prod.id) === String(it.producto_id));
        if (!p) {
          return { success: false, error: `Producto no encontrado en inventario: ${it.producto_id}` };
        }
        const req = Math.abs(Number(it.cantidad) || 0);
        const disp = Number(p.stock_actual) || 0;
        if (disp < req) {
          return {
            success: false,
            error: `Stock insuficiente para ${p.nombre || p.codigo}. Disponible: ${disp}, Requerido: ${req}`
          };
        }
      }
    }

    let procesados = 0;
    for (const item of items) {
      const res = await dbActualizarStockAtomico(empresaId, item.producto_id, item.cantidad, tipo, {
        costoUnitario: item.costo_unitario,
        actualizarCosto: item.actualizar_costo,
        almacenOrigenId: item.almacen_origen_id,
        almacenDestinoId: item.almacen_destino_id,
        referencia: options?.referencia,
        usuario: options?.usuario,
        permitirNegativo: options?.permitirNegativo
      });

      if (!res.success) {
        return {
          success: false,
          error: res.error,
          items_procesados: procesados
        };
      }
      procesados++;
    }

    return {
      success: true,
      items_procesados: procesados
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Error procesando lote de actualización de inventario'
    };
  }
}

