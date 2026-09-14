import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Landmark, CreditCard
} from 'lucide-react';
import BackButton from '../components/common/BackButton';

const bankModules = [
  { 
    name: 'Cuentas Bancarias', 
    description: 'Gestión de cuentas corrientes, de ahorro, saldos y movimientos bancarios', 
    icon: Landmark, 
    gradient: 'from-sky-500 to-blue-700', 
    shadow: 'shadow-sky-500/20', 
    path: '/banks/cuentas',
    tag: 'Bancos'
  },
  { 
    name: 'Puntos de Venta (POS) & Lotes', 
    description: 'Control de lotes diarios de puntos de venta, cierre con ticket y conciliación bancaria', 
    icon: CreditCard, 
    gradient: 'from-amber-500 to-orange-600', 
    shadow: 'shadow-amber-500/20', 
    path: '/banks/pos-lotes',
    tag: 'POS & Tarjetas'
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const item = {
  hidden: { opacity: 0, y: 15 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 350, damping: 25 } 
  }
};

export default function BanksMenu() {
  return (
    <div className="min-h-[calc(100vh-4rem)] relative overflow-hidden flex flex-col items-center justify-start pt-2 sm:pt-3 pb-6 px-4 sm:px-8 bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Top Bar Navigation */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10 shrink-0 mb-1">
        <BackButton to="/" label="Volver al Inicio" />
        <span className="badge-modern-neutral">
          Módulo Tesorería & Bancos
        </span>
      </div>

      {/* Hero Header */}
      <div className="z-10 text-center flex flex-col items-center shrink-0 mt-1 mb-2.5">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-md shadow-sky-500/20 flex items-center justify-center mb-1.5 group hover:scale-105 transition-transform"
        >
          <Landmark size={22} className="text-white" strokeWidth={2} />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight"
        >
          Bancos & Tesorería
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5 max-w-lg"
        >
          Acceso a la gestión de cuentas bancarias, saldos y movimientos
        </motion.p>
      </div>

      {/* Modules Grid */}
      <motion.div 
        variants={container as any}
        initial="hidden"
        animate="show"
        className="z-10 max-w-3xl w-full px-2 sm:px-6 grid grid-cols-1 sm:grid-cols-2 gap-4 justify-items-center mt-1.5 mb-3"
      >
        {bankModules.map((app) => {
          const Icon = app.icon;
          return (
            <motion.div key={app.name} variants={item as any} className="w-full">
              <Link 
                to={app.path} 
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className="group flex flex-col p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/80 hover:border-sky-300 shadow-xs hover:shadow-xl hover:shadow-sky-500/5 hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full justify-between select-none"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${app.gradient} shadow-md ${app.shadow} group-hover:scale-108 transition-all duration-200 ease-out shrink-0`}>
                    <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 mix-blend-overlay" />
                    <Icon size={26} strokeWidth={2} className="text-white relative z-10 drop-shadow-xs" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-sky-50 group-hover:text-sky-700 transition-colors border border-slate-200/60">
                    {app.tag}
                  </span>
                </div>
                
                <div className="mt-3">
                  <span className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors block leading-tight">
                    {app.name}
                  </span>
                  <span className="mt-1 text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed block">
                    {app.description}
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Footer Info */}
      <div className="mt-auto z-10 shrink-0 pt-4 pb-2 text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-sky-500" />
        <span>Halley Insights ERP • Flujo de Caja & Tesorería</span>
      </div>
    </div>
  );
}
