import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isUUID, getLocal, setLocal } from './storageHelper';

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

