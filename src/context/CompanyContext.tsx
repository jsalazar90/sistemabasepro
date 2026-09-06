import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

import { UserSession, INITIAL_DEFAULT_USERS } from "../data/defaultUsers";
import { dbFetchEmpresas } from "../services/db";

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
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [workingYear, setWorkingYear] = useState<string>(() => String(new Date().getFullYear()));
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [dbUsers, setDbUsers] = useState<UserSession[]>(INITIAL_DEFAULT_USERS);
  const [currentUserEmpresas, setCurrentUserEmpresas] = useState<any[]>([]);

  // Estado de Sesión de Usuario en memoria (con fallback al usuario Master por defecto)
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    const saved = sessionStorage.getItem("erp_active_user") || localStorage.getItem("erp_active_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_DEFAULT_USERS[0];
      }
    }
    return INITIAL_DEFAULT_USERS[0];
  });

  const refreshCompanies = async (userParam?: UserSession | null) => {
    try {
      const activeUser = userParam !== undefined ? userParam : currentUser;
      const dbList = await dbFetchEmpresas();
      
      let userPermittedCompanies = dbList;
      let userEmpresas: any[] = [];

      // ÚNICAMENTE el rol Master tiene acceso irrestricto a todas las empresas
      if (activeUser && activeUser.role !== 'Master') {
        const { dbFetchUsuarioEmpresas } = await import("../services/db");
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
        const selected = prev && userPermittedCompanies.some(c => c.id === prev) 
          ? prev 
          : (userPermittedCompanies.length > 0 ? userPermittedCompanies[0].id : null);
        const found = userPermittedCompanies.find(c => c.id === selected);
        if (found && ((found as any).workingYear || (found as any).anoInicio)) {
          setWorkingYear((found as any).workingYear || (found as any).anoInicio);
        }
        return selected;
      });
    } catch (e) {
      console.warn("Error cargando empresas de Supabase:", e);
      setAvailableCompanies([]);
      setActiveCompanyId(null);
    }
  };

  // Cargar empresas y usuarios directamente de Supabase
  useEffect(() => {
    refreshCompanies(currentUser);
    async function loadUsers() {
      try {
        const { dbFetchUsuarios } = await import("../services/db");
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
  }, [currentUser?.id, currentUser?.email]);

  // Autenticación Login contra base de datos
  const login = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    let usersList = dbUsers;
    try {
      const { dbFetchUsuarios } = await import("../services/db");
      const remoteUsers = await dbFetchUsuarios();
      if (remoteUsers && remoteUsers.length > 0) {
        usersList = remoteUsers;
        setDbUsers(remoteUsers);
      }
    } catch (e) {
      // fallback to memory
    }

    let user = usersList.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user && cleanEmail === "jefe@halleyerp.com" && cleanPass === "19072828") {
      user = INITIAL_DEFAULT_USERS[0];
    }

    if (!user) {
      return { success: false, error: "El correo electrónico ingresado no se encuentra registrado en el sistema." };
    }

    if (user.activo === false) {
      return { success: false, error: "Esta cuenta de usuario ha sido suspendida. Contacte al Administrador Master." };
    }

    if (user.password !== cleanPass) {
      return { success: false, error: "Contraseña incorrecta. Por favor intente nuevamente." };
    }

    // Login Exitoso
    setCurrentUser(user);
    sessionStorage.setItem("erp_active_user", JSON.stringify(user));
    await refreshCompanies(user);
    return { success: true };
  };

  // Cierre de Sesión
  const logout = () => {
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
  activeCompanyId: 'empresa-local-1',
  setActiveCompanyId: () => {},
  availableCompanies: [
    {
      id: 'empresa-local-1',
      name: 'Agencia de Viajes y Turismo Halley, C.A.',
      taxId: 'J-12345678-0',
      nombre: 'Agencia de Viajes y Turismo Halley, C.A.',
      rif: 'J-12345678-0',
      direccion: 'Av. Principal, Edificio Torre Empresarial, Piso 5',
      telefono: '+58 212 555-0100',
      email: 'administracion@agenciaprincipal.com',
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

