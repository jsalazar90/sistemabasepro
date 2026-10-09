import { formatNumber } from '../utils/numberFormat';
import { getTasaForDate } from '../services/exchangeRateService';
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  Users, Building, Briefcase, UserCircle, PhoneCall, Search, Filter, Download, Plus, 
  ArrowRight, ArrowLeft, Landmark, FileText, CheckCircle, ShoppingCart, X, Save, 
  CornerDownRight, Package, Trash2, ChevronDown, Eye, EyeOff, Handshake, 
  UserCheck, Percent, Clock, AlertTriangle, ShieldCheck, Mail, Phone, ExternalLink, 
  DollarSign, ArrowDownLeft, FileSpreadsheet, Send, BarChart2, Coins, RotateCcw, 
  MessageSquare, Calendar, Printer, Lock, TrendingUp, ChevronRight, MoreVertical, CreditCard } from 'lucide-react';
import CuentaContableModal from '../components/common/CuentaContableModal';
import VoucherPreviewModal from '../components/common/VoucherPreviewModal';
import { PrintPreview } from '../components/PrintPreview';
import { dbResetAllTestData, dbFetchTerminalesPos, dbRegistrarAbonoCxpAtomico, isUUID } from '../services/db';
import { TerminalPosModel } from '../types/database';
import { useCompany } from '../context/CompanyContext';
import MasterAuthModal from '../components/common/MasterAuthModal';
import BackButton from '../components/common/BackButton';

const getCleanDocNumber = (itemOrDoc: any, fallback?: string): string => {
  if (!itemOrDoc) {
    if (fallback && isUUID(fallback)) {
      return `DOC-${fallback.slice(0, 8).toUpperCase()}`;
    }
    return fallback || '-';
  }
  const cleanFac = (itemOrDoc.factura && !isUUID(itemOrDoc.factura)) ? itemOrDoc.factura
    : (itemOrDoc.numero && !isUUID(itemOrDoc.numero)) ? itemOrDoc.numero
    : (itemOrDoc.factura_numero && !isUUID(itemOrDoc.factura_numero)) ? itemOrDoc.factura_numero
    : null;
  if (cleanFac) return cleanFac;

  const desc = itemOrDoc.descripcion || itemOrDoc.concepto || '';
  const matchFac = desc.match(/(?:Fact(?:ura)?(?:\s+de\s+Compra)?|Fact\.?|Doc\.?|Documento)\s*[:#.]?\s*([A-Za-z0-9\-_]+)/i);
  if (matchFac && matchFac[1]) return matchFac[1];

  if (itemOrDoc.factura_id && !isUUID(itemOrDoc.factura_id)) return itemOrDoc.factura_id;
  if (itemOrDoc.referencia && !isUUID(itemOrDoc.referencia)) return itemOrDoc.referencia;

  const raw = itemOrDoc.factura_id || itemOrDoc.id || fallback || '';
  if (isUUID(raw)) {
    return `DOC-${raw.slice(0, 8).toUpperCase()}`;
  }
  return raw || '-';
};


export default function Payables({ cxc = [], cxp = [], facturasCompra = [], pagosRealizados = [], comprobantes = [], bancos = [], movimientosBancos = [], proveedores = [], contactos = [], cuentasContables = [], configContable, onSave, showToast, workingYear }: { cxc?: any[], cxp?: any[], facturasCompra?: any[], pagosRealizados?: any[], comprobantes?: any[], bancos?: any[], movimientosBancos?: any[], proveedores?: any[], contactos?: any[], cuentasContables?: any[], configContable?: any, onSave?: any, showToast?: any, workingYear?: string }) {
  const { activeCompanyId } = useCompany();
  const { category } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(category || 'proveedores');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [hideZeroBalances, setHideZeroBalances] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'CON_DEUDA' | 'EN_MORA' | 'AL_DIA' | 'A_FAVOR' | 'SOLVENTES' | 'TODOS'>('CON_DEUDA');
  const [showExtraActionsMenu, setShowExtraActionsMenu] = useState<boolean>(false);
  const [currentTasa, setCurrentTasa] = useState<number>(() => getTasaForDate());
  const [mainTablePage, setMainTablePage] = useState(1);
  const MAIN_TABLE_ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentTasa(getTasaForDate());
  }, []);

  useEffect(() => {
    setMainTablePage(1);
  }, [activeTab, searchTerm, hideZeroBalances, statusFilter]);

  // Reintegro modal state
  const [showReintegroModal, setShowReintegroModal] = useState(false);
  const [reintegroForm, setReintegroForm] = useState({
    bancoId: '',
    fecha: new Date().toISOString().split('T')[0],
    referencia: '',
    monto: '',
    notas: 'Reintegro de saldo a favor / anticipo no utilizado'
  });

  // Modal de Autorización Master para Eliminar / Anular
  const [masterAuth, setMasterAuth] = useState<{
    isOpen: boolean;
    title?: string;
    actionName?: string;
    actionDetails?: string;
    onSuccess: () => void | Promise<void>;
  }>({
    isOpen: false,
    onSuccess: () => {}
  });

  // Preview contabilidad state
  const [pendingVoucher, setPendingVoucher] = useState<{
    comprobante: any;
    movimiento: any;
    onConfirm: (finalComprobante: any) => Promise<void>;
  } | null>(null);

  // Sync activeTab with URL category
  useEffect(() => {
    if (category) {
      setActiveTab(category);
    }
  }, [category]);

  const [terminalesPos, setTerminalesPos] = useState<TerminalPosModel[]>([]);

  useEffect(() => {
    dbFetchTerminalesPos().then(setTerminalesPos).catch(console.error);
  }, []);

  // Estado para el módulo de pago
  const [pagoForm, setPagoForm] = useState({
    bancoId: '',
    referencia: '',
    fecha: new Date().toISOString().split('T')[0],
    tasa: 1,
    tasaReferencial: '',
    proveedorId: '',
    pagos: [] as Array<{
      id: string;
      bancoId: string;
      metodo?: string;
      terminalId?: string;
      referencia: string;
      monto: string;
      montoBs: string;
    }>
  });

  // Estado para Historial de Pagos Realizados
  const [selectedPago, setSelectedPago] = useState<any | null>(null);
  const [historialPage, setHistorialPage] = useState(1);
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialDateRange, setHistorialDateRange] = useState({
    desde: '',
    hasta: ''
  });
  const [isPagoSupplierModalOpen, setIsPagoSupplierModalOpen] = useState(false);
  const [pagoSupplierSearchTerm, setPagoSupplierSearchTerm] = useState('');
  const [abonos, setAbonos] = useState<Record<string, string>>({});
  const [anticipoGlobal, setAnticipoGlobal] = useState<string>('');
  const [entityFilters, setEntityFilters] = useState({
    proveedores: true,
    aliados: true,
    intercompanias: true,
    accionistas: true,
    empleados: true
  });

  // Estado para el modal de nuevo préstamo (Cuentas por pagar accionistas / intercompañías / terceros)
  const [showNewModal, setShowNewModal] = useState(false);
  const [newMovForm, setNewMovForm] = useState({
    bancoId: '',
    fecha: new Date().toISOString().split('T')[0],
    fechaVencimiento: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    referencia: '',
    descripcion: '',
    monto: '',
    entidad: '',
    entidad_id: '',
    categoria: 'accionistas',
    tasa: '',
    montoBs: ''
  });

  const handleOpenNewLoanModal = (categoriaDefault?: string) => {
    const cat = (categoriaDefault === 'intercompanias' || activeTab === 'intercompanias') 
      ? 'intercompanias' 
      : 'accionistas';
    const today = new Date().toISOString().split('T')[0];
    const due = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const nowTs = Date.now().toString();
    setNewMovForm({
      bancoId: bancos[0]?.id || '',
      fecha: today,
      fechaVencimiento: due,
      referencia: `PREST-${nowTs.slice(-4)}`,
      descripcion: cat === 'intercompanias' ? 'Préstamo recibido de intercompañía para financiamiento' : 'Préstamo recibido de accionista para financiamiento',
      monto: '',
      entidad: '',
      entidad_id: '',
      categoria: cat,
      tasa: (currentTasa || getTasaForDate() || 1).toString(),
      montoBs: ''
    });
    setShowNewModal(true);
  };

  // Estado para el modal de Anticipo
  const [showAnticipoModal, setShowAnticipoModal] = useState(false);
  const [isAnticipoSupplierModalOpen, setIsAnticipoSupplierModalOpen] = useState(false);
  const [anticipoSupplierSearchTerm, setAnticipoSupplierSearchTerm] = useState('');
  const [anticipoForm, setAnticipoForm] = useState({
    proveedor: '',
    proveedor_id: '',
    bancoId: '',
    fecha: new Date().toISOString().split('T')[0],
    referencia: '',
    descripcion: 'Anticipo a proveedor',
    monto: '',
    tasa: '',
    montoBs: ''
  });

  // Estado para el modal de Provisión
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [isProvisionSupplierModalOpen, setIsProvisionSupplierModalOpen] = useState(false);
  const [provisionSupplierSearchTerm, setProvisionSupplierSearchTerm] = useState('');
  const [provisionForm, setProvisionForm] = useState({
    proveedor: '',
    proveedor_id: '',
    fecha: new Date().toISOString().split('T')[0],
    descripcion: 'Provisión',
    monto: '',
    cuentaGasto: ''
  });

  // Estado para el modal de Saldo Inicial (CXP)
  const [showSaldoInicialModal, setShowSaldoInicialModal] = useState(false);
  const [isSaldoInicialSupplierModalOpen, setIsSaldoInicialSupplierModalOpen] = useState(false);
  const [saldoInicialSupplierSearchTerm, setSaldoInicialSupplierSearchTerm] = useState('');
  const [saldoInicialForm, setSaldoInicialForm] = useState({
    contacto: '',
    contacto_id: '',
    factura_id: '',
    fecha: new Date().toISOString().split('T')[0],
    vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: 'Saldo Inicial de CxP',
    monto: '',
    moneda: 'Dólares (USD)',
    tasa: '1.00',
    cuentaContrapartida: ''
  });

  const [showCuentaModal, setShowCuentaModal] = useState(false);
  const [cuentaSearchTerm, setCuentaSearchTerm] = useState('');
  
  const cuentasMovimiento = useMemo(() => {
    return cuentasContables.filter(c => c.tipo === 'Movimiento').sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
  }, [cuentasContables]);

  const selectedAnticipoBanco = useMemo(() => bancos.find(b => b.id === anticipoForm.bancoId), [bancos, anticipoForm.bancoId]);
  const isAnticipoVES = selectedAnticipoBanco?.moneda === 'VES' || selectedAnticipoBanco?.moneda === 'Bs' || selectedAnticipoBanco?.moneda === 'Bs.' || selectedAnticipoBanco?.moneda === 'Bolivares';

  const selectedNewMovBanco = useMemo(() => bancos.find(b => b.id === newMovForm.bancoId), [bancos, newMovForm.bancoId]);
  const isNewMovVES = selectedNewMovBanco?.moneda === 'VES' || selectedNewMovBanco?.moneda === 'Bs' || selectedNewMovBanco?.moneda === 'Bs.' || selectedNewMovBanco?.moneda === 'Bolivares' || selectedNewMovBanco?.moneda === 'Bolívares';

  const [isNewMovSupplierModalOpen, setIsNewMovSupplierModalOpen] = useState(false);
  const [newMovSupplierSearchTerm, setNewMovSupplierSearchTerm] = useState('');

  const filteredNewMovEntities = useMemo(() => {
    const term = (newMovSupplierSearchTerm || '').toLowerCase().trim();
    const targetCat = newMovForm.categoria || 'accionistas';

    return contactos.filter(c => {
      let isMatch = false;
      const cType = (c.type || '').toLowerCase();
      const cCat = (c.categoria || '').toLowerCase();
      const cCargo = ((c as any).cargo || '').toLowerCase();

      if (targetCat === 'intercompanias') {
        isMatch = cType === 'intercompany' || 
                  cType === 'intercompanias' || 
                  cType === 'intercompañia' || 
                  cType === 'intercompañías' || 
                  cCat.includes('intercompa') ||
                  cCargo.includes('intercompa');
      } else {
        // accionistas por defecto
        isMatch = cType === 'shareholder' || 
                  cType === 'accionistas' || 
                  cType === 'accionista' || 
                  cCat.includes('accion') ||
                  cCargo.includes('accion') ||
                  cCargo.includes('socio');
      }

      if (!isMatch) return false;

      if (!term) return true;
      const taxId = (c.taxId || c.identificacion || '').toLowerCase();
      const name = (c.name || c.nombre || '').toLowerCase();
      return taxId.includes(term) || name.includes(term);
    });
  }, [contactos, newMovSupplierSearchTerm, newMovForm.categoria]);

  const filteredProvisionEntities = useMemo(() => {
    const term = (provisionSupplierSearchTerm || '').toLowerCase();
    
    return contactos.filter(c => {
      let isMatch = false;
      switch(activeTab) {
         case 'freelance':
           isMatch = c.type === 'freelance' || c.type === 'customs_agency';
           break;
         case 'accionistas': 
           isMatch = c.type === 'shareholder';
           break;
         case 'aliados':
           isMatch = ['customs_agency', 'aliado', 'freelance', 'supplier', 'both'].includes(c.type);
           break;
         case 'empleados': 
           isMatch = c.type === 'employee';
           break;
         default: 
           isMatch = ['supplier', 'both', 'freelance', 'customs_agency', 'aliado', 'intercompany', 'shareholder', 'employee'].includes(c.type);
      }
      return isMatch && ((c.taxId || '').toLowerCase().includes(term) || (c.name || '').toLowerCase().includes(term));
    });
  }, [contactos, provisionSupplierSearchTerm, activeTab]);

  const filteredAnticipoEntities = useMemo(() => {
    const term = (anticipoSupplierSearchTerm || '').toLowerCase();
    
    return contactos.filter(c => {
      let isMatch = false;
      switch(activeTab) {
         case 'freelance':
           isMatch = c.type === 'freelance' || c.type === 'customs_agency';
           break;
         case 'proveedores':
         case 'pago':
           isMatch = ['supplier', 'both'].includes(c.type);
           break;
         case 'aliados':
           isMatch = ['customs_agency', 'aliado', 'freelance', 'supplier', 'both'].includes(c.type);
           break;
         case 'empleados': 
           isMatch = c.type === 'employee';
           break;
         case 'intercompanias': 
           isMatch = c.type === 'intercompany';
           break;
         case 'accionistas': 
           isMatch = c.type === 'shareholder';
           break;
         default: 
           isMatch = ['supplier', 'both', 'freelance', 'customs_agency', 'aliado', 'intercompany', 'shareholder', 'employee'].includes(c.type);
      }
      return isMatch && ((c.taxId || '').toLowerCase().includes(term) || (c.name || '').toLowerCase().includes(term));
    });
  }, [contactos, anticipoSupplierSearchTerm, activeTab]);

  const filteredSaldoInicialSupplierEntities = useMemo(() => {
    const term = (saldoInicialSupplierSearchTerm || '').toLowerCase();
    
    return contactos.filter(c => {
      let isMatch = false;
      switch(activeTab) {
         case 'freelance':
           isMatch = c.type === 'freelance' || c.type === 'customs_agency';
           break;
         case 'proveedores':
         case 'pago':
           isMatch = ['supplier', 'both'].includes(c.type);
           break;
         case 'aliados':
           isMatch = ['customs_agency', 'aliado', 'freelance', 'supplier', 'both'].includes(c.type);
           break;
         case 'empleados': 
           isMatch = c.type === 'employee';
           break;
         case 'intercompanias': 
           isMatch = c.type === 'intercompany';
           break;
         case 'accionistas': 
           isMatch = c.type === 'shareholder';
           break;
         default: 
           isMatch = ['supplier', 'both', 'freelance', 'customs_agency', 'aliado', 'intercompany', 'shareholder', 'employee'].includes(c.type);
      }
      return isMatch && ((c.taxId || '').toLowerCase().includes(term) || (c.name || '').toLowerCase().includes(term));
    });
  }, [contactos, saldoInicialSupplierSearchTerm, activeTab]);

  const currentYear = new Date().getFullYear();
  const [filtrosHistorial, setFiltrosHistorial] = useState({ 
    tipo: 'mes', 
    mes: String(new Date().getMonth() + 1).padStart(2, '0'), 
    ano: String(currentYear), 
    desde: '', 
    hasta: '' 
  });

  const tabs = [
    { id: 'proveedores', label: 'Proveedores', icon: Users },
    { id: 'intercompanias', label: 'Intercompañías', icon: Building },
    { id: 'accionistas', label: 'Accionistas', icon: UserCircle },
    { id: 'pago', label: 'Módulo Pago', icon: PhoneCall },
    { id: 'historial-pagos', label: 'Historial Pagos', icon: FileText },
  ];

  const formatoES = (num: number | string) => {
    const n = Number(num);
    if (isNaN(n) || num === null) return "0,00";
    let str = n.toFixed(2);
    let parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.join(',');
  };

  // Filter data based on tab
  const tabData = useMemo(() => {
    return cxp.filter(item => {
      const cat = item.categoria || 'proveedores';
      if (activeTab === 'pago') return true;
      if (activeTab === 'aliados') return cat === 'aliados' || cat === 'aliado';
      if (activeTab === 'proveedores') return cat === 'proveedores' || cat === 'servicios';
      return cat === activeTab;
    });
  }, [cxp, activeTab]);

  // Group data by supplier for the main table
  const allGroupedData = useMemo(() => {
    if (activeTab === 'pago') return [];
    
    const groups: Record<string, any> = {};
    const todayTs = new Date().setHours(0, 0, 0, 0);
    
    tabData.forEach(item => {
      const contactObj = contactos.find(c => 
        (item.proveedor_id && (c.id === item.proveedor_id || c.taxId === item.proveedor_id)) ||
        (item.proveedor && c.name?.toLowerCase() === item.proveedor.toLowerCase())
      );
      
      const key = contactObj?.taxId || contactObj?.id || item.proveedor_id || item.proveedor;
      
      if (!groups[key]) {
        groups[key] = {
          id: key,
          proveedor: item.proveedor || contactObj?.name || 'Proveedor sin nombre',
          rif: contactObj?.taxId || item.proveedor_rif || item.taxId || (String(key).startsWith('J-') || String(key).startsWith('V-') || String(key).startsWith('G-') || String(key).startsWith('E-') ? key : ''),
          telefono: contactObj?.phone || '',
          montoAdeudo: 0,
          abonosAplicados: 0,
          saldoPendiente: 0,
          hasOverdue: false,
          moraDays: 0,
          status: 'AL_DIA',
          documentos: []
        };
      }
      
      const total = Number(item.total) || 0;
      if (total > 0) {
        groups[key].montoAdeudo += total;
      }
      
      groups[key].documentos.push(item);
    });

    Object.values(groups).forEach(g => {
      const supplierIdStr = String(g.id).trim();
      const supplierNameLower = (g.proveedor || '').toLowerCase();
      
      // 1. Pagos realizados activos
      const activePagos = (pagosRealizados || []).filter((p: any) => {
        if (p.estado === 'anulado') return false;
        if (p.proveedorId && String(p.proveedorId) === supplierIdStr) return true;
        if (p.proveedorNombre && p.proveedorNombre.toLowerCase() === supplierNameLower) return true;
        return false;
      });
      
      const totalPagadoEnPagosRealizados = activePagos.reduce((sum: number, p: any) => sum + (Number(p.monto) || 0), 0);
      
      // 2. Pagos en documentos
      const pagosEnDocs = g.documentos.reduce((sum: number, d: any) => {
        const totalDoc = Number(d.total) || 0;
        const saldoDoc = Number(d.saldo) || 0;
        if (totalDoc > 0) {
          const paid = totalDoc - saldoDoc;
          return sum + (paid > 0 ? paid : 0);
        }
        return sum;
      }, 0);
      
      // 3. Anticipos no utilizados
      const totalAnticiposUnused = g.documentos.reduce((sum: number, d: any) => {
        const t = Number(d.total) || 0;
        const s = Number(d.saldo) || 0;
        return sum + (t < 0 ? Math.abs(s) : 0);
      }, 0);
      
      const remainingDebt = Math.max(0, g.montoAdeudo - pagosEnDocs);
      g.saldoPendiente = remainingDebt - totalAnticiposUnused;
      g.abonosAplicados = (g.montoAdeudo - remainingDebt) + totalAnticiposUnused;
      
      // Detectar si tiene facturas vencidas en mora
      let hasOverdue = false;
      let maxMora = 0;
      g.documentos.forEach((d: any) => {
        const saldoVal = Number(d.saldo !== undefined ? d.saldo : d.total) || 0;
        if (saldoVal > 0.01 && d.estado !== 'anulada' && d.tipo !== 'anticipo') {
          const vDate = d.vencimiento ? new Date(d.vencimiento).getTime() : (d.fecha ? new Date(d.fecha).getTime() : todayTs);
          const diffDays = Math.floor((todayTs - vDate) / (1000 * 60 * 60 * 24));
          if (diffDays > 0) {
            hasOverdue = true;
            if (diffDays > maxMora) maxMora = diffDays;
          }
        }
      });
      g.hasOverdue = hasOverdue;
      g.moraDays = maxMora;
      
      if (g.saldoPendiente < -0.01) {
        g.status = 'A_FAVOR';
      } else if (g.saldoPendiente <= 0.01) {
        g.status = 'SOLVENTE';
      } else if (g.hasOverdue) {
        g.status = 'EN_MORA';
      } else {
        g.status = 'AL_DIA';
      }
      
      g.documentos.sort((a: any, b: any) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
    });

    return Object.values(groups);
  }, [tabData, activeTab, contactos, pagosRealizados]);

  // Executive KPI summary calculations across active tab
  const kpiStats = useMemo(() => {
    let totalExigible = 0;
    let totalCobrado = 0;
    let totalFacturado = 0;
    let totalEnMora = 0;
    let countConDeuda = 0;
    let countEnMora = 0;
    let countAFavor = 0;
    let countAlDia = 0;

    allGroupedData.forEach((g: any) => {
      totalFacturado += g.montoAdeudo;
      totalCobrado += g.abonosAplicados;
      if (g.saldoPendiente > 0.01) {
        totalExigible += g.saldoPendiente;
        countConDeuda++;
        if (g.hasOverdue) {
          totalEnMora += g.saldoPendiente;
          countEnMora++;
        } else {
          countAlDia++;
        }
      } else if (g.saldoPendiente < -0.01) {
        countAFavor++;
      }
    });

    const countSolventes = allGroupedData.length - countConDeuda - countAFavor;
    return {
      totalExigible,
      totalCobrado,
      totalFacturado,
      totalEnMora,
      countConDeuda,
      countEnMora,
      countAFavor,
      countAlDia,
      countSolventes: Math.max(0, countSolventes),
      totalEntidades: allGroupedData.length
    };
  }, [allGroupedData]);

  // Filtered dataset according to search and status pills
  const groupedData = useMemo(() => {
    let result = [...allGroupedData];

    if (searchTerm.trim() !== '') {
      const st = searchTerm.trim().toLowerCase();
      result = result.filter((g: any) => {
        const nameMatch = (g.proveedor?.toLowerCase() || '').includes(st);
        const idMatch = (String(g.id)?.toLowerCase() || '').includes(st);
        const rifMatch = (String(g.rif)?.toLowerCase() || '').includes(st);
        return nameMatch || idMatch || rifMatch;
      });
    }

    if (statusFilter === 'CON_DEUDA') {
      result = result.filter((g: any) => g.saldoPendiente > 0.01);
    } else if (statusFilter === 'EN_MORA') {
      result = result.filter((g: any) => g.status === 'EN_MORA');
    } else if (statusFilter === 'AL_DIA') {
      result = result.filter((g: any) => g.status === 'AL_DIA');
    } else if (statusFilter === 'A_FAVOR') {
      result = result.filter((g: any) => g.status === 'A_FAVOR');
    } else if (statusFilter === 'SOLVENTES') {
      result = result.filter((g: any) => g.status === 'SOLVENTE');
    }

    return result.sort((a: any, b: any) => b.saldoPendiente - a.saldoPendiente);
  }, [allGroupedData, searchTerm, statusFilter]);

  const totalMainPages = Math.ceil(groupedData.length / MAIN_TABLE_ITEMS_PER_PAGE) || 1;
  const paginatedGroupedData = useMemo(() => {
    const start = (mainTablePage - 1) * MAIN_TABLE_ITEMS_PER_PAGE;
    return groupedData.slice(start, start + MAIN_TABLE_ITEMS_PER_PAGE);
  }, [groupedData, mainTablePage]);

  // Calculate totals for the active tab (grouped)
  const totals = useMemo(() => {
    return groupedData.reduce((acc: any, curr: any) => {
      acc.montoAdeudo += curr.montoAdeudo;
      acc.abonosAplicados += curr.abonosAplicados;
      acc.saldoPendiente += curr.saldoPendiente;
      return acc;
    }, { montoAdeudo: 0, abonosAplicados: 0, saldoPendiente: 0 });
  }, [groupedData]);

  // Synchronized selected supplier from the fresh groupedData list
  const currentSupplier = useMemo(() => {
    if (!selectedSupplier) return null;
    return allGroupedData.find((g: any) => g.id === selectedSupplier.id) || selectedSupplier;
  }, [allGroupedData, selectedSupplier]);

  // --- LÓGICA MÓDULO PAGO ---
  const suppliersWithDebt = useMemo(() => {
    const suppliersMap = new Map();
    cxp.forEach(item => {
      if (Number(item.saldo) > 0) {
        const cat = item.categoria || 'proveedores';
        
        // Find contact early to get accurate keys
        const contactObj = contactos.find(c => 
          (item.proveedor_id && (c.id === item.proveedor_id || c.taxId === item.proveedor_id)) ||
          (item.proveedor && c.name?.toLowerCase() === item.proveedor.toLowerCase())
        );
        const key = contactObj?.taxId || contactObj?.id || item.proveedor_id || item.proveedor;

        const isCurrentlySelected = pagoForm.proveedorId && (String(key) === String(pagoForm.proveedorId) || String(item.proveedor_id) === String(pagoForm.proveedorId));
        
        const filterKey = (cat === 'aliado' ? 'aliados' : cat) as keyof typeof entityFilters;
        const passFilter = (entityFilters[filterKey] !== undefined ? entityFilters[filterKey] : true) || isCurrentlySelected;

        if (passFilter) {
          if (!suppliersMap.has(key)) {
            suppliersMap.set(key, {
              id: key,
              nombre: item.proveedor || contactObj?.name,
              categoria: cat
            });
          }
        }
      }
    });
    return Array.from(suppliersMap.values()).sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [cxp, entityFilters, contactos, pagoForm.proveedorId]);

  const filteredPagoSuppliersWithDebt = useMemo(() => {
    const term = (pagoSupplierSearchTerm || '').toLowerCase().trim();
    return suppliersWithDebt.filter(s => 
      (s.nombre || '').toLowerCase().includes(term) ||
      (s.categoria || '').toLowerCase().includes(term) ||
      (String(s.id) || '').toLowerCase().includes(term)
    );
  }, [suppliersWithDebt, pagoSupplierSearchTerm]);

  const selectedSupplierObj = useMemo(() => {
    if (!pagoForm.proveedorId) return null;
    return suppliersWithDebt.find(s => s.id === pagoForm.proveedorId) || null;
  }, [suppliersWithDebt, pagoForm.proveedorId]);

  const selectedSupplierDebts = useMemo(() => {
    if (!pagoForm.proveedorId) return [];

    const targetIdStr = String(pagoForm.proveedorId).toLowerCase().trim();
    const supplierNameLow = (selectedSupplierObj?.nombre || '').toLowerCase().trim();

    // Encontrar contacto asociado a este proveedor
    const contactObj = contactos.find(c => {
      const cId = String(c.id || '').toLowerCase().trim();
      const cTax = String(c.taxId || c.identificacion || '').toLowerCase().trim();
      const cName = String(c.name || c.nombre || '').toLowerCase().trim();
      return (cId && cId === targetIdStr) || 
             (cTax && cTax === targetIdStr) || 
             (supplierNameLow && cName === supplierNameLow);
    });

    const validIds = new Set<string>();
    validIds.add(targetIdStr);
    if (contactObj) {
      if (contactObj.id) validIds.add(String(contactObj.id).toLowerCase().trim());
      if (contactObj.taxId) validIds.add(String(contactObj.taxId).toLowerCase().trim());
      if (contactObj.identificacion) validIds.add(String(contactObj.identificacion).toLowerCase().trim());
    }

    const effectiveTargetName = (contactObj?.name || contactObj?.nombre || selectedSupplierObj?.nombre || '').toLowerCase().trim();

    return cxp.filter(item => {
      const saldo = Number(item.saldo !== undefined ? item.saldo : item.total) || 0;
      if (saldo <= 0.009) return false;

      // 1. Coincidencia por ID de proveedor o RIF en el item
      const itemProvId = String(item.proveedor_id || '').toLowerCase().trim();
      if (itemProvId && validIds.has(itemProvId)) return true;

      const itemTaxId = String(item.taxId || item.proveedor_rif || '').toLowerCase().trim();
      if (itemTaxId && validIds.has(itemTaxId)) return true;

      // 2. Coincidencia mediante búsqueda de contacto del item
      const itemContact = contactos.find(c => {
        const cId = String(c.id || '').toLowerCase().trim();
        const cTax = String(c.taxId || c.identificacion || '').toLowerCase().trim();
        const cName = String(c.name || c.nombre || '').toLowerCase().trim();
        const itemProvStr = String(item.proveedor || item.proveedor_nombre || '').toLowerCase().trim();

        return (itemProvId && (cId === itemProvId || cTax === itemProvId)) ||
               (itemTaxId && (cId === itemTaxId || cTax === itemTaxId)) ||
               (itemProvStr && cName === itemProvStr);
      });

      if (itemContact) {
        const cId = String(itemContact.id || '').toLowerCase().trim();
        const cTax = String(itemContact.taxId || itemContact.identificacion || '').toLowerCase().trim();
        const cName = String(itemContact.name || itemContact.nombre || '').toLowerCase().trim();

        if (cId && validIds.has(cId)) return true;
        if (cTax && validIds.has(cTax)) return true;
        if (effectiveTargetName && cName === effectiveTargetName) return true;
      }

      // 3. Coincidencia directa o parcial por nombre del proveedor
      const itemProvName = String(item.proveedor || item.proveedor_nombre || '').toLowerCase().trim();
      if (effectiveTargetName && itemProvName) {
        if (itemProvName === effectiveTargetName || itemProvName.includes(effectiveTargetName) || effectiveTargetName.includes(itemProvName)) {
          return true;
        }
      }

      return false;
    }).sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
  }, [cxp, pagoForm.proveedorId, selectedSupplierObj, contactos]);

  const selectedSupplierAnticipos = useMemo(() => {
    if (!pagoForm.proveedorId) return [];

    const targetIdStr = String(pagoForm.proveedorId).toLowerCase().trim();
    const supplierNameLow = (selectedSupplierObj?.nombre || '').toLowerCase().trim();

    const contactObj = contactos.find(c => {
      const cId = String(c.id || '').toLowerCase().trim();
      const cTax = String(c.taxId || c.identificacion || '').toLowerCase().trim();
      const cName = String(c.name || c.nombre || '').toLowerCase().trim();
      return (cId && cId === targetIdStr) || 
             (cTax && cTax === targetIdStr) || 
             (supplierNameLow && cName === supplierNameLow);
    });

    const validIds = new Set<string>();
    validIds.add(targetIdStr);
    if (contactObj) {
      if (contactObj.id) validIds.add(String(contactObj.id).toLowerCase().trim());
      if (contactObj.taxId) validIds.add(String(contactObj.taxId).toLowerCase().trim());
      if (contactObj.identificacion) validIds.add(String(contactObj.identificacion).toLowerCase().trim());
    }

    const effectiveTargetName = (contactObj?.name || contactObj?.nombre || selectedSupplierObj?.nombre || '').toLowerCase().trim();

    return cxp.filter(item => {
      const saldo = Number(item.saldo !== undefined ? item.saldo : item.total) || 0;
      if (saldo >= -0.009) return false;

      // 1. Coincidencia por ID de proveedor o RIF en el item
      const itemProvId = String(item.proveedor_id || '').toLowerCase().trim();
      if (itemProvId && validIds.has(itemProvId)) return true;

      const itemTaxId = String(item.taxId || item.proveedor_rif || '').toLowerCase().trim();
      if (itemTaxId && validIds.has(itemTaxId)) return true;

      // 2. Coincidencia mediante búsqueda de contacto del item
      const itemContact = contactos.find(c => {
        const cId = String(c.id || '').toLowerCase().trim();
        const cTax = String(c.taxId || c.identificacion || '').toLowerCase().trim();
        const cName = String(c.name || c.nombre || '').toLowerCase().trim();
        const itemProvStr = String(item.proveedor || item.proveedor_nombre || '').toLowerCase().trim();

        return (itemProvId && (cId === itemProvId || cTax === itemProvId)) ||
               (itemTaxId && (cId === itemTaxId || cTax === itemTaxId)) ||
               (itemProvStr && cName === itemProvStr);
      });

      if (itemContact) {
        const cId = String(itemContact.id || '').toLowerCase().trim();
        const cTax = String(itemContact.taxId || itemContact.identificacion || '').toLowerCase().trim();
        const cName = String(itemContact.name || itemContact.nombre || '').toLowerCase().trim();

        if (cId && validIds.has(cId)) return true;
        if (cTax && validIds.has(cTax)) return true;
        if (effectiveTargetName && cName === effectiveTargetName) return true;
      }

      // 3. Coincidencia directa o parcial por nombre del proveedor
      const itemProvName = String(item.proveedor || item.proveedor_nombre || '').toLowerCase().trim();
      if (effectiveTargetName && itemProvName) {
        if (itemProvName === effectiveTargetName || itemProvName.includes(effectiveTargetName) || effectiveTargetName.includes(itemProvName)) {
          return true;
        }
      }

      return false;
    }).sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
  }, [cxp, pagoForm.proveedorId, selectedSupplierObj, contactos]);

  const totalAnticiposDisponibles = useMemo(() => {
    return selectedSupplierAnticipos.reduce((acc, item) => acc + Math.abs(Number(item.saldo)), 0);
  }, [selectedSupplierAnticipos]);

  useEffect(() => {
    if (pagoForm.proveedorId) {
      const stillExists = suppliersWithDebt.some(s => String(s.id) === String(pagoForm.proveedorId));
      if (!stillExists) {
        // Comment out this reset because it might be aggressively clearing the vendor during modal initialization
        // setPagoForm(prev => ({ ...prev, proveedorId: '' }));
        setAbonos({});
        setAnticipoGlobal('');
      }
    }
  }, [suppliersWithDebt, pagoForm.proveedorId]);

  const totalFacturasAplicadas = useMemo(() => {
    return Object.values(abonos).reduce((acc: number, val: string) => acc + (Number(val) || 0), 0);
  }, [abonos]);

  useEffect(() => {
    const numAnticipo = Number(anticipoGlobal) || 0;
    const maxAllowed = Math.min(totalFacturasAplicadas, totalAnticiposDisponibles);
    if (numAnticipo > maxAllowed) {
      setAnticipoGlobal(maxAllowed.toString());
    }
  }, [totalFacturasAplicadas, totalAnticiposDisponibles, anticipoGlobal]);

  const totalAnticiposAplicados = Number(anticipoGlobal) || 0;
  const montoBanco = totalFacturasAplicadas - totalAnticiposAplicados;
  const sumPagosDisplay = pagoForm.pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);

  const handleAbonoChange = (docId: string, value: string, maxSaldo: number) => {
    let numValue = Number(value);
    if (numValue < 0) numValue = 0;
    if (numValue > maxSaldo) numValue = maxSaldo;
    
    setAbonos(prev => ({
      ...prev,
      [docId]: value === '' ? '' : numValue.toString()
    }));
  };

  const handlePagarTotal = (docId: string, maxSaldo: number) => {
    setAbonos(prev => ({
      ...prev,
      [docId]: maxSaldo.toString()
    }));
  };

  const selectedBanco = useMemo(() => bancos.find(b => b.id === pagoForm.bancoId), [bancos, pagoForm.bancoId]);
  const isVES = selectedBanco?.moneda === 'VES' || selectedBanco?.moneda === 'Bs' || selectedBanco?.moneda === 'Bs.' || selectedBanco?.moneda === 'Bolivares';

  const getSapsLockDate = (bId: string) => {
    const sapsMovs = movimientosBancos.filter(m => String(m.banco_id) === String(bId) && (m.tipo === 'ajuste_ganancia' || m.tipo === 'ajuste_perdida') && m.estado !== 'anulado');
    if (sapsMovs.length === 0) return null;
    sapsMovs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    return sapsMovs[0].fecha;
  };

  const handleProcesarPago = async () => {
    if (workingYear && pagoForm.fecha) {
      const year = pagoForm.fecha.substring(0, 4);
      if (year !== workingYear) {
        showToast?.(`No se puede procesar el pago porque el año de la fecha seleccionada (${year}) no coincide con el período contable seleccionado (${workingYear}).`, 'error');
        return;
      }
    }

    if (totalFacturasAplicadas <= 0 && totalAnticiposAplicados <= 0) return showToast?.('Debe aplicar al menos un monto en las facturas', 'error');
    if (montoBanco < 0) return showToast?.('El total de anticipos aplicados no puede superar el total de facturas a pagar', 'error');

    const sumPagos = pagoForm.pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);

    if (montoBanco > 0) {
      const diffPagos = Number((sumPagos - montoBanco).toFixed(2));
      if (Math.abs(diffPagos) > 0.01) {
        if (diffPagos < 0) {
          return showToast?.(`El total de los métodos de pago ($ ${formatNumber(sumPagos)}) no cubre el monto neto por pagar ($ ${formatNumber(montoBanco)}). Faltan $ ${formatNumber(Math.abs(diffPagos))}.`, 'error');
        } else {
          return showToast?.(`El total en métodos de pago ($ ${formatNumber(sumPagos)}) excede el neto por pagar ($ ${formatNumber(montoBanco)}) por $ ${formatNumber(diffPagos)}. Los montos deben coincidir exactamente para mantener la partida doble contable.`, 'error');
        }
      }
      for (const p of pagoForm.pagos) {
        if (!p.bancoId) return showToast?.('Seleccione un banco o caja para todos los métodos de pago', 'error');
        if (!p.referencia) return showToast?.('Ingrese un número de referencia para todos los métodos de pago', 'error');
        if (!p.monto || Number(p.monto) <= 0) return showToast?.('Ingrese un monto válido mayor a 0 para todos los métodos de pago', 'error');

        const lockDate = getSapsLockDate(p.bancoId);
        if (lockDate && pagoForm.fecha <= lockDate) {
          return showToast?.(`Error: Existe un cierre SAPS en ${lockDate} para una de las cuentas seleccionadas.`, 'error');
        }
      }
    }

    try {
      const nowTs = Date.now().toString();

      // Obtener cuentas contables correspondientes
      const proveedorObj = proveedores.find(p => p.id === pagoForm.proveedorId);
      const contactObj = contactos.find(c => 
        c.id === pagoForm.proveedorId || 
        c.taxId === pagoForm.proveedorId || 
        c.name?.toLowerCase() === selectedSupplierObj?.nombre?.toLowerCase()
      );
      const isEmployeeOrFreelancer = contactObj?.type === 'employee';

      let cuentaEntidad = '2.1.1'; // Cuenta por Pagar Proveedores por defecto
      if (contactObj) {
        cuentaEntidad = contactObj.creditAccount || (isEmployeeOrFreelancer ? '2.1.3' : '2.1.1');
      } else if (proveedorObj) {
        cuentaEntidad = proveedorObj.cuenta_contable_id || '2.1.1';
      } else {
        cuentaEntidad = configContable?.cuentaCxp || '2.1.1';
      }

      const entidadNombre = contactObj?.name || proveedorObj?.nombre || selectedSupplierObj?.nombre || 'Proveedor';

      const draftMovs: any[] = [];
      const lineas: any[] = [];

      // 1. Débito a CxP por el total de facturas aplicadas
      if (totalFacturasAplicadas > 0) {
        lineas.push({
          id: `l1-${nowTs}`,
          cuentaId: cuentaEntidad,
          descripcion: `Pago de facturas a ${entidadNombre} - CxP`,
          debe: totalFacturasAplicadas,
          haber: 0
        });
      }

      // 2. Crédito a Anticipos si se usaron
      const cuentaAnticipo = configContable?.cuentaAnticipoOtorgado || '1.1.4';
      if (totalAnticiposAplicados > 0) {
        lineas.push({
          id: `l-ant-${nowTs}`,
          cuentaId: cuentaAnticipo,
          descripcion: `Aplicación de anticipo a favor - ${entidadNombre}`,
          debe: 0,
          haber: totalAnticiposAplicados
        });
      }

      // 3. Crear movimientos bancarios (egresos) y líneas contables por CADA método de pago
      const compId = crypto.randomUUID();
      for (const p of pagoForm.pagos) {
        const banco = bancos.find(b => b.id === p.bancoId);
        const cuentaBanco = banco?.cuenta_contable_id || '1.1.3';
        const montoNum = Number(p.monto);

        draftMovs.push({
          id: crypto.randomUUID(),
          empresa_id: activeCompanyId,
          banco_id: p.bancoId,
          fecha: pagoForm.fecha,
          ref: p.referencia,
          descripcion: `Pago a ${entidadNombre} (${banco?.banco || 'Banco'})`,
          tipo: 'egreso' as const,
          monto: montoNum,
          montoBs: p.montoBs ? Number(p.montoBs) : Number((montoNum * (pagoForm.tasa || 1)).toFixed(2)),
          tasa: pagoForm.tasa || 1,
          estado: 'activo',
          comprobante_id: compId,
          cuenta_contable_id: cuentaEntidad
        });

        lineas.push({
          id: `l-banco-${nowTs}-${Math.random().toString(36).substring(2, 7)}`,
          cuentaId: cuentaBanco,
          descripcion: `Egreso Banco ${banco?.banco || ''} - Ref: ${p.referencia}`,
          debe: 0,
          haber: montoNum
        });
      }

      const mainRef = pagoForm.pagos.map(p => p.referencia).filter(Boolean).join(', ') || `PAG-${nowTs.slice(-4)}`;

      let newComprobante: any = null;
      if (lineas.length > 0) {
        const isBalanced = Math.abs(lineas.reduce((s,l)=>s+(Number(l.debe)||0),0) - lineas.reduce((s,l)=>s+(Number(l.haber)||0),0)) < 0.01;
        const isDescuadrado = !isBalanced || lineas.some(l => !l.cuentaId);
        newComprobante = {
          id: compId,
          empresa_id: activeCompanyId,
          fecha: pagoForm.fecha,
          numero: `CMP-${nowTs.slice(-6)}`,
          tipo: 'Diario',
          descripcion: `Pago de facturas a ${entidadNombre}`,
          referencia: mainRef,
          total: totalFacturasAplicadas,
          estado: isDescuadrado ? 'Descuadrado' : 'Contabilizado',
          lineas
        };
      }

      const executeSave = async (finalComprobante: any) => {
        if (onSave) {
          const effectiveComp = finalComprobante || newComprobante;
          const effectiveCompId = effectiveComp?.id || compId;

          // Guardar primero el comprobante para que su ID exista en Supabase y no falle la FK en movimientos_bancos
          if (effectiveComp) {
            await onSave('comprobantes', effectiveComp);
          }

          // Guardar cada movimiento bancario generado
          for (const mov of draftMovs) {
            await onSave('movimientosBancos', { ...mov, comprobante_id: effectiveCompId });
          }

          // Actualizar saldos de las facturas en cxp de forma atómica
          for (const [docId, montoAbonado] of Object.entries(abonos)) {
            const montoNum = Number(montoAbonado);
            if (montoNum > 0) {
              const doc = cxp.find(d => d.id === docId);
              if (doc) {
                const currentSaldo = Number(doc.saldo !== undefined ? doc.saldo : doc.total) || 0;
                const abonoRes = await dbRegistrarAbonoCxpAtomico(
                  activeCompanyId || '',
                  doc.id,
                  montoNum,
                  pagoForm.fecha,
                  mainRef || `PAG-${Date.now().toString().slice(-6)}`
                );

                const newSaldo = abonoRes.success && abonoRes.nuevo_saldo !== undefined
                  ? abonoRes.nuevo_saldo
                  : Math.max(0, currentSaldo - montoNum);
                const newEstado = newSaldo <= 0.009 ? 'pagada' : 'parcial';
                await onSave('cxp', { ...doc, saldo: newSaldo, saldo_pendiente: newSaldo, estado: newEstado, _localOnly: true });

                // Sincronizar factura de compra si existe
                if (facturasCompra && Array.isArray(facturasCompra)) {
                  const matchedFac = facturasCompra.find((f: any) => {
                    const facIdStr = String(f.id || '').toLowerCase();
                    const facNumStr = String(f.numero || '').trim().toLowerCase();
                    const docFacId = String(doc.factura_id || doc.factura_db_id || '').toLowerCase();
                    const docFacNum = String(doc.factura || doc.numero || '').trim().toLowerCase();
                    return (docFacId && (docFacId === facIdStr || docFacId === facNumStr)) ||
                           (docFacNum && (docFacNum === facNumStr || docFacNum === facIdStr)) ||
                           (doc.descripcion && facNumStr && doc.descripcion.toLowerCase().includes(facNumStr));
                  });

                  if (matchedFac) {
                    const targetFacEstado = newSaldo <= 0.009 ? 'pagada' : 'parcial';
                    const targetSaldoUSD = Math.max(0, newSaldo);
                    const targetSaldoBs = targetSaldoUSD * (matchedFac.tasa_cambio || 1);
                    await onSave('facturasCompra', {
                      ...matchedFac,
                      estado: targetFacEstado,
                      saldo_pendiente: targetSaldoUSD,
                      saldo_pendiente_bs: targetSaldoBs,
                      cxp_id: doc.id,
                      _localOnly: true
                    });
                  }
                }
              }
            }
          }

          // Actualizar saldos de los anticipos en cxp usando FIFO
          let remainingAnticipoToApply = totalAnticiposAplicados;
          for (const anticipoDoc of selectedSupplierAnticipos) {
            if (remainingAnticipoToApply <= 0) break;
            
            const saldoAbs = Math.abs(Number(anticipoDoc.saldo) || 0);
            if (saldoAbs > 0) {
              const amountToApplyToThisDoc = Math.min(saldoAbs, remainingAnticipoToApply);
              
              await onSave('cxp', { 
                ...anticipoDoc, 
                saldo: anticipoDoc.saldo + amountToApplyToThisDoc
              });
              
              remainingAnticipoToApply -= amountToApplyToThisDoc;
            }
          }


          // Registrar historial de pago realizado con array de pagos
          const newPagoRealizado = {
            id: crypto.randomUUID(),
            empresa_id: activeCompanyId,
            empresaId: activeCompanyId,
            fecha: pagoForm.fecha,
            proveedorNombre: entidadNombre,
            proveedorId: String(pagoForm.proveedorId),
            monto: totalFacturasAplicadas,
            referencia: mainRef,
            comprobanteId: effectiveCompId,
            movimientosBancos: draftMovs.map(m => ({ ...m, comprobante_id: effectiveCompId })),
            movimientoBancoId: draftMovs[0]?.id || null,
            estado: 'activo',
            abonos: abonos,
            anticiposAplicados: totalAnticiposAplicados,
            pagos: pagoForm.pagos,
            bancoId: pagoForm.pagos[0]?.bancoId || '',
            tasa: pagoForm.tasa || 1,
          };
          await onSave('pagos-realizados', newPagoRealizado);
        }

        showToast?.('Pago procesado exitosamente', 'success');
        setPendingVoucher(null);
        setPagoForm({
          bancoId: '',
          referencia: '',
          fecha: new Date().toISOString().split('T')[0],
          tasa: 1,
          tasaReferencial: '',
          proveedorId: '',
          pagos: []
        });
        setAbonos({});
        setAnticipoGlobal('');

        if (draftMovs.length > 0) {
          navigate('/reports/comprobante-movimiento-banco', { state: { movimiento: draftMovs[0] } });
        }
      };

      if (newComprobante) {
        setPendingVoucher({
          comprobante: newComprobante,
          movimiento: draftMovs[0] || null,
          onConfirm: async (finalComprobante: any) => {
            await executeSave(finalComprobante);
          }
        });
      } else {
        await executeSave(null);
      }
    } catch (error) {
      console.error(error);
      showToast?.('Error al procesar el pago', 'error');
    }
  };

  const handleSaveNewMov = () => {
    if (workingYear && newMovForm.fecha) {
      const year = newMovForm.fecha.substring(0, 4);
      if (year !== workingYear) {
        showToast?.(`No se puede registrar el movimiento porque el año de la fecha seleccionada (${year}) no coincide con el período contable seleccionado (${workingYear}).`, 'error');
        return;
      }
    }

    if (!newMovForm.bancoId || !newMovForm.entidad || !newMovForm.monto) {
      showToast?.('Por favor complete los campos requeridos: Banco, Entidad prestamista y Monto', 'error');
      return;
    }

    const lockDate = getSapsLockDate(newMovForm.bancoId);
    if (lockDate && newMovForm.fecha <= lockDate) {
      return showToast?.(`Error: Existe un cierre SAPS en ${lockDate}. Use una fecha posterior.`, 'error');
    }

    const montoNum = Number(Number(newMovForm.monto).toFixed(2));
    if (montoNum <= 0) {
      showToast?.('El monto debe ser mayor a 0', 'error');
      return;
    }

    const banco = bancos.find(b => b.id === newMovForm.bancoId);
    if (!banco) return;

    if (isNewMovVES && (!newMovForm.tasa || Number(newMovForm.tasa) <= 0)) {
      showToast?.('Debe ingresar una tasa válida mayor a 0 para operaciones en Bolívares', 'error');
      return;
    }

    const nowTs = Date.now().toString();
    const effectiveCategory = newMovForm.categoria || (activeTab !== 'proveedores' && activeTab !== 'pago' ? activeTab : 'accionistas');
    const docRef = newMovForm.referencia ? newMovForm.referencia.trim() : `PREST-${nowTs.slice(-4)}`;
    const concepto = newMovForm.descripcion ? newMovForm.descripcion.trim() : `Préstamo recibido de ${newMovForm.entidad} para financiamiento`;

    const movId = crypto.randomUUID();
    const cxpId = crypto.randomUUID();
    const compId = crypto.randomUUID();

    // 1. Crear movimiento bancario (ingreso a cuenta bancaria)
    const newMov = {
      id: movId,
      empresa_id: activeCompanyId,
      banco_id: newMovForm.bancoId,
      fecha: newMovForm.fecha,
      ref: docRef,
      descripcion: concepto,
      tipo: 'ingreso' as const,
      monto: montoNum,
      tasa: isNewMovVES ? Number(newMovForm.tasa) : (banco.tasa || 1),
      comprobante_id: compId,
      estado: 'activo'
    };

    // 2. Crear registro en CXP (Cuenta por Pagar)
    const newCxp = {
      id: cxpId,
      empresa_id: activeCompanyId,
      categoria: effectiveCategory,
      proveedor: newMovForm.entidad,
      proveedor_id: newMovForm.entidad_id || null,
      factura_id: docRef,
      factura: docRef,
      numero: docRef,
      factura_numero: docRef,
      fecha: newMovForm.fecha,
      fecha_emision: newMovForm.fecha,
      vencimiento: newMovForm.fechaVencimiento || newMovForm.fecha,
      fecha_vencimiento: newMovForm.fechaVencimiento || newMovForm.fecha,
      descripcion: concepto,
      tipo: 'prestamo',
      total: montoNum,
      monto: montoNum,
      monto_total: montoNum,
      saldo: montoNum,
      saldo_pendiente: montoNum,
      moneda: banco.moneda || 'USD',
      tasa: isNewMovVES ? Number(newMovForm.tasa) : (banco.tasa || 1),
      estado: 'pendiente'
    };

    // 3. Crear comprobante contable
    let cuentaEntidad = configContable?.cuentaCxp || '2.1.1';
    const contact = contactos.find(c => c.id === newMovForm.entidad_id || c.taxId === newMovForm.entidad_id);
    if (contact) {
      cuentaEntidad = contact.creditAccount || contact.expenseAccount || cuentaEntidad;
      newCxp.proveedor = contact.name || newCxp.proveedor;
      newCxp.proveedor_id = contact.id || null;
    } else {
      if (effectiveCategory === 'accionistas') {
        const accCuenta = cuentasContables.find(c => c.codigo?.startsWith('2.1.3') || c.nombre?.toLowerCase().includes('accionista') || c.nombre?.toLowerCase().includes('socio'));
        if (accCuenta) cuentaEntidad = accCuenta.id || accCuenta.codigo;
      } else if (effectiveCategory === 'intercompanias') {
        const interCuenta = cuentasContables.find(c => c.codigo?.startsWith('2.1.4') || c.nombre?.toLowerCase().includes('intercompañ') || c.nombre?.toLowerCase().includes('relacionad'));
        if (interCuenta) cuentaEntidad = interCuenta.id || interCuenta.codigo;
      }
    }

    const lineas = [
      {
        id: `l1-${nowTs}`,
        cuentaId: banco.cuenta_contable_id || '1.1.3',
        descripcion: `Ingreso a Banco ${banco.banco} (Préstamo Recibido)`,
        debe: montoNum,
        haber: 0
      },
      {
        id: `l2-${nowTs}`,
        cuentaId: cuentaEntidad,
        descripcion: `Préstamo por pagar a ${newCxp.proveedor}`,
        debe: 0,
        haber: montoNum
      }
    ];

    const isBalanced = Math.abs(lineas.reduce((s,l)=>s+(Number(l.debe)||0),0) - lineas.reduce((s,l)=>s+(Number(l.haber)||0),0)) < 0.01;
    const isDescuadrado = !isBalanced || lineas.some(l => !l.cuentaId);

    const newComprobante = {
      id: compId,
      empresa_id: activeCompanyId,
      fecha: newMovForm.fecha,
      numero: `CMP-${nowTs.slice(-6)}`,
      tipo: 'Diario',
      descripcion: concepto,
      referencia: docRef,
      total: montoNum,
      estado: isDescuadrado ? 'Descuadrado' : 'Contabilizado',
      lineas: lineas
    };

    setPendingVoucher({
      comprobante: newComprobante,
      movimiento: newMov,
      onConfirm: async (finalComprobante: any) => {
        if (onSave) {
          const compToSave = finalComprobante || newComprobante;
          onSave('movimientosBancos', { ...newMov, comprobante_id: compToSave.id });
          onSave('cxp', newCxp);
          onSave('comprobantes', compToSave);
        }

        showToast?.('Préstamo y cuenta por pagar registrados exitosamente', 'success');
        setPendingVoucher(null);
        setShowNewModal(false);
        setNewMovForm({
          bancoId: '',
          fecha: new Date().toISOString().split('T')[0],
          fechaVencimiento: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          referencia: '',
          descripcion: '',
          monto: '',
          entidad: '',
          entidad_id: '',
          categoria: 'accionistas',
          tasa: '',
          montoBs: ''
        });
        if (effectiveCategory && effectiveCategory !== activeTab && activeTab !== 'proveedores') {
          setActiveTab(effectiveCategory);
        }
      }
    });
  };

  const handleSaveProvision = () => {
    if (workingYear && provisionForm.fecha) {
      const year = provisionForm.fecha.substring(0, 4);
      if (year !== workingYear) {
        showToast?.(`No se puede registrar la provisión porque el año de la fecha seleccionada (${year}) no coincide con el período contable seleccionado (${workingYear}).`, 'error');
        return;
      }
    }

    if (!provisionForm.proveedor_id || !provisionForm.monto || !provisionForm.descripcion) {
      showToast?.('Por favor complete todos los campos requeridos', 'error');
      return;
    }

    const montoNum = Number(provisionForm.monto);
    if (montoNum <= 0) {
      showToast?.('El monto debe ser mayor a 0', 'error');
      return;
    }

    const nowTs = Date.now().toString();

    // 1. Crear registro en CXP
    const newCxp = {
      id: crypto.randomUUID(),
      empresa_id: activeCompanyId,
      categoria: activeTab,
      proveedor: provisionForm.proveedor,
      proveedor_id: provisionForm.proveedor_id,
      factura_id: `PROV-${nowTs.slice(-4)}`,
      fecha: provisionForm.fecha,
      vencimiento: provisionForm.fecha,
      descripcion: provisionForm.descripcion,
      tipo: 'prestamo', 
      total: montoNum,
      saldo: montoNum
    };

    // 2. Crear comprobante contable
    let cuentaPasivo = configContable?.cuentaCxp || '2.1.1';
    let cuentaGasto = provisionForm.cuentaGasto || configContable?.cuentaHonorarios || '6.1.1'; // Gasto default
    
    const contact = contactos.find(c => c.id === provisionForm.proveedor_id || c.taxId === provisionForm.proveedor_id);
    if (contact) {
      if (contact.creditAccount) cuentaPasivo = contact.creditAccount;
      if (!provisionForm.cuentaGasto && contact.expenseAccount) cuentaGasto = contact.expenseAccount;
      newCxp.proveedor = contact.name;
      newCxp.proveedor_id = contact.taxId || contact.id;
    }

    const lineas = [
      {
        id: `l1-${nowTs}`,
        cuentaId: cuentaGasto,
        descripcion: `Gasto por ${provisionForm.descripcion}`,
        debe: montoNum,
        haber: 0
      },
      {
        id: `l2-${nowTs}`,
        cuentaId: cuentaPasivo,
        descripcion: `CxP ${newCxp.proveedor}`,
        debe: 0,
        haber: montoNum
      }
    ];

    const isBalanced = Math.abs(lineas.reduce((s,l)=>s+(Number(l.debe)||0),0) - lineas.reduce((s,l)=>s+(Number(l.haber)||0),0)) < 0.01;
    const isDescuadrado = !isBalanced || lineas.some(l => !l.cuentaId);

    const newComprobante = {
      id: crypto.randomUUID(),
      empresa_id: activeCompanyId,
      fecha: provisionForm.fecha,
      numero: `CMP-${nowTs.slice(-6)}`,
      tipo: 'Diario',
      descripcion: `Provisión ${newCxp.proveedor}`,
      referencia: newCxp.factura_id,
      total: montoNum,
      estado: isDescuadrado ? 'Descuadrado' : 'Contabilizado',
      lineas: lineas
    };

    setPendingVoucher({
      comprobante: newComprobante,
      movimiento: null,
      onConfirm: async (finalComprobante: any) => {
        if (onSave) {
          onSave('cxp', newCxp);
          onSave('comprobantes', finalComprobante);
        }

        showToast?.('Provisión registrada exitosamente', 'success');
        setPendingVoucher(null);
        setShowProvisionModal(false);
        setProvisionForm({
          proveedor: '',
          proveedor_id: '',
          fecha: new Date().toISOString().split('T')[0],
          descripcion: 'Provisión',
          monto: '',
          cuentaGasto: ''
        });
      }
    });
  };

  const handleSaveAnticipo = () => {
    if (workingYear && anticipoForm.fecha) {
      const year = anticipoForm.fecha.substring(0, 4);
      if (year !== workingYear) {
        showToast?.(`No se puede registrar el anticipo porque el año de la fecha seleccionada (${year}) no coincide con el período contable seleccionado (${workingYear}).`, 'error');
        return;
      }
    }

    if (!anticipoForm.bancoId || !anticipoForm.proveedor || !anticipoForm.monto || !anticipoForm.descripcion) {
      showToast?.('Por favor complete todos los campos requeridos', 'error');
      return;
    }

    const lockDate = getSapsLockDate(anticipoForm.bancoId);
    if (lockDate && anticipoForm.fecha <= lockDate) {
      return showToast?.(`Error: Existe un cierre SAPS en ${lockDate}. Use una fecha posterior.`, 'error');
    }

    const montoNum = Number(Number(anticipoForm.monto).toFixed(2));
    if (montoNum <= 0) {
      showToast?.('El monto debe ser mayor a 0', 'error');
      return;
    }

    const banco = bancos.find(b => b.id === anticipoForm.bancoId);
    if (!banco) return;
    
    if (isAnticipoVES && (!anticipoForm.tasa || Number(anticipoForm.tasa) <= 0)) {
      showToast?.('Debe ingresar una tasa válida mayor a 0 para operaciones en Bolívares', 'error');
      return;
    }

    const nowTs = Date.now().toString();

    // 1. Crear movimiento bancario (egreso)
    const newMov = {
      id: crypto.randomUUID(),
      empresa_id: activeCompanyId,
      banco_id: anticipoForm.bancoId,
      fecha: anticipoForm.fecha,
      ref: anticipoForm.referencia || `ANT-${nowTs.slice(-4)}`,
      descripcion: anticipoForm.descripcion,
      tipo: 'egreso' as const,
      monto: montoNum,
      tasa: isAnticipoVES ? Number(anticipoForm.tasa) : (banco.tasa || 1),
      estado: 'activo',
      proveedor_asignado: anticipoForm.proveedor_id || `PROV-${nowTs.slice(-4)}`
    };

    // 2. Crear registro en CXP con saldo negativo (a favor del proveedor)
    const newCxp = {
      id: crypto.randomUUID(),
      empresa_id: activeCompanyId,
      categoria: activeTab === 'pago' ? 'proveedores' : activeTab,
      proveedor: anticipoForm.proveedor,
      proveedor_id: anticipoForm.proveedor_id || `PROV-${nowTs.slice(-4)}`,
      factura_id: `ANT-${nowTs.slice(-4)}`,
      fecha: anticipoForm.fecha,
      vencimiento: anticipoForm.fecha,
      descripcion: anticipoForm.descripcion,
      tipo: 'anticipo',
      total: -montoNum,
      saldo: -montoNum
    };

    // 3. Crear comprobante contable
    const cuentaAnticipo = configContable?.cuentaAnticipoOtorgado || '1.1.4'; // Activo por defecto
    const lineas = [
      {
        id: `l1-${nowTs}`,
        cuentaId: cuentaAnticipo,
        descripcion: `Anticipo a Proveedor ${newCxp.proveedor}`,
        debe: montoNum,
        haber: 0
      },
      {
        id: `l2-${nowTs}`,
        cuentaId: banco.cuenta_contable_id || '1.1.3',
        descripcion: `Egreso de Banco ${banco.banco}`,
        debe: 0,
        haber: montoNum
      }
    ];

    const isBalanced = Math.abs(lineas.reduce((s,l)=>s+(Number(l.debe)||0),0) - lineas.reduce((s,l)=>s+(Number(l.haber)||0),0)) < 0.01;
    const isDescuadrado = !isBalanced || lineas.some(l => !l.cuentaId);

    const newComprobante = {
      id: crypto.randomUUID(),
      empresa_id: activeCompanyId,
      fecha: anticipoForm.fecha,
      numero: `CMP-${nowTs.slice(-6)}`,
      tipo: 'Diario',
      descripcion: `Anticipo otorgado a ${newCxp.proveedor}`,
      referencia: newMov.ref || newCxp.factura_id,
      total: montoNum,
      estado: isDescuadrado ? 'Descuadrado' : 'Contabilizado',
      lineas: lineas
    };

    setPendingVoucher({
      comprobante: newComprobante,
      movimiento: newMov,
      onConfirm: async (finalComprobante: any) => {
        if (onSave) {
          onSave('movimientosBancos', newMov);
          onSave('cxp', newCxp);
          onSave('comprobantes', finalComprobante);
        }

        showToast?.('Anticipo registrado exitosamente', 'success');
        setPendingVoucher(null);
        setShowAnticipoModal(false);
        setAnticipoForm({
          proveedor: '',
          proveedor_id: '',
          bancoId: '',
          fecha: new Date().toISOString().split('T')[0],
          referencia: '',
          descripcion: 'Anticipo a proveedor',
          monto: '',
          tasa: ''
        });
        navigate('/reports/comprobante-movimiento-banco', { state: { movimiento: newMov } });
      }
    });
  };

  const handleSaveSaldoInicial = () => {
    if (workingYear && saldoInicialForm.fecha) {
      const year = saldoInicialForm.fecha.substring(0, 4);
      if (year !== workingYear) {
        showToast?.(`No se puede guardar el saldo inicial porque el año de la fecha seleccionada (${year}) no coincide con el período contable seleccionado (${workingYear}).`, 'error');
        return;
      }
    }

    if (!saldoInicialForm.contacto || !saldoInicialForm.monto || !saldoInicialForm.descripcion) {
      showToast?.('Por favor complete todos los campos requeridos', 'error');
      return;
    }

    const montoNum = Number(saldoInicialForm.monto);
    if (montoNum <= 0) {
      showToast?.('El monto debe ser mayor a 0', 'error');
      return;
    }

    const nowTs = Date.now().toString();

    const docId = saldoInicialForm.factura_id || `SI-${nowTs.slice(-4)}`;

    // 1. Crear registro en CXP
    const newCxp = {
      id: crypto.randomUUID(),
      empresa_id: activeCompanyId,
      categoria: activeTab === 'pago' ? 'proveedores' : activeTab,
      proveedor: saldoInicialForm.contacto,
      proveedor_id: saldoInicialForm.contacto_id || `PROV-${nowTs.slice(-4)}`,
      factura_id: docId,
      fecha: saldoInicialForm.fecha,
      vencimiento: saldoInicialForm.vencimiento,
      descripcion: saldoInicialForm.descripcion,
      tipo: 'saldo_inicial',
      total: montoNum,
      saldo: montoNum,
      moneda: saldoInicialForm.moneda,
      tasa: Number(saldoInicialForm.tasa) || 1
    };

    // 2. Crear comprobante contable si se selecciona una cuenta de contrapartida
    if (saldoInicialForm.cuentaContrapartida) {
      let cuentaCxp = configContable?.cuentaCxp || '2.1.1';
      const contact = contactos.find(c => c.id === saldoInicialForm.contacto_id || c.taxId === saldoInicialForm.contacto_id);
      if (contact && contact.creditAccount) {
        cuentaCxp = contact.creditAccount;
      }

      const lineas = [
        {
          id: `l1-${nowTs}`,
          cuentaId: saldoInicialForm.cuentaContrapartida,
          descripcion: `Contrapartida Saldo Inicial - ${newCxp.proveedor}`,
          debe: montoNum,
          haber: 0
        },
        {
          id: `l2-${nowTs}`,
          cuentaId: cuentaCxp,
          descripcion: `Carga de Saldo Inicial - ${newCxp.proveedor}`,
          debe: 0,
          haber: montoNum
        }
      ];

      const isBalanced = Math.abs(lineas.reduce((s,l)=>s+(Number(l.debe)||0),0) - lineas.reduce((s,l)=>s+(Number(l.haber)||0),0)) < 0.01;
      const isDescuadrado = !isBalanced || lineas.some(l => !l.cuentaId);

      const newComprobante = {
        id: crypto.randomUUID(),
        empresa_id: activeCompanyId,
        fecha: saldoInicialForm.fecha,
        numero: `CMP-${nowTs.slice(-6)}`,
        tipo: 'Diario',
        descripcion: `Carga de Saldo Inicial - ${newCxp.proveedor}`,
        referencia: docId,
        total: montoNum,
        estado: isDescuadrado ? 'Descuadrado' : 'Contabilizado',
        lineas: lineas
      };

      setPendingVoucher({
        comprobante: newComprobante,
        movimiento: null,
        onConfirm: async (finalComprobante: any) => {
          if (onSave) {
            onSave('cxp', newCxp);
            onSave('comprobantes', finalComprobante);
          }

          showToast?.('Saldo inicial cargado exitosamente', 'success');
          setPendingVoucher(null);
          setShowSaldoInicialModal(false);
          setSaldoInicialForm({
            contacto: '',
            contacto_id: '',
            factura_id: '',
            fecha: new Date().toISOString().split('T')[0],
            vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            descripcion: 'Saldo Inicial de CxP',
            monto: '',
            moneda: 'Dólares (USD)',
            tasa: '1.00',
            cuentaContrapartida: ''
          });
        }
      });
    } else {
      if (onSave) {
        onSave('cxp', newCxp);
      }
      showToast?.('Saldo inicial cargado exitosamente', 'success');
      setShowSaldoInicialModal(false);
      setSaldoInicialForm({
        contacto: '',
        contacto_id: '',
        factura_id: '',
        fecha: new Date().toISOString().split('T')[0],
        vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        descripcion: 'Saldo Inicial de CxP',
        monto: '',
        moneda: 'Dólares (USD)',
        tasa: '1.00',
        cuentaContrapartida: ''
      });
    }
  };

  // Combinar documentos de CxP y movimientos bancarios relacionados
  // Combinar documentos de CxP y pagos realizados relacionados
  const historialProveedor = useMemo(() => {
    if (!currentSupplier) return { movs: [], saldoInicial: 0 };
    
    // 1. Cargos y Anticipos (Documentos / Facturas)
    const docs = (currentSupplier.documentos || []).map((d: any) => ({
      ...d,
      _tipo: 'documento',
      _fecha: new Date(d.fecha || d.createdAt).getTime(),
      fechaStr: d.fecha || new Date(d.createdAt).toISOString().split('T')[0]
    }));

    // 2. Abonos (Pagos realizados a través del módulo de Pagos)
    const supplierIdStr = String(currentSupplier?.id || currentSupplier?.proveedor_id || '').trim();
    const contactObj = contactos.find(c => 
      c.id === supplierIdStr || 
      c.taxId === supplierIdStr || 
      (currentSupplier?.rif && c.taxId?.toLowerCase() === currentSupplier.rif.toLowerCase()) ||
      (currentSupplier?.proveedor && c.name?.toLowerCase() === currentSupplier.proveedor.toLowerCase())
    );
    const supplierDocIds = new Set((currentSupplier.documentos || []).map((d: any) => String(d.id || d.factura_id || d.factura || '')));
    
    const pagos = (pagosRealizados || []).filter((p: any) => {
      if (p.estado === 'anulado') return false;
      // Filtrar pagos por ID de proveedor, o nombre como fallback
      if (p.proveedorId && String(p.proveedorId) === supplierIdStr) return true;
      if (contactObj && p.proveedorId && (String(p.proveedorId) === contactObj.id || String(p.proveedorId) === contactObj.taxId)) return true;
      if (p.proveedorNombre && currentSupplier?.proveedor && p.proveedorNombre.toLowerCase() === currentSupplier.proveedor.toLowerCase()) return true;
      
      // Filter by document ID references in abonos/detalles
      if (p.detalles) {
        if (Array.isArray(p.detalles) && p.detalles.some((d: any) => supplierDocIds.has(String(d.docId || d.id || '')))) return true;
        if (typeof p.detalles === 'object') {
          if (Array.isArray(p.detalles.items) && p.detalles.items.some((d: any) => supplierDocIds.has(String(d.docId || d.id || '')))) return true;
          if (Object.keys(p.detalles).some(k => supplierDocIds.has(String(k)))) return true;
        }
      }
      if (p.abonos) {
        if (Array.isArray(p.abonos) && p.abonos.some((a: any) => supplierDocIds.has(String(a.docId || a.id || '')))) return true;
        if (typeof p.abonos === 'object' && Object.keys(p.abonos).some(k => supplierDocIds.has(String(k)))) return true;
      }
      
      return false;
    }).map((p: any) => ({
      ...p,
      _tipo: 'pago',
      _fecha: new Date(p.fecha || p.createdAt || 0).getTime(),
      fechaStr: p.fecha || new Date(p.createdAt || 0).toISOString().split('T')[0],
      totalAnticiposAplicados: Number(p.anticiposAplicados) || 0
    }));

    // Generate virtual abonos for fully/partially paid docs that have no corresponding pago
    const pagoDocIds = new Set<string>();
    pagos.forEach((p: any) => {
      if (Array.isArray(p.detalles)) {
        p.detalles.forEach((d: any) => {
          const id = d.docId || d.id || d.facturaId;
          if (id) pagoDocIds.add(String(id));
        });
      } else if (p.detalles && typeof p.detalles === 'object') {
        if (Array.isArray(p.detalles.items)) {
          p.detalles.items.forEach((d: any) => {
            const id = d.docId || d.id || d.facturaId;
            if (id) pagoDocIds.add(String(id));
          });
        }
        Object.keys(p.detalles).forEach(k => {
          if (k !== 'proveedor_nombre' && k !== 'items') pagoDocIds.add(String(k));
        });
      }

      if (Array.isArray(p.abonos)) {
        p.abonos.forEach((a: any) => {
          const id = a.docId || a.id || a.facturaId;
          if (id) pagoDocIds.add(String(id));
        });
      } else if (p.abonos && typeof p.abonos === 'object') {
        Object.keys(p.abonos).forEach(k => pagoDocIds.add(String(k)));
      }
    });

    const virtualAbonos: any[] = [];
    docs.forEach(d => {
       const dId = String(d.id || d.factura_id || d.factura || '');
       if (dId && !pagoDocIds.has(dId) && (d.tipo !== 'anticipo' && d.tipo !== 'nota_credito')) {
         const totalDoc = Math.abs(Number(d.total) || Number(d.monto) || 0);
         const saldoDoc = d.saldo !== undefined ? Number(d.saldo) : totalDoc;
         const paid = totalDoc - saldoDoc;
         if (paid > 0.01 && d.estado !== 'anulada') {
            virtualAbonos.push({
               id: `pago-virtual-${dId}`,
               _tipo: 'pago',
               _fecha: d._fecha + 1000, // right after doc
               fechaStr: d.fechaStr,
               monto: paid,
               descripcion: `Pago / Amortización de Factura ${d.factura || d.factura_id || ''}`,
               referencia: d.factura || d.factura_id || '',
               estado: 'procesado'
            });
         }
       }
    });

    const allMovs = [...docs, ...pagos, ...virtualAbonos].sort((a, b) => a._fecha - b._fecha);

    let fIni: string | null = null; 
    let fFin: string | null = null;
    if (filtrosHistorial.tipo === 'mes') {
      fIni = `${filtrosHistorial.ano}-${filtrosHistorial.mes}-01`;
      fFin = `${filtrosHistorial.ano}-${filtrosHistorial.mes}-${new Date(parseInt(filtrosHistorial.ano), parseInt(filtrosHistorial.mes), 0).getDate()}`;
    } else if (filtrosHistorial.tipo === 'ano') {
      fIni = `${filtrosHistorial.ano}-01-01`; 
      fFin = `${filtrosHistorial.ano}-12-31`;
    } else if (filtrosHistorial.tipo === 'rango') {
      fIni = filtrosHistorial.desde; 
      fFin = filtrosHistorial.hasta;
    }

    let saldoInicial = 0;
    let movsList: any[] = [];

    allMovs.forEach(item => {
      let cargo = 0;
      let abono = 0;

      if (item._tipo === 'pago') {
        // En cuentas por pagar, un pago es un abono (reduce la deuda)
        abono = Math.max(0, (Number(item.monto) || Number(item.montoTotal) || Number(item.monto_total) || 0));
      } else {
        // Un documento
        const isAnticipo = Number(item.total) < 0;
        if (isAnticipo) {
          abono = Math.abs(Number(item.total));
        } else {
          cargo = Number(item.total);
        }
      }

      const valor = cargo - abono;

      let inPeriod = true;
      if (filtrosHistorial.tipo !== 'todo') {
        if (fIni && item.fechaStr < fIni) inPeriod = false;
        if (fFin && item.fechaStr > fFin) inPeriod = false;
      }

      if (!inPeriod && item.fechaStr < (fIni || '9999-12-31')) {
        saldoInicial += valor;
      } else if (inPeriod) {
        movsList.push({
          ...item,
          __cargo: cargo,
          __abono: abono
        });
      }
    });

    return { movs: movsList, saldoInicial };
  }, [currentSupplier, pagosRealizados, filtrosHistorial]);

  // --- SUBMODULO DE HISTORIAL DE PAGOS REALIZADOS ---
  const computedPagosRealizados = useMemo(() => {
    return [...pagosRealizados];
  }, [pagosRealizados]);

  const sortedFilteredPagosRealizados = useMemo(() => {
    let result = [...computedPagosRealizados];

    // Filter by search
    if (historialSearch.trim()) {
      const term = historialSearch.toLowerCase();
      result = result.filter(e => 
        (e.proveedorNombre || '').toLowerCase().includes(term) ||
        (e.referencia || '').toLowerCase().includes(term) ||
        String(e.monto || '').includes(term)
      );
    }

    // Filter by date range
    if (historialDateRange.desde) {
      result = result.filter(e => e.fecha >= historialDateRange.desde);
    }
    if (historialDateRange.hasta) {
      result = result.filter(e => e.fecha <= historialDateRange.hasta);
    }

    // Sort chronologically (newest first)
    return result.sort((a, b) => {
      const dateA = String(a.fecha || '');
      const dateB = String(b.fecha || '');
      const cmpDate = dateB.localeCompare(dateA);
      if (cmpDate !== 0) return cmpDate;
      const idA = String(a.id || '');
      const idB = String(b.id || '');
      return idB.localeCompare(idA);
    });
  }, [computedPagosRealizados, historialSearch, historialDateRange]);

  // Paginar historial
  const ITEMS_PER_PAGE = 10;
  const totalHistorialPages = Math.ceil(sortedFilteredPagosRealizados.length / ITEMS_PER_PAGE) || 1;
  const paginatedHistorialPagos = useMemo(() => {
    const start = (historialPage - 1) * ITEMS_PER_PAGE;
    return sortedFilteredPagosRealizados.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedFilteredPagosRealizados, historialPage]);

  // Recalculate to page 1 if query inputs shift
  useEffect(() => {
    setHistorialPage(1);
  }, [historialSearch, historialDateRange]);

  const handleAnnulPago = (pago: any) => {
    setMasterAuth({
      isOpen: true,
      title: 'Autorización Master Requerida',
      actionName: 'Anular Pago a Proveedor',
      actionDetails: `Pago ${pago.referencia || pago.id} - Monto: $${formatoES(pago.monto)} (${pago.proveedorNombre || ''})`,
      onSuccess: async () => {
        try {
          // 1. Restaurar balances de facturas CxP (solo si no estaba ya anulado)
          if (pago.estado !== 'anulado') {
            if (Array.isArray(pago.abonos)) {
              pago.abonos.forEach((item: any) => {
                const docId = item.docId || item.id || item.facturaId;
                const montoNum = Number(item.montoAbonado || item.monto || item.abono) || 0;
                if (montoNum > 0 && docId) {
                  const doc = cxp.find(d => d.id === docId || d.factura_id === docId);
                  if (doc) {
                    const docTotal = Number(doc.total) || Number(doc.monto) || 0;
                    const curSaldo = doc.saldo !== undefined ? Number(doc.saldo) : 0;
                    const restoredSaldo = Math.min(docTotal, curSaldo + montoNum);
                    const restoredEstado = restoredSaldo >= docTotal - 0.01 ? 'pendiente' : (doc.estado || 'activo');
                    onSave?.('cxp', { ...doc, saldo: restoredSaldo, estado: restoredEstado, fechaPago: null });
                  }
                }
              });
            } else if (pago.abonos && typeof pago.abonos === 'object') {
              Object.entries(pago.abonos).forEach(([docId, montoAbonado]) => {
                const montoNum = typeof montoAbonado === 'object' ? Number((montoAbonado as any)?.montoAbonado || (montoAbonado as any)?.monto || 0) : Number(montoAbonado);
                if (montoNum > 0 && docId) {
                  const doc = cxp.find(d => d.id === docId || d.factura_id === docId);
                  if (doc) {
                    const docTotal = Number(doc.total) || Number(doc.monto) || 0;
                    const curSaldo = doc.saldo !== undefined ? Number(doc.saldo) : 0;
                    const restoredSaldo = Math.min(docTotal, curSaldo + montoNum);
                    const restoredEstado = restoredSaldo >= docTotal - 0.01 ? 'pendiente' : (doc.estado || 'activo');
                    onSave?.('cxp', { ...doc, saldo: restoredSaldo, estado: restoredEstado, fechaPago: null });
                  }
                }
              });
            }
          }

          // 2. Anular Comprobante Contable vinculado
          if (pago.comprobanteId) {
            const comp = comprobantes.find(c => c.id === pago.comprobanteId);
            if (comp) {
              onSave?.('comprobantes', { 
                ...comp, 
                estado: 'Anulado', 
                descripcion: `ANULADO - ${comp.descripcion}` 
              });
            }
          }

          // 3. Anular movimientos bancarios vinculados
          const bankIds: string[] = [];
          if (pago.movimientoBancoIds && Array.isArray(pago.movimientoBancoIds)) {
            bankIds.push(...pago.movimientoBancoIds);
          }
          if (pago.movimientoBancoId) {
            bankIds.push(pago.movimientoBancoId);
          }

          (movimientosBancos || []).forEach((m: any) => {
            const matchesId = bankIds.includes(String(m.id));
            const matchesRef = pago.referencia && String(m.ref) === String(pago.referencia);
            if (matchesId || matchesRef) {
              onSave?.('movimientosBancos', { 
                ...m, 
                estado: 'anulado', 
                descripcion: `ANULADO - ${m.descripcion}` 
              });
            }
          });

          // 4. Marcar pago como anulado
          if (!pago.isSynthetic) {
            onSave?.('pagos-realizados', { ...pago, estado: 'anulado' });
          } else {
            onSave?.('pagos-realizados', { ...pago, id: crypto.randomUUID(), empresa_id: activeCompanyId, empresaId: activeCompanyId, isSynthetic: false, estado: 'anulado' });
          }

          setSelectedSupplier(null);
          showToast?.('Pago anulado exitosamente y balances restaurados.', 'success');
        } catch (err) {
          console.error(err);
          showToast?.('Error al anular el pago.', 'error');
        }
      }
    });
  };

  const handleDeletePago = (pago: any) => {
    setMasterAuth({
      isOpen: true,
      title: 'Autorización Master Requerida',
      actionName: 'Eliminar Registro de Pago',
      actionDetails: `Pago ${pago.referencia || pago.id} - Monto: $${formatoES(pago.monto)} (${pago.proveedorNombre || ''})`,
      onSuccess: async () => {
        try {
          // 1. Restaurar balances de facturas CxP (si no estaba ya anulado)
          if (pago.estado !== 'anulado') {
            if (Array.isArray(pago.abonos)) {
              pago.abonos.forEach((item: any) => {
                const docId = item.docId || item.id || item.facturaId;
                const montoNum = Number(item.montoAbonado || item.monto || item.abono) || 0;
                if (montoNum > 0 && docId) {
                  const doc = cxp.find(d => d.id === docId || d.factura_id === docId);
                  if (doc) {
                    const docTotal = Number(doc.total) || Number(doc.monto) || 0;
                    const curSaldo = doc.saldo !== undefined ? Number(doc.saldo) : 0;
                    const restoredSaldo = Math.min(docTotal, curSaldo + montoNum);
                    const restoredEstado = restoredSaldo >= docTotal - 0.01 ? 'pendiente' : (doc.estado || 'activo');
                    onSave?.('cxp', { ...doc, saldo: restoredSaldo, estado: restoredEstado, fechaPago: null });
                  }
                }
              });
            } else if (pago.abonos && typeof pago.abonos === 'object') {
              Object.entries(pago.abonos).forEach(([docId, montoAbonado]) => {
                const montoNum = typeof montoAbonado === 'object' ? Number((montoAbonado as any)?.montoAbonado || (montoAbonado as any)?.monto || 0) : Number(montoAbonado);
                if (montoNum > 0 && docId) {
                  const doc = cxp.find(d => d.id === docId || d.factura_id === docId);
                  if (doc) {
                    const docTotal = Number(doc.total) || Number(doc.monto) || 0;
                    const curSaldo = doc.saldo !== undefined ? Number(doc.saldo) : 0;
                    const restoredSaldo = Math.min(docTotal, curSaldo + montoNum);
                    const restoredEstado = restoredSaldo >= docTotal - 0.01 ? 'pendiente' : (doc.estado || 'activo');
                    onSave?.('cxp', { ...doc, saldo: restoredSaldo, estado: restoredEstado, fechaPago: null });
                  }
                }
              });
            }
          }

          // 2. Eliminar Comprobante Contable
          if (pago.comprobanteId) {
            onSave?.('comprobantes', { id: pago.comprobanteId, _delete: true });
          }

          // 3. Eliminar movimientos de banco vinculados
          const bankIds: string[] = [];
          if (pago.movimientoBancoIds && Array.isArray(pago.movimientoBancoIds)) {
            bankIds.push(...pago.movimientoBancoIds);
          }
          if (pago.movimientoBancoId) {
            bankIds.push(pago.movimientoBancoId);
          }

          (movimientosBancos || []).forEach((m: any) => {
            const matchesId = bankIds.includes(String(m.id));
            const matchesRef = pago.referencia && String(m.ref) === String(pago.referencia);
            if (matchesId || matchesRef) {
              onSave?.('movimientosBancos', { id: m.id, _delete: true });
            }
          });

          // 4. Eliminar registro de pago
          if (!pago.isSynthetic) {
            onSave?.('pagos-realizados', { id: pago.id, _delete: true });
          }

          setSelectedSupplier(null);
          setSelectedPago(null);
          showToast?.('Pago eliminado exitosamente del sistema.', 'success');
        } catch (err) {
          console.error(err);
          showToast?.('Error al eliminar el pago.', 'error');
        }
      }
    });
  };

  const handleExecuteReintegroSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSupplier) return;
    const montoReintegro = Number(reintegroForm.monto);
    if (!montoReintegro || montoReintegro <= 0) {
      showToast?.('Por favor ingrese un monto válido para el reintegro.', 'error');
      return;
    }
    if (!reintegroForm.bancoId) {
      showToast?.('Debe seleccionar el banco destino del reintegro.', 'error');
      return;
    }

    const availableCredit = Math.abs(Number(currentSupplier.saldoPendiente) || 0);
    if (montoReintegro > availableCredit + 0.01) {
      showToast?.(`El monto a reintegrar ($${formatoES(montoReintegro)}) no puede ser mayor al saldo a favor disponible ($${formatoES(availableCredit)}).`, 'error');
      return;
    }

    try {
      const selectedBanco = bancos.find(b => b.id === reintegroForm.bancoId);
      const isBancoVES = selectedBanco?.moneda === 'VES' || selectedBanco?.moneda === 'Bs' || selectedBanco?.moneda === 'Bs.' || selectedBanco?.moneda === 'Bolivares' || selectedBanco?.moneda === 'Bolívares';
      const effectiveTasa = isBancoVES ? Number(selectedBanco?.tasa || 1.0) : 1.0;
      const refCode = reintegroForm.referencia.trim() || `REINT-${Date.now().toString().slice(-6)}`;

      // 1. Amortizar anticipos existentes del proveedor
      let remainingToAmortize = montoReintegro;
      const supplierAdvances = (currentSupplier.documentos || []).filter((d: any) => 
        (d.tipo === 'anticipo' || Number(d.total) < 0) && d.estado !== 'anulada' && (Number(d.saldo) < 0 || Number(d.total) < 0)
      );

      for (const adv of supplierAdvances) {
        if (remainingToAmortize <= 0) break;
        const currentAdvSaldo = Math.abs(Number(adv.saldo !== undefined ? adv.saldo : adv.total));
        const amortizeAmount = Math.min(currentAdvSaldo, remainingToAmortize);
        const newSaldo = -(currentAdvSaldo - amortizeAmount);
        
        onSave?.('cxp', {
          ...adv,
          saldo: Math.abs(newSaldo) <= 0.009 ? 0 : newSaldo,
          estado: Math.abs(newSaldo) <= 0.009 ? 'pagada' : 'pendiente'
        });
        remainingToAmortize -= amortizeAmount;
      }

      // 2. Registrar documento de ajuste de reintegro en CxP
      const docReintegroId = crypto.randomUUID();
      onSave?.('cxp', {
        id: docReintegroId,
        empresa_id: activeCompanyId,
        factura_id: refCode,
        proveedor_id: currentSupplier.id,
        proveedor: currentSupplier.proveedor,
        categoria: activeTab === 'pago' ? 'proveedores' : activeTab,
        fecha: reintegroForm.fecha,
        vencimiento: reintegroForm.fecha,
        descripcion: `Reintegro recibido por fondos no utilizados (${reintegroForm.notas || 'Devolución de anticipo'})`,
        tipo: 'reintegro',
        total: montoReintegro,
        saldo: 0,
        moneda: selectedBanco?.moneda || 'USD',
        tasa: effectiveTasa,
        estado: 'pagada'
      });

      // 3. Registrar movimiento de ingreso bancario
      const movBancoId = crypto.randomUUID();
      const cuentaBancoContable = selectedBanco?.cuentaContableId || '1.1.3';
      onSave?.('movimientosBancos', {
        id: movBancoId,
        empresa_id: activeCompanyId,
        bancoId: reintegroForm.bancoId,
        banco_id: reintegroForm.bancoId,
        fecha: reintegroForm.fecha,
        ref: refCode,
        descripcion: `Reintegro de saldo a favor recibido de ${currentSupplier.proveedor}`,
        tipo: 'ingreso',
        monto: montoReintegro,
        tasa: effectiveTasa,
        estado: 'conciliado'
      });

      // 4. Asiento Contable Automático (Debe 1.1.3 Bancos / Haber 1.1.4 Anticipo a Proveedores)
      const cuentaAnticipos = configContable?.cuentaAnticipoOtorgado || '1.1.4';
      const compId = crypto.randomUUID();
      onSave?.('comprobantes', {
        id: compId,
        empresa_id: activeCompanyId,
        numero: `CMP-${Date.now().toString().slice(-6)}`,
        fecha: reintegroForm.fecha,
        descripcion: `Reintegro de saldo a favor de ${currentSupplier.proveedor} (Ref: ${refCode})`,
        referencia: refCode,
        origen: 'bancos',
        estado: 'Contabilizado',
        total: montoReintegro,
        lineas: [
          {
            id: `l-${Date.now()}-1`,
            cuentaId: cuentaBancoContable,
            descripcion: `Ingreso por reintegro en ${selectedBanco?.banco || 'Banco'}`,
            debe: montoReintegro,
            haber: 0
          },
          {
            id: `l-${Date.now()}-2`,
            cuentaId: cuentaAnticipos,
            descripcion: `Disminución de anticipo a favor con ${currentSupplier.proveedor}`,
            debe: 0,
            haber: montoReintegro
          }
        ]
      });

      showToast?.(`Reintegro de $${formatoES(montoReintegro)} procesado e ingresado a banco exitosamente.`, 'success');
      setShowReintegroModal(false);
      setReintegroForm({
        bancoId: '',
        fecha: new Date().toISOString().split('T')[0],
        referencia: '',
        monto: '',
        notas: 'Reintegro de saldo a favor / anticipo no utilizado'
      });
    } catch (err) {
      console.error(err);
      showToast?.('Error al procesar el reintegro.', 'error');
    }
  };

  const renderHistorialPagos = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Historial de Pagos Realizados
            </h3>
            
            {/* Quick date filters */}
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={() => setHistorialDateRange({ desde: '', hasta: '' })}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  !historialDateRange.desde && !historialDateRange.hasta 
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-750' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Todas las fechas
              </button>
              <button 
                onClick={() => {
                  const today = new Date();
                  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
                  setHistorialDateRange({ desde: firstDay, hasta: lastDay });
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  historialDateRange.desde && historialDateRange.desde.substring(0, 7) === new Date().toISOString().substring(0, 7)
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-750' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Este Mes
              </button>
            </div>
          </div>

          {/* Search bar and custom date inputs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por proveedor, referencia o monto..."
                value={historialSearch}
                onChange={e => setHistorialSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Desde:</span>
              <input
                type="date"
                value={historialDateRange.desde}
                onChange={e => setHistorialDateRange({ ...historialDateRange, desde: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-600"
              />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Hasta:</span>
              <input
                type="date"
                value={historialDateRange.hasta}
                onChange={e => setHistorialDateRange({ ...historialDateRange, hasta: e.target.value })}
                className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Beneficiario / Proveedor</th>
                  <th className="px-6 py-4">Referencia</th>
                  <th className="px-6 py-4 text-right">Monto Pagado</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 bg-white">
                {paginatedHistorialPagos.map((pago) => {
                  const isAnulado = pago.estado === 'anulado';
                  return (
                    <tr key={pago.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{(pago.fecha || '').split('T')[0].split('-').reverse().join('/')}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{pago.proveedorNombre}</td>
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">{pago.referencia}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-800">${formatoES(pago.monto)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          isAnulado 
                            ? 'bg-rose-50 text-rose-700' 
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isAnulado ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {isAnulado ? 'Anulado' : 'Activo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedPago(pago)}
                            title="Ver detalles"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Eye size={16} />
                          </button>
                          
                          {!isAnulado && (
                            <button
                              onClick={() => handleAnnulPago(pago)}
                              title="Anular pago"
                              className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                            >
                              <X size={16} />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeletePago(pago)}
                            title="Eliminar registro"
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedHistorialPagos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No se encontraron pagos registrados con los criterios seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination buttons */}
          {totalHistorialPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-6 mt-6">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                Página {historialPage} de {totalHistorialPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={historialPage === 1}
                  onClick={() => setHistorialPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                  Anterior
                </button>
                <button
                  disabled={historialPage === totalHistorialPages}
                  onClick={() => setHistorialPage(prev => Math.min(totalHistorialPages, prev + 1))}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (selectedSupplier) {
      return renderSupplierDetail();
    }

    const getEntityLabel = () => {
      const tab = tabs.find(t => t.id === activeTab);
      return tab ? tab.label.slice(0, -1) : 'Entidad';
    };

    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        {/* 1. CUADROS DE RESUMEN EJECUTIVO COMPACTOS (ALTA DENSIDAD) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KPI 1: Total Cuentas por Pagar */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs hover:border-rose-300 transition-all flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total por Pagar</span>
              <div className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                $ {formatNumber(kpiStats.totalExigible)}
              </div>
              <div className="text-[11px] font-medium text-slate-400 leading-tight">
                Bs. {formatNumber(kpiStats.totalExigible * currentTasa)}
              </div>
            </div>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
              <DollarSign size={16} />
            </div>
          </div>

          {/* KPI 2: Pagos Realizados */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pagos Realizados</span>
              <div className="text-lg font-black text-emerald-600 tracking-tight leading-tight">
                $ {formatNumber(kpiStats.totalCobrado)}
              </div>
              <div className="text-[11px] font-medium text-slate-400 leading-tight">
                Bs. {formatNumber(kpiStats.totalCobrado * currentTasa)}
              </div>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
              <CheckCircle size={16} />
            </div>
          </div>

          {/* KPI 3: Deuda Vencida */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs hover:border-amber-300 transition-all flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deuda Vencida</span>
                {kpiStats.countEnMora > 0 && (
                  <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 rounded">
                    {kpiStats.countEnMora}
                  </span>
                )}
              </div>
              <div className="text-lg font-black text-amber-600 tracking-tight leading-tight">
                $ {formatNumber(kpiStats.totalEnMora)}
              </div>
              <div className="text-[11px] font-medium text-slate-400 leading-tight">
                Bs. {formatNumber(kpiStats.totalEnMora * currentTasa)}
              </div>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
              <AlertTriangle size={16} />
            </div>
          </div>

          {/* KPI 4: Total Causado */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Causado</span>
              <div className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                $ {formatNumber(kpiStats.totalFacturado)}
              </div>
              <div className="text-[11px] font-medium text-slate-400 leading-tight">
                Bs. {formatNumber(kpiStats.totalFacturado * currentTasa)}
              </div>
            </div>
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg shrink-0">
              <Briefcase size={16} />
            </div>
          </div>
        </div>

        {/* 2. BARRA DE HERRAMIENTAS Y PÍLDORAS INTELIGENTES (DEUDAS POR DEFECTO) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          {/* Búsqueda y Filtros de Estado */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative min-w-[220px] max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input 
                type="text" 
                placeholder={`Buscar ${getEntityLabel().toLowerCase()} por nombre o RIF...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-4 py-1.5 text-xs bg-slate-50/70 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Smart Status Filter Pills con Proveedores con deuda prioritarios */}
            <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl overflow-x-auto text-xs font-bold">
              <button
                type="button"
                onClick={() => setStatusFilter('CON_DEUDA')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === 'CON_DEUDA'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-rose-600'
                }`}
                title="Mostrar solo proveedores con saldo pendiente por pagar"
              >
                <span>Con Deuda</span>
                <span className={`text-[10px] px-1 rounded ${statusFilter === 'CON_DEUDA' ? 'bg-rose-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {kpiStats.countConDeuda}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('EN_MORA')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === 'EN_MORA'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-amber-600 hover:text-amber-700'
                }`}
                title="Proveedores con facturas vencidas en mora"
              >
                <span>En Mora</span>
                <span className={`text-[10px] px-1 rounded ${statusFilter === 'EN_MORA' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-700'}`}>
                  {kpiStats.countEnMora}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('AL_DIA')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === 'AL_DIA'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
                title="Proveedores con saldo corriente no vencido"
              >
                <span>Al Día</span>
                <span className={`text-[10px] px-1 rounded ${statusFilter === 'AL_DIA' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                  {kpiStats.countAlDia}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('A_FAVOR')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === 'A_FAVOR'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-teal-700'
                }`}
                title="Proveedores con saldo a nuestro favor"
              >
                <span>A Favor</span>
                <span className={`text-[10px] px-1 rounded ${statusFilter === 'A_FAVOR' ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-700'}`}>
                  {kpiStats.countAFavor}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('SOLVENTES')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === 'SOLVENTES'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Proveedores solventes con saldo $0"
              >
                <span>Solventes ($0)</span>
                <span className={`text-[10px] px-1 rounded ${statusFilter === 'SOLVENTES' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {kpiStats.countSolventes}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('TODOS')}
                className={`px-2 py-1 rounded-lg transition-all whitespace-nowrap text-slate-500 hover:text-slate-800 ${
                  statusFilter === 'TODOS' ? 'bg-white text-slate-900 shadow-xs' : ''
                }`}
                title="Ver lista completa de proveedores"
              >
                Todos ({allGroupedData.length})
              </button>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-2 relative">
            <button 
              onClick={() => {
                setPagoForm({
                  ...pagoForm,
                  proveedorId: ''
                });
                setActiveTab('pago');
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <DollarSign size={14} />
              <span>+ Registrar Pago</span>
            </button>

            {activeTab === 'proveedores' ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => navigate('/purchases/new')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <ShoppingCart size={14} />
                  <span>+ Compra / Gasto</span>
                </button>
                <button 
                  onClick={() => handleOpenNewLoanModal('accionistas')}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Plus size={14} />
                  <span>+ Nuevo Préstamo</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => handleOpenNewLoanModal(activeTab)}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus size={14} />
                <span>+ Nuevo Préstamo</span>
              </button>
            )}

            {/* Menu Dropdown de Más Opciones */}
            <div className="relative">
              <button
                onClick={() => setShowExtraActionsMenu(!showExtraActionsMenu)}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors border border-slate-200 cursor-pointer"
                title="Más opciones"
              >
                <MoreVertical size={15} />
              </button>

              {showExtraActionsMenu && (
                <div 
                  className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 text-xs font-medium animate-in fade-in slide-in-from-top-2 duration-150"
                  onMouseLeave={() => setShowExtraActionsMenu(false)}
                >
                  <button 
                    onClick={() => {
                      setShowExtraActionsMenu(false);
                      handleOpenNewLoanModal();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                  >
                    <Plus size={14} className="text-indigo-600" /> + Nuevo Préstamo
                  </button>

                  <button 
                    onClick={() => {
                      setShowExtraActionsMenu(false);
                      setShowAnticipoModal(true);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                  >
                    <Plus size={14} className="text-emerald-600" /> + Generar Anticipo
                  </button>

                  <button 
                    onClick={() => {
                      setShowExtraActionsMenu(false);
                      setSaldoInicialForm({
                        contacto: '',
                        contacto_id: '',
                        factura_id: `SI-${Date.now().toString().slice(-4)}`,
                        fecha: new Date().toISOString().split('T')[0],
                        vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        descripcion: 'Saldo Inicial de CxP',
                        monto: '',
                        moneda: 'Dólares (USD)',
                        tasa: '1.00',
                        cuentaContrapartida: ''
                      });
                      setShowSaldoInicialModal(true);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                  >
                    <Plus size={14} className="text-violet-600" /> Saldo Inicial Histórico
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button 
                    onClick={() => {
                      setShowExtraActionsMenu(false);
                      window.print();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                  >
                    <Download size={14} className="text-slate-500" /> Exportar / Imprimir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. TABLA EJECUTIVA PRINCIPAL DE CUENTAS POR PAGAR */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-center w-12">#</th>
                  <th className="px-4 py-3">{getEntityLabel()} / RAZÓN SOCIAL & RIF</th>
                  <th className="px-4 py-3 text-center">ESTADO</th>
                  <th className="px-4 py-3 text-right">TOTAL FACTURADO</th>
                  <th className="px-4 py-3 text-right">PAGOS APLICADOS</th>
                  <th className="px-4 py-3 text-right">SALDO POR PAGAR</th>
                  <th className="px-4 py-3 text-center w-44">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {paginatedGroupedData.map((item, index) => {
                  const globalIndex = (mainTablePage - 1) * MAIN_TABLE_ITEMS_PER_PAGE + index + 1;
                  const isNegative = item.saldoPendiente < -0.01;
                  const isZero = Math.abs(item.saldoPendiente) <= 0.01;

                  return (
                    <tr 
                      key={item.id || index}
                      onClick={() => setSelectedSupplier(item)}
                      className="hover:bg-rose-50/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 text-slate-400 font-semibold text-center">{globalIndex}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center font-black text-xs shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                            {item.proveedor?.charAt(0)?.toUpperCase() || 'P'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 group-hover:text-rose-600 transition-colors block text-sm leading-tight">
                              {item.proveedor}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                              <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold">
                                {item.rif || item.id}
                              </span>
                              {item.telefono && (
                                <span className="hidden sm:inline text-slate-400">• {item.telefono}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.status === 'A_FAVOR' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                            <Coins size={11} /> Saldo a Favor
                          </span>
                        ) : item.status === 'EN_MORA' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle size={11} /> En Mora ({item.moraDays}d)
                          </span>
                        ) : item.status === 'AL_DIA' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle size={11} /> Al Día
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                            Solvente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-slate-700">$ {formatNumber(item.montoAdeudo)}</div>
                        <div className="text-[10px] text-slate-400">Bs. {formatNumber(item.montoAdeudo * currentTasa)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-emerald-600">$ {formatNumber(item.abonosAplicados)}</div>
                        <div className="text-[10px] text-slate-400">Bs. {formatNumber(item.abonosAplicados * currentTasa)}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`font-black text-sm ${
                          isNegative ? 'text-teal-600' : isZero ? 'text-slate-400' : 'text-slate-900'
                        }`}>
                          {isNegative ? `A Favor: $ ${formatNumber(Math.abs(item.saldoPendiente))}` : `$ ${formatNumber(item.saldoPendiente)}`}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Bs. {formatNumber(Math.abs(item.saldoPendiente) * currentTasa)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setPagoForm({
                                ...pagoForm,
                                proveedorId: item.id
                              });
                              setActiveTab('pago');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg text-xs font-bold transition-all border border-rose-200 hover:border-rose-600 shadow-2xs whitespace-nowrap cursor-pointer"
                            title="Registrar pago a este proveedor"
                          >
                            <DollarSign size={12} />
                            <span>Pagar</span>
                          </button>
                          
                          <button
                            onClick={() => setSelectedSupplier(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-800 text-slate-700 hover:text-white rounded-lg text-xs font-bold transition-all border border-slate-200 hover:border-slate-800 shadow-2xs whitespace-nowrap cursor-pointer"
                            title="Ver Estado de Cuenta y Facturas de Compra"
                          >
                            <Eye size={12} />
                            <span>Ver Detalle</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedGroupedData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-14 text-center text-slate-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Briefcase size={32} className="mx-auto text-slate-300" />
                        <p className="font-semibold text-slate-600 text-sm">No se encontraron proveedores</p>
                        <p className="text-xs text-slate-400">
                          {searchTerm ? `Ningún proveedor coincide con "${searchTerm}".` : 'No hay registros en la categoría seleccionada.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {groupedData.length > 0 && (
                <tfoot className="bg-slate-50/90 border-t border-slate-200 font-bold text-slate-800 text-xs">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-wider text-[11px] text-slate-600">
                      TOTALES GENERALES ({groupedData.length} registros):
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-slate-900">$ {formatNumber(totals.montoAdeudo)}</div>
                      <div className="text-[10px] text-slate-400">Bs. {formatNumber(totals.montoAdeudo * currentTasa)}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600">
                      <div className="font-bold text-emerald-700">$ {formatNumber(totals.abonosAplicados)}</div>
                      <div className="text-[10px] text-emerald-500">Bs. {formatNumber(totals.abonosAplicados * currentTasa)}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-rose-700">
                      <div className="font-black text-sm text-rose-900">$ {formatNumber(totals.saldoPendiente)}</div>
                      <div className="text-[10px] text-rose-500">Bs. {formatNumber(totals.saldoPendiente * currentTasa)}</div>
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Paginación */}
          {groupedData.length > 0 && (
            <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
              <div>
                Mostrando <span className="font-bold text-slate-800">{(mainTablePage - 1) * MAIN_TABLE_ITEMS_PER_PAGE + 1}</span> a <span className="font-bold text-slate-800">{Math.min(mainTablePage * MAIN_TABLE_ITEMS_PER_PAGE, groupedData.length)}</span> de <span className="font-bold text-slate-800">{groupedData.length}</span> {getEntityLabel().toLowerCase()}s
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMainTablePage(p => Math.max(1, p - 1))}
                  disabled={mainTablePage === 1}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
                >
                  Anterior
                </button>
                <span className="text-xs font-bold px-2 text-slate-700">
                  Página {mainTablePage} de {totalMainPages}
                </span>
                <button
                  onClick={() => setMainTablePage(p => Math.min(totalMainPages, p + 1))}
                  disabled={mainTablePage >= totalMainPages}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSupplierDetail = () => {
    if (!currentSupplier) return null;

    const getEntityLabel = () => {
      const tab = tabs.find(t => t.id === activeTab);
      return tab ? tab.label.slice(0, -1) : 'Entidad';
    };

    const contactObj = (contactos || []).find((c: any) => 
      String(c.id) === String(currentSupplier.id) || 
      String(c.taxId) === String(currentSupplier.id) || 
      (c.name && c.name.toLowerCase() === currentSupplier.proveedor?.toLowerCase())
    );

    // Aging analysis calculation for supplier deudas
    const todayTs = new Date().setHours(0,0,0,0);
    let porVencer = 0;
    let dias0a30 = 0;
    let dias31a60 = 0;
    let dias61a90 = 0;
    let diasMas90 = 0;
    let hasOverdueInvoices = false;

    (currentSupplier.documentos || []).forEach((d: any) => {
      const saldoVal = Number(d.saldo !== undefined ? d.saldo : d.total) || 0;
      if (saldoVal > 0 && d.estado !== 'anulada' && d.tipo !== 'anticipo') {
        const vDate = d.vencimiento ? new Date(d.vencimiento).getTime() : (d.fecha ? new Date(d.fecha).getTime() : todayTs);
        const diffDays = Math.floor((todayTs - vDate) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) {
          porVencer += saldoVal;
        } else if (diffDays <= 30) {
          dias0a30 += saldoVal;
          hasOverdueInvoices = true;
        } else if (diffDays <= 60) {
          dias31a60 += saldoVal;
          hasOverdueInvoices = true;
        } else if (diffDays <= 90) {
          dias61a90 += saldoVal;
          hasOverdueInvoices = true;
        } else {
          diasMas90 += saldoVal;
          hasOverdueInvoices = true;
        }
      }
    });

    const totalDeudaAging = porVencer + dias0a30 + dias31a60 + dias61a90 + diasMas90;

    // Anticipos otorgados / a favor nuestro disponibles
    const totalAnticiposDisponibles = (currentSupplier.documentos || []).reduce((sum: number, d: any) => {
      if ((d.tipo === 'anticipo' || Number(d.total) < 0 || Number(d.saldo) < 0) && d.estado !== 'anulada') {
        return sum + Math.abs(Number(d.saldo !== undefined ? d.saldo : d.total) || 0);
      }
      return sum;
    }, 0);

    // WhatsApp URL
    const phoneNum = contactObj?.phone ? contactObj.phone.replace(/[^0-9]/g, '') : '';
    const waMessage = `Estimado(a) *${currentSupplier.proveedor}*,\nLe compartimos el resumen de facturas y pagos pendientes de nuestra empresa:\n\n📌 *Saldo Pendiente por Pagar:* $${formatoES(Math.max(0, currentSupplier.saldoPendiente))}\n💵 *Pagos Aplicados:* $${formatoES(currentSupplier.abonosAplicados)}\n📊 *Total Facturado:* $${formatoES(currentSupplier.montoAdeudo)}\n\n_Departamento de Finanzas & Tesorería_`;
    const waUrl = phoneNum ? `https://wa.me/${phoneNum}?text=${encodeURIComponent(waMessage)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(waMessage)}`;

    let saldoAcumulado = historialProveedor.saldoInicial;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        {/* CABECERA COMPACTA EJECUTIVA DE ESTADO DE CUENTA PROVEEDOR */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col gap-3">
          {/* Fila 1: Entidad, RIF, Estado y Acciones Directas */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <BackButton onClick={() => setSelectedSupplier(null)} label="Volver" />
              
              <div className="h-5 w-px bg-slate-200 hidden sm:block" />

              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                {currentSupplier.proveedor}
              </h2>

              <span className="font-mono bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-xs">
                {contactObj?.taxId || currentSupplier.id}
              </span>

              {/* Status Badge */}
              {currentSupplier.saldoPendiente < -0.01 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-[11px] font-bold">
                  <Coins size={11} /> Saldo a Favor
                </span>
              ) : hasOverdueInvoices ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[11px] font-bold">
                  <AlertTriangle size={11} /> En Mora
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
                  <CheckCircle size={11} /> Al Día
                </span>
              )}

              {contactObj?.phone && (
                <span className="hidden xl:flex items-center gap-1 text-[11px] text-slate-500">
                  <Phone size={12} className="text-slate-400" /> {contactObj.phone}
                </span>
              )}
              {contactObj?.email && (
                <span className="hidden 2xl:flex items-center gap-1 text-[11px] text-slate-500">
                  <Mail size={12} className="text-slate-400" /> {contactObj.email}
                </span>
              )}
            </div>

            {/* Acciones Rápidas */}
            <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
              <button 
                onClick={() => {
                  setPagoForm(prev => ({ ...prev, proveedorId: currentSupplier.id }));
                  setActiveTab('pago');
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <DollarSign size={14} />
                <span>Registrar Pago</span>
              </button>

              <button 
                onClick={() => {
                  setAnticipoForm(prev => ({
                    ...prev,
                    proveedor: currentSupplier.proveedor,
                    proveedor_id: currentSupplier.id
                  }));
                  setShowAnticipoModal(true);
                }}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>Anticipo</span>
              </button>

              {(() => {
                const maxReintegro = currentSupplier.saldoPendiente < -0.009 ? Math.abs(currentSupplier.saldoPendiente) : 0;
                if (maxReintegro > 0.009) {
                  return (
                    <button 
                      onClick={() => {
                        setReintegroForm({
                          monto: maxReintegro.toFixed(2),
                          bancoId: bancos[0]?.id || '',
                          referencia: `REINT-${Date.now().toString().slice(-4)}`,
                          fecha: new Date().toISOString().split('T')[0],
                          notas: `Reintegro de saldo a favor de ${currentSupplier.proveedor}`
                        });
                        setShowReintegroModal(true);
                      }}
                      className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1"
                    >
                      <RotateCcw size={13} />
                      <span>Reintegrar ($ {formatNumber(maxReintegro)})</span>
                    </button>
                  );
                }
                return null;
              })()}

              <a 
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
                title="WhatsApp"
              >
                <MessageSquare size={13} className="text-emerald-600" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>

              <button 
                onClick={() => window.print()}
                className="p-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all border border-slate-200 flex items-center gap-1 cursor-pointer"
                title="Imprimir"
              >
                <Printer size={13} />
                <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          </div>

          {/* Fila 2: Tira Compacta de Indicadores Financieros y Antigüedad */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 p-2.5 px-3.5 rounded-xl border border-slate-100 text-xs">
            {/* Indicadores Financieros Clave */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Facturado / Causado</span>
                <span className="font-bold text-slate-800 font-mono text-sm">$ {formatNumber(currentSupplier.montoAdeudo)}</span>
              </div>

              <div className="h-6 w-px bg-slate-200" />

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Pagos Aplicados</span>
                <span className="font-bold text-emerald-600 font-mono text-sm">$ {formatNumber(currentSupplier.abonosAplicados)}</span>
              </div>

              <div className="h-6 w-px bg-slate-200" />

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {currentSupplier.saldoPendiente < -0.01 ? "Saldo a Favor" : "Saldo por Pagar"}
                </span>
                <span className={`font-black font-mono text-sm ${
                  currentSupplier.saldoPendiente < -0.01 ? "text-teal-600" : currentSupplier.saldoPendiente <= 0.01 ? "text-slate-400" : "text-rose-700"
                }`}>
                  $ {formatNumber(Math.abs(currentSupplier.saldoPendiente))}
                </span>
                <span className="text-[10px] text-slate-400 ml-1.5">
                  (Bs. {formatNumber(Math.abs(currentSupplier.saldoPendiente) * currentTasa)})
                </span>
              </div>

              {totalAnticiposDisponibles > 0 && (
                <>
                  <div className="h-6 w-px bg-slate-200" />
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Anticipos Disp.</span>
                    <span className="font-bold text-teal-600 font-mono text-sm">$ {formatNumber(totalAnticiposDisponibles)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Antigüedad de Saldos Compacta */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 hidden md:inline">Vencimiento:</span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-800 font-medium">
                Por Vencer: <b className="font-mono">${formatNumber(porVencer)}</b>
              </span>
              {dias0a30 > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200/60 text-amber-800 font-medium">
                  1-30d: <b className="font-mono">${formatNumber(dias0a30)}</b>
                </span>
              )}
              {dias31a60 > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-orange-50 border border-orange-200/60 text-orange-800 font-medium">
                  31-60d: <b className="font-mono">${formatNumber(dias31a60)}</b>
                </span>
              )}
              {dias61a90 > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200/60 text-rose-800 font-medium">
                  61-90d: <b className="font-mono">${formatNumber(dias61a90)}</b>
                </span>
              )}
              {diasMas90 > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-red-100 border border-red-200 text-red-900 font-bold">
                  +90d: <b className="font-mono">${formatNumber(diasMas90)}</b>
                </span>
              )}
              {!hasOverdueInvoices && porVencer === 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-medium text-[10px]">
                  Sin facturas por pagar
                </span>
              )}
            </div>
          </div>
        </div>

        {/* TABLA DE DETALLES Y MOVIMIENTOS */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Header & Filter Bar de la Tabla */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-rose-600" />
              <h3 className="text-sm font-black text-slate-800">
                Historial de Documentos & Pagos
              </h3>
            </div>

            {/* Filtros de período */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Período:</span>
                <select 
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-indigo-600 outline-none" 
                  value={filtrosHistorial.tipo} 
                  onChange={e=>setFiltrosHistorial({...filtrosHistorial, tipo: e.target.value})}
                >
                  <option value="todo">Historial Completo</option>
                  <option value="mes">Por Mes</option>
                  <option value="ano">Por Año</option>
                  <option value="rango">Rango de Fechas</option>
                </select>
              </div>

              {filtrosHistorial.tipo==='mes' && (
                <div className="flex items-center gap-1.5">
                  <select 
                    className="px-2 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none" 
                    value={filtrosHistorial.mes} 
                    onChange={e=>setFiltrosHistorial({...filtrosHistorial, mes: e.target.value})}
                  >
                    {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m,i)=><option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
                  </select>
                  <select 
                    className="px-2 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none" 
                    value={filtrosHistorial.ano} 
                    onChange={e=>setFiltrosHistorial({...filtrosHistorial, ano: e.target.value})}
                  >
                    {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}

              {filtrosHistorial.tipo==='rango' && (
                <div className="flex items-center gap-1.5">
                  <input 
                    type="date" 
                    className="px-2 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none" 
                    value={filtrosHistorial.desde} 
                    onChange={e=>setFiltrosHistorial({...filtrosHistorial, desde: e.target.value})}
                  />
                  <span className="text-xs text-slate-400">a</span>
                  <input 
                    type="date" 
                    className="px-2 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none" 
                    value={filtrosHistorial.hasta} 
                    onChange={e=>setFiltrosHistorial({...filtrosHistorial, hasta: e.target.value})}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider select-none">
                <tr>
                  <th className="px-5 py-3.5">Emisión / Venc.</th>
                  <th className="px-5 py-3.5">N° Documento</th>
                  <th className="px-5 py-3.5">Concepto / Detalle</th>
                  <th className="px-5 py-3.5 text-center">Estatus</th>
                  <th className="px-5 py-3.5 text-right">Cargo</th>
                  <th className="px-5 py-3.5 text-right">Abono</th>
                  <th className="px-5 py-3.5 text-right">Saldo</th>
                  <th className="px-5 py-3.5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrosHistorial.tipo !== 'todo' && (
                  <tr className="bg-indigo-50/50 border-b-2 border-indigo-100 text-xs font-bold text-indigo-700">
                    <td className="px-5 py-3" colSpan={4}>
                      <CornerDownRight className="w-4 h-4 inline mr-2 text-indigo-400"/> 
                      Saldo Arrastrado al Período
                    </td>
                    <td className="px-5 py-3 text-right">-</td>
                    <td className="px-5 py-3 text-right">-</td>
                    <td className="px-5 py-3 text-right font-black text-sm">${formatoES(historialProveedor.saldoInicial)}</td>
                    <td></td>
                  </tr>
                )}

                {historialProveedor.movs.map((item: any, i: number) => {
                  let cargo = item.__cargo || 0;
                  let abono = item.__abono || 0;
                  let docId = '';
                  let descripcion = '';
                  let isPago = item._tipo === 'pago';
                  const isReintegro = item.tipo === 'reintegro';
                  const isAnticipo = item.tipo === 'anticipo' || Number(item.total) < 0;

                  if (isPago) {
                    docId = item.referencia || item.comprobantePago || (isUUID(item.id) ? `REC-${item.id.slice(0, 8).toUpperCase()}` : item.id);
                    const appliedAnt = Number(item.totalAnticiposAplicados) || Number(item.anticiposAplicados) || 0;
                    if (appliedAnt > 0) {
                      descripcion = `Pago a proveedor ${item.proveedorNombre || ''} (Anticipo aplicado: $${formatoES(appliedAnt)})`;
                    } else {
                      descripcion = item.descripcion || `Pago a proveedor ${item.proveedorNombre || ''}`;
                    }
                  } else {
                    docId = getCleanDocNumber(item);
                    descripcion = item.descripcion || (isAnticipo ? 'Anticipo Otorgado' : 'Factura / Cargo');
                  }

                  saldoAcumulado += (cargo - abono);

                  // Days overdue calculation
                  const todayTsLocal = new Date().setHours(0,0,0,0);
                  const vencTs = item.vencimiento ? new Date(item.vencimiento).getTime() : (item.fecha ? new Date(item.fecha).getTime() : todayTsLocal);
                  const diffDays = Math.floor((todayTsLocal - vencTs) / (1000 * 60 * 60 * 24));
                  const isOverdue = !isPago && !isAnticipo && !isReintegro && (item.saldo > 0.009 || item.saldo === undefined) && diffDays > 0;

                  return (
                    <tr key={item.id || i} className={`hover:bg-slate-50/80 transition-colors ${isPago ? 'bg-slate-50/40' : ''}`}>
                      <td className="px-5 py-3.5 text-xs text-slate-600 font-medium">
                        <div className="font-bold text-slate-800">
                          {(item.fechaStr || item.fecha || '').split('T')[0].split('-').reverse().join('/')}
                        </div>
                        {item.vencimiento && !isPago && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Vence: {item.vencimiento.split('T')[0].split('-').reverse().join('/')}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-rose-600">
                        <div className="flex items-center gap-1.5">
                          {isPago && <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                          <span>{docId}</span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-slate-700 font-medium max-w-xs truncate" title={descripcion}>
                        {descripcion}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        {isPago ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                            Pagado
                          </span>
                        ) : isReintegro ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-[10px] font-bold">
                            Reintegrado
                          </span>
                        ) : isAnticipo ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-[10px] font-bold">
                            Anticipo
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-bold">
                            Vencida ({diffDays}d)
                          </span>
                        ) : (item.saldo || 0) <= 0.009 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                            Liquidada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                            Por Vencer
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right font-medium text-slate-800 text-xs">
                        {cargo > 0 ? `$${formatoES(cargo)}` : '-'}
                      </td>

                      <td className="px-5 py-3.5 text-right font-medium text-emerald-600 text-xs">
                        {abono > 0 ? `$${formatoES(abono)}` : '-'}
                      </td>

                      <td className={`px-5 py-3.5 text-right font-black text-xs ${saldoAcumulado < 0 ? 'text-teal-600' : 'text-slate-800'}`}>
                        ${formatoES(saldoAcumulado)}
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        {!isPago && (() => {
                          const docTotal = Number(item.total) || Number(item.monto) || 0;
                          const docSaldo = item.saldo !== undefined ? Number(item.saldo) : docTotal;
                          const isPaidDoc = item.estado === 'pagada' || item.estado === 'liquidada' || (docTotal > 0 && docSaldo <= 0.009);
                          const hasPartialPayment = docTotal > 0 && docSaldo < docTotal - 0.009;

                          if (isPaidDoc || hasPartialPayment) {
                            return (
                              <span 
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-md text-[10px] font-bold select-none cursor-not-allowed"
                                title={isPaidDoc ? "Esta cuenta por pagar ya está totalmente pagada. No se permite modificar ni eliminar." : "Esta cuenta por pagar ya tiene pagos o anticipos aplicados. Para modificarla o eliminarla debe anular primero el pago correspondiente."}
                              >
                                <Lock size={11} className="text-slate-400" />
                                <span>Bloqueada</span>
                              </span>
                            );
                          }

                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMasterAuth({
                                  isOpen: true,
                                  title: 'Autorización Master Requerida',
                                  actionName: 'Eliminar Cuenta por Pagar',
                                  actionDetails: `Documento ${getCleanDocNumber(item)} - Monto: $${formatoES(item.total || item.monto)} (${currentSupplier?.proveedor || ''})`,
                                  onSuccess: async () => {
                                    onSave?.('cxp', { id: item.id, _delete: true });

                                    const bankMovId = item.id.replace('-cxp', '');
                                    const matchedMov = (movimientosBancos || []).find((m: any) => String(m.id) === String(bankMovId));
                                    if (matchedMov) {
                                      onSave?.('movimientosBancos', { id: matchedMov.id, _delete: true });
                                    }

                                    if (comprobantes && comprobantes.length > 0) {
                                      const matchedComp = comprobantes.find((c: any) => 
                                        c.referencia === (item.factura_id || item.id) ||
                                        (matchedMov && c.referencia === matchedMov.ref)
                                      );
                                      if (matchedComp) {
                                        onSave?.('comprobantes', { id: matchedComp.id, _delete: true });
                                      }
                                    }

                                    if (showToast) showToast('Documento y sus impactos contables/bancarios vinculados han sido eliminados exitosamente.', 'success');
                                  }
                                });
                              }}
                              className="inline-flex items-center gap-1 p-1 px-2.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors cursor-pointer"
                              title="Eliminar documento"
                            >
                              <Trash2 size={13} />
                              <span>Eliminar</span>
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}

                {historialProveedor.movs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No hay movimientos registrados para esta entidad en el período seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800 text-xs">
                <tr>
                  <td colSpan={4} className="px-5 py-3.5 text-right uppercase tracking-wider text-[10px]">TOTALES DEL PERÍODO:</td>
                  <td className="px-5 py-3.5 text-right">${formatoES(historialProveedor.movs.reduce((sum: number, item: any) => sum + (item.__cargo || 0), 0))}</td>
                  <td className="px-5 py-3.5 text-right text-emerald-600">${formatoES(historialProveedor.movs.reduce((sum: number, item: any) => sum + (item.__abono || 0), 0))}</td>
                  <td className="px-5 py-3.5 text-right text-rose-700">${formatoES(historialProveedor.saldoInicial + historialProveedor.movs.reduce((sum: number, item: any) => sum + (item.__cargo || 0) - (item.__abono || 0), 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderPago = () => {
    const hasVESBank = pagoForm.pagos.some(p => {
      const selB = bancos.find(b => b.id === p.bancoId);
      return selB && (selB.moneda === 'VES' || selB.moneda === 'Bs' || selB.moneda === 'Bs.' || selB.moneda === 'Bolivares');
    });

    return (
      <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-300">
        {/* Columna Izquierda: Formulario de Pago y Métodos */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex-1">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-rose-600" />
              Detalles del Pago
            </h3>
            
            <div className="space-y-5">
              {/* Fecha de Pago */}
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Pago</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all font-medium text-slate-700"
                  value={pagoForm.fecha}
                  onChange={e => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                />
              </div>

              {/* Selector de Proveedor */}
              <div className="flex flex-col pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Proveedor / Entidad</label>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    <button 
                      type="button"
                      onClick={() => setEntityFilters(prev => ({...prev, proveedores: !prev.proveedores}))}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${entityFilters.proveedores ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      title="Proveedores"
                    >Proveedores</button>
                    <button 
                      type="button"
                      onClick={() => setEntityFilters(prev => ({...prev, intercompanias: !prev.intercompanias}))}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-colors ${entityFilters.intercompanias ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      title="Intercompañías"
                    >Intercomp.</button>
                    <button 
                      type="button"
                      onClick={() => setEntityFilters(prev => ({...prev, accionistas: !prev.accionistas}))}
                      className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md transition-colors ${entityFilters.accionistas ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      title="Accionistas"
                    >Accionistas</button>
                  </div>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    readOnly
                    placeholder="Haga click para buscar entidad..."
                    value={selectedSupplierObj ? `${selectedSupplierObj.nombre} (${selectedSupplierObj.categoria})` : ''}
                    onClick={() => setIsPagoSupplierModalOpen(true)}
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 border border-slate-200 rounded-xl text-sm focus:bg-white outline-none transition-all font-bold text-slate-800 cursor-pointer text-left"
                  />
                  <button 
                    type="button"
                    onClick={() => setIsPagoSupplierModalOpen(true)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 transition-colors"
                  >
                    <Search size={16} />
                  </button>
                </div>
              </div>

              {/* SECCIÓN MÉTODOS DE PAGO MULTIPLES */}
              <div className="pt-4 border-t border-slate-100 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Building className="w-4 h-4 text-rose-500" />
                    Métodos de Pago
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const currentSum = pagoForm.pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
                      const pending = Math.max(0, Number((montoBanco - currentSum).toFixed(2)));
                      const newPago = {
                        id: crypto.randomUUID(),
                        bancoId: '',
                        metodo: 'Transferencia',
                        terminalId: '',
                        referencia: '',
                        monto: pending > 0 ? pending.toString() : '',
                        montoBs: ''
                      };
                      setPagoForm({ ...pagoForm, pagos: [...pagoForm.pagos, newPago] });
                    }}
                    className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md hover:bg-rose-100 transition-colors cursor-pointer"
                  >
                    + Agregar Pago
                  </button>
                </div>

                <div className="space-y-3">
                  {pagoForm.pagos.map((pago, idx) => {
                    const selB = bancos.find(b => b.id === pago.bancoId);
                    const isCaja = !!(selB?.es_caja || (selB?.tipo || '').toLowerCase().includes('caja') || (selB?.banco || '').toLowerCase().includes('caja'));
                    const isUSD = !isCaja && (selB?.moneda === 'USD' || selB?.moneda === 'Dolares');
                    const isBVES = !isCaja && (selB?.moneda === 'VES' || selB?.moneda === 'Bs' || selB?.moneda === 'Bs.' || selB?.moneda === 'Bolivares' || selB?.moneda === 'Bolívares');

                    // Available methods based on account type
                    let availableMethods = ['Transferencia', 'Depósito', 'Punto de Venta', 'Pago Móvil', 'Efectivo', 'Zelle', 'Binance'];
                    if (isCaja) {
                      availableMethods = ['Efectivo'];
                    } else if (isUSD) {
                      availableMethods = ['Transferencia', 'Depósito', 'Zelle', 'Binance', 'Punto de Venta'];
                    } else if (isBVES) {
                      availableMethods = ['Transferencia', 'Depósito', 'Pago Móvil', 'Punto de Venta'];
                    }

                    const isPos = pago.metodo === 'Punto de Venta';
                    const activeTerminals = terminalesPos.filter(t => t.activo !== false);
                    const selectedTerm = isPos
                      ? (terminalesPos.find(t => t.id === pago.terminalId) || activeTerminals[0] || terminalesPos[0])
                      : null;
                    const isTermUSD = selectedTerm ? (selectedTerm.tipo_cuenta === 'internacional' || selectedTerm.moneda === 'USD') : false;
                    const isEffectiveVES = isPos ? !isTermUSD : isBVES;

                    return (
                      <div key={pago.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl relative group space-y-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            const newPagos = [...pagoForm.pagos];
                            newPagos.splice(idx, 1);
                            setPagoForm({ ...pagoForm, pagos: newPagos });
                          }}
                          className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-80 hover:opacity-100 transition-opacity shadow-sm z-10"
                          title="Eliminar método de pago"
                        >
                          <X size={12} />
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Cuenta o Caja */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-black text-slate-500 uppercase">Cuenta / Caja</label>
                              {isCaja && <span className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.2 rounded">Caja</span>}
                            </div>
                            <select 
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-rose-500"
                              value={pago.bancoId}
                              onChange={e => {
                                const newBankId = e.target.value;
                                const newB = bancos.find(b => b.id === newBankId);
                                const newIsCaja = !!(newB?.es_caja || (newB?.tipo || '').toLowerCase().includes('caja') || (newB?.banco || '').toLowerCase().includes('caja'));
                                const newIsUSD = !newIsCaja && (newB?.moneda === 'USD' || newB?.moneda === 'Dolares');
                                const newIsVES = !newIsCaja && (newB?.moneda === 'VES' || newB?.moneda === 'Bs' || newB?.moneda === 'Bs.' || newB?.moneda === 'Bolivares');

                                let newMetodo = pago.metodo;
                                if (newIsCaja) {
                                  newMetodo = 'Efectivo';
                                } else if (newIsUSD && !['Transferencia', 'Depósito', 'Zelle', 'Binance', 'Punto de Venta'].includes(newMetodo || '')) {
                                  newMetodo = 'Transferencia';
                                } else if (newIsVES && !['Transferencia', 'Depósito', 'Pago Móvil', 'Punto de Venta'].includes(newMetodo || '')) {
                                  newMetodo = 'Transferencia';
                                }

                                const newPagos = [...pagoForm.pagos];
                                newPagos[idx].bancoId = newBankId;
                                newPagos[idx].metodo = newMetodo;
                                setPagoForm({ ...pagoForm, pagos: newPagos });
                              }}
                            >
                              <option value="">Seleccione banco o caja...</option>
                              {bancos.map(b => {
                                const isBox = !!(b.es_caja || (b.tipo || '').toLowerCase().includes('caja') || (b.banco || '').toLowerCase().includes('caja'));
                                return (
                                  <option key={b.id} value={b.id}>
                                    {isBox ? '💵 [Caja]' : '🏦 [Banco]'} {b.banco} ({b.moneda})
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Método de Pago */}
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Método de Pago</label>
                            <select
                              value={pago.metodo || availableMethods[0]}
                              onChange={e => {
                                const val = e.target.value;
                                const newPagos = [...pagoForm.pagos];
                                newPagos[idx].metodo = val;
                                if (val === 'Punto de Venta' && activeTerminals.length > 0 && !newPagos[idx].terminalId) {
                                  newPagos[idx].terminalId = activeTerminals[0].id;
                                  if (activeTerminals[0].banco_id) {
                                    newPagos[idx].bancoId = activeTerminals[0].banco_id;
                                  }
                                }
                                setPagoForm({ ...pagoForm, pagos: newPagos });
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-rose-500"
                            >
                              {availableMethods.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Si es Punto de Venta: Selector de Terminal Configurado */}
                        {isPos && (
                          <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold text-amber-800 uppercase flex items-center gap-1">
                                <CreditCard size={12} />
                                <span>Terminal Configurado (Punto de Venta) *</span>
                              </label>
                              {isTermUSD ? (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                                  Internacional USD (Sin Tasa)
                                </span>
                              ) : (
                                <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                                  Nacional VES (Tasa BCV)
                                </span>
                              )}
                            </div>
                            <select
                              value={pago.terminalId || (activeTerminals[0]?.id || '')}
                              onChange={e => {
                                const termId = e.target.value;
                                const term = terminalesPos.find(t => t.id === termId);
                                const newPagos = [...pagoForm.pagos];
                                newPagos[idx].terminalId = termId;
                                if (term?.banco_id) newPagos[idx].bancoId = term.banco_id;
                                if (term?.tipo_cuenta === 'internacional' || term?.moneda === 'USD') {
                                  newPagos[idx].montoBs = '';
                                }
                                setPagoForm({ ...pagoForm, pagos: newPagos });
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                            >
                              {activeTerminals.length === 0 ? (
                                <option value="">No hay terminales configurados</option>
                              ) : (
                                activeTerminals.map(t => {
                                  const isInt = t.tipo_cuenta === 'internacional' || t.moneda === 'USD';
                                  return (
                                    <option key={t.id} value={t.id}>
                                      {t.nombre} ({t.codigo}) - {isInt ? 'Internacional USD (Directo)' : 'Nacional VES (Tasa BCV)'}
                                    </option>
                                  );
                                })
                              )}
                            </select>
                          </div>
                        )}

                        {/* Referencia y Monto */}
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            type="text" 
                            placeholder="Referencia"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-rose-500"
                            value={pago.referencia}
                            onChange={e => {
                              const newPagos = [...pagoForm.pagos];
                              newPagos[idx].referencia = e.target.value;
                              setPagoForm({ ...pagoForm, pagos: newPagos });
                            }}
                          />
                          {isEffectiveVES ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">Bs.</span>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  placeholder="Monto Bs"
                                  className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-rose-500"
                                  value={pago.montoBs || ''}
                                  onChange={e => {
                                    const newPagos = [...pagoForm.pagos];
                                    const valBs = e.target.value;
                                    newPagos[idx].montoBs = valBs;
                                    const t = Number(pagoForm.tasa) || currentTasa || 1;
                                    if (t > 0 && valBs) {
                                      newPagos[idx].monto = (Number(valBs) / t).toFixed(2);
                                    } else {
                                      newPagos[idx].monto = '';
                                    }
                                    setPagoForm({ ...pagoForm, pagos: newPagos });
                                  }}
                                />
                              </div>
                              {Number(pago.monto) > 0 && (
                                <div className="text-[10px] text-slate-500 font-bold ml-1">
                                  Eqv: $ {formatNumber(pago.monto)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                              <input 
                                type="number" 
                                step="0.01"
                                placeholder="Monto USD"
                                className="w-full pl-6 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-rose-500"
                                value={pago.monto}
                                onChange={e => {
                                  const newPagos = [...pagoForm.pagos];
                                  newPagos[idx].monto = e.target.value;
                                  newPagos[idx].montoBs = '';
                                  setPagoForm({ ...pagoForm, pagos: newPagos });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {pagoForm.pagos.length === 0 && (
                    <div className="text-center py-4 text-xs font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      No hay métodos de pago agregados. Haga clic en "+ Agregar Pago".
                    </div>
                  )}
                </div>
              </div>

              {/* Tasa General si aplica (visible si algún banco es VES) */}
              {hasVESBank && (
                <div className="flex flex-col pt-2 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tasa BCV (Bs./$)</label>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Oficial</span>
                  </div>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-500"
                    value={pagoForm.tasa || currentTasa}
                    onChange={e => {
                      const newTasa = Number(e.target.value);
                      const updatedPagos = pagoForm.pagos.map(p => {
                        if (p.montoBs && newTasa > 0) {
                          return { ...p, monto: (Number(p.montoBs) / newTasa).toFixed(2) };
                        }
                        return p;
                      });
                      setPagoForm({ ...pagoForm, tasa: newTasa, pagos: updatedPagos });
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Facturas a Pagar y Resumen */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          {pagoForm.proveedorId ? (
            <>
              {/* Resumen a Pagar */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg p-6 text-white flex flex-col sm:flex-row justify-between items-center gap-6 relative overflow-hidden">
                <div className="relative z-10 w-full sm:w-auto text-center sm:text-left flex flex-col gap-2">
                  <div className="flex justify-between items-center gap-8 text-slate-300 text-sm">
                    <span>Total Facturas Seleccionadas:</span>
                    <span className="font-bold text-white">$ {formatNumber(totalFacturasAplicadas)}</span>
                  </div>
                  
                  {totalAnticiposDisponibles > 0 && (
                    <div className="flex justify-between items-center gap-8 text-emerald-300 text-sm mt-1 pt-1 border-t border-slate-700">
                      <span>Anticipos Disponibles:</span>
                      <span className="font-bold text-emerald-400">$ {formatNumber(totalAnticiposDisponibles)}</span>
                    </div>
                  )}

                  {totalAnticiposDisponibles > 0 && (
                    <div className="flex justify-between items-center gap-8 text-emerald-200 text-sm mt-1">
                      <span>Anticipo a Aplicar:</span>
                      <div className="relative w-32">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">$</span>
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          max={Math.min(totalFacturasAplicadas, totalAnticiposDisponibles)}
                          className="w-full pl-6 pr-2 py-1 text-xs border-none rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none font-bold text-emerald-900 bg-emerald-50 shadow-inner text-right"
                          placeholder="0,00"
                          value={anticipoGlobal}
                          onChange={(e) => {
                            let val = Number(e.target.value);
                            if (val < 0) val = 0;
                            const max = Math.min(totalFacturasAplicadas, totalAnticiposDisponibles);
                            if (val > max) val = max;
                            setAnticipoGlobal(e.target.value === '' ? '' : val.toString());
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="h-px w-full bg-slate-700 my-1" />
                  
                  <div className="flex justify-between items-end gap-8 mt-1">
                    <span className="text-slate-300 font-medium text-xs uppercase tracking-wider mb-1">Total Neto por Pagar</span>
                    <div className="flex items-baseline gap-3">
                      <p className="text-2xl sm:text-3xl font-black tracking-tight text-white">$ {formatNumber(montoBanco)}</p>
                    </div>
                  </div>

                  {/* Estado de Cobertura con Métodos de Pago */}
                  <div className="flex justify-between items-center gap-8 text-xs pt-1">
                    <span className="text-slate-400">Total en Métodos de Pago:</span>
                    <span className={`font-black text-sm ${Math.abs(sumPagosDisplay - montoBanco) <= 0.01 && montoBanco > 0 ? 'text-emerald-400' : sumPagosDisplay > montoBanco ? 'text-amber-400' : 'text-rose-400'}`}>
                      $ {formatNumber(sumPagosDisplay)}
                    </span>
                  </div>

                  {montoBanco > 0 && (
                    <div className="mt-1">
                      {sumPagosDisplay < montoBanco - 0.01 ? (
                        <div className="text-xs bg-rose-500/20 text-rose-300 px-2.5 py-1 rounded-lg border border-rose-500/30 flex items-center gap-1.5 font-semibold">
                          <AlertTriangle size={13} /> Faltan $ {formatNumber(montoBanco - sumPagosDisplay)} por cubrir
                        </div>
                      ) : sumPagosDisplay > montoBanco + 0.01 ? (
                        <div className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30 flex items-center gap-1.5 font-semibold">
                          <AlertTriangle size={13} /> Excedente de $ {formatNumber(sumPagosDisplay - montoBanco)} (el pago supera las facturas seleccionadas)
                        </div>
                      ) : (
                        <div className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/30 flex items-center gap-1.5 font-semibold">
                          <CheckCircle size={13} /> Monto cubierto y cuadrado en su totalidad ($ {formatNumber(montoBanco)})
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleProcesarPago}
                  disabled={totalFacturasAplicadas <= 0 || (montoBanco > 0 && Math.abs(sumPagosDisplay - montoBanco) > 0.01)}
                  className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:hover:bg-emerald-500 text-slate-950 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed text-sm whitespace-nowrap"
                >
                  <CheckCircle size={18} />
                  <span>Procesar Pago</span>
                </button>
              </div>

              {/* Lista de Facturas Pendientes */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-rose-600" />
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Facturas Pendientes por Pagar ({selectedSupplierDebts.length})
                    </h4>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 w-10">Pagar</th>
                        <th className="py-2.5 px-4">Fecha</th>
                        <th className="py-2.5 px-4">N° Factura</th>
                        <th className="py-2.5 px-4">Detalle</th>
                        <th className="py-2.5 px-4 text-right">Total</th>
                        <th className="py-2.5 px-4 text-right">Saldo</th>
                        <th className="py-2.5 px-4 text-right w-36">Monto a Pagar ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSupplierDebts.map((item) => {
                        const total = Math.abs(Number(item.total) || 0);
                        const saldo = Math.abs(Number(item.saldo !== undefined ? item.saldo : item.total) || 0);
                        const isApplied = abonos[item.id] !== undefined && abonos[item.id] !== '';

                        return (
                          <tr key={item.id} className={`hover:bg-slate-50/80 transition-colors ${isApplied ? 'bg-rose-50/20' : ''}`}>
                            <td className="py-3 px-4">
                              <input 
                                type="checkbox"
                                checked={isApplied}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    handlePagarTotal(item.id, saldo);
                                  } else {
                                    handleAbonoChange(item.id, '', saldo);
                                  }
                                }}
                                className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-600">{item.fecha}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{getCleanDocNumber(item)}</td>
                            <td className="py-3 px-4 text-slate-500 max-w-[180px] truncate">{item.descripcion || item.concepto || '-'}</td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-600">$ {formatNumber(total)}</td>
                            <td className="py-3 px-4 text-right font-black text-rose-600">$ {formatNumber(saldo)}</td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <span className="text-slate-400 font-bold">$</span>
                                <input 
                                  type="number"
                                  step="0.01"
                                  placeholder="0,00"
                                  className="w-24 px-2 py-1 text-right bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-rose-500"
                                  value={abonos[item.id] !== undefined ? abonos[item.id] : ''}
                                  onChange={(e) => handleAbonoChange(item.id, e.target.value, saldo)}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {selectedSupplierDebts.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-10 text-slate-400 font-medium">
                            No hay facturas pendientes para este proveedor.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-12 text-slate-400">
              <Landmark className="w-12 h-12 stroke-[1.5] mb-3 text-slate-300" />
              <p className="font-bold text-slate-600 mb-1">Ninguna entidad seleccionada</p>
              <p className="text-xs">Seleccione un proveedor para visualizar sus facturas y registrar métodos de pago.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="px-3 sm:px-6 pt-1 pb-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="mb-3.5">
        <div className="flex items-center gap-4 mb-2">
          {category ? (
            <BackButton to="/payables" label="Volver a Cuentas por Pagar" />
          ) : (
            <BackButton to="/" label="Volver al Inicio" />
          )}
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-rose-600" />
            {category ? tabs.find(t => t.id === category)?.label : 'Cuentas por Pagar'}
          </h2>
        </div>
        <p className="text-sm text-slate-500 font-medium mt-1">Gestión de obligaciones, pagos a proveedores y pasivos</p>
      </div>

      {/* Tabs */}
      {!category && (
        <div className="flex overflow-x-auto hide-scrollbar mb-6 bg-slate-200/50 p-1.5 rounded-xl gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedSupplier(null);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-white text-rose-700 shadow-sm ring-1 ring-slate-200/50' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-rose-600' : 'text-slate-400'} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {activeTab === 'pago' ? (
        renderPago()
      ) : activeTab === 'historial-pagos' ? (
        renderHistorialPagos()
      ) : (
        renderTable()
      )}

      {/* Modal Nuevo Préstamo */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Handshake size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Registrar Nuevo Préstamo</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                    Financiamiento recibido (Accionistas o Intercompañías) y Cuenta por Pagar
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowNewModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tipo / Origen del Préstamo</label>
                  <select
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-slate-700"
                    value={newMovForm.categoria || 'accionistas'}
                    onChange={e => {
                      const cat = e.target.value;
                      setNewMovForm({
                        ...newMovForm,
                        categoria: cat,
                        entidad: '',
                        entidad_id: '',
                        descripcion: cat === 'intercompanias' ? 'Préstamo recibido de intercompañía para financiamiento' : 'Préstamo recibido de accionista para financiamiento'
                      });
                    }}
                  >
                    <option value="accionistas">Accionista / Socio</option>
                    <option value="intercompanias">Intercompañía</option>
                  </select>
                </div>

                <div className="flex flex-col relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {newMovForm.categoria === 'intercompanias' ? 'Intercompañía Prestamista' : 'Accionista / Socio Prestamista'}
                  </label>
                  <div 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-indigo-500 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-slate-700 cursor-pointer flex justify-between items-center"
                    onClick={() => setIsNewMovSupplierModalOpen(true)}
                  >
                    <span className={newMovForm.entidad ? 'text-slate-800' : 'text-slate-400 font-normal'}>
                      {newMovForm.entidad || (newMovForm.categoria === 'intercompanias' ? 'Seleccionar intercompañía...' : 'Seleccionar accionista...')}
                    </span>
                    <Search className="w-4 h-4 text-indigo-500" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cuenta Bancaria (Ingreso a Banco)</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-slate-700"
                    value={newMovForm.bancoId}
                    onChange={e => setNewMovForm({...newMovForm, bancoId: e.target.value})}
                  >
                    <option value="">Seleccione cuenta bancaria destino...</option>
                    {bancos.map(b => (
                      <option key={b.id} value={b.id}>{b.banco} - {b.moneda} ({b.numeroCuenta || 'Principal'})</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Concepto / Motivo</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-slate-700"
                    placeholder="Ej. Préstamo de accionista para financiamiento de operación..."
                    value={newMovForm.descripcion}
                    onChange={e => setNewMovForm({...newMovForm, descripcion: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha Ingreso</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-slate-700"
                    value={newMovForm.fecha}
                    onChange={e => setNewMovForm({...newMovForm, fecha: e.target.value})}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha Vencimiento / Pago</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-slate-700"
                    value={newMovForm.fechaVencimiento || newMovForm.fecha}
                    onChange={e => setNewMovForm({...newMovForm, fechaVencimiento: e.target.value})}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">N° Documento / Referencia</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono font-bold text-slate-700"
                    placeholder="Ej. PREST-001"
                    value={newMovForm.referencia}
                    onChange={e => setNewMovForm({...newMovForm, referencia: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Monto del Préstamo (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      className="w-full pl-7 pr-4 py-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-black text-indigo-700"
                      placeholder="0.00"
                      value={newMovForm.monto}
                      onChange={e => {
                        const usdVal = e.target.value;
                        const tasaVal = parseFloat(newMovForm.tasa) || 1;
                        const bsVal = usdVal ? (parseFloat(usdVal) * tasaVal).toFixed(2) : '';
                        setNewMovForm({
                          ...newMovForm,
                          monto: usdVal,
                          montoBs: bsVal
                        });
                      }}
                    />
                  </div>
                </div>
              </div>

              {isNewMovVES && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tasa de Operación (Bs./$)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0.01"
                      className="w-full px-4 py-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-indigo-700"
                      placeholder="Ej. 36.50"
                      value={newMovForm.tasa}
                      onChange={e => {
                        const tasaVal = e.target.value;
                        const tasaNum = parseFloat(tasaVal) || 1;
                        const bsVal = parseFloat(newMovForm.montoBs || '0');
                        const usdVal = parseFloat(newMovForm.monto || '0');
                        if (bsVal > 0) {
                          const calculatedUsd = (bsVal / tasaNum).toFixed(2);
                          setNewMovForm({
                            ...newMovForm,
                            tasa: tasaVal,
                            monto: calculatedUsd
                          });
                        } else {
                          const calculatedBs = usdVal > 0 ? (usdVal * tasaNum).toFixed(2) : '';
                          setNewMovForm({
                            ...newMovForm,
                            tasa: tasaVal,
                            montoBs: calculatedBs
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Monto en Bolívares (VES)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Bs.</span>
                      <input 
                        type="number" 
                        step="0.01" 
                        className="w-full pl-10 pr-4 py-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-indigo-700"
                        placeholder="0.00"
                        value={newMovForm.montoBs || ''}
                        onChange={e => {
                          const bsVal = e.target.value;
                          const tasaNum = parseFloat(newMovForm.tasa) || 1;
                          const usdVal = bsVal ? (parseFloat(bsVal) / tasaNum).toFixed(2) : '';
                          setNewMovForm({
                            ...newMovForm,
                            montoBs: bsVal,
                            monto: usdVal
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowNewModal(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveNewMov}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Save size={16} />
                Registrar Préstamo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Anticipo */}
      {showAnticipoModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <Landmark size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Generar Anticipo</h3>
                  <p className="text-xs font-medium text-slate-500">Registrar un pago a favor del proveedor</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAnticipoModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Entidad / Proveedor</label>
                  <div 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-emerald-500 rounded-xl text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all font-bold text-slate-700 cursor-pointer flex justify-between items-center"
                    onClick={() => setIsAnticipoSupplierModalOpen(true)}
                  >
                    <span className={anticipoForm.proveedor ? 'text-slate-800' : 'text-slate-400 font-normal'}>
                      {anticipoForm.proveedor || 'Seleccionar entidad...'}
                    </span>
                    <Search className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cuenta Bancaria (Origen)</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all font-bold text-slate-700"
                    value={anticipoForm.bancoId}
                    onChange={e => setAnticipoForm({...anticipoForm, bancoId: e.target.value})}
                  >
                    <option value="">Seleccione un banco...</option>
                    {bancos.map(b => (
                      <option key={b.id} value={b.id}>{b.banco} - {b.moneda}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descripción del Anticipo</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all font-bold text-slate-700"
                  placeholder="Ej. Anticipo para futura compra..."
                  value={anticipoForm.descripcion}
                  onChange={e => setAnticipoForm({...anticipoForm, descripcion: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all font-bold text-slate-700"
                    value={anticipoForm.fecha}
                    onChange={e => setAnticipoForm({...anticipoForm, fecha: e.target.value})}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Referencia</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all font-mono font-bold text-slate-700"
                    placeholder="Opcional"
                    value={anticipoForm.referencia}
                    onChange={e => setAnticipoForm({...anticipoForm, referencia: e.target.value})}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Monto</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      className="w-full pl-7 pr-4 py-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all font-black text-emerald-700"
                      placeholder="0.00"
                      value={anticipoForm.monto}
                      onChange={e => {
                        const usdVal = e.target.value;
                        const tasaVal = parseFloat(anticipoForm.tasa) || 1;
                        const bsVal = usdVal ? (parseFloat(usdVal) * tasaVal).toFixed(2) : '';
                        setAnticipoForm({
                          ...anticipoForm,
                          monto: usdVal,
                          montoBs: bsVal
                        });
                      }}
                    />
                  </div>
                </div>
              </div>

              {isAnticipoVES && (
                <div className="flex flex-col animate-in fade-in zoom-in-95 duration-200 pt-6 border-t border-slate-100 mt-4 gap-4">
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tasa de Operación (Bs./$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0.01"
                      className="w-full px-4 py-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all font-bold text-emerald-700"
                      placeholder="Ej. 36.50"
                      value={anticipoForm.tasa}
                      onChange={e => {
                        const tasaVal = e.target.value;
                        const tasaNum = parseFloat(tasaVal) || 1;
                        const bsVal = parseFloat(anticipoForm.montoBs || '0');
                        const usdVal = parseFloat(anticipoForm.monto || '0');
                        if (bsVal > 0) {
                          const calculatedUsd = (bsVal / tasaNum).toFixed(2);
                          setAnticipoForm({
                            ...anticipoForm,
                            tasa: tasaVal,
                            monto: calculatedUsd
                          });
                        } else {
                          const calculatedBs = usdVal > 0 ? (usdVal * tasaNum).toFixed(2) : '';
                          setAnticipoForm({
                            ...anticipoForm,
                            tasa: tasaVal,
                            montoBs: calculatedBs
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Monto en Bolívares (VES)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">Bs.</span>
                      <input 
                        type="number" 
                        step="0.01"
                        className="w-full pl-10 pr-4 py-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all font-bold text-emerald-700"
                        placeholder="0.00"
                        value={anticipoForm.montoBs || ''}
                        onChange={e => {
                          const bsVal = e.target.value;
                          const tasaNum = parseFloat(anticipoForm.tasa) || 1;
                          const usdVal = bsVal ? (parseFloat(bsVal) / tasaNum).toFixed(2) : '';
                          setAnticipoForm({
                            ...anticipoForm,
                            montoBs: bsVal,
                            monto: usdVal
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowAnticipoModal(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveAnticipo}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center gap-2 transition-colors"
              >
                <Save size={16} />
                Guardar Anticipo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Provisión */}
      {showProvisionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Nueva Provisión (Gasto)</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                    Solo crea cuenta por pagar
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowProvisionModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-col relative">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Accionista / Entidad</label>
                <div 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 hover:border-indigo-400 rounded-xl text-sm outline-none transition-all font-bold text-slate-700 cursor-pointer flex justify-between items-center"
                  onClick={() => setIsProvisionSupplierModalOpen(true)}
                >
                  <span className={provisionForm.proveedor ? 'text-slate-800' : 'text-slate-400 font-normal'}>
                    {provisionForm.proveedor || 'Seleccionar accionista...'}
                  </span>
                  <Search className="w-4 h-4 text-indigo-500" />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Concepto / Gasto</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all font-bold text-slate-700"
                  placeholder="Ej. Nómina Directiva, Bonos..."
                  value={provisionForm.descripcion}
                  onChange={e => setProvisionForm({...provisionForm, descripcion: e.target.value})}
                />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cuenta Contable (Gasto)</label>
                <div 
                  onClick={() => setShowCuentaModal(true)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm hover:bg-white hover:border-rose-400 cursor-pointer transition-all flex justify-between items-center group"
                >
                  {provisionForm.cuentaGasto ? (() => {
                    const selectedCuenta = cuentasContables.find(c => c.id === provisionForm.cuentaGasto);
                    return selectedCuenta ? (
                      <div>
                        <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 mr-1.5">{selectedCuenta.codigo}</span>
                        <span className="font-medium text-slate-800">{selectedCuenta.nombre}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 font-medium">Seleccionar cuenta contable (Opcional)...</span>
                    );
                  })() : (
                    <span className="text-slate-400 font-medium">Seleccionar cuenta contable (Opcional)...</span>
                  )}
                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-rose-500" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Si se deja vacío usará la cuenta configurada en el accionista o la cuenta por defecto.</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all font-bold text-slate-700"
                    value={provisionForm.fecha}
                    onChange={e => setProvisionForm({...provisionForm, fecha: e.target.value})}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Monto</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      className="w-full pl-7 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition-all font-black text-rose-700"
                      placeholder="0.00"
                      value={provisionForm.monto}
                      onChange={e => setProvisionForm({...provisionForm, monto: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowProvisionModal(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveProvision}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm flex items-center gap-2 transition-colors"
              >
                <Save size={16} />
                Guardar Provisión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anticipo Supplier Search Modal */}
      {isAnticipoSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl outline-none shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Search size={20} className="text-emerald-600"/>
                Buscar Entidad / Proveedor
              </h3>
              <button 
                onClick={() => setIsAnticipoSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o identificación..."
                  value={anticipoSupplierSearchTerm}
                  onChange={(e) => setAnticipoSupplierSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredAnticipoEntities.length > 0 ? (
                <div className="grid grid-cols-1 gap-1">
                  {filteredAnticipoEntities.map(client => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setAnticipoForm({
                          ...anticipoForm,
                          proveedor_id: client.taxId || client.id,
                          proveedor: client.name || client.nombre || ''
                        });
                        setIsAnticipoSupplierModalOpen(false);
                        setAnticipoSupplierSearchTerm('');
                      }}
                      className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left rounded-xl border border-transparent hover:border-slate-200"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{client.name || client.nombre}</div>
                        <div className="text-xs text-slate-500 font-mono mt-1">{client.taxId || client.identificacion}</div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <ArrowRight size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-700">No se encontraron entidades</p>
                  <p className="text-sm mt-1">Verifique los términos de búsqueda o registre una nueva entidad en el módulo de Contactos.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* New Mov Supplier Search Modal */}
      {isNewMovSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl outline-none shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Search size={20} className="text-indigo-600"/>
                {newMovForm.categoria === 'intercompanias' ? 'Buscar Intercompañía' : 'Buscar Accionista / Socio'}
              </h3>
              <button 
                onClick={() => setIsNewMovSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder={newMovForm.categoria === 'intercompanias' ? "Buscar intercompañía por nombre o RIF..." : "Buscar accionista por nombre o cédula/RIF..."}
                  value={newMovSupplierSearchTerm}
                  onChange={(e) => setNewMovSupplierSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredNewMovEntities.length > 0 ? (
                <div className="grid grid-cols-1 gap-1">
                  {filteredNewMovEntities.map(client => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setNewMovForm({
                          ...newMovForm,
                          entidad_id: client.taxId || client.id,
                          entidad: client.name || client.nombre || ''
                        });
                        setIsNewMovSupplierModalOpen(false);
                        setNewMovSupplierSearchTerm('');
                      }}
                      className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left rounded-xl border border-transparent hover:border-slate-200"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{client.name || client.nombre}</div>
                        <div className="text-xs text-slate-500 font-mono mt-1">{client.taxId || client.identificacion}</div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <ArrowRight size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-700">
                    {newMovForm.categoria === 'intercompanias' ? 'No se encontraron intercompañías registradas' : 'No se encontraron accionistas registrados'}
                  </p>
                  <p className="text-sm mt-1">
                    {newMovForm.categoria === 'intercompanias'
                      ? 'Verifique los contactos de tipo Intercompañía en el Directorio de Contactos o ingrese el nombre directamente.'
                      : 'Verifique los contactos de tipo Accionista en el Directorio de Contactos o ingrese el nombre directamente.'}
                  </p>
                  {newMovSupplierSearchTerm.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewMovForm({
                          ...newMovForm,
                          entidad_id: `ENT-${Date.now().toString().slice(-4)}`,
                          entidad: newMovSupplierSearchTerm.trim()
                        });
                        setIsNewMovSupplierModalOpen(false);
                        setNewMovSupplierSearchTerm('');
                      }}
                      className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Usar "{newMovSupplierSearchTerm.trim()}" directamente</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Provision Supplier Search Modal */}
      {isProvisionSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl outline-none shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Search size={20} className="text-indigo-600"/>
                Buscar Entidad / Nombre
              </h3>
              <button 
                onClick={() => setIsProvisionSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o identificación..."
                  value={provisionSupplierSearchTerm}
                  onChange={(e) => setProvisionSupplierSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredProvisionEntities.length > 0 ? (
                <div className="grid grid-cols-1 gap-1">
                  {filteredProvisionEntities.map(client => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setProvisionForm({
                          ...provisionForm,
                          proveedor_id: client.taxId || client.id,
                          proveedor: client.name || client.nombre || ''
                        });
                        setIsProvisionSupplierModalOpen(false);
                        setProvisionSupplierSearchTerm('');
                      }}
                      className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left rounded-xl border border-transparent hover:border-slate-200"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{client.name || client.nombre}</div>
                        <div className="text-xs text-slate-500 font-mono mt-1">{client.taxId || client.identificacion}</div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <ArrowRight size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-700">No se encontraron entidades</p>
                  <p className="text-sm mt-1">Verifique los términos de búsqueda o registre una nueva entidad en el módulo de Contactos.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal para seleccionar cuenta contable */}
      <CuentaContableModal
        isOpen={showCuentaModal}
        onClose={() => setShowCuentaModal(false)}
        onSelect={(c) => {
          setProvisionForm({ ...provisionForm, cuentaGasto: c.id });
          setShowCuentaModal(false);
        }}
        cuentasContables={cuentasContables}
        selectedCuentaId={provisionForm.cuentaGasto}
        title="Seleccionar Cuenta Contable (Gasto)"
        subtitle="Seleccione la cuenta para el registro contable de la provisión"
      />
      {/* Modal Cargar Saldo Inicial (CXP) */}
      {showSaldoInicialModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden font-sans">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 text-violet-600 rounded-lg">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Cargar Saldo Inicial de CxP</h3>
                  <p className="text-xs font-medium text-slate-500">Registrar cuenta por pagar histórica pendiente con el proveedor</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSaldoInicialModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto w-full text-left">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex gap-3">
                <span className="font-bold text-lg leading-none">⚠️</span>
                <div>
                  <span className="font-bold">Información de Seguridad:</span> Cargar un saldo inicial registrará la cuenta por pagar histórica con su proveedor. No afectará las cuentas bancarias ni el flujo de caja actual. Opcionalmente, puede registrar una partida doble en su libro de diario especificando una cuenta de contrapartida.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col relative col-span-2 md:col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Proveedor / Contacto</label>
                  <div 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-violet-500 rounded-xl text-sm focus:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all font-bold text-slate-700 cursor-pointer flex justify-between items-center"
                    onClick={() => setIsSaldoInicialSupplierModalOpen(true)}
                  >
                    <span>{saldoInicialForm.contacto || 'Seleccione un contacto...'}</span>
                    <ArrowRight size={16} className="text-violet-500" />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nro de Factura / Control Deudor</label>
                  <input 
                    type="text" 
                    placeholder="Ej. SI-0001"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-violet-500 outline-none transition-all font-semibold"
                    value={saldoInicialForm.factura_id}
                    onChange={e => setSaldoInicialForm({...saldoInicialForm, factura_id: e.target.value})}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Factura (Histórica)</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-violet-500 outline-none transition-all"
                    value={saldoInicialForm.fecha}
                    onChange={e => setSaldoInicialForm({...saldoInicialForm, fecha: e.target.value})}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Vencimiento de Pago</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-violet-500 outline-none transition-all"
                    value={saldoInicialForm.vencimiento}
                    onChange={e => setSaldoInicialForm({...saldoInicialForm, vencimiento: e.target.value})}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descripción</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-violet-500 outline-none transition-all"
                    value={saldoInicialForm.descripcion}
                    onChange={e => setSaldoInicialForm({...saldoInicialForm, descripcion: e.target.value})}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Monto Pendiente ($)</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    step="0.01"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-violet-500 outline-none transition-all font-mono font-bold"
                    value={saldoInicialForm.monto}
                    onChange={e => setSaldoInicialForm({...saldoInicialForm, monto: e.target.value})}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Moneda del Saldo</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-violet-500 outline-none transition-all font-bold"
                    value={saldoInicialForm.moneda}
                    onChange={e => setSaldoInicialForm({...saldoInicialForm, moneda: e.target.value})}
                  >
                    <option value="Dólares (USD)">Dólares (USD)</option>
                    <option value="Bolívares (VES)">Bolívares (VES)</option>
                  </select>
                </div>

                {saldoInicialForm.moneda === 'Bolívares (VES)' && (
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tasa de Cambio (BCV)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 40.50"
                      step="0.02"
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-violet-500 outline-none transition-all font-mono font-bold"
                      value={saldoInicialForm.tasa}
                      onChange={e => setSaldoInicialForm({...saldoInicialForm, tasa: e.target.value})}
                    />
                  </div>
                )}

                <div className="flex flex-col col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cuenta Contrapartida Contable (Opcional)</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-violet-500 outline-none transition-all font-medium text-slate-700"
                    value={saldoInicialForm.cuentaContrapartida}
                    onChange={e => setSaldoInicialForm({...saldoInicialForm, cuentaContrapartida: e.target.value})}
                  >
                    <option value="">No generar comprobante contable automático (Solo registrar saldo para Cuentas por Pagar)</option>
                    {cuentasContables.filter(c => c.tipo === 'Movimiento').sort((a,b)=>(a.codigo||'').localeCompare(b.codigo||'')).map(c => (
                      <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Recomendado: Resultados Acumulados, Capital Social o cuenta de migración para cuadrar balance inicial.</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-wrap">
              <button 
                onClick={() => setShowSaldoInicialModal(false)}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveSaldoInicial}
                className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-sm flex items-center gap-2 transition-colors"
              >
                <Save size={16} />
                Guardar Saldo Inicial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submodal para elegir proveedor (Saldo Inicial) */}
      {isSaldoInicialSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg h-[600px] flex flex-col overflow-hidden font-sans">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-800">Seleccionar Proveedor / Contacto</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Haga clic sobre un registro de la lista</p>
              </div>
              <button 
                onClick={() => {
                  setIsSaldoInicialSupplierModalOpen(false);
                  setSaldoInicialSupplierSearchTerm('');
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-white mr-1 text-left">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o identificación..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm transition-all bg-white"
                  value={saldoInicialSupplierSearchTerm}
                  onChange={(e) => setSaldoInicialSupplierSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 bg-slate-50/50">
              {filteredSaldoInicialSupplierEntities.length > 0 ? (
                <div className="grid grid-cols-1 gap-1">
                  {filteredSaldoInicialSupplierEntities.map(client => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setSaldoInicialForm({
                          ...saldoInicialForm,
                          contacto_id: client.taxId || client.id,
                          contacto: client.name || client.nombre || ''
                        });
                        setIsSaldoInicialSupplierModalOpen(false);
                        setSaldoInicialSupplierSearchTerm('');
                      }}
                      className="flex items-center justify-between p-4 hover:bg-white hover:shadow-xs transition-all text-left bg-transparent rounded-xl border border-transparent hover:border-slate-100 w-full"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{client.name || client.nombre}</div>
                        <div className="text-xs text-slate-500 font-mono mt-1">{client.taxId || client.identificacion || client.id}</div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 transition-colors">
                        <ArrowRight size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 bg-white m-2 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-700">No se encontraron de estas entidades</p>
                  <p className="text-sm mt-1">Verifique los términos de búsqueda o registre una nueva entidad en el módulo de Contactos.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pago Supplier Search Modal */}
      {isPagoSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[220] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-50 rounded-2xl w-full max-w-xl outline-none shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-150 flex justify-between items-center bg-white">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Search size={20} className="text-indigo-650"/>
                Buscar Proveedor / Entidad con Deuda
              </h3>
              <button 
                onClick={() => {
                  setIsPagoSupplierModalOpen(false);
                  setPagoSupplierSearchTerm('');
                }}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 bg-white border-b border-slate-150">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o identificación..."
                  value={pagoSupplierSearchTerm}
                  onChange={(e) => setPagoSupplierSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-550 outline-none text-sm transition-all"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {filteredPagoSuppliersWithDebt.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {filteredPagoSuppliersWithDebt.map(client => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setPagoForm({
                          ...pagoForm,
                          proveedorId: String(client.id)
                        });
                        setAbonos({}); // Resetear abonos al cambiar de proveedor
                        setIsPagoSupplierModalOpen(false);
                        setPagoSupplierSearchTerm('');
                      }}
                      className="flex items-center justify-between p-4 hover:bg-white hover:shadow-sm transition-all text-left bg-white rounded-xl border border-slate-200 hover:border-indigo-300 w-full group"
                    >
                      <div>
                        <div className="font-bold text-slate-800 group-hover:text-indigo-655 transition-colors">{client.nombre}</div>
                        <div className="flex gap-2 items-center mt-1">
                          <span className="text-xs text-slate-500 font-mono font-medium">{client.id}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full capitalize font-bold">{client.categoria}</span>
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-all">
                        <ArrowRight size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 bg-white m-2 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-medium text-slate-700">No se encontraron entidades con deudas activas</p>
                  <p className="text-sm mt-1 text-slate-400">Verifique los filtros activos arriba o que la entidad tenga facturas o saldos pendientes de pago.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Accounting Voucher Preview Modal before registering */}
      {pendingVoucher && (
        <VoucherPreviewModal
          isOpen={!!pendingVoucher}
          onClose={() => setPendingVoucher(null)}
          initialComprobante={pendingVoucher.comprobante}
          cuentasContables={cuentasContables}
          onConfirm={pendingVoucher.onConfirm}
        />
      )}

      {/* Modal Detalle de Pago */}
      {selectedPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Comprobante de Pago</h3>
                  <p className="text-xs font-mono font-semibold text-slate-400">Ref: {selectedPago.referencia} | ID: {selectedPago.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPago(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50/60 rounded-2xl border border-slate-100 text-sm">
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Fecha</div>
                  <div className="font-bold text-slate-800">{selectedPago.fecha}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Beneficiario</div>
                  <div className="font-bold text-slate-800 line-clamp-1">{selectedPago.proveedorNombre}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Referencia</div>
                  <div className="font-bold text-slate-800 font-mono">{selectedPago.referencia}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Pagado</div>
                  <div className="font-black text-rose-600">${formatoES(selectedPago.monto)}</div>
                </div>
              </div>

              {/* Extra log metadata */}
              {selectedPago.tasa && selectedPago.tasa !== 1 && (
                <div className="flex items-center justify-between px-4 py-2 bg-indigo-50/30 border border-indigo-100/50 rounded-xl text-xs font-bold text-indigo-800">
                  <span>Tasa de cambio aplicada:</span>
                  <span>1 USD = {formatoES(selectedPago.tasa)} Bs.F</span>
                </div>
              )}

              {/* Invoices Mapped / Abonos list */}
              {selectedPago.abonos && Object.keys(selectedPago.abonos).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Documentos Afectados (Abonos)</h4>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-white">
                    {Object.entries(selectedPago.abonos).map(([docId, val]) => {
                      const amount = Number(val);
                      if (amount <= 0) return null;
                      const originalInvoice = cxp.find(d => d.id === docId);
                      return (
                        <div key={docId} className="px-4 py-2.5 flex items-center justify-between text-sm hover:bg-slate-50/30">
                          <div>
                            <span className="font-bold text-slate-700">Factura / Pago:</span>{' '}
                            <span className="font-mono text-xs text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">{getCleanDocNumber(originalInvoice, docId)}</span>
                            {originalInvoice?.descripcion && <span className="text-xs text-slate-400 block mt-0.5">{originalInvoice.descripcion}</span>}
                          </div>
                          <span className="font-bold text-slate-800">${formatoES(amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Accounting entry visual (Asiento Contable) */}
              <div className="space-y-3">
                {(() => {
                  const targetRef = String(selectedPago.referencia || selectedPago.comprobantePago || '').trim();
                  const matchedComp = comprobantes.find((c: any) => 
                    (selectedPago.comprobanteId && (String(c.id) === String(selectedPago.comprobanteId))) ||
                    (targetRef && (
                      String(c.referencia || '').trim() === targetRef ||
                      String(c.numero || '').trim() === targetRef ||
                      (c.referencia && String(c.referencia).toLowerCase().includes(targetRef.toLowerCase())) ||
                      (targetRef && String(c.referencia || '').toLowerCase().includes(targetRef.toLowerCase()))
                    )) ||
                    (c.total && Math.abs(Number(c.total) - Number(selectedPago.montoTotal || selectedPago.monto)) < 0.01 && c.fecha === selectedPago.fecha)
                  ) || (selectedPago?.lineas ? selectedPago : null);

                  let linesObj = matchedComp?.lineas || [];

                  // Fallback dinámico si no hay líneas para que el comprobante nunca salga en blanco
                  if (!linesObj || linesObj.length === 0) {
                    const montoTotal = Number(selectedPago.montoTotal || selectedPago.monto) || 0;
                    if (montoTotal > 0) {
                      const ctaCxpCode = configContable?.cuentaCxp || '2.1.01.001';
                      const ctaCxpObj = cuentasContables.find(c => String(c.codigo) === String(ctaCxpCode) || String(c.id) === String(ctaCxpCode));

                      const selBanco = bancos.find(b => b.id === selectedPago.bancoId) || bancos.find(b => b.es_caja || (b.tipo || '').toLowerCase().includes('caja')) || bancos[0];
                      const ctaBancoCode = selBanco?.cuenta_contable_id || '1.1.01.001';
                      const ctaBancoObj = cuentasContables.find(c => String(c.codigo) === String(ctaBancoCode) || String(c.id) === String(ctaBancoCode));

                      linesObj = [
                        {
                          id: 'syn-debe',
                          cuentaId: ctaCxpObj?.id || ctaCxpCode,
                          codigo: ctaCxpObj?.codigo || ctaCxpCode,
                          descripcion: `Pago Facturas - ${selectedPago.proveedorNombre || 'Proveedor'}`,
                          debe: montoTotal,
                          haber: 0
                        },
                        {
                          id: 'syn-haber',
                          cuentaId: ctaBancoObj?.id || ctaBancoCode,
                          codigo: ctaBancoObj?.codigo || ctaBancoCode,
                          descripcion: `Egreso ${selBanco?.banco || 'Caja Principal'} - Ref: ${targetRef || 'Efectivo'}`,
                          debe: 0,
                          haber: montoTotal
                        }
                      ];
                    }
                  }

                  const voucherNumero = matchedComp?.numero || (selectedPago.comprobanteId ? (selectedPago.comprobanteId.startsWith('CMP-') ? selectedPago.comprobanteId : `CMP-${selectedPago.comprobanteId.slice(0, 8)}`) : (targetRef ? `CMP-${targetRef}` : 'CMP-ASIENTO'));

                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Asiento Contable Generado</h4>
                        <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-500 font-mono font-bold px-2 py-0.5 rounded-full">
                          Voucher: {voucherNumero}
                        </span>
                      </div>

                      <div className="overflow-hidden border border-slate-150 rounded-2xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-indigo-100/50 text-slate-500 uppercase font-black">
                            <tr>
                              <th className="px-4 py-3">Código</th>
                              <th className="px-4 py-3">Cuenta</th>
                              <th className="px-4 py-3 text-right">Debe</th>
                              <th className="px-4 py-3 text-right">Haber</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {(() => {
                              if (linesObj.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                                      No se encontraron registros de líneas contables
                                    </td>
                                  </tr>
                                );
                              }

                              let totalDebe = 0;
                              let totalHaber = 0;

                              return (
                                <>
                                  {linesObj.map((l: any, i: number) => {
                                    const cuenta = cuentasContables.find(c => 
                                      String(c.codigo) === String(l.cuentaId) || 
                                      String(c.id) === String(l.cuentaId) || 
                                      String(c.id) === String(l.cuenta_id) || 
                                      String(c.codigo) === String(l.codigo)
                                    );
                                    const codigoCuenta = cuenta?.codigo || l.cuentaCodigo || l.codigo || (l.cuentaId && !l.cuentaId.includes('-') ? l.cuentaId : '---');
                                    const debe = Number(l.debe) || 0;
                                    const haber = Number(l.haber) || 0;
                                    totalDebe += debe;
                                    totalHaber += haber;

                                    return (
                                      <tr key={l.id || i} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-2.5 font-mono text-indigo-600 font-bold">{codigoCuenta}</td>
                                        <td className="px-4 py-2.5 text-slate-700 max-w-[200px] truncate" title={cuenta?.nombre || l.descripcion}>
                                          {cuenta?.nombre || l.descripcion || 'Cuenta Contable'}
                                        </td>
                                        <td className="px-4 py-2.5 text-right font-bold text-slate-800">{debe > 0 ? `$${formatoES(debe)}` : '-'}</td>
                                        <td className="px-4 py-2.5 text-right font-bold text-slate-800">{haber > 0 ? `$${formatoES(haber)}` : '-'}</td>
                                      </tr>
                                    );
                                  })}
                            <tr className="bg-slate-50/40 font-bold text-slate-800">
                              <td colSpan={2} className="px-4 py-2.5 text-right uppercase tracking-wider text-[10px]">Totales:</td>
                              <td className="px-4 py-2.5 text-right border-t border-slate-200 text-slate-800 font-bold">${formatoES(totalDebe)}</td>
                              <td className="px-4 py-2.5 text-right border-t border-slate-200 text-slate-800 font-bold">${formatoES(totalHaber)}</td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      </div>

            {/* Footer buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 rounded-b-3xl">
              <button 
                onClick={() => setSelectedPago(null)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 rounded-xl transition-colors hover:bg-slate-100"
              >
                Cerrar Detalle
              </button>
              
              {selectedPago.estado === 'activo' && (
                <button
                  type="button"
                  onClick={() => {
                    handleAnnulPago(selectedPago);
                    setSelectedPago(null);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-amber-500/10 flex items-center gap-1.5"
                >
                  <X size={16} /> Anular Pago
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDeletePago(selectedPago)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-rose-600/10 flex items-center gap-1.5"
              >
                <Trash2 size={16} /> Eliminar Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reintegro de Saldo a Favor a Proveedor */}
      {showReintegroModal && currentSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Reintegrar Saldo a Favor</h3>
                  <p className="text-xs font-semibold text-slate-400">Recibir devolución de fondos del proveedor</p>
                </div>
              </div>
              <button 
                onClick={() => setShowReintegroModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteReintegroSupplier} className="p-6 space-y-4">
              <div className="p-4 bg-teal-50/60 rounded-2xl border border-teal-100">
                <p className="text-xs text-teal-800 font-bold mb-1">Saldo a Favor Disponible:</p>
                <p className="text-2xl font-black text-teal-700">${formatoES(Math.abs(currentSupplier.saldoPendiente))}</p>
                <p className="text-[11px] text-teal-600 mt-1">Este monto proviene de anticipos no consumidos o pagos en exceso realizados al proveedor.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Banco Destino (Donde ingresa el dinero) *</label>
                <select 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
                  value={reintegroForm.bancoId}
                  onChange={e => setReintegroForm({ ...reintegroForm, bancoId: e.target.value })}
                  required
                >
                  <option value="">Seleccione cuenta bancaria...</option>
                  {bancos.map(b => (
                    <option key={b.id} value={b.id}>{b.banco} ({b.moneda}) - Saldo: ${formatoES(b.saldo)}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha *</label>
                  <input 
                    type="date"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:border-teal-500 outline-none"
                    value={reintegroForm.fecha}
                    onChange={e => setReintegroForm({ ...reintegroForm, fecha: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">N° Referencia *</label>
                  <input 
                    type="text"
                    placeholder="Ej. TRF-99214"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:border-teal-500 outline-none"
                    value={reintegroForm.referencia}
                    onChange={e => setReintegroForm({ ...reintegroForm, referencia: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Monto a Reintegrar (USD) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Math.abs(currentSupplier.saldoPendiente)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 focus:bg-white focus:border-teal-500 outline-none"
                    value={reintegroForm.monto}
                    onChange={e => setReintegroForm({ ...reintegroForm, monto: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas / Concepto</label>
                <input 
                  type="text"
                  placeholder="Detalle o motivo del reintegro..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:bg-white focus:border-teal-500 outline-none"
                  value={reintegroForm.notas}
                  onChange={e => setReintegroForm({ ...reintegroForm, notas: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowReintegroModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Procesar Reintegro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Autorización Master para Eliminar / Anular */}
      <MasterAuthModal
        isOpen={masterAuth.isOpen}
        onClose={() => setMasterAuth({ isOpen: false, onSuccess: () => {} })}
        title={masterAuth.title}
        actionName={masterAuth.actionName}
        actionDetails={masterAuth.actionDetails}
        onSuccess={masterAuth.onSuccess}
      />
    </div>
  );
}
