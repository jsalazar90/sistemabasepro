import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isUUID, getLocal, setLocal, getTodayLocalDate } from './storageHelper';

export const DEFAULT_CUENTAS: any[] = [];

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
  { id: "1.1.01.001", codigo: "1.1.01.001", nombre: "Caja Chica Administración", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.002", codigo: "1.1.01.002", nombre: "Caja Chica Ventas & Tiendas", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.003", codigo: "1.1.01.003", nombre: "Caja Bóveda Principal Moneda Extranjera", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.004", codigo: "1.1.01.004", nombre: "Banesco Banco Universal (Cuenta Cte)", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.005", codigo: "1.1.01.005", nombre: "Banco Mercantil (Sobregiro Operativo NIIF)", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.006", codigo: "1.1.01.006", nombre: "BBVA Banco Provincial (Cuenta Cte)", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.007", codigo: "1.1.01.007", nombre: "Banco Nacional de Crédito BNC", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.008", codigo: "1.1.01.008", nombre: "JPMorgan Chase Bank (USD Operaciones)", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.01.009", codigo: "1.1.01.009", nombre: "Fondos de Inversión Líquida a Corto Plazo", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 1.1.02 Inversiones Temporales
  { id: "1.1.02", codigo: "1.1.02", nombre: "Inversiones Financieras a Corto Plazo", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.02.001", codigo: "1.1.02.001", nombre: "Certificados de Depósito a Plazo Fijo", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.02.002", codigo: "1.1.02.002", nombre: "Bonos Soberanos e Inversiones Negociables", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 1.1.03 Exigible / Cuentas por Cobrar
  { id: "1.1.03", codigo: "1.1.03", nombre: "Deudores Comerciales y Cuentas por Cobrar", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.03.001", codigo: "1.1.03.001", nombre: "Clientes Nacionales al Día", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.03.002", codigo: "1.1.03.002", nombre: "Clientes en Gestión de Cobranza Morosa", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.03.003", codigo: "1.1.03.003", nombre: "Provisión para Cuentas Incobrables", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.03.004", codigo: "1.1.03.004", nombre: "Cuentas por Cobrar a Empresas Filiales", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.03.005", codigo: "1.1.03.005", nombre: "Cuentas por Cobrar a Empleados y Préstamos", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.03.006", codigo: "1.1.03.006", nombre: "Anticipos a Proveedores y Contratistas", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.03.007", codigo: "1.1.03.007", nombre: "Reclamaciones a Compañías de Seguros", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 1.1.04 Inventarios
  { id: "1.1.04", codigo: "1.1.04", nombre: "Inventarios y Mercancías", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.04.001", codigo: "1.1.04.001", nombre: "Inventario de Mercancía para la Venta", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.04.002", codigo: "1.1.04.002", nombre: "Mercancías en Tránsito e Importación", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.04.003", codigo: "1.1.04.003", nombre: "Inventario de Repuestos y Accesorios", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.04.004", codigo: "1.1.04.004", nombre: "Inventario de Materiales de Embalaje", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 1.1.05 Otros Activos Corrientes
  { id: "1.1.05", codigo: "1.1.05", nombre: "Otros Activos Corrientes y Pagos Anticipados", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.1.05.001", codigo: "1.1.05.001", nombre: "Crédito Fiscal IVA por Compensar", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.05.002", codigo: "1.1.05.002", nombre: "Retenciones de IVA Soportadas en Ventas", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.05.003", codigo: "1.1.05.003", nombre: "Anticipos de ISLR Declarados", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.05.004", codigo: "1.1.05.004", nombre: "Seguros de Flota Pagados por Anticipado", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.1.05.005", codigo: "1.1.05.005", nombre: "Alquileres de Sedes Pagados por Anticipado", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 1.2 ACTIVO NO CORRIENTE
  { id: "1.2", codigo: "1.2", nombre: "Activo No Corriente", nivel: 2, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.2.01", codigo: "1.2.01", nombre: "Propiedad, Planta y Equipos (Fijos)", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.2.01.001", codigo: "1.2.01.001", nombre: "Terrenos Industriales y Urbanos", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.002", codigo: "1.2.01.002", nombre: "Edificaciones Comerciales y Galpón Principal", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.003", codigo: "1.2.01.003", nombre: "Depreciación Acumulada de Edificaciones", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.004", codigo: "1.2.01.004", nombre: "Maquinarias y Equipos Industriales", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.005", codigo: "1.2.01.005", nombre: "Depreciación Acumulada de Maquinarias", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.006", codigo: "1.2.01.006", nombre: "Vehículos y Camiones de Carga Pesada", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.007", codigo: "1.2.01.007", nombre: "Depreciación Acumulada de Vehículos", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.008", codigo: "1.2.01.008", nombre: "Equipos de Computación, Redes y Servidores", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.009", codigo: "1.2.01.009", nombre: "Depreciación Acumulada Equipos de Computación", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.010", codigo: "1.2.01.010", nombre: "Mobiliario, Muebles y Enseres de Oficina", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.01.011", codigo: "1.2.01.011", nombre: "Depreciación Acumulada de Mobiliario", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 1.2.02 Intangibles y Diferidos
  { id: "1.2.02", codigo: "1.2.02", nombre: "Activos Intangibles y Diferidos", nivel: 3, tipo: "Grupo", grupo: "Activo", naturaleza: "Deudora" },
  { id: "1.2.02.001", codigo: "1.2.02.001", nombre: "Licencias de Software y Sistemas ERP", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.02.002", codigo: "1.2.02.002", nombre: "Amortización Acumulada de Software", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.02.003", codigo: "1.2.02.003", nombre: "Marcas Registradas y Patentes", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "1.2.02.004", codigo: "1.2.02.004", nombre: "Depósitos en Garantía a Largo Plazo", nivel: 4, tipo: "Movimiento", grupo: "Activo", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },

  // 2. PASIVOS
  { id: "2", codigo: "2", nombre: "PASIVO", nivel: 1, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1", codigo: "2.1", nombre: "Pasivo Corriente", nivel: 2, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },

  // 2.1.01 Comerciales
  { id: "2.1.01", codigo: "2.1.01", nombre: "Cuentas y Obligaciones Comerciales por Pagar", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1.01.001", codigo: "2.1.01.001", nombre: "Proveedores Nacionales Comerciales", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.01.002", codigo: "2.1.01.002", nombre: "Proveedores del Exterior e Importaciones", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.01.003", codigo: "2.1.01.003", nombre: "Contratistas y Servicios Especializados por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.01.004", codigo: "2.1.01.004", nombre: "Facturas Pendientes de Recibir / Provisiones", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 2.1.02 Laborales
  { id: "2.1.02", codigo: "2.1.02", nombre: "Obligaciones Laborales y con el Personal", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1.02.001", codigo: "2.1.02.001", nombre: "Sueldos y Salarios por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.02.002", codigo: "2.1.02.002", nombre: "Vacaciones y Bono Vacacional Acumulado", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.02.003", codigo: "2.1.02.003", nombre: "Utilidades y Bonificaciones de Fin de Año", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.02.004", codigo: "2.1.02.004", nombre: "Prestaciones Sociales Acumuladas Corrientes", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.02.005", codigo: "2.1.02.005", nombre: "Aportes Patronales IVSS / FAOV / INCES", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 2.1.03 Fiscales
  { id: "2.1.03", codigo: "2.1.03", nombre: "Tributos e Impuestos por Pagar", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1.03.001", codigo: "2.1.03.001", nombre: "Débito Fiscal IVA por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.03.002", codigo: "2.1.03.002", nombre: "Retenciones de IVA por Enterar al Fisco", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.03.003", codigo: "2.1.03.003", nombre: "Retenciones de ISLR por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.03.004", codigo: "2.1.03.004", nombre: "Impuesto Sobre la Renta (ISLR) por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.03.005", codigo: "2.1.03.005", nombre: "Impuestos Municipales / Patente de Comercio", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 2.1.04 Financieros y Anticipos
  { id: "2.1.04", codigo: "2.1.04", nombre: "Préstamos y Créditos a Corto Plazo", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.1.04.001", codigo: "2.1.04.001", nombre: "Pagarés y Créditos Bancarios a Corto Plazo", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.04.002", codigo: "2.1.04.002", nombre: "Porción Circulante de Deuda a Largo Plazo", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.04.003", codigo: "2.1.04.003", nombre: "Intereses Devengados por Pagar", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.1.04.004", codigo: "2.1.04.004", nombre: "Anticipos Recibidos de Clientes", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 2.2 PASIVO NO CORRIENTE
  { id: "2.2", codigo: "2.2", nombre: "Pasivo No Corriente", nivel: 2, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.2.01", codigo: "2.2.01", nombre: "Deudas y Obligaciones a Largo Plazo", nivel: 3, tipo: "Grupo", grupo: "Pasivo", naturaleza: "Acreedora" },
  { id: "2.2.01.001", codigo: "2.2.01.001", nombre: "Préstamos Bancarios Comerciales a Largo Plazo", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.2.01.002", codigo: "2.2.01.002", nombre: "Hipotecas por Pagar sobre Inmueble Sede", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.2.01.003", codigo: "2.2.01.003", nombre: "Bonos Financieros y Títulos de Deuda", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "2.2.01.004", codigo: "2.2.01.004", nombre: "Provisión para Indemnizaciones Laborales a Largo Plazo", nivel: 4, tipo: "Movimiento", grupo: "Pasivo", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 3. PATRIMONIO NETO
  { id: "3", codigo: "3", nombre: "PATRIMONIO", nivel: 1, tipo: "Grupo", grupo: "Patrimonio", naturaleza: "Acreedora" },
  { id: "3.1", codigo: "3.1", nombre: "Patrimonio Neto y Reservas", nivel: 2, tipo: "Grupo", grupo: "Patrimonio", naturaleza: "Acreedora" },
  { id: "3.1.01.001", codigo: "3.1.01.001", nombre: "Capital Social Suscrito y Pagado", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "3.1.01.002", codigo: "3.1.01.002", nombre: "Aportes de Accionistas para Futuros Aumentos", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "3.1.02.001", codigo: "3.1.02.001", nombre: "Reserva Legal (10% Código de Comercio)", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "3.1.02.002", codigo: "3.1.02.002", nombre: "Reserva Estatutaria y Facultativa", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "3.1.03.001", codigo: "3.1.03.001", nombre: "Utilidades Retenidas de Ejercicios Anteriores", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "3.1.03.002", codigo: "3.1.03.002", nombre: "Superávit por Revaluación de Activos Fijos", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "3.1.03.003", codigo: "3.1.03.003", nombre: "Resultado del Ejercicio Actual (Utilidad Neta)", nivel: 4, tipo: "Movimiento", grupo: "Patrimonio", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 4. INGRESOS
  { id: "4", codigo: "4", nombre: "INGRESOS", nivel: 1, tipo: "Grupo", grupo: "Ingresos", naturaleza: "Acreedora" },
  { id: "4.1", codigo: "4.1", nombre: "Ingresos por Ventas y Servicios", nivel: 2, tipo: "Grupo", grupo: "Ingresos", naturaleza: "Acreedora" },
  { id: "4.1.01.001", codigo: "4.1.01.001", nombre: "Ventas de Mercancías Nacionales", nivel: 4, tipo: "Movimiento", grupo: "Ingresos", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },
  { id: "4.1.01.002", codigo: "4.1.01.002", nombre: "Ganancia en Diferencial Cambiario", nivel: 4, tipo: "Movimiento", grupo: "Ingresos", naturaleza: "Acreedora", saldo: 0, saldoActual: 0 },

  // 5. GASTOS Y COSTOS
  { id: "5", codigo: "5", nombre: "GASTOS Y COSTOS", nivel: 1, tipo: "Grupo", grupo: "Gastos", naturaleza: "Deudora" },
  { id: "5.1", codigo: "5.1", nombre: "Gastos Operativos y de Administración", nivel: 2, tipo: "Grupo", grupo: "Gastos", naturaleza: "Deudora" },
  { id: "5.1.01.001", codigo: "5.1.01.001", nombre: "Sueldos, Salarios y Beneficios al Personal", nivel: 4, tipo: "Movimiento", grupo: "Gastos", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "5.1.01.002", codigo: "5.1.01.002", nombre: "Servicios Básicos (Electricidad, Agua, Internet)", nivel: 4, tipo: "Movimiento", grupo: "Gastos", naturaleza: "Deudora", saldo: 0, saldoActual: 0 },
  { id: "5.1.01.003", codigo: "5.1.01.003", nombre: "Pérdida en Diferencial Cambiario", nivel: 4, tipo: "Movimiento", grupo: "Gastos", naturaleza: "Deudora", saldo: 0, saldoActual: 0 }
];


// ============================================================================
// 11. CUENTAS CONTABLES NIIF
// ============================================================================

export async function dbFetchCuentasContables(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase.from('cuentas_contables').select('*').eq('empresa_id', empresaId).order('codigo', { ascending: true });
      if (!error && data) {
        const mapped = (data || []).map((row: any) => ({
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
        await setLocal(`erp_local_cuentas_${cid}`, mapped);
        return mapped;
      }
    } catch {}
  }
  const local = await getLocal<any[]>(`erp_local_cuentas_${cid}`, []);
  return (local || []).map(c => ({ ...c, saldo: 0, saldoActual: 0 }));
}

export async function dbResetToFullDemoCuentas(empresaId?: string): Promise<any[]> {
  const cid = empresaId || 'default';
  await setLocal(`erp_local_cuentas_${cid}`, []);
  return [];
}

export async function dbSaveCuentaContable(cuenta: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_cuentas_${cid}`, []);
  const existingIdx = list.findIndex(c => (cuenta.id && c.id === cuenta.id) || c.codigo === cuenta.codigo);
  const accountId = (cuenta.id && isUUID(cuenta.id))
    ? cuenta.id
    : (existingIdx >= 0 && isUUID(list[existingIdx].id) ? list[existingIdx].id : crypto.randomUUID());

  const formatted = {
    id: accountId,
    codigo: cuenta.codigo,
    nombre: cuenta.nombre,
    tipo: cuenta.tipo || 'Movimiento',
    naturaleza: cuenta.naturaleza || 'Deudora',
    grupo: cuenta.grupo || (cuenta.codigo.startsWith('1') ? 'Activo' : cuenta.codigo.startsWith('2') ? 'Pasivo' : cuenta.codigo.startsWith('3') ? 'Patrimonio' : cuenta.codigo.startsWith('4') ? 'Ingresos' : 'Gastos'),
    nivel: Number(cuenta.nivel) || (cuenta.codigo.split('.').length),
    cuentaPadreId: (cuenta.cuentaPadreId && isUUID(cuenta.cuentaPadreId)) ? cuenta.cuentaPadreId : null,
    saldoActual: Number(cuenta.saldoActual || cuenta.saldo) || 0,
    activo: cuenta.activo ?? true
  };
  if (existingIdx >= 0) list[existingIdx] = { ...list[existingIdx], ...formatted };
  else list.push(formatted);
  await setLocal(`erp_local_cuentas_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const payload: any = {
        id: formatted.id,
        empresa_id: empresaId,
        codigo: formatted.codigo,
        nombre: formatted.nombre,
        tipo: formatted.tipo || 'Movimiento',
        naturaleza: formatted.naturaleza || 'Deudora',
        grupo: formatted.grupo || 'Activo',
        nivel: formatted.nivel || 1,
        cuenta_padre_id: formatted.cuentaPadreId,
        saldo_actual: formatted.saldoActual,
        activo: formatted.activo
      };
      const { error: upsertErr } = await supabase.from('cuentas_contables').upsert(payload, { onConflict: 'empresa_id,codigo' });
      if (upsertErr && payload.cuenta_padre_id) {
        payload.cuenta_padre_id = null;
        await supabase.from('cuentas_contables').upsert(payload, { onConflict: 'empresa_id,codigo' });
      }
    } catch (e) {
      console.warn('Error dbSaveCuentaContable Supabase:', e);
    }
  }
  return true;
}

export async function dbDeleteCuentaContable(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_cuentas_${cid}`, []);
  await setLocal(`erp_local_cuentas_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase && isUUID(id)) {
    try {
      await supabase.from('cuentas_contables').delete().eq('id', id);
    } catch {}
  }
  return true;
}

export async function dbClearCuentasContables(empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  await setLocal(`erp_local_cuentas_${cid}`, []);

  if (isSupabaseConfigured && supabase && empresaId && isUUID(empresaId)) {
    try {
      const { error } = await supabase.from('cuentas_contables').delete().eq('empresa_id', empresaId);
      if (error) console.error('Error dbClearCuentasContables Supabase:', error);
    } catch (e) {
      console.error('Error dbClearCuentasContables:', e);
    }
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
  return await getLocal<any[]>(`erp_local_comprobantes_${cid}`, []);
}

export async function dbSaveComprobante(comp: any, empresaId: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_comprobantes_${cid}`, []);
  const totalDebe = Array.isArray(comp.lineas) && comp.lineas.length > 0 
    ? comp.lineas.reduce((acc: number, l: any) => acc + (Number(l.debe) || 0), 0) 
    : 0;
  const totalHaber = Array.isArray(comp.lineas) && comp.lineas.length > 0 
    ? comp.lineas.reduce((acc: number, l: any) => acc + (Number(l.haber) || 0), 0) 
    : 0;
  const diferencia = Math.abs(totalDebe - totalHaber);
  const estadoFinal = comp.estado 
    ? (comp.estado === 'Contabilizado' && diferencia > 0.01 && (comp.lineas?.length || 0) > 0 ? 'Descuadrado' : comp.estado)
    : (diferencia > 0.01 && (comp.lineas?.length || 0) > 0 ? 'Descuadrado' : 'Contabilizado');

  const formatted = {
    id: comp.id || `diar_${Date.now()}`,
    numero: comp.numero || `DIAR-${Date.now().toString().slice(-6)}`,
    fecha: comp.fecha || getTodayLocalDate(),
    tipo: comp.tipo || 'Diario',
    descripcion: comp.descripcion || '',
    referencia: comp.referencia || '',
    total: Number(comp.total) || totalDebe,
    estado: estadoFinal,
    createdBy: comp.createdBy || comp.created_by || 'Sistema',
    lineas: comp.lineas || []
  };
  const validVoucherId = isUUID(comp.id) ? comp.id : (isUUID(formatted.id) ? formatted.id : crypto.randomUUID());
  formatted.id = validVoucherId;

  const idx = list.findIndex(c => c.id === formatted.id || (formatted.numero && c.numero === formatted.numero));
  if (idx >= 0) list[idx] = { ...list[idx], ...formatted };
  else list.push(formatted);
  await setLocal(`erp_local_comprobantes_${cid}`, list);

  if (isSupabaseConfigured && supabase && empresaId) {
    try {
      // 1. Resolve existing row in Supabase:
      // Note: comprobantes_diario has TWO unique constraints:
      //   - primary key (id)
      //   - unique (empresa_id, numero)
      // If we attempt upsert on id when (empresa_id, numero) already exists, Postgres throws 23505 duplicate key.
      let targetVoucherId = validVoucherId;
      let existingRowId: string | null = null;

      if (isUUID(validVoucherId)) {
        const { data: byId } = await supabase.from('comprobantes_diario').select('id').eq('id', validVoucherId).maybeSingle();
        if (byId) existingRowId = byId.id;
      }
      if (!existingRowId && formatted.numero) {
        const { data: byNum } = await supabase.from('comprobantes_diario').select('id').eq('empresa_id', empresaId).eq('numero', formatted.numero).maybeSingle();
        if (byNum) existingRowId = byNum.id;
      }

      const payload: any = {
        empresa_id: empresaId,
        numero: formatted.numero,
        fecha: formatted.fecha,
        tipo: formatted.tipo || 'Diario',
        descripcion: formatted.descripcion || 'Comprobante de Diario',
        referencia: formatted.referencia || '',
        total: formatted.total,
        estado: formatted.estado || 'Contabilizado'
      };
      if (isUUID(formatted.createdBy)) {
        payload.created_by = formatted.createdBy;
      }

      if (existingRowId) {
        targetVoucherId = existingRowId;
        const { error: updErr } = await supabase.from('comprobantes_diario').update(payload).eq('id', existingRowId);
        if (updErr) console.error('Error updating comprobantes_diario Supabase:', updErr);
      } else {
        payload.id = targetVoucherId;
        const { error: insErr } = await supabase.from('comprobantes_diario').insert(payload);
        if (insErr) console.error('Error inserting comprobantes_diario Supabase:', insErr);
      }

      // 2. Guardar líneas del comprobante
      if (Array.isArray(comp.lineas) && comp.lineas.length > 0) {
        await supabase.from('lineas_comprobante').delete().eq('comprobante_id', targetVoucherId);

        let accounts: any[] = (await getLocal<any[]>(`erp_local_cuentas_${cid}`, [])) || [];
        if (!accounts || accounts.length === 0) {
          try {
            accounts = await dbFetchCuentasContables(empresaId);
          } catch {}
        }

        const linesPayload = comp.lineas.map((l: any, lineIdx: number) => {
          let accountUUID: string | null = null;
          const rawAcc = l.cuentaId || l.cuenta_id;
          if (isUUID(rawAcc)) {
            accountUUID = rawAcc;
          } else if (rawAcc && accounts && accounts.length > 0) {
            const found = accounts.find((a: any) => a.codigo === rawAcc || a.id === rawAcc);
            if (found && isUUID(found.id)) {
              accountUUID = found.id;
            }
          }

          return {
            id: isUUID(l.id) ? l.id : crypto.randomUUID(),
            comprobante_id: targetVoucherId,
            cuenta_id: accountUUID,
            descripcion: (l.descripcion && String(l.descripcion).trim()) ? String(l.descripcion).trim() : (formatted.descripcion || 'Línea de comprobante'),
            debe: Number(l.debe) || 0,
            haber: Number(l.haber) || 0,
            orden: lineIdx + 1
          };
        });
        const { error: linesError } = await supabase.from('lineas_comprobante').insert(linesPayload);
        if (linesError) console.error('Error lineas_comprobante Supabase:', linesError);
      }
    } catch (err) {
      console.error('Exception dbSaveComprobante Supabase:', err);
    }
  }
  return true;
}

export async function dbDeleteComprobante(id: string, empresaId?: string): Promise<boolean> {
  const cid = empresaId || 'default';
  const list = await getLocal<any[]>(`erp_local_comprobantes_${cid}`, []);
  await setLocal(`erp_local_comprobantes_${cid}`, list.filter(c => c.id !== id));

  if (isSupabaseConfigured && supabase) {
    try {
      if (isUUID(id)) { await supabase.from('comprobantes_diario').delete().eq('id', id); }
    } catch {}
  }
  return true;
}

