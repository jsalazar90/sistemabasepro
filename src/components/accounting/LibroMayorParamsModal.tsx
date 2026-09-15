import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  BookOpen, 
  Search, 
  ExternalLink, 
  FileSpreadsheet, 
  Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface LibroMayorParamsModalProps {
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
  const n = typeof num === 'string' ? parseFloat(num) || 0 : num || 0;
  if (n < -0.009) {
    return `<span style="color:#dc2626; font-weight:bold;">($${formatoES(Math.abs(n))})</span>`;
  }
  return `<span>$${formatoES(n)}</span>`;
};

// Cuentas modelo para Libro Mayor demostrativo
const SAMPLE_MAYOR_ACCOUNTS = [
  {
    id: 'm-101',
    codigo: '1.1.01.004',
    nombre: 'Banesco Banco Universal (Cuenta Corriente)',
    nat: 'Deudora',
    saldoInicial: 54200,
    entries: [
      { fecha: '2026-01-05', comprobante: 'DI-001', concepto: 'Cobro factura FC-1044 cliente Corporación Industrial', debe: 18500, haber: 0 },
      { fecha: '2026-01-12', comprobante: 'EG-015', concepto: 'Pago transferencia a proveedor de insumos', debe: 0, haber: 14200 },
      { fecha: '2026-01-18', comprobante: 'DI-032', concepto: 'Cobro de factura comercial de servicios', debe: 9400, haber: 0 },
      { fecha: '2026-01-25', comprobante: 'EG-040', concepto: 'Cancelación nómina quincenal empleados', debe: 0, haber: 8900 },
      { fecha: '2026-01-29', comprobante: 'EG-055', concepto: 'Pago alquiler oficina y servicios básicos', debe: 0, haber: 2450 }
    ]
  },
  {
    id: 'm-102',
    codigo: '1.1.03.001',
    nombre: 'Clientes Nacionales y Corporativos al Día',
    nat: 'Deudora',
    saldoInicial: 92400,
    entries: [
      { fecha: '2026-01-04', comprobante: 'DI-002', concepto: 'Emisión factura crédito 15 días Empresas Polar', debe: 24500, haber: 0 },
      { fecha: '2026-01-14', comprobante: 'DI-020', concepto: 'Cobro liquidación factura N° 1020', debe: 0, haber: 18500 },
      { fecha: '2026-01-22', comprobante: 'DI-038', concepto: 'Facturación servicios comerciales corporativos', debe: 16800, haber: 0 },
      { fecha: '2026-01-28', comprobante: 'DI-050', concepto: 'Cobro transferencia cliente BNC', debe: 0, haber: 12000 }
    ]
  },
  {
    id: 'm-201',
    codigo: '2.1.01.001',
    nombre: 'Proveedores Nacionales Comerciales',
    nat: 'Acreedora',
    saldoInicial: 114500,
    entries: [
      { fecha: '2026-01-08', comprobante: 'CP-010', concepto: 'Recepción factura suministros de oficina y operaciones', debe: 0, haber: 21400 },
      { fecha: '2026-01-16', comprobante: 'EG-022', concepto: 'Abono 50% factura N° 458 Proveedor Nacional', debe: 10700, haber: 0 },
      { fecha: '2026-01-24', comprobante: 'CP-035', concepto: 'Factura mensual mantenimiento de infraestructura', debe: 0, haber: 7800 },
      { fecha: '2026-01-30', comprobante: 'EG-060', concepto: 'Pago total saldo pendiente proveedor de servicios', debe: 7800, haber: 0 }
    ]
  },
  {
    id: 'm-401',
    codigo: '4.1.01.001',
    nombre: 'Ventas de Bienes y Mercancías',
    nat: 'Acreedora',
    saldoInicial: 0,
    entries: [
      { fecha: '2026-01-05', comprobante: 'DI-001', concepto: 'Facturación orden comercial N° 1002', debe: 0, haber: 32000 },
      { fecha: '2026-01-15', comprobante: 'DI-025', concepto: 'Facturación lote de mercancía orden N° 1045', debe: 0, haber: 48500 },
      { fecha: '2026-01-27', comprobante: 'DI-048', concepto: 'Venta de productos terminados al por mayor', debe: 0, haber: 19800 }
    ]
  }
];

export default function LibroMayorParamsModal({
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
}: LibroMayorParamsModalProps) {
  const [localStartDate, setLocalStartDate] = useState<string>(startDate || `${new Date().getFullYear()}-01-01`);
  const [localEndDate, setLocalEndDate] = useState<string>(endDate || new Date().toISOString().split('T')[0]);
  const [filterMode, setFilterMode] = useState<'todos' | 'individual' | 'rango'>('todos');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [desdeAccountId, setDesdeAccountId] = useState<string>('');
  const [hastaAccountId, setHastaAccountId] = useState<string>('');
  const [hideZero, setHideZero] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const useDemoData = false;

  if (!isOpen) return null;

  const computeData = () => {
    const isContabilizado = (c: any) => {
      if (!c.estado) return true;
      const e = String(c.estado).toLowerCase().trim();
      return e === 'contabilizado' || e === 'aprobado' || e === 'registrado';
    };

    const hasLive = comprobantes.some(isContabilizado);
    const hasAccounts = cuentasContables && cuentasContables.length > 0;
    const isDemo = useDemoData || (!hasLive && !hasAccounts);

    if (isDemo) {
      let accounts = SAMPLE_MAYOR_ACCOUNTS.map(acc => {
        let run = acc.saldoInicial;
        const mappedEntries = acc.entries.map(e => {
          if (acc.nat === 'Deudora') {
            run += (e.debe - e.haber);
          } else {
            run += (e.haber - e.debe);
          }
          return {
            ...e,
            saldo: run
          };
        });
        const totalDebe = mappedEntries.reduce((s, e) => s + e.debe, 0);
        const totalHaber = mappedEntries.reduce((s, e) => s + e.haber, 0);
        return {
          ...acc,
          entries: mappedEntries,
          totalDebe,
          totalHaber,
          saldoFinal: run
        };
      });

      // Filtro por modo
      if (filterMode === 'individual' && selectedAccountId) {
        accounts = accounts.filter(a => a.id === selectedAccountId);
      } else if (filterMode === 'rango' && desdeAccountId && hastaAccountId) {
        const dAcc = accounts.find(a => a.id === desdeAccountId);
        const hAcc = accounts.find(a => a.id === hastaAccountId);
        if (dAcc && hAcc) {
          const min = dAcc.codigo.localeCompare(hAcc.codigo) <= 0 ? dAcc.codigo : hAcc.codigo;
          const max = dAcc.codigo.localeCompare(hAcc.codigo) <= 0 ? hAcc.codigo : dAcc.codigo;
          accounts = accounts.filter(a => a.codigo >= min && a.codigo <= max);
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        accounts = accounts.filter(a => a.codigo.toLowerCase().includes(q) || a.nombre.toLowerCase().includes(q));
      }

      if (hideZero) {
        accounts = accounts.filter(a => a.entries.length > 0 || Math.abs(a.saldoFinal) > 0.009);
      }

      return accounts;
    }

    // Datos reales
    const pastComps = comprobantes.filter(c => isContabilizado(c) && (c.fecha || '').split('T')[0] < localStartDate);
    const periodComps = comprobantes.filter(c => isContabilizado(c) && (c.fecha || '').split('T')[0] >= localStartDate && (c.fecha || '').split('T')[0] <= localEndDate);

    const sortedComps = [...periodComps].sort((a, b) => {
      const cmp = (a.fecha || '').localeCompare(b.fecha || '');
      if (cmp !== 0) return cmp;
      return (a.numero || a.codigo || '').localeCompare(b.numero || b.codigo || '');
    });

    const activeCuentas = cuentasContables.filter(c => c.tipo === 'Movimiento' || (!c.tipo && c.codigo && c.codigo.split('.').length >= 3));

    const matchesAccount = (linea: any, c: any) => {
      const cId = String(linea.cuentaId || linea.cuenta_id || '').trim();
      if (!cId) return false;
      return String(c.id) === cId || String(c.codigo) === cId || (c.codigo && c.codigo.replace(/\./g, '') === cId.replace(/\./g, ''));
    };

    let accounts = activeCuentas.map(c => {
      let pastDeb = 0;
      let pastCred = 0;

      pastComps.forEach(comp => {
        (comp.lineas || []).forEach((l: any) => {
          if (matchesAccount(l, c)) {
            pastDeb += Number(l.debe) || 0;
            pastCred += Number(l.haber) || 0;
          }
        });
      });

      const cod = c.codigo || '';
      const nat = c.naturaleza || (cod.startsWith('1') || cod.startsWith('5') || cod.startsWith('6') ? 'Deudora' : 'Acreedora');
      const saldoInicial = nat === 'Deudora' ? (pastDeb - pastCred) : (pastCred - pastDeb);

      const entries: any[] = [];
      let running = saldoInicial;

      sortedComps.forEach(comp => {
        (comp.lineas || []).forEach((l: any) => {
          if (matchesAccount(l, c)) {
            const deb = Number(l.debe) || 0;
            const cred = Number(l.haber) || 0;
            if (deb > 0 || cred > 0) {
              if (nat === 'Deudora') {
                running += (deb - cred);
              } else {
                running += (cred - deb);
              }
              entries.push({
                fecha: comp.fecha,
                comprobante: comp.numero || comp.codigo || 'N/A',
                concepto: l.descripcion || comp.descripcion || comp.glosa || comp.concepto || 'Sin detalle',
                debe: deb,
                haber: cred,
                saldo: running
              });
            }
          }
        });
      });

      const totalDebe = entries.reduce((s, e) => s + e.debe, 0);
      const totalHaber = entries.reduce((s, e) => s + e.haber, 0);

      return {
        id: String(c.id),
        codigo: cod,
        nombre: c.nombre || '',
        nat,
        saldoInicial,
        entries,
        totalDebe,
        totalHaber,
        saldoFinal: running
      };
    });

    accounts.sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));

    if (filterMode === 'individual' && selectedAccountId) {
      accounts = accounts.filter(a => a.id === selectedAccountId);
    } else if (filterMode === 'rango' && desdeAccountId && hastaAccountId) {
      const dAcc = accounts.find(a => a.id === desdeAccountId);
      const hAcc = accounts.find(a => a.id === hastaAccountId);
      if (dAcc && hAcc) {
        const min = dAcc.codigo.localeCompare(hAcc.codigo) <= 0 ? dAcc.codigo : hAcc.codigo;
        const max = dAcc.codigo.localeCompare(hAcc.codigo) <= 0 ? hAcc.codigo : dAcc.codigo;
        accounts = accounts.filter(a => a.codigo >= min && a.codigo <= max);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      accounts = accounts.filter(a => a.codigo.toLowerCase().includes(q) || a.nombre.toLowerCase().includes(q));
    }

    if (hideZero) {
      accounts = accounts.filter(a => a.entries.length > 0 || Math.abs(a.saldoFinal) > 0.009);
    }

    return accounts;
  };

  const handleOpenInNewWindow = () => {
    if (setStartDate) setStartDate(localStartDate);
    if (setEndDate) setEndDate(localEndDate);

    const accounts = computeData();

    const w = window.open('', '_blank', 'width=1180,height=950,scrollbars=yes,resizable=yes');
    if (!w) {
      alert('Por favor autoriza las ventanas emergentes en tu navegador para ver el reporte.');
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
        background: rgba(14, 165, 233, 0.25);
        color: #7dd3fc;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 800;
        border: 1px solid rgba(14, 165, 233, 0.4);
      }
      .toolbar button.btn-print {
        background: #0ea5e9;
        color: white;
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
      .toolbar button.btn-print:hover { background: #0284c7; }
      .sheet-container {
        margin-top: 60px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 24px;
      }
      .sheet-page {
        width: 215.9mm;
        min-height: 279.4mm;
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
      .account-card {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        margin-bottom: 16px;
        overflow: hidden;
        page-break-inside: avoid;
      }
      .account-header {
        background: #0f172a;
        color: white;
        padding: 8px 12px;
        font-size: 11px;
        font-weight: bold;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      table.entry-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      table.entry-table th {
        background: #f8fafc;
        border-bottom: 1px solid #cbd5e1;
        padding: 5px 8px;
        font-size: 10px;
        text-transform: uppercase;
        font-weight: bold;
      }
      table.entry-table td {
        border-bottom: 1px solid #f1f5f9;
        padding: 4px 8px;
      }
      table.entry-table tr.total-row td {
        background: #f8fafc;
        border-top: 1px solid #0f172a;
        border-bottom: 2px solid #0f172a;
        font-weight: bold;
      }
      .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; font-size: 11px; padding-top: 24px; margin-top: 20px; border-top: 1px solid #cbd5e1; }
      .sig-line { border-top: 1px solid #000; width: 80%; margin: 25px auto 4px auto; }
      @page {
        size: letter portrait;
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

    // Empaquetar cuentas en hojas
    const sheets: any[][] = [];
    let currentSheet: any[] = [];
    let currentHeight = 0;
    const PAGE_HEIGHT_CAP = 780;

    accounts.forEach(acc => {
      // altura estimada: header (35) + entries (22 * n) + total (30) + initial (22)
      const accH = 35 + ((acc.entries.length + 2) * 22) + 30;
      if (currentHeight + accH > PAGE_HEIGHT_CAP && currentSheet.length > 0) {
        sheets.push(currentSheet);
        currentSheet = [acc];
        currentHeight = accH;
      } else {
        currentSheet.push(acc);
        currentHeight += accH;
      }
    });
    if (currentSheet.length > 0) sheets.push(currentSheet);
    if (sheets.length === 0) sheets.push([]);

    const generatedBodyHtml = `
      <div class="toolbar">
        <div class="title">
          <span>Libro Mayor Analítico</span>
          <span class="badge">Detalle de Asientos &bull; ${sheets.length} Hojas</span>
          <span style="font-size:12px; color:#94a3b8; font-weight:normal;">&bull; ${empresa?.nombre || 'HALLEY INSIGHTS'}</span>
        </div>
        <button class="btn-print" onclick="window.print()">
          &#128438; Imprimir Hoja Carta (Ctrl + P)
        </button>
      </div>

      <div class="sheet-container">
        ${sheets.map((sheetAccounts, sIdx) => `
          <div class="sheet-page">
            <div>
              ${sIdx === 0 ? `
                <div class="header-main">
                  <h2 style="margin:0; font-size:18px; font-weight:900; text-transform:uppercase;">${empresa?.nombre || 'HALLEY INSIGHTS S.A.'}</h2>
                  <p style="margin:3px 0; font-size:11px; color:#475569; font-weight:bold;">RIF / NIT: ${empresa?.rif || 'J-00000000-0'}</p>
                  <h3 style="margin:8px 0 2px 0; font-size:15px; font-weight:900; color:#0284c7; text-transform:uppercase; letter-spacing:1px;">
                    LIBRO MAYOR ANALÍTICO
                  </h3>
                  <p style="margin:0; font-size:11px; font-weight:bold; color:#64748b; text-transform:uppercase;">
                    DEL ${localStartDate} AL ${localEndDate} &bull; EXPRESADO EN DÓLARES (USD $)
                  </p>
                </div>
              ` : `
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #cbd5e1; padding-bottom:6px; margin-bottom:14px; font-size:10px; color:#64748b; font-weight:bold;">
                  <span>${empresa?.nombre || 'HALLEY INSIGHTS S.A.'} &bull; LIBRO MAYOR</span>
                  <span>Página ${sIdx + 1} de ${sheets.length}</span>
                </div>
              `}

              <div>
                ${sheetAccounts.map(acc => `
                  <div class="account-card">
                    <div class="account-header">
                      <span><strong>${acc.codigo}</strong> &bull; ${acc.nombre.toUpperCase()}</span>
                      <span style="font-size:10px; opacity:0.85;">NATURALEZA: ${acc.nat.toUpperCase()}</span>
                    </div>

                    <table class="entry-table">
                      <thead>
                        <tr>
                          <th style="width:12%; text-align:left;">Fecha</th>
                          <th style="width:14%; text-align:left;">Comprobante</th>
                          <th style="width:40%; text-align:left;">Concepto / Glosa</th>
                          <th style="width:11%; text-align:right;">Debe</th>
                          <th style="width:11%; text-align:right;">Haber</th>
                          <th style="width:12%; text-align:right;">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style="background:#f8fafc; font-style:italic;">
                          <td class="font-mono">${localStartDate}</td>
                          <td>-</td>
                          <td><strong>SALDO INICIAL AL INICIO DEL PERÍODO</strong></td>
                          <td class="font-mono text-right">-</td>
                          <td class="font-mono text-right">-</td>
                          <td class="font-mono" style="text-align:right; font-weight:bold;">${formatMontoContableHtml(acc.saldoInicial)}</td>
                        </tr>

                        ${acc.entries.map((e: any) => `
                          <tr>
                            <td class="font-mono" style="color:#64748b;">${e.fecha}</td>
                            <td class="font-mono font-bold">${e.comprobante}</td>
                            <td>${e.concepto}</td>
                            <td class="font-mono" style="text-align:right;">${e.debe > 0 ? '$' + formatoES(e.debe) : '$0,00'}</td>
                            <td class="font-mono" style="text-align:right;">${e.haber > 0 ? '$' + formatoES(e.haber) : '$0,00'}</td>
                            <td class="font-mono" style="text-align:right; font-weight:bold;">${formatMontoContableHtml(e.saldo)}</td>
                          </tr>
                        `).join('')}

                        <tr class="total-row">
                          <td colspan="3" style="text-transform:uppercase; font-size:10px;">TOTAL MOVIMIENTOS Y SALDO DE CIERRE</td>
                          <td class="font-mono" style="text-align:right;">$${formatoES(acc.totalDebe)}</td>
                          <td class="font-mono" style="text-align:right;">$${formatoES(acc.totalHaber)}</td>
                          <td class="font-mono" style="text-align:right; color:#0284c7;">${formatMontoContableHtml(acc.saldoFinal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                `).join('')}
              </div>

              ${sIdx === sheets.length - 1 && configContable?.reportShowSignatures !== false ? `
                <div class="signatures">
                  <div><div class="sig-line"></div><strong>${configContable?.reportPreparadorName || 'Lic. María Delgado'}</strong><br><span style="color:#64748b;">Preparado por / Contador</span></div>
                  <div><div class="sig-line"></div><strong>${configContable?.reportRevisorName || 'Ing. Javier Espinoza'}</strong><br><span style="color:#64748b;">Revisado por / Auditor</span></div>
                  <div><div class="sig-line"></div><strong>${configContable?.reportAprobadorName || 'Dirección Ejecutiva'}</strong><br><span style="color:#64748b;">Aprobado por / Gerencia</span></div>
                </div>
              ` : ''}
            </div>

            <div class="footer-running">
              <span>Halley Insights ERP &bull; Libro Mayor Analítico &bull; Fecha: ${new Date().toLocaleDateString('es-ES')}</span>
              <span>Página ${sIdx + 1} de ${sheets.length}</span>
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
        <title>Libro Mayor - ${localStartDate} al ${localEndDate}</title>
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
    const accounts = computeData();
    const rows: any[] = [];
    rows.push({ A: empresa?.nombre || 'HALLEY INSIGHTS S.A.' });
    rows.push({ A: `RIF/NIT: ${empresa?.rif || 'N/A'}` });
    rows.push({ A: 'LIBRO MAYOR ANALÍTICO' });
    rows.push({ A: `Período: del ${localStartDate} al ${localEndDate} | Moneda: USD ($)` });
    rows.push({});

    accounts.forEach(acc => {
      rows.push({ A: `CUENTA: ${acc.codigo} - ${acc.nombre}`, B: '', C: '', D: '', E: `Naturaleza: ${acc.nat}` });
      rows.push({
        A: 'Fecha',
        B: 'Comprobante',
        C: 'Concepto / Glosa',
        D: 'Debe ($)',
        E: 'Haber ($)',
        F: 'Saldo ($)'
      });
      rows.push({
        A: localStartDate,
        B: 'SALDO INICIAL',
        C: 'Saldo de inicio del período',
        D: '',
        E: '',
        F: acc.saldoInicial
      });

      acc.entries.forEach((e: any) => {
        rows.push({
          A: e.fecha,
          B: e.comprobante,
          C: e.concepto,
          D: e.debe,
          E: e.haber,
          F: e.saldo
        });
      });

      rows.push({
        A: 'TOTALES CUENTA',
        D: acc.totalDebe,
        E: acc.totalHaber,
        F: acc.saldoFinal
      });
      rows.push({});
    });

    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
    ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 45 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Libro Mayor');
    XLSX.writeFile(wb, `Libro_Mayor_${localStartDate}_al_${localEndDate}.xlsx`);
  };

  const activeAccounts = computeData();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* ENCABEZADO */}
        <div className="p-5 md:p-6 border-b border-slate-100 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-sky-50 border border-sky-100 text-sky-700">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight uppercase">
                    LIBRO MAYOR ANALÍTICO
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                    MOVIMIENTOS POR CUENTA
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {empresa?.nombre || 'Corporación Halley, C.A.'} • Movimientos del {localStartDate} al {localEndDate}
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
          {/* Modalidad de Filtro */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
              1. Alcance de Cuentas:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFilterMode('todos')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all text-left flex flex-col justify-between ${
                  filterMode === 'todos'
                    ? 'bg-white border-sky-600 shadow-md shadow-sky-500/10'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-black text-slate-900">Todas las Cuentas</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Mayor general completo del período.</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterMode('individual')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all text-left flex flex-col justify-between ${
                  filterMode === 'individual'
                    ? 'bg-white border-sky-600 shadow-md shadow-sky-500/10'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-black text-slate-900">Cuenta Específica</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Consultar una sola cuenta contable.</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterMode('rango')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all text-left flex flex-col justify-between ${
                  filterMode === 'rango'
                    ? 'bg-white border-sky-600 shadow-md shadow-sky-500/10'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-black text-slate-900">Rango de Cuentas</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Filtrar desde Código A hasta Código B.</span>
              </button>
            </div>
          </div>

          {/* Filtros específicos según el modo */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
              2. Parámetros de Selección:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-center">
              {filterMode === 'individual' && (
                <div className="col-span-full">
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-sky-500"
                  >
                    <option value="">-- Seleccionar Cuenta Contable --</option>
                    {activeAccounts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.codigo} - {a.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {filterMode === 'rango' && (
                <>
                  <div>
                    <select
                      value={desdeAccountId}
                      onChange={(e) => setDesdeAccountId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-sky-500"
                    >
                      <option value="">-- Desde Cuenta Inicial --</option>
                      {activeAccounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.codigo} - {a.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <select
                      value={hastaAccountId}
                      onChange={(e) => setHastaAccountId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:border-sky-500"
                    >
                      <option value="">-- Hasta Cuenta Final --</option>
                      {activeAccounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.codigo} - {a.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Buscar cuenta o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-sky-400 transition-all"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors select-none">
                <input 
                  type="checkbox"
                  checked={hideZero}
                  onChange={(e) => setHideZero(e.target.checked)}
                  className="rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span>Ocultar cuentas sin movimientos</span>
              </label>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <button 
            onClick={handleExportExcel}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-sky-50 hover:border-sky-300 text-slate-700 hover:text-sky-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-sky-600" />
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
              <ExternalLink className="w-4 h-4 text-sky-400" />
              <span>Ver Libro Mayor en Ventana</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
