import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Truck, 
  Briefcase,
  ShoppingBag,
  ArrowRight
} from 'lucide-react';
import BackButton from '../components/common/BackButton';

const purchaseModules = [
  { 
    name: 'Compras de Mercancía', 
    badge: 'Mercancía & Inventario',
    description: 'Recepción de mercancía a almacén, facturas de proveedores, actualización de stock y costos', 
    icon: Truck, 
    gradient: 'from-blue-600 to-indigo-700', 
    shadow: 'shadow-blue-500/20', 
    borderHover: 'hover:border-blue-300',
    textHover: 'group-hover:text-blue-600',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    path: '/purchases/compras' 
  },
  { 
    name: 'Gastos y Servicios', 
    badge: 'Gastos Operativos',
    description: 'Servicios comerciales, honorarios profesionales, víveres, papelería y gastos generales', 
    icon: Briefcase, 
    gradient: 'from-purple-600 to-indigo-700', 
    shadow: 'shadow-purple-500/20', 
    borderHover: 'hover:border-purple-300',
    textHover: 'group-hover:text-purple-600',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    path: '/purchases/servicios' 
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
  hidden: { opacity: 0, y: 15, scale: 0.95 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1, 
    transition: { type: "spring", stiffness: 350, damping: 25 } 
  }
};

export default function PurchasesMenu() {
  return (
    <div className="min-h-[calc(100vh-4rem)] relative overflow-hidden flex flex-col items-center justify-start pt-2 sm:pt-4 pb-8 px-4 sm:px-8 bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Top Bar Navigation */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10 shrink-0 mb-2">
        <BackButton to="/" label="Volver al Inicio" />
        <span className="badge-modern-neutral">
          Gestión de Compras & Gastos
        </span>
      </div>

      {/* Hero Header */}
      <div className="z-10 text-center flex flex-col items-center shrink-0 mt-2 mb-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md shadow-blue-500/20 flex items-center justify-center mb-2 group hover:scale-105 transition-transform"
        >
          <ShoppingBag size={24} className="text-white" strokeWidth={2} />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight"
        >
          Módulo de Compras
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="text-slate-500 text-xs sm:text-sm font-medium mt-1 max-w-lg"
        >
          Selecciona una categoría para registrar, consultar facturas o gestionar egresos y stock
        </motion.p>
      </div>

      {/* Modules Grid */}
      <motion.div 
        variants={container as any}
        initial="hidden"
        animate="show"
        className="z-10 max-w-3xl w-full px-2 sm:px-4 grid grid-cols-1 sm:grid-cols-2 gap-4 justify-items-center mt-2 mb-6"
      >
        {purchaseModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <motion.div key={mod.name} variants={item as any} className="w-full">
              <Link 
                to={mod.path} 
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className={`group flex flex-col items-start p-5 sm:p-6 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/90 ${mod.borderHover} shadow-xs hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full select-none relative overflow-hidden`}
              >
                <div className="w-full flex items-center justify-between mb-4">
                  <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${mod.gradient} shadow-md ${mod.shadow} group-hover:scale-105 transition-all duration-200 ease-out`}>
                    <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 mix-blend-overlay" />
                    <Icon size={26} strokeWidth={2} className="text-white relative z-10 drop-shadow-xs" />
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${mod.badgeColor}`}>
                    {mod.badge}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 w-full">
                  <span className={`text-base sm:text-lg font-black text-slate-900 ${mod.textHover} transition-colors leading-tight`}>
                    {mod.name}
                  </span>
                  <ArrowRight size={16} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all ml-auto" />
                </div>

                <p className="mt-2 text-xs text-slate-500 font-medium leading-relaxed">
                  {mod.description}
                </p>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Footer Info */}
      <div className="mt-auto z-10 shrink-0 pt-6 pb-2 text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-indigo-500" />
        <span>Halley Insights ERP • Módulo de Compras & Gastos</span>
      </div>
    </div>
  );
}
