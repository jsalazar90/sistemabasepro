import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Plus, CheckCircle, RefreshCw, AlertCircle, Scale, 
  FileText, Calendar, Hash, Tag, Trash2, ArrowRightLeft,
  DollarSign, Check, ShieldCheck, HelpCircle, Search
} from 'lucide-react';
import CuentaContableModal from './CuentaContableModal';

export interface VoucherLine {
  id: string;
  cuentaId: string;
  nombreCuenta?: string;
  descripcion: string;
  debe: number;
  haber: number;
}

export interface VoucherModel {
  id?: string;
  numero?: string;
  fecha: string;
  descripcion?: string;
  concepto?: string;
  referencia?: string;
  total?: number;
  tipo?: string;
  estado?: string;
  modulo?: string;
  tasa?: number;
  tasa_cambio?: number;
  lineas: VoucherLine[];
}

export interface VoucherPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialComprobante: VoucherModel | any | null;
  cuentasContables: any[];
  onConfirm: (finalComprobante: any) => Promise<void> | void;
  showToast?: (msg: string, type: string) => void;
  title?: string;
  subtitle?: string;
  tasaCambio?: number;
}

export default function VoucherPreviewModal({
  isOpen,
  onClose,
  initialComprobante,
  cuentasContables = [],
  onConfirm,
  showToast,
  title = "Asiento Contable NIIF / IFRS",
  subtitle = "Comprobante de Diario • Verifique las cuentas contables, glosas y cuadre de partida doble antes de registrar.",
  tasaCambio
}: VoucherPreviewModalProps) {
  const [comprobante, setComprobante] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [accountModalIndex, setAccountModalIndex] = useState<number | null>(null);

  useEffect(() => {
    if (initialComprobante) {
      const cloned = JSON.parse(JSON.stringify(initialComprobante));
      // Normalizar cuentaId a coincidir con el ID real si se pasó código
      if (Array.isArray(cloned.lineas)) {
        cloned.lineas = cloned.lineas.map((l: any, idx: number) => {
          const matched = (cuentasContables || []).find((c: any) => c.id === l.cuentaId || c.codigo === l.cuentaId);
          return {
            id: l.id || `line-${Date.now()}-${idx}`,
            cuentaId: matched ? matched.id : (l.cuentaId || ''),
            nombreCuenta: matched ? `${matched.codigo} - ${matched.nombre || matched.name}` : (l.nombreCuenta || ''),
            descripcion: l.descripcion || cloned.descripcion || cloned.concepto || '',
            debe: parseFloat(String(l.debe || 0)) || 0,
            haber: parseFloat(String(l.haber || 0)) || 0
          };
        });
      } else {
        cloned.lineas = [];
      }
      setComprobante(cloned);
    }
  }, [initialComprobante, cuentasContables]);

  // Lista ordenada de cuentas contables de movimiento
  const activeCuentas = useMemo(() => {
    return (cuentasContables || [])
      .filter(c => c.tipo === 'Movimiento' || !c.tipo)
      .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
  }, [cuentasContables]);

  const mapCuentas = useMemo(() => {
    const map = new Map<string, any>();
    (cuentasContables || []).forEach(c => map.set(c.id, c));
    return map;
  }, [cuentasContables]);

  if (!isOpen || !comprobante) return null;

  const handleLineChange = (index: number, field: string, value: any) => {
    const updatedLineas = [...comprobante.lineas];
    let val = value;
    if (field === 'debe' || field === 'haber') {
      val = value === '' ? 0 : parseFloat(value);
      if (isNaN(val)) val = 0;
    }
    
    const currentLine = { ...updatedLineas[index], [field]: val };
    if (field === 'cuentaId') {
      const acc = mapCuentas.get(val);
      if (acc) {
        currentLine.nombreCuenta = `${acc.codigo} - ${acc.nombre || acc.name}`;
      }
    }
    updatedLineas[index] = currentLine;

    const totalDebe = updatedLineas.reduce((acc, curr) => acc + (Number(curr.debe) || 0), 0);
    const totalHaber = updatedLineas.reduce((acc, curr) => acc + (Number(curr.haber) || 0), 0);
    const isBalanced = Math.abs(totalDebe - totalHaber) < 0.01;

    setComprobante({
      ...comprobante,
      lineas: updatedLineas,
      total: Math.max(totalDebe, totalHaber),
      estado: isBalanced ? 'Contabilizado' : 'Descuadrado'
    });
  };

  const handleAddLine = () => {
    const defaultDesc = comprobante.descripcion || comprobante.concepto || 'Línea de Comprobante';
    const newLine = {
      id: `l-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      cuentaId: '',
      descripcion: defaultDesc,
      debe: 0,
      haber: 0
    };
    setComprobante({
      ...comprobante,
      lineas: [...comprobante.lineas, newLine]
    });
  };

  const handleRemoveLine = (index: number) => {
    if (comprobante.lineas.length <= 1) return;
    const updatedLineas = comprobante.lineas.filter((_: any, i: number) => i !== index);
    const totalDebe = updatedLineas.reduce((acc: number, curr: any) => acc + (Number(curr.debe) || 0), 0);
    const totalHaber = updatedLineas.reduce((acc: number, curr: any) => acc + (Number(curr.haber) || 0), 0);
    const isBalanced = Math.abs(totalDebe - totalHaber) < 0.01;

    setComprobante({
      ...comprobante,
      lineas: updatedLineas,
      total: Math.max(totalDebe, totalHaber),
      estado: isBalanced ? 'Contabilizado' : 'Descuadrado'
    });
  };

  const totalDebe = (comprobante.lineas || []).reduce((acc: number, curr: any) => acc + (Number(curr.debe) || 0), 0);
  const totalHaber = (comprobante.lineas || []).reduce((acc: number, curr: any) => acc + (Number(curr.haber) || 0), 0);
  const diff = Math.round((totalDebe - totalHaber) * 100) / 100;
  const isBalanced = Math.abs(diff) < 0.01;

  // Auto-cuadrar asiento ajustando la diferencia
  const handleAutoBalance = () => {
    if (isBalanced) return;
    const absDiff = Math.abs(diff);
    const updatedLineas = [...comprobante.lineas];
    
    const newLine = {
      id: `l-balance-${Date.now()}`,
      cuentaId: '',
      descripcion: `Ajuste de Cuadre (${comprobante.descripcion || 'Partida Doble'})`,
      debe: diff < 0 ? absDiff : 0,
      haber: diff > 0 ? absDiff : 0
    };

    updatedLineas.push(newLine);
    setComprobante({
      ...comprobante,
      lineas: updatedLineas,
      total: Math.max(totalDebe, totalHaber) + (diff < 0 ? absDiff : 0),
      estado: 'Contabilizado'
    });
    showToast?.('Línea de contrapartida agregada para cuadrar el asiento.', 'info');
  };

  const formatES = (num: number | string) => {
    if (num === undefined || num === null || num === "") return "0,00";
    const parsed = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(parsed)) return "0,00";
    return parsed.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const effectiveTasa = tasaCambio || comprobante.tasa || comprobante.tasa_cambio || 0;

  const handleConfirmClick = async () => {
    if (isSaving) return;

    // Validación de cuentas vacías
    const hasEmptyCuenta = (comprobante.lineas || []).some((l: any) => !l.cuentaId);
    if (hasEmptyCuenta) {
      showToast?.('Debe seleccionar una cuenta contable en todas las líneas del asiento.', 'error');
      return;
    }

    // Validación de líneas en cero
    const hasZeroAmount = (comprobante.lineas || []).some((l: any) => (Number(l.debe) || 0) === 0 && (Number(l.haber) || 0) === 0);
    if (hasZeroAmount) {
      showToast?.('Todas las líneas del asiento deben registrar un monto mayor a cero en Debe o Haber.', 'error');
      return;
    }

    // Validación de Partida Doble
    if (!isBalanced) {
      showToast?.(`El asiento está descuadrado por $ ${formatES(Math.abs(diff))}. La suma del Debe debe ser igual al Haber.`, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const cleanLineas = (comprobante.lineas || []).map((l: any) => ({
        ...l,
        debe: parseFloat(Number(l.debe || 0).toFixed(2)),
        haber: parseFloat(Number(l.haber || 0).toFixed(2))
      }));

      const cleanComp = {
        ...comprobante,
        descripcion: comprobante.descripcion?.trim() || comprobante.concepto?.trim() || 'Comprobante de Diario',
        concepto: comprobante.descripcion?.trim() || comprobante.concepto?.trim() || 'Comprobante de Diario',
        lineas: cleanLineas,
        total: parseFloat(Number(totalDebe || comprobante.total || 0).toFixed(2)),
        estado: 'Contabilizado'
      };

      await onConfirm(cleanComp);
    } catch (error: any) {
      console.error("Error confirming voucher:", error);
      showToast?.(`Error: ${error?.message || String(error)}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 font-sans">
        
        {/* 1. HEADER NIIF / IFRS */}
        <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Scale size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">
                  NIIF / IFRS • LIBRO DIARIO
                </span>
                {isBalanced ? (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle size={11} /> Partida Doble Cuadrada
                  </span>
                ) : (
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                    <AlertCircle size={11} /> Descuadrado (Dif: ${formatES(Math.abs(diff))})
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">{title}</h3>
              <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            disabled={isSaving}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
            title="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. METADATOS Y GLOSA PRINCIPAL (TARJETA SUPERIOR) */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-6 py-4 shrink-0 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            
            {/* N° Comprobante */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                N° Comprobante
              </span>
              <span className="font-mono font-black text-indigo-700 text-sm block mt-0.5">
                {comprobante.numero || 'Generado autom.'}
              </span>
            </div>

            {/* Fecha Contable */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Fecha Contable
              </span>
              <input
                type="date"
                className="w-full mt-0.5 bg-transparent font-bold text-slate-800 text-xs outline-none cursor-pointer"
                value={comprobante.fecha || ''}
                onChange={e => setComprobante({ ...comprobante, fecha: e.target.value })}
                disabled={isSaving}
              />
            </div>

            {/* Referencia Documento Fuente */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Referencia Origen
              </span>
              <span className="font-mono font-bold text-slate-700 text-xs block mt-0.5 truncate" title={comprobante.referencia || '-'}>
                {comprobante.referencia || '-'}
              </span>
            </div>

            {/* Moneda y Estado */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Moneda Base
                </span>
                <span className="font-bold text-slate-800 text-xs block mt-0.5">
                  USD ($) {effectiveTasa > 0 && <span className="text-[10px] text-slate-500 font-normal">@ Bs. {formatES(effectiveTasa)}</span>}
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isBalanced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                {isBalanced ? 'Cuadrado' : 'Descuadre'}
              </span>
            </div>

          </div>

          {/* Glosa / Concepto General del Asiento */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider shrink-0 flex items-center gap-1.5 min-w-[170px]">
              <FileText size={14} className="text-indigo-600" />
              Glosa / Concepto General:
            </label>
            <input
              type="text"
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all placeholder:text-slate-400"
              value={comprobante.descripcion || comprobante.concepto || ''}
              onChange={e => setComprobante({ ...comprobante, descripcion: e.target.value, concepto: e.target.value })}
              placeholder="Descripción detallada del motivo y transacción contable..."
              disabled={isSaving}
            />
          </div>
        </div>

        {/* 3. TABLA DE ASIENTO CONTABLE (PARTIDA DOBLE) */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-6 bg-slate-100/60">
          <div className="flex items-center justify-between pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Detalle de Cuentas y Partida Doble
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 font-bold text-[10px]">
                {comprobante.lineas?.length || 0} cuentas
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isBalanced && (
                <button
                  type="button"
                  onClick={handleAutoBalance}
                  className="px-3 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Generar línea de ajuste para igualar el Debe y el Haber"
                >
                  <ArrowRightLeft size={13} />
                  Auto-Cuadrar (${formatES(Math.abs(diff))})
                </button>
              )}
              <button
                type="button"
                onClick={handleAddLine}
                disabled={isSaving}
                className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Plus size={14} />
                Agregar Cuenta
              </button>
            </div>
          </div>

          {/* Contenedor con Scroll de la Tabla */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="overflow-y-auto flex-1 max-h-[46vh]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs text-slate-600 font-extrabold border-b border-slate-200 text-[11px] uppercase tracking-wider select-none shadow-2xs">
                  <tr>
                    <th className="py-3 px-3 text-center w-10">#</th>
                    <th className="py-3 px-4 min-w-[300px] w-5/12">Cuenta Contable (Código y Nombre)</th>
                    <th className="py-3 px-4 min-w-[260px] w-4/12">Glosa / Concepto de Línea</th>
                    <th className="py-3 px-4 text-right w-36 min-w-[140px]">Debe ($)</th>
                    <th className="py-3 px-4 text-right w-36 min-w-[140px]">Haber ($)</th>
                    <th className="py-3 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comprobante.lineas.map((line: any, index: number) => {
                    const selectedAccount = mapCuentas.get(line.cuentaId);
                    return (
                      <tr key={line.id || index} className="hover:bg-indigo-50/20 transition-colors">
                        {/* N° */}
                        <td className="p-2 text-center font-mono text-[11px] font-bold text-slate-400 select-none">
                          {index + 1}
                        </td>

                        {/* Cuenta Contable */}
                        <td className="p-2">
                          <button
                            type="button"
                            onClick={() => setAccountModalIndex(index)}
                            disabled={isSaving}
                            className="w-full text-left px-3 py-2 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-400 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 rounded-xl transition-all shadow-2xs group flex items-center justify-between gap-2 disabled:bg-slate-100 disabled:cursor-not-allowed cursor-pointer"
                            title="Haga clic para buscar y seleccionar en el catálogo de cuentas NIIF"
                          >
                            <div className="min-w-0 flex-1">
                              {selectedAccount ? (
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                                    <span className="font-mono text-indigo-700 font-black mr-1.5">{selectedAccount.codigo}</span>
                                    • {selectedAccount.nombre || selectedAccount.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    Tipo: {selectedAccount.tipo || 'Movimiento'} • Código: {selectedAccount.codigo}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium italic flex items-center gap-1.5">
                                  <Search size={13} className="text-slate-400 group-hover:text-indigo-600 shrink-0" />
                                  Seleccionar cuenta contable NIIF...
                                </span>
                              )}
                            </div>
                            <div className="p-1 text-slate-400 group-hover:text-indigo-600 rounded-lg group-hover:bg-indigo-100/60 transition-colors shrink-0">
                              <Search size={14} />
                            </div>
                          </button>
                        </td>

                        {/* Glosa de Línea */}
                        <td className="p-2">
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-none bg-white transition-all disabled:bg-slate-100"
                            value={line.descripcion || ''}
                            onChange={e => handleLineChange(index, 'descripcion', e.target.value)}
                            placeholder="Detalle o justificación de la partida..."
                            disabled={isSaving}
                          />
                        </td>

                        {/* Debe ($) */}
                        <td className="p-2">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-full px-3 py-2 text-right border border-slate-200 rounded-lg text-sm font-mono font-bold text-emerald-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none bg-white transition-all disabled:bg-slate-100"
                              value={line.debe === 0 ? '' : line.debe}
                              onChange={e => handleLineChange(index, 'debe', e.target.value)}
                              placeholder="0,00"
                              disabled={isSaving}
                            />
                          </div>
                        </td>

                        {/* Haber ($) */}
                        <td className="p-2">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-full px-3 py-2 text-right border border-slate-200 rounded-lg text-sm font-mono font-bold text-violet-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none bg-white transition-all disabled:bg-slate-100"
                              value={line.haber === 0 ? '' : line.haber}
                              onChange={e => handleLineChange(index, 'haber', e.target.value)}
                              placeholder="0,00"
                              disabled={isSaving}
                            />
                          </div>
                        </td>

                        {/* Eliminar */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(index)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
                            title="Eliminar esta línea del asiento"
                            disabled={comprobante.lineas.length <= 1 || isSaving}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 4. PIE DE TABLA: TOTALES FIJOS INTERNACIONALES */}
            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
              
              {/* Estado y Diferencia */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Estado de Balance:
                  </span>
                  {isBalanced ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <Check size={14} /> ASIENTO CUADRADO
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                      <AlertCircle size={14} /> DESCUADRADO
                    </span>
                  )}
                </div>

                <div className="border-l border-slate-200 pl-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Diferencia:</span>
                  <span className={`font-mono font-black text-sm ml-1.5 ${isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                    $ {formatES(Math.abs(diff))}
                  </span>
                </div>
              </div>

              {/* Totales Debe y Haber */}
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    TOTAL DEBE (DÉBITO)
                  </span>
                  <span className="text-base font-mono font-black text-emerald-700 block">
                    $ {formatES(totalDebe)}
                  </span>
                  {effectiveTasa > 0 && (
                    <span className="text-[10px] font-mono text-slate-500 font-bold block">
                      Bs. {formatES(totalDebe * effectiveTasa)}
                    </span>
                  )}
                </div>

                <div className="w-px h-10 bg-slate-200" />

                <div className="text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    TOTAL HABER (CRÉDITO)
                  </span>
                  <span className="text-base font-mono font-black text-violet-700 block">
                    $ {formatES(totalHaber)}
                  </span>
                  {effectiveTasa > 0 && (
                    <span className="text-[10px] font-mono text-slate-500 font-bold block">
                      Bs. {formatES(totalHaber * effectiveTasa)}
                    </span>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* 5. FOOTER CON BOTONES DE ACCIÓN */}
        <div className="p-4 sm:px-6 sm:py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1.5 hidden md:flex">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <span>Este asiento se registrará de forma automática y definitiva en el Libro Diario y Mayor General.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={!isBalanced || isSaving}
              className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isBalanced && !isSaving 
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 active:scale-95' 
                  : 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Contabilizando Asiento...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  <span>Confirmar y Contabilizar</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Modal para Buscar Cuentas Contables NIIF */}
      {accountModalIndex !== null && (
        <CuentaContableModal
          isOpen={accountModalIndex !== null}
          onClose={() => setAccountModalIndex(null)}
          onSelect={(cuenta) => {
            handleLineChange(accountModalIndex, 'cuentaId', cuenta.id);
            setAccountModalIndex(null);
          }}
          cuentasContables={cuentasContables}
          selectedCuentaId={comprobante.lineas[accountModalIndex]?.cuentaId}
          title="Catálogo de Cuentas NIIF"
          subtitle="Seleccione la cuenta contable para asignar a esta línea del comprobante"
          tipoFilter="Movimiento"
        />
      )}
    </div>
  );
}
