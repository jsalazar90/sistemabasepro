import React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { useCompany } from "../context/CompanyContext";
import {
  Users,
  Building2,
  Landmark,
  FileSpreadsheet,
  Settings,
  BarChart3,
  Contact,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Receipt,
  FileText,
  Package,
  Truck,
} from "lucide-react";

const apps = [
  {
    id: "contactos",
    name: "Contacto",
    description: "Clientes, proveedores, empleados y cuentas corporativas",
    icon: Contact,
    gradient: "from-teal-500 to-emerald-600",
    shadow: "shadow-teal-500/20",
    border: "border-teal-200/50",
    path: "/contacts",
  },
  {
    id: "facturacion",
    name: "Facturación de Ventas",
    description: "Emisión de facturas fiscales, notas de entrega y cobranza",
    icon: FileText,
    gradient: "from-blue-600 to-indigo-700",
    shadow: "shadow-blue-500/20",
    border: "border-blue-200/50",
    path: "/invoicing",
  },
  {
    id: "inventario",
    name: "Inventario de Mercancía",
    description: "Catálogo de productos, existencias, alertas de stock y kardex",
    icon: Package,
    gradient: "from-amber-500 to-orange-600",
    shadow: "shadow-amber-500/20",
    border: "border-amber-200/50",
    path: "/inventory",
  },
  {
    id: "compras",
    name: "Compra",
    description: "Ingreso de facturas de compra, recepción de mercancía y CxP",
    icon: Truck,
    gradient: "from-blue-600 to-cyan-700",
    shadow: "shadow-blue-500/20",
    border: "border-blue-200/50",
    path: "/purchases",
  },
  {
    id: "cuentasCobrar",
    name: "Cuentas por Cobrar",
    description: "Facturación, cobros e historial de cuentas por cobrar",
    icon: Receipt,
    gradient: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-500/20",
    border: "border-emerald-200/50",
    path: "/receivables",
  },
  {
    id: "cuentasPagar",
    name: "Cuentas por Pagar",
    description: "Facturas de compras y pagos",
    icon: Building2,
    gradient: "from-rose-500 to-amber-600",
    shadow: "shadow-rose-500/20",
    border: "border-rose-200/50",
    path: "/payables",
  },
  {
    id: "bancos",
    name: "Banco",
    description: "Cuentas bancarias, caja, traspasos y conciliación",
    icon: Landmark,
    gradient: "from-sky-500 to-blue-600",
    shadow: "shadow-sky-500/20",
    border: "border-sky-200/50",
    path: "/banks",
  },
  {
    id: "contabilidad",
    name: "Contabilidad",
    description: "Plan de cuentas, diario y cierre",
    icon: FileSpreadsheet,
    gradient: "from-violet-600 to-indigo-600",
    shadow: "shadow-violet-500/20",
    border: "border-violet-200/50",
    path: "/accounting",
  },
  {
    id: "informes",
    name: "Informes & Balances",
    description: "Estados financieros y balances",
    icon: BarChart3,
    gradient: "from-amber-500 to-orange-600",
    shadow: "shadow-amber-500/20",
    border: "border-amber-200/50",
    path: "/reports",
  },
  {
    id: "configuracion",
    name: "Configuración",
    description: "Empresa, roles y parámetros",
    icon: Settings,
    gradient: "from-slate-600 to-slate-800",
    shadow: "shadow-slate-500/20",
    border: "border-slate-300/50",
    path: "/settings",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 350, damping: 25 },
  },
};

export default function Home() {
  const { userRole, userPermissions, activeCompanyId, availableCompanies, workingYear } = useCompany();
  const activeCompany = (availableCompanies || []).find((c: any) => c.id === activeCompanyId);

  const filteredApps = apps.filter((app) => {
    if (userRole !== "Master" && userRole !== "Admin" && userRole !== "SuperAdmin") {
      const perms = userPermissions[app.id];
      if (perms) {
        if (!perms.view) return false;
      }
    }
    return true;
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex flex-col justify-start items-center pt-2 sm:pt-3 pb-4 px-4 sm:px-8 relative select-none bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Background Ambient Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header Section */}
      <div className="z-10 text-center flex flex-col items-center shrink-0 max-w-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-center mb-2 p-1.5 group hover:scale-105 transition-transform"
        >
          <img 
            src={activeCompany?.logo || '/logo.png'} 
            alt="Logo" 
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
            className="w-full h-full object-contain pointer-events-none select-none"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="flex flex-col items-center gap-0.5"
        >
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200/70 shadow-2xs">
            <Sparkles size={12} className="text-indigo-600" />
            <span>Entorno Operativo Activo</span>
            {workingYear && <span className="font-mono ml-1">• {workingYear}</span>}
          </div>
          
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 mt-1">
            {activeCompany?.name || 'Halley Insights ERP'}
          </h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5"
        >
          Selecciona un módulo para gestionar operaciones financieras y contables
        </motion.p>
      </div>

      {/* Apps Launcher Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="z-10 max-w-6xl w-full px-2 sm:px-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-3 sm:gap-4 justify-items-center mt-3 sm:mt-4 mb-3"
      >
        {filteredApps.map((app: any) => {
          const Icon = app.icon;
          return (
            <motion.div key={app.name} variants={itemVariants} className="w-full">
              <Link
                to={app.path}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className="group relative flex flex-col items-center p-3.5 sm:p-4 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-indigo-300 shadow-xs hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full select-none"
              >
                {app.inConstruction && (
                  <span className="absolute top-2.5 right-2.5 px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/70 rounded-full text-[9px] font-black uppercase tracking-wider">
                    Construcción
                  </span>
                )}

                <div
                  className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${app.gradient} shadow-md ${app.shadow} group-hover:scale-108 transition-all duration-200 ease-out`}
                >
                  <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 mix-blend-overlay" />
                  <Icon
                    size={24}
                    strokeWidth={2}
                    className="text-white relative z-10 drop-shadow-xs"
                  />
                </div>
                
                <span className="mt-2.5 text-xs sm:text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors text-center leading-tight">
                  {app.name}
                </span>

                <span className="mt-1 text-[11px] text-slate-400 font-medium text-center line-clamp-2 leading-relaxed">
                  {app.description}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Footer Info */}
      <div className="mt-auto z-10 shrink-0 pt-4 pb-2 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Halley Insights ERP • Sistema de Gestión Multi-empresa</span>
      </div>
    </div>
  );
}
