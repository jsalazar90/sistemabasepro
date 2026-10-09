import React from 'react';

export interface BimonetaryValueProps {
  amountUSD: number;
  amountBs: number;
  primaryCurrency?: 'USD' | 'VES';
  variant?: 'neutral' | 'success' | 'warning' | 'danger';
  align?: 'left' | 'right' | 'center';
  showZeroSecondary?: boolean;
}

export default function BimonetaryValue({
  amountUSD = 0,
  amountBs = 0,
  primaryCurrency = 'USD',
  variant = 'neutral',
  align = 'right',
  showZeroSecondary = false,
}: BimonetaryValueProps) {
  const isUSDPrimary = primaryCurrency === 'USD';
  const primaryAmount = isUSDPrimary ? amountUSD : amountBs;
  const secondaryAmount = isUSDPrimary ? amountBs : amountUSD;

  const formattedPrimary = isUSDPrimary
    ? `$ ${primaryAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `Bs. ${primaryAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formattedSecondary = isUSDPrimary
    ? `Bs. ${secondaryAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$ ${secondaryAmount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const variantStyles = {
    neutral: 'text-slate-900',
    success: 'text-emerald-700',
    warning: 'text-amber-700 font-extrabold',
    danger: 'text-rose-700'
  };

  const alignStyles = {
    left: 'text-left items-start',
    right: 'text-right items-end',
    center: 'text-center items-center'
  };

  const shouldShowSecondary = showZeroSecondary || Math.abs(secondaryAmount) > 0.009;

  return (
    <div className={`flex flex-col ${alignStyles[align]}`}>
      <span className={`font-mono text-xs sm:text-sm font-bold tabular-nums tracking-tight ${variantStyles[variant]}`}>
        {formattedPrimary}
      </span>
      {shouldShowSecondary && (
        <span className="font-mono text-[10.5px] font-medium tabular-nums text-slate-400 mt-0.5 leading-none">
          {formattedSecondary}
        </span>
      )}
    </div>
  );
}
