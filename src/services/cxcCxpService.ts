import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isUUID, getLocal, setLocal, getTodayLocalDate } from './storageHelper';

export const DEFAULT_CXC: any[] = [];

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
          const directClientName = row.cliente?.name || row.cliente_nombre || (typeof row.cliente === 'string' ? row.cliente : '');
          const directClientRif = row.cliente?.tax_id || row.cliente_rif || row.tax_id || '';

          // Priorizar campos estructurados sobre parsing de texto
          const matchFac = (!row.factura && !row.numero) ? desc.match(/(?:Factura(?:\s+de\s+Venta)?|Fact\.?)\s+([A-Za-z0-9\-_]+)/i) : null;
          const facturaNumero = row.factura || row.numero || row.factura_numero || (matchFac ? matchFac[1] : (row.factura_id || ''));

          const matchClient = (!directClientName) ? desc.match(/Cliente:\s*([^[–\-]+)(?:\[([A-Za-z0-9\-]+)\])?/i) : null;
          const clientNameFromDesc = matchClient ? matchClient[1].trim() : '';
          const clientRifFromDesc = matchClient && matchClient[2] ? matchClient[2].trim() : '';

          const clienteNombre = directClientName || clientNameFromDesc || '';
          const clienteRif = directClientRif || clientRifFromDesc || '';

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

export async function dbRegistrarAbonoCxcAtomico(
  empresaId: string,
  cxcId: string,
  monto: number,
  fecha?: string,
  reciboNumero?: string,
  notas?: string
): Promise<{ success: boolean; nuevo_saldo?: number; error?: string }> {
  const cid = empresaId || 'default';
  const effectiveFecha = fecha || getTodayLocalDate();
  const montoNum = Math.abs(Number(monto) || 0);

  // 1. Ejecución atómica en PostgreSQL con bloqueo pesimista FOR UPDATE
  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase.rpc('registrar_abono_cxc_atomico', {
        p_empresa_id: empresaId,
        p_cxc_id: cxcId,
        p_monto: montoNum,
        p_fecha: effectiveFecha,
        p_recibo_numero: reciboNumero || '',
        p_notas: notas || ''
      });

      if (!error && data && data.success) {
        // Reflejar cambio en almacenamiento local
        const localList = await getLocal<any[]>(`erp_local_cxc_${cid}`, []);
        const idx = localList.findIndex(c => c.id === cxcId);
        if (idx >= 0) {
          localList[idx] = {
            ...localList[idx],
            saldo: Number(data.saldo_resultante) || 0,
            saldo_pendiente: Number(data.saldo_resultante) || 0,
            estado: data.estado || localList[idx].estado
          };
          await setLocal(`erp_local_cxc_${cid}`, localList);
        }
        return { success: true, nuevo_saldo: Number(data.saldo_resultante) };
      }
      if (error) {
        console.warn('RPC registrar_abono_cxc_atomico no disponible, aplicando fallback local:', error.message);
      }
    } catch (e: any) {
      console.warn('Excepción al invocar registrar_abono_cxc_atomico:', e?.message || e);
    }
  }

  // 2. Fallback Local-First
  try {
    const localList = await getLocal<any[]>(`erp_local_cxc_${cid}`, []);
    const idx = localList.findIndex(c => c.id === cxcId);
    if (idx >= 0) {
      const currentSaldo = Number(localList[idx].saldo || localList[idx].saldo_pendiente || 0);
      const newSaldo = Math.max(0, currentSaldo - montoNum);
      const newEstado = newSaldo <= 0.009 ? 'pagada' : 'parcial';
      localList[idx] = {
        ...localList[idx],
        saldo: newSaldo,
        saldo_pendiente: newSaldo,
        estado: newEstado,
        fechaPago: newSaldo <= 0.009 ? effectiveFecha : (localList[idx].fechaPago || null)
      };
      await setLocal(`erp_local_cxc_${cid}`, localList);
      return { success: true, nuevo_saldo: newSaldo };
    }
    return { success: false, error: 'Documento CxC no encontrado localmente' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error registrando abono local' };
  }
}

export async function dbRegistrarAbonoCxpAtomico(
  empresaId: string,
  cxpId: string,
  monto: number,
  fecha?: string,
  comprobanteNumero?: string,
  notas?: string
): Promise<{ success: boolean; nuevo_saldo?: number; error?: string }> {
  const cid = empresaId || 'default';
  const effectiveFecha = fecha || getTodayLocalDate();
  const montoNum = Math.abs(Number(monto) || 0);

  // 1. Ejecución atómica en PostgreSQL con bloqueo pesimista FOR UPDATE
  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase.rpc('registrar_abono_cxp_atomico', {
        p_empresa_id: empresaId,
        p_cxp_id: cxpId,
        p_monto: montoNum,
        p_fecha: effectiveFecha,
        p_recibo_numero: comprobanteNumero || '',
        p_notas: notas || ''
      });

      if (!error && data && data.success) {
        const localList = await getLocal<any[]>(`erp_local_cxp_${cid}`, []);
        const idx = localList.findIndex(c => c.id === cxpId);
        if (idx >= 0) {
          localList[idx] = {
            ...localList[idx],
            saldo: Number(data.saldo_resultante) || 0,
            saldo_pendiente: Number(data.saldo_resultante) || 0,
            estado: data.estado || localList[idx].estado
          };
          await setLocal(`erp_local_cxp_${cid}`, localList);
        }
        return { success: true, nuevo_saldo: Number(data.saldo_resultante) };
      }
      if (error) {
        console.warn('RPC registrar_abono_cxp_atomico no disponible, aplicando fallback local:', error.message);
      }
    } catch (e: any) {
      console.warn('Excepción al invocar registrar_abono_cxp_atomico:', e?.message || e);
    }
  }

  // 2. Fallback Local-First
  try {
    const localList = await getLocal<any[]>(`erp_local_cxp_${cid}`, []);
    const idx = localList.findIndex(c => c.id === cxpId);
    if (idx >= 0) {
      const currentSaldo = Number(localList[idx].saldo || localList[idx].saldo_pendiente || 0);
      const newSaldo = Math.max(0, currentSaldo - montoNum);
      const newEstado = newSaldo <= 0.009 ? 'pagada' : 'parcial';
      localList[idx] = {
        ...localList[idx],
        saldo: newSaldo,
        saldo_pendiente: newSaldo,
        estado: newEstado,
        fechaPago: newSaldo <= 0.009 ? effectiveFecha : (localList[idx].fechaPago || null)
      };
      await setLocal(`erp_local_cxp_${cid}`, localList);
      return { success: true, nuevo_saldo: newSaldo };
    }
    return { success: false, error: 'Documento CxP no encontrado localmente' };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error registrando abono CxP local' };
  }
}


