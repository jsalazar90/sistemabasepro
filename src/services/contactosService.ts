import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isUUID, getLocal, setLocal, getTodayLocalDate } from './storageHelper';
import { enqueueMutation, getPendingQueue, mergeWithPending } from './syncQueueService';

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
        const mapped = (data || []).map((row: any) => {
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
        const pending = await getPendingQueue(cid);
        const merged = mergeWithPending(mapped, pending, 'contactos');
        await setLocal(`erp_local_contactos_${cid}`, merged);
        return merged;
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
        await enqueueMutation(cid, 'contactos', 'UPSERT', formatted);
      }
    } catch (e) {
      console.warn('Error de red al guardar contacto en Supabase:', e);
      await enqueueMutation(cid, 'contactos', 'UPSERT', formatted);
    }
  } else {
    await enqueueMutation(cid, 'contactos', 'UPSERT', formatted);
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
    } catch {
      await enqueueMutation(cid, 'contactos', 'DELETE', { id });
    }
  } else {
    await enqueueMutation(cid, 'contactos', 'DELETE', { id });
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

