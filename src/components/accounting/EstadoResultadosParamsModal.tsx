import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  FileText, 
  PieChart as PieIcon, 
  Search, 
  ExternalLink, 
  FileSpreadsheet, 
  TrendingUp
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface EstadoResultadosParamsModalProps {
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
  return `<span style="font-weight:bold;">$${formatoES(n)}</span>`;
};

// Cuentas de muestra para resultados si el sistema no tiene movimientos registrados
const SAMPLE_PL_CUENTAS = [
  // 4. INGRESOS
  { id: 'pl-401', codigo: '4.1.01.001', nombre: 'Ingresos por Venta de Mercancías y Productos', grupo: '4', nat: 'Acreedora', saldo: 485600 },
  { id: 'pl-402', codigo: '4.1.01.002', nombre: 'Ingresos por Prestación de Servicios Comerciales', grupo: '4', nat: 'Acreedora', saldo: 242300 },
  { id: 'pl-403', codigo: '4.1.01.003', nombre: 'Ingresos por Asesorías y Consultorías', grupo: '4', nat: 'Acreedora', saldo: 38400 },
  { id: 'pl-404', codigo: '4.1.01.004', nombre: 'Servicios de Logística y Transporte Comercial', grupo: '4', nat: 'Acreedora', saldo: 61500 },
  { id: 'pl-405', codigo: '4.1.02.001', nombre: 'Descuentos y Bonificaciones Otorgados en Ventas', grupo: '4', nat: 'Deudora', saldo: -12800 },
  
  // 5. COSTOS
  { id: 'pl-501', codigo: '5.1.01.001', nombre: 'Costo de Ventas - Mercancías para la Venta', grupo: '5', nat: 'Deudora', saldo: 412000 },
  { id: 'pl-502', codigo: '5.1.01.002', nombre: 'Costos Directos de Servicios Prestados', grupo: '5', nat: 'Deudora', saldo: 178500 },
  { id: 'pl-503', codigo: '5.1.01.003', nombre: 'Comisiones Pagadas a Vendedores y Aliados', grupo: '5', nat: 'Deudora', saldo: 24600 },

  // 6. GASTOS OPERACIONALES
  { id: 'pl-601', codigo: '6.1.01.001', nombre: 'Sueldos, Salarios y Beneficios al Personal Operativo', grupo: '6', nat: 'Deudora', saldo: 45200 },
  { id: 'pl-602', codigo: '6.1.01.002', nombre: 'Aportes Patronales de Ley (Seguro Social, FAOV, INCES)', grupo: '6', nat: 'Deudora', saldo: 6800 },
  { id: 'pl-603', codigo: '6.1.01.003', nombre: 'Alquiler de Oficinas Administrativas y Sucursales', grupo: '6', nat: 'Deudora', saldo: 14400 },
  { id: 'pl-604', codigo: '6.1.01.004', nombre: 'Servicios Públicos (Electricidad, Telecomunicaciones, Agua)', grupo: '6', nat: 'Deudora', saldo: 4850 },
  { id: 'pl-605', codigo: '6.1.01.005', nombre: 'Publicidad Digital, Campañas y Redes Sociales', grupo: '6', nat: 'Deudora', saldo: 9200 },
  { id: 'pl-606', codigo: '6.1.01.006', nombre: 'Licencias de Software Contable y ERP Cloud', grupo: '6', nat: 'Deudora', saldo: 7500 },
  { id: 'pl-607', codigo: '6.1.01.007', nombre: 'Honorarios Profesionales Contables y Jurídicos', grupo: '6', nat: 'Deudora', saldo: 5400 },
  { id: 'pl-608', codigo: '6.1.01.008', nombre: 'Depreciación de Mobiliario y Equipos de Computación', grupo: '6', nat: 'Deudora', saldo: 6100 },
  { id: 'pl-609', codigo: '6.1.01.009', nombre: 'Mantenimiento General, Limpieza y Seguridad', grupo: '6', nat: 'Deudora', saldo: 3900 },

  // 7. OTROS INGRESOS
  { id: 'pl-701', codigo: '7.1.01.001', nombre: 'Ganancia en Diferencial Cambiario por Tenencia de Divisas', grupo: '7', nat: 'Acreedora', saldo: 18400 },
  { id: 'pl-702', codigo: '7.1.01.002', nombre: 'Intereses Bancarios Ganados en Cuentas Remuneradas', grupo: '7', nat: 'Acreedora', saldo: 2150 },

  // 8. OTROS EGRESOS
  { id: 'pl-801', codigo: '8.1.01.001', nombre: 'Comisiones y Gastos por Operaciones Bancarias', grupo: '8', nat: 'Deudora', saldo: 3450 },
  { id: 'pl-802', codigo: '8.1.01.002', nombre: 'Pérdida en Diferencial Cambiario', grupo: '8', nat: 'Deudora', saldo: 4100 },
  { id: 'pl-803', codigo: '8.1.01.003', nombre: 'Impuestos Municipales y Patente de Industria y Comercio', grupo: '8', nat: 'Deudora', saldo: 8650 },

  // 9. IMPUESTOS SOBRE LA RENTA
  { id: 'pl-901', codigo: '9.1.01.001', nombre: 'Provisión para Impuesto Sobre la Renta (ISLR Ejercicio)', grupo: '9', nat: 'Deudora', saldo: 14750 }
];

interface PrintBlock {
  id: string;
  type: 
    | 'group_header' 
    | 'account_row' 
    | 'subtotal_bar' 
    | 'kpi_margin_bar'
    | 'net_result_banner' 
    | 'signatures_block';
  height: number;
  data?: any;
}

export default function EstadoResultadosParamsModal({
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
}: EstadoResultadosParamsModalProps) {
  const [localStartDate, setLocalStartDate] = useState<string>(startDate || `${new Date().getFullYear()}-01-01`);
  const [localEndDate, setLocalEndDate] = useState<string>(endDate || new Date().toISOString().split('T')[0]);
  const [selectedViewMode, setSelectedViewMode] = useState<'visor' | 'dashboard'>('visor');
  const [hideZero, setHideZero] = useState<boolean>(true);
  const [showVerticalAnalysis, setShowVerticalAnalysis] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const useFullDemoPL = false;

  if (!isOpen) return null;

  // Cálculo de cuentas de resultados según período y comprobantes
  const computeData = () => {
    const isContabilizado = (c: any) => {
      if (!c.estado) return true;
      const e = String(c.estado).toLowerCase().trim();
      return e === 'contabilizado' || e === 'aprobado' || e === 'registrado';
    };

    const hasLiveComps = comprobantes.some(isContabilizado);
    const hasAccounts = cuentasContables && cuentasContables.length > 0;
    const isDemo = useFullDemoPL || (!hasLiveComps && !hasAccounts);

    if (isDemo) {
      let filtered = SAMPLE_PL_CUENTAS;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(c => c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q));
      }
      if (hideZero) {
        filtered = filtered.filter(c => Math.abs(c.saldo) > 0.009);
      }

      const totalIngresos = filtered.filter(c => c.grupo === '4').reduce((sum, c) => sum + c.saldo, 0);
      const totalCostos = filtered.filter(c => c.grupo === '5').reduce((sum, c) => sum + Math.abs(c.saldo), 0);
      const utilidadBruta = totalIngresos - totalCostos;
      
      const totalGastosOp = filtered.filter(c => c.grupo === '6').reduce((sum, c) => sum + Math.abs(c.saldo), 0);
      const utilidadOperativa = utilidadBruta - totalGastosOp;

      const totalOtrosIngresos = filtered.filter(c => c.grupo === '7').reduce((sum, c) => sum + Math.abs(c.saldo), 0);
      const totalOtrosGastos = filtered.filter(c => c.grupo === '8').reduce((sum, c) => sum + Math.abs(c.saldo), 0);
      const totalImpuestos = filtered.filter(c => c.grupo === '9').reduce((sum, c) => sum + Math.abs(c.saldo), 0);

      const utilidadNeta = utilidadOperativa + totalOtrosIngresos - totalOtrosGastos - totalImpuestos;

      return {
        isDemo: true,
        cuentas: filtered,
        totalIngresos,
        totalCostos,
        utilidadBruta,
        totalGastosOp,
        utilidadOperativa,
        totalOtrosIngresos,
        totalOtrosGastos,
        totalImpuestos,
        utilidadNeta,
        grupos: [
          { digito: '4', nombre: '4. INGRESOS OPERACIONALES', cuentas: filtered.filter(c => c.grupo === '4'), total: totalIngresos, isPositive: true },
          { digito: '5', nombre: '5. COSTOS DE OPERACIÓN Y VENTAS', cuentas: filtered.filter(c => c.grupo === '5'), total: totalCostos, isPositive: false },
          { digito: '6', nombre: '6. GASTOS DE OPERACIÓN Y ADMINISTRACIÓN', cuentas: filtered.filter(c => c.grupo === '6'), total: totalGastosOp, isPositive: false },
          { digito: '7', nombre: '7. OTROS INGRESOS NO OPERACIONALES', cuentas: filtered.filter(c => c.grupo === '7'), total: totalOtrosIngresos, isPositive: true },
          { digito: '8', nombre: '8. OTROS EGRESOS Y GASTOS EXTRAORDINARIOS', cuentas: filtered.filter(c => c.grupo === '8'), total: totalOtrosGastos, isPositive: false },
          { digito: '9', nombre: '9. IMPUESTOS Y CUENTAS ESPECIALES', cuentas: filtered.filter(c => c.grupo === '9'), total: totalImpuestos, isPositive: false }
        ]
      };
    }

    // Datos Reales
    const periodComps = comprobantes.filter(
      c => isContabilizado(c) && (c.fecha || '').split('T')[0] >= localStartDate && (c.fecha || '').split('T')[0] <= localEndDate
    );

    const cuentasMov = cuentasContables.filter(c => {
      const first = c.codigo?.charAt(0);
      return first >= '4' && first <= '9';
    });

    const saldos: Record<string, { debe: number; haber: number }> = {};
    cuentasMov.forEach(c => {
      saldos[c.id] = { debe: 0, haber: 0 };
    });

    periodComps.forEach(comp => {
      (comp.lineas || []).forEach((linea: any) => {
        const cId = String(linea.cuentaId || linea.cuenta_id || '').trim();
        if (!cId) return;
        const matched = cuentasMov.find(item => 
          String(item.id) === cId || 
          String(item.codigo) === cId ||
          (item.codigo && item.codigo.replace(/\./g, '') === cId.replace(/\./g, ''))
        );
        if (matched && saldos[matched.id]) {
          saldos[matched.id].debe += Number(linea.debe) || 0;
          saldos[matched.id].haber += Number(linea.haber) || 0;
        }
      });
    });

    const mappedCuentas = cuentasMov.map(c => {
      const first = c.codigo?.charAt(0);
      const nat = c.naturaleza || ((first === '4' || first === '7') ? 'Acreedora' : 'Deudora');
      const { debe, haber } = saldos[c.id] || { debe: 0, haber: 0 };
      const saldo = nat === 'Acreedora' ? (haber - debe) : (debe - haber);
      return {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        grupo: first,
        nat,
        debe,
        haber,
        saldo
      };
    });

    let filtered = mappedCuentas;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => c.codigo.toLowerCase().includes(q) || c.nombre.toLowerCase().includes(q));
    }
    if (hideZero) {
      filtered = filtered.filter(c => Math.abs(c.saldo) > 0.009);
    }

    const totalIngresos = filtered.filter(c => c.grupo === '4').reduce((sum, c) => sum + c.saldo, 0);
    const totalCostos = filtered.filter(c => c.grupo === '5').reduce((sum, c) => sum + c.saldo, 0);
    const utilidadBruta = totalIngresos - totalCostos;
    
    const totalGastosOp = filtered.filter(c => c.grupo === '6').reduce((sum, c) => sum + c.saldo, 0);
    const utilidadOperativa = utilidadBruta - totalGastosOp;

    const totalOtrosIngresos = filtered.filter(c => c.grupo === '7').reduce((sum, c) => sum + c.saldo, 0);
    const totalOtrosGastos = filtered.filter(c => c.grupo === '8').reduce((sum, c) => sum + c.saldo, 0);
    const totalImpuestos = filtered.filter(c => c.grupo === '9').reduce((sum, c) => sum + c.saldo, 0);

    const utilidadNeta = utilidadOperativa + totalOtrosIngresos - totalOtrosGastos - totalImpuestos;

    return {
      isDemo: false,
      cuentas: filtered,
      totalIngresos,
      totalCostos,
      utilidadBruta,
      totalGastosOp,
      utilidadOperativa,
      totalOtrosIngresos,
      totalOtrosGastos,
      totalImpuestos,
      utilidadNeta,
      grupos: [
        { digito: '4', nombre: '4. INGRESOS OPERACIONALES', cuentas: filtered.filter(c => c.grupo === '4'), total: totalIngresos, isPositive: true },
        { digito: '5', nombre: '5. COSTOS DE OPERACIÓN Y VENTAS', cuentas: filtered.filter(c => c.grupo === '5'), total: totalCostos, isPositive: false },
        { digito: '6', nombre: '6. GASTOS DE OPERACIÓN Y ADMINISTRACIÓN', cuentas: filtered.filter(c => c.grupo === '6'), total: totalGastosOp, isPositive: false },
        { digito: '7', nombre: '7. OTROS INGRESOS NO OPERACIONALES', cuentas: filtered.filter(c => c.grupo === '7'), total: totalOtrosIngresos, isPositive: true },
        { digito: '8', nombre: '8. OTROS EGRESOS Y GASTOS EXTRAORDINARIOS', cuentas: filtered.filter(c => c.grupo === '8'), total: totalOtrosGastos, isPositive: false },
        { digito: '9', nombre: '9. IMPUESTOS Y CUENTAS ESPECIALES', cuentas: filtered.filter(c => c.grupo === '9'), total: totalImpuestos, isPositive: false }
      ]
    };
  };

  // Abrir ventana nueva con formato de impresión Hoja Carta oficial
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
        background: rgba(16, 185, 129, 0.25);
        color: #6ee7b7;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 800;
        border: 1px solid rgba(16, 185, 129, 0.4);
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
      .row-item { display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; font-size: 12px; border-bottom: 1px dashed #e2e8f0; }
      .group-header { background: #0f172a; color: white; padding: 6px 10px; font-weight: 900; font-size: 12px; text-transform: uppercase; margin: 10px 0 4px 0; border-radius: 4px; display: flex; justify-content: space-between; }
      .subtotal-bar { display: flex; justify-content: space-between; font-weight: bold; padding: 6px 8px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; background: #f8fafc; font-size: 12px; margin: 4px 0; color: #1e293b; }
      .kpi-margin-bar { display: flex; justify-content: space-between; font-weight: 900; padding: 8px 10px; border-top: 1px solid #0f172a; border-bottom: 2px solid #0f172a; background: #f1f5f9; font-size: 13px; margin: 8px 0; }
      .net-result { display: flex; justify-content: space-between; font-weight: 900; padding: 12px 14px; border-top: 2px solid #0f172a; border-bottom: 4px double #0f172a; font-size: 15px; margin: 12px 0; }
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

    // Generación de bloques para paginación
    const blocks: PrintBlock[] = [];

    data.grupos.forEach(grp => {
      if (grp.cuentas.length === 0) return;

      blocks.push({
        id: `gh-${grp.digito}`,
        type: 'group_header',
        height: 34,
        data: { title: grp.nombre }
      });

      grp.cuentas.forEach(c => {
        const pct = data.totalIngresos > 0 ? (Math.abs(c.saldo) / data.totalIngresos) * 100 : 0;
        blocks.push({
          id: `row-${c.id}`,
          type: 'account_row',
          height: 25,
          data: { cuenta: c, pct }
        });
      });

      blocks.push({
        id: `sub-${grp.digito}`,
        type: 'subtotal_bar',
        height: 30,
        data: { title: `SUBTOTAL ${grp.nombre}`, total: grp.total }
      });

      if (grp.digito === '5') {
        blocks.push({
          id: 'kpi-bruta',
          type: 'kpi_margin_bar',
          height: 38,
          data: { title: 'UTILIDAD BRUTA (MARGEN BRUTO EN VENTAS)', total: data.utilidadBruta }
        });
      }

      if (grp.digito === '6') {
        blocks.push({
          id: 'kpi-operativa',
          type: 'kpi_margin_bar',
          height: 38,
          data: { title: 'UTILIDAD OPERACIONAL (EBITDA / RENDIMIENTO)', total: data.utilidadOperativa }
        });
      }
    });

    // Resultado Final
    blocks.push({
      id: 'net-result',
      type: 'net_result_banner',
      height: 50,
      data: { total: data.utilidadNeta }
    });

    if (configContable?.reportShowSignatures !== false) {
      blocks.push({ id: 'blk-firmas', type: 'signatures_block', height: 125 });
    }

    // Paginación
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

    const generatedBodyHtml = `
      <div class="toolbar">
        <div class="title">
          <span>Estado de Pérdidas y Ganancias (P&L)</span>
          <span class="badge">Visor Hoja Carta (${sheets.length} ${sheets.length === 1 ? 'Hoja' : 'Hojas'})</span>
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
                  <h3 style="margin:8px 0 2px 0; font-size:15px; font-weight:900; color:#047857; text-transform:uppercase; letter-spacing:1px;">ESTADO DE RESULTADOS (P&L)</h3>
                  <p style="margin:0; font-size:11px; font-weight:bold; color:#64748b; text-transform:uppercase;">DEL ${localStartDate} AL ${localEndDate} &bull; EXPRESADO EN DÓLARES (USD $)</p>
                </div>
              ` : `
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #cbd5e1; padding-bottom:6px; margin-bottom:12px; font-size:10px; color:#64748b; font-weight:bold;">
                  <span>${empresa?.nombre || 'HALLEY INSIGHTS S.A.'} &bull; ESTADO DE RESULTADOS (P&L)</span>
                  <span>Página ${sIdx + 1} de ${sheets.length}</span>
                </div>
              `}

              <div>
                ${sheetBlocks.map(block => {
                  if (block.type === 'group_header') {
                    return `<div class="group-header"><span>${block.data.title}</span></div>`;
                  }
                  if (block.type === 'account_row') {
                    const c = block.data.cuenta;
                    return `
                      <div class="row-item">
                        <span><span class="font-mono" style="color:#64748b; margin-right:6px;">${c.codigo}</span>${c.nombre}</span>
                        <span style="display:flex; gap:14px; align-items:center;">
                          ${showVerticalAnalysis ? `<span class="font-mono" style="color:#94a3b8; font-size:10px;">${block.data.pct.toFixed(1)}%</span>` : ''}
                          <span class="font-mono">${formatMontoContableHtml(c.saldo)}</span>
                        </span>
                      </div>
                    `;
                  }
                  if (block.type === 'subtotal_bar') {
                    return `<div class="subtotal-bar"><span>${block.data.title}</span><span class="font-mono">${formatMontoContableHtml(block.data.total)}</span></div>`;
                  }
                  if (block.type === 'kpi_margin_bar') {
                    return `<div class="kpi-margin-bar"><span>${block.data.title}</span><span class="font-mono">${formatMontoContableHtml(block.data.total)}</span></div>`;
                  }
                  if (block.type === 'net_result_banner') {
                    const isPos = block.data.total >= 0;
                    const bg = isPos ? '#ecfdf5' : '#fff1f2';
                    const col = isPos ? '#047857' : '#be123c';
                    return `
                      <div class="net-result" style="background:${bg}; color:${col}; border-color:${col};">
                        <span>${isPos ? 'UTILIDAD NETA DEL EJERCICIO' : 'PÉRDIDA NETA DEL EJERCICIO'}</span>
                        <span class="font-mono">${formatMontoContableHtml(block.data.total)}</span>
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
              <span>Halley Insights ERP &bull; Estado de Pérdidas y Ganancias &bull; Fecha: ${new Date().toLocaleDateString('es-ES')}</span>
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
        <title>Estado de Resultados - ${localStartDate} al ${localEndDate}</title>
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
    const data = computeData();
    const rows: any[] = [];
    rows.push({ A: empresa?.nombre || 'HALLEY INSIGHTS S.A.' });
    rows.push({ A: `RIF/NIT: ${empresa?.rif || 'N/A'}` });
    rows.push({ A: 'ESTADO DE RESULTADOS (P&L)' });
    rows.push({ A: `Período: del ${localStartDate} al ${localEndDate} | Moneda: USD ($)` });
    rows.push({});

    rows.push({
      A: 'Código Contable',
      B: 'Nombre de la Cuenta',
      C: 'Naturaleza',
      D: 'Saldo Período ($)',
      E: '% Peso S/ Ingresos'
    });

    data.grupos.forEach(grp => {
      if (grp.cuentas.length === 0) return;
      rows.push({ A: grp.nombre, B: '', C: '', D: '', E: '' });
      grp.cuentas.forEach(c => {
        const pct = data.totalIngresos > 0 ? (Math.abs(c.saldo) / data.totalIngresos) * 100 : 0;
        rows.push({
          A: c.codigo,
          B: `  ${c.nombre}`,
          C: c.nat,
          D: c.saldo,
          E: `${pct.toFixed(2)}%`
        });
      });
      rows.push({ A: `SUBTOTAL ${grp.nombre}`, D: grp.total });
      if (grp.digito === '5') {
        rows.push({ A: 'UTILIDAD BRUTA (MARGEN)', D: data.utilidadBruta });
      }
      if (grp.digito === '6') {
        rows.push({ A: 'UTILIDAD OPERATIVA (EBITDA)', D: data.utilidadOperativa });
      }
      rows.push({});
    });

    rows.push({
      A: data.utilidadNeta >= 0 ? 'UTILIDAD NETA DEL EJERCICIO' : 'PÉRDIDA NETA DEL EJERCICIO',
      D: data.utilidadNeta,
      E: data.totalIngresos > 0 ? `${((data.utilidadNeta / data.totalIngresos) * 100).toFixed(2)}%` : '0.00%'
    });

    const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
    ws['!cols'] = [{ wch: 18 }, { wch: 45 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estado de Resultados');
    XLSX.writeFile(wb, `Estado_Resultados_${localStartDate}_al_${localEndDate}.xlsx`);
  };

  const previewData = computeData();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* ENCABEZADO */}
        <div className="p-5 md:p-6 border-b border-slate-100 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight uppercase">
                    ESTADO DE RESULTADOS (P&L)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    RENDIMIENTO OPERATIVO
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {empresa?.nombre || 'Corporación Halley, C.A.'} • Rendimiento del {localStartDate} al {localEndDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Selectores de Fecha */}
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

        <div className="p-6 space-y-6 bg-slate-50/50">
          {/* Formato de Presentación */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
              1. Selecciona el Formato de Presentación:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div 
                onClick={() => setSelectedViewMode('visor')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  selectedViewMode === 'visor'
                    ? 'bg-white border-emerald-600 shadow-md shadow-emerald-500/10'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${selectedViewMode === 'visor' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  {selectedViewMode === 'visor' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Visor Hoja Carta NIIF</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Paginado físico oficial (8.5" × 11") listo para imprimir con firmas.</p>
                </div>
              </div>

              <div 
                onClick={() => setSelectedViewMode('dashboard')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                  selectedViewMode === 'dashboard'
                    ? 'bg-white border-emerald-600 shadow-md shadow-emerald-500/10'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-xl ${selectedViewMode === 'dashboard' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <PieIcon className="w-4 h-4" />
                  </div>
                  {selectedViewMode === 'dashboard' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">Márgenes y Estructura</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">KPIs de Margen Bruto, Operativo y Utilidad Neta.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Opciones y Filtros Contables */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500">
              2. Configuración y Filtros del Reporte:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-center">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Buscar cuenta o código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:outline-hidden focus:border-emerald-400 transition-all"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors select-none">
                <input 
                  type="checkbox"
                  checked={hideZero}
                  onChange={(e) => setHideZero(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Ocultar cuentas con saldo $0</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors select-none">
                <input 
                  type="checkbox"
                  checked={showVerticalAnalysis}
                  onChange={(e) => setShowVerticalAnalysis(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span>% Peso sobre Ingresos</span>
              </label>
            </div>
          </div>
        </div>

        {/* FOOTER */}
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

            <button
              onClick={handleOpenInNewWindow}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition-all shadow-md cursor-pointer active:scale-95"
            >
              <ExternalLink className="w-4 h-4 text-emerald-400" />
              <span>Ver Estado de Resultados en Ventana</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
