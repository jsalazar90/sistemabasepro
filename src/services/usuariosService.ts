import bcrypt from 'bcryptjs';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isUUID, getLocal, setLocal, delLocal } from './storageHelper';

// ============================================================================
// 10. USUARIOS Y PERMISOS RBAC
// ============================================================================



/**
 * Elimina restos de la clave de operaciones en texto plano que versiones anteriores
 * guardaban en IndexedDB, localStorage y en la lista local de usuarios.
 */
export async function purgeLegacyClaveOperaciones(): Promise<void> {
  try {
    await delLocal('erp_master_clave_operaciones');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sistema_master_clave_operaciones');
    }
    const localUsers = await getLocal<any[]>('erp_local_usuarios', []);
    if (Array.isArray(localUsers) && localUsers.some(u => u && ('claveOperaciones' in u || 'clave_operaciones' in u || 'password' in u))) {
      const cleaned = localUsers.map(u => {
        if (!u) return u;
        // Elimina también contraseñas en texto plano que versiones antiguas dejaron en el equipo
        const { claveOperaciones, clave_operaciones, password, ...rest } = u;
        return rest;
      });
      await setLocal('erp_local_usuarios', cleaned);
    }
  } catch {}
}

/**
 * Define o cambia la clave de operaciones de un usuario Master.
 * La clave se convierte en hash dentro de la base de datos (nunca se guarda en claro).
 * Requiere conexión y que quien llama sea Master.
 */
export async function dbSaveMasterClaveOperaciones(
  newClave: string,
  usuarioId: string
): Promise<{ success: boolean; error?: string }> {
  const cleanKey = (newClave || '').trim();
  if (cleanKey.length < 6) {
    return { success: false, error: 'La clave de operaciones debe tener al menos 6 caracteres.' };
  }
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Se requiere conexión con el servidor para cambiar la clave de operaciones.' };
  }
  if (!isUUID(usuarioId)) {
    return { success: false, error: 'Usuario inválido: guarde primero el usuario en el servidor.' };
  }
  try {
    const { error } = await supabase.rpc('set_clave_operaciones', {
      p_usuario_id: usuarioId,
      p_nueva: cleanKey
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'No se pudo guardar la clave de operaciones.' };
  }
}

/** Indica si un usuario Master ya tiene clave configurada (sin revelarla). */
export async function dbClaveOperacionesConfigurada(usuarioId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !isUUID(usuarioId)) return false;
  try {
    const { data, error } = await supabase.rpc('clave_operaciones_configurada', { p_usuario_id: usuarioId });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function dbFetchUsuarios(): Promise<any[]> {
  const local = await getLocal<any[]>('erp_local_usuarios', []);
  const localMap = new Map<string, any>((local || []).map(u => [u.email?.toLowerCase(), u]));
  await purgeLegacyClaveOperaciones();

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('usuarios').select('id, email, nombre, role, activo, created_at').order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        const mappedUsers = (data || []).map((u: any) => {
          const localUser = localMap.get(u.email?.toLowerCase());
          return {
            id: u.id,
            email: u.email,
            name: u.nombre || u.email.split('@')[0],
            // El hash para acceso offline es solo local: nunca viene del servidor
            password_hash: localUser?.password_hash || null,
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
  const rawPass = usuario.password || usuario.password_hash || '';
  let passHash = '';
  if (rawPass) {
    passHash = (rawPass.startsWith('$2a$') || rawPass.startsWith('$2b$'))
      ? rawPass
      : bcrypt.hashSync(String(rawPass), 10);
  }

  // La clave de operaciones NO se guarda aquí: se gestiona con dbSaveMasterClaveOperaciones (hash en servidor)
  const formatted: any = {
    id: (usuario.id && isUUID(usuario.id)) ? usuario.id : crypto.randomUUID(),
    email: usuario.email.trim().toLowerCase(),
    name: usuario.name || usuario.nombre || usuario.email.split('@')[0],
    role: usuario.role || 'Operador',
    activo: usuario.activo !== false
  };
  // El hash se guarda SOLO en este equipo (acceso offline); solo se sobrescribe si llega uno nuevo
  if (passHash) formatted.password_hash = passHash;

  const idx = list.findIndex(u => u.id === formatted.id || u.email === formatted.email);
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  await setLocal('erp_local_usuarios', list);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('usuarios').upsert({
        id: formatted.id,
        email: formatted.email,
        nombre: formatted.name,
        role: formatted.role,
        activo: formatted.activo
      });
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

export async function dbVerifyMasterClaveOperaciones(
  claveInput: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = String(claveInput || '').trim();
  if (!trimmed) return { success: false };

  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Se requiere conexión con el servidor para autorizar esta operación.' };
  }

  try {
    // La verificación ocurre en el servidor (hash bcrypt + límite de intentos)
    const { data, error } = await supabase.rpc('verify_clave_operaciones', { p_clave: trimmed });
    if (error) return { success: false, error: error.message };
    return { success: data === true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'No se pudo verificar la clave de operaciones.' };
  }
}

/**
 * Crea un usuario con acceso al sistema. Solo un Master puede hacerlo.
 * Con Supabase configurado, la cuenta se crea en el servidor (Supabase Auth) sin tocar la sesión actual.
 * Sin Supabase (modo local), se crea solo en este equipo.
 */
export async function dbCrearUsuarioAdmin(params: {
  email: string;
  password: string;
  nombre?: string;
  role: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const email = params.email.trim().toLowerCase();
  if ((params.password || '').length < 8) {
    return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.rpc('admin_crear_usuario', {
        p_email: email,
        p_password: params.password,
        p_nombre: params.nombre || email.split('@')[0],
        p_role: params.role
      });
      if (error) return { success: false, error: error.message };
      return { success: true, id: String(data) };
    } catch (e: any) {
      return { success: false, error: e?.message || 'No se pudo crear el usuario.' };
    }
  }

  // Modo local (sin Supabase)
  const id = crypto.randomUUID();
  await dbSaveUsuario({
    id,
    email,
    name: params.nombre || email.split('@')[0],
    role: params.role,
    activo: true,
    password: params.password
  });
  return { success: true, id };
}

/**
 * Cambia la contraseña de acceso de un usuario. Solo un Master puede hacerlo.
 * Con Supabase configurado, cambia la contraseña real de Supabase Auth y cierra las sesiones de ese usuario.
 */
export async function dbCambiarPasswordAdmin(
  usuarioId: string,
  nuevaPassword: string
): Promise<{ success: boolean; error?: string }> {
  if ((nuevaPassword || '').length < 8) {
    return { success: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  }

  if (isSupabaseConfigured && supabase) {
    if (!isUUID(usuarioId)) {
      return { success: false, error: 'Usuario inválido: no está registrado en el servidor.' };
    }
    try {
      const { error } = await supabase.rpc('admin_cambiar_password', {
        p_usuario_id: usuarioId,
        p_password: nuevaPassword
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'No se pudo cambiar la contraseña.' };
    }
  }

  // Modo local (sin Supabase)
  const list = await getLocal<any[]>('erp_local_usuarios', []);
  const idx = list.findIndex(u => u.id === usuarioId);
  if (idx < 0) return { success: false, error: 'Usuario no encontrado.' };
  list[idx] = { ...list[idx], password_hash: bcrypt.hashSync(nuevaPassword, 10) };
  await setLocal('erp_local_usuarios', list);
  return { success: true };
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

