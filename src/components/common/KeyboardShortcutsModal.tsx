import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({
  isOpen,
  onClose
}: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl + K / ⌘K', desc: 'Abrir barra global de comandos y búsqueda' },
    { key: 'F2', desc: 'Crear nueva factura de venta (POS)' },
    { key: 'F3', desc: 'Abrir catálogo de inventario y artículos' },
    { key: 'F4', desc: 'Seleccionar cliente en facturación' },
    { key: 'F8', desc: 'Alternar condición Contado / Crédito' },
    { key: 'F9', desc: 'Alternar vista de moneda dominante (USD / VES)' },
    { key: 'F12', desc: 'Cobrar y registrar factura inmediata' },
    { key: 'Esc', desc: 'Cerrar cualquier modal o limpiar selección' },
    { key: 'Ctrl + P', desc: 'Imprimir documento o reporte activo' }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 select-none">
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col animate-scale-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2 text-indigo-600">
            <Keyboard className="w-5 h-5" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Atajos de Teclado del Sistema
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-2.5 max-h-96 overflow-y-auto">
          {shortcuts.map((sc, idx) => (
            <div 
              key={idx}
              className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:bg-slate-100/70 transition"
            >
              <span className="text-xs font-medium text-slate-700">
                {sc.desc}
              </span>
              <kbd className="font-mono text-xs font-bold text-indigo-700 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-2xs">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
