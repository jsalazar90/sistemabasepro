export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: string;
  password?: string;
  claveOperaciones?: string;
  activo?: boolean;
  companyRoles: Record<string, string>;
  companyConfigs?: Record<
    string,
    {
      role: string;
      permissions?: Record<
        string,
        { view: boolean; create: boolean; delete: boolean }
      >;
      vendedorId?: string | null;
      vendedorNombre?: string | null;
    }
  >;
}

export const INITIAL_DEFAULT_USERS: UserSession[] = [
  {
    id: "u-master-1",
    email: "jefe@halleyerp.com",
    name: "Administrador Master",
    role: "Master",
    password: "19072828",
    claveOperaciones: "19072828",
    activo: true,
    companyRoles: { "*": "Master" },
    companyConfigs: {}
  }
];
