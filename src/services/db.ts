import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Company } from '../context/CompanyContext';

// Helper local storage
function getLocal<T>(key: string, defaultVal: T): T {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : defaultVal;
  } catch {
    return defaultVal;
  }
}

function setLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
}

export const DEFAULT_LOCAL_COMPANY: Company = {
  id: 'empresa-local-1',
  name: 'Agencia de Viajes y Turismo Halley, C.A.',
  taxId: 'J-12345678-0',
  nombre: 'Agencia de Viajes y Turismo Halley, C.A.',
  rif: 'J-12345678-0',
  direccion: 'Av. Principal, Edificio Torre Empresarial, Piso 5',
  telefono: '+58 212 555-0100',
  email: 'administracion@agenciaprincipal.com',
  logo: '',
  monedaPrincipal: 'USD',
  monedaSecundaria: 'VES',
  tipoContribuyente: 'ordinario',
  tipoEmpresa: 'turismo',
  anoInicio: String(new Date().getFullYear()),
  workingYear: String(new Date().getFullYear()),
  habilitarPOS: true,
  habilitarVendedores: true,
  habilitarPedidos: true,
  habilitarTasaReferencial: true,
};

// ============================================================================
// 1. EMPRESAS
// ============================================================================

export async function dbFetchEmpresas(): Promise<Company[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('empresas').select('*').order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        return (data || []).map((row: any) => ({
          id: row.id,
          name: row.nombre,
          taxId: row.rif,
          nombre: row.nombre,
          rif: row.rif,
          anoInicio: row.ano_inicio || row.working_year || String(new Date().getFullYear()),
          workingYear: row.working_year || String(new Date().getFullYear()),
          direccion: row.direccion || '',
          telefono: row.telefono || '',
          email: row.email || '',
          logo: row.logo || '',
          monedaPrincipal: row.moneda_principal || 'USD',
          monedaSecundaria: row.moneda_secundaria || 'VES',
          tipoContribuyente: row.tipo_contribuyente || 'ordinario',
          tipoEmpresa: row.tipo_empresa || 'comercial',
          habilitarPOS: row.habilitar_pos ?? true,
          habilitarVendedores: row.habilitar_vendedores ?? true,
          habilitarPedidos: row.habilitar_pedidos ?? true,
          habilitarTasaReferencial: row.habilitar_tasa_referencial ?? false,
        }));
      }
    } catch (err: any) {
      console.warn('Error al consultar empresas de Supabase, usando local:', err);
    }
  }

  // Fallback localStorage
  const local = getLocal<Company[]>('erp_local_empresas', [DEFAULT_LOCAL_COMPANY]);
  if (!local || local.length === 0) {
    setLocal('erp_local_empresas', [DEFAULT_LOCAL_COMPANY]);
    return [DEFAULT_LOCAL_COMPANY];
  }
  return local;
}

export async function dbSaveEmpresa(empresa: any): Promise<{ success: boolean; error?: string }> {
  const compId = empresa.id || `comp_${Date.now()}`;
  const localList = getLocal<Company[]>('erp_local_empresas', [DEFAULT_LOCAL_COMPANY]);
  const formatted: Company = {
    id: compId,
    name: empresa.nombre || empresa.name || 'Empresa Local',
    taxId: empresa.rif || empresa.taxId || 'J-00000000-0',
    nombre: empresa.nombre || empresa.name || 'Empresa Local',
    rif: empresa.rif || empresa.taxId || 'J-00000000-0',
    direccion: empresa.direccion || '',
    telefono: empresa.telefono || '',
    email: empresa.email || '',
    logo: empresa.logo || '',
    monedaPrincipal: empresa.monedaPrincipal || 'USD',
    monedaSecundaria: empresa.monedaSecundaria || 'VES',
    tipoContribuyente: empresa.tipoContribuyente || 'ordinario',
    tipoEmpresa: empresa.tipoEmpresa || 'turismo',
    anoInicio: empresa.anoInicio || empresa.workingYear || String(new Date().getFullYear()),
    workingYear: empresa.workingYear || empresa.anoInicio || String(new Date().getFullYear()),
    habilitarPOS: empresa.habilitarPOS ?? true,
    habilitarVendedores: empresa.habilitarVendedores ?? true,
    habilitarPedidos: empresa.habilitarPedidos ?? true,
    habilitarTasaReferencial: empresa.habilitarTasaReferencial ?? false,
  };

  const existingIdx = localList.findIndex(c => c.id === compId);
  let updatedList: Company[];
  if (existingIdx >= 0) {
    updatedList = [...localList];
    updatedList[existingIdx] = { ...updatedList[existingIdx], ...formatted };
  } else {
    updatedList = [...localList, formatted];
  }
  setLocal('erp_local_empresas', updatedList);

  if (isSupabaseConfigured && supabase) {
    try {
      const payload = {
        id: compId,
        nombre: formatted.nombre,
        rif: formatted.rif,
        direccion: formatted.direccion,
        telefono: formatted.telefono,
        email: formatted.email,
        logo: formatted.logo,
        moneda_principal: formatted.monedaPrincipal,
        moneda_secundaria: formatted.monedaSecundaria,
        tipo_contribuyente: formatted.tipoContribuyente,
        tipo_empresa: formatted.tipoEmpresa,
        habilitar_pos: formatted.habilitarPOS,
        habilitar_vendedores: formatted.habilitarVendedores,
        habilitar_pedidos: formatted.habilitarPedidos,
        habilitar_tasa_referencial: formatted.habilitarTasaReferencial,
        updated_at: new Date().toISOString()
      };
      await supabase.from('empresas').upsert(payload);
    } catch {}
  }
  return { success: true };
}

export async function dbDeleteEmpresa(id: string): Promise<{ success: boolean; error?: string }> {
  const localList = getLocal<Company[]>('erp_local_empresas', [DEFAULT_LOCAL_COMPANY]);
  const filtered = localList.filter(c => c.id !== id);
  setLocal('erp_local_empresas', filtered.length > 0 ? filtered : [DEFAULT_LOCAL_COMPANY]);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('empresas').delete().eq('id', id);
    } catch {}
  }
  return { success: true };
}

// ============================================================================
// PLAN DE CUENTAS NIIF COMPLETO PARA BALANCES Y AUDITORÍAS (59+ CUENTAS)
// Cuadrado exacto: Activos = Pasivos ($1,149,850) + Patrimonio ($625,000) = $1,774,850
// Incluye sobregiro bancario negativo y cuentas de valuación de activos para paginación multi-hoja
// ============================================================================
export const SAMPLE_FULL_BALANCE_CUENTAS = [
  // 1. ACTIVOS
  { id: "1", codigo: "1", nombre: "ACTIVO", nivel: 1, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1", codigo: "1.1", nombre: "Activo Corriente", nivel: 2, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  
  // 1.1.01 Disponible / Efectivo
  { id: "1.1.01", codigo: "1.1.01", nombre: "Efectivo y Equivalentes de Efectivo", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.01.001", codigo: "1.1.01.001", nombre: "Caja Chica Administración", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 2500, saldoActual: 2500 },
  { id: "1.1.01.002", codigo: "1.1.01.002", nombre: "Caja Chica Ventas & Tiendas", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 1800, saldoActual: 1800 },
  { id: "1.1.01.003", codigo: "1.1.01.003", nombre: "Caja Bóveda Principal Moneda Extranjera", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 45000, saldoActual: 45000 },
  { id: "1.1.01.004", codigo: "1.1.01.004", nombre: "Banesco Banco Universal (Cuenta Cte)", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 68450, saldoActual: 68450 },
  { id: "1.1.01.005", codigo: "1.1.01.005", nombre: "Banco Mercantil (Sobregiro Operativo NIIF)", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: -15200, saldoActual: -15200 },
  { id: "1.1.01.006", codigo: "1.1.01.006", nombre: "BBVA Banco Provincial (Cuenta Cte)", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 34200, saldoActual: 34200 },
  { id: "1.1.01.007", codigo: "1.1.01.007", nombre: "Banco Nacional de Crédito BNC", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 22100, saldoActual: 22100 },
  { id: "1.1.01.008", codigo: "1.1.01.008", nombre: "JPMorgan Chase Bank (USD Operaciones)", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 115000, saldoActual: 115000 },
  { id: "1.1.01.009", codigo: "1.1.01.009", nombre: "Fondos de Inversión Líquida a Corto Plazo", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 30000, saldoActual: 30000 },

  // 1.1.02 Inversiones Temporales
  { id: "1.1.02", codigo: "1.1.02", nombre: "Inversiones Financieras a Corto Plazo", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.02.001", codigo: "1.1.02.001", nombre: "Certificados de Depósito a Plazo Fijo", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 40000, saldoActual: 40000 },
  { id: "1.1.02.002", codigo: "1.1.02.002", nombre: "Bonos Soberanos e Inversiones Negociables", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 25000, saldoActual: 25000 },

  // 1.1.03 Exigible / Cuentas por Cobrar
  { id: "1.1.03", codigo: "1.1.03", nombre: "Deudores Comerciales y Cuentas por Cobrar", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.03.001", codigo: "1.1.03.001", nombre: "Clientes Nacionales al Día", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 85400, saldoActual: 85400 },
  { id: "1.1.03.002", codigo: "1.1.03.002", nombre: "Clientes en Gestión de Cobranza Morosa", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 18600, saldoActual: 18600 },
  { id: "1.1.03.003", codigo: "1.1.03.003", nombre: "Provisión para Cuentas Incobrables", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: -4500, saldoActual: -4500 },
  { id: "1.1.03.004", codigo: "1.1.03.004", nombre: "Cuentas por Cobrar a Empresas Filiales", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 32000, saldoActual: 32000 },
  { id: "1.1.03.005", codigo: "1.1.03.005", nombre: "Cuentas por Cobrar a Empleados y Préstamos", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 6750, saldoActual: 6750 },
  { id: "1.1.03.006", codigo: "1.1.03.006", nombre: "Anticipos a Proveedores y Contratistas", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 24500, saldoActual: 24500 },
  { id: "1.1.03.007", codigo: "1.1.03.007", nombre: "Reclamaciones a Compañías de Seguros", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 8200, saldoActual: 8200 },

  // 1.1.04 Inventarios
  { id: "1.1.04", codigo: "1.1.04", nombre: "Inventarios y Mercancías", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.04.001", codigo: "1.1.04.001", nombre: "Inventario de Mercancía para la Venta", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 142500, saldoActual: 142500 },
  { id: "1.1.04.002", codigo: "1.1.04.002", nombre: "Mercancías en Tránsito e Importación", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 38600, saldoActual: 38600 },
  { id: "1.1.04.003", codigo: "1.1.04.003", nombre: "Inventario de Repuestos y Accesorios", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 21400, saldoActual: 21400 },
  { id: "1.1.04.004", codigo: "1.1.04.004", nombre: "Inventario de Materiales de Embalaje", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 7800, saldoActual: 7800 },

  // 1.1.05 Otros Activos Corrientes
  { id: "1.1.05", codigo: "1.1.05", nombre: "Otros Activos Corrientes y Pagos Anticipados", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.05.001", codigo: "1.1.05.001", nombre: "Crédito Fiscal IVA por Compensar", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 16400, saldoActual: 16400 },
  { id: "1.1.05.002", codigo: "1.1.05.002", nombre: "Retenciones de IVA Soportadas en Ventas", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 11250, saldoActual: 11250 },
  { id: "1.1.05.003", codigo: "1.1.05.003", nombre: "Anticipos de ISLR Declarados", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 14800, saldoActual: 14800 },
  { id: "1.1.05.004", codigo: "1.1.05.004", nombre: "Seguros de Flota Pagados por Anticipado", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 9600, saldoActual: 9600 },
  { id: "1.1.05.005", codigo: "1.1.05.005", nombre: "Alquileres de Sedes Pagados por Anticipado", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 12000, saldoActual: 12000 },

  // 1.2 ACTIVO NO CORRIENTE
  { id: "1.2", codigo: "1.2", nombre: "Activo No Corriente", nivel: 2, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.2.01", codigo: "1.2.01", nombre: "Propiedad, Planta y Equipos (Fijos)", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.2.01.001", codigo: "1.2.01.001", nombre: "Terrenos Industriales y Urbanos", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 220000, saldoActual: 220000 },
  { id: "1.2.01.002", codigo: "1.2.01.002", nombre: "Edificaciones Comerciales y Galpón Principal", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 380000, saldoActual: 380000 },
  { id: "1.2.01.003", codigo: "1.2.01.003", nombre: "Depreciación Acumulada de Edificaciones", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: -38000, saldoActual: -38000 },
  { id: "1.2.01.004", codigo: "1.2.01.004", nombre: "Maquinarias y Equipos Industriales", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 145000, saldoActual: 145000 },
  { id: "1.2.01.005", codigo: "1.2.01.005", nombre: "Depreciación Acumulada de Maquinarias", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: -29000, saldoActual: -29000 },
  { id: "1.2.01.006", codigo: "1.2.01.006", nombre: "Vehículos y Camiones de Carga Pesada", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 190000, saldoActual: 190000 },
  { id: "1.2.01.007", codigo: "1.2.01.007", nombre: "Depreciación Acumulada de Vehículos", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: -45000, saldoActual: -45000 },
  { id: "1.2.01.008", codigo: "1.2.01.008", nombre: "Equipos de Computación, Redes y Servidores", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 52000, saldoActual: 52000 },
  { id: "1.2.01.009", codigo: "1.2.01.009", nombre: "Depreciación Acumulada Equipos de Computación", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: -18200, saldoActual: -18200 },
  { id: "1.2.01.010", codigo: "1.2.01.010", nombre: "Mobiliario, Muebles y Enseres de Oficina", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 34500, saldoActual: 34500 },
  { id: "1.2.01.011", codigo: "1.2.01.011", nombre: "Depreciación Acumulada de Mobiliario", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: -8600, saldoActual: -8600 },

  // 1.2.02 Intangibles y Diferidos
  { id: "1.2.02", codigo: "1.2.02", nombre: "Activos Intangibles y Diferidos", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.2.02.001", codigo: "1.2.02.001", nombre: "Licencias de Software y Sistemas ERP", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 45000, saldoActual: 45000 },
  { id: "1.2.02.002", codigo: "1.2.02.002", nombre: "Amortización Acumulada de Software", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: -12000, saldoActual: -12000 },
  { id: "1.2.02.003", codigo: "1.2.02.003", nombre: "Marcas Registradas y Patentes", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 30000, saldoActual: 30000 },
  { id: "1.2.02.004", codigo: "1.2.02.004", nombre: "Depósitos en Garantía a Largo Plazo", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 15000, saldoActual: 15000 },

  // 2. PASIVOS
  { id: "2", codigo: "2", nombre: "PASIVO", nivel: 1, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1", codigo: "2.1", nombre: "Pasivo Corriente", nivel: 2, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },

  // 2.1.01 Comerciales
  { id: "2.1.01", codigo: "2.1.01", nombre: "Cuentas y Obligaciones Comerciales por Pagar", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1.01.001", codigo: "2.1.01.001", nombre: "Proveedores Nacionales Comerciales", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 125400, saldoActual: 125400 },
  { id: "2.1.01.002", codigo: "2.1.01.002", nombre: "Proveedores del Exterior e Importaciones", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 78500, saldoActual: 78500 },
  { id: "2.1.01.003", codigo: "2.1.01.003", nombre: "Contratistas y Servicios Especializados por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 28600, saldoActual: 28600 },
  { id: "2.1.01.004", codigo: "2.1.01.004", nombre: "Facturas Pendientes de Recibir / Provisiones", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 14200, saldoActual: 14200 },

  // 2.1.02 Laborales
  { id: "2.1.02", codigo: "2.1.02", nombre: "Obligaciones Laborales y con el Personal", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1.02.001", codigo: "2.1.02.001", nombre: "Sueldos y Salarios por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 32400, saldoActual: 32400 },
  { id: "2.1.02.002", codigo: "2.1.02.002", nombre: "Vacaciones y Bono Vacacional Acumulado", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 19800, saldoActual: 19800 },
  { id: "2.1.02.003", codigo: "2.1.02.003", nombre: "Utilidades y Bonificaciones de Fin de Año", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 38500, saldoActual: 38500 },
  { id: "2.1.02.004", codigo: "2.1.02.004", nombre: "Prestaciones Sociales Acumuladas Corrientes", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 42000, saldoActual: 42000 },
  { id: "2.1.02.005", codigo: "2.1.02.005", nombre: "Aportes Patronales IVSS / FAOV / INCES", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 11600, saldoActual: 11600 },

  // 2.1.03 Fiscales
  { id: "2.1.03", codigo: "2.1.03", nombre: "Tributos e Impuestos por Pagar", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1.03.001", codigo: "2.1.03.001", nombre: "Débito Fiscal IVA por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 24500, saldoActual: 24500 },
  { id: "2.1.03.002", codigo: "2.1.03.002", nombre: "Retenciones de IVA por Enterar al Fisco", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 13800, saldoActual: 13800 },
  { id: "2.1.03.003", codigo: "2.1.03.003", nombre: "Retenciones de ISLR por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 8950, saldoActual: 8950 },
  { id: "2.1.03.004", codigo: "2.1.03.004", nombre: "Impuesto Sobre la Renta (ISLR) por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 35000, saldoActual: 35000 },
  { id: "2.1.03.005", codigo: "2.1.03.005", nombre: "Impuestos Municipales / Patente de Comercio", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 14200, saldoActual: 14200 },

  // 2.1.04 Financieros y Anticipos
  { id: "2.1.04", codigo: "2.1.04", nombre: "Préstamos y Créditos a Corto Plazo", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1.04.001", codigo: "2.1.04.001", nombre: "Pagarés y Créditos Bancarios a Corto Plazo", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 80000, saldoActual: 80000 },
  { id: "2.1.04.002", codigo: "2.1.04.002", nombre: "Porción Circulante de Deuda a Largo Plazo", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 45000, saldoActual: 45000 },
  { id: "2.1.04.003", codigo: "2.1.04.003", nombre: "Intereses Devengados por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 6400, saldoActual: 6400 },
  { id: "2.1.04.004", codigo: "2.1.04.004", nombre: "Anticipos Recibidos de Clientes", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 31000, saldoActual: 31000 },

  // 2.2 PASIVO NO CORRIENTE
  { id: "2.2", codigo: "2.2", nombre: "Pasivo No Corriente", nivel: 2, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.2.01", codigo: "2.2.01", nombre: "Deudas y Obligaciones a Largo Plazo", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.2.01.001", codigo: "2.2.01.001", nombre: "Préstamos Bancarios Comerciales a Largo Plazo", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 210000, saldoActual: 210000 },
  { id: "2.2.01.002", codigo: "2.2.01.002", nombre: "Hipotecas por Pagar sobre Inmueble Sede", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 165000, saldoActual: 165000 },
  { id: "2.2.01.003", codigo: "2.2.01.003", nombre: "Bonos Financieros y Títulos de Deuda", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 80000, saldoActual: 80000 },
  { id: "2.2.01.004", codigo: "2.2.01.004", nombre: "Provisión para Indemnizaciones Laborales a Largo Plazo", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 45000, saldoActual: 45000 },

  // 3. PATRIMONIO NETO
  { id: "3", codigo: "3", nombre: "PATRIMONIO", nivel: 1, tipo: "Grupo", grupo: "Patrimonio", naturaleza: "Acreedora" },
  { id: "3.1", codigo: "3.1", nombre: "Patrimonio Neto y Reservas", nivel: 2, tipo: "Grupo", grupo: "Patrimonio", naturaleza: "Acreedora" },
  { id: "3.1.01.001", codigo: "3.1.01.001", nombre: "Capital Social Suscrito y Pagado", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 350000, saldoActual: 350000 },
  { id: "3.1.01.002", codigo: "3.1.01.002", nombre: "Aportes de Accionistas para Futuros Aumentos", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 50000, saldoActual: 50000 },
  { id: "3.1.02.001", codigo: "3.1.02.001", nombre: "Reserva Legal (10% Código de Comercio)", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 35000, saldoActual: 35000 },
  { id: "3.1.02.002", codigo: "3.1.02.002", nombre: "Reserva Estatutaria y Facultativa", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 20000, saldoActual: 20000 },
  { id: "3.1.03.001", codigo: "3.1.03.001", nombre: "Utilidades Retenidas de Ejercicios Anteriores", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 98500, saldoActual: 98500 },
  { id: "3.1.03.002", codigo: "3.1.03.002", nombre: "Superávit por Revaluación de Activos Fijos", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 32000, saldoActual: 32000 },
  { id: "3.1.03.003", codigo: "3.1.03.003", nombre: "Resultado del Ejercicio Actual (Utilidad Neta)", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 39500, saldoActual: 39500 },

  // 4. INGRESOS
  { id: "4", codigo: "4", nombre: "INGRESOS", nivel: 1, tipo: "Grupo", grupo: "Ingresos", naturaleza: "Acreedora" },
  { id: "4.1", codigo: "4.1", nombre: "Ingresos por Ventas y Servicios", nivel: 2, tipo: "Grupo", grupo: "Ingresos", naturaleza: "Acreedora" },
  { id: "4.1.01.001", codigo: "4.1.01.001", nombre: "Ventas de Mercancías Nacionales", nivel: 4, tipo: "Movimiento", grupo: "Ingresos", naturaleza: "Acreedora", saldo: 420000, saldoActual: 420000 },
  { id: "4.1.01.002", codigo: "4.1.01.002", nombre: "Ganancia en Diferencial Cambiario", nivel: 4, tipo: "Movimiento", grupo: "Ingresos", naturaleza: "Acreedora", saldo: 15400, saldoActual: 15400 },

  // 5. GASTOS Y COSTOS
  { id: "5", codigo: "5", nombre: "GASTOS Y COSTOS", nivel: 1, tipo: "Grupo", grupo: "Gastos", naturaleza: "Deudora" },
  { id: "5.1", codigo: "5.1", nombre: "Gastos Operativos y de Administración", nivel: 2, tipo: "Grupo", grupo: "Gastos", naturaleza: "Deudora" },
  { id: "5.1.01.001", codigo: "5.1.01.001", nombre: "Sueldos, Salarios y Beneficios al Personal", nivel: 4, tipo: "Movimiento", grupo: "Gastos", naturaleza: "Deudora", saldo: 185000, saldoActual: 185000 },
  { id: "5.1.01.002", codigo: "5.1.01.002", nombre: "Servicios Básicos (Electricidad, Agua, Internet)", nivel: 4, tipo: "Movimiento", grupo: "Gastos", naturaleza: "Deudora", saldo: 24500, saldoActual: 24500 },
  { id: "5.1.01.003", codigo: "5.1.01.003", nombre: "Pérdida en Diferencial Cambiario", nivel: 4, tipo: "Movimiento", grupo: "Gastos", naturaleza: "Deudora", saldo: 12800, saldoActual: 12800 }
];

const DEFAULT_CUENTAS = SAMPLE_FULL_BALANCE_CUENTAS;

const DEFAULT_BANCOS = [
  {
    id: "banco-1",
    banco: "Banesco Banco Universal",
    numeroCuenta: "0134-0001-01-0000000001",
    cuenta: "0134-0001-01-0000000001",
    numero_cuenta: "0134-0001-01-0000000001",
    tipo: "Corriente",
    moneda: "USD",
    saldo: 10000.00,
    tasa: 1.0,
    cuentaContableId: "1.1.3",
    cuenta_contable_id: "1.1.3",
    activo: true
  }
];

// ============================================================================
// 9. CONTACTOS (ALIADOS, FREELANCE, AEROLÍNEAS, PROVEEDORES, AGENTES)
// ============================================================================

export const DEFAULT_LOCAL_CONTACTS = [
  {
    id: "ct-airline-052",
    name: "Laser Airlines, C.A.",
    taxId: "J-30291823-1",
    type: "airline",
    codigoIata: "052",
    codigoDosLetras: "QL",
    email: "soporte@laserairlines.com",
    phone: "+58 212 5055000",
    address: "Caracas, Venezuela",
    tipoContribuyente: "ordinario",
    saldo: 0,
    saldoCxp: 0,
    debitAccount: "5.1.1",
    creditAccount: "2.1.1",
    activo: true
  },
  {
    id: "ct-airline-308",
    name: "Rutaca Airlines",
    taxId: "J-30492817-2",
    type: "airline",
    codigoIata: "308",
    codigoDosLetras: "5R",
    email: "emisiones@rutaca.com.ve",
    phone: "+58 212 9005000",
    address: "Ciudad Bolívar / Caracas, Venezuela",
    tipoContribuyente: "ordinario",
    saldo: 0,
    saldoCxp: 0,
    debitAccount: "5.1.1",
    creditAccount: "2.1.1",
    activo: true
  },
  {
    id: "ct-aliado-01",
    name: "Agencia de Viajes Destinos & Sol, C.A.",
    taxId: "J-40918273-0",
    type: "customer",
    email: "reservas@destinosysol.com",
    phone: "+58 414 1234567",
    address: "Altamira, Caracas, Venezuela",
    personaContacto: "Lic. Roberto Mendoza",
    comisionPorcentaje: 6.0,
    tipoContribuyente: "ordinario",
    saldo: 0,
    saldoCxp: 0,
    debitAccount: "1.1.2",
    creditAccount: "2.1.2",
    terminalAgente: "PTYQ178AT",
    activo: true
  },
  {
    id: "ct-aliado-02",
    name: "Viajes y Turismo Costa Azul, C.A.",
    taxId: "J-31948271-5",
    type: "customer",
    email: "administracion@costaazul.com",
    phone: "+58 212 9998877",
    address: "Las Mercedes, Caracas",
    personaContacto: "Ing. Laura Chacón",
    comisionPorcentaje: 7.0,
    tipoContribuyente: "ordinario",
    saldo: 0,
    saldoCxp: 0,
    debitAccount: "1.1.2",
    creditAccount: "2.1.2",
    terminalAgente: "PTYQ17804",
    activo: true
  },
  {
    id: "ct-aliado-03",
    name: "Mundo Tour Venezuela, C.A.",
    taxId: "J-41209384-9",
    type: "customer",
    email: "finanzas@mundotour.com.ve",
    phone: "+58 414 3332211",
    address: "Lechería, Edo. Anzoátegui",
    personaContacto: "Mariana Silva",
    comisionPorcentaje: 5.5,
    tipoContribuyente: "ordinario",
    saldo: 0,
    saldoCxp: 0,
    debitAccount: "1.1.2",
    creditAccount: "2.1.2",
    terminalAgente: "PTYQ1782V",
    activo: true
  },
  {
    id: "ct-freelance-01",
    name: "Carlos Eduardo Pérez (Freelance)",
    taxId: "V-18492019",
    type: "freelance",
    email: "carlos.viajes@gmail.com",
    phone: "+58 412 9876543",
    address: "Valencia, Edo. Carabobo",
    personaContacto: "Carlos Pérez",
    comisionPorcentaje: 3.5,
    bancoPago: "Banesco Banco Universal",
    pagoMovil: "0412-9876543 / 18492019 / 0134",
    tipoContribuyente: "no_contribuyente",
    saldo: 0,
    saldoCxp: 0,
    debitAccount: "5.1.2",
    creditAccount: "2.1.3",
    activo: true
  },
  {
    id: "ct-inter-01",
    name: "Inversiones Grupo Halley Holding, C.A.",
    taxId: "J-50192837-4",
    type: "intercompany",
    email: "holding@grupo-halley.com",
    phone: "+58 212 5550200",
    address: "Torre Empresarial, Piso 10, Caracas",
    personaContacto: "Dr. Gustavo Benítez",
    tipoContribuyente: "ordinario",
    saldo: 0,
    saldoCxp: 0,
    debitAccount: "1.1.4",
    creditAccount: "2.1.1",
    activo: true
  },
  {
    id: "ct-share-01",
    name: "Ing. Alejandro Morales (Accionista)",
    taxId: "V-14920194",
    type: "shareholder",
    email: "amorales@grupo-halley.com",
    phone: "+58 414 8889900",
    address: "Caracas, Venezuela",
    personaContacto: "Alejandro Morales",
    tipoContribuyente: "no_contribuyente",
    saldo: 0,
    saldoCxp: 0,
    debitAccount: "1.1.4",
    creditAccount: "2.1.1",
    activo: true
  },
  {
    id: "ct-airline-01",
    name: "Laser Airlines, C.A.",
    taxId: "J-30080820-2",
    type: "airline",
    codigoIata: "QL",
    codigoDosLetras: "LER",
    email: "liquidaciones@laserairlines.com",
    phone: "+58 212 2088888",
    address: "Av. Francisco de Miranda, Edif. Parque Cristal, Caracas",
    personaContacto: "Dpto. Conciliación y Tesorería",
    tipoContribuyente: "especial",
    saldo: 0,
    saldoCxp: 0,
    debitAccount: "5.1.1",
    creditAccount: "2.1.1",
    activo: true
  },
  {
    id: "ct-airline-02",
    name: "Copa Airlines (Compañía Panameña de Aviación)",
    taxId: "J-00049281-9",
    type: "airline",
    codigoIata: "CM",
    codigoDosLetras: "CMP",
    email: "bsp.venezuela@copaair.com",
    phone: "+58 212 9022672",
    address: "Centro Empresarial Lido, Caracas",
    personaContacto: "Agencias y Canales Indirectos",
    tipoContribuyente: "especial",
    saldo: 0,
    saldoCxp: 0,
    debitAccount: "5.1.1",
    creditAccount: "2.1.1",
    activo: true
  },
  {
    id: "ct-supplier-01",
    name: "Kiu System Solutions (GDS)",
    taxId: "J-90182736-1",
    type: "supplier",
    email: "billing@kiusys.com",
    phone: "+54 11 5278-8000",
    address: "Buenos Aires / Plataforma Global",
    tipoContribuyente: "ordinario",
    saldo: 0,
    saldoCxp: 0,
    debitAccount: "5.1.1",
    creditAccount: "2.1.1",
    activo: true
  },
  {
    id: "ct-agent-01",
    name: "Andrea Valentina Rivas (Counter/Emisión)",
    taxId: "V-24819203",
    type: "employee",
    employeeType: "agente_emisor",
    email: "andrea.rivas@halleyerp.com",
    phone: "+58 424 5551234",
    address: "Caracas, Venezuela",
    comisionPorcentaje: 1.0,
    tipoContribuyente: "no_contribuyente",
    saldo: 0,
    saldoCxp: 0,
    debitAccount: "5.1.2",
    creditAccount: "2.1.3",
    activo: true
  },
  {
    id: "ct-empleado-01",
    name: "María Eugenia Blanco (Administración)",
    taxId: "V-20184920",
    type: "empleados",
    employeeType: "empleado_general",
    email: "maria.blanco@halleyerp.com",
    phone: "+58 414 7778899",
    address: "Caracas, Venezuela",
    tipoContribuyente: "no_contribuyente",
    saldo: 0,
    saldoCxp: 0,
    debitAccount: "5.1.1",
    creditAccount: "2.1.3",
    activo: true
  }
];

export async function dbFetchContactos(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data, error } = await supabase.from('contactos').select('*').eq('empresa_id', empresaId).order('name', { ascending: true });
      if (!error && data && data.length > 0) {
        return (data || []).map((row: any) => ({
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
          debitAccount: row.debit_account || '',
          creditAccount: row.credit_account || '',
          expenseAccount: row.expense_account || '',
          employeeType: row.employee_type || undefined,
          comisionPorcentaje: Number(row.comision_porcentaje) || 0,
          codigoIata: row.codigo_iata || '',
          codigoDosLetras: row.codigo_dos_letras || '',
          terminalAgente: row.terminal_agente || row.terminalAgente || '',
          personaContacto: row.persona_contacto || '',
          bancoPago: row.banco_pago || '',
          pagoMovil: row.pago_movil || '',
          activo: row.activo ?? true
        }));
      }
    } catch {}
  }
  return getLocal<any[]>(`erp_local_contactos_${cid}`, DEFAULT_LOCAL_CONTACTS);
}

export async function dbSaveContacto(contacto: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_contactos_${cid}`, DEFAULT_LOCAL_CONTACTS);
  const formatted = {
    id: contacto.id || `ct_${Date.now()}`,
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
    codigoIata: contacto.codigoIata || '',
    codigoDosLetras: contacto.codigoDosLetras || '',
    terminalAgente: (contacto.terminalAgente || '').trim().toUpperCase(),
    personaContacto: contacto.personaContacto || '',
    bancoPago: contacto.bancoPago || '',
    pagoMovil: contacto.pagoMovil || '',
    activo: contacto.activo ?? true
  };
  const idx = list.findIndex(c => c.id === formatted.id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...formatted };
  } else {
    list.push(formatted);
  }
  setLocal(`erp_local_contactos_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId) {
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
        debit_account: formatted.debitAccount || null,
        credit_account: formatted.creditAccount || null,
        expense_account: formatted.expenseAccount || null,
        employee_type: formatted.employeeType || null,
        comision_porcentaje: formatted.comisionPorcentaje,
        codigo_iata: formatted.codigoIata || null,
        codigo_dos_letras: formatted.codigoDosLetras || null,
        terminal_agente: formatted.terminalAgente || null,
        persona_contacto: formatted.personaContacto || null,
        banco_pago: formatted.bancoPago || null,
        pago_movil: formatted.pagoMovil || null,
        activo: formatted.activo
      };
      await supabase.from('contactos').upsert(payload);
    } catch {}
  }
  return true;
}

export async function dbDeleteContacto(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_contactos_${cid}`, DEFAULT_LOCAL_CONTACTS);
  setLocal(`erp_local_contactos_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('contactos').delete().eq('id', id);
    } catch {}
  }
  return true;
}

// ============================================================================
// 10. USUARIOS Y PERMISOS RBAC
// ============================================================================

export async function dbFetchUsuarios(): Promise<any[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('usuarios').select('*').order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        return (data || []).map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.nombre || u.email.split('@')[0],
          password: u.password_hash || '123456',
          claveOperaciones: u.clave_operaciones || u.claveOperaciones || (u.role === 'Master' ? '19072828' : undefined),
          role: u.role || 'Operador',
          activo: u.activo !== false,
          companyRoles: {},
          companyConfigs: {}
        }));
      }
    } catch {}
  }
  const local = getLocal<any[]>('erp_local_usuarios', []);
  if (!local || local.length === 0) {
    const defaultMaster = {
      id: "u-master-1",
      email: "jefe@halleyerp.com",
      name: "Administrador Master",
      role: "Master",
      password: "19072828",
      claveOperaciones: "19072828",
      activo: true,
      companyRoles: { "*": "Master" },
      companyConfigs: {}
    };
    setLocal('erp_local_usuarios', [defaultMaster]);
    return [defaultMaster];
  }
  return local;
}

export async function dbSaveUsuario(usuario: any): Promise<boolean> {
  const list = getLocal<any[]>('erp_local_usuarios', []);
  const formatted = {
    id: usuario.id || `user_${Date.now()}`,
    email: usuario.email.trim().toLowerCase(),
    name: usuario.name || usuario.nombre || usuario.email.split('@')[0],
    password: usuario.password || usuario.password_hash || '123456',
    claveOperaciones: usuario.claveOperaciones || usuario.clave_operaciones || (usuario.role === 'Master' ? '19072828' : undefined),
    role: usuario.role || 'Operador',
    activo: usuario.activo !== false
  };
  const idx = list.findIndex(u => u.id === formatted.id || u.email === formatted.email);
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  setLocal('erp_local_usuarios', list);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('usuarios').upsert({
        id: formatted.id,
        email: formatted.email,
        nombre: formatted.name,
        password_hash: formatted.password,
        clave_operaciones: formatted.claveOperaciones,
        role: formatted.role,
        activo: formatted.activo
      });
    } catch {}
  }
  return true;
}

export async function dbDeleteUsuario(idOrEmail: string): Promise<boolean> {
  const list = getLocal<any[]>('erp_local_usuarios', []);
  const filtered = list.filter(u => u.id !== idOrEmail && u.email !== idOrEmail);
  setLocal('erp_local_usuarios', filtered);

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
  const trimmed = claveInput.trim();
  if (!trimmed) return { success: false };

  // Always check default master password as universal super-fallback
  if (trimmed === '19072828') {
    return { success: true, masterUser: { name: 'Administrador Master', role: 'Master' } };
  }

  try {
    const allUsers = await dbFetchUsuarios();
    const masterUsers = (allUsers || []).filter(u => u.role === 'Master' && u.activo !== false);

    const matched = masterUsers.find(u => 
      (u.claveOperaciones && u.claveOperaciones.trim() === trimmed) ||
      (u.password && u.password.trim() === trimmed)
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
      const payload = {
        id: record.id || `ue_${record.usuario_id || record.usuarioId}_${record.empresa_id || record.empresaId}`,
        usuario_id: record.usuario_id || record.usuarioId,
        empresa_id: record.empresa_id || record.empresaId,
        role: record.role || 'Operador',
        vendedor_id: record.vendedor_id || record.vendedorId || null,
        vendedor_nombre: record.vendedor_nombre || record.vendedorNombre || null,
        permissions: record.permissions || {},
        activo: record.activo !== false
      };
      await supabase.from('usuario_empresas').upsert(payload);
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

// ============================================================================
// 11. CUENTAS CONTABLES NIIF
// ============================================================================

export async function dbFetchCuentasContables(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data, error } = await supabase.from('cuentas_contables').select('*').eq('empresa_id', empresaId).order('codigo', { ascending: true });
      if (!error && data && data.length > 0) {
        return (data || []).map((row: any) => ({
          id: row.id,
          codigo: row.codigo,
          nombre: row.nombre,
          tipo: row.tipo || 'Movimiento',
          naturaleza: row.naturaleza || 'Deudora',
          grupo: row.grupo || 'Activo',
          nivel: Number(row.nivel) || 1,
          cuentaPadreId: row.cuenta_padre_id,
          saldoActual: Number(row.saldo_actual) || 0,
          activo: row.activo ?? true
        }));
      }
    } catch {}
  }
  const local = getLocal<any[]>(`erp_local_cuentas_${cid}`, DEFAULT_CUENTAS);
  if (!local || local.length === 0) {
    setLocal(`erp_local_cuentas_${cid}`, DEFAULT_CUENTAS);
    return DEFAULT_CUENTAS;
  }
  return local;
}

export async function dbResetToFullDemoCuentas(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  setLocal(`erp_local_cuentas_${cid}`, SAMPLE_FULL_BALANCE_CUENTAS);
  return SAMPLE_FULL_BALANCE_CUENTAS;
}

export async function dbSaveCuentaContable(cuenta: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_cuentas_${cid}`, DEFAULT_CUENTAS);
  const formatted = {
    id: cuenta.id,
    codigo: cuenta.codigo,
    nombre: cuenta.nombre,
    tipo: cuenta.tipo || 'Movimiento',
    naturaleza: cuenta.naturaleza || 'Deudora',
    grupo: cuenta.grupo || (cuenta.codigo.startsWith('1') ? 'Activo' : cuenta.codigo.startsWith('2') ? 'Pasivo' : cuenta.codigo.startsWith('3') ? 'Patrimonio' : cuenta.codigo.startsWith('4') ? 'Ingresos' : 'Gastos'),
    nivel: Number(cuenta.nivel) || (cuenta.codigo.split('.').length),
    cuentaPadreId: cuenta.cuentaPadreId || null,
    saldoActual: Number(cuenta.saldoActual || cuenta.saldo) || 0,
    activo: cuenta.activo ?? true
  };
  const idx = list.findIndex(c => c.id === formatted.id || c.codigo === formatted.codigo);
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  setLocal(`erp_local_cuentas_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const payload = {
        id: formatted.id,
        empresa_id: empresaId,
        codigo: formatted.codigo,
        nombre: formatted.nombre,
        tipo: formatted.tipo,
        naturaleza: formatted.naturaleza,
        grupo: formatted.grupo,
        nivel: formatted.nivel,
        cuenta_padre_id: formatted.cuentaPadreId,
        saldo_actual: formatted.saldoActual,
        activo: formatted.activo
      };
      await supabase.from('cuentas_contables').upsert(payload);
    } catch {}
  }
  return true;
}

export async function dbDeleteCuentaContable(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_cuentas_${cid}`, DEFAULT_CUENTAS);
  setLocal(`erp_local_cuentas_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('cuentas_contables').delete().eq('id', id);
    } catch {}
  }
  return true;
}

// ============================================================================
// 12. BANCOS Y TESORERÍA
// ============================================================================

export async function dbFetchBancos(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data, error } = await supabase.from('bancos').select('*').eq('empresa_id', empresaId).order('banco', { ascending: true });
      if (!error && data && data.length > 0) {
        return (data || []).map((row: any) => ({
          id: row.id,
          banco: row.banco,
          numeroCuenta: row.numero_cuenta,
          cuenta: row.numero_cuenta,
          numero_cuenta: row.numero_cuenta,
          tipo: row.tipo || 'Corriente',
          moneda: row.moneda || 'Bolivares',
          saldo: Number(row.saldo) || 0,
          tasa: Number(row.tasa) || 1.0,
          cuentaContableId: row.cuenta_contable_id || '1.1.3',
          cuenta_contable_id: row.cuenta_contable_id || '1.1.3',
          activo: row.activo ?? true
        }));
      }
    } catch {}
  }
  const local = getLocal<any[]>(`erp_local_bancos_${cid}`, DEFAULT_BANCOS);
  if (!local || local.length === 0) {
    setLocal(`erp_local_bancos_${cid}`, DEFAULT_BANCOS);
    return DEFAULT_BANCOS;
  }
  return local;
}

export async function dbSaveBanco(banco: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_bancos_${cid}`, DEFAULT_BANCOS);
  const formatted = {
    id: banco.id || `banco_${Date.now()}`,
    banco: banco.banco,
    numeroCuenta: banco.cuenta || banco.numeroCuenta || banco.numero_cuenta || '0000-0000-0000-0000',
    cuenta: banco.cuenta || banco.numeroCuenta || banco.numero_cuenta || '0000-0000-0000-0000',
    numero_cuenta: banco.cuenta || banco.numeroCuenta || banco.numero_cuenta || '0000-0000-0000-0000',
    tipo: banco.tipo || 'Corriente',
    moneda: banco.moneda || 'USD',
    saldo: Number(banco.saldo) || 0,
    tasa: Number(banco.tasa) || 1.0,
    cuentaContableId: banco.cuenta_contable_id || banco.cuentaContableId || '1.1.3',
    cuenta_contable_id: banco.cuenta_contable_id || banco.cuentaContableId || '1.1.3',
    activo: banco.activo ?? true
  };
  const idx = list.findIndex(b => b.id === formatted.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  setLocal(`erp_local_bancos_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const payload: any = {
        id: formatted.id,
        empresa_id: empresaId,
        banco: formatted.banco,
        numero_cuenta: formatted.numeroCuenta,
        moneda: formatted.moneda,
        saldo: formatted.saldo,
        tasa: formatted.tasa,
        cuenta_contable_id: formatted.cuentaContableId,
        activo: formatted.activo
      };
      await supabase.from('bancos').upsert(payload);
    } catch {}
  }
  return true;
}

export async function dbDeleteBanco(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_bancos_${cid}`, DEFAULT_BANCOS);
  setLocal(`erp_local_bancos_${cid}`, list.filter(b => b.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('bancos').delete().eq('id', id);
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
      if (!error && data && data.length > 0) {
        return (data || []).map((row: any) => ({
          id: row.id,
          bancoId: row.banco_id,
          banco_id: row.banco_id,
          fecha: row.fecha,
          ref: row.ref || '',
          descripcion: row.descripcion,
          tipo: row.tipo,
          monto: Number(row.monto) || 0,
          tasa: Number(row.tasa) || 1.0,
          comprobanteId: row.comprobante_id || '',
          comprobante_id: row.comprobante_id || '',
          estado: row.estado || 'conciliado',
          notas: row.notas || '',
          created_at: row.created_at,
          createdAt: row.created_at
        }));
      }
    } catch {}
  }
  return getLocal<any[]>(`erp_local_movimientos_bancos_${cid}`, []);
}

export async function dbSaveMovimientoBanco(mov: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_movimientos_bancos_${cid}`, []);
  const formatted = {
    id: mov.id || `mov_${Date.now()}`,
    bancoId: mov.banco_id || mov.bancoId,
    banco_id: mov.banco_id || mov.bancoId,
    fecha: mov.fecha || new Date().toISOString().split('T')[0],
    ref: mov.ref || '',
    descripcion: mov.descripcion || '',
    tipo: mov.tipo || 'ingreso',
    monto: Number(mov.monto) || 0,
    tasa: Number(mov.tasa) || 1.0,
    comprobanteId: mov.comprobante_id || mov.comprobanteId || null,
    comprobante_id: mov.comprobante_id || mov.comprobanteId || null,
    estado: mov.estado || 'conciliado',
    notas: mov.notas || ''
  };
  const idx = list.findIndex(m => m.id === formatted.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  setLocal(`erp_local_movimientos_bancos_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const payload = {
        id: formatted.id,
        empresa_id: empresaId,
        banco_id: formatted.bancoId,
        fecha: formatted.fecha,
        ref: formatted.ref,
        descripcion: formatted.descripcion,
        tipo: formatted.tipo,
        monto: formatted.monto,
        tasa: formatted.tasa,
        comprobante_id: formatted.comprobanteId,
        estado: formatted.estado,
        notas: formatted.notas
      };
      await supabase.from('movimientos_bancos').upsert(payload);
    } catch {}
  }
  return true;
}

export async function dbDeleteMovimientoBanco(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_movimientos_bancos_${cid}`, []);
  setLocal(`erp_local_movimientos_bancos_${cid}`, list.filter(m => m.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('movimientos_bancos').delete().eq('id', id);
    } catch {}
  }
  return true;
}

// ============================================================================
// 13. CONFIGURACIÓN CONTABLE, SERIES Y CORRELATIVOS, RÉGIMEN FISCAL
// ============================================================================

export async function dbFetchConfiguracionContable(empresaId: string): Promise<any | null> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data, error } = await supabase
        .from('configuracion_contable')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          empresaId: data.empresa_id,
          cuentaInventario: data.cuenta_inventario || '',
          cuentaCostoVentas: data.cuenta_costo_ventas || '',
          cuentaVentas: data.cuenta_ventas || '4.1',
          cuentaGastos: data.cuenta_gastos || '5.1',
          cuentaAnticipoRecibido: data.cuenta_anticipo_recibido || '2.1.1',
          cuentaAnticipoOtorgado: data.cuenta_anticipo_otorgado || '1.1.4',
          cuentaCxc: data.cuenta_cxc || '1.1.4',
          cuentaCxp: data.cuenta_cxp || '2.1.1',
          cuentaDebitoFiscal: data.cuenta_debito_fiscal || '2.1.2',
          cuentaCreditoFiscal: data.cuenta_credito_fiscal || '2.1.2',
          cuentaIvaRetenidoVentas: data.cuenta_iva_retenido_ventas || '',
          cuentaIvaRetenidoCompras: data.cuenta_iva_retenido_compras || '',
          cuentaIslrRetenidoVentas: data.cuenta_islr_retenido_ventas || '',
          cuentaIslrRetenidoCompras: data.cuenta_islr_retenido_compras || '',
          cuentaGananciaDiferencialCambiario: data.cuenta_ganancia_diferencial || '4.1.1',
          cuentaPerdidaDiferencialCambiario: data.cuenta_perdida_diferencial || '5.2.1',
          cuentaUtilidadAnteriores: data.cuenta_utilidad_anteriores || '',
          mesCierre: data.mes_cierre || '12',
          workingYear: data.working_year || String(new Date().getFullYear()),
          iva: Number(data.iva ?? 16),
          igtf: Number(data.igtf ?? 3),
          retencionIva: Number(data.retencion_iva ?? 75),
          retencionIslr: Number(data.retencion_islr ?? 2),
          prefijoFactura: data.prefijo_factura ?? '',
          correlativoFactura: data.correlativo_factura ?? '00001',
          prefijoCotizacion: data.prefijo_cotizacion ?? '',
          correlativoCotizacion: data.correlativo_cotizacion ?? '00001',
          prefijoNotaEntrega: data.prefijo_nota_entrega ?? '',
          correlativoNotaEntrega: data.correlativo_nota_entrega ?? '00001',
          prefijoRecibo: data.prefijo_recibo ?? 'REC-',
          correlativoRecibo: data.correlativo_recibo ?? '00001',
          diasVencimientoDefault: Number(data.dias_vencimiento_default ?? 15),
          notasDefault: data.notas_default || '',
          comisionMode: data.comision_mode || 'emitidas',
          activeServiceTemplate: data.active_service_template || 'Estándar',
          activeInventoryTemplate: data.active_inventory_template || 'Estándar',
          usaMaquinaFiscal: data.usa_maquina_fiscal ?? false,
          marcaMaquinaFiscal: data.marca_maquina_fiscal || 'bixolon'
        };
      }
    } catch {}
  }
  return getLocal<any | null>(`erp_local_config_${cid}`, {
    empresaId: cid,
    cuentaVentas: '4.1',
    cuentaGastos: '5.1',
    cuentaCxc: '1.1.4',
    cuentaCxp: '2.1.1',
    cuentaDebitoFiscal: '2.1.2',
    cuentaCreditoFiscal: '2.1.2',
    cuentaGananciaDiferencialCambiario: '4.1.1',
    cuentaPerdidaDiferencialCambiario: '5.2.1',
    mesCierre: '12',
    workingYear: String(new Date().getFullYear()),
    iva: 16,
    igtf: 3,
    retencionIva: 75,
    retencionIslr: 2,
    prefijoFactura: '',
    correlativoFactura: '00001',
    prefijoRecibo: 'REC-',
    correlativoRecibo: '00001',
    diasVencimientoDefault: 15,
    notasDefault: '',
    comisionMode: 'emitidas'
  });
}

export async function dbSaveConfiguracionContable(config: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const existing = getLocal<any>(`erp_local_config_${cid}`, {});
  const merged = { ...existing, ...config, empresaId: cid };
  setLocal(`erp_local_config_${cid}`, merged);

  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const getVal = (newVal: any, existingVal: any, defaultVal: any = null) => {
        if (newVal !== undefined && newVal !== null && newVal !== '') return newVal;
        if (existingVal !== undefined && existingVal !== null && existingVal !== '') return existingVal;
        return defaultVal;
      };

      const payload = {
        id: config.id || `cfg_${empresaId}`,
        empresa_id: empresaId,
        cuenta_inventario: getVal(config.cuentaInventario, null),
        cuenta_costo_ventas: getVal(config.cuentaCostoVentas, null),
        cuenta_ventas: getVal(config.cuentaVentas, '4.1'),
        cuenta_gastos: getVal(config.cuentaGastos, '5.1'),
        cuenta_anticipo_recibido: getVal(config.cuentaAnticipoRecibido, '2.1.1'),
        cuenta_anticipo_otorgado: getVal(config.cuentaAnticipoOtorgado, '1.1.4'),
        cuenta_cxc: getVal(config.cuentaCxc, '1.1.4'),
        cuenta_cxp: getVal(config.cuentaCxp, '2.1.1'),
        cuenta_debito_fiscal: getVal(config.cuentaDebitoFiscal, '2.1.2'),
        cuenta_credito_fiscal: getVal(config.cuentaCreditoFiscal, '2.1.2'),
        cuenta_iva_retenido_ventas: getVal(config.cuentaIvaRetenidoVentas, null),
        cuenta_iva_retenido_compras: getVal(config.cuentaIvaRetenidoCompras, null),
        cuenta_islr_retenido_ventas: getVal(config.cuentaIslrRetenidoVentas, null),
        cuenta_islr_retenido_compras: getVal(config.cuentaIslrRetenidoCompras, null),
        cuenta_ganancia_diferencial: getVal(config.cuentaGananciaDiferencialCambiario || config.cuentaGananciaDiferencial, '4.1.1'),
        cuenta_perdida_diferencial: getVal(config.cuentaPerdidaDiferencialCambiario || config.cuentaPerdidaDiferencial, '5.2.1'),
        cuenta_utilidad_anteriores: getVal(config.cuentaUtilidadAnteriores, null),
        mes_cierre: getVal(config.mesCierre, '12'),
        working_year: getVal(config.workingYear, String(new Date().getFullYear())),
        iva: config.iva !== undefined ? Number(config.iva) : 16,
        igtf: config.igtf !== undefined ? Number(config.igtf) : 3,
        retencion_iva: config.retencionIva !== undefined ? Number(config.retencionIva) : 75,
        retencion_islr: config.retencionIslr !== undefined ? Number(config.retencionIslr) : 2,
        prefijo_factura: config.prefijoFactura ?? '',
        correlativo_factura: config.correlativoFactura ?? '00001',
        prefijo_cotizacion: config.prefijoCotizacion ?? '',
        correlativo_cotizacion: config.correlativoCotizacion ?? '00001',
        prefijo_nota_entrega: config.prefijoNotaEntrega ?? '',
        correlativo_nota_entrega: config.correlativoNotaEntrega ?? '00001',
        prefijo_recibo: config.prefijoRecibo ?? 'REC-',
        correlativo_recibo: config.correlativoRecibo ?? '00001',
        dias_vencimiento_default: config.diasVencimientoDefault !== undefined ? Number(config.diasVencimientoDefault) : 15,
        notas_default: config.notasDefault ?? '',
        comision_mode: config.comisionMode ?? 'emitidas',
        active_service_template: config.activeServiceTemplate ?? 'Estándar',
        active_inventory_template: config.activeInventoryTemplate ?? 'Estándar',
        usa_maquina_fiscal: config.usaMaquinaFiscal !== undefined ? Boolean(config.usaMaquinaFiscal) : false,
        marca_maquina_fiscal: config.marcaMaquinaFiscal ?? 'bixolon',
        updated_at: new Date().toISOString()
      };

      await supabase.from('configuracion_contable').upsert(payload, { onConflict: 'empresa_id' });
    } catch {}
  }
  return true;
}

// ============================================================================
// 14. CUENTAS POR COBRAR (CXC)
// ============================================================================

export const DEFAULT_CXC = [
  // 1. Aliado con Facturas en Mora y Corriente (Destinos & Sol)
  {
    id: "cxc-001",
    factura_id: "FAC-2026-101",
    cliente_id: "ct-aliado-01",
    cliente: "Agencia de Viajes Destinos & Sol, C.A.",
    categoria: "aliados",
    fecha: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Emisión Boletos Madrid-Caracas (Air Europa - 2 Pax)",
    tipo: "factura",
    total: 1450.00,
    saldo: 950.00, // $500 abonados en cobranza REC-2026-001
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  },
  {
    id: "cxc-002",
    factura_id: "FAC-2026-102",
    cliente_id: "ct-aliado-01",
    cliente: "Agencia de Viajes Destinos & Sol, C.A.",
    categoria: "aliados",
    fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Paquete Turístico Cancún VIP Todo Incluido 5D/4N",
    tipo: "factura",
    total: 900.00,
    saldo: 900.00,
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  },
  // 2. Aliado Al Día (Costa Azul)
  {
    id: "cxc-003",
    factura_id: "FAC-2026-103",
    cliente_id: "ct-aliado-02",
    cliente: "Viajes y Turismo Costa Azul, C.A.",
    categoria: "aliados",
    fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Emisión Boletos Miami Laser Airlines CCS-MIA",
    tipo: "factura",
    total: 650.00,
    saldo: 650.00,
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  },
  // 3. Aliado con Saldo a Favor Puro para probar "Reintegrar Saldo" (Mundo Tour)
  {
    id: "cxc-004",
    factura_id: "ANT-2026-05",
    cliente_id: "ct-aliado-03",
    cliente: "Mundo Tour Venezuela, C.A.",
    categoria: "aliados",
    fecha: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Anticipo de cliente para recarga de balance prepagado",
    tipo: "anticipo",
    total: -800.00,
    saldo: -800.00,
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  },
  // 4. Freelance Al Día
  {
    id: "cxc-005",
    factura_id: "CARG-FL-022",
    cliente_id: "ct-freelance-01",
    cliente: "Carlos Eduardo Pérez (Freelance)",
    categoria: "freelance",
    fecha: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Emisión Boletos Bogotá Copa Airlines CCS-BOG",
    tipo: "factura",
    total: 420.00,
    saldo: 420.00,
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  },
  // 5. Intercompañías
  {
    id: "cxc-006",
    factura_id: "PRES-INT-2026-01",
    cliente_id: "ct-inter-01",
    cliente: "Inversiones Grupo Halley Holding, C.A.",
    categoria: "intercompanias",
    fecha: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Préstamo puente operacional intercompañía",
    tipo: "factura",
    total: 3500.00,
    saldo: 3500.00,
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  },
  // 6. Accionistas
  {
    id: "cxc-007",
    factura_id: "PRES-ACC-2026-01",
    cliente_id: "ct-share-01",
    cliente: "Ing. Alejandro Morales (Accionista)",
    categoria: "accionistas",
    fecha: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Anticipo de utilidades y dividendos",
    tipo: "factura",
    total: 1000.00,
    saldo: 1000.00,
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  },
  // 7. Empleados
  {
    id: "cxc-008",
    factura_id: "ANT-EMP-2026-01",
    cliente_id: "ct-empleado-01",
    cliente: "María Eugenia Blanco (Administración)",
    categoria: "empleados",
    fecha: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Préstamo personal y anticipo de quincena",
    tipo: "factura",
    total: 200.00,
    saldo: 200.00,
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  }
];

export const DEFAULT_MOVIMIENTOS_BANCOS = [
  {
    id: "mov-001",
    bancoId: "banco-1",
    banco_id: "banco-1",
    fecha: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    ref: "REF-TRANSF-449102",
    descripcion: "Cobranza de cliente Agencia de Viajes Destinos & Sol, C.A.",
    tipo: "ingreso",
    monto: 500.00,
    tasa: 1.0,
    comprobanteId: "CMP-001",
    estado: "conciliado",
    cliente_asignado: "ct-aliado-01"
  }
];

export function dbResetAllTestData(empresaId?: string): void {
  const cid = empresaId || 'default';
  setLocal(`erp_local_cxc_${cid}`, DEFAULT_CXC);
  setLocal(`erp_local_cxp_${cid}`, DEFAULT_CXP);
  setLocal(`erp_local_cobranzas_${cid}`, DEFAULT_COBRANZAS);
  setLocal(`erp_local_pagos_${cid}`, DEFAULT_PAGOS_REALIZADOS);
  setLocal(`erp_local_contactos_${cid}`, DEFAULT_LOCAL_CONTACTS);
  setLocal(`erp_local_bancos_${cid}`, DEFAULT_BANCOS);
  setLocal(`erp_local_movimientos_bancos_${cid}`, DEFAULT_MOVIMIENTOS_BANCOS);
}

export async function dbFetchCxc(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data, error } = await supabase.from('cuentas_cobrar_cxc').select('*').eq('empresa_id', empresaId).order('fecha', { ascending: false });
      if (!error && data && data.length > 0) {
        return (data || []).map((row: any) => ({
          id: row.id,
          factura_id: row.factura_id,
          cliente_id: row.cliente_id,
          cliente: row.cliente,
          categoria: row.categoria || 'clientes',
          fecha: row.fecha,
          vencimiento: row.vencimiento,
          descripcion: row.descripcion,
          tipo: row.tipo || 'factura',
          total: Number(row.total) || 0,
          saldo: Number(row.saldo) || 0,
          moneda: row.moneda || 'USD',
          tasa: Number(row.tasa) || 1.0,
          estado: (Number(row.saldo) || 0) <= 0.009 ? 'cobrada' : 'pendiente'
        }));
      }
    } catch {}
  }
  const local = getLocal<any[]>(`erp_local_cxc_${cid}`, DEFAULT_CXC);
  if (!local || local.length === 0) {
    setLocal(`erp_local_cxc_${cid}`, DEFAULT_CXC);
    return DEFAULT_CXC;
  }
  return local;
}

export async function dbSaveCxc(cxc: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_cxc_${cid}`, []);
  const formatted = {
    ...cxc,
    id: cxc.id || `cxc_${Date.now()}`,
    factura_id: cxc.factura_id || cxc.facturaId || cxc.numeroFactura || '',
    cliente_id: cxc.cliente_id || cxc.clienteId || cxc.proveedor_id || '',
    cliente: cxc.cliente || cxc.clienteNombre || cxc.proveedor_nombre || '',
    proveedor_id: cxc.proveedor_id || cxc.cliente_id || '',
    proveedor_nombre: cxc.proveedor_nombre || cxc.cliente || '',
    categoria: cxc.categoria || 'clientes',
    fecha: cxc.fecha || cxc.fecha_emision || cxc.fechaEmision || new Date().toISOString().split('T')[0],
    fecha_emision: cxc.fecha_emision || cxc.fecha || new Date().toISOString().split('T')[0],
    vencimiento: cxc.vencimiento || cxc.fecha_vencimiento || cxc.fechaVencimiento || cxc.fecha || new Date().toISOString().split('T')[0],
    descripcion: cxc.descripcion || '',
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
  setLocal(`erp_local_cxc_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const payload = {
        id: formatted.id,
        empresa_id: empresaId,
        factura_id: formatted.factura_id,
        cliente_id: formatted.cliente_id,
        cliente: formatted.cliente,
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
      await supabase.from('cuentas_cobrar_cxc').upsert(payload);
    } catch {}
  }
  return true;
}

export async function dbDeleteCxc(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_cxc_${cid}`, []);
  setLocal(`erp_local_cxc_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('cuentas_cobrar_cxc').delete().eq('id', id);
    } catch {}
  }
  return true;
}

// ============================================================================
// 15. CUENTAS POR PAGAR (CXP)
// ============================================================================

export const DEFAULT_CXP = [
  // 1. Aerolínea con Deuda (Laser Airlines)
  {
    id: "cxp-001",
    factura_id: "FAC-AIR-8821",
    proveedor_id: "ct-airline-01",
    proveedor: "Laser Airlines, C.A.",
    categoria: "aerolineas",
    fecha: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Liquidación Quincenal de Emisiones Boletos Nacionales & MIA",
    tipo: "factura",
    total: 3200.00,
    saldo: 1200.00, // $2.000 abonados en pago PAG-2026-001
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  },
  {
    id: "cxp-002",
    factura_id: "FAC-AIR-8902",
    proveedor_id: "ct-airline-01",
    proveedor: "Laser Airlines, C.A.",
    categoria: "aerolineas",
    fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Liquidación Boletos Ruta Caracas - Santo Domingo",
    tipo: "factura",
    total: 1850.00,
    saldo: 1850.00,
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  },
  // 2. Aerolínea Al Día (Copa Airlines)
  {
    id: "cxp-003",
    factura_id: "FAC-COPA-4410",
    proveedor_id: "ct-airline-02",
    proveedor: "Copa Airlines (Compañía Panameña de Aviación)",
    categoria: "aerolineas",
    fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Liquidación BSP Emisión Rutas Internacionales",
    tipo: "factura",
    total: 2400.00,
    saldo: 2400.00,
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  },
  // 3. Proveedor con Anticipo Otorgado / Saldo a Favor Nuestro (Kiu System Solutions)
  {
    id: "cxp-004",
    factura_id: "ANT-PROV-001",
    proveedor_id: "ct-supplier-01",
    proveedor: "Kiu System Solutions (GDS)",
    categoria: "proveedores",
    fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Anticipo de saldo para cupo de emisiones GDS",
    tipo: "anticipo",
    total: -1000.00,
    saldo: -1000.00,
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  },
  // 4. Freelance (Comisiones por Pagar)
  {
    id: "cxp-005",
    factura_id: "COM-FL-022",
    proveedor_id: "ct-freelance-01",
    proveedor: "Carlos Eduardo Pérez (Freelance)",
    categoria: "freelance",
    fecha: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Comisión por ventas y emisiones de vuelos internacionales",
    tipo: "factura",
    total: 180.00,
    saldo: 180.00,
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  },
  // 5. Intercompañías
  {
    id: "cxp-006",
    factura_id: "DEU-INT-2026-01",
    proveedor_id: "ct-inter-01",
    proveedor: "Inversiones Grupo Halley Holding, C.A.",
    categoria: "intercompanias",
    fecha: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Aporte por canon de arrendamiento y servicios compartidos",
    tipo: "factura",
    total: 1500.00,
    saldo: 1500.00,
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  },
  // 6. Accionistas
  {
    id: "cxp-007",
    factura_id: "DIV-ACC-2026-01",
    proveedor_id: "ct-share-01",
    proveedor: "Ing. Alejandro Morales (Accionista)",
    categoria: "accionistas",
    fecha: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vencimiento: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: "Dividendos decretados pendientes de liquidación",
    tipo: "factura",
    total: 2000.00,
    saldo: 2000.00,
    moneda: "USD",
    tasa: 1.0,
    estado: "pendiente"
  }
];

export async function dbFetchCxp(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data, error } = await supabase.from('cuentas_pagar_cxp').select('*').eq('empresa_id', empresaId).order('fecha', { ascending: false });
      if (!error && data && data.length > 0) {
        return (data || []).map((row: any) => ({
          id: row.id,
          factura_id: row.factura_id,
          proveedor_id: row.proveedor_id,
          proveedor: row.proveedor,
          categoria: row.categoria || 'proveedores',
          fecha: row.fecha,
          vencimiento: row.vencimiento,
          descripcion: row.descripcion,
          tipo: row.tipo || 'factura',
          total: Number(row.total) || 0,
          saldo: Number(row.saldo) || 0,
          moneda: row.moneda || 'USD',
          tasa: Number(row.tasa) || 1.0,
          estado: (Number(row.saldo) || 0) <= 0.009 ? 'pagada' : 'pendiente'
        }));
      }
    } catch {}
  }
  const local = getLocal<any[]>(`erp_local_cxp_${cid}`, DEFAULT_CXP);
  if (!local || local.length === 0) {
    setLocal(`erp_local_cxp_${cid}`, DEFAULT_CXP);
    return DEFAULT_CXP;
  }
  return local;
}

export async function dbSaveCxp(cxp: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_cxp_${cid}`, []);
  const formatted = {
    id: cxp.id || `cxp_${Date.now()}`,
    factura_id: cxp.factura_id || cxp.facturaId || cxp.numeroFactura || '',
    proveedor_id: cxp.proveedor_id || cxp.proveedorId || '',
    proveedor: cxp.proveedor || cxp.proveedorNombre || '',
    categoria: cxp.categoria || 'proveedores',
    fecha: cxp.fecha || cxp.fechaEmision || new Date().toISOString().split('T')[0],
    vencimiento: cxp.vencimiento || cxp.fechaVencimiento || cxp.fecha || new Date().toISOString().split('T')[0],
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
  setLocal(`erp_local_cxp_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const payload = {
        id: formatted.id,
        empresa_id: empresaId,
        factura_id: formatted.factura_id,
        proveedor_id: formatted.proveedor_id,
        proveedor: formatted.proveedor,
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
      await supabase.from('cuentas_pagar_cxp').upsert(payload);
    } catch {}
  }
  return true;
}

export async function dbDeleteCxp(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_cxp_${cid}`, []);
  setLocal(`erp_local_cxp_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('cuentas_pagar_cxp').delete().eq('id', id);
    } catch {}
  }
  return true;
}

// ============================================================================
// 16. COBRANZAS Y PAGOS REALIZADOS
// ============================================================================

export const DEFAULT_COBRANZAS = [
  {
    id: "cob-001",
    reciboNumero: "REC-2026-001",
    referencia: "REF-TRANSF-449102",
    clienteId: "ct-aliado-01",
    clienteNombre: "Agencia de Viajes Destinos & Sol, C.A.",
    fecha: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    monto: 500.00,
    montoTotal: 500.00,
    montoBanco: 500.00,
    bancoId: "banco-1",
    abonos: {
      "cxc-001": "500.00"
    },
    detalles: [
      { docId: "cxc-001", factura: "FAC-2026-101", monto: 500.00 }
    ],
    notas: "Abono bancario Banesco a factura Air Europa",
    estado: "activo"
  }
];

export async function dbFetchCobranzas(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data, error } = await supabase.from('cobranzas').select('*').eq('empresa_id', empresaId).order('fecha', { ascending: false });
      if (!error && data && data.length > 0) {
        return (data || []).map((r: any) => ({
          id: r.id,
          reciboNumero: r.recibo_numero,
          referencia: r.recibo_numero || '',
          clienteId: r.cliente_id,
          clienteNombre: r.cliente_nombre,
          fecha: r.fecha,
          monto: Number(r.monto_total) || 0,
          montoTotal: Number(r.monto_total) || 0,
          montoBanco: Number(r.monto_total) || 0,
          bancoId: r.banco_id,
          comprobanteId: r.comprobante_id,
          retencionIva: Number(r.retencion_iva) || 0,
          retencionIslr: Number(r.retencion_islr) || 0,
          diferencialCambiario: Number(r.diferencial_cambiario) || 0,
          detalles: r.detalles || [],
          abonos: r.detalles ? r.detalles.reduce((acc: any, d: any) => ({ ...acc, [d.docId || d.id]: d.monto }), {}) : {},
          notas: r.notas || '',
          estado: (r.notas || '').includes('ANULADO') ? 'anulado' : 'activo'
        }));
      }
    } catch {}
  }
  const local = getLocal<any[]>(`erp_local_cobranzas_${cid}`, DEFAULT_COBRANZAS);
  if (!local || local.length === 0) {
    setLocal(`erp_local_cobranzas_${cid}`, DEFAULT_COBRANZAS);
    return DEFAULT_COBRANZAS;
  }
  return local;
}

export async function dbSaveCobranza(cob: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_cobranzas_${cid}`, []);
  const formatted = {
    id: cob.id || `cob_${Date.now()}`,
    reciboNumero: cob.referencia || cob.reciboNumero || cob.recibo_numero || `REC-${Date.now().toString().slice(-6)}`,
    referencia: cob.referencia || cob.reciboNumero || cob.recibo_numero || `REC-${Date.now().toString().slice(-6)}`,
    clienteId: cob.clienteId || cob.cliente_id || '',
    clienteNombre: cob.clienteNombre || cob.cliente_nombre || '',
    fecha: cob.fecha || new Date().toISOString().split('T')[0],
    monto: Number(cob.monto ?? cob.montoTotal ?? cob.monto_total ?? cob.montoBanco) || 0,
    montoTotal: Number(cob.monto ?? cob.montoTotal ?? cob.monto_total ?? cob.montoBanco) || 0,
    montoBanco: Number(cob.monto ?? cob.montoTotal ?? cob.monto_total ?? cob.montoBanco) || 0,
    bancoId: cob.bancoId || cob.banco_id || null,
    comprobanteId: cob.comprobanteId || cob.comprobante_id || null,
    retencionIva: Number(cob.retencionIva || cob.retencion_iva) || 0,
    retencionIslr: Number(cob.retencionIslr || cob.retencion_islr) || 0,
    diferencialCambiario: Number(cob.diferencialCambiario || cob.diferencial_cambiario) || 0,
    detalles: cob.detalles || cob.abonos || [],
    notas: cob.estado === 'anulado' ? 'ANULADO' : (cob.notas || ''),
    estado: cob.estado || 'activo'
  };
  const idx = list.findIndex(c => c.id === formatted.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  setLocal(`erp_local_cobranzas_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const payload = {
        id: formatted.id,
        empresa_id: empresaId,
        recibo_numero: formatted.reciboNumero,
        cliente_id: formatted.clienteId,
        cliente_nombre: formatted.clienteNombre,
        fecha: formatted.fecha,
        monto_total: formatted.montoTotal,
        banco_id: formatted.bancoId,
        comprobante_id: formatted.comprobanteId,
        retencion_iva: formatted.retencionIva,
        retencion_islr: formatted.retencionIslr,
        diferencial_cambiario: formatted.diferencialCambiario,
        detalles: formatted.detalles,
        notas: formatted.notas
      };
      await supabase.from('cobranzas').upsert(payload);
    } catch {}
  }
  return true;
}

export async function dbDeleteCobranza(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_cobranzas_${cid}`, []);
  setLocal(`erp_local_cobranzas_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('cobranzas').delete().eq('id', id);
    } catch {}
  }
  return true;
}

export const DEFAULT_PAGOS_REALIZADOS = [
  {
    id: "pag-001",
    comprobantePago: "PAG-2026-001",
    referencia: "REF-TRANSF-110293",
    proveedorId: "ct-airline-01",
    proveedorNombre: "Laser Airlines, C.A.",
    fecha: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    monto: 2000.00,
    montoTotal: 2000.00,
    bancoId: "banco-1",
    abonos: {
      "cxp-001": "2000.00"
    },
    detalles: [
      { docId: "cxp-001", factura: "FAC-AIR-8821", monto: 2000.00 }
    ],
    notas: "Transferencia bancaria Banesco pago parcial liquidación boletos",
    estado: "activo"
  }
];

export async function dbFetchPagosRealizados(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data, error } = await supabase.from('pagos_realizados').select('*').eq('empresa_id', empresaId).order('fecha', { ascending: false });
      if (!error && data && data.length > 0) {
        return (data || []).map((r: any) => ({
          id: r.id,
          comprobantePago: r.comprobante_pago,
          referencia: r.comprobante_pago || '',
          proveedorId: r.proveedor_id,
          proveedorNombre: r.proveedor_nombre,
          fecha: r.fecha,
          monto: Number(r.monto_total) || 0,
          montoTotal: Number(r.monto_total) || 0,
          bancoId: r.banco_id,
          comprobanteId: r.comprobante_id,
          retencionIva: Number(r.retencion_iva) || 0,
          retencionIslr: Number(r.retencion_islr) || 0,
          diferencialCambiario: Number(r.diferencial_cambiario) || 0,
          detalles: r.detalles || [],
          abonos: r.detalles ? r.detalles.reduce((acc: any, d: any) => ({ ...acc, [d.docId || d.id]: d.monto }), {}) : {},
          notas: r.notas || '',
          estado: (r.notas || '').includes('ANULADO') ? 'anulado' : 'activo'
        }));
      }
    } catch {}
  }
  const local = getLocal<any[]>(`erp_local_pagos_${cid}`, DEFAULT_PAGOS_REALIZADOS);
  if (!local || local.length === 0) {
    setLocal(`erp_local_pagos_${cid}`, DEFAULT_PAGOS_REALIZADOS);
    return DEFAULT_PAGOS_REALIZADOS;
  }
  return local;
}

export async function dbSavePagoRealizado(pago: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_pagos_${cid}`, []);
  const formatted = {
    id: pago.id || `pag_${Date.now()}`,
    comprobantePago: pago.referencia || pago.comprobantePago || pago.comprobante_pago || `PAG-${Date.now().toString().slice(-6)}`,
    referencia: pago.referencia || pago.comprobantePago || pago.comprobante_pago || `PAG-${Date.now().toString().slice(-6)}`,
    proveedorId: pago.proveedorId || pago.proveedor_id || '',
    proveedorNombre: pago.proveedorNombre || pago.proveedor_nombre || '',
    fecha: pago.fecha || new Date().toISOString().split('T')[0],
    monto: Number(pago.monto ?? pago.montoTotal ?? pago.monto_total) || 0,
    montoTotal: Number(pago.monto ?? pago.montoTotal ?? pago.monto_total) || 0,
    bancoId: pago.bancoId || pago.banco_id || null,
    comprobanteId: pago.comprobanteId || pago.comprobante_id || null,
    retencionIva: Number(pago.retencionIva || pago.retencion_iva) || 0,
    retencionIslr: Number(pago.retencionIslr || pago.retencion_islr) || 0,
    diferencialCambiario: Number(pago.diferencialCambiario || pago.diferencial_cambiario) || 0,
    detalles: pago.detalles || pago.abonos || [],
    notas: pago.estado === 'anulado' ? 'ANULADO' : (pago.notas || ''),
    estado: pago.estado || 'activo'
  };
  const idx = list.findIndex(p => p.id === formatted.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  setLocal(`erp_local_pagos_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const payload = {
        id: formatted.id,
        empresa_id: empresaId,
        comprobante_pago: formatted.comprobantePago,
        proveedor_id: formatted.proveedorId,
        proveedor_nombre: formatted.proveedorNombre,
        fecha: formatted.fecha,
        monto_total: formatted.montoTotal,
        banco_id: formatted.bancoId,
        comprobante_id: formatted.comprobanteId,
        retencion_iva: formatted.retencionIva,
        retencion_islr: formatted.retencionIslr,
        diferencial_cambiario: formatted.diferencialCambiario,
        detalles: formatted.detalles,
        notas: formatted.notas
      };
      await supabase.from('pagos_realizados').upsert(payload);
    } catch {}
  }
  return true;
}

export async function dbDeletePagoRealizado(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_pagos_${cid}`, []);
  setLocal(`erp_local_pagos_${cid}`, list.filter(p => p.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('pagos_realizados').delete().eq('id', id);
    } catch {}
  }
  return true;
}

// ============================================================================
// 17. COMPROBANTES DE DIARIO Y LÍNEAS DE ASIENTO
// ============================================================================

export async function dbFetchComprobantes(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data: vouchers, error } = await supabase.from('comprobantes_diario').select('*').eq('empresa_id', empresaId).order('fecha', { ascending: false });
      if (!error && vouchers && vouchers.length > 0) {
        const voucherIds = vouchers.map((v: any) => v.id);
        const linesMap = new Map<string, any[]>();
        if (voucherIds.length > 0) {
          const { data: lines } = await supabase
            .from('lineas_comprobante')
            .select('*')
            .in('comprobante_id', voucherIds)
            .order('orden', { ascending: true });
          (lines || []).forEach((l: any) => {
            if (!linesMap.has(l.comprobante_id)) linesMap.set(l.comprobante_id, []);
            linesMap.get(l.comprobante_id)!.push({
              id: l.id,
              cuentaId: l.cuenta_id,
              descripcion: l.descripcion,
              debe: Number(l.debe) || 0,
              haber: Number(l.haber) || 0,
              orden: l.orden
            });
          });
        }

        return vouchers.map((v: any) => {
          const vLines = linesMap.get(v.id) || [];
          const computedTotal = Number(v.total) || (vLines.length > 0 ? vLines.reduce((acc: number, l: any) => acc + (Number(l.debe) || 0), 0) : 0);
          return {
            id: v.id,
            numero: v.numero,
            fecha: v.fecha,
            tipo: v.tipo || 'Diario',
            descripcion: v.descripcion,
            referencia: v.referencia,
            total: computedTotal,
            estado: v.estado || 'Contabilizado',
            createdBy: v.created_by,
            lineas: vLines
          };
        });
      }
    } catch {}
  }
  return getLocal<any[]>(`erp_local_comprobantes_${cid}`, []);
}

export async function dbSaveComprobante(comp: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_comprobantes_${cid}`, []);
  const linesTotal = Array.isArray(comp.lineas) && comp.lineas.length > 0 
    ? comp.lineas.reduce((acc: number, l: any) => acc + (Number(l.debe) || 0), 0) 
    : 0;
  const formatted = {
    id: comp.id || `diar_${Date.now()}`,
    numero: comp.numero || `DIAR-${Date.now().toString().slice(-6)}`,
    fecha: comp.fecha || new Date().toISOString().split('T')[0],
    tipo: comp.tipo || 'Diario',
    descripcion: comp.descripcion || '',
    referencia: comp.referencia || '',
    total: Number(comp.total) || linesTotal,
    estado: comp.estado || 'Contabilizado',
    createdBy: comp.createdBy || comp.created_by || 'Sistema',
    lineas: comp.lineas || []
  };
  const idx = list.findIndex(c => c.id === formatted.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  setLocal(`erp_local_comprobantes_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const payload = {
        id: formatted.id,
        empresa_id: empresaId,
        numero: formatted.numero,
        fecha: formatted.fecha,
        tipo: formatted.tipo,
        descripcion: formatted.descripcion,
        referencia: formatted.referencia,
        total: formatted.total,
        estado: formatted.estado,
        created_by: formatted.createdBy
      };
      await supabase.from('comprobantes_diario').upsert(payload);

      if (Array.isArray(comp.lineas) && comp.lineas.length > 0) {
        await supabase.from('lineas_comprobante').delete().eq('comprobante_id', comp.id);
        const linesPayload = comp.lineas.map((l: any, idx: number) => ({
          id: l.id || `${comp.id}-l${idx + 1}`,
          comprobante_id: comp.id,
          cuenta_id: l.cuentaId || l.cuenta_id || '1.1.1',
          descripcion: l.descripcion || '',
          debe: Number(l.debe) || 0,
          haber: Number(l.haber) || 0,
          orden: idx + 1
        }));
        await supabase.from('lineas_comprobante').insert(linesPayload);
      }
    } catch {}
  }
  return true;
}

export async function dbDeleteComprobante(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = getLocal<any[]>(`erp_local_comprobantes_${cid}`, []);
  setLocal(`erp_local_comprobantes_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('comprobantes_diario').delete().eq('id', id);
    } catch {}
  }
  return true;
}

// ============================================================================
// 18. CATÁLOGO DE PRODUCTOS / SERVICIOS
// ============================================================================

export async function dbFetchServicios(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  const local = localStorage.getItem(`app_servicios_${cid}`);
  const fallback = local ? JSON.parse(local) : [];
  if (!isSupabaseConfigured || !supabase || !empresaId) return fallback;
  try {
    const { data, error } = await supabase
      .from('servicios')
      .select('*')
      .eq('empresa_id', empresaId);
    if (error || !data) return fallback;
    return data.map((s: any) => ({
      id: s.id,
      codigo: s.codigo,
      nombre: s.nombre,
      descripcion: s.descripcion,
      precioBase: Number(s.precio_base || s.precioBase) || 0,
      cuentaContableId: s.cuenta_contable_id || s.cuentaContableId || ''
    }));
  } catch (e) {
    return fallback;
  }
}

export async function dbSaveServicio(servicio: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const local = localStorage.getItem(`app_servicios_${cid}`);
    const list = local ? JSON.parse(local) : [];
    const idx = list.findIndex((s: any) => String(s.id) === String(servicio.id));
    let updated: any[];
    if (idx >= 0) {
      updated = [...list];
      updated[idx] = { ...updated[idx], ...servicio };
    } else {
      updated = [...list, servicio];
    }
    localStorage.setItem(`app_servicios_${cid}`, JSON.stringify(updated));

    if (isSupabaseConfigured && supabase && empresaId) {
      const payload = {
        id: servicio.id,
        empresa_id: empresaId,
        codigo: servicio.codigo || `SERV-${Date.now().toString().slice(-4)}`,
        nombre: servicio.nombre || '',
        descripcion: servicio.descripcion || '',
        precio_base: Number(servicio.precioBase || servicio.precio_base) || 0,
        cuenta_contable_id: servicio.cuentaContableId || servicio.cuenta_contable_id || null
      };
      await supabase.from('servicios').upsert(payload);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbDeleteServicio(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  try {
    const local = localStorage.getItem(`app_servicios_${cid}`);
    if (local) {
      const list = JSON.parse(local);
      const filtered = list.filter((s: any) => String(s.id) !== String(id));
      localStorage.setItem(`app_servicios_${cid}`, JSON.stringify(filtered));
    }
    if (isSupabaseConfigured && supabase) {
      await supabase.from('servicios').delete().eq('id', id);
    }
    return true;
  } catch (e) {
    return false;
  }
}

// ============================================================================
// 10. SOLICITUDES DE BANCO (CONFIRMACIONES DE INGRESO Y SOLICITUDES DE PAGO)
// ============================================================================

export const DEFAULT_SOLICITUDES_BANCO = [
  {
    id: "sol-ing-001",
    tipo: "confirmacion_ingreso",
    estado: "pendiente",
    fecha: new Date().toISOString().split('T')[0],
    contacto_id: "ct-aliado-01",
    contacto_nombre: "Agencia de Viajes Destinos & Sol, C.A.",
    contacto_tipo: "aliados",
    banco_id: "banco-1",
    banco_nombre: "Banesco Banco Universal",
    monto: 850.00,
    moneda: "USD",
    tasa: 1.0,
    referencia: "REF-74829104",
    metodo_pago: "Transferencia",
    descripcion: "Reporte de transferencia por emisión de boletos Laser CCS-MIA",
    categoria_concepto: "emision_boletos",
    created_at: new Date().toISOString()
  },
  {
    id: "sol-pago-001",
    tipo: "solicitud_pago",
    estado: "pendiente",
    fecha: new Date().toISOString().split('T')[0],
    fecha_requerida: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    contacto_id: "ct-freelance-01",
    contacto_nombre: "Carlos Eduardo Pérez (Freelance)",
    contacto_tipo: "freelance",
    banco_id: "banco-1",
    banco_nombre: "Banesco Banco Universal",
    monto: 120.00,
    moneda: "USD",
    tasa: 1.0,
    referencia: "COM-JUL-01",
    metodo_pago: "Pago Móvil",
    descripcion: "Liquidación de comisiones por venta de boletos mes en curso",
    categoria_concepto: "comision_freelance",
    datos_pago_beneficiario: {
      banco_destino: "Banesco Banco Universal",
      pago_movil: "0412-9876543 / V-18492019 / 0134",
      titular: "Carlos Eduardo Pérez",
      identificacion: "V-18492019"
    },
    created_at: new Date().toISOString()
  },
  {
    id: "sol-pago-002",
    tipo: "solicitud_pago",
    estado: "pendiente",
    fecha: new Date().toISOString().split('T')[0],
    fecha_requerida: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    contacto_id: "ct-airline-052",
    contacto_nombre: "Laser Airlines, C.A.",
    contacto_tipo: "airline",
    banco_id: "banco-1",
    banco_nombre: "Banesco Banco Universal",
    monto: 1450.00,
    moneda: "USD",
    tasa: 1.0,
    referencia: "LIQ-052-0826",
    metodo_pago: "Transferencia",
    descripcion: "Pago liquidación quincenal emisiones boletos GDS Kiu",
    categoria_concepto: "pago_aerolinea",
    datos_pago_beneficiario: {
      banco_destino: "Banesco Banco Universal USD",
      cuenta_destino: "0134-0001-01-0000000001",
      titular: "Laser Airlines, C.A.",
      identificacion: "J-30291823-1"
    },
    created_at: new Date().toISOString()
  }
];

export async function dbFetchSolicitudesBanco(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      const { data, error } = await supabase.from('solicitudes_banco').select('*').eq('empresa_id', empresaId).order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
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
  const local = getLocal<any[]>(`erp_local_solicitudes_banco_${cid}`, DEFAULT_SOLICITUDES_BANCO);
  if (!local || local.length === 0) {
    setLocal(`erp_local_solicitudes_banco_${cid}`, DEFAULT_SOLICITUDES_BANCO);
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
    setLocal(`erp_local_solicitudes_banco_${cid}`, updated);

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
    setLocal(`erp_local_solicitudes_banco_${cid}`, filtered);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('solicitudes_banco').delete().eq('id', id);
      } catch {}
    }
    return true;
  } catch {
    return false;
  }
}



// ============================================================================
// CATEGORÍAS DE ACTIVOS FIJOS, ACTIVOS Y DEPRECIACIONES
// ============================================================================

export async function dbFetchCategoriasActivos(empresaId?: string): Promise<any[]> {
  try {
    const cid = empresaId || 'default';
    const local = localStorage.getItem(`app_categorias_activos_${cid}`);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [];
  } catch (e) {
    return [];
  }
}

export async function dbSaveCategoriaActivo(cat: any, empresaId: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    const current = await dbFetchCategoriasActivos(cid);
    const existingIndex = current.findIndex((c: any) => String(c.id) === String(cat.id));
    let updated: any[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = { ...updated[existingIndex], ...cat };
    } else {
      updated = [...current, cat];
    }
    localStorage.setItem(`app_categorias_activos_${cid}`, JSON.stringify(updated));
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbDeleteCategoriaActivo(id: string, empresaId: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    const current = await dbFetchCategoriasActivos(cid);
    const filtered = current.filter((c: any) => String(c.id) !== String(id));
    localStorage.setItem(`app_categorias_activos_${cid}`, JSON.stringify(filtered));
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbSaveCategoriasActivos(cats: any[], empresaId: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    localStorage.setItem(`app_categorias_activos_${cid}`, JSON.stringify(cats));
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbFetchActivosFijos(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  const localList = localStorage.getItem(`app_activos_fijos_${cid}`);
  const fallback = localList ? JSON.parse(localList) : [];
  
  if (!isSupabaseConfigured || !supabase) return fallback;
  try {
    let query = supabase.from('activos_fijos').select('*').order('created_at', { ascending: false });
    if (empresaId) query = query.eq('empresa_id', empresaId);
    const { data, error } = await query;
    if (error) {
      console.warn('Error al cargar activos fijos de Supabase:', error.message);
      return fallback;
    }
    if (!data || data.length === 0) return fallback;
    return (data || []).map((row: any) => ({
      id: row.id,
      codigo: row.codigo,
      nombre: row.nombre,
      descripcion: row.nombre,
      categoriaId: row.categoria,
      categoriaNombre: row.categoria,
      fechaAdquisicion: row.fecha_adquisicion,
      valorInicial: Number(row.valor_compra) || 0,
      vidaUtilMeses: row.vida_util_meses || 60,
      depreciacionAcumulada: Number(row.depreciacion_acumulada) || 0,
      cuentaActivo: row.cuenta_activo_id || '',
      cuentaGastoDeprec: row.cuenta_gasto_deprec_id || '',
      estado: row.estado || 'Activo'
    }));
  } catch (e) {
    return fallback;
  }
}

export async function dbSaveActivoFijo(activo: any, empresaId: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    const localList = localStorage.getItem(`app_activos_fijos_${cid}`);
    const current = localList ? JSON.parse(localList) : [];
    const idx = current.findIndex((a: any) => String(a.id) === String(activo.id));
    let updatedList: any[];
    if (idx >= 0) {
      updatedList = [...current];
      updatedList[idx] = { ...updatedList[idx], ...activo };
    } else {
      updatedList = [...current, activo];
    }
    localStorage.setItem(`app_activos_fijos_${cid}`, JSON.stringify(updatedList));

    if (isSupabaseConfigured && supabase && empresaId) {
      const payload = {
        id: String(activo.id),
        empresa_id: empresaId,
        codigo: activo.codigo || `AF-${Date.now().toString().slice(-4)}`,
        nombre: activo.descripcion || activo.nombre || 'Activo Fijo',
        categoria: activo.categoriaNombre || activo.categoriaId || 'General',
        fecha_adquisicion: activo.fechaAdquisicion || new Date().toISOString().split('T')[0],
        valor_compra: Number(activo.valorInicial || activo.valorCompra) || 0,
        vida_util_meses: Number(activo.vidaUtilMeses || (Number(activo.vidaUtil || 5) * 12)) || 60,
        depreciacion_acumulada: Number(activo.depreciacionAcumulada) || 0,
        cuenta_activo_id: activo.cuentaActivo || activo.cuenta_activo_id || null,
        cuenta_gasto_deprec_id: activo.cuentaGastoDeprec || activo.cuenta_gasto_deprec_id || null,
        estado: activo.estado || 'Activo'
      };
      await supabase.from('activos_fijos').upsert(payload);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbDeleteActivoFijo(id: string): Promise<boolean> {
  try {
    if (isSupabaseConfigured && supabase) {
      await supabase.from('activos_fijos').delete().eq('id', id);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbFetchDepreciaciones(empresaId?: string): Promise<any[]> {
  try {
    const cid = empresaId || 'default';
    const local = localStorage.getItem(`app_depreciaciones_${cid}`);
    return local ? JSON.parse(local) : [];
  } catch (e) {
    return [];
  }
}

export async function dbSaveDepreciacion(dep: any, empresaId: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    const current = await dbFetchDepreciaciones(cid);
    const updated = [...current, dep];
    localStorage.setItem(`app_depreciaciones_${cid}`, JSON.stringify(updated));
    return true;
  } catch (e) {
    return false;
  }
}

export async function dbSaveDepreciaciones(deps: any[], empresaId: string): Promise<boolean> {
  try {
    const cid = empresaId || 'default';
    localStorage.setItem(`app_depreciaciones_${cid}`, JSON.stringify(deps));
    return true;
  } catch (e) {
    return false;
  }
}



