import { formatNumber } from '../utils/numberFormat';
import { getTasaForDate } from '../services/exchangeRateService';
import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Users, Building, UserCircle, PhoneCall, Search, Filter, Download, Plus, 
  ArrowRight, ArrowLeft, Landmark, FileText, CheckCircle, X, Save, CornerDownRight, 
  Eye, EyeOff, Trash2, Calendar, Printer, ChevronDown, Globe, UserCheck, Contact2, 
  Percent, MessageSquare, Clock, AlertTriangle, ShieldCheck, Mail, Phone, 
  ExternalLink, DollarSign, ArrowDownLeft, FileSpreadsheet, Send, BarChart2, Coins, RotateCcw,
  Lock, TrendingUp, ChevronRight, MoreVertical, CreditCard } from 'lucide-react';
import { PrintPreview } from '../components/PrintPreview';
import { dbResetAllTestData, dbFetchTerminalesPos, isUUID } from '../services/db';
import { TerminalPosModel } from '../types/database';
import { useCompany } from '../context/CompanyContext';
import MasterAuthModal from '../components/common/MasterAuthModal';
import VoucherPreviewModal from '../components/common/VoucherPreviewModal';
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
  const matchFac = desc.match(/(?:Factura(?:\s+de\s+Venta)?|Fact(?:ura)?(?:\s+de\s+Compra)?|Fact\.?|Doc\.?|Documento)\s*[:#.]?\s*([A-Za-z0-9\-_]+)/i);
  if (matchFac && matchFac[1]) return matchFac[1];

  if (itemOrDoc.factura_id && !isUUID(itemOrDoc.factura_id)) return itemOrDoc.factura_id;
  if (itemOrDoc.referencia && !isUUID(itemOrDoc.referencia)) return itemOrDoc.referencia;

  const raw = itemOrDoc.factura_id || itemOrDoc.id || fallback || '';
  if (isUUID(raw)) {
    return `DOC-${raw.slice(0, 8).toUpperCase()}`;
  }
  return raw || '-';
};


export default function Receivables({ cxc = [], cobranzas = [], comprobantes = [], bancos = [], movimientosBancos = [], clientes = [], contactos = [], cuentasContables = [], configContable, onSave, showToast, workingYear, facturas = [] }: { cxc?: any[], cobranzas?: any[], comprobantes?: any[], bancos?: any[], movimientosBancos?: any[], clientes?: any[], contactos?: any[], cuentasContables?: any[], configContable?: any, onSave?: any, showToast?: any, workingYear?: string, facturas?: any[] }) {
  const { activeCompanyId } = useCompany();
  const { category } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(category || 'clientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null);
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

  // Preview contabilidad state
  const [pendingVoucher, setPendingVoucher] = useState<{
    comprobante: any;
    movimiento: any;
    onConfirm: (finalComprobante: any) => Promise<void>;
  } | null>(null);

  // Estado para el modal de edición de documentos
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [showEditDocModal, setShowEditDocModal] = useState(false);
  const [editDocForm, setEditDocForm] = useState({
    id: '',
    factura_id: '',
    fecha: '',
    descripcion: '',
    total: '',
    saldo: ''
  });

  // Estado para el modal de Saldo Inicial
  const [showSaldoInicialModal, setShowSaldoInicialModal] = useState(false);
  const [isSaldoInicialClientModalOpen, setIsSaldoInicialClientModalOpen] = useState(false);
  const [saldoInicialClientSearchTerm, setSaldoInicialClientSearchTerm] = useState('');
  const [saldoInicialForm, setSaldoInicialForm] = useState({
    contacto: '',
    contacto_id: '',
    factura_id: '',
    fecha: new Date().toISOString().split('T')[0],
    vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    descripcion: 'Saldo Inicial de CxC',
    monto: '',
    moneda: 'Dólares (USD)',
    tasa: '1.00',
    cuentaContrapartida: ''
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

  const [terminalesPos, setTerminalesPos] = useState<TerminalPosModel[]>([]);

  useEffect(() => {
    dbFetchTerminalesPos().then(setTerminalesPos).catch(console.error);
  }, []);

  // Estado para el módulo de cobranza
  const [cobranzaForm, setCobranzaForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    clienteId: '',
    tasa: 1,
    tasaReferencial: '',
    pagos: [] as Array<{
      id: string;
      bancoId: string;
      metodo?: string;
      terminalId?: string;
      referencia: string;
      monto: string;
      montoBs: string;
    }>,
    entidadSobranteId: '' // Cliente o Agencia Aduanal
  });

  // PrintPreview state variables
  const [isSelectingSobrante, setIsSelectingSobrante] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printModalTitle, setPrintModalTitle] = useState('');
  const [printModalOrientation, setPrintModalOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [printModalContent, setPrintModalContent] = useState<React.ReactNode | null>(null);

  const triggerPrintPreview = (title: string, orientation: 'portrait' | 'landscape', content: React.ReactNode) => {
    setPrintModalTitle(title);
    setPrintModalOrientation(orientation);
    setPrintModalContent(content);
    setPrintModalOpen(true);
  };

  // Estado para Historial de Cobranzas
  const [selectedCobranza, setSelectedCobranza] = useState<any | null>(null);
  const [historialPage, setHistorialPage] = useState(1);
  const [historialSearch, setHistorialSearch] = useState('');
  const [historialDateRange, setHistorialDateRange] = useState({
    desde: '',
    hasta: ''
  });
  const [isCobranzaClientModalOpen, setIsCobranzaClientModalOpen] = useState(false);
  const [cobranzaClientSearchTerm, setCobranzaClientSearchTerm] = useState('');
  const [abonos, setAbonos] = useState<Record<string, string>>({});
  const [anticipoGlobal, setAnticipoGlobal] = useState<string>('');
  const [entityFilters, setEntityFilters] = useState({
    aliados: true,
    clientes: true,
    freelance: true,
    intercompanias: true,
    accionistas: true,
    empleados: true
  });

  // Estado para el modal de nuevo movimiento bancario (Cuentas por cobrar no clientes)
  const [showNewModal, setShowNewModal] = useState(false);
  const [newMovForm, setNewMovForm] = useState({
    bancoId: '',
    fecha: new Date().toISOString().split('T')[0],
    referencia: '',
    descripcion: '',
    monto: '',
    entidad: '',
    entidad_id: '',
    tasa: '',
    montoBs: ''
  });

  const selectedNewMovBanco = useMemo(() => bancos.find(b => b.id === newMovForm.bancoId), [bancos, newMovForm.bancoId]);
  const isNewMovVES = selectedNewMovBanco?.moneda === 'VES' || selectedNewMovBanco?.moneda === 'Bs' || selectedNewMovBanco?.moneda === 'Bs.' || selectedNewMovBanco?.moneda === 'Bolivares' || selectedNewMovBanco?.moneda === 'Bolívares';

  // Estado para Reintegro de Anticipos
  const [reintegroTarget, setReintegroTarget] = useState<any>(null);
  const [reintegroForm, setReintegroForm] = useState({
    monto: '',
    bancoId: '',
    referencia: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  // Estado para el modal de Anticipo
  const [showAnticipoModal, setShowAnticipoModal] = useState(false);
  const [isAnticipoClientModalOpen, setIsAnticipoClientModalOpen] = useState(false);
  const [anticipoClientSearchTerm, setAnticipoClientSearchTerm] = useState('');
  const [anticipoForm, setAnticipoForm] = useState({
    cliente: '',
    cliente_id: '',
    bancoId: '',
    fecha: new Date().toISOString().split('T')[0],
    referencia: '',
    descripcion: 'Anticipo de cliente',
    monto: '',
    tasa: '',
    montoBs: ''
  });

  const selectedAnticipoBanco = useMemo(() => bancos.find(b => b.id === anticipoForm.bancoId), [bancos, anticipoForm.bancoId]);
  const isAnticipoVES = selectedAnticipoBanco?.moneda === 'VES' || selectedAnticipoBanco?.moneda === 'Bs' || selectedAnticipoBanco?.moneda === 'Bs.' || selectedAnticipoBanco?.moneda === 'Bolivares';

  const [isNewMovClientModalOpen, setIsNewMovClientModalOpen] = useState(false);
  const [newMovClientSearchTerm, setNewMovClientSearchTerm] = useState('');

  const filteredNewMovEntities = useMemo(() => {
    const term = (newMovClientSearchTerm || '').toLowerCase();
    
    // Filtramos los contactos según la pestaña activa
    const validTypes = (() => {
       switch(activeTab) {
          case 'clientes':
          case 'aliados': 
            return ['customer', 'aliados', 'both'];
          case 'intercompanias': 
            return ['intercompany'];
          case 'accionistas': 
            return ['shareholder'];
          case 'empleados': 
            return ['employee'];
          case 'cobranza': 
          default: 
            return ['customer', 'aliados', 'intercompany', 'shareholder', 'employee', 'both'];
       }
    })();

    return contactos.filter(c => 
      validTypes.includes(c.type) && 
      ((c.taxId || '').toLowerCase().includes(term) || 
       (c.name || '').toLowerCase().includes(term))
    );
  }, [contactos, newMovClientSearchTerm, activeTab]);

  const filteredAnticipoEntities = useMemo(() => {
    const term = (anticipoClientSearchTerm || '').toLowerCase();
    
    // Filtramos los contactos según la pestaña activa
    const validTypes = (() => {
       switch(activeTab) {
          case 'clientes':
          case 'aliados': 
            return ['customer', 'aliados', 'both'];
          case 'intercompanias': 
            return ['intercompany'];
          case 'accionistas': 
            return ['shareholder'];
          case 'empleados': 
            return ['employee'];
          case 'cobranza': 
          default: 
            return ['customer', 'aliados', 'intercompany', 'shareholder', 'employee', 'both'];
       }
    })();

    return contactos.filter(c => 
      validTypes.includes(c.type) && 
      ((c.taxId || '').toLowerCase().includes(term) || 
       (c.name || '').toLowerCase().includes(term))
    );
  }, [contactos, anticipoClientSearchTerm, activeTab]);

  const filteredSaldoInicialEntities = useMemo(() => {
    const term = (saldoInicialClientSearchTerm || '').toLowerCase();
    const validTypes = (() => {
       switch(activeTab) {
          case 'clientes':
          case 'aliados': 
            return ['customer', 'aliados', 'both'];
          case 'intercompanias': 
            return ['intercompany'];
          case 'accionistas': 
            return ['shareholder'];
          case 'empleados': 
            return ['employee'];
          case 'cobranza': 
          default: 
            return ['customer', 'aliados', 'intercompany', 'shareholder', 'employee', 'both'];
       }
    })();

    return contactos.filter(c => 
      validTypes.includes(c.type) && 
      ((c.taxId || '').toLowerCase().includes(term) || 
       (c.name || '').toLowerCase().includes(term))
    );
  }, [contactos, saldoInicialClientSearchTerm, activeTab]);

  const currentYear = new Date().getFullYear();
  const [filtrosHistorial, setFiltrosHistorial] = useState({ 
    tipo: 'mes', 
    mes: String(new Date().getMonth() + 1).padStart(2, '0'), 
    ano: String(currentYear), 
    desde: '', 
    hasta: '' 
  });

  useEffect(() => {
    if (category) {
      if (category === 'clientes' || category === 'aliados') setActiveTab('clientes');
      else setActiveTab(category);
    }
  }, [category]);

  const tabs = [
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'intercompanias', label: 'Intercompañías', icon: Building },
    { id: 'accionistas', label: 'Accionistas', icon: UserCircle },
    { id: 'empleados', label: 'Empleados', icon: Contact2 },
    { id: 'cobranza', label: 'Módulo Cobranza', icon: PhoneCall },
    { id: 'historial-cobranzas', label: 'Historial Cobranzas', icon: FileText },
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
    return cxc.filter(item => {
      const cat = (item.categoria || 'clientes').toLowerCase();
      if (activeTab === 'cobranza') return true;
      if (activeTab === 'clientes' || activeTab === 'aliados') {
        return cat === 'clientes' || cat === 'aliados' || !item.categoria;
      }
      return cat === activeTab.toLowerCase();
    });
  }, [cxc, activeTab]);

  // Group data by client for the main table
  const allGroupedData = useMemo(() => {
    if (activeTab === 'cobranza') return [];
    
    const groups: Record<string, any> = {};
    const todayTs = new Date().setHours(0, 0, 0, 0);
    
    tabData.forEach(item => {
      const contactObj = contactos.find(c => 
        (item.cliente_id && (c.id === item.cliente_id || c.taxId === item.cliente_id)) ||
        (item.cliente_rif && c.taxId?.toLowerCase() === item.cliente_rif.toLowerCase()) ||
        (item.cliente && c.name?.toLowerCase() === item.cliente.toLowerCase()) ||
        (item.cliente_nombre && c.name?.toLowerCase() === item.cliente_nombre.toLowerCase())
      );
      
      const key = contactObj?.taxId || contactObj?.id || item.cliente_rif || item.taxId || item.cliente_id || item.cliente || item.cliente_nombre || 'cliente_general';
      
      if (!groups[key]) {
        groups[key] = {
          id: key,
          cliente: item.cliente || item.cliente_nombre || contactObj?.name || 'Cliente sin nombre',
          rif: contactObj?.taxId || item.cliente_rif || item.taxId || (String(key).startsWith('J-') || String(key).startsWith('V-') || String(key).startsWith('G-') || String(key).startsWith('E-') ? key : ''),
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
      
      const idStr = String(item.id || '').toLowerCase();
      const facStr = String(item.factura || item.factura_id || '').toLowerCase();
      const isCreditDoc = item.tipo === 'anticipo' || item.tipo === 'nota_credito' || idStr.startsWith('ant-') || idStr.includes('cxc-nc-') || idStr.startsWith('nc-') || facStr.startsWith('nc-') || Number(item.total) < 0 || Number(item.monto) < 0;

      const total = Math.abs(Number(item.total) || Number(item.monto) || 0);
      
      if (!isCreditDoc && item.estado !== 'anulada' && total > 0) {
        groups[key].montoAdeudo += total;
      }
      
      groups[key].documentos.push(item);
    });

    Object.values(groups).forEach(g => {
      const clientIdStr = String(g.id).trim();
      const clientNameLower = (g.cliente || '').toLowerCase();
      
      // 1. Cobranzas activas
      const activeCobros = (cobranzas || []).filter((cob: any) => {
        if (cob.estado === 'anulado') return false;
        if (cob.clienteId && String(cob.clienteId) === clientIdStr) return true;
        if (cob.clienteNombre && cob.clienteNombre.toLowerCase() === clientNameLower) return true;
        return false;
      });
      
      const totalAbonadoEnCobranzas = activeCobros.reduce((sum: number, cob: any) => sum + (Number(cob.monto) || 0), 0);
      
      // 2. Abonos en documentos
      const abonosEnDocs = g.documentos.reduce((sum: number, d: any) => {
        const totalDoc = Number(d.total) || Number(d.monto) || 0;
        const saldoDoc = d.saldo !== undefined ? Number(d.saldo) : totalDoc;
        if (totalDoc > 0 && d.estado !== 'anulada') {
          const paid = totalDoc - saldoDoc;
          return sum + (paid > 0 ? paid : 0);
        }
        return sum;
      }, 0);
      
      // 3. Anticipos y notas de credito no usados
      const totalAnticiposUnused = g.documentos.reduce((sum: number, d: any) => {
        const idStr = String(d.id || '').toLowerCase();
        const facStr = String(d.factura || d.factura_id || '').toLowerCase();
        const isCreditDoc = d.tipo === 'anticipo' || d.tipo === 'nota_credito' || idStr.startsWith('ant-') || idStr.includes('cxc-nc-') || idStr.startsWith('nc-') || facStr.startsWith('nc-') || Number(d.total) < 0 || Number(d.saldo) < 0;
        
        if (isCreditDoc && d.estado !== 'anulada') {
          const s = d.saldo !== undefined ? Number(d.saldo) : (Number(d.total) || Number(d.monto) || 0);
          return sum + Math.abs(s);
        }
        return sum;
      }, 0);
      
      const remainingDebt = Math.max(0, g.montoAdeudo - abonosEnDocs);
      g.saldoPendiente = remainingDebt - totalAnticiposUnused;
      g.abonosAplicados = (g.montoAdeudo - remainingDebt) + totalAnticiposUnused;
      
      // Detectar si tiene facturas vencidas en mora
      let hasOverdue = false;
      let maxMora = 0;
      g.documentos.forEach((d: any) => {
        const saldoVal = Number(d.saldo !== undefined ? d.saldo : (Number(d.total) || Number(d.monto) || 0)) || 0;
        if (saldoVal > 0.01 && d.estado !== 'anulada' && d.tipo !== 'anticipo' && d.tipo !== 'nota_credito') {
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
  }, [tabData, activeTab, contactos, cobranzas]);

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
        const nameMatch = (g.cliente?.toLowerCase() || '').includes(st);
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

  const selectedClient = useMemo(() => {
    if (!selectedClientKey) return null;
    return allGroupedData.find((g: any) => g.id === selectedClientKey) || null;
  }, [allGroupedData, selectedClientKey]);

  // --- LÓGICA MÓDULO COBRANZA ---
  const clientsWithDebt = useMemo(() => {
    const clientsMap = new Map();
    cxc.forEach(item => {
      if (Number(item.saldo) > 0) {
        const cat = item.categoria || 'clientes';
        if (entityFilters[cat as keyof typeof entityFilters]) {
          const contactObj = contactos.find(c => 
            (item.cliente_id && (c.id === item.cliente_id || c.taxId === item.cliente_id)) ||
            (item.cliente && c.name?.toLowerCase() === item.cliente.toLowerCase())
          );
          
          const key = contactObj?.taxId || contactObj?.id || item.cliente_id || item.cliente;
          
          if (!clientsMap.has(key)) {
            clientsMap.set(key, {
              id: key,
              nombre: item.cliente || contactObj?.name,
              categoria: cat
            });
          }
        }
      }
    });
    return Array.from(clientsMap.values()).sort((a: any, b: any) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [cxc, entityFilters, contactos]);

  const filteredCobranzaClientsWithDebt = useMemo(() => {
    const term = (cobranzaClientSearchTerm || '').toLowerCase().trim();
    return clientsWithDebt.filter(c => 
      (c.nombre || '').toLowerCase().includes(term) ||
      (c.categoria || '').toLowerCase().includes(term) ||
      (String(c.id) || '').toLowerCase().includes(term)
    );
  }, [clientsWithDebt, cobranzaClientSearchTerm]);

  const selectedClientObj = useMemo(() => {
    if (!cobranzaForm.clienteId) return null;
    return clientsWithDebt.find(c => c.id === cobranzaForm.clienteId) || null;
  }, [clientsWithDebt, cobranzaForm.clienteId]);

  const selectedClientDebts = useMemo(() => {
    if (!cobranzaForm.clienteId) return [];
    const clientNameLow = selectedClientObj?.nombre?.toLowerCase() || '';
    return cxc.filter(item => {
      const matchId = item.cliente_id === cobranzaForm.clienteId || item.cliente === cobranzaForm.clienteId;
      const matchName = clientNameLow && item.cliente && item.cliente.toLowerCase() === clientNameLow;
      const isAnulada = String(item.estado || '').toLowerCase() === 'anulada';
      const idStr = String(item.id || '').toLowerCase();
      const facStr = String(item.factura || item.factura_id || '').toLowerCase();
      const isCreditDoc = item.tipo === 'anticipo' || item.tipo === 'nota_credito' || idStr.startsWith('ant-') || idStr.includes('cxc-nc-') || idStr.startsWith('nc-') || facStr.startsWith('nc-');
      
      return (matchId || matchName) && !isAnulada && !isCreditDoc && Number(item.saldo) > 0;
    }).sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
  }, [cxc, cobranzaForm.clienteId, selectedClientObj]);

  const selectedClientAnticipos = useMemo(() => {
    if (!cobranzaForm.clienteId) return [];
    const clientNameLow = selectedClientObj?.nombre?.toLowerCase() || '';
    return cxc.filter(item => {
      const matchId = item.cliente_id === cobranzaForm.clienteId || item.cliente === cobranzaForm.clienteId;
      const matchName = clientNameLow && item.cliente && item.cliente.toLowerCase() === clientNameLow;
      const idStr = String(item.id || '').toLowerCase();
      const facStr = String(item.factura || item.factura_id || '').toLowerCase();
      const isCreditDoc = item.tipo === 'anticipo' || item.tipo === 'nota_credito' || idStr.startsWith('ant-') || idStr.includes('cxc-nc-') || idStr.startsWith('nc-') || facStr.startsWith('nc-') || Number(item.saldo) < 0;
      const availAmount = Math.abs(Number(item.saldo) || 0);
      return (matchId || matchName) && isCreditDoc && item.estado !== 'anulada' && availAmount > 0.001;
    }).sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
  }, [cxc, cobranzaForm.clienteId, selectedClientObj]);

  const totalAnticiposDisponibles = useMemo(() => {
    return selectedClientAnticipos.reduce((acc, item) => acc + Math.abs(Number(item.saldo)), 0);
  }, [selectedClientAnticipos]);

  useEffect(() => {
    if (cobranzaForm.clienteId) {
      const stillExists = clientsWithDebt.some(c => c.id === cobranzaForm.clienteId);
      if (!stillExists) {
        setCobranzaForm(prev => ({ ...prev, clienteId: '' }));
        setAbonos({});
        setAnticipoGlobal('');
      }
    }
  }, [clientsWithDebt, cobranzaForm.clienteId]);

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
  const sumPagosDisplay = cobranzaForm.pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0); const montoBanco = totalFacturasAplicadas - totalAnticiposAplicados;

  const handleAbonoChange = (docId: string, value: string, maxSaldo: number) => {
    let stringToStore = value;
    if (value !== '') {
      let numValue = Number(value);
      if (!isNaN(numValue)) {
        if (numValue < 0) stringToStore = '0';
        else if (numValue > maxSaldo) stringToStore = maxSaldo.toString();
      }
    }
    
    setAbonos(prev => ({
      ...prev,
      [docId]: stringToStore
    }));
  };

  const handlePagarTotal = (docId: string, maxSaldo: number) => {
    setAbonos(prev => ({
      ...prev,
      [docId]: maxSaldo.toString()
    }));
  };

  const selectedBanco = useMemo(() => bancos.find(b => b.id === cobranzaForm.bancoId), [bancos, cobranzaForm.bancoId]);
  const isVES = selectedBanco?.moneda === 'VES' || selectedBanco?.moneda === 'Bs' || selectedBanco?.moneda === 'Bs.' || selectedBanco?.moneda === 'Bolivares';

  const getSapsLockDate = (bId: string) => {
    const sapsMovs = movimientosBancos.filter(m => String(m.banco_id) === String(bId) && (m.tipo === 'ajuste_ganancia' || m.tipo === 'ajuste_perdida') && m.estado !== 'anulado');
    if (sapsMovs.length === 0) return null;
    sapsMovs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    return sapsMovs[0].fecha;
  };

  const handleProcesarCobro = async () => {
    if (workingYear && cobranzaForm.fecha) {
      const year = cobranzaForm.fecha.substring(0, 4);
      if (year !== workingYear) {
        showToast?.(`No se puede procesar el cobro porque el año de la fecha seleccionada (${year}) no coincide con el período contable seleccionado (${workingYear}).`, 'error');
        return;
      }
    }

    if (totalFacturasAplicadas <= 0 && totalAnticiposAplicados <= 0) return showToast?.('Debe aplicar al menos un monto', 'error');
    
    const sumPagos = cobranzaForm.pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
    const montoFacturas = totalFacturasAplicadas - totalAnticiposAplicados;
    
    if (sumPagos < montoFacturas - 0.01) {
      return showToast?.('El monto total de los pagos no cubre el total de facturas aplicadas', 'error');
    }
    
    if (sumPagos > 0 && cobranzaForm.pagos.length === 0) {
      return showToast?.('Agregue al menos un método de pago', 'error');
    }

    for (const p of cobranzaForm.pagos) {
      if (!p.bancoId) return showToast?.('Seleccione un banco para todos los pagos', 'error');
      if (!p.referencia) return showToast?.('Ingrese referencia para todos los pagos', 'error');
      if (!p.monto || Number(p.monto) <= 0) return showToast?.('Ingrese montos válidos para los pagos', 'error');
    }

    if (sumPagos > 0 && configContable?.habilitarTasaReferencialCobranza && !cobranzaForm.tasaReferencial) {
      const hasVES = cobranzaForm.pagos.some(p => {
        const b = bancos.find(x => x.id === p.bancoId);
        return b && (b.moneda === 'VES' || b.moneda === 'Bs' || b.moneda === 'Bs.');
      });
      if (hasVES) return showToast?.('Debe ingresar la Tasa Referencial Paralela para cobros en Bs.', 'error');
    }

    try {
      const clienteObj = clientes.find(c => c.id === cobranzaForm.clienteId);
      const nameOfClient = clienteObj?.nombre || selectedClientDebts[0]?.cliente || 'Cliente';
      
      const sobrante = sumPagos - montoFacturas;
      const tieneSobrante = sobrante > 0.01 && montoFacturas > 0;
      
      const entidadSobranteId = tieneSobrante ? (cobranzaForm.entidadSobranteId || cobranzaForm.clienteId) : null;
      const entidadSobranteObj = entidadSobranteId ? contactos.find(c => c.id === entidadSobranteId) : clienteObj;
      const nombreSobrante = entidadSobranteObj?.nombre || nameOfClient;

      const draftMovs: any[] = [];
      const lineas: any[] = [];
      
      for (const p of cobranzaForm.pagos) {
        const b = bancos.find(x => x.id === p.bancoId);
        const cuentaBanco = b?.cuenta_contable_id || '1.1.3';
        
        draftMovs.push({
          id: `mov-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
          banco_id: p.bancoId,
          fecha: cobranzaForm.fecha,
          ref: p.referencia,
          descripcion: `Cobro a cliente ${nameOfClient}`,
          tipo: 'ingreso',
          monto: Number(p.monto),
          tasa: cobranzaForm.tasa || 1,
          estado: 'activo',
          cliente_asignado: cobranzaForm.clienteId
        });
        
        lineas.push({
          id: `l-${Date.now()}-${Math.random().toString(36).substring(2,7)}`,
          cuentaId: cuentaBanco,
          descripcion: `Cobro a cliente ${nameOfClient} - ${b?.banco || 'Banco'}`,
          debe: Number(p.monto),
          haber: 0
        });
      }

      if (totalAnticiposAplicados > 0) {
        lineas.push({
          id: `l-ant-${Date.now()}`,
          cuentaId: configContable?.cuentaAnticipoRecibido || '2.1.1',
          descripcion: `Aplicación de anticipo - Cliente ${nameOfClient}`,
          debe: totalAnticiposAplicados,
          haber: 0
        });
      }

      const cuentaCxc = clienteObj?.cuenta_contable_id || configContable?.cuentaCxc || '1.1.4';
      
      if (totalFacturasAplicadas > 0) {
        lineas.push({
          id: `l-cxc-${Date.now()}`,
          cuentaId: cuentaCxc,
          descripcion: `Cancelación de facturas - Cliente ${nameOfClient}`,
          debe: 0,
          haber: totalFacturasAplicadas
        });
      }

      let draftAnticipoSobrante = null;

      if (tieneSobrante) {
        lineas.push({
          id: `l-sob-${Date.now()}`,
          cuentaId: configContable?.cuentaAnticipoRecibido || '2.1.1',
          descripcion: `Anticipo por sobrante - ${nombreSobrante}`,
          debe: 0,
          haber: sobrante
        });
        
        draftAnticipoSobrante = {
          id: `ant-${Date.now()}`,
          categoria: 'clientes',
          cliente: nombreSobrante,
          cliente_id: entidadSobranteId,
          factura_id: `ANT-${Date.now().toString().slice(-4)}`,
          fecha: cobranzaForm.fecha,
          vencimiento: cobranzaForm.fecha,
          descripcion: `Anticipo generado por sobrante de cobro a ${nameOfClient}`,
          tipo: 'anticipo',
          monto: -sobrante,
          total: -sobrante,
          saldo: -sobrante,
          moneda: 'Dólares (USD)',
          tasa: cobranzaForm.tasa || 1,
          estado: 'pendiente'
        };
      }

      const isBalanced = Math.abs(lineas.reduce((s,l)=>s+(Number(l.debe)||0),0) - lineas.reduce((s,l)=>s+(Number(l.haber)||0),0)) < 0.01;

      const draftComprobante = {
        id: crypto.randomUUID(),
        fecha: cobranzaForm.fecha,
        numero: `CMP-${Date.now().toString().slice(-6)}`,
        tipo: 'Diario',
        descripcion: `Cobro múltiple a ${nameOfClient}`,
        referencia: cobranzaForm.pagos[0]?.referencia || 'VARIOS',
        total: Math.max(
          lineas.reduce((acc, curr) => acc + (Number(curr.debe) || 0), 0),
          lineas.reduce((acc, curr) => acc + (Number(curr.haber) || 0), 0)
        ),
        estado: isBalanced ? 'Contabilizado' : 'Descuadrado',
        lineas: lineas
      };

      setPendingVoucher({
        comprobante: draftComprobante,
        movimiento: draftMovs[0] || null, // UI might still expect single mov for preview, we pass the first or we can adapt VoucherPreviewModal later.
        onConfirm: async (finalComprobante: any) => {
          try {
            const abonosLog: any[] = [];
            const anticiposAplicadosLog: any[] = [];
            let tFacturasAplicadas = 0;
            let tAnticiposAplicados = 0;
      
            if (onSave) {
              onSave('comprobantes', finalComprobante);
              
              for (const mov of draftMovs) {
                onSave('movimientosBancos', mov);
              }
              
              if (draftAnticipoSobrante) {
                onSave('cxc', draftAnticipoSobrante);
              }
      
              Object.entries(abonos).forEach(([docId, val]) => {
                const montoNum = Number(val) || 0;
                if (montoNum > 0) {
                  const doc = cxc.find(d => d.id === docId);
                  if (doc) {
                    const newSaldo = doc.saldo - montoNum;
                    const newEstado = newSaldo <= 0.01 ? 'pagada' : 'parcial';
                    const newFechaPago = newSaldo <= 0.01 ? cobranzaForm.fecha : (doc.fechaPago || null);
                    
                    abonosLog.push({ docId: doc.id, facturaId: doc.factura_id, montoAbonado: montoNum });
                    tFacturasAplicadas += montoNum;
                    
                    onSave('cxc', {
                      ...doc,
                      saldo: newSaldo,
                      estado: newEstado,
                      fechaPago: newFechaPago
                    });

                    // Sincronizar factura de venta si existe
                    if (facturas && Array.isArray(facturas)) {
                      const matchedFac = facturas.find((f: any) => {
                        const facIdStr = String(f.id || '').toLowerCase();
                        const facNumStr = String(f.numero || '').trim().toLowerCase();
                        const docFacId = String(doc.factura_id || doc.factura_db_id || '').toLowerCase();
                        const docFacNum = String(doc.factura || doc.numero || '').trim().toLowerCase();
                        const docMetaFacId = String(doc.metadata?.factura_id || '').toLowerCase();
                        const docMetaFacNum = String(doc.metadata?.factura_numero || '').trim().toLowerCase();
                        return (docFacId && (docFacId === facIdStr || docFacId === facNumStr)) ||
                               (docFacNum && (docFacNum === facNumStr || docFacNum === facIdStr)) ||
                               (docMetaFacId && (docMetaFacId === facIdStr || docMetaFacId === facNumStr)) ||
                               (docMetaFacNum && (docMetaFacNum === facNumStr || docMetaFacNum === facIdStr)) ||
                               (doc.descripcion && facNumStr && doc.descripcion.toLowerCase().includes(facNumStr));
                      });

                      if (matchedFac) {
                        const targetFacEstado = newSaldo <= 0.009 ? 'cobrada' : 'parcial';
                        const targetSaldoUSD = Math.max(0, newSaldo);
                        const targetSaldoBs = targetSaldoUSD * (matchedFac.tasa_cambio || 1);
                        onSave('facturasVenta', {
                          ...matchedFac,
                          estado: targetFacEstado,
                          saldo_pendiente: targetSaldoUSD,
                          saldo_pendiente_bs: targetSaldoBs,
                          cxc_id: doc.id,
                          updated_at: new Date().toISOString()
                        });
                      }
                    }
                  }
                }
              });
      
              let remainingAnticipoToConsume = Number(anticipoGlobal) || 0;
              
              if (remainingAnticipoToConsume > 0) {
                const clientNameLow = selectedClientObj?.nombre?.toLowerCase() || '';
                const availableAnticipos = cxc.filter(d => {
                  const matchId = d.cliente_id === cobranzaForm.clienteId || d.cliente === cobranzaForm.clienteId;
                  const matchName = clientNameLow && d.cliente && d.cliente.toLowerCase() === clientNameLow;
                  const idStr = String(d.id || '').toLowerCase();
                  const facStr = String(d.factura || d.factura_id || '').toLowerCase();
                  const isCreditDoc = d.tipo === 'anticipo' || d.tipo === 'nota_credito' || idStr.startsWith('ant-') || idStr.includes('cxc-nc-') || idStr.startsWith('nc-') || facStr.startsWith('nc-') || Number(d.saldo) < 0;
                  const availAmount = Math.abs(Number(d.saldo) || 0);
                  return (matchId || matchName) && isCreditDoc && d.estado !== 'anulada' && availAmount > 0.001;
                }).sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
                
                for (const ant of availableAnticipos) {
                  if (remainingAnticipoToConsume <= 0) break;
                  
                  const saldoAntAbs = Math.abs(Number(ant.saldo) || Number(ant.monto) || 0);
                  const amountToTake = Math.min(saldoAntAbs, remainingAnticipoToConsume);
                  remainingAnticipoToConsume -= amountToTake;
                  tAnticiposAplicados += amountToTake;
                  
                  const newSaldoAntAbs = saldoAntAbs - amountToTake;
                  const newSaldoVal = newSaldoAntAbs <= 0.001 ? 0 : -newSaldoAntAbs;
                  const newEstadoAnt = newSaldoAntAbs <= 0.001 ? 'aplicada' : ant.estado;

                  anticiposAplicadosLog.push({ anticipoId: ant.id, facturaRef: ant.factura || ant.factura_id, montoAplicado: amountToTake });
                  
                  onSave('cxc', {
                    ...ant,
                    saldo: newSaldoVal,
                    saldo_usd: newSaldoVal,
                    saldoBs: newSaldoVal * (ant.tasa || 1),
                    saldo_bs: newSaldoVal * (ant.tasa || 1),
                    estado: newEstadoAnt
                  });
                }
                
                if (remainingAnticipoToConsume > 0) {
                  const client = clientes.find(c => c.id === cobranzaForm.clienteId);
                  if (client) {
                    onSave('clientes', {
                      ...client,
                      anticipoDisponible: Math.max(0, (client.anticipoDisponible || 0) - remainingAnticipoToConsume)
                    });
                    tAnticiposAplicados += remainingAnticipoToConsume;
                  }
                }
              }
      
              const newCobranza = {
                id: `cob-${Date.now()}`,
                fecha: cobranzaForm.fecha,
                clienteId: cobranzaForm.clienteId,
                clienteNombre: nameOfClient,
                monto: tFacturasAplicadas,
                bancoId: cobranzaForm.pagos[0]?.bancoId || '',
                referencia: cobranzaForm.pagos.map(p => p.referencia).join(', ') || `COB-${Date.now().toString().slice(-4)}`,
                tasa: Number(cobranzaForm.tasa) || 1,
                tasaReferencial: cobranzaForm.tasaReferencial ? Number(cobranzaForm.tasaReferencial) : null,
                comprobanteId: finalComprobante.id,
                movimientoBancoId: null,
                estado: 'activo',
                abonos: abonosLog,
                anticiposAplicadosLog: anticiposAplicadosLog,
                totalAnticiposAplicados: tAnticiposAplicados,
                montoBanco: sumPagos,
                pagos: cobranzaForm.pagos,
                movimientoBancoIds: draftMovs.map((m) => m.id),
                anticipoSobranteId: draftAnticipoSobrante ? draftAnticipoSobrante.id : null
              };
              
              onSave('cobranzas', newCobranza);
            }
      
            showToast?.('Cobro procesado exitosamente', 'success');
            
            setCobranzaForm({
              fecha: new Date().toISOString().split('T')[0],
              clienteId: '',
              tasa: 1,
              tasaReferencial: '',
              pagos: [],
              entidadSobranteId: ''
            });
            setSelectedClientKey(null);
            
            setPendingVoucher(null);
            
          } catch (error: any) {
            console.error(error);
            showToast?.(error.message, 'error');
          }
        }
      });
    } catch (error: any) {
      console.error(error);
      showToast?.(error.message, 'error');
    }
  };

  const handleSaveNewMov = () => {
    if (workingYear && newMovForm.fecha) {
      const year = newMovForm.fecha.substring(0, 4);
      if (year !== workingYear) {
        showToast?.(`No se puede guardar el movimiento porque el año de la fecha seleccionada (${year}) no coincide con el período contable seleccionado (${workingYear}).`, 'error');
        return;
      }
    }

    if (!newMovForm.bancoId || !newMovForm.entidad || !newMovForm.monto || !newMovForm.descripcion) {
      showToast?.('Por favor complete todos los campos requeridos', 'error');
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

    // 1. Crear movimiento bancario (egreso)
    const newMov = {
      id: nowTs,
      banco_id: newMovForm.bancoId,
      fecha: newMovForm.fecha,
      ref: newMovForm.referencia || `REF-${nowTs.slice(-4)}`,
      descripcion: newMovForm.descripcion,
      tipo: 'egreso' as const,
      monto: montoNum,
      tasa: isNewMovVES ? Number(newMovForm.tasa) : (banco.tasa || 1),
      estado: 'activo'
    };

    // 2. Crear registro en CXC
    const targetCategory = activeTab === 'cobranza' || activeTab === 'historial-cobranzas' || activeTab === 'clientes' || activeTab === 'aliados' ? 'aliados' : activeTab;
    const newCxc = {
      id: nowTs + '-cxc',
      categoria: targetCategory,
      cliente: newMovForm.entidad,
      cliente_id: newMovForm.entidad_id || `ENT-${nowTs.slice(-4)}`,
      factura_id: `MOV-${nowTs.slice(-4)}`,
      fecha: newMovForm.fecha,
      vencimiento: newMovForm.fecha,
      descripcion: newMovForm.descripcion,
      tipo: 'prestamo',
      total: montoNum,
      saldo: montoNum
    };

    // 3. Crear comprobante contable
    let cuentaEntidad = configContable?.cuentaCxc || '1.1.4';
    const contact = contactos.find(c => c.id === newMovForm.entidad_id || c.taxId === newMovForm.entidad_id);
    if (contact) {
      cuentaEntidad = contact.debitAccount || cuentaEntidad;
      newCxc.cliente = contact.name;
      newCxc.cliente_id = contact.taxId || contact.id;
    }

    const lineas = [
      {
        id: `l1-${nowTs}`,
        cuentaId: cuentaEntidad,
        descripcion: `CxC ${newCxc.cliente}`,
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
      fecha: newMovForm.fecha,
      numero: `CMP-${nowTs.slice(-6)}`,
      tipo: 'Diario',
      descripcion: `Préstamo/Anticipo a ${newCxc.cliente}`,
      referencia: newMov.ref || newCxc.factura_id,
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
          onSave('cxc', newCxc);
          onSave('comprobantes', finalComprobante);
        }

        showToast?.('Movimiento y cuenta por cobrar registrados exitosamente', 'success');
        setPendingVoucher(null);
        setShowNewModal(false);
        setNewMovForm({
          bancoId: '',
          fecha: new Date().toISOString().split('T')[0],
          referencia: '',
          descripcion: '',
          monto: '',
          entidad: '',
          entidad_id: '',
          tasa: '',
          montoBs: ''
        });
        navigate('/reports/comprobante-movimiento-banco', { state: { movimiento: newMov } });
      }
    });
  };

  const handleSaveAnticipo = () => {
    if (workingYear && anticipoForm.fecha) {
      const year = anticipoForm.fecha.substring(0, 4);
      if (year !== workingYear) {
        showToast?.(`No se puede guardar el anticipo porque el año de la fecha seleccionada (${year}) no coincide con el período contable seleccionado (${workingYear}).`, 'error');
        return;
      }
    }

    if (!anticipoForm.bancoId || !anticipoForm.cliente || !anticipoForm.monto || !anticipoForm.descripcion) {
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

    // 1. Crear movimiento bancario (ingreso)
    const newMov = {
      id: nowTs,
      banco_id: anticipoForm.bancoId,
      fecha: anticipoForm.fecha,
      ref: anticipoForm.referencia || `ANT-${nowTs.slice(-4)}`,
      descripcion: anticipoForm.descripcion,
      tipo: 'ingreso' as const,
      monto: montoNum,
      tasa: isAnticipoVES ? Number(anticipoForm.tasa) : (banco.tasa || 1),
      estado: 'activo',
      cliente_asignado: anticipoForm.cliente_id || `CLI-${nowTs.slice(-4)}`
    };

    // 2. Crear registro en CXC con saldo negativo (a favor del cliente)
    const newCxc = {
      id: nowTs + '-cxc',
      categoria: activeTab === 'cobranza' || activeTab === 'clientes' ? 'aliados' : activeTab,
      cliente: anticipoForm.cliente,
      cliente_id: anticipoForm.cliente_id || `CLI-${nowTs.slice(-4)}`,
      factura_id: `ANT-${nowTs.slice(-4)}`,
      fecha: anticipoForm.fecha,
      vencimiento: anticipoForm.fecha,
      descripcion: anticipoForm.descripcion,
      tipo: 'anticipo',
      total: -montoNum,
      saldo: -montoNum
    };

    // 3. Crear comprobante contable
    const cuentaAnticipo = configContable?.cuentaAnticipoRecibido || '2.1.1'; // Pasivo por defecto
    const lineas = [
      {
        id: `l1-${nowTs}`,
        cuentaId: banco.cuenta_contable_id || '1.1.3',
        descripcion: `Ingreso a Banco ${banco.banco}`,
        debe: montoNum,
        haber: 0
      },
      {
        id: `l2-${nowTs}`,
        cuentaId: cuentaAnticipo,
        descripcion: `Anticipo de Cliente ${newCxc.cliente}`,
        debe: 0,
        haber: montoNum
      }
    ];

    const isBalanced = Math.abs(lineas.reduce((s,l)=>s+(Number(l.debe)||0),0) - lineas.reduce((s,l)=>s+(Number(l.haber)||0),0)) < 0.01;
    const isDescuadrado = !isBalanced || lineas.some(l => !l.cuentaId);

    const newComprobante = {
      id: crypto.randomUUID(),
      fecha: anticipoForm.fecha,
      numero: `CMP-${nowTs.slice(-6)}`,
      tipo: 'Diario',
      descripcion: `Anticipo recibido de ${newCxc.cliente}`,
      referencia: newMov.ref || newCxc.factura_id,
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
          onSave('cxc', newCxc);
          onSave('comprobantes', finalComprobante);
        }

        showToast?.('Anticipo registrado exitosamente', 'success');
        setPendingVoucher(null);
        setShowAnticipoModal(false);
        setAnticipoForm({
          cliente: '',
          cliente_id: '',
          bancoId: '',
          fecha: new Date().toISOString().split('T')[0],
          referencia: '',
          descripcion: 'Anticipo de cliente',
          monto: '',
          tasa: '',
          montoBs: ''
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

    const docId = saldoInicialForm.factura_id || `SI-${Date.now().toString().slice(-4)}`;

    // 1. Crear registro en CXC
    const newCxc = {
      id: Date.now().toString() + '-cxc',
      categoria: activeTab === 'cobranza' || activeTab === 'clientes' ? 'aliados' : activeTab,
      cliente: saldoInicialForm.contacto,
      cliente_id: saldoInicialForm.contacto_id || `CLI-${Date.now().toString().slice(-4)}`,
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
      let cuentaCxc = configContable?.cuentaCxc || '1.1.4';
      const contact = contactos.find(c => c.id === saldoInicialForm.contacto_id || c.taxId === saldoInicialForm.contacto_id);
      if (contact && contact.debitAccount) {
        cuentaCxc = contact.debitAccount;
      }

      const lineas = [
        {
          id: `l1-${Date.now()}`,
          cuentaId: cuentaCxc,
          descripcion: `Carga de Saldo Inicial - ${newCxc.cliente}`,
          debe: montoNum,
          haber: 0
        },
        {
          id: `l2-${Date.now()}`,
          cuentaId: saldoInicialForm.cuentaContrapartida,
          descripcion: `Contrapartida Saldo Inicial - ${newCxc.cliente}`,
          debe: 0,
          haber: montoNum
        }
      ];

      const isBalanced = Math.abs(lineas.reduce((s,l)=>s+(Number(l.debe)||0),0) - lineas.reduce((s,l)=>s+(Number(l.haber)||0),0)) < 0.01;
      const isDescuadrado = !isBalanced || lineas.some(l => !l.cuentaId);

      const newComprobante = {
        id: crypto.randomUUID(),
        fecha: saldoInicialForm.fecha,
        numero: `CMP-${Date.now().toString().slice(-6)}`,
        tipo: 'Diario',
        descripcion: `Carga de Saldo Inicial - ${newCxc.cliente}`,
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
            onSave('cxc', newCxc);
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
            descripcion: 'Saldo Inicial de CxC',
            monto: '',
            moneda: 'Dólares (USD)',
            tasa: '1.00',
            cuentaContrapartida: ''
          });
        }
      });
    } else {
      if (onSave) {
        onSave('cxc', newCxc);
      }
      showToast?.('Saldo inicial cargado exitosamente', 'success');
      setShowSaldoInicialModal(false);
      setSaldoInicialForm({
        contacto: '',
        contacto_id: '',
        factura_id: '',
        fecha: new Date().toISOString().split('T')[0],
        vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        descripcion: 'Saldo Inicial de CxC',
        monto: '',
        moneda: 'Dólares (USD)',
        tasa: '1.00',
        cuentaContrapartida: ''
      });
    }
  };

  const handleDeleteDoc = async (docItem: any) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar el documento de cobro ${docItem.factura_id || docItem.id}? Esta operación es irreversible y eliminará también el movimiento de banco y asiento contable asociado.`)) {
      return;
    }
    try {
      if (onSave) {
        onSave('cxc', { id: docItem.id, _delete: true });
        
        // Find and delete associated bank movement
        const bankMovId = docItem.id.replace('-cxc', '');
        const matchedMov = (movimientosBancos || []).find(m => String(m.id) === String(bankMovId));
        if (matchedMov) {
          onSave('movimientosBancos', { id: matchedMov.id, _delete: true });
        }

        // Find and delete associated accounting entry (comprobante)
        if (comprobantes && comprobantes.length > 0) {
          const matchedComp = comprobantes.find(c => 
            c.referencia === (docItem.factura_id || docItem.id) ||
            (matchedMov && c.referencia === matchedMov.ref)
          );
          if (matchedComp) {
            onSave('comprobantes', { id: matchedComp.id, _delete: true });
          }
        }
        
        setSelectedClientKey(null);
        showToast?.('Documento de cobro y sus impactos contables/bancarios vinculados han sido eliminados exitosamente.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast?.('Error al eliminar el documento.', 'error');
    }
  };

  const handleRestoreVirtualCobro = (virtualItem: any) => {
    const docAsociado = cxc.find(d => d.factura_id === virtualItem.referencia || d.id === virtualItem.referencia);
    if (!docAsociado) {
      showToast?.('No se encontró el documento de origen asociado a esta cobranza.', 'error');
      return;
    }

    setMasterAuth({
      isOpen: true,
      title: 'Autorización Master Requerida',
      actionName: 'Eliminar Registro de Cobro',
      actionDetails: `Restaurar saldo de factura ${virtualItem.referencia} a $${formatoES(docAsociado.total || 0)} (${selectedClient?.cliente || ''})`,
      onSuccess: async () => {
        try {
          if (onSave) {
            const updatedDoc = {
              ...docAsociado,
              saldo: docAsociado.total || docAsociado.monto || 0,
              estado: 'pendiente',
              fechaPago: null
            };
            onSave('cxc', updatedDoc);

            if (facturas && Array.isArray(facturas)) {
              const matchedFac = facturas.find((f: any) => {
                const facIdStr = String(f.id || '').toLowerCase();
                const facNumStr = String(f.numero || '').trim().toLowerCase();
                const docFacId = String(docAsociado.factura_id || docAsociado.factura_db_id || '').toLowerCase();
                const docFacNum = String(docAsociado.factura || docAsociado.numero || '').trim().toLowerCase();
                const docMetaFacId = String(docAsociado.metadata?.factura_id || '').toLowerCase();
                const docMetaFacNum = String(docAsociado.metadata?.factura_numero || '').trim().toLowerCase();
                return (docFacId && (docFacId === facIdStr || docFacId === facNumStr)) ||
                       (docFacNum && (docFacNum === facNumStr || docFacNum === facIdStr)) ||
                       (docMetaFacId && (docMetaFacId === facIdStr || docMetaFacId === facNumStr)) ||
                       (docMetaFacNum && (docMetaFacNum === facNumStr || docMetaFacNum === facIdStr)) ||
                       (docAsociado.descripcion && facNumStr && docAsociado.descripcion.toLowerCase().includes(facNumStr));
              });

              if (matchedFac) {
                const restTotal = Number(matchedFac.total) || 0;
                onSave('facturasVenta', {
                  ...matchedFac,
                  estado: 'emitida',
                  saldo_pendiente: restTotal,
                  saldo_pendiente_bs: restTotal * (matchedFac.tasa_cambio || 1),
                  updated_at: new Date().toISOString()
                });
              }
            }
            
            setSelectedClientKey(null);
            showToast?.('Saldo restaurado exitosamente y cobranza eliminada.', 'success');
          }
        } catch (err) {
          console.error(err);
          showToast?.('Error al restaurar saldo.', 'error');
        }
      }
    });
  };

  const handleEditDocClick = (docItem: any) => {
    setEditingDoc(docItem);
    setEditDocForm({
      id: docItem.id || '',
      factura_id: docItem.factura_id || '',
      fecha: docItem.fecha || new Date().toISOString().split('T')[0],
      descripcion: docItem.descripcion || docItem.concepto || '',
      total: String(docItem.total || docItem.monto || ''),
      saldo: String(docItem.saldo || '')
    });
    setShowEditDocModal(true);
  };

  const handleSaveEditDoc = () => {
    if (!editDocForm.factura_id || !editDocForm.total || !editDocForm.saldo) {
      showToast?.('Por favor, complete todos los campos obligatorios.', 'error');
      return;
    }

    const totalNum = Number(editDocForm.total);
    const saldoNum = Number(editDocForm.saldo);

    if (totalNum <= 0) {
      showToast?.('El monto total debe ser mayor que 0.', 'error');
      return;
    }
    if (saldoNum < 0 || saldoNum > totalNum) {
      showToast?.('El saldo pendiente no puede ser negativo ni mayor que el monto total.', 'error');
      return;
    }

    try {
      if (onSave && editingDoc) {
        const updatedDoc = {
          ...editingDoc,
          fecha: editDocForm.fecha,
          factura_id: editDocForm.factura_id,
          descripcion: editDocForm.descripcion,
          concepto: editDocForm.descripcion,
          total: totalNum,
          monto: totalNum,
          saldo: saldoNum,
          estado: saldoNum <= 0.01 
            ? 'pagado' 
            : saldoNum >= (totalNum - 0.01) 
              ? 'pendiente' 
              : 'parcial'
        };
        onSave('cxc', updatedDoc);

        if (facturas && Array.isArray(facturas)) {
          const matchedFac = facturas.find((f: any) => {
            const facIdStr = String(f.id || '').toLowerCase();
            const facNumStr = String(f.numero || '').trim().toLowerCase();
            const docFacId = String(editingDoc.factura_id || editingDoc.factura_db_id || '').toLowerCase();
            const docFacNum = String(editingDoc.factura || editingDoc.numero || '').trim().toLowerCase();
            const docMetaFacId = String(editingDoc.metadata?.factura_id || '').toLowerCase();
            const docMetaFacNum = String(editingDoc.metadata?.factura_numero || '').trim().toLowerCase();
            return (docFacId && (docFacId === facIdStr || docFacId === facNumStr)) ||
                   (docFacNum && (docFacNum === facNumStr || docFacNum === facIdStr)) ||
                   (docMetaFacId && (docMetaFacId === facIdStr || docMetaFacId === facNumStr)) ||
                   (docMetaFacNum && (docMetaFacNum === facNumStr || docMetaFacNum === facIdStr)) ||
                   (editingDoc.descripcion && facNumStr && editingDoc.descripcion.toLowerCase().includes(facNumStr));
          });

          if (matchedFac) {
            const targetFacEstado = saldoNum <= 0.009 ? 'cobrada' : saldoNum >= (totalNum - 0.01) ? 'emitida' : 'parcial';
            onSave('facturasVenta', {
              ...matchedFac,
              estado: targetFacEstado,
              saldo_pendiente: Math.max(0, saldoNum),
              saldo_pendiente_bs: Math.max(0, saldoNum) * (matchedFac.tasa_cambio || 1),
              updated_at: new Date().toISOString()
            });
          }
        }
        
        setShowEditDocModal(false);
        setEditingDoc(null);
        setSelectedClientKey(null); // Force groupings update
        showToast?.('Documento actualizado exitosamente.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast?.('Error al guardar los cambios del documento.', 'error');
    }
  };

  const handleReintegroSubmit = () => {
    if (!reintegroTarget) return;
    const amountToRefund = Number(reintegroForm.monto);
    if (!amountToRefund || amountToRefund <= 0) {
      showToast?.('Por favor ingrese un monto válido a reintegrar.', 'warning');
      return;
    }
    const maxRefund = Math.abs(Number(reintegroTarget.saldo) || 0);
    if (amountToRefund > maxRefund + 0.01) {
      showToast?.(`El monto no puede superar el saldo disponible ($${formatoES(maxRefund)}).`, 'error');
      return;
    }
    if (!reintegroForm.bancoId) {
      showToast?.('Por favor seleccione el banco origen del reintegro.', 'warning');
      return;
    }

    try {
      if (onSave) {
        const selectedBank = bancos.find(b => b.id === reintegroForm.bancoId);
        const originalTasa = Number(reintegroTarget.tasa) || 1;
        const bankIsBs = selectedBank?.moneda === 'VES' || selectedBank?.moneda === 'Bs' || selectedBank?.moneda === 'Bs.';
        const amountBank = bankIsBs ? amountToRefund * originalTasa : amountToRefund;
        const nowTs = Date.now().toString();
        const reintRef = reintegroForm.referencia || `REINT-${nowTs.slice(-4)}`;

        // 1. Crear movimiento bancario de egreso
        const movId = `mov-${nowTs}`;
        const newMov = {
          id: movId,
          banco_id: reintegroForm.bancoId,
          fecha: reintegroForm.fecha,
          ref: reintRef,
          descripcion: `Reintegro de saldo a favor a ${reintegroTarget.cliente || 'Cliente'}`,
          tipo: 'egreso',
          monto: amountBank,
          tasa: originalTasa,
          categoria: 'devolucion',
          estado: 'conciliado',
          creador: 'Sistema',
          cliente_asignado: reintegroTarget.cliente_id
        };
        onSave('movimientosBancos', newMov);

        // 2. Reducir el saldo de los anticipos abiertos del cliente
        let remainingToReduce = amountToRefund;
        const clientDocs = (cxc || []).filter((d: any) => {
          const idMatch = d.cliente_id && String(d.cliente_id) === String(reintegroTarget.cliente_id);
          const nameMatch = d.cliente && d.cliente.toLowerCase() === (reintegroTarget.cliente || '').toLowerCase();
          return idMatch || nameMatch;
        });

        clientDocs.forEach((d: any) => {
          const idStr = String(d.id || '').toLowerCase();
          const isAnt = d.tipo === 'anticipo' || idStr.startsWith('ant-') || Number(d.total) < 0 || Number(d.saldo) < 0;
          if (isAnt && remainingToReduce > 0 && Number(d.saldo) < 0) {
            const availableInDoc = Math.abs(Number(d.saldo));
            const reduceHere = Math.min(availableInDoc, remainingToReduce);
            const newDocSaldo = Number(d.saldo) + reduceHere;
            remainingToReduce -= reduceHere;
            onSave('cxc', {
              ...d,
              saldo: newDocSaldo,
              estado: Math.abs(newDocSaldo) <= 0.01 ? 'consumido' : 'pendiente'
            });
          }
        });

        // 3. Crear documento explícito de Reintegro en CxC para que figure en el historial cronológico del cliente
        const reintegroDoc = {
          id: `reint-${nowTs}-cxc`,
          factura_id: reintRef,
          cliente_id: reintegroTarget.cliente_id,
          cliente: reintegroTarget.cliente,
          categoria: reintegroTarget.categoria || activeTab,
          fecha: reintegroForm.fecha,
          vencimiento: reintegroForm.fecha,
          descripcion: `Reintegro / Devolución de saldo a favor`,
          tipo: 'reintegro',
          total: amountToRefund,
          saldo: 0,
          moneda: reintegroTarget.moneda || 'USD',
          tasa: originalTasa,
          estado: 'pagada',
          banco_id: reintegroForm.bancoId,
          movimiento_banco_id: movId
        };
        onSave('cxc', reintegroDoc);

        // 4. Crear Asiento Contable Automático (Comprobante de Diario)
        const cuentaAnticipo = configContable?.cuentaAnticipoRecibido || '2.1.1';
        const cuentaBanco = selectedBank?.cuenta_contable_id || '1.1.3';
        const lineasComp = [
          {
            id: `l1-${nowTs}`,
            cuentaId: cuentaAnticipo,
            descripcion: `Reintegro de anticipo a cliente ${reintegroTarget.cliente}`,
            debe: amountToRefund,
            haber: 0
          },
          {
            id: `l2-${nowTs}`,
            cuentaId: cuentaBanco,
            descripcion: `Egreso bancario ${selectedBank?.banco || ''} por reintegro`,
            debe: 0,
            haber: amountToRefund
          }
        ];

        const compReintegro = {
          id: crypto.randomUUID(),
          fecha: reintegroForm.fecha,
          numero: `CMP-${nowTs.slice(-6)}`,
          tipo: 'Diario',
          descripcion: `Reintegro de saldo a favor a ${reintegroTarget.cliente}`,
          referencia: reintRef,
          total: amountToRefund,
          estado: 'Contabilizado',
          lineas: lineasComp
        };
        onSave('comprobantes', compReintegro);

        showToast?.('Reintegro registrado exitosamente en bancos, cuentas por cobrar e historial del cliente.', 'success');
        setReintegroTarget(null);
        setSelectedClientKey(null); // Force refresh
      }
    } catch (err) {
      console.error(err);
      showToast?.('Error al procesar el reintegro.', 'error');
    }
  };

  // Combinar documentos de CxC y cobranzas relacionadas
  const historialCliente = useMemo(() => {
    if (!selectedClient) return { movs: [], saldoInicial: 0 };
    
    // 1. Cargos y Anticipos (Documentos / Facturas)
    const docs = (selectedClient.documentos || []).map((d: any) => ({
      ...d,
      _tipo: 'documento',
      _fecha: new Date(d.fecha || d.createdAt).getTime(),
      fechaStr: d.fecha || new Date(d.createdAt).toISOString().split('T')[0]
    }));

    // 2. Abonos (Pagos recibidos a través del módulo de Cobranzas)
    const clientIdStr = String(selectedClient?.id || selectedClient?.cliente_id || '').trim();
    const contactObj = contactos.find(c => 
      c.id === clientIdStr || 
      c.taxId === clientIdStr || 
      (selectedClient?.rif && c.taxId?.toLowerCase() === selectedClient.rif.toLowerCase()) ||
      (selectedClient?.cliente && c.name?.toLowerCase() === selectedClient.cliente.toLowerCase())
    );
    const clientDocIds = new Set((selectedClient.documentos || []).map((d: any) => String(d.id || d.factura_id || d.factura || '')));
    
    const cobros = (cobranzas || []).filter((cob: any) => {
      if (cob.estado === 'anulado') return false;
      // Filtrar cobranzas por ID de cliente, o nombre como fallback
      if (cob.clienteId && String(cob.clienteId) === clientIdStr) return true;
      if (contactObj && cob.clienteId && (String(cob.clienteId) === contactObj.id || String(cob.clienteId) === contactObj.taxId)) return true;
      if (cob.clienteNombre && selectedClient?.cliente && cob.clienteNombre.toLowerCase() === selectedClient.cliente.toLowerCase()) return true;
      
      // Filter by document ID references in abonos/detalles
      if (cob.abonos) {
        if (Array.isArray(cob.abonos) && cob.abonos.some((a: any) => clientDocIds.has(String(a.docId || a.id || '')))) return true;
        if (typeof cob.abonos === 'object' && Object.keys(cob.abonos).some(k => clientDocIds.has(String(k)))) return true;
      }
      if (cob.detalles) {
        if (Array.isArray(cob.detalles) && cob.detalles.some((d: any) => clientDocIds.has(String(d.docId || d.id || '')))) return true;
        if (typeof cob.detalles === 'object') {
          if (Array.isArray(cob.detalles.items) && cob.detalles.items.some((d: any) => clientDocIds.has(String(d.docId || d.id || '')))) return true;
          if (Object.keys(cob.detalles).some(k => clientDocIds.has(String(k)))) return true;
        }
      }
      
      return false;
    }).flatMap((cob: any) => {
      const baseCobro = {
        ...cob,
        _tipo: 'cobro',
        _fecha: new Date(cob.fecha || cob.createdAt || 0).getTime(),
        fechaStr: cob.fecha || new Date(cob.createdAt || 0).toISOString().split('T')[0]
      };

      if (cob.pagos && Array.isArray(cob.pagos) && cob.pagos.length > 0) {
        let remainingToApply = Number(cob.monto) || Number(cob.montoTotal) || Number(cob.monto_total) || 0;
        return cob.pagos.map((p: any, idx: number) => {
          const b = bancos.find(x => x.id === p.bancoId);
          let assignedMonto = 0;
          const pMonto = Number(p.monto) || 0;
          if (remainingToApply > 0) {
            assignedMonto = Math.min(pMonto, remainingToApply);
            remainingToApply -= assignedMonto;
          }
          return {
            ...baseCobro,
            id: `${cob.id}-p${idx}`,
            monto: assignedMonto,
            referencia: p.referencia || cob.referencia,
            descripcion: `Abono - ${b?.banco || 'Pago'} (Ref: ${p.referencia || ''})`,
          };
        }).filter((item: any) => item.monto > 0);
      }

      return [{ ...baseCobro, monto: Number(cob.monto) || Number(cob.montoTotal) || Number(cob.monto_total) || 0 }];
    });

    // 2.5 Generate virtual abonos for fully/partially paid docs that have no corresponding cobro
    const cobroDocIds = new Set<string>();
    cobros.forEach((cob: any) => {
      if (Array.isArray(cob.abonos)) {
        cob.abonos.forEach((a: any) => {
          const id = a.docId || a.id || a.facturaId;
          if (id) cobroDocIds.add(String(id));
        });
      } else if (cob.abonos && typeof cob.abonos === 'object') {
        Object.keys(cob.abonos).forEach(k => cobroDocIds.add(String(k)));
      }

      if (Array.isArray(cob.detalles)) {
        cob.detalles.forEach((d: any) => {
          const id = d.docId || d.id || d.facturaId;
          if (id) cobroDocIds.add(String(id));
        });
      } else if (cob.detalles && typeof cob.detalles === 'object') {
        if (Array.isArray(cob.detalles.items)) {
          cob.detalles.items.forEach((d: any) => {
            const id = d.docId || d.id || d.facturaId;
            if (id) cobroDocIds.add(String(id));
          });
        }
        Object.keys(cob.detalles).forEach(k => {
          if (k !== 'cliente_nombre' && k !== 'items') cobroDocIds.add(String(k));
        });
      }
    });

    const virtualAbonos: any[] = [];
    docs.forEach(d => {
       const dId = String(d.id || d.factura_id || d.factura || '');
       if (dId && !cobroDocIds.has(dId) && (d.tipo !== 'anticipo' && d.tipo !== 'nota_credito')) {
         const totalDoc = Math.abs(Number(d.total) || Number(d.monto) || 0);
         const saldoDoc = d.saldo !== undefined ? Number(d.saldo) : totalDoc;
         const paid = totalDoc - saldoDoc;
         if (paid > 0.01 && d.estado !== 'anulada') {
            virtualAbonos.push({
               id: `cob-virtual-${dId}`,
               _tipo: 'cobro',
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

    const allMovs = [...docs, ...cobros, ...virtualAbonos].sort((a, b) => a._fecha - b._fecha);

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

      if (item._tipo === 'cobro') {
        // En cuentas por cobrar, un cobro SIEMPRE es un abono (reduce la deuda)
        abono = Math.max(0, (Number(item.monto) || 0));
      } else {
        // Un documento
        const idStr = String(item.id || '').toLowerCase();
        const facStr = String(item.factura || item.factura_id || '').toLowerCase();
        const isCreditDoc = item.tipo === 'anticipo' || item.tipo === 'nota_credito' || idStr.startsWith('ant-') || idStr.includes('cxc-nc-') || idStr.startsWith('nc-') || facStr.startsWith('nc-') || Number(item.total) < 0 || Number(item.monto) < 0;

        const docMonto = Math.abs(Number(item.total) || Number(item.monto) || Number(item.monto_usd) || Number(item.saldo) || 0);

        if (isCreditDoc) {
          abono = docMonto;
          cargo = 0;
        } else if (item.estado === 'anulada') {
          cargo = 0;
          abono = 0;
        } else {
          cargo = docMonto;
          abono = 0;
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
        // Solo agregar si genera un movimiento financiero real o es un documento
        if (cargo > 0 || abono > 0 || item._tipo === 'documento') {
          movsList.push({
            ...item,
            __cargo: cargo,
            __abono: abono
          });
        }
      }
    });

    return { movs: movsList, saldoInicial };
  }, [selectedClient, cobranzas, filtrosHistorial, bancos, movimientosBancos]);

  // --- SUBMODULO DE HISTORIAL DE COBRANZAS ---
  const computedCobranzas = useMemo(() => {
    return [...cobranzas];
  }, [cobranzas]);

  const sortedFilteredCobranzas = useMemo(() => {
    let result = [...computedCobranzas];

    // Filter by search
    if (historialSearch.trim()) {
      const term = historialSearch.toLowerCase();
      result = result.filter(e => 
        (e.clienteNombre || '').toLowerCase().includes(term) ||
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
  }, [computedCobranzas, historialSearch, historialDateRange]);

  // Paginar historial
  const ITEMS_PER_PAGE = 10;
  const totalHistorialPages = Math.ceil(sortedFilteredCobranzas.length / ITEMS_PER_PAGE) || 1;
  const paginatedHistorialCobranzas = useMemo(() => {
    const start = (historialPage - 1) * ITEMS_PER_PAGE;
    return sortedFilteredCobranzas.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedFilteredCobranzas, historialPage]);

  // Recalculate to page 1 if query inputs shift
  useEffect(() => {
    setHistorialPage(1);
  }, [historialSearch, historialDateRange]);

  const handleAnnulCobranza = (cob: any) => {
    setMasterAuth({
      isOpen: true,
      title: 'Autorización Master Requerida',
      actionName: 'Anular Cobro / Recibo',
      actionDetails: `Cobro ${cob.numero || cob.id || cob.referencia} - Monto: $${formatoES(cob.monto)} (${cob.clienteNombre || ''})`,
      onSuccess: async () => {
        try {
          // 1. Restaurar saldos de las facturas involucradas (solo si no estaba ya anulada)
          if (cob.estado !== 'anulado') {
            if (Array.isArray(cob.abonos)) {
              cob.abonos.forEach((item: any) => {
                const docId = item.docId || item.id || item.facturaId;
                const montoNum = Number(item.montoAbonado || item.monto || item.abono) || 0;
                if (montoNum > 0 && docId) {
                  const doc = cxc.find(d => d.id === docId || d.factura_id === docId);
                  if (doc) {
                    const docTotal = Number(doc.total) || Number(doc.monto) || 0;
                    const curSaldo = doc.saldo !== undefined ? Number(doc.saldo) : 0;
                    const restoredSaldo = Math.min(docTotal, curSaldo + montoNum);
                    const restoredEstado = restoredSaldo >= docTotal - 0.01 ? 'pendiente' : 'parcial';
                    onSave?.('cxc', { ...doc, saldo: restoredSaldo, estado: restoredEstado, fechaPago: null });
                  }
                }
              });
            } else if (cob.abonos && typeof cob.abonos === 'object') {
              Object.entries(cob.abonos).forEach(([docId, montoAbonado]) => {
                const montoNum = typeof montoAbonado === 'object' ? Number((montoAbonado as any)?.montoAbonado || (montoAbonado as any)?.monto || 0) : Number(montoAbonado);
                if (montoNum > 0 && docId) {
                  const doc = cxc.find(d => d.id === docId || d.factura_id === docId);
                  if (doc) {
                    const docTotal = Number(doc.total) || Number(doc.monto) || 0;
                    const curSaldo = doc.saldo !== undefined ? Number(doc.saldo) : 0;
                    const restoredSaldo = Math.min(docTotal, curSaldo + montoNum);
                    const restoredEstado = restoredSaldo >= docTotal - 0.01 ? 'pendiente' : 'parcial';
                    onSave?.('cxc', { ...doc, saldo: restoredSaldo, estado: restoredEstado, fechaPago: null });
                  }
                }
              });
            }

            // 2. Restaurar anticipos aplicados
            if (Array.isArray(cob.anticiposAplicadosLog)) {
              cob.anticiposAplicadosLog.forEach((item: any) => {
                const antId = item.anticipoId || item.id;
                const montoNum = Number(item.montoAplicado || item.monto) || 0;
                if (montoNum > 0 && antId) {
                  const antDoc = cxc.find(d => d.id === antId || d.factura_id === antId);
                  if (antDoc) {
                    const curSaldo = Number(antDoc.saldo) || 0;
                    onSave?.('cxc', { ...antDoc, saldo: curSaldo - montoNum, estado: 'pendiente' });
                  }
                }
              });
            } else if (cob.anticiposAplicadosLog && typeof cob.anticiposAplicadosLog === 'object') {
              Object.entries(cob.anticiposAplicadosLog).forEach(([antId, montoAplicado]) => {
                const montoNum = typeof montoAplicado === 'object' ? Number((montoAplicado as any)?.montoAplicado || 0) : Number(montoAplicado);
                if (montoNum > 0 && antId) {
                  const antDoc = cxc.find(d => d.id === antId || d.factura_id === antId);
                  if (antDoc) {
                    const curSaldo = Number(antDoc.saldo) || 0;
                    onSave?.('cxc', { ...antDoc, saldo: curSaldo - montoNum, estado: 'pendiente' });
                  }
                }
              });
            }

            // 3. Anular / Eliminar anticipo sobrante si se creó
            if (cob.anticipoSobranteId) {
              onSave?.('cxc', { id: cob.anticipoSobranteId, _delete: true });
            }
          }

          // 4. Anular Comprobante Contable vinculado
          if (cob.comprobanteId) {
            const comp = comprobantes.find(c => c.id === cob.comprobanteId);
            if (comp) {
              onSave?.('comprobantes', { 
                ...comp, 
                estado: 'Anulado', 
                descripcion: `ANULADO - ${comp.descripcion}` 
              });
            }
          }

          // 5. Anular todos los movimientos bancarios vinculados
          const bankIds: string[] = [];
          if (cob.movimientoBancoIds && Array.isArray(cob.movimientoBancoIds)) {
            bankIds.push(...cob.movimientoBancoIds);
          }
          if (cob.movimientoBancoId) {
            bankIds.push(cob.movimientoBancoId);
          }
          if (cob.pagos && Array.isArray(cob.pagos)) {
            cob.pagos.forEach((p: any) => {
              if (p.id) bankIds.push(p.id);
            });
          }

          (movimientosBancos || []).forEach((m: any) => {
            const matchesId = bankIds.includes(String(m.id));
            const matchesRef = (cob.referencia && String(m.ref) === String(cob.referencia)) ||
                               (cob.pagos && cob.pagos.some((p: any) => p.referencia && String(m.ref) === String(p.referencia)));
            if (matchesId || matchesRef) {
              onSave?.('movimientosBancos', { 
                ...m, 
                estado: 'anulado', 
                descripcion: `ANULADO - ${m.descripcion}` 
              });
            }
          });

          // 6. Marcar cobranza como anulada
          if (!cob.isSynthetic) {
            onSave?.('cobranzas', { ...cob, estado: 'anulado' });
          } else {
            onSave?.('cobranzas', { ...cob, id: `cob-${Date.now()}`, isSynthetic: false, estado: 'anulado' });
          }

          setSelectedClientKey(null);
          showToast?.('Cobranza anulada exitosamente y balances restaurados.', 'success');
        } catch (err) {
          console.error(err);
          showToast?.('Error al anular la cobranza.', 'error');
        }
      }
    });
  };

  const handleDeleteCobranza = (cob: any) => {
    setMasterAuth({
      isOpen: true,
      title: 'Autorización Master Requerida',
      actionName: 'Eliminar Registro de Cobro',
      actionDetails: `Cobro ${cob.numero || cob.id || cob.referencia} - Monto: $${formatoES(cob.monto)} (${cob.clienteNombre || ''})`,
      onSuccess: async () => {
        try {
          // 1. Restaurar saldos de facturas (si no estaba ya anulada)
          if (cob.estado !== 'anulado') {
            if (Array.isArray(cob.abonos)) {
              cob.abonos.forEach((item: any) => {
                const docId = item.docId || item.id || item.facturaId;
                const montoNum = Number(item.montoAbonado || item.monto || item.abono) || 0;
                if (montoNum > 0 && docId) {
                  const doc = cxc.find(d => d.id === docId || d.factura_id === docId);
                  if (doc) {
                    const docTotal = Number(doc.total) || Number(doc.monto) || 0;
                    const curSaldo = doc.saldo !== undefined ? Number(doc.saldo) : 0;
                    const restoredSaldo = Math.min(docTotal, curSaldo + montoNum);
                    const restoredEstado = restoredSaldo >= docTotal - 0.01 ? 'pendiente' : 'parcial';
                    onSave?.('cxc', { ...doc, saldo: restoredSaldo, estado: restoredEstado, fechaPago: null });
                  }
                }
              });
            } else if (cob.abonos && typeof cob.abonos === 'object') {
              Object.entries(cob.abonos).forEach(([docId, montoAbonado]) => {
                const montoNum = typeof montoAbonado === 'object' ? Number((montoAbonado as any)?.montoAbonado || (montoAbonado as any)?.monto || 0) : Number(montoAbonado);
                if (montoNum > 0 && docId) {
                  const doc = cxc.find(d => d.id === docId || d.factura_id === docId);
                  if (doc) {
                    const docTotal = Number(doc.total) || Number(doc.monto) || 0;
                    const curSaldo = doc.saldo !== undefined ? Number(doc.saldo) : 0;
                    const restoredSaldo = Math.min(docTotal, curSaldo + montoNum);
                    const restoredEstado = restoredSaldo >= docTotal - 0.01 ? 'pendiente' : 'parcial';
                    onSave?.('cxc', { ...doc, saldo: restoredSaldo, estado: restoredEstado, fechaPago: null });
                  }
                }
              });
            }

            // 2. Restaurar anticipos aplicados
            if (Array.isArray(cob.anticiposAplicadosLog)) {
              cob.anticiposAplicadosLog.forEach((item: any) => {
                const antId = item.anticipoId || item.id;
                const montoNum = Number(item.montoAplicado || item.monto) || 0;
                if (montoNum > 0 && antId) {
                  const antDoc = cxc.find(d => d.id === antId || d.factura_id === antId);
                  if (antDoc) {
                    const curSaldo = Number(antDoc.saldo) || 0;
                    onSave?.('cxc', { ...antDoc, saldo: curSaldo - montoNum, estado: 'pendiente' });
                  }
                }
              });
            } else if (cob.anticiposAplicadosLog && typeof cob.anticiposAplicadosLog === 'object') {
              Object.entries(cob.anticiposAplicadosLog).forEach(([antId, montoAplicado]) => {
                const montoNum = typeof montoAplicado === 'object' ? Number((montoAplicado as any)?.montoAplicado || 0) : Number(montoAplicado);
                if (montoNum > 0 && antId) {
                  const antDoc = cxc.find(d => d.id === antId || d.factura_id === antId);
                  if (antDoc) {
                    const curSaldo = Number(antDoc.saldo) || 0;
                    onSave?.('cxc', { ...antDoc, saldo: curSaldo - montoNum, estado: 'pendiente' });
                  }
                }
              });
            }

            // 3. Eliminar anticipo sobrante
            if (cob.anticipoSobranteId) {
              onSave?.('cxc', { id: cob.anticipoSobranteId, _delete: true });
            }
          }

          // 4. Eliminar Comprobante Contable
          if (cob.comprobanteId) {
            onSave?.('comprobantes', { id: cob.comprobanteId, _delete: true });
          }

          // 5. Eliminar movimientos de banco vinculados
          const bankIds: string[] = [];
          if (cob.movimientoBancoIds && Array.isArray(cob.movimientoBancoIds)) {
            bankIds.push(...cob.movimientoBancoIds);
          }
          if (cob.movimientoBancoId) {
            bankIds.push(cob.movimientoBancoId);
          }
          if (cob.pagos && Array.isArray(cob.pagos)) {
            cob.pagos.forEach((p: any) => {
              if (p.id) bankIds.push(p.id);
            });
          }

          (movimientosBancos || []).forEach((m: any) => {
            const matchesId = bankIds.includes(String(m.id));
            const matchesRef = (cob.referencia && String(m.ref) === String(cob.referencia)) ||
                               (cob.pagos && cob.pagos.some((p: any) => p.referencia && String(m.ref) === String(p.referencia)));
            if (matchesId || matchesRef) {
              onSave?.('movimientosBancos', { id: m.id, _delete: true });
            }
          });

          // 6. Eliminar cobranza
          if (!cob.isSynthetic) {
            onSave?.('cobranzas', { id: cob.id, _delete: true });
          }

          setSelectedClientKey(null);
          setSelectedCobranza(null);
          showToast?.('Cobranza eliminada exitosamente del sistema.', 'success');
        } catch (err) {
          console.error(err);
          showToast?.('Error al eliminar la cobranza.', 'error');
        }
      }
    });
  };

  const handlePrintReporteAdministrativo = () => {
    // Generate rows
    const rows: any[] = [];
    sortedFilteredCobranzas.forEach((cob) => {
      const isAnulado = cob.estado === 'anulado';
      if (isAnulado) return;

      const abonoEntries = Object.entries(cob.abonos || {});
      const hasAbonos = abonoEntries.some(([_, amt]) => Number(amt) > 0);

      const tasaCobro = Number(cob.tasa) || 1;
      const tasaReferencia = Number(cob.tasaReferencial) || 0;

      if (hasAbonos) {
        abonoEntries.forEach(([docId, amountVal]) => {
          const amount = Number(amountVal);
          if (amount <= 0) return;

          const originalInvoice = cxc.find(d => d.id === docId);
          const invoiceNum = getCleanDocNumber(originalInvoice, docId);

          const montoBs = amount * tasaCobro;
          const usdRef = tasaReferencia > 0 ? (montoBs / tasaReferencia) : amount;

          rows.push({
            fecha: (cob.fecha || '').split('T')[0],
            cliente: cob.clienteNombre,
            factura: invoiceNum,
            montoUsd: amount,
            tasaCobro,
            montoBs,
            tasaReferencia,
            usdRef,
            isVES: tasaCobro > 1
          });
        });
      } else {
        const montoBs = cob.monto * tasaCobro;
        const usdRef = tasaReferencia > 0 ? (montoBs / tasaReferencia) : cob.monto;

        rows.push({
          fecha: (cob.fecha || '').split('T')[0],
          cliente: cob.clienteNombre,
          factura: '-',
          montoUsd: cob.monto,
          tasaCobro,
          montoBs,
          tasaReferencia,
          usdRef,
          isVES: tasaCobro > 1
        });
      }
    });

    const isRefEnabled = !!configContable?.habilitarTasaReferencialCobranza;

    // Totales
    const totalUsdCobrado = rows.reduce((sum, r) => sum + r.montoUsd, 0);
    const totalBsCobrado = rows.reduce((sum, r) => sum + r.montoBs, 0);
    const totalUsdRef = rows.reduce((sum, r) => sum + r.usdRef, 0);

    const reportContent = (
      <div className="p-8 space-y-6 text-slate-800 bg-white" id="reporte-cobranza-print">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">REPORTE ADMINISTRATIVO DE COBRANZA</h1>
            <p className="text-xs text-slate-500 font-bold tracking-wider uppercase mt-1">SISTEMA ADMINISTRATIVO CONTABLE</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-slate-950">Fecha de Emisión: {new Date().toLocaleDateString()}</p>
            <p className="text-slate-500 mt-1">Rango: {historialDateRange.desde || 'Inicio'} al {historialDateRange.hasta || 'Hoy'}</p>
          </div>
        </div>

        {/* Content Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-300 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-2">Fecha</th>
                <th className="py-3 px-2">Cliente</th>
                <th className="py-3 px-2">Factura</th>
                <th className="py-3 px-2 text-right">Monto Cobrado (USD)</th>
                <th className="py-3 px-2 text-right">Tasa Cobro</th>
                <th className="py-3 px-2 text-right">Monto en Bolívares</th>
                {isRefEnabled && (
                  <>
                    <th className="py-3 px-2 text-right bg-indigo-50/50 text-indigo-900">Tasa Ref.</th>
                    <th className="py-3 px-2 text-right bg-indigo-50/50 text-indigo-900">USD Ref.</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 px-2 font-medium">{row.fecha.split('-').reverse().join('/')}</td>
                  <td className="py-2.5 px-2 font-bold max-w-[150px] truncate" title={row.cliente}>{row.cliente}</td>
                  <td className="py-2.5 px-2 font-mono text-slate-500 font-bold">{row.factura}</td>
                  <td className="py-2.5 px-2 text-right font-black">${formatoES(row.montoUsd)}</td>
                  <td className="py-2.5 px-2 text-right font-semibold text-slate-600">
                    {row.isVES ? `${formatoES(row.tasaCobro)} Bs` : '-'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold text-slate-700">
                    {row.isVES ? `Bs. ${formatoES(row.montoBs)}` : '-'}
                  </td>
                  {isRefEnabled && (
                    <>
                      <td className="py-2.5 px-2 text-right font-bold bg-indigo-50/20 text-indigo-900">
                        {row.isVES && row.tasaReferencia > 0 ? `${formatoES(row.tasaReferencia)} Bs` : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right font-black bg-indigo-50/20 text-indigo-950">
                        {row.isVES && row.tasaReferencia > 0 ? `$${formatoES(row.usdRef)}` : `$${formatoES(row.montoUsd)}`}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={isRefEnabled ? 8 : 6} className="py-8 text-center text-slate-400 font-medium">
                    No hay cobranzas registradas en este período.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Totales footer row */}
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 font-bold bg-slate-50/50 text-slate-900">
                  <td colSpan={3} className="py-3 px-2 text-right uppercase tracking-wider text-[10px]">Totales Generales:</td>
                  <td className="py-3 px-2 text-right font-black text-slate-900">${formatoES(totalUsdCobrado)}</td>
                  <td className="py-3 px-2"></td>
                  <td className="py-3 px-2 text-right font-black text-slate-900 font-mono">Bs. {formatoES(totalBsCobrado)}</td>
                  {isRefEnabled && (
                    <>
                      <td className="py-3 px-2"></td>
                      <td className="py-3 px-2 text-right font-black text-indigo-950 bg-indigo-50/50">${formatoES(totalUsdRef)}</td>
                    </>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer Notes */}
        <div className="pt-6 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-medium">
          <p>Reporte administrativo generado automáticamente. Moneda base de cálculo: USD ($).</p>
          <p>Página 1 de 1</p>
        </div>
      </div>
    );

    triggerPrintPreview('Reporte Administrativo de Cobranza', 'landscape', reportContent);
  };

  const renderHistorialCobranzas = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Historial de Cobros y Cobranzas Realizadas
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
              
              <button 
                onClick={handlePrintReporteAdministrativo}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border bg-slate-900 border-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5 shadow-sm transition-all ml-2"
              >
                <Printer size={14} />
                Reporte Administrativo
              </button>
            </div>
          </div>

          {/* Search bar and custom date inputs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, referencia o monto..."
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
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Referencia</th>
                  <th className="px-6 py-4 text-right">Monto Cobrado</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 bg-white">
                {paginatedHistorialCobranzas.map((cob) => {
                  const isAnulado = cob.estado === 'anulado';
                  return (
                    <tr key={cob.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">{(cob.fecha || '').split('T')[0].split('-').reverse().join('/')}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{cob.clienteNombre}</td>
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">{cob.referencia}</td>
                      <td className="px-6 py-4 text-right font-black text-slate-800">${formatoES(cob.monto)}</td>
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
                            onClick={() => setSelectedCobranza(cob)}
                            title="Ver detalles"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Eye size={16} />
                          </button>
                          
                          {!isAnulado && (
                            <button
                              onClick={() => handleAnnulCobranza(cob)}
                              title="Anular cobro"
                              className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                            >
                              <X size={16} />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteCobranza(cob)}
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
                {paginatedHistorialCobranzas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No se encontraron cobros registrados con los criterios seleccionados.
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
    if (selectedClient) {
      return renderClientDetail();
    }

    const getEntityLabel = () => {
      const tab = tabs.find(t => t.id === activeTab);
      return tab ? tab.label.slice(0, -1) : 'Entidad';
    };

    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        {/* 1. CUADROS DE RESUMEN EJECUTIVO COMPACTOS (ALTA DENSIDAD) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KPI 1: Cartera Exigible */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs hover:border-indigo-300 transition-all flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cartera Exigible</span>
              <div className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                $ {formatNumber(kpiStats.totalExigible)}
              </div>
              <div className="text-[11px] font-medium text-slate-400 leading-tight">
                Bs. {formatNumber(kpiStats.totalExigible * currentTasa)}
              </div>
            </div>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
              <DollarSign size={16} />
            </div>
          </div>

          {/* KPI 2: Abonos & Recaudación */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Abonos y Cobranzas</span>
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

          {/* KPI 3: Vencido en Mora */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs hover:border-rose-300 transition-all flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vencido en Mora</span>
                {kpiStats.countEnMora > 0 && (
                  <span className="text-[9px] bg-rose-100 text-rose-800 font-bold px-1 rounded">
                    {kpiStats.countEnMora}
                  </span>
                )}
              </div>
              <div className="text-lg font-black text-rose-600 tracking-tight leading-tight">
                $ {formatNumber(kpiStats.totalEnMora)}
              </div>
              <div className="text-[11px] font-medium text-slate-400 leading-tight">
                Bs. {formatNumber(kpiStats.totalEnMora * currentTasa)}
              </div>
            </div>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
              <AlertTriangle size={16} />
            </div>
          </div>

          {/* KPI 4: Total Facturado */}
          <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Facturado</span>
              <div className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                $ {formatNumber(kpiStats.totalFacturado)}
              </div>
              <div className="text-[11px] font-medium text-slate-400 leading-tight">
                Bs. {formatNumber(kpiStats.totalFacturado * currentTasa)}
              </div>
            </div>
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg shrink-0">
              <Users size={16} />
            </div>
          </div>
        </div>

        {/* 2. BARRA DE HERRAMIENTAS Y PÍLDORAS INTELIGENTES (DEUDORES POR DEFECTO) */}
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

            {/* Smart Status Filter Pills con Deudores prioritarios */}
            <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl overflow-x-auto text-xs font-bold">
              <button
                type="button"
                onClick={() => setStatusFilter('CON_DEUDA')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === 'CON_DEUDA'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-indigo-600'
                }`}
                title="Mostrar solo clientes con saldo pendiente de cobro"
              >
                <span>Con Deuda</span>
                <span className={`text-[10px] px-1 rounded ${statusFilter === 'CON_DEUDA' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {kpiStats.countConDeuda}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('EN_MORA')}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  statusFilter === 'EN_MORA'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-rose-600 hover:text-rose-700'
                }`}
                title="Clientes con facturas vencidas en mora"
              >
                <span>En Mora</span>
                <span className={`text-[10px] px-1 rounded ${statusFilter === 'EN_MORA' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-700'}`}>
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
                title="Clientes con saldo corriente no vencido"
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
                title="Clientes con saldo a su favor"
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
                title="Clientes solventes con saldo $0"
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
                title="Ver lista completa de clientes"
              >
                Todos ({allGroupedData.length})
              </button>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-2 relative">
            <button 
              onClick={() => {
                setCobranzaForm({
                  ...cobranzaForm,
                  clienteId: '',
                  fecha: new Date().toISOString().split('T')[0]
                });
                setActiveTab('cobranza');
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <DollarSign size={14} />
              <span>+ Registrar Cobro</span>
            </button>

            <button 
              onClick={() => setShowAnticipoModal(true)}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus size={14} />
              <span>Anticipo</span>
            </button>

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
                      setShowNewModal(true);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                  >
                    <Plus size={14} className="text-indigo-600" /> Nuevo Préstamo / CxC
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
                        descripcion: 'Saldo Inicial de CxC',
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

        {/* 3. TABLA EJECUTIVA PRINCIPAL DE CUENTAS POR COBRAR */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-3 text-center w-12">#</th>
                  <th className="px-4 py-3">{getEntityLabel()} / RAZÓN SOCIAL & RIF</th>
                  <th className="px-4 py-3 text-center">ESTADO</th>
                  <th className="px-4 py-3 text-right">TOTAL FACTURADO</th>
                  <th className="px-4 py-3 text-right">ABONOS APLICADOS</th>
                  <th className="px-4 py-3 text-right">SALDO EXIGIBLE</th>
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
                      onClick={() => setSelectedClientKey(item.id)}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 text-slate-400 font-semibold text-center">{globalIndex}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            {item.cliente?.charAt(0)?.toUpperCase() || 'C'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors block text-sm leading-tight">
                              {item.cliente}
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
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
                              setCobranzaForm({
                                ...cobranzaForm,
                                clienteId: item.id,
                                fecha: new Date().toISOString().split('T')[0]
                              });
                              setActiveTab('cobranza');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg text-xs font-bold transition-all border border-emerald-200 hover:border-emerald-600 shadow-2xs whitespace-nowrap cursor-pointer"
                            title="Registrar cobro para este cliente"
                          >
                            <DollarSign size={12} />
                            <span>Cobrar</span>
                          </button>
                          
                          <button
                            onClick={() => setSelectedClientKey(item.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-indigo-600 text-slate-700 hover:text-white rounded-lg text-xs font-bold transition-all border border-slate-200 hover:border-indigo-600 shadow-2xs whitespace-nowrap cursor-pointer"
                            title="Ver Estado de Cuenta y Facturas"
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
                        <Users size={32} className="mx-auto text-slate-300" />
                        <p className="font-semibold text-slate-600 text-sm">No se encontraron clientes</p>
                        <p className="text-xs text-slate-400">
                          {searchTerm ? `Ningún cliente coincide con "${searchTerm}".` : 'No hay registros en la categoría seleccionada.'}
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
                    <td className="px-4 py-3 text-right text-indigo-700">
                      <div className="font-black text-sm text-indigo-900">$ {formatNumber(totals.saldoPendiente)}</div>
                      <div className="text-[10px] text-indigo-500">Bs. {formatNumber(totals.saldoPendiente * currentTasa)}</div>
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

  const renderClientDetail = () => {
    const getEntityLabel = () => {
      const tab = tabs.find(t => t.id === activeTab);
      return tab ? tab.label.slice(0, -1) : 'Entidad';
    };

    // Lookup contact details
    const contactObj = (contactos || []).find((c: any) => 
      String(c.id) === String(selectedClient.id) || 
      String(c.taxId) === String(selectedClient.id) || 
      (c.name && c.name.toLowerCase() === selectedClient.cliente?.toLowerCase())
    );

    // Aging analysis calculation
    const todayTs = new Date().setHours(0,0,0,0);
    let porVencer = 0;
    let dias0a30 = 0;
    let dias31a60 = 0;
    let dias61a90 = 0;
    let diasMas90 = 0;
    let hasOverdueInvoices = false;

    (selectedClient.documentos || []).forEach((d: any) => {
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

    // Anticipos disponibles
    const totalAnticiposDisponibles = (selectedClient.documentos || []).reduce((sum: number, d: any) => {
      if ((d.tipo === 'anticipo' || Number(d.total) < 0 || Number(d.saldo) < 0) && d.estado !== 'anulada') {
        return sum + Math.abs(Number(d.saldo !== undefined ? d.saldo : d.total) || 0);
      }
      return sum;
    }, 0);

    // WhatsApp URL
    const phoneNum = contactObj?.phone ? contactObj.phone.replace(/[^0-9]/g, '') : '';
    const waMessage = `Estimado(a) *${selectedClient.cliente}*,\nLe compartimos el resumen de su *Estado de Cuenta*:\n\n📌 *Saldo Pendiente:* $${formatoES(Math.max(0, selectedClient.saldoPendiente))}\n💵 *Abonos Aplicados:* $${formatoES(selectedClient.abonosAplicados)}\n📊 *Total Facturado:* $${formatoES(selectedClient.montoAdeudo)}\n\nPara cualquier consulta o envío de comprobantes de pago, por favor responda a este mensaje.\n_Departamento de Administración & Finanzas_`;
    const waUrl = phoneNum ? `https://wa.me/${phoneNum}?text=${encodeURIComponent(waMessage)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(waMessage)}`;

    let saldoAcumulado = historialCliente.saldoInicial;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        {/* CABECERA COMPACTA EJECUTIVA DE ESTADO DE CUENTA */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 flex flex-col gap-3">
          {/* Fila 1: Entidad, RIF, Estado y Acciones Directas */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <BackButton onClick={() => setSelectedClientKey(null)} label="Volver" />
              
              <div className="h-5 w-px bg-slate-200 hidden sm:block" />

              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                {selectedClient.cliente}
              </h2>

              <span className="font-mono bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-xs">
                {contactObj?.taxId || selectedClient.id}
              </span>

              {/* Status Badge */}
              {selectedClient.saldoPendiente < -0.01 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-[11px] font-bold">
                  <Coins size={11} /> Saldo a Favor
                </span>
              ) : hasOverdueInvoices ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[11px] font-bold">
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
                  setCobranzaForm({
                    ...cobranzaForm,
                    clienteId: selectedClient.id,
                    fecha: new Date().toISOString().split('T')[0]
                  });
                  setActiveTab('cobranza');
                  setSelectedClientKey(null);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <DollarSign size={14} />
                <span>Registrar Cobro</span>
              </button>

              <button 
                onClick={() => {
                  setAnticipoForm({
                    ...anticipoForm,
                    cliente: selectedClient.cliente,
                    cliente_id: selectedClient.id,
                    fecha: new Date().toISOString().split('T')[0]
                  });
                  setShowAnticipoModal(true);
                }}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>Anticipo</span>
              </button>

              {(() => {
                const maxReintegro = selectedClient.saldoPendiente < -0.009 ? Math.abs(selectedClient.saldoPendiente) : 0;
                if (maxReintegro > 0.009) {
                  return (
                    <button 
                      onClick={() => {
                        setReintegroForm({
                          monto: maxReintegro.toFixed(2),
                          bancoId: '',
                          referencia: '',
                          fecha: new Date().toISOString().split('T')[0]
                        });
                        setReintegroTarget({
                          cliente: selectedClient.cliente,
                          cliente_id: selectedClient.id,
                          saldo: -maxReintegro,
                          total: -maxReintegro,
                          tasa: 1,
                          moneda: 'USD',
                          categoria: activeTab
                        });
                      }}
                      className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1"
                    >
                      <ArrowDownLeft size={13} />
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
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Facturado Total</span>
                <span className="font-bold text-slate-800 font-mono text-sm">$ {formatNumber(selectedClient.montoAdeudo)}</span>
              </div>

              <div className="h-6 w-px bg-slate-200" />

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Abonos Aplicados</span>
                <span className="font-bold text-emerald-600 font-mono text-sm">$ {formatNumber(selectedClient.abonosAplicados)}</span>
              </div>

              <div className="h-6 w-px bg-slate-200" />

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  {selectedClient.saldoPendiente < -0.01 ? "Saldo a Favor" : "Saldo Exigible"}
                </span>
                <span className={`font-black font-mono text-sm ${
                  selectedClient.saldoPendiente < -0.01 ? "text-teal-600" : selectedClient.saldoPendiente <= 0.01 ? "text-slate-400" : "text-indigo-700"
                }`}>
                  $ {formatNumber(Math.abs(selectedClient.saldoPendiente))}
                </span>
                <span className="text-[10px] text-slate-400 ml-1.5">
                  (Bs. {formatNumber(Math.abs(selectedClient.saldoPendiente) * currentTasa)})
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
                  Sin facturas vencidas
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 5. TABLA DE DOCUMENTOS Y MOVIMIENTOS (DATA GRID) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Header & Filter Bar de la Tabla */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-indigo-600" />
              <h3 className="text-sm font-black text-slate-800">
                Historial de Documentos & Cobranzas
              </h3>
            </div>

            {/* Filtros de Fecha */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Período:</label>
                <select 
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-indigo-600 outline-none"
                  value={filtrosHistorial.tipo} 
                  onChange={e => setFiltrosHistorial({...filtrosHistorial, tipo: e.target.value})}
                >
                  <option value="todo">Todo el Historial</option>
                  <option value="mes">Mes Específico</option>
                  <option value="ano">Año</option>
                  <option value="rango">Rango de Fechas</option>
                </select>
              </div>

              {filtrosHistorial.tipo === 'mes' && (
                <div className="flex items-center gap-1.5 animate-in fade-in">
                  <select 
                    className="px-2 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none" 
                    value={filtrosHistorial.mes} 
                    onChange={e => setFiltrosHistorial({...filtrosHistorial, mes: e.target.value})}
                  >
                    {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m,i)=><option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
                  </select>
                  <select 
                    className="px-2 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none" 
                    value={filtrosHistorial.ano} 
                    onChange={e => setFiltrosHistorial({...filtrosHistorial, ano: e.target.value})}
                  >
                    {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}

              {filtrosHistorial.tipo === 'ano' && (
                <div className="flex items-center gap-1.5 animate-in fade-in">
                  <select 
                    className="px-2 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none" 
                    value={filtrosHistorial.ano} 
                    onChange={e => setFiltrosHistorial({...filtrosHistorial, ano: e.target.value})}
                  >
                    {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}

              {filtrosHistorial.tipo === 'rango' && (
                <div className="flex items-center gap-2 animate-in fade-in">
                  <input 
                    type="date" 
                    className="px-2 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                    value={filtrosHistorial.desde} 
                    onChange={e => setFiltrosHistorial({...filtrosHistorial, desde: e.target.value})}
                  />
                  <span className="text-xs text-slate-400">a</span>
                  <input 
                    type="date" 
                    className="px-2 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                    value={filtrosHistorial.hasta} 
                    onChange={e => setFiltrosHistorial({...filtrosHistorial, hasta: e.target.value})}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Table Data */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-5">Fecha Emisión</th>
                  <th className="py-3.5 px-5">N° Documento / Ref</th>
                  <th className="py-3.5 px-5">Concepto / Motivo</th>
                  <th className="py-3.5 px-5 text-center">Estado / Días Mora</th>
                  <th className="py-3.5 px-5 text-right">Cargo (Facturado)</th>
                  <th className="py-3.5 px-5 text-right">Abono (Cobrado)</th>
                  <th className="py-3.5 px-5 text-right">Saldo Acumulado</th>
                  <th className="py-3.5 px-5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrosHistorial.tipo !== 'todo' && (
                  <tr className="bg-indigo-50/40 border-b border-indigo-100 text-xs font-bold text-indigo-700">
                    <td className="py-3 px-5" colSpan={4}>
                      <CornerDownRight className="w-3.5 h-3.5 inline mr-2 text-indigo-400"/> 
                      Saldo Arrastrado al Inicio del Período
                    </td>
                    <td className="py-3 px-5 text-right">-</td>
                    <td className="py-3 px-5 text-right">-</td>
                    <td className="py-3 px-5 text-right font-black text-indigo-900">${formatoES(historialCliente.saldoInicial)}</td>
                    <td className="py-3 px-5 text-center">-</td>
                  </tr>
                )}
                {historialCliente.movs.map((item: any, i: number) => {
                  let cargo = item.__cargo || 0;
                  let abono = item.__abono || 0;
                  let docId = '';
                  let descripcion = '';
                  let isCobro = item._tipo === 'cobro';

                  if (isCobro) {
                    docId = item.referencia || (isUUID(item.id) ? `COB-${item.id.slice(0, 8).toUpperCase()}` : item.id);
                    const appliedAnt = Number(item.totalAnticiposAplicados) || 0;
                    descripcion = appliedAnt > 0
                      ? `Cobro Recibido (Anticipo aplicado: $${formatoES(appliedAnt)})`
                      : `Cobranza / Recibo de Pago`;
                  } else {
                    docId = getCleanDocNumber(item);
                    const isAnt = item.tipo === 'anticipo' || Number(item.total) < 0;
                    const isReint = item.tipo === 'reintegro';
                    if (isReint) {
                      descripcion = item.descripcion || 'Reintegro / Devolución de Anticipo';
                    } else if (isAnt) {
                      descripcion = item.descripcion || 'Anticipo / Saldo a Favor';
                    } else {
                      descripcion = item.descripcion || 'Factura / Cargo';
                    }
                  }

                  saldoAcumulado += (cargo - abono);
                  const isVirtual = isCobro && String(item.id).startsWith('cob-virtual-');
                  const isReint = item.tipo === 'reintegro';

                  // Mora calculation for invoices
                  const itemVenc = item.vencimiento ? new Date(item.vencimiento).getTime() : (item.fecha ? new Date(item.fecha).getTime() : todayTs);
                  const moraDays = Math.floor((todayTs - itemVenc) / (1000 * 60 * 60 * 24));
                  const isPendingDoc = !isCobro && !isReint && (Number(item.saldo) > 0 || (item.saldo === undefined && cargo > 0));

                  return (
                    <tr key={item.id || i} className={`hover:bg-slate-50/70 transition-colors ${isCobro ? 'bg-slate-50/40' : ''}`}>
                      {/* Fecha */}
                      <td className="py-3.5 px-5 text-slate-600 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {(item.fechaStr || item.fecha || '').split('T')[0].split('-').reverse().join('/')}
                        </div>
                        {item.vencimiento && !isCobro && !isReint && (
                          <div className="text-[10px] text-slate-400 font-medium">
                            Vence: {item.vencimiento.split('-').reverse().join('/')}
                          </div>
                        )}
                      </td>

                      {/* N° Documento */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isCobro && <Landmark className="w-3 h-3 text-slate-400 shrink-0" />}
                          <span className={`font-mono font-bold px-2 py-0.5 rounded border ${
                            isReint 
                              ? 'text-blue-700 bg-blue-50/60 border-blue-200' 
                              : 'text-indigo-700 bg-indigo-50/60 border-indigo-100'
                          }`}>
                            {docId}
                          </span>
                          {!isCobro && item.isFiscal && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Fiscal
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Concepto */}
                      <td className="py-3.5 px-5 text-slate-700">
                        <div className="truncate max-w-[220px] font-medium" title={descripcion}>
                          {descripcion}
                        </div>
                      </td>

                      {/* Estado / Días Mora */}
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        {isCobro ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle size={10} /> Aplicado
                          </span>
                        ) : isReint ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <ArrowDownLeft size={10} /> Reintegrado
                          </span>
                        ) : isPendingDoc ? (
                          moraDays > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle size={10} /> {moraDays}d vencido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock size={10} /> Por vencer
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            Amortizado
                          </span>
                        )}
                      </td>

                      {/* Cargo */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap font-mono font-bold text-slate-800">
                        {cargo > 0 ? `$${formatoES(cargo)}` : '-'}
                      </td>

                      {/* Abono */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap font-mono font-bold text-emerald-700">
                        {abono > 0 ? `$${formatoES(abono)}` : '-'}
                      </td>

                      {/* Saldo Acumulado */}
                      <td className={`py-3.5 px-5 text-right whitespace-nowrap font-mono font-black ${
                        saldoAcumulado < 0 ? 'text-emerald-600' : 'text-slate-900'
                      }`}>
                        ${formatoES(saldoAcumulado)}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        {isCobro ? (
                          isVirtual ? (
                            <button
                              onClick={() => handleRestoreVirtualCobro(item)}
                              title="Eliminar cobranza virtual"
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAnnulCobranza(item)}
                              title="Anular cobranza real"
                              className="p-1 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          )
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            {(() => {
                              const docTotal = Number(item.total) || Number(item.monto) || 0;
                              const docSaldo = item.saldo !== undefined ? Number(item.saldo) : docTotal;
                              const isPaidDoc = item.estado === 'pagada' || item.estado === 'liquidada' || (docTotal > 0 && docSaldo <= 0.009);
                              const hasPartialPayment = docTotal > 0 && docSaldo < docTotal - 0.009;

                              if (isPaidDoc || hasPartialPayment) {
                                return (
                                  <span 
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-md text-[10px] font-bold select-none cursor-not-allowed"
                                    title={isPaidDoc ? "Esta cuenta por cobrar ya está totalmente pagada. No se permite modificar ni eliminar." : "Esta cuenta por cobrar ya tiene abonos aplicados. Para modificarla o eliminarla debe anular primero el cobro correspondiente."}
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
                                      actionName: 'Eliminar Cuenta por Cobrar',
                                      actionDetails: `Documento ${getCleanDocNumber(item)} - Monto: $${formatoES(item.total || item.monto)} (${selectedClient?.cliente || ''})`,
                                      onSuccess: async () => {
                                        onSave?.('cxc', { id: item.id, _delete: true });

                                        const bankMovId = item.id.replace('-cxc', '');
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
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {historialCliente.movs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                      No hay movimientos registrados para esta entidad en el período seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                <tr>
                  <td colSpan={4} className="py-3.5 px-5 text-right uppercase tracking-wider text-[10px]">
                    Totales del Período:
                  </td>
                  <td className="py-3.5 px-5 text-right font-black font-mono">
                    ${formatoES(historialCliente.movs.reduce((sum: number, item: any) => sum + (item.__cargo || 0), 0))}
                  </td>
                  <td className="py-3.5 px-5 text-right font-black font-mono text-emerald-700">
                    ${formatoES(historialCliente.movs.reduce((sum: number, item: any) => sum + (item.__abono || 0), 0))}
                  </td>
                  <td className="py-3.5 px-5 text-right font-black font-mono text-indigo-900 text-sm">
                    ${formatoES(historialCliente.saldoInicial + historialCliente.movs.reduce((sum: number, item: any) => sum + (item.__cargo || 0) - (item.__abono || 0), 0))}
                  </td>
                  <td className="py-3.5 px-5 text-center">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCobranza = () => {
    return (
      <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-300">
        {/* Columna Izquierda: Formulario */}
        
        {/* Columna Izquierda: Formulario */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex-1">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-indigo-600" />
              Detalles del Cobro
            </h3>
            
            <div className="space-y-5">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Cobro</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-700"
                  value={cobranzaForm.fecha}
                  onChange={e => setCobranzaForm({ ...cobranzaForm, fecha: e.target.value })}
                />
              </div>

              <div className="flex flex-col pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente a cobrar</label>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    <button 
                      type="button"
                      className="px-2 py-1 text-[10px] font-bold rounded-md bg-white shadow-sm text-indigo-600"
                    >
                      Buscar
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    readOnly
                    className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none font-medium text-slate-700 cursor-pointer"
                    placeholder="Seleccione un cliente..."
                    value={(() => {
                      const cid = cobranzaForm.clienteId;
                      if (!cid) return '';
                      const contact = contactos.find(c => String(c.id) === String(cid) || String(c.taxId) === String(cid));
                      if (contact) return contact.name || contact.nombre || '';
                      const cli = clientes.find(c => String(c.id) === String(cid) || String(c.taxId) === String(cid));
                      return cli?.nombre || cli?.cliente || cli?.name || cid;
                    })()}
                    onClick={() => setIsCobranzaClientModalOpen(true)}
                  />
                  <button 
                    type="button"
                    onClick={() => setIsCobranzaClientModalOpen(true)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-650 transition-colors"
                  >
                    <Search size={16} />
                  </button>
                </div>
              </div>

              {/* MÉTODOS DE PAGO */}
              <div className="pt-4 border-t border-slate-100 mt-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-500" />
                    Métodos de Pago
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const newPago = {
                        id: 'pago-' + Date.now(),
                        bancoId: '',
                        metodo: 'Transferencia',
                        terminalId: '',
                        referencia: '',
                        monto: '',
                        montoBs: ''
                      };
                      setCobranzaForm({ ...cobranzaForm, pagos: [...cobranzaForm.pagos, newPago] });
                    }}
                    className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md hover:bg-indigo-100 transition-colors"
                  >
                    + Agregar Pago
                  </button>
                </div>

                <div className="space-y-4">
                  {cobranzaForm.pagos.map((pago, idx) => {
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
                            const newPagos = [...cobranzaForm.pagos];
                            newPagos.splice(idx, 1);
                            setCobranzaForm({ ...cobranzaForm, pagos: newPagos });
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
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-indigo-500"
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

                                const newPagos = [...cobranzaForm.pagos];
                                newPagos[idx].bancoId = newBankId;
                                newPagos[idx].metodo = newMetodo;
                                setCobranzaForm({ ...cobranzaForm, pagos: newPagos });
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
                                const newPagos = [...cobranzaForm.pagos];
                                newPagos[idx].metodo = val;
                                if (val === 'Punto de Venta' && activeTerminals.length > 0 && !newPagos[idx].terminalId) {
                                  newPagos[idx].terminalId = activeTerminals[0].id;
                                  if (activeTerminals[0].banco_id) {
                                    newPagos[idx].bancoId = activeTerminals[0].banco_id;
                                  }
                                }
                                setCobranzaForm({ ...cobranzaForm, pagos: newPagos });
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-indigo-500"
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
                                const newPagos = [...cobranzaForm.pagos];
                                newPagos[idx].terminalId = termId;
                                if (term?.banco_id) newPagos[idx].bancoId = term.banco_id;
                                if (term?.tipo_cuenta === 'internacional' || term?.moneda === 'USD') {
                                  newPagos[idx].montoBs = '';
                                }
                                setCobranzaForm({ ...cobranzaForm, pagos: newPagos });
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
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-indigo-500"
                            value={pago.referencia}
                            onChange={e => {
                              const newPagos = [...cobranzaForm.pagos];
                              newPagos[idx].referencia = e.target.value;
                              setCobranzaForm({ ...cobranzaForm, pagos: newPagos });
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
                                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={pago.montoBs || ''}
                                  onChange={e => {
                                    const newPagos = [...cobranzaForm.pagos];
                                    const valBs = e.target.value;
                                    newPagos[idx].montoBs = valBs;
                                    const t = Number(cobranzaForm.tasa) || 1;
                                    if (t > 0 && valBs) {
                                      newPagos[idx].monto = (Number(valBs) / t).toFixed(2);
                                    } else {
                                      newPagos[idx].monto = '';
                                    }
                                    setCobranzaForm({ ...cobranzaForm, pagos: newPagos });
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
                                className="w-full pl-6 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={pago.monto}
                                onChange={e => {
                                  const newPagos = [...cobranzaForm.pagos];
                                  newPagos[idx].monto = e.target.value;
                                  newPagos[idx].montoBs = '';
                                  setCobranzaForm({ ...cobranzaForm, pagos: newPagos });
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {cobranzaForm.pagos.length === 0 && (
                    <div className="text-center py-4 text-xs font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      No hay pagos agregados
                    </div>
                  )}
                </div>
              </div>

              {/* Tasa General si aplica (solo visible si algún banco seleccionado es en Bolívares / VES) */}
              {(() => {
                const hasVESBank = cobranzaForm.pagos.some(p => {
                  const selB = bancos.find(b => b.id === p.bancoId);
                  return selB && (selB.moneda === 'VES' || selB.moneda === 'Bs' || selB.moneda === 'Bs.' || selB.moneda === 'Bolivares');
                });
                if (!hasVESBank) return null;

                return (
                  <div className="pt-4 border-t border-slate-100 mt-4 animate-in fade-in duration-150">
                    <div className="flex flex-col">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tasa de Cambio Global (Bs./$)</label>
                      <input 
                        type="number" 
                        step="0.0001"
                        min="0.01"
                        className="w-full px-4 py-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-indigo-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={cobranzaForm.tasa || ''}
                        onChange={e => {
                          const newTasa = Number(e.target.value);
                          const newPagos = cobranzaForm.pagos.map((p) => {
                            const selB = bancos.find(b => b.id === p.bancoId);
                            const isBVES = selB && (selB.moneda === 'VES' || selB.moneda === 'Bs' || selB.moneda === 'Bs.' || selB.moneda === 'Bolivares');
                            if (isBVES && p.montoBs && newTasa > 0) {
                              return { ...p, monto: (Number(p.montoBs) / newTasa).toFixed(2) };
                            }
                            return p;
                          });
                          setCobranzaForm({ ...cobranzaForm, tasa: newTasa, pagos: newPagos });
                        }}
                      />
                    </div>
                    {configContable?.habilitarTasaReferencialCobranza && (
                      <div className="flex flex-col mt-4">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tasa Referencial Paralela (Bs./$)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          className="w-full px-4 py-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-indigo-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={cobranzaForm.tasaReferencial || ''}
                          onChange={e => setCobranzaForm({ ...cobranzaForm, tasaReferencial: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* SOBRANTE / ANTICIPO */}
              {(() => {
                const sumPagos = cobranzaForm.pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
                const totalFacturas = totalFacturasAplicadas - totalAnticiposAplicados;
                if (sumPagos > totalFacturas + 0.01 && totalFacturas > 0) {
                  return (
                    <div className="pt-4 border-t border-slate-100 animate-in fade-in zoom-in-95 duration-200 bg-amber-50/50 p-4 rounded-xl border border-amber-100 mt-4">
                      <div className="flex items-center gap-2 mb-3 text-amber-700">
                        <CornerDownRight size={16} />
                        <h4 className="text-sm font-bold">Generación de Sobrante</h4>
                      </div>
                      <p className="text-xs font-medium text-amber-600 mb-4">
                        El monto pagado ({formatoES(sumPagos)}) supera el total a cobrar ({formatoES(totalFacturas)}).
                        El sobrante de <strong className="text-amber-700">{formatoES(sumPagos - totalFacturas)} USD</strong> se registrará como Anticipo a favor de:
                      </p>
                      
                      <div className="relative">
                        <input 
                          type="text" 
                          readOnly
                          className="w-full pl-4 pr-10 py-2 bg-white border border-amber-200 rounded-lg text-xs outline-none font-medium text-slate-700 cursor-pointer"
                          placeholder="Mismo cliente..."
                          value={(() => {
                            const eid = cobranzaForm.entidadSobranteId || cobranzaForm.clienteId;
                            if (!eid) return '';
                            const contact = contactos.find(c => String(c.id) === String(eid) || String(c.taxId) === String(eid));
                            if (contact) return contact.name || contact.nombre || '';
                            const cli = clientes.find(c => String(c.id) === String(eid) || String(c.taxId) === String(eid));
                            return cli?.nombre || cli?.cliente || cli?.name || eid;
                          })()}
                          onClick={() => {
                            setIsSelectingSobrante(true);
                            setIsCobranzaClientModalOpen(true);
                          }}
                        />
                        <button 
                          type="button"
                          onClick={() => {
                            setIsSelectingSobrante(true);
                            setIsCobranzaClientModalOpen(true);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-650"
                        >
                          <Search size={14} />
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Haga clic en la lupa para asignar el sobrante a otra entidad (ej. Agencia Aduanal)</p>
                    </div>
                  );
                }
                return null;
              })()}

            </div>
          </div>
        </div>

        {/* Columna Derecha: Cuentas y Resumen */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          {cobranzaForm.clienteId ? (
            <>
              {/* Resumen a Pagar */}
              <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl shadow-lg p-6 text-white flex flex-col sm:flex-row justify-between items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="relative z-10 w-full sm:w-auto text-center sm:text-left flex flex-col gap-2">
                  <div className="flex justify-between items-center gap-8 text-indigo-200 text-sm">
                    <span>Total Facturas:</span>
                    <span className="font-bold text-white">${formatoES(totalFacturasAplicadas)}</span>
                  </div>
                  {totalAnticiposDisponibles > 0 && (
                    <div className="flex justify-between items-center gap-8 text-emerald-300 text-sm">
                      <span>Anticipo Disponible:</span>
                      <span className="font-bold">${formatoES(totalAnticiposDisponibles)}</span>
                    </div>
                  )}
                  {totalAnticiposDisponibles > 0 && (
                    <div className="flex justify-between items-center gap-8 text-emerald-300 text-sm mt-2">
                      <span>Anticipo a Usar:</span>
                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-bold">$</span>
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          max={Math.min(totalFacturasAplicadas, totalAnticiposDisponibles)}
                          className="w-full pl-7 pr-3 py-1.5 text-sm border border-emerald-500/30 rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none font-bold text-emerald-900 bg-emerald-50 shadow-sm transition-all text-right"
                          placeholder="0.00"
                          value={anticipoGlobal}
                          onChange={(e) => {
                            const value = e.target.value;
                            let stringToStore = value;
                            if (value !== '') {
                              let val = Number(value);
                              if (!isNaN(val)) {
                                if (val < 0) stringToStore = '0';
                                else {
                                  const maxAllowed = Math.min(totalFacturasAplicadas, totalAnticiposDisponibles);
                                  if (val > maxAllowed) stringToStore = maxAllowed.toString();
                                }
                              }
                            }
                            setAnticipoGlobal(stringToStore);
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="h-px w-full bg-indigo-500/50 my-2" />
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-end gap-8 mt-1">
                      <span className="text-indigo-200 font-medium text-sm uppercase tracking-wider mb-1">Total Recibido (Pagos)</span>
                      <div className="flex items-baseline gap-3">
                        <p className="text-2xl sm:text-3xl font-black tracking-tight text-emerald-300">${formatoES(sumPagosDisplay)}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-end gap-8 mt-1">
                      <span className="text-indigo-200 font-medium text-sm uppercase tracking-wider mb-1">Monto a Aplicar</span>
                      <div className="flex items-baseline gap-3">
                        <p className={`text-3xl sm:text-4xl font-black tracking-tight ${montoBanco > sumPagosDisplay + 0.01 ? 'text-red-300' : 'text-white'}`}>${formatoES(montoBanco)}</p>
                      </div>
                    </div>
                    {montoBanco > sumPagosDisplay + 0.01 && (
                      <p className="text-red-200 text-xs font-bold text-right mt-1 bg-red-500/40 px-3 py-1.5 rounded-lg self-end border border-red-400/50">
                        No puede aplicar un monto mayor al recibido
                      </p>
                    )}
                  </div>
                </div>
                <button 
                  onClick={handleProcesarCobro}
                  disabled={totalFacturasAplicadas <= 0 || montoBanco > sumPagosDisplay + 0.01}
                  className="relative z-10 w-full sm:w-auto bg-white text-indigo-600 hover:bg-indigo-50 text-lg font-bold px-8 py-4 rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-6 h-6" /> 
                  Procesar Cobro
                </button>
              </div>

              {/* Tabla de Cuentas por Cobrar del Cliente */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">Facturas Pendientes</h4>
                      <p className="text-xs text-slate-500 font-medium">Seleccione los montos a cobrar por cada documento</p>
                    </div>
                  </div>
                  {totalAnticiposDisponibles > 0 && (
                    <div className="bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg text-sm font-bold border border-emerald-200 flex items-center gap-2">
                      <Landmark className="w-4 h-4" />
                      Anticipo Disponible: ${formatoES(totalAnticiposDisponibles)}
                    </div>
                  )}
                </div>
                
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-bold">Documento</th>
                        <th className="px-6 py-4 font-bold text-right">Saldo Pendiente</th>
                        <th className="px-6 py-4 font-bold text-right w-48">Abono a Aplicar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedClientDebts.map((item, i) => {
                        const saldoNum = Number(item.saldo) || 0;
                        const abonoVal = Number(abonos[item.id]) || 0;
                        
                        return (
                          <tr key={item.id || i} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-mono text-indigo-600 font-bold">{item.factura_id}</span>
                                <span className="text-slate-500 text-xs mt-0.5">{(item.fecha || (item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : '')).split('T')[0].split('-').reverse().join('/')}</span>
                                <span className="text-slate-600 text-xs mt-1 line-clamp-1" title={item.descripcion}>{item.descripcion || 'Factura / Cargo'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-black text-slate-800 text-base">${formatoES(saldoNum)}</span>
                                <span className="text-slate-400 text-xs mt-0.5">Orig: ${formatoES(item.total)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-2">
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                  <input 
                                    type="number" 
                                    step="0.01"
                                    min="0"
                                    max={saldoNum}
                                    className="w-full pl-7 pr-3 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700 bg-white shadow-sm transition-all"
                                    placeholder="0.00"
                                    value={abonos[item.id] || ''}
                                    onChange={(e) => handleAbonoChange(item.id, e.target.value, saldoNum)}
                                  />
                                </div>
                                <div className="flex justify-between items-center w-full mt-1">
                                  {abonoVal > 0 ? (
                                    <span className={`text-[11px] font-bold ${saldoNum - abonoVal <= 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                      Falta: ${formatoES(Math.max(0, saldoNum - abonoVal))}
                                    </span>
                                  ) : <span />}
                                  <button 
                                    onClick={() => handlePagarTotal(item.id, saldoNum)}
                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors text-right"
                                  >
                                    Aplicar total
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {selectedClientDebts.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-400">
                              <CheckCircle className="w-12 h-12 mb-3 text-emerald-400" strokeWidth={1.5} />
                              <p className="font-medium text-slate-600">Este cliente no tiene facturas pendientes.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 border-dashed shadow-sm p-12 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Users className="w-10 h-10 text-slate-300" strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Seleccione un cliente</h3>
              <p className="text-slate-500 max-w-md">
                Elija un cliente en el panel de detalles para ver sus cuentas pendientes y registrar un nuevo cobro.
              </p>
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
            <BackButton to="/receivables" label="Volver a Cuentas por Cobrar" />
          ) : (
            <BackButton to="/" label="Volver al Inicio" />
          )}
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            {category ? tabs.find(t => t.id === category)?.label : 'Cuentas por Cobrar'}
          </h2>
        </div>
        <p className="text-sm text-slate-500 font-medium mt-1">Gestión de cartera, derechos de cobro y antigüedad de saldos</p>
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
                  setSelectedClientKey(null);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                  isActive 
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {activeTab === 'cobranza' ? (
        renderCobranza()
      ) : activeTab === 'historial-cobranzas' ? (
        renderHistorialCobranzas()
      ) : (
        renderTable()
      )}

      {/* Modal Nuevo Movimiento */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Landmark size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Nuevo Movimiento Bancario</h3>
                  <p className="text-xs font-medium text-slate-500">Generar cuenta por cobrar ({activeTab})</p>
                </div>
              </div>
              <button 
                onClick={() => setShowNewModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col relative">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Entidad / Nombre</label>
                  <div 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-indigo-500 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-slate-700 cursor-pointer flex justify-between items-center"
                    onClick={() => setIsNewMovClientModalOpen(true)}
                  >
                    <span className={newMovForm.entidad ? 'text-slate-800' : 'text-slate-400 font-normal'}>
                      {newMovForm.entidad || 'Seleccionar entidad...'}
                    </span>
                    <Search className="w-4 h-4 text-indigo-500" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cuenta Bancaria (Origen)</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-slate-700"
                    value={newMovForm.bancoId}
                    onChange={e => setNewMovForm({...newMovForm, bancoId: e.target.value})}
                  >
                    <option value="">Seleccione un banco...</option>
                    {bancos.map(b => (
                      <option key={b.id} value={b.id}>{b.banco} - {b.moneda}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descripción del Movimiento</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-slate-700"
                  placeholder="Ej. Préstamo personal, Anticipo..."
                  value={newMovForm.descripcion}
                  onChange={e => setNewMovForm({...newMovForm, descripcion: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-slate-700"
                    value={newMovForm.fecha}
                    onChange={e => setNewMovForm({...newMovForm, fecha: e.target.value})}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Referencia</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono font-bold text-slate-700"
                    placeholder="Opcional"
                    value={newMovForm.referencia}
                    onChange={e => setNewMovForm({...newMovForm, referencia: e.target.value})}
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
                <div className="flex flex-col animate-in fade-in zoom-in-95 duration-200 pt-6 border-t border-slate-100 gap-4">
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
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveNewMov}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center gap-2 transition-colors"
              >
                <Save size={16} />
                Guardar Movimiento
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
                  <p className="text-xs font-medium text-slate-500">Registrar un pago a favor del cliente</p>
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Entidad / Cliente</label>
                  <div 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-emerald-500 rounded-xl text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all font-bold text-slate-700 cursor-pointer flex justify-between items-center"
                    onClick={() => setIsAnticipoClientModalOpen(true)}
                  >
                    <span className={anticipoForm.cliente ? 'text-slate-800' : 'text-slate-400 font-normal'}>
                      {anticipoForm.cliente || 'Seleccionar entidad...'}
                    </span>
                    <Search className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cuenta Bancaria (Destino)</label>
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
                  placeholder="Ej. Anticipo para futuro proyecto..."
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

      {/* Modal de Reintegro de Anticipo/Sobrante */}
      {reintegroTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg outline-none shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-emerald-100">
            <div className="p-6 border-b border-emerald-100 flex justify-between items-center bg-emerald-50">
              <div>
                <h3 className="text-lg font-bold text-emerald-800 flex items-center gap-2">
                  <ArrowRight size={20} className="text-emerald-600"/>
                  Reintegrar Saldo a Favor
                </h3>
                <p className="text-xs text-emerald-600 font-medium mt-1">Devolución de dinero al cliente/entidad</p>
              </div>
              <button 
                onClick={() => setReintegroTarget(null)}
                className="text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Entidad:</span>
                  <span className="text-sm font-bold text-slate-800">{reintegroTarget.cliente || 'Cliente'}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Origen de Fondos:</span>
                  <span className="text-sm font-semibold text-slate-700">
                    {reintegroTarget.factura_id || 'Saldo a Favor / Anticipos en Cartera'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase">Saldo Disponible:</span>
                  <span className="text-lg font-black text-emerald-600">${formatoES(Math.abs(reintegroTarget.saldo))}</span>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200 border-dashed">
                  <span className="text-xs font-bold text-slate-500 uppercase">Tasa Original:</span>
                  <span className="text-sm font-bold text-slate-700">Bs. {formatoES(reintegroTarget.tasa || 1)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Monto a Reintegrar (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-black text-emerald-700"
                      value={reintegroForm.monto}
                      onChange={e => setReintegroForm({ ...reintegroForm, monto: e.target.value })}
                    />
                    <button 
                      type="button"
                      onClick={() => setReintegroForm({ ...reintegroForm, monto: String(Math.abs(reintegroTarget.saldo)) })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 px-2 py-1 rounded transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                  {(() => {
                    const enteredMonto = Number(reintegroForm.monto) || 0;
                    const tasa = Number(reintegroTarget.tasa) || 1;
                    if (enteredMonto > 0) {
                      return (
                        <p className="text-xs font-bold text-slate-500 mt-2 text-right">
                          Equivalente: <span className="text-indigo-600">Bs. {formatoES(enteredMonto * tasa)}</span>
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Banco Origen del Dinero</label>
                  <div className="relative">
                    <select
                      className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl appearance-none focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium text-slate-700 bg-white"
                      value={reintegroForm.bancoId}
                      onChange={(e) => setReintegroForm({ ...reintegroForm, bancoId: e.target.value })}
                    >
                      <option value="">Seleccione un banco...</option>
                      {bancos.filter(b => b.estado !== 'inactivo').map(b => (
                        <option key={b.id} value={b.id}>{b.banco} ({b.moneda})</option>
                      ))}
                    </select>
                    <Landmark className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">N° de Referencia</label>
                  <input 
                    type="text" 
                    placeholder="Ej. 98127391"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                    value={reintegroForm.referencia}
                    onChange={e => setReintegroForm({ ...reintegroForm, referencia: e.target.value })}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Fecha del Reintegro</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-700"
                    value={reintegroForm.fecha}
                    onChange={e => setReintegroForm({ ...reintegroForm, fecha: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 mt-auto">
              <button 
                onClick={() => setReintegroTarget(null)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleReintegroSubmit}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center gap-2 transition-colors"
              >
                <ArrowRight size={16} />
                Procesar Reintegro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anticipo Client Search Modal */}
      {isAnticipoClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl outline-none shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Search size={20} className="text-emerald-600"/>
                Buscar Entidad / Cliente
              </h3>
              <button 
                onClick={() => setIsAnticipoClientModalOpen(false)}
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
                  value={anticipoClientSearchTerm}
                  onChange={(e) => setAnticipoClientSearchTerm(e.target.value)}
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
                          cliente_id: client.taxId || client.id,
                          cliente: client.name || client.nombre || ''
                        });
                        setIsAnticipoClientModalOpen(false);
                        setAnticipoClientSearchTerm('');
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

      {/* New Mov Client Search Modal */}
      {isNewMovClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl outline-none shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Search size={20} className="text-indigo-600"/>
                Buscar Entidad / Nombre
              </h3>
              <button 
                onClick={() => setIsNewMovClientModalOpen(false)}
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
                  value={newMovClientSearchTerm}
                  onChange={(e) => setNewMovClientSearchTerm(e.target.value)}
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
                        setIsNewMovClientModalOpen(false);
                        setNewMovClientSearchTerm('');
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

      {/* Modal Cargar Saldo Inicial */}
      {showSaldoInicialModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden font-sans">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 text-violet-600 rounded-lg">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Cargar Saldo Inicial de CxC</h3>
                  <p className="text-xs font-medium text-slate-500">Registrar deuda histórica pendiente del cliente</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSaldoInicialModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex gap-3">
                <span className="font-bold text-lg leading-none">⚠️</span>
                <div>
                  <span className="font-bold">Información de Seguridad:</span> Cargar un saldo inicial registrará la cuenta por cobrar histórica del cliente. No afectará las cuentas bancarias ni el flujo de caja actual. Opcionalmente, puede registrar una partida doble en su libro de diario especificando una cuenta de contrapartida.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col relative col-span-2 md:col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cliente / Entidad</label>
                  <div 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-violet-500 rounded-xl text-sm focus:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-200 outline-none transition-all font-bold text-slate-700 cursor-pointer flex justify-between items-center"
                    onClick={() => setIsSaldoInicialClientModalOpen(true)}
                  >
                    <span>{saldoInicialForm.contacto || 'Seleccione una entidad...'}</span>
                    <ArrowRight size={16} className="text-violet-500" />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nro de Documento / Referencia</label>
                  <input 
                    type="text" 
                    placeholder="Ej. SI-0001"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-violet-500 outline-none transition-all font-semibold"
                    value={saldoInicialForm.factura_id}
                    onChange={e => setSaldoInicialForm({...saldoInicialForm, factura_id: e.target.value})}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Carga (Histórica)</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-violet-500 outline-none transition-all"
                    value={saldoInicialForm.fecha}
                    onChange={e => setSaldoInicialForm({...saldoInicialForm, fecha: e.target.value})}
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Vencimiento de Deuda</label>
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
                    <option value="">No generar comprobante contable automático (Solo registrar saldo para Cobranza)</option>
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

      {/* Modal Editar Documento CxC */}
      {showEditDocModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden font-sans border border-slate-100 border-t-4 border-t-indigo-600">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Ver / Editar Documento</h3>
                  <p className="text-xs font-medium text-slate-500">Modificar los parámetros y saldos contables del documento de cobro</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEditDocModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-700"
                    value={editDocForm.fecha}
                    onChange={e => setEditDocForm({...editDocForm, fecha: e.target.value})}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">N° Documento</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-700 font-mono"
                    value={editDocForm.factura_id}
                    onChange={e => setEditDocForm({...editDocForm, factura_id: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Descripción</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-700"
                  value={editDocForm.descripcion}
                  onChange={e => setEditDocForm({...editDocForm, descripcion: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Monto Total ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono font-bold text-slate-800"
                    value={editDocForm.total}
                    onChange={e => setEditDocForm({...editDocForm, total: e.target.value})}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Saldo Pendiente ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono font-bold text-indigo-700 focus:text-indigo-800"
                    value={editDocForm.saldo}
                    onChange={e => setEditDocForm({...editDocForm, saldo: e.target.value})}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Si reduce este saldo manual, se simulará una cobranza virtual.</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-wrap">
              <button 
                onClick={() => setShowEditDocModal(false)}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEditDoc}
                className="px-6 py-2 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center gap-2 transition-colors"
              >
                <Save size={16} />
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submodal para elegir entidad (Saldo Inicial) */}
      {isSaldoInicialClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg h-[600px] flex flex-col overflow-hidden font-sans">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-lg font-black text-slate-800">Seleccionar {activeTab === 'aliados' || activeTab === 'clientes' ? 'Aliado (Agencia)' : activeTab === 'freelance' ? 'Freelance' : activeTab === 'empleados' ? 'Empleado' : 'Contacto'}</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">Haga clic sobre un registro de la lista</p>
              </div>
              <button 
                onClick={() => {
                  setIsSaldoInicialClientModalOpen(false);
                  setSaldoInicialClientSearchTerm('');
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o identificación..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 outline-none text-sm transition-all"
                  value={saldoInicialClientSearchTerm}
                  onChange={(e) => setSaldoInicialClientSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 bg-slate-50/50">
              {filteredSaldoInicialEntities.length > 0 ? (
                <div className="grid grid-cols-1 gap-1">
                  {filteredSaldoInicialEntities.map(client => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setSaldoInicialForm({
                          ...saldoInicialForm,
                          contacto_id: client.taxId || client.id,
                          contacto: client.name || client.nombre || ''
                        });
                        setIsSaldoInicialClientModalOpen(false);
                        setSaldoInicialClientSearchTerm('');
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
                  <p className="font-medium text-slate-700">No se encontraron entidades</p>
                  <p className="text-sm mt-1">Verifique los términos de búsqueda o registre una nueva entidad en el módulo de Contactos.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cobranza Client Search Modal */}
      {isCobranzaClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[220] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-50 rounded-2xl w-full max-w-xl outline-none shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-150 flex justify-between items-center bg-white">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Search size={20} className="text-indigo-650"/>
                Buscar Cliente / Entidad con Deuda
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setIsCobranzaClientModalOpen(false);
                  setIsSelectingSobrante(false);
                  setCobranzaClientSearchTerm('');
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
                  value={cobranzaClientSearchTerm}
                  onChange={(e) => setCobranzaClientSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-550 outline-none text-sm transition-all"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {(() => {
                const listToRender = isSelectingSobrante
                  ? contactos
                      .filter(c => (c.name || '').toLowerCase().includes(cobranzaClientSearchTerm.toLowerCase()) || (c.taxId || '').toLowerCase().includes(cobranzaClientSearchTerm.toLowerCase()))
                      .map(c => ({ id: c.taxId || c.id, nombre: c.name, categoria: c.isProvider ? 'proveedor' : (c.isCustoms ? 'agencia' : 'cliente') }))
                  : filteredCobranzaClientsWithDebt;

                return listToRender.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2">
                    {listToRender.map((client: any) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          if (isSelectingSobrante) {
                            setCobranzaForm({ ...cobranzaForm, entidadSobranteId: String(client.id) });
                          } else {
                            setCobranzaForm({ ...cobranzaForm, clienteId: String(client.id) });
                            setAbonos({}); // Resetear abonos al cambiar de cliente
                          }
                          setIsSelectingSobrante(false);
                          setIsCobranzaClientModalOpen(false);
                          setCobranzaClientSearchTerm('');
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
                    <p className="font-bold text-slate-700">No se encontraron resultados</p>
                    <p className="text-sm mt-1">Intente con otros términos de búsqueda.</p>
                  </div>
                );
              })()}
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

      {/* Modal Detalle de Cobranza */}
      {selectedCobranza && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Comprobante de Cobro</h3>
                  <p className="text-xs font-mono font-semibold text-slate-400">Ref: {selectedCobranza.referencia} | ID: {selectedCobranza.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedCobranza(null)}
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
                  <div className="font-bold text-slate-800">{selectedCobranza.fecha}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Cliente</div>
                  <div className="font-bold text-slate-800 line-clamp-1">{selectedCobranza.clienteNombre}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Referencia</div>
                  <div className="font-bold text-slate-800 font-mono">{selectedCobranza.referencia}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Total Cobrado</div>
                  <div className="font-black text-emerald-600">${formatoES(selectedCobranza.monto)}</div>
                </div>
              </div>

              {/* Extra log metadata */}
              {selectedCobranza.tasa && selectedCobranza.tasa !== 1 && (
                <div className="flex items-center justify-between px-4 py-2 bg-indigo-50/30 border border-indigo-100/50 rounded-xl text-xs font-bold text-indigo-800">
                  <span>Tasa de cambio aplicada:</span>
                  <span>1 USD = {formatoES(selectedCobranza.tasa)} Bs.F</span>
                </div>
              )}

              {/* Invoices Mapped / Abonos list */}
              {selectedCobranza.abonos && Object.keys(selectedCobranza.abonos).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Documentos Afectados (Abonos)</h4>
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-white">
                    {Object.entries(selectedCobranza.abonos).map(([docId, val]) => {
                      const amount = Number(val);
                      if (amount <= 0) return null;
                      const originalInvoice = cxc.find(d => d.id === docId);
                      return (
                        <div key={docId} className="px-4 py-2.5 flex items-center justify-between text-sm hover:bg-slate-50/30">
                          <div>
                            <span className="font-bold text-slate-700">Factura / Cobro:</span>{' '}
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
                  const targetRef = String(selectedCobranza.referencia || selectedCobranza.reciboNumero || '').trim();
                  const matchedComp = comprobantes.find((c: any) => 
                    (selectedCobranza.comprobanteId && (String(c.id) === String(selectedCobranza.comprobanteId))) ||
                    (targetRef && (
                      String(c.referencia || '').trim() === targetRef ||
                      String(c.numero || '').trim() === targetRef ||
                      (c.referencia && String(c.referencia).toLowerCase().includes(targetRef.toLowerCase())) ||
                      (targetRef && String(c.referencia || '').toLowerCase().includes(targetRef.toLowerCase()))
                    )) ||
                    (c.total && Math.abs(Number(c.total) - Number(selectedCobranza.montoTotal || selectedCobranza.monto)) < 0.01 && c.fecha === selectedCobranza.fecha)
                  ) || (selectedCobranza?.lineas ? selectedCobranza : null);

                  let linesObj = matchedComp?.lineas || [];

                  // Fallback dinámico si no hay líneas para que el comprobante nunca salga en blanco
                  if (!linesObj || linesObj.length === 0) {
                    const montoTotal = Number(selectedCobranza.montoTotal || selectedCobranza.monto) || 0;
                    if (montoTotal > 0) {
                      const selBanco = bancos.find(b => b.id === selectedCobranza.bancoId) || bancos.find(b => b.es_caja || (b.tipo || '').toLowerCase().includes('caja')) || bancos[0];
                      const ctaBancoCode = selBanco?.cuenta_contable_id || '1.1.01.001';
                      const ctaBancoObj = cuentasContables.find(c => String(c.codigo) === String(ctaBancoCode) || String(c.id) === String(ctaBancoCode));

                      const ctaCxcCode = configContable?.cuentaCxc || '1.1.02.001';
                      const ctaCxcObj = cuentasContables.find(c => String(c.codigo) === String(ctaCxcCode) || String(c.id) === String(ctaCxcCode));

                      linesObj = [
                        {
                          id: 'syn-cob-debe',
                          cuentaId: ctaBancoObj?.id || ctaBancoCode,
                          codigo: ctaBancoObj?.codigo || ctaBancoCode,
                          descripcion: `Ingreso Cobro ${selBanco?.banco || 'Caja Principal'} - Ref: ${targetRef || 'Efectivo'}`,
                          debe: montoTotal,
                          haber: 0
                        },
                        {
                          id: 'syn-cob-haber',
                          cuentaId: ctaCxcObj?.id || ctaCxcCode,
                          codigo: ctaCxcObj?.codigo || ctaCxcCode,
                          descripcion: `Cancelación CxC - ${selectedCobranza.clienteNombre || 'Cliente'}`,
                          debe: 0,
                          haber: montoTotal
                        }
                      ];
                    }
                  }

                  const voucherNumero = matchedComp?.numero || (selectedCobranza.comprobanteId ? (selectedCobranza.comprobanteId.startsWith('CMP-') ? selectedCobranza.comprobanteId : `CMP-${selectedCobranza.comprobanteId.slice(0, 8)}`) : (targetRef ? `CMP-${targetRef}` : 'CMP-COBRANZA'));

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
                onClick={() => setSelectedCobranza(null)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 rounded-xl transition-colors hover:bg-slate-100"
              >
                Cerrar Detalle
              </button>
              
              {selectedCobranza.estado === 'activo' && (
                <button
                  type="button"
                  onClick={() => {
                    handleAnnulCobranza(selectedCobranza);
                    setSelectedCobranza(null);
                  }}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-amber-500/10 flex items-center gap-1.5"
                >
                  <X size={16} /> Anular Cobranza
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDeleteCobranza(selectedCobranza)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-rose-600/10 flex items-center gap-1.5"
              >
                <Trash2 size={16} /> Eliminar Cobranza
              </button>
            </div>
          </div>
        </div>
      )}

      <PrintPreview 
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title={printModalTitle}
        defaultOrientation={printModalOrientation}
      >
        {printModalContent}
      </PrintPreview>

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
