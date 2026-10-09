import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Package, 
  ShieldCheck, 
  History, 
  Printer, 
  ArrowRight,
  Boxes
} from 'lucide-react';
import BackButton from '../components/common/BackButton';

const inventoryModules = [
  { 
    name: 'Catálogo', 
    badge: 'Catálogo, Categorías & Depósitos',
    description: 'Maestro de productos, clasificación por categorías y administración de depósitos / almacenes', 
    icon: Boxes, 
    gradient: 'from-blue-600 to-indigo-700', 
    shadow: 'shadow-blue-500/20', 
    borderHover: 'hover:border-blue-300',
    textHover: 'group-hover:text-blue-600',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    path: '/inventory/catalogo' 
  },
  { 
    name: 'Auditoría Física', 
    badge: 'Toma Física & Descuadres',
    description: 'Conteo ciego de existencias, detección de variaciones y ajustes contables con clave', 
    icon: ShieldCheck, 
    gradient: 'from-purple-600 to-indigo-700', 
    shadow: 'shadow-purple-500/20', 
    borderHover: 'hover:border-purple-300',
    textHover: 'group-hover:text-purple-600',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    path: '/inventory/auditoria' 
  },
  { 
    name: 'Kardex', 
    badge: 'Trazabilidad & Movimientos',
    description: 'Historial inmutable de movimientos, entradas, salidas, traslados y valorizaciones por SKU', 
    icon: History, 
    gradient: 'from-amber-500 to-orange-600', 
    shadow: 'shadow-amber-500/20', 
    borderHover: 'hover:border-amber-300',
    textHover: 'group-hover:text-amber-600',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    path: '/inventory/kardex' 
  },
  { 
    name: 'Lista de Precios', 
    badge: 'Márgenes & Emisión',
    description: 'Catálogo de precios de venta (PVP, Mayor, VIP), cálculo de márgenes y exportación lista para imprimir', 
    icon: Printer, 
    gradient: 'from-emerald-500 to-teal-600', 
    shadow: 'shadow-emerald-500/20', 
    borderHover: 'hover:border-emerald-300',
    textHover: 'group-hover:text-emerald-600',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    path: '/inventory/precios' 
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

export default function InventoryMenu() {
  return (
    <div className="min-h-[calc(100vh-4rem)] relative overflow-hidden flex flex-col items-center justify-start pt-2 sm:pt-4 pb-8 px-4 sm:px-8 bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Top Bar Navigation */}
      <div className="w-full max-w-5xl flex items-center justify-between z-10 shrink-0 mb-2">
        <BackButton to="/" label="Volver al Inicio" />
        <span className="badge-modern-neutral">
          Gestión de Inventario & Existencias
        </span>
      </div>

      {/* Hero Header */}
      <div className="z-10 text-center flex flex-col items-center shrink-0 mt-2 mb-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 shadow-md shadow-indigo-500/20 flex items-center justify-center mb-2 group hover:scale-105 transition-transform"
        >
          <Package size={24} className="text-white" strokeWidth={2} />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight"
        >
          Módulo de Inventario
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="text-slate-500 text-xs sm:text-sm font-medium mt-1 max-w-lg"
        >
          Control de existencias, catálogo maestro, auditoría física, kardex y listas de precios
        </motion.p>
      </div>

      {/* Modules Grid (4 Iconos Tamaño Pequeño / Mediano) */}
      <motion.div 
        variants={container as any}
        initial="hidden"
        animate="show"
        className="z-10 max-w-5xl w-full px-2 sm:px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 justify-items-center mt-2 mb-6"
      >
        {inventoryModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <motion.div key={mod.name} variants={item as any} className="w-full">
              <Link 
                to={mod.path} 
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className={`group flex flex-col items-start p-4 sm:p-5 rounded-2xl bg-white hover:bg-slate-50/80 border border-slate-200/90 ${mod.borderHover} shadow-xs hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1 transition-all duration-200 cursor-pointer h-full select-none relative overflow-hidden`}
              >
                <div className="w-full flex items-center justify-between mb-3">
                  <div className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${mod.gradient} shadow-md ${mod.shadow} group-hover:scale-105 transition-all duration-200 ease-out`}>
                    <div className="absolute inset-0 bg-white/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 mix-blend-overlay" />
                    <Icon size={22} strokeWidth={2} className="text-white relative z-10 drop-shadow-xs" />
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${mod.badgeColor}`}>
                    {mod.name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 w-full">
                  <span className={`text-base font-black text-slate-900 ${mod.textHover} transition-colors leading-tight`}>
                    {mod.name}
                  </span>
                  <ArrowRight size={15} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all ml-auto" />
                </div>

                <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                  {mod.badge}
                </span>

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
        <span>Halley Insights ERP • Sistema de Inventario Multimoneda</span>
      </div>
    </div>
  );
}
