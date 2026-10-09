import React, { Component, ErrorInfo, ReactNode, useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { 
  FileText, Plus, Search, Printer, Trash2, 
  Calendar, CalendarDays, CheckCircle2, Clock, DollarSign, 
  TrendingUp, Download, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, 
  ArrowRight, ShoppingCart, Coins, RefreshCw
} from 'lucide-react';
import BackButton from '../components/common/BackButton';
import InvoicePrintModal from '../components/invoicing/InvoicePrintModal';
import TasaCambioModal from '../components/invoicing/TasaCambioModal';
import MasterAuthModal from '../components/common/MasterAuthModal';
import BimonetaryValue from '../components/common/BimonetaryValue';
import { getTasaForDate, fetchLiveBcvRate } from '../services/exchangeRateService';
import { FacturaVentaModel } from '../types/database';
import { formatDate, toInputDateFormat } from '../utils/dateUtils';
import InvoiceForm from './InvoiceForm';
import { useCompany } from '../context/CompanyContext';
import { dbActualizarStockAtomico, dbFetchFacturasVenta } from '../services/db';

// Helpers de formato de fechas en español
const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_SEMANA_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const formatMonthLabel = (monthKey: string) => {
  if (monthKey === 'todos') return 'Historial Completo';
  if (!monthKey || monthKey.length < 7) return monthKey;
  const [year, month] = monthKey.split('-');
  const idx = parseInt(month, 10) - 1;
  return `${MESES_ES[idx] || month} ${year}`;
};

const formatDayDetails = (dateStr: string) => {
  if (!dateStr) return { dayOfWeek: '', dayNumber: '', formatted: '', full: '' };
  const normalized = toInputDateFormat(dateStr);
  const parts = normalized.split('-');
  if (parts.length < 3) return { dayOfWeek: '', dayNumber: dateStr, formatted: dateStr, full: dateStr };
  const [year, month, day] = parts;
  const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  const dayOfWeek = DIAS_SEMANA_ES[d.getDay()] || '';
  const monthName = MESES_ES[parseInt(month, 10) - 1] || month;
  return {
    dayOfWeek,
    dayNumber: day,
    formatted: `${day}/${month}/${year}`,
    full: `${dayOfWeek}, ${day} de ${monthName} de ${year}`
  };
};

const getInvoiceDate = (fac: FacturaVentaModel): string => {
  const raw = fac.fecha_emision || fac.created_at || '';
  if (!raw) return '';
  return toInputDateFormat(raw);
};



export default function Invoicing({
  facturas = [],
  cxc = [],
  comprobantes = [],
  movimientosBancos = [],
  products = [],
  contactos = [],
  cuentasContables = [],
  bancos = [],
  cobranzas = [],
  configContable,
  workingYear,
  empresa,
  onSave,
  showToast
}: {
  facturas?: FacturaVentaModel[];
  cxc?: any[];
  comprobantes?: any[];
  movimientosBancos?: any[];
  cobranzas?: any[];
  products?: any[];
  contactos?: any[];
  cuentasContables?: any[];
  bancos?: any[];
  configContable?: any;
  workingYear?: string;
  empresa?: any;
  onSave?: (collection: string, data: any) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const navigate = useNavigate();
  const { activeCompanyId } = useCompany();
  const currentCompanyId = activeCompanyId || empresa?.id || '';
  const handleOpenInvoiceWindow = () => {
    try {
      const popup = window.open('/invoicing/new', 'NuevaFactura', 'width=1450,height=900,left=50,top=50');
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        navigate('/invoicing/new');
      }
    } catch {
      navigate('/invoicing/new');
    }
  };
  const [isNewInvoiceModalOpen, setIsNewInvoiceModalOpen] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

  // Modal de Autorización Master para Anulación de Factura
  const [isMasterAuthModalOpen, setIsMasterAuthModalOpen] = useState(false);
  const [facturaToAnular, setFacturaToAnular] = useState<FacturaVentaModel | null>(null);

  // Filtro de Mes (por defecto mes actual YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const currentYear = useMemo(() => {
    if (selectedMonth && selectedMonth.length >= 4) {
      return selectedMonth.substring(0, 4);
    }
    return workingYear || String(new Date().getFullYear());
  }, [selectedMonth, workingYear]);

  // Conteo de facturas por mes para los períodos
  const invoicesCountByMonth = useMemo(() => {
    const map = new Map<string, number>();
    facturas.forEach(f => {
      const d = getInvoiceDate(f);
      if (d && d.length >= 7) {
        const key = d.substring(0, 7);
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return map;
  }, [facturas]);

  // Día seleccionado para ver detalle (null = vista resumen del mes)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [monthViewMode, setMonthViewMode] = useState<'dias' | 'facturas'>('dias');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'cobrada' | 'emitida' | 'parcial' | 'anulada'>('todos');
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<FacturaVentaModel | null>(null);
  const [isTasaModalOpen, setIsTasaModalOpen] = useState(false);
  const [tasaKey, setTasaKey] = useState(0);

  // Auto-sincronizar tasa oficial en vivo desde el BCV al ingresar a Facturación
  useEffect(() => {
    fetchLiveBcvRate(false).then(res => {
      if (res.success && res.tasa) {
        setTasaKey(k => k + 1);
      }
    });

    const handleTasaUpdated = () => {
      setTasaKey(k => k + 1);
    };
    window.addEventListener('tasa-cambio-updated', handleTasaUpdated);
    return () => window.removeEventListener('tasa-cambio-updated', handleTasaUpdated);
  }, []);

  const todayTasa = useMemo(() => {
    return getTasaForDate(new Date().toISOString().split('T')[0]);
  }, [tasaKey]);

  const selectedDateTasa = useMemo(() => {
    return getTasaForDate(selectedDate || new Date().toISOString().split('T')[0]);
  }, [selectedDate, tasaKey]);

  // Lista de meses disponibles que contienen facturas para navegación rápida
  const availableMonths = useMemo(() => {
    const map = new Map<string, number>();
    facturas.forEach(f => {
      const d = getInvoiceDate(f);
      if (d && d.length >= 7) {
        const mKey = d.substring(0, 7);
        map.set(mKey, (map.get(mKey) || 0) + 1);
      }
    });

    const now = new Date();
    const currMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(currMonth)) map.set(currMonth, 0);
    if (!map.has(prevMonth)) map.set(prevMonth, 0);

    return Array.from(map.entries())
      .map(([key, count]) => ({ key, label: formatMonthLabel(key), count }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [facturas]);

  // Navegación de Meses
  const handlePrevMonth = () => {
    const currentM = selectedMonth === 'todos' 
      ? (availableMonths[0]?.key || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
      : selectedMonth;
    const [y, m] = currentM.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const py = prevDate.getFullYear();
    const pm = String(prevDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${py}-${pm}`);
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    const currentM = selectedMonth === 'todos' 
      ? (availableMonths[0]?.key || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)
      : selectedMonth;
    const [y, m] = currentM.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const ny = nextDate.getFullYear();
    const nm = String(nextDate.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${ny}-${nm}`);
    setSelectedDate(null);
  };

  // Facturas del mes seleccionado o historial completo
  const monthFacturas = useMemo(() => {
    if (selectedMonth === 'todos') {
      return facturas;
    }
    return facturas.filter(f => {
      const d = getInvoiceDate(f);
      return d.startsWith(selectedMonth);
    });
  }, [facturas, selectedMonth]);

  const [isSyncing, setIsSyncing] = useState(false);

  // Sincronización manual desde la base de datos
  const handleManualSync = useCallback(async () => {
    if (!currentCompanyId) return;
    setIsSyncing(true);
    try {
      const fresh = await dbFetchFacturasVenta(currentCompanyId);
      if (fresh && onSave) {
        onSave('facturasVenta', fresh.map((f: any) => ({ ...f, _localOnly: true })));
      }
      showToast?.(`Facturas actualizadas: ${fresh?.length || 0} registradas en el sistema`, 'success');
    } catch (e: any) {
      console.error('Error refreshing facturas:', e);
      showToast?.('Error al refrescar facturas desde la base de datos', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [currentCompanyId, onSave, showToast]);

  // Helpers para normalizar montos: La moneda principal contable y de reportes del sistema es siempre USD
  const getInvoiceTotalUSD = useCallback((f: FacturaVentaModel): number => {
    if (f.moneda === 'VES' && f.tasa_cambio > 1 && (f.total > 500 || !f.total_bs)) {
      return (Number(f.total) || 0) / f.tasa_cambio;
    }
    return Number(f.total) || 0;
  }, []);

  // Mapa indexado en memoria para búsquedas O(1) instantáneas de CxC
  const cxcLookupMap = useMemo(() => {
    const map = new Map<string, any>();
    if (!cxc || !cxc.length) return map;

    for (const c of cxc) {
      if (!c) continue;
      if (c.id) map.set(String(c.id).toLowerCase(), c);
      if (c.factura_id) map.set(String(c.factura_id).toLowerCase(), c);
      if (c.factura_db_id) map.set(String(c.factura_db_id).toLowerCase(), c);
      if (c.factura) map.set(String(c.factura).trim().toLowerCase(), c);
      if (c.numero) map.set(String(c.numero).trim().toLowerCase(), c);
      if (c.metadata?.factura_id) map.set(String(c.metadata.factura_id).toLowerCase(), c);
      if (c.metadata?.factura_numero) map.set(String(c.metadata.factura_numero).trim().toLowerCase(), c);
    }
    return map;
  }, [cxc]);

  // Helper optimizado O(1) para buscar el documento correspondiente en CxC
  const findCxcForInvoice = useCallback((fac: FacturaVentaModel): any | undefined => {
    if (!cxc || !cxc.length) return undefined;

    if (fac.cxc_id && cxcLookupMap.has(String(fac.cxc_id).toLowerCase())) {
      return cxcLookupMap.get(String(fac.cxc_id).toLowerCase());
    }
    const facIdStr = fac.id ? String(fac.id).toLowerCase() : '';
    if (facIdStr && cxcLookupMap.has(facIdStr)) {
      return cxcLookupMap.get(facIdStr);
    }
    const facNumStr = fac.numero ? String(fac.numero).trim().toLowerCase() : '';
    if (facNumStr && cxcLookupMap.has(facNumStr)) {
      return cxcLookupMap.get(facNumStr);
    }
    return undefined;
  }, [cxc, cxcLookupMap]);

  // Saldo pendiente en USD considerando conciliación con Cuentas por Cobrar (CxC)
  const getInvoicePendingUSD = useCallback((f: FacturaVentaModel): number => {
    if (f.estado === 'anulada' || f.estado === 'cobrada') return 0;
    if (f.condicion === 'contado') return 0;

    const linkedCxc = findCxcForInvoice(f);
    if (linkedCxc) {
      const cxcSaldo = Number(linkedCxc.saldo);
      if (!isNaN(cxcSaldo)) {
        if (cxcSaldo <= 0.009) return 0;
        return cxcSaldo;
      }
      if (linkedCxc.estado === 'pagada' || linkedCxc.estado === 'cobrada' || linkedCxc.estado === 'pagado') {
        return 0;
      }
    }

    const rawPending = f.saldo_pendiente ?? f.total;
    if (Number(rawPending) <= 0.009) return 0;
    if (f.moneda === 'VES' && f.tasa_cambio > 1 && (rawPending > 500 || !f.saldo_pendiente_bs)) {
      return (Number(rawPending) || 0) / f.tasa_cambio;
    }
    return Number(rawPending) || 0;
  }, [findCxcForInvoice]);

  // Estado efectivo de la factura conciliado con CxC
  const getInvoiceEffectiveStatus = useCallback((f: FacturaVentaModel): 'anulada' | 'cobrada' | 'parcial' | 'emitida' => {
    if (f.estado === 'anulada') return 'anulada';
    if (f.estado === 'cobrada') return 'cobrada';
    if (f.condicion === 'contado') return 'cobrada';

    const linkedCxc = findCxcForInvoice(f);
    const totalUSD = getInvoiceTotalUSD(f);

    if (linkedCxc) {
      const cxcSaldo = Number(linkedCxc.saldo);
      if (!isNaN(cxcSaldo)) {
        if (cxcSaldo <= 0.009) return 'cobrada';
        if (cxcSaldo < (Number(linkedCxc.total) || totalUSD) - 0.01) return 'parcial';
        return 'emitida';
      }
      if (linkedCxc.estado === 'pagada' || linkedCxc.estado === 'cobrada' || linkedCxc.estado === 'pagado') {
        return 'cobrada';
      }
    }

    const pending = getInvoicePendingUSD(f);
    if (pending <= 0.009) return 'cobrada';
    if (pending < totalUSD - 0.01) return 'parcial';
    return (f.estado as any) || 'emitida';
  }, [findCxcForInvoice, getInvoicePendingUSD, getInvoiceTotalUSD]);

  const getInvoiceTotalBs = (f: FacturaVentaModel): number => {
    if (f.total_bs && f.total_bs > 0) return f.total_bs;
    if (f.moneda === 'VES') return Number(f.total) || 0;
    const rate = f.tasa_cambio || 1;
    return (Number(f.total) || 0) * rate;
  };

  const getInvoicePendingBs = useCallback((f: FacturaVentaModel): number => {
    if (f.estado === 'anulada' || f.estado === 'cobrada') return 0;
    const pendUSD = getInvoicePendingUSD(f);
    if (pendUSD <= 0.009) return 0;
    if (f.saldo_pendiente_bs && f.saldo_pendiente_bs > 0 && Math.abs((f.saldo_pendiente ?? 0) - pendUSD) < 0.01) {
      return f.saldo_pendiente_bs;
    }
    const rate = f.tasa_cambio || 1;
    return pendUSD * rate;
  }, [getInvoicePendingUSD]);

  // Resumen Diario del Mes Seleccionado (Agrupación por Días)
  const dailySummaries = useMemo(() => {
    const map = new Map<string, {
      fecha: string;
      count: number;
      totalFacturado: number;
      totalCobrado: number;
      totalPendiente: number;
      clientes: Set<string>;
      contadoCount: number;
      creditoCount: number;
      anuladasCount: number;
    }>();

    monthFacturas.forEach(f => {
      const d = getInvoiceDate(f);
      if (!d) return;

      if (!map.has(d)) {
        map.set(d, {
          fecha: d,
          count: 0,
          totalFacturado: 0,
          totalCobrado: 0,
          totalPendiente: 0,
          clientes: new Set(),
          contadoCount: 0,
          creditoCount: 0,
          anuladasCount: 0
        });
      }

      const day = map.get(d)!;
      day.count += 1;
      const total = getInvoiceTotalUSD(f);
      const pendiente = getInvoicePendingUSD(f);
      const effStatus = getInvoiceEffectiveStatus(f);

      if (effStatus === 'anulada') {
        day.anuladasCount += 1;
      } else {
        day.totalFacturado += total;
        const cobrado = effStatus === 'cobrada' ? total : Math.max(0, total - pendiente);
        day.totalCobrado += cobrado;
        day.totalPendiente += pendiente;
      }

      if (f.cliente_nombre) {
        day.clientes.add(f.cliente_nombre);
      }

      if (f.condicion === 'credito') {
        day.creditoCount += 1;
      } else {
        day.contadoCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [monthFacturas, cxc, getInvoicePendingUSD, getInvoiceEffectiveStatus, getInvoiceTotalUSD]);

  // Totales acumulados del mes seleccionado
  const monthKpis = useMemo(() => {
    let totalFacturado = 0;
    let totalCobrado = 0;
    let totalPendiente = 0;
    let totalFacturas = 0;

    dailySummaries.forEach(d => {
      totalFacturado += d.totalFacturado;
      totalCobrado += d.totalCobrado;
      totalPendiente += d.totalPendiente;
      totalFacturas += d.count;
    });

    return {
      daysCount: dailySummaries.length,
      totalFacturas,
      totalFacturado,
      totalCobrado,
      totalPendiente
    };
  }, [dailySummaries]);

  // Facturas del día seleccionado (Vista Detalle)
  const dayFacturas = useMemo(() => {
    if (!selectedDate) return [];
    return facturas.filter(f => getInvoiceDate(f) === selectedDate);
  }, [facturas, selectedDate]);

  // Helper para verificar estado de factura considerando saldo pendiente y conciliación
  const matchesStatusFilter = useCallback((f: FacturaVentaModel, filter: string) => {
    if (filter === 'todos') return true;
    const effStatus = getInvoiceEffectiveStatus(f);
    return effStatus === filter;
  }, [getInvoiceEffectiveStatus]);

  // Facturas filtradas del día
  const filteredDayFacturas = useMemo(() => {
    return dayFacturas.filter(f => {
      const matchStatus = matchesStatusFilter(f, statusFilter);
      const term = searchTerm.toLowerCase();
      const matchSearch = !term ||
        (f.numero || '').toLowerCase().includes(term) ||
        (f.cliente_nombre || '').toLowerCase().includes(term) ||
        (f.cliente_rif || '').toLowerCase().includes(term) ||
        (f.control_numero || '').toLowerCase().includes(term);
      return matchStatus && matchSearch;
    }).sort((a, b) => (b.numero || '').localeCompare(a.numero || ''));
  }, [dayFacturas, statusFilter, searchTerm, matchesStatusFilter]);

  // Facturas filtradas del mes completo
  const filteredMonthFacturas = useMemo(() => {
    return monthFacturas.filter(f => {
      const matchStatus = matchesStatusFilter(f, statusFilter);
      const term = searchTerm.toLowerCase();
      const matchSearch = !term ||
        (f.numero || '').toLowerCase().includes(term) ||
        (f.cliente_nombre || '').toLowerCase().includes(term) ||
        (f.cliente_rif || '').toLowerCase().includes(term) ||
        (f.control_numero || '').toLowerCase().includes(term);
      return matchStatus && matchSearch;
    }).sort((a, b) => (b.fecha_emision || '').localeCompare(a.fecha_emision || '') || (b.numero || '').localeCompare(a.numero || ''));
  }, [monthFacturas, statusFilter, searchTerm, matchesStatusFilter]);

  // KPIs del día seleccionado
  const dayKpis = useMemo(() => {
    let totalFacturado = 0;
    let totalCobrado = 0;
    let totalPendiente = 0;

    dayFacturas.forEach(f => {
      const effStatus = getInvoiceEffectiveStatus(f);
      if (effStatus !== 'anulada') {
        const total = getInvoiceTotalUSD(f);
        const pendiente = getInvoicePendingUSD(f);
        totalFacturado += total;
        const cobrado = effStatus === 'cobrada' ? total : Math.max(0, total - pendiente);
        totalCobrado += cobrado;
        totalPendiente += pendiente;
      }
    });

    return {
      count: dayFacturas.length,
      totalFacturado,
      totalCobrado,
      totalPendiente
    };
  }, [dayFacturas, cxc, getInvoiceEffectiveStatus, getInvoicePendingUSD, getInvoiceTotalUSD]);

  // Conciliación con Cuentas por Cobrar (CxC)
  const [isReconciling, setIsReconciling] = useState(false);

  const handleReconcileWithCxc = useCallback(async (showNotification = false) => {
    if (!onSave || !facturas.length || !cxc.length) {
      if (showNotification) showToast?.('No hay facturas o cuentas por cobrar para conciliar', 'info');
      return;
    }

    setIsReconciling(true);
    let reconciledCount = 0;

    try {
      for (const fac of facturas) {
        if (fac.estado === 'anulada') continue;

        const linked = findCxcForInvoice(fac);
        if (!linked) continue;

        const cxcSaldo = Number(linked.saldo);
        if (isNaN(cxcSaldo)) continue;

        const cxcTotal = Number(linked.total) || getInvoiceTotalUSD(fac);
        const isPaid = cxcSaldo <= 0.009 || linked.estado === 'pagada' || linked.estado === 'cobrada' || linked.estado === 'pagado';
        const isPartial = !isPaid && cxcSaldo > 0.009 && cxcSaldo < (cxcTotal - 0.01);

        const targetEstado: 'cobrada' | 'parcial' | 'emitida' = isPaid ? 'cobrada' : isPartial ? 'parcial' : 'emitida';
        const targetSaldo = isPaid ? 0 : cxcSaldo;
        const targetSaldoBs = isPaid ? 0 : (targetSaldo * (fac.tasa_cambio || 1));

        const needsUpdate = 
          fac.estado !== targetEstado ||
          Math.abs((fac.saldo_pendiente ?? fac.total) - targetSaldo) > 0.01 ||
          (!fac.cxc_id && linked.id);

        if (needsUpdate) {
          reconciledCount++;
          await onSave('facturasVenta', {
            ...fac,
            estado: targetEstado,
            saldo_pendiente: targetSaldo,
            saldo_pendiente_bs: targetSaldoBs,
            cxc_id: linked.id,
            updated_at: new Date().toISOString()
          });
        }
      }

      if (showNotification) {
        if (reconciledCount > 0) {
          showToast?.(`Se conciliaron exitosamente ${reconciledCount} factura(s) con CxC`, 'success');
        } else {
          showToast?.('Todas las facturas están al día y conciliadas con CxC', 'info');
        }
      }
    } catch (err: any) {
      console.error('Error conciliando facturas con CxC:', err);
      if (showNotification) showToast?.('Error durante la conciliación con CxC', 'error');
    } finally {
      setIsReconciling(false);
    }
  }, [facturas, cxc, findCxcForInvoice, getInvoiceTotalUSD, onSave, showToast]);

  // Auto-conciliación en segundo plano una vez que las facturas y CxC estén disponibles
  useEffect(() => {
    if (facturas.length > 0 && cxc.length > 0) {
      handleReconcileWithCxc(false);
    }
  }, [facturas.length, cxc.length]);

  const formatMoney = (amount: number, curr: string = 'USD') => {
    return new Intl.NumberFormat('es-VE', { 
      style: 'currency', 
      currency: curr === 'VES' ? 'VES' : 'USD',
      minimumFractionDigits: 2 
    }).format(amount || 0).replace('USD', '$').replace('VES', 'Bs.');
  };

  const handleAnular = (fac: FacturaVentaModel) => {
    if (fac.estado === 'anulada') {
      showToast?.('Esta factura ya se encuentra anulada', 'info');
      return;
    }
    setFacturaToAnular(fac);
    setIsMasterAuthModalOpen(true);
  };

  const handleConfirmAnulacion = async () => {
    if (!facturaToAnular) return;

    const fac = facturaToAnular;

    // 1. Marcar la factura como anulada y en cero
    await onSave?.('facturasVenta', {
      ...fac,
      estado: 'anulada',
      saldo_pendiente: 0,
      saldo_pendiente_bs: 0,
      notas: `${fac.notas || ''} [ANULADA EL ${new Date().toLocaleDateString('es-VE')} CON CLAVE DE OPERACIONES]`.trim(),
      updated_at: new Date().toISOString()
    });

    // 2. Eliminar o anular la Cuenta por Cobrar (CxC) asociada
    const cxcMatches = (cxc || []).filter(item => {
      const matchId = fac.cxc_id && String(item.id) === String(fac.cxc_id);
      const matchDoc = (item.factura && String(item.factura) === String(fac.numero)) ||
                       (item.numero && String(item.numero) === String(fac.numero)) ||
                       (item.factura_id && String(item.factura_id) === String(fac.numero)) ||
                       (item.factura_id && String(item.factura_id) === String(fac.id));
      const matchMeta = item.metadata && (
        String(item.metadata.factura_numero) === String(fac.numero) ||
        String(item.metadata.factura_id) === String(fac.id)
      );
      return matchId || matchDoc || matchMeta;
    });

    for (const item of cxcMatches) {
      await onSave?.('cxc', { id: item.id, _delete: true });
    }

    // 3. Anular el Asiento Contable asociado (preserva la correlatividad y auditoría NIIF)
    const compMatches = (comprobantes || []).filter(comp => {
      const matchId = fac.comprobante_id && String(comp.id) === String(fac.comprobante_id);
      const matchConc = comp.concepto && String(comp.concepto).includes(String(fac.numero));
      return matchId || matchConc;
    });

    for (const comp of compMatches) {
      await onSave?.('comprobantes', {
        ...comp,
        estado: 'Anulado',
        descripcion: `[ANULADO] ${comp.descripcion || comp.concepto || 'Registro de Factura de Venta'}`
      });
    }

    // 4. Eliminar movimientos bancarios vinculados (si fue de contado)
    const bankMatches = (movimientosBancos || []).filter(mov => {
      const matchComp = fac.comprobante_id && String(mov.comprobante_id) === String(fac.comprobante_id);
      const matchRef = mov.ref && String(mov.ref) === String(fac.numero);
      return matchComp || matchRef;
    });

    for (const mov of bankMatches) {
      await onSave?.('movimientosBancos', { id: mov.id, _delete: true });
    }

    // 5. Eliminar o cancelar cobranzas vinculadas (si fue de contado)
    const cobMatches = (cobranzas || []).filter((cob: any) => {
      const matchComp = fac.comprobante_id && String(cob.comprobanteId) === String(fac.comprobante_id);
      const matchRec = cob.reciboNumero && String(cob.reciboNumero) === String(fac.numero);
      const matchDet = cob.detalles && Array.isArray(cob.detalles) && cob.detalles.some((d: any) => d.docId === fac.id || d.numDoc === fac.numero);
      return matchComp || matchRec || matchDet;
    });

    for (const cob of cobMatches) {
      await onSave?.('cobranzas', { id: cob.id, _delete: true });
    }

    // 6. Revertir inventario atómicamente si la factura contenía productos
    if (fac.items && Array.isArray(fac.items)) {
      for (const item of fac.items) {
        if (item.producto_id) {
          const originalProd = (products || []).find((p: any) => String(p.id) === String(item.producto_id));
          if (originalProd) {
            const cantRevertir = Number(item.cantidad) || 0;
            const currentStock = Number(originalProd.stock_actual) || 0;
            const restoredStock = currentStock + cantRevertir;

            if (currentCompanyId) {
              try {
                await dbActualizarStockAtomico(
                  currentCompanyId,
                  originalProd.id,
                  cantRevertir,
                  'devolucion',
                  {
                    referencia: `Anulación Factura Venta N° ${fac.numero}`,
                    usuario: 'Administrador (Master)'
                  }
                );
              } catch (e) {
                console.warn('Error en retorno atómico de inventario:', e);
              }
            }

            await onSave?.('products', {
              ...originalProd,
              stock_actual: restoredStock,
              updated_at: new Date().toISOString()
            });

            await onSave?.('movimientosInventario', {
              id: crypto.randomUUID(),
              empresa_id: currentCompanyId,
              producto_id: originalProd.id,
              producto_nombre: originalProd.nombre,
              producto_codigo: originalProd.codigo,
              tipo: 'ajuste_positivo',
              cantidad: cantRevertir,
              stock_anterior: currentStock,
              stock_resultante: restoredStock,
              costo_unitario: originalProd.costo_unitario,
              referencia: `Reverso por Anulación Factura ${fac.numero}`,
              fecha: new Date().toISOString().split('T')[0],
              usuario: 'Administrador (Master)',
              created_at: new Date().toISOString()
            });
          }
        }
      }
    }

    showToast?.(
      `Factura ${fac.numero} anulada con éxito. Stock restituido y módulos sincronizados.`,
      'success'
    );
    setIsMasterAuthModalOpen(false);
    setFacturaToAnular(null);
  };

  // Exportar a CSV
  const handleExportMonthCSV = () => {
    if (monthFacturas.length === 0) {
      showToast?.('No hay facturas en este mes para exportar', 'info');
      return;
    }

    const headers = [
      'Nro Factura', 'Nro Control', 'Fecha Emision', 'Fecha Vencimiento',
      'Cliente', 'RIF', 'Condicion', 'Moneda', 'Total', 'Saldo Pendiente', 'Estado'
    ];

    const rows = monthFacturas.map(f => [
      `"${f.numero || ''}"`,
      `"${f.control_numero || ''}"`,
      `"${formatDate(f.fecha_emision)}"`,
      `"${formatDate(f.fecha_vencimiento)}"`,
      `"${(f.cliente_nombre || '').replace(/"/g, '""')}"`,
      `"${f.cliente_rif || ''}"`,
      `"${f.condicion || 'contado'}"`,
      `"${f.moneda || 'USD'}"`,
      (Number(f.total) || 0).toFixed(2),
      (Number(getInvoicePendingUSD(f)) || 0).toFixed(2),
      `"${getInvoiceEffectiveStatus(f)}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `facturacion_ventas_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ============================================================================
  // CASO 1: VISTA RESUMEN MENSUAL POR DÍA (!selectedDate)
  // ============================================================================
  if (!selectedDate) {
    return (
      <div className="px-3 sm:px-6 pt-2 pb-6 max-w-7xl mx-auto animate-in fade-in duration-300 space-y-4">
        {/* Barra Superior con Navegación y Selector de Mes */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <BackButton to="/" label="Volver al Panel Principal" />
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-full border border-slate-200/80">
            Facturación de Ventas • Resumen Mensual por Días
          </span>
        </div>

        {/* HEADER PRINCIPAL */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                Facturación de Ventas
                <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full">
                  {monthKpis.totalFacturas} en {formatMonthLabel(selectedMonth)}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Ventas y comprobantes agrupados por día para auditoría, consulta y control financiero
              </p>
            </div>
          </div>

          {/* CONTROLES DEL MES & BOTONES */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Navegación Mes Anterior / Siguiente y Selector de Períodos */}
            <div className="relative flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all cursor-pointer shadow-2xs"
                title="Mes Anterior"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                onClick={() => setIsMonthDropdownOpen(prev => !prev)}
                className="px-3 py-1 text-xs font-bold text-slate-800 flex items-center gap-1.5 hover:bg-white rounded-xl transition-all cursor-pointer select-none"
                title="Haga clic para cambiar período/mes"
              >
                <Calendar size={13} className="text-indigo-600" />
                <span>{formatMonthLabel(selectedMonth)}</span>
                <ChevronDown size={13} className={`text-slate-400 transition-transform ${isMonthDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <button
                onClick={handleNextMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all cursor-pointer shadow-2xs"
                title="Mes Siguiente"
              >
                <ChevronRight size={16} />
              </button>

              {/* Menú Desplegable de Períodos */}
              {isMonthDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-30" 
                    onClick={() => setIsMonthDropdownOpen(false)} 
                  />
                  <div className="absolute top-full left-0 mt-2 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 w-64 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
                      <span>Períodos {currentYear}</span>
                      <span className="text-[10px] font-bold text-slate-500 font-mono">
                        {facturas.length} {facturas.length === 1 ? 'Factura' : 'Facturas'}
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                      {MESES_ES.map((nombreMes, idx) => {
                        const mStr = String(idx + 1).padStart(2, '0');
                        const key = `${currentYear}-${mStr}`;
                        const count = invoicesCountByMonth.get(key) || 0;
                        const isSelected = selectedMonth === key;

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setSelectedMonth(key);
                              setSelectedDate(null);
                              setIsMonthDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Calendar size={13} className={isSelected ? 'text-indigo-200' : 'text-slate-400'} />
                              <span>{nombreMes} {currentYear}</span>
                            </span>
                            {count > 0 && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-black ${
                                isSelected ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-700'
                              }`}>
                                {count} {count === 1 ? 'fac' : 'facs'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Botón Tasa BCV del Día */}
            <button
              onClick={() => setIsTasaModalOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs group"
              title="Almacenar y consultar Tasa de Cambio Oficial BCV (Actualizable en vivo)"
            >
              <Coins size={15} className="text-emerald-600" />
              <div className="flex items-center gap-1.5">
                <span className="hidden sm:inline">Tasa BCV:</span>
                <span className="font-mono font-black text-emerald-900 bg-white px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Bs. {todayTasa.toFixed(2)}
                </span>
              </div>
            </button>

            {/* Botón Actualizar desde DB */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs group"
              title="Recargar facturas en vivo desde Supabase"
            >
              <RefreshCw size={14} className={`text-indigo-600 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Actualizando...' : 'Actualizar'}</span>
            </button>

            {/* Botón Conciliar con CxC */}
            <button
              onClick={() => handleReconcileWithCxc(true)}
              disabled={isReconciling}
              className="px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs group"
              title="Conciliar automáticamente saldos y estados de facturas con Cuentas por Cobrar (CxC)"
            >
              <RefreshCw size={14} className={`text-indigo-600 ${isReconciling ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              <span className="hidden sm:inline">{isReconciling ? 'Conciliando...' : 'Conciliar CxC'}</span>
            </button>

            {/* Botón Exportar CSV */}
            <button
              onClick={handleExportMonthCSV}
              className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Exportar facturas de este mes a CSV"
            >
              <Download size={14} className="text-indigo-600" />
              <span className="hidden sm:inline">Exportar Mes</span>
            </button>

            {/* Botón Nueva Factura */}
            <button 
              onClick={handleOpenInvoiceWindow}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/25 active:scale-95 cursor-pointer"
              title="Emitir nueva factura de venta"
            >
              <Plus className="w-4 h-4" /> 
              <span>Nueva Factura</span>
            </button>
          </div>
        </div>

        {/* TARJETAS DE KPIS DEL MES */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Facturado</span>
              <DollarSign size={16} className="text-emerald-600" />
            </div>
            <div className="text-xl font-black text-emerald-600 font-mono">
              {formatMoney(monthKpis.totalFacturado)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {monthKpis.totalFacturas} comprobantes emitidos
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Cobrado (Contado)</span>
              <CheckCircle2 size={16} className="text-teal-600" />
            </div>
            <div className="text-xl font-black text-teal-600 font-mono">
              {formatMoney(monthKpis.totalCobrado)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Ingresos directos liquidados
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Por Cobrar (Crédito)</span>
              <Clock size={16} className="text-blue-600" />
            </div>
            <div className="text-xl font-black text-blue-600 font-mono">
              {formatMoney(monthKpis.totalPendiente)}
            </div>
            <div className="text-[10px] text-blue-600 font-bold mt-0.5">
              Saldo pendiente de cobro
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-4 rounded-2xl text-white shadow-xs border border-indigo-900/50">
            <div className="flex items-center justify-between text-indigo-300 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider">Días con Facturación</span>
              <CalendarDays size={16} className="text-indigo-400" />
            </div>
            <div className="text-xl font-black text-white font-mono">
              {monthKpis.daysCount} días activos
            </div>
            <div className="text-[10px] text-indigo-200 font-medium mt-0.5">
              En {formatMonthLabel(selectedMonth)}
            </div>
          </div>
        </div>

        {/* TABLA PRINCIPAL: RESUMEN DIARIO O LISTADO COMPLETO DEL MES */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Facturación en {formatMonthLabel(selectedMonth)}
              </h2>
              <p className="text-[11px] text-slate-500">
                {monthViewMode === 'dias'
                  ? 'Resumen por fecha con importes facturados y recaudados'
                  : 'Listado completo de todas las facturas emitidas en el mes'}
              </p>
            </div>

            {/* Selector de Modo de Vista */}
            <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-2xl self-start sm:self-auto">
              <button
                onClick={() => setMonthViewMode('dias')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  monthViewMode === 'dias'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays size={13} />
                <span>Por Días ({dailySummaries.length})</span>
              </button>
              <button
                onClick={() => setMonthViewMode('facturas')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  monthViewMode === 'facturas'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText size={13} />
                <span>Todas las Facturas ({monthFacturas.length})</span>
              </button>
            </div>
          </div>

          {/* MODO 1: TABLA RESUMEN POR DÍAS (SÚPER LIMPIA, SIN DATOS INNECESARIOS) */}
          {monthViewMode === 'dias' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500 select-none">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4 text-center">Facturas</th>
                    <th className="py-3 px-4 text-right">Total Facturado</th>
                    <th className="py-3 px-4 text-right">Cobrado</th>
                    <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium">
                  {dailySummaries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                          <CalendarDays size={24} />
                        </div>
                        <div className="text-sm font-bold text-slate-700">
                          No hay facturas registradas en {formatMonthLabel(selectedMonth)}
                        </div>
                        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                          Puedes cambiar de mes con los botones superiores o emitir una nueva factura de venta.
                        </p>
                        <button
                          onClick={handleOpenInvoiceWindow}
                          className="mt-3.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>Nueva Factura Ahora</span>
                        </button>
                      </td>
                    </tr>
                  ) : (
                    dailySummaries.map((day) => {
                      const { dayOfWeek, formatted } = formatDayDetails(day.fecha);
                      const isFullyPaid = day.totalPendiente === 0;

                      return (
                        <tr 
                          key={day.fecha}
                          onClick={() => setSelectedDate(day.fecha)}
                          className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                        >
                          {/* Fecha y Día */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex flex-col items-center justify-center text-slate-700 shrink-0 font-mono font-black shadow-2xs">
                                <span className="text-[9px] uppercase tracking-tighter leading-none opacity-80">
                                  {dayOfWeek.slice(0, 3)}
                                </span>
                                <span className="text-sm leading-none mt-0.5 font-extrabold">
                                  {day.fecha.split('-')[2]}
                                </span>
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-indigo-700 transition-colors">
                                  {dayOfWeek}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono">
                                  {formatted}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Comprobantes / Facturas */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1.5 font-mono font-bold text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">
                              <FileText size={13} className="text-slate-500" />
                              <span>{day.count} {day.count === 1 ? 'factura' : 'facturas'}</span>
                            </span>
                          </td>

                          {/* Total Facturado */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-mono font-black text-slate-900 text-sm block">
                              {formatMoney(day.totalFacturado)}
                            </span>
                          </td>

                          {/* Total Cobrado */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-mono font-bold text-emerald-600 text-sm block">
                              {formatMoney(day.totalCobrado)}
                            </span>
                          </td>

                          {/* Saldo Pendiente */}
                          <td className="py-3.5 px-4 text-right">
                            <span className={`font-mono font-bold text-sm block ${day.totalPendiente > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                              {formatMoney(day.totalPendiente)}
                            </span>
                          </td>

                          {/* Estado */}
                          <td className="py-3.5 px-4 text-center">
                            {isFullyPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 size={12} className="text-emerald-600" />
                                <span>100% Cobrado</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock size={12} className="text-amber-600" />
                                <span>Con Pendiente</span>
                              </span>
                            )}
                          </td>

                          {/* Botón Ver Detalle */}
                          <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedDate(day.fecha)}
                              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                              title={`Ver facturas del ${day.fecha}`}
                            >
                              <span>Ver Facturas</span>
                              <ArrowRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* MODO 2: LISTADO COMPLETO DE FACTURAS DEL MES */}
          {monthViewMode === 'facturas' && (
            <div className="space-y-3 p-4">
              {/* Barra de Filtros y Búsqueda */}
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por N° factura, cliente, RIF o control..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-indigo-600 outline-none transition"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
                  {[
                    { id: 'todos', label: 'Todas' },
                    { id: 'emitida', label: 'Pendientes' },
                    { id: 'parcial', label: 'Abonadas' },
                    { id: 'cobrada', label: 'Cobradas' },
                    { id: 'anulada', label: 'Anuladas' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setStatusFilter(tab.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
                        statusFilter === tab.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabla de Facturas */}
              <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-4 py-3">N° Factura</th>
                        <th className="px-4 py-3">Emisión</th>
                        <th className="px-4 py-3">Vencimiento</th>
                        <th className="px-4 py-3">Cliente & RIF</th>
                        <th className="px-4 py-3 text-center">Condición</th>
                        <th className="px-4 py-3 text-right">Total ($)</th>
                        <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                        <th className="px-4 py-3 text-center">Estado</th>
                        <th className="px-4 py-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filteredMonthFacturas.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-10 text-slate-400 font-bold">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                            No hay facturas con los filtros seleccionados en este mes
                          </td>
                        </tr>
                      ) : (
                        filteredMonthFacturas.map(fac => {
                          const effStatus = getInvoiceEffectiveStatus(fac);
                          let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                          let statusLabel = 'Emitida';

                          if (effStatus === 'anulada') {
                            badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                            statusLabel = 'Anulada';
                          } else if (effStatus === 'cobrada') {
                            badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            statusLabel = 'Cobrada';
                          } else if (effStatus === 'parcial') {
                            badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                            statusLabel = 'Abonada / Parcial';
                          }

                          return (
                            <tr key={fac.id} className="hover:bg-slate-50/70 transition">
                              <td className="px-4 py-2.5 font-mono font-black text-indigo-600">
                                {fac.numero}
                                {fac.control_numero && (
                                  <span className="block text-[10px] text-slate-400 font-mono font-normal">
                                    Ctrl: {fac.control_numero}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-slate-600">
                                {formatDate(fac.fecha_emision)}
                              </td>
                              <td className="px-4 py-2.5 text-slate-500">
                                {formatDate(fac.fecha_vencimiento)}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="font-bold text-slate-900">{fac.cliente_nombre}</div>
                                <div className="text-[11px] font-mono text-slate-400">{fac.cliente_rif || 'N/A'}</div>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                                  fac.condicion === 'contado' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                                }`}>
                                  {fac.condicion || 'Contado'}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <BimonetaryValue
                                  amountUSD={getInvoiceTotalUSD(fac)}
                                  amountBs={getInvoiceTotalBs(fac)}
                                  align="right"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <BimonetaryValue
                                  amountUSD={getInvoicePendingUSD(fac)}
                                  amountBs={getInvoicePendingBs(fac)}
                                  variant={getInvoicePendingUSD(fac) > 0 ? 'warning' : 'neutral'}
                                  align="right"
                                />
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border font-bold ${badgeColor}`}>
                                  {statusLabel}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedInvoiceForPrint(fac)}
                                    title="Ver e Imprimir Factura"
                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  >
                                    <Printer size={16} />
                                  </button>
                                  {fac.estado !== 'anulada' && (
                                    <button
                                      onClick={() => handleAnular(fac)}
                                      title="Anular Factura"
                                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal de Impresión */}
        <InvoicePrintModal
          isOpen={!!selectedInvoiceForPrint}
          onClose={() => setSelectedInvoiceForPrint(null)}
          factura={selectedInvoiceForPrint}
          empresa={empresa}
        />

        {/* Modal de Tasa de Cambio BCV */}
        <TasaCambioModal
          isOpen={isTasaModalOpen}
          onClose={() => setIsTasaModalOpen(false)}
          onSaveSuccess={(f, t) => {
            setTasaKey(k => k + 1);
            showToast?.(`Tasa BCV actualizada: Bs. ${t.toFixed(2)} / $`, 'success');
          }}
        />

        {/* Modal de Autorización Master para Anulación de Factura */}
        <MasterAuthModal
          isOpen={isMasterAuthModalOpen}
          onClose={() => {
            setIsMasterAuthModalOpen(false);
            setFacturaToAnular(null);
          }}
          title="Autorización Especial de Operaciones"
          subtitle="Se requiere Clave Especial de Operaciones para anular la factura"
          actionName="Anulación de Factura de Venta"
          actionDetails={
            facturaToAnular ? [
              `• Factura Nº: ${facturaToAnular.numero}`,
              `• Cliente: ${facturaToAnular.cliente_nombre}`,
              `• Condición: ${(facturaToAnular.condicion || 'contado').toUpperCase()}`,
              `• Total: $${Number(facturaToAnular.total || 0).toFixed(2)} (Bs. ${Number(facturaToAnular.total_bs || 0).toFixed(2)})`,
              `• Consecuencias de la operación:`,
              `  - La factura pasará a estado ANULADA.`,
              `  - Se eliminará la Cuenta por Cobrar (CxC) asociada.`,
              `  - Se eliminará el Comprobante Contable generado.`,
              `  - Se revertirá el stock de los productos al inventario.`
            ].join('\n') : ''
          }
          onSuccess={handleConfirmAnulacion}
        />
      </div>
    );
  }

  // ============================================================================
  // CASO 2: VISTA DETALLE DE UN DÍA SELECCIONADO (selectedDate)
  // ============================================================================
  const dayFormatted = formatDayDetails(selectedDate);

  return (
    <div className="px-3 sm:px-6 pt-2 pb-6 max-w-7xl mx-auto animate-in fade-in duration-300 space-y-4">
      {/* Barra Superior con Botón de Regreso y Título del Día */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedDate(null);
              setSearchTerm('');
            }}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
            title={`Volver a Días de ${formatMonthLabel(selectedMonth)}`}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200">
                {dayFormatted.dayOfWeek}
              </span>
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                {dayFormatted.full}
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Auditoría y detalle de facturas emitidas en este día ({dayFacturas.length} comprobantes)
            </p>
          </div>
        </div>

        {/* Acciones de la Vista Detalle */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botón Tasa BCV */}
          <button
            onClick={() => setIsTasaModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs group"
            title="Almacenar y consultar Tasa de Cambio Oficial BCV (Actualizable en vivo)"
          >
            <Coins size={15} className="text-emerald-600" />
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline">Tasa BCV:</span>
              <span className="font-mono font-black text-emerald-900 bg-white px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Bs. {selectedDateTasa.toFixed(2)}
              </span>
            </div>
          </button>

          {/* Botón Conciliar con CxC */}
          <button
            onClick={() => handleReconcileWithCxc(true)}
            disabled={isReconciling}
            className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs group"
            title="Conciliar automáticamente saldos y estados de facturas con Cuentas por Cobrar (CxC)"
          >
            <RefreshCw size={14} className={`text-indigo-600 ${isReconciling ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            <span className="hidden sm:inline">{isReconciling ? 'Conciliando...' : 'Conciliar CxC'}</span>
          </button>

          <button
            onClick={handleOpenInvoiceWindow}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-500/20 cursor-pointer"
          >
            <Plus size={15} />
            <span>Nueva Factura</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI del Día Seleccionado */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ventas del Día</span>
            <DollarSign size={16} className="text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-600 font-mono">
            {formatMoney(dayKpis.totalFacturado)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{dayKpis.count} comprobantes</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cobrado Hoy</span>
            <CheckCircle2 size={16} className="text-teal-600" />
          </div>
          <div className="text-xl font-black text-teal-600 font-mono">
            {formatMoney(dayKpis.totalCobrado)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Ingresos al contado</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Por Cobrar Hoy</span>
            <Clock size={16} className="text-blue-600" />
          </div>
          <div className="text-xl font-black text-blue-600 font-mono">
            {formatMoney(dayKpis.totalPendiente)}
          </div>
          <div className="text-[10px] text-blue-600 font-bold mt-0.5">Créditos del día</div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-4 rounded-2xl text-white shadow-xs border border-indigo-900/50">
          <div className="flex items-center justify-between text-indigo-300 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Comprobantes</span>
            <FileText size={16} className="text-indigo-400" />
          </div>
          <div className="text-xl font-black text-white font-mono">
            {dayKpis.count}
          </div>
          <div className="text-[10px] text-indigo-200 font-medium mt-0.5">Operaciones registradas</div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por N° factura, cliente, RIF o control..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none transition"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {[
            { id: 'todos', label: 'Todas' },
            { id: 'emitida', label: 'Pendientes' },
            { id: 'parcial', label: 'Abonadas' },
            { id: 'cobrada', label: 'Cobradas' },
            { id: 'anulada', label: 'Anuladas' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition ${
                statusFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Facturas del Día */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3.5">N° Factura</th>
                <th className="px-4 py-3.5">Emisión</th>
                <th className="px-4 py-3.5">Vencimiento</th>
                <th className="px-4 py-3.5">Cliente & RIF</th>
                <th className="px-4 py-3.5 text-center">Condición</th>
                <th className="px-4 py-3.5 text-right">Total ($)</th>
                <th className="px-4 py-3.5 text-right">Saldo Pendiente</th>
                <th className="px-4 py-3.5 text-center">Estado</th>
                <th className="px-4 py-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredDayFacturas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 font-bold">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-400" />
                    No hay facturas para mostrar con los filtros seleccionados
                  </td>
                </tr>
              ) : (
                filteredDayFacturas.map(fac => {
                  const effStatus = getInvoiceEffectiveStatus(fac);
                  let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                  let statusLabel = 'Emitida';

                  if (effStatus === 'anulada') {
                    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                    statusLabel = 'Anulada';
                  } else if (effStatus === 'cobrada') {
                    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    statusLabel = 'Cobrada';
                  } else if (effStatus === 'parcial') {
                    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                    statusLabel = 'Abonada / Parcial';
                  }

                  return (
                    <tr key={fac.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-mono font-black text-indigo-600">
                        {fac.numero}
                        {fac.control_numero && (
                          <span className="block text-[10px] text-slate-400 font-mono font-normal">
                            Ctrl: {fac.control_numero}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-600">
                        {formatDate(fac.fecha_emision)}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(fac.fecha_vencimiento)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{fac.cliente_nombre}</div>
                        <div className="text-[11px] font-mono text-slate-400">{fac.cliente_rif || 'N/A'}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                          fac.condicion === 'contado' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {fac.condicion || 'Contado'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <BimonetaryValue
                          amountUSD={getInvoiceTotalUSD(fac)}
                          amountBs={getInvoiceTotalBs(fac)}
                          align="right"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <BimonetaryValue
                          amountUSD={getInvoicePendingUSD(fac)}
                          amountBs={getInvoicePendingBs(fac)}
                          variant={getInvoicePendingUSD(fac) > 0 ? 'warning' : 'neutral'}
                          align="right"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] border font-bold ${badgeColor}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedInvoiceForPrint(fac)}
                            title="Ver e Imprimir Factura"
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          >
                            <Printer size={16} />
                          </button>
                          {fac.estado !== 'anulada' && (
                            <button
                              onClick={() => handleAnular(fac)}
                              title="Anular Factura"
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Impresión */}
      <InvoicePrintModal
        isOpen={!!selectedInvoiceForPrint}
        onClose={() => setSelectedInvoiceForPrint(null)}
        factura={selectedInvoiceForPrint}
        empresa={empresa}
      />

      {/* Modal de Tasa de Cambio BCV */}
      <TasaCambioModal
        isOpen={isTasaModalOpen}
        onClose={() => setIsTasaModalOpen(false)}
        onSaveSuccess={(f, t) => {
          setTasaKey(k => k + 1);
          showToast?.(`Tasa BCV actualizada: Bs. ${t.toFixed(2)} / $`, 'success');
        }}
      />

      {/* Modal de Autorización Master para Anulación de Factura */}
      <MasterAuthModal
        isOpen={isMasterAuthModalOpen}
        onClose={() => {
          setIsMasterAuthModalOpen(false);
          setFacturaToAnular(null);
        }}
        title="Autorización Especial de Operaciones"
        subtitle="Se requiere Clave Especial de Operaciones para anular la factura"
        actionName="Anulación de Factura de Venta"
        actionDetails={
          facturaToAnular ? [
            `• Factura Nº: ${facturaToAnular.numero}`,
            `• Cliente: ${facturaToAnular.cliente_nombre}`,
            `• Condición: ${(facturaToAnular.condicion || 'contado').toUpperCase()}`,
            `• Total: $${Number(facturaToAnular.total || 0).toFixed(2)} (Bs. ${Number(facturaToAnular.total_bs || 0).toFixed(2)})`,
            `• Consecuencias de la operación:`,
            `  - La factura pasará a estado ANULADA.`,
            `  - Se eliminará la Cuenta por Cobrar (CxC) asociada.`,
            `  - Se eliminará el Comprobante Contable generado.`,
            `  - Se revertirá el stock de los productos al inventario.`
          ].join('\n') : ''
        }
        onSuccess={handleConfirmAnulacion}
      />

      {isNewInvoiceModalOpen && (
        <InvoiceForm
          isModal={true}
          onClose={() => {
            setIsNewInvoiceModalOpen(false);
            if (currentCompanyId) {
              dbFetchFacturasVenta(currentCompanyId).then(fresh => {
                if (fresh && onSave) onSave('facturasVenta', fresh);
              });
            }
          }}
          contactos={contactos}
          products={products}
          cuentasContables={cuentasContables}
          bancos={bancos}
          configContable={configContable}
          onSave={onSave}
          showToast={showToast}
          workingYear={workingYear}
          empresa={empresa}
        />
      )}
    </div>
  );
}
