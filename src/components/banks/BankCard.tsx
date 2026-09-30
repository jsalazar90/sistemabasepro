import React, { useState } from 'react';
import { Landmark, Copy, Check, Eye, ArrowUpRight, ArrowDownLeft, ShieldCheck } from 'lucide-react';
import { formatMoney } from '../../utils/numberFormat';

export interface BankCardProps {
  banco: any;
  isSelected?: boolean;
  onSelect?: (banco: any) => void;
  onTransfer?: (banco: any) => void;
  onNewMovement?: (banco: any) => void;
}

export default function BankCard({
  banco,
  isSelected = false,
  onSelect,
  onTransfer,
  onNewMovement
}: BankCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (banco.numero_cuenta || banco.numeroCuenta) {
      navigator.clipboard.writeText(banco.numero_cuenta || banco.numeroCuenta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isUsd = (banco.moneda || 'USD').toUpperCase() === 'USD';
  const saldo = Number(banco.saldo_actual ?? banco.saldoActual ?? 0);
  const isCaja = banco.es_caja || (banco.tipo || '').toLowerCase().includes('caja');

  return (
    <div
      onClick={() => onSelect?.(banco)}
      className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
        isSelected
          ? 'bg-gradient-to-br from-indigo-900 to-slate-900 border-indigo-500 text-white shadow-lg ring-2 ring-indigo-500/30'
          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs hover:border-slate-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isSelected ? 'bg-indigo-600/50 text-indigo-200' : 'bg-indigo-50 text-indigo-600'
            }`}
          >
            <Landmark size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h4 className={`text-sm font-black truncate max-w-[170px] ${isSelected ? 'text-white' : 'text-slate-900'}`}>
              {banco.nombre || banco.name || 'Entidad Bancaria'}
            </h4>
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                isCaja
                  ? isSelected ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-50 text-amber-700'
                  : isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isCaja ? 'Caja / Efectivo' : (banco.tipo_cuenta || banco.tipoCuenta || 'Cuenta Corriente')}
            </span>
          </div>
        </div>

        <span
          className={`text-[11px] font-black px-2 py-0.5 rounded-lg border font-mono ${
            isUsd
              ? isSelected ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : isSelected ? 'bg-blue-500/20 border-blue-400/40 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          {isUsd ? '$ USD' : 'Bs. VES'}
        </span>
      </div>

      <div className="mt-4">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Saldo Disponible
        </div>
        <div
          className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
            saldo < 0
              ? 'text-rose-500'
              : isSelected ? 'text-emerald-400' : 'text-slate-900'
          }`}
        >
          {isUsd ? '$ ' : 'Bs. '}
          {formatMoney(saldo)}
        </div>
      </div>

      {(banco.numero_cuenta || banco.numeroCuenta) && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className={`font-mono text-[11px] truncate max-w-[180px] ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
            {banco.numero_cuenta || banco.numeroCuenta}
          </span>
          <button
            onClick={handleCopy}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isSelected ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="Copiar número de cuenta"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 pt-2">
        {onNewMovement && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNewMovement(banco);
            }}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isSelected
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
            }`}
          >
            <ArrowUpRight size={13} strokeWidth={2.5} />
            Movimiento
          </button>
        )}
        {onTransfer && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTransfer(banco);
            }}
            className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              isSelected
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Traspaso interbancario"
          >
            Traspaso
          </button>
        )}
      </div>
    </div>
  );
}
