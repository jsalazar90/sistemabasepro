import { describe, it, expect } from 'vitest';

/**
 * Suite de Pruebas Unitarias de Cálculos Fiscales Venezolanos (SENIAT & NIIF)
 * Providencia SNAT/2015/0049 (Retenciones IVA)
 * Decreto 1808 (Retenciones ISLR)
 * Ley de Impuesto a las Grandes Transacciones Financieras (IGTF 3%)
 */

export function calculateInvoiceTaxes(params: {
  subtotal: number;
  exento: number;
  alicuotaIva?: number; // default 0.16
  applyRetIva?: boolean;
  retIvaPercent?: number; // 75 o 100
  applyRetIslr?: boolean;
  retIslrPercent?: number; // 2 o 5
  applyIgtf?: boolean;
  igtfPercent?: number; // 3
  exchangeRate?: number;
}) {
  const alicuota = params.alicuotaIva ?? 0.16;
  const baseImponible = Math.max(0, params.subtotal - params.exento);
  const iva = Number((baseImponible * alicuota).toFixed(2));
  
  const retIva = params.applyRetIva 
    ? Number((iva * ((params.retIvaPercent ?? 75) / 100)).toFixed(2))
    : 0;

  const retIslr = params.applyRetIslr
    ? Number((baseImponible * ((params.retIslrPercent ?? 2) / 100)).toFixed(2))
    : 0;

  const subtotalConIva = params.subtotal + iva;
  
  const igtf = params.applyIgtf
    ? Number((subtotalConIva * ((params.igtfPercent ?? 3) / 100)).toFixed(2))
    : 0;

  const total = Number((subtotalConIva + igtf).toFixed(2));
  const netoCobrar = Number((total - retIva - retIslr).toFixed(2));

  const rate = params.exchangeRate ?? 1;
  const totalBs = Number((total * rate).toFixed(2));
  const netoCobrarBs = Number((netoCobrar * rate).toFixed(2));

  return {
    baseImponible,
    iva,
    retIva,
    retIslr,
    igtf,
    total,
    netoCobrar,
    totalBs,
    netoCobrarBs
  };
}

describe('Cálculos Fiscales y Tributarios SENIAT (IVA, ISLR, IGTF)', () => {
  it('Debe calcular IVA 16% estándar y total de factura sin retenciones', () => {
    const res = calculateInvoiceTaxes({
      subtotal: 1000,
      exento: 0
    });

    expect(res.baseImponible).toBe(1000);
    expect(res.iva).toBe(160);
    expect(res.total).toBe(1160);
    expect(res.netoCobrar).toBe(1160);
  });

  it('Debe calcular correctamente ítems mixtos (Gravados y Exentos de IVA)', () => {
    const res = calculateInvoiceTaxes({
      subtotal: 1500,
      exento: 500 // 1000 gravados + 500 exentos
    });

    expect(res.baseImponible).toBe(1000);
    expect(res.iva).toBe(160);
    expect(res.total).toBe(1660);
    expect(res.netoCobrar).toBe(1660);
  });

  it('Debe aplicar Retención de IVA al 75% según Providencia SNAT/2015/0049', () => {
    const res = calculateInvoiceTaxes({
      subtotal: 1000,
      exento: 0,
      applyRetIva: true,
      retIvaPercent: 75
    });

    expect(res.iva).toBe(160);
    expect(res.retIva).toBe(120); // 75% de 160 = 120
    expect(res.total).toBe(1160);
    expect(res.netoCobrar).toBe(1040); // 1160 - 120 = 1040
  });

  it('Debe aplicar Retención de IVA al 100% a Contribuyentes Especiales sin RIF actualizado', () => {
    const res = calculateInvoiceTaxes({
      subtotal: 1000,
      exento: 0,
      applyRetIva: true,
      retIvaPercent: 100
    });

    expect(res.iva).toBe(160);
    expect(res.retIva).toBe(160);
    expect(res.netoCobrar).toBe(1000);
  });

  it('Debe retener simultáneamente IVA (75%) e ISLR (2% Servicios)', () => {
    const res = calculateInvoiceTaxes({
      subtotal: 1000,
      exento: 0,
      applyRetIva: true,
      retIvaPercent: 75,
      applyRetIslr: true,
      retIslrPercent: 2
    });

    expect(res.iva).toBe(160);
    expect(res.retIva).toBe(120);
    expect(res.retIslr).toBe(20); // 2% de base 1000 = 20
    expect(res.total).toBe(1160);
    expect(res.netoCobrar).toBe(1020); // 1160 - 120 - 20 = 1020
  });

  it('Debe calcular IGTF al 3% sobre el total en divisas', () => {
    const res = calculateInvoiceTaxes({
      subtotal: 1000,
      exento: 0,
      applyIgtf: true,
      igtfPercent: 3
    });

    // Total con IVA = 1160. IGTF 3% = 34.80. Total con IGTF = 1194.80
    expect(res.igtf).toBe(34.80);
    expect(res.total).toBe(1194.80);
    expect(res.netoCobrar).toBe(1194.80);
  });

  it('Debe convertir con precisión decimal dual a Bolívares usando la tasa BCV', () => {
    const tasaBCV = 36.54;
    const res = calculateInvoiceTaxes({
      subtotal: 100,
      exento: 0,
      exchangeRate: tasaBCV
    });

    expect(res.total).toBe(116);
    expect(res.totalBs).toBe(Number((116 * tasaBCV).toFixed(2))); // 4238.64
  });
});
