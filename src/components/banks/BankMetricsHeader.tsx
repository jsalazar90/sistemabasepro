import React from 'react';
import { Landmark, DollarSign, Wallet, TrendingUp, Sparkles } from 'lucide-react';
import { formatMoney } from '../../utils/numberFormat';

export interface BankMetricsHeaderProps {
  bancos: any[];
  tasaBcv?: number;
}

export default function BankMetricsHeader({
  bancos = [],
  tasaBcv = 36.5
}: BankMetricsHeaderProps) {
  const totalUSD = bancos
    .filter((b) => (b.moneda || 'USD').toUpperCase() === 'USD')
    .reduce((sum, b) => sum + Number(b.saldo_actual ?? b.saldoActual ?? 0), 0);

  const totalVES = bancos
    .filter((b) => (b.moneda || 'USD').toUpperCase() === 'VES')
    .reduce((sum, b) => sum + Number(b.saldo_actual ?? b.saldoActual ?? 0), 0);

  const totalConsolidadoUSD = totalUSD + (tasaBcv > 0 ? totalVES / tasaBcv : 0);

  const totalCuentas = bancos.length;
  const totalCajas = bancos.filter((b) => b.es_caja || (b.tipo || '').toLowerCase().includes('caja')).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Liquidez Total Consolidada (USD) */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-5 rounded-2xl border border-indigo-700/40 shadow-sm relative overflow-hidden">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              Liquidez Consolidada
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono mt-1 text-white tracking-tight">
              $ {formatMoney(totalConsolidadoUSD)}
            </div>
          </div>
          <div className="p-2.5 bg-white/10 rounded-xl text-indigo-300">
            <Wallet size={20} />
          </div>
        </div>
        <div className="mt-3 text-xs text-indigo-200/80 flex items-center gap-1.5">
          <span>Tasa BCV: </span>
          <span className="font-mono font-bold text-white">Bs. {formatMoney(tasaBcv)} / $</span>
        </div>
      </div>

      {/* 2. Cuentas en Dólares ($ USD) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Disponible USD ($)
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono mt-1 text-emerald-600 tracking-tight">
              $ {formatMoney(totalUSD)}
            </div>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign size={20} />
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500 font-bold">
          Cuentas custodia y divisas en efectivo
        </div>
      </div>

      {/* 3. Cuentas en Bolívares (Bs. VES) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Disponible Bolívares (Bs.)
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono mt-1 text-blue-600 tracking-tight">
              Bs. {formatMoney(totalVES)}
            </div>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <TrendingUp size={20} />
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500 font-bold">
          Equivalente a: <span className="font-mono text-slate-700">${formatMoney(tasaBcv > 0 ? totalVES / tasaBcv : 0)} USD</span>
        </div>
      </div>

      {/* 4. Entidades y Cajas Operativas */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Instrumentos Activos
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono mt-1 text-slate-900 tracking-tight">
              {totalCuentas} <span className="text-sm font-bold text-slate-400">cuentas</span>
            </div>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Landmark size={20} />
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500 font-bold">
          {totalCajas} caja(s) de efectivo operativa(s)
        </div>
      </div>
    </div>
  );
}
