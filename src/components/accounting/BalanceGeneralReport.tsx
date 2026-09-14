import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { 
  ArrowLeft, 
  Printer, 
  FileSpreadsheet, 
  Calendar, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  ZoomIn, 
  ZoomOut, 
  FileText, 
  Info, 
  X,
  ShieldCheck
} from 'lucide-react';
import { SAMPLE_FULL_BALANCE_CUENTAS } from '../../services/db';

export interface CuentaContableItem {
  id: string | number;
  codigo: string;
  nombre: string;
  tipo: 'Grupo' | 'Movimiento' | string;
  naturaleza?: 'Deudora' | 'Acreedora' | string;
  nivel?: number;
  saldo?: number;
  esCalculado?: boolean;
}

export interface BalanceGeneralReportProps {
  comprobantes: any[];
  cuentasContables: any[];
  empresa?: any;
  configContable?: any;
  endDate: string;
  setEndDate?: (date: string) => void;
  startDate?: string;
  estadoResultados?: {
    utilidadNeta: number;
    [key: string]: any;
  };
  onBack?: () => void;
  onPrint?: (elementId: string, title: string, orientation?: 'portrait' | 'landscape') => void;
}

const formatoES = (num: number | string) => {
  const n = typeof num === 'string' ? parseFloat(num) || 0 : num || 0;
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

// Formato contable estándar: sobregiros (< 0) en rojo y entre paréntesis sin signo menos
const renderMontoContable = (num: number | string, extraClass = '') => {
  const n = typeof num === 'string' ? parseFloat(num) || 0 : num || 0;
  if (n < -0.009) {
    return <span className={`text-rose-600 font-bold font-mono ${extraClass}`}>(${formatoES(Math.abs(n))})</span>;
  }
  return <span className={`font-bold font-mono ${extraClass}`}>${formatoES(n)}</span>;
};

interface PrintBlock {
  id: string;
  type: 
    | 'section_title' 
    | 'group_bar' 
    | 'subtotal_bar'
    | 'account_row' 
    | 'total_bar' 
    | 'closing_total' 
    | 'equation_banner' 
    | 'signatures_block';
  height: number;
  data?: any;
}

export default function BalanceGeneralReport({
  comprobantes = [],
  cuentasContables = [],
  empresa = {},
  configContable = {},
  endDate,
  setEndDate,
  startDate,
  estadoResultados = { utilidadNeta: 0 },
  onBack,
}: BalanceGeneralReportProps) {
  // Configuración directa de la hoja
  const [maxDepthLevel, setMaxDepthLevel] = useState<number>(5);
  const [hideZero, setHideZero] = useState<boolean>(true);
  const [showVerticalAnalysis, setShowVerticalAnalysis] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(100);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAuditAccount, setSelectedAuditAccount] = useState<CuentaContableItem | null>(null);

  // Helper para verificar relación padre-hijo estricto
  const isDescendant = (childCode: string, parentCode: string) => {
    if (!childCode || !parentCode) return false;
    if (childCode === parentCode) return true;
    return childCode.startsWith(parentCode + '.');
  };

  const isActivoCorriente = (a: any) => {
    const cod = String(a.codigo || '').trim();
    const nom = (a.nombre || '').toLowerCase();
    if (cod.startsWith('1.2') || cod.startsWith('12') || cod.startsWith('1-2')) return false;
    if (nom.includes('no corriente') || nom.includes('no-corriente') || nom.includes('largo plazo') || nom.includes('fijo') || nom.includes('intangible')) return false;
    if (cod.startsWith('1.1') || cod.startsWith('11') || cod.startsWith('1-1')) return true;
    return nom.includes('corriente') || nom.includes('circulante') || nom.includes('disponible') || nom.includes('exigible') || nom.includes('realizable');
  };

  const isPasivoCorriente = (p: any) => {
    const cod = String(p.codigo || '').trim();
    const nom = (p.nombre || '').toLowerCase();
    if (cod.startsWith('2.2') || cod.startsWith('22') || cod.startsWith('2-2')) return false;
    if (nom.includes('no corriente') || nom.includes('no-corriente') || nom.includes('largo plazo') || nom.includes('hipoteca')) return false;
    if (cod.startsWith('2.1') || cod.startsWith('21') || cod.startsWith('2-1')) return true;
    return nom.includes('corriente') || nom.includes('corto plazo') || nom.includes('circulante');
  };

  // Cálculo de saldos contables y rollup en cascada
  // Cálculo de saldos contables y rollup en cascada
  const balanceData = useMemo(() => {
    const activeCuentas = (cuentasContables && cuentasContables.length > 0)
      ? cuentasContables
      : SAMPLE_FULL_BALANCE_CUENTAS;

    const isContabilizado = (c: any) => {
      if (!c.estado) return true;
      const e = String(c.estado).toLowerCase().trim();
      return e === 'contabilizado' || e === 'aprobado' || e === 'registrado';
    };

    const pastComprobantes = comprobantes.filter(
      c => isContabilizado(c) && (!c.fecha || c.fecha.split('T')[0] <= endDate)
    );

    const saldosCuentas: Record<string, number> = {};
    const ledgerByAccount: Record<string, any[]> = {};

    activeCuentas.forEach(c => {
      if (c.saldoActual !== undefined || c.saldo !== undefined) {
        saldosCuentas[c.id] = Number(c.saldoActual ?? c.saldo ?? 0);
      }
    });

    pastComprobantes.forEach(comp => {
      (comp.lineas || []).forEach((linea: any) => {
        const cId = String(linea.cuentaId || linea.cuenta_id || '').trim();
        if (!cId) return;
        const cuenta = activeCuentas.find(item => 
          String(item.id) === cId || 
          String(item.codigo) === cId ||
          (item.codigo && item.codigo.replace(/\./g, '') === cId.replace(/\./g, ''))
        );
        if (!cuenta) return;

        const debe = Number(linea.debe) || 0;
        const haber = Number(linea.haber) || 0;
        const cod = cuenta.codigo || '';
        const nat = cuenta.naturaleza || (cod.startsWith('1') || cod.startsWith('5') || cod.startsWith('6') ? 'Deudora' : 'Acreedora');

        if (saldosCuentas[cuenta.id] === undefined) {
          saldosCuentas[cuenta.id] = 0;
        }
        if (!ledgerByAccount[cuenta.id]) {
          ledgerByAccount[cuenta.id] = [];
        }

        const montoNeto = nat === 'Deudora' ? debe - haber : haber - debe;
        saldosCuentas[cuenta.id] += montoNeto;

        ledgerByAccount[cuenta.id].push({
          comprobanteId: comp.id,
          comprobanteNumero: comp.numero || comp.correlativo || 'S/N',
          fecha: comp.fecha ? comp.fecha.split('T')[0] : '',
          concepto: linea.descripcion || comp.descripcion || comp.concepto || 'Movimiento contable',
          debe,
          haber,
          saldoParcial: saldosCuentas[cuenta.id]
        });
      });
    });

    const isLeafAccount = (c: any) => {
      if (c.tipo === 'Movimiento' || c.isLeaf === true) return true;
      const hasChildren = activeCuentas.some(other => other.id !== c.id && isDescendant(other.codigo, c.codigo));
      return !hasChildren;
    };

    const movementAccounts = activeCuentas.filter(isLeafAccount);
    const computedSaldos: Record<string, number> = {};

    activeCuentas.forEach(cuenta => {
      if (isLeafAccount(cuenta)) {
        computedSaldos[cuenta.id] = saldosCuentas[cuenta.id] || 0;
      } else {
        const sumHijas = movementAccounts.reduce((acc, mov) => {
          if (isDescendant(mov.codigo, cuenta.codigo) && mov.id !== cuenta.id) {
            return acc + (saldosCuentas[mov.id] || 0);
          }
          return acc;
        }, 0);
        computedSaldos[cuenta.id] = sumHijas !== 0 ? sumHijas : (saldosCuentas[cuenta.id] || 0);
      }
    });

    const rawActivos: (CuentaContableItem & { level: number; isLeaf?: boolean })[] = [];
    const rawPasivos: (CuentaContableItem & { level: number; isLeaf?: boolean })[] = [];
    const rawPatrimonio: (CuentaContableItem & { level: number; isLeaf?: boolean })[] = [];

    activeCuentas.forEach(c => {
      const cod = c.codigo || '';
      const saldo = computedSaldos[c.id] || 0;
      const level = c.nivel || (cod.split('.').length);
      const isLeaf = isLeafAccount(c);

      const record: CuentaContableItem & { level: number; isLeaf?: boolean } = {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: c.tipo,
        naturaleza: c.naturaleza,
        nivel: level,
        saldo: saldo,
        level: level,
        isLeaf: isLeaf
      };

      if (cod.startsWith('1')) rawActivos.push(record);
      else if (cod.startsWith('2')) rawPasivos.push(record);
      else if (cod.startsWith('3')) rawPatrimonio.push(record);
    });

    rawActivos.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
    rawPasivos.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
    rawPatrimonio.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

    let totalActivosCalc = rawActivos
      .filter(a => a.isLeaf)
      .reduce((sum, item) => sum + (item.saldo || 0), 0);
    if (totalActivosCalc === 0 && rawActivos.length > 0) {
      const r1 = rawActivos.find(a => a.codigo === '1');
      if (r1 && r1.saldo > 0) totalActivosCalc = r1.saldo;
    }

    let totalPasivosCalc = rawPasivos
      .filter(p => p.isLeaf)
      .reduce((sum, item) => sum + (item.saldo || 0), 0);
    if (totalPasivosCalc === 0 && rawPasivos.length > 0) {
      const r2 = rawPasivos.find(p => p.codigo === '2');
      if (r2 && r2.saldo > 0) totalPasivosCalc = r2.saldo;
    }

    let totalPatrimonioCalc = rawPatrimonio
      .filter(p => p.isLeaf)
      .reduce((sum, item) => sum + (item.saldo || 0), 0);
    if (totalPatrimonioCalc === 0 && rawPatrimonio.length > 0) {
      const r3 = rawPatrimonio.find(p => p.codigo === '3');
      if (r3 && r3.saldo > 0) totalPatrimonioCalc = r3.saldo;
    }

    const isUsingSample = activeCuentas === SAMPLE_FULL_BALANCE_CUENTAS;
    if (!isUsingSample) {
      let utilidadNetaPAndL = estadoResultados?.utilidadNeta || 0;
      if (Math.abs(utilidadNetaPAndL) < 0.009 && activeCuentas.length > 0 && pastComprobantes.length > 0) {
        let ing = 0;
        let egr = 0;
        pastComprobantes.forEach(comp => {
          (comp.lineas || []).forEach((linea: any) => {
            const cId = String(linea.cuentaId || linea.cuenta_id || '').trim();
            if (!cId) return;
            const cuenta = activeCuentas.find(item => 
              String(item.id) === cId || 
              String(item.codigo) === cId ||
              (item.codigo && item.codigo.replace(/\./g, '') === cId.replace(/\./g, ''))
            );
            if (!cuenta) return;
            const first = cuenta.codigo?.charAt(0);
            const debe = Number(linea.debe) || 0;
            const haber = Number(linea.haber) || 0;
            if (first === '4' || first === '7') {
              ing += (haber - debe);
            } else if (first >= '5' && first <= '9') {
              egr += (debe - haber);
            }
          });
        });
        utilidadNetaPAndL = ing - egr;
      }

      if (Math.abs(utilidadNetaPAndL) > 0.009) {
        const resultadoEjercicioItem: CuentaContableItem & { level: number; isLeaf?: boolean } = {
          id: 'UTILIDAD_TEMP',
          codigo: '3.9.9.99',
          nombre: 'Resultado del Ejercicio Actual (Utilidad / Pérdida Neta P&L)',
          tipo: 'Movimiento',
          naturaleza: 'Acreedora',
          nivel: 3,
          level: 3,
          saldo: utilidadNetaPAndL,
          esCalculado: true,
          isLeaf: true
        };
        rawPatrimonio.push(resultadoEjercicioItem);
        rawPatrimonio.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
        totalPatrimonioCalc += utilidadNetaPAndL;
      }
    }

    let totalActivoCorriente = rawActivos
      .filter(a => (a.isLeaf ?? a.tipo === 'Movimiento') && isActivoCorriente(a))
      .reduce((sum, item) => sum + (item.saldo || 0), 0);
    if (totalActivoCorriente === 0 && totalActivosCalc > 0) {
      const rootCte = rawActivos.find(a => a.codigo.startsWith('1.1') && (a.level ?? 1) <= 2);
      if (rootCte && rootCte.saldo > 0) totalActivoCorriente = rootCte.saldo;
      else totalActivoCorriente = totalActivosCalc;
    }
    const totalActivoNoCorriente = Math.max(0, totalActivosCalc - totalActivoCorriente);

    let totalPasivoCorriente = rawPasivos
      .filter(p => (p.isLeaf ?? p.tipo === 'Movimiento') && isPasivoCorriente(p))
      .reduce((sum, item) => sum + (item.saldo || 0), 0);
    if (totalPasivoCorriente === 0 && totalPasivosCalc > 0) {
      const rootPasCte = rawPasivos.find(p => p.codigo.startsWith('2.1') && (p.level ?? 1) <= 2);
      if (rootPasCte && rootPasCte.saldo > 0) totalPasivoCorriente = rootPasCte.saldo;
      else totalPasivoCorriente = totalPasivosCalc;
    }
    const totalPasivoNoCorriente = Math.max(0, totalPasivosCalc - totalPasivoCorriente);

    const totalPasivoMasPatrimonio = totalPasivosCalc + totalPatrimonioCalc;
    const descuadre = Math.abs(totalActivosCalc - totalPasivoMasPatrimonio);

    return {
      activos: rawActivos,
      pasivos: rawPasivos,
      patrimonio: rawPatrimonio,
      totalActivos: totalActivosCalc,
      totalActivoCorriente,
      totalActivoNoCorriente,
      totalPasivos: totalPasivosCalc,
      totalPasivoCorriente,
      totalPasivoNoCorriente,
      totalPatrimonio: totalPatrimonioCalc,
      totalPasivoMasPatrimonio,
      descuadre,
      ledgerByAccount
    };
  }, [comprobantes, cuentasContables, endDate, estadoResultados]);

  // Filtrado de cuentas
  const filterAccounts = (accounts: (CuentaContableItem & { level: number })[]) => {
    return accounts.filter(acc => {
      if ((acc.level ?? 1) > maxDepthLevel) return false;
      if (hideZero && Math.abs(acc.saldo || 0) < 0.009) return false;
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        return acc.codigo.toLowerCase().includes(query) || acc.nombre.toLowerCase().includes(query);
      }
      return true;
    });
  };

  const noRoot = (list: (CuentaContableItem & { level: number })[]) => {
    if (maxDepthLevel === 1) return list;
    if (maxDepthLevel === 2) {
      return list.filter(item => item.codigo !== '1' && item.codigo !== '2' && item.codigo !== '3');
    }
    return list.filter(item => 
      item.codigo !== '1' && item.codigo !== '2' && item.codigo !== '3' &&
      item.codigo !== '1.1' && item.codigo !== '1.2' &&
      item.codigo !== '2.1' && item.codigo !== '2.2' &&
      item.codigo !== '11' && item.codigo !== '12' &&
      item.codigo !== '21' && item.codigo !== '22'
    );
  };

  const filteredActivos = useMemo(() => noRoot(filterAccounts(balanceData.activos)), [balanceData.activos, hideZero, searchQuery, maxDepthLevel]);
  const filteredPasivos = useMemo(() => noRoot(filterAccounts(balanceData.pasivos)), [balanceData.pasivos, hideZero, searchQuery, maxDepthLevel]);
  const filteredPatrimonio = useMemo(() => noRoot(filterAccounts(balanceData.patrimonio)), [balanceData.patrimonio, hideZero, searchQuery, maxDepthLevel]);

  const allFilteredVisible = useMemo(() => [
    ...filteredActivos,
    ...filteredPasivos,
    ...filteredPatrimonio
  ], [filteredActivos, filteredPasivos, filteredPatrimonio]);

  const isLeafInCurrentView = (item: any) => {
    const hasChildInView = allFilteredVisible.some(other => 
      String(other.id) !== String(item.id) && isDescendant(other.codigo, item.codigo)
    );
    return !hasChildInView;
  };

  const activosCorrientesList = useMemo(() => {
    const list = filteredActivos.filter(isActivoCorriente);
    if (list.length === 0 && filteredActivos.length > 0 && !filteredActivos.some(a => !isActivoCorriente(a))) {
      return filteredActivos;
    }
    return list;
  }, [filteredActivos]);

  const activosNoCorrientesList = useMemo(() => {
    return filteredActivos.filter(a => !isActivoCorriente(a));
  }, [filteredActivos]);

  const pasivosCorrientesList = useMemo(() => {
    const list = filteredPasivos.filter(isPasivoCorriente);
    if (list.length === 0 && filteredPasivos.length > 0 && !filteredPasivos.some(p => !isPasivoCorriente(p))) {
      return filteredPasivos;
    }
    return list;
  }, [filteredPasivos]);

  const pasivosNoCorrientesList = useMemo(() => {
    return filteredPasivos.filter(p => !isPasivoCorriente(p));
  }, [filteredPasivos]);

  // ==========================================================
  // SEGMENTACIÓN Y PAGINACIÓN EN HOJAS CARTA EXACTAS
  // ==========================================================
  const paginatedSheets = useMemo(() => {
    const blocks: PrintBlock[] = [];

    // 1. ACTIVOS
    blocks.push({ id: 'sec-activos', type: 'section_title', height: 36, data: { title: '1. ACTIVOS' } });

    if (activosCorrientesList.length > 0) {
      if (maxDepthLevel > 2) {
        blocks.push({
          id: 'sub-act-corriente',
          type: 'group_bar',
          height: 30,
          data: { title: '1.1 ACTIVO CORRIENTE (Circulante / Disponible / Exigible)' }
        });
      }
      activosCorrientesList.forEach(item => {
        const isMov = isLeafInCurrentView(item);
        blocks.push({ 
          id: `item-${item.id}`, 
          type: 'account_row', 
          height: 24, 
          data: { 
            item, 
            totalBase: balanceData.totalActivos,
            isLeafInView: isMov
          } 
        });
      });
      if (maxDepthLevel > 2) {
        blocks.push({
          id: 'subtot-act-corriente',
          type: 'subtotal_bar',
          height: 30,
          data: { title: 'TOTAL ACTIVO CORRIENTE', total: balanceData.totalActivoCorriente }
        });
      }
    }

    if (activosNoCorrientesList.length > 0) {
      if (maxDepthLevel > 2) {
        blocks.push({
          id: 'sub-act-nocorriente',
          type: 'group_bar',
          height: 30,
          data: { title: '1.2 ACTIVO NO CORRIENTE (Propiedad, Planta y Equipos)' }
        });
      }
      activosNoCorrientesList.forEach(item => {
        const isMov = isLeafInCurrentView(item);
        blocks.push({ 
          id: `item-${item.id}`, 
          type: 'account_row', 
          height: 24, 
          data: { 
            item, 
            totalBase: balanceData.totalActivos,
            isLeafInView: isMov
          } 
        });
      });
      if (maxDepthLevel > 2) {
        blocks.push({
          id: 'subtot-act-nocorriente',
          type: 'subtotal_bar',
          height: 30,
          data: { title: 'TOTAL ACTIVO NO CORRIENTE', total: balanceData.totalActivoNoCorriente }
        });
      }
    }

    // Total Activos
    blocks.push({
      id: 'tot-activos',
      type: 'total_bar',
      height: 38,
      data: { title: 'TOTAL DE ACTIVOS', total: balanceData.totalActivos, colorClass: 'bg-indigo-50/70 text-indigo-950 border-indigo-900' }
    });

    // 2. PASIVOS
    blocks.push({ id: 'sec-pasivos', type: 'section_title', height: 36, data: { title: '2. PASIVOS' } });

    if (pasivosCorrientesList.length > 0) {
      if (maxDepthLevel > 2) {
        blocks.push({
          id: 'sub-pas-corriente',
          type: 'group_bar',
          height: 30,
          data: { title: '2.1 PASIVO CORRIENTE (Corto Plazo / Operativo)' }
        });
      }
      pasivosCorrientesList.forEach(item => {
        const isMov = isLeafInCurrentView(item);
        blocks.push({ 
          id: `item-${item.id}`, 
          type: 'account_row', 
          height: 24, 
          data: { 
            item, 
            totalBase: balanceData.totalPasivoMasPatrimonio,
            isLeafInView: isMov
          } 
        });
      });
      if (maxDepthLevel > 2) {
        blocks.push({
          id: 'subtot-pas-corriente',
          type: 'subtotal_bar',
          height: 30,
          data: { title: 'TOTAL PASIVO CORRIENTE', total: balanceData.totalPasivoCorriente }
        });
      }
    }

    if (pasivosNoCorrientesList.length > 0) {
      if (maxDepthLevel > 2) {
        blocks.push({
          id: 'sub-pas-nocorriente',
          type: 'group_bar',
          height: 30,
          data: { title: '2.2 PASIVO NO CORRIENTE (Largo Plazo)' }
        });
      }
      pasivosNoCorrientesList.forEach(item => {
        const isMov = isLeafInCurrentView(item);
        blocks.push({ 
          id: `item-${item.id}`, 
          type: 'account_row', 
          height: 24, 
          data: { 
            item, 
            totalBase: balanceData.totalPasivoMasPatrimonio,
            isLeafInView: isMov
          } 
        });
      });
      if (maxDepthLevel > 2) {
        blocks.push({
          id: 'subtot-pas-nocorriente',
          type: 'subtotal_bar',
          height: 30,
          data: { title: 'TOTAL PASIVO NO CORRIENTE', total: balanceData.totalPasivoNoCorriente }
        });
      }
    }

    // Total Pasivos
    blocks.push({
      id: 'tot-pasivos',
      type: 'total_bar',
      height: 38,
      data: { title: 'TOTAL DE PASIVOS', total: balanceData.totalPasivos, colorClass: 'bg-slate-50 text-slate-900 border-slate-700' }
    });

    // 3. PATRIMONIO NETO
    blocks.push({ id: 'sec-patrimonio', type: 'section_title', height: 36, data: { title: '3. PATRIMONIO NETO' } });
    filteredPatrimonio.forEach(item => {
      const isMov = isLeafInCurrentView(item);
      blocks.push({ 
        id: `item-${item.id}`, 
        type: 'account_row', 
        height: 24, 
        data: { 
          item, 
          totalBase: balanceData.totalPasivoMasPatrimonio,
          isLeafInView: isMov
        } 
      });
    });

    // Total Patrimonio
    blocks.push({
      id: 'tot-patrimonio',
      type: 'total_bar',
      height: 38,
      data: { title: 'TOTAL DE PATRIMONIO NETO', total: balanceData.totalPatrimonio, colorClass: 'bg-slate-50 text-slate-900 border-slate-700' }
    });

    // Total Pasivo + Patrimonio
    blocks.push({
      id: 'tot-pasivo-patrimonio',
      type: 'closing_total',
      height: 44,
      data: { title: 'TOTAL DE PASIVO + PATRIMONIO', total: balanceData.totalPasivoMasPatrimonio }
    });

    // Banner Ecuación Contable
    blocks.push({
      id: 'ban-ecuacion',
      type: 'equation_banner',
      height: 40,
      data: { descuadre: balanceData.descuadre }
    });

    // Firmas de Auditoría
    if (configContable?.reportShowSignatures !== false) {
      blocks.push({
        id: 'blk-firmas',
        type: 'signatures_block',
        height: 120,
        data: {
          preparador: configContable?.reportPreparadorName || 'Lic. María Delgado (Contador)',
          revisor: configContable?.reportRevisorName || 'Ing. Javier Espinoza (Auditor)',
          aprobador: configContable?.reportAprobadorName || 'Dirección Ejecutiva'
        }
      });
    }

    // Capacidades de hoja carta (215.9mm x 279.4mm)
    const PAGE_1_CAPACITY = 750;
    const PAGE_OTHER_CAPACITY = 850;

    const pages: PrintBlock[][] = [];
    let currentPage: PrintBlock[] = [];
    let currentHeight = 0;

    blocks.forEach((block) => {
      const currentCapacity = pages.length === 0 ? PAGE_1_CAPACITY : PAGE_OTHER_CAPACITY;

      if (currentHeight + block.height > currentCapacity && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [block];
        currentHeight = block.height;
      } else {
        currentPage.push(block);
        currentHeight += block.height;
      }
    });

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages;
  }, [
    activosCorrientesList, 
    activosNoCorrientesList, 
    pasivosCorrientesList, 
    pasivosNoCorrientesList, 
    filteredPatrimonio, 
    balanceData, 
    configContable,
    maxDepthLevel,
    allFilteredVisible
  ]);

  // Manejador de Impresión Directa (sin pantallas intermedias)
  const handleDirectPrint = () => {
    window.print();
  };

  // Exportación a Excel
  const handleExportExcel = () => {
    const rows: any[] = [];
    rows.push({ A: empresa?.nombre || 'HALLEY INSIGHTS S.A.' });
    rows.push({ A: `RIF/NIT: ${empresa?.rif || 'N/A'}` });
    rows.push({ A: 'ESTADO DE SITUACIÓN FINANCIERA (BALANCE GENERAL)' });
    rows.push({ A: `Fecha de Corte: al ${endDate} | Moneda: USD ($)` });
    rows.push({});

    rows.push({
      A: 'Código Contable',
      B: 'Nombre de Cuenta',
      C: 'Tipo',
      D: 'Nivel',
      E: 'Saldo ($)',
      F: '% Análisis Vertical'
    });

    const addSection = (title: string, list: any[], baseTotal: number) => {
      rows.push({ A: title, B: '', C: '', D: '', E: '', F: '' });
      list.forEach(item => {
        const indent = '  '.repeat(Math.max(0, (item.level || 1) - 1));
        const pct = baseTotal > 0 ? ((item.saldo || 0) / baseTotal) * 100 : 0;
        const isMov = isLeafInCurrentView(item);
        rows.push({
          A: item.codigo,
          B: `${indent}${item.nombre}`,
          C: item.tipo,
          D: item.level,
          E: isMov ? (item.saldo || 0) : '',
          F: isMov && baseTotal > 0 ? `${pct.toFixed(2)}%` : ''
        });
      });
      rows.push({});
    };

    addSection('1. ACTIVOS', filteredActivos, balanceData.totalActivos);
    rows.push({ A: 'TOTAL ACTIVOS', E: balanceData.totalActivos, F: '100.00%' });
    rows.push({});

    addSection('2. PASIVOS', filteredPasivos, balanceData.totalPasivoMasPatrimonio);
    rows.push({ A: 'TOTAL PASIVOS', E: balanceData.totalPasivos, F: `${((balanceData.totalPasivos / (balanceData.totalPasivoMasPatrimonio || 1)) * 100).toFixed(2)}%` });
    rows.push({});

    addSection('3. PATRIMONIO NETO', filteredPatrimonio, balanceData.totalPasivoMasPatrimonio);
    rows.push({ A: 'TOTAL PATRIMONIO NETO', E: balanceData.totalPatrimonio, F: `${((balanceData.totalPatrimonio / (balanceData.totalPasivoMasPatrimonio || 1)) * 100).toFixed(2)}%` });
    rows.push({});

    rows.push({ A: 'TOTAL PASIVO + PATRIMONIO', E: balanceData.totalPasivoMasPatrimonio, F: '100.00%' });
    rows.push({
      A: 'ESTADO DE LA ECUACIÓN',
      B: balanceData.descuadre === 0 ? 'CONCILIADO Y CUADRADO' : `DESCUADRE DE $${balanceData.descuadre.toFixed(2)}`
    });

    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
    ws['!cols'] = [{ wch: 18 }, { wch: 45 }, { wch: 14 }, { wch: 8 }, { wch: 18 }, { wch: 18 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Balance General');
    XLSX.writeFile(wb, `Balance_General_${endDate}.xlsx`);
  };

  // Renderizador de fila de cuenta en la hoja
  const renderSheetRow = (item: CuentaContableItem & { level: number }, totalBase: number, isLeafInView?: boolean) => {
    const isMov = isLeafInView !== undefined ? isLeafInView : (item.tipo === 'Movimiento' || (item as any).isLeaf === true);
    const isGroup = !isMov || item.tipo === 'Grupo';
    const isL1 = item.level === 1;
    const isL2 = item.level === 2;
    const pct = totalBase > 0 ? ((item.saldo || 0) / totalBase) * 100 : 0;

    let rowClass = 'group flex items-center justify-between py-1 px-2 border-b border-dashed border-slate-200 text-xs';
    if (isL1) {
      rowClass = 'flex items-center justify-between py-1.5 px-2 bg-slate-900 text-white font-black text-xs uppercase rounded-sm my-1';
    } else if (isL2) {
      rowClass = 'flex items-center justify-between py-1 px-2 bg-slate-100 text-slate-900 font-bold text-xs border-y border-slate-200 my-0.5';
    } else if (isGroup) {
      rowClass = 'flex items-center justify-between py-1 px-2 font-bold text-slate-800 text-xs border-b border-slate-100';
    }

    const paddingLeft = isL1 ? 'pl-1' : isL2 ? 'pl-3' : item.level === 3 ? 'pl-6' : 'pl-9';

    return (
      <div 
        key={item.id} 
        className={`${rowClass} cursor-pointer hover:bg-indigo-50/50 transition-colors`}
        onClick={() => {
          if (isMov) setSelectedAuditAccount(item);
        }}
        title={isMov ? "Clic para ver comprobantes y asientos que componen este saldo" : undefined}
      >
        <div className={`flex items-center gap-2 min-w-0 ${paddingLeft}`}>
          <span className={`font-mono text-[11px] shrink-0 ${isL1 ? 'text-slate-300' : 'text-slate-500 font-semibold'}`}>
            {item.codigo}
          </span>
          <span className={`truncate ${isL1 ? 'font-black' : isGroup ? 'font-bold' : 'font-medium text-slate-700'}`}>
            {item.nombre}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0 font-mono">
          {showVerticalAnalysis && isMov && (
            <span className={`text-[10px] w-12 text-right ${isL1 ? 'text-slate-300' : 'text-slate-400 font-normal'}`}>
              {pct.toFixed(1)}%
            </span>
          )}
          {isMov ? (
            <span className="text-right font-bold w-24">
              {renderMontoContable(item.saldo || 0)}
            </span>
          ) : (
            <span className="w-24 shrink-0" />
          )}
        </div>
      </div>
    );
  };

  // Renderizador del contenido de una hoja carta
  const renderSheetContent = (pageBlocks: PrintBlock[], pageIdx: number) => (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Cabecera Página 1 o Running Header */}
        {pageIdx === 0 ? (
          <div className="text-center pb-4 border-b-2 border-slate-900 mb-4 space-y-1">
            <h2 className="text-lg font-black text-slate-900 tracking-wider uppercase">
              {empresa?.nombre || 'HALLEY INSIGHTS S.A.'}
            </h2>
            <p className="text-[11px] font-mono text-slate-500 font-bold">
              RIF / NIT: {empresa?.rif || 'J-00000000-0'}
            </p>
            <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest pt-1">
              ESTADO DE SITUACIÓN FINANCIERA
            </h3>
            <p className="text-[11px] text-slate-600 font-bold uppercase">
              AL {endDate} • EXPRESADO EN DÓLARES ESTADOUNIDENSES (USD $)
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between pb-2 border-b border-slate-300 mb-3 text-[10px] text-slate-500 font-bold">
            <span>{empresa?.nombre || 'HALLEY INSIGHTS S.A.'} • ESTADO DE SITUACIÓN FINANCIERA</span>
            <span>Página {pageIdx + 1} de {paginatedSheets.length}</span>
          </div>
        )}

        {/* Bloques de la página */}
        <div className="space-y-0.5">
          {pageBlocks.map(block => {
            if (block.type === 'section_title') {
              return (
                <div key={block.id} className="pt-2 pb-0.5">
                  <div className="bg-slate-900 text-white font-black text-xs px-2.5 py-1 rounded-xs uppercase tracking-wide">
                    {block.data.title}
                  </div>
                </div>
              );
            }

            if (block.type === 'group_bar') {
              return (
                <div key={block.id} className="bg-slate-100/90 border-y border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-800 my-0.5">
                  <span>{block.data.title}</span>
                </div>
              );
            }

            if (block.type === 'subtotal_bar') {
              return (
                <div key={block.id} className="bg-slate-50 border-y border-slate-300 px-2.5 py-1.5 flex justify-between items-center text-xs font-bold text-slate-800 my-0.5">
                  <span>{block.data.title}</span>
                  <span className="font-mono">{renderMontoContable(block.data.total)}</span>
                </div>
              );
            }

            if (block.type === 'account_row') {
              return renderSheetRow(block.data.item, block.data.totalBase, block.data.isLeafInView);
            }

            if (block.type === 'total_bar') {
              return (
                <div key={block.id} className={`border-t border-b-2 py-1.5 px-2.5 flex justify-between items-center font-black text-xs my-1 ${block.data.colorClass}`}>
                  <span>{block.data.title}</span>
                  <span className="font-mono">{renderMontoContable(block.data.total)}</span>
                </div>
              );
            }

            if (block.type === 'closing_total') {
              return (
                <div key={block.id} className="border-t-2 border-b-4 border-slate-900 py-2 px-2.5 flex justify-between items-center font-black bg-emerald-50/80 text-emerald-950 text-sm my-1.5">
                  <span>{block.data.title}</span>
                  <span className="font-mono font-black">{renderMontoContable(block.data.total, 'text-emerald-700')}</span>
                </div>
              );
            }

            if (block.type === 'equation_banner') {
              const isOk = block.data.descuadre < 0.01;
              return (
                <div key={block.id} className={`p-2 rounded-lg border flex items-center justify-between text-xs font-bold my-1.5 ${
                  isOk ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <span>Ecuación Contable (Activo = Pasivo + Patrimonio):</span>
                  <span className="font-mono">
                    {isOk ? '✓ CONCILIADO Y CUADRADO EXACTO' : `⚠ DESCUADRE DE $${formatoES(block.data.descuadre)}`}
                  </span>
                </div>
              );
            }

            if (block.type === 'signatures_block') {
              return (
                <div key={block.id} className="pt-8 mt-4 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-[11px]">
                  <div>
                    <div className="border-t border-slate-400 w-4/5 mx-auto pt-1 mb-0.5" />
                    <strong className="block text-slate-900">{block.data.preparador}</strong>
                    <span className="text-[10px] text-slate-500">Preparado por / Contador</span>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 w-4/5 mx-auto pt-1 mb-0.5" />
                    <strong className="block text-slate-900">{block.data.revisor}</strong>
                    <span className="text-[10px] text-slate-500">Revisado por / Auditor</span>
                  </div>
                  <div>
                    <div className="border-t border-slate-400 w-4/5 mx-auto pt-1 mb-0.5" />
                    <strong className="block text-slate-900">{block.data.aprobador}</strong>
                    <span className="text-[10px] text-slate-500">Aprobado por / Gerencia</span>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* Pie de Página */}
      <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 select-none">
        <span>Halley Insights ERP • Emitido el {new Date().toLocaleDateString('es-ES')}</span>
        <span className="font-bold text-slate-600">Página {pageIdx + 1} de {paginatedSheets.length}</span>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen -m-4 md:-m-6 lg:-m-8">
      {/* ========================================================== */}
      {/* BARRA DE HERRAMIENTAS COMPACTA SUPERIOR                    */}
      {/* ========================================================== */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-3 sticky top-0 z-30 shadow-xs flex flex-wrap items-center justify-between gap-3 select-none no-print">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Volver a los Informes"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-black text-slate-900 tracking-tight uppercase">
                Estado de Situación Financiera
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                Carta (8.5 × 11")
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {empresa?.nombre || 'Halley Insights'} • {paginatedSheets.length} {paginatedSheets.length === 1 ? 'Página generada' : 'Páginas generadas'}
            </p>
          </div>
        </div>

        {/* Controles de Vista y Filtros */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Selector de Fecha */}
          {setEndDate && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-600">Al:</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-black text-slate-800 border-none outline-hidden p-0 cursor-pointer"
              />
            </div>
          )}

          {/* Selector de Nivel de Profundidad */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-600">Nivel:</span>
            <select
              value={maxDepthLevel}
              onChange={(e) => setMaxDepthLevel(Number(e.target.value))}
              className="bg-transparent text-xs font-black text-indigo-700 border-none outline-hidden cursor-pointer"
            >
              <option value={1}>Nivel 1 (Clases)</option>
              <option value={2}>Nivel 2 (Grupos)</option>
              <option value={3}>Nivel 3 (Rubros)</option>
              <option value={4}>Nivel 4 (Cuentas)</option>
              <option value={5}>Nivel 5 (Completo)</option>
            </select>
          </div>

          {/* Switch Ocultar $0 */}
          <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
            <input 
              type="checkbox"
              checked={hideZero}
              onChange={(e) => setHideZero(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span>Ocultar $0</span>
          </label>

          {/* Switch Análisis Vertical */}
          <label className="hidden sm:flex items-center gap-1.5 cursor-pointer font-bold text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
            <input 
              type="checkbox"
              checked={showVerticalAnalysis}
              onChange={(e) => setShowVerticalAnalysis(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span>% Vertical</span>
          </label>

          {/* Controles de Zoom */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
            <button 
              onClick={() => setZoom(Math.max(60, zoom - 10))}
              className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer"
              title="Alejar"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono font-bold text-[11px] text-slate-700 min-w-[40px] text-center">
              {zoom}%
            </span>
            <button 
              onClick={() => setZoom(Math.min(130, zoom + 10))}
              className="p-1 hover:bg-white rounded-lg text-slate-600 hover:text-slate-900 cursor-pointer"
              title="Acercar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Exportar Excel */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Excel</span>
          </button>

          {/* Botón Principal: Imprimir Hoja Carta Directo */}
          <button
            onClick={handleDirectPrint}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all shadow-sm cursor-pointer active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Hoja Carta (Ctrl + P)</span>
          </button>
        </div>
      </header>

      {/* ========================================================== */}
      {/* LIENZO DE IMPRESIÓN DIRECTO (ESCRITORIO WYSIWYG)           */}
      {/* ========================================================== */}
      <main className="flex-1 bg-slate-200/80 py-8 px-4 flex flex-col items-center overflow-x-auto no-print">
        <div 
          className="flex flex-col items-center gap-8 transition-transform duration-200 ease-out origin-top"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          {paginatedSheets.map((pageBlocks, pageIdx) => (
            <div 
              key={pageIdx}
              className="bg-white text-slate-900 rounded-xs shadow-2xl border border-slate-300 p-8 md:p-10 flex flex-col justify-between"
              style={{
                width: '215.9mm',
                minHeight: '279.4mm',
                boxSizing: 'border-box'
              }}
            >
              {renderSheetContent(pageBlocks, pageIdx)}
            </div>
          ))}
        </div>
      </main>

      {/* ========================================================== */}
      {/* PORTAL DE AISLAMIENTO PARA IMPRESIÓN FÍSICA / NAVEGADOR     */}
      {/* ========================================================== */}
      {createPortal(
        <div id="reporte-imprimible-root">
          {paginatedSheets.map((pageBlocks, pageIdx) => (
            <div 
              key={pageIdx}
              className="sheet-page"
              style={{
                width: '100%',
                minHeight: '100vh',
                padding: '12mm 15mm',
                pageBreakAfter: pageIdx === paginatedSheets.length - 1 ? 'avoid' : 'always',
                breakAfter: pageIdx === paginatedSheets.length - 1 ? 'avoid' : 'page',
                boxSizing: 'border-box'
              }}
            >
              {renderSheetContent(pageBlocks, pageIdx)}
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* ========================================================== */}
      {/* MODAL DE AUDITORÍA (DRILL-DOWN)                            */}
      {/* ========================================================== */}
      {selectedAuditAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                    {selectedAuditAccount.codigo}
                  </span>
                  <h3 className="text-sm font-black text-slate-900">
                    {selectedAuditAccount.nombre}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Saldo acumulado al {endDate}: <strong className="text-slate-800 font-mono">${formatoES(selectedAuditAccount.saldo || 0)}</strong>
                </p>
              </div>
              <button 
                onClick={() => setSelectedAuditAccount(null)}
                className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
              {(!balanceData.ledgerByAccount[String(selectedAuditAccount.id)] || balanceData.ledgerByAccount[String(selectedAuditAccount.id)].length === 0) ? (
                <div className="text-center py-6 text-slate-400">
                  {selectedAuditAccount.esCalculado ? (
                    <p>Esta cuenta es sintetizada dinámicamente desde el Estado de Resultados (P&L).</p>
                  ) : (
                    <p>No se registraron asientos directos en este período para esta cuenta.</p>
                  )}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">Comprobante</th>
                        <th className="p-2">Concepto</th>
                        <th className="p-2 text-right">Debe ($)</th>
                        <th className="p-2 text-right">Haber ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {balanceData.ledgerByAccount[String(selectedAuditAccount.id)].map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 text-slate-600 font-sans">{entry.fecha}</td>
                          <td className="p-2 font-bold text-indigo-600">#{entry.comprobanteNumero}</td>
                          <td className="p-2 text-slate-700 font-sans max-w-xs truncate">{entry.concepto}</td>
                          <td className="p-2 text-right text-slate-800">
                            {entry.debe > 0 ? `$${formatoES(entry.debe)}` : '-'}
                          </td>
                          <td className="p-2 text-right text-slate-800">
                            {entry.haber > 0 ? `$${formatoES(entry.haber)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedAuditAccount(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
