import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isUUID, getLocal, setLocal, getTodayLocalDate } from './storageHelper';

export const DEFAULT_BANCOS: any[] = [];
export const DEFAULT_MOVIMIENTOS_BANCOS: any[] = [];

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
        const mapped = (data || []).map((row: any) => {
          const localItem = localList.find((l: any) => l.id === row.id);
          const isCaja = !!(row.es_caja || (row.tipo || '').toLowerCase().includes('caja'));
          return {
            id: row.id,
            banco: row.banco,
            numeroCuenta: row.numero_cuenta,
            cuenta: row.numero_cuenta,
            numero_cuenta: row.numero_cuenta,
            tipo: row.tipo || 'Corriente',
            tipo_cuenta: row.tipo_cuenta || 'nacional',
            moneda: row.moneda || 'Bolivares',
            saldo: Number(row.saldo) || 0,
            tasa: Number(row.tasa) || 1.0,
            es_caja: isCaja,
            cuentaContableId: row.cuenta_contable_id || localItem?.cuentaContableId || '1.1.3',
            cuenta_contable_id: row.cuenta_contable_id || localItem?.cuenta_contable_id || '1.1.3',
            activo: row.activo ?? true
          };
        });
        await setLocal(`erp_local_bancos_${cid}`, mapped);
        return mapped;
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
  const isCaja = !!(banco.es_caja || (banco.tipo || '').toLowerCase().includes('caja'));
  const formatted = {
    id: bancoId,
    banco: banco.banco,
    numeroCuenta: banco.cuenta || banco.numeroCuenta || banco.numero_cuenta || '0000-0000-0000-0000',
    cuenta: banco.cuenta || banco.numeroCuenta || banco.numero_cuenta || '0000-0000-0000-0000',
    numero_cuenta: banco.cuenta || banco.numeroCuenta || banco.numero_cuenta || '0000-0000-0000-0000',
    tipo: banco.tipo || 'Corriente',
    tipo_cuenta: banco.tipo_cuenta || 'nacional',
    moneda: banco.moneda || 'USD',
    saldo: Number(banco.saldo) || 0,
    tasa: Number(banco.tasa) || 1.0,
    es_caja: isCaja,
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
        es_caja: formatted.es_caja,
        tipo_cuenta: formatted.tipo_cuenta,
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
        const mapped = (data || []).map((row: any) => ({
          id: row.id,
          bancoId: row.banco_id,
          banco_id: row.banco_id,
          fecha: row.fecha,
          ref: row.ref || '',
          descripcion: row.descripcion,
          tipo: row.tipo,
          monto: Number(row.monto) || 0,
          montoBs: row.monto_bs !== undefined && row.monto_bs !== null ? Number(row.monto_bs) : undefined,
          tasa: Number(row.tasa) || 1.0,
          comprobanteId: row.comprobante_id || '',
          comprobante_id: row.comprobante_id || '',
          estado: row.estado || 'conciliado',
          notas: row.notas || '',
          created_at: row.created_at,
          createdAt: row.created_at
        }));
        await setLocal(`erp_local_movimientos_bancos_${cid}`, mapped);
        return mapped;
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



