import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  User,
  Home,
  Contact,
  FileText,
  Calculator,
  Users,
  Building2,
  Landmark,
  BarChart3,
  FileSpreadsheet,
  Package,
  Settings,
  TrendingUp,
  ChevronDown,
  Plus,
  X,
  Upload,
  ArrowLeft,
  PhoneCall,
  Shield,
  LogOut,
  MapPin,
  Truck,
  Receipt,
  FolderArchive,
  Calendar,
  Terminal,
  Lock,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { dbSaveEmpresa, dbSaveConfiguracionContable } from "../services/db";
import { APP_VERSION } from "../config/version";
import { useIdleTimer } from "../hooks/useIdleTimer";
import { ScreenLockModal } from "./common/ScreenLockModal";
import SyncStatusBadge from "./common/SyncStatusBadge";

const NAVIGATION = [
  { name: "Inicio", path: "/", icon: Home, exact: true, id: "home" },
  { name: "Contactos", path: "/contacts", icon: Contact, id: "contactos" },
  { name: "Facturación", path: "/invoicing", icon: FileText, id: "facturacion" },
  { name: "Inventario", path: "/inventory", icon: Package, id: "inventario" },
  { name: "Compra / Servicio", path: "/purchases", icon: Truck, id: "compras" },
  {
    name: "Cuentas por Cobrar",
    path: "/receivables",
    icon: Receipt,
    id: "cuentasCobrar",
  },
  {
    name: "Cuentas por Pagar",
    path: "/payables",
    icon: Building2,
    id: "cuentasPagar",
  },
  { name: "Bancos", path: "/banks", icon: Landmark, id: "bancos" },
  {
    name: "Contabilidad",
    path: "/accounting",
    icon: FileSpreadsheet,
    id: "contabilidad",
  },
  { name: "Informes", path: "/reports", icon: BarChart3, id: "informes" },
  {
    name: "Configuración",
    path: "/settings",
    icon: Settings,
    id: "configuracion",
  },
];

export default function Layout({
  children,
  tipoEmpresa = "mixta",
  onLogout,
  empresa,
}: {
  children: React.ReactNode;
  tipoEmpresa?: string;
  onLogout?: () => void;
  empresa?: any;
}) {
  const location = useLocation();
  const {
    activeCompanyId,
    setActiveCompanyId,
    availableCompanies,
    setAvailableCompanies,
    userRole,
    userPermissions,
    workingYear,
    setWorkingYear,
    currentUser,
  } = useCompany();
  const currentYear = new Date().getFullYear();
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isCompanyPeriodModalOpen, setIsCompanyPeriodModalOpen] = useState(false);
  const [tempCompanyId, setTempCompanyId] = useState<string | null>(null);
  const [tempYear, setTempYear] = useState<string>(String(currentYear));
  const [createdYears, setCreatedYears] = useState<string[]>([]);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyTaxId, setNewCompanyTaxId] = useState("");
  const [newCompanyYear, setNewCompanyYear] = useState<string>(String(currentYear));
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  // Enterprise Inactivity Auto-Lock (15 min idle)
  const { isLocked, lock, unlock } = useIdleTimer({
    timeoutMinutes: 15,
    enabled: Boolean(currentUser)
  });

  useEffect(() => {
    const selectedComp = availableCompanies.find(c => c.id === (tempCompanyId || activeCompanyId)) || empresa;
    const startYearStr = (selectedComp as any)?.anoInicio || (selectedComp as any)?.ano_inicio || (empresa as any)?.anoInicio || '2026';
    const startYearNum = parseInt(startYearStr) || currentYear;
    
    const yearsSet = new Set<number>();
    yearsSet.add(startYearNum);
    if (workingYear) {
      const wy = parseInt(workingYear);
      if (!isNaN(wy)) yearsSet.add(wy);
    }
    if (tempYear) {
      const ty = parseInt(tempYear);
      if (!isNaN(ty)) yearsSet.add(ty);
    }

    const minYear = Math.min(...Array.from(yearsSet));
    const maxYear = Math.max(...Array.from(yearsSet));
    const yearsList: string[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      yearsList.push(String(y));
    }

    setCreatedYears(yearsList.sort((a, b) => b.localeCompare(a)));
  }, [tempCompanyId, activeCompanyId, workingYear, tempYear, empresa, availableCompanies, currentYear]);

  const openCompanyPeriodSelector = () => {
    setTempCompanyId(activeCompanyId);
    setTempYear(workingYear || String(currentYear));
    setIsCompanyPeriodModalOpen(true);
  };

  const handleConfirmCompanyAndPeriod = async () => {
    if (tempCompanyId) {
      setActiveCompanyId(tempCompanyId);
      setWorkingYear(tempYear);
      try {
        await dbSaveConfiguracionContable({ workingYear: tempYear }, tempCompanyId);
      } catch (e) {
        console.warn("No se pudo persistir el año de trabajo:", e);
      }
    }
    setIsCompanyPeriodModalOpen(false);
  };
  const navigate = useNavigate();
  const [copyPlanCuentas, setCopyPlanCuentas] = useState(false);
  const [copyContactos, setCopyContactos] = useState(false);
  const [sourceCompanyId, setSourceCompanyId] = useState("");

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    setIsCreatingCompany(true);
    try {
      const docId = crypto.randomUUID();
      const newCompany = {
        id: docId,
        name: newCompanyName.trim(),
        taxId: newCompanyTaxId.trim(),
        nombre: newCompanyName.trim(),
        rif: newCompanyTaxId.trim(),
        anoInicio: newCompanyYear,
        workingYear: newCompanyYear,
        direccion: "",
        telefono: "",
        email: "",
        monedaPrincipal: "USD",
        monedaSecundaria: "VES",
        tipoContribuyente: "ordinario",
        tipoEmpresa: "comercial"
      };
      await dbSaveEmpresa(newCompany);
      await dbSaveConfiguracionContable({ workingYear: newCompanyYear }, docId);

      if (copyPlanCuentas && sourceCompanyId) {
        const { dbFetchCuentasContables, dbSaveCuentaContable } = await import('../services/db');
        const sourceAccounts = await dbFetchCuentasContables(sourceCompanyId);
        for (const acc of sourceAccounts) {
          await dbSaveCuentaContable({
            ...acc,
            id: crypto.randomUUID(),
            saldoActual: 0
          }, docId);
        }
      }

      if (copyContactos && sourceCompanyId) {
        const { dbFetchContactos, dbSaveContacto } = await import('../services/db');
        const sourceContacts = await dbFetchContactos(sourceCompanyId);
        for (const ct of sourceContacts) {
          await dbSaveContacto({
            ...ct,
            id: crypto.randomUUID(),
            saldo: 0,
            saldoCxp: 0
          }, docId);
        }
      }

      const updated = [...availableCompanies, newCompany];
      setAvailableCompanies(updated);
      setWorkingYear(newCompanyYear);
      setActiveCompanyId(docId);

      setIsCompanyModalOpen(false);
      setIsCompanyPeriodModalOpen(false);
      setNewCompanyName("");
      setNewCompanyTaxId("");
      setNewCompanyYear(String(currentYear));
      setCopyPlanCuentas(false);
      setCopyContactos(false);
      setSourceCompanyId("");

      // Redirigir de inmediato al Perfil de Empresa en Configuración
      navigate("/settings");
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingCompany(false);
    }
  };

  const filteredNavigation = NAVIGATION.filter((nav) => {
    if (nav.id === "vendedores" && empresa?.habilitarVendedores === false) {
      return false;
    }

    if (nav.id === "pedidosRecibidos" && empresa?.habilitarPedidos === false) {
      return false;
    }

    if (userRole === "Vendedor") {
      return nav.id === "vendedores";
    }

    // El Usuario Master tiene acceso total a todos los módulos y empresas
    if (currentUser?.role === "Master" || userRole === "Master") {
      return true;
    }

    // Para los demás roles, se evalúa estrictamente los permisos que el Master le asignó
    if (nav.id !== "home") {
      const perms = userPermissions[nav.id];
      if (perms && !perms.view) {
        return false;
      }
    }

    return true;
  });

  const currentModule = filteredNavigation.find((nav) =>
    nav.exact
      ? location.pathname === nav.path
      : location.pathname.startsWith(nav.path),
  );

  const appName = currentModule ? currentModule.name : "Halley Insights";
  const activeCompany = availableCompanies.find(
    (c) => c.id === activeCompanyId,
  );

  if (
    location.pathname === '/invoicing/new' || 
    location.pathname === '/purchases/new'
  ) {
    return (
      <div className="min-h-screen w-screen overflow-x-hidden bg-slate-50 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Navigation Bar - Premium Glassmorphic */}
      <header className="h-16 z-40 flex items-center px-4 sm:px-8 justify-between sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200/80 text-slate-700 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)] transition-all">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="w-10 h-10 rounded-xl p-0.5 border border-slate-200/80 bg-white shadow-xs flex items-center justify-center overflow-hidden hover:border-indigo-300 transition-colors">
              <img 
                src={empresa?.logo || activeCompany?.logo || '/logo.png'} 
                alt="Logo" 
                className="w-full h-full object-contain" 
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            </Link>
            <div className="flex flex-col">
              <Link to="/" className="text-base sm:text-lg font-black tracking-tight text-slate-900 flex items-center leading-none hover:opacity-90">
                {activeCompany?.name || (activeCompany as any)?.nombre || (empresa?.nombre && empresa?.nombre !== 'Empresa' ? empresa?.nombre : '') || 'Halley'}<span className="text-indigo-600 ml-1 font-black">ERP</span>
              </Link>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Sistema Operativo
                </span>
                <span className="bg-indigo-50 border border-indigo-200/70 text-indigo-700 text-[9px] font-black px-1.5 py-0.2 rounded font-mono">
                  v{APP_VERSION} Pro
                </span>
              </div>
            </div>
          </div>
          {currentModule && currentModule.path !== "/" && (
            <>
              <div className="hidden sm:block w-px h-5 bg-slate-200 mx-1" />
              <div className="hidden sm:flex items-center gap-2 bg-slate-100/70 border border-slate-200/80 px-3 py-1.5 rounded-xl text-slate-800 shadow-2xs">
                <currentModule.icon size={15} className="text-indigo-600 shrink-0" strokeWidth={2.2} />
                <span className="text-xs font-bold tracking-tight">{currentModule.name}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {availableCompanies.length > 0 && (
            <button 
              onClick={openCompanyPeriodSelector}
              className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-indigo-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 px-3 py-2 rounded-xl transition-all shadow-xs group cursor-pointer active:scale-98"
              title="Cambiar empresa o período contable"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 shrink-0" />
              <Building2 size={15} className="text-slate-500 group-hover:text-indigo-600 transition-colors shrink-0" />
              <span className="hidden md:inline truncate max-w-[170px] text-slate-800 font-bold">
                {activeCompany?.name || "Seleccionar Empresa"}
              </span>
              {workingYear && (
                <span className="bg-indigo-50 border border-indigo-200/70 text-indigo-700 text-[10px] font-black px-1.5 py-0.5 rounded-md font-mono">
                  {workingYear}
                </span>
              )}
              <ChevronDown size={13} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </button>
          )}

          <SyncStatusBadge />

          <div className="flex items-center gap-2 pl-2 sm:border-l border-slate-200/80">
            <div className="flex items-center gap-2 bg-white border border-slate-200/80 pl-1.5 pr-2.5 py-1 rounded-xl shadow-2xs">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                <User size={14} strokeWidth={2.5} />
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-[11px] font-bold text-slate-800 leading-tight">
                  {currentUser?.name || currentUser?.email?.split('@')[0] || "Administrador"}
                </span>
                <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider leading-none">
                  {userRole || "Master"}
                </span>
              </div>
            </div>
 
            <button
              onClick={lock}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 p-2 sm:px-3 sm:py-2 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
              title="Bloquear pantalla de trabajo"
            >
              <Lock size={14} />
              <span className="hidden sm:inline">Bloquear</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 p-2 sm:px-3 sm:py-2 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                title="Cerrar sesión"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">Salir</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 relative ${location.pathname === "/" ? "overflow-hidden bg-slate-50" : "overflow-auto bg-slate-50"}`}>
        <div className="h-full">
          {!currentModule && location.pathname !== "/" ? (
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-6">
              <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl shadow-slate-200/50 text-center border border-slate-200/80 max-w-md w-full animate-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <X size={32} />
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2">
                  Acceso Restringido
                </h2>
                <p className="text-slate-500 mb-6 text-xs sm:text-sm font-medium leading-relaxed">
                  No tienes permisos configurados para acceder a este módulo o la ruta solicitada no se encuentra disponible.
                </p>
                <Link
                  to="/"
                  className="btn-primary w-full"
                >
                  <ArrowLeft size={16} />
                  <span>Regresar al Inicio</span>
                </Link>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {/* Modal de Gestión y Creación de Empresas */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 border border-slate-200/80">
            <button
              onClick={() => setIsCompanyModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200/80 rounded-full p-1.5 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
            <div className="p-6 sm:p-7">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                  <Building2 size={20} strokeWidth={2.2} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">
                    Gestión de Empresas
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Crea un nuevo entorno de trabajo
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateCompany} className="mt-5 space-y-4">
                <div>
                  <label className="form-label-modern">
                    Nombre de la Empresa
                  </label>
                  <input
                    type="text"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    required
                    maxLength={50}
                    className="input-modern"
                    placeholder="Ej. Inversiones Beta C.A."
                  />
                </div>
                <div>
                  <label className="form-label-modern">
                    Identificación / NIT / RIF
                  </label>
                  <input
                    type="text"
                    value={newCompanyTaxId}
                    onChange={(e) => setNewCompanyTaxId(e.target.value)}
                    required
                    maxLength={20}
                    className="input-modern"
                    placeholder="Ej. J-12345678-9"
                  />
                </div>

                <div>
                  <label className="form-label-modern flex items-center gap-1.5">
                    <Calendar size={13} className="text-indigo-600" />
                    Año / Ejercicio Fiscal de Inicio
                  </label>
                  <select
                    value={newCompanyYear}
                    onChange={(e) => setNewCompanyYear(e.target.value)}
                    className="input-modern font-bold cursor-pointer"
                  >
                    {Array.from({ length: 6 }, (_, i) => String(currentYear - 3 + i)).map((y) => (
                      <option key={y} value={y}>
                        Año {y} {y === String(currentYear) ? '(Actual)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {availableCompanies.length > 0 && (
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-3">
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      Duplicar Configuración (Opcional)
                    </p>
                    
                    <label className="flex items-start gap-2.5 cursor-pointer group">
                      <input 
                        type="checkbox"
                        checked={copyPlanCuentas}
                        onChange={(e) => {
                          setCopyPlanCuentas(e.target.checked);
                          if (e.target.checked && !sourceCompanyId && availableCompanies.length > 0) {
                            setSourceCompanyId(availableCompanies[0].id);
                          }
                        }}
                        className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                      />
                      <span className="text-slate-700 text-xs font-semibold select-none group-hover:text-slate-900 transition-colors">
                        Copiar Plan de Cuentas existente
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer group">
                      <input 
                        type="checkbox"
                        checked={copyContactos}
                        onChange={(e) => {
                          setCopyContactos(e.target.checked);
                          if (e.target.checked && !sourceCompanyId && availableCompanies.length > 0) {
                            setSourceCompanyId(availableCompanies[0].id);
                          }
                        }}
                        className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                      />
                      <span className="text-slate-700 text-xs font-semibold select-none group-hover:text-slate-900 transition-colors">
                        Copiar Directorio de Contactos
                      </span>
                    </label>

                    {(copyPlanCuentas || copyContactos) && (
                      <div className="pt-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <label className="form-label-modern">
                          Seleccione la Empresa de Origen
                        </label>
                        <select
                          value={sourceCompanyId}
                          onChange={(e) => setSourceCompanyId(e.target.value)}
                          required={copyPlanCuentas || copyContactos}
                          className="input-modern text-xs"
                        >
                          {availableCompanies.map(comp => (
                            <option key={comp.id} value={comp.id}>
                              {comp.name} ({comp.taxId})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCompanyId(null);
                      setIsCompanyModalOpen(false);
                    }}
                    className="btn-secondary flex-1"
                  >
                    Ver Todas
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingCompany}
                    className="btn-primary flex-1"
                  >
                    {isCreatingCompany ? "Creando..." : "Crear Empresa"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Selector de Empresa y Período Contable Modal */}
      {isCompanyPeriodModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200/80">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Building2 size={16} strokeWidth={2.2} />
                </div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">Seleccionar Empresa y Período</h2>
              </div>
              <button
                onClick={() => setIsCompanyPeriodModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 transition-colors rounded-lg p-1.5 border border-slate-200 cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="form-label-modern mb-0">
                    Empresa de Trabajo
                  </label>
                  {currentUser?.role === 'Master' && (
                    <button 
                      onClick={() => {
                        setIsCompanyPeriodModalOpen(false);
                        setIsCompanyModalOpen(true);
                      }}
                      className="text-xs text-indigo-600 font-bold hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} /> Nueva Empresa
                    </button>
                  )}
                </div>
                <select
                  value={tempCompanyId || ""}
                  onChange={(e) => setTempCompanyId(e.target.value || null)}
                  className="input-modern font-semibold"
                >
                  <option value="">Seleccione una empresa...</option>
                  {availableCompanies.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name} {comp.taxId ? `(${comp.taxId})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {tempCompanyId && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="form-label-modern mb-0">
                      Año de Trabajo / Período Contable Actual
                    </label>
                  </div>
                  <select
                    value={tempYear}
                    onChange={(e) => setTempYear(e.target.value)}
                    className="input-modern font-mono font-bold"
                  >
                    {createdYears.map((year) => (
                      <option key={year} value={year}>
                        Ejercicio Contable - Año {year}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1.5 pl-1 leading-relaxed">
                    * Los ejercicios fiscales corresponden a los períodos contables activos de la empresa.
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCompanyPeriodModalOpen(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmCompanyAndPeriod}
                  disabled={!tempCompanyId}
                  className="btn-primary flex-1"
                >
                  Confirmar y Cargar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ScreenLockModal
        isOpen={isLocked}
        onUnlock={unlock}
        onLogout={onLogout || (() => {})}
      />
    </div>
  );
}
