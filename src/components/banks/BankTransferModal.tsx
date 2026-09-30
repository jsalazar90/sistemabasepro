import React, { useState, useMemo } from 'react';
import { X, ArrowRightLeft, AlertCircle, Check, Landmark, Calendar, FileText } from 'lucide-react';
import { formatMoney } from '../../utils/numberFormat';
import { getTodayLocalDate } from '../../utils/dateUtils';

export interface BankTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  bancos: any[];
  tasaBcv?: number;
  onConfirmTransfer: (data: {
    origenBancoId: string;
    destinoBancoId: string;
    montoOrigen: number;
    montoDestino: number;
    fecha: string;
    referencia: string;
    concepto: string;
    tasaCambio: number;
  }) => Promise<void>;
}

export default function BankTransferModal({
  isOpen,
  onClose,
  bancos = [],
  tasaBcv = 36.5,
  onConfirmTransfer
}: BankTransferModalProps) {
  const [origenBancoId, setOrigenBancoId] = useState<string>('');
  const [destinoBancoId, setDestinoBancoId] = useState<string>('');
  const [montoInput, setMontoInput] = useState<string>('');
  const [fecha, setFecha] = useState<string>(getTodayLocalDate());
  const [referencia, setReferencia] = useState<string>('');
  const [concepto, setConcepto] = useState<string>('Traspaso de fondos entre cuentas');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const origenBanco = bancos.find((b) => b.id === origenBancoId);
  const destinoBanco = bancos.find((b) => b.id === destinoBancoId);

  const montoNum = parseFloat(montoInput.replace(',', '.')) || 0;
  const saldoDisponibleOrigen = Number(origenBanco?.saldo_actual ?? origenBanco?.saldoActual ?? 0);

  const isCrossCurrency = useMemo(() => {
    if (!origenBanco || !destinoBanco) return false;
    return (origenBanco.moneda || 'USD').toUpperCase() !== (destinoBanco.moneda || 'USD').toUpperCase();
  }, [origenBanco, destinoBanco]);

  const montoDestinoCalculado = useMemo(() => {
    if (!origenBanco || !destinoBanco || montoNum <= 0) return 0;
    const origenMoneda = (origenBanco.moneda || 'USD').toUpperCase();
    const destinoMoneda = (destinoBanco.moneda || 'USD').toUpperCase();

    if (origenMoneda === destinoMoneda) {
      return montoNum;
    }

    if (origenMoneda === 'USD' && destinoMoneda === 'VES') {
      return Number((montoNum * tasaBcv).toFixed(2));
    }

    if (origenMoneda === 'VES' && destinoMoneda === 'USD') {
      return tasaBcv > 0 ? Number((montoNum / tasaBcv).toFixed(2)) : 0;
    }

    return montoNum;
  }, [origenBanco, destinoBanco, montoNum, tasaBcv]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!origenBancoId) {
      setErrorMsg('Debe seleccionar la cuenta o caja de origen');
      return;
    }
    if (!destinoBancoId) {
      setErrorMsg('Debe seleccionar la cuenta o caja de destino');
      return;
    }
    if (origenBancoId === destinoBancoId) {
      setErrorMsg('La cuenta de origen y destino no pueden ser la misma');
      return;
    }
    if (montoNum <= 0) {
      setErrorMsg('El monto a transferir debe ser mayor a cero');
      return;
    }
    if (montoNum > saldoDisponibleOrigen) {
      setErrorMsg(`Saldo insuficiente en ${origenBanco?.nombre}. Disponible: ${formatMoney(saldoDisponibleOrigen)}`);
      return;
    }
    if (!referencia.trim()) {
      setErrorMsg('Debe ingresar un número de referencia o voucher');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmTransfer({
        origenBancoId,
        destinoBancoId,
        montoOrigen: montoNum,
        montoDestino: montoDestinoCalculado,
        fecha,
        referencia: referencia.trim(),
        concepto: concepto.trim(),
        tasaCambio: tasaBcv
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al procesar el traspaso interbancario');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-xs">
              <ArrowRightLeft size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-white">
                Traspaso Interbancario / Depósito
              </h3>
              <p className="text-xs text-slate-400 font-bold">
                Movimiento dual entre instrumentos financieros
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Origen */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Cuenta de Origen (Salida de Fondos)
            </label>
            <select
              value={origenBancoId}
              onChange={(e) => setOrigenBancoId(e.target.value)}
              className="w-full text-sm font-semibold p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
              required
            >
              <option value="">-- Seleccione cuenta de salida --</option>
              {bancos.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre} ({b.moneda || 'USD'}) - Saldo: {formatMoney(b.saldo_actual ?? b.saldoActual ?? 0)}
                </option>
              ))}
            </select>
          </div>

          {/* Destino */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Cuenta de Destino (Entrada de Fondos)
            </label>
            <select
              value={destinoBancoId}
              onChange={(e) => setDestinoBancoId(e.target.value)}
              className="w-full text-sm font-semibold p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
              required
            >
              <option value="">-- Seleccione cuenta receptora --</option>
              {bancos
                .filter((b) => b.id !== origenBancoId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre} ({b.moneda || 'USD'}) - Saldo: {formatMoney(b.saldo_actual ?? b.saldoActual ?? 0)}
                  </option>
                ))}
            </select>
          </div>

          {/* Monto & Equivalencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                Monto en Origen ({origenBanco?.moneda || 'USD'})
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={montoInput}
                onChange={(e) => setMontoInput(e.target.value)}
                className="w-full text-sm font-mono font-bold p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                Monto Destino ({destinoBanco?.moneda || 'USD'})
              </label>
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-mono text-sm font-black text-slate-800">
                {destinoBanco?.moneda || 'USD'} {formatMoney(montoDestinoCalculado)}
              </div>
            </div>
          </div>

          {isCrossCurrency && (
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex justify-between items-center font-bold">
              <span>Conversión multimoneda activa</span>
              <span className="font-mono">Tasa: Bs. {formatMoney(tasaBcv)} / $</span>
            </div>
          )}

          {/* Fecha y Referencia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                Fecha de Operación
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full text-sm font-semibold p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                Referencia Bancaria
              </label>
              <input
                type="text"
                placeholder="Ej. TRF-123456"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="w-full text-sm font-mono p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          {/* Concepto */}
          <div>
            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Concepto / Observaciones
            </label>
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="w-full text-sm p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check size={14} strokeWidth={2.5} />
              {isSubmitting ? 'Procesando...' : 'Confirmar Traspaso'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
