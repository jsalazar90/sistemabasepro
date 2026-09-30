import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

import { UserSession, INITIAL_DEFAULT_USERS } from "../data/defaultUsers";
import { dbFetchEmpresas, dbFetchUsuarioEmpresas, dbFetchUsuarios } from "../services/db";
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
        }
        const found = userPermittedCompanies.find(c => c.id === selected);
        if (found) {
          try {
            localStorage.setItem("erp_cached_active_company", JSON.stringify(found));
          } catch {}
          if ((found as any).workingYear || (found as any).anoInicio) {
            setWorkingYear((found as any).workingYear || (found as any).anoInicio);
          }
        }
        return selected;
      });
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
            const { data: userData } = await supabase.from('usuarios').select('*').eq('email', email).maybeSingle();
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
            await refreshCompanies(user);
          } else {
            await refreshCompanies(currentUser);
          }
        } else {
          await refreshCompanies(currentUser);
        }

        // 2. Suscribirse reactivamente a cambios de sesión de Supabase Auth
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (!isMounted) return;
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (currentSession?.user) {
              const email = currentSession.user.email?.toLowerCase();
              if (email) {
                const { data: userData } = await supabase.from('usuarios').select('*').eq('email', email).maybeSingle();
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
                await refreshCompanies(user);
              }
            }
          } else if (event === 'SIGNED_OUT') {
            setCurrentUser(null);
            sessionStorage.removeItem("erp_active_user");
            localStorage.removeItem("erp_active_user");
            setAvailableCompanies([]);
            setActiveCompanyId(null);
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
        // 1. Autenticación Segura con Supabase Auth
        let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPass
        });

        if (authError) {
          // Si el usuario no ha sido provisionado en auth.users, intentar signUp
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPass
          });

          if (!signUpError && signUpData.user) {
            const retry = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password: cleanPass
            });
            if (retry.data?.user) {
              authData = retry.data;
              authError = null;
            }
          }
        }

        if (authError || !authData?.user) {
           return { 
             success: false, 
             error: authError?.message?.includes('credentials') 
               ? 'Contraseña incorrecta o usuario no registrado en el sistema de seguridad.' 
               : (authError?.message || 'Error de autenticación.')
           };
        }

        // 2. Obtener metadatos del usuario desde public.usuarios
        const { data: userData } = await supabase.from('usuarios').select('*').eq('email', cleanEmail).maybeSingle();
        
        if (userData && userData.activo === false) {
          await supabase.auth.signOut();
          return { success: false, error: "Esta cuenta de usuario ha sido suspendida. Contacte al Administrador Master." };
        }

        // Si el usuario es el administrador principal legal, forzar rol Master para que vea todas las empresas
        const isSuperAdmin = cleanEmail === 'jhoansg@gmail.com';
        const assignedRole = isSuperAdmin ? 'Master' : (userData?.role || 'Operador');

        // Auto-registrar al Master en la base de datos pública si es su primera vez
        if (isSuperAdmin && !userData) {
          try {
            await supabase.from('usuarios').upsert({
              id: authData.user.id,
              email: cleanEmail,
              nombre: 'Jhoan SG',
              role: 'Master',
              activo: true
            });
          } catch (e) {
            console.warn("No se pudo auto-registrar al master:", e);
          }
        }

        const user: UserSession = {
          id: userData?.id || authData.user.id,
          email: cleanEmail,
          name: userData?.nombre || cleanEmail.split('@')[0],
          role: assignedRole,
          activo: true,
          companyRoles: {},
          companyConfigs: {}
        };

        setCurrentUser(user);
        sessionStorage.setItem("erp_active_user", JSON.stringify(user));
        await refreshCompanies(user);
        return { success: true };
      }
    } catch (e: any) {
      console.warn("Fallo de red o Supabase Auth, intentando fallback local...", e);
    }

    // --- FALLBACK LOCAL OFFLINE ---
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

    let user = usersList.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return { success: false, error: "El correo electrónico ingresado no se encuentra registrado en el sistema." };
    }

    if (user.activo === false) {
      return { success: false, error: "Esta cuenta de usuario ha sido suspendida." };
    }

    if (user.password && user.password !== cleanPass) {
      return { success: false, error: "Contraseña local incorrecta. Por favor intente nuevamente." };
    }

    // Login Exitoso Local
    setCurrentUser(user);
    sessionStorage.setItem("erp_active_user", JSON.stringify(user));
    await refreshCompanies(user);
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
    sessionStorage.removeItem("erp_active_user");
    localStorage.removeItem("erp_active_user");
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

