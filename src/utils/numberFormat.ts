/**
 * Utilidades de formateo numérico estándar profesional (Gálac / Saint)
 * Formato: punto (.) para separador de miles y coma (,) para separador de decimales.
 * Ejemplo: 1.234.567,89
 */

export const parseMoney = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  const str = String(val).trim();
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      const clean = str.replace(/\./g, '').replace(',', '.');
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? 0 : parsed;
    } else {
      const clean = str.replace(/,/g, '');
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? 0 : parsed;
    }
  }
  if (str.includes(',')) {
    const clean = str.replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

export const formatNumber = (
  num: number | string | null | undefined,
  decimals: number = 2
): string => {
  if (num === null || num === undefined || num === '') return '0,00';
  
  const val = parseMoney(num);
  if (isNaN(val)) return '0,00';

  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const fixed = absVal.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');

  // Insertar puntos como separador de miles
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const sign = isNegative ? '-' : '';
  return decimals > 0 ? `${sign}${withThousands},${decPart}` : `${sign}${withThousands}`;
};

export const formatMoney = (
  amount: number | string | null | undefined,
  currencySymbol?: string,
  decimals: number = 2
): string => {
  const formatted = formatNumber(amount, decimals);
  if (!currencySymbol) return formatted;
  return `${currencySymbol} ${formatted}`;
};

/**
 * Formatea un correlativo numérico asegurando ceros a la izquierda (ej: '000001').
 * Respeta la longitud si el usuario ingresó más dígitos (ej. '00000001').
 */
export const formatCorrelativo = (
  val: string | number | null | undefined,
  defaultDigits: number = 6
): string => {
  if (val === null || val === undefined || val === '') {
    return '1'.padStart(defaultDigits, '0');
  }
  const str = String(val).trim();
  if (/^\d+$/.test(str)) {
    const minDigits = Math.max(str.length, defaultDigits);
    return str.padStart(minDigits, '0');
  }
  return str;
};

/**
 * Une un prefijo opcional y un correlativo numérico.
 * - Si el prefijo está vacío, devuelve únicamente el número formateado (ej. '000001').
 * - Si el prefijo tiene valor (ej. 'FAC' o 'FAC-'), asegura que no se dupliquen guiones (ej. 'FAC-000001').
 */
export const formatDocumentNumber = (
  prefix: string | null | undefined,
  correlativo: string | number | null | undefined,
  defaultDigits: number = 6
): string => {
  const numStr = formatCorrelativo(correlativo, defaultDigits);
  const cleanPrefix = (prefix ?? '').trim();
  if (!cleanPrefix) {
    return numStr;
  }
  if (cleanPrefix.endsWith('-') || cleanPrefix.endsWith('_') || cleanPrefix.endsWith('/')) {
    return `${cleanPrefix}${numStr}`;
  }
  return `${cleanPrefix}-${numStr}`;
};

/**
 * Calcula el siguiente número correlativo incrementado en 1,
 * preservando la cantidad de ceros a la izquierda según el formato actual.
 */
export const getNextCorrelativo = (
  currentVal: string | number | null | undefined,
  defaultDigits: number = 6
): string => {
  const str = String(currentVal || '1').trim();
  const numPart = parseInt(str, 10) || 1;
  const padLen = Math.max(str.length, defaultDigits);
  return String(numPart + 1).padStart(padLen, '0');
};
