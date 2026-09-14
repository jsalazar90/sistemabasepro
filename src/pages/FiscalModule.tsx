import React, { useState, useMemo } from 'react';
import { 
  Receipt, 
  FileText, 
  Download, 
  Printer, 
  Calendar, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  Scale, 
  ShieldCheck, 
  FileCode, 
  X 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import BackButton from '../components/common/BackButton';
import { 
  FacturaCompraModel, 
  FacturaVentaModel, 
  CuentaContableModel 
} from '../types/database';
import { getTasaForDate } from '../services/exchangeRateService';

interface FiscalModuleProps {
  facturasCompra?: FacturaCompraModel[];
  facturasVenta?: FacturaVentaModel[];
  comprobantes?: any[];
  cuentasContables?: CuentaContableModel[];
  empresa?: any;
  configContable?: any;
  workingYear?: string;
  onSave?: (collection: string, data: any) => Promise<any> | void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function FiscalModule({
  facturasCompra = [],
  facturasVenta = [],
  cuentasContables = [],
  empresa = {},
  workingYear,
  showToast
}: FiscalModuleProps) {
  // Pestaña activa
  const [activeTab, setActiveTab] = useState<'compras' | 'ventas' | 'retenciones' | 'txt_seniat' | 'cuadre'>('compras');

  // Filtros de Período
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const defaultYear = workingYear || String(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<string>(defaultYear);

  // Moneda de visualización: 'VES' (Obligatoria formalmente para libros) o 'USD' (Moneda base contable)
  const [monedaVista, setMonedaVista] = useState<'VES' | 'USD'>('VES');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Tasa actual de referencia
  const [tasaLive] = useState<number>(() => getTasaForDate());

  // Modal para Previsualizar/Imprimir Comprobante de Retención
  const [previewRetencion, setPreviewRetencion] = useState<any | null>(null);

  // Helper de Formato de Número
  const formatoES = (num: number | string | undefined | null) => {
    const n = Number(num) || 0;
    return new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  };

  const periodPrefix = `${selectedYear}-${selectedMonth}`;
  const periodLabel = `${selectedMonth}/${selectedYear}`;

  // =========================================================================
  // 1. DATA: LIBRO DE COMPRAS FISCAL
  // =========================================================================
  const libroComprasData = useMemo(() => {
    const filtradas = facturasCompra.filter(f => {
      if (!f.fecha_emision) return false;
      const fPeriod = f.fecha_emision.substring(0, 7);
      const matchesPeriod = fPeriod === periodPrefix;
      const matchesSearch = !searchQuery.trim() || 
        (f.proveedor_nombre || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.proveedor_rif || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.numero || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.control_numero || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPeriod && matchesSearch && f.estado !== 'anulada';
    });

    const ordenadas = [...filtradas].sort((a, b) => (a.fecha_emision || '').localeCompare(b.fecha_emision || ''));

    let totalComprasConIva = 0;
    let totalExento = 0;
    let totalBase16 = 0;
    let totalIva16 = 0;
    let totalIgtf = 0;
    let totalRetIva = 0;
    let totalRetIslr = 0;

    const items: any[] = [];
    let opCounter = 1;

    ordenadas.forEach((f) => {
      const tc = Number(f.tasa_cambio) || tasaLive || 1;
      const isVES = monedaVista === 'VES';

      const totalDoc = isVES 
        ? (f.total_bs ?? f.total * tc) 
        : f.total;
      const exento = isVES 
        ? (f.monto_exento_bs ?? (f.monto_exento || 0) * tc) 
        : (f.monto_exento || 0);
      const base = isVES 
        ? (f.base_imponible_bs ?? (f.base_imponible || 0) * tc) 
        : (f.base_imponible || 0);
      const iva = isVES 
        ? (f.iva_monto_bs ?? (f.iva_monto || 0) * tc) 
        : (f.iva_monto || 0);
      const igtf = isVES 
        ? (f.igtf_monto_bs ?? (f.igtf_monto || 0) * tc) 
        : (f.igtf_monto || 0);
      const retIva = isVES 
        ? (f.retencion_iva_monto_bs ?? (f.retencion_iva_monto || 0) * tc) 
        : (f.retencion_iva_monto || 0);
      const retIslr = isVES 
        ? (f.retencion_islr_monto_bs ?? (f.retencion_islr_monto || 0) * tc) 
        : (f.retencion_islr_monto || 0);

      totalComprasConIva += totalDoc;
      totalExento += exento;
      totalBase16 += base;
      totalIva16 += iva;
      totalIgtf += igtf;
      totalRetIva += retIva;
      totalRetIslr += retIslr;

      // 1. FILA DE LA COMPRA / FACTURA
      items.push({
        ...f,
        idFila: `cmp_${f.id}`,
        tipoFila: 'factura',
        operacion: opCounter++,
        fecha: f.fecha_emision,
        proveedorRif: f.proveedor_rif || 'J-00000000-0',
        proveedorNombre: f.proveedor_nombre,
        numComprobanteRet: '',
        numeroDoc: f.numero,
        controlDoc: f.control_numero || '00-000000',
        tipoTransaccion: '01 Registro',
        facturaAfectada: '',
        totalDoc,
        exento,
        base,
        iva,
        retIva: 0,
        tasaCambioDoc: tc
      });

      // 2. FILA DE RETENCIÓN DE IVA EMITIDA (SI EXISTE) - SIEMPRE DEBAJO DE LA FACTURA
      if (retIva > 0) {
        const numCompRet = `${selectedYear}${selectedMonth}${String(opCounter).padStart(8, '0')}`;
        items.push({
          ...f,
          idFila: `ret_iva_cmp_${f.id}`,
          tipoFila: 'retencion_iva',
          operacion: opCounter++,
          fecha: f.fecha_emision,
          proveedorRif: f.proveedor_rif || 'J-00000000-0',
          proveedorNombre: f.proveedor_nombre,
          numComprobanteRet: numCompRet,
          numeroDoc: '',
          controlDoc: '',
          tipoTransaccion: '01 Registro',
          facturaAfectada: f.numero,
          totalDoc: 0,
          exento: 0,
          base: 0,
          iva: 0,
          retIva: retIva,
          tasaCambioDoc: tc
        });
      }
    });

    return {
      items,
      totalComprasConIva,
      totalExento,
      totalBase16,
      totalIva16,
      totalIgtf,
      totalRetIva,
      totalRetIslr
    };
  }, [facturasCompra, periodPrefix, searchQuery, monedaVista, tasaLive, selectedYear, selectedMonth]);

  // =========================================================================
  // 2. DATA: LIBRO DE VENTAS FISCAL
  // =========================================================================
  const libroVentasData = useMemo(() => {
    const filtradas = facturasVenta.filter(f => {
      if (!f.fecha_emision) return false;
      const fPeriod = f.fecha_emision.substring(0, 7);
      const matchesPeriod = fPeriod === periodPrefix;
      const matchesSearch = !searchQuery.trim() || 
        (f.cliente_nombre || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.cliente_rif || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.numero || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.control_numero || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPeriod && matchesSearch && f.estado !== 'anulada';
    });

    const ordenadas = [...filtradas].sort((a, b) => (a.fecha_emision || '').localeCompare(b.fecha_emision || ''));

    let totalVentasConIva = 0;
    let totalExento = 0;
    let totalBase16 = 0;
    let totalIva16 = 0;
    let totalIgtf = 0;
    let totalRetIva = 0;
    let totalRetIslr = 0;

    const items: any[] = [];
    let opCounter = 1;

    ordenadas.forEach((f) => {
      const tc = Number(f.tasa_cambio) || tasaLive || 1;
      const isVES = monedaVista === 'VES';

      const totalDoc = isVES 
        ? (f.total_bs ?? f.total * tc) 
        : f.total;
      const exento = isVES 
        ? (f.monto_exento_bs ?? (f.monto_exento || 0) * tc) 
        : (f.monto_exento || 0);
      const base = isVES 
        ? (f.base_imponible_bs ?? (f.base_imponible || 0) * tc) 
        : (f.base_imponible || 0);
      const iva = isVES 
        ? (f.iva_monto_bs ?? (f.iva_monto || 0) * tc) 
        : (f.iva_monto || 0);
      const igtf = isVES 
        ? (f.igtf_monto_bs ?? (f.igtf_monto || 0) * tc) 
        : (f.igtf_monto || 0);
      const retIva = isVES 
        ? (f.retencion_iva_monto_bs ?? (f.retencion_iva_monto || 0) * tc) 
        : (f.retencion_iva_monto || 0);
      const retIslr = isVES 
        ? (f.retencion_islr_monto_bs ?? (f.retencion_islr_monto || 0) * tc) 
        : (f.retencion_islr_monto || 0);

      totalVentasConIva += totalDoc;
      totalExento += exento;
      totalBase16 += base;
      totalIva16 += iva;
      totalIgtf += igtf;
      totalRetIva += retIva;
      totalRetIslr += retIslr;

      // 1. FILA DE LA FACTURA
      items.push({
        ...f,
        idFila: `fac_${f.id}`,
        tipoFila: 'factura',
        operacion: opCounter++,
        fecha: f.fecha_emision,
        clienteRif: f.cliente_rif || 'V-00000000',
        clienteNombre: f.cliente_nombre,
        numeroDoc: f.numero,
        controlDoc: f.control_numero || '00-000000',
        numComprobanteRet: '',
        tipoTransaccion: '01 Registro',
        facturaAfectada: '',
        totalDoc,
        exento,
        base,
        iva,
        retIva: 0,
        tasaCambioDoc: tc
      });

      // 2. FILA DE RETENCIÓN DE IVA (SI EXISTE) - SIEMPRE DEBAJO DE LA FACTURA
      if (retIva > 0) {
        items.push({
          ...f,
          idFila: `ret_iva_${f.id}`,
          tipoFila: 'retencion_iva',
          operacion: opCounter++,
          fecha: f.comprobante_retencion_iva_fecha || f.fecha_emision,
          clienteRif: f.cliente_rif || 'V-00000000',
          clienteNombre: f.cliente_nombre,
          numeroDoc: '',
          controlDoc: f.control_numero || '00-000000',
          numComprobanteRet: f.comprobante_retencion_iva_numero || `RET-${f.numero}`,
          tipoTransaccion: '01 Registro',
          facturaAfectada: f.numero,
          totalDoc: 0,
          exento: 0,
          base: 0,
          iva: 0,
          retIva: retIva,
          tasaCambioDoc: tc
        });
      }

      // 3. FILA DE RETENCIÓN DE ISLR: POR DEBAJO DE LA FACTURA
      if (retIslr > 0) {
        items.push({
          ...f,
          idFila: `ret_islr_${f.id}`,
          tipoFila: 'retencion_islr',
          operacion: opCounter++,
          fecha: f.comprobante_retencion_islr_fecha || f.fecha_emision,
          clienteRif: f.cliente_rif || 'V-00000000',
          clienteNombre: f.cliente_nombre,
          tipoDocumento: '04-ISLR',
          numeroDoc: f.comprobante_retencion_islr_numero || `ISLR-${f.numero}`,
          controlDoc: f.control_numero || 'S/C',
          facturaAfectada: f.numero,
          totalDoc: 0,
          exento: 0,
          base: 0,
          alicuota: `${f.retencion_islr_porcentaje || 2}%`,
          iva: 0,
          igtf: 0,
          retIva: 0,
          retIslr: retIslr,
          tasaCambioDoc: tc
        });
      }
    });

    return {
      items,
      totalVentasConIva,
      totalExento,
      totalBase16,
      totalIva16,
      totalIgtf,
      totalRetIva,
      totalRetIslr
    };
  }, [facturasVenta, periodPrefix, searchQuery, monedaVista, tasaLive]);

  // =========================================================================
  // 3. DATA: CUADRE FISCAL VS CONTABILIDAD
  // =========================================================================
  const cuadreFiscal = useMemo(() => {
    const debitoFiscalVentasUSD = facturasVenta
      .filter(f => f.fecha_emision?.substring(0, 7) === periodPrefix && f.estado !== 'anulada')
      .reduce((acc, f) => acc + (f.iva_monto || 0), 0);

    const creditoFiscalComprasUSD = facturasCompra
      .filter(f => f.fecha_emision?.substring(0, 7) === periodPrefix && f.estado !== 'anulada')
      .reduce((acc, f) => acc + (f.iva_monto || 0), 0);

    const retencionesIvaSoportadasUSD = facturasVenta
      .filter(f => f.fecha_emision?.substring(0, 7) === periodPrefix && f.estado !== 'anulada')
      .reduce((acc, f) => acc + (f.retencion_iva_monto || 0), 0);

    const retencionesIvaPorEnterarUSD = facturasCompra
      .filter(f => f.fecha_emision?.substring(0, 7) === periodPrefix && f.estado !== 'anulada')
      .reduce((acc, f) => acc + (f.retencion_iva_monto || 0), 0);

    const findAccountSaldo = (searchPattern: string) => {
      const cta = cuentasContables.find(c => 
        (c.codigo || '').includes(searchPattern) || 
        (c.nombre || '').toLowerCase().includes(searchPattern.toLowerCase())
      );
      return cta ? Number((cta as any).saldoActual ?? cta.saldo_actual ?? 0) : 0;
    };

    const cuentaDebitoFiscalSaldo = findAccountSaldo('2.1.2.01') || findAccountSaldo('Débito Fiscal');
    const cuentaCreditoFiscalSaldo = findAccountSaldo('1.1.3.03') || findAccountSaldo('Crédito Fiscal');
    const cuentaRetIvaPorEnterarSaldo = findAccountSaldo('2.1.03.002') || findAccountSaldo('Retenciones de IVA por Enterar');

    const cuotaTributariaMes = debitoFiscalVentasUSD - creditoFiscalComprasUSD;
    const totalPagarFisco = Math.max(0, cuotaTributariaMes - retencionesIvaSoportadasUSD);
    const excedenteCreditoFiscal = cuotaTributariaMes < 0 ? Math.abs(cuotaTributariaMes) : 0;

    return {
      debitoFiscalVentasUSD,
      creditoFiscalComprasUSD,
      retencionesIvaSoportadasUSD,
      retencionesIvaPorEnterarUSD,
      cuotaTributariaMes,
      totalPagarFisco,
      excedenteCreditoFiscal,
      cuentaDebitoFiscalSaldo,
      cuentaCreditoFiscalSaldo,
      cuentaRetIvaPorEnterarSaldo,
      diferenciaDebito: Math.abs(debitoFiscalVentasUSD - Math.abs(cuentaDebitoFiscalSaldo)),
      diferenciaCredito: Math.abs(creditoFiscalComprasUSD - Math.abs(cuentaCreditoFiscalSaldo))
    };
  }, [libroVentasData, libroComprasData, cuentasContables]);

  // =========================================================================
  // EXPORTACIÓN EXCEL
  // =========================================================================
  const handleExportExcel = (type: 'compras' | 'ventas') => {
    if (type === 'compras') {
      const rows = libroComprasData.items.map(i => ({
        'Nº de Operación': i.operacion,
        'Fecha del Documento': i.fecha,
        'Nº R.I.F.': i.proveedorRif,
        'Proveedor o Razón Social': i.proveedorNombre,
        'Nº de Comprobante de Retención': i.numComprobanteRet,
        'Nº de Factura': i.numeroDoc,
        'Nº de Control': i.controlDoc,
        'Tipo de Transacción': i.tipoTransaccion,
        'Nº de Documento Afectado': i.facturaAfectada,
        'Total Compras Incluyendo el IVA': i.totalDoc,
        'Base 16%': i.base,
        'IVA 16%': i.iva,
        'IVA Retenido (al vendedor)': i.retIva
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Libro_Compras_${periodLabel.replace('/', '_')}`);
      XLSX.writeFile(wb, `Libro_Compras_Fiscal_${periodLabel.replace('/', '_')}.xlsx`);
      showToast?.('Libro de Compras exportado a Excel exitosamente.', 'success');
    } else {
      const rows = libroVentasData.items.map(i => ({
        'Nº de Operación': i.operacion,
        'Fecha del Documento': i.fecha,
        'Nº R.I.F.': i.clienteRif,
        'Nombre o Razón Social': i.clienteNombre,
        'Nº de Factura': i.numeroDoc,
        'Nº Control de Factura': i.controlDoc,
        'Nº de Comprobante de Retención': i.numComprobanteRet,
        'Tipo de Transacción': i.tipoTransaccion,
        'Nº de Documento Afectado': i.facturaAfectada,
        'Total Venta Incluyendo el IVA': i.totalDoc,
        'Base 16%': i.base,
        'IVA 16%': i.iva,
        'IVA Retenido (por el Comprador)': i.retIva
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Libro_Ventas_${periodLabel.replace('/', '_')}`);
      XLSX.writeFile(wb, `Libro_Ventas_Fiscal_${periodLabel.replace('/', '_')}.xlsx`);
      showToast?.('Libro de Ventas exportado a Excel exitosamente.', 'success');
    }
  };

  // =========================================================================
  // GENERADOR TXT RETENCIONES DE IVA (SENIAT)
  // =========================================================================
  const handleDownloadTxtSeniatIva = () => {
    const rifAgente = (empresa?.rif || 'J000000000').replace(/[-.\s]/g, '').toUpperCase();
    const periodo = `${selectedYear}${selectedMonth}`;

    const lineasTxt = libroComprasData.items
      .filter(f => f.retIva > 0)
      .map(f => {
        const fecha = f.fecha_emision ? f.fecha_emision.replace(/-/g, '') : '';
        const op = 'C';
        const tipoDoc = '01';
        const rifSujeto = (f.proveedor_rif || 'J000000000').replace(/[-.\s]/g, '').toUpperCase();
        const nroFactura = (f.numero || '').trim();
        const nroControl = (f.control_numero || '00-000000').trim();
        
        const tc = f.tasaCambioDoc || tasaLive || 1;
        const totalBs = (f.total_bs ?? f.total * tc).toFixed(2);
        const baseBs = (f.base_imponible_bs ?? (f.base_imponible || 0) * tc).toFixed(2);
        const retBs = (f.retencion_iva_monto_bs ?? (f.retencion_iva_monto || 0) * tc).toFixed(2);
        const exentoBs = (f.monto_exento_bs ?? (f.monto_exento || 0) * tc).toFixed(2);
        const alicuota = '16.00';
        const numComp = f.numCompRet;

        return `${rifAgente}\t${periodo}\t${fecha}\t${op}\t${tipoDoc}\t${rifSujeto}\t${nroFactura}\t${nroControl}\t${totalBs}\t${baseBs}\t${retBs}\t0\t${numComp}\t${exentoBs}\t${alicuota}\t0`;
      });

    if (lineasTxt.length === 0) {
      showToast?.('No hay retenciones de IVA aplicadas en este período para generar el archivo TXT.', 'info');
      return;
    }

    const contenido = lineasTxt.join('\r\n');
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `RET_IVA_${rifAgente}_${periodo}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.(`Archivo TXT de Retenciones IVA generado con ${lineasTxt.length} registros.`, 'success');
  };

  // =========================================================================
  // GENERADOR XML RETENCIONES DE ISLR (SENIAT)
  // =========================================================================
  const handleDownloadXmlSeniatIslr = () => {
    const rifAgente = (empresa?.rif || 'J000000000').replace(/[-.\s]/g, '').toUpperCase();
    const periodo = `${selectedYear}${selectedMonth}`;

    const comprasConRetIslr = libroComprasData.items.filter(f => f.retIslr > 0);

    if (comprasConRetIslr.length === 0) {
      showToast?.('No hay retenciones de ISLR registradas en este período.', 'info');
      return;
    }

    let xmlContent = `<?xml version="1.0" encoding="ISO-8859-1"?>\n`;
    xmlContent += `<RelacionRetencionesISLR RifAgente="${rifAgente}" Periodo="${periodo}">\n`;

    comprasConRetIslr.forEach(f => {
      const tc = f.tasaCambioDoc || tasaLive || 1;
      const baseBs = (f.base_imponible_bs ?? (f.base_imponible || 0) * tc).toFixed(2);
      const retBs = (f.retencion_islr_monto_bs ?? (f.retencion_islr_monto || 0) * tc).toFixed(2);
      const rifSujeto = (f.proveedor_rif || 'J000000000').replace(/[-.\s]/g, '').toUpperCase();
      const numFact = (f.numero || '').trim();
      const numControl = (f.control_numero || '00-000000').trim();
      const fecha = f.fecha_emision ? f.fecha_emision.split('-').reverse().join('/') : '';
      const codigoConcepto = '001';
      const porcentaje = f.retencion_islr_porcentaje || 2;

      xmlContent += `  <DetalleRetencion>\n`;
      xmlContent += `    <RifRetenido>${rifSujeto}</RifRetenido>\n`;
      xmlContent += `    <NumeroFactura>${numFact}</NumeroFactura>\n`;
      xmlContent += `    <NumeroControl>${numControl}</NumeroControl>\n`;
      xmlContent += `    <FechaOperacion>${fecha}</FechaOperacion>\n`;
      xmlContent += `    <CodigoConcepto>${codigoConcepto}</CodigoConcepto>\n`;
      xmlContent += `    <MontoOperacion>${baseBs}</MontoOperacion>\n`;
      xmlContent += `    <PorcentajeRetencion>${porcentaje}</PorcentajeRetencion>\n`;
      xmlContent += `    <MontoRetenido>${retBs}</MontoRetenido>\n`;
      xmlContent += `  </DetalleRetencion>\n`;
    });

    xmlContent += `</RelacionRetencionesISLR>`;

    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `RET_ISLR_${rifAgente}_${periodo}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.(`Archivo XML de Retenciones ISLR generado con ${comprasConRetIslr.length} registros.`, 'success');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Barra de Navegación Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <BackButton to="/accounting" label="Volver a Contabilidad" />
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-600">
                <Receipt size={18} />
              </span>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Módulo Fiscal & Retenciones (SENIAT / NIIF)
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Libros de IVA reglamentarios, comprobantes formales, archivos TXT/XML y conciliación tributaria
            </p>
          </div>
        </div>

        {/* Selector de Período y Moneda */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Calendar size={14} className="text-slate-500 ml-2 mr-1" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none pr-2 cursor-pointer"
            >
              <option value="01">Enero</option>
              <option value="02">Febrero</option>
              <option value="03">Marzo</option>
              <option value="04">Abril</option>
              <option value="05">Mayo</option>
              <option value="06">Junio</option>
              <option value="07">Julio</option>
              <option value="08">Agosto</option>
              <option value="09">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre</option>
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none pr-1 border-l border-slate-300 pl-1 cursor-pointer"
            >
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setMonedaVista('VES')}
              className={`px-2.5 py-1 text-xs font-black rounded-lg transition ${
                monedaVista === 'VES' 
                  ? 'bg-rose-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bs. (Fiscal)
            </button>
            <button
              onClick={() => setMonedaVista('USD')}
              className={`px-2.5 py-1 text-xs font-black rounded-lg transition ${
                monedaVista === 'USD' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              USD (NIIF)
            </button>
          </div>
        </div>
      </div>

      {/* Pestañas de Navegación */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('compras')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 -mb-px transition flex items-center gap-2 shrink-0 ${
            activeTab === 'compras'
              ? 'border-rose-600 text-rose-700 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText size={15} />
          <span>Libro de Compras Fiscal</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600 font-mono">
            {libroComprasData.items.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ventas')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 -mb-px transition flex items-center gap-2 shrink-0 ${
            activeTab === 'ventas'
              ? 'border-indigo-600 text-indigo-700 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet size={15} />
          <span>Libro de Ventas Fiscal</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600 font-mono">
            {libroVentasData.items.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('retenciones')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 -mb-px transition flex items-center gap-2 shrink-0 ${
            activeTab === 'retenciones'
              ? 'border-amber-600 text-amber-700 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt size={15} />
          <span>Comprobantes de Retención (IVA / ISLR)</span>
        </button>

        <button
          onClick={() => setActiveTab('txt_seniat')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 -mb-px transition flex items-center gap-2 shrink-0 ${
            activeTab === 'txt_seniat'
              ? 'border-emerald-600 text-emerald-700 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCode size={15} />
          <span>Generador TXT / XML SENIAT</span>
        </button>

        <button
          onClick={() => setActiveTab('cuadre')}
          className={`py-2.5 px-4 text-xs font-bold border-b-2 -mb-px transition flex items-center gap-2 shrink-0 ${
            activeTab === 'cuadre'
              ? 'border-blue-600 text-blue-700 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Scale size={15} />
          <span>Cuadre Fiscal vs Contable</span>
        </button>
      </div>

      {/* VISTA 1: LIBRO DE COMPRAS FISCAL */}
      {activeTab === 'compras' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Buscar por proveedor, RIF, factura, número de control..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportExcel('compras')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Download size={14} />
                <span>Exportar Excel</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                <span>Imprimir Libro Legal</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider">Libro de Compras Fiscal</h3>
                <p className="text-[11px] text-slate-300">
                  Período: {periodLabel} • Expresado en: {monedaVista === 'VES' ? 'Bolívares (Bs.) a Tasa Oficial BCV' : 'Dólares (USD)'}
                </p>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-lg">
                Régimen Art. 75 al 78 Reglamento Ley IVA
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] whitespace-nowrap">
                <thead className="bg-slate-200 text-slate-800 font-bold uppercase text-[9px] tracking-wider border-b-2 border-slate-400">
                  <tr>
                    <th rowSpan={2} className="px-3 py-2 text-center border-r border-slate-300">Nº de Operación</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300">Fecha del Documento</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300">Nº R.I.F.</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300">Proveedor o Razón Social</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300">Nº de Comprobante de Retención</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300">Nº de Factura</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300">Nº de Control</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300 text-center">Tipo de Transacción</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300 text-center">Nº de Documento Afectado</th>
                    <th colSpan={3} className="px-3 py-1 text-center bg-slate-300 text-slate-900 border-r border-slate-400 font-black">
                      COMPRAS INTERNAS
                    </th>
                    <th rowSpan={2} className="px-3 py-2 text-right">IVA Retenido (al vendedor)</th>
                  </tr>
                  <tr>
                    <th className="px-3 py-1.5 text-right border-r border-slate-300 bg-slate-100">Total Compras Incluyendo el IVA</th>
                    <th className="px-3 py-1.5 text-right border-r border-slate-300 bg-slate-100">Base 16%</th>
                    <th className="px-3 py-1.5 text-right border-r border-slate-400 bg-slate-100">IVA 16%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {libroComprasData.items.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-8 text-center text-slate-400">
                        No hay registros de compra para el período fiscal {periodLabel}.
                      </td>
                    </tr>
                  ) : (
                    libroComprasData.items.map((row) => (
                      <tr 
                        key={row.idFila} 
                        className={`transition ${
                          row.tipoFila === 'retencion_iva' 
                            ? 'bg-amber-50/40 hover:bg-amber-100/40 border-l-2 border-l-amber-500' 
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-3 py-1.5 text-center font-mono font-bold text-slate-600 border-r border-slate-200">{row.operacion}</td>
                        <td className="px-3 py-1.5 font-mono text-slate-700 border-r border-slate-200">{row.fecha}</td>
                        <td className="px-3 py-1.5 font-mono font-bold text-slate-900 border-r border-slate-200">{row.proveedorRif}</td>
                        <td className="px-3 py-1.5 font-bold text-slate-900 max-w-[220px] truncate border-r border-slate-200" title={row.proveedorNombre}>
                          {row.proveedorNombre}
                        </td>
                        <td className="px-3 py-1.5 font-mono font-bold text-amber-800 border-r border-slate-200 text-center">
                          {row.numComprobanteRet || ''}
                        </td>
                        <td className="px-3 py-1.5 font-mono font-bold text-indigo-700 border-r border-slate-200 text-center">
                          {row.numeroDoc || ''}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-slate-600 border-r border-slate-200 text-center">
                          {row.controlDoc || ''}
                        </td>
                        <td className="px-3 py-1.5 text-center text-[10px] text-slate-600 border-r border-slate-200">
                          {row.tipoTransaccion}
                        </td>
                        <td className="px-3 py-1.5 font-mono font-bold text-indigo-600 border-r border-slate-200 text-center">
                          {row.facturaAfectada || ''}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200">
                          {row.tipoFila === 'factura' ? formatoES(row.totalDoc) : '0,00'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                          {row.tipoFila === 'factura' ? formatoES(row.base) : '0,00'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                          {row.tipoFila === 'factura' ? formatoES(row.iva) : '0,00'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-amber-800">
                          {formatoES(row.retIva)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-200 text-slate-900 font-black border-t-2 border-slate-400">
                  <tr>
                    <td colSpan={9} className="px-3 py-2 text-right uppercase tracking-wider text-xs border-r border-slate-300">
                      Totales:
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs border-r border-slate-300">{formatoES(libroComprasData.totalComprasConIva)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs border-r border-slate-300">{formatoES(libroComprasData.totalBase16)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs border-r border-slate-300">{formatoES(libroComprasData.totalIva16)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-amber-900">{formatoES(libroComprasData.totalRetIva)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* CUADRO RESUMEN DEL PERÍODO OFICIAL SENIAT (LIBRO DE COMPRAS) */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs max-w-3xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-300 text-slate-900 font-black border-b border-slate-400">
                <tr>
                  <th className="px-4 py-2 text-left">Resumen del Período</th>
                  <th className="px-4 py-2 text-right border-l border-slate-400 w-36">Base Imponible</th>
                  <th className="px-4 py-2 text-right border-l border-slate-400 w-36">Crédito Fiscal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] font-medium text-slate-800">
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Compras no gravadas y/o sin Derecho a Crédito Fiscal</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">{formatoES(libroComprasData.totalExento)}</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">-</td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Importaciones Gravadas por Alícuota General</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Importaciones Gravadas por Alícuota General más Alícuota Adicional</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Importaciones Gravadas por Alícuota Reducida</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="px-4 py-1.5 text-slate-900">Compras Internas Gravadas por Alícuota General</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">{formatoES(libroComprasData.totalBase16)}</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">{formatoES(libroComprasData.totalIva16)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Compras Internas Gravadas por Alícuota General más Alícuota Adicional</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Compras Internas Gravadas por Alícuota Reducida</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                </tr>
                <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                  <td className="px-4 py-2 text-slate-900 uppercase text-[10px]">Total Compras y Créditos Fiscales del Período</td>
                  <td className="px-4 py-2 text-right font-mono border-l border-slate-300 text-xs">{formatoES(libroComprasData.totalBase16)}</td>
                  <td className="px-4 py-2 text-right font-mono border-l border-slate-300 text-xs">{formatoES(libroComprasData.totalIva16)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Créditos Fiscales Totalmente Deducibles</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">-</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200 font-bold">{formatoES(libroComprasData.totalIva16)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Créditos Fiscales Producto de la Aplicación del Porcentaje de Prorrata</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">-</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                </tr>
                <tr className="bg-slate-100 font-black">
                  <td className="px-4 py-1.5 text-slate-900 uppercase text-[10px]">Total Créditos Fiscales Deducibles</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-300">-</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-300 text-xs">{formatoES(libroComprasData.totalIva16)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Excedente Créditos Fiscales del Mes Anterior</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">-</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Ajuste a los Créditos Fiscales de los Períodos Anteriores</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">-</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                </tr>
                <tr className="bg-slate-200 font-black border-t border-slate-400">
                  <td className="px-4 py-2 text-slate-900 uppercase text-xs">Total Créditos Fiscales</td>
                  <td className="px-4 py-2 text-right font-mono border-l border-slate-400 text-xs">-</td>
                  <td className="px-4 py-2 text-right font-mono border-l border-slate-400 text-xs">{formatoES(libroComprasData.totalIva16)}</td>
                </tr>
                <tr className="border-t-2 border-slate-400 font-black bg-amber-50">
                  <td className="px-4 py-2 text-amber-900 uppercase text-xs">Total IVA Retenido (Al Vendedor)</td>
                  <td className="px-4 py-2 text-right font-mono border-l border-slate-300 text-xs">-</td>
                  <td className="px-4 py-2 text-right font-mono border-l border-slate-300 text-xs text-amber-900">{formatoES(libroComprasData.totalRetIva)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 2: LIBRO DE VENTAS FISCAL */}
      {activeTab === 'ventas' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Buscar por cliente, RIF, factura, número de control..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExportExcel('ventas')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Download size={14} />
                <span>Exportar Excel</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                <span>Imprimir Libro Legal</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider">Libro de Ventas Fiscal</h3>
                <p className="text-[11px] text-indigo-200">
                  Período: {periodLabel} • Expresado en: {monedaVista === 'VES' ? 'Bolívares (Bs.) a Tasa Oficial BCV' : 'Dólares (USD)'}
                </p>
              </div>
              <span className="text-[11px] font-mono text-indigo-300 bg-indigo-900/60 border border-indigo-700 px-2.5 py-1 rounded-lg">
                Régimen Art. 76 al 79 Reglamento Ley IVA
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] whitespace-nowrap">
                <thead className="bg-slate-200 text-slate-800 font-bold uppercase text-[9px] tracking-wider border-b-2 border-slate-400">
                  <tr>
                    <th rowSpan={2} className="px-3 py-2 text-center border-r border-slate-300">Nº de Operación</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300">Fecha del Documento</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300">Nº R.I.F.</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300">Nombre o Razón Social</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300">Nº de Factura</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300">Nº Control de Factura</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300">Nº de Comprobante de Retención</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300 text-center">Tipo de Transacción</th>
                    <th rowSpan={2} className="px-3 py-2 border-r border-slate-300 text-center">Nº de Documento Afectado</th>
                    <th colSpan={3} className="px-3 py-1 text-center bg-slate-300 text-slate-900 border-r border-slate-400 font-black">
                      CONTRIBUYENTE
                    </th>
                    <th rowSpan={2} className="px-3 py-2 text-right">IVA Retenido (por el Comprador)</th>
                  </tr>
                  <tr>
                    <th className="px-3 py-1.5 text-right border-r border-slate-300 bg-slate-100">Total Venta Incluyendo el IVA</th>
                    <th className="px-3 py-1.5 text-right border-r border-slate-300 bg-slate-100">Base 16%</th>
                    <th className="px-3 py-1.5 text-right border-r border-slate-400 bg-slate-100">IVA 16%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {libroVentasData.items.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-8 text-center text-slate-400">
                        No hay facturas de venta registradas para el período fiscal {periodLabel}.
                      </td>
                    </tr>
                  ) : (
                    libroVentasData.items.map((row) => (
                      <tr 
                        key={row.idFila} 
                        className={`transition ${
                          row.tipoFila === 'retencion_iva' 
                            ? 'bg-amber-50/40 hover:bg-amber-100/40 border-l-2 border-l-amber-500' 
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="px-3 py-1.5 text-center font-mono font-bold text-slate-600 border-r border-slate-200">{row.operacion}</td>
                        <td className="px-3 py-1.5 font-mono text-slate-700 border-r border-slate-200">{row.fecha}</td>
                        <td className="px-3 py-1.5 font-mono font-bold text-slate-900 border-r border-slate-200">{row.clienteRif}</td>
                        <td className="px-3 py-1.5 font-bold text-slate-900 max-w-[220px] truncate border-r border-slate-200" title={row.clienteNombre}>
                          {row.clienteNombre}
                        </td>
                        <td className="px-3 py-1.5 font-mono font-bold text-indigo-700 border-r border-slate-200 text-center">
                          {row.numeroDoc || ''}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-slate-600 border-r border-slate-200 text-center">
                          {row.controlDoc || ''}
                        </td>
                        <td className="px-3 py-1.5 font-mono font-bold text-amber-800 border-r border-slate-200 text-center">
                          {row.numComprobanteRet || ''}
                        </td>
                        <td className="px-3 py-1.5 text-center text-[10px] text-slate-600 border-r border-slate-200">
                          {row.tipoTransaccion}
                        </td>
                        <td className="px-3 py-1.5 font-mono font-bold text-indigo-600 border-r border-slate-200 text-center">
                          {row.facturaAfectada || ''}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900 border-r border-slate-200">
                          {row.tipoFila === 'factura' ? formatoES(row.totalDoc) : '0,00'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                          {row.tipoFila === 'factura' ? formatoES(row.base) : '0,00'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                          {row.tipoFila === 'factura' ? formatoES(row.iva) : '0,00'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-bold text-amber-800">
                          {formatoES(row.retIva)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-200 text-slate-900 font-black border-t-2 border-slate-400">
                  <tr>
                    <td colSpan={9} className="px-3 py-2 text-right uppercase tracking-wider text-xs border-r border-slate-300">
                      Totales:
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs border-r border-slate-300">{formatoES(libroVentasData.totalVentasConIva)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs border-r border-slate-300">{formatoES(libroVentasData.totalBase16)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs border-r border-slate-300">{formatoES(libroVentasData.totalIva16)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-amber-900">{formatoES(libroVentasData.totalRetIva)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* CUADRO RESUMEN DEL PERÍODO OFICIAL SENIAT (LIBRO DE VENTAS) */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs max-w-3xl">
            <table className="w-full text-xs">
              <thead className="bg-slate-300 text-slate-900 font-black border-b border-slate-400">
                <tr>
                  <th className="px-4 py-2 text-left">Resumen del Período</th>
                  <th className="px-4 py-2 text-right border-l border-slate-400 w-36">Base Imponible</th>
                  <th className="px-4 py-2 text-right border-l border-slate-400 w-36">Débito Fiscal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] font-medium text-slate-800">
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Ventas Internas no Gravadas</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">{formatoES(libroVentasData.totalExento)}</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">-</td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Ventas Exportación</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="px-4 py-1.5 text-slate-900">Ventas Internas Gravadas por Alícuota General</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">{formatoES(libroVentasData.totalBase16)}</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">{formatoES(libroVentasData.totalIva16)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Ventas Internas Gravadas por Alícuota General más Alícuota Adicional</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Ventas Internas Gravadas por Alícuota Reducida</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                </tr>
                <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                  <td className="px-4 py-2 text-slate-900 uppercase text-[10px]">Total Ventas y Débitos Fiscales para efectos de Determinación</td>
                  <td className="px-4 py-2 text-right font-mono border-l border-slate-300 text-xs">{formatoES(libroVentasData.totalBase16)}</td>
                  <td className="px-4 py-2 text-right font-mono border-l border-slate-300 text-xs">{formatoES(libroVentasData.totalIva16)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-1.5 text-slate-700">Ajustes a los Débitos Fiscales de períodos anteriores</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">-</td>
                  <td className="px-4 py-1.5 text-right font-mono border-l border-slate-200">0,00</td>
                </tr>
                <tr className="bg-slate-200 font-black border-t border-slate-400">
                  <td className="px-4 py-2 text-slate-900 uppercase text-xs">Total Débitos Fiscales del período</td>
                  <td className="px-4 py-2 text-right font-mono border-l border-slate-400 text-xs">-</td>
                  <td className="px-4 py-2 text-right font-mono border-l border-slate-400 text-xs">{formatoES(libroVentasData.totalIva16)}</td>
                </tr>
                <tr className="border-t-2 border-slate-400 font-black bg-amber-50">
                  <td className="px-4 py-2 text-amber-900 uppercase text-xs">IVA Retenido (por el comprador) / Total Retenciones del Período</td>
                  <td className="px-4 py-2 text-right font-mono border-l border-slate-300 text-xs">-</td>
                  <td className="px-4 py-2 text-right font-mono border-l border-slate-300 text-xs text-amber-900">{formatoES(libroVentasData.totalRetIva)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 3: COMPROBANTES DE RETENCIÓN */}
      {activeTab === 'retenciones' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3 mb-3">
                <span className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                  <Receipt size={20} />
                </span>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Retenciones Emitidas a Proveedores (IVA / ISLR)</h3>
                  <p className="text-xs text-slate-500">Como Agente de Retención designado por el SENIAT</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Al registrar facturas de compras sujetas a retención (75% o 100% de IVA, y 2% o 5% de ISLR), el sistema genera el correlativo legal con formato <strong className="font-mono text-slate-900">AAAAMMDDDDDDDD</strong> para imprimir el comprobante oficial y entregarlo al proveedor.
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3 mb-3">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Retenciones Soportadas de Clientes</h3>
                  <p className="text-xs text-slate-500">Comprobantes recibidos de Contribuyentes Especiales</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Estas retenciones representan un <strong className="text-emerald-700">Anticipo de Impuesto (Crédito a favor)</strong> que reduce directamente el monto de IVA e ISLR que tu empresa debe enterar al fisco al cierre del período.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="font-black text-xs uppercase tracking-wider">
                Comprobantes de Retención Generados del Período {periodLabel}
              </h4>
              <span className="text-[10px] text-slate-400">Haga clic en 'Imprimir Comprobante' para ver formato oficial</span>
            </div>

            <div className="divide-y divide-slate-100">
              {libroComprasData.items.filter(f => f.retIva > 0 || f.retIslr > 0).length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No hay comprobantes de retención emitidos a proveedores en el período seleccionado.
                </div>
              ) : (
                libroComprasData.items.filter(f => f.retIva > 0 || f.retIslr > 0).map(item => (
                  <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono font-black text-xs">
                          {item.numCompRet}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{item.proveedor_nombre}</span>
                        <span className="text-xs font-mono text-slate-500">({item.proveedor_rif})</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3">
                        <span>Factura Ref: <strong>{item.numero}</strong></span>
                        <span>Control: <strong>{item.control_numero || 'S/C'}</strong></span>
                        <span>Fecha: <strong>{item.fecha_emision}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">IVA Retenido</span>
                        <span className="font-mono font-black text-amber-700 text-xs">
                          {monedaVista === 'VES' ? 'Bs.' : '$'} {formatoES(item.retIva)}
                        </span>
                      </div>

                      <button
                        onClick={() => setPreviewRetencion({
                          tipo: 'IVA',
                          fecha: item.fecha_emision,
                          numComprobante: item.numCompRet,
                          periodo: `${selectedYear}${selectedMonth}`,
                          sujetoNombre: item.proveedor_nombre,
                          sujetoRif: item.proveedor_rif,
                          sujetoDireccion: item.proveedor_direccion,
                          numFactura: item.numero,
                          numControl: item.control_numero || 'S/C',
                          total: item.totalDoc,
                          base: item.base,
                          iva: item.iva,
                          porcentaje: item.retencion_iva_porcentaje || 75,
                          retencion: item.retIva,
                          tasaCambio: item.tasaCambioDoc
                        })}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Printer size={13} />
                        <span>Imprimir Comprobante</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* VISTA 4: GENERADOR DE ARCHIVOS PLANOS SENIAT */}
      {activeTab === 'txt_seniat' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Generador TXT IVA */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-3">
                  <FileText size={22} />
                </div>
                <h3 className="font-black text-base text-slate-900">Archivo TXT de Retenciones de IVA</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Genera el archivo con delimitador de tabulación según la especificación técnica vigente del portal fiscal del SENIAT para la declaración quincenal o mensual de retenciones de IVA a proveedores.
                </p>

                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Agente de Retención:</span>
                    <strong className="font-mono text-slate-900">{empresa?.rif || 'J000000000'}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Período Fiscal:</span>
                    <strong className="font-mono text-slate-900">{selectedYear}{selectedMonth}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Retenciones a Exportar:</span>
                    <strong className="text-amber-700">{libroComprasData.items.filter(f => f.retIva > 0).length} registros</strong>
                  </div>
                </div>
              </div>

              <button
                onClick={handleDownloadTxtSeniatIva}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Download size={16} />
                <span>Descargar Archivo TXT para el Portal SENIAT</span>
              </button>
            </div>

            {/* Generador XML ISLR */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-3">
                  <FileCode size={22} />
                </div>
                <h3 className="font-black text-base text-slate-900">Archivo XML de Retenciones de ISLR</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Genera la estructura XML oficial bajo la etiqueta <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">&lt;RelacionRetencionesISLR&gt;</code> para enterar las retenciones de Impuesto Sobre La Renta aplicadas a servicios y proveedores.
                </p>

                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Agente de Retención:</span>
                    <strong className="font-mono text-slate-900">{empresa?.rif || 'J000000000'}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Período Fiscal:</span>
                    <strong className="font-mono text-slate-900">{selectedYear}{selectedMonth}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Retenciones a Exportar:</span>
                    <strong className="text-emerald-700">{libroComprasData.items.filter(f => f.retIslr > 0).length} registros</strong>
                  </div>
                </div>
              </div>

              <button
                onClick={handleDownloadXmlSeniatIslr}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <Download size={16} />
                <span>Descargar Archivo XML para el Portal SENIAT</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 5: CUADRE FISCAL VS CONTABLE */}
      {activeTab === 'cuadre' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="font-black text-sm uppercase tracking-wider text-slate-900 mb-1">
              Liquidación Estimada del IVA (Período {periodLabel})
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Cálculo formal de la declaración fiscal según Débitos y Créditos acumulados en los Libros Legales
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                <span className="text-[10px] font-bold text-indigo-700 uppercase block mb-1">(+) Débito Fiscal (Ventas)</span>
                <p className="font-mono font-black text-xl text-indigo-950">${formatoES(cuadreFiscal.debitoFiscalVentasUSD)}</p>
                <span className="text-[10px] text-indigo-600">Impuesto facturado a clientes</span>
              </div>

              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <span className="text-[10px] font-bold text-rose-700 uppercase block mb-1">(-) Crédito Fiscal (Compras)</span>
                <p className="font-mono font-black text-xl text-rose-950">${formatoES(cuadreFiscal.creditoFiscalComprasUSD)}</p>
                <span className="text-[10px] text-rose-600">Impuesto pagado a proveedores</span>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <span className="text-[10px] font-bold text-amber-700 uppercase block mb-1">(-) Retenciones Soportadas</span>
                <p className="font-mono font-black text-xl text-amber-950">${formatoES(cuadreFiscal.retencionesIvaSoportadasUSD)}</p>
                <span className="text-[10px] text-amber-600">IVA retenido por clientes a favor</span>
              </div>

              <div className={`p-4 rounded-xl border ${
                cuadreFiscal.totalPagarFisco > 0 
                  ? 'bg-rose-50 border-rose-300 text-rose-950' 
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
              }`}>
                <span className="text-[10px] font-bold uppercase block mb-1">
                  {cuadreFiscal.totalPagarFisco > 0 ? '(=) IVA Neto a Pagar al Fisco' : '(=) Excedente Crédito Fiscal'}
                </span>
                <p className="font-mono font-black text-xl">
                  ${formatoES(cuadreFiscal.totalPagarFisco > 0 ? cuadreFiscal.totalPagarFisco : cuadreFiscal.excedenteCreditoFiscal)}
                </p>
                <span className="text-[10px]">
                  {cuadreFiscal.totalPagarFisco > 0 ? 'Monto a pagar en declaración' : 'Pasa a favor para el siguiente mes'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider text-slate-900">
                  Conciliación Libro Legal vs Cuentas de Mayor NIIF
                </h3>
                <p className="text-xs text-slate-500">
                  Verifica que los libros fiscales coincidan 1:1 con los saldos del Plan de Cuentas Contables
                </p>
              </div>

              <div className="flex items-center gap-2">
                {cuadreFiscal.diferenciaDebito < 0.05 && cuadreFiscal.diferenciaCredito < 0.05 ? (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span>Totalmente Cuadrado y Conciliado</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    <span>Diferencias Operativas Detectadas</span>
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Concepto Tributario</th>
                    <th className="px-4 py-3">Total Según Libro Fiscal</th>
                    <th className="px-4 py-3">Cuenta Contable Asociada</th>
                    <th className="px-4 py-3 text-right">Saldo en Mayor Contable</th>
                    <th className="px-4 py-3 text-right">Diferencia</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="px-4 py-3 font-bold text-slate-900">Débito Fiscal IVA (Ventas)</td>
                    <td className="px-4 py-3 font-mono font-bold text-indigo-600">${formatoES(cuadreFiscal.debitoFiscalVentasUSD)}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">2.1.2.01 (Débito Fiscal IVA)</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">${formatoES(Math.abs(cuadreFiscal.cuentaDebitoFiscalSaldo))}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-500">${formatoES(cuadreFiscal.diferenciaDebito)}</td>
                    <td className="px-4 py-3 text-center">
                      {cuadreFiscal.diferenciaDebito < 0.05 ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">Cuadrado</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">Revisar Asientos</span>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-4 py-3 font-bold text-slate-900">Crédito Fiscal IVA (Compras)</td>
                    <td className="px-4 py-3 font-mono font-bold text-rose-600">${formatoES(cuadreFiscal.creditoFiscalComprasUSD)}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">1.1.3.03 (Crédito Fiscal IVA)</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">${formatoES(Math.abs(cuadreFiscal.cuentaCreditoFiscalSaldo))}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-500">${formatoES(cuadreFiscal.diferenciaCredito)}</td>
                    <td className="px-4 py-3 text-center">
                      {cuadreFiscal.diferenciaCredito < 0.05 ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">Cuadrado</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">Revisar Asientos</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OFICIAL: COMPROBANTE DE RETENCIÓN IVA */}
      {previewRetencion && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-amber-400" />
                <h3 className="font-black text-sm">Vista Previa Comprobante Oficial de Retención</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Imprimir Comprobante</span>
                </button>
                <button
                  onClick={() => setPreviewRetencion(null)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-900 bg-white printable-content" id="printable-retencion">
              <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
                <h2 className="text-base font-black uppercase tracking-wider text-slate-900">
                  {empresa?.nombre || 'EMPRESA CONTRIBUYENTE ESPECIAL C.A.'}
                </h2>
                <p className="font-mono font-bold text-xs text-slate-600">RIF: {empresa?.rif || 'J-00000000-0'}</p>
                <p className="text-[10px] text-slate-500">{empresa?.direccion || 'Dirección Fiscal Principal'}</p>
                <div className="pt-2">
                  <span className="px-3 py-1 bg-slate-100 rounded-full font-black text-xs uppercase tracking-wider border border-slate-300">
                    Comprobante de Retención de Impuesto al Valor Agregado (IVA)
                  </span>
                </div>
                <p className="text-[9px] text-slate-400 italic mt-1">
                  (Ley del IVA - Art. 11: "Serán responsables del pago del impuesto en calidad de agentes de retención...")
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Nº de Comprobante:</span>
                  <span className="font-mono font-black text-sm text-amber-700">{previewRetencion.numComprobante}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Fecha de Emisión:</span>
                  <span className="font-mono font-bold text-xs">{previewRetencion.fecha}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Período Fiscal:</span>
                  <span className="font-mono font-bold text-xs">{previewRetencion.periodo}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Tasa Oficial BCV Aplicada:</span>
                  <span className="font-mono font-bold text-xs">Bs. {formatoES(previewRetencion.tasaCambio)} / $</span>
                </div>
              </div>

              <div className="p-3.5 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider mb-1">
                  Datos del Sujeto Retenido (Proveedor)
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-600">Nombre / Razón Social:</span>
                  <strong className="text-slate-900">{previewRetencion.sujetoNombre}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Registro de Información Fiscal (RIF):</span>
                  <strong className="font-mono text-slate-900">{previewRetencion.sujetoRif || 'N/A'}</strong>
                </div>
                {previewRetencion.sujetoDireccion && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Dirección Fiscal:</span>
                    <span className="text-slate-700">{previewRetencion.sujetoDireccion}</span>
                  </div>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 font-bold uppercase text-[9px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Factura Nº</th>
                      <th className="px-3 py-2">Nº Control</th>
                      <th className="px-3 py-2 text-right">Total Factura</th>
                      <th className="px-3 py-2 text-right">Base Imponible</th>
                      <th className="px-3 py-2 text-right">IVA Total</th>
                      <th className="px-3 py-2 text-center">% Ret.</th>
                      <th className="px-3 py-2 text-right text-amber-700 font-black">Monto Retenido</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{previewRetencion.numFactura}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">{previewRetencion.numControl}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{formatoES(previewRetencion.total)}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{formatoES(previewRetencion.base)}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{formatoES(previewRetencion.iva)}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold">{previewRetencion.porcentaje}%</td>
                      <td className="px-3 py-2.5 text-right font-mono font-black text-amber-700 text-xs">
                        {formatoES(previewRetencion.retencion)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-10 text-center text-xs">
                <div className="border-t border-slate-400 pt-2 space-y-0.5">
                  <strong className="block text-slate-900 uppercase text-[10px]">Agente de Retención (Firma y Sello)</strong>
                  <span className="text-[10px] text-slate-500">{empresa?.nombre || 'Empresa Emisora'}</span>
                </div>
                <div className="border-t border-slate-400 pt-2 space-y-0.5">
                  <strong className="block text-slate-900 uppercase text-[10px]">Sujeto Retenido (Recibido Conforme)</strong>
                  <span className="text-[10px] text-slate-500">{previewRetencion.sujetoNombre}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
