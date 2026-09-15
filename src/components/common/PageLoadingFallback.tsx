import React from 'react';
import { Loader2 } from 'lucide-react';
import { APP_NAME } from '../../config/version';

export const PageLoadingFallback: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 animate-in fade-in duration-200">
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 animate-pulse" />
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin absolute" />
      </div>
      <p className="text-xs font-bold text-slate-700 tracking-wide">
        Cargando módulo...
      </p>
      <p className="text-[10px] text-slate-400 font-mono mt-1">
        {APP_NAME} • Optimización bajo demanda
      </p>
    </div>
  );
};

export default PageLoadingFallback;
