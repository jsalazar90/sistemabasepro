import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Users, 
  Building2, 
  UserCheck, 
  ArrowLeft,
  PhoneCall,
  Users2,
  FileText,
  Percent,
  Globe,
  Contact2
} from 'lucide-react';
import BackButton from '../components/common/BackButton';

const receivableModules = [
  { 
    name: 'Clientes', 
    description: 'Gestión de cobros, facturación y cartera de clientes comerciales', 
    icon: Users, 
    gradient: 'from-blue-600 to-indigo-700', 
    shadow: 'shadow-blue-500/20', 
    path: '/receivables/clientes' 
  },
  { 
    name: 'Intercompañías', 
    description: 'Cuentas por cobrar a empresas relacionadas y filiales', 
    icon: Building2, 
    gradient: 'from-amber-500 to-orange-500', 
    shadow: 'shadow-amber-500/20', 
    path: '/receivables/intercompanias' 
  },
  { 
    name: 'Accionistas', 
    description: 'Cuentas por cobrar a socios y directivos', 
    icon: UserCheck, 
    gradient: 'from-emerald-500 to-teal-600', 
    shadow: 'shadow-emerald-500/20', 
    path: '/receivables/accionistas' 
  },
  { 
    name: 'Empleados', 
    description: 'Cuentas por cobrar, préstamos y anticipos a empleados', 
    icon: Contact2, 
    gradient: 'from-purple-500 to-fuchsia-600', 
    shadow: 'shadow-purple-500/20', 
    path: '/receivables/empleados' 
  },
  { 
    name: 'Módulo Cobranza', 
    description: 'Procesamiento de pagos y conciliación de cobros', 
    icon: PhoneCall, 
    gradient: 'from-slate-700 to-slate-900', 
    shadow: 'shadow-slate-600/20', 
    path: '/receivables/cobranza' 
  },
  { 
    name: 'Historial Cobranzas', 
    description: 'Ver, anular o auditar cobranzas realizadas', 
    icon: FileText, 
    gradient: 'from-slate-500 to-slate-700', 
    shadow: 'shadow-slate-500/20', 
    path: '/receivables/historial-cobranzas' 
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 }
  }
};

const item = {
  hidden: { opacity: 0, y: 15, scale: 0.95 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1, 
    transition: { type: "spring", stiffness: 350, damping: 25 } 
  }
};

export default function ReceivablesMenu() {
  return (
    <div className="min-h-[calc(100vh-4rem)] relative overflow-hidden flex flex-col items-center justify-start pt-2 sm:pt-3 pb-6 px-4 sm:px-8 bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Ambient Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Top Bar Navigation */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10 shrink-0 mb-1">
        <BackButton to="/" label="Volver al Inicio" />
        <span className="badge-modern-neutral">
          Ventas & Cobranzas
        </span>
      </div>

      {/* Hero Header */}
      <div className="z-10 text-center flex flex-col items-center shrink-0 mt-1 mb-2.5">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-500/20 flex items-center justify-center mb-1.5 group hover:scale-105 transition-transform"
        >
          <Users2 size={22} className="text-white" strokeWidth={2} />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight"
        >
          Cuentas por Cobrar
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5 max-w-lg"
        >
          Control de saldos pendientes, facturas y procesamiento de cobranzas
        </motion.p>
      </div>

      {/* Modules Grid */}
      <motion.div 
        variants={container as any}
        initial="hidden"
        animate="show"
        className="z-10 max-w-4xl w-full px-2 sm:px-6 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 justify-items-center mt-1.5 mb-3"
      >
        {receivableModules.map((app) => {
          const Icon = app.icon;
          return (
            <motion.div key={app.name} variants={item as any} className="w-full">
              <Link 
                to={app.path} 
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className="group flex flex-col items-center p-3.5 sm:p-4 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-blue-300 shadow-xs hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full select-none"
              >
                <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${app.gradient} shadow-md ${app.shadow} group-hover:scale-108 transition-all duration-200 ease-out`}>
                  <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 mix-blend-overlay" />
                  <Icon size={24} strokeWidth={2} className="text-white relative z-10 drop-shadow-xs" />
                </div>
                <span className="mt-2.5 text-xs sm:text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors text-center leading-tight">
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
      <div className="mt-auto z-10 shrink-0 pt-4 pb-2 text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        <span>Halley Insights ERP • Gestión de Cuentas por Cobrar</span>
      </div>
    </div>
  );
}
