import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Receipt, 
  Search, 
  ExternalLink, 
  FileSpreadsheet, 
  FileText,
  ListFilter
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface LibroDiarioParamsModalProps {
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

// Asientos demostrativos
const SAMPLE_DIARIO_COMPROBANTES = [
  {
    id: 'cmp-001',
    codigo: 'DI-001',
    numero: '1001',
    fecha: '2026-01-05',
    tipo: 'Diario',
    glosa: 'Cobro de facturas comerciales boletos internacionales corporativos',
    lineas: [
      { cuentaCodigo: '1.1.01.004', cuentaNombre: 'Banesco Banco Universal', debe: 18500, haber: 0 },
      { cuentaCodigo: '1.1.03.001', cuentaNombre: 'Clientes Nacionales al Día', debe: 0, haber: 18500 }
    ]
  },
  {
    id: 'cmp-002',
    codigo: 'CP-002',
    numero: '1002',
    fecha: '2026-01-08',
    tipo: 'Compras',
    glosa: 'Recepción factura proveedores hotelería y receptivos turísticos',
    lineas: [
      { cuentaCodigo: '5.1.01.002', cuentaNombre: 'Costos Directos Hotelería y Operadores', debe: 21400, haber: 0 },
      { cuentaCodigo: '1.1.05.001', cuentaNombre: 'Crédito Fiscal IVA 16%', debe: 3424, haber: 0 },
      { cuentaCodigo: '2.1.01.001', cuentaNombre: 'Proveedores Nacionales Comerciales', debe: 0, haber: 24824 }
    ]
  },
  {
    id: 'cmp-003',
    codigo: 'EG-003',
    numero: '1003',
    fecha: '2026-01-12',
    tipo: 'Egreso',
    glosa: 'Pago parcial a mayorista aéreo Copa Airlines transferencia bancaria',
    lineas: [
      { cuentaCodigo: '2.1.01.002', cuentaNombre: 'Proveedores del Exterior e Importaciones', debe: 14200, haber: 0 },
      { cuentaCodigo: '1.1.01.008', cuentaNombre: 'JPMorgan Chase Bank (USD Operaciones)', debe: 0, haber: 14200 }
    ]
  },
  {
    id: 'cmp-004',
    codigo: 'DI-004',
    numero: '1004',
    fecha: '2026-01-18',
    tipo: 'Ingreso',
    glosa: 'Facturación directa paquetes todo incluido Cancún y Riviera Maya',
    lineas: [
      { cuentaCodigo: '1.1.01.003', cuentaNombre: 'Caja Bóveda Moneda Extranjera', debe: 9400, haber: 0 },
      { cuentaCodigo: '4.1.01.002', cuentaNombre: 'Venta de Paquetes Turísticos y Hoteles', debe: 0, haber: 9400 }
    ]
  },
  {
    id: 'cmp-005',
    codigo: 'EG-005',
    numero: '1005',
    fecha: '2026-01-25',
    tipo: 'Egreso',
    glosa: 'Pago nómina quincenal empleados administrativos y comerciales',
    lineas: [
      { cuentaCodigo: '6.1.01.001', cuentaNombre: 'Sueldos, Salarios y Beneficios al Personal', debe: 8900, haber: 0 },
      { cuentaCodigo: '2.1.02.001', cuentaNombre: 'Sueldos y Salarios por Pagar', debe: 0, haber: 8900 }
    ]
  },
  {
    id: 'cmp-006',
    codigo: 'EG-006',
    numero: '1006',
    fecha: '2026-01-29',
    tipo: 'Egreso',
    glosa: 'Liquidación de alquiler de oficinas y servicios de telecomunicaciones',
    lineas: [
      { cuentaCodigo: '6.1.01.003', cuentaNombre: 'Alquiler de Oficinas Administrativas', debe: 2450, haber: 0 },
      { cuentaCodigo: '1.1.01.004', cuentaNombre: 'Banesco Banco Universal', debe: 0, haber: 2450 }
    ]
  }
];

export default function LibroDiarioParamsModal({
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
}: LibroDiarioParamsModalProps) {
  const [localStartDate, setLocalStartDate] = useState<string>(startDate || `${new Date().getFullYear()}-01-01`);
  const [localEndDate, setLocalEndDate] = useState<string>(endDate || new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'resumen' | 'detalle'>('resumen');
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
      let comps = SAMPLE_DIARIO_COMPROBANTES;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        comps = comps.filter(c => 
          c.codigo.toLowerCase().includes(q) || 
          c.glosa.toLowerCase().includes(q) ||
          c.lineas.some(l => l.cuentaCodigo.toLowerCase().includes(q) || l.cuentaNombre.toLowerCase().includes(q))
        );
      }

      // Resumen consolidado por cuenta
      const accMap: Record<string, { codigo: string; nombre: string; debe: number; haber: number }> = {};
      comps.forEach(c => {
        c.lineas.forEach(l => {
          if (!accMap[l.cuentaCodigo]) {
            accMap[l.cuentaCodigo] = { codigo: l.cuentaCodigo, nombre: l.cuentaNombre, debe: 0, haber: 0 };
          }
          accMap[l.cuentaCodigo].debe += l.debe;
          accMap[l.cuentaCodigo].haber += l.haber;
        });
      });

      const resumenRows = Object.values(accMap).sort((a, b) => a.codigo.localeCompare(b.codigo));
      const totalDebe = resumenRows.reduce((s, r) => s + r.debe, 0);
      const totalHaber = resumenRows.reduce((s, r) => s + r.haber, 0);

      return {
        isDemo: true,
        comprobantes: comps,
        resumenRows,
        totalDebe,
        totalHaber
      };
    }

    // Datos reales
    const filteredComps = comprobantes
      .filter(c => isContabilizado(c) && (c.fecha || '').split('T')[0] >= localStartDate && (c.fecha || '').split('T')[0] <= localEndDate)
      .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

    const mappedComps = filteredComps.map(c => {
      const lineas = (c.lineas || []).map((l: any) => {
        const cId = String(l.cuentaId || l.cuenta_id || '').trim();
        const cObj = cuentasContables.find(item => 
          String(item.id) === cId || 
          String(item.codigo) === cId ||
          (item.codigo && item.codigo.replace(/\./g, '') === cId.replace(/\./g, ''))
        );
        return {
          cuentaCodigo: cObj?.codigo || l.cuentaCodigo || 'N/A',
          cuentaNombre: cObj?.nombre || l.cuentaNombre || 'Sin cuenta',
          debe: Number(l.debe) || 0,
          haber: Number(l.haber) || 0
        };
      });

      return {
        id: c.id,
        codigo: c.numero || c.codigo || 'S/N',
        numero: c.numero || '',
        fecha: c.fecha ? c.fecha.split('T')[0] : '',
        tipo: c.tipo || 'Diario',
        glosa: c.glosa || c.descripcion || c.concepto || 'Sin descripción',
        lineas
      };
    });

    let comps = mappedComps;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      comps = comps.filter(c => 
        c.codigo.toLowerCase().includes(q) || 
        c.glosa.toLowerCase().includes(q) ||
        c.lineas.some(l => l.cuentaCodigo.toLowerCase().includes(q) || l.cuentaNombre.toLowerCase().includes(q))
      );
    }

    const accMap: Record<string, { codigo: string; nombre: string; debe: number; haber: number }> = {};
    comps.forEach(c => {
      c.lineas.forEach(l => {
        if (!accMap[l.cuentaCodigo]) {
          accMap[l.cuentaCodigo] = { codigo: l.cuentaCodigo, nombre: l.cuentaNombre, debe: 0, haber: 0 };
        }
        accMap[l.cuentaCodigo].debe += l.debe;
        accMap[l.cuentaCodigo].haber += l.haber;
      });
    });

    const resumenRows = Object.values(accMap).sort((a, b) => a.codigo.localeCompare(b.codigo));
    const totalDebe = resumenRows.reduce((s, r) => s + r.debe, 0);
    const totalHaber = resumenRows.reduce((s, r) => s + r.haber, 0);

    return {
      isDemo: false,
      comprobantes: comps,
      resumenRows,
      totalDebe,
      totalHaber
    };
  };

  const handleOpenInNewWindow = () => {
    if (setStartDate) setStartDate(localStartDate);
    if (setEndDate) setEndDate(localEndDate);

    const data = computeData();

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
        background: rgba(168, 85, 247, 0.25);
        color: #d8b4fe;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 800;
        border: 1px solid rgba(168, 85, 247, 0.4);
      }
      .toolbar button.btn-print {
        background: #9333ea;
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
      .toolbar button.btn-print:hover { background: #7e22ce; }
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
      .asiento-card {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        margin-bottom: 14px;
        overflow: hidden;
        page-break-inside: avoid;
      }
      .asiento-header {
        background: #f8fafc;
        border-bottom: 1px solid #cbd5e1;
        padding: 6px 10px;
        font-size: 11px;
        display: flex;
        justify-content: space-between;
      }
      table.lines-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      table.lines-table th {
        background: #f1f5f9;
        border-bottom: 1px solid #cbd5e1;
        padding: 5px 8px;
        font-size: 10px;
        text-transform: uppercase;
        font-weight: bold;
      }
      table.lines-table td {
        border-bottom: 1px solid #f1f5f9;
        padding: 4px 8px;
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

    let generatedBodyHtml = '';

    if (viewMode === 'resumen') {
      // Formato Resumen de Diario
      generatedBodyHtml = `
        <div class="toolbar">
          <div class="title">
            <span>Resumen de Libro Diario</span>
            <span class="badge">Consolidado por Cuentas</span>
            <span style="font-size:12px; color:#94a3b8; font-weight:normal;">&bull; ${empresa?.nombre || 'HALLEY INSIGHTS'}</span>
          </div>
          <button class="btn-print" onclick="window.print()">
            &#128438; Imprimir Hoja Carta (Ctrl + P)
          </button>
        </div>

        <div class="sheet-container">
          <div class="sheet-page">
            <div>
              <div class="header-main">
                <h2 style="margin:0; font-size:18px; font-weight:900; text-transform:uppercase;">${empresa?.nombre || 'HALLEY INSIGHTS S.A.'}</h2>
                <p style="margin:3px 0; font-size:11px; color:#475569; font-weight:bold;">RIF / NIT: ${empresa?.rif || 'J-00000000-0'}</p>
                <h3 style="margin:8px 0 2px 0; font-size:15px; font-weight:900; color:#7e22ce; text-transform:uppercase; letter-spacing:1px;">
                  RESUMEN DE LIBRO DIARIO
                </h3>
                <p style="margin:0; font-size:11px; font-weight:bold; color:#64748b; text-transform:uppercase;">
                  DEL ${localStartDate} AL ${localEndDate} &bull; EXPRESADO EN DÓLARES (USD $)
                </p>
              </div>

              <table class="lines-table" style="margin-top:16px;">
                <thead>
                  <tr style="border-top:1px solid #cbd5e1;">
                    <th style="width:20%; text-align:left;">Código</th>
                    <th style="width:50%; text-align:left;">Nombre de la Cuenta</th>
                    <th style="width:15%; text-align:right;">Debe ($)</th>
                    <th style="width:15%; text-align:right;">Haber ($)</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.resumenRows.map(r => `
                    <tr>
                      <td class="font-mono" style="color:#64748b;">${r.codigo}</td>
                      <td style="text-transform:uppercase; font-weight:500;">${r.nombre}</td>
                      <td class="font-mono" style="text-align:right;">${r.debe > 0 ? '$' + formatoES(r.debe) : '$0,00'}</td>
                      <td class="font-mono" style="text-align:right;">${r.haber > 0 ? '$' + formatoES(r.haber) : '$0,00'}</td>
                    </tr>
                  `).join('')}

                  <tr style="background:#faf5ff; border-top:2px solid #0f172a; border-bottom:4px double #0f172a; font-weight:900;">
                    <td colspan="2" style="padding:10px 8px; text-transform:uppercase;">TOTALES SUMAS IGUALES</td>
                    <td class="font-mono" style="text-align:right; font-size:12px;">$${formatoES(data.totalDebe)}</td>
                    <td class="font-mono" style="text-align:right; font-size:12px;">$${formatoES(data.totalHaber)}</td>
                  </tr>
                </tbody>
              </table>

              ${configContable?.reportShowSignatures !== false ? `
                <div class="signatures">
                  <div><div class="sig-line"></div><strong>${configContable?.reportPreparadorName || 'Lic. María Delgado'}</strong><br><span style="color:#64748b;">Preparado por / Contador</span></div>
                  <div><div class="sig-line"></div><strong>${configContable?.reportRevisorName || 'Ing. Javier Espinoza'}</strong><br><span style="color:#64748b;">Revisado por / Auditor</span></div>
                  <div><div class="sig-line"></div><strong>${configContable?.reportAprobadorName || 'Dirección Ejecutiva'}</strong><br><span style="color:#64748b;">Aprobado por / Gerencia</span></div>
                </div>
              ` : ''}
            </div>

            <div class="footer-running">
              <span>Halley Insights ERP &bull; Resumen de Diario &bull; Fecha: ${new Date().toLocaleDateString('es-ES')}</span>
              <span>Página 1 de 1</span>
            </div>
          </div>
        </div>
      `;
    } else {
      // Formato Detalle de Asientos con paginación
      const COMPS_PER_PAGE = 3;
      const pages: any[][] = [];
      for (let i = 0; i < data.comprobantes.length; i += COMPS_PER_PAGE) {
        pages.push(data.comprobantes.slice(i, i + COMPS_PER_PAGE));
      }
      if (pages.length === 0) pages.push([]);

      generatedBodyHtml = `
        <div class="toolbar">
          <div class="title">
            <span>Libro Diario de Comprobantes</span>
            <span class="badge">Detalle Asiento por Asiento &bull; ${pages.length} Hojas</span>
            <span style="font-size:12px; color:#94a3b8; font-weight:normal;">&bull; ${empresa?.nombre || 'HALLEY INSIGHTS'}</span>
          </div>
          <button class="btn-print" onclick="window.print()">
            &#128438; Imprimir Hoja Carta (Ctrl + P)
          </button>
        </div>

        <div class="sheet-container">
          ${pages.map((pageComps, pIdx) => `
            <div class="sheet-page">
              <div>
                ${pIdx === 0 ? `
                  <div class="header-main">
                    <h2 style="margin:0; font-size:18px; font-weight:900; text-transform:uppercase;">${empresa?.nombre || 'HALLEY INSIGHTS S.A.'}</h2>
                    <p style="margin:3px 0; font-size:11px; color:#475569; font-weight:bold;">RIF / NIT: ${empresa?.rif || 'J-00000000-0'}</p>
                    <h3 style="margin:8px 0 2px 0; font-size:15px; font-weight:900; color:#7e22ce; text-transform:uppercase; letter-spacing:1px;">
                      LIBRO DIARIO DE ASIENTOS
                    </h3>
                    <p style="margin:0; font-size:11px; font-weight:bold; color:#64748b; text-transform:uppercase;">
                      DEL ${localStartDate} AL ${localEndDate} &bull; EXPRESADO EN DÓLARES (USD $)
                    </p>
                  </div>
                ` : `
                  <div style="display:flex; justify-content:space-between; border-bottom:1px solid #cbd5e1; padding-bottom:6px; margin-bottom:14px; font-size:10px; color:#64748b; font-weight:bold;">
                    <span>${empresa?.nombre || 'HALLEY INSIGHTS S.A.'} &bull; LIBRO DIARIO</span>
                    <span>Página ${pIdx + 1} de ${pages.length}</span>
                  </div>
                `}

                <div>
                  ${pageComps.map(comp => {
                    const cDebe = comp.lineas.reduce((s: number, l: any) => s + l.debe, 0);
                    const cHaber = comp.lineas.reduce((s: number, l: any) => s + l.haber, 0);
                    return `
                      <div class="asiento-card">
                        <div class="asiento-header">
                          <span><strong>Asiento Nº ${comp.codigo}</strong> &bull; Fecha: ${comp.fecha}</span>
                          <span style="font-size:10px; color:#64748b; font-weight:bold; text-transform:uppercase;">Tipo: ${comp.tipo}</span>
                        </div>
                        <div style="padding:6px 10px; font-size:11px; color:#334155; background:#ffffff; border-bottom:1px solid #f1f5f9;">
                          <strong>Glosa:</strong> ${comp.glosa}
                        </div>
                        <table class="lines-table">
                          <thead>
                            <tr>
                              <th style="width:20%; text-align:left;">Código</th>
                              <th style="width:50%; text-align:left;">Cuenta</th>
                              <th style="width:15%; text-align:right;">Debe</th>
                              <th style="width:15%; text-align:right;">Haber</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${comp.lineas.map((l: any) => `
                              <tr>
                                <td class="font-mono" style="color:#64748b;">${l.cuentaCodigo}</td>
                                <td>${l.cuentaNombre}</td>
                                <td class="font-mono" style="text-align:right;">${l.debe > 0 ? '$' + formatoES(l.debe) : '$0,00'}</td>
                                <td class="font-mono" style="text-align:right;">${l.haber > 0 ? '$' + formatoES(l.haber) : '$0,00'}</td>
                              </tr>
                            `).join('')}
                            <tr style="background:#f8fafc; font-weight:bold; border-top:1px solid #cbd5e1;">
                              <td colspan="2" style="font-size:10px; text-transform:uppercase;">SUMAS DEL ASIENTO</td>
                              <td class="font-mono" style="text-align:right;">$${formatoES(cDebe)}</td>
                              <td class="font-mono" style="text-align:right;">$${formatoES(cHaber)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    `;
                  }).join('')}
                </div>

                ${pIdx === pages.length - 1 && configContable?.reportShowSignatures !== false ? `
                  <div class="signatures">
                    <div><div class="sig-line"></div><strong>${configContable?.reportPreparadorName || 'Lic. María Delgado'}</strong><br><span style="color:#64748b;">Preparado por / Contador</span></div>
                    <div><div class="sig-line"></div><strong>${configContable?.reportRevisorName || 'Ing. Javier Espinoza'}</strong><br><span style="color:#64748b;">Revisado por / Auditor</span></div>
                    <div><div class="sig-line"></div><strong>${configContable?.reportAprobadorName || 'Dirección Ejecutiva'}</strong><br><span style="color:#64748b;">Aprobado por / Gerencia</span></div>
                  </div>
                ` : ''}
              </div>

              <div class="footer-running">
                <span>Halley Insights ERP &bull; Libro Diario &bull; Fecha: ${new Date().toLocaleDateString('es-ES')}</span>
                <span>Página ${pIdx + 1} de ${pages.length}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    const fullDoc = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Libro Diario - ${localStartDate} al ${localEndDate}</title>
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
    const data = computeData();
    const rows: any[] = [];
    rows.push({ A: empresa?.nombre || 'HALLEY INSIGHTS S.A.' });
    rows.push({ A: `RIF/NIT: ${empresa?.rif || 'N/A'}` });
    rows.push({ A: `LIBRO DIARIO (${viewMode === 'resumen' ? 'RESUMEN POR CUENTA' : 'DETALLE DE ASIENTOS'})` });
    rows.push({ A: `Período: del ${localStartDate} al ${localEndDate} | Moneda: USD ($)` });
    rows.push({});

    if (viewMode === 'resumen') {
      rows.push({
        A: 'Código Contable',
        B: 'Nombre de Cuenta',
        C: 'Debe ($)',
        D: 'Haber ($)'
      });

      data.resumenRows.forEach(r => {
        rows.push({
          A: r.codigo,
          B: r.nombre,
          C: r.debe,
          D: r.haber
        });
      });

      rows.push({});
      rows.push({
        A: 'TOTALES SUMAS',
        C: data.totalDebe,
        D: data.totalHaber
      });
    } else {
      rows.push({
        A: 'Asiento / N°',
        B: 'Fecha',
        C: 'Código',
        D: 'Cuenta Contable',
        E: 'Glosa / Concepto',
        F: 'Debe ($)',
        G: 'Haber ($)'
      });

      data.comprobantes.forEach(c => {
        c.lineas.forEach((l: any, idx: number) => {
          rows.push({
            A: idx === 0 ? c.codigo : '',
            B: idx === 0 ? c.fecha : '',
            C: l.cuentaCodigo,
            D: l.cuentaNombre,
            E: idx === 0 ? c.glosa : '',
            F: l.debe,
            G: l.haber
          });
        });
        rows.push({});
      });

      rows.push({
        A: 'TOTALES GENERALES',
        F: data.totalDebe,
        G: data.totalHaber
      });
    }

    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
    ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 40 }, { wch: 45 }, { wch: 16 }, { wch: 16 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Libro Diario');
    XLSX.writeFile(wb, `Libro_Diario_${localStartDate}_al_${localEndDate}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* ENCABEZADO */}
        <div className="p-5 md:p-6 border-b border-slate-100 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-50 border border-purple-100 text-purple-700">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight uppercase">
                    LIBRO DIARIO DE ASIENTOS
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                    COMPROBANTES CONTABLES
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {empresa?.nombre || 'Agencia de Viajes y Turismo Halley, C.A.'} • Del {localStartDate} al {localEndDate}
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
          {/* Formato de Visualización */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
              1. Selecciona el Formato de Emisión:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div 
                onClick={() => setViewMode('resumen')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  viewMode === 'resumen'
                    ? 'bg-white border-purple-600 shadow-md shadow-purple-500/10'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${viewMode === 'resumen' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  {viewMode === 'resumen' && (
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Resumen de Diario</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Consolidado por cuenta con sumas de Debe y Haber.</p>
                </div>
              </div>

              <div 
                onClick={() => setViewMode('detalle')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  viewMode === 'detalle'
                    ? 'bg-white border-purple-600 shadow-md shadow-purple-500/10'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${viewMode === 'detalle' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <ListFilter className="w-4 h-4" />
                  </div>
                  {viewMode === 'detalle' && (
                    <span className="w-2 h-2 rounded-full bg-purple-600" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Detalle Asiento por Asiento</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Comprobante por comprobante con glosa y cuentas.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
              2. Configuración y Búsqueda:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Buscar comprobante, glosa o cuenta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-purple-400 transition-all"
                />
              </div>

              <div className="text-xs text-slate-500 font-bold bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 flex items-center justify-between">
                <span>Estado de Comprobantes:</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px] font-black uppercase">
                  Contabilizados
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <button 
            onClick={handleExportExcel}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-purple-50 hover:border-purple-300 text-slate-700 hover:text-purple-700 text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-purple-600" />
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
              <ExternalLink className="w-4 h-4 text-purple-400" />
              <span>Ver Libro Diario en Ventana</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
