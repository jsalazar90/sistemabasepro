import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Truck, 
  Building2, 
  UserCheck, 
  ArrowLeft,
  PhoneCall,
  Building,
  FileText,
  Plane,
  Percent
} from 'lucide-react';
import BackButton from '../components/common/BackButton';

const payableModules = [
  { 
    name: 'Aerolíneas', 
    description: 'Cuentas por pagar a líneas aéreas y liquidación de boletos', 
    icon: Plane, 
    gradient: 'from-sky-500 to-blue-600', 
    shadow: 'shadow-sky-500/20', 
    path: '/payables/aerolineas' 
  },
  { 
    name: 'Proveedores', 
    description: 'Gestión de facturas de compra, GDS y servicios comerciales', 
    icon: Truck, 
    gradient: 'from-rose-500 to-orange-500', 
    shadow: 'shadow-rose-500/20', 
    path: '/payables/proveedores' 
  },
  { 
    name: 'Freelance (Comisiones)', 
    description: 'Comisiones por pagar a emisores y asesores independientes', 
    icon: Percent, 
    gradient: 'from-cyan-500 to-teal-600', 
    shadow: 'shadow-cyan-500/20', 
    path: '/payables/freelance' 
  },
  { 
    name: 'Intercompañías', 
    description: 'Cuentas por pagar a empresas filiales y relacionadas', 
    icon: Building2, 
    gradient: 'from-amber-500 to-orange-500', 
    shadow: 'shadow-amber-500/20', 
    path: '/payables/intercompanias' 
  },
  { 
    name: 'Accionistas', 
    description: 'Cuentas por pagar a socios y directivos', 
    icon: UserCheck, 
    gradient: 'from-emerald-500 to-teal-600', 
    shadow: 'shadow-emerald-500/20', 
    path: '/payables/accionistas' 
  },
  { 
    name: 'Módulo Pago', 
    description: 'Procesamiento de egresos y emisión de pagos', 
    icon: PhoneCall, 
    gradient: 'from-slate-700 to-slate-900', 
    shadow: 'shadow-slate-600/20', 
    path: '/payables/pago' 
  },
  { 
    name: 'Historial Pagos', 
    description: 'Ver, anular o auditar pagos y egresos realizados', 
    icon: FileText, 
    gradient: 'from-cyan-500 to-blue-600', 
    shadow: 'shadow-cyan-500/20', 
    path: '/payables/historial-pagos' 
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

export default function PayablesMenu() {
  return (
    <div className="min-h-[calc(100vh-4rem)] relative overflow-hidden flex flex-col items-center justify-start pt-2 sm:pt-3 pb-6 px-4 sm:px-8 bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Ambient Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Top Bar Navigation */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10 shrink-0 mb-1">
        <BackButton to="/" label="Volver al Inicio" />
        <span className="badge-modern-neutral">
          Compras & Egresos
        </span>
      </div>

      {/* Hero Header */}
      <div className="z-10 text-center flex flex-col items-center shrink-0 mt-1 mb-2.5">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 shadow-md shadow-rose-500/20 flex items-center justify-center mb-1.5 group hover:scale-105 transition-transform"
        >
          <Building size={22} className="text-white" strokeWidth={2} />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight"
        >
          Cuentas por Pagar
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5 max-w-lg"
        >
          Control de compromisos, compras y procesamiento de egresos
        </motion.p>
      </div>

      {/* Modules Grid */}
      <motion.div 
        variants={container as any}
        initial="hidden"
        animate="show"
        className="z-10 max-w-4xl w-full px-2 sm:px-6 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 justify-items-center mt-1.5 mb-3"
      >
        {payableModules.map((app) => {
          const Icon = app.icon;
          return (
            <motion.div key={app.name} variants={item as any} className="w-full">
              <Link 
                to={app.path} 
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className="group flex flex-col items-center p-3.5 sm:p-4 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-rose-300 shadow-xs hover:shadow-xl hover:shadow-rose-500/5 hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full select-none"
              >
                <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${app.gradient} shadow-md ${app.shadow} group-hover:scale-108 transition-all duration-200 ease-out`}>
                  <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 mix-blend-overlay" />
                  <Icon size={24} strokeWidth={2} className="text-white relative z-10 drop-shadow-xs" />
                </div>
                <span className="mt-2.5 text-xs sm:text-sm font-bold text-slate-800 group-hover:text-rose-600 transition-colors text-center leading-tight">
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
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        <span>Halley Insights ERP • Gestión de Cuentas por Pagar</span>
      </div>
    </div>
  );
}
