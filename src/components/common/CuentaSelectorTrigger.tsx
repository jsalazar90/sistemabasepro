import React from 'react';
import { ChevronDown, BookOpen } from 'lucide-react';

interface CuentaSelectorTriggerProps {
  label?: string;
  value?: string;
  cuentasContables: any[];
  onClick: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function CuentaSelectorTrigger({
  label,
  value,
  cuentasContables = [],
  onClick,
  placeholder = "Seleccionar cuenta contable...",
  className = "",
  disabled = false
}: CuentaSelectorTriggerProps) {
  const selectedCuenta = cuentasContables.find(
    c => String(c.id) === String(value) || String(c.codigo) === String(value)
  );

  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label className="text-xs font-medium text-slate-700 block">{label}</label>}
      <div 
        onClick={!disabled ? onClick : undefined}
        className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm transition-all flex justify-between items-center group ${
          disabled 
            ? 'opacity-60 cursor-not-allowed bg-slate-100' 
            : 'hover:bg-white hover:border-indigo-400 cursor-pointer'
        }`}
      >
        {selectedCuenta ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 shrink-0">
              {selectedCuenta.codigo}
            </span>
            <span className="font-bold text-xs text-slate-800 truncate">
              {selectedCuenta.nombre}
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <BookOpen size={13} className="text-slate-400" />
            {placeholder}
          </span>
        )}
        <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 shrink-0 ml-2" />
      </div>
    </div>
  );
}
