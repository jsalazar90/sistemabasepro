import React, { useState, useMemo } from 'react';
import { BookOpen, Search, X, Check } from 'lucide-react';

export interface CuentaContableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (cuenta: any) => void;
  cuentasContables: any[];
  title?: string;
  subtitle?: string;
  selectedCuentaId?: string;
  defaultGroup?: string;
  tipoFilter?: 'Movimiento' | 'all';
}

export default function CuentaContableModal({
  isOpen,
  onClose,
  onSelect,
  cuentasContables = [],
  title = "Catálogo de Cuentas NIIF",
  subtitle = "Seleccione la cuenta contable para este enlace automático",
  selectedCuentaId = "",
  defaultGroup = "todos",
  tipoFilter = "Movimiento"
}: CuentaContableModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState(defaultGroup);

  const filteredCuentas = useMemo(() => {
    return (cuentasContables || []).filter(c => {
      const matchSearch = 
        !searchTerm || 
        (c.codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        (c.nombre || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchGroup = true;
      if (filterGroup !== 'todos') {
        if (filterGroup === '5') {
          matchGroup = (c.codigo || '').startsWith('5') || (c.codigo || '').startsWith('6');
        } else {
          matchGroup = (c.codigo || '').startsWith(filterGroup);
        }
      }

      const matchTipo = tipoFilter === 'all' ? true : (c.tipo === 'Movimiento' || !c.tipo);
      return matchTipo && matchSearch && matchGroup;
    }).sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
  }, [cuentasContables, searchTerm, filterGroup, tipoFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh] animate-in zoom-in-95 duration-200 border border-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800">{title}</h3>
              <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Groups Filter */}
        <div className="p-4 border-b border-slate-100 space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por código o nombre de cuenta..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'todos', label: 'Todas las Cuentas' },
              { id: '1', label: '1. Activo' },
              { id: '2', label: '2. Pasivo' },
              { id: '3', label: '3. Patrimonio' },
              { id: '4', label: '4. Ingresos' },
              { id: '5', label: '5. Costos / Gastos' }
            ].map(grp => (
              <button
                key={grp.id}
                type="button"
                onClick={() => setFilterGroup(grp.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all cursor-pointer ${
                  filterGroup === grp.id 
                    ? 'bg-indigo-600 text-white shadow-2xs' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {grp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cuentas List */}
        <div className="p-3 overflow-y-auto flex-1 max-h-[400px]">
          {filteredCuentas.length > 0 ? (
            <div className="space-y-1">
              {filteredCuentas.map(c => {
                const isSelected = selectedCuentaId && (String(c.id) === String(selectedCuentaId) || String(c.codigo) === String(selectedCuentaId));
                return (
                  <div 
                    key={c.id}
                    onClick={() => {
                      onSelect(c);
                      onClose();
                    }}
                    className={`p-3 rounded-xl cursor-pointer border transition-all flex items-center justify-between group ${
                      isSelected 
                        ? 'bg-indigo-50/80 border-indigo-300 shadow-2xs' 
                        : 'hover:bg-indigo-50/40 border-transparent hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                          {c.codigo}
                        </span>
                        <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-900 truncate">
                          {c.nombre}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Grupo: {c.grupo || 'General'} {c.naturaleza ? `• Naturaleza: ${c.naturaleza}` : ''}
                      </span>
                    </div>
                    <Check className={`w-4 h-4 text-indigo-600 transition-opacity shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold text-slate-500">No se encontraron cuentas contables</p>
              <p className="text-[11px] mt-0.5">Intente con otros criterios de búsqueda.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer transition-colors shadow-2xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
