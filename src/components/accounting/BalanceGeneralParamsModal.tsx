import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  FileText, 
  PieChart as PieIcon, 
  Search, 
  Check, 
  ExternalLink, 
  Printer, 
  FileSpreadsheet, 
  Layers,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SAMPLE_FULL_BALANCE_CUENTAS, dbResetToFullDemoCuentas } from '../../services/db';

export interface BalanceGeneralParamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresa?: any;
  configContable?: any;
  endDate: string;
  setEndDate?: (date: string) => void;
  comprobantes: any[];
  cuentasContables: any[];
  estadoResultados?: {
    utilidadNeta: number;
    [key: string]: any;
  };
}

const formatoES = (num: number | string) => {
  const n = typeof num === 'string' ? parseFloat(num) || 0 : num || 0;
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

// Formato contable estándar: sobregiros (< 0) en rojo y entre paréntesis sin signo menos
const formatMontoContableHtml = (num: number | string) => {
  const n = typeof num === 'string' ? parseFloat(num) || 0 : num || 0;
  if (n < -0.009) {
    return `<span style="color:#dc2626; font-weight:bold;">($${formatoES(Math.abs(n))})</span>`;
  }
  return `<span style="font-weight:bold;">$${formatoES(n)}</span>`;
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

export default function BalanceGeneralParamsModal({
  isOpen,
  onClose,
  empresa = {},
  configContable = {},
  endDate,
  setEndDate,
  comprobantes = [],
  cuentasContables = [],
  estadoResultados = { utilidadNeta: 0 },
}: BalanceGeneralParamsModalProps) {
  const [selectedViewMode, setSelectedViewMode] = useState<'visor' | 'dashboard'>('visor');
  const [localEndDate, setLocalEndDate] = useState<string>(endDate || new Date().toISOString().split('T')[0]);
  const [hideZero, setHideZero] = useState<boolean>(true);
  const [showVerticalAnalysis, setShowVerticalAnalysis] = useState<boolean>(true);
  const [maxDepthLevel, setMaxDepthLevel] = useState<number>(5);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [useFullDemoBalance, setUseFullDemoBalance] = useState<boolean>(true);

  if (!isOpen) return null;

  const isDescendant = (childCode: string, parentCode: string) => {
    if (!childCode || !parentCode) return false;
    if (childCode === parentCode) return true;
    if (childCode.startsWith(parentCode + '.')) return true;
    if (!parentCode.includes('.') && childCode.startsWith(parentCode) && childCode.length > parentCode.length) {
      return true;
    }
    return false;
  };

  // Helper robusto para determinar si una cuenta es de movimiento (hoja) o de agrupación (padre)
  const isLeafAccount = (cuenta: any, allAccounts: any[]) => {
    const t = (cuenta.tipo || '').toLowerCase();
    if (t === 'movimiento' || t === 'detalle') return true;
    if (t === 'titulo' || t === 'total' || t === 'grupo' || t === 'subtotal') return false;
    
    // Si no está explícito en 'tipo', verificar si tiene cuentas hijas en el catálogo
    const cod = cuenta.codigo || '';
    if (!cod) return false;
    const hasChildren = allAccounts.some(other => {
      if (String(other.id) === String(cuenta.id)) return false;
      const otherCod = other.codigo || '';
      return otherCod.startsWith(cod + '.') || (otherCod.startsWith(cod) && otherCod.length > cod.length);
    });
    return !hasChildren;
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

  const computeBalanceData = (cutoffDate: string) => {
    const activeCuentas = (useFullDemoBalance || cuentasContables.length < 25)
      ? SAMPLE_FULL_BALANCE_CUENTAS
      : cuentasContables;

    const pastComprobantes = comprobantes.filter(
      c => c.estado === 'Contabilizado' && (!c.fecha || c.fecha.split('T')[0] <= cutoffDate)
    );

    const saldosCuentas: Record<string, number> = {};

    activeCuentas.forEach(c => {
      saldosCuentas[c.id] = Number(c.saldoActual || c.saldo || 0);
    });

    if (!useFullDemoBalance && comprobantes.length > 0) {
      pastComprobantes.forEach(comp => {
        (comp.lineas || []).forEach((linea: any) => {
          const cId = String(linea.cuentaId);
          const cuenta = activeCuentas.find(item => String(item.id) === cId);
          if (!cuenta) return;

          const debe = Number(linea.debe) || 0;
          const haber = Number(linea.haber) || 0;
          const cod = cuenta.codigo || '';
          const nat = cuenta.naturaleza || (cod.startsWith('1') || cod.startsWith('5') || cod.startsWith('6') ? 'Deudora' : 'Acreedora');

          if (!saldosCuentas[cuenta.id]) saldosCuentas[cuenta.id] = 0;
          const montoNeto = nat === 'Deudora' ? debe - haber : haber - debe;
          saldosCuentas[cuenta.id] += montoNeto;
        });
      });
    }

    const leafAccounts = activeCuentas.filter(c => isLeafAccount(c, activeCuentas));
    const computedSaldos: Record<string, number> = {};

    activeCuentas.forEach(cuenta => {
      const isLeaf = isLeafAccount(cuenta, activeCuentas);
      if (isLeaf) {
        computedSaldos[cuenta.id] = saldosCuentas[cuenta.id] || 0;
      } else {
        const childLeaves = leafAccounts.filter(leaf => leaf.id !== cuenta.id && isDescendant(leaf.codigo, cuenta.codigo));
        if (childLeaves.length > 0) {
          computedSaldos[cuenta.id] = childLeaves.reduce((acc, leaf) => acc + (saldosCuentas[leaf.id] || 0), 0);
        } else {
          computedSaldos[cuenta.id] = saldosCuentas[cuenta.id] || 0;
        }
      }
    });

    const rawActivos: any[] = [];
    const rawPasivos: any[] = [];
    const rawPatrimonio: any[] = [];

    activeCuentas.forEach(c => {
      const cod = c.codigo || '';
      const saldo = computedSaldos[c.id] || 0;
      const level = Number(c.nivel) || (cod.split('.').length) || 1;
      const isLeaf = isLeafAccount(c, activeCuentas);

      const record = {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: isLeaf ? 'Movimiento' : 'Grupo',
        isLeaf: isLeaf,
        nivel: level,
        level: level,
        saldo: saldo
      };

      if (cod.startsWith('1')) rawActivos.push(record);
      else if (cod.startsWith('2')) rawPasivos.push(record);
      else if (cod.startsWith('3')) rawPatrimonio.push(record);
    });

    rawActivos.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
    rawPasivos.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
    rawPatrimonio.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

    let totalActivos = rawActivos
      .filter(a => a.isLeaf)
      .reduce((sum, item) => sum + (item.saldo || 0), 0);
    if (totalActivos === 0 && rawActivos.length > 0) {
      const root1 = rawActivos.find(a => a.codigo === '1');
      if (root1 && root1.saldo > 0) totalActivos = root1.saldo;
    }

    let totalPasivos = rawPasivos
      .filter(p => p.isLeaf)
      .reduce((sum, item) => sum + (item.saldo || 0), 0);
    if (totalPasivos === 0 && rawPasivos.length > 0) {
      const root2 = rawPasivos.find(p => p.codigo === '2');
      if (root2 && root2.saldo > 0) totalPasivos = root2.saldo;
    }

    let totalPatrimonio = rawPatrimonio
      .filter(p => p.isLeaf)
      .reduce((sum, item) => sum + (item.saldo || 0), 0);
    if (totalPatrimonio === 0 && rawPatrimonio.length > 0) {
      const root3 = rawPatrimonio.find(p => p.codigo === '3');
      if (root3 && root3.saldo > 0) totalPatrimonio = root3.saldo;
    }

    if (!useFullDemoBalance) {
      const utilidadNetaPAndL = estadoResultados?.utilidadNeta || 0;
      if (Math.abs(utilidadNetaPAndL) > 0.009) {
        rawPatrimonio.push({
          id: 'UTILIDAD_TEMP',
          codigo: '3.9.9.99',
          nombre: 'Resultado del Ejercicio Actual (Utilidad / Pérdida Neta P&L)',
          tipo: 'Movimiento',
          isLeaf: true,
          nivel: 3,
          level: 3,
          saldo: utilidadNetaPAndL,
          esCalculado: true
        });
        totalPatrimonio += utilidadNetaPAndL;
      }
    }

    let totalActivoCorriente = rawActivos
      .filter(a => a.isLeaf && isActivoCorriente(a))
      .reduce((sum, item) => sum + (item.saldo || 0), 0);
    if (totalActivoCorriente === 0 && totalActivos > 0) {
      const rootCte = rawActivos.find(a => a.codigo.startsWith('1.1') && a.level <= 2);
      if (rootCte && rootCte.saldo > 0) totalActivoCorriente = rootCte.saldo;
      else totalActivoCorriente = totalActivos;
    }
    const totalActivoNoCorriente = Math.max(0, totalActivos - totalActivoCorriente);

    let totalPasivoCorriente = rawPasivos
      .filter(p => p.isLeaf && isPasivoCorriente(p))
      .reduce((sum, item) => sum + (item.saldo || 0), 0);
    if (totalPasivoCorriente === 0 && totalPasivos > 0) {
      const rootPasCte = rawPasivos.find(p => p.codigo.startsWith('2.1') && p.level <= 2);
      if (rootPasCte && rootPasCte.saldo > 0) totalPasivoCorriente = rootPasCte.saldo;
      else totalPasivoCorriente = totalPasivos;
    }
    const totalPasivoNoCorriente = Math.max(0, totalPasivos - totalPasivoCorriente);

    const totalPasivoMasPatrimonio = totalPasivos + totalPatrimonio;
    const descuadre = Math.abs(totalActivos - totalPasivoMasPatrimonio);

    // Ratios Financieros
    const capitalDeTrabajo = totalActivoCorriente - totalPasivoCorriente;
    const razonCorriente = totalPasivoCorriente > 0 ? (totalActivoCorriente / totalPasivoCorriente) : (totalActivoCorriente > 0 ? 99 : 1);
    const razonEndeudamiento = totalActivos > 0 ? ((totalPasivos / totalActivos) * 100) : 0;
    const solvencia = totalPasivos > 0 ? (totalActivos / totalPasivos) : (totalActivos > 0 ? 99 : 1);

    return {
      activos: rawActivos,
      pasivos: rawPasivos,
      patrimonio: rawPatrimonio,
      totalActivos,
      totalActivoCorriente,
      totalActivoNoCorriente,
      totalPasivos,
      totalPasivoCorriente,
      totalPasivoNoCorriente,
      totalPatrimonio,
      totalPasivoMasPatrimonio,
      descuadre,
      capitalDeTrabajo,
      razonCorriente,
      razonEndeudamiento,
      solvencia
    };
  };

  // Función principal para abrir la ventana nueva con el formato seleccionado
  const handleOpenInNewWindow = () => {
    if (setEndDate) setEndDate(localEndDate);

    const data = computeBalanceData(localEndDate);

    const filterList = (list: any[]) => {
      let res = list.filter(item => {
        if (item.level > maxDepthLevel) return false;
        if (hideZero && Math.abs(item.saldo || 0) < 0.009) return false;
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          return (item.codigo || '').toLowerCase().includes(q) || (item.nombre || '').toLowerCase().includes(q);
        }
        return true;
      });
      // Fallback seguro: si hideZero ocultó todo, mostrar el catálogo para que nunca salga una hoja en blanco
      if (res.length === 0 && list.length > 0 && hideZero) {
        res = list.filter(item => {
          if (item.level > maxDepthLevel) return false;
          if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase();
            return (item.codigo || '').toLowerCase().includes(q) || (item.nombre || '').toLowerCase().includes(q);
          }
          return true;
        });
      }
      return res;
    };

    const noRoot = (list: any[]) => {
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

    const activosFiltrados = filterList(data.activos);
    const pasivosFiltrados = filterList(data.pasivos);
    const patrimonioFiltrado = filterList(data.patrimonio);

    const visibleActivosRows = noRoot(activosFiltrados);
    const visiblePasivosRows = noRoot(pasivosFiltrados);
    const visiblePatrimonioRows = noRoot(patrimonioFiltrado);

    const allFilteredVisible = [...visibleActivosRows, ...visiblePasivosRows, ...visiblePatrimonioRows];

    // Helper determinante: si una cuenta no tiene hijas visibles por debajo de ella en este nivel de filtro,
    // actúa como cuenta de movimiento/hoja visible y debe mostrar su saldo acumulado.
    const isLeafInCurrentView = (item: any) => {
      const hasChildInView = allFilteredVisible.some(other => 
        String(other.id) !== String(item.id) && isDescendant(other.codigo, item.codigo)
      );
      return !hasChildInView;
    };

    let activosCorrientes = visibleActivosRows.filter(isActivoCorriente);
    let activosNoCorrientes = visibleActivosRows.filter(a => !isActivoCorriente(a));
    if (activosCorrientes.length === 0 && activosNoCorrientes.length === 0) {
      activosCorrientes = visibleActivosRows;
    }

    let pasivosCorrientes = visiblePasivosRows.filter(isPasivoCorriente);
    let pasivosNoCorrientes = visiblePasivosRows.filter(p => !isPasivoCorriente(p));
    if (pasivosCorrientes.length === 0 && pasivosNoCorrientes.length === 0) {
      pasivosCorrientes = visiblePasivosRows;
    }

    const patrimonioRows = visiblePatrimonioRows;

    const w = window.open('', '_blank', 'width=1180,height=950,scrollbars=yes,resizable=yes');
    if (!w) {
      alert('Por favor autoriza las ventanas emergentes en tu navegador para ver el balance.');
      return;
    }

    // Estilos base comunes para impresión y visualización en papel
    const isLandscape = false;
    const baseCss = `
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 20px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background-color: #1e293b;
        color: #0f172a;
      }
      .toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #0f172a;
        color: white;
        padding: 12px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
        z-index: 1000;
      }
      .toolbar .title {
        font-size: 14px;
        font-weight: bold;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .toolbar .badge {
        background: rgba(99, 102, 241, 0.25);
        color: #a5b4fc;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 800;
        border: 1px solid rgba(99, 102, 241, 0.4);
      }
      .toolbar button.btn-print {
        background: #10b981;
        color: white;
        border: none;
        padding: 8px 20px;
        border-radius: 8px;
        font-weight: bold;
        font-size: 13px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .toolbar button.btn-print:hover { background: #059669; }
      .sheet-container {
        margin-top: 60px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
      }
      .sheet-page {
        width: ${isLandscape ? '279.4mm' : '215.9mm'};
        min-height: ${isLandscape ? '215.9mm' : '279.4mm'};
        background: white;
        padding: 15mm 18mm;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .header-main { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
      .footer-running { border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
      .row-item { display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; font-size: 12px; border-bottom: 1px dashed #e2e8f0; }
      .row-group { font-weight: bold; background: #f8fafc; border-bottom: 1px solid #cbd5e1; font-size: 12px; padding: 6px; margin: 4px 0; }
      .subtotal-bar { display: flex; justify-content: space-between; font-weight: bold; padding: 6px 8px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; background: #f8fafc; font-size: 12px; margin: 4px 0; color: #1e293b; }
      .sec-title { background: #0f172a; color: white; padding: 6px 10px; font-weight: 900; font-size: 13px; text-transform: uppercase; margin: 10px 0 4px 0; border-radius: 4px; }
      .total-bar { display: flex; justify-content: space-between; font-weight: 900; padding: 8px 10px; border-top: 1px solid #0f172a; border-bottom: 2px solid #0f172a; background: #f1f5f9; font-size: 13px; margin: 6px 0; }
      .closing-total { display: flex; justify-content: space-between; font-weight: 900; padding: 10px 12px; border-top: 2px solid #0f172a; border-bottom: 4px double #0f172a; background: #ecfdf5; font-size: 14px; color: #047857; margin: 8px 0; }
      .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; font-size: 11px; padding-top: 24px; margin-top: 20px; border-top: 1px solid #cbd5e1; }
      .sig-line { border-top: 1px solid #000; width: 80%; margin: 25px auto 4px auto; }
      @page {
        size: ${isLandscape ? 'letter landscape' : 'letter portrait'};
        margin: 10mm 15mm;
      }
      @media print {
        body { background: white; padding: 0; }
        .toolbar { display: none; }
        .sheet-container { margin-top: 0; gap: 0; }
        .sheet-page { box-shadow: none; border-radius: 0; margin: 0; padding: 10mm 12mm; page-break-after: always; break-after: page; width: 100%; min-height: 100vh; }
        .sheet-page:last-child { page-break-after: avoid; break-after: avoid; }
      }
    `;

    let generatedBodyHtml = '';

    // =========================================================================
    // 1. FORMATO: VISOR HOJA CARTA (PAGINADO FÍSICO EN MÚLTIPLES HOJAS)
    // =========================================================================
    if (selectedViewMode === 'visor') {
      const blocks: PrintBlock[] = [];
      blocks.push({ id: 'sec-activos', type: 'section_title', height: 38, data: { title: '1. ACTIVOS' } });

      if (activosCorrientes.length > 0) {
        if (maxDepthLevel > 2) {
          blocks.push({
            id: 'sub-act-corriente',
            type: 'group_bar',
            height: 32,
            data: { title: '1.1 ACTIVO CORRIENTE (Disponible / Exigible / Realizable)' }
          });
        }
        activosCorrientes.forEach(it => {
          const isMov = isLeafInCurrentView(it);
          blocks.push({ 
            id: `item-${it.id}`, 
            type: 'account_row', 
            height: 25, 
            data: { 
              item: it, 
              totalBase: data.totalActivos,
              isLeafInView: isMov
            } 
          });
        });
        if (maxDepthLevel > 2) {
          blocks.push({
            id: 'subtot-act-corriente',
            type: 'subtotal_bar',
            height: 30,
            data: { title: 'TOTAL ACTIVO CORRIENTE', total: data.totalActivoCorriente }
          });
        }
      }

      if (activosNoCorrientes.length > 0) {
        if (maxDepthLevel > 2) {
          blocks.push({
            id: 'sub-act-nocorriente',
            type: 'group_bar',
            height: 32,
            data: { title: '1.2 ACTIVO NO CORRIENTE (Propiedad, Planta y Equipos / Fijos)' }
          });
        }
        activosNoCorrientes.forEach(it => {
          const isMov = isLeafInCurrentView(it);
          blocks.push({ 
            id: `item-${it.id}`, 
            type: 'account_row', 
            height: 25, 
            data: { 
              item: it, 
              totalBase: data.totalActivos,
              isLeafInView: isMov
            } 
          });
        });
        if (maxDepthLevel > 2) {
          blocks.push({
            id: 'subtot-act-nocorriente',
            type: 'subtotal_bar',
            height: 30,
            data: { title: 'TOTAL ACTIVO NO CORRIENTE', total: data.totalActivoNoCorriente }
          });
        }
      }

      blocks.push({ id: 'tot-activos', type: 'total_bar', height: 40, data: { title: 'TOTAL DE ACTIVOS', total: data.totalActivos } });

      blocks.push({ id: 'sec-pasivos', type: 'section_title', height: 38, data: { title: '2. PASIVOS' } });

      if (pasivosCorrientes.length > 0) {
        if (maxDepthLevel > 2) {
          blocks.push({
            id: 'sub-pas-corriente',
            type: 'group_bar',
            height: 32,
            data: { title: '2.1 PASIVO CORRIENTE (Corto Plazo / Operativo)' }
          });
        }
        pasivosCorrientes.forEach(it => {
          const isMov = isLeafInCurrentView(it);
          blocks.push({ 
            id: `item-${it.id}`, 
            type: 'account_row', 
            height: 25, 
            data: { 
              item: it, 
              totalBase: data.totalPasivoMasPatrimonio,
              isLeafInView: isMov
            } 
          });
        });
        if (maxDepthLevel > 2) {
          blocks.push({
            id: 'subtot-pas-corriente',
            type: 'subtotal_bar',
            height: 30,
            data: { title: 'TOTAL PASIVO CORRIENTE', total: data.totalPasivoCorriente }
          });
        }
      }

      if (pasivosNoCorrientes.length > 0) {
        if (maxDepthLevel > 2) {
          blocks.push({
            id: 'sub-pas-nocorriente',
            type: 'group_bar',
            height: 32,
            data: { title: '2.2 PASIVO NO CORRIENTE (Largo Plazo / Financiero)' }
          });
        }
        pasivosNoCorrientes.forEach(it => {
          const isMov = isLeafInCurrentView(it);
          blocks.push({ 
            id: `item-${it.id}`, 
            type: 'account_row', 
            height: 25, 
            data: { 
              item: it, 
              totalBase: data.totalPasivoMasPatrimonio,
              isLeafInView: isMov
            } 
          });
        });
        if (maxDepthLevel > 2) {
          blocks.push({
            id: 'subtot-pas-nocorriente',
            type: 'subtotal_bar',
            height: 30,
            data: { title: 'TOTAL PASIVO NO CORRIENTE', total: data.totalPasivoNoCorriente }
          });
        }
      }

      blocks.push({ id: 'tot-pasivos', type: 'total_bar', height: 38, data: { title: 'TOTAL DE PASIVOS', total: data.totalPasivos } });

      blocks.push({ id: 'sec-patrimonio', type: 'section_title', height: 38, data: { title: '3. PATRIMONIO NETO' } });
      patrimonioRows.forEach(it => {
        const isMov = isLeafInCurrentView(it);
        blocks.push({ 
          id: `item-${it.id}`, 
          type: 'account_row', 
          height: 25, 
          data: { 
            item: it, 
            totalBase: data.totalPasivoMasPatrimonio,
            isLeafInView: isMov
          } 
        });
      });

      blocks.push({ id: 'tot-patrimonio', type: 'total_bar', height: 38, data: { title: 'TOTAL DE PATRIMONIO NETO', total: data.totalPatrimonio } });
      blocks.push({ id: 'tot-pasivo-patrimonio', type: 'closing_total', height: 45, data: { title: 'TOTAL DE PASIVO + PATRIMONIO', total: data.totalPasivoMasPatrimonio } });
      blocks.push({ id: 'ban-ecuacion', type: 'equation_banner', height: 42, data: { descuadre: data.descuadre } });

      if (configContable?.reportShowSignatures !== false) {
        blocks.push({ id: 'blk-firmas', type: 'signatures_block', height: 125 });
      }

      const PAGE_1_CAP = 720;
      const PAGE_OTHER_CAP = 820;
      const sheets: PrintBlock[][] = [];
      let currentSheet: PrintBlock[] = [];
      let currentH = 0;

      blocks.forEach(b => {
        const cap = sheets.length === 0 ? PAGE_1_CAP : PAGE_OTHER_CAP;
        if (currentH + b.height > cap && currentSheet.length > 0) {
          sheets.push(currentSheet);
          currentSheet = [b];
          currentH = b.height;
        } else {
          currentSheet.push(b);
          currentH += b.height;
        }
      });
      if (currentSheet.length > 0) sheets.push(currentSheet);
      if (sheets.length === 0) sheets.push(blocks);

      generatedBodyHtml = `
        <div class="toolbar">
          <div class="title">
            <span>Estado de Situación Financiera</span>
            <span class="badge">Visor Carta Paginado (${sheets.length} ${sheets.length === 1 ? 'Hoja' : 'Hojas'})</span>
            <span style="font-size:12px; color:#94a3b8; font-weight:normal;">&bull; ${empresa?.nombre || 'HALLEY INSIGHTS'}</span>
          </div>
          <button class="btn-print" onclick="window.print()">
            &#128438; Imprimir Hoja Carta (Ctrl + P)
          </button>
        </div>

        <div class="sheet-container">
          ${sheets.map((sheetBlocks, sIdx) => `
            <div class="sheet-page">
              <div>
                ${sIdx === 0 ? `
                  <div class="header-main">
                    <h2 style="margin:0; font-size:18px; font-weight:900; text-transform:uppercase;">${empresa?.nombre || 'HALLEY INSIGHTS S.A.'}</h2>
                    <p style="margin:3px 0; font-size:11px; color:#475569; font-weight:bold;">RIF / NIT: ${empresa?.rif || 'J-00000000-0'}</p>
                    <h3 style="margin:8px 0 2px 0; font-size:15px; font-weight:900; color:#312e81; text-transform:uppercase; letter-spacing:1px;">ESTADO DE SITUACIÓN FINANCIERA</h3>
                    <p style="margin:0; font-size:11px; font-weight:bold; color:#64748b; text-transform:uppercase;">AL ${localEndDate} &bull; EXPRESADO EN DÓLARES (USD $)</p>
                  </div>
                ` : `
                  <div style="display:flex; justify-content:space-between; border-bottom:1px solid #cbd5e1; padding-bottom:6px; margin-bottom:12px; font-size:10px; color:#64748b; font-weight:bold;">
                    <span>${empresa?.nombre || 'HALLEY INSIGHTS S.A.'} &bull; ESTADO DE SITUACIÓN FINANCIERA</span>
                    <span>Página ${sIdx + 1} de ${sheets.length}</span>
                  </div>
                `}

                <div>
                  ${sheetBlocks.map(block => {
                    if (block.type === 'section_title') return `<div class="sec-title">${block.data.title}</div>`;
                    if (block.type === 'group_bar') {
                      return `<div class="row-group"><span>${block.data.title}</span></div>`;
                    }
                    if (block.type === 'subtotal_bar') {
                      return `<div class="subtotal-bar"><span>${block.data.title}</span><span class="font-mono">${formatMontoContableHtml(block.data.total)}</span></div>`;
                    }
                    if (block.type === 'account_row') {
                      const it = block.data.item;
                      const isMov = block.data.isLeafInView !== undefined ? block.data.isLeafInView : (it.isLeaf || it.tipo === 'Movimiento');
                      const indent = it.level <= 1 ? '0px' : it.level === 2 ? '8px' : it.level === 3 ? '18px' : '28px';
                      const pct = block.data.totalBase > 0 ? ((it.saldo || 0) / block.data.totalBase) * 100 : 0;
                      return `
                        <div class="row-item" style="padding-left:${indent}; font-weight:${!isMov ? 'bold' : 'normal'};">
                          <span><span class="font-mono" style="color:#64748b; margin-right:6px;">${it.codigo}</span>${it.nombre}</span>
                          <span style="display:flex; gap:12px; align-items:center;">
                            ${showVerticalAnalysis && isMov ? `<span class="font-mono" style="color:#94a3b8; font-size:10px;">${pct.toFixed(1)}%</span>` : ''}
                            ${isMov ? `<span class="font-mono">${formatMontoContableHtml(it.saldo || 0)}</span>` : '<span style="display:inline-block; width:20px;"></span>'}
                          </span>
                        </div>
                      `;
                    }
                    if (block.type === 'total_bar') {
                      return `<div class="total-bar"><span>${block.data.title}</span><span class="font-mono">${formatMontoContableHtml(block.data.total)}</span></div>`;
                    }
                    if (block.type === 'closing_total') {
                      return `<div class="closing-total"><span>${block.data.title}</span><span class="font-mono">${formatMontoContableHtml(block.data.total)}</span></div>`;
                    }
                    if (block.type === 'equation_banner') {
                      const ok = block.data.descuadre < 0.01;
                      return `
                        <div style="background:${ok ? '#f0fdf4' : '#fff1f2'}; border:1px solid ${ok ? '#86efac' : '#fecdd3'}; padding:8px 12px; border-radius:6px; font-size:11px; font-weight:bold; color:${ok ? '#166534' : '#9f1239'}; margin:12px 0; display:flex; justify-content:space-between;">
                          <span>Ecuación Contable (Activo = Pasivo + Patrimonio):</span>
                          <span>${ok ? '&#10003; CONCILIADO Y CUADRADO EXACTO' : `&#9888; DESCUADRE DE $${formatoES(block.data.descuadre)}`}</span>
                        </div>
                      `;
                    }
                    if (block.type === 'signatures_block') {
                      return `
                        <div class="signatures">
                          <div><div class="sig-line"></div><strong>${configContable?.reportPreparadorName || 'Lic. María Delgado'}</strong><br><span style="color:#64748b;">Preparado por / Contador</span></div>
                          <div><div class="sig-line"></div><strong>${configContable?.reportRevisorName || 'Ing. Javier Espinoza'}</strong><br><span style="color:#64748b;">Revisado por / Auditor</span></div>
                          <div><div class="sig-line"></div><strong>${configContable?.reportAprobadorName || 'Dirección Ejecutiva'}</strong><br><span style="color:#64748b;">Aprobado por / Gerencia</span></div>
                        </div>
                      `;
                    }
                    return '';
                  }).join('')}
                </div>
              </div>

              <div class="footer-running">
                <span>Halley Insights ERP &bull; Documento Financiero Oficial &bull; Fecha: ${new Date().toLocaleDateString('es-ES')}</span>
                <span>Página ${sIdx + 1} de ${sheets.length}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // =========================================================================
    // 2. FORMATO: DASHBOARD EJECUTIVO & RATIOS FINANCIEROS
    // =========================================================================
    else if (selectedViewMode === 'dashboard') {
      const pctEndeudamiento = data.razonEndeudamiento.toFixed(1);
      const pctPropio = (100 - data.razonEndeudamiento).toFixed(1);
      const pctActivoCte = data.totalActivos > 0 ? ((data.totalActivoCorriente / data.totalActivos) * 100).toFixed(1) : '0.0';
      const pctActivoNoCte = (100 - Number(pctActivoCte)).toFixed(1);

      generatedBodyHtml = `
        <div class="toolbar">
          <div class="title">
            <span>Estado de Situación Financiera</span>
            <span class="badge">Dashboard Ejecutivo & Ratios</span>
            <span style="font-size:12px; color:#94a3b8; font-weight:normal;">&bull; ${empresa?.nombre || 'HALLEY INSIGHTS'}</span>
          </div>
          <button class="btn-print" onclick="window.print()">
            &#128438; Imprimir Dashboard (Ctrl + P)
          </button>
        </div>

        <div class="sheet-container">
          <div class="sheet-page">
            <div>
              <div class="header-main">
                <h2 style="margin:0; font-size:18px; font-weight:900; text-transform:uppercase;">${empresa?.nombre || 'HALLEY INSIGHTS S.A.'}</h2>
                <p style="margin:3px 0; font-size:11px; color:#475569; font-weight:bold;">RIF / NIT: ${empresa?.rif || 'J-00000000-0'}</p>
                <h3 style="margin:8px 0 2px 0; font-size:15px; font-weight:900; color:#312e81; text-transform:uppercase; letter-spacing:1px;">DIAGNÓSTICO EJECUTIVO DE SITUACIÓN FINANCIERA</h3>
                <p style="margin:0; font-size:11px; font-weight:bold; color:#64748b; text-transform:uppercase;">INDICADORES CLAVE Y MASAS PATRIMONIALES AL ${localEndDate} (USD $)</p>
              </div>

              <!-- 4 Tarjetas KPI -->
              <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:20px;">
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                  <span style="font-size:10px; font-weight:bold; color:#64748b; text-transform:uppercase;">Capital de Trabajo</span>
                  <div class="font-mono" style="font-size:18px; font-weight:900; color:#0f172a; margin:4px 0;">${formatMontoContableHtml(data.capitalDeTrabajo)}</div>
                  <span style="font-size:10px; font-weight:bold; color:${data.capitalDeTrabajo >= 0 ? '#10b981' : '#f43f5e'};">${data.capitalDeTrabajo >= 0 ? '&#10003; Excedente Operativo' : '&#9888; Déficit'}</span>
                </div>

                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                  <span style="font-size:10px; font-weight:bold; color:#64748b; text-transform:uppercase;">Razón Corriente</span>
                  <div class="font-mono" style="font-size:18px; font-weight:900; color:#0f172a; margin:4px 0;">${data.razonCorriente.toFixed(2)}x</div>
                  <span style="font-size:10px; font-weight:bold; color:${data.razonCorriente >= 1.5 ? '#10b981' : data.razonCorriente >= 1.0 ? '#f59e0b' : '#f43f5e'};">${data.razonCorriente >= 1.5 ? '&#10003; Liquidez Óptima' : data.razonCorriente >= 1.0 ? 'Ajustada' : 'Crítica'}</span>
                </div>

                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                  <span style="font-size:10px; font-weight:bold; color:#64748b; text-transform:uppercase;">Endeudamiento</span>
                  <div class="font-mono" style="font-size:18px; font-weight:900; color:#0f172a; margin:4px 0;">${data.razonEndeudamiento.toFixed(1)}%</div>
                  <span style="font-size:10px; font-weight:bold; color:${data.razonEndeudamiento < 60 ? '#10b981' : '#f59e0b'};">${data.razonEndeudamiento < 60 ? '&#10003; Nivel Moderado' : '&#9888; Elevado'}</span>
                </div>

                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;">
                  <span style="font-size:10px; font-weight:bold; color:#64748b; text-transform:uppercase;">Solvencia Global</span>
                  <div class="font-mono" style="font-size:18px; font-weight:900; color:#0f172a; margin:4px 0;">${data.solvencia.toFixed(2)}x</div>
                  <span style="font-size:10px; font-weight:bold; color:#10b981;">Activo / Pasivo</span>
                </div>
              </div>

              <!-- Barras de Composición -->
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:20px;">
                <h4 style="margin:0 0 12px 0; font-size:12px; text-transform:uppercase; font-weight:bold; color:#334155;">Estructura de Recursos y Financiación</h4>

                <div style="margin-bottom:14px;">
                  <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:bold; margin-bottom:4px;">
                    <span>Financiación: Terceros (${pctEndeudamiento}%) vs Patrimonio Propio (${pctPropio}%)</span>
                    <span class="font-mono">${formatMontoContableHtml(data.totalPasivoMasPatrimonio)}</span>
                  </div>
                  <div style="height:12px; background:#e2e8f0; border-radius:6px; overflow:hidden; display:flex;">
                    <div style="width:${pctEndeudamiento}%; background:#f59e0b;" title="Pasivo: ${pctEndeudamiento}%"></div>
                    <div style="width:${pctPropio}%; background:#10b981;" title="Patrimonio: ${pctPropio}%"></div>
                  </div>
                </div>

                <div>
                  <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:bold; margin-bottom:4px;">
                    <span>Estructura de Activo: Corriente (${pctActivoCte}%) vs No Corriente (${pctActivoNoCte}%)</span>
                    <span class="font-mono">${formatMontoContableHtml(data.totalActivos)}</span>
                  </div>
                  <div style="height:12px; background:#e2e8f0; border-radius:6px; overflow:hidden; display:flex;">
                    <div style="width:${pctActivoCte}%; background:#6366f1;" title="Activo Corriente: ${pctActivoCte}%"></div>
                    <div style="width:${pctActivoNoCte}%; background:#3b82f6;" title="Activo No Corriente: ${pctActivoNoCte}%"></div>
                  </div>
                </div>
              </div>

              <!-- Resumen Consolidado -->
              <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:14px;">
                <thead>
                  <tr style="background:#0f172a; color:white;">
                    <th style="padding:8px 10px; text-align:left;">Masa Patrimonial</th>
                    <th style="padding:8px 10px; text-align:right;">Monto Consolidado ($)</th>
                    <th style="padding:8px 10px; text-align:right;">% Peso Relativo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px 10px; font-weight:bold;">1. Activo Total</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono font-bold">${formatMontoContableHtml(data.totalActivos)}</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono">100.0%</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px 10px; padding-left:20px;">- Activo Corriente (Circulante)</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono">${formatMontoContableHtml(data.totalActivoCorriente)}</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono">${pctActivoCte}%</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px 10px; padding-left:20px;">- Activo No Corriente (Fijo / Intangibles)</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono">${formatMontoContableHtml(data.totalActivoNoCorriente)}</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono">${pctActivoNoCte}%</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px 10px; font-weight:bold;">2. Pasivo Total (Obligaciones a Terceros)</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono font-bold">${formatMontoContableHtml(data.totalPasivos)}</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono">${pctEndeudamiento}%</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px 10px; padding-left:20px;">- Pasivo Corriente (Corto Plazo)</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono">${formatMontoContableHtml(data.totalPasivoCorriente)}</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono">${data.totalPasivoMasPatrimonio > 0 ? ((data.totalPasivoCorriente / data.totalPasivoMasPatrimonio) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px 10px; padding-left:20px;">- Pasivo No Corriente (Largo Plazo)</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono">${formatMontoContableHtml(data.totalPasivoNoCorriente)}</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono">${data.totalPasivoMasPatrimonio > 0 ? ((data.totalPasivoNoCorriente / data.totalPasivoMasPatrimonio) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px 10px; font-weight:bold;">3. Patrimonio Neto (Recursos Propios)</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono font-bold">${formatMontoContableHtml(data.totalPatrimonio)}</td>
                    <td style="padding:8px 10px; text-align:right;" class="font-mono">${pctPropio}%</td>
                  </tr>
                  <tr style="background:#ecfdf5; font-weight:900; color:#047857;">
                    <td style="padding:10px;">TOTAL PASIVO + PATRIMONIO</td>
                    <td style="padding:10px; text-align:right;" class="font-mono">${formatMontoContableHtml(data.totalPasivoMasPatrimonio)}</td>
                    <td style="padding:10px; text-align:right;" class="font-mono">100.0%</td>
                  </tr>
                </tbody>
              </table>

              <!-- Firmas -->
              ${configContable?.reportShowSignatures !== false ? `
                <div class="signatures">
                  <div><div class="sig-line"></div><strong>${configContable?.reportPreparadorName || 'Lic. María Delgado'}</strong><br><span style="color:#64748b;">Preparado por / Contador</span></div>
                  <div><div class="sig-line"></div><strong>${configContable?.reportRevisorName || 'Ing. Javier Espinoza'}</strong><br><span style="color:#64748b;">Revisado por / Auditor</span></div>
                  <div><div class="sig-line"></div><strong>${configContable?.reportAprobadorName || 'Dirección Ejecutiva'}</strong><br><span style="color:#64748b;">Aprobado por / Gerencia</span></div>
                </div>
              ` : ''}
            </div>

            <div class="footer-running" style="margin-top:20px;">
              <span>Halley Insights ERP &bull; Documento Financiero Oficial &bull; Fecha: ${new Date().toLocaleDateString('es-ES')}</span>
              <span>Página 1 de 1</span>
            </div>
          </div>
        </div>
      `;
    }

    const fullDoc = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Balance General - ${localEndDate}</title>
        <style>${baseCss}</style>
      </head>
      <body>
        ${generatedBodyHtml}
      </body>
      </html>
    `;

    w.document.open();
    w.document.write(fullDoc);
    w.document.close();
    onClose();
  };

  // Exportar Excel
  const handleExportExcel = () => {
    const data = computeBalanceData(localEndDate);
    const rows: any[] = [];
    rows.push({ A: empresa?.nombre || 'HALLEY INSIGHTS S.A.' });
    rows.push({ A: `RIF/NIT: ${empresa?.rif || 'N/A'}` });
    rows.push({ A: 'ESTADO DE SITUACIÓN FINANCIERA (BALANCE GENERAL)' });
    rows.push({ A: `Fecha de Corte: al ${localEndDate} | Moneda: USD ($)` });
    rows.push({});

    rows.push({
      A: 'Código Contable',
      B: 'Nombre de Cuenta',
      C: 'Tipo',
      D: 'Nivel',
      E: 'Saldo ($)',
      F: '% Análisis Vertical'
    });

    const allFilteredVisible = [
      ...data.activos,
      ...data.pasivos,
      ...data.patrimonio
    ].filter(a => (a.level ?? 1) <= maxDepthLevel);

    const isLeafInCurrentView = (item: any) => {
      const hasChildInView = allFilteredVisible.some(other => 
        String(other.id) !== String(item.id) && isDescendant(other.codigo, item.codigo)
      );
      return !hasChildInView;
    };

    const addSection = (title: string, list: any[], baseTotal: number) => {
      rows.push({ A: title, B: '', C: '', D: '', E: '', F: '' });
      const filtered = list.filter(item => (item.level ?? 1) <= maxDepthLevel);
      filtered.forEach(item => {
        const isMov = isLeafInCurrentView(item);
        const indent = '  '.repeat(Math.max(0, item.level - 1));
        const pct = baseTotal > 0 ? ((item.saldo || 0) / baseTotal) * 100 : 0;
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

    addSection('1. ACTIVOS', data.activos, data.totalActivos);
    rows.push({ A: 'TOTAL ACTIVOS', E: data.totalActivos, F: '100.00%' });
    rows.push({});

    addSection('2. PASIVOS', data.pasivos, data.totalPasivoMasPatrimonio);
    rows.push({ A: 'TOTAL PASIVOS', E: data.totalPasivos, F: `${((data.totalPasivos / (data.totalPasivoMasPatrimonio || 1)) * 100).toFixed(2)}%` });
    rows.push({});

    addSection('3. PATRIMONIO NETO', data.patrimonio, data.totalPasivoMasPatrimonio);
    rows.push({ A: 'TOTAL PATRIMONIO NETO', E: data.totalPatrimonio, F: `${((data.totalPatrimonio / (data.totalPasivoMasPatrimonio || 1)) * 100).toFixed(2)}%` });
    rows.push({});

    rows.push({ A: 'TOTAL PASIVO + PATRIMONIO', E: data.totalPasivoMasPatrimonio, F: '100.00%' });
    rows.push({
      A: 'ESTADO DE LA ECUACIÓN',
      B: data.descuadre === 0 ? 'CONCILIADO Y CUADRADO' : `DESCUADRE DE $${data.descuadre.toFixed(2)}`
    });

    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
    ws['!cols'] = [{ wch: 18 }, { wch: 45 }, { wch: 14 }, { wch: 8 }, { wch: 18 }, { wch: 18 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Balance General');
    XLSX.writeFile(wb, `Balance_General_${localEndDate}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* ========================================================== */}
        {/* ENCABEZADO IDÉNTICO AL DEL PANEL DEL USUARIO               */}
        {/* ========================================================== */}
        <div className="p-5 md:p-6 border-b border-slate-100 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight uppercase">
                    ESTADO DE SITUACIÓN FINANCIERA
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                    NIIF / HOJA CARTA
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {empresa?.nombre || 'Agencia de Viajes y Turismo Halley, C.A.'} • Balance General Consolidado al {localEndDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Selector de Fecha */}
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-600">Al:</span>
                <input 
                  type="date"
                  value={localEndDate}
                  onChange={(e) => setLocalEndDate(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-800 border-none outline-hidden cursor-pointer"
                />
              </div>

              {/* Botón Cerrar Modal */}
              <button 
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================== */}
        {/* CUERPO: OPCIONES Y SELECTOR DE FORMATO                    */}
        {/* ========================================================== */}
        <div className="p-6 space-y-6 bg-slate-50/50">
          {/* Banner Demostración Multi-Página */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-4 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md border border-indigo-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs md:text-sm font-black uppercase tracking-wide">
                    Balance Completo Multi-Página
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    59 CUENTAS / 3 HOJAS CARTA
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    SOBREGIRO ROJO ($15.200,00)
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  Genera el reporte balanceado al centavo: <strong>Total Activos = Total Pasivo + Patrimonio = $1.774.850,00</strong> (Descuadre $0.00) con saltos de hoja automáticos y cuentas de título sin montos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer bg-white/10 px-3 py-1.5 rounded-xl hover:bg-white/20 transition-all border border-white/10">
                <input 
                  type="checkbox"
                  checked={useFullDemoBalance}
                  onChange={(e) => setUseFullDemoBalance(e.target.checked)}
                  className="rounded text-indigo-500 cursor-pointer"
                />
                <span>Usar Demo 59 Cuentas</span>
              </label>
            </div>
          </div>

          {/* Selector de Formato de Vista */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
              1. Selecciona el Formato de Presentación:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Opción 1: Visor Hoja Carta */}
              <div 
                onClick={() => setSelectedViewMode('visor')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  selectedViewMode === 'visor'
                    ? 'bg-white border-indigo-600 shadow-md shadow-indigo-500/10'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${selectedViewMode === 'visor' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  {selectedViewMode === 'visor' && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Visor Hoja Carta</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Paginado físico oficial (8.5" × 11") listo para imprimir.</p>
                </div>
              </div>

              {/* Opción 2: Dashboard & Ratios */}
              <div 
                onClick={() => setSelectedViewMode('dashboard')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  selectedViewMode === 'dashboard'
                    ? 'bg-white border-indigo-600 shadow-md shadow-indigo-500/10'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${selectedViewMode === 'dashboard' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <PieIcon className="w-4 h-4" />
                  </div>
                  {selectedViewMode === 'dashboard' && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Dashboard & Ratios</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">KPIs de liquidez, solvencia y gráficos.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Opciones y Filtros Contables */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
              2. Configuración y Filtros del Reporte:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-center">
              {/* Buscador */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Buscar cuenta o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-indigo-400 transition-all"
                />
              </div>

              {/* Selector de Nivel */}
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-bold">Nivel:</span>
                <select 
                  value={maxDepthLevel}
                  onChange={(e) => setMaxDepthLevel(Number(e.target.value))}
                  className="bg-transparent text-xs font-black text-slate-800 outline-hidden cursor-pointer w-full"
                >
                  <option value={1}>1 (Mayor / Capítulos)</option>
                  <option value={2}>2 (Grupos Principales)</option>
                  <option value={3}>3 (Subgrupos / Rubros)</option>
                  <option value={4}>4 (Subcuentas)</option>
                  <option value={5}>5 (Detallado Completo)</option>
                </select>
              </div>

              {/* Checkbox Cero */}
              <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors select-none">
                <input 
                  type="checkbox"
                  checked={hideZero}
                  onChange={(e) => setHideZero(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Ocultar cuentas en $0</span>
              </label>

              {/* Checkbox Vertical */}
              <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors select-none">
                <input 
                  type="checkbox"
                  checked={showVerticalAnalysis}
                  onChange={(e) => setShowVerticalAnalysis(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>% Análisis Vertical</span>
              </label>
            </div>
          </div>
        </div>

        {/* ========================================================== */}
        {/* FOOTER CON BOTÓN ÚNICO DE VISUALIZACIÓN EN VENTANA NUEVA   */}
        {/* ========================================================== */}
        <div className="p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <button 
            onClick={handleExportExcel}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Descargar Excel</span>
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>

            {/* BOTÓN PRINCIPAL: ABRIR EN VENTANA NUEVA */}
            <button
              onClick={handleOpenInNewWindow}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all shadow-md cursor-pointer active:scale-95"
            >
              <ExternalLink className="w-4 h-4 text-indigo-300" />
              <span>Ver Balance en Ventana Nueva</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
