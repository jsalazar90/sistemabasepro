import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import BackButton from '../components/common/BackButton';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  FileText, 
  Edit,
  TrendingUp, 
  TrendingDown, 
  Landmark, 
  Users, 
  ShoppingBag, 
  ArrowLeft, 
  Printer, 
  FileSpreadsheet, 
  Calendar, 
  Clock, 
  Calculator, 
  Building2, 
  ArrowUpRight, 
  ArrowDownRight,
  CornerDownRight,
  Database,
  BarChart3,
  CalendarDays,
  Search,
  BookOpen,
  PieChart as PieIcon,
  ChevronsRight,
  Plus,
  Minus,
  X,
  Pencil,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  Activity,
  ListTree,
  Receipt,
  Coins
} from 'lucide-react';
import { PrintPreview } from '../components/PrintPreview';
import { AREAS_FLUJO } from './ChartOfAccounts';
import BalanceGeneralReport from '../components/accounting/BalanceGeneralReport';
import BalanceGeneralParamsModal from '../components/accounting/BalanceGeneralParamsModal';
import EstadoResultadosParamsModal from '../components/accounting/EstadoResultadosParamsModal';
import BalanceComprobacionParamsModal from '../components/accounting/BalanceComprobacionParamsModal';
import LibroMayorParamsModal from '../components/accounting/LibroMayorParamsModal';
import LibroDiarioParamsModal from '../components/accounting/LibroDiarioParamsModal';

interface ReportsProps {
  facturasServicio?: any[];
  comprobantes: any[];
  cuentasContables: any[];
  cxc: any[];
  cxp: any[];
  bancos: any[];
  movimientosBancos: any[];
  servicios?: any[];
  contactos?: any[];
  products?: any[];
  configContable?: any;
  empresa?: any;
  cobranzas?: any[];
  onSave?: (collectionName: string, data: any) => Promise<any>;
  showToast?: (message: string, type: string) => void;
}

const formatoES = (num: number | string) => {
  const n = typeof num === 'string' ? parseFloat(num) || 0 : num || 0;
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

export default function Reports({
  facturasServicio = [],
  comprobantes = [],
  cuentasContables = [],
  cxc = [],
  cxp = [],
  bancos = [],
  movimientosBancos = [],
  servicios = [],
  contactos = [],
  products = [],
  configContable,
  empresa,
  cobranzas = [],
  onSave,
  showToast
}: ReportsProps) {
  // Print Layout Customizations (Loaded dynamically from the Custom Template Designer)
  const reportTheme = configContable?.reportTheme || 'modern-sans'; // 'classic-serif' | 'modern-sans' | 'elegant-dark'
  const reportShowFiscalHeader = configContable?.hasOwnProperty('reportShowFiscalHeader') ? configContable.reportShowFiscalHeader : true;
  const reportHeaderAlign = configContable?.reportHeaderAlign || 'center'; // 'left' | 'center' | 'right'
  const reportDoubleLineTotals = configContable?.hasOwnProperty('reportDoubleLineTotals') ? configContable.reportDoubleLineTotals : true;
  const reportZebraStripe = configContable?.hasOwnProperty('reportZebraStripe') ? configContable.reportZebraStripe : true;
  const reportShowMultidivisa = configContable?.hasOwnProperty('reportShowMultidivisa') ? configContable.reportShowMultidivisa : true;
  const reportShowSignatures = configContable?.hasOwnProperty('reportShowSignatures') ? configContable.reportShowSignatures : true;

  const reportPreparadorName = configContable?.reportPreparadorName || 'Lic. María Delgado (Contador)';
  const reportRevisorName = configContable?.reportRevisorName || 'Ing. Javier Espinoza (Auditor)';
  const reportAprobadorName = configContable?.reportAprobadorName || 'Sr(a). Director Ejecutivo';
  const reportWatermark = configContable?.reportWatermark || 'none'; // 'none' | 'borrador' | 'confidencial' | 'preliminar'
  const reportFontSize = configContable?.reportFontSize || 'md'; // 'sm' | 'md' | 'lg'

  // Estados de Filtros para Mayor Analítico
  const [mayorFilterMode, setMayorFilterMode] = useState<'individual' | 'rango'>('individual');
  const [selectedMayorAccountId, setSelectedMayorAccountId] = useState<string>('todos');
  const [desdeMayorAccountId, setDesdeMayorAccountId] = useState<string>('');
  const [hastaMayorAccountId, setHastaMayorAccountId] = useState<string>('');
  const [mayorHideZero, setMayorHideZero] = useState<boolean>(true);

  // Estados de Impresión y Vista Previa
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printModalContent, setPrintModalContent] = useState<React.ReactNode | null>(null);
  const [printModalTitle, setPrintModalTitle] = useState('');
  const [printModalOrientation, setPrintModalOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const handlePrintReport = (elementId: string, title: string, orientation: 'portrait' | 'landscape' = 'portrait') => {
    const el = document.getElementById(elementId);
    if (!el) return;
    setPrintModalTitle(title);
    setPrintModalOrientation(orientation);
    setPrintModalContent(<div dangerouslySetInnerHTML={{ __html: el.innerHTML }} />);
    setPrintModalOpen(true);
  };

  // Estados de Responsables de Firma
  const [showSignaturesModal, setShowSignaturesModal] = useState(false);
  const [localPreparador, setLocalPreparador] = useState(reportPreparadorName);
  const [localRevisor, setLocalRevisor] = useState(reportRevisorName);
  const [localAprobador, setLocalAprobador] = useState(reportAprobadorName);
  const [isSavingSignatures, setIsSavingSignatures] = useState(false);

  const handleSaveSignatures = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSignatures(true);
    try {
      if (onSave) {
        await onSave('configContable', {
          ...configContable,
          reportPreparadorName: localPreparador,
          reportRevisorName: localRevisor,
          reportAprobadorName: localAprobador
        });
      }
      showToast?.('Firmas guardadas exitosamente', 'success');
      setShowSignaturesModal(false);
    } catch (err) {
      showToast?.('Error al guardar firmas', 'error');
    } finally {
      setIsSavingSignatures(false);
    }
  };

  const [searchParams] = useSearchParams();
  const urlReport = searchParams.get('report');
  const urlTab = searchParams.get('tab');
  const openBalanceModalParam = searchParams.get('openBalanceModal');

  // Pestaña principal: 'contables' o 'flujo_caja'
  const [activeTab, setActiveTab] = useState<'contables' | 'flujo_caja'>(
    urlTab === 'flujo_caja' ? 'flujo_caja' : 'contables'
  );

  // Modal flotante de configuración para Balance General
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState<boolean>(openBalanceModalParam === 'true');
  // Modales flotantes de configuración para otros reportes contables oficiales
  const [isEstadoResultadosModalOpen, setIsEstadoResultadosModalOpen] = useState<boolean>(false);
  const [isBalanceComprobacionModalOpen, setIsBalanceComprobacionModalOpen] = useState<boolean>(false);
  const [isLibroMayorModalOpen, setIsLibroMayorModalOpen] = useState<boolean>(false);
  const [isLibroDiarioModalOpen, setIsLibroDiarioModalOpen] = useState<boolean>(false);

  // Distribución del detalle de Flujo de Caja: 'ingresos', 'gastos' o 'financiamiento'
  const [distribucionTab, setDistribucionTab] = useState<'ingresos' | 'gastos' | 'financiamiento'>('ingresos');
  
  // Vista activa de reporte detallado (null si está en el menú de la pestaña)
  const [activeReport, setActiveReport] = useState<string | null>(urlReport || null);

  useEffect(() => {
    if (urlReport) setActiveReport(urlReport);
    if (urlTab === 'flujo_caja' || urlTab === 'contables') setActiveTab(urlTab);
    if (openBalanceModalParam === 'true') setIsBalanceModalOpen(true);
  }, [urlReport, urlTab, openBalanceModalParam]);

  // Estados para la edición rápida de descripción/concepto en Flujo de Caja
  const [editingMovId, setEditingMovId] = useState<string | null>(null);
  const [editDescValue, setEditDescValue] = useState<string>('');

  const handleSaveDescription = async (m: any) => {
    if (!editDescValue.trim()) return;
    try {
      const comp = (comprobantes || []).find(c => String(c.id) === String(m.comprobanteId));
      if (!comp) {
        showToast('No se encontró el comprobante asociado.', 'error');
        return;
      }

      const updatedLines = [...(comp.lineas || [])];
      if (m.lineIndex !== undefined && m.lineIndex >= 0 && m.lineIndex < updatedLines.length) {
        updatedLines[m.lineIndex] = {
          ...updatedLines[m.lineIndex],
          descripcion: editDescValue
        };
      }

      const updatedComp = {
        ...comp,
        lineas: updatedLines
      };

      if (!comp.descripcion || comp.descripcion === m.descripcion) {
        updatedComp.descripcion = editDescValue;
      }

      if (onSave) {
        await onSave('comprobantes', updatedComp);
        showToast('Concepto de transacción actualizado correctamente.', 'success');
      }
      setEditingMovId(null);
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar.', 'error');
    }
  };

  // Reclasificación de movimientos de flujo de caja
  const [reclassifyingMov, setReclassifyingMov] = useState<any | null>(null);
  const [selectedNewArea, setSelectedNewArea] = useState<string>('');

  const handleSaveAreaFlujoCaja = async (m: any, newArea: string) => {
    try {
      const comp = (comprobantes || []).find(c => String(c.id) === String(m.comprobanteId));
      if (!comp) {
        showToast('No se encontró el comprobante asociado.', 'error');
        return;
      }

      const updatedLines = [...(comp.lineas || [])];
      if (m.lineIndex !== undefined && m.lineIndex >= 0 && m.lineIndex < updatedLines.length) {
        updatedLines[m.lineIndex] = {
          ...updatedLines[m.lineIndex],
          areaFlujoCaja: newArea
        };
      }

      const updatedComp = {
        ...comp,
        lineas: updatedLines
      };

      if (onSave) {
        await onSave('comprobantes', updatedComp);
        showToast('Clasificación de la transacción actualizada correctamente.', 'success');
      }
      setReclassifyingMov(null);
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar la clasificación de la transacción.', 'error');
    }
  };

  const handleSaveAccountAreaFlujoCaja = async (ctaId: string, newArea: string) => {
    try {
      const cta = (cuentasContables || []).find(c => String(c.id) === String(ctaId) || (c.codigo && String(c.codigo) === String(ctaId)));
      if (!cta) {
        showToast('No se encontró la cuenta contable.', 'error');
        return;
      }

      const updatedCta = {
        ...cta,
        areaFlujoCaja: newArea
      };

      if (onSave) {
        await onSave('cuentasContables', updatedCta);
        showToast(`La cuenta contable "${cta.nombre}" ha sido reconfigurada al área seleccionada.`, 'success');
      }
      setReclassifyingMov(null);
    } catch (err) {
      console.error(err);
      showToast('Error al actualizar la configuración de la cuenta contable.', 'error');
    }
  };

  // Sub-pestaña activa para el reporte de Salud Financiera: 'diagnostico' o 'cuentas_saldos'
  const [saludFinancieraTab, setSaludFinancieraTab] = useState<'diagnostico' | 'cuentas_saldos'>('diagnostico');

  // Filtros de fecha generales para los reportes
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);

  const totalCxCPendiente = useMemo(() => (cxc || []).reduce((sum, item) => sum + (Number(item.saldo) || 0), 0), [cxc]);
  const totalCxPPendiente = useMemo(() => (cxp || []).reduce((sum, item) => sum + (Number(item.saldo) || 0), 0), [cxp]);

  // Estados para Flujo de Caja
  const [expandedDivisions, setExpandedDivisions] = useState<{ [key: string]: boolean }>({});
  const toggleDivision = (key: string) => setExpandedDivisions(prev => ({ ...prev, [key]: !prev[key] }));
  const [expandedHistorialDivisions, setExpandedHistorialDivisions] = useState<{ [key: string]: boolean }>({});
  const [showFlowStatementModal, setShowFlowStatementModal] = useState(false);
  const [showDetailedHistoryModal, setShowDetailedHistoryModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('all');

  // Estados para Reportes Contables
  const [bgHideZero, setBgHideZero] = useState(true);
  const [plHideZero, setPlHideZero] = useState(true);
  const [comprobacionReportMode, setComprobacionReportMode] = useState<'4columnas' | '8columnas'>('8columnas');
  const [diarioReportMode, setDiarioReportMode] = useState<'detallado' | 'resumido'>('detallado');

  const renderSubTransactionsTable = (movs: any[], _metricKey: string, sign: '+' | '-') => {
    if (!movs || movs.length === 0) {
      return (
        <div className="p-4 text-center text-xs text-slate-400 font-medium bg-slate-50/50 border-t border-slate-100">
          No hay transacciones registradas para este rubro en el periodo seleccionado.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto border-t border-slate-100 bg-slate-50/30">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/70 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <th className="py-2.5 px-4">Fecha</th>
              <th className="py-2.5 px-4">Descripción / Concepto</th>
              <th className="py-2.5 px-4">Cuenta Banco/Caja</th>
              <th className="py-2.5 px-4">Contrapartida</th>
              <th className="py-2.5 px-4 text-right">Monto</th>
              <th className="py-2.5 px-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {movs.map((m: any, idx: number) => {
              const isEditing = editingMovId === m.id;
              return (
                <tr key={m.id || idx} className="hover:bg-white/80 transition-colors">
                  <td className="py-2 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                    {m.fecha}
                  </td>
                  <td className="py-2 px-4 max-w-[220px]">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editDescValue}
                          onChange={(e) => setEditDescValue(e.target.value)}
                          className="w-full text-xs px-2 py-1 border rounded bg-white"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveDescription(m)}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          title="Guardar"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingMovId(null)}
                          className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                          title="Cancelar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between group/desc">
                        <span className="truncate font-medium text-slate-800" title={m.descripcion}>{m.descripcion || '-'}</span>
                        <button
                          onClick={() => {
                            setEditingMovId(m.id);
                            setEditDescValue(m.descripcion || '');
                          }}
                          className="opacity-0 group-hover/desc:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 transition-opacity ml-1"
                          title="Editar descripción"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-4 whitespace-nowrap text-slate-600 font-medium">
                    {m.bancoNombre || m.cuentaBancoNombre || '-'}
                  </td>
                  <td className="py-2 px-4 whitespace-nowrap text-slate-600">
                    <span className="font-mono text-[11px] text-indigo-600">{m.cuentaCodigo || ''}</span>{' '}
                    <span className="text-[11px]">{m.cuentaNombre || '-'}</span>
                  </td>
                  <td className="py-2 px-4 text-right font-mono font-bold whitespace-nowrap">
                    <span className={sign === '+' ? 'text-emerald-600' : 'text-rose-600'}>
                      {sign}${formatoES(m.monto)}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-center whitespace-nowrap">
                    <button
                      onClick={() => {
                        setReclassifyingMov(m);
                        setSelectedNewArea(m.areaFlujoCaja || '');
                      }}
                      className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors"
                      title="Reclasificar rubro de flujo"
                    >
                      Reclasificar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ============================================
  // CÁLCULOS PARA FLUJO DE CAJA (CASH FLOW)
  // ============================================
  const cashFlowMetrics = useMemo(() => {
    // Helper to identify Cash and Bank accounts
    const isCuentaEfectivoYBanco = (cta: any) => {
      if (!cta) return false;
      const cod = cta.codigo || '';
      const nom = (cta.nombre || '').toLowerCase();
      // Also check if any bank is configured with this account ID
      const associatedBank = (bancos || []).some(b => 
        (b.cuenta_contable_id && String(b.cuenta_contable_id) === String(cta.id)) ||
        (b.cuenta_contable_id && String(b.cuenta_contable_id) === String(cta.codigo))
      );
      return (
        cod.startsWith('1.1.1') || 
        nom.includes('caja') || 
        nom.includes('banco') || 
        nom.includes('efectivo') || 
        nom.includes('cash') ||
        associatedBank
      );
    };

    const cashBankAccounts = (cuentasContables || []).filter(isCuentaEfectivoYBanco);
    const cashBankIds = new Set(cashBankAccounts.map(c => String(c.id)));
    const cashBankCodigos = new Set(cashBankAccounts.map(c => String(c.codigo)));

    const bankAccountIdsAndCodigos = new Set(
      (bancos || [])
        .map(b => b.cuenta_contable_id ? String(b.cuenta_contable_id) : null)
        .filter(Boolean)
    );

    const isCashBankIdOrCodigo = (val: any) => {
      if (!val) return false;
      const valStr = String(val);
      if (bankAccountIdsAndCodigos.has(valStr)) return true;
      return cashBankIds.has(valStr) || cashBankCodigos.has(valStr);
    };

    // 1. Saldo Inicial: acumulado de comprobantes antes de startDate
    const pastComprobantes = (comprobantes || []).filter(c => c.estado === 'Contabilizado' && (c.fecha || '').split('T')[0] < startDate);
    let saldoInicial = 0;
    pastComprobantes.forEach(comp => {
      (comp.lineas || []).forEach((line: any) => {
        if (isCashBankIdOrCodigo(line.cuentaId)) {
          saldoInicial += (Number(line.debe) || 0) - (Number(line.haber) || 0);
        }
      });
    });

    // 2. Comprobantes del período seleccionado
    const periodComprobantes = (comprobantes || []).filter(c => 
      c.estado === 'Contabilizado' && 
      (c.fecha || '').split('T')[0] >= startDate && 
      (c.fecha || '').split('T')[0] <= endDate
    );

    const movsPeriodo: any[] = [];
    
    // Build virtual movements in the period
    periodComprobantes.forEach(comp => {
      const lines = comp.lineas || [];
      const cashLines = lines.filter((l: any) => isCashBankIdOrCodigo(l.cuentaId));
      const nonCashLines = lines.filter((l: any) => !isCashBankIdOrCodigo(l.cuentaId));

      if (cashLines.length === 0) return;

      const compDesc = (comp.descripcion || '').toLowerCase();
      const compRef = String(comp.numero || comp.referencia || '').toLowerCase();
      const isTransferFromModule = 
        comp.modulo === 'Tesorería' && 
        (compRef.startsWith('trf-') || compDesc.startsWith('traspaso:'));
      
      const isAnyTraspasoComp = 
        isTransferFromModule || 
        compRef.startsWith('trf-') || 
        compDesc.includes('traspaso') || 
        compDesc.includes('transferencia entre cuentas') || 
        compDesc.includes('traspaso de fondos');

      cashLines.forEach((cashLine: any, index: number) => {
        const debeAmt = Number(cashLine.debe) || 0;
        const haberAmt = Number(cashLine.haber) || 0;

        if (debeAmt === 0 && haberAmt === 0) return;

        // Find counterpart
        let counterpartCtaId = '';
        if (nonCashLines.length > 0) {
          let maxAmt = -1;
          nonCashLines.forEach((l: any) => {
            const amt = Math.max(Number(l.debe) || 0, Number(l.haber) || 0);
            if (amt > maxAmt) {
              maxAmt = amt;
              counterpartCtaId = l.cuentaId;
            }
          });
        } else if (cashLines.length > 1) {
          // Internal transfer between cash/bank accounts
          const isDebe = debeAmt > 0;
          const oppositeLine = cashLines.find((l: any, idx: number) => 
            idx !== index && (isDebe ? (Number(l.haber) || 0) > 0 : (Number(l.debe) || 0) > 0)
          );
          if (oppositeLine) {
            counterpartCtaId = oppositeLine.cuentaId;
          }
        }

        const lineIndexInComp = (comp.lineas || []).findIndex((l: any) => l === cashLine);

        const m = {
          id: `${comp.id}-l-${cashLine.id || index}-${debeAmt > 0 ? 'debe' : 'haber'}`,
          fecha: comp.fecha,
          ref: comp.numero || comp.referencia || '',
          descripcion: cashLine.descripcion || comp.descripcion || (debeAmt > 0 ? 'Ingreso de caja' : 'Egreso de caja'),
          monto: debeAmt > 0 ? debeAmt : haberAmt,
          tipo: debeAmt > 0 ? 'ingreso' : 'egreso',
          cuentaContrapartida: counterpartCtaId,
          banco_id: cashLine.cuentaId,
          comprobanteId: comp.id,
          lineIndex: lineIndexInComp,
          isStrictTraspaso: isAnyTraspasoComp,
          areaFlujoCajaOverride: cashLine.areaFlujoCaja || null
        };

        movsPeriodo.push(m);
      });
    });

    const movsCobranzas: any[] = [];
    const movsPrestamosRecibidos: any[] = [];
    const movsGastosER: any[] = [];
    const movsPrestamosOtorgados: any[] = [];
    const movsSeniat: any[] = [];
    const movsDirectivos: any[] = [];
    const movsTraspasosIngresos: any[] = [];
    const movsTraspasosEgresos: any[] = [];
    const movsProveedoresReal: any[] = [];

    movsPeriodo.forEach(m => {
      const descLow = (m.descripcion || '').toLowerCase();
      const isTraspaso = m.isStrictTraspaso || descLow.includes('traspaso') || descLow.includes('transferencia entre cuentas') || descLow.includes('traspaso de fondos');

      const ctaObj = cuentasContables.find(c => 
        String(c.id) === String(m.cuentaContrapartida) || 
        (c.codigo && String(c.codigo) === String(m.cuentaContrapartida))
      );

      const isCounterpartCash = ctaObj && isCuentaEfectivoYBanco(ctaObj);
      const actsAsTraspaso = isTraspaso || isCounterpartCash;

      const activeArea = m.areaFlujoCajaOverride || (ctaObj ? ctaObj.areaFlujoCaja : null);

      if (activeArea === 'traspasos' || (actsAsTraspaso && !m.areaFlujoCajaOverride)) {
        if (m.tipo === 'ingreso') {
          movsTraspasosIngresos.push({ ...m, clasificacionInterna: 'Ingresos por traspasos' });
        } else {
          movsTraspasosEgresos.push({ ...m, clasificacionInterna: 'Egresos por traspasos' });
        }
      } else if (activeArea) {
        const area = activeArea;
        if (m.tipo === 'ingreso') {
          if (area === 'cobranzas') {
            movsCobranzas.push({ ...m, clasificacionInterna: 'Ingresos por cobranzas' });
          } else if (area === 'recibidos') {
            movsPrestamosRecibidos.push({ ...m, clasificacionInterna: 'Ingresos por prestamos recibidos' });
          } else if (area === 'traspasos') {
            movsTraspasosIngresos.push({ ...m, clasificacionInterna: 'Ingresos por traspasos' });
          } else {
            movsCobranzas.push({ ...m, clasificacionInterna: 'Ingresos por cobranzas' });
          }
        } else {
          if (area === 'gastos_er') {
            movsGastosER.push({ ...m, clasificacionInterna: 'Gastos pagados que van al estado de resultado' });
          } else if (area === 'proveedores_real') {
            movsProveedoresReal.push({ ...m, clasificacionInterna: 'Pagos de proveedores y cuentas por pagar' });
          } else if (area === 'prestamos_ot') {
            movsPrestamosOtorgados.push({ ...m, clasificacionInterna: 'Prestamos otorgados' });
          } else if (area === 'seniat') {
            movsSeniat.push({ ...m, clasificacionInterna: 'Pagos realizados de las cajas seniat' });
          } else if (area === 'directivos') {
            movsDirectivos.push({ ...m, clasificacionInterna: 'Pagos a directivos' });
          } else if (area === 'traspasos') {
            movsTraspasosEgresos.push({ ...m, clasificacionInterna: 'Egresos por traspasos' });
          } else {
            movsGastosER.push({ ...m, clasificacionInterna: 'Gastos pagados que van al estado de resultado' });
          }
        }
      } else if (ctaObj) {
        const ctaCodigo = ctaObj.codigo || '';
        const firstChar = ctaCodigo.charAt(0);
        const ctaNombreLow = (ctaObj.nombre || '').toLowerCase();
        const ctaGrupoLow = (ctaObj.grupo || '').toLowerCase();

        if (m.tipo === 'ingreso') {
          const esPrestamoRecibido = ctaCodigo.startsWith('2.1.2') || ctaCodigo.startsWith('2.2') || ctaNombreLow.includes('prestamo') || ctaNombreLow.includes('préstamo') || ctaNombreLow.includes('credito') || ctaNombreLow.includes('crédito') || ctaNombreLow.includes('financiamiento') || ctaNombreLow.includes('obligacion') || ctaNombreLow.includes('obligación');
          
          if (esPrestamoRecibido) {
            movsPrestamosRecibidos.push({ ...m, clasificacionInterna: 'Ingresos por prestamos recibidos' });
          } else {
            movsCobranzas.push({ ...m, clasificacionInterna: 'Ingresos por cobranzas' });
          }
        } else {
          const esPrestamoOtorgado = ctaCodigo.startsWith('1.1.3') || ctaNombreLow.includes('prestamos otorgados') || ctaNombreLow.includes('préstamo otorgado') || ctaNombreLow.includes('prestamos a terceros') || ctaNombreLow.includes('préstamo socio') || ctaNombreLow.includes('préstamos a empleados') || ctaNombreLow.includes('otorgado') || ctaNombreLow.includes('avance') || ctaNombreLow.includes('prestamo socio') || ctaNombreLow.includes('prestamos socios') || ctaNombreLow.includes('financiamiento otorgado');
          const esDirectivo = firstChar === '3' || ctaGrupoLow.includes('patrimonio') || ctaNombreLow.includes('socio') || ctaNombreLow.includes('director') || ctaNombreLow.includes('directivo') || ctaNombreLow.includes('gerente') || ctaNombreLow.includes('accionista') || ctaNombreLow.includes('dividendo') || ctaNombreLow.includes('junta');
          
          const hasTasaExclusion = ctaNombreLow.includes('interes') || ctaNombreLow.includes('interés') || ctaNombreLow.includes('cambio') || ctaNombreLow.includes('banco') || ctaNombreLow.includes('bancari') || ctaNombreLow.includes('comision') || ctaNombreLow.includes('comisión');
          const esSeniat = ctaCodigo.startsWith('2.1.3') || ctaNombreLow.includes('seniat') || ctaNombreLow.includes('impuesto') || ctaNombreLow.includes('iva') || ctaNombreLow.includes('retencion') || ctaNombreLow.includes('retención') || ctaNombreLow.includes('islr') || ctaNombreLow.includes('patente') || ctaNombreLow.includes('tributo') || (ctaNombreLow.includes('tasa') && !hasTasaExclusion) || ctaNombreLow.includes('tasas') || ctaNombreLow.includes('contribuy') || ctaNombreLow.includes('municipal');

          if (esPrestamoOtorgado) {
            movsPrestamosOtorgados.push({ ...m, clasificacionInterna: 'Prestamos otorgados' });
          } else if (esDirectivo) {
            movsDirectivos.push({ ...m, clasificacionInterna: 'Pagos a directivos' });
          } else if (esSeniat) {
            movsSeniat.push({ ...m, clasificacionInterna: 'Pagos realizados de las cajas seniat' });
          } else if (firstChar === '4' || firstChar === '5' || firstChar === '6' || ctaGrupoLow.includes('egresos') || ctaGrupoLow.includes('gastos') || ctaGrupoLow.includes('costos')) {
            movsGastosER.push({ ...m, clasificacionInterna: 'Gastos pagados que van al estado de resultado' });
          } else if (firstChar === '1' || firstChar === '2' || ctaGrupoLow.includes('activo') || ctaGrupoLow.includes('pasivo')) {
            movsProveedoresReal.push({ ...m, clasificacionInterna: 'Pagos de proveedores y cuentas por pagar' });
          } else {
            movsGastosER.push({ ...m, clasificacionInterna: 'Gastos pagados que van al estado de resultado' });
          }
        }
      } else {
        if (m.tipo === 'ingreso') {
          const esPrestamo = descLow.includes('prestamo') || descLow.includes('préstamo') || descLow.includes('credito') || descLow.includes('crédito') || descLow.includes('financiamiento');
          if (esPrestamo) {
            movsPrestamosRecibidos.push({ ...m, clasificacionInterna: 'Ingresos por prestamos recibidos' });
          } else {
            movsCobranzas.push({ ...m, clasificacionInterna: 'Ingresos por cobranzas' });
          }
        } else {
          const esPrestamoOtorgado = descLow.includes('prestamo') || descLow.includes('préstamo') || descLow.includes('credito') || descLow.includes('crédito') || descLow.includes('avance') || descLow.includes('otorgado') || descLow.includes('financiamiento');
          const esDirectivo = descLow.includes('socio') || descLow.includes('director') || descLow.includes('directivo') || descLow.includes('gerente') || descLow.includes('accionista') || descLow.includes('junt') || descLow.includes('dividendo');
          
          const hasTasaExclusionDesc = descLow.includes('interes') || descLow.includes('interés') || descLow.includes('cambio') || descLow.includes('banco') || descLow.includes('bancari') || descLow.includes('comision') || descLow.includes('comisión');
          const esSeniat = descLow.includes('seniat') || descLow.includes('impuesto') || descLow.includes('iva') || descLow.includes('retencion') || descLow.includes('retención') || descLow.includes('islr') || descLow.includes('patente') || descLow.includes('tributo') || (descLow.includes('tasa') && !hasTasaExclusionDesc) || descLow.includes('tasas') || descLow.includes('municip') || descLow.includes('contribuy');
          const esProveedor = descLow.includes('proveedor') || descLow.includes('factura') || descLow.includes('cxp') || descLow.includes('cuenta por pagar') || descLow.includes('abono') || descLow.includes('obligación') || descLow.includes('compra');

          if (esPrestamoOtorgado) {
            movsPrestamosOtorgados.push({ ...m, clasificacionInterna: 'Prestamos otorgados' });
          } else if (esDirectivo) {
            movsDirectivos.push({ ...m, clasificacionInterna: 'Pagos a directivos' });
          } else if (esSeniat) {
            movsSeniat.push({ ...m, clasificacionInterna: 'Pagos realizados de las cajas seniat' });
          } else if (esProveedor) {
            movsProveedoresReal.push({ ...m, clasificacionInterna: 'Pagos de proveedores y cuentas por pagar' });
          } else {
            movsGastosER.push({ ...m, clasificacionInterna: 'Gastos pagados que van al estado de resultado' });
          }
        }
      }
    });

    const totalCobranzas = movsCobranzas.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);
    const totalPrestamosRecibidos = movsPrestamosRecibidos.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);
    const totalGastosER = movsGastosER.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);
    const totalPrestamosOtorgados = movsPrestamosOtorgados.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);
    const totalSeniat = movsSeniat.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);
    const totalDirectivos = movsDirectivos.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);
    const totalTraspasosIngresos = movsTraspasosIngresos.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);
    const totalTraspasosEgresos = movsTraspasosEgresos.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);
    const totalProveedoresReal = movsProveedoresReal.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);

    // Force internal transfers to perfectly balance to 0 net effect
    const balancedTraspasoVal = Math.max(totalTraspasosIngresos, totalTraspasosEgresos);

    const totalIngresos = totalCobranzas + totalPrestamosRecibidos + balancedTraspasoVal;
    const totalEgresos = totalGastosER + totalProveedoresReal + totalPrestamosOtorgados + totalSeniat + totalDirectivos + balancedTraspasoVal;
    const flujoNeto = totalIngresos - totalEgresos;
    const saldoFinal = saldoInicial + flujoNeto;

    // Todas las subdivisiones juntas ordenadas cronológicamente para el historial de caja
    const movsClassified = [
      ...movsCobranzas,
      ...movsPrestamosRecibidos,
      ...movsGastosER,
      ...movsProveedoresReal,
      ...movsPrestamosOtorgados,
      ...movsSeniat,
      ...movsDirectivos,
      ...movsTraspasosIngresos,
      ...movsTraspasosEgresos
    ].sort((a, b) => b.fecha.localeCompare(a.fecha));

    return {
      saldoInicial,
      totalCobranzas,
      totalPrestamosRecibidos,
      totalGastosER,
      totalProveedoresReal,
      totalPrestamosOtorgados,
      totalSeniat,
      totalDirectivos,
      totalTraspasosIngresos: balancedTraspasoVal,
      totalTraspasosEgresos: balancedTraspasoVal,
      saldoFinal,
      movsClassified,
      
      // Retrocompatibilidad o redundancia
      movsPeriodo,
      flujoNeto,
      ingresosPeriodo: totalIngresos,
      egresosPeriodo: totalEgresos,
      movsIngresos: movsCobranzas,
      movsGastos: movsGastosER,
      movsFinanciamiento: [ ...movsPrestamosRecibidos, ...movsPrestamosOtorgados, ...movsDirectivos ],
      movsTraspasos: [ ...movsTraspasosIngresos, ...movsTraspasosEgresos ],
      totalIngresosCaja: totalCobranzas,
      totalGastosResultado: totalGastosER,
      totalFinanciamientoIngresos: totalPrestamosRecibidos,
      totalFinanciamientoEgresos: totalPrestamosOtorgados + totalDirectivos,
      totalFinanciamientoNeto: totalPrestamosRecibidos - (totalPrestamosOtorgados + totalDirectivos),
      totalTraspasosNeto: 0,

      ingresosPorBanco: {},
      egresosPorBanco: {},
      ingresosCategorias: {},
      egresosCategorias: {},
      proyeccion: {
        cxc: { r15: 0, r30: 0, r60: 0, rMas: 0 },
        cxp: { r15: 0, r30: 0, r60: 0, rMas: 0 }
      }
    };
  }, [comprobantes, cuentasContables, bancos, startDate, endDate]);

  const bancosConSaldos = useMemo(() => {
    return (bancos || []).map(b => {
      let saldoUSD = 0;
      // Filter accounting entries where status is Contabilizado and date is less than or equal to endDate
      const relevantComps = (comprobantes || []).filter(c => c.estado === 'Contabilizado' && (c.fecha || '').split('T')[0] <= endDate);
      relevantComps.forEach(comp => {
        (comp.lineas || []).forEach((line: any) => {
          if (String(line.cuentaId) === String(b.cuenta_contable_id)) {
            saldoUSD += (Number(line.debe) || 0) - (Number(line.haber) || 0);
          }
        });
      });

      // Find the last SAPS movement for this bank
      const sapsMovs = (movimientosBancos || []).filter(
        m => String(m.banco_id) === String(b.id) && 
        (m.tipo === 'ajuste_ganancia' || m.tipo === 'ajuste_perdida') && 
        m.estado !== 'anulado' && 
        (m.fecha || '').split('T')[0] <= endDate
      );
      
      let lastSapsRate = null;
      if (sapsMovs.length > 0) {
        const sortedSaps = [...sapsMovs].sort((a, b) => {
          const dateComp = (b.fecha || '').localeCompare(a.fecha || '');
          if (dateComp !== 0) return dateComp;
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : Number(a.id) || 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : Number(b.id) || 0;
          return timeB - timeA;
        });
        const latestSaps = sortedSaps[0];
        if (latestSaps.tasa && Number(latestSaps.tasa) > 1) {
          lastSapsRate = Number(latestSaps.tasa);
        } else {
          // If the tasa is 0 or not set, find the latest movement's tasa for this bank that is > 1 on or before the SAPS date
          const prevMovsWithTasa = (movimientosBancos || []).filter(
            m => String(m.banco_id) === String(b.id) && 
            m.estado !== 'anulado' && 
            (m.fecha || '').split('T')[0] <= latestSaps.fecha && 
            m.tasa && Number(m.tasa) > 1
          );
          if (prevMovsWithTasa.length > 0) {
            prevMovsWithTasa.sort((a, b) => {
              const dateComp = (b.fecha || '').localeCompare(a.fecha || '');
              if (dateComp !== 0) return dateComp;
              const timeA = a.createdAt ? new Date(a.createdAt).getTime() : Number(a.id) || 0;
              const timeB = b.createdAt ? new Date(b.createdAt).getTime() : Number(b.id) || 0;
              return timeB - timeA;
            });
            lastSapsRate = Number(prevMovsWithTasa[0].tasa);
          }
        }
      }

      // If we still don't have a SAPS rate, but the account is Bolivares, find the latest movement with any rate > 1 as fallback
      let fallbackRate = null;
      if (!lastSapsRate && b.moneda === 'Bolivares') {
        const bankMovs = (movimientosBancos || []).filter(
          m => String(m.banco_id) === String(b.id) && m.estado !== 'anulado' && (m.fecha || '').split('T')[0] <= endDate
        );
        const movsWithTasa = bankMovs.filter(m => m.tasa && Number(m.tasa) > 1);
        if (movsWithTasa.length > 0) {
          const sortedMovs = [...movsWithTasa].sort((a, b) => {
            const dateComp = (b.fecha || '').localeCompare(a.fecha || '');
            if (dateComp !== 0) return dateComp;
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : Number(a.id) || 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : Number(b.id) || 0;
            return timeB - timeA;
          });
          fallbackRate = Number(sortedMovs[0].tasa);
        }
      }

      const effectiveRate = lastSapsRate || fallbackRate || Number(b.tasa) || 1;
      let saldoVES = saldoUSD * effectiveRate;
      if (b.moneda === 'Bolivares') {
        let accumulatedVES = 0;
        const bankMovs = (movimientosBancos || []).filter(
          m => String(m.banco_id) === String(b.id) && m.estado !== 'anulado' && (m.fecha || '').split('T')[0] <= endDate
        );
        bankMovs.forEach(m => {
          let mVES = (m.montoBs !== undefined && m.montoBs !== null && m.montoBs !== '') ? parseFloat(String(m.montoBs)) : m.monto * (m.tasa || b.tasa || 1);
          if (m.tipo === 'ajuste_ganancia' || m.tipo === 'ajuste_perdida') mVES = 0;
          accumulatedVES += (m.tipo === 'ingreso' || m.tipo === 'ajuste_ganancia') ? mVES : -mVES;
        });
        saldoVES = accumulatedVES;
      }
      return { ...b, saldoUSD, saldoVES, lastSapsRate, effectiveRate };
    });
  }, [bancos, comprobantes, endDate, movimientosBancos]);

  const totalBancosSaldosUSD = useMemo(() => {
    return bancosConSaldos.reduce((sum, b) => sum + b.saldoUSD, 0);
  }, [bancosConSaldos]);

  const cumulativeCashChartData = useMemo(() => {
    const startY = parseInt(startDate.slice(0, 4)) || new Date().getFullYear();
    const startM = parseInt(startDate.slice(5, 7)) || 1;
    const endY = parseInt(endDate.slice(0, 4)) || new Date().getFullYear();
    const endM = parseInt(endDate.slice(5, 7)) || 12;

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dataByMonth = [];

    const firstYearMonthStr = `${startY}-${String(startM).padStart(2, '0')}-01`;

    const isCuentaEfectivoYBanco = (cta: any) => {
      if (!cta) return false;
      const cod = cta.codigo || '';
      const nom = (cta.nombre || '').toLowerCase();
      return (
        cod.startsWith('1.1.1') || 
        nom.includes('caja') || 
        nom.includes('banco') || 
        nom.includes('efectivo') || 
        nom.includes('cash')
      );
    };

    const cashBankAccounts = (cuentasContables || []).filter(isCuentaEfectivoYBanco);
    const cashBankIds = new Set(cashBankAccounts.map(c => String(c.id)));
    const cashBankCodigos = new Set(cashBankAccounts.map(c => String(c.codigo)));

    const bankAccountIdsAndCodigos = new Set(
      (bancos || [])
        .map(b => b.cuenta_contable_id ? String(b.cuenta_contable_id) : null)
        .filter(Boolean)
    );

    const isCashBankIdOrCodigo = (val: any) => {
      if (!val) return false;
      const valStr = String(val);
      if (bankAccountIdsAndCodigos.has(valStr)) return true;
      return cashBankIds.has(valStr) || cashBankCodigos.has(valStr);
    };

    const isContabilizado = (c: any) => {
      if (!c.estado) return true;
      const e = String(c.estado).toLowerCase().trim();
      return e === 'contabilizado' || e === 'aprobado' || e === 'registrado';
    };

    // Calculate initial cumulative cash balance before first month in chart range
    const pastComps = (comprobantes || []).filter(c => isContabilizado(c) && (c.fecha || '').split('T')[0] < firstYearMonthStr);
    let cumulative = 0;
    pastComps.forEach(comp => {
      (comp.lineas || []).forEach((line: any) => {
        if (isCashBankIdOrCodigo(line.cuentaId || line.cuenta_id)) {
          cumulative += (Number(line.debe) || 0) - (Number(line.haber) || 0);
        }
      });
    });

    let currentY = startY;
    let currentM = startM;
    let count = 0;

    while ((currentY < endY || (currentY === endY && currentM <= endM)) && count < 36) {
      const monthStr = String(currentM).padStart(2, '0');
      const yearMonthKey = `${currentY}-${monthStr}`;

      const monthComps = (comprobantes || []).filter(c => 
        isContabilizado(c) && 
        c.fecha.startsWith(yearMonthKey) && 
        (c.fecha || '').split('T')[0] >= startDate && 
        (c.fecha || '').split('T')[0] <= endDate
      );

      let ingresos = 0;
      let egresos = 0;
      
      monthComps.forEach(comp => {
        (comp.lineas || []).forEach((line: any) => {
          if (isCashBankIdOrCodigo(line.cuentaId || line.cuenta_id)) {
            const debe = Number(line.debe) || 0;
            const haber = Number(line.haber) || 0;
            if (debe > 0) ingresos += debe;
            if (haber > 0) egresos += haber;
          }
        });
      });

      const neto = ingresos - egresos;
      cumulative += neto;

      const nameLabel = startY === endY 
        ? monthNames[currentM - 1] 
        : `${monthNames[currentM - 1]} '${String(currentY).slice(-2)}`;

      dataByMonth.push({
        name: nameLabel,
        Ingresos: ingresos,
        Egresos: egresos,
        "Saldo Caja": cumulative
      });

      currentM++;
      if (currentM > 12) {
        currentM = 1;
        currentY++;
      }
      count++;
    }

    if (dataByMonth.length === 0) {
      return [{ name: 'Sin datos', Ingresos: 0, Egresos: 0, "Saldo Caja": cumulative }];
    }

    return dataByMonth;
  }, [comprobantes, cuentasContables, startDate, endDate]);


  // ============================================
  // CÁLCULOS PARA INFORMES CONTABLES
  // ============================================

  // 1. Balance de Comprobación
  const balanceComprobacion = useMemo(() => {
    const isContabilizado = (c: any) => {
      if (!c.estado) return true;
      const e = String(c.estado).toLowerCase().trim();
      return e === 'contabilizado' || e === 'aprobado' || e === 'registrado';
    };

    const isLineForAccount = (linea: any, cuenta: any) => {
      const cId = String(linea.cuentaId || linea.cuenta_id || linea.cuentaCodigo || linea.codigo || '').trim();
      if (!cId) return false;
      return String(cuenta.id) === cId || String(cuenta.codigo) === cId || (cuenta.codigo && cuenta.codigo.replace(/\./g, '') === cId.replace(/\./g, ''));
    };

    const cuentasMovimiento = cuentasContables.filter(c => c.tipo === 'Movimiento' || (!c.tipo && c.codigo && c.codigo.split('.').length >= 3)).sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
    
    const pastComprobantes = comprobantes.filter(c => isContabilizado(c) && (c.fecha || '').split('T')[0] < startDate);
    const periodComprobantes = comprobantes.filter(c => isContabilizado(c) && (c.fecha || '').split('T')[0] >= startDate && (c.fecha || '').split('T')[0] <= endDate);

    const report = cuentasMovimiento.map(cuenta => {
      let saldoInicialDeudor = 0;
      let saldoInicialAcreedor = 0;
      let debitos = 0;
      let creditos = 0;

      // 1- FÓRMULA UNIFICADA DE SALDOS: Determinar el Saldo Inicial como el balance de cierre exacto del período inmediatamente anterior (antes de la fecha de inicio seleccionada).
      let pastDebitosTotal = 0;
      let pastCreditosTotal = 0;

      pastComprobantes.forEach(comp => {
        (comp.lineas || []).forEach((linea: any) => {
          if (isLineForAccount(linea, cuenta)) {
            pastDebitosTotal += Number(linea.debe) || 0;
            pastCreditosTotal += Number(linea.haber) || 0;
          }
        });
      });

      const nat = cuenta.naturaleza || (cuenta.codigo?.startsWith('1') || cuenta.codigo?.startsWith('5') || cuenta.codigo?.startsWith('6') ? 'Deudora' : 'Acreedora');

      if (nat === 'Deudora') {
        const saldoAnteriorNeto = pastDebitosTotal - pastCreditosTotal;
        if (saldoAnteriorNeto >= 0) {
          saldoInicialDeudor = saldoAnteriorNeto;
          saldoInicialAcreedor = 0;
        } else {
          saldoInicialDeudor = 0;
          saldoInicialAcreedor = Math.abs(saldoAnteriorNeto);
        }
      } else {
        const saldoAnteriorNeto = pastCreditosTotal - pastDebitosTotal;
        if (saldoAnteriorNeto >= 0) {
          saldoInicialDeudor = 0;
          saldoInicialAcreedor = saldoAnteriorNeto;
        } else {
          saldoInicialDeudor = Math.abs(saldoAnteriorNeto);
          saldoInicialAcreedor = 0;
        }
      }

      // 2- MOVIMIENTOS REALES: Lectura cronológica exacta de los débitos y créditos del período actual seleccionado sin alterar movimientos vigentes.
      periodComprobantes.forEach(comp => {
        (comp.lineas || []).forEach((linea: any) => {
          if (isLineForAccount(linea, cuenta)) {
            debitos += Number(linea.debe) || 0;
            creditos += Number(linea.haber) || 0;
          }
        });
      });

      // 3- FÓRMULA DE CIERRE: Directiva limpia Saldo Actual = Saldo Inicial + Monto Debe - Monto Haber
      let saldoFinalDeudor = 0;
      let saldoFinalAcreedor = 0;

      if (nat === 'Deudora') {
        const saldoFinalNeto = (saldoInicialDeudor - saldoInicialAcreedor) + debitos - creditos;
        if (saldoFinalNeto >= 0) {
          saldoFinalDeudor = saldoFinalNeto;
          saldoFinalAcreedor = 0;
        } else {
          saldoFinalDeudor = 0;
          saldoFinalAcreedor = Math.abs(saldoFinalNeto);
        }
      } else {
        const saldoFinalNeto = (saldoInicialAcreedor - saldoInicialDeudor) + creditos - debitos;
        if (saldoFinalNeto >= 0) {
          saldoFinalDeudor = 0;
          saldoFinalAcreedor = saldoFinalNeto;
        } else {
          saldoFinalDeudor = Math.abs(saldoFinalNeto);
          saldoFinalAcreedor = 0;
        }
      }

      return {
        ...cuenta,
        saldoInicialDeudor,
        saldoInicialAcreedor,
        debitos,
        creditos,
        saldoFinalDeudor,
        saldoFinalAcreedor
      };
    });

    // Guardar solo las que tengan saldo inicial, movimientos activos o saldo final
    return report.filter(r => 
      r.saldoInicialDeudor !== 0 || 
      r.saldoInicialAcreedor !== 0 || 
      r.debitos !== 0 || 
      r.creditos !== 0 ||
      r.saldoFinalDeudor !== 0 ||
      r.saldoFinalAcreedor !== 0
    );
  }, [comprobantes, cuentasContables, startDate, endDate]);

  const totalesComprobacion = useMemo(() => {
    return balanceComprobacion.reduce((acc, curr) => ({
      saldoInicialDeudor: acc.saldoInicialDeudor + curr.saldoInicialDeudor,
      saldoInicialAcreedor: acc.saldoInicialAcreedor + curr.saldoInicialAcreedor,
      debitos: acc.debitos + curr.debitos,
      creditos: acc.creditos + curr.creditos,
      saldoFinalDeudor: acc.saldoFinalDeudor + curr.saldoFinalDeudor,
      saldoFinalAcreedor: acc.saldoFinalAcreedor + curr.saldoFinalAcreedor,
    }), {
      saldoInicialDeudor: 0, saldoInicialAcreedor: 0,
      debitos: 0, creditos: 0,
      saldoFinalDeudor: 0, saldoFinalAcreedor: 0
    });
  }, [balanceComprobacion]);

  // 1.1 Libro Mayor (General Ledger) calculation
  const libroMayorData = useMemo(() => {
    const isContabilizado = (c: any) => {
      if (!c.estado) return true;
      const e = String(c.estado).toLowerCase().trim();
      return e === 'contabilizado' || e === 'aprobado' || e === 'registrado';
    };

    const isLineForAccount = (linea: any, cuenta: any) => {
      const cId = String(linea.cuentaId || linea.cuenta_id || linea.cuentaCodigo || linea.codigo || '').trim();
      if (!cId) return false;
      return String(cuenta.id) === cId || String(cuenta.codigo) === cId || (cuenta.codigo && cuenta.codigo.replace(/\./g, '') === cId.replace(/\./g, ''));
    };

    const cuentasMovimiento = cuentasContables.filter(c => c.tipo === 'Movimiento' || (!c.tipo && c.codigo && c.codigo.split('.').length >= 3)).sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
    
    const pastComprobantes = comprobantes.filter(c => isContabilizado(c) && (c.fecha || '').split('T')[0] < startDate);
    const periodComprobantes = comprobantes.filter(c => isContabilizado(c) && (c.fecha || '').split('T')[0] >= startDate && (c.fecha || '').split('T')[0] <= endDate);

    return cuentasMovimiento.map(cuenta => {
      let pastDebitosTotal = 0;
      let pastCreditosTotal = 0;

      pastComprobantes.forEach(comp => {
        (comp.lineas || []).forEach((linea: any) => {
          if (isLineForAccount(linea, cuenta)) {
            pastDebitosTotal += Number(linea.debe) || 0;
            pastCreditosTotal += Number(linea.haber) || 0;
          }
        });
      });

      const nat = cuenta.naturaleza || (cuenta.codigo?.startsWith('1') || cuenta.codigo?.startsWith('5') || cuenta.codigo?.startsWith('6') ? 'Deudora' : 'Acreedora');
      const saldoInicial = nat === 'Deudora' ? (pastDebitosTotal - pastCreditosTotal) : (pastCreditosTotal - pastDebitosTotal);

      // Entries for period, sorted by date then code/id
      const sortedPeriodComprobantes = [...periodComprobantes].sort((a, b) => {
        const dateCompare = a.fecha.localeCompare(b.fecha);
        if (dateCompare !== 0) return dateCompare;
        return (a.numero || a.codigo || '').localeCompare(b.numero || b.codigo || '');
      });

      const entries: any[] = [];
      let runningBalance = saldoInicial;

      sortedPeriodComprobantes.forEach(comp => {
        (comp.lineas || []).forEach((linea: any) => {
          if (isLineForAccount(linea, cuenta)) {
            const debeVal = Number(linea.debe) || 0;
            const haberVal = Number(linea.haber) || 0;
            
            if (debeVal > 0 || haberVal > 0) {
              if (nat === 'Deudora') {
                runningBalance += (debeVal - haberVal);
              } else {
                runningBalance += (haberVal - debeVal);
              }

              entries.push({
                fecha: comp.fecha,
                comprobante: comp.numero || comp.codigo || 'N/A',
                comprobanteNumero: comp.numero || '',
                concepto: linea.descripcion || comp.descripcion || comp.glosa || comp.concepto || 'Sin descripción',
                debe: debeVal,
                haber: haberVal,
                saldo: runningBalance
              });
            }
          }
        });
      });

      const totalDebe = entries.reduce((sum, e) => sum + e.debe, 0);
      const totalHaber = entries.reduce((sum, e) => sum + e.haber, 0);

      return {
        ...cuenta,
        saldoInicial,
        nat,
        entries,
        totalDebe,
        totalHaber,
        saldoFinal: runningBalance
      };
    });
  }, [comprobantes, cuentasContables, startDate, endDate]);

  // Interfaces para la Balanza de Comprobación Jerárquica de 4 Columnas
  interface BalanzaRow {
    isSubtotal?: boolean;
    level?: number; // 1, 2, 3
    codigo: string;
    nombre: string;
    saldoInicial: number;
    debitos: number;
    creditos: number;
    saldoActual: number;
  }

  const balanzaHierarchicalRows = useMemo(() => {
    return balanceComprobacion.map(item => {
      const saldoInicial = item.saldoInicialDeudor - item.saldoInicialAcreedor;
      const debitos = item.debitos;
      const creditos = item.creditos;
      const saldoActual = (saldoInicial + debitos - creditos);
      return {
        codigo: item.codigo,
        nombre: item.nombre.toUpperCase(),
        saldoInicial,
        debitos,
        creditos,
        saldoActual
      };
    }).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, [balanceComprobacion]);

  const totalesHierarchical = useMemo(() => {
    let saldoInicial = 0;
    let debitos = 0;
    let creditos = 0;
    let saldoActual = 0;

    balanceComprobacion.forEach(item => {
      const init = item.saldoInicialDeudor - item.saldoInicialAcreedor;
      saldoInicial += init;
      debitos += item.debitos;
      creditos += item.creditos;
      saldoActual += (init + item.debitos - item.creditos);
    });

    return { saldoInicial, debitos, creditos, saldoActual };
  }, [balanceComprobacion]);

  // Formateador de fecha YYYY-MM-DD a DD/MM/YYYY
  const formatFechaDMY = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Fecha y hora actual formateada simulación para reporte de emisión
  const fechaEmisionStr = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = pad(now.getDate());
    const month = pad(now.getMonth() + 1);
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());
    const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
    hours = hours % 12;
    hours = hours ? hours : 12; // la hora '0' debe ser '12'
    const hoursStr = pad(hours);
    return `${day}/${month}/${year} a las ${hoursStr}:${minutes}:${seconds} ${ampm}`;
  }, []);

  // Función para descargar el Libro Mayor Analítico en formato Excel (.xlsx)
  const downloadMayorExcel = () => {
    let accountsToDisplay: any[] = [];

    if (mayorFilterMode === 'individual') {
      if (selectedMayorAccountId) {
        accountsToDisplay = libroMayorData.filter(acc => String(acc.id) === String(selectedMayorAccountId));
      }
    } else if (mayorFilterMode === 'rango') {
      if (desdeMayorAccountId && hastaMayorAccountId) {
        const desdeAcc = libroMayorData.find(acc => String(acc.id) === String(desdeMayorAccountId));
        const hastaAcc = libroMayorData.find(acc => String(acc.id) === String(hastaMayorAccountId));
        
        if (desdeAcc && hastaAcc) {
          const codMin = desdeAcc.codigo;
          const codMax = hastaAcc.codigo;
          const minCode = codMin.localeCompare(codMax) <= 0 ? codMin : codMax;
          const maxCode = codMin.localeCompare(codMax) <= 0 ? codMax : codMin;
          
          accountsToDisplay = libroMayorData.filter(acc => 
            acc.codigo >= minCode && acc.codigo <= maxCode
          );
        }
      }
    }

    if (mayorHideZero) {
      accountsToDisplay = accountsToDisplay.filter(acc => Math.abs(acc.saldoFinal) >= 0.01);
    }

    if (accountsToDisplay.length === 0) {
      if (showToast) {
        showToast('No hay datos para exportar en el Libro Mayor.', 'error');
      }
      return;
    }

    // Crear libro de Excel y filas de datos
    const wb = XLSX.utils.book_new();
    const rows: any[] = [];

    // Títulos de cabecera generales
    rows.push([empresa?.nombre || 'EMPRESA']);
    rows.push(['LIBRO MAYOR GENERAL']);
    rows.push([`Período: del ${formatFechaDMY(startDate)} al ${formatFechaDMY(endDate)}`]);
    rows.push([`Emitido el: ${fechaEmisionStr}`]);
    rows.push([]); // fila en blanco

    accountsToDisplay.forEach((acc) => {
      // Fila de cabecera de cuenta contable
      rows.push([
        `Cuenta: ${acc.codigo} - ${acc.nombre}`, 
        '', 
        '', 
        '', 
        `Naturaleza: ${acc.nat}`, 
        `Saldo Anterior: $${formatoES(acc.saldoInicial)}`
      ]);

      // Encabezados de columnas de la cuenta
      rows.push([
        'Fecha',
        'Documento / Asiento',
        'Nº Comprobante',
        'Descripción / Glosa',
        'Debe',
        'Haber',
        'Saldo Acumulado'
      ]);

      // Fila para el saldo inicial
      rows.push([
        '-',
        '-',
        '-',
        `SALDO INICIAL AL ${formatFechaDMY(startDate)}`,
        '',
        '',
        acc.saldoInicial
      ]);

      // Entradas/movimientos del periodo
      acc.entries.forEach((entry: any) => {
        rows.push([
          formatFechaDMY(entry.fecha),
          entry.comprobante !== 'N/A' ? `ASN-${entry.comprobante}` : 'ASN-N/A',
          entry.comprobanteNumero || '',
          entry.concepto,
          entry.debe > 0 ? entry.debe : 0,
          entry.haber > 0 ? entry.haber : 0,
          entry.saldo
        ]);
      });

      // Fila de totales para la cuenta
      rows.push([
        'SUMA DEL PERÍODO E IMPORTES',
        '',
        '',
        '',
        acc.totalDebe,
        acc.totalHaber,
        acc.saldoFinal
      ]);

      // Fila vacía de separación entre cuentas
      rows.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Definir anchos sugeridos de columnas para legibilidad
    ws['!cols'] = [
      { wch: 12 }, // Fecha
      { wch: 20 }, // Documento / Asiento
      { wch: 18 }, // Nº Comprobante
      { wch: 45 }, // Descripción / Glosa
      { wch: 15 }, // Debe
      { wch: 15 }, // Haber
      { wch: 18 }  // Saldo Acumulado
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Libro Mayor');
    
    const filename = `Libro_Mayor_${startDate}_al_${endDate}.xlsx`;
    XLSX.writeFile(wb, filename);

    if (showToast) {
      showToast('Libro Mayor descargado en Excel correctamente.', 'success');
    }
  };

  // Filas para el Resumen de Diario
  const resumenDiarioRows = useMemo(() => {
    const isContabilizado = (c: any) => {
      if (!c.estado) return true;
      const e = String(c.estado).toLowerCase().trim();
      return e === 'contabilizado' || e === 'aprobado' || e === 'registrado';
    };

    const periodComprobantes = comprobantes.filter(
      c => isContabilizado(c) && (c.fecha || '').split('T')[0] >= startDate && (c.fecha || '').split('T')[0] <= endDate
    );

    const aggregates: Record<string, { debe: number; haber: number }> = {};
    
    periodComprobantes.forEach(comp => {
      (comp.lineas || []).forEach((linea: any) => {
        const cId = String(linea.cuentaId || linea.cuenta_id || '').trim();
        if (!cId) return;
        const matched = cuentasContables.find(item => 
          String(item.id) === cId || 
          String(item.codigo) === cId || 
          (item.codigo && item.codigo.replace(/\./g, '') === cId.replace(/\./g, ''))
        );
        const key = matched ? matched.id : cId;
        const debe = Number(linea.debe) || 0;
        const haber = Number(linea.haber) || 0;
        if (debe > 0 || haber > 0) {
          if (!aggregates[key]) {
            aggregates[key] = { debe: 0, haber: 0 };
          }
          aggregates[key].debe += debe;
          aggregates[key].haber += haber;
        }
      });
    });

    const rows = Object.entries(aggregates).map(([cId, vals]) => {
      const cuentaObj = cuentasContables.find(item => 
        String(item.id) === cId || 
        String(item.codigo) === cId || 
        (item.codigo && item.codigo.replace(/\./g, '') === cId.replace(/\./g, ''))
      );
      return {
        id: cId,
        codigo: cuentaObj?.codigo || '',
        nombre: (cuentaObj?.nombre || '').toUpperCase(),
        debe: vals.debe,
        haber: vals.haber,
      };
    }).filter(r => r.debe > 0 || r.haber > 0);

    rows.sort((a, b) => a.codigo.localeCompare(b.codigo));
    return rows;
  }, [comprobantes, cuentasContables, startDate, endDate]);

  const resumenDiarioTotals = useMemo(() => {
    let totalDebe = 0;
    let totalHaber = 0;
    resumenDiarioRows.forEach(row => {
      totalDebe += row.debe;
      totalHaber += row.haber;
    });
    return { debe: totalDebe, haber: totalHaber };
  }, [resumenDiarioRows]);

  // 2. Estado de Resultados (Ingresos vs Gastos)
  const estadoResultados = useMemo(() => {
    const isContabilizado = (c: any) => {
      if (!c.estado) return true;
      const e = String(c.estado).toLowerCase().trim();
      return e === 'contabilizado' || e === 'aprobado' || e === 'registrado';
    };

    // 2.1 Filter all movement accounts from group 4 to 9
    const cuentasResultadoMovimiento = cuentasContables.filter(c => {
      const firstChar = c.codigo?.charAt(0);
      return firstChar >= '4' && firstChar <= '9';
    });
    
    cuentasResultadoMovimiento.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));

    const balancesNominales: Record<string, { debe: number; haber: number }> = {};
    cuentasResultadoMovimiento.forEach(c => {
      balancesNominales[c.id] = { debe: 0, haber: 0 };
    });

    const periodComprobantes = comprobantes.filter(c => isContabilizado(c) && (c.fecha || '').split('T')[0] >= startDate && (c.fecha || '').split('T')[0] <= endDate);

    periodComprobantes.forEach(comp => {
      (comp.lineas || []).forEach((linea: any) => {
        const cId = String(linea.cuentaId || linea.cuenta_id || '').trim();
        if (!cId) return;
        const matched = cuentasResultadoMovimiento.find(item => 
          String(item.id) === cId || 
          String(item.codigo) === cId || 
          (item.codigo && item.codigo.replace(/\./g, '') === cId.replace(/\./g, ''))
        );
        if (matched && balancesNominales[matched.id] !== undefined) {
          balancesNominales[matched.id].debe += Number(linea.debe) || 0;
          balancesNominales[matched.id].haber += Number(linea.haber) || 0;
        }
      });
    });

    const nombresGrupos: Record<string, string> = {
      '4': '4 - INGRESOS',
      '5': '5 - COSTOS Y EGRESOS DIRECTOS',
      '6': '6 - GASTOS DE OPERACIÓN',
      '7': '7 - OTROS INGRESOS',
      '8': '8 - OTROS EGRESOS Y GASTOS EXTRAORDINARIOS',
      '9': '9 - CUENTAS ESPECIALES Y DE CIERRE'
    };

    const grupos: Record<string, {
      digito: string;
      nombre: string;
      naturaleza: 'Deudora' | 'Acreedora';
      cuentas: any[];
      totalDebe: number;
      totalHaber: number;
      totalSaldo: number;
    }> = {};

    for (let i = 4; i <= 9; i++) {
      const digito = String(i);
      grupos[digito] = {
        digito,
        nombre: nombresGrupos[digito] || `${digito} - CUENTAS DE GRUPO ${digito}`,
        naturaleza: (digito === '4' || digito === '7') ? 'Acreedora' : 'Deudora',
        cuentas: [],
        totalDebe: 0,
        totalHaber: 0,
        totalSaldo: 0
      };
    }

    cuentasResultadoMovimiento.forEach(cuenta => {
      const firstChar = cuenta.codigo?.charAt(0);
      const grp = grupos[firstChar];
      if (!grp) return;

      const { debe, haber } = balancesNominales[cuenta.id] || { debe: 0, haber: 0 };
      
      const nat = cuenta.naturaleza || grp.naturaleza;
      const saldo = nat === 'Acreedora' ? (haber - debe) : (debe - haber);

      grp.cuentas.push({
        ...cuenta,
        debe,
        haber,
        saldo,
        nat
      });

      grp.totalDebe += debe;
      grp.totalHaber += haber;
      grp.totalSaldo += saldo;
    });

    // Filter out groups with no accounts in chart to avoid empty blocks
    const gruposList = Object.values(grupos).filter(g => g.cuentas.length > 0);

    let totalAcreedoras = 0;
    let totalDeudoras = 0;

    gruposList.forEach(g => {
      if (g.naturaleza === 'Acreedora') {
        totalAcreedoras += g.totalSaldo;
      } else {
        totalDeudoras += g.totalSaldo;
      }
    });

    const utilidadNeta = totalAcreedoras - totalDeudoras;

    // Classic / legacy variables calculation for complete compatibility with internal references if any:
    let ingresos = 0;
    let devolucionesVentas = 0;
    let costoVentas = 0;
    let gastosOperacionales = 0;
    let gastosAdmin = 0;
    let ingresosOtros = 0;

    periodComprobantes.forEach(comp => {
      (comp.lineas || []).forEach((linea: any) => {
        const cId = String(linea.cuentaId || linea.cuenta_id || '').trim();
        if (!cId) return;
        const cuentaObj = cuentasContables.find(ct => 
          String(ct.id) === cId || 
          String(ct.codigo) === cId || 
          (ct.codigo && ct.codigo.replace(/\./g, '') === cId.replace(/\./g, ''))
        );
        if (!cuentaObj) return;

        const cod = cuentaObj.codigo || '';
        const debe = Number(linea.debe) || 0;
        const haber = Number(linea.haber) || 0;

        if (cod.startsWith('4.1')) {
          ingresos += (haber - debe);
        } else if (cod.startsWith('4.2') || cod.startsWith('4.3')) {
          ingresosOtros += (haber - debe);
        } else if (cod.startsWith('5.1')) {
          costoVentas += (debe - haber);
        } else if (cod.startsWith('6.1') || cod.startsWith('5.2')) {
          gastosOperacionales += (debe - haber);
        } else if (cod.startsWith('6.2') || cod.startsWith('6.3') || cod.startsWith('5.3')) {
          gastosAdmin += (debe - haber);
        }
      });
    });

    const ingresosNetos = ingresos - devolucionesVentas;
    const utilidadBruta = ingresosNetos - costoVentas;
    const EBITDA = utilidadBruta - gastosOperacionales;

    return {
      ingresos,
      devolucionesVentas,
      ingresosNetos,
      costoVentas,
      utilidadBruta,
      gastosOperacionales,
      EBITDA,
      gastosAdmin,
      ingresosOtros,
      utilidadNeta,
      gruposList
    };
  }, [comprobantes, cuentasContables, startDate, endDate]);

  // 3. Balance General
  const balanceGeneral = useMemo(() => {
    const activeCuentas = cuentasContables || [];

    const pastComprobantes = comprobantes.filter(c => c.estado === 'Contabilizado' && (c.fecha || '').split('T')[0] <= endDate);

    const saldosCuentas: Record<string, number> = {};
    activeCuentas.forEach(c => {
      if (c.saldoActual !== undefined || c.saldo !== undefined) {
        saldosCuentas[c.id] = Number(c.saldoActual ?? c.saldo ?? 0);
      }
    });
    
    // Sumar todos los movimientos hasta la fecha de fin
    pastComprobantes.forEach(comp => {
      (comp.lineas || []).forEach((linea: any) => {
        const cId = linea.cuentaId;
        const c = activeCuentas.find(item => String(item.id) === String(cId));
        if (!c) return;
        
        const debe = Number(linea.debe) || 0;
        const haber = Number(linea.haber) || 0;
        const nat = c.naturaleza || (c.codigo?.startsWith('1') || c.codigo?.startsWith('5') || c.codigo?.startsWith('6') ? 'Deudora' : 'Acreedora');

        if (saldosCuentas[c.id] === undefined) {
          saldosCuentas[c.id] = 0;
        }

        if (nat === 'Deudora') {
          saldosCuentas[c.id] += (debe - haber);
        } else {
          saldosCuentas[c.id] += (haber - debe);
        }
      });
    });

    const isLeafAccount = (c: any) => {
      if (c.tipo === 'Movimiento' || c.isLeaf === true) return true;
      const hasChildren = activeCuentas.some(other => other.id !== c.id && (other.codigo || '').startsWith(c.codigo + '.'));
      return !hasChildren;
    };

    const isMovimientoActivo = (c: any) => {
      const saldo = saldosCuentas[c.id] || 0;
      if (!bgHideZero) return true;
      return Math.abs(saldo) >= 0.009;
    };

    const hasActiveCuentasHijas = (grupo: any) => {
      const gCod = grupo.codigo || '';
      return activeCuentas.some(c => {
        if (!isLeafAccount(c)) return false;
        if (!c.codigo.startsWith(gCod)) return false;
        return isMovimientoActivo(c);
      });
    };

    const activos: any[] = [];
    const pasivos: any[] = [];
    const patrimonio: any[] = [];

    let totalActivos = 0;
    let totalPasivos = 0;
    let totalPatrimonio = 0;

    activeCuentas.forEach(c => {
      const saldo = saldosCuentas[c.id] || 0;
      const cod = c.codigo || '';
      const isLeaf = isLeafAccount(c);

      if (isLeaf) {
        if (!isMovimientoActivo(c)) return;
      } else {
        if (bgHideZero && !hasActiveCuentasHijas(c)) return;
      }

      const record = {
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        tipo: c.tipo,
        saldo: saldo,
        isLeaf: isLeaf
      };

      if (cod.startsWith('1')) {
        activos.push(record);
        if (isLeaf) totalActivos += saldo;
      } else if (cod.startsWith('2')) {
        pasivos.push(record);
        if (isLeaf) totalPasivos += saldo;
      } else if (cod.startsWith('3')) {
        patrimonio.push(record);
        if (isLeaf) totalPatrimonio += saldo;
      }
    });

    {
      const utilidadResultados = estadoResultados.utilidadNeta;
      if (Math.abs(utilidadResultados) > 0.009) {
        patrimonio.push({
          id: 'UTILIDAD_TEMP',
          codigo: '3.9.9.99',
          nombre: 'Utilidad / Pérdida del Ejercicio Actual (P&L)',
          tipo: 'Movimiento',
          saldo: utilidadResultados
        });
        totalPatrimonio += utilidadResultados;
      }
    }

    return {
      activos: activos.sort((a, b) => a.codigo.localeCompare(b.codigo)),
      pasivos: pasivos.sort((a, b) => a.codigo.localeCompare(b.codigo)),
      patrimonio: patrimonio.sort((a, b) => a.codigo.localeCompare(b.codigo)),
      totalActivos,
      totalPasivos,
      totalPatrimonio,
      totalPasivoMasPatrimonio: totalPasivos + totalPatrimonio,
      descuadre: Math.abs(totalActivos - (totalPasivos + totalPatrimonio))
    };
  }, [comprobantes, cuentasContables, endDate, estadoResultados, bgHideZero]);

  const saludFinancieraSaldos = useMemo(() => {
    const activosMov = balanceGeneral.activos.filter(a => a.tipo === 'Movimiento' && Math.abs(a.saldo) > 0.009);
    const pasivosMov = balanceGeneral.pasivos.filter(p => p.tipo === 'Movimiento' && Math.abs(p.saldo) > 0.009);
    const patrimonioMov = balanceGeneral.patrimonio.filter(p => p.tipo === 'Movimiento' && Math.abs(p.saldo) > 0.009);

    const deCajaBancos: any[] = [];
    const deCxC: any[] = [];
    const deInventario: any[] = [];
    const deOtrosActivos: any[] = [];

    activosMov.forEach(a => {
      const cod = a.codigo || '';
      const nom = (a.nombre || '').toLowerCase();
      
      if (
        cod.startsWith('1.1.1') || 
        cod.startsWith('1.1.2') || 
        cod.startsWith('1.1.3') || 
        nom.includes('caja') || 
        nom.includes('banco') || 
        nom.includes('efectivo') || 
        nom.includes('cash')
      ) {
        deCajaBancos.push(a);
      } else if (
        cod.startsWith('1.1.4') || 
        nom.includes('cobrar') || 
        nom.includes('cxc') || 
        nom.includes('cliente') || 
        nom.includes('cartera')
      ) {
        deCxC.push(a);
      } else if (
        cod.startsWith('1.1.5') || 
        cod.startsWith('1.1.6') || 
        nom.includes('inventario') || 
        nom.includes('mercancia') || 
        nom.includes('producto') || 
        nom.includes('almacen')
      ) {
        deInventario.push(a);
      } else {
        deOtrosActivos.push(a);
      }
    });

    const totalCajaBancos = deCajaBancos.reduce((sum, a) => sum + a.saldo, 0);
    const totalCxC = deCxC.reduce((sum, a) => sum + a.saldo, 0);
    const totalInventario = deInventario.reduce((sum, a) => sum + a.saldo, 0);
    const totalOtrosActivos = deOtrosActivos.reduce((sum, a) => sum + a.saldo, 0);
    const totalDisponible = balanceGeneral.totalActivos; // as requested, Total Activos = Total Disponible

    const deCxpProveedores: any[] = [];
    const deCxpSocios: any[] = [];
    const deOtrosPasivos: any[] = [];

    pasivosMov.forEach(p => {
      const cod = p.codigo || '';
      const nom = (p.nombre || '').toLowerCase();

      if (
        cod.startsWith('2.1.1') || 
        nom.includes('proveedor') || 
        nom.includes('cxp') || 
        nom.includes('comercial')
      ) {
        deCxpProveedores.push(p);
      } else if (
        cod.startsWith('2.2.1') || 
        nom.includes('socio') || 
        nom.includes('accionista') || 
        nom.includes('director') || 
        nom.includes('prestamo') || 
        nom.includes('préstamo') || 
        nom.includes('dueño')
      ) {
        deCxpSocios.push(p);
      } else {
        deOtrosPasivos.push(p);
      }
    });

    const totalCxpProveedores = deCxpProveedores.reduce((sum, p) => sum + p.saldo, 0);
    const totalCxpSocios = deCxpSocios.reduce((sum, p) => sum + p.saldo, 0);
    const totalOtrosPasivos = deOtrosPasivos.reduce((sum, p) => sum + p.saldo, 0);
    const totalPorPagar = balanceGeneral.totalPasivos; // as requested, Total Pasivos = Total por pagar general

    const disponibleDespuesPasivos = totalDisponible - totalPorPagar;

    const deUtilidades: any[] = [];
    const deFondoCapital: any[] = [];
    const deApartados: any[] = [];

    patrimonioMov.forEach(p => {
      const cod = p.codigo || '';
      const nom = (p.nombre || '').toLowerCase();

      if (
        nom.includes('utilidad') || 
        nom.includes('perdida') || 
        nom.includes('pérdida') || 
        nom.includes('resultado') || 
        nom.includes('ejercicio')
      ) {
        deUtilidades.push(p);
      } else if (
        nom.includes('capital') || 
        nom.includes('social') || 
        nom.includes('aporte') || 
        nom.includes('fondo')
      ) {
        deFondoCapital.push(p);
      } else {
        deApartados.push(p);
      }
    });

    const totalUtilidades = deUtilidades.reduce((sum, p) => sum + p.saldo, 0);
    const totalFondoCapital = deFondoCapital.reduce((sum, p) => sum + p.saldo, 0);
    const totalApartados = deApartados.reduce((sum, p) => sum + p.saldo, 0);

    return {
      deCajaBancos,
      deCxC,
      deInventario,
      deOtrosActivos,
      totalCajaBancos,
      totalCxC,
      totalInventario,
      totalOtrosActivos,
      totalDisponible,
      deCxpProveedores,
      deCxpSocios,
      deOtrosPasivos,
      totalCxpProveedores,
      totalCxpSocios,
      totalOtrosPasivos,
      totalPorPagar,
      disponibleDespuesPasivos,
      deUtilidades,
      deFondoCapital,
      deApartados,
      totalUtilidades,
      totalFondoCapital,
      totalApartados,
      saldoNetoFavor: totalDisponible - totalPorPagar
    };
  }, [balanceGeneral]);

  

  return (
    <div className="min-h-screen bg-slate-50 px-3 sm:px-6 pt-1 pb-8">
      {/* Top Navigation */}
      <div className="max-w-7xl mx-auto mb-3 flex items-center justify-between no-print">
        <BackButton to="/" label="Volver al Inicio" />
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-full border border-slate-200/80">
          Informes & Balances
        </span>
      </div>

      {/* HEADER DE MÓDULO */}
      <div className="max-w-7xl mx-auto mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            Módulo de Informes de Gestión
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Análisis financiero, comercial y contable en tiempo real para tu negocio.
          </p>
        </div>

        {/* SELECTOR DE SUBMÓDULO PRINCIPAL */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl border border-slate-300/40 w-fit shrink-0">
          <button
            onClick={() => { setActiveTab('contables'); setActiveReport(null); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === 'contables' 
                ? 'bg-white text-indigo-600 shadow-2xs' 
                : 'text-slate-600 hover:text-indigo-600'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Informes Contables
          </button>
          <button
            onClick={() => { setActiveTab('flujo_caja'); setActiveReport(null); }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === 'flujo_caja' 
                ? 'bg-white text-indigo-600 shadow-2xs' 
                : 'text-slate-600 hover:text-indigo-600'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            Flujo de Caja
          </button>
        </div>
      </div>

      {/* COMPONENTE DE FILTROS GENERALES (Omitido en impresión) */}
      <div className="max-w-7xl mx-auto mb-4 bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5 text-slate-700">
            <CalendarDays className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold">Rango de fechas:</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Desde</span>
              <input
                type="date"
                className="bg-transparent text-xs font-semibold text-slate-700 outline-hidden cursor-pointer"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Hasta</span>
              <input
                type="date"
                className="bg-transparent text-xs font-semibold text-slate-700 outline-hidden cursor-pointer"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowSignaturesModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 hover:border-indigo-400 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Responsables de Firma</span>
          </button>

          <div className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 uppercase tracking-wider">
            Filtrado Activo: {startDate} 👉 {endDate}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* ========================================================== */}
        {/* INFORMES CONTABLES                                         */}
        {/* ========================================================== */}
        {activeTab === 'contables' && !activeReport && (
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Resumen bento de contabilidad */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Activos Totales</h3>
                  <span className="p-1 rounded-md bg-indigo-50 text-indigo-600">
                    <Coins className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-black text-indigo-600">${formatoES(balanceGeneral.totalActivos)}</p>
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Balance calculado</span>
                  <span className="font-semibold text-slate-600">Estructura Activo</span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pasivo + Patrimonio</h3>
                  <span className="p-1 rounded-md bg-emerald-50 text-emerald-600">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-black text-emerald-600">${formatoES(balanceGeneral.totalPasivoMasPatrimonio)}</p>
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Garantía de cuadre</span>
                  <span className={`font-black ${balanceGeneral.descuadre === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {balanceGeneral.descuadre === 0 ? '✓ Cuadrado' : `⚠ Descuadre: $${formatoES(balanceGeneral.descuadre)}`}
                  </span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-3.5 sm:p-4 shadow-2xs text-white">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Utilidad Neta (P&L)</h3>
                  <span className="p-1 rounded-md bg-white/10 text-emerald-300">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className={`text-xl sm:text-2xl font-black ${estadoResultados.utilidadNeta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ${formatoES(estadoResultados.utilidadNeta)}
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-700/80 flex items-center justify-between text-[11px] text-slate-300">
                  <span>Margen Neto Estimado</span>
                  <span className="font-medium text-slate-200">Año en curso</span>
                </div>
              </div>
            </div>

            {/* Listado de Informes Contables Disponibles */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm sm:text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <span>Cuentas Anuales y Estados Financieros</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                    6 Reportes
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {/* 1. Balance General */}
                <div 
                  onClick={() => setIsBalanceModalOpen(true)}
                  className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 hover:border-indigo-500 hover:shadow-md cursor-pointer group transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-2xs">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800 group-hover:text-indigo-600 transition-colors">
                            Balance General
                          </h4>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Situación Financiera
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-2.5">
                      Estado de Situación Financiera clasificado por Activos, Pasivos y Patrimonio neto.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-indigo-600">
                    <span>Cifras consolidadas</span>
                    <ChevronsRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 2. Estado de Resultados */}
                <div 
                  onClick={() => setIsEstadoResultadosModalOpen(true)}
                  className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 hover:border-emerald-500 hover:shadow-md cursor-pointer group transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-2xs">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800 group-hover:text-emerald-600 transition-colors">
                            Estado de Resultados (P&L)
                          </h4>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Rendimiento Operativo
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-2.5">
                      Cálculo pormenorizado de Ingresos, Costos, Gastos Operativos y Utilidad Neta.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-emerald-600">
                    <span>Configurar y Ver P&L</span>
                    <ChevronsRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 3. Balance de Comprobación */}
                <div 
                  onClick={() => setIsBalanceComprobacionModalOpen(true)}
                  className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 hover:border-amber-500 hover:shadow-md cursor-pointer group transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-2xs">
                          <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800 group-hover:text-amber-600 transition-colors">
                            Balance de Comprobación
                          </h4>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Sumas y Saldos
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-2.5">
                      Débitos, créditos, saldos iniciales y finales para todas las cuentas de movimiento.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-amber-600">
                    <span>Configurar y Ver Sumas</span>
                    <ChevronsRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 4. Libro Mayor Analítico */}
                <div 
                  onClick={() => setIsLibroMayorModalOpen(true)}
                  className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 hover:border-sky-500 hover:shadow-md cursor-pointer group transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0 group-hover:bg-sky-600 group-hover:text-white transition-all shadow-2xs">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800 group-hover:text-sky-600 transition-colors">
                            Libro Mayor Analítico
                          </h4>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Movimientos por Cuenta
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-sky-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-2.5">
                      Libro de movimientos contables detallados por cuenta o rango de cuentas.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-sky-600">
                    <span>Configurar y Ver Mayor</span>
                    <ChevronsRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 5. Comprobantes Contables */}
                <div 
                  onClick={() => setIsLibroDiarioModalOpen(true)}
                  className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 hover:border-purple-500 hover:shadow-md cursor-pointer group transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-2xs">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800 group-hover:text-purple-600 transition-colors">
                            Libro Diario de Asientos
                          </h4>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Comprobantes Contables
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-purple-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-2.5">
                      Informe de asientos y comprobantes registrados con partida doble bimonetaria.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-purple-600">
                    <span>Configurar y Ver Diario</span>
                    <ChevronsRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 6. Salud Financiera */}
                <div 
                  onClick={() => setActiveReport('salud_financiera')}
                  className="bg-white border border-slate-200/90 rounded-xl p-3.5 sm:p-4 hover:border-rose-500 hover:shadow-md cursor-pointer group transition-all duration-200 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-all shadow-2xs">
                          <HeartPulse className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800 group-hover:text-rose-600 transition-colors">
                            Salud Financiera
                          </h4>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Diagnóstico y Liquidez
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-rose-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-2.5">
                      Diagnóstico de liquidez inmediata, deudas comerciales (CxP) y suficiencia de fondos.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-rose-600">
                    <span>Ver Diagnóstico de Salud</span>
                    <ChevronsRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* 3. MÓDULO: FLUJO DE CAJA (CASH FLOW)                       */}
        {/* ========================================================== */}
        {activeTab === 'flujo_caja' && !activeReport && (
          <div className="space-y-8 animate-in fade-in duration-300">
            
            {/* 1. Estructura de Conciliación y Flujo de Caja */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 md:p-8 animate-in fade-in duration-400">
              <div className="flex flex-col lg:flex-row sm:items-start lg:items-center justify-between gap-6 mb-8 pb-6 border-b border-slate-150">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">
                    Estructura de Flujo de Efectivo
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Reconciliación y distribución del capital líquido agrupado por concepto operativo.
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setShowFlowStatementModal(true)}
                    className="w-full sm:w-auto px-5 py-2.5 h-10 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <FileText className="w-4 h-4" /> Exportar Oficial (PDF)
                  </button>
                </div>
              </div>

              {/* Accordion List with Clear Spacing & Separators */}
              <div className="space-y-4">
                {/* 1. Saldo Inicial */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white transition-all hover:shadow-sm">
                  <div 
                    onClick={() => toggleDivision('inicial')}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center group-hover:bg-white group-hover:border-slate-300 transition-colors">
                        <span className="text-sm font-semibold text-slate-600">1</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Saldo Inicial (Cierre Mes Pasado)</p>
                        <p className="text-xs text-slate-500 tracking-tight mt-0.5">Disponibilidad líquida heredada y balance de apertura</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                      <span className="text-xl font-bold tracking-tight text-slate-900">${formatoES(cashFlowMetrics.saldoInicial)}</span>
                      <div className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:border-slate-300 transition-all">
                        {expandedDivisions.inicial ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                  {expandedDivisions.inicial && (
                    <div className="p-5 bg-slate-50/50 border-t border-slate-100 text-sm text-slate-600 animate-in fade-in slide-in-from-top-2 duration-200">
                      <p>Este saldo representa la reserva líquida consolidada en bancos, cajas y cuentas especiales al inicio del periodo fiscal de reporte (<strong>{startDate}</strong>).</p>
                      <p className="text-xs text-slate-500 mt-2 font-medium">Calculado automáticamente sumando todos los ingresos y restando los egresos de las cuentas registrados en fechas previas a {startDate}.</p>
                    </div>
                  )}
                </div>

                {/* 2. Ingresos por Cobranzas */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white transition-all hover:shadow-sm">
                  <div 
                    onClick={() => toggleDivision('cobranzas')}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-emerald-100 bg-emerald-50 flex items-center justify-center group-hover:bg-white group-hover:border-emerald-200 transition-colors">
                        <span className="text-sm font-semibold text-emerald-700">2</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Ingresos por Cobranzas (+)</p>
                        <p className="text-xs text-slate-500 tracking-tight mt-0.5">Cobros ordinarios de clientes facturados o aportes corrientes</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                      <span className="text-xl font-bold tracking-tight text-emerald-600">
                        +${formatoES(cashFlowMetrics.totalCobranzas)}
                      </span>
                      <div className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:border-slate-300 transition-all">
                        {expandedDivisions.cobranzas ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                  {expandedDivisions.cobranzas && renderSubTransactionsTable(
                    cashFlowMetrics.movsClassified.filter(m => m.clasificacionInterna === 'Ingresos por cobranzas'),
                    'totalCobranzas',
                    '+'
                  )}
                </div>

                {/* 3. Ingresos por Préstamos Recibidos */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white transition-all hover:shadow-sm">
                  <div 
                    onClick={() => toggleDivision('recibidos')}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-emerald-100 bg-emerald-50 flex items-center justify-center group-hover:bg-white group-hover:border-emerald-200 transition-colors">
                        <span className="text-sm font-semibold text-emerald-700">3</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Ingresos por Préstamos Recibidos (+)</p>
                        <p className="text-xs text-slate-500 tracking-tight mt-0.5">Créditos de banca pública/privada, aportes puntuales de financiamiento</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                      <span className="text-xl font-bold tracking-tight text-emerald-600">
                        +${formatoES(cashFlowMetrics.totalPrestamosRecibidos)}
                      </span>
                      <div className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:border-slate-300 transition-all">
                        {expandedDivisions.recibidos ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                  {expandedDivisions.recibidos && renderSubTransactionsTable(
                    cashFlowMetrics.movsClassified.filter(m => m.clasificacionInterna === 'Ingresos por prestamos recibidos'),
                    'totalPrestamosRecibidos',
                    '+'
                  )}
                </div>

                <div className="h-px bg-slate-200/60 my-1" />

                {/* 4. Gastos Pagados que van al Estado de Resultado */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white transition-all hover:shadow-sm">
                  <div 
                    onClick={() => toggleDivision('gastos_er')}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-rose-100 bg-rose-50 flex items-center justify-center group-hover:bg-white group-hover:border-rose-200 transition-colors">
                        <span className="text-sm font-semibold text-rose-700">4</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Gastos Pagados (Estado de Resultado) (-)</p>
                        <p className="text-xs text-slate-500 tracking-tight mt-0.5">Egresos corrientes, proveedores, personal, servicios básicos y mermas</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                      <span className="text-xl font-bold tracking-tight text-rose-600">
                        -${formatoES(cashFlowMetrics.totalGastosER)}
                      </span>
                      <div className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:border-slate-300 transition-all">
                        {expandedDivisions.gastos_er ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                  {expandedDivisions.gastos_er && renderSubTransactionsTable(
                    cashFlowMetrics.movsClassified.filter(m => m.clasificacionInterna === 'Gastos pagados que van al estado de resultado'),
                    'totalGastosER',
                    '-'
                  )}
                </div>

                {/* 5. Pagos de proveedores y cuentas por pagar */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white transition-all hover:shadow-sm">
                  <div 
                    onClick={() => toggleDivision('proveedores_real')}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-rose-100 bg-rose-50 flex items-center justify-center group-hover:bg-white group-hover:border-rose-200 transition-colors">
                        <span className="text-sm font-semibold text-rose-700">5</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Pagos a Proveedores / Cuentas por Pagar (-)</p>
                        <p className="text-xs text-slate-500 tracking-tight mt-0.5">Cancelaciones de facturas y obligaciones a corto plazo (Cuentas Reales del Grupo 1 al 3)</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                      <span className="text-xl font-bold tracking-tight text-rose-600">
                        -${formatoES(cashFlowMetrics.totalProveedoresReal)}
                      </span>
                      <div className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:border-slate-300 transition-all">
                        {expandedDivisions.proveedores_real ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                  {expandedDivisions.proveedores_real && renderSubTransactionsTable(
                    cashFlowMetrics.movsClassified.filter(m => m.clasificacionInterna === 'Pagos de proveedores y cuentas por pagar'),
                    'totalProveedoresReal',
                    '-'
                  )}
                </div>

                {/* 6. Préstamos Otorgados */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white transition-all hover:shadow-sm">
                  <div 
                    onClick={() => toggleDivision('prestamos_ot')}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-rose-100 bg-rose-50 flex items-center justify-center group-hover:bg-white group-hover:border-rose-200 transition-colors">
                        <span className="text-sm font-semibold text-rose-700">6</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Préstamos Otorgados (-)</p>
                        <p className="text-xs text-slate-500 tracking-tight mt-0.5">Dinero o créditos otorgados de manera provisional a terceros y asociados</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                      <span className="text-xl font-bold tracking-tight text-rose-500">
                        -${formatoES(cashFlowMetrics.totalPrestamosOtorgados)}
                      </span>
                      <div className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:border-slate-300 transition-all">
                        {expandedDivisions.prestamos_ot ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                  {expandedDivisions.prestamos_ot && renderSubTransactionsTable(
                    cashFlowMetrics.movsClassified.filter(m => m.clasificacionInterna === 'Prestamos otorgados'),
                    'totalPrestamosOtorgados',
                    '-'
                  )}
                </div>

                {/* 7. Pagos Realizados de las Cajas SENIAT */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white transition-all hover:shadow-sm">
                  <div 
                    onClick={() => toggleDivision('seniat')}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-rose-100 bg-rose-50 flex items-center justify-center group-hover:bg-white group-hover:border-rose-200 transition-colors">
                        <span className="text-sm font-semibold text-rose-700">7</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Pagos Realizados de las Cajas SENIAT / Tributos (-)</p>
                        <p className="text-xs text-slate-500 tracking-tight mt-0.5">Cancelaciones de IVA, Retenciones ISR, Impuestos Municipales</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                      <span className="text-xl font-bold tracking-tight text-rose-600">
                        -${formatoES(cashFlowMetrics.totalSeniat)}
                      </span>
                      <div className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:border-slate-300 transition-all">
                        {expandedDivisions.seniat ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                  {expandedDivisions.seniat && renderSubTransactionsTable(
                    cashFlowMetrics.movsClassified.filter(m => m.clasificacionInterna === 'Pagos realizados de las cajas seniat'),
                    'totalSeniat',
                    '-'
                  )}
                </div>

                {/* 8. Pagos a Directivos */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white transition-all hover:shadow-sm">
                  <div 
                    onClick={() => toggleDivision('directivos')}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-rose-100 bg-rose-50 flex items-center justify-center group-hover:bg-white group-hover:border-rose-200 transition-colors">
                        <span className="text-sm font-semibold text-rose-700">8</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Pagos a Directivos / Socios (-)</p>
                        <p className="text-xs text-slate-500 tracking-tight mt-0.5">Honorarios de gerencia y dividendos de junta directiva</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                      <span className="text-xl font-bold tracking-tight text-rose-600">
                        -${formatoES(cashFlowMetrics.totalDirectivos)}
                      </span>
                      <div className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:border-slate-300 transition-all">
                        {expandedDivisions.directivos ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                  {expandedDivisions.directivos && renderSubTransactionsTable(
                    cashFlowMetrics.movsClassified.filter(m => m.clasificacionInterna === 'Pagos a directivos'),
                    'totalDirectivos',
                    '-'
                  )}
                </div>

                <div className="h-px bg-slate-200/60 my-1" />

                {/* 9. Traspasos Internos (Ingresos y Egresos) */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white transition-all hover:shadow-sm">
                  <div 
                    onClick={() => toggleDivision('traspasos')}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-slate-50 transition-colors cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border border-sky-100 bg-sky-50 flex items-center justify-center group-hover:bg-white group-hover:border-sky-200 transition-colors">
                        <span className="text-sm font-semibold text-sky-700">9</span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 leading-tight">Traspasos Internos (+/-)</p>
                        <p className="text-xs text-slate-500 tracking-tight mt-0.5">Movimientos entre cuentas propias (no afectan el resultado operativo)</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                      <div className="flex flex-col text-right">
                        <span className="text-sm font-bold text-emerald-600 tracking-tight">
                          +${formatoES(cashFlowMetrics.totalTraspasosIngresos)}
                        </span>
                        <span className="text-sm font-bold text-rose-600 leading-none tracking-tight">
                          -${formatoES(cashFlowMetrics.totalTraspasosEgresos)}
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-full border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:border-slate-300 transition-all">
                        {expandedDivisions.traspasos ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                  {expandedDivisions.traspasos && (
                    <div className="flex flex-col md:flex-row gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100 border-t border-slate-100 bg-slate-50/50">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-emerald-700 tracking-wider uppercase px-6 py-4 flex items-center gap-2 shadow-sm bg-white">
                          <Plus className="w-4 h-4 text-emerald-500" /> Recepción de Traspasos (+)
                        </p>
                        {renderSubTransactionsTable(
                          cashFlowMetrics.movsClassified.filter(m => m.clasificacionInterna === 'Ingresos por traspasos'),
                          'totalTraspasosIngresos',
                          '+'
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-rose-700 tracking-wider uppercase px-6 py-4 flex items-center gap-2 shadow-sm bg-white">
                          <Minus className="w-4 h-4 text-rose-500" /> Envío de Traspasos (-)
                        </p>
                        {renderSubTransactionsTable(
                          cashFlowMetrics.movsClassified.filter(m => m.clasificacionInterna === 'Egresos por traspasos'),
                          'totalTraspasosEgresos',
                          '-'
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-6" />

                {/* 9. Saldo Final */}
                <div className="border border-slate-900 rounded-xl overflow-hidden bg-slate-900 shadow-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-slate-300">
                        <CornerDownRight className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-white text-base tracking-wide leading-tight">Saldo Final de Caja Conciliado</p>
                        <p className="text-sm text-slate-400 mt-1">Total acumulado líquido final en bancos y cuentas al {endDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-start sm:justify-end">
                      <span className="text-3xl md:text-4xl font-black text-white tracking-tighter">
                        ${formatoES(cashFlowMetrics.saldoFinal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Historial Detallado de Caja y Banco (Con todas las subdivisiones juntas) */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 overflow-hidden animate-in fade-in duration-300">
              <div className="flex flex-col lg:flex-row sm:items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-150">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
                    Historial Detallado General
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Todas las transacciones y movimientos distribuidos por su asignación contable
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  {/* Detailed History Official Document Modal View */}
                  <button
                    type="button"
                    onClick={() => setShowDetailedHistoryModal(true)}
                    className="flex-1 lg:flex-none px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <FileText className="w-4 h-4" /> Detallado (PDF)
                  </button>

                  {/* Export Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const activeList = cashFlowMetrics.movsClassified;
                      let csv = "Fecha;Referencia;Descripción / Concepto;Clasificación;Tipo;Monto\n";
                      activeList.forEach(m => {
                        csv += `"${m.fecha}";"${m.ref || '-'}";"${m.descripcion || '-'}";"${m.clasificacionInterna || ''}";"${m.tipo === 'ingreso' || m.tipo === 'ajuste_ganancia' ? 'Entrada' : 'Salida'}";"${m.monto}"\n`;
                      });
                      const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", `FlujoCaja_HistorialCompleto_${startDate}_${endDate}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="flex-1 lg:flex-none px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar (CSV)
                  </button>
                </div>
              </div>

              {/* Advanced Filter and Control Bar */}
              <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Search query */}
                <div className="relative w-full sm:max-w-xs">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por referencia o concepto..."
                    className="w-full text-xs pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-hidden text-slate-700"
                  />
                </div>

                {/* Dropdown filter */}
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Filtrar Sección:</span>
                  <select
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    className="text-xs py-1.5 px-3 bg-white border border-slate-200 rounded-xl focus:outline-hidden text-slate-600 font-bold"
                  >
                    <option value="todos">Mostrar todas las divisiones</option>
                    <option value="cobranzas">1. Ingresos por cobranzas</option>
                    <option value="recibidos">2. Ingresos por préstamos recibidos</option>
                    <option value="gastos_er">3. Gastos pagados (E.R.)</option>
                    <option value="proveedores_real">4. Pagos a Proveedores / Cuentas por Pagar</option>
                    <option value="prestamos_ot">5. Préstamos otorgados</option>
                    <option value="seniat">6. Pagos SENIAT / Impuestos</option>
                    <option value="directivos">7. Pagos a directivos / socios</option>
                  </select>
                </div>
              </div>

              {/* Transactions Table with divisional accordions, separators, and totalizers */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b text-slate-500 font-bold uppercase text-[10px] tracking-wider select-none">
                    <tr>
                      <th className="py-3 px-4 text-left">Fecha</th>
                      <th className="py-3 px-4 text-left">Referencia</th>
                      <th className="py-3 px-4 text-left">Descripción / Concepto</th>
                      <th className="py-3 px-4 text-left">Subdivisión / Clasificación</th>
                      <th className="py-3 px-4 text-center">Tipo</th>
                      <th className="py-3 px-4 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredMovs = cashFlowMetrics.movsClassified.filter(m => {
                        return searchQuery === '' || 
                          (m.descripcion || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (m.ref || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          String(m.monto).includes(searchQuery);
                      });

                      const divisionsList = [
                        { key: 'cobranzas', label: 'Ingresos por Cobranzas', clasif: 'Ingresos por cobranzas', sign: '+', textColor: 'text-emerald-600', bgColor: 'bg-emerald-50/50' },
                        { key: 'recibidos', label: 'Ingresos por Préstamos Recibidos', clasif: 'Ingresos por prestamos recibidos', sign: '+', textColor: 'text-emerald-500', bgColor: 'bg-emerald-50/30' },
                        { key: 'gastos_er', label: 'Gastos Pagados (Estado de Resultado)', clasif: 'Gastos pagados que van al estado de resultado', sign: '-', textColor: 'text-rose-600', bgColor: 'bg-rose-50/50' },
                        { key: 'proveedores_real', label: 'Pagos a Proveedores / Cuentas por Pagar (Cuentas Reales)', clasif: 'Pagos de proveedores y cuentas por pagar', sign: '-', textColor: 'text-rose-650', bgColor: 'bg-rose-50/40' },
                        { key: 'prestamos_ot', label: 'Préstamos Otorgados', clasif: 'Prestamos otorgados', sign: '-', textColor: 'text-rose-500', bgColor: 'bg-rose-50/30' },
                        { key: 'seniat', label: 'Pagos Realizados Cajas SENIAT / Tributos', clasif: 'Pagos realizados de las cajas seniat', sign: '-', textColor: 'text-rose-600', bgColor: 'bg-rose-50/50' },
                        { key: 'directivos', label: 'Pagos a Directivos / Socios', clasif: 'Pagos a directivos', sign: '-', textColor: 'text-rose-500', bgColor: 'bg-rose-50/30' },
                      ];

                      const activeDivs = divisionsList.filter(div => filterClass === 'todos' || filterClass === div.key);

                      const totalMovsCount = activeDivs.reduce((acc, div) => {
                        return acc + filteredMovs.filter(m => m.clasificacionInterna === div.clasif).length;
                      }, 0);

                      if (totalMovsCount === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                              No se encontraron transacciones en esta vista unificada con los criterios y filtros aplicados.
                            </td>
                          </tr>
                        );
                      }

                      return activeDivs.map((div) => {
                        const divMovs = filteredMovs.filter(m => m.clasificacionInterna === div.clasif);
                        const divTotal = divMovs.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);
                        const isExpanded = !!expandedHistorialDivisions[div.key];

                        if (divMovs.length === 0 && searchQuery !== '') return null;

                        return (
                          <React.Fragment key={div.key}>
                            {/* Accordion division header banner */}
                            <tr 
                              onClick={() => setExpandedHistorialDivisions(prev => ({ ...prev, [div.key]: !prev[div.key] }))}
                              className="bg-slate-100/90 hover:bg-slate-200/60 transition-colors cursor-pointer select-none border-y border-slate-200"
                            >
                              <td colSpan={5} className="py-3 px-4 font-black text-slate-700">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 border border-slate-300">
                                    {isExpanded ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                  </span>
                                  <span className="text-xs uppercase tracking-wider">{div.label}</span>
                                  <span className="text-[10px] font-normal text-slate-400">({divMovs.length} transacciones)</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-black text-xs text-slate-700">
                                Subtotal sección: {div.sign}${formatoES(divTotal)}
                              </td>
                            </tr>

                            {/* Division transaction rows (collapsible) */}
                            {isExpanded && divMovs.length === 0 && (
                              <tr>
                                <td colSpan={6} className="p-4 text-center text-xs text-slate-400 italic bg-slate-50/40">
                                  No se registraron movimientos en esta división para el rango de fechas seleccionado.
                                </td>
                              </tr>
                            )}

                            {isExpanded && divMovs.map((m, idx) => (
                              <tr key={m.id || idx} className="hover:bg-slate-55/60 transition-colors border-b border-slate-150/40">
                                <td className="py-2.5 px-4 font-medium text-slate-500 font-sans">{m.fecha}</td>
                                <td className="py-2.5 px-4 font-mono text-slate-400">{m.ref || '-'}</td>
                                <td className="py-2.5 px-4 text-slate-700 font-semibold">{m.descripcion}</td>
                                <td className="py-2.5 px-4">
                                  <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded-md ${
                                    div.key === 'cobranzas' 
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-100/50' 
                                      : div.key === 'recibidos' 
                                        ? 'bg-blue-50 text-blue-800 border border-blue-100/50'
                                        : div.key === 'prestamos_ot' 
                                          ? 'bg-amber-50 text-amber-800 border border-amber-100/50'
                                          : div.key === 'seniat'
                                            ? 'bg-purple-50 text-purple-800 border border-purple-100/50'
                                            : div.key === 'directivos'
                                              ? 'bg-indigo-50 text-indigo-800 border border-indigo-100/50'
                                              : 'bg-rose-50 text-rose-850 border border-rose-100/50'
                                  }`}>
                                    {div.label}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide border ${
                                    m.tipo === 'ingreso' || m.tipo === 'ajuste_ganancia'
                                      ? "bg-emerald-50/80 text-emerald-700 border-emerald-100"
                                      : "bg-rose-50/80 text-rose-700 border-rose-100"
                                  }`}>
                                    {m.tipo === 'ingreso' || m.tipo === 'ajuste_ganancia' ? 'Entrada' : 'Salida'}
                                  </span>
                                </td>
                                <td className={`py-2.5 px-4 text-right font-black text-xs sm:text-sm ${
                                  m.tipo === 'ingreso' || m.tipo === 'ajuste_ganancia' ? "text-emerald-600" : "text-rose-600"
                                }`}>
                                  {m.tipo === 'ingreso' || m.tipo === 'ajuste_ganancia' ? "" : "-"}${formatoES(m.monto)}
                                </td>
                              </tr>
                            ))}

                            {/* Section subtotal block footer */}
                            {isExpanded && divMovs.length > 0 && (
                              <tr className="bg-slate-50 font-bold border-b border-slate-200">
                                <td colSpan={5} className="py-2 px-4 text-right text-slate-400 uppercase text-[9px] tracking-wider">
                                  Total en {div.label}:
                                </td>
                                <td className={`py-2 px-4 text-right font-black text-xs sm:text-sm ${div.sign === '+' ? 'text-emerald-700 font-extrabold' : 'text-rose-700 font-extrabold'}`}>
                                  {div.sign}${formatoES(divTotal)}
                                </td>
                              </tr>
                            )}

                            {/* Visual double line separator between divisions */}
                            <tr className="h-3 bg-slate-100/50">
                              <td colSpan={6} className="p-0 border-y border-slate-200/50"></td>
                            </tr>
                          </React.Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MODAL DE VISUALIZACIÓN DEL ESTADO DE FLUJO DE CAJA (DESCARGABLE E IMPRIMIBLE) */}
            {showFlowStatementModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all no-print animate-in fade-in duration-200">
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden !important;
                    }
                    #printable-flow-statement, #printable-flow-statement * {
                      visibility: visible !important;
                    }
                    #printable-flow-statement {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      height: auto !important;
                      padding: 2rem !important;
                      box-shadow: none !important;
                      border: none !important;
                      background: white !important;
                      color: black !important;
                    }
                  }
                `}</style>
                <div className="bg-white w-full max-w-4xl h-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  {/* Modal Toolbar Header */}
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                        <FileText className="w-5 h-5" />
                      </span>
                      <div>
                        <h4 className="font-black text-slate-800 text-xs sm:text-sm">Estado de Flujo de Efectivo</h4>
                        <p className="text-[10px] text-slate-400">Reporte oficial conciso para descarga e impresión</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handlePrintReport('printable-flow-statement', 'Estado de Flujo de Efectivo', 'portrait')}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" /> Descargar PDF / Imprimir
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          let csv = "ESTADO DE FLUJO DE EFECTIVO Y RENDIMIENTO BANCOS/CAJA\n";
                          csv += `Periodo: ${startDate} al ${endDate}\n\n`;
                          csv += `Disponibilidad Inicial (Cierre anterior);;${cashFlowMetrics.saldoInicial}\n`;
                          csv += `(+) Ingresos por Cobranzas;;${cashFlowMetrics.totalCobranzas}\n`;
                          csv += `(+) Ingresos por Prestamos Recibidos;;${cashFlowMetrics.totalPrestamosRecibidos}\n`;
                          csv += `(-) Gastos operacionales en ER;;${cashFlowMetrics.totalGastosER}\n`;
                          csv += `(-) Pagos de Proveedores / Cuentas por Pagar (Reales);;${cashFlowMetrics.totalProveedoresReal}\n`;
                          csv += `(-) Prestamos Otorgados;;${cashFlowMetrics.totalPrestamosOtorgados}\n`;
                          csv += `(-) Pagos Cajas SENIAT / Tributos;;${cashFlowMetrics.totalSeniat}\n`;
                          csv += `(-) Pagos a Directivos / Socios;;${cashFlowMetrics.totalDirectivos}\n`;
                          csv += `Saldo Final de Caja Conciliado;;${cashFlowMetrics.saldoFinal}\n`;

                          const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
                          const link = document.createElement("a");
                          link.setAttribute("href", encodedUri);
                          link.setAttribute("download", `EstadoFlujoCaja_${startDate}_${endDate}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Exportar CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFlowStatementModal(false)}
                        className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Printable Area Body */}
                  <div className="flex-1 overflow-y-auto p-6 sm:p-12 bg-slate-100/30">
                    <div 
                      id="printable-flow-statement"
                      className="bg-white p-8 sm:p-10 border border-slate-200 rounded-xl shadow-xs max-w-3xl mx-auto text-slate-800 font-sans animate-in fade-in duration-200"
                    >
                      {/* Company banner */}
                      <div className="flex justify-between items-start pb-6 border-b border-slate-300 mb-6">
                        <div>
                          <h2 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest font-mono">SISTEMA INTEGRAL DE CONTROL FINANCIERO</h2>
                          <h1 className="text-xl font-black text-slate-800 tracking-tight mt-1">ESTADO DE FLUJOS DE EFECTIVO</h1>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono">R.I.F. J-40810123-0 / CONTABILIDAD GENERAL</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase rounded-md tracking-wider">
                            VISTA DE RENDIMIENTO
                          </span>
                          <p className="text-[10px] text-slate-505 mt-2 font-mono">Desde: <strong>{startDate}</strong></p>
                          <p className="text-[10px] text-slate-550 font-mono">Hasta: <strong>{endDate}</strong></p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-mono">Impreso: {new Date().toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Financial Document Rows */}
                      <div className="space-y-6 text-xs sm:text-sm">
                        
                        {/* 1. SECCIÓN: BALANCE DE APERTURA */}
                        <div>
                          <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-slate-400 mb-2 font-mono">I. DISPONIBILIDAD LÍQUIDA DE APERTURA</h4>
                          <div className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-lg border border-slate-100">
                            <span className="font-semibold text-slate-750">Efectivo y Equivalentes de Efectivo al Inicio del Periodo</span>
                            <span className="font-black text-slate-850">${formatoES(cashFlowMetrics.saldoInicial)}</span>
                          </div>
                        </div>

                        {/* 2. SECCIÓN: ACTIVIDADES DE OPERACIÓN */}
                        <div>
                          <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-slate-400 mb-2 font-mono">II. ACTIVIDADES DE OPERACIÓN ORDINARIA</h4>
                          <div className="divide-y divide-slate-100 border border-slate-150 rounded-lg overflow-hidden">
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-slate-50/40">
                              <span className="text-slate-650">(+) Flujo Captado por Cobranzas y Clientes</span>
                              <span className="font-bold text-emerald-600">+${formatoES(cashFlowMetrics.totalCobranzas)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-slate-50/40">
                              <span className="text-slate-650">(-) Desembolsos por Compras, Personal y Gastos de E.R.</span>
                              <span className="font-bold text-rose-600">-${formatoES(cashFlowMetrics.totalGastosER)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-slate-50/40">
                              <span className="text-slate-650">(-) Desembolsos por Cuentas por Pagar / Proveedores (Cuentas Reales)</span>
                              <span className="font-bold text-rose-600">-${formatoES(cashFlowMetrics.totalProveedoresReal)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-slate-50/40">
                              <span className="text-slate-650">(-) Liquidación de Compromisos Tributarios (SENIAT)</span>
                              <span className="font-bold text-rose-600">-${formatoES(cashFlowMetrics.totalSeniat)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50 font-bold justify-between">
                              <span className="text-slate-700 uppercase text-[10px] tracking-wide">Flujo Neto Proveniente de Actividades Operacionales</span>
                              <span className={`font-black ${cashFlowMetrics.totalCobranzas - cashFlowMetrics.totalGastosER - cashFlowMetrics.totalProveedoresReal - cashFlowMetrics.totalSeniat >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                {cashFlowMetrics.totalCobranzas - cashFlowMetrics.totalGastosER - cashFlowMetrics.totalProveedoresReal - cashFlowMetrics.totalSeniat >= 0 ? "+" : ""}${formatoES(cashFlowMetrics.totalCobranzas - cashFlowMetrics.totalGastosER - cashFlowMetrics.totalProveedoresReal - cashFlowMetrics.totalSeniat)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 3. SECCIÓN: ACTIVIDADES DE FINANCIAMIENTO */}
                        <div>
                          <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-slate-400 mb-2 font-mono">III. ACTIVIDADES DE FINANCIAMIENTO Y DIRECTIVOS</h4>
                          <div className="divide-y divide-slate-100 border border-slate-150 rounded-lg overflow-hidden">
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-slate-50/40">
                              <span className="text-slate-650">(+) Aportes de Préstamos y Financiamientos Recibidos</span>
                              <span className="font-bold text-emerald-600">+${formatoES(cashFlowMetrics.totalPrestamosRecibidos)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-slate-50/40">
                              <span className="text-slate-650">(-) Desembolsos por Préstamos Otorgados a Terceros</span>
                              <span className="font-bold text-rose-600">-${formatoES(cashFlowMetrics.totalPrestamosOtorgados)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-slate-50/40">
                              <span className="text-slate-650">(-) Retiros de Capital y Rendimientos a Directivos/Socios</span>
                              <span className="font-bold text-rose-600">-${formatoES(cashFlowMetrics.totalDirectivos)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50 font-bold justify-between">
                              <span className="text-slate-700 uppercase text-[10px] tracking-wide">Flujo Neto de Actividades de Financiamiento</span>
                              <span className={`font-black ${cashFlowMetrics.totalPrestamosRecibidos - cashFlowMetrics.totalPrestamosOtorgados - cashFlowMetrics.totalDirectivos >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                {cashFlowMetrics.totalPrestamosRecibidos - cashFlowMetrics.totalPrestamosOtorgados - cashFlowMetrics.totalDirectivos >= 0 ? "+" : ""}${formatoES(cashFlowMetrics.totalPrestamosRecibidos - cashFlowMetrics.totalPrestamosOtorgados - cashFlowMetrics.totalDirectivos)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 4. SECCIÓN: TRASPASOS INTERNOS */}
                        <div>
                          <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-slate-400 mb-2 font-mono">IV. TRASPASOS INTERNOS ENTRE CUENTAS</h4>
                          <div className="divide-y divide-slate-100 border border-slate-150 rounded-lg overflow-hidden">
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-slate-50/40">
                              <span className="text-slate-650">(+) Entradas por Traspasos Internos (Recepción)</span>
                              <span className="font-bold text-emerald-600">+${formatoES(cashFlowMetrics.totalTraspasosIngresos)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 px-3 hover:bg-slate-50/40">
                              <span className="text-slate-650">(-) Salidas por Traspasos Internos (Envío)</span>
                              <span className="font-bold text-rose-600">-${formatoES(cashFlowMetrics.totalTraspasosEgresos)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2.5 px-3 bg-slate-50 font-bold justify-between">
                              <span className="text-slate-700 uppercase text-[10px] tracking-wide">Efecto Neto de Traspasos (Suele ser 0)</span>
                              <span className={`font-black ${cashFlowMetrics.totalTraspasosNeto >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                {cashFlowMetrics.totalTraspasosNeto >= 0 ? "+" : ""}${formatoES(cashFlowMetrics.totalTraspasosNeto)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 5. SECCIÓN: CONCILIACIÓN FINAL */}
                        <div className="pt-4 border-t border-slate-300">
                          <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-slate-400 mb-2 font-mono">V. CONCILIACIÓN DE EFECTIVO AL CIERRE</h4>
                          <div className="space-y-1 bg-slate-900 text-white p-4 rounded-xl border border-slate-950">
                            <div className="flex justify-between items-center text-xs text-slate-300">
                              <span>Variación Neta de Caja General</span>
                              <span className={`font-bold ${cashFlowMetrics.flujoNeto >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {cashFlowMetrics.flujoNeto >= 0 ? '+' : ''}${formatoES(cashFlowMetrics.flujoNeto)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-300 pb-2 border-b border-white/10">
                              <span>(+) Reserva Líquida Inicial de Apertura</span>
                              <span>${formatoES(cashFlowMetrics.saldoInicial)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 font-black border-b border-white/5 pb-2">
                              <span className="text-xs sm:text-sm uppercase tracking-wide text-indigo-200 font-sans">Disp. Líquida Conciliada al Cierre ({endDate})</span>
                              <span className="text-sm sm:text-lg text-emerald-350">${formatoES(cashFlowMetrics.saldoFinal)}</span>
                            </div>

                            {/* Saldos reales de las cuentas de bancos para comparar y conciliar */}
                            <div className="pt-3">
                              <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-2">Comprobación: Saldos Reales en Cuentas Contables y Bancarias</p>
                              <div className="space-y-1 pr-1">
                                {(bancosConSaldos || []).map((b: any) => (
                                  <div key={b.id} className="flex justify-between items-center text-[11px] text-slate-300 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg transition-all font-mono">
                                    <div className="flex flex-col">
                                      <span className="font-sans font-bold text-[11px] text-white leading-none mb-0.5">{b.banco}</span>
                                      <span className="text-[9px] text-slate-400 leading-none">
                                        {b.cuenta || 'Sin número'} ({b.moneda === 'Bolivares' ? 'VES' : 'USD'})
                                        {b.lastSapsRate && ` • Último SAPS: ${formatoES(b.lastSapsRate)}`}
                                        {!b.lastSapsRate && b.effectiveRate > 1 && ` • Tasa: ${formatoES(b.effectiveRate)}`}
                                      </span>
                                    </div>
                                    <div className="text-right">
                                      <span className={`font-bold ${b.saldoUSD < 0 ? 'text-rose-400 font-extrabold' : 'text-white'}`}>{b.saldoUSD < 0 ? '-' : ''}${formatoES(Math.abs(b.saldoUSD))}</span>
                                      {b.moneda === 'Bolivares' && (
                                        <div className={`text-[9px] font-medium ${b.saldoVES < 0 ? 'text-rose-400/80 font-bold' : 'text-slate-400'}`}>{b.saldoVES < 0 ? '-' : ''}Bs. {formatoES(Math.abs(b.saldoVES))}</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-between items-center pt-2.5 mt-2.5 border-t border-white/10 text-xs font-black">
                                <span className="text-[11px] uppercase tracking-wide text-indigo-250 font-sans">Liquidez Total en Cuentas (USD Contable)</span>
                                <span className={`text-sm font-mono ${totalBancosSaldosUSD < 0 ? 'text-rose-400 font-bold' : 'text-indigo-300'}`}>{totalBancosSaldosUSD < 0 ? '-' : ''}${formatoES(Math.abs(totalBancosSaldosUSD))}</span>
                              </div>

                              {/* Estado de la Conciliación */}
                              <div className="mt-2.5 pt-2.5 border-t border-dashed border-white/10">
                                {Math.abs(cashFlowMetrics.saldoFinal - totalBancosSaldosUSD) < 0.05 ? (
                                  <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-lg">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    <span>✓ CONCILIACIÓN PERFECTA: El saldo conciliado coincide con los saldos reales de bancos.</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1 text-[10px] md:text-xs font-bold text-amber-300 bg-amber-950/40 border border-amber-800/40 px-3 py-1.5 rounded-lg animate-in fade-in">
                                    <div className="flex items-center gap-2">
                                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                      <span>⚠ CONCILIACIÓN CON DIFERENCIA: Existe un descuadre contable o desfase de período.</span>
                                    </div>
                                    <p className="text-[9px] text-amber-400 font-medium font-sans mt-0.5 leading-relaxed pl-3.5">
                                      Diferencia de <strong className="font-mono">${formatoES(Math.abs(cashFlowMetrics.saldoFinal - totalBancosSaldosUSD))}</strong>. Puede deberse a movimientos fuera del rango de fechas ({startDate} al {endDate}) o ajustes de saldos iniciales.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* 5. FIRMAS COMPROMISOS */}
                        <div className="pt-12 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-500 font-mono">
                          <div className="border-t border-slate-200 pt-3">
                            <p className="font-bold text-slate-700 uppercase">Preparado por Contabilidad</p>
                            <p className="text-slate-400 mt-1">Firma Autorizada • Departamento Contable</p>
                          </div>
                          <div className="border-t border-slate-200 pt-3">
                            <p className="font-bold text-slate-700 uppercase">Aprobado por Junta Directiva</p>
                            <p className="text-slate-400 mt-1">Firma de Conformidad • Gerencia General</p>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* Modal Footer Controls */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowFlowStatementModal(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Cerrar Vista Previa
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* MODAL DE VISUALIZACIÓN DEL HISTORIAL DETALLADO DE CAJA Y BANCO (DESCARGABLE E IMPRIMIBLE) */}
            {showDetailedHistoryModal && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all no-print animate-in fade-in duration-200">
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden !important;
                    }
                    #printable-detailed-history, #printable-detailed-history * {
                      visibility: visible !important;
                    }
                    #printable-detailed-history {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      height: auto !important;
                      padding: 2rem !important;
                      box-shadow: none !important;
                      border: none !important;
                      background: white !important;
                      color: black !important;
                    }
                  }
                `}</style>
                <div className="bg-white w-full max-w-5xl h-full max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  {/* Modal Toolbar Header */}
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                        <FileText className="w-5 h-5" />
                      </span>
                      <div>
                        <h4 className="font-black text-slate-800 text-xs sm:text-sm">Libro Auxiliar: Historial Detallado de Caja y Banco</h4>
                        <p className="text-[10px] text-slate-400">Listado íntegro detallado por división contable para el periodo seleccionado</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handlePrintReport('printable-detailed-history', 'Historial Detallado de Caja y Banco', 'landscape')}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" /> Imprimir / Descargar PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const activeList = cashFlowMetrics.movsClassified;
                          let csv = "Fecha;Referencia;Descripción / Concepto;Clasificación;Tipo;Monto\n";
                          activeList.forEach(m => {
                            csv += `"${m.fecha}";"${m.ref || '-'}";"${m.descripcion || '-'}";"${m.clasificacionInterna || ''}";"${m.tipo === 'ingreso' || m.tipo === 'ajuste_ganancia' ? 'Entrada' : 'Salida'}";"${m.monto}"\n`;
                          });
                          const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
                          const link = document.createElement("a");
                          link.setAttribute("href", encodedUri);
                          link.setAttribute("download", `FlujoCaja_HistorialCompleto_${startDate}_${endDate}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Exportar CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDetailedHistoryModal(false)}
                        className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Printable Area Body */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-10 bg-slate-100/30">
                    <div 
                      id="printable-detailed-history"
                      className="bg-white p-6 sm:p-8 border border-slate-200 rounded-xl shadow-xs max-w-4xl mx-auto text-slate-800 font-sans"
                    >
                      {/* Header */}
                      <div className="flex justify-between items-start pb-6 border-b border-slate-300 mb-6 font-sans">
                        <div>
                          <h2 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest font-mono">SISTEMA INTEGRAL DE CONTROL FINANCIERO</h2>
                          <h1 className="text-lg font-black text-slate-800 tracking-tight mt-1">REPORTE DETALLADO DE TRANSACCIONES DE CAJA Y BANCO</h1>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase font-mono">LIBRO AUXILIAR UNIFICADO DE ARQUEOS Y MOVIMIENTOS</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase rounded-md tracking-wider">
                            VISTA INTEGRAL DE CONTROL
                          </span>
                          <p className="text-[10px] text-slate-500 mt-2 font-mono">Desde: <strong>{startDate}</strong></p>
                          <p className="text-[10px] text-slate-500 font-mono">Hasta: <strong>{endDate}</strong></p>
                          <p className="text-[9px] text-slate-400 mt-0.5 font-mono">Impreso: {new Date().toLocaleDateString()}</p>
                        </div>
                      </div>

                      {/* Grouped divisions tables list */}
                      <div className="space-y-6">
                        {[
                          { key: 'cobranzas', label: '1. Ingresos por Cobranzas', clasif: 'Ingresos por cobranzas', sign: '+' },
                          { key: 'recibidos', label: '2. Ingresos por Préstamos Recibidos', clasif: 'Ingresos por prestamos recibidos', sign: '+' },
                          { key: 'gastos_er', label: '3. Gastos Pagados (Estado de Resultado)', clasif: 'Gastos pagados que van al estado de resultado', sign: '-' },
                          { key: 'proveedores_real', label: '4. Pagos a Proveedores / Cuentas por Pagar (Cuentas Reales)', clasif: 'Pagos de proveedores y cuentas por pagar', sign: '-' },
                          { key: 'prestamos_ot', label: '5. Préstamos Otorgados', clasif: 'Prestamos otorgados', sign: '-' },
                          { key: 'seniat', label: '6. Pagos Realizados Cajas SENIAT / Tributos', clasif: 'Pagos realizados de las cajas seniat', sign: '-' },
                          { key: 'directivos', label: '7. Pagos a Directivos / Socios', clasif: 'Pagos a directivos', sign: '-' },
                        ].map(div => {
                          const divMovs = cashFlowMetrics.movsClassified.filter(m => m.clasificacionInterna === div.clasif);
                          const divTotal = divMovs.reduce((sum, m) => sum + (Number(m.monto) || 0), 0);

                          if (divMovs.length === 0) return null;

                          return (
                            <div key={div.key} className="border border-slate-200 rounded-lg overflow-hidden animate-in fade-in duration-200">
                              <div className="bg-slate-50 px-4 py-2 flex justify-between items-center border-b border-slate-200">
                                <span className="font-extrabold text-xs text-slate-750 uppercase tracking-wide font-sans">
                                  {div.label}
                                </span>
                                <span className="text-xs font-black text-slate-800">
                                  Total División: {div.sign}${formatoES(divTotal)}
                                </span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-[11px] text-slate-600">
                                  <thead>
                                    <tr className="bg-slate-100/50 border-b border-slate-200 font-bold text-slate-500 uppercase text-[9px] tracking-wider">
                                      <th className="py-2.5 px-3 text-left w-20">Fecha</th>
                                      <th className="py-2.5 px-3 text-left w-24">Referencia</th>
                                      <th className="py-2.5 px-3 text-left">Concepto / Descripción del Movimiento</th>
                                      <th className="py-2.5 px-3 text-center w-16">Tipo</th>
                                      <th className="py-2.5 px-3 text-right w-28">Monto</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-150">
                                    {divMovs.map((m, mIdx) => (
                                      <tr key={m.id || mIdx} className="hover:bg-slate-50/10">
                                        <td className="py-2 px-3 whitespace-nowrap text-slate-500 font-mono">{m.fecha}</td>
                                        <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-400">{m.ref || '-'}</td>
                                        <td className="py-2 px-3 text-slate-700 font-semibold">{m.descripcion}</td>
                                        <td className="py-2 px-3 text-center">
                                          <span className={`text-[9px] uppercase font-bold ${
                                            m.tipo === 'ingreso' || m.tipo === 'ajuste_ganancia' ? 'text-emerald-600' : 'text-rose-600'
                                          }`}>
                                            {m.tipo === 'ingreso' || m.tipo === 'ajuste_ganancia' ? 'Entrada' : 'Salida'}
                                          </span>
                                        </td>
                                        <td className={`py-2 px-3 text-right font-black ${
                                          m.tipo === 'ingreso' || m.tipo === 'ajuste_ganancia' ? 'text-emerald-600' : 'text-rose-600'
                                        }`}>
                                          {m.tipo === 'ingreso' || m.tipo === 'ajuste_ganancia' ? '+' : '-'}${formatoES(m.monto)}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="bg-slate-100/30 font-bold border-t border-slate-200/80">
                                      <td colSpan={4} className="py-2 px-3 text-right uppercase text-[9px] tracking-wider text-slate-400">Total Sección:</td>
                                      <td className={`py-2 px-3 text-right font-black text-xs ${div.sign === '+' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        {div.sign}${formatoES(divTotal)}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Summary Aggregates */}
                      <div className="mt-8 bg-slate-900 text-white rounded-xl p-5 border border-slate-950 font-sans">
                        <h4 className="font-extrabold uppercase text-[10px] tracking-widest text-indigo-400 mb-3 font-mono">Consolidado Final de Flujos de Efectivo</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                            <span className="text-slate-400 block text-[9px] uppercase tracking-wider font-mono">Reserva Inicial</span>
                            <span className="text-sm font-bold text-white">${formatoES(cashFlowMetrics.saldoInicial)}</span>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                            <span className="text-emerald-400 block text-[9px] uppercase tracking-wider font-mono">Entradas (+)</span>
                            <span className="text-sm font-bold text-emerald-350">+${formatoES(cashFlowMetrics.totalCobranzas + cashFlowMetrics.totalPrestamosRecibidos)}</span>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                            <span className="text-rose-400 block text-[9px] uppercase tracking-wider font-mono">Salidas (-)</span>
                            <span className="text-sm font-bold text-rose-350">-${formatoES(cashFlowMetrics.totalGastosER + cashFlowMetrics.totalProveedoresReal + cashFlowMetrics.totalPrestamosOtorgados + cashFlowMetrics.totalSeniat + cashFlowMetrics.totalDirectivos)}</span>
                          </div>
                          <div className="p-3 bg-indigo-950 rounded-lg border border-indigo-700/30">
                            <span className="text-indigo-300 block text-[9px] uppercase tracking-wider font-mono">Saldo Final</span>
                            <span className="text-sm font-black text-emerald-400">${formatoES(cashFlowMetrics.saldoFinal)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Signatures */}
                      <div className="pt-12 grid grid-cols-2 gap-8 text-center text-[10px] text-slate-500 font-mono">
                        <div className="border-t border-slate-200 pt-3">
                          <p className="font-bold text-slate-700 uppercase">Preparado por Contabilidad</p>
                          <p className="text-slate-400 mt-1">Firma del Analista Contable</p>
                        </div>
                        <div className="border-t border-slate-200 pt-3">
                          <p className="font-bold text-slate-700 uppercase">Aprobado por Junta Directiva</p>
                          <p className="text-slate-400 mt-1">Sello y Firma de Conformidad</p>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Modal Footer Controls */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowDetailedHistoryModal(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Cerrar Vista Previa
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* MODAL PARA RECLASIFICACIÓN DE FLUJO DE CAJA (SUBIR O BAJAR MONTO) */}
            {reclassifyingMov && (() => {
              const counterpartCta = cuentasContables.find(c => 
                String(c.id) === String(reclassifyingMov.cuentaContrapartida) || 
                (c.codigo && String(c.codigo) === String(reclassifyingMov.cuentaContrapartida))
              );
              return (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[60] p-4 transition-all animate-in fade-in duration-200">
                  <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                          <Calculator className="w-5 h-5" />
                        </span>
                        <div>
                          <h4 className="font-black text-slate-800 text-xs sm:text-sm">Reclasificar Flujo de Efectivo</h4>
                          <p className="text-[10px] text-slate-400">Sube o baja este monto a otra sección para corregir desfases</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReclassifyingMov(null)}
                        className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-4 text-xs text-slate-700">
                      {/* Movement Card Info */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400 uppercase font-mono text-[9px]">Transacción</span>
                          <span className="font-semibold text-slate-800">{reclassifyingMov.fecha}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 uppercase font-mono text-[9px]">Referencia</span>
                          <span className="font-mono font-bold text-slate-800">{reclassifyingMov.ref || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 uppercase font-mono text-[9px]">Concepto</span>
                          <span className="font-semibold text-slate-800 max-w-[250px] text-right line-clamp-2">{reclassifyingMov.descripcion}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400 uppercase font-mono text-[9px]">Monto</span>
                          <span className={`font-black text-sm ${reclassifyingMov.tipo === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {reclassifyingMov.tipo === 'ingreso' ? '+' : '-'}${formatoES(reclassifyingMov.monto)}
                          </span>
                        </div>
                        {counterpartCta && (
                          <div className="flex justify-between pt-2 border-t border-slate-200">
                            <span className="text-slate-400 uppercase font-mono text-[9px]">Cuenta Asociada</span>
                            <span className="font-bold text-indigo-700 text-right">{counterpartCta.codigo} - {counterpartCta.nombre}</span>
                          </div>
                        )}
                      </div>

                      {/* Option Selector */}
                      <div className="space-y-3">
                        <label className="block font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                          Seleccione la nueva sección del Flujo de Caja:
                        </label>
                        <select
                          value={selectedNewArea}
                          onChange={(e) => setSelectedNewArea(e.target.value)}
                          className="w-full bg-white px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-850"
                        >
                          <option value="">-- Seleccionar Sección del Flujo --</option>
                          {AREAS_FLUJO.map(a => (
                            <option key={a.id} value={a.id}>{a.nombre}</option>
                          ))}
                        </select>
                      </div>

                      <div className="h-px bg-slate-200/60 my-2" />

                      {/* Form Actions */}
                      <div className="space-y-3 pt-1">
                        <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                          ¿Cómo desea aplicar este cambio? Puede reubicar únicamente este movimiento específico (ideal para ajustes puntuales), o reconfigurar la cuenta contable de contrapartida de forma permanente.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                          <button
                            type="button"
                            disabled={!selectedNewArea}
                            onClick={() => handleSaveAreaFlujoCaja(reclassifyingMov, selectedNewArea)}
                            className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-xs cursor-pointer text-center"
                          >
                            Mover solo esta transacción
                          </button>
                          
                          {counterpartCta && (
                            <button
                              type="button"
                              disabled={!selectedNewArea}
                              onClick={() => handleSaveAccountAreaFlujoCaja(counterpartCta.id, selectedNewArea)}
                              className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-xs cursor-pointer text-center"
                            >
                              Reclasificar toda la cuenta
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setReclassifyingMov(null)}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ========================================================== */}
        {/* VISTAS DETALLADAS DE REPORTES                              */}
        {/* ========================================================== */}

        {/* REPORT: BALANCE GENERAL (CONTABLE) */}
        {activeReport === 'balance_general' && (
          <BalanceGeneralReport
            comprobantes={comprobantes}
            cuentasContables={cuentasContables}
            empresa={empresa}
            configContable={configContable}
            endDate={endDate}
            setEndDate={setEndDate}
            startDate={startDate}
            estadoResultados={estadoResultados}
            onBack={() => setActiveReport(null)}
            onPrint={(elementId, title, orientation) => handlePrintReport(elementId, title, orientation)}
          />
        )}

        {/* REPORT: ESTADO DE RESULTADOS (CONTABLE) */}
        {activeReport === 'estado_resultado' && (
          <div id="printable-estado-resultado" className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in duration-300 max-w-[21cm] mx-auto">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-6 border-b-2 border-slate-800 gap-4 mb-6">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveReport(null)}
                  className="p-2 hover:bg-slate-50 rounded-xl border border-slate-200 text-slate-500 transition-colors no-print"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-wider uppercase">Estado de Pérdidas y Ganancias (P&L)</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase">Cuentas de Movimiento (Grupos del 4 al 9) del {formatFechaDMY(startDate)} al {formatFechaDMY(endDate)}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 no-print">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-200 transition-all select-none">
                  <input 
                    type="checkbox" 
                    checked={plHideZero} 
                    onChange={(e) => setPlHideZero(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Ocultar cuentas sin movimientos</span>
                </label>

                <button 
                  onClick={() => handlePrintReport('printable-estado-resultado', 'Estado de Pérdidas y Ganancias (P&L)', 'portrait')}
                  className="btn-primary !bg-slate-950 text-xs flex items-center gap-1.5 cursor-pointer no-print"
                >
                  <Printer className="w-4 h-4" /> Imprimir P&L
                </button>
              </div>
            </div>

            {/* Listado dinámico de grupos contables de resultados del 4 al 9 */}
            <div className="space-y-8">
              {estadoResultados.gruposList.map((grupo) => {
                const accountsToShow = plHideZero
                  ? grupo.cuentas.filter((c: any) => c.debe !== 0 || c.haber !== 0 || Math.abs(c.saldo) >= 0.01)
                  : grupo.cuentas;

                if (accountsToShow.length === 0) return null;

                const isAcreedora = grupo.naturaleza === 'Acreedora';
                const groupHeaderColor = isAcreedora 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border-rose-200 text-rose-800';

                return (
                  <div key={grupo.digito} className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    {/* Encabezado del Grupo */}
                    <div className={`p-3 border-b font-black text-xs md:text-sm uppercase tracking-wider flex justify-between items-center ${groupHeaderColor}`}>
                      <span>{grupo.nombre}</span>
                      <span className="font-mono text-[10px] md:text-xs">Naturaleza: {grupo.naturaleza}</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                            <th className="p-2.5 pl-4 w-1/4">Código</th>
                            <th className="p-2.5">Cuenta Contable</th>
                            <th className="p-2.5 text-right w-1/4 pr-4">Saldo Período</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {accountsToShow.map((cuenta: any) => {
                            const displaySaldo = Math.abs(cuenta.saldo);

                            return (
                              <tr key={cuenta.id} className="hover:bg-slate-50/50 transition-all font-mono">
                                <td className="p-2.5 pl-4 text-slate-500 font-semibold">{cuenta.codigo}</td>
                                <td className="p-2.5 text-slate-800 font-semibold font-sans">{cuenta.nombre}</td>
                                <td className={`p-2.5 text-right pr-4 font-bold ${displaySaldo >= 0.01 ? (cuenta.nat === 'Acreedora' ? 'text-emerald-600' : 'text-slate-700') : 'text-slate-400'}`}>
                                  {displaySaldo >= 0.01 ? `$${formatoES(displaySaldo)}` : '$0,00'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 border-t-2 border-slate-200 font-extrabold text-slate-700">
                            <td colSpan={2} className="p-2.5 pl-4 text-left uppercase text-[10px] tracking-wider">
                              Subtotal {grupo.nombre}
                            </td>
                            <td className={`p-2.5 text-right pr-4 font-mono text-xs md:text-sm ${isAcreedora ? 'text-emerald-800 bg-emerald-50/50' : 'text-rose-800 bg-rose-50/50'}`}>
                              ${formatoES(Math.abs(grupo.totalSaldo))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Utilidad Neta del Ejercicio Final */}
              <div className={`p-4 md:p-6 border-2 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 ${
                estadoResultados.utilidadNeta >= 0 
                  ? 'bg-emerald-900 border-emerald-800 text-white shadow-sm' 
                  : 'bg-rose-900 border-rose-800 text-white shadow-sm'
              }`}>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider opacity-90">Resultado del Ejercicio</h3>
                  <p className="text-xs opacity-75 mt-0.5">Cálculo de ingresos (Cuentas Acreedoras) menos egresos (Cuentas Deudoras)</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] md:text-xs uppercase font-black tracking-wider bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
                    {estadoResultados.utilidadNeta >= 0 ? 'UTILIDAD NETA' : 'PÉRDIDA NETA'}
                  </span>
                  <span className="text-xl md:text-2xl font-black font-mono">
                    ${formatoES(estadoResultados.utilidadNeta)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* REPORT: BALANCE DE COMPROBACIÓN (CONTABLE) */}
        {activeReport === 'comprobacion' && (
          <div id="printable-comprobacion" className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4 mb-6">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveReport(null)}
                  className="p-2 hover:bg-slate-50 rounded-xl border border-slate-200 text-slate-500 transition-colors no-print"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-black text-slate-800">Balance de Comprobación</h2>
                  <p className="text-xs text-slate-500">Listado de saldos iniciales, movimientos y saldos de cierre por cuenta.</p>
                </div>
              </div>

              <button 
                onClick={() => handlePrintReport('printable-comprobacion', `Balance de Comprobación y Pre-Cierre`, 'portrait')}
                className="btn-primary !bg-slate-850 text-xs flex items-center gap-1.5 no-print"
              >
                <Printer className="w-4 h-4" /> Imprimir Balance
              </button>
            </div>

            {/* Control para alternar el diseño del reporte en el modal/impresión */}
            <div className="flex bg-slate-100 p-1 rounded-xl self-start mb-6 no-print max-w-sm w-full">
              <button
                onClick={() => setComprobacionReportMode('oficial_4col')}
                className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${
                  comprobacionReportMode === 'oficial_4col'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Formato Oficial (4 Columnas)
              </button>
              <button
                onClick={() => setComprobacionReportMode('columnas_6col')}
                className={`flex-1 text-center py-1.5 text-xs font-bold rounded-lg transition-all ${
                  comprobacionReportMode === 'columnas_6col'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Formato Completo (6 Columnas)
              </button>
            </div>

            {comprobacionReportMode === 'oficial_4col' ? (
              <div className="overflow-x-auto text-[11px] md:text-xs">
                <table className="w-full text-left border-collapse border border-slate-200">
                  <thead>
                    <tr className="border-b-2 border-slate-300 bg-slate-100">
                      <th className="p-2 font-bold text-slate-700" rowSpan={2}>Código</th>
                      <th className="p-2 font-bold text-slate-700" rowSpan={2}>Cuenta Contable</th>
                      <th className="p-2 text-center font-bold text-slate-700 border-l border-r border-slate-200" rowSpan={2}>Saldo Inicial</th>
                      <th className="p-2 text-center font-bold text-slate-700 border-r border-slate-200" colSpan={2}>Movimientos</th>
                      <th className="p-2 text-center font-bold text-slate-700" rowSpan={2}>Saldo Actual</th>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="p-2 text-right font-medium text-slate-600 border-l">Debe</th>
                      <th className="p-2 text-right font-medium text-slate-600 border-r">Haber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 font-mono">
                    {balanzaHierarchicalRows.map((row, index) => {
                      const formatBalanzaVal = (val: any) => {
                        const n = Number(val);
                        if (isNaN(n) || n === 0 || Math.abs(n) < 0.005) return "0,00";
                        const str = Math.abs(n).toFixed(2);
                        let parts = str.split('.');
                        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                        const formatted = parts.join(',');
                        return n < 0 ? `(${formatted})` : formatted;
                      };

                      return (
                        <tr key={index} className="border-b border-slate-150 hover:bg-slate-50/80 transition-colors text-[10px] md:text-xs text-slate-700 font-normal">
                          <td className="p-2 text-slate-400 font-medium">{row.codigo}</td>
                          <td className="p-2 font-sans text-slate-700 pl-6 border-l border-slate-100 font-medium">
                            {row.nombre}
                          </td>
                          <td className="p-2 text-right border-l border-r border-slate-200 text-slate-500 bg-slate-50/20">
                            {formatBalanzaVal(row.saldoInicial)}
                          </td>
                          <td className="p-2 text-right text-slate-600">
                            {formatBalanzaVal(row.debitos)}
                          </td>
                          <td className="p-2 text-right border-r border-slate-200 text-slate-600">
                            {formatBalanzaVal(row.creditos)}
                          </td>
                          <td className="p-2 text-right font-bold text-indigo-600 bg-indigo-50/10">
                            {formatBalanzaVal(row.saldoActual)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Fila inferior de Totales con el patrón de la de 6 columnas */}
                    <tr className="border-t-2 border-b-4 border-double border-slate-400 font-bold bg-slate-100 text-slate-800 font-mono text-[11px] md:text-xs">
                      <td className="p-2.5 font-sans font-black" colSpan={2}>
                        TOTALES SUMAS
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-800 border-l border-r border-slate-200">
                        {(() => {
                          const val = totalesHierarchical.saldoInicial;
                          const n = Number(val);
                          if (isNaN(n) || n === 0 || Math.abs(n) < 0.005) return "0,00";
                          const str = Math.abs(n).toFixed(2);
                          let parts = str.split('.');
                          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                          const formatted = parts.join(',');
                          return n < 0 ? `(${formatted})` : formatted;
                        })()}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-800">
                        {(() => {
                          const val = totalesHierarchical.debitos;
                          const n = Number(val);
                          if (isNaN(n) || n === 0 || Math.abs(n) < 0.005) return "0,00";
                          const str = Math.abs(n).toFixed(2);
                          let parts = str.split('.');
                          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                          const formatted = parts.join(',');
                          return n < 0 ? `(${formatted})` : formatted;
                        })()}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200">
                        {(() => {
                          const val = totalesHierarchical.creditos;
                          const n = Number(val);
                          if (isNaN(n) || n === 0 || Math.abs(n) < 0.005) return "0,00";
                          const str = Math.abs(n).toFixed(2);
                          let parts = str.split('.');
                          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                          const formatted = parts.join(',');
                          return n < 0 ? `(${formatted})` : formatted;
                        })()}
                      </td>
                      <td className="p-2.5 text-right font-mono font-black text-indigo-700 bg-indigo-50/20">
                        {(() => {
                          const val = totalesHierarchical.saldoActual;
                          const n = Number(val);
                          if (isNaN(n) || n === 0 || Math.abs(n) < 0.005) return "0,00";
                          const str = Math.abs(n).toFixed(2);
                          let parts = str.split('.');
                          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                          const formatted = parts.join(',');
                          return n < 0 ? `(${formatted})` : formatted;
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto text-[11px] md:text-xs animate-in fade-in duration-200">
                <table className="w-full text-left border-collapse border border-slate-200">
                  <thead>
                    <tr className="border-b-2 border-slate-300 bg-slate-100">
                      <th className="p-2 font-bold text-slate-700" rowSpan={2}>Código</th>
                      <th className="p-2 font-bold text-slate-700" rowSpan={2}>Cuenta Contable</th>
                      <th className="p-2 text-center font-bold text-slate-700 border-l border-r border-slate-200" colSpan={2}>Saldos Iniciales</th>
                      <th className="p-2 text-center font-bold text-slate-700 border-r border-slate-200" colSpan={2}>Movimientos</th>
                      <th className="p-2 text-center font-bold text-slate-700" colSpan={2}>Saldos Finales</th>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="p-2 text-right font-medium text-slate-600 border-l">Debe</th>
                      <th className="p-2 text-right font-medium text-slate-600 border-r">Haber</th>
                      <th className="p-2 text-right font-medium text-slate-600">Debe</th>
                      <th className="p-2 text-right font-medium text-slate-600 border-r">Haber</th>
                      <th className="p-2 text-right font-bold text-indigo-600">Debe</th>
                      <th className="p-2 text-right font-bold text-indigo-600">Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanceComprobacion.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-slate-400">No se encontraron movimientos registrados para este período.</td>
                      </tr>
                    ) : (
                      balanceComprobacion.map((item, i) => (
                        <tr key={i} className="border-b border-slate-150 hover:bg-slate-50 transition-colors font-mono">
                          <td className="p-2 text-slate-500">{item.codigo}</td>
                          <td className="p-2 font-sans font-bold text-slate-700">{item.nombre}</td>
                          <td className="p-2 text-right border-l text-slate-500">${formatoES(item.saldoInicialDeudor)}</td>
                          <td className="p-2 text-right border-r text-slate-500">${formatoES(item.saldoInicialAcreedor)}</td>
                          <td className="p-2 text-right text-slate-600">${formatoES(item.debitos)}</td>
                          <td className="p-2 text-right border-r text-slate-600">${formatoES(item.creditos)}</td>
                          <td className="p-2 text-right font-bold text-indigo-600 bg-indigo-50/10">${formatoES(item.saldoFinalDeudor)}</td>
                          <td className="p-2 text-right font-bold text-indigo-600 bg-indigo-50/10">${formatoES(item.saldoFinalAcreedor)}</td>
                        </tr>
                      ))
                    )}
                    <tr className="border-t-2 border-slate-400 font-bold bg-slate-100 text-slate-800 font-mono">
                      <td className="p-2.5 font-sans font-black" colSpan={2}>TOTALES SUMAS</td>
                      <td className="p-2.5 text-right border-l">${formatoES(totalesComprobacion.saldoInicialDeudor)}</td>
                      <td className="p-2.5 text-right border-r">${formatoES(totalesComprobacion.saldoInicialAcreedor)}</td>
                      <td className="p-2.5 text-right">${formatoES(totalesComprobacion.debitos)}</td>
                      <td className="p-2.5 text-right border-r">${formatoES(totalesComprobacion.creditos)}</td>
                      <td className="p-2.5 text-right font-bold text-indigo-600 bg-indigo-50/20">${formatoES(totalesComprobacion.saldoFinalDeudor)}</td>
                      <td className="p-2.5 text-right font-bold text-indigo-600 bg-indigo-50/20">${formatoES(totalesComprobacion.saldoFinalAcreedor)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* REPORT: DIARIO DE COMPROBANTE CONTABLE (CONTABLE) */}
        {activeReport === 'diario' && (
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in duration-300">
            {/* Back button, title, toggle bar & print button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4 mb-6 no-print">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveReport(null)}
                  className="p-2 hover:bg-slate-50 rounded-xl border border-slate-200 text-slate-500 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-black text-slate-800">Diario de Comprobante</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase">Asientos Contables del {formatFechaDMY(startDate)} al {formatFechaDMY(endDate)}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* View toggles */}
                <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs no-print select-none">
                  <button
                    type="button"
                    onClick={() => setDiarioReportMode('resumen')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      diarioReportMode === 'resumen' 
                        ? 'bg-white text-slate-800 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Resumen de Diario
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiarioReportMode('detalle')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      diarioReportMode === 'detalle' 
                        ? 'bg-white text-slate-800 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Detalle de Asientos
                  </button>
                </div>

                <button 
                  onClick={() => handlePrintReport(diarioReportMode === 'resumen' ? 'printable-resumen-diario' : 'printable-detalle-diario', `Libro Diario - ${diarioReportMode === 'resumen' ? 'Resumen Consolidad' : 'Detalle de Asientos'}`, 'portrait')}
                  className="btn-primary !bg-slate-850 hover:!bg-slate-900 text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                >
                  <Printer className="w-4 h-4" /> 
                  {diarioReportMode === 'resumen' ? 'Imprimir Resumen' : 'Imprimir Diario'}
                </button>
              </div>
            </div>

            {/* VIEW MODE 1: RESUMEN DE DIARIO (REPLICATING THE DESIGN PATTERN OF THE IMAGE) */}
            {diarioReportMode === 'resumen' && (
              <div 
                id="printable-resumen-diario"
                className="bg-white p-6 md:p-12 border border-slate-200 rounded-xl shadow-xs max-w-4xl mx-auto text-slate-950 font-sans leading-normal animate-in fade-in duration-200"
              >
                {/* Centered Heading */}
                <div className="text-center pb-8 mb-6">
                  <h1 className="text-xl font-bold tracking-tight text-slate-950 block">Resumen de Diario</h1>
                  <p className="text-sm font-bold text-slate-900 mt-1 uppercase">
                    Del {formatFechaDMY(startDate)} Al {formatFechaDMY(endDate)}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">
                    Emitido el {fechaEmisionStr}
                  </p>
                </div>

                {/* Table Container */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] md:text-xs font-mono text-slate-900 border-collapse">
                    <thead>
                      <tr className="border-t border-b border-dotted border-slate-400">
                        <th className="py-2.5 text-left font-bold text-slate-950 w-[18%]">Código</th>
                        <th className="py-2.5 text-left font-bold text-slate-950 w-[52%]">NOMBRE DE LA CUENTA</th>
                        <th className="py-2.5 text-right font-bold text-slate-950 w-[15%]">DEBE</th>
                        <th className="py-2.5 text-right font-bold text-slate-950 w-[15%]">HABER</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Gap row */}
                      <tr className="h-2">
                        <td colSpan={4}></td>
                      </tr>

                      {resumenDiarioRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-400 italic">
                            No se registraron movimientos contables en el rango de fechas seleccionado.
                          </td>
                        </tr>
                      ) : (
                        resumenDiarioRows.map((row) => (
                          <tr key={row.codigo} className="hover:bg-slate-50/50">
                            <td className="py-1.5 text-left pr-4 whitespace-nowrap text-slate-600">{row.codigo}</td>
                            <td className="py-1.5 text-left pr-4 truncate font-sans uppercase font-medium">{row.nombre}</td>
                            <td className="py-1.5 text-right font-mono">{formatoES(row.debe)}</td>
                            <td className="py-1.5 text-right font-mono">{formatoES(row.haber)}</td>
                          </tr>
                        ))
                      )}

                      {/* Spacer row */}
                      <tr className="h-3">
                        <td colSpan={4}></td>
                      </tr>

                      {/* Bottom line and totals */}
                      <tr className="border-t border-dotted border-slate-500 font-bold select-text text-slate-950">
                        <td colSpan={2} className="py-4 font-bold text-[11px] md:text-xs uppercase tracking-wider pl-1 font-sans">
                          TOTALES. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
                        </td>
                        <td className="py-3 text-right font-bold font-mono text-xs border-b-[5px] border-double border-b-slate-900 align-middle">
                          {formatoES(resumenDiarioTotals.debe)}
                        </td>
                        <td className="py-3 text-right font-bold font-mono text-xs border-b-[5px] border-double border-b-slate-900 align-middle">
                          {formatoES(resumenDiarioTotals.haber)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footnote */}
                <div className="mt-14 pt-6 border-t border-slate-100 text-center text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                  SISTEMA CONTABLE REGISTRADO
                </div>
              </div>
            )}

            {/* VIEW MODE 2: DETALLE DE ASIENTOS COMPROBANTES (ORIGINAL LIST WITH PRINT ID DETALLE) */}
            {diarioReportMode === 'detalle' && (
              <div id="printable-detalle-diario" className="space-y-6 animate-in fade-in duration-200">
                <style>{`
                  @media print {
                    #printable-detalle-diario {
                      background: white !important;
                      color: black !important;
                    }
                  }
                `}</style>
                <div className="hidden print:block text-center pb-6 mb-6">
                  <h1 className="text-xl font-bold tracking-tight text-slate-950 block">Diario de Comprobante (Asientos Detallados)</h1>
                  <p className="text-sm font-bold text-slate-900 mt-1 uppercase">
                    Del {formatFechaDMY(startDate)} Al {formatFechaDMY(endDate)}
                  </p>
                </div>

                {comprobantes.filter(c => c.estado === 'Contabilizado' && (c.fecha || '').split('T')[0] >= startDate && (c.fecha || '').split('T')[0] <= endDate).length === 0 ? (
                  <div className="text-center py-8 text-slate-400">No se encontraron asientos contabilizados en este rango de fechas.</div>
                ) : (
                  comprobantes
                    .filter(c => c.estado === 'Contabilizado' && (c.fecha || '').split('T')[0] >= startDate && (c.fecha || '').split('T')[0] <= endDate)
                    .sort((a,b) => a.fecha.localeCompare(b.fecha))
                    .map((comp, index) => (
                      <div key={comp.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex flex-wrap justify-between items-center text-xs text-slate-500 font-bold">
                          <span>Asiento Nº {comp.codigo || index + 1}</span>
                          <span>Fecha: {formatFechaDMY(comp.fecha)}</span>
                          <span>Estado: <span className="text-emerald-600">{comp.estado}</span></span>
                        </div>
                        <div className="p-4 text-xs">
                          <p className="mb-3 font-bold text-slate-700">Contenido/Descripción: <span className="font-normal text-slate-600">{comp.glosa || comp.concepto}</span></p>
                          <table className="w-full text-left font-mono">
                            <thead>
                              <tr className="border-b border-slate-300 font-bold text-slate-600">
                                <th className="py-1">Código</th>
                                <th className="py-1 pl-4">Cuenta</th>
                                <th className="py-1 text-right">Debe</th>
                                <th className="py-1 text-right">Haber</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(comp.lineas || []).map((linea: any, lIndex: number) => {
                                const c = cuentasContables.find(item => String(item.id) === String(linea.cuentaId));
                                return (
                                  <tr key={lIndex} className="border-b border-slate-100 hover:bg-slate-50/50">
                                    <td className="py-1 px-1">{c?.codigo}</td>
                                    <td className="py-1 pl-4 font-sans">{c?.nombre}</td>
                                    <td className="py-1 text-right text-indigo-600">{linea.debe > 0 ? `$${formatoES(linea.debe)}` : '-'}</td>
                                    <td className="py-1 text-right text-emerald-600">{linea.haber > 0 ? `$${formatoES(linea.haber)}` : '-'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        )}

        {/* REPORT: LIBRO MAYOR (CONTABLE) */}
        {activeReport === 'libro_mayor' && (
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in duration-300">
            {/* Back button, title, account selector & print button */}
            {/* Back button, title, account selector & print button */}
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-6 mb-6 no-print">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveReport(null)}
                    className="p-2 hover:bg-slate-50 rounded-xl border border-slate-200 text-slate-500 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">Libro Mayor</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase">Movimientos del {formatFechaDMY(startDate)} al {formatFechaDMY(endDate)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-slate-600 font-bold no-print select-none cursor-pointer hover:text-slate-800">
                    <input 
                      type="checkbox" 
                      checked={mayorHideZero} 
                      onChange={(e) => setMayorHideZero(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Ocultar saldo 0</span>
                  </label>

                  <button 
                    onClick={() => handlePrintReport('printable-libro-mayor', 'Libro Mayor Detallado', 'portrait')}
                    className="btn-primary !bg-slate-850 hover:!bg-slate-905 text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all animate-none"
                  >
                    <Printer className="w-4 h-4" /> 
                    Imprimir Mayor
                  </button>

                  <button 
                    onClick={downloadMayorExcel}
                    className="btn-primary !bg-emerald-650 hover:!bg-emerald-705 text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all animate-none"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> 
                    Descargar Excel
                  </button>
                </div>
              </div>

              {/* Selector de modo y filtros */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                {/* Toggle de Modo */}
                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Filtro por:</span>
                  <div className="bg-slate-200/80 p-0.5 rounded-xl flex">
                    <button
                      type="button"
                      onClick={() => {
                        setMayorFilterMode('individual');
                        setDesdeMayorAccountId('');
                        setHastaMayorAccountId('');
                      }}
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${
                        mayorFilterMode === 'individual' 
                          ? 'bg-white text-indigo-700 shadow-xs' 
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Cuenta Única
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMayorFilterMode('rango');
                        setSelectedMayorAccountId('');
                      }}
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all ${
                        mayorFilterMode === 'rango' 
                          ? 'bg-white text-indigo-700 shadow-xs' 
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Rango de Cuentas
                    </button>
                  </div>
                </div>

                {/* Filtros correspondientes */}
                <div className="md:col-span-9 flex flex-col sm:flex-row gap-3">
                  {mayorFilterMode === 'individual' ? (
                    <div className="flex-1 flex flex-col gap-1.5 w-full">
                      <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Cuenta Contable:</span>
                      <select
                        value={selectedMayorAccountId}
                        onChange={(e) => setSelectedMayorAccountId(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 w-full"
                      >
                        <option value="">-- Seleccione una cuenta contable para ver su Libro Mayor --</option>
                        {libroMayorData.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.codigo} - {acc.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                      <div className="flex flex-col gap-1.5 w-full">
                        <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Desde Código/Cuenta:</span>
                        <select
                          value={desdeMayorAccountId}
                          onChange={(e) => setDesdeMayorAccountId(e.target.value)}
                          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 w-full"
                        >
                          <option value="">-- Primera Cuenta (Inicio) --</option>
                          {libroMayorData.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.codigo} - {acc.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5 w-full">
                        <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Hasta Código/Cuenta:</span>
                        <select
                          value={hastaMayorAccountId}
                          onChange={(e) => setHastaMayorAccountId(e.target.value)}
                          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 w-full"
                        >
                          <option value="">-- Última Cuenta (Fin) --</option>
                          {libroMayorData.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.codigo} - {acc.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PRINT CONTAINER */}
            <div id="printable-libro-mayor" className="space-y-8">
              {/* Header inside printing mode */}
              <div className="hidden print:block text-center pb-6 border-b-2 border-slate-300 mb-6">
                <h1 className="text-xl font-bold tracking-tight text-slate-950">Libro Mayor General</h1>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mt-1">
                  Período: del {formatFechaDMY(startDate)} al {formatFechaDMY(endDate)}
                </p>
                <p className="text-[10px] text-slate-400 font-mono mt-1">
                  Emitido el {fechaEmisionStr}
                </p>
              </div>

              {(() => {
                // Filter the accounts to display based on selection
                let accountsToDisplay: any[] = [];

                if (mayorFilterMode === 'individual') {
                  if (selectedMayorAccountId) {
                    accountsToDisplay = libroMayorData.filter(acc => String(acc.id) === String(selectedMayorAccountId));
                  }
                } else if (mayorFilterMode === 'rango') {
                  if (desdeMayorAccountId && hastaMayorAccountId) {
                    const desdeAcc = libroMayorData.find(acc => String(acc.id) === String(desdeMayorAccountId));
                    const hastaAcc = libroMayorData.find(acc => String(acc.id) === String(hastaMayorAccountId));
                    
                    if (desdeAcc && hastaAcc) {
                      // Compare alphabetically by codigo
                      const codMin = desdeAcc.codigo;
                      const codMax = hastaAcc.codigo;
                      
                      // Normalize range comparison
                      const minCode = codMin.localeCompare(codMax) <= 0 ? codMin : codMax;
                      const maxCode = codMin.localeCompare(codMax) <= 0 ? codMax : codMin;
                      
                      accountsToDisplay = libroMayorData.filter(acc => 
                        acc.codigo >= minCode && acc.codigo <= maxCode
                      );
                    }
                  }
                }

                if (mayorHideZero) {
                  accountsToDisplay = accountsToDisplay.filter(acc => Math.abs(acc.saldoFinal) >= 0.01);
                }

                if (accountsToDisplay.length === 0) {
                  return (
                    <div className="text-center py-16 bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-8 max-w-xl mx-auto flex flex-col items-center gap-3 no-print">
                      <Landmark className="w-10 h-10 text-indigo-500 animate-pulse" />
                      <h3 className="text-sm font-black text-slate-700">Libro Mayor</h3>
                      <p className="text-xs text-slate-500 leading-relaxed text-center">
                        {mayorFilterMode === 'individual' 
                          ? 'Por favor, seleccione una cuenta contable en el panel superior para visualizar el detalle de sus movimientos y saldos acumulados.' 
                          : 'Por favor, defina tanto la cuenta de inicio (Desde) como de fin (Hasta) en el panel superior para cargar el rango seleccionado.'
                        }
                      </p>
                    </div>
                  );
                }

                return accountsToDisplay.map((acc, idx) => (
                  <div key={acc.id} className={`border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white ${idx > 0 ? 'page-break-before-print mt-6' : ''}`}>
                    {/* Account Header block */}
                    <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <span className="font-mono text-[11px] sm:text-xs text-slate-500 font-bold block">{acc.codigo}</span>
                        <h3 className="text-sm sm:text-base font-black text-slate-800 tracking-tight font-sans uppercase">
                          {acc.nombre}
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:gap-4 text-xs font-mono">
                        <div className="bg-white/80 px-2 py-1 rounded border border-slate-150">
                          <span className="text-slate-400 uppercase font-sans font-bold text-[9px] mr-1">Naturaleza:</span>
                          <span className="text-slate-700 font-bold">{acc.nat}</span>
                        </div>
                        <div className="bg-white/80 px-2 py-1 rounded border border-slate-150 font-mono">
                          <span className="text-slate-400 uppercase font-sans font-bold text-[9px] mr-1">Saldo Anterior:</span>
                          <span className={`font-bold ${acc.saldoInicial >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                            ${formatoES(acc.saldoInicial)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 overflow-x-auto text-xs">
                      <table className="w-full text-left font-mono border-collapse min-w-[650px]">
                        <thead>
                          <tr className="border-b border-slate-300 font-bold text-slate-600 bg-slate-50/50">
                            <th className="py-2 px-2 w-[12%]">Fecha</th>
                            <th className="py-2 px-2 w-[15%]">Documento / Asiento</th>
                            <th className="py-2 px-2 w-[38%]">Descripción / Glosa</th>
                            <th className="py-2 px-2 text-right w-[11%]">Debe</th>
                            <th className="py-2 px-2 text-right w-[11%]">Haber</th>
                            <th className="py-2 px-2 text-right w-[13%]">Saldo Acumulado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Saldo Inicial Row */}
                          <tr className="border-b border-slate-150 bg-slate-50/30 text-slate-500 italic font-medium">
                            <td className="py-1.5 px-2">-</td>
                            <td className="py-1.5 px-2">-</td>
                            <td className="py-1.5 px-2 font-sans text-[11px]">SALDO INICIAL AL {formatFechaDMY(startDate)}</td>
                            <td className="py-1.5 px-2 text-right">-</td>
                            <td className="py-1.5 px-2 text-right">-</td>
                            <td className={`py-1.5 px-2 text-right font-bold ${acc.saldoInicial >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                              ${formatoES(acc.saldoInicial)}
                            </td>
                          </tr>

                          {acc.entries.length === 0 ? (
                            <tr className="border-b border-slate-100 hover:bg-slate-50/40">
                              <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                                Sin movimientos registrados en el período de fechas establecido.
                              </td>
                            </tr>
                          ) : (
                            acc.entries.map((entry: any, eIdx: number) => (
                              <tr key={eIdx} className="border-b border-slate-100 hover:bg-slate-50/40 transition-colors">
                                <td className="py-2 px-2 whitespace-nowrap text-slate-500 font-medium">{formatFechaDMY(entry.fecha)}</td>
                                <td className="py-2 px-2 text-slate-600 font-bold text-xs">
                                  {entry.comprobante !== 'N/A' ? (
                                    <>
                                      <div>ASN-{entry.comprobante}</div>
                                      {entry.comprobanteNumero && entry.comprobanteNumero !== 'N/A' && (
                                        <div className="text-[10px] text-slate-400 font-mono font-medium mt-0.5">{entry.comprobanteNumero}</div>
                                      )}
                                    </>
                                  ) : (
                                    <div>{entry.comprobanteNumero || 'ASN-N/A'}</div>
                                  )}
                                </td>
                                <td className="py-2 px-2 font-sans truncate text-slate-700 max-w-[280px]" title={entry.concepto}>
                                  {entry.concepto}
                                </td>
                                <td className="py-2 px-2 text-right text-indigo-600 font-semibold">
                                  {entry.debe > 0 ? `$${formatoES(entry.debe)}` : '-'}
                                </td>
                                <td className="py-2 px-2 text-right text-emerald-600 font-semibold">
                                  {entry.haber > 0 ? `$${formatoES(entry.haber)}` : '-'}
                                </td>
                                <td className={`py-2 px-2 text-right font-bold bg-slate-50/10 ${entry.saldo >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
                                  ${formatoES(entry.saldo)}
                                </td>
                              </tr>
                            ))
                          )}

                          {/* Account Summary Footer */}
                          <tr className="border-t-2 border-slate-400 font-bold bg-slate-100 text-slate-800">
                            <td colSpan={3} className="py-3 px-2 font-sans font-black text-slate-700 uppercase tracking-widest text-[10px]">
                              Suma del Período e Importes
                            </td>
                            <td className="py-3 px-2 text-right text-indigo-700 font-black">
                              ${formatoES(acc.totalDebe)}
                            </td>
                            <td className="py-3 px-2 text-right text-emerald-700 font-black">
                              ${formatoES(acc.totalHaber)}
                            </td>
                            <td className={`py-3 px-2 text-right font-black bg-indigo-50/30 text-indigo-900 border-l border-slate-200`}>
                              ${formatoES(acc.saldoFinal)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* REPORT: SALUD FINANCIERA */}
        {activeReport === 'salud_financiera' && (
          <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in duration-300 max-w-[21cm] mx-auto" id="printable-salud-financiera">
            {/* Encabezado */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b-2 border-slate-800 gap-4 mb-6">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveReport(null)}
                  className="p-2 hover:bg-slate-50 rounded-xl border border-slate-200 text-slate-500 transition-colors no-print"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-wider uppercase flex items-center gap-2">
                    <HeartPulse className="w-6 h-6 text-rose-600" /> Diagnóstico de Salud Financiera
                  </h2>
                  <p className="text-xs text-slate-500 font-bold uppercase">Análisis de Liquidez, Capacidad de Pago y Solvencia al {endDate}</p>
                </div>
              </div>

              <button 
                onClick={() => handlePrintReport('printable-salud-financiera', 'Diagnóstico de Salud Financiera', 'portrait')}
                className="btn-primary !bg-slate-950 text-xs flex items-center gap-1.5 no-print"
              >
                <Printer className="w-4 h-4" /> {saludFinancieraTab === 'diagnostico' ? "Imprimir Diagnóstico" : "Imprimir Saldos Contables"}
              </button>
            </div>

            {/* Sub-pestañas de Salud Financiera */}
            <div className="flex border-b border-slate-200 mb-6 gap-2 no-print">
              <button
                onClick={() => setSaludFinancieraTab('diagnostico')}
                className={`py-2.5 px-4 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-1.5 ${
                  saludFinancieraTab === 'diagnostico'
                    ? 'border-rose-600 text-rose-650 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-850'
                }`}
              >
                <Activity className="w-4 h-4 text-rose-600" /> Semáforo y Diagnóstico CFO
              </button>
              <button
                onClick={() => setSaludFinancieraTab('cuentas_saldos')}
                className={`py-2.5 px-4 text-xs font-bold transition-all border-b-2 -mb-px flex items-center gap-1.5 ${
                  saludFinancieraTab === 'cuentas_saldos'
                    ? 'border-indigo-600 text-indigo-900 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-850'
                }`}
              >
                <ListTree className="w-4 h-4 text-indigo-605" /> Cuentas Contables y Saldos Reales
              </button>
            </div>

            {/* TAB 1: DIAGNÓSTICO GENERAL */}
            {saludFinancieraTab === 'diagnostico' && (
              <div className="space-y-6">
                {/* KPI Cards (Bento) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Disponibilidad Líquida (1)</span>
                    <p className={`text-2xl font-mono font-black ${totalBancosSaldosUSD < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{totalBancosSaldosUSD < 0 ? '-' : ''}${formatoES(Math.abs(totalBancosSaldosUSD))}</p>
                    <span className="text-[10px] text-slate-500 mt-1 block">Recursos inmediatos en bancos y caja fresca.</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Deudas Comerciales (2)</span>
                    <p className="text-2xl font-mono font-black text-rose-600">${formatoES(totalCxPPendiente)}</p>
                    <span className="text-[10px] text-slate-500 mt-1 block">Obligaciones de pago a proveedores (CxP) vigentes.</span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cuentas por Cobrar (3)</span>
                    <p className="text-2xl font-mono font-black text-indigo-600">${formatoES(totalCxCPendiente)}</p>
                    <span className="text-[10px] text-slate-500 mt-1 block">Facturación pendiente de cobro a clientes (CxC).</span>
                  </div>
                </div>

                {/* Sección de Diagnóstico de Liquidez y Capacidad de Pago */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="bg-slate-905 p-4 text-white bg-slate-900">
                    <h3 className="text-xs uppercase font-black tracking-widest text-slate-300">Verificación de Capacidad de Pago Inmediata</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Evaluación del disponible neto inmediato frente a las facturas pendientes de proveedores.</p>
                  </div>
                  
                  <div className="p-5 space-y-4">
                    {/* Comparación matemática */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                        <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-2">Escenario 1: Cobertura de Caja Inmediata</h4>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>(+) Disponibilidad en Bancos</span>
                            <span className="font-mono font-bold text-slate-800">${formatoES(totalBancosSaldosUSD)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>(-) Cuentas por Pagar (Proveedores)</span>
                            <span className="font-mono font-bold text-rose-600">(${formatoES(totalCxPPendiente)})</span>
                          </div>
                          <div className="border-t border-slate-200 my-2 pt-2 flex justify-between font-extrabold text-sm font-sans pt-3">
                            <span>(=) Capital Excedente Inmediato</span>
                            <span className={`font-mono ${totalBancosSaldosUSD - totalCxPPendiente >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {totalBancosSaldosUSD - totalCxPPendiente >= 0 ? "Sobrante" : "Faltante"}: ${formatoES(Math.abs(totalBancosSaldosUSD - totalCxPPendiente))}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                        <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-2">Escenario 2: Cobertura Proyectada (Con CxC)</h4>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>(+) Disponibilidad en Bancos</span>
                            <span className="font-mono font-bold text-slate-800">${formatoES(totalBancosSaldosUSD)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>(+) Cuentas por Cobrar (Clientes)</span>
                            <span className="font-mono font-bold text-indigo-600">${formatoES(totalCxCPendiente)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>(-) Cuentas por Pagar (Proveedores)</span>
                            <span className="font-mono font-bold text-rose-600">(${formatoES(totalCxPPendiente)})</span>
                          </div>
                          <div className="border-t border-slate-200 my-2 pt-2 flex justify-between font-extrabold text-sm font-sans pt-3">
                            <span>(=) Capital Excedente Proyectado</span>
                            <span className={`font-mono ${(totalBancosSaldosUSD + totalCxCPendiente) - totalCxPPendiente >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {(totalBancosSaldosUSD + totalCxCPendiente) - totalCxPPendiente >= 0 ? "Sobrante" : "Faltante"}: ${formatoES(Math.abs((totalBancosSaldosUSD + totalCxCPendiente) - totalCxPPendiente))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Diagnóstico Final Consolidado */}
                    <div className="border-t border-slate-100 pt-4">
                      <h4 className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-2.5">Diagnóstico y Semáforo de Solvencia</h4>
                      
                      {totalBancosSaldosUSD >= totalCxPPendiente ? (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs leading-relaxed space-y-2">
                          <div className="flex items-center gap-2 font-black text-emerald-950">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>ÓPTIMA CAPACIDAD DE PAGO INMEDIATA (Semáforo Verde)</span>
                          </div>
                          <p className="font-sans font-medium">
                            La empresa dispone actualmente de <strong>${formatoES(totalBancosSaldosUSD)}</strong> en liquidez bancaria, la cual es suficiente para cubrir la totalidad de sus deudas comerciales acumuladas (<strong>${formatoES(totalCxPPendiente)}</strong>). 
                            Incluso si todos los proveedores exigieran sus pagos hoy mismo, la compañía conservaría un fondo de efectivo o colchón remanente de <strong>${formatoES(totalBancosSaldosUSD - totalCxPPendiente)}</strong> sin necesidad de recurrir a la cobranza urgente a clientes o inyectar recursos externos.
                          </p>
                        </div>
                      ) : (totalBancosSaldosUSD + totalCxCPendiente) >= totalCxPPendiente ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs leading-relaxed space-y-2">
                          <div className="flex items-center gap-2 font-black text-amber-955">
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>SOLVENCIA OPERATIVA CON RESPALDO DE CARTERA (Semáforo Amarillo)</span>
                          </div>
                          <p className="font-sans font-medium">
                            Los saldos líquidos disponibles en bancos (<strong>${formatoES(totalBancosSaldosUSD)}</strong>) no alcanzan a pagar de forma inmediata la totalidad de sus deudas actuales de proveedores (<strong>${formatoES(totalCxPPendiente)}</strong>), registrando una brecha o faltante inmediato de caja de <strong>${formatoES(Math.abs(totalBancosSaldosUSD - totalCxPPendiente))}</strong>.
                          </p>
                          <p className="font-sans font-medium text-[11px] underline">
                            <strong>Sin embargo, la compañía es solvente en el ciclo corto:</strong> Al recuperar la facturación por cobrar de clientes (<strong>${formatoES(totalCxCPendiente)}</strong>), se recaudarán fondos suficientes para cancelar el 100% de las obligaciones con proveedores y conservar un remanente neto estimado de <strong>${formatoES((totalBancosSaldosUSD + totalCxCPendiente) - totalCxPPendiente)}</strong>. Se recomienda dinamizar el departamento de cobro a clientes.
                          </p>
                        </div>
                      ) : (
                        <div className="p-4 bg-rose-50 border border-rose-250 rounded-xl text-rose-800 text-xs leading-relaxed space-y-2">
                          <div className="flex items-center gap-2 font-black text-rose-955">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                            <span>RESTRICCIÓN DE FLUIDEZ Y COBERTURA (Semáforo Rojo)</span>
                          </div>
                          <p className="font-sans font-medium">
                            Las deudas de proveedores actualmente comprometidas (<strong>${formatoES(totalCxPPendiente)}</strong>) superan significativamente tanto la disponibilidad de caja (<strong>${formatoES(totalBancosSaldosUSD)}</strong>) como los cobros estimados pendientes de clientes (<strong>${formatoES(totalCxCPendiente)}</strong>).
                          </p>
                          <p className="font-sans font-medium">
                            Incluso liquidando el total de la cartera de clientes de inmediato, persistirá una brecha de financiamiento de <strong>${formatoES(Math.abs((totalBancosSaldosUSD + totalCxCPendiente) - totalCxPPendiente))}</strong>. Se requiere de forma urgente contactar a sus acreedores para prorrogar plazos, reducir transitoriamente egresos de capital no estratégicos o inyectar fondos frescos de socios.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ratios Financieros de Cobertura */}
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <div className="bg-slate-50 p-3 border-b font-extrabold text-slate-800">
                    Índices Financieros de Liquidez y Trabajo
                  </div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-2.5 pl-4">Índice Financiero</th>
                        <th className="p-2.5 text-center">Fórmula de Cálculo</th>
                        <th className="p-2.5 text-center">Valor / Ratio</th>
                        <th className="p-2.5 pr-4">Evaluación y Diagnóstico</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 pl-4 font-bold text-slate-800">Índice de Caja (Cash Ratio)</td>
                        <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">Disponibilidad / Cuentas por Pagar (CxP)</td>
                        <td className="p-2.5 text-center font-mono font-extrabold text-slate-900 text-[12px]">
                          {totalCxPPendiente > 0 
                            ? (totalBancosSaldosUSD / totalCxPPendiente).toFixed(2) 
                            : totalBancosSaldosUSD > 0 ? "INF (Sin deudas)" : "0.00"
                          }
                        </td>
                        <td className="p-2.5 text-slate-600 pr-4">
                          {totalCxPPendiente === 0 
                            ? "Sin deudas comerciales en cuenta." 
                            : (totalBancosSaldosUSD / totalCxPPendiente) >= 1.0 
                              ? "✓ Excelente. Caja neta suficiente para liquidar el pasivo corriente." 
                              : "⚠ Ajustado (< 1.0). Requiere recurrir a cobranzas o recursos de inventario."}
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 pl-4 font-bold text-slate-800">Prueba Ácida Corriente</td>
                        <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">(Disponible + CxC) / Cuentas por Pagar</td>
                        <td className="p-2.5 text-center font-mono font-extrabold text-slate-900 text-[12px]">
                          {totalCxPPendiente > 0 
                            ? ((totalBancosSaldosUSD + totalCxCPendiente) / totalCxPPendiente).toFixed(2) 
                            : (totalBancosSaldosUSD + totalCxCPendiente) > 0 ? "INF" : "0.00"
                          }
                        </td>
                        <td className="p-2.5 text-slate-600 pr-4">
                          {totalCxPPendiente === 0 
                            ? "Excelente capacidad de cobertura." 
                            : ((totalBancosSaldosUSD + totalCxCPendiente) / totalCxPPendiente) >= 1.0 
                              ? "✓ Saludable. La suma líquida y facturas de clientes aseguran el cumplimiento del pasivo." 
                              : "⚠️ Insuficiente (< 1.0). Las deudas superan las cobranzas estimadas a corto plazo."}
                        </td>
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="p-2.5 pl-4 font-bold text-slate-800">Ratio de Pasivos Totales</td>
                        <td className="p-2.5 text-center text-slate-500 font-mono text-[11px]">Disponible / Pasivos Totales (Consolidados)</td>
                        <td className="p-2.5 text-center font-mono font-extrabold text-slate-900 text-[12px]">
                          {balanceGeneral.totalPasivos > 0 
                            ? (totalBancosSaldosUSD / balanceGeneral.totalPasivos).toFixed(2) 
                            : totalBancosSaldosUSD > 0 ? "INF (Sin Pasivos)" : "0.00"
                          }
                        </td>
                        <td className="p-2.5 text-slate-600 pr-4">
                          {balanceGeneral.totalPasivos === 0 
                            ? "Sin pasivos registrados en libro." 
                            : (totalBancosSaldosUSD / balanceGeneral.totalPasivos) >= 1.0 
                              ? "✓ Todo el endeudamiento de la cuenta contable de pasivos está respaldado." 
                              : "Existen otras deudas contables (Impuestos, provisiones, etc.) que cuidar."}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Detalle de Cuentas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Desglose Disponibilidad */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-50 p-3 border-b font-bold text-slate-800 flex justify-between items-center">
                      <span>Saldos Disponibles en Bancos</span>
                      <span className={`font-mono text-[11px] font-bold ${totalBancosSaldosUSD < 0 ? 'text-rose-600 font-extrabold' : 'text-slate-600'}`}>Total: {totalBancosSaldosUSD < 0 ? '-' : ''}${formatoES(Math.abs(totalBancosSaldosUSD))}</span>
                    </div>
                    <div className="p-3 divide-y divide-slate-100 max-h-56 overflow-y-auto">
                      {(bancosConSaldos || []).length === 0 ? (
                        <p className="text-slate-400 italic text-center py-4">No se registran fondos de cuentas bancarias.</p>
                      ) : (
                        bancosConSaldos.map((b: any) => (
                          <div key={b.id} className="py-2 flex justify-between items-center text-[11px]">
                            <div>
                              <p className="font-extrabold text-slate-800">{b.banco}</p>
                              <span className="text-[9px] text-slate-400 font-mono">
                                Nº: {b.cuenta || 'Sin cuenta'} ({b.moneda === 'Bolivares' ? 'VES' : 'USD'})
                                {b.lastSapsRate && ` • Último SAPS: ${formatoES(b.lastSapsRate)}`}
                                {!b.lastSapsRate && b.effectiveRate > 1 && ` • Tasa: ${formatoES(b.effectiveRate)}`}
                              </span>
                            </div>
                            <div className="text-right font-mono">
                              <span className={`font-extrabold ${b.saldoUSD < 0 ? 'text-rose-600 font-extrabold animate-pulse' : 'text-slate-900'}`}>{b.saldoUSD < 0 ? '-' : ''}${formatoES(Math.abs(b.saldoUSD))}</span>
                              {b.moneda === 'Bolivares' && (
                                <p className={`text-[9px] ${b.saldoVES < 0 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>{b.saldoVES < 0 ? '-' : ''}Bs. {formatoES(Math.abs(b.saldoVES))}</p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Desglose Deudas */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-50 p-3 border-b font-bold text-slate-800 flex justify-between items-center">
                      <span>Cuentas por Pagar (Proveedores)</span>
                      <span className="font-mono text-[11px] text-rose-600 font-black">Total: ${formatoES(totalCxPPendiente)}</span>
                    </div>
                    <div className="p-3 divide-y divide-slate-100 max-h-56 overflow-y-auto">
                      {(cxp || []).filter(item => (Number(item.saldo) || 0) >= 0.01).length === 0 ? (
                        <p className="text-slate-400 italic text-center py-4">Sin deudas vencidas/pendientes con proveedores.</p>
                      ) : (
                        cxp
                          .filter(item => (Number(item.saldo) || 0) >= 0.01)
                          .map((item: any, idx) => (
                            <div key={idx} className="py-2 flex justify-between items-center text-[11px]">
                              <div>
                                <p className="font-bold text-slate-800 truncate max-w-[170px]" title={item.proveedor}>{item.proveedor}</p>
                                <span className="text-[9px] text-slate-400 font-mono">Doc: {item.factura_id || `ID-${item.id?.slice(-4)}`} / Vence: {item.vencimiento || item.fecha}</span>
                              </div>
                              <div className="text-right font-mono font-bold text-rose-600">
                                <span>${formatoES(Number(item.saldo))}</span>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Recomendaciones Estratégicas */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs">
                  <h4 className="font-extrabold uppercase text-[10px] tracking-wider text-slate-400 mb-2 font-mono">Recomendaciones del CFO Virtual</h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-slate-650 leading-relaxed font-sans">
                    <li><strong>Alinear ciclos de cobranza y pago:</strong> Intente negociar plazos de cobro a clientes más cortos (ej. 15 días) y plazos de pago a proveedores más holgados (ej. 30 o 45 días) para generar caja líquida libre de presión.</li>
                    <li><strong>Reserva de Liquidez:</strong> Trate de mantener en bancos al menos el equivalente a 1.5 veces sus deudas de proveedores inmediatas para amortiguar cualquier período inesperado de baja facturación.</li>
                    <li><strong>Negociación de Deudas:</strong> Si se encuentra en un semáforo de alerta, reestructure los compromisos antes de su fecha de vencimiento. Los proveedores valoran la transparencia y prefieren acordar cuotas a enfrentar impagos.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 2: CUENTAS CONTABLES Y SALDOS REALES */}
            {saludFinancieraTab === 'cuentas_saldos' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-indigo-50 border border-indigo-150 rounded-xl p-4 text-xs text-indigo-950 leading-relaxed no-print">
                  <p className="font-bold uppercase tracking-wider text-[10px] text-indigo-800 mb-1">Alineación Financiera Contra Balances del Mayor</p>
                  A continuación se desglosan de manera unificada las <strong>cuentas de movimiento</strong> de Activo, Pasivo y Patrimonio que conforman el balance base del reporte, mostrando todos sus saldos reales consolidados en una sola vista.
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="p-4 bg-slate-900 text-white flex justify-between items-center flex-wrap gap-4">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-200">Cuentas Contables y Saldos Reales Consolidados</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase">Cuentas de Movimientos de Activo, Pasivo y Patrimonio</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3 pl-4">Código Cuenta</th>
                          <th className="p-3">Nombre de Cuenta Contable</th>
                          <th className="p-3 text-center">Clasificación</th>
                          <th className="p-3 text-right pr-4">Saldo Real (Mayor)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-705">
                        {/* Activos - Efectivo y Bancos */}
                        {saludFinancieraSaldos.deCajaBancos.map((acc: any) => (
                          <tr key={acc.id} className="hover:bg-slate-50/50">
                            <td className="p-3 pl-4 font-mono font-bold text-slate-500 w-32">{acc.codigo}</td>
                            <td className="p-3 text-slate-800 font-extrabold">{acc.nombre}</td>
                            <td className="p-3 text-center w-32">
                              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase tracking-widest">Activo</span>
                            </td>
                            <td className="p-3 text-right pr-4 font-mono font-black text-slate-900 w-32">${formatoES(acc.saldo)}</td>
                          </tr>
                        ))}
                        {saludFinancieraSaldos.deCajaBancos.length > 0 && (
                          <tr className="bg-emerald-50/20 font-bold border-t border-slate-200">
                            <td className="p-2 pl-4 text-emerald-800 text-[10px] text-right uppercase tracking-widest" colSpan={3}>
                              Total Efectivo y Bancos
                            </td>
                            <td className="p-2 text-right pr-4 font-mono text-[11px] font-black text-emerald-700">
                              ${formatoES(saludFinancieraSaldos.totalCajaBancos)}
                            </td>
                          </tr>
                        )}

                        {/* Activos - Cuentas por Cobrar */}
                        {saludFinancieraSaldos.deCxC.map((acc: any) => (
                          <tr key={acc.id} className="hover:bg-slate-50/50">
                            <td className="p-3 pl-4 font-mono font-bold text-slate-500 w-32">{acc.codigo}</td>
                            <td className="p-3 text-slate-800 font-extrabold">{acc.nombre}</td>
                            <td className="p-3 text-center w-32">
                              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase tracking-widest">Activo</span>
                            </td>
                            <td className="p-3 text-right pr-4 font-mono font-black text-slate-900 w-32">${formatoES(acc.saldo)}</td>
                          </tr>
                        ))}
                        {saludFinancieraSaldos.deCxC.length > 0 && (
                          <tr className="bg-emerald-50/20 font-bold border-t border-slate-200">
                            <td className="p-2 pl-4 text-emerald-800 text-[10px] text-right uppercase tracking-widest" colSpan={3}>
                              Total Cuentas por Cobrar
                            </td>
                            <td className="p-2 text-right pr-4 font-mono text-[11px] font-black text-emerald-700">
                              ${formatoES(saludFinancieraSaldos.totalCxC)}
                            </td>
                          </tr>
                        )}

                        {/* Activos - Inventario */}
                        {saludFinancieraSaldos.deInventario.map((acc: any) => (
                          <tr key={acc.id} className="hover:bg-slate-50/50">
                            <td className="p-3 pl-4 font-mono font-bold text-slate-500 w-32">{acc.codigo}</td>
                            <td className="p-3 text-slate-800 font-extrabold">{acc.nombre}</td>
                            <td className="p-3 text-center w-32">
                              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase tracking-widest">Activo</span>
                            </td>
                            <td className="p-3 text-right pr-4 font-mono font-black text-slate-900 w-32">${formatoES(acc.saldo)}</td>
                          </tr>
                        ))}
                        {saludFinancieraSaldos.deInventario.length > 0 && (
                          <tr className="bg-emerald-50/20 font-bold border-t border-slate-200">
                            <td className="p-2 pl-4 text-emerald-800 text-[10px] text-right uppercase tracking-widest" colSpan={3}>
                              Total Inventario
                            </td>
                            <td className="p-2 text-right pr-4 font-mono text-[11px] font-black text-emerald-700">
                              ${formatoES(saludFinancieraSaldos.totalInventario)}
                            </td>
                          </tr>
                        )}

                        {/* Activos - Otros Activos */}
                        {saludFinancieraSaldos.deOtrosActivos.map((acc: any) => (
                          <tr key={acc.id} className="hover:bg-slate-50/50">
                            <td className="p-3 pl-4 font-mono font-bold text-slate-500 w-32">{acc.codigo}</td>
                            <td className="p-3 text-slate-800 font-extrabold">{acc.nombre}</td>
                            <td className="p-3 text-center w-32">
                              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase tracking-widest">Activo</span>
                            </td>
                            <td className="p-3 text-right pr-4 font-mono font-black text-slate-900 w-32">${formatoES(acc.saldo)}</td>
                          </tr>
                        ))}
                        {saludFinancieraSaldos.deOtrosActivos.length > 0 && (
                          <tr className="bg-emerald-50/20 font-bold border-t border-slate-200">
                            <td className="p-2 pl-4 text-emerald-800 text-[10px] text-right uppercase tracking-widest" colSpan={3}>
                              Total Otros Activos
                            </td>
                            <td className="p-2 text-right pr-4 font-mono text-[11px] font-black text-emerald-700">
                              ${formatoES(saludFinancieraSaldos.totalOtrosActivos)}
                            </td>
                          </tr>
                        )}

                        {/* TOTAL DISPONIBLE (Activos) */}
                        <tr className="bg-emerald-100/50 font-black border-t-2 border-emerald-200">
                          <td className="p-3 pl-4 text-emerald-900 text-[11px] text-right uppercase tracking-widest" colSpan={3}>
                            Total Disponible (Total Activos)
                          </td>
                          <td className="p-3 text-right pr-4 font-mono text-[13px] font-black text-emerald-900">
                            ${formatoES(saludFinancieraSaldos.totalDisponible)}
                          </td>
                        </tr>

                        {/* Pasivos */}
                        {balanceGeneral.pasivos.filter(a => a.tipo === 'Movimiento' && Math.abs(a.saldo) > 0.009).map((acc: any) => (
                          <tr key={acc.id} className="hover:bg-slate-50/50">
                            <td className="p-3 pl-4 font-mono font-bold text-slate-500">{acc.codigo}</td>
                            <td className="p-3 text-slate-800 font-extrabold">{acc.nombre}</td>
                            <td className="p-3 text-center">
                              <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-black uppercase tracking-widest">Pasivo</span>
                            </td>
                            <td className="p-3 text-right pr-4 font-mono font-black text-slate-900">${formatoES(acc.saldo)}</td>
                          </tr>
                        ))}
                        <tr className="bg-rose-100/50 font-black border-t-2 border-rose-200">
                          <td className="p-3 pl-4 text-rose-900 text-[11px] text-right uppercase tracking-widest" colSpan={3}>
                            Total Por Pagar General (Total Pasivos)
                          </td>
                          <td className="p-3 text-right pr-4 font-mono text-[13px] font-black text-rose-900">
                            ${formatoES(saludFinancieraSaldos.totalPorPagar)}
                          </td>
                        </tr>

                        {/* DISPONIBLE DESPUÉS DE PAGOS */}
                        <tr className="bg-indigo-50 font-black border-t-2 border-indigo-200">
                          <td className="p-3 pl-4 text-indigo-900 text-[11px] text-right uppercase tracking-widest" colSpan={3}>
                            Disponible Después de Pagos
                          </td>
                          <td className="p-3 text-right pr-4 font-mono text-[13px] font-black text-indigo-900">
                            ${formatoES(saludFinancieraSaldos.disponibleDespuesPasivos)}
                          </td>
                        </tr>

                        {/* Patrimonio - Apartados */}
                        {saludFinancieraSaldos.deApartados.map((acc: any) => (
                          <tr key={acc.id} className="hover:bg-slate-50/50">
                            <td className="p-3 pl-4 font-mono font-bold text-slate-500">{acc.codigo}</td>
                            <td className="p-3 text-slate-800 font-extrabold">{acc.nombre}</td>
                            <td className="p-3 text-center">
                              <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-black uppercase tracking-widest">Apartados</span>
                            </td>
                            <td className="p-3 text-right pr-4 font-mono font-black text-slate-900">${formatoES(acc.saldo)}</td>
                          </tr>
                        ))}
                        {saludFinancieraSaldos.deApartados.length > 0 && (
                          <tr className="bg-indigo-100/50 font-black border-t border-indigo-200">
                            <td className="p-2 pl-4 text-indigo-900 text-[10px] text-right uppercase tracking-widest" colSpan={3}>
                              Total Apartados
                            </td>
                            <td className="p-2 text-right pr-4 font-mono text-[11px] font-black text-indigo-900">
                              ${formatoES(saludFinancieraSaldos.totalApartados)}
                            </td>
                          </tr>
                        )}

                        {/* DISPONIBLE (Disponible despues - apartados) */}
                        <tr className="bg-indigo-100 font-black border-t-2 border-indigo-300">
                          <td className="p-3 pl-4 text-indigo-950 text-[11px] text-right uppercase tracking-widest" colSpan={3}>
                            Disponible
                          </td>
                          <td className="p-3 text-right pr-4 font-mono text-[13px] font-black text-indigo-950">
                            ${formatoES(saludFinancieraSaldos.disponibleDespuesPasivos - saludFinancieraSaldos.totalApartados)}
                          </td>
                        </tr>

                        {/* Patrimonio - Utilidades */}
                        {saludFinancieraSaldos.deUtilidades.map((acc: any) => (
                          <tr key={acc.id} className="hover:bg-slate-50/50">
                            <td className="p-3 pl-4 font-mono font-bold text-slate-500">{acc.codigo}</td>
                            <td className="p-3 text-slate-800 font-extrabold">{acc.nombre}</td>
                            <td className="p-3 text-center">
                              <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-black uppercase tracking-widest">Utilidades</span>
                            </td>
                            <td className="p-3 text-right pr-4 font-mono font-black text-slate-900">${formatoES(acc.saldo)}</td>
                          </tr>
                        ))}
                        {saludFinancieraSaldos.deUtilidades.length > 0 && (
                          <tr className="bg-indigo-100/50 font-black border-t border-indigo-200">
                            <td className="p-2 pl-4 text-indigo-900 text-[10px] text-right uppercase tracking-widest" colSpan={3}>
                              Utilidades por Repartir
                            </td>
                            <td className="p-2 text-right pr-4 font-mono text-[11px] font-black text-indigo-900">
                              ${formatoES(saludFinancieraSaldos.totalUtilidades)}
                            </td>
                          </tr>
                        )}

                        {/* TOTAL (Disponible - Utilidades) */}
                        <tr className="bg-slate-100 font-black border-t-2 border-slate-300">
                          <td className="p-3 pl-4 text-slate-900 text-[11px] text-right uppercase tracking-widest" colSpan={3}>
                            Total
                          </td>
                          <td className="p-3 text-right pr-4 font-mono text-[13px] font-black text-slate-900">
                            ${formatoES(saludFinancieraSaldos.disponibleDespuesPasivos - saludFinancieraSaldos.totalApartados - saludFinancieraSaldos.totalUtilidades)}
                          </td>
                        </tr>

                        {/* Patrimonio - Fondo Capital */}
                        {saludFinancieraSaldos.deFondoCapital.map((acc: any) => (
                          <tr key={acc.id} className="hover:bg-slate-50/50">
                            <td className="p-3 pl-4 font-mono font-bold text-slate-500">{acc.codigo}</td>
                            <td className="p-3 text-slate-800 font-extrabold">{acc.nombre}</td>
                            <td className="p-3 text-center">
                              <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-black uppercase tracking-widest">Capital</span>
                            </td>
                            <td className="p-3 text-right pr-4 font-mono font-black text-slate-900">${formatoES(acc.saldo)}</td>
                          </tr>
                        ))}
                        {saludFinancieraSaldos.deFondoCapital.length > 0 && (
                          <tr className="bg-indigo-100/50 font-black border-t border-indigo-200">
                            <td className="p-2 pl-4 text-indigo-900 text-[10px] text-right uppercase tracking-widest" colSpan={3}>
                              Fondo de Capital
                            </td>
                            <td className="p-2 text-right pr-4 font-mono text-[11px] font-black text-indigo-900">
                              ${formatoES(saludFinancieraSaldos.totalFondoCapital)}
                            </td>
                          </tr>
                        )}

                        {/* DIFERENCIA */}
                        <tr className={`${Math.abs(saludFinancieraSaldos.disponibleDespuesPasivos - saludFinancieraSaldos.totalApartados - saludFinancieraSaldos.totalUtilidades - saludFinancieraSaldos.totalFondoCapital) < 0.05 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'} font-black`}>
                          <td className={`p-4 pl-4 text-[10px] sm:text-[11px] text-right uppercase tracking-widest`} colSpan={3}>
                            Comprobación (Total - Fondo Capital = 0)
                          </td>
                          <td className={`p-4 text-right pr-4 font-mono text-[14px]`}>
                            ${formatoES(Math.abs(saludFinancieraSaldos.disponibleDespuesPasivos - saludFinancieraSaldos.totalApartados - saludFinancieraSaldos.totalUtilidades - saludFinancieraSaldos.totalFondoCapital))}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
      
      {/* Centralized Premium Print Preview Modal */}
      <PrintPreview
        isOpen={printModalOpen}
        onClose={() => {
          setPrintModalOpen(false);
          setPrintModalContent(null);
        }}
        title={printModalTitle}
        defaultOrientation={printModalOrientation}
      >
        {printModalContent}
      </PrintPreview>

      {/* Modal para configurar los Responsables de Firma */}
      {showSignaturesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all no-print animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
                  <Edit className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="font-black text-slate-800 text-xs sm:text-sm">Responsables de Firma</h4>
                  <p className="text-[10px] text-slate-400">Modifica los nombres que aparecen al pie de los reportes</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSignaturesModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSignatures} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Preparado Por (Contador)
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium bg-slate-50/50 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={localPreparador}
                  onChange={(e) => setLocalPreparador(e.target.value)}
                  placeholder="Ej: Lic. María Delgado (Contador)"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Revisado Por (Auditor / Controller)
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium bg-slate-50/50 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={localRevisor}
                  onChange={(e) => setLocalRevisor(e.target.value)}
                  placeholder="Ej: Ing. Javier Espinoza (Auditor)"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Aprobado Por (Dirección / Gerencia)
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium bg-slate-50/50 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={localAprobador}
                  onChange={(e) => setLocalAprobador(e.target.value)}
                  placeholder="Ej: Sr(a). Director Ejecutivo"
                />
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSignaturesModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingSignatures}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  {isSavingSignatures ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal flotante de configuración de Balance General */}
      <BalanceGeneralParamsModal
        isOpen={isBalanceModalOpen}
        onClose={() => setIsBalanceModalOpen(false)}
        empresa={empresa}
        configContable={configContable}
        endDate={endDate}
        setEndDate={setEndDate}
        comprobantes={comprobantes}
        cuentasContables={cuentasContables}
        estadoResultados={estadoResultados}
      />

      {/* Modal flotante de Estado de Resultados (P&L) */}
      <EstadoResultadosParamsModal
        isOpen={isEstadoResultadosModalOpen}
        onClose={() => setIsEstadoResultadosModalOpen(false)}
        empresa={empresa}
        configContable={configContable}
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        comprobantes={comprobantes}
        cuentasContables={cuentasContables}
      />

      {/* Modal flotante de Balance de Comprobación */}
      <BalanceComprobacionParamsModal
        isOpen={isBalanceComprobacionModalOpen}
        onClose={() => setIsBalanceComprobacionModalOpen(false)}
        empresa={empresa}
        configContable={configContable}
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        comprobantes={comprobantes}
        cuentasContables={cuentasContables}
      />

      {/* Modal flotante de Libro Mayor Analítico */}
      <LibroMayorParamsModal
        isOpen={isLibroMayorModalOpen}
        onClose={() => setIsLibroMayorModalOpen(false)}
        empresa={empresa}
        configContable={configContable}
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        comprobantes={comprobantes}
        cuentasContables={cuentasContables}
      />

      {/* Modal flotante de Libro Diario de Asientos */}
      <LibroDiarioParamsModal
        isOpen={isLibroDiarioModalOpen}
        onClose={() => setIsLibroDiarioModalOpen(false)}
        empresa={empresa}
        configContable={configContable}
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        comprobantes={comprobantes}
        cuentasContables={cuentasContables}
      />
    </div>
  );
}
