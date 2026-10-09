import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, FileText, Package, Contact, Receipt, Building2, 
  Landmark, FileSpreadsheet, BarChart3, Settings, Truck,
  PlusCircle, ArrowRight, X, Coins, Sparkles, Command, Check
} from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { getLocal } from '../../services/storageHelper';
import { getTasaForDate } from '../../services/exchangeRateService';

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Navegación' | 'Acción Rápida' | 'Inventario' | 'Finanzas';
  icon: any;
  action: () => void;
  badge?: string;
}

export default function CommandPalette({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { activeCompanyId } = useCompany();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cargar productos en caché para búsqueda instantánea de stock
  const [localProducts, setLocalProducts] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      // Cargar productos locales para búsqueda relámpago
      if (activeCompanyId) {
        getLocal<any[]>(`app_products_${activeCompanyId}`, []).then(prods => {
          if (Array.isArray(prods)) setLocalProducts(prods);
        });
      }
    }
  }, [isOpen, activeCompanyId]);

  const liveRate = useMemo(() => {
    return getTasaForDate(new Date().toISOString().slice(0, 10));
  }, []);

  // Lista base de comandos
  const baseCommands: CommandItem[] = useMemo(() => [
    {
      id: 'cmd-new-invoice',
      title: 'Nueva Factura de Venta',
      subtitle: 'Crear comprobante o factura rápida a cliente',
      category: 'Acción Rápida',
      icon: PlusCircle,
      badge: 'F2',
      action: () => { navigate('/invoicing'); onClose(); }
    },
    {
      id: 'cmd-invoicing',
      title: 'Módulo de Facturación',
      subtitle: 'Listado de facturas emitidas, notas de entrega y cotizaciones',
      category: 'Navegación',
      icon: FileText,
      action: () => { navigate('/invoicing'); onClose(); }
    },
    {
      id: 'cmd-inventory',
      title: 'Control de Inventario y Kardex',
      subtitle: 'Existencias, precios, lotes y almacenes',
      category: 'Navegación',
      icon: Package,
      badge: 'F3',
      action: () => { navigate('/inventory'); onClose(); }
    },
    {
      id: 'cmd-contacts',
      title: 'Contactos (Clientes y Proveedores)',
      subtitle: 'Directorio comercial, RIFs y saldos',
      category: 'Navegación',
      icon: Contact,
      action: () => { navigate('/contacts'); onClose(); }
    },
    {
      id: 'cmd-receivables',
      title: 'Cuentas por Cobrar (CxC)',
      subtitle: 'Cobranzas pendientes, abonos y estado de cuenta',
      category: 'Finanzas',
      icon: Receipt,
      action: () => { navigate('/receivables'); onClose(); }
    },
    {
      id: 'cmd-payables',
      title: 'Cuentas por Pagar (CxP)',
      subtitle: 'Compromisos con proveedores y programación de pagos',
      category: 'Finanzas',
      icon: Building2,
      action: () => { navigate('/payables'); onClose(); }
    },
    {
      id: 'cmd-banks',
      title: 'Tesorería y Bancos',
      subtitle: 'Cuentas bancarias, cajas y conciliación de movimientos',
      category: 'Finanzas',
      icon: Landmark,
      action: () => { navigate('/banks'); onClose(); }
    },
    {
      id: 'cmd-accounting',
      title: 'Contabilidad y Asientos Diarios',
      subtitle: 'Plan de cuentas, balance y comprobantes contables',
      category: 'Finanzas',
      icon: FileSpreadsheet,
      action: () => { navigate('/accounting'); onClose(); }
    },
    {
      id: 'cmd-purchases',
      title: 'Compras y Gastos',
      subtitle: 'Registro de facturas de compra y recepción de inventario',
      category: 'Navegación',
      icon: Truck,
      action: () => { navigate('/purchases'); onClose(); }
    },
    {
      id: 'cmd-reports',
      title: 'Reportes e Informes Financieros',
      subtitle: 'Libros fiscales IVA/ISLR, ventas por vendedor y rentabilidad',
      category: 'Navegación',
      icon: BarChart3,
      action: () => { navigate('/reports'); onClose(); }
    },
    {
      id: 'cmd-settings',
      title: 'Configuración General',
      subtitle: 'Empresa, correlativos, usuarios y puntos POS',
      category: 'Navegación',
      icon: Settings,
      action: () => { navigate('/settings'); onClose(); }
    }
  ], [navigate, onClose]);

  // Si el usuario escribe algo, también buscamos en productos de inventario
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseCommands;

    const matchedCommands = baseCommands.filter(c => 
      c.title.toLowerCase().includes(q) || 
      c.subtitle.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );

    // Búsqueda instantánea de productos en stock
    const matchedProducts: CommandItem[] = localProducts
      .filter(p => 
        (p.nombre && p.nombre.toLowerCase().includes(q)) ||
        (p.codigo && p.codigo.toLowerCase().includes(q)) ||
        (p.codigo_barra && p.codigo_barra.toLowerCase().includes(q))
      )
      .slice(0, 5)
      .map(p => ({
        id: `prod-${p.id}`,
        title: `${p.nombre} (${p.codigo || 'SIN-COD'})`,
        subtitle: `Stock: ${p.stock_actual ?? 0} ${p.unidad_medida || 'UND'} • Precio: $ ${(Number(p.precio_venta) || 0).toFixed(2)} (Bs. ${((Number(p.precio_venta) || 0) * liveRate).toFixed(2)})`,
        category: 'Inventario' as const,
        icon: Package,
        badge: `${p.stock_actual ?? 0} disp.`,
        action: () => {
          navigate('/inventory');
          onClose();
        }
      }));

    return [...matchedProducts, ...matchedCommands];
  }, [query, baseCommands, localProducts, liveRate, navigate, onClose]);

  // Navegación por teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-start justify-center pt-16 sm:pt-24 px-4 select-none">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Caja de Comandos Modal */}
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col transform transition-all animate-scale-up">
        {/* Barra de Entrada */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 bg-slate-50/70">
          <Search className="w-5 h-5 text-indigo-600 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Escribe un comando, módulo o busca un producto... (↑↓ para navegar, Enter para seleccionar)"
            className="w-full bg-transparent text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <div className="hidden sm:flex items-center gap-1 ml-2 text-[10px] font-mono text-slate-400 bg-slate-200/60 px-1.5 py-0.5 rounded border border-slate-300/60">
            <span>ESC</span>
          </div>
        </div>

        {/* Tasa BCV Bar Informativa */}
        <div className="px-4 py-1.5 bg-indigo-50/60 border-b border-indigo-100/60 flex items-center justify-between text-[11px] font-medium text-indigo-900">
          <div className="flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-indigo-600" />
            <span>Tasa Oficial BCV Hoy:</span>
            <strong className="font-mono font-bold text-indigo-700">Bs. {liveRate.toFixed(4)} / USD</strong>
          </div>
          <span className="text-slate-400 text-[10px]">Atajo rápido: [Ctrl + K]</span>
        </div>

        {/* Lista de Resultados */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No se encontraron comandos o productos coincidentes con "{query}".
            </div>
          ) : (
            filteredCommands.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const IconComp = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs sm:text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                          {item.title}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {item.category}
                        </span>
                      </div>
                      <p className={`text-[11px] truncate mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {item.badge && (
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        isSelected 
                          ? 'bg-white/20 text-white border-white/30' 
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-300'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Guía de Teclas */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/80 text-[11px] text-slate-400 flex items-center justify-between font-medium">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-white px-1 border border-slate-200 rounded text-[10px]">↑</kbd> <kbd className="font-mono bg-white px-1 border border-slate-200 rounded text-[10px]">↓</kbd> Navegar</span>
            <span><kbd className="font-mono bg-white px-1 border border-slate-200 rounded text-[10px]">Enter</kbd> Ejecutar</span>
            <span><kbd className="font-mono bg-white px-1 border border-slate-200 rounded text-[10px]">Esc</kbd> Salir</span>
          </div>
          <span className="text-slate-500 font-semibold">Halley ERP Pro</span>
        </div>
      </div>
    </div>
  );
}
