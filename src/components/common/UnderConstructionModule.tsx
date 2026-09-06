import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Construction, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  ShieldCheck,
  LucideIcon 
} from 'lucide-react';
import BackButton from './BackButton';

interface UnderConstructionProps {
  title: string;
  subtitle: string;
  category: string;
  icon: LucideIcon;
  gradient: string;
  shadow: string;
  features?: string[];
}

export default function UnderConstructionModule({
  title,
  subtitle,
  category,
  icon: Icon,
  gradient,
  shadow,
  features = []
}: UnderConstructionProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4.5rem)] w-full flex flex-col justify-start pt-2 sm:pt-3 pb-8 px-4 sm:px-8 max-w-6xl mx-auto animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-2.5 mb-4">
        <BackButton to="/" label="Volver al Inicio" />

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-black uppercase tracking-wider animate-pulse">
            <Clock size={12} />
            <span>En Construcción</span>
          </span>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
            {category}
          </span>
        </div>
      </div>

      {/* Main Content Hero */}
      <div className="flex-1 flex flex-col items-center justify-start text-center mt-2 mb-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br ${gradient} ${shadow} flex items-center justify-center mb-6 shadow-xl relative group`}
        >
          <Icon size={44} className="text-white" strokeWidth={2.2} />
          <div className="absolute -bottom-2 -right-2 bg-amber-500 text-slate-950 p-1.5 rounded-full border-2 border-white shadow-md">
            <Construction size={16} className="animate-spin" style={{ animationDuration: '6s' }} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="max-w-2xl"
        >
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mb-3">
            Módulo de {title}
          </h1>
          <p className="text-slate-500 text-sm sm:text-base font-medium leading-relaxed mb-8">
            {subtitle}. Este módulo se encuentra actualmente en fase activa de desarrollo e integración con el núcleo administrativo y contable.
          </p>
        </motion.div>

        {/* Feature roadmap preview cards */}
        {features.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="w-full max-w-3xl bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs text-left"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-indigo-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Funcionalidades en Desarrollo para este Módulo
              </h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-xs font-semibold text-slate-700">{feat}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Action Button */}
        <div className="mt-8 flex gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <span>Ir al Inicio</span>
          </Link>
        </div>
      </div>

      {/* Footer info */}
      <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 font-medium">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-indigo-500" /> Sistema Base 2026 - Módulo Registrado
        </span>
        <span className="mt-2 sm:mt-0">Próximamente disponible en actualización</span>
      </div>
    </div>
  );
}
