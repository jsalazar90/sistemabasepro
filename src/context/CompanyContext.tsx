import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

import bcrypt from 'bcryptjs';
import { UserSession, INITIAL_DEFAULT_USERS } from "../data/defaultUsers";
import { dbFetchEmpresas, dbFetchUsuarioEmpresas, dbFetchUsuarios, dbSaveUsuario } from "../services/db";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export type { UserSession };

export interface Company {
  id: string;
  name: string;
  taxId: string;
  nombre?: string;
  rif?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  logo?: string;
  monedaPrincipal?: string;
  monedaSecundaria?: string;
  tipoContribuyente?: string;
  tipoEmpresa?: string;
  habilitarPOS?: boolean;
  habilitarVendedores?: boolean;
  habilitarPedidos?: boolean;
  habilitarTasaReferencial?: boolean;
  anoInicio?: string;
  workingYear?: string;
}

interface CompanyContextType {
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string | null) => void;
  availableCompanies: Company[];
  setAvailableCompanies: (companies: Company[]) => void;
  refreshCompanies: () => Promise<void>;
  syncVersion: number;
  triggerDataReload: () => void;
  userRole: string;
  userPermissions: Record<
    string,
    { view: boolean; create: boolean; delete: boolean }
  >;
  isUserInactive: boolean;
  vendedorId?: string | null;
  vendedorNombre?: string | null;
  workingYear: string;
  setWorkingYear: (year: string) => void;
  currentUser: UserSession | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

export const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const ALL_MODULES = [
  "contactos",
  "facturacion",
  "cuentasCobrar",
  "cuentasPagar",
  "bancos",
  "contabilidad",
  "inventario",
  "nomina",
  "transporte",
  "expedientes",
  "rutas",
  "informes",
  "disenador",
  "callcenter",
  "vendedores",
  "pedidosRecibidos",
  "configuracion",
];

const fullPermissions: Record<string, { view: boolean; create: boolean; delete: boolean }> = {};
ALL_MODULES.forEach((m) => {
  fullPermissions[m] = { view: true, create: true, delete: true };
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(() => {
    return localStorage.getItem("erp_active_company_id") || null;
  });
  const [workingYear, setWorkingYear] = useState<string>(() => String(new Date().getFullYear()));
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [dbUsers, setDbUsers] = useState<UserSession[]>(INITIAL_DEFAULT_USERS);
  const [currentUserEmpresas, setCurrentUserEmpresas] = useState<any[]>([]);
  const [syncVersion, setSyncVersion] = useState<number>(0);

  const triggerDataReload = () => {
    setSyncVersion(v => v + 1);
  };

  // Guardar activeCompanyId en localStorage para que nuevas pestañas y ventanas popup lo reconozcan de inmediato
  useEffect(() => {
    if (activeCompanyId) {
      localStorage.setItem("erp_active_company_id", activeCompanyId);
    }
  }, [activeCompanyId]);

  // Estado de Sesión de Usuario en memoria
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const saved = sessionStorage.getItem("erp_active_user") || localStorage.getItem("erp_active_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) {
          if (parsed.email.toLowerCase() === 'jefe@halleyerp.com') {
            sessionStorage.removeItem("erp_active_user");
            localStorage.removeItem("erp_active_user");
            return null;
          }
          return parsed;
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const refreshCompanies = async (userParam?: UserSession | null) => {
    try {
      const activeUser = userParam !== undefined ? userParam : currentUser;

      // Si Supabase está configurado pero no hay usuario autenticado activo,
      // no cargamos empresas ni asignamos IDs por defecto para evitar contaminar la sesión en PCs nuevas
      if (isSupabaseConfigured && !activeUser) {
        setAvailableCompanies([]);
        setActiveCompanyId(null);
        return;
      }

      const dbList = await dbFetchEmpresas();
      
      let userPermittedCompanies = dbList;
      let userEmpresas: any[] = [];

      // ÚNICAMENTE el rol Master tiene acceso irrestricto a todas las empresas
      if (activeUser && activeUser.role !== 'Master') {
        userEmpresas = await dbFetchUsuarioEmpresas(activeUser.id);
        setCurrentUserEmpresas(userEmpresas);
        
        userPermittedCompanies = dbList.filter(comp => 
          userEmpresas.some(ue => ue.empresa_id === comp.id && ue.activo !== false)
        );
      } else {
        setCurrentUserEmpresas([]);
      }

      setAvailableCompanies(userPermittedCompanies);
      
      setActiveCompanyId(prev => {
        const stored = localStorage.getItem("erp_active_company_id");
        const candidate = prev || stored;
        const selected = candidate && userPermittedCompanies.some(c => c.id === candidate) 
          ? candidate 
          : (userPermittedCompanies.length > 0 ? userPermittedCompanies[0].id : null);
        if (selected) {
          localStorage.setItem("erp_active_company_id", selected);
          const found = userPermittedCompanies.find(c => c.id === selected);
          if (found) {
            try {
              localStorage.setItem("erp_cached_active_company", JSON.stringify(found));
            } catch {}
            if ((found as any).workingYear || (found as any).anoInicio) {
              setWorkingYear((found as any).workingYear || (found as any).anoInicio);
            }
          }
        }
        return selected;
      });

      setSyncVersion(v => v + 1);
    } catch (e) {
      console.warn("Error cargando empresas de Supabase:", e);
      setAvailableCompanies([]);
      setActiveCompanyId(null);
    }
  };

  // Sincronización continua de sesión y persistencia en Supabase Auth
  useEffect(() => {
    let isMounted = true;

    async function syncAuthSession() {
      try {
        if (!isSupabaseConfigured || !supabase) {
          refreshCompanies(currentUser);
          return;
        }

        // 1. Obtener la sesión activa persistida de Supabase Auth
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && isMounted) {
          const email = session.user.email?.toLowerCase();
          if (email) {
            const { data: userData } = await supabase.from('usuarios').select('id, email, nombre, role, activo').eq('email', email).maybeSingle();
            const isSuperAdmin = email === 'jhoansg@gmail.com';
            const user: UserSession = {
              id: userData?.id || session.user.id,
              email: email,
              name: userData?.nombre || session.user.user_metadata?.nombre || email.split('@')[0],
              role: isSuperAdmin ? 'Master' : (userData?.role || 'Operador'),
              activo: true,
              companyRoles: {},
              companyConfigs: {}
            };
            setCurrentUser(user);
            sessionStorage.setItem("erp_active_user", JSON.stringify(user));
            localStorage.setItem("erp_active_user", JSON.stringify(user));
            await refreshCompanies(user);
            setSyncVersion(v => v + 1);
          } else if (currentUser) {
            await refreshCompanies(currentUser);
          } else {
            setAvailableCompanies([]);
            setActiveCompanyId(null);
          }
        } else if (currentUser) {
          await refreshCompanies(currentUser);
        } else {
          setAvailableCompanies([]);
          setActiveCompanyId(null);
        }

        // 2. Suscribirse reactivamente a cambios de sesión de Supabase Auth
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (!isMounted) return;
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (currentSession?.user) {
              const email = currentSession.user.email?.toLowerCase();
              if (email) {
                const { data: userData } = await supabase.from('usuarios').select('id, email, nombre, role, activo').eq('email', email).maybeSingle();
                const isSuperAdmin = email === 'jhoansg@gmail.com';
                const user: UserSession = {
                  id: userData?.id || currentSession.user.id,
                  email: email,
                  name: userData?.nombre || currentSession.user.user_metadata?.nombre || email.split('@')[0],
                  role: isSuperAdmin ? 'Master' : (userData?.role || 'Operador'),
                  activo: true,
                  companyRoles: {},
                  companyConfigs: {}
                };
                setCurrentUser(user);
                sessionStorage.setItem("erp_active_user", JSON.stringify(user));
                localStorage.setItem("erp_active_user", JSON.stringify(user));
                await refreshCompanies(user);
                setSyncVersion(v => v + 1);
              }
            }
          } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            sessionStorage.removeItem("erp_active_user");
            localStorage.removeItem("erp_active_user");
            localStorage.removeItem("erp_active_company_id");
            localStorage.removeItem("erp_cached_active_company");
            setAvailableCompanies([]);
            setActiveCompanyId(null);
            setSyncVersion(v => v + 1);
          }
        });

        return () => {
          authListener?.subscription?.unsubscribe();
        };
      } catch (err) {
        console.warn("Error en syncAuthSession:", err);
      }
    }

    syncAuthSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Cargar lista de usuarios cuando el usuario activo es Master
  useEffect(() => {
    async function loadUsers() {
      if (!currentUser) return;
      try {
        const list = await dbFetchUsuarios();
        if (list && list.length > 0) {
          setDbUsers(list);
        } else {
          setDbUsers(INITIAL_DEFAULT_USERS);
        }
      } catch (e) {
        setDbUsers(INITIAL_DEFAULT_USERS);
      }
    }
    loadUsers();
  }, [currentUser?.id, currentUser?.email, currentUser?.role]);

  // Autenticación Login contra base de datos
  const login = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (cleanEmail === 'jefe@halleyerp.com') {
      sessionStorage.removeItem("erp_active_user");
      localStorage.removeItem("erp_active_user");
      return { 
        success: false, 
        error: "El usuario jefe@halleyerp.com ha sido revocado y eliminado permanentemente del sistema. Inicie sesión con jhoansg@gmail.com." 
      };
    }

    try {
      if (isSupabaseConfigured && supabase) {
        // 1. Autenticación Segura con Supabase Auth (estrictamente signIn, jamás signUp libre)
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPass
        });

        if (authError) {
          // Si el servidor de autenticación respondió explícitamente con credenciales inválidas, rechazar de inmediato
          const isCredError = authError.message?.toLowerCase().includes('credential') || 
                              authError.message?.toLowerCase().includes('invalid') ||
                              authError.status === 400;

          if (isCredError) {
            return {
              success: false,
              error: 'Credenciales inválidas. Por favor verifique su correo electrónico y contraseña.'
            };
          }
          // Solo se permite el acceso offline ante fallos reales de conexión (no ante límites de intentos u otros errores)
          const status = (authError as any).status;
          const isConnectivityError =
            (authError as any).name === 'AuthRetryableFetchError' ||
            status === 0 ||
            (typeof status === 'number' && status >= 502 && status <= 504);

          if (!isConnectivityError) {
            return {
              success: false,
              error: status === 429
                ? 'Demasiados intentos. Espere unos minutos antes de volver a intentar.'
                : 'No se pudo iniciar sesión: ' + (authError.message || 'error del servidor') + '.'
            };
          }
          console.warn("Fallo temporal de conexión con Supabase Auth, intentando verificación local...", authError.message);
        } else if (authData?.user) {
          // 2. Obtener metadatos del usuario desde public.usuarios
          const { data: userData } = await supabase.from('usuarios').select('id, email, nombre, role, activo').eq('email', cleanEmail).maybeSingle();
          
          if (userData && userData.activo === false) {
            await supabase.auth.signOut();
            return { success: false, error: "Esta cuenta de usuario ha sido suspendida. Contacte al Administrador Master." };
          }

          const isSuperAdmin = cleanEmail === 'jhoansg@gmail.com';
          const assignedRole = isSuperAdmin ? 'Master' : (userData?.role || 'Operador');

          const user: UserSession = {
            id: userData?.id || authData.user.id,
            email: cleanEmail,
            name: userData?.nombre || cleanEmail.split('@')[0],
            role: assignedRole,
            activo: true,
            companyRoles: {},
            companyConfigs: {}
          };

          // Guardar hash bcrypt local para permitir inicio seguro offline futuro
          try {
            const localUsers = await dbFetchUsuarios();
            const existingLocal = localUsers.find(u => u.email?.toLowerCase() === cleanEmail);
            const hashed = bcrypt.hashSync(cleanPass, 10);
            await dbSaveUsuario({
              ...(existingLocal || {}),
              id: user.id,
              email: cleanEmail,
              name: user.name,
              role: assignedRole,
              activo: true,
              password_hash: hashed
            });
          } catch {}

          setCurrentUser(user);
          sessionStorage.setItem("erp_active_user", JSON.stringify(user));
          localStorage.setItem("erp_active_user", JSON.stringify(user));
          await refreshCompanies(user);
          setSyncVersion(v => v + 1);
          return { success: true };
        }
      }
    } catch (e: any) {
      console.warn("Fallo de red al conectar con Supabase Auth, procediendo a verificación local...", e);
    }

    // --- FALLBACK LOCAL OFFLINE SEGURO ---
    let usersList = dbUsers;
    try {
      const remoteUsers = await dbFetchUsuarios();
      if (remoteUsers && remoteUsers.length > 0) {
        usersList = remoteUsers;
        setDbUsers(remoteUsers);
      }
    } catch (e) {
      // fallback to memory
    }

    const user = usersList.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return { success: false, error: "El correo electrónico ingresado no se encuentra registrado en el sistema." };
    }

    if (user.activo === false) {
      return { success: false, error: "Esta cuenta de usuario ha sido suspendida." };
    }

    // Validación estricta de contraseña en modo local
    const storedPass = user.password_hash;
    if (!storedPass) {
      return {
        success: false,
        error: "Este equipo no cuenta con credenciales locales guardadas para este usuario. Inicie sesión al menos una vez con conexión a internet para habilitar el acceso offline."
      };
    }

    let isPasswordValid = false;
    if (storedPass.startsWith('$2a$') || storedPass.startsWith('$2b$')) {
      try {
        isPasswordValid = bcrypt.compareSync(cleanPass, storedPass);
      } catch {
        isPasswordValid = false;
      }
    } else {
      // Ya no se aceptan contraseñas en texto plano: se exige iniciar sesión con conexión para regenerar el acceso offline
      return {
        success: false,
        error: "Las credenciales guardadas en este equipo están desactualizadas. Inicie sesión con conexión a internet para renovarlas."
      };
    }

    if (!isPasswordValid) {
      return { success: false, error: "Contraseña incorrecta. Por favor intente nuevamente." };
    }

    // Login Exitoso Local
    setCurrentUser(user);
    sessionStorage.setItem("erp_active_user", JSON.stringify(user));
    localStorage.setItem("erp_active_user", JSON.stringify(user));
    await refreshCompanies(user);
    setSyncVersion(v => v + 1);
    return { success: true };
  };

  // Cierre de Sesión
  const logout = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {}
    setCurrentUser(null);
    setCurrentUserEmpresas([]);
    setActiveCompanyId(null);
    setAvailableCompanies([]);
    sessionStorage.removeItem("erp_active_user");
    localStorage.removeItem("erp_active_user");
    localStorage.removeItem("erp_active_company_id");
    localStorage.removeItem("erp_cached_active_company");
    setSyncVersion(v => v + 1);
  };

  // Cálculo reactivo de rol y permisos según usuario y empresa activa
  const activeCompanyPerm = currentUserEmpresas.find(ue => ue.empresa_id === activeCompanyId);
  const userRole = currentUser?.role === 'Master'
    ? 'Master'
    : (activeCompanyPerm?.role || currentUser?.role || "Operador");

  const userPermissions = currentUser?.role === 'Master'
    ? fullPermissions
    : (activeCompanyPerm?.permissions || fullPermissions);

  const isUserInactive = currentUser?.activo === false;
  const vendedorId = activeCompanyPerm?.vendedor_id || currentUser?.vendedorId || null;
  const vendedorNombre = activeCompanyPerm?.vendedor_nombre || currentUser?.vendedorNombre || null;

  return (
    <CompanyContext.Provider
      value={{
        activeCompanyId,
        setActiveCompanyId,
        availableCompanies,
        setAvailableCompanies,
        refreshCompanies: () => refreshCompanies(currentUser),
        syncVersion,
        triggerDataReload,
        userRole,
        userPermissions,
        isUserInactive,
        vendedorId,
        vendedorNombre,
        workingYear,
        setWorkingYear,
        currentUser,
        login,
        logout,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

const defaultFallbackContext: CompanyContextType = {
  activeCompanyId: '00000000-0000-0000-0000-000000000001',
  setActiveCompanyId: () => {},
  availableCompanies: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Corporación Halley, C.A.',
      taxId: 'J-12345678-0',
      nombre: 'Corporación Halley, C.A.',
      rif: 'J-12345678-0',
      direccion: 'Av. Principal, Edificio Torre Empresarial, Piso 5',
      telefono: '+58 212 555-0100',
      email: 'administracion@corporacionhalley.com',
      monedaPrincipal: 'USD',
      monedaSecundaria: 'VES'
    }
  ],
  setAvailableCompanies: () => {},
  refreshCompanies: async () => {},
  syncVersion: 0,
  triggerDataReload: () => {},
  userRole: 'Administrador',
  userPermissions: fullPermissions,
  isUserInactive: false,
  vendedorId: null,
  vendedorNombre: null,
  workingYear: String(new Date().getFullYear()),
  setWorkingYear: () => {},
  currentUser: INITIAL_DEFAULT_USERS[0],
  login: async () => ({ success: true }),
  logout: () => {}
};

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    return defaultFallbackContext;
  }
  return context;
}

