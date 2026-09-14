import React, { useState, useEffect } from 'react';
import { X, Coins, Calendar, Check, Trash2, Edit3, TrendingUp, AlertCircle, RefreshCw, Globe, Sparkles } from 'lucide-react';
import { 
  getStoredTasas, 
  saveStoredTasa, 
  deleteStoredTasa, 
  getTasaForDate, 
  fetchLiveBcvRate,
  TasaCambioDia 
} from '../../services/exchangeRateService';
import { formatDate } from '../../utils/dateUtils';

interface TasaCambioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess?: (fecha: string, tasa: number) => void;
}

export default function TasaCambioModal({
  isOpen,
  onClose,
  onSaveSuccess
}: TasaCambioModalProps) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [fecha, setFecha] = useState(todayStr);
  const [tasaInput, setTasaInput] = useState('36.50');
  const [fuente, setFuente] = useState('BCV');
  const [historyList, setHistoryList] = useState<TasaCambioDia[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFetchingLive, setIsFetchingLive] = useState(false);

  // Cargar histórico y tasa inicial al abrir
  useEffect(() => {
    if (isOpen) {
      const stored = getStoredTasas();
      setHistoryList(stored);
      const currentRate = getTasaForDate(fecha);
      setTasaInput(currentRate.toFixed(2));
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Sincronización en vivo con el Banco Central de Venezuela
  const handleFetchLiveBcv = async () => {
    setIsFetchingLive(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetchLiveBcvRate(true);
      if (res.success && res.tasa) {
        const rateStr = res.tasa.toFixed(2);
        setTasaInput(rateStr);
        if (res.fecha) {
          setFecha(res.fecha);
        }
        setFuente(res.fuente || 'BCV');
        const updated = getStoredTasas();
        setHistoryList(updated);

        const msg = `¡Tasa actualizada en vivo! Bs. ${res.tasa.toFixed(2)} / $ desde ${res.fuente || 'bcv.org.ve'} (Fecha Valor: ${res.fecha ? formatDate(res.fecha) : formatDate(fecha)})`;
        setSuccessMessage(msg);
        onSaveSuccess?.(res.fecha || fecha, res.tasa);

        setTimeout(() => {
          setSuccessMessage(null);
        }, 6000);
      } else {
        setErrorMessage(res.error || 'No se pudo obtener la tasa oficial del BCV. Verifique su conexión a internet.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al conectar con el servidor oficial del BCV.');
    } finally {
      setIsFetchingLive(false);
    }
  };

  // Al cambiar la fecha en el selector, autocompletar con la tasa de esa fecha si existe
  const handleDateChange = (newDate: string) => {
    setFecha(newDate);
    const existing = historyList.find(t => t.fecha === newDate);
    if (existing) {
      setTasaInput(existing.tasa.toFixed(2));
      setFuente(existing.fuente || 'BCV');
    } else {
      const fallback = getTasaForDate(newDate);
      setTasaInput(fallback.toFixed(2));
    }
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tasaInput.replace(',', '.').trim();
    const num = parseFloat(clean);
    if (isNaN(num) || num <= 0) {
      alert('Por favor introduce un valor válido para la tasa de cambio.');
      return;
    }

    const updated = saveStoredTasa(fecha, num, fuente);
    setHistoryList(updated);
    setSuccessMessage(`Tasa guardada exitosamente: Bs. ${num.toFixed(2)} / $ para el ${formatDate(fecha)}`);
    onSaveSuccess?.(fecha, num);

    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  const handleDelete = (targetDate: string) => {
    if (window.confirm(`¿Eliminar la tasa registrada para el ${formatDate(targetDate)}?`)) {
      const updated = deleteStoredTasa(targetDate);
      setHistoryList(updated);
      if (targetDate === fecha) {
        setTasaInput(getTasaForDate(fecha).toFixed(2));
      }
    }
  };

  const handleSelectFromHistory = (item: TasaCambioDia) => {
    setFecha(item.fecha);
    setTasaInput(item.tasa.toFixed(2));
    setFuente(item.fuente || 'BCV');
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header Modal */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Tasa de Cambio Oficial (BCV)</h3>
              <p className="text-xs text-emerald-100 font-medium">
                Actualización en vivo y consulta oficial para facturación y cobranza
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Tarjeta de Sincronización en Vivo */}
          <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/60 border border-emerald-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Globe size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-slate-900">Banco Central de Venezuela</h4>
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    En Vivo
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Conexión directa con <span className="font-mono font-bold text-slate-700">bcv.org.ve</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFetchLiveBcv}
              disabled={isFetchingLive}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition shadow-sm shadow-emerald-600/25 active:scale-95 cursor-pointer shrink-0"
            >
              <RefreshCw size={13} className={isFetchingLive ? 'animate-spin' : ''} />
              <span>{isFetchingLive ? 'Consultando BCV...' : 'Actualizar en Vivo'}</span>
            </button>
          </div>

          {/* Mensaje de error si falla la conexión */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Mensaje de éxito */}
          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs font-bold animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Formulario de Registro */}
          <form onSubmit={handleSave} className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4.5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} className="text-emerald-600" />
                Registrar / Ajustar Manualmente
              </span>
              {fecha === todayStr && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Fecha de Hoy
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Fecha */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Fecha del Registro
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    required
                    value={fecha}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>
              </div>

              {/* Tasa BCV */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tasa Oficial BCV (Bs. / $)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs select-none">
                    Bs.
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="0.00"
                    value={tasaInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^[0-9]*[.,]?[0-9]*$/.test(val)) {
                        setTasaInput(val);
                      }
                    }}
                    onBlur={() => {
                      if (!tasaInput.trim() || parseFloat(tasaInput.replace(',', '.')) <= 0) {
                        setTasaInput('1.00');
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-emerald-800 outline-none focus:border-emerald-600 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-400 font-medium">
                Fuente: <strong className="text-slate-600">{fuente}</strong> (Banco Central de Venezuela)
              </span>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm shadow-emerald-500/20 active:scale-95 cursor-pointer"
              >
                <Check size={14} />
                <span>Guardar Tasa</span>
              </button>
            </div>
          </form>

          {/* Histórico de Tasas Registradas */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                Histórico de Tasas Registradas
              </h4>
              <span className="text-[11px] text-slate-400 font-bold">
                {historyList.length} {historyList.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
              {historyList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                  No hay tasas registradas todavía
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold tracking-wider sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Fecha</th>
                      <th className="px-4 py-2.5">Tasa Oficial</th>
                      <th className="px-4 py-2.5">Fuente</th>
                      <th className="px-4 py-2.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {historyList.map((item) => {
                      const isToday = item.fecha === todayStr;
                      const isSelected = item.fecha === fecha;

                      return (
                        <tr 
                          key={item.id || item.fecha}
                          className={`hover:bg-slate-50/80 transition ${
                            isSelected ? 'bg-emerald-50/50 font-bold' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5 font-semibold">
                            <div className="flex items-center gap-2">
                              <span>{formatDate(item.fecha)}</span>
                              {isToday && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                  Hoy
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-mono font-black text-emerald-700">
                            Bs. {item.tasa.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">
                            {item.fuente || 'BCV'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSelectFromHistory(item)}
                                className="p-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                                title="Cargar fecha y tasa al formulario"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.fecha)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                title="Eliminar registro"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
