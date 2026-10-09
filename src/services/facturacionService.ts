import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isUUID, getLocal, setLocal, getTodayLocalDate } from './storageHelper';
import { dbFetchCuentasContables } from './contabilidadService';
import { dbSaveCxc } from './cxcCxpService';
import { enqueueMutation, getPendingQueue, mergeWithPending } from './syncQueueService';

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
          const pending = await getPendingQueue(cid);
          const merged = mergeWithPending(mapped, pending, 'facturas_venta');
          await setLocal(`app_facturas_venta_${cid}`, merged);
          return merged;
        }
      } catch (err) {
        console.error("Error dbFetchFacturasVenta Supabase:", err);
      }
    }

    const local = await getLocal<any[]>(`app_facturas_venta_${cid}`, []);
    if (local) {
      const parsed = local;
      if (Array.isArray(parsed)) {
        return parsed;
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

        const itemsPayload = (Array.isArray(formatted.items) ? formatted.items : []).map((it: any) => ({
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

        // 1. Intentar registrar de forma atómica mediante RPC en Postgres (ACID)
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('registrar_factura_venta_atomica', {
            p_factura: payload,
            p_items: itemsPayload,
            p_cxc: null
          });
          if (!rpcErr && rpcRes && rpcRes.success) {
            return true;
          }
        } catch {}

        // 2. Fallback estándar si RPC aún no fue migrado en Postgres
        let { error } = await supabase.from('facturas_venta').upsert(payload, { onConflict: 'id' });
        if (error && error.code === '23503') {
          console.warn("Foreign key violation in dbSaveFacturaVenta, reintentando con fallback seguro:", error.message);
          const fallbackPayload = { ...payload };
          delete fallbackPayload.comprobante_id;
          delete fallbackPayload.banco_id;
          const retryRes = await supabase.from('facturas_venta').upsert(fallbackPayload, { onConflict: 'id' });
          error = retryRes.error;
          if (retryRes.error) console.error("Error in retry dbSaveFacturaVenta Supabase:", retryRes.error);
        }
        if (error && (error.code === '23505' || (error as any).status === 409)) {
          const updateRes = await supabase.from('facturas_venta').update(payload).eq('id', validId);
          error = updateRes.error;
        } else if (error) {
          console.error("Error dbSaveFacturaVenta Supabase:", error);
        }

        // Guardar renglones en facturas_venta_items
        if (itemsPayload.length > 0) {
          await supabase.from('facturas_venta_items').delete().eq('factura_id', validId);
          const { error: itemsErr } = await supabase.from('facturas_venta_items').insert(itemsPayload);
          if (itemsErr) console.error("Error inserting facturas_venta_items Supabase:", itemsErr);
        }
      } catch (err) {
        console.error("Exception dbSaveFacturaVenta Supabase:", err);
        await enqueueMutation(cid, 'facturas_venta', 'UPSERT', formatted);
      }
    } else {
      await enqueueMutation(cid, 'facturas_venta', 'UPSERT', formatted);
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
      } catch {
        await enqueueMutation(cid, 'facturas_venta', 'DELETE', { id });
      }
    } else {
      await enqueueMutation(cid, 'facturas_venta', 'DELETE', { id });
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
          const pending = await getPendingQueue(cid);
          const merged = mergeWithPending(mapped, pending, 'facturas_compra');
          await setLocal(`app_facturas_compra_${cid}`, merged);
          return merged;
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
        await enqueueMutation(cid, 'facturas_compra', 'UPSERT', formatted);
      }
    } else {
      await enqueueMutation(cid, 'facturas_compra', 'UPSERT', formatted);
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
    if (isSupabaseConfigured && supabase && isUUID(id)) {
      try {
        await supabase.from('facturas_compra').delete().eq('id', id);
      } catch {
        await enqueueMutation(cid, 'facturas_compra', 'DELETE', { id });
      }
    } else {
      await enqueueMutation(cid, 'facturas_compra', 'DELETE', { id });
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

export async function dbAcumularTransaccionLotePosAtomico(
  empresaId: string,
  terminalId: string,
  transaccion: any,
  montoBs: number,
  montoUsd: number
): Promise<{ success: boolean; lote_id?: string; total_operaciones?: number; error?: string }> {
  const cid = empresaId || 'default';
  const validTx = {
    id: isUUID(transaccion.id) ? transaccion.id : crypto.randomUUID(),
    factura_id: isUUID(transaccion.factura_id) ? transaccion.factura_id : null,
    referencia: transaccion.referencia || 'VOUCHER',
    fecha: transaccion.fecha || new Date().toISOString().slice(0, 10),
    hora: transaccion.hora || new Date().toTimeString().slice(0, 8),
    monto_bs: Number(montoBs) || 0,
    monto_usd: Number(montoUsd) || 0
  };

  // 1. Ejecución atómica en PostgreSQL con bloqueo FOR UPDATE
  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase.rpc('acumular_transaccion_lote_pos_atomico', {
        p_empresa_id: empresaId,
        p_terminal_id: terminalId,
        p_transaccion: validTx,
        p_monto_bs: Number(montoBs) || 0,
        p_monto_usd: Number(montoUsd) || 0
      });

      if (!error && data && data.success) {
        return {
          success: true,
          lote_id: data.lote_id,
          total_operaciones: Number(data.total_operaciones)
        };
      }
      if (error) {
        console.warn('RPC acumular_transaccion_lote_pos_atomico no disponible, aplicando fallback:', error.message);
      }
    } catch (e: any) {
      console.warn('Excepción al invocar acumular_transaccion_lote_pos_atomico:', e?.message || e);
    }
  }

  // 2. Fallback Local-First
  try {
    const existingLotes = await dbFetchLotesPos(cid);
    let openLote = existingLotes.find((l: any) => l.terminal_id === terminalId && l.estado === 'abierto');
    if (!openLote) {
      openLote = {
        id: crypto.randomUUID(),
        empresa_id: cid,
        terminal_id: terminalId,
        lote_numero: 'EN CURSO',
        estado: 'abierto',
        fecha_apertura: new Date().toISOString().slice(0, 10),
        total_operaciones: 0,
        monto_bruto_sistema: 0,
        monto_bruto_usd: 0,
        transacciones: []
      };
    }

    const updatedLote = {
      ...openLote,
      total_operaciones: (openLote.transacciones?.length || 0) + 1,
      monto_bruto_sistema: Number(((openLote.monto_bruto_sistema || 0) + Number(montoBs || 0)).toFixed(2)),
      monto_bruto_usd: Number(((openLote.monto_bruto_usd || 0) + Number(montoUsd || 0)).toFixed(2)),
      transacciones: [...(openLote.transacciones || []), validTx]
    };

    await dbSaveLotePos(updatedLote, cid);
    return { success: true, lote_id: updatedLote.id, total_operaciones: updatedLote.total_operaciones };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error en fallback local de lote POS' };
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

