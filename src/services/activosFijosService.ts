import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isUUID, getLocal, setLocal } from './storageHelper';

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

