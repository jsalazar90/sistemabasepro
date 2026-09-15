import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  FileText, 
  Search, 
  ExternalLink, 
  FileSpreadsheet, 
  Columns,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SAMPLE_FULL_BALANCE_CUENTAS } from '../../services/db';

export interface BalanceComprobacionParamsModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresa?: any;
  configContable?: any;
  startDate: string;
  endDate: string;
  setStartDate?: (date: string) => void;
  setEndDate?: (date: string) => void;
  comprobantes: any[];
  cuentasContables: any[];
}

const formatoES = (num: number | string) => {
  const n = typeof num === 'string' ? parseFloat(num) || 0 : num || 0;
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

const formatMontoContableHtml = (num: number | string) => {
  let n = typeof num === 'string' ? parseFloat(num) || 0 : num || 0;
  if (Math.abs(n) < 0.009) {
    n = 0;
  }
  if (n < -0.009) {
    return `<span style="color:#dc2626; font-weight:bold;">($${formatoES(Math.abs(n))})</span>`;
  }
  return `<span>$${formatoES(n)}</span>`;
};

interface ComprobacionRow {
  id: string;
  codigo: string;
  nombre: string;
  nivel: number;
  tipo: string;
  isLeaf: boolean;
  saldoInicialDeudor: number;
  saldoInicialAcreedor: number;
  saldoInicialNeto: number;
  debitos: number;
  creditos: number;
  saldoFinalDeudor: number;
  saldoFinalAcreedor: number;
  saldoFinalNeto: number;
}

interface PrintBlock {
  id: string;
  type: 'table_header' | 'row' | 'totals_bar' | 'signatures_block';
  height: number;
  data?: any;
}

export default function BalanceComprobacionParamsModal({
  isOpen,
  onClose,
  empresa = {},
  configContable = {},
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  comprobantes = [],
  cuentasContables = [],
}: BalanceComprobacionParamsModalProps) {
  const [localStartDate, setLocalStartDate] = useState<string>(startDate || `${new Date().getFullYear()}-01-01`);
  const [localEndDate, setLocalEndDate] = useState<string>(endDate || new Date().toISOString().split('T')[0]);
  const [reportFormat, setReportFormat] = useState<'oficial_4col' | 'completo_6col'>('oficial_4col');
  const [hideZero, setHideZero] = useState<boolean>(true);
  const [maxDepthLevel, setMaxDepthLevel] = useState<number>(5);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const useFullDemo = false;

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

  const computeData = (): { rows: ComprobacionRow[]; totals: any } => {
    const isContabilizado = (c: any) => {
      if (!c.estado) return true;
      const e = String(c.estado).toLowerCase().trim();
      return e === 'contabilizado' || e === 'aprobado' || e === 'registrado';
    };

    const hasLive = comprobantes.some(isContabilizado);
    const hasAccounts = cuentasContables && cuentasContables.length > 0;
    const isDemo = useFullDemo || (!hasLive && !hasAccounts);

    if (isDemo) {
      const activeCuentas = (cuentasContables.length >= 30 && !useFullDemo) 
        ? cuentasContables 
        : SAMPLE_FULL_BALANCE_CUENTAS;

      const computedRows: ComprobacionRow[] = [];

      activeCuentas.forEach(c => {
        const cod = c.codigo || '';
        const nivel = Number(c.nivel) || cod.split('.').length || 1;
        const isLeaf = c.tipo === 'Movimiento' || (!c.tipo && cod.split('.').length >= 3);
        const baseSaldo = Number(c.saldoActual || c.saldo || 0);

        // Simulamos movimientos consistentes
        const isDeudora = cod.startsWith('1') || cod.startsWith('5') || cod.startsWith('6');
        let deb = 0;
        let cred = 0;
        let initDeudor = 0;
        let initAcreedor = 0;

        if (isLeaf) {
          const factor = Math.abs(baseSaldo) * 0.15;
          deb = Math.round(factor * 1.2 * 100) / 100;
          cred = Math.round(factor * 0.8 * 100) / 100;
          if (isDeudora) {
            initDeudor = Math.max(0, baseSaldo - deb + cred);
          } else {
            initAcreedor = Math.max(0, baseSaldo - cred + deb);
          }
        }

        // Saldo algebraico (Debe - Haber) para formato 4 columnas:
        // Cuentas deudoras (Activo, Costos, Gastos): saldo positivo.
        // Cuentas acreedoras (Pasivo, Patrimonio, Ingresos): saldo negativo ($X,XX).
        const saldoInicialNeto = initDeudor - initAcreedor;
        const saldoFinalNeto = (initDeudor - initAcreedor) + deb - cred;

        const finDeudor = isDeudora 
          ? (saldoFinalNeto >= 0 ? saldoFinalNeto : 0) 
          : (saldoFinalNeto > 0 ? saldoFinalNeto : 0);
        const finAcreedor = !isDeudora 
          ? (saldoFinalNeto <= 0 ? Math.abs(saldoFinalNeto) : 0) 
          : (saldoFinalNeto < 0 ? Math.abs(saldoFinalNeto) : 0);

        computedRows.push({
          id: String(c.id),
          codigo: cod,
          nombre: c.nombre || '',
          nivel,
          tipo: c.tipo || (isLeaf ? 'Movimiento' : 'Grupo'),
          isLeaf,
          saldoInicialDeudor: initDeudor,
          saldoInicialAcreedor: initAcreedor,
          saldoInicialNeto,
          debitos: deb,
          creditos: cred,
          saldoFinalDeudor: finDeudor,
          saldoFinalAcreedor: finAcreedor,
          saldoFinalNeto
        });
      });

      computedRows.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

      // Filtrado
      let filtered = computedRows.filter(r => {
        if (r.nivel > maxDepthLevel) return false;
        if (hideZero && r.debitos === 0 && r.creditos === 0 && Math.abs(r.saldoFinalNeto) < 0.01) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return r.codigo.toLowerCase().includes(q) || r.nombre.toLowerCase().includes(q);
        }
        return true;
      });

      // Sumas de comprobación
      const leafRows = filtered.filter(r => r.isLeaf);
      const targetRows = leafRows.length > 0 ? leafRows : filtered;
      const rawFinalNeto = targetRows.reduce((s, r) => s + r.saldoFinalNeto, 0);
      const rawInicialNeto = targetRows.reduce((s, r) => s + r.saldoInicialNeto, 0);

      const totals = {
        saldoInicialDeudor: targetRows.reduce((s, r) => s + r.saldoInicialDeudor, 0),
        saldoInicialAcreedor: targetRows.reduce((s, r) => s + r.saldoInicialAcreedor, 0),
        saldoInicialNeto: Math.abs(rawInicialNeto) < 0.009 ? 0 : rawInicialNeto,
        debitos: targetRows.reduce((s, r) => s + r.debitos, 0),
        creditos: targetRows.reduce((s, r) => s + r.creditos, 0),
        saldoFinalDeudor: targetRows.reduce((s, r) => s + r.saldoFinalDeudor, 0),
        saldoFinalAcreedor: targetRows.reduce((s, r) => s + r.saldoFinalAcreedor, 0),
        saldoFinalNeto: Math.abs(rawFinalNeto) < 0.009 ? 0 : rawFinalNeto,
      };

      return { rows: filtered, totals };
    }

    // Datos Reales
    const pastComps = comprobantes.filter(c => isContabilizado(c) && (c.fecha || '').split('T')[0] < localStartDate);
    const periodComps = comprobantes.filter(c => isContabilizado(c) && (c.fecha || '').split('T')[0] >= localStartDate && (c.fecha || '').split('T')[0] <= localEndDate);

    const activeCuentas = cuentasContables;
    const isLeaf = (c: any) => {
      const t = (c.tipo || '').toLowerCase();
      if (t === 'movimiento' || t === 'detalle') return true;
      if (t === 'grupo' || t === 'título general' || t === 'titulo general' || t === 'subtotal') return false;
      const cod = c.codigo || '';
      return !activeCuentas.some(o => String(o.id) !== String(c.id) && o.codigo && o.codigo.startsWith(cod + '.'));
    };

    const leafAccounts = activeCuentas.filter(isLeaf);
    const leafSaldos: Record<string, { pastDeb: number; pastCred: number; deb: number; cred: number }> = {};
    activeCuentas.forEach(c => {
      leafSaldos[c.id] = { pastDeb: 0, pastCred: 0, deb: 0, cred: 0 };
    });

    pastComps.forEach(comp => {
      (comp.lineas || []).forEach((l: any) => {
        const cId = String(l.cuentaId || l.cuenta_id || '').trim();
        if (!cId) return;
        const matched = activeCuentas.find(c => 
          String(c.id) === cId || 
          String(c.codigo) === cId || 
          (c.codigo && c.codigo.replace(/\./g, '') === cId.replace(/\./g, ''))
        );
        if (matched && leafSaldos[matched.id]) {
          leafSaldos[matched.id].pastDeb += Number(l.debe) || 0;
          leafSaldos[matched.id].pastCred += Number(l.haber) || 0;
        }
      });
    });

    periodComps.forEach(comp => {
      (comp.lineas || []).forEach((l: any) => {
        const cId = String(l.cuentaId || l.cuenta_id || '').trim();
        if (!cId) return;
        const matched = activeCuentas.find(c => 
          String(c.id) === cId || 
          String(c.codigo) === cId || 
          (c.codigo && c.codigo.replace(/\./g, '') === cId.replace(/\./g, ''))
        );
        if (matched && leafSaldos[matched.id]) {
          leafSaldos[matched.id].deb += Number(l.debe) || 0;
          leafSaldos[matched.id].cred += Number(l.haber) || 0;
        }
      });
    });

    const rows: ComprobacionRow[] = activeCuentas.map(c => {
      const isLeafNode = isLeaf(c);
      let pastDeb = 0;
      let pastCred = 0;
      let deb = 0;
      let cred = 0;

      if (isLeafNode) {
        pastDeb = leafSaldos[c.id]?.pastDeb || 0;
        pastCred = leafSaldos[c.id]?.pastCred || 0;
        deb = leafSaldos[c.id]?.deb || 0;
        cred = leafSaldos[c.id]?.cred || 0;
      } else {
        const childLeaves = leafAccounts.filter(l => l.id !== c.id && isDescendant(l.codigo, c.codigo));
        childLeaves.forEach(l => {
          pastDeb += leafSaldos[l.id]?.pastDeb || 0;
          pastCred += leafSaldos[l.id]?.pastCred || 0;
          deb += leafSaldos[l.id]?.deb || 0;
          cred += leafSaldos[l.id]?.cred || 0;
        });
      }

      const cod = c.codigo || '';
      const nat = c.naturaleza || (cod.startsWith('1') || cod.startsWith('5') || cod.startsWith('6') ? 'Deudora' : 'Acreedora');
      let initDeudor = 0;
      let initAcreedor = 0;

      if (nat === 'Deudora') {
        const net = pastDeb - pastCred;
        if (net >= 0) initDeudor = net;
        else initAcreedor = Math.abs(net);
      } else {
        const net = pastCred - pastDeb;
        if (net >= 0) initAcreedor = net;
        else initDeudor = Math.abs(net);
      }

      // Saldo algebraico (Debe - Haber) para el Balance de Comprobación:
      // - Cuentas Deudoras (Activo, Costos, Gastos): saldo positivo.
      // - Cuentas Acreedoras (desde Pasivo hasta Ingresos): saldo negativo ($X,XX).
      // De esta manera, la suma total de saldos deudores y acreedores al final es exactamente $0,00.
      const saldoInicialNeto = pastDeb - pastCred;
      const saldoFinalNeto = (pastDeb - pastCred) + (deb - cred);

      let finDeudor = 0;
      let finAcreedor = 0;

      if (nat === 'Deudora') {
        if (saldoFinalNeto >= 0) finDeudor = saldoFinalNeto;
        else finAcreedor = Math.abs(saldoFinalNeto);
      } else {
        const acreedorNet = (pastCred - pastDeb) + (cred - deb);
        if (acreedorNet >= 0) finAcreedor = acreedorNet;
        else finDeudor = Math.abs(acreedorNet);
      }

      return {
        id: String(c.id),
        codigo: cod,
        nombre: c.nombre || '',
        nivel: Number(c.nivel) || cod.split('.').length || 1,
        tipo: isLeafNode ? 'Movimiento' : (c.tipo || 'Grupo'),
        isLeaf: isLeafNode,
        saldoInicialDeudor: initDeudor,
        saldoInicialAcreedor: initAcreedor,
        saldoInicialNeto,
        debitos: deb,
        creditos: cred,
        saldoFinalDeudor: finDeudor,
        saldoFinalAcreedor: finAcreedor,
        saldoFinalNeto
      };
    });

    rows.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

    let filtered = rows.filter(r => {
      if (r.nivel > maxDepthLevel) return false;
      if (hideZero && r.debitos === 0 && r.creditos === 0 && Math.abs(r.saldoFinalNeto) < 0.01) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return r.codigo.toLowerCase().includes(q) || r.nombre.toLowerCase().includes(q);
      }
      return true;
    });

    const leafRows = filtered.filter(r => r.isLeaf);
    const targetRows = leafRows.length > 0 ? leafRows : filtered;
    const rawFinalNeto = targetRows.reduce((s, r) => s + r.saldoFinalNeto, 0);
    const rawInicialNeto = targetRows.reduce((s, r) => s + r.saldoInicialNeto, 0);

    const totals = {
      saldoInicialDeudor: targetRows.reduce((s, r) => s + r.saldoInicialDeudor, 0),
      saldoInicialAcreedor: targetRows.reduce((s, r) => s + r.saldoInicialAcreedor, 0),
      saldoInicialNeto: Math.abs(rawInicialNeto) < 0.009 ? 0 : rawInicialNeto,
      debitos: targetRows.reduce((s, r) => s + r.debitos, 0),
      creditos: targetRows.reduce((s, r) => s + r.creditos, 0),
      saldoFinalDeudor: targetRows.reduce((s, r) => s + r.saldoFinalDeudor, 0),
      saldoFinalAcreedor: targetRows.reduce((s, r) => s + r.saldoFinalAcreedor, 0),
      saldoFinalNeto: Math.abs(rawFinalNeto) < 0.009 ? 0 : rawFinalNeto,
    };

    return { rows: filtered, totals };
  };

  const handleOpenInNewWindow = () => {
    if (setStartDate) setStartDate(localStartDate);
    if (setEndDate) setEndDate(localEndDate);

    const { rows, totals } = computeData();
    const isLandscape = reportFormat === 'completo_6col';

    const w = window.open('', '_blank', 'width=1200,height=950,scrollbars=yes,resizable=yes');
    if (!w) {
      alert('Por favor autoriza las ventanas emergentes para ver el reporte.');
      return;
    }

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
        background: rgba(245, 158, 11, 0.25);
        color: #fcd34d;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 800;
        border: 1px solid rgba(245, 158, 11, 0.4);
      }
      .toolbar button.btn-print {
        background: #f59e0b;
        color: #0f172a;
        border: none;
        padding: 8px 20px;
        border-radius: 8px;
        font-weight: 900;
        font-size: 13px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .toolbar button.btn-print:hover { background: #d97706; color: white; }
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
        padding: 12mm 15mm;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .header-main { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
      .footer-running { border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
      table.report-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      table.report-table th {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        padding: 5px 6px;
        font-weight: 800;
        font-size: 10px;
        text-transform: uppercase;
      }
      table.report-table td {
        border: 1px solid #e2e8f0;
        padding: 4px 6px;
        font-size: 11px;
      }
      .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; font-size: 11px; padding-top: 24px; margin-top: 20px; border-top: 1px solid #cbd5e1; }
      .sig-line { border-top: 1px solid #000; width: 80%; margin: 25px auto 4px auto; }
      @page {
        size: ${isLandscape ? 'letter landscape' : 'letter portrait'};
        margin: 10mm 12mm;
      }
      @media print {
        body { background: white; padding: 0; }
        .toolbar { display: none; }
        .sheet-container { margin-top: 0; gap: 0; }
        .sheet-page { box-shadow: none; border-radius: 0; margin: 0; padding: 8mm 10mm; page-break-after: always; break-after: page; width: 100%; min-height: 100vh; }
        .sheet-page:last-child { page-break-after: avoid; break-after: avoid; }
      }
    `;

    // Paginación por bloques de filas
    const ROWS_PER_PAGE = isLandscape ? 22 : 28;
    const pages: ComprobacionRow[][] = [];
    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
      pages.push(rows.slice(i, i + ROWS_PER_PAGE));
    }
    if (pages.length === 0) pages.push([]);

    const generatedBodyHtml = `
      <div class="toolbar">
        <div class="title">
          <span>Balance de Comprobación y Pre-Cierre</span>
          <span class="badge">${reportFormat === 'oficial_4col' ? 'Formato Oficial (4 Col)' : 'Formato Completo (6 Col)'} &bull; ${pages.length} Hojas</span>
          <span style="font-size:12px; color:#94a3b8; font-weight:normal;">&bull; ${empresa?.nombre || 'HALLEY INSIGHTS'}</span>
        </div>
        <button class="btn-print" onclick="window.print()">
          &#128438; Imprimir Hoja Carta (Ctrl + P)
        </button>
      </div>

      <div class="sheet-container">
        ${pages.map((pageRows, pIdx) => `
          <div class="sheet-page">
            <div>
              ${pIdx === 0 ? `
                <div class="header-main">
                  <h2 style="margin:0; font-size:18px; font-weight:900; text-transform:uppercase;">${empresa?.nombre || 'HALLEY INSIGHTS S.A.'}</h2>
                  <p style="margin:3px 0; font-size:11px; color:#475569; font-weight:bold;">RIF / NIT: ${empresa?.rif || 'J-00000000-0'}</p>
                  <h3 style="margin:6px 0 2px 0; font-size:14px; font-weight:900; color:#b45309; text-transform:uppercase; letter-spacing:1px;">
                    BALANCE DE COMPROBACIÓN (SUMAS Y SALDOS)
                  </h3>
                  <p style="margin:0; font-size:11px; font-weight:bold; color:#64748b; text-transform:uppercase;">
                    DEL ${localStartDate} AL ${localEndDate} &bull; EXPRESADO EN DÓLARES (USD $)
                  </p>
                </div>
              ` : `
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #cbd5e1; padding-bottom:6px; margin-bottom:10px; font-size:10px; color:#64748b; font-weight:bold;">
                  <span>${empresa?.nombre || 'HALLEY INSIGHTS S.A.'} &bull; BALANCE DE COMPROBACIÓN</span>
                  <span>Página ${pIdx + 1} de ${pages.length}</span>
                </div>
              `}

              <table class="report-table">
                ${reportFormat === 'oficial_4col' ? `
                  <thead>
                    <tr>
                      <th style="width:16%;">Código</th>
                      <th style="text-align:left; width:44%;">Cuenta Contable</th>
                      <th style="text-align:right; width:13%;">Saldo Inicial</th>
                      <th style="text-align:right; width:13%;">Débitos</th>
                      <th style="text-align:right; width:13%;">Créditos</th>
                      <th style="text-align:right; width:14%;">Saldo Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pageRows.map(r => `
                      <tr style="font-weight:${r.isLeaf ? 'normal' : 'bold'}; background:${!r.isLeaf ? '#f8fafc' : 'white'};">
                        <td class="font-mono" style="color:#64748b;">${r.codigo}</td>
                        <td style="text-transform:uppercase;">${r.nombre}</td>
                        <td class="font-mono" style="text-align:right;">${formatMontoContableHtml(r.saldoInicialNeto)}</td>
                        <td class="font-mono" style="text-align:right;">${r.debitos > 0 ? '$' + formatoES(r.debitos) : '$0,00'}</td>
                        <td class="font-mono" style="text-align:right;">${r.creditos > 0 ? '$' + formatoES(r.creditos) : '$0,00'}</td>
                        <td class="font-mono" style="text-align:right; font-weight:bold;">${formatMontoContableHtml(r.saldoFinalNeto)}</td>
                      </tr>
                    `).join('')}

                    ${pIdx === pages.length - 1 ? `
                      <tr style="background:#fef3c7; border-top:2px solid #0f172a; border-bottom:3px double #0f172a; font-weight:900;">
                        <td colspan="2" style="padding:8px; text-transform:uppercase;">TOTALES SUMAS IGUALES</td>
                        <td class="font-mono" style="text-align:right;">${formatMontoContableHtml(totals.saldoInicialNeto)}</td>
                        <td class="font-mono" style="text-align:right;">$${formatoES(totals.debitos)}</td>
                        <td class="font-mono" style="text-align:right;">$${formatoES(totals.creditos)}</td>
                        <td class="font-mono" style="text-align:right;">${formatMontoContableHtml(totals.saldoFinalNeto)}</td>
                      </tr>
                    ` : ''}
                  </tbody>
                ` : `
                  <thead>
                    <tr>
                      <th rowspan="2" style="width:12%;">Código</th>
                      <th rowspan="2" style="text-align:left; width:34%;">Cuenta Contable</th>
                      <th colspan="2" style="text-align:center;">Saldos Iniciales</th>
                      <th colspan="2" style="text-align:center;">Movimientos</th>
                      <th colspan="2" style="text-align:center;">Saldos Finales</th>
                    </tr>
                    <tr>
                      <th style="text-align:right; width:9%;">Debe</th>
                      <th style="text-align:right; width:9%;">Haber</th>
                      <th style="text-align:right; width:9%;">Debe</th>
                      <th style="text-align:right; width:9%;">Haber</th>
                      <th style="text-align:right; width:9%;">Debe</th>
                      <th style="text-align:right; width:9%;">Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pageRows.map(r => `
                      <tr style="font-weight:${r.isLeaf ? 'normal' : 'bold'}; background:${!r.isLeaf ? '#f8fafc' : 'white'};">
                        <td class="font-mono" style="color:#64748b;">${r.codigo}</td>
                        <td style="text-transform:uppercase;">${r.nombre}</td>
                        <td class="font-mono" style="text-align:right;">${r.saldoInicialDeudor > 0 ? '$' + formatoES(r.saldoInicialDeudor) : '$0,00'}</td>
                        <td class="font-mono" style="text-align:right;">${r.saldoInicialAcreedor > 0 ? '$' + formatoES(r.saldoInicialAcreedor) : '$0,00'}</td>
                        <td class="font-mono" style="text-align:right;">${r.debitos > 0 ? '$' + formatoES(r.debitos) : '$0,00'}</td>
                        <td class="font-mono" style="text-align:right;">${r.creditos > 0 ? '$' + formatoES(r.creditos) : '$0,00'}</td>
                        <td class="font-mono" style="text-align:right; font-weight:bold;">${r.saldoFinalDeudor > 0 ? '$' + formatoES(r.saldoFinalDeudor) : '$0,00'}</td>
                        <td class="font-mono" style="text-align:right; font-weight:bold;">${r.saldoFinalAcreedor > 0 ? '$' + formatoES(r.saldoFinalAcreedor) : '$0,00'}</td>
                      </tr>
                    `).join('')}

                    ${pIdx === pages.length - 1 ? `
                      <tr style="background:#fef3c7; border-top:2px solid #0f172a; border-bottom:3px double #0f172a; font-weight:900;">
                        <td colspan="2" style="padding:8px; text-transform:uppercase;">TOTALES SUMAS IGUALES</td>
                        <td class="font-mono" style="text-align:right;">$${formatoES(totals.saldoInicialDeudor)}</td>
                        <td class="font-mono" style="text-align:right;">$${formatoES(totals.saldoInicialAcreedor)}</td>
                        <td class="font-mono" style="text-align:right;">$${formatoES(totals.debitos)}</td>
                        <td class="font-mono" style="text-align:right;">$${formatoES(totals.creditos)}</td>
                        <td class="font-mono" style="text-align:right;">$${formatoES(totals.saldoFinalDeudor)}</td>
                        <td class="font-mono" style="text-align:right;">$${formatoES(totals.saldoFinalAcreedor)}</td>
                      </tr>
                    ` : ''}
                  </tbody>
                `}
              </table>

              ${pIdx === pages.length - 1 && configContable?.reportShowSignatures !== false ? `
                <div class="signatures">
                  <div><div class="sig-line"></div><strong>${configContable?.reportPreparadorName || 'Lic. María Delgado'}</strong><br><span style="color:#64748b;">Preparado por / Contador</span></div>
                  <div><div class="sig-line"></div><strong>${configContable?.reportRevisorName || 'Ing. Javier Espinoza'}</strong><br><span style="color:#64748b;">Revisado por / Auditor</span></div>
                  <div><div class="sig-line"></div><strong>${configContable?.reportAprobadorName || 'Dirección Ejecutiva'}</strong><br><span style="color:#64748b;">Aprobado por / Gerencia</span></div>
                </div>
              ` : ''}
            </div>

            <div class="footer-running">
              <span>Halley Insights ERP &bull; Balance de Comprobación &bull; Fecha: ${new Date().toLocaleDateString('es-ES')}</span>
              <span>Página ${pIdx + 1} de ${pages.length}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    const fullDoc = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Balance de Comprobación - ${localStartDate} al ${localEndDate}</title>
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

  const handleExportExcel = () => {
    const { rows, totals } = computeData();
    const sheetData: any[] = [];
    sheetData.push({ A: empresa?.nombre || 'HALLEY INSIGHTS S.A.' });
    sheetData.push({ A: `RIF/NIT: ${empresa?.rif || 'N/A'}` });
    sheetData.push({ A: 'BALANCE DE COMPROBACIÓN DE SUMAS Y SALDOS' });
    sheetData.push({ A: `Período: del ${localStartDate} al ${localEndDate} | Moneda: USD ($)` });
    sheetData.push({});

    if (reportFormat === 'oficial_4col') {
      sheetData.push({
        A: 'Código Contable',
        B: 'Nombre de Cuenta',
        C: 'Saldo Inicial ($)',
        D: 'Débitos ($)',
        E: 'Créditos ($)',
        F: 'Saldo Actual ($)'
      });

      rows.forEach(r => {
        sheetData.push({
          A: r.codigo,
          B: r.nombre,
          C: r.saldoInicialNeto,
          D: r.debitos,
          E: r.creditos,
          F: r.saldoFinalNeto
        });
      });

      sheetData.push({});
      sheetData.push({
        A: 'TOTALES SUMAS IGUALES',
        C: totals.saldoInicialNeto,
        D: totals.debitos,
        E: totals.creditos,
        F: totals.saldoFinalNeto
      });
    } else {
      sheetData.push({
        A: 'Código Contable',
        B: 'Nombre de Cuenta',
        C: 'Saldo Inic. Debe',
        D: 'Saldo Inic. Haber',
        E: 'Movim. Debe',
        F: 'Movim. Haber',
        G: 'Saldo Final Debe',
        H: 'Saldo Final Haber'
      });

      rows.forEach(r => {
        sheetData.push({
          A: r.codigo,
          B: r.nombre,
          C: r.saldoInicialDeudor,
          D: r.saldoInicialAcreedor,
          E: r.debitos,
          F: r.creditos,
          G: r.saldoFinalDeudor,
          H: r.saldoFinalAcreedor
        });
      });

      sheetData.push({});
      sheetData.push({
        A: 'TOTALES SUMAS IGUALES',
        C: totals.saldoInicialDeudor,
        D: totals.saldoInicialAcreedor,
        E: totals.debitos,
        F: totals.creditos,
        G: totals.saldoFinalDeudor,
        H: totals.saldoFinalAcreedor
      });
    }

    const ws = XLSX.utils.json_to_sheet(sheetData, { skipHeader: true });
    ws['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comprobación');
    XLSX.writeFile(wb, `Balance_Comprobacion_${localStartDate}_al_${localEndDate}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* ENCABEZADO */}
        <div className="p-5 md:p-6 border-b border-slate-100 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight uppercase">
                    BALANCE DE COMPROBACIÓN
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                    SUMAS Y SALDOS
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {empresa?.nombre || 'Corporación Halley, C.A.'} • Del {localStartDate} al {localEndDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-600">Desde:</span>
                <input 
                  type="date"
                  value={localStartDate}
                  onChange={(e) => setLocalStartDate(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-800 border-none outline-hidden cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-600 ml-1">Hasta:</span>
                <input 
                  type="date"
                  value={localEndDate}
                  onChange={(e) => setLocalEndDate(e.target.value)}
                  className="bg-transparent text-xs font-black text-slate-800 border-none outline-hidden cursor-pointer"
                />
              </div>

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

        <div className="p-6 space-y-6 bg-slate-50/50">
          {/* Formato de Columnas */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
              1. Selecciona el Formato de la Balanza:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div 
                onClick={() => setReportFormat('oficial_4col')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  reportFormat === 'oficial_4col'
                    ? 'bg-white border-amber-600 shadow-md shadow-amber-500/10'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${reportFormat === 'oficial_4col' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  {reportFormat === 'oficial_4col' && (
                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Formato Oficial (4 Columnas)</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Saldo Inicial, Débitos, Créditos y Saldo Actual en hoja vertical.</p>
                </div>
              </div>

              <div 
                onClick={() => setReportFormat('completo_6col')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  reportFormat === 'completo_6col'
                    ? 'bg-white border-amber-600 shadow-md shadow-amber-500/10'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${reportFormat === 'completo_6col' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Columns className="w-4 h-4" />
                  </div>
                  {reportFormat === 'completo_6col' && (
                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Formato Completo (6 Columnas)</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Debe/Haber Inicial, Movimientos y Saldos Finales en horizontal.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
              2. Configuración y Filtros:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-center">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Buscar cuenta o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-amber-400 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-bold">Nivel:</span>
                <select 
                  value={maxDepthLevel}
                  onChange={(e) => setMaxDepthLevel(Number(e.target.value))}
                  className="bg-transparent text-xs font-black text-slate-800 outline-hidden cursor-pointer w-full"
                >
                  <option value={1}>1 (Mayor)</option>
                  <option value={2}>2 (Grupos)</option>
                  <option value={3}>3 (Rubros)</option>
                  <option value={4}>4 (Subcuentas)</option>
                  <option value={5}>5 (Detalle Completo)</option>
                </select>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors select-none">
                <input 
                  type="checkbox"
                  checked={hideZero}
                  onChange={(e) => setHideZero(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>Ocultar cuentas con saldo $0</span>
              </label>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <button 
            onClick={handleExportExcel}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-amber-50 hover:border-amber-300 text-slate-700 hover:text-amber-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-amber-600" />
            <span>Descargar Excel</span>
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              onClick={handleOpenInNewWindow}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all shadow-md cursor-pointer active:scale-95"
            >
              <ExternalLink className="w-4 h-4 text-amber-400" />
              <span>Ver Balance de Comprobación en Ventana</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
