import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, Link, useParams } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import { PrintPreview } from '../components/PrintPreview';
import CuentaContableModal from '../components/common/CuentaContableModal';
import VoucherPreviewModal from '../components/common/VoucherPreviewModal';
import BackButton from '../components/common/BackButton';
import { 
  Landmark, Plus, ArrowRightLeft, BarChart3, PiggyBank, Pencil, X, Save, 
  BookOpen, CloudUpload, TrendingUp, TrendingDown, Calculator, CornerDownRight, 
  Ban, LogOut, LogIn, CheckCircle, FileSpreadsheet, ArrowLeft, ChevronLeft, 
  ChevronRight, Wallet, Activity, Printer, ShieldAlert, UserCheck, Receipt, Search, Check, Trash2,
  Info, Coins, Scale, RefreshCw, HelpCircle, ArrowRight, Image, Eye, User, History,
  ArrowDownLeft, ArrowUpRight, Inbox, Calendar, Copy, Filter, DollarSign, CreditCard,
  ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';

// Utilidad para formatear moneda
const formatoES = (num: number | string) => {
  const n = Number(num);
  if (isNaN(n) || num === null) return "0,00";
  let str = n.toFixed(2);
  let parts = str.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(',');
};

const isBankIngreso = (tipo?: string) => {
  const t = (tipo || '').toLowerCase();
  return t === 'ingreso' || t === 'ingreso_directo' || t === 'deposito' || t === 'cobro' || t === 'cobranza' || t === 'transferencia_recibida' || t === 'ajuste_ganancia';
};

// Helper para generar IDs únicos
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Helpers para ordenar movimientos cronológicamente según orden de registro
const sortMovimientos = (a: any, b: any) => {
  const timeDiff = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
  if (timeDiff !== 0) return timeDiff;
  
  // Explicitamente colocar APER (Apertura de Cuenta) de primero para la misma fecha
  if (a.ref === 'APER' && b.ref !== 'APER') return -1;
  if (b.ref === 'APER' && a.ref !== 'APER') return 1;

  // Explicitamente colocar SAPS (Ajustes de Cambio) de último para la misma fecha
  const isSapsA = a.ref === 'AUTO-FX' || a.tipo === 'ajuste_ganancia' || a.tipo === 'ajuste_perdida';
  const isSapsB = b.ref === 'AUTO-FX' || b.tipo === 'ajuste_ganancia' || b.tipo === 'ajuste_perdida';
  if (isSapsA && !isSapsB) return 1;
  if (isSapsB && !isSapsA) return -1;

  const getTimestamp = (item: any) => {
    const rawCreated = item.created_at || item.createdAt;
    if (rawCreated) {
      const t = new Date(rawCreated).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    const idMatch = String(item.id).match(/\d{13}/);
    if (idMatch) {
      const t = Number(idMatch[0]);
      if (!isNaN(t) && t > 1000000000000) return t;
    }
    const parsedId = Number(item.id);
    if (!isNaN(parsedId) && parsedId > 1000000000000) {
      return parsedId;
    }
    return 0;
  };

  const timeA = getTimestamp(a);
  const timeB = getTimestamp(b);
  if (timeA !== timeB && timeA > 0 && timeB > 0) return timeA - timeB;
  return 0;
};

const sortMovimientosDesc = (a: any, b: any) => {
  const timeDiff = new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
  if (timeDiff !== 0) return timeDiff;
  
  // En orden descendente, colocar APER de último
  if (a.ref === 'APER' && b.ref !== 'APER') return 1;
  if (b.ref === 'APER' && a.ref !== 'APER') return -1;

  // En orden descendente, colocar SAPS de primero para la misma fecha (más reciente)
  const isSapsA = a.ref === 'AUTO-FX' || a.tipo === 'ajuste_ganancia' || a.tipo === 'ajuste_perdida';
  const isSapsB = b.ref === 'AUTO-FX' || b.tipo === 'ajuste_ganancia' || b.tipo === 'ajuste_perdida';
  if (isSapsA && !isSapsB) return -1;
  if (isSapsB && !isSapsA) return 1;

  const getTimestamp = (item: any) => {
    const rawCreated = item.created_at || item.createdAt;
    if (rawCreated) {
      const t = new Date(rawCreated).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
    const idMatch = String(item.id).match(/\d{13}/);
    if (idMatch) {
      const t = Number(idMatch[0]);
      if (!isNaN(t) && t > 1000000000000) return t;
    }
    const parsedId = Number(item.id);
    if (!isNaN(parsedId) && parsedId > 1000000000000) {
      return parsedId;
    }
    return 0;
  };

  const timeA = getTimestamp(a);
  const timeB = getTimestamp(b);
  if (timeA !== timeB && timeA > 0 && timeB > 0) return timeB - timeA;
  return 0;
};

// Subcomponente de Paginación interno
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-white/60 border-t border-slate-100 shadow-inner rounded-b-2xl">
      <span className="text-[11px] md:text-xs font-medium text-slate-500">
        Pág <b className="text-slate-800">{currentPage}</b> de <b>{totalPages}</b>
      </span>
      <div className="flex gap-1.5 md:gap-2">
        <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-3 md:px-4 py-1.5 text-[10px] md:text-[11px] font-bold uppercase rounded-lg flex items-center gap-1 bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-50 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" /> Ant
        </button>
        <button onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="px-3 md:px-4 py-1.5 text-[10px] md:text-[11px] font-bold uppercase rounded-lg flex items-center gap-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 transition-colors">
          Sig <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default function BancosView({ 
  bancos = [], 
  movimientosBancos = [], 
  recibos = [], 
  pagos = [], 
  cuentasContables = [], 
  clientes = [], // Para asignar pagos en cuarentena
  contactos = [],
  cxc = [],      // Para cruzar con cuentas por cobrar
  cxp = [],      // Para cruzar con cuentas por pagar
  cobranzas = [], // Para revertir cobros
  configContable = {}, // Para obtener cuentas parametrizadas
  onSave = async (collection: string, data: any) => {}, 
  showToast = (msg: string, type: string) => console.log(`${type.toUpperCase()}: ${msg}`),
  workingYear,
  comprobantes = []
}: {
  bancos?: any[],
  movimientosBancos?: any[],
  recibos?: any[],
  pagos?: any[],
  cuentasContables?: any[],
  clientes?: any[],
  contactos?: any[],
  cxc?: any[],
  cxp?: any[],
  cobranzas?: any[],
  configContable?: any,
  onSave?: (collection: string, data: any) => Promise<void>,
  showToast?: (msg: string, type: string) => void,
  workingYear?: string,
  comprobantes?: any[]
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { submodule } = useParams<{ submodule?: string }>();
  const { userRole, activeCompanyId, availableCompanies, currentUser } = useCompany();
  const [subView, setSubView] = useState('cuentas');
  const [activeSubmodule, setActiveSubmodule] = useState<string>('cuentas');
  const [selectedBancoId, setSelectedBancoId] = useState(null);

  useEffect(() => {
    if (submodule) {
      if (submodule === 'bancos' || submodule === 'cuentas') {
        setActiveSubmodule('cuentas');
        setSubView('cuentas');
      } else if (submodule === 'caja' || submodule === 'cajas') {
        setActiveSubmodule('caja');
        setSubView('cuentas');
      } else if (submodule === 'traspasos') {
        setActiveSubmodule('cuentas');
        setSubView('historial_traspasos');
      } else if (submodule === 'saps' || submodule === 'ajustes') {
        setActiveSubmodule('cuentas');
        setSubView('saps');
      } else if (submodule === 'cuarentena' || submodule === 'conciliacion') {
        setActiveSubmodule('cuentas');
        setSubView('cuarentena');
      } else {
        setActiveSubmodule('cuentas');
        setSubView('cuentas');
      }
    } else {
      setActiveSubmodule('cuentas');
      setSubView('cuentas');
    }
  }, [submodule]);

  const checkOriginModule = (m: any) => {
    // 1. Cobranza
    const linkedCobranza = (cobranzas || []).find(cob => 
      (cob.movimientoBancoId && String(cob.movimientoBancoId) === String(m.id)) ||
      (m.ref && cob.referencia && String(cob.referencia).toLowerCase() === String(m.ref).toLowerCase())
    );
    if (linkedCobranza) {
      return 'Cobranzas';
    }

    // 2. Pago
    const linkedPago = (pagos || []).find(p => 
      (p.movimientoBancoId && String(p.movimientoBancoId) === String(m.id)) ||
      (m.ref && p.referencia && String(p.referencia).toLowerCase() === String(m.ref).toLowerCase())
    );
    if (linkedPago) {
      return 'Pagos';
    }

    // 3. Préstamo o Anticipo en CxC
    const linkedCxc = (cxc || []).find(doc => 
      (doc.id === m.id + '-cxc' || doc.id === `${m.id}-cxc` || String(doc.id).startsWith(m.id + '-')) &&
      (doc.tipo === 'prestamo' || doc.tipo === 'anticipo')
    );
    if (linkedCxc) {
      return linkedCxc.tipo === 'prestamo' ? 'Préstamos' : 'Anticipos';
    }

    // 4. Préstamo o Anticipo en CxP
    const linkedCxp = (cxp || []).find(doc => 
      (doc.id === m.id + '-cxp' || doc.id === `${m.id}-cxp` || String(doc.id).startsWith(m.id + '-')) &&
      (doc.tipo === 'prestamo' || doc.tipo === 'anticipo')
    );
    if (linkedCxp) {
      return linkedCxp.tipo === 'prestamo' ? 'Préstamos' : 'Anticipos';
    }

    return null;
  };

  useEffect(() => {
    if (location.state?.subView) {
      setSubView(location.state.subView);
    }
    if (location.state?.selectedBancoId) {
      setSelectedBancoId(location.state.selectedBancoId);
    }
  }, [location.state]);
  
  // PrintPreview state variables
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
  const [editBancoId, setEditBancoId] = useState(null);

  useEffect(() => {
    if (subView !== 'form_movimiento') return;
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                setMovForm(prev => ({ ...prev, soporteImagen: String(event.target?.result) }));
                showToast?.('Soporte de imagen pegado desde el portapapeles con éxito.', 'success');
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [subView, showToast]);
  
  // Estados para Edición y Cuarentena
  const [editMovId, setEditMovId] = useState(null); 
  const [oldMov, setOldMov] = useState(null); 
  const [pendingVoucher, setPendingVoucher] = useState<{
    comprobante: any;
    movimiento: any;
    onConfirm: (finalComprobante: any) => Promise<void>;
  } | null>(null); 
  
  const [currentPage, setCurrentPage] = useState(1);
  const [reciboVisualizado, setReciboVisualizado] = useState(null); // Nuevo estado para ver el detalle del recibo
  const ITEMS_PER_PAGE = 10;

  const currentYear = new Date().getFullYear();
  const [filtros, setFiltros] = useState({ tipo: 'mes', mes: String(new Date().getMonth() + 1).padStart(2, '0'), ano: String(currentYear), desde: '', hasta: '' });
  const [mayorSearch, setMayorSearch] = useState('');
  const [mayorTypeFilter, setMayorTypeFilter] = useState<'todos' | 'ingresos' | 'egresos'>('todos');
  const [copiedCta, setCopiedCta] = useState(false);
  const [searchTraspaso, setSearchTraspaso] = useState('');
  const [traspasoPage, setTraspasoPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [mayorSearch, mayorTypeFilter, filtros]);

  useEffect(() => {
    setTraspasoPage(1);
  }, [searchTraspaso]);

  const listadoTraspasos = useMemo(() => {
    const outMovs = (movimientosBancos || []).filter(
      m => m.ref && m.ref.toUpperCase().startsWith('OUT-')
    );

    return outMovs.map(outMov => {
      const refCode = outMov.ref.substring(4); // "OUT-12345" -> "12345"
      const inMov = (movimientosBancos || []).find(
        m => m.ref && m.ref.toUpperCase() === `IN-${refCode.toUpperCase()}`
      );
      const comp = (comprobantes || []).find(
        c => (c.referencia && c.referencia.toUpperCase() === `TRF-${refCode.toUpperCase()}`) ||
             (outMov.comprobanteId && (c.id === outMov.comprobanteId || c.id === outMov.comprobante_id)) ||
             (inMov?.comprobanteId && (c.id === inMov.comprobanteId || c.id === inMov.comprobante_id))
      );

      const bO = bancos.find(b => String(b.id) === String(outMov.banco_id));
      const bD = inMov ? bancos.find(b => String(b.id) === String(inMov.banco_id)) : null;

      return {
        id: refCode,
        fecha: outMov.fecha,
        concepto: outMov.descripcion.replace(/^Traspaso a .+: /, '') || 'Traspaso',
        monto: outMov.monto,
        tasaOrigen: outMov.tasa || 1,
        montoBsOrigen: outMov.montoBs,
        tasaDestino: inMov?.tasa || 1,
        montoBsDestino: inMov?.montoBs,
        bancoOrigen: bO ? bO.banco : 'Desconocido',
        bancoOrigenMoneda: bO ? bO.moneda : 'USD',
        bancoDestino: bD ? bD.banco : 'Desconocido',
        bancoDestinoMoneda: bD ? bD.moneda : 'USD',
        outMov,
        inMov,
        comp,
        estado: outMov.estado || 'activo'
      };
    }).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [movimientosBancos, comprobantes, bancos]);

  const handleDeleteTraspaso = async (traspaso: any) => {
    if (typeof window !== 'undefined' && !window.confirm(`¿Está seguro de que desea eliminar permanentemente este traspaso de $ ${formatoES(traspaso.monto)}? Esta acción borrará el egreso del banco de origen (${traspaso.bancoOrigen}), el ingreso al banco de destino (${traspaso.bancoDestino}) y el asiento contable asociado (${traspaso.comp?.numero || 'TRF-' + traspaso.id}) en su totalidad.`)) {
      return;
    }

    const oId = traspaso.outMov?.banco_id;
    const dId = traspaso.inMov?.banco_id;
    const fecha = traspaso.fecha;

    if (oId) {
      const lockDateOrigen = getSapsLockDate(oId);
      if (lockDateOrigen && fecha <= lockDateOrigen) {
        showToast(`Error: El banco origen tiene un cierre SAPS en ${lockDateOrigen}. No se puede eliminar el traspaso.`, 'error');
        return;
      }
    }

    if (dId) {
      const lockDateDestino = getSapsLockDate(dId);
      if (lockDateDestino && fecha <= lockDateDestino) {
        showToast(`Error: El banco destino tiene un cierre SAPS en ${lockDateDestino}. No se puede eliminar el traspaso.`, 'error');
        return;
      }
    }

    try {
      // 1. Delete OUT movement
      if (traspaso.outMov?.id) {
        await onSave('movimientosBancos', { id: traspaso.outMov.id, _delete: true });
      }

      // 2. Delete IN movement
      if (traspaso.inMov?.id) {
        await onSave('movimientosBancos', { id: traspaso.inMov.id, _delete: true });
      }

      // 3. Delete comprobante
      if (traspaso.comp?.id) {
        await onSave('comprobantes', { id: traspaso.comp.id, _delete: true });
      }

      showToast('El traspaso y toda su trayectoria de movimientos y asientos contables se han eliminado correctamente.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Error al intentar eliminar el traspaso.', 'error');
    }
  };

  const fechaHoy = new Date().toISOString().split('T')[0];
  const [cuentaForm, setCuentaForm] = useState({ banco: '', cuenta: '', tipo: 'Corriente', moneda: 'USD', tasa: '1', saldo: '0', saldoBs: '0', cuenta_contable_id: '', es_caja: false, tipo_cuenta: 'nacional' });
  const [movForm, setMovForm] = useState({ tipo: 'ingreso', fecha: fechaHoy, ref: '', desc: '', monto: '', tasa: '1', montoBs: '', cuentaContrapartida: '', isCuarentena: false, soporteImagen: '' });
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [viewingComprobante, setViewingComprobante] = useState<any>(null);

  // Función para limpiar completamente el formulario de movimientos bancarios al entrar o salir
  const resetMovForm = () => {
    const today = new Date().toISOString().split('T')[0];
    setMovForm({ 
      tipo: 'ingreso', 
      fecha: today, 
      ref: '', 
      desc: '', 
      monto: '', 
      tasa: '1', 
      montoBs: '', 
      cuentaContrapartida: '', 
      isCuarentena: false, 
      soporteImagen: '' 
    });
    setEditMovId(null);
    setOldMov(null);
    setPendingVoucher(null);
  };

  const renderComprobanteViewerModal = () => {
    if (!viewingComprobante) return null;

    const totalDebe = (viewingComprobante.lineas || []).reduce((acc: number, curr: any) => acc + (Number(curr.debe) || 0), 0);
    const totalHaber = (viewingComprobante.lineas || []).reduce((acc: number, curr: any) => acc + (Number(curr.haber) || 0), 0);

    return (
      <div 
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={() => setViewingComprobante(null)}
      >
        <div 
          className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100" 
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-905 to-indigo-950 p-6 text-white flex justify-between items-center shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white/10 text-indigo-200 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-white/5">
                  Asiento Contable Relacionado
                </span>
                <span className="bg-emerald-500 text-white px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  {viewingComprobante.estado || 'Contabilizado'}
                </span>
              </div>
              <h3 className="text-xl font-black mt-1.5 flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-400" />
                Comprobante Contable: {viewingComprobante.numero}
              </h3>
              <p className="text-xs text-indigo-200/80 font-medium mt-0.5">Visor oficial de partida contable doble generada por el sistema.</p>
            </div>
            <button 
              type="button"
              onClick={() => setViewingComprobante(null)} 
              className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Details */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
            <div className="bg-white p-4 rounded-xl border border-slate-200/65 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-semibold">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Método Contable</label>
                <p className="text-sm font-extrabold text-slate-800 mt-1">Devengado / Auxiliar</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha de Asiento</label>
                <p className="text-sm font-extrabold text-slate-800 mt-1">{viewingComprobante.fecha}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Referencia de Origen</label>
                <p className="text-sm font-bold text-indigo-650 mt-1 font-mono tracking-tight">{viewingComprobante.referencia}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Monto Consolidado</label>
                <p className="text-sm font-black text-slate-800 mt-1 font-mono hover:text-indigo-605 transition-colors">$ {formatoES(viewingComprobante.total || totalDebe)}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/65 shadow-sm space-y-1 text-xs">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Descripción o Concepto General</label>
              <p className="text-sm text-slate-700 font-extrabold">{viewingComprobante.descripcion}</p>
            </div>

            {/* Account lines table */}
            <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-500 font-mono tracking-widest">
                    <th className="p-4 pl-6">Cuenta Contable</th>
                    <th className="p-4">Descripción de Línea</th>
                    <th className="p-4 text-right w-36">Debito (Debe)</th>
                    <th className="p-4 text-right w-36 pr-6">Credito (Haber)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(viewingComprobante.lineas || []).map((line: any, idx: number) => {
                    const cta = (cuentasContables || []).find(c => String(c.id) === String(line.cuentaId));
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-4 pl-6">
                          <div className="font-extrabold text-slate-800">{cta?.nombre || `Cuenta ${line.cuentaId}`}</div>
                          <div className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">{cta?.codigo || '---'}</div>
                        </td>
                        <td className="p-4 text-slate-500 font-medium">
                          {line.descripcion || viewingComprobante.descripcion}
                        </td>
                        <td className="p-4 text-right font-bold text-slate-700 font-mono">
                          {Number(line.debe) > 0 ? `$ ${formatoES(line.debe)}` : '-'}
                        </td>
                        <td className="p-4 text-right font-bold text-slate-700 font-mono pr-6">
                          {Number(line.haber) > 0 ? `$ ${formatoES(line.haber)}` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals footer */}
              <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex justify-between items-center font-mono font-bold text-slate-700">
                <span className="uppercase font-sans font-black text-slate-400 text-[10px] tracking-wider pl-2">Totalizaciones Cuadradas:</span>
                <div className="flex gap-8 pr-2">
                  <div>
                    <span className="text-slate-400 font-sans text-[10px] mr-2">DEBE:</span>
                    <span className="text-slate-800 font-black">$ {formatoES(totalDebe)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans text-[10px] mr-2">HABER:</span>
                    <span className="text-slate-800 font-black">$ {formatoES(totalHaber)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-end shrink-0">
            <button 
              onClick={() => setViewingComprobante(null)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
            >
              Cerrar Vista de Asiento
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderLightbox = () => {
    if (!lightboxImage) return null;
    return (
      <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setLightboxImage(null)}>
        <div className="relative max-w-5xl w-full max-h-[90vh] bg-transparent flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute -top-12 right-0 p-2 text-white hover:text-slate-200 bg-white/10 hover:bg-white/20 rounded-full transition-colors self-end z-10 flex items-center justify-center"
            title="Cerrar Visualización"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-full flex items-center justify-center overflow-auto rounded-2xl bg-slate-900/40 p-2 border border-white/10 shadow-2xl">
            <img 
              src={lightboxImage} 
              alt="Soporte digital adjunto" 
              className="max-w-full max-h-[80vh] object-contain rounded-xl select-none" 
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-white/60 text-xs font-semibold mt-4">Soporte Digital Adjunto de Transacción</p>
        </div>
      </div>
    );
  };

  const renderTraspasoModal = () => {
    if (!transferForm.showModal) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={()=>setTransferForm({...transferForm, showModal:false})}>
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95" onClick={e=>e.stopPropagation()}>
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50"><h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><ArrowRightLeft className="w-6 h-6 text-blue-600"/> Nuevo Traspaso Bancario</h3><button className="text-slate-400 hover:text-red-500 bg-white p-2 rounded-full shadow-sm" onClick={()=>setTransferForm({...transferForm, showModal:false})}><X className="w-5 h-5"/></button></div>
          <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 relative">
            <div className="space-y-5">
              <h4 className="font-bold text-red-600 uppercase tracking-widest text-[11px] mb-4 flex items-center gap-2 bg-red-50 p-2 rounded-lg w-max"><LogOut className="w-4 h-4"/> Origen (Egreso)</h4>
              <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Banco a debitar</label><select className="input-modern bg-slate-50" value={transferForm.origenId} onChange={e=>setTransferForm({...transferForm, origenId: e.target.value})}><option value="">Seleccione cuenta origen...</option>{bancos.map(b=><option key={b.id} value={b.id}>{b.banco} ({b.moneda})</option>)}</select></div>
              <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Monto a Traspasar (USD)</label><input type="number" step="0.01" className="input-modern font-black text-2xl text-slate-800" value={transferForm.monto} onChange={e=>setTransferForm({...transferForm, monto: e.target.value})} placeholder="0.00" /></div>
              {bancos.find(b=>String(b.id)===transferForm.origenId)?.moneda==='Bolivares' && (
                <div className="flex flex-col bg-red-50/50 p-4 rounded-xl border border-red-100 animate-in fade-in"><label className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1"><Calculator className="w-3 h-3"/> Tasa de Cambio Origen</label><input type="number" step="0.01" className="input-modern bg-white" value={transferForm.tasaOrigen} onChange={e=>setTransferForm({...transferForm, tasaOrigen: e.target.value})} />
                <span className="text-[10px] font-bold text-red-700 mt-2 bg-white px-2 py-1 rounded shadow-sm w-max">Eq. Físico: Bs. {formatoES((parseFloat(transferForm.monto.toString())||0)*(parseFloat(transferForm.tasaOrigen.toString())||1))}</span>
                </div>
              )}
              <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Concepto del Movimiento</label><input type="text" className="input-modern" value={transferForm.concepto} onChange={e=>setTransferForm({...transferForm, concepto: e.target.value})} placeholder="Ej. Reposición caja..." /></div>
            </div>
            <div className="space-y-5">
              <h4 className="font-bold text-green-600 uppercase tracking-widest text-[11px] mb-4 flex items-center gap-2 bg-green-50 p-2 rounded-lg w-max"><LogIn className="w-4 h-4"/> Destino (Ingreso)</h4>
              <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Banco acreditar</label><select className="input-modern bg-slate-50" value={transferForm.destinoId} onChange={e=>setTransferForm({...transferForm, destinoId: e.target.value})}><option value="">Seleccione cuenta destino...</option>{bancos.map(b=><option key={b.id} value={b.id}>{b.banco} ({b.moneda})</option>)}</select></div>
              <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Monto que ingresará (USD)</label><div className="h-[52px] bg-green-50 border border-green-200 rounded-xl flex items-center justify-center font-black text-2xl text-green-600 shadow-inner">$ {formatoES(parseFloat(transferForm.monto.toString())||0)}</div></div>
              {bancos.find(b=>String(b.id)===transferForm.destinoId)?.moneda==='Bolivares' && (
                <div className="flex flex-col bg-green-50/50 p-4 rounded-xl border border-green-100 animate-in fade-in"><label className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-2 flex items-center gap-1"><Calculator className="w-3 h-3"/> Tasa de Cambio Destino</label><input type="number" step="0.01" className="input-modern bg-white" value={transferForm.tasaDestino} onChange={e=>setTransferForm({...transferForm, tasaDestino: e.target.value})} />
                <span className="text-[10px] font-bold text-green-700 mt-2 bg-white px-2 py-1 rounded shadow-sm w-max">Eq. Físico: Bs. {formatoES((parseFloat(transferForm.monto.toString())||0)*(parseFloat(transferForm.tasaDestino.toString())||1))}</span>
                </div>
              )}
            </div>
          </div>
          <div className="p-5 border-t border-slate-100 bg-slate-50 flex flex-col-reverse md:flex-row justify-end gap-3">
            <button className="btn-secondary w-full md:w-auto" onClick={()=>setTransferForm({...transferForm, showModal:false})}>Cancelar</button>
            <button className="btn-primary bg-blue-600 hover:bg-blue-700 w-full md:w-auto" onClick={handleEjecutarTraspaso}><CheckCircle className="w-4 h-4"/> Procesar Traspaso Seguro</button>
          </div>
        </div>
      </div>
    );
  };

  const [isDragging, setIsDragging] = useState(false);
  const [sapsForm, setSapsForm] = useState({ bancoId: '', fecha: fechaHoy, tasa: '' });
  const [sapsResult, setSapsResult] = useState(null);
  const [showSapsConfirmModal, setShowSapsConfirmModal] = useState(false);
  const [showSapsPrintOptionModal, setShowSapsPrintOptionModal] = useState(false);
  const [showSapsGuide, setShowSapsGuide] = useState(false);
  const [sapsTableSearch, setSapsTableSearch] = useState('');
  const [sapsCustomConcept, setSapsCustomConcept] = useState('');
  const [isApplyingSaps, setIsApplyingSaps] = useState(false);
  const [transferForm, setTransferForm] = useState({ origenId: '', destinoId: '', monto: '', concepto: '', tasaOrigen: '1', tasaDestino: '1', showModal: false });
  
  // Estado Modal Cobranza de Cuarentena
  const [asignarModal, setAsignarModal] = useState({ open: false, mov: null, clienteId: '' });
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteSearchTerm, setClienteSearchTerm] = useState('');

  // Estado para busqueda de cuenta contable
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'todas' | 'bancos' | 'cajas' | 'USD' | 'VES'>('todas');
  const [viewMode, setViewMode] = useState<'tarjetas' | 'lista'>('tarjetas');
  const [showCuentaModal, setShowCuentaModal] = useState(false);

  // Cálculos de Saldos Globales y Bimoneda
  const bancosConSaldos = useMemo(() => {
    return bancos.map(b => {
      let saldoUSD = 0; let saldoVES = 0;
      movimientosBancos.filter(m => String(m.banco_id) === String(b.id) && m.estado !== 'anulado').forEach(m => {
        const esIngreso = isBankIngreso(m.tipo);
        const montoAbs = Math.abs(Number(m.monto) || 0);
        let valorUSD = esIngreso ? montoAbs : -montoAbs;
        saldoUSD += valorUSD;
        if (b.moneda === 'Bolivares') {
          let mVES = (m.montoBs !== undefined && m.montoBs !== null && m.montoBs !== '') ? Math.abs(parseFloat(String(m.montoBs))) : montoAbs * (m.tasa || b.tasa || 1);
          if (m.tipo === 'ajuste_ganancia' || m.tipo === 'ajuste_perdida') mVES = 0;
          saldoVES += esIngreso ? mVES : -mVES;
        }
      });
      return { ...b, saldoUSD, saldoVES };
    });
  }, [bancos, movimientosBancos]);

  const totalLiquidez = bancosConSaldos.reduce((acc, b) => acc + b.saldoUSD, 0);

  const bancosOnlyCount = useMemo(() => bancosConSaldos.filter(b => !(b.es_caja || (b.tipo || '').toLowerCase().includes('caja'))).length, [bancosConSaldos]);
  const cajasOnlyCount = useMemo(() => bancosConSaldos.filter(b => (b.es_caja || (b.tipo || '').toLowerCase().includes('caja'))).length, [bancosConSaldos]);

  const filteredBancos = useMemo(() => {
    return bancosConSaldos.filter(b => {
      const q = searchTerm.trim().toLowerCase();
      const matchSearch = !q || 
        (b.banco && b.banco.toLowerCase().includes(q)) ||
        (b.cuenta && b.cuenta.toLowerCase().includes(q)) ||
        (b.tipo && b.tipo.toLowerCase().includes(q));

      if (!matchSearch) return false;

      const isCaja = !!(b.es_caja || (b.tipo || '').toLowerCase().includes('caja'));
      const isVES = b.moneda === 'Bolivares';

      if (filterType === 'bancos') return !isCaja;
      if (filterType === 'cajas') return isCaja;
      if (filterType === 'USD') return !isVES;
      if (filterType === 'VES') return isVES;

      return true;
    });
  }, [bancosConSaldos, searchTerm, filterType]);
  const totalLiquidezVES = bancosConSaldos.reduce((acc, b) => acc + (b.moneda === 'Bolivares' ? (b.saldoVES || 0) : 0), 0);
  const cuarentenaMovs = useMemo(() => {
    return movimientosBancos.filter(m => m.isCuarentena && m.estado !== 'anulado' && !m.cliente_asignado);
  }, [movimientosBancos]);

  // CRUD de Cuentas
  const handleDeleteBanco = async (bancoId, bancoName) => {
    const hasMovs = movimientosBancos.some(m => String(m.banco_id) === String(bancoId) && m.estado !== 'anulado');
    if (hasMovs) {
      showToast(`No se puede eliminar el banco ${bancoName} porque tiene movimientos activos.`, 'error');
      return;
    }
    
    try {
      await onSave('bancos', { id: bancoId, _delete: true });
      showToast(`Banco ${bancoName} eliminado exitosamente.`, 'success');
      // If currently selected, clear
      if (selectedBancoId === bancoId) {
        setSubView('cuentas');
        setSelectedBancoId(null);
      }
    } catch (e) {
      showToast('Error al eliminar banco.', 'error');
    }
  };

  const handleEditBanco = (banco) => {
    setEditBancoId(banco.id);
    const isBox = !!(banco.es_caja || (banco.tipo || '').toLowerCase().includes('caja') || (banco.banco || '').toLowerCase().includes('caja'));
    setCuentaForm({ 
      banco: banco.banco || '', 
      cuenta: banco.cuenta || banco.numero_cuenta || '', 
      tipo: banco.tipo || (isBox ? 'Caja General' : 'Corriente'), 
      moneda: banco.moneda || 'USD', 
      tasa: banco.tasa?.toString() || '1', 
      saldo: '0', 
      saldoBs: '0',
      cuenta_contable_id: banco.cuenta_contable_id || '',
      es_caja: isBox,
      tipo_cuenta: banco.tipo_cuenta || (banco.moneda === 'Bolivares' ? 'nacional' : 'internacional')
    });
    setSubView('nueva_cuenta');
  };

  const handleGuardarCuenta = async () => {
    if (!cuentaForm.banco || !cuentaForm.cuenta) return showToast("Faltan datos requeridos.", "error");
    const dataToSave: any = { 
      banco: cuentaForm.banco,
      cuenta: cuentaForm.cuenta,
      numero_cuenta: cuentaForm.cuenta,
      tipo: cuentaForm.tipo, 
      cuenta_contable_id: cuentaForm.cuenta_contable_id || null,
      es_caja: !!cuentaForm.es_caja,
      tipo_cuenta: cuentaForm.tipo_cuenta || (cuentaForm.moneda === 'Bolivares' ? 'nacional' : 'internacional')
    };

    try {
      if (editBancoId) {
        const b = bancos.find(x => x.id === editBancoId);
        if(b.moneda === 'Bolivares') dataToSave.tasa = parseFloat(cuentaForm.tasa.toString()) || 1;
        await onSave('bancos', { ...b, ...dataToSave });
        showToast(cuentaForm.es_caja ? "Caja actualizada." : "Banco actualizado.", "success");
      } else {
        const newBancoId = generateId();
        const saldoInicial = parseFloat(cuentaForm.saldo.toString()) || 0;
        dataToSave.moneda = cuentaForm.moneda;
        dataToSave.tasa = cuentaForm.moneda === 'Bolivares' ? (parseFloat(cuentaForm.tasa.toString()) || 1) : 1;
        dataToSave.saldo = 0; 
        await onSave('bancos', { id: newBancoId, createdAt: Date.now(), ...dataToSave });

        if (saldoInicial > 0) {
          await onSave('movimientosBancos', { id: generateId(), banco_id: newBancoId, fecha: fechaHoy, ref: "APER", descripcion: "Apertura de Cuenta", tipo: 'ingreso', monto: saldoInicial, tasa: dataToSave.tasa, montoBs: dataToSave.moneda === 'Bolivares' ? (saldoInicial * dataToSave.tasa).toFixed(2) : null, estado: 'activo', createdAt: Date.now() });
        }
        showToast(cuentaForm.es_caja ? "Caja creada exitosamente." : "Banco creado exitosamente.", "success");
      }
      setEditBancoId(null); setSubView('cuentas');
    } catch(e) { showToast("Error al guardar cuenta.", "error"); }
  };

  // Libro Mayor Analítico
  const mayorData = useMemo(() => {
    if (!selectedBancoId) return { movs: [], saldoInicialUSD: 0, saldoInicialVES: 0, saldoFinalUSD: 0 };
    const banco = bancos.find(b => String(b.id) === String(selectedBancoId));
    const isVES = banco?.moneda === 'Bolivares';

    let fIni = null; let fFin = null;
    if (filtros.tipo === 'mes') {
      fIni = `${filtros.ano}-${filtros.mes}-01`;
      fFin = `${filtros.ano}-${filtros.mes}-${new Date(Number(filtros.ano), parseInt(filtros.mes), 0).getDate()}`;
    } else if (filtros.tipo === 'ano') {
      fIni = `${filtros.ano}-01-01`; fFin = `${filtros.ano}-12-31`;
    } else if (filtros.tipo === 'rango') {
      fIni = filtros.desde; fFin = filtros.hasta;
    }

    let sIniUSD = 0; let sIniVES = 0; let movsList = [];
    const allMovs = movimientosBancos.filter(m => String(m.banco_id) === String(selectedBancoId)).sort(sortMovimientos);

    allMovs.forEach(m => {
      const isAnulado = m.estado === 'anulado';
      const esIngreso = isBankIngreso(m.tipo);
      const montoAbs = Math.abs(parseFloat(m.monto?.toString() || '0')) || 0;
      let vUSD = 0; let vVES = 0;
      if (!isAnulado) {
        vUSD = esIngreso ? montoAbs : -montoAbs;
        if (isVES) {
          let mVES = (m.montoBs !== undefined && m.montoBs !== null && m.montoBs !== '') ? Math.abs(parseFloat(String(m.montoBs))) : montoAbs * (m.tasa || banco.tasa || 1);
          if (m.tipo === 'ajuste_ganancia' || m.tipo === 'ajuste_perdida') mVES = 0;
          vVES = esIngreso ? mVES : -mVES;
        }
      }
      
      let inPeriod = true;
      if (filtros.tipo !== 'todo') {
        if (fIni && m.fecha < fIni) inPeriod = false;
        if (fFin && m.fecha > fFin) inPeriod = false;
      }
      
      if (!inPeriod && m.fecha < (fIni || '9999-12-31')) {
        sIniUSD += vUSD; sIniVES += vVES;
      } else if (inPeriod) {
        movsList.push(m);
      }
    });

    let sAcumUSD = sIniUSD; let sAcumVES = sIniVES;
    let totalIngresosUSD = 0;
    let totalEgresosUSD = 0;
    let totalIngresosVES = 0;
    let totalEgresosVES = 0;
    let countIngresos = 0;
    let countEgresos = 0;

    movsList.forEach(m => {
      if (m.estado !== 'anulado') {
        const esIngreso = isBankIngreso(m.tipo);
        let montoNum = Math.abs(parseFloat(m.monto?.toString() || '0')) || 0;
        let vUSD = esIngreso ? montoNum : -montoNum;
        sAcumUSD += vUSD;
        let mVES = 0;
        if (isVES) {
          mVES = (m.montoBs !== undefined && m.montoBs !== null && m.montoBs !== '') ? Math.abs(parseFloat(String(m.montoBs))) : montoNum * (parseFloat(m.tasa?.toString()) || parseFloat(banco?.tasa?.toString()) || 1);
          if (m.tipo === 'ajuste_ganancia' || m.tipo === 'ajuste_perdida') mVES = 0;
          sAcumVES += esIngreso ? mVES : -mVES;
        }

        if (esIngreso) {
          totalIngresosUSD += montoNum;
          totalIngresosVES += mVES;
          countIngresos++;
        } else {
          totalEgresosUSD += montoNum;
          totalEgresosVES += mVES;
          countEgresos++;
        }
      }
      m.saldoCalcUSD = sAcumUSD; m.saldoCalcVES = sAcumVES;
    });

    // Orden cronológico estricto (Libro Mayor clásico: más antiguos arriba, recientes abajo)
    const displayMovs = [...movsList].sort(sortMovimientos);
    return { 
      movs: displayMovs, 
      saldoInicialUSD: sIniUSD, 
      saldoInicialVES: sIniVES, 
      saldoFinalUSD: sAcumUSD,
      saldoFinalVES: sAcumVES,
      totalIngresosUSD,
      totalEgresosUSD,
      totalIngresosVES,
      totalEgresosVES,
      netoPeriodoUSD: totalIngresosUSD - totalEgresosUSD,
      countIngresos,
      countEgresos
    };
  }, [selectedBancoId, bancos, movimientosBancos, filtros]);

  const handlePrintMayor = () => {
    const b = bancosConSaldos.find(x => String(x.id) === String(selectedBancoId));
    const isVES = b?.moneda === 'Bolivares';
    const movsToPrint = mayorData.movs;

    triggerPrintPreview(
      `Libro Mayor Contable - ${b?.banco || ''}`,
      'portrait',
      <div className="w-full text-slate-800 font-sans">
        <div className="text-center mb-6 border-b-2 border-slate-800 pb-4">
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-widest">{b?.banco}</h2>
          <p className="text-sm font-bold text-slate-700 mt-1">CUENTA: {b?.cuenta} | MONEDA: {b?.moneda}</p>
          <p className="text-[10px] md:text-xs text-slate-500 mt-1 uppercase font-semibold">REPORTE DE MAYOR ANALÍTICO - {filtros.tipo === 'todo' ? 'TODO EL HISTORIAL' : 'PERÍODO FILTRADO'}</p>
        </div>
        <table className="w-full text-left border-collapse text-[10px] md:text-[11px] table-layout-fixed">
          <thead>
            <tr className="border-b-2 border-slate-400 bg-slate-50 font-bold">
              <th className="py-2.5 pl-4 pr-2 w-24">Fecha</th>
              <th className="px-2 w-32">Referencia</th>
              <th className="pr-4 py-2.5">Descripción</th>
              <th className="text-right w-28 pr-4">Ingreso</th>
              <th className="text-right w-28 pr-4">Egreso</th>
              <th className="text-right w-32 pr-4">Saldo USD</th>
              {isVES && <th className="text-right w-32 pr-4">Saldo VES</th>}
            </tr>
          </thead>
          <tbody>
            {filtros.tipo !== 'todo' && (
              <tr className="border-b border-slate-200 font-bold bg-slate-100/50">
                <td className="py-2 pl-4 pr-2 text-indigo-700" colSpan={3}>Saldo Arrastrado al Período</td>
                <td className="text-right pr-4">-</td>
                <td className="text-right pr-4">-</td>
                <td className="text-right pr-4 font-black">${formatoES(mayorData.saldoInicialUSD)}</td>
                {isVES && <td className="text-right pr-4 font-black">Bs.{formatoES(mayorData.saldoInicialVES)}</td>}
              </tr>
            )}
            {movsToPrint.map((m: any) => {
              const isAnulado = m.estado === 'anulado';
              const isIngreso = isBankIngreso(m.tipo);
              const montoVal = Math.abs(Number(m.monto) || 0);
              return (
                <tr key={m.id} className={`border-b border-slate-100 ${isAnulado ? 'opacity-60 line-through text-slate-400' : 'text-slate-800'}`}>
                  <td className="py-2.5 pl-4 pr-2 font-medium whitespace-nowrap">{(m.fecha || '').split('T')[0].split('-').reverse().join('/')}</td>
                  <td className="px-2 font-mono whitespace-nowrap">{m.ref}</td>
                  <td className="pr-4 py-2.5 leading-relaxed">{m.descripcion} {isAnulado && <span className="ml-1 text-[8px] font-bold text-red-600 uppercase inline-block">(ANULADO)</span>}</td>
                  <td className="text-right font-medium text-emerald-700 pr-4 whitespace-nowrap">{!isAnulado && isIngreso ? formatoES(montoVal) : '-'}</td>
                  <td className="text-right font-medium text-rose-700 pr-4 whitespace-nowrap">{!isAnulado && !isIngreso ? formatoES(montoVal) : '-'}</td>
                  <td className={`text-right font-bold pr-4 whitespace-nowrap ${m.saldoCalcUSD < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{m.saldoCalcUSD < 0 ? '-' : ''}${formatoES(Math.abs(m.saldoCalcUSD))}</td>
                  {isVES && <td className={`text-right font-medium pr-4 whitespace-nowrap ${m.saldoCalcVES < 0 ? 'text-rose-500' : 'text-slate-500'}`}>{m.saldoCalcVES < 0 ? '-' : ''}Bs.{formatoES(Math.abs(m.saldoCalcVES))}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-6 flex justify-end items-center border-t-2 border-slate-800 pt-4">
          <div className="text-right">
            <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Saldo Final Contable USD</p>
            <p className={`text-xl md:text-2xl font-black leading-none ${mayorData.saldoFinalUSD < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{mayorData.saldoFinalUSD < 0 ? '-' : ''}${formatoES(Math.abs(mayorData.saldoFinalUSD))}</p>
          </div>
        </div>
      </div>
    );
  };

  const filteredMayorMovs = useMemo(() => {
    let list = mayorData.movs;
    if (mayorSearch.trim()) {
      const q = mayorSearch.toLowerCase().trim();
      list = list.filter(m => 
        (m.ref || '').toLowerCase().includes(q) ||
        (m.descripcion || '').toLowerCase().includes(q) ||
        (m.monto || '').toString().includes(q) ||
        (m.usuario || '').toLowerCase().includes(q)
      );
    }
    if (mayorTypeFilter === 'ingresos') {
      list = list.filter(m => isBankIngreso(m.tipo) && m.estado !== 'anulado');
    } else if (mayorTypeFilter === 'egresos') {
      list = list.filter(m => !isBankIngreso(m.tipo) && m.estado !== 'anulado');
    }
    return list;
  }, [mayorData.movs, mayorSearch, mayorTypeFilter]);

  const totalPagesMayor = Math.ceil(filteredMayorMovs.length / ITEMS_PER_PAGE) || 1;
  const safePageMayor = Math.min(currentPage, totalPagesMayor);
  const paginatedMayor = filteredMayorMovs.slice((safePageMayor - 1) * ITEMS_PER_PAGE, safePageMayor * ITEMS_PER_PAGE);

  // ==========================================
  // LÓGICA DE MOVIMIENTOS Y CUARENTENA
  // ==========================================
  
  const getSapsLockDate = (bId: string) => {
    const sapsMovs = movimientosBancos.filter(m => String(m.banco_id) === String(bId) && (m.tipo === 'ajuste_ganancia' || m.tipo === 'ajuste_perdida') && m.estado !== 'anulado');
    if (sapsMovs.length === 0) return null;
    sapsMovs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    return sapsMovs[0].fecha;
  };

  const handleEditMovimiento = (m) => {
    const lockDate = getSapsLockDate(m.banco_id);
    if (lockDate && m.fecha <= lockDate && m.tipo !== 'ajuste_ganancia' && m.tipo !== 'ajuste_perdida') {
      return showToast(`Error: No se puede editar un movimiento en un período cerrado por SAPS (${lockDate}).`, 'error');
    }
    setEditMovId(m.id);
    setOldMov(m);
    setMovForm({ 
      tipo: m.tipo || 'ingreso', 
      fecha: m.fecha || new Date().toISOString().split('T')[0], 
      ref: m.ref || '', 
      desc: m.descripcion || '', 
      monto: m.monto ?? 0, 
      tasa: m.tasa || 1, 
      montoBs: (m.montoBs !== undefined && m.montoBs !== null && m.montoBs !== '') ? m.montoBs.toString() : (m.tasa && m.monto ? (parseFloat(String(m.monto)) * parseFloat(String(m.tasa))).toFixed(2) : ''),
      cuentaContrapartida: m.cuentaContrapartida || '',
      isCuarentena: m.isCuarentena || false,
      soporteImagen: m.soporteImagen || ''
    });
    setSubView('form_movimiento');
  };

  const handleGenerarAsiento = async (fecha: string, modulo: string, ref: string, desc: string, detalles: any[]) => {
    const totalDebe = detalles.reduce((sum, d) => sum + (Number(d.debe) || 0), 0);
    const totalHaber = detalles.reduce((sum, d) => sum + (Number(d.haber) || 0), 0);
    
    const isBalanced = Math.abs(totalDebe - totalHaber) < 0.01;
    const hasInvalidLines = detalles.some(d => !d.cuenta_id);
    const estado = (!isBalanced || hasInvalidLines) ? 'Descuadrado' : 'Contabilizado';

    const newComprobante = {
      id: `comp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fecha,
      numero: `CMP-${Date.now().toString().slice(-6)}`,
      tipo: 'Diario',
      descripcion: desc,
      referencia: ref,
      total: totalDebe,
      estado: estado,
      lineas: (detalles || []).map((d, i) => ({
        id: `l${i}-${Date.now()}`,
        cuentaId: d.cuenta_id || '',
        descripcion: d.descripcion || desc,
        debe: Number(d.debe) || 0,
        haber: Number(d.haber) || 0
      }))
    };
    await onSave('comprobantes', newComprobante);
    return newComprobante;
  };

  const handleAttachFiles = (files: FileList) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      showToast?.('Por favor, seleccione un archivo de imagen válido (PNG, JPG, JPEG).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setMovForm(prev => ({ ...prev, soporteImagen: String(e.target?.result) }));
        showToast?.('Soporte de imagen cargado correctamente.', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGuardarMovimiento = async () => {
    const parsedMonto = parseFloat(movForm.monto.toString());
    const monto = parseFloat(parsedMonto.toFixed(2));
    if (!monto || monto <= 0 || !movForm.desc) return showToast('Valide monto y descripción.', 'error');
    if (!editMovId && !movForm.isCuarentena && !movForm.cuentaContrapartida) return showToast('Seleccione una cuenta NIIF destino.', 'error');

    if (workingYear && movForm.fecha) {
      const year = movForm.fecha.substring(0, 4);
      if (year !== workingYear) {
        showToast(`No se puede registrar este movimiento porque el año de la fecha seleccionada (${year}) no coincide con el período contable seleccionado (${workingYear}).`, 'error');
        return;
      }
    }

    const lockDate = getSapsLockDate(selectedBancoId);
    if (lockDate && movForm.fecha <= lockDate) {
      return showToast(`Error: Existe un cierre SAPS en ${lockDate}. Use una fecha posterior.`, 'error');
    }

    const b = bancos.find(x => String(x.id) === String(selectedBancoId));
    const ref = movForm.ref || 'S/R';
    
    // Cuenta Puente "Pagos por Identificar". Si no existe usa la 99 o 28 como fallback.
    const ctaCuarentenaId = configContable?.cuentaPagosPorIdentificar || cuentasContables.find(c => (c.nombre || '').toLowerCase().includes('identificar'))?.id || '2.1.1'; 
    const ctaDestino = movForm.isCuarentena ? ctaCuarentenaId : movForm.cuentaContrapartida;
    const cB = b?.cuenta_contable_id || '1.1.3';
    const timestamp = Date.now();

    try {
      const cleanRefLower = (str: string) => {
        if (!str) return '';
        return String(str)
          .trim()
          .toLowerCase()
          .replace(/^(out|in|trf|rec|asig)-/, '');
      };
      
      const oldRef = oldMov?.ref || '';
      const targetClean = cleanRefLower(oldRef);
      const isGeneric = (r: string) => !r || r === 's/r' || r === 'sr' || r === 'sin referencia';
      const existingComp = (comprobantes || []).find(c => {
        if (!editMovId) return false;
        if (oldMov?.comprobanteId && (String(c.id) === String(oldMov.comprobanteId) || String(c.id) === String(oldMov.comprobante_id))) {
          return true;
        }
        if (c.movimientoBancoId && String(c.movimientoBancoId) === String(editMovId)) {
          return true;
        }
        if (c.id) {
          const idStr = String(editMovId).toLowerCase();
          const cIdStr = String(c.id).toLowerCase();
          if (cIdStr === `comp-${idStr}` || cIdStr.includes(idStr) || idStr.includes(cIdStr)) return true;
          const m13 = idStr.match(/\d{13}/)?.[0];
          const c13 = cIdStr.match(/\d{13}/)?.[0];
          if (m13 && c13 && m13 === c13) return true;
        }
        return false;
      });

      let templateComp: any = null;
      if (editMovId && existingComp) {
        templateComp = JSON.parse(JSON.stringify(existingComp));
        templateComp.fecha = movForm.fecha;
        templateComp.descripcion = movForm.desc;
        templateComp.referencia = ref;
        templateComp.total = monto;
        
        if (templateComp.lineas && templateComp.lineas.length === 2) {
          const updatedLineas = [...templateComp.lineas];
          if (movForm.tipo === 'ingreso') {
            updatedLineas[0] = {
              ...updatedLineas[0],
              cuentaId: cB,
              descripcion: `Ingreso Banco ${b?.banco || ''} - ${movForm.desc}`,
              debe: monto,
              haber: 0
            };
            updatedLineas[1] = {
              ...updatedLineas[1],
              cuentaId: ctaDestino,
              descripcion: movForm.desc,
              debe: 0,
              haber: monto
            };
          } else {
            updatedLineas[0] = {
              ...updatedLineas[0],
              cuentaId: ctaDestino,
              descripcion: movForm.desc,
              debe: monto,
              haber: 0
            };
            updatedLineas[1] = {
              ...updatedLineas[1],
              cuentaId: cB,
              descripcion: `Egreso Banco ${b?.banco || ''} - ${movForm.desc}`,
              debe: 0,
              haber: monto
            };
          }
          templateComp.lineas = updatedLineas;
        }
      }
      const newId = editMovId || generateId();
      const compId = editMovId ? (oldMov?.comprobanteId || oldMov?.comprobante_id || existingComp?.id || `comp-${newId}`) : `comp-${newId}`;

      if (!templateComp) {
        const lineas = movForm.tipo === 'ingreso' ? [
          {
            id: `l0-${Date.now()}`,
            cuentaId: cB,
            descripcion: `Ingreso Banco ${b?.banco || ''} - ${movForm.desc}`,
            debe: monto,
            haber: 0
          },
          {
            id: `l1-${Date.now()}`,
            cuentaId: ctaDestino,
            descripcion: movForm.desc,
            debe: 0,
            haber: monto
          }
        ] : [
          {
            id: `l0-${Date.now()}`,
            cuentaId: ctaDestino,
            descripcion: movForm.desc,
            debe: monto,
            haber: 0
          },
          {
            id: `l1-${Date.now()}`,
            cuentaId: cB,
            descripcion: `Egreso Banco ${b?.banco || ''} - ${movForm.desc}`,
            debe: 0,
            haber: monto
          }
        ];

        templateComp = {
          id: compId,
          fecha: movForm.fecha,
          numero: existingComp?.numero || `CMP-${Date.now().toString().slice(-6)}`,
          tipo: 'Diario',
          descripcion: movForm.desc,
          referencia: ref,
          total: monto,
          estado: 'Contabilizado',
          lineas,
          movimientoBancoId: newId
        };
      } else {
        templateComp.id = compId;
        templateComp.movimientoBancoId = newId;
      }

      const newMov = editMovId ? {
        id: editMovId, 
        banco_id: selectedBancoId, 
        fecha: movForm.fecha, 
        ref, 
        descripcion: movForm.desc, 
        tipo: movForm.tipo, 
        monto, 
        tasa: b?.moneda==='Bolivares' ? movForm.tasa : 1,
        montoBs: b?.moneda==='Bolivares' ? movForm.montoBs : null,
        isCuarentena: movForm.isCuarentena,
        cuarentenaStatus: movForm.isCuarentena ? (oldMov?.cuarentenaStatus || 'pendiente') : null,
        cuentaContrapartida: ctaDestino,
        soporteImagen: movForm.soporteImagen || '',
        usuario: oldMov?.usuario || currentUser?.email || 'Usuario',
        comprobanteId: compId,
        comprobante_id: compId
      } : {
        id: newId, 
        createdAt: timestamp, 
        banco_id: selectedBancoId, 
        fecha: movForm.fecha, 
        ref, 
        descripcion: movForm.desc, 
        tipo: movForm.tipo, 
        monto, 
        tasa: b?.moneda==='Bolivares'?movForm.tasa:1, 
        montoBs: b?.moneda==='Bolivares' ? movForm.montoBs : null,
        estado: 'activo', 
        isCuarentena: movForm.isCuarentena, 
        cuarentenaStatus: movForm.isCuarentena ? 'pendiente' : null, 
        cuentaContrapartida: ctaDestino,
        soporteImagen: movForm.soporteImagen || '',
        usuario: currentUser?.email || 'Usuario',
        comprobanteId: compId,
        comprobante_id: compId
      };

      setPendingVoucher({
        comprobante: templateComp,
        movimiento: newMov,
        onConfirm: async (finalComprobante: any) => {
          try {
            if (editMovId) {
              const oldWasCuarentena = oldMov?.isCuarentena;
              const newIsCuarentena = movForm.isCuarentena;

              await onSave('movimientosBancos', newMov);

              if (oldWasCuarentena && !newIsCuarentena) {
                 await handleGenerarAsiento(movForm.fecha, 'Tesorería', `REC-${ref}`, `Reclasificación de Cuarentena: ${movForm.desc}`, [
                    { cuenta_id: oldMov.cuentaContrapartida || ctaCuarentenaId, descripcion: 'Descargo de Cuarentena', debe: monto, haber: 0 },
                    { cuenta_id: ctaDestino, descripcion: 'Reclasificación a cuenta real', debe: 0, haber: monto }
                 ]);
              } else if (!oldWasCuarentena && newIsCuarentena) {
                 await handleGenerarAsiento(movForm.fecha, 'Tesorería', `REC-${ref}`, `Envío a Cuarentena: ${movForm.desc}`, [
                    { cuenta_id: oldMov.cuentaContrapartida, descripcion: 'Anulación de cuenta anterior', debe: monto, haber: 0 },
                    { cuenta_id: ctaCuarentenaId, descripcion: 'Abono a Cuarentena', debe: 0, haber: monto }
                 ]);
              }

              await onSave('comprobantes', {
                ...finalComprobante,
                id: compId,
                movimientoBancoId: newMov.id
              });

              // Sincronizar fecha en Cobranzas y Pagos vinculados
              const linkedCobranza = (cobranzas || []).find(cob => 
                (cob.movimientoBancoId && String(cob.movimientoBancoId) === String(newMov.id))
              );

              if (linkedCobranza) {
                await onSave('cobranzas', { 
                  ...linkedCobranza, 
                  fecha: newMov.fecha 
                });

                if (linkedCobranza.abonos) {
                  for (const [docId, montoAbonado] of Object.entries(linkedCobranza.abonos)) {
                    const montoNum = Number(montoAbonado);
                    if (montoNum > 0) {
                      const doc = cxc.find(d => d.id === docId);
                      if (doc) {
                        if (doc.saldo <= 0.01) {
                          await onSave('cxc', { ...doc, fechaPago: newMov.fecha });
                        }
                      }
                    }
                  }
                }
              }

              const linkedPago = (pagos || []).find(p => 
                (p.movimientoBancoId && String(p.movimientoBancoId) === String(newMov.id))
              );

              if (linkedPago) {
                await onSave('pagos-realizados', { 
                  ...linkedPago, 
                  fecha: newMov.fecha 
                });
              }

              showToast('Movimiento actualizado exitosamente.', 'success');
            } else {
              await onSave('movimientosBancos', newMov);
              
              await onSave('comprobantes', {
                ...finalComprobante,
                id: compId,
                movimientoBancoId: newMov.id
              });
              
              showToast(movForm.isCuarentena ? 'Movimiento enviado a cuarentena.' : 'Movimiento registrado con éxito.', 'success');
              
              if (!movForm.isCuarentena) {
                navigate('/reports/comprobante-movimiento-banco', { state: { movimiento: newMov, banco: b } });
              }
            }
            
            const wasCuarentena = movForm.isCuarentena;
            resetMovForm();
            setSubView(wasCuarentena ? 'cuarentena' : 'mayor_analitico');
          } catch (e: any) {
            console.error("Error al registrar movimiento:", e);
            const errMsg = e?.message || String(e);
            showToast(`Error al registrar movimiento: ${errMsg}`, 'error');
            throw e; // Rethrow so handleConfirmClick in modal catches it too
          }
        }
      });
    } catch (e: any) {
      console.error("Error al procesar movimiento:", e);
      showToast(`Error al procesar movimiento: ${e?.message || String(e)}`, 'error');
    }
  };

  // Flujo B: Asignar Cuarentena a Cliente
  const handleAsignarCuarentena = async () => {
    if (!asignarModal.clienteId) return showToast('Seleccione un cliente.', 'error');
    const mov = asignarModal.mov;
    
    const ctaCuarentenaId = mov.cuentaContrapartida || cuentasContables.find(c => (c.nombre || '').toLowerCase().includes('identificar'))?.id || 99;
    const clienteObj = clientes.find(c => String(c.id) === String(asignarModal.clienteId));
    const ctaClienteId = clienteObj?.cuenta_contable_debe_id || clienteObj?.cuenta_contable_id || configContable?.cuentaAnticipoRecibido || '2.1.1';
    const clienteNombre = clienteObj?.name || clienteObj?.nombre || 'Cliente Desconocido';

    try {
      // Evento 2: Asiento de Cruce
      const ctaCuarentenaId = configContable?.cuentaPagosPorIdentificar || cuentasContables.find(c => (c.nombre || '').toLowerCase().includes('identificar'))?.id || '2.1.1';
      await handleGenerarAsiento(fechaHoy, 'Cobranzas', `ASIG-${mov.ref}`, `Cruce Cuarentena - Cliente: ${clienteNombre}`, [
           { cuenta_id: ctaCuarentenaId, descripcion: 'Descargo de Cuarentena', debe: mov.monto, haber: 0 },
           { cuenta_id: ctaClienteId, descripcion: 'Abono Anticipo CxC', debe: 0, haber: mov.monto }
      ]);

      const updatedMov = { 
        ...mov, 
        cuarentenaStatus: 'asignado', 
        cliente_asignado: asignarModal.clienteId,
        descripcion: `${mov.descripcion} (Asignado a: ${clienteNombre})`
      };

      // Marcar el movimiento como asignado
      await onSave('movimientosBancos', updatedMov);

      // Generar Anticipo a favor del cliente en Cuentas por Cobrar
      const bancoObj = bancos.find(b => String(b.id) === String(mov.banco_id));
      await onSave('cxc', { 
        id: generateId(), 
        createdAt: Date.now(), 
        fecha: fechaHoy,
        vencimiento: fechaHoy,
        factura_id: `ANT-${mov.ref}`, 
        cliente_id: asignarModal.clienteId, 
        cliente: clienteNombre, 
        descripcion: `Anticipo por pago en cuarentena Ref: ${mov.ref}`,
        moneda: bancoObj?.moneda === 'Bolivares' ? 'VES' : 'USD',
        tasa: mov.tasa || bancoObj?.tasa || 1,
        total: -(mov.monto), 
        saldo: -(mov.monto), 
        tipo: 'anticipo',
        estado: 'activo'
      });

      showToast('Dinero asignado como saldo a favor del cliente.', 'success');
      setAsignarModal({ open: false, mov: null, clienteId: '' });
      
      // Navegar al comprobante
      // navigate('/reports/comprobante-movimiento-banco', { state: { movimiento: updatedMov, banco: bancoObj } });
    } catch (e) { showToast('Error al asignar el pago.', 'error'); }
  };

  const handleAnularMovimiento = async (m) => {
    const origin = checkOriginModule(m);
    if (origin) {
      showToast(`No se puede anular este movimiento desde el módulo de bancos. Debe ser anulado o eliminado desde su módulo de origen (${origin}) para asegurar la integridad de los datos.`, 'error');
      return;
    }

    const lockDate = getSapsLockDate(m.banco_id);
    if (lockDate && m.fecha <= lockDate && m.tipo !== 'ajuste_ganancia' && m.tipo !== 'ajuste_perdida') {
      return showToast(`Error: No se puede anular un movimiento en un período cerrado por SAPS (${lockDate}).`, 'error');
    }
    // We avoid window.confirm in iframe
    try { await onSave('movimientosBancos', { id: m.id, estado: 'anulado' }); showToast('Movimiento anulado.', 'success'); } catch(e) {}
  };

  const handleDeleteMovimiento = async (m) => {
    const origin = checkOriginModule(m);
    if (origin) {
      showToast(`No se puede eliminar este movimiento desde el módulo de bancos. Debe ser eliminado desde su módulo de origen (${origin}) para asegurar la integridad de los datos.`, 'error');
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm(`¿Está seguro que desea eliminar este movimiento de banco (${m.ref}) de manera PERMANENTE? Esto eliminará también su asiento contable.`)) {
      return;
    }

    try {
      const cleanRefLower = (str: string) => {
        if (!str) return '';
        return String(str)
          .trim()
          .toLowerCase()
          .replace(/^(out|in|trf|rec|asig)-/, '');
      };

      const originalRef = m.ref || '';
      const targetClean = cleanRefLower(originalRef);
      const isTransfer = originalRef.toLowerCase().startsWith('out-') || originalRef.toLowerCase().startsWith('in-');

      // 1. Eliminar movimiento bancario actual
      await onSave('movimientosBancos', { id: m.id, _delete: true });

      // Si es un traspaso, buscar y eliminar el otro movimiento (por ejemplo si borramos OUT-12345, borramos IN-12345)
      if (isTransfer && movimientosBancos && movimientosBancos.length > 0 && targetClean) {
        const otherTransferMovs = movimientosBancos.filter(other => {
          if (!other.ref || other.id === m.id) return false;
          const otherClean = cleanRefLower(other.ref);
          const otherLower = other.ref.toLowerCase();
          const isOtherTransfer = otherLower.startsWith('out-') || otherLower.startsWith('in-');
          return isOtherTransfer && otherClean === targetClean;
        });

        for (const otherMov of otherTransferMovs) {
          await onSave('movimientosBancos', { id: otherMov.id, _delete: true });
        }
      }

      // 2. Buscar asiento contable (comprobante) específico para eliminarlo
      const compIdToDelete = m.comprobanteId || m.comprobante_id;
      if (compIdToDelete) {
        await onSave('comprobantes', { id: compIdToDelete, _delete: true });
      } else if (comprobantes && comprobantes.length > 0) {
        // Buscar el comprobante específico generado para este movimiento por ID
        const matchedComp = comprobantes.find(c => 
          String(c.id) === `comp-${m.id}` || 
          (c.movimientoBancoId && String(c.movimientoBancoId) === String(m.id)) ||
          (c.id && String(c.id).toLowerCase().includes(String(m.id).toLowerCase()))
        );
        if (matchedComp) {
          await onSave('comprobantes', { id: matchedComp.id, _delete: true });
        }
      }

      // 3. Buscar y revertir cobranza asociada (Cuentas por Cobrar)
      const linkedCobranza = (cobranzas || []).find(cob => 
        (cob.movimientoBancoId && String(cob.movimientoBancoId) === String(m.id))
      );

      if (linkedCobranza) {
        if (linkedCobranza.abonos) {
          Object.entries(linkedCobranza.abonos).forEach(([docId, montoAbonado]) => {
            const montoNum = Number(montoAbonado);
            if (montoNum > 0) {
              const doc = cxc.find(d => d.id === docId);
              if (doc) {
                const restoredSaldo = doc.saldo + montoNum;
                const restoredEstado = restoredSaldo >= (doc.total || doc.monto || 0) - 0.01 ? 'pendiente' : 'parcial';
                onSave('cxc', { ...doc, saldo: restoredSaldo, estado: restoredEstado, fechaPago: null });
              }
            }
          });
        }
        if (linkedCobranza.anticiposAplicadosLog) {
          Object.entries(linkedCobranza.anticiposAplicadosLog).forEach(([antId, montoAplicado]) => {
            const montoNum = Number(montoAplicado);
            if (montoNum > 0) {
              const antDoc = cxc.find(d => d.id === antId);
              if (antDoc) {
                onSave('cxc', { ...antDoc, saldo: antDoc.saldo - montoNum });
              }
            }
          });
        }
        await onSave('cobranzas', { id: linkedCobranza.id, _delete: true });
        if (linkedCobranza.comprobanteId) {
          await onSave('comprobantes', { id: linkedCobranza.comprobanteId, _delete: true });
        }
      }

      // 4. Buscar y revertir pago asociado (Cuentas por Pagar)
      const linkedPago = (pagos || []).find(p => 
        (p.movimientoBancoId && String(p.movimientoBancoId) === String(m.id))
      );

      if (linkedPago) {
        if (linkedPago.abonos) {
          Object.entries(linkedPago.abonos).forEach(([docId, montoAbonado]) => {
            const montoNum = Number(montoAbonado);
            if (montoNum > 0) {
              const doc = cxp.find(d => d.id === docId);
              if (doc) {
                const restoredSaldo = doc.saldo + montoNum;
                const restoredEstado = restoredSaldo >= (doc.total || doc.monto || 0) - 0.01 ? 'pendiente' : 'parcial';
                onSave('cxp', { ...doc, saldo: restoredSaldo, estado: restoredEstado });
              }
            }
          });
        }
        await onSave('pagos-realizados', { id: linkedPago.id, _delete: true });
        if (linkedPago.comprobanteId) {
          await onSave('comprobantes', { id: linkedPago.comprobanteId, _delete: true });
        }
      }

      showToast('Movimiento bancario y sus impactos contables vinculados han sido revertidos permanentemente.', 'success');
    } catch (e) {
      showToast('Error al eliminar el movimiento o el asiento contable.', 'error');
    }
  };

  // Función para Abrir Detalle de Recibo desde el Banco
  const abrirDetalleRecibo = (refStr) => {
    if (!recibos || recibos.length === 0) {
       showToast('Los recibos no están sincronizados. Asegure pasar recibos={recibos} en App.jsx', 'error');
       return;
    }
    const rec = recibos.find(r => r.correlativo === refStr);
    if (rec) {
       setReciboVisualizado(rec);
    } else {
       showToast('No se encontró el detalle de este recibo.', 'error');
    }
  };

  // SAPS (Análisis Diferencial Cambiario)
  const handleCalcularSAPS = () => {
    const bId = sapsForm.bancoId; 
    const fCorte = sapsForm.fecha; 
    const tCierre = parseFloat(sapsForm.tasa.toString());
    
    if (!bId || !fCorte || !tCierre || tCierre <= 0) return showToast('Complete los parámetros correctamente.', 'error');

    const banco = bancos.find(b => String(b.id) === String(bId));
    const bTasa = banco?.tasa || 1;

    const movs = movimientosBancos
      .filter(m => 
        String(m.banco_id) === String(bId) && 
        m.estado !== 'anulado' && 
        m.fecha <= fCorte && 
        !(m.ref === 'AUTO-FX' && m.fecha === fCorte)
      )
      .sort(sortMovimientos);
      
    let arrUSD=0, arrVES=0, ingUSD=0, ingVES=0, egrUSD=0, egrVES=0;
    
    let lastAdjIdx = -1;
    for(let i=movs.length-1; i>=0; i--) { 
      if((movs[i].tipo==='ajuste_ganancia' || movs[i].tipo==='ajuste_perdida') && movs[i].fecha < fCorte){ lastAdjIdx=i; break; } 
    }
    
    for(let i=0; i<=lastAdjIdx; i++) {
      let m=movs[i]; 
      let mVES = m.montoBs ? parseFloat(String(m.montoBs)) : (m.monto * (m.tasa || bTasa)); 
      mVES = Math.round(mVES * 100) / 100;
      if(m.tipo==='ajuste_ganancia' || m.tipo==='ajuste_perdida') mVES=0;
      if(m.tipo==='ingreso' || m.tipo==='ajuste_ganancia'){ 
        arrUSD = Math.round((arrUSD + m.monto) * 100) / 100; 
        arrVES = Math.round((arrVES + mVES) * 100) / 100; 
      } else if(m.tipo==='egreso' || m.tipo==='ajuste_perdida'){ 
        arrUSD = Math.round((arrUSD - m.monto) * 100) / 100; 
        arrVES = Math.round((arrVES - mVES) * 100) / 100; 
      }
    }

    let detallados = [];
    let acumUSD = Math.round(arrUSD * 100) / 100;
    let acumVES = Math.round(arrVES * 100) / 100;

    detallados.push({
      id: 'arrastre',
      fecha: '-',
      referencia: 'Saldo Inicial (Corte Anterior)',
      descripcion: 'Saldos previos confirmados',
      tipo: 'arrastre',
      montoUSD: 0,
      tasa: null,
      montoVES: 0,
      saldoUSD: acumUSD,
      saldoVES: acumVES
    });
    
    for(let i=lastAdjIdx+1; i<movs.length; i++) {
      let m=movs[i]; 
      let mVES = m.montoBs ? parseFloat(String(m.montoBs)) : (m.monto * (m.tasa || bTasa));
      mVES = Math.round(mVES * 100) / 100;
      if(m.tipo==='ingreso'){ 
        ingUSD = Math.round((ingUSD + m.monto) * 100) / 100; 
        ingVES = Math.round((ingVES + mVES) * 100) / 100; 
        acumUSD = Math.round((acumUSD + m.monto) * 100) / 100; 
        acumVES = Math.round((acumVES + mVES) * 100) / 100;
      } else if(m.tipo==='egreso'){ 
        egrUSD = Math.round((egrUSD + m.monto) * 100) / 100; 
        egrVES = Math.round((egrVES + mVES) * 100) / 100; 
        acumUSD = Math.round((acumUSD - m.monto) * 100) / 100; 
        acumVES = Math.round((acumVES - mVES) * 100) / 100;
      }
      detallados.push({
         id: m.id,
         fecha: m.fecha,
         referencia: m.referencia || m.descripcion || '-',
         descripcion: m.descripcion || '-',
         tipo: m.tipo,
         montoUSD: m.monto,
         tasa: m.tasa || bTasa,
         montoVES: mVES,
         saldoUSD: acumUSD,
         saldoVES: acumVES
      });
    }

    const sTeoricoUSD = Math.round((arrUSD + ingUSD - egrUSD) * 100) / 100;
    const sFinalVES = Math.round((arrVES + ingVES - egrVES) * 100) / 100;
    const valorRealUSD = Math.round((sFinalVES / tCierre) * 100) / 100;
    const diferencial = Math.round((valorRealUSD - sTeoricoUSD) * 100) / 100;

    let res = { 
      bancoId: bId, fecha: fCorte, 
      arrUSD: Math.round(arrUSD * 100) / 100, 
      arrVES: Math.round(arrVES * 100) / 100, 
      ingUSD: Math.round(ingUSD * 100) / 100, 
      ingVES: Math.round(ingVES * 100) / 100, 
      egrUSD: Math.round(egrUSD * 100) / 100, 
      egrVES: Math.round(egrVES * 100) / 100, 
      sTeoricoUSD, sFinalVES, valorRealUSD, diferencial, tipo: 'none', monto: 0,
      detalles: detallados,
      tasaCierre: tCierre
    };
    
    if(Math.abs(diferencial) > 0.05) { 
      res.tipo = diferencial < -0.05 ? 'ajuste_perdida' : 'ajuste_ganancia'; 
      res.monto = Math.round(Math.abs(diferencial) * 100) / 100; 
    }
    setSapsResult(res);
  };

  const handlePrintSapsReport = () => {
    if (!sapsResult) return;
    setShowSapsPrintOptionModal(true);
  };

  const handlePrintSapsReportEx = (formatType: 'detallado' | 'resumido') => {
    if (!sapsResult) return;
    const selectedBankObj = bancos.find(b => String(b.id) === String(sapsResult.bancoId));
    const activeCompany = availableCompanies?.find(c => c.id === activeCompanyId);
    const companyName = activeCompany?.name || 'NUESTRA EMPRESA C.A.';
    const companyTaxId = activeCompany?.taxId || '';

    // Grouped data for Resumido if needed
    let printDetails = [];
    if (formatType === 'resumido') {
      const detallesOriginales = sapsResult.detalles || [];
      const arrastreRow = detallesOriginales.find(d => d.id === 'arrastre') || {
        id: 'arrastre',
        fecha: '-',
        referencia: 'Saldo Inicial (Corte Anterior)',
        descripcion: 'Saldos previos confirmados',
        tipo: 'arrastre',
        montoUSD: 0,
        tasa: null,
        montoVES: 0,
        saldoUSD: sapsResult.arrUSD || 0,
        saldoVES: sapsResult.arrVES || 0
      };

      const otherRows = detallesOriginales.filter(d => d.id !== 'arrastre');
      const groupedMap = new Map<string, {
        fecha: string;
        ingresosUSD: number;
        egresosUSD: number;
        ingresosVES: number;
        egresosVES: number;
        count: number;
      }>();

      otherRows.forEach(row => {
        const f = row.fecha;
        if (!groupedMap.has(f)) {
          groupedMap.set(f, {
            fecha: f,
            ingresosUSD: 0,
            egresosUSD: 0,
            ingresosVES: 0,
            egresosVES: 0,
            count: 0
          });
        }
        const group = groupedMap.get(f)!;
        group.count += 1;
        if (row.tipo === 'ingreso') {
          group.ingresosUSD += row.montoUSD;
          group.ingresosVES += row.montoVES;
        } else if (row.tipo === 'egreso') {
          group.egresosUSD += row.montoUSD;
          group.egresosVES += row.montoVES;
        }
      });

      const sortedDates = Array.from(groupedMap.keys()).sort();
      let runningUSD = arrastreRow.saldoUSD;
      let runningVES = arrastreRow.saldoVES;

      printDetails.push({
        ...arrastreRow,
        ingresoUSD: 0,
        egresoUSD: 0,
        ingresoVES: 0,
        egresoVES: 0,
      });

      sortedDates.forEach(date => {
        const g = groupedMap.get(date)!;
        runningUSD += (g.ingresosUSD - g.egresosUSD);
        runningVES += (g.ingresosVES - g.egresosVES);
        printDetails.push({
          id: `resumido-${date}`,
          fecha: date,
          referencia: `Consolidado del día`,
          descripcion: `${g.count} transacción(es) agrupada(s)`,
          tipo: 'resumen_dia',
          montoUSD: g.ingresosUSD - g.egresosUSD,
          ingresoUSD: g.ingresosUSD,
          egresoUSD: g.egresosUSD,
          ingresoVES: g.ingresosVES,
          egresoVES: g.egresosVES,
          tasa: null,
          montoVES: g.ingresosVES - g.egresosVES,
          saldoUSD: runningUSD,
          saldoVES: runningVES
        });
      });
    } else {
      printDetails = sapsResult.detalles || [];
    }

    const ctaB = selectedBankObj?.cuenta_contable_id || '1.1.3';
    const ctaBankObj = cuentasContables.find(c => String(c.id) === String(ctaB) || String(c.codigo) === String(ctaB));

    const pG = configContable?.cuentaGananciaDiferencialCambiario || cuentasContables.find(c => (c.nombre || '').toLowerCase().includes('ganancia') && (c.nombre || '').toLowerCase().includes('cambio'))?.id || '4.1.1'; 
    const pP = configContable?.cuentaPerdidaDiferencialCambiario || cuentasContables.find(c => (c.nombre || '').toLowerCase().includes('pérdida') && (c.nombre || '').toLowerCase().includes('cambio'))?.id || '5.2.1'; 

    const ctaPGObj = cuentasContables.find(c => String(c.id) === String(pG) || String(c.codigo) === String(pG));
    const ctaPPObj = cuentasContables.find(c => String(c.id) === String(pP) || String(c.codigo) === String(pP));

    const getDiferencialFila = (d: any, tCierre: number) => {
      if (!tCierre || tCierre <= 0) return 0;
      let val = 0;
      if (d.tipo === 'arrastre') {
        val = (d.saldoVES / tCierre) - d.saldoUSD;
      } else if (d.tipo === 'egreso') {
        val = d.montoUSD - (d.montoVES / tCierre);
      } else {
        val = (d.montoVES / tCierre) - d.montoUSD;
      }
      return Math.round(val * 100) / 100;
    };

    const content = (
      <div className="p-8 bg-white text-slate-800 font-sans text-xs max-w-4xl mx-auto printable-saps-report">
        {/* Encabezado Membrete */}
        <div className="flex justify-between items-start border-b-2 border-slate-300 pb-4 mb-6">
          <div>
            <h1 className="text-sm font-black uppercase text-slate-800 tracking-wide">{companyName}</h1>
            {companyTaxId && <p className="text-[10px] text-slate-500 font-bold mt-0.5">R.I.F.: {companyTaxId}</p>}
            <p className="text-[9px] text-slate-400 font-medium">Departamento de Contabilidad & Finanzas</p>
          </div>
          <div className="text-right">
            <h2 className="text-base font-black text-indigo-700 uppercase tracking-widest leading-none">Análisis SAPS (FX)</h2>
            <p className="text-[9px] text-slate-500 font-bold mt-1.5">Cédula de Revalorización Cambiaria ({formatType === 'resumido' ? 'Resumido' : 'Detallado'})</p>
            <p className="text-[8px] text-slate-400 font-medium">Fecha de Emisión: {new Date().toLocaleDateString('es-VE')} {new Date().toLocaleTimeString('es-VE')}</p>
          </div>
        </div>

        {/* Parámetros del Análisis */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Institución Financiera</span>
            <span className="text-xs font-black text-slate-800">{selectedBankObj?.banco || 'Banco'}</span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Número de Cuenta (Bs.)</span>
            <span className="text-xs font-mono font-bold text-slate-700">{selectedBankObj?.cuenta || 'S/C'}</span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Fecha Límite de Corte</span>
            <span className="text-xs font-black text-slate-800">{sapsResult.fecha}</span>
          </div>
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-400 block">Tasa BCV de Corte</span>
            <span className="text-xs font-mono font-black text-indigo-700">{formatoES(sapsResult.tasaCierre)} Bs/$</span>
          </div>
        </div>

        {/* Sección 1: Cuadro del Balance de Cuadre */}
        <div className="mb-6">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
            📌 1. Pasos del Análisis y Revalorización Cambiaria (Lógica SAPS)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-3xs">
              <span className="text-[8px] font-extrabold text-indigo-600 uppercase bg-indigo-50 px-1.5 py-0.5 rounded block w-max mb-1.5">A. Saldo Teórico en Dólares (Libros Contables)</span>
              <span className="text-sm font-black text-slate-850 font-mono">$ {formatoES(sapsResult.sTeoricoUSD)}</span>
              <p className="text-[8px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-100">
                Fórmula: Arrastre USD (${formatoES(sapsResult.arrUSD)}) + Ingresos USD (${formatoES(sapsResult.ingUSD)}) - Egresos USD (${formatoES(sapsResult.egrUSD)})
              </p>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-3xs">
              <span className="text-[8px] font-extrabold text-indigo-600 uppercase bg-indigo-50 px-1.5 py-0.5 rounded block w-max mb-1.5">B. Saldo Real en Bolívares (Moneda Local)</span>
              <span className="text-sm font-black text-indigo-700 font-mono">Bs. {formatoES(sapsResult.sFinalVES)}</span>
              <p className="text-[8px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-100">
                Fórmula: Arrastre VES (Bs. {formatoES(sapsResult.arrVES)}) + Ingresos VES (Bs. {formatoES(sapsResult.ingVES)}) - Egresos VES (Bs. {formatoES(sapsResult.egrVES)})
              </p>
            </div>
            <div className="border border-slate-200 rounded-xl p-3 bg-indigo-50/50 border-indigo-100 shadow-3xs">
              <span className="text-[8px] font-extrabold text-indigo-600 uppercase bg-indigo-100 px-1.5 py-0.5 rounded block w-max mb-1.5">C. Valor Real en Dólares (Ajustado)</span>
              <span className="text-sm font-black text-indigo-950 font-mono">$ {formatoES(sapsResult.valorRealUSD)}</span>
              <p className="text-[8px] text-indigo-500 font-mono mt-1 pt-1 border-t border-indigo-100/50">
                Fórmula: Saldo Final VES (Bs. {formatoES(sapsResult.sFinalVES)}) / Tasa de Cierre (${formatoES(sapsResult.tasaCierre)})
              </p>
            </div>
            <div className={`border rounded-xl p-3 shadow-3xs ${sapsResult.tipo === 'ajuste_ganancia' ? 'bg-emerald-50/40 border-emerald-200 text-emerald-950' : sapsResult.tipo === 'ajuste_perdida' ? 'bg-rose-50/40 border-rose-200 text-rose-950' : 'bg-slate-50 border-slate-200 text-slate-800'}`}>
              <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded block w-max mb-1.5 ${sapsResult.tipo === 'ajuste_ganancia' ? 'bg-emerald-100 text-emerald-800' : sapsResult.tipo === 'ajuste_perdida' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-600'}`}>D. Diferencial Cambiario</span>
              <span className="text-sm font-black font-mono">
                {sapsResult.diferencial >= 0 ? '+' : '-'}$ {formatoES(Math.abs(sapsResult.diferencial))}
              </span>
              <p className="text-[8px] text-slate-500 font-mono mt-1 pt-1 border-t border-slate-200/50">
                Fórmula: Valor Real USD (${formatoES(sapsResult.valorRealUSD)}) - Saldo Teórico USD (${formatoES(sapsResult.sTeoricoUSD)})
              </p>
            </div>
          </div>

          <div className={`mt-4 p-3 rounded-xl border flex items-center justify-between ${sapsResult.tipo === 'ajuste_ganancia' ? 'bg-emerald-50/40 border-emerald-100 text-emerald-800' : sapsResult.tipo === 'ajuste_perdida' ? 'bg-rose-50/40 border-rose-100 text-rose-800' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
            <div>
              <span className="text-[8px] font-extrabold uppercase tracking-wide block text-slate-400">Resultado Contable Neto</span>
              <span className="text-xs font-black font-mono">
                {sapsResult.tipo === 'ajuste_ganancia' ? 'Ganancia por Revalorización Cambiaria' : sapsResult.tipo === 'ajuste_perdida' ? 'Pérdida por Devaluación Cambiaria' : 'Saldos Sincronizados y Cuadrados'}
              </span>
            </div>
            <span className="text-sm font-black font-mono">
              {sapsResult.tipo !== 'none' ? `$ ${formatoES(sapsResult.monto)}` : '$ 0,00'}
            </span>
          </div>
        </div>

        {/* Sección 2: El Asiento Contable Proyectado */}
        {sapsResult.tipo !== 'none' && (
          <div className="mb-6">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
              ⚖️ 2. Propuesta de Ajuste Contable (Asiento Diario de Ajuste)
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs">
              <table className="w-full text-left text-[10px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="p-2.5">Código Cuenta</th>
                    <th className="p-2.5">Descripción de Cuenta Contable</th>
                    <th className="p-2.5 text-right w-24">Debe ($)</th>
                    <th className="p-2.5 text-right w-24">Haber ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {sapsResult.tipo === 'ajuste_ganancia' ? (
                    <>
                      <tr>
                        <td className="p-2.5 font-mono text-slate-600">{ctaBankObj?.codigo || ctaB}</td>
                        <td className="p-2.5 text-slate-800 font-bold text-left">{ctaBankObj ? `${ctaBankObj.nombre} (${selectedBankObj?.banco})` : `Banco: ${selectedBankObj?.banco}`} <span className="text-[8px] text-emerald-600 font-black bg-emerald-50 px-1 rounded ml-1">(Revalorización de Activo)</span></td>
                        <td className="p-2.5 text-right font-mono font-bold">$ {formatoES(sapsResult.monto)}</td>
                        <td className="p-2.5 text-right text-slate-300 font-mono">0,00</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-mono text-slate-600">{ctaPGObj?.codigo || '4.1.1'}</td>
                        <td className="p-2.5 text-slate-800 font-bold text-left">{ctaPGObj?.nombre || 'Ingreso por Diferencial Cambiario'} <span className="text-[8px] text-indigo-600 font-black bg-indigo-50 px-1 rounded ml-1">(Ganancia Cambiaria)</span></td>
                        <td className="p-2.5 text-right text-slate-300 font-mono">0,00</td>
                        <td className="p-2.5 text-right font-mono font-bold">$ {formatoES(sapsResult.monto)}</td>
                      </tr>
                    </>
                  ) : (
                    <>
                      <tr>
                        <td className="p-2.5 font-mono text-slate-600">{ctaPPObj?.codigo || '5.2.1'}</td>
                        <td className="p-2.5 text-slate-800 font-bold text-left">{ctaPPObj?.nombre || 'Gasto por Diferencial Cambiario'} <span className="text-[8px] text-rose-600 font-black bg-rose-50 px-1 rounded ml-1">(Pérdida Cambiaria)</span></td>
                        <td className="p-2.5 text-right font-mono font-bold">$ {formatoES(sapsResult.monto)}</td>
                        <td className="p-2.5 text-right text-slate-300 font-mono">0,00</td>
                      </tr>
                      <tr>
                        <td className="p-2.5 font-mono text-slate-600">{ctaBankObj?.codigo || ctaB}</td>
                        <td className="p-2.5 text-slate-800 font-bold text-left">{ctaBankObj ? `${ctaBankObj.nombre} (${selectedBankObj?.banco})` : `Banco: ${selectedBankObj?.banco}`} <span className="text-[8px] text-slate-600 font-black bg-slate-100 px-1 rounded ml-1">(Devaluación de Activo)</span></td>
                        <td className="p-2.5 text-right text-slate-300 font-mono">0,00</td>
                        <td className="p-2.5 text-right font-mono font-bold">$ {formatoES(sapsResult.monto)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-100 font-black text-slate-800">
                    <td colSpan={2} className="p-2.5 text-right">Totales del Ajuste:</td>
                    <td className="p-2.5 text-right font-mono">$ {formatoES(sapsResult.monto)}</td>
                    <td className="p-2.5 text-right font-mono">$ {formatoES(sapsResult.monto)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Sección 3: Cédula Analítica de Movimientos */}
        <div className="mb-6">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
            📊 3. Desglose y Cédula Analítica de Movimientos {formatType === 'resumido' ? 'Consolidados por Día' : 'Detallados'}
          </h3>
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-3xs">
            <table className="w-full text-left text-[9px] border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-black border-b border-slate-200">
                  <th className="p-2 text-center w-16">Fecha</th>
                  <th className="p-2">Descripción/Referencia</th>
                  <th className="p-2 text-center w-14">Operación</th>
                  <th className="p-2 text-right w-16">Tasa Contable</th>
                  <th className="p-2 text-right w-20">{formatType === 'resumido' ? 'Neto USD' : 'Ingreso/Egreso USD'}</th>
                  <th className="p-2 text-right w-24">{formatType === 'resumido' ? 'Neto VES' : 'Importe VES'}</th>
                  <th className="p-1.5 text-right bg-slate-100/50 w-24">Saldo USD Acum</th>
                  <th className="p-1.5 text-right bg-indigo-50/50 text-indigo-950 w-24">Saldo VES Acum</th>
                  <th className="p-1.5 text-right bg-slate-50 w-20 text-slate-600 font-bold">USD Cierre</th>
                  <th className="p-1.5 text-right bg-indigo-50/50 text-indigo-950 w-24 font-extrabold">Diferencial FX</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {printDetails.map((d: any, idx: number) => {
                  const diffRow = getDiferencialFila(d, sapsResult.tasaCierre);
                  const usdCierreVal = Math.round((d.tipo === 'arrastre' ? (d.saldoVES / sapsResult.tasaCierre) : (d.montoVES / sapsResult.tasaCierre)) * 100) / 100;
                  return (
                    <tr key={`${d.id}-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2 text-center whitespace-nowrap text-[8px] uppercase font-bold text-slate-500">{d.fecha !== '-' ? d.fecha : 'INICIAL'}</td>
                      <td className="p-2 text-left">
                        <span className="font-bold text-slate-850">{d.referencia}</span>
                        {formatType === 'resumido' && d.tipo === 'resumen_dia' ? (
                          <span className="block text-[8px] text-slate-400 font-medium">
                            Ingresos: ${formatoES(d.ingresoUSD)} | Egresos: ${formatoES(d.egresoUSD)}
                          </span>
                        ) : (
                          d.descripcion && d.descripcion !== '-' && d.descripcion !== d.referencia && <span className="block text-[8px] text-slate-400 font-medium">{d.descripcion}</span>
                        )}
                      </td>
                      <td className="p-2 text-center text-[8px] font-black uppercase">
                        {d.tipo === 'arrastre' ? <span className="text-slate-500 uppercase">PREVIO</span> :
                         d.tipo === 'resumen_dia' ? <span className="text-indigo-600 font-extrabold">NETO DÍA</span> :
                         d.tipo === 'ingreso' ? <span className="text-emerald-600">INGRESO</span> :
                         <span className="text-rose-600">EGRESO</span>}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-600">{d.tasa ? formatoES(d.tasa) : '-'}</td>
                      <td className={`p-2 text-right font-mono font-bold ${formatType === 'resumido' ? (d.montoUSD >= 0 ? 'text-emerald-700' : 'text-rose-700') : (d.tipo === 'ingreso' ? 'text-emerald-700' : d.tipo === 'egreso' ? 'text-rose-700' : 'text-slate-700')}`}>
                        {d.tipo === 'arrastre' ? '$ 0,00' : (formatType === 'resumido' ? `${d.montoUSD >= 0 ? '+' : '-'}$${formatoES(Math.abs(d.montoUSD))}` : (d.tipo === 'egreso' ? `-$${formatoES(d.montoUSD)}` : `$${formatoES(d.montoUSD)}`))}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-indigo-700">
                        {formatType === 'resumido' ? (
                          d.tipo === 'arrastre' ? 'Bs. 0,00' : `${d.montoVES >= 0 ? '+' : '-'}Bs. ${formatoES(Math.abs(d.montoVES))}`
                        ) : (
                          d.montoVES ? `Bs. ${formatoES(d.montoVES)}` : 'Bs. 0,00'
                        )}
                      </td>
                      <td className="p-2 text-right font-mono bg-slate-50/50 font-black text-slate-800">
                        ${formatoES(d.saldoUSD)}
                      </td>
                      <td className="p-2 text-right font-mono bg-indigo-50/30 font-black text-indigo-900 border-l border-indigo-50/30">
                        Bs. {formatoES(d.saldoVES)}
                      </td>
                      <td className="p-2 text-right font-mono text-slate-600 bg-slate-50/30 font-bold">
                        ${formatoES(usdCierreVal)}
                      </td>
                      <td className={`p-2 text-right font-mono font-bold bg-slate-50/30 ${diffRow > 0.005 ? 'text-emerald-700 bg-emerald-50/20' : diffRow < -0.005 ? 'text-rose-700 bg-rose-50/20' : 'text-slate-500'}`}>
                        {diffRow >= 0 ? '+' : '-'}${formatoES(Math.abs(diffRow))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t border-slate-200">
                  <td colSpan={6} className="p-2 text-right font-black text-slate-800 text-[9px] uppercase">Saldo Teórico SAPS Final:</td>
                  <td className="p-2 text-right font-mono font-black text-slate-900 text-xs">
                    ${formatoES(sapsResult.sTeoricoUSD)}
                  </td>
                  <td className="p-2 text-right font-mono font-black text-slate-900 text-xs">
                    Bs. {formatoES(sapsResult.sFinalVES)}
                  </td>
                  <td className="p-2 text-right font-mono text-slate-400 font-bold">-</td>
                  <td className="p-2 text-right font-mono text-slate-400 font-bold">-</td>
                </tr>
                <tr className="bg-indigo-50 border-t border-slate-200">
                  <td colSpan={6} className="p-2 text-right font-black text-indigo-800 text-[9px] uppercase">Saldo Real Revalorizado a Tasa BCV ({formatoES(sapsResult.tasaCierre)}):</td>
                  <td className="p-2 text-right font-mono font-black text-indigo-900 text-xs">
                    ${formatoES(sapsResult.valorRealUSD)}
                  </td>
                  <td className="p-2 text-right font-mono font-black text-indigo-900 text-xs">
                    Bs. {formatoES(sapsResult.sFinalVES)}
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-slate-700 bg-slate-50">
                    Tasa: {formatoES(sapsResult.tasaCierre)}
                  </td>
                  <td className={`p-2 text-right font-mono font-black text-xs bg-indigo-100 ${sapsResult.diferencial >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                    {sapsResult.diferencial >= 0 ? '+' : '-'}${formatoES(Math.abs(sapsResult.diferencial))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Zona de Firmas Formales */}
        <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-3 gap-8 text-center text-[9px] keep-together">
          <div className="flex flex-col items-center">
            <div className="w-40 border-b border-slate-400 mb-2 mt-8"></div>
            <span className="font-extrabold text-slate-700 uppercase">Preparado por:</span>
            <span className="text-slate-400 text-[8px] mt-0.5">Analista de Tesorería / Contador</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-40 border-b border-slate-400 mb-2 mt-8"></div>
            <span className="font-extrabold text-slate-700 uppercase">Revisado por:</span>
            <span className="text-slate-400 text-[8px] mt-0.5">Gerente de Administración</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-40 border-b border-slate-400 mb-2 mt-8"></div>
            <span className="font-extrabold text-slate-700 uppercase">Aprobado / Auditado por:</span>
            <span className="text-slate-400 text-[8px] mt-0.5">Auditor Interno / Dirección</span>
          </div>
        </div>

        {/* Pie de Página de Control */}
        <div className="mt-8 text-center text-[8px] text-slate-400 font-medium">
          Este informe constituye una declaración formal de revalorización contable bajo estándares NIIF.
        </div>
      </div>
    );

    triggerPrintPreview(
      `Cédula de Análisis y Revalorización SAPS (${formatType === 'resumido' ? 'Resumido' : 'Detallado'})`, 
      'landscape', 
      content
    );
  };

  const handleOpenSapsConfirmModal = () => {
    if (!sapsResult || sapsResult.tipo === 'none') return;
    const banco = bancos.find(b => String(b.id) === String(sapsResult.bancoId));
    const defaultDesc = sapsResult.tipo === 'ajuste_ganancia'
      ? `Revalorización Cambiaria SAPS (FX a Favor) - ${banco?.banco || 'Banco'}`
      : `Revalorización Cambiaria SAPS (FX en Contra) - ${banco?.banco || 'Banco'}`;
    setSapsCustomConcept(defaultDesc);
    setShowSapsConfirmModal(true);
  };

  const handleAplicarSAPS = async () => {
    if(!sapsResult || sapsResult.tipo==='none') return;

    if (workingYear && sapsResult.fecha) {
      const year = sapsResult.fecha.substring(0, 4);
      if (year !== workingYear) {
        showToast(`No se pueden aplicar ajustes SAPS porque la fecha del ajuste (${year}) no coincide con el período contable seleccionado (${workingYear}).`, 'error');
        return;
      }
    }

    const banco = bancos.find(b => String(b.id) === String(sapsResult.bancoId));
    setIsApplyingSaps(true);
    try {
      // Eliminar ajuste SAPS previo de la misma fecha si existe para evitar duplicidad
      const existingSaps = movimientosBancos.find(m => 
        String(m.banco_id) === String(sapsResult.bancoId) && 
        m.fecha === sapsResult.fecha && 
        m.ref === 'AUTO-FX' && 
        m.estado !== 'anulado'
      );
      if (existingSaps) {
        await onSave('movimientosBancos', { id: existingSaps.id, _delete: true });
      }

      // Eliminar comprobante contable previo de la misma fecha con referencia AUTO-FX para evitar duplicidad
      const existingComp = (comprobantes || []).find(c => 
        c.fecha === sapsResult.fecha && 
        c.referencia === 'AUTO-FX' &&
        (c.descripcion || '').includes(banco?.banco || '')
      );
      if (existingComp) {
        await onSave('comprobantes', { id: existingComp.id, _delete: true });
      }

      const asientoDesc = sapsCustomConcept?.trim() || (sapsResult.tipo === 'ajuste_ganancia' 
        ? `Revalorización Cambiaria SAPS (FX a Favor) - ${banco?.banco || 'Banco'}` 
        : `Revalorización Cambiaria SAPS (FX en Contra) - ${banco?.banco || 'Banco'}`);

      await onSave('movimientosBancos', { 
        id: generateId(), 
        banco_id: sapsResult.bancoId, 
        fecha: sapsResult.fecha, 
        ref: "AUTO-FX", 
        descripcion: asientoDesc, 
        tipo: sapsResult.tipo, 
        monto: sapsResult.monto, 
        tasa: sapsResult.tasaCierre || 0, 
        estado: 'activo', 
        createdAt: Date.now() 
      });

      const ctaB = banco?.cuenta_contable_id || '1.1.3';
      const pG = configContable?.cuentaGananciaDiferencialCambiario || cuentasContables.find(c => (c.nombre || '').toLowerCase().includes('ganancia') && (c.nombre || '').toLowerCase().includes('cambio'))?.id || '4.1.1'; 
      const pP = configContable?.cuentaPerdidaDiferencialCambiario || cuentasContables.find(c => (c.nombre || '').toLowerCase().includes('pérdida') && (c.nombre || '').toLowerCase().includes('cambio'))?.id || '5.2.1'; 

      const descLineBanco = sapsResult.tipo === 'ajuste_ganancia'
        ? `Revalorización de saldo bancario a tasa BCV Bs. ${formatoES(sapsResult.tasaCierre)}`
        : `Ajuste por devaluación / diferencial cambiario a tasa BCV Bs. ${formatoES(sapsResult.tasaCierre)}`;

      const descLineResultado = sapsResult.tipo === 'ajuste_ganancia'
        ? `Ganancia en cambio por revalorización de tesorería (SAPS)`
        : `Pérdida en cambio por ajuste cambiario de tesorería (SAPS)`;

      let compRes: any = null;
      if (sapsResult.tipo === 'ajuste_ganancia') {
        compRes = await handleGenerarAsiento(
          sapsResult.fecha, 
          'SAPS', 
          "AUTO-FX", 
          asientoDesc, 
          [
            { cuenta_id: ctaB, descripcion: descLineBanco, debe: sapsResult.monto, haber: 0 }, 
            { cuenta_id: pG, descripcion: descLineResultado, debe: 0, haber: sapsResult.monto }
          ]
        );
      } else {
        compRes = await handleGenerarAsiento(
          sapsResult.fecha, 
          'SAPS', 
          "AUTO-FX", 
          asientoDesc, 
          [
            { cuenta_id: pP, descripcion: descLineResultado, debe: sapsResult.monto, haber: 0 }, 
            { cuenta_id: ctaB, descripcion: descLineBanco, debe: 0, haber: sapsResult.monto }
          ]
        );
      }

      setShowSapsConfirmModal(false);
      showToast(compRes?.numero ? `Asiento contable ${compRes.numero} registrado exitosamente.` : 'Ajuste contable aplicado.', 'success'); 
      setSapsResult(null); 
      setSelectedBancoId(sapsResult.bancoId); 
      setSubView('mayor_analitico');
    } catch(e) { 
      showToast('Error al aplicar SAPS.', 'error'); 
    } finally {
      setIsApplyingSaps(false);
    }
  };

  const handleEjecutarTraspaso = async () => {
    const oId = transferForm.origenId; const dId = transferForm.destinoId; const m = parseFloat(transferForm.monto.toString());
    if (!oId || !dId) return showToast('Seleccione bancos.', 'error');
    if (oId === dId) return showToast('Los bancos deben ser distintos.', 'error');
    if (m <= 0) return showToast('Monto inválido.', 'error');

    if (workingYear && fechaHoy) {
      const year = fechaHoy.substring(0, 4);
      if (year !== workingYear) {
        showToast(`No se puede realizar este traspaso porque el año de hoy (${year}) no coincide con el período contable seleccionado (${workingYear}).`, 'error');
        return;
      }
    }

    const lockDateOrigen = getSapsLockDate(oId);
    if (lockDateOrigen && fechaHoy <= lockDateOrigen) {
      return showToast(`Error: El banco origen tiene un cierre SAPS en ${lockDateOrigen}. Use una fecha posterior.`, 'error');
    }

    const lockDateDestino = getSapsLockDate(dId);
    if (lockDateDestino && fechaHoy <= lockDateDestino) {
      return showToast(`Error: El banco destino tiene un cierre SAPS en ${lockDateDestino}. Use una fecha posterior.`, 'error');
    }

    const bO = bancos.find(b => String(b.id) === String(oId));
    const bD = bancos.find(b => String(b.id) === String(dId));
    const ref = Date.now().toString().slice(-5);
    const rawConcepto = transferForm.concepto?.trim();
    const cto = rawConcepto || `Traspaso de ${bO?.banco || 'Banco Origen'} a ${bD?.banco || 'Banco Destino'}`;

    const outId = generateId();
    const inId = generateId();
    const compId = `comp-${Date.now()}`;
    const compNumero = `CMP-${Date.now().toString().slice(-6)}`;

    const ctaOrigen = bO?.cuenta_contable_id || '1.1.3';
    const ctaDestino = bD?.cuenta_contable_id || '1.1.3';

    const outMov = {
      id: outId,
      banco_id: oId,
      fecha: fechaHoy,
      ref: `OUT-${ref}`,
      descripcion: cto,
      tipo: 'egreso',
      monto: m,
      tasa: bO?.moneda === 'Bolivares' ? (parseFloat(transferForm.tasaOrigen.toString()) || 1) : 1,
      montoBs: bO?.moneda === 'Bolivares' ? (m * (parseFloat(transferForm.tasaOrigen.toString()) || 1)).toFixed(2) : null,
      estado: 'activo',
      comprobanteId: compId,
      comprobante_id: compId
    };

    const inMov = {
      id: inId,
      banco_id: dId,
      fecha: fechaHoy,
      ref: `IN-${ref}`,
      descripcion: cto,
      tipo: 'ingreso',
      monto: m,
      tasa: bD?.moneda === 'Bolivares' ? (parseFloat(transferForm.tasaDestino.toString()) || 1) : 1,
      montoBs: bD?.moneda === 'Bolivares' ? (m * (parseFloat(transferForm.tasaDestino.toString()) || 1)).toFixed(2) : null,
      estado: 'activo',
      comprobanteId: compId,
      comprobante_id: compId
    };

    const templateComp = {
      id: compId,
      fecha: fechaHoy,
      numero: compNumero,
      tipo: 'Diario',
      descripcion: cto,
      referencia: `TRF-${ref}`,
      total: m,
      estado: 'Contabilizado',
      movimientoBancoId: outId,
      lineas: [
        {
          id: `l0-${Date.now()}`,
          cuentaId: ctaDestino,
          descripcion: cto,
          debe: m,
          haber: 0
        },
        {
          id: `l1-${Date.now()}`,
          cuentaId: ctaOrigen,
          descripcion: cto,
          debe: 0,
          haber: m
        }
      ]
    };

    // 1. Cerrar modal de traspaso para abrir la previsualización del asiento
    setTransferForm(prev => ({ ...prev, showModal: false }));

    // 2. Mostrar la previsualización del asiento contable antes de registrarlo
    setPendingVoucher({
      comprobante: templateComp,
      movimiento: { outMov, inMov, bO, bD },
      onConfirm: async (finalComprobante: any) => {
        try {
          const confirmedCompId = finalComprobante.id || compId;
          const finalDesc = finalComprobante.descripcion || cto;

          // Guardar Comprobante Contable
          await onSave('comprobantes', {
            ...finalComprobante,
            id: confirmedCompId,
            movimientoBancoId: outId
          });

          // Guardar Movimientos Bancarios asegurando que el concepto bancario sea idéntico al contable
          const finalOut = {
            ...outMov,
            descripcion: finalDesc,
            comprobanteId: confirmedCompId,
            comprobante_id: confirmedCompId
          };
          const finalIn = {
            ...inMov,
            descripcion: finalDesc,
            comprobanteId: confirmedCompId,
            comprobante_id: confirmedCompId
          };

          await onSave('movimientosBancos', finalOut);
          await onSave('movimientosBancos', finalIn);

          showToast('Traspaso exitoso y contabilizado.', 'success');
          setTransferForm({ origenId: '', destinoId: '', monto: '', concepto: '', tasaOrigen: '1', tasaDestino: '1', showModal: false });
          setPendingVoucher(null);

          // Navegar al comprobante del egreso (origen)
          navigate('/reports/comprobante-movimiento-banco', { state: { movimiento: finalOut, banco: bO } });
        } catch (e) {
          showToast('Error en traspaso.', 'error');
        }
      }
    });
  };

  const exportarMayorCSV = () => {
    const banco = bancos.find(b => String(b.id) === String(selectedBancoId));
    if (!banco) return;
    const isVES = banco.moneda === 'Bolivares';
    const SEP = ";"; const escapeCSV = (s) => `"${(s||'').toString().replace(/"/g, '""')}"`;
    
    let csv = "\uFEFF"; 
    csv += `MAYOR ANALÍTICO BANCARIO - ${escapeCSV(banco.banco)}\nCuenta:${SEP}${escapeCSV(banco.cuenta)}${SEP}Moneda:${SEP}${banco.moneda}\nFiltro Activo:${SEP}${filtros.tipo === 'todo' ? 'TODO EL HISTORIAL' : 'FILTRADO'}\n\n`;

    let header = `Fecha${SEP}Referencia${SEP}Descripción${SEP}Ingreso (USD)${SEP}Egreso (USD)${SEP}Saldo Acumulado USD`;
    if (isVES) header += `${SEP}Ingreso (VES)${SEP}Egreso (VES)${SEP}Saldo Acumulado VES`;
    header += `${SEP}Estatus\n`;
    csv += header;

    if (filtros.tipo !== 'todo') {
        let row = `${SEP}${SEP}Saldo Inicial del Período${SEP}${SEP}${SEP}${formatoES(mayorData.saldoInicialUSD)}`;
        if (isVES) row += `${SEP}${SEP}${SEP}${formatoES(mayorData.saldoInicialVES)}`;
        csv += row + `${SEP}\n`;
    }

    const chronologicalMovs = [...mayorData.movs].sort(sortMovimientos);
    
    chronologicalMovs.forEach(m => { 
        const isAnulado = m.estado === 'anulado';
        const isIngreso = isBankIngreso(m.tipo);
        const mAbs = Math.abs(Number(m.monto) || 0);
        let iUSD = 0, eUSD = 0, iVES = 0, eVES = 0;
        if (!isAnulado) {
            if(isIngreso) { iUSD = mAbs; if(isVES) iVES = (m.tipo === 'ajuste_ganancia') ? 0 : mAbs * (m.tasa || 1); } 
            else { eUSD = mAbs; if(isVES) eVES = (m.tipo === 'ajuste_perdida') ? 0 : mAbs * (m.tasa || 1); }
        }
        let row = `${(m.fecha || '').split('T')[0].split('-').reverse().join('/')}${SEP}${escapeCSV(m.ref)}${SEP}${escapeCSV(m.descripcion)}${SEP}${isAnulado ? '0,00' : (iUSD > 0 ? formatoES(iUSD) : '')}${SEP}${isAnulado ? '0,00' : (eUSD > 0 ? formatoES(eUSD) : '')}${SEP}${formatoES(m.saldoCalcUSD)}`;
        if (isVES) row += `${SEP}${isAnulado ? '0,00' : (iVES > 0 ? formatoES(iVES) : '')}${SEP}${isAnulado ? '0,00' : (eVES > 0 ? formatoES(eVES) : '')}${SEP}${formatoES(m.saldoCalcVES)}`;
        csv += row + `${SEP}${m.estado.toUpperCase()}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `Mayor_Banco_${banco.banco.replace(/\s+/g,'_')}.csv`; link.click();
    showToast("Reporte exportado exitosamente a CSV.", "success");
  };

  const renderTabs = () => (
    <div className="mb-3.5 flex flex-col gap-2.5">
      {/* Top Navigation & Actions Toolbar (Unified Header) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 sm:px-4 sm:py-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          {subView !== 'cuentas' ? (
            <BackButton onClick={() => setSubView('cuentas')} label="Volver a Cuentas" />
          ) : (
            <BackButton to="/banks" label="Volver al Menú Bancos" />
          )}

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-xs">
              <Landmark className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight">
                {activeSubmodule === 'caja' ? 'Control de Caja & Efectivo' : 'Gestión de Cuentas Bancarias'}
              </h1>
            </div>
          </div>
        </div>

        {subView === 'cuentas' ? (
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <Link 
              to="/banks/pos-lotes"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all border border-slate-200 bg-white shadow-2xs hover:bg-slate-50 text-slate-700 h-8 sm:h-9 px-3 cursor-pointer active:scale-95" 
              title="Ir al módulo de Puntos de Venta (POS) & Lotes"
            >
              <CreditCard className="w-3.5 h-3.5 text-amber-600" /> 
              <span>Puntos de Venta (POS)</span>
            </Link>
            <button 
              className="inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all border border-slate-200 bg-white shadow-2xs hover:bg-slate-50 text-slate-700 h-8 sm:h-9 px-3 cursor-pointer active:scale-95" 
              onClick={() => setSubView('historial_traspasos')}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" /> 
              <span>Traspasos</span>
            </button>
            <button 
              className="inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all border border-slate-200 bg-white shadow-2xs hover:bg-slate-50 text-slate-700 h-8 sm:h-9 px-3 cursor-pointer active:scale-95" 
              onClick={() => {setSapsResult(null); setSubView('saps');}}
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-600" /> 
              <span>Ajuste SAPS (FX)</span>
            </button>
            <button 
              className="inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-600/20 h-8 sm:h-9 px-3.5 cursor-pointer active:scale-95" 
              onClick={() => {setEditBancoId(null); setCuentaForm({banco:'', cuenta:'', tipo:'Corriente', moneda:'USD', tasa:'1', saldo:'0', saldoBs:'0', cuenta_contable_id:'', es_caja: false, tipo_cuenta: 'nacional'}); setSubView('nueva_cuenta');}}
            >
              <Plus className="w-3.5 h-3.5" /> 
              <span>Añadir Cuenta</span>
            </button>
          </div>
        ) : (
          <span className="text-[11px] font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-full border border-slate-200 ml-auto">
            Tesorería & Cuentas
          </span>
        )}
      </div>

      {/* KPI Stats Strip */}
      {subView === 'cuentas' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-300">
          {/* KPI 1: Liquidez Global USD */}
          <div className="bg-white p-3 sm:px-4 sm:py-3 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between group hover:border-emerald-200 transition-all">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Liquidez Global (USD)</p>
              </div>
              <p className={`text-lg sm:text-xl font-black tracking-tight mt-0.5 truncate ${totalLiquidez < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {totalLiquidez < 0 ? '-' : ''}$ {formatoES(Math.abs(totalLiquidez))}
              </p>
              <span className="text-[10px] text-slate-400 font-medium">Consolidado en divisas</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>

          {/* KPI 2: Saldo Consolidado VES */}
          <div className="bg-white p-3 sm:px-4 sm:py-3 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between group hover:border-blue-200 transition-all">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Saldo en Bolívares (VES)</p>
              </div>
              <p className={`text-lg sm:text-xl font-black tracking-tight mt-0.5 truncate ${totalLiquidezVES < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                {totalLiquidezVES < 0 ? '-' : ''}Bs. {formatoES(Math.abs(totalLiquidezVES))}
              </p>
              <span className="text-[10px] text-slate-400 font-medium">Cuentas moneda nacional</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Coins className="w-4 h-4" />
            </div>
          </div>

          {/* KPI 3: Cuentas Registradas */}
          <div className="bg-white p-3 sm:px-4 sm:py-3 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between group hover:border-indigo-200 transition-all">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Cuentas Bancarias</p>
              </div>
              <p className="text-lg sm:text-xl font-black tracking-tight text-slate-900 mt-0.5">
                {bancosConSaldos.length} {bancosConSaldos.length === 1 ? 'Cuenta' : 'Cuentas'}
              </p>
              <span className="text-[10px] text-slate-400 font-medium">Activas y operativas</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4" />
            </div>
          </div>

          {/* KPI 4: Cuarentena / Pagos por Identificar */}
          <div 
            onClick={() => cuarentenaMovs.length > 0 && setSubView('cuarentena')}
            className={`p-3 sm:px-4 sm:py-3 rounded-2xl border shadow-xs flex items-center justify-between transition-all ${
              cuarentenaMovs.length > 0 
                ? 'bg-orange-50/60 border-orange-200 text-orange-900 cursor-pointer hover:bg-orange-100/70' 
                : 'bg-white border-slate-200/90'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${cuarentenaMovs.length > 0 ? 'bg-orange-500 animate-pulse' : 'bg-slate-300'}`} />
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Pagos en Cuarentena</p>
              </div>
              <p className={`text-lg sm:text-xl font-black tracking-tight mt-0.5 ${cuarentenaMovs.length > 0 ? 'text-orange-700' : 'text-slate-900'}`}>
                {cuarentenaMovs.length} {cuarentenaMovs.length === 1 ? 'Depósito' : 'Depósitos'}
              </p>
              <span className="text-[10px] text-slate-400 font-medium">
                {cuarentenaMovs.length > 0 ? 'Haga clic para identificar' : 'Sin pagos pendientes'}
              </span>
            </div>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              cuarentenaMovs.length > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'
            }`}>
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* Barra de Filtros y Búsqueda Estilo Foto 2 (Limpio & Profesional) */}
      {subView === 'cuentas' && (
        <div className="bg-white p-2.5 sm:px-4 sm:py-2.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-300">
          {/* Input de Búsqueda */}
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar banco, caja o cuenta..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Pastillas de Filtro */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterType('todas')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterType === 'todas'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Todas ({bancosConSaldos.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('bancos')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterType === 'bancos'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Bancos ({bancosOnlyCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('cajas')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterType === 'cajas'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Cajas ({cajasOnlyCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('USD')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterType === 'USD'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => setFilterType('VES')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                filterType === 'VES'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              VES (Bs.)
            </button>
          </div>

          {/* Conmutador de Vista: Lista vs Tarjetas */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode('lista')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'lista'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista tabular estilo administrativo"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tarjetas')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                viewMode === 'tarjetas'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista en tarjetas ejecutivas"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Tarjetas</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (subView === 'nueva_cuenta') {
    return (
      <div className="px-3 sm:px-6 pt-1 pb-6 max-w-5xl mx-auto w-full animate-in slide-in-from-bottom-4">
        {renderTabs()}
        <div className="odoo-card p-5 md:p-8">
          <div className="mb-6 pb-4 border-b border-slate-100 flex justify-between items-center"><h3 className="text-xl font-bold text-slate-800">{editBancoId ? 'Editar Cuenta' : 'Nueva Cuenta Bancaria'}</h3><button onClick={()=>setSubView('cuentas')} className="text-slate-400 hover:text-red-500 bg-slate-100 p-2 rounded-full"><X className="w-5 h-5"/></button></div>
          <div className="space-y-6">
            <div className="flex flex-col"><label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Institución Bancaria</label><input type="text" className="text-xl md:text-3xl font-black text-slate-800 border border-slate-200 bg-slate-50 hover:bg-white focus:bg-white focus:border-indigo-600 outline-none p-3 md:p-4 w-full transition-colors rounded-xl placeholder-slate-300 shadow-sm" placeholder="Ej. Banco Banesco" value={cuentaForm.banco} onChange={e=>setCuentaForm({...cuentaForm, banco: e.target.value})} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Checkbox / Tilde: ¿Es una Caja? */}
              <div className="flex items-start gap-3 p-3.5 bg-indigo-50/60 border border-indigo-200/80 rounded-2xl md:col-span-2">
                <input
                  type="checkbox"
                  id="es_caja"
                  checked={!!cuentaForm.es_caja}
                  onChange={e => {
                    const isChecked = e.target.checked;
                    setCuentaForm({
                      ...cuentaForm,
                      es_caja: isChecked,
                      tipo: isChecked ? (cuentaForm.tipo.includes('Caja') ? cuentaForm.tipo : 'Caja General') : (cuentaForm.tipo.includes('Caja') ? 'Corriente' : cuentaForm.tipo)
                    });
                  }}
                  className="w-5 h-5 rounded mt-0.5 text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="es_caja" className="cursor-pointer select-none flex-1">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <span>Esta cuenta bancaria es una CAJA (Efectivo)</span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Control de Efectivo</span>
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Marque esta casilla si la cuenta corresponde a una caja física de efectivo (USD o Bolívares). Al seleccionarla en Facturación de Ventas o Compras, únicamente se habilitará el método de pago en <b>Efectivo</b>.
                  </span>
                </label>
              </div>

              <div className="flex flex-col"><label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">N° de Cuenta</label><input type="text" className="input-modern font-mono" placeholder="0134-xxxx..." value={cuentaForm.cuenta} onChange={e=>setCuentaForm({...cuentaForm, cuenta: e.target.value})} /></div>
              <div className="flex flex-col"><label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tipo</label><select className="input-modern" value={cuentaForm.tipo} onChange={e=>{
                const newTipo = e.target.value;
                setCuentaForm({
                  ...cuentaForm, 
                  tipo: newTipo,
                  es_caja: newTipo.includes('Caja') ? true : cuentaForm.es_caja
                });
              }}><option>Corriente</option><option>Ahorro</option><option>Custodia</option><option>Caja Chica</option><option>Caja General</option></select></div>
              <div className="flex flex-col">
                <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Moneda</label>
                <select 
                  className="input-modern" 
                  value={cuentaForm.moneda} 
                  onChange={e => {
                    const nextMoneda = e.target.value;
                    setCuentaForm({
                      ...cuentaForm,
                      moneda: nextMoneda,
                      tasa: nextMoneda === 'Bolivares' ? '36.00' : '1',
                      saldo: '0',
                      saldoBs: '0',
                      tipo_cuenta: nextMoneda === 'Bolivares' ? 'nacional' : cuentaForm.tipo_cuenta
                    });
                  }} 
                  disabled={!!editBancoId}
                >
                  <option value="USD">Dólares (USD)</option>
                  <option value="Bolivares">Bolívares (VES)</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Ámbito de la Cuenta
                </label>
                <select
                  className="input-modern font-semibold"
                  value={cuentaForm.tipo_cuenta}
                  onChange={e => setCuentaForm({ ...cuentaForm, tipo_cuenta: e.target.value as any })}
                >
                  <option value="nacional">Cuenta Nacional (Maneja Tasa BCV)</option>
                  <option value="internacional">Cuenta Internacional USD (Sin Tasa de Cambio)</option>
                </select>
              </div>

              {cuentaForm.moneda === 'Bolivares' && (
                <div className="flex flex-col animate-in zoom-in-95">
                  <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Tasa Cambio Inicial
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    className="input-modern" 
                    value={cuentaForm.tasa} 
                    onChange={e => {
                      const rateVal = e.target.value;
                      const bsVal = parseFloat(cuentaForm.saldoBs) || 0;
                      const rate = parseFloat(rateVal) || 1;
                      const usdVal = rate > 0 ? (bsVal / rate).toFixed(2) : '0';
                      setCuentaForm({
                        ...cuentaForm,
                        tasa: rateVal,
                        saldo: usdVal
                      });
                    }} 
                  />
                </div>
              )}

              {!editBancoId && (
                cuentaForm.moneda === 'Bolivares' ? (
                  <>
                    <div className="flex flex-col animate-in zoom-in-95">
                      <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Saldo Inicial (Bs)
                      </label>
                      <input 
                        type="number" 
                        step="0.01" 
                        className="input-modern font-black text-amber-700 bg-amber-50/50 border-amber-200" 
                        value={cuentaForm.saldoBs} 
                        onChange={e => {
                          const bsVal = e.target.value;
                          const rate = parseFloat(cuentaForm.tasa) || 1;
                          const usdVal = rate > 0 ? (parseFloat(bsVal) / rate).toFixed(2) : '0';
                          setCuentaForm({
                            ...cuentaForm,
                            saldoBs: bsVal,
                            saldo: usdVal
                          });
                        }} 
                      />
                    </div>
                    <div className="flex flex-col animate-in zoom-in-95">
                      <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Saldo Equivalente (USD)
                      </label>
                      <div className="input-modern bg-slate-50 border-slate-200 font-mono font-black text-emerald-700 flex items-center justify-between">
                        <span>$ {formatoES(parseFloat(cuentaForm.saldo) || 0)}</span>
                        <span className="text-slate-400 text-[10px] uppercase font-black tracking-wider">Cálculo Automático</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col">
                    <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      Saldo Inicial (USD)
                    </label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="input-modern font-black text-indigo-700 bg-indigo-50/50 border-indigo-200" 
                      value={cuentaForm.saldo} 
                      onChange={e => setCuentaForm({ ...cuentaForm, saldo: e.target.value })} 
                    />
                  </div>
                )
              )}
            </div>
            <div className="pt-6 border-t border-slate-100">
              <label className="text-[10px] md:text-xs font-bold text-cyan-700 uppercase tracking-wider mb-2 flex items-center gap-1"><BookOpen className="w-4 h-4"/> Integración NIIF (Cuenta Destino)</label>
              <div 
                onClick={() => setShowCuentaModal(true)}
                className="w-full p-4 border-2 border-slate-200 bg-slate-50 hover:bg-white hover:border-cyan-300 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
              >
                {cuentaForm.cuenta_contable_id ? (() => {
                  const c = cuentasContables.find(x => String(x.id) === String(cuentaForm.cuenta_contable_id));
                  return c ? (
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs font-bold text-cyan-800">{c.codigo}</span>
                      <span className="text-sm font-bold text-cyan-900">{c.nombre}</span>
                    </div>
                  ) : <span className="text-sm font-medium text-slate-500">Seleccione cuenta contable...</span>;
                })() : (
                  <span className="text-sm font-medium text-slate-500">Seleccione cuenta contable...</span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-end gap-3"><button className="btn-secondary w-full md:w-auto" onClick={()=>setSubView('cuentas')}>Cancelar</button><button className="btn-primary w-full md:w-auto" onClick={handleGuardarCuenta}><Save className="w-4 h-4"/> Guardar Cuenta</button></div>
        </div>

        {/* Modal para Seleccionar Cuenta NIIF */}
        <CuentaContableModal
          isOpen={showCuentaModal}
          onClose={() => setShowCuentaModal(false)}
          onSelect={(c) => {
            setCuentaForm({ ...cuentaForm, cuenta_contable_id: String(c.id) });
            setShowCuentaModal(false);
          }}
          cuentasContables={cuentasContables}
          selectedCuentaId={cuentaForm.cuenta_contable_id}
          title="Seleccionar Contrapartida NIIF"
          subtitle="Busque y seleccione la cuenta contable de destino para este banco"
        />
      </div>
    );
  }

  if (subView === 'form_movimiento') {
    const b = bancosConSaldos.find(x => String(x.id) === String(selectedBancoId));
    const isVES = b?.moneda === 'Bolivares';
    const isIngreso = movForm.tipo === 'ingreso';
    
    // Filter and search for Contrapartida NIIF
    const filteredCuentas = cuentasContables.filter(c => 
      c.tipo === 'Movimiento' && 
      ((c.codigo || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
       (c.nombre || '').toLowerCase().includes((searchTerm || '').toLowerCase()))
    ).sort((a,b) => (a.codigo||'').localeCompare(b.codigo||''));

    return (
      <div className="px-3 sm:px-6 pt-1 pb-6 max-w-5xl mx-auto w-full animate-in slide-in-from-bottom-4">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <BackButton onClick={() => { resetMovForm(); setSubView('mayor_analitico'); }} label="Volver al Mayor" />
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800 bg-white border border-slate-200 shadow-xs px-3 py-1 rounded-lg">
                {b?.banco} - {b?.moneda}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border shadow-xs ${
                isIngreso 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isIngreso ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`} />
                {isIngreso ? '🟢 Entrada de Dinero (Ingreso +)' : '🔴 Salida de Dinero (Egreso -)'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Visual Operation Type Banner */}
          <div className={`p-4 sm:p-6 border-b transition-colors ${
            isIngreso 
              ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-100' 
              : 'bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border-rose-100'
          }`}>
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 block mb-3">
              1. Seleccione el Tipo de Operación:
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Card INGRESO (+) */}
              <div 
                onClick={() => {
                  if (!(editMovId && oldMov?.isCuarentena)) {
                    setMovForm({...movForm, tipo: 'ingreso'});
                  }
                }}
                className={`relative p-4 sm:p-5 rounded-2xl cursor-pointer transition-all duration-200 flex items-start gap-4 ${
                  isIngreso 
                    ? 'bg-white border-2 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-4 ring-emerald-500/15' 
                    : 'bg-slate-50 border-2 border-slate-200 hover:bg-white hover:border-slate-300 opacity-60 hover:opacity-100'
                } ${editMovId && oldMov?.isCuarentena ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isIngreso 
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' 
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  <ArrowDownLeft className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-base font-black ${isIngreso ? 'text-emerald-900' : 'text-slate-700'}`}>
                      INGRESO / ENTRADA (+)
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isIngreso ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      + Suma al Banco
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                    Cobro de clientes, aportes de socios, anticipos o depósitos recibidos.
                  </p>
                </div>
                {isIngreso && (
                  <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-emerald-500" />
                )}
              </div>

              {/* Card EGRESO (-) */}
              <div 
                onClick={() => {
                  if (!(editMovId && oldMov?.isCuarentena)) {
                    setMovForm({...movForm, tipo: 'egreso', isCuarentena: false});
                  }
                }}
                className={`relative p-4 sm:p-5 rounded-2xl cursor-pointer transition-all duration-200 flex items-start gap-4 ${
                  !isIngreso 
                    ? 'bg-white border-2 border-rose-500 shadow-lg shadow-rose-500/10 ring-4 ring-rose-500/15' 
                    : 'bg-slate-50 border-2 border-slate-200 hover:bg-white hover:border-slate-300 opacity-60 hover:opacity-100'
                } ${editMovId && oldMov?.isCuarentena ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  !isIngreso 
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30' 
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-base font-black ${!isIngreso ? 'text-rose-900' : 'text-slate-700'}`}>
                      EGRESO / SALIDA (-)
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      !isIngreso ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      - Resta del Banco
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                    Pagos a proveedores, gastos operativos, comisiones, compras o débitos.
                  </p>
                </div>
                {!isIngreso && (
                  <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-rose-500" />
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row">
            {/* Columna Izquierda: Detalles del Movimiento */}
            <div className="flex-1 p-6 md:p-8 lg:border-r border-slate-100">
              <div className="space-y-6">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Concepto / Descripción del Movimiento
                  </label>
                  <input 
                    type="text" 
                    className="text-base md:text-lg font-bold text-slate-800 border-2 border-slate-200 bg-slate-50 hover:bg-white focus:bg-white focus:border-indigo-500 outline-none p-3.5 rounded-xl w-full transition-all shadow-xs" 
                    placeholder={isIngreso ? "Ej. Cobro Factura F-1020, Depósito de Cliente..." : "Ej. Pago a Proveedor, Compra de Materiales, Transferencia..."} 
                    value={movForm.desc} 
                    onChange={e=>setMovForm({...movForm, desc:e.target.value})} 
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Operación</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-slate-700" 
                      value={movForm.fecha} 
                      onChange={e=>setMovForm({...movForm, fecha:e.target.value})} 
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Referencia Bancaria</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-mono font-bold text-slate-700" 
                      placeholder="Ej. TRF-123456 / REF-987"
                      value={movForm.ref} 
                      onChange={e=>setMovForm({...movForm, ref:e.target.value})} 
                    />
                  </div>
                </div>
                
                {/* CHECKBOX CUARENTENA (Solo para ingresos) */}
                {isIngreso && (
                   <div className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${movForm.isCuarentena ? 'bg-orange-50 border-orange-300 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-orange-200'}`} onClick={() => !editMovId && setMovForm({...movForm, isCuarentena: !movForm.isCuarentena})}>
                      <input 
                        type="checkbox" 
                        id="isCuarentena" 
                        className="w-5 h-5 accent-orange-600 rounded cursor-pointer" 
                        checked={movForm.isCuarentena} 
                        onChange={e => setMovForm({...movForm, isCuarentena: e.target.checked})} 
                        disabled={editMovId && oldMov?.isCuarentena}
                        onClick={e => e.stopPropagation()}
                      />
                      <div className="flex flex-col">
                        <label htmlFor="isCuarentena" className={`text-sm font-bold cursor-pointer select-none ${movForm.isCuarentena ? 'text-orange-900' : 'text-slate-700'}`}>Enviar a Pagos en Cuarentena</label>
                        <span className="text-xs text-slate-500 mt-0.5">Marcar si el origen del depósito es desconocido para conciliarlo después.</span>
                      </div>
                   </div>
                )}

                {/* SOPORTE DE IMAGEN ADJUNTA */}
                <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Soporte / Comprobante Digital</span>
                    <span className="text-[10px] text-indigo-500 font-semibold normal-case">Permite CTRL+V para pegar</span>
                  </label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    id="soporteFileInput" 
                    onChange={(e) => e.target.files && handleAttachFiles(e.target.files)} 
                  />
                  
                  {!movForm.soporteImagen ? (
                    <div 
                      className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-250 ${
                        isDragging 
                          ? 'border-indigo-500 bg-indigo-50/50 shadow-inner scale-[0.99]' 
                          : 'border-slate-200 bg-slate-50/50 hover:border-indigo-300 hover:bg-slate-50 hover:shadow-xs'
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) handleAttachFiles(e.dataTransfer.files); }}
                      onClick={() => {
                        const el = document.getElementById('soporteFileInput');
                        if (el) el.click();
                      }}
                    >
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center mb-2">
                        <CloudUpload className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">Arrastra o selecciona el comprobante</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-[280px]">Haz clic para subir un archivo o presiona <kbd className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[10px] font-bold">Ctrl + V</kbd> para pegar captura.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-xs relative group">
                      <div className="p-3 bg-slate-100/85 flex items-center justify-between border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <Image className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-bold text-slate-700 line-clamp-1">Soporte_Adjunto.png</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={() => setLightboxImage(movForm.soporteImagen)}
                            className="p-1 px-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded transition-colors text-xs font-semibold flex items-center gap-1 shadow-xs border border-slate-100 bg-white cursor-pointer"
                            title="Ver en pantalla completa"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ampliar
                          </button>
                          <button 
                            type="button"
                            onClick={() => setMovForm({ ...movForm, soporteImagen: '' })}
                            className="p-1 px-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded transition-colors text-xs font-semibold flex items-center gap-1 shadow-xs border border-slate-100 bg-white cursor-pointer"
                            title="Quitar soporte"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Quitar
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-4 flex justify-center bg-slate-900/5 relative group-hover:bg-slate-900/10 cursor-pointer" onClick={() => setLightboxImage(movForm.soporteImagen)}>
                        <img 
                          src={movForm.soporteImagen} 
                          alt="Vista previa del soporte" 
                          className="h-44 max-w-full object-contain rounded-lg shadow-xs"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/60 to-transparent p-3 text-center opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center">
                          <span className="text-white text-xs font-bold inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5"/> Clic para Previsualizar</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Columna Derecha: Montos y Contabilidad */}
            <div className="w-full lg:w-[400px] bg-slate-50/50 p-6 md:p-8 flex flex-col gap-6">
              {/* Sección de Monto Dinámica */}
              <div className={`p-6 rounded-2xl shadow-xs border transition-all relative overflow-hidden ${
                isIngreso 
                  ? 'bg-emerald-50/40 border-emerald-200' 
                  : 'bg-rose-50/40 border-rose-200'
              }`}>
                <label className={`text-xs font-black uppercase tracking-widest mb-3 block relative z-10 ${
                  isIngreso ? 'text-emerald-800' : 'text-rose-800'
                }`}>
                  {isIngreso ? '+ Monto de Ingreso (USD)' : '- Monto de Egreso (USD)'}
                </label>
                <div className="relative z-10">
                  <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-black ${
                    isIngreso ? 'text-emerald-500' : 'text-rose-500'
                  }`}>
                    {isIngreso ? '+$' : '-$'}
                  </span>
                  <input 
                    type="number" 
                    step="0.01" 
                    className={`w-full text-4xl font-black bg-white outline-none border-2 transition-all rounded-xl py-4 pl-14 pr-4 shadow-inner ${
                      isIngreso 
                        ? 'text-emerald-700 border-emerald-200 focus:border-emerald-500' 
                        : 'text-rose-700 border-rose-200 focus:border-rose-500'
                    }`}
                    placeholder="0.00" 
                    value={movForm.monto} 
                    onChange={e => {
                      const usdVal = e.target.value;
                      const tasaVal = parseFloat(movForm.tasa.toString()) || 1;
                      const bsVal = usdVal ? (parseFloat(usdVal) * tasaVal).toFixed(2) : '';
                      setMovForm({
                        ...movForm,
                        monto: usdVal,
                        montoBs: bsVal
                      });
                    }} 
                    disabled={editMovId && oldMov?.isCuarentena} 
                  />
                </div>

                {isVES && (
                  <div className="mt-5 pt-5 border-t border-slate-200/60 relative z-10 animate-in fade-in">
                     <div className="flex flex-col gap-2 mb-3">
                       <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tasa de Cambio (VES/USD)</label>
                       <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Bs.</span>
                         <input 
                           type="number" 
                           step="0.01" 
                           className="w-full pl-10 pr-3 py-2 bg-white border-2 border-slate-200 rounded-lg text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all font-bold text-slate-700" 
                           value={movForm.tasa} 
                           onChange={e => {
                             const tasaVal = e.target.value;
                             const tasaNum = parseFloat(tasaVal) || 1;
                             const bsVal = parseFloat(movForm.montoBs || '0');
                             const usdVal = parseFloat(movForm.monto || '0');
                             if (bsVal > 0) {
                               const calculatedUsd = (bsVal / tasaNum).toFixed(2);
                               setMovForm({
                                 ...movForm,
                                 tasa: tasaVal,
                                 monto: calculatedUsd
                               });
                             } else {
                               const calculatedBs = usdVal > 0 ? (usdVal * tasaNum).toFixed(2) : '';
                               setMovForm({
                                 ...movForm,
                                 tasa: tasaVal,
                                 montoBs: calculatedBs
                               });
                             }
                           }} 
                           disabled={editMovId && oldMov?.isCuarentena} 
                         />
                       </div>
                     </div>
                     <div className={`p-3 rounded-xl border flex flex-col items-center justify-center ${
                       isIngreso ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'
                     }`}>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Monto en Bolívares (VES)</span>
                        <div className="relative w-full max-w-[240px]">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Bs.</span>
                          <input 
                            type="number" 
                            step="0.01" 
                            className="w-full pl-10 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-lg text-center font-black text-slate-800 focus:border-indigo-500 outline-none transition-all" 
                            placeholder="0.00"
                            value={movForm.montoBs} 
                            onChange={e => {
                              const bsVal = e.target.value;
                              const tasaNum = parseFloat(movForm.tasa.toString()) || 1;
                              const usdVal = bsVal ? (parseFloat(bsVal) / tasaNum).toFixed(2) : '';
                              setMovForm({
                                ...movForm,
                                montoBs: bsVal,
                                monto: usdVal
                              });
                            }}
                            disabled={editMovId && oldMov?.isCuarentena} 
                          />
                        </div>
                     </div>
                  </div>
                )}
              </div>
              
              {/* Sección de Contabilidad */}
              {!movForm.isCuarentena ? (
                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 animate-in fade-in flex-1 flex flex-col">
                   <label className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                     <BookOpen className="w-4 h-4 text-indigo-600"/> Contrapartida NIIF
                   </label>
                   
                   <div className="flex flex-col gap-3 flex-1">
                     <div 
                       onClick={() => setShowCuentaModal(true)}
                       className={`w-full p-3.5 border-2 rounded-xl cursor-pointer transition-all flex items-center justify-between ${movForm.cuentaContrapartida ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-white'}`}
                     >
                       {movForm.cuentaContrapartida ? (
                         <div className="flex flex-col gap-1">
                           <span className="font-mono text-xs font-bold text-indigo-700">
                             {cuentasContables.find(c => c.id === movForm.cuentaContrapartida)?.codigo}
                           </span>
                           <span className="text-sm font-bold text-slate-800">
                             {cuentasContables.find(c => c.id === movForm.cuentaContrapartida)?.nombre}
                           </span>
                         </div>
                       ) : (
                         <span className="text-sm font-medium text-slate-500">Seleccionar cuenta contable...</span>
                       )}
                       <Search className="w-4 h-4 text-slate-400" />
                     </div>
                   </div>
                </div>
              ) : (
                <div className="bg-orange-50 p-5 rounded-2xl border border-orange-200 animate-in fade-in flex-1 flex flex-col items-center justify-center text-center">
                   <div className="w-12 h-12 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-3">
                     <ShieldAlert className="w-6 h-6"/>
                   </div>
                   <h4 className="text-base font-black text-orange-900 mb-1">Pagos por Identificar</h4>
                   <p className="text-xs text-orange-800 font-medium leading-relaxed">
                     El asiento cruzará automáticamente contra la cuenta de pasivo temporal "Pagos por Identificar" hasta que sea asignado a un cliente.
                   </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Footer Actions */}
          <div className="bg-slate-50 p-5 md:p-6 border-t border-slate-200 flex flex-col-reverse md:flex-row justify-end gap-3">
            <button 
              className="btn-secondary text-sm px-6 py-2.5 cursor-pointer" 
              onClick={() => { resetMovForm(); setSubView('mayor_analitico'); }}
            >
              Descartar
            </button>
            <button 
              className={`text-sm px-6 py-2.5 rounded-xl font-black text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isIngreso 
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25 active:scale-95' 
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25 active:scale-95'
              }`}
              onClick={handleGuardarMovimiento}
            >
              {isIngreso ? <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" /> : <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />}
              {editMovId 
                ? 'Actualizar Cambios' 
                : isIngreso 
                  ? '+ Contabilizar Ingreso (Entrada)' 
                  : '- Contabilizar Egreso (Salida)'}
            </button>
          </div>
        </div>

        {/* Modal para Seleccionar Cuenta NIIF */}
        <CuentaContableModal
          isOpen={showCuentaModal}
          onClose={() => setShowCuentaModal(false)}
          onSelect={(c) => {
            setMovForm({ ...movForm, cuentaContrapartida: c.id });
            setShowCuentaModal(false);
          }}
          cuentasContables={cuentasContables}
          selectedCuentaId={movForm.cuentaContrapartida}
          title="Seleccionar Contrapartida NIIF"
          subtitle="Busque y seleccione la cuenta contable de destino para este movimiento"
        />
        {renderLightbox()}

        {/* Accounting Voucher Preview Modal before registering */}
        {pendingVoucher && (
          <VoucherPreviewModal
            isOpen={!!pendingVoucher}
            onClose={() => setPendingVoucher(null)}
            initialComprobante={pendingVoucher.comprobante}
            cuentasContables={cuentasContables}
            onConfirm={pendingVoucher.onConfirm}
            showToast={showToast}
          />
        )}
      </div>
    );
  }

  if (subView === 'cuarentena') {
    const cuarentenaMovs = movimientosBancos.filter(m => m.isCuarentena && m.cuarentenaStatus === 'pendiente').sort(sortMovimientosDesc);
    
    const clientesFiltrados = clientes.filter(c => {
      const nombre = c.name || c.nombre || '';
      const identificacion = c.taxId || c.identificacion || '';
      return (nombre || '').toLowerCase().includes((clienteSearchTerm || '').toLowerCase()) || 
             (identificacion || '').toLowerCase().includes((clienteSearchTerm || '').toLowerCase());
    });

    return (
      <div className="p-4 md:p-8 animate-in slide-in-from-right-4 duration-300 w-full max-w-7xl mx-auto">
         {asignarModal.open && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
               <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-5"><h3 className="text-xl font-bold text-slate-800">Asignar a Cliente</h3><button className="text-slate-400 hover:bg-slate-100 rounded-full p-2" onClick={() => setAsignarModal({open: false, mov: null, clienteId: ''})}><X className="w-5 h-5"/></button></div>
                  <div className="mb-6 p-4 bg-orange-50 rounded-xl border border-orange-100 text-sm"><p className="flex justify-between text-orange-900 mb-1"><span className="font-medium">Monto Recibido:</span><span className="font-black text-lg">${formatoES(asignarModal.mov.monto)}</span></p><p className="flex justify-between text-orange-800 opacity-80 font-mono text-xs"><span className="font-medium font-sans">Referencia:</span>{asignarModal.mov.ref}</p></div>
                  
                  <div className="flex flex-col mb-8">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cruzar con Cliente</label>
                    <div 
                      className="input-modern shadow-sm flex items-center justify-between cursor-pointer"
                      onClick={() => setShowClienteModal(true)}
                    >
                      <span className={asignarModal.clienteId ? "text-slate-800 font-medium" : "text-slate-400"}>
                        {asignarModal.clienteId 
                          ? (clientes.find(c => String(c.id) === String(asignarModal.clienteId))?.name || clientes.find(c => String(c.id) === String(asignarModal.clienteId))?.nombre || 'Cliente seleccionado')
                          : 'Seleccione cliente para cruce...'}
                      </span>
                      <Search className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>

                  <div className="flex flex-col-reverse md:flex-row justify-end gap-3"><button className="btn-secondary" onClick={() => setAsignarModal({open: false, mov: null, clienteId: ''})}>Cancelar</button><button className="btn-primary !bg-orange-600 hover:!bg-orange-700" onClick={handleAsignarCuarentena}><UserCheck className="w-4 h-4"/> Confirmar Asignación</button></div>
               </div>
            </div>
         )}

         {/* Modal de Búsqueda de Cliente */}
         {showClienteModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Seleccionar Cliente</h3>
                    <p className="text-xs font-medium text-slate-500">Busque y seleccione el cliente para cruzar el pago</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowClienteModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-5 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o identificación..."
                    value={clienteSearchTerm}
                    onChange={(e) => setClienteSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-slate-700"
                    autoFocus
                  />
                </div>
              </div>

              <div className="overflow-y-auto max-h-[400px] p-2">
                {clientesFiltrados.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1">
                    {clientesFiltrados.map((cliente) => {
                      const nombre = cliente.name || cliente.nombre || 'Sin nombre';
                      const identificacion = cliente.taxId || cliente.identificacion || '';
                      return (
                      <button
                        key={cliente.id}
                        onClick={() => {
                          setAsignarModal({ ...asignarModal, clienteId: cliente.id });
                          setShowClienteModal(false);
                          setClienteSearchTerm('');
                        }}
                        className={`flex items-center justify-between p-4 rounded-xl transition-all text-left ${
                          String(asignarModal.clienteId) === String(cliente.id)
                            ? 'bg-orange-50 border border-orange-200'
                            : 'hover:bg-slate-50 border border-transparent'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-slate-800">{nombre}</p>
                          {identificacion && (
                            <p className="text-xs text-slate-500 font-mono mt-0.5">{identificacion}</p>
                          )}
                        </div>
                        {String(asignarModal.clienteId) === String(cliente.id) && (
                          <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    )})}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                      <Search className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">No se encontraron clientes</p>
                    <p className="text-sm text-slate-400 mt-1">Intente con otros términos de búsqueda</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

         <div className="mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
           <BackButton onClick={() => setSubView('mayor_analitico')} label="Volver al Mayor" />
           <div className="flex items-center gap-3"><div className="bg-orange-100 text-orange-600 p-2.5 rounded-2xl"><ShieldAlert className="w-6 h-6" /></div><div><h3 className="text-2xl font-black text-slate-800">Pagos en Cuarentena</h3><p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Depósitos Pendientes por Identificar</p></div></div></div>
         <div className="odoo-card overflow-hidden shadow-md">
            <div className="table-container">
               <table className="table-odoo min-w-[950px]">
                  <thead><tr><th className="pl-6 w-24">Fecha</th><th className="w-32">Banco Emisor</th><th className="w-32">Ref</th><th>Descripción</th><th className="text-right w-32">Monto USD</th><th className="text-center w-36 pr-4">Acción</th></tr></thead>
                  <tbody>
                     {cuarentenaMovs.map(m => {
                        const bName = bancos.find(x => String(x.id) === String(m.banco_id))?.banco || "Desconocido";
                        return (
                           <tr key={m.id} className="hover:bg-orange-50/50 text-sm transition-colors">
                              <td className="pl-6 text-slate-500 font-medium">{(m.fecha || '').split('T')[0].split('-').reverse().join('/')}</td><td className="font-bold text-slate-700">{bName}</td><td className="font-mono font-bold text-indigo-600">{m.ref}</td><td className="text-slate-700">{m.descripcion}</td><td className="text-right font-black text-orange-700 bg-orange-50/30">${formatoES(m.monto)}</td>
                              <td className="text-center pr-4"><button onClick={() => setAsignarModal({ open: true, mov: m, clienteId: '' })} className="inline-flex items-center gap-1.5 bg-orange-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-orange-700 shadow-md transition-all active:scale-95"><UserCheck className="w-3.5 h-3.5"/> Cobrar</button></td>
                           </tr>
                        )
                     })}
                     {cuarentenaMovs.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-slate-400 bg-slate-50/50">No hay pagos en cuarentena pendientes.</td></tr>}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    );
  }

  if (subView === 'print_mayor') {
    const b = bancosConSaldos.find(x => String(x.id) === String(selectedBancoId));
    const isVES = b?.moneda === 'Bolivares';
    const movsToPrint = mayorData.movs; 
    return (
      <div className="absolute inset-0 bg-white z-[200] overflow-y-auto p-4 md:p-8 animate-in fade-in">
        <style>{`@media print { body * { visibility: hidden; } #print-section, #print-section * { visibility: visible; } #print-section { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; } .no-print { display: none !important; } @page { size: portrait; margin: 10mm; } }`}</style>
        <div className="mb-4 flex justify-between items-center no-print bg-slate-50 p-3 rounded-xl border border-slate-200 max-w-[21cm] mx-auto shadow-xs">
          <BackButton onClick={() => setSubView('mayor_analitico')} label="Volver al Mayor" />
          <button onClick={() => window.print()} className="btn-primary !bg-slate-800 hover:!bg-slate-900"><Printer className="w-4 h-4"/> Confirmar Impresión</button>
        </div>
        <div id="print-section" className="w-full max-w-[21cm] mx-auto bg-white text-slate-900">
          <div className="text-center mb-6 border-b-2 border-slate-800 pb-4"><h2 className="text-xl md:text-2xl font-black uppercase tracking-widest">{b?.banco}</h2><p className="text-sm font-bold text-slate-700 mt-1">CUENTA: {b?.cuenta} | MONEDA: {b?.moneda}</p><p className="text-[10px] md:text-xs text-slate-500 mt-1 uppercase">REPORTE DE MAYOR ANALÍTICO - {filtros.tipo === 'todo' ? 'TODO EL HISTORIAL' : 'PERÍODO FILTRADO'}</p></div>
          <table className="w-full text-left border-collapse text-[10px] md:text-[11px]">
            <thead><tr className="border-b-2 border-slate-400 bg-slate-50"><th className="py-2 pl-4 pr-2 w-20 md:w-24">Fecha</th><th className="px-2 w-24 md:w-32">Ref</th><th className="pr-12 w-auto">Descripción</th><th className="text-right w-24 md:w-28 pr-4">Ingreso</th><th className="text-right w-24 md:w-28 pr-4">Egreso</th><th className="text-right w-24 md:w-32 pr-4">Saldo USD</th>{isVES && <th className="text-right w-28 md:w-36 pr-4">Saldo VES</th>}</tr></thead>
            <tbody>
              {filtros.tipo !== 'todo' && (<tr className="border-b border-slate-200 font-bold bg-slate-100/50"><td className="py-2 pl-4 pr-2" colSpan={3}>Saldo Arrastrado al Período</td><td className="text-right pr-4">-</td><td className="text-right pr-4">-</td><td className="text-right pr-4">${formatoES(mayorData.saldoInicialUSD)}</td>{isVES && <td className="text-right pr-4">Bs.{formatoES(mayorData.saldoInicialVES)}</td>}</tr>)}
              {movsToPrint.map(m => {
                const isAnulado = m.estado === 'anulado';
                const isIngreso = isBankIngreso(m.tipo);
                const mAbs = Math.abs(Number(m.monto) || 0);
                return (
                  <tr key={m.id} className={`border-b border-slate-100 ${isAnulado ? 'opacity-60 line-through text-slate-500' : 'text-slate-800'}`}>
                    <td className="py-2.5 pl-4 pr-2 font-medium whitespace-nowrap">{(m.fecha || '').split('T')[0].split('-').reverse().join('/')}</td><td className="px-2 font-mono whitespace-nowrap">{m.ref}</td><td className="pr-12 py-2.5 leading-relaxed w-full">{m.descripcion} {isAnulado && <span className="ml-1 text-[8px] font-bold text-red-600 uppercase no-underline line-through-none inline-block">(ANULADO)</span>}</td><td className="text-right font-medium text-emerald-700 pr-4 whitespace-nowrap">{!isAnulado && isIngreso ? formatoES(mAbs) : '-'}</td><td className="text-right font-medium text-rose-700 pr-4 whitespace-nowrap">{!isAnulado && !isIngreso ? formatoES(mAbs) : '-'}</td><td className={`text-right font-bold pr-4 whitespace-nowrap ${m.saldoCalcUSD < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{m.saldoCalcUSD < 0 ? '-' : ''}${formatoES(Math.abs(m.saldoCalcUSD))}</td>{isVES && <td className={`text-right font-medium pr-4 whitespace-nowrap ${m.saldoCalcVES < 0 ? 'text-rose-500' : 'text-slate-500'}`}>{m.saldoCalcVES < 0 ? '-' : ''}Bs.{formatoES(Math.abs(m.saldoCalcVES))}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="mt-6 flex justify-end items-center border-t-2 border-slate-800 pt-4"><div className="text-right"><p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Saldo Final Contable USD</p><p className={`text-xl md:text-2xl font-black leading-none ${mayorData.saldoFinalUSD < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{mayorData.saldoFinalUSD < 0 ? '-' : ''}${formatoES(Math.abs(mayorData.saldoFinalUSD))}</p></div></div>
        </div>
      </div>
    );
  }

  if (subView === 'mayor_analitico') {
    const b = bancosConSaldos.find(x => String(x.id) === String(selectedBancoId));
    const isVES = b?.moneda === 'Bolivares';

    const handleCopyCuenta = (cta: string) => {
      if (!cta) return;
      navigator.clipboard.writeText(cta);
      setCopiedCta(true);
      showToast('Número de cuenta copiado al portapapeles', 'info');
      setTimeout(() => setCopiedCta(false), 2000);
    };

    return (
      <div className="px-3 sm:px-6 pt-1 pb-6 animate-in slide-in-from-right-4 duration-300 w-full max-w-7xl mx-auto relative font-sans">
        
        {/* MODAL DE DETALLE DE RECIBO (ABIERTO DESDE EL MAYOR) */}
        {reciboVisualizado && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={()=>setReciboVisualizado(null)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95" onClick={e=>e.stopPropagation()}>
              <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                <div>
                   <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3"><Receipt className="w-6 h-6 text-indigo-600" /> {reciboVisualizado.correlativo} {reciboVisualizado.estado==='anulado' && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded uppercase font-bold tracking-widest">Anulado</span>}</h3>
                   <p className="text-sm text-slate-500 font-bold mt-1">Cliente: {reciboVisualizado.cliente_nombre}</p>
                </div>
                <button className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full" onClick={()=>setReciboVisualizado(null)}><X className="w-5 h-5" /></button>
              </div>
              <div className={`p-6 border-b flex justify-between items-center ${reciboVisualizado.estado==='anulado' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                 <h4 className={`font-bold flex items-center gap-2 ${reciboVisualizado.estado==='anulado' ? 'text-red-800' : 'text-emerald-800'}`}><CheckCircle className="w-5 h-5" /> Distribución del Pago</h4>
                 <div className="bg-white px-5 py-2 rounded-xl shadow-sm border"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Total de la Operación</p><p className={`text-2xl font-black ${reciboVisualizado.estado==='anulado'?'text-red-600 line-through':'text-emerald-700'}`}>$ {formatoES(reciboVisualizado.monto_total)}</p></div>
              </div>
              <div className="max-h-[40vh] overflow-y-auto">
                 <table className="w-full text-left table-odoo"><thead className="bg-slate-50 sticky top-0 shadow-sm"><tr><th className="pl-6">Documento Afectado</th><th className="text-right">Tipo de Operación</th><th className="text-right pr-8">Monto Aplicado</th></tr></thead><tbody>
                  {reciboVisualizado.facturas?.map(f => (<tr key={f.guia} className="border-b border-slate-50"><td className="pl-6 py-4 font-mono font-bold text-indigo-600">{f.guia}</td><td className="text-right py-4 text-xs font-bold text-slate-400 uppercase">{f.tipo === 'cruce' ? 'Uso de Anticipo' : 'Abono a Factura'}</td><td className="text-right pr-8 py-4 font-black text-slate-700 bg-slate-50/50">${formatoES(f.abono)}</td></tr>))}
                 </tbody></table>
              </div>
            </div>
          </div>
        )}

        {/* Barra Superior Compacta: Identidad Bancaria, Saldo & Nuevo Movimiento */}
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 sm:px-4 sm:py-2.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <BackButton onClick={() => setSubView('cuentas')} label="Volver a Cuentas" />

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs ${
                isVES 
                  ? 'bg-gradient-to-br from-blue-600 to-sky-600' 
                  : 'bg-gradient-to-br from-emerald-600 to-teal-700'
              }`}>
                {(b?.tipo || '').includes('Ahorro') ? <PiggyBank className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
              </div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">{b?.banco}</h3>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  isVES 
                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {b?.moneda || 'USD'}
                </span>
              </div>
            </div>

            {b?.cuenta && (
              <div className="hidden md:flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60 text-[11px] font-mono font-medium text-slate-600">
                <span>{b.cuenta}</span>
                <button 
                  onClick={() => handleCopyCuenta(b.cuenta)}
                  className="text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors cursor-pointer ml-1"
                  title={copiedCta ? 'Copiado' : 'Copiar número de cuenta'}
                >
                  {copiedCta ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
            {/* Saldo Final en Libros */}
            <div className="flex items-center gap-2 bg-slate-900 text-white px-3.5 py-1.5 rounded-xl shadow-xs border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Saldo en Libros:</span>
              <span className={`text-sm sm:text-base font-black font-mono tracking-tight ${
                mayorData.saldoFinalUSD < 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {mayorData.saldoFinalUSD < 0 ? '-' : ''}$ {formatoES(Math.abs(mayorData.saldoFinalUSD))}
              </span>
              {isVES && (
                <span className="text-xs font-bold text-slate-400 font-mono hidden md:inline border-l border-slate-700 pl-2 ml-1">
                  {mayorData.saldoFinalVES < 0 ? '-' : ''}Bs. {formatoES(Math.abs(mayorData.saldoFinalVES))}
                </span>
              )}
            </div>

            {/* Botón Nuevo Movimiento */}
            <button 
              onClick={() => { resetMovForm(); setSubView('form_movimiento'); }}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black px-3.5 py-2 rounded-xl transition-all shadow-sm shadow-emerald-600/20 flex items-center justify-center gap-1.5 text-xs cursor-pointer active:scale-95 shrink-0 border border-emerald-400/20"
            >
              <Plus className="w-4 h-4 stroke-[3]"/> 
              <span>Nuevo Movimiento</span>
            </button>
          </div>
        </div>

        {/* Panel Central: Filtros, Búsqueda, Tabs y Tabla del Mayor Analítico */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden mb-6">
          <div className="p-3 sm:p-4 border-b border-slate-200/80 flex flex-col gap-3">
            
            {/* Fila 1: Filtros de Período y Acciones Principales */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
              
              {/* Selectores de Período */}
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                <div className="flex items-center gap-2 bg-slate-100/70 p-1 rounded-2xl border border-slate-200/60">
                  <div className="flex items-center gap-1.5 px-3 text-slate-500">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span className="text-[11px] font-extrabold uppercase tracking-wider">Período:</span>
                  </div>
                  <select 
                    className="h-8 rounded-xl border-none bg-white px-3 text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all cursor-pointer" 
                    value={filtros.tipo} 
                    onChange={e=>setFiltros({...filtros, tipo: e.target.value})}
                  >
                    <option value="mes">Por Mes</option>
                    <option value="ano">Por Año</option>
                    <option value="rango">Rango de Fechas</option>
                    <option value="todo">Historial Completo</option>
                  </select>
                </div>

                {filtros.tipo === 'mes' && (
                  <div className="flex items-center gap-2">
                    <select 
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer" 
                      value={filtros.mes} 
                      onChange={e=>setFiltros({...filtros, mes: e.target.value})}
                    >
                      {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m,i)=>(
                        <option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>
                      ))}
                    </select>
                    <select 
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer" 
                      value={filtros.ano} 
                      onChange={e=>setFiltros({...filtros, ano: e.target.value})}
                    >
                      {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                )}

                {filtros.tipo === 'ano' && (
                  <select 
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer" 
                    value={filtros.ano} 
                    onChange={e=>setFiltros({...filtros, ano: e.target.value})}
                  >
                    {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                )}

                {filtros.tipo === 'rango' && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white border border-slate-200 px-2.5 rounded-xl shadow-xs">
                      <span className="text-[10px] font-bold text-slate-400">DESDE:</span>
                      <input 
                        type="date" 
                        className="h-9 bg-transparent text-xs font-bold text-slate-800 outline-none" 
                        value={filtros.desde} 
                        onChange={e=>setFiltros({...filtros, desde: e.target.value})}
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 px-2.5 rounded-xl shadow-xs">
                      <span className="text-[10px] font-bold text-slate-400">HASTA:</span>
                      <input 
                        type="date" 
                        className="h-9 bg-transparent text-xs font-bold text-slate-800 outline-none" 
                        value={filtros.hasta} 
                        onChange={e=>setFiltros({...filtros, hasta: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botones de Acción (Cuarentena, Exportar, Imprimir) */}
              <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
                <button 
                  onClick={() => setSubView('cuarentena')}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all border h-10 px-4 cursor-pointer shadow-xs active:scale-95 ${
                    cuarentenaMovs.length > 0 
                      ? 'bg-amber-500/10 border-amber-300 text-amber-800 hover:bg-amber-500/20' 
                      : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                  title="Ver movimientos en cuarentena pendientes por identificar"
                >
                  <ShieldAlert className={`w-4 h-4 ${cuarentenaMovs.length > 0 ? 'text-amber-600' : 'text-slate-400'}`}/> 
                  <span>Cuarentena</span>
                  {cuarentenaMovs.length > 0 && (
                    <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                      {cuarentenaMovs.length}
                    </span>
                  )}
                </button>

                <button 
                  onClick={exportarMayorCSV}
                  className="inline-flex items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-xs h-10 px-4 cursor-pointer active:scale-95"
                  title="Exportar movimientos del período a formato CSV/Excel"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600"/> 
                  <span>Exportar CSV</span>
                </button>

                <button 
                  onClick={handlePrintMayor}
                  className="inline-flex items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 shadow-xs h-10 px-4 cursor-pointer active:scale-95"
                  title="Generar vista previa e imprimir reporte contable oficial"
                >
                  <Printer className="w-4 h-4 text-indigo-600"/> 
                  <span>Imprimir Reporte</span>
                </button>
              </div>
            </div>

            {/* Fila 2: Buscador en Tiempo Real & Pestañas de Tipo */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              {/* Buscador */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Buscar por referencia, descripción, usuario o monto..."
                  value={mayorSearch}
                  onChange={e => setMayorSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-9 bg-slate-50/80 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
                {mayorSearch && (
                  <button 
                    onClick={() => setMayorSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Segmented Control / Tabs de Tipo */}
              <div className="flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 self-start sm:self-auto">
                <button
                  onClick={() => setMayorTypeFilter('todos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    mayorTypeFilter === 'todos' 
                      ? 'bg-white text-slate-900 shadow-2xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Todos <span className="text-[10px] opacity-70 ml-1">({mayorData.movs.length})</span>
                </button>
                <button
                  onClick={() => setMayorTypeFilter('ingresos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    mayorTypeFilter === 'ingresos' 
                      ? 'bg-white text-emerald-700 shadow-2xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Ingresos <span className="text-[10px] opacity-70 ml-0.5">({mayorData.countIngresos})</span>
                </button>
                <button
                  onClick={() => setMayorTypeFilter('egresos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    mayorTypeFilter === 'egresos' 
                      ? 'bg-white text-rose-700 shadow-2xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Egresos <span className="text-[10px] opacity-70 ml-0.5">({mayorData.countEgresos})</span>
                </button>
              </div>
            </div>

          </div>

          {/* Tabla Estandarizada del Mayor Analítico */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 w-28 pl-6">Fecha</th>
                  <th className="py-3.5 px-4 w-32">Referencia</th>
                  <th className="py-3.5 px-4">Descripción & Detalles</th>
                  <th className="py-3.5 px-4 text-right w-36">Ingreso (+)</th>
                  <th className="py-3.5 px-4 text-right w-36">Egreso (-)</th>
                  <th className="py-3.5 px-4 text-right w-40">Saldo USD</th>
                  <th className="py-3.5 px-4 text-center w-28 pr-6">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Saldo Arrastrado (Fila Fijada al inicio de la página 1) */}
                {filtros.tipo !== 'todo' && currentPage === 1 && !mayorSearch && (
                  <tr className="bg-gradient-to-r from-slate-50/90 via-indigo-50/20 to-slate-50/90 font-semibold text-slate-700 border-b border-slate-200/80">
                    <td className="py-3.5 px-4 pl-6" colSpan={3}>
                      <div className="flex items-center gap-2.5 text-slate-800 font-black">
                        <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                          <CornerDownRight className="w-3.5 h-3.5"/> 
                        </div>
                        <div>
                          <span className="text-xs">Saldo Arrastrado al Período</span>
                          <span className="text-[11px] text-slate-400 font-normal ml-2">(Balance acumulado anterior)</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-300 font-mono">-</td>
                    <td className="py-3.5 px-4 text-right text-slate-300 font-mono">-</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-black font-mono text-sm text-slate-900">$ {formatoES(mayorData.saldoInicialUSD)}</div>
                      {isVES && <div className="text-[10px] font-bold text-slate-500 font-mono mt-0.5">Bs. {formatoES(mayorData.saldoInicialVES)}</div>}
                    </td>
                    <td className="py-3.5 px-4 pr-6"></td>
                  </tr>
                )}

                {/* Filas de Movimientos */}
                {paginatedMayor.map(m => {
                  const isAnulado = m.estado === 'anulado'; 
                  const isIngreso = isBankIngreso(m.tipo);
                  const mAbs = Math.abs(Number(m.monto) || 0);
                  const mVES = isVES ? ((m.montoBs !== undefined && m.montoBs !== null && m.montoBs !== '') ? Math.abs(parseFloat(String(m.montoBs))) : mAbs*(m.tasa||1)) : 0;
                  const isAjuste = (m.tipo || '').startsWith('ajuste');
                  const isCobranza = m.ref?.startsWith('REC-');

                  return (
                    <tr 
                      key={m.id} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isAnulado ? 'bg-slate-50/50 opacity-60' : ''
                      }`}
                    >
                      {/* Fecha */}
                      <td className="py-3.5 px-4 pl-6 text-slate-600 font-semibold whitespace-nowrap">
                        {(m.fecha || '').split('T')[0].split('-').reverse().join('/')}
                      </td>

                      {/* Referencia */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                        {isCobranza && !isAnulado ? (
                          <button 
                            onClick={() => abrirDetalleRecibo(m.ref)} 
                            className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-bold transition-colors cursor-pointer" 
                            title="Ver Desglose del Recibo"
                          >
                            <Receipt className="w-3.5 h-3.5" /> 
                            <span>{m.ref}</span>
                          </button>
                        ) : (
                          <span className="bg-slate-100 text-slate-700 border border-slate-200/80 px-2 py-0.5 rounded-md text-[11px] font-bold">
                            {m.ref || 'S/R'}
                          </span>
                        )}
                      </td>

                      {/* Descripción y Tags */}
                      <td className="py-3.5 px-4 text-slate-700">
                        <span className={`font-semibold text-slate-800 text-xs line-clamp-2 ${isAnulado ? 'line-through text-slate-400' : ''}`}>
                          {m.descripcion}
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                          {isAnulado && (
                            <span className="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded-md text-[9px] uppercase font-black tracking-wider">
                              Anulado
                            </span>
                          )}
                          {m.isCuarentena && (
                            <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-md text-[9px] uppercase font-black tracking-wider inline-flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3 text-amber-600"/> Cuarentena
                            </span>
                          )}
                          {m.soporteImagen && (
                            <span 
                              onClick={() => setLightboxImage(m.soporteImagen)}
                              className="cursor-pointer bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-2 py-0.5 rounded-md text-[9px] uppercase font-black tracking-wider inline-flex items-center gap-1 transition-all"
                              title="Haga clic para ver el soporte digital adjunto"
                            >
                              <Image className="w-3 h-3 text-emerald-600" /> Ver Soporte
                            </span>
                          )}
                          {m.usuario && (
                            <span 
                              className="bg-slate-100 border border-slate-200/70 text-slate-600 px-2 py-0.5 rounded-md text-[9px] uppercase font-bold tracking-wider inline-flex items-center gap-1"
                              title={`Registrado por: ${m.usuario}`}
                            >
                              <User className="w-2.5 h-2.5 text-slate-400" /> {m.usuario.split('@')[0]}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Ingreso */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {!isAnulado && isIngreso ? (
                          <div className="inline-flex flex-col items-end bg-emerald-50/70 border border-emerald-100 px-2.5 py-1 rounded-xl">
                            <span className="font-black text-emerald-700 font-mono text-xs sm:text-sm">
                              +$ {formatoES(mAbs)}
                            </span>
                            {isVES && (
                              <span className="text-[10px] font-bold text-emerald-600/90 font-mono">
                                {isAjuste ? 'Ajuste FX' : `+Bs. ${formatoES(mVES)}`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">-</span>
                        )}
                      </td>

                      {/* Egreso */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {!isAnulado && !isIngreso ? (
                          <div className="inline-flex flex-col items-end bg-rose-50/70 border border-rose-100 px-2.5 py-1 rounded-xl">
                            <span className="font-black text-rose-700 font-mono text-xs sm:text-sm">
                              -$ {formatoES(mAbs)}
                            </span>
                            {isVES && (
                              <span className="text-[10px] font-bold text-rose-600/90 font-mono">
                                {isAjuste ? 'Ajuste FX' : `-Bs. ${formatoES(mVES)}`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">-</span>
                        )}
                      </td>

                      {/* Saldo USD */}
                      <td className="py-3.5 px-4 text-right bg-slate-50/40 whitespace-nowrap">
                        <div className={`font-black font-mono text-xs sm:text-sm ${m.saldoCalcUSD < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                          {m.saldoCalcUSD < 0 ? '-' : ''}$ {formatoES(Math.abs(m.saldoCalcUSD))}
                        </div>
                        {isVES && (
                          <div className={`text-[10px] font-bold font-mono mt-0.5 ${m.saldoCalcVES < 0 ? 'text-rose-500' : 'text-slate-500'}`}>
                            {m.saldoCalcVES < 0 ? '-' : ''}Bs. {formatoES(Math.abs(m.saldoCalcVES))}
                          </div>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center pr-6 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            className="p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                            onClick={() => {
                              const b = bancos.find(x => String(x.id) === String(m.banco_id));
                              navigate('/reports/comprobante-movimiento-banco', { state: { movimiento: m, banco: b } });
                            }}
                            title="Imprimir Comprobante Oficial"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          {m.soporteImagen && (
                            <button 
                              className="p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg transition-colors cursor-pointer"
                              onClick={() => setLightboxImage(m.soporteImagen)}
                              title="Ver Soporte Adjunto"
                            >
                              <Image className="w-4 h-4" />
                            </button>
                          )}
                          {!isAnulado && (
                            <>
                              <button 
                                className="p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer" 
                                onClick={() => handleEditMovimiento(m)} 
                                title="Editar Movimiento"
                              >
                                <Pencil className="w-4 h-4"/>
                              </button>
                              <button 
                                className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors cursor-pointer" 
                                onClick={()=>handleAnularMovimiento(m)} 
                                title="Anular Movimiento"
                              >
                                <Ban className="w-4 h-4"/>
                              </button>
                            </>
                          )}
                          {userRole === 'Master' && (
                            <button 
                              className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors cursor-pointer" 
                              onClick={() => handleDeleteMovimiento(m)} 
                              title="Eliminar Permanentemente"
                            >
                              <Trash2 className="w-4 h-4"/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Estado Vacío Renovado */}
                {paginatedMayor.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-16 px-4 bg-gradient-to-b from-white to-slate-50/60">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-slate-400">
                        <div className="w-16 h-16 rounded-3xl bg-indigo-50/80 border border-indigo-100 flex items-center justify-center text-indigo-500 mb-4 shadow-sm">
                          <BookOpen className="w-8 h-8" />
                        </div>
                        <h4 className="font-black text-slate-800 text-base">
                          {mayorSearch ? 'Sin resultados para la búsqueda' : 'No se encontraron movimientos'}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed text-center">
                          {mayorSearch 
                            ? `No hay operaciones que coincidan con "${mayorSearch}". Intenta con otro término o limpia el buscador.`
                            : `No hay operaciones bancarias registradas en este banco para el período seleccionado.`
                          }
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                          <button 
                            onClick={() => { resetMovForm(); setSubView('form_movimiento'); }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
                          >
                            <Plus className="w-4 h-4 stroke-[2.5]" /> Registrar Primer Movimiento
                          </button>
                          {(filtros.tipo !== 'todo' || mayorSearch || mayorTypeFilter !== 'todos') && (
                            <button 
                              onClick={() => {
                                setFiltros({ ...filtros, tipo: 'todo' });
                                setMayorSearch('');
                                setMayorTypeFilter('todos');
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 shadow-xs transition-all cursor-pointer"
                            >
                              Ver Todo el Historial
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pie de Tabla con Resumen y Paginación */}
          <div className="p-4 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-xs text-slate-500 font-medium">
              Mostrando <span className="font-bold text-slate-800">{filteredMayorMovs.length === 0 ? 0 : (safePageMayor - 1) * ITEMS_PER_PAGE + 1}</span> a <span className="font-bold text-slate-800">{Math.min(safePageMayor * ITEMS_PER_PAGE, filteredMayorMovs.length)}</span> de <span className="font-bold text-slate-800">{filteredMayorMovs.length}</span> operaciones
              {mayorSearch && <span className="text-indigo-600 ml-1 font-semibold">(filtradas por búsqueda)</span>}
            </div>
            <Pagination currentPage={safePageMayor} totalPages={totalPagesMayor} onPageChange={setCurrentPage} />
          </div>
        </div>

        <PrintPreview 
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          title={printModalTitle}
          defaultOrientation={printModalOrientation}
          defaultShowHeader={false}
          defaultShowFooter={false}
          defaultCompactSpacing={true}
        >
          {printModalContent}
        </PrintPreview>
        {renderLightbox()}
      </div>
    );
  }

  if (subView === 'saps') {
    const selectedBankObj = bancos.find(b => String(b.id) === String(sapsForm.bancoId));
    const ctaB = selectedBankObj?.cuenta_contable_id || '1.1.3';
    const ctaBankObj = cuentasContables.find(c => String(c.id) === String(ctaB) || String(c.codigo) === String(ctaB));

    const pG = configContable?.cuentaGananciaDiferencialCambiario || cuentasContables.find(c => (c.nombre || '').toLowerCase().includes('ganancia') && (c.nombre || '').toLowerCase().includes('cambio'))?.id || '4.1.1'; 
    const pP = configContable?.cuentaPerdidaDiferencialCambiario || cuentasContables.find(c => (c.nombre || '').toLowerCase().includes('pérdida') && (c.nombre || '').toLowerCase().includes('cambio'))?.id || '5.2.1'; 

    const ctaPGObj = cuentasContables.find(c => String(c.id) === String(pG) || String(c.codigo) === String(pG));
    const ctaPPObj = cuentasContables.find(c => String(c.id) === String(pP) || String(c.codigo) === String(pP));

    const getDiferencialFila = (d: any, tCierre: number) => {
      if (!tCierre || tCierre <= 0) return 0;
      let val = 0;
      if (d.tipo === 'arrastre') {
        val = (d.saldoVES / tCierre) - d.saldoUSD;
      } else if (d.tipo === 'egreso') {
        val = d.montoUSD - (d.montoVES / tCierre);
      } else {
        val = (d.montoVES / tCierre) - d.montoUSD;
      }
      return Math.round(val * 100) / 100;
    };

    const rawDetalles = sapsResult?.detalles || [];
    const filteredDetalles = sapsTableSearch.trim()
      ? rawDetalles.filter((d: any) =>
          (d.referencia || '').toLowerCase().includes(sapsTableSearch.toLowerCase().trim()) ||
          (d.descripcion || '').toLowerCase().includes(sapsTableSearch.toLowerCase().trim()) ||
          (d.fecha || '').toLowerCase().includes(sapsTableSearch.toLowerCase().trim()) ||
          String(d.montoUSD || '').includes(sapsTableSearch.trim()) ||
          String(d.montoVES || '').includes(sapsTableSearch.trim())
        )
      : rawDetalles;

    return (
      <div className="px-4 sm:px-8 py-6 animate-in fade-in duration-200 w-full max-w-7xl mx-auto font-sans space-y-6">
        {/* Header Superior Moderno */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-4">
            <BackButton onClick={() => { setSapsResult(null); setSubView('cuentas'); }} label="Volver a Bancos" />
            <div className="h-9 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-xs">
                <RefreshCw className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Revalorización SAPS (FX)
                  </h2>
                  <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                    NIC 21 / NIIF
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Ajuste de diferencial cambiario automático para cuentas bancarias en moneda nacional (VES)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end lg:self-center">
            <button
              type="button"
              onClick={() => setShowSapsGuide(!showSapsGuide)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                showSapsGuide
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Info className="w-4 h-4 text-indigo-500" />
              <span>¿Cómo funciona?</span>
              {showSapsGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {sapsResult && (
              <button
                type="button"
                onClick={handlePrintSapsReport}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all active:scale-98 cursor-pointer"
                title="Imprimir el reporte analítico auditado de SAPS (PDF)"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Reporte PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* Guía Explicativa Plegable */}
        {showSapsGuide && (
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 animate-in slide-in-from-top-3 duration-200">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-200">Metodología de Cálculo SAPS (Diferencial FX)</h4>
              </div>
              <button onClick={() => setShowSapsGuide(false)} className="text-slate-400 hover:text-white text-xs font-bold cursor-pointer">Cerrar guía ✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/70 p-4 rounded-2xl border border-slate-700/60">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-300 font-black text-xs flex items-center justify-center border border-indigo-500/30">1</div>
                  <h5 className="font-bold text-sm text-slate-100">Flujo Histórico Transaccional</h5>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Totaliza ingresos y egresos en Bolívares y calcula el <strong>Saldo Teórico en USD</strong> con la tasa de cada operación desde el último cierre.
                </p>
              </div>

              <div className="bg-slate-800/70 p-4 rounded-2xl border border-slate-700/60">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-300 font-black text-xs flex items-center justify-center border border-amber-500/30">2</div>
                  <h5 className="font-bold text-sm text-slate-100">Valoración al Cierre (BCV)</h5>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Toma el saldo en Bolívares consolidado y lo divide entre la <strong>Tasa BCV de corte</strong>, obteniendo el <strong>Valor Real equivalente en USD</strong> hoy.
                </p>
              </div>

              <div className="bg-slate-800/70 p-4 rounded-2xl border border-slate-700/60">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-300 font-black text-xs flex items-center justify-center border border-emerald-500/30">3</div>
                  <h5 className="font-bold text-sm text-slate-100">Ajuste de Partida Doble</h5>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Calcula el diferencial neto y genera el asiento contable balanceado: <strong>Ganancia / Pérdida Cambiaria</strong> contra la cuenta del banco.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Barra Unificada de Parámetros */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">Parámetros del Análisis</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Banco selector */}
            <div className="md:col-span-4 flex flex-col">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-slate-400" /> Banco a Revalorizar (VES)
              </label>
              <select 
                className="w-full h-11 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 outline-none transition-all"
                value={sapsForm.bancoId} 
                onChange={e => {
                  const bId = e.target.value;
                  const bObj = bancos.find(b => String(b.id) === String(bId));
                  setSapsForm({
                    ...sapsForm,
                    bancoId: bId,
                    tasa: sapsForm.tasa || (bObj?.tasa ? String(bObj.tasa) : '')
                  });
                }}
              >
                <option value="">Seleccione cuenta en Bolívares...</option>
                {bancos.filter(b => b.moneda === 'Bolivares').map(b => (
                  <option key={b.id} value={b.id}>{b.banco} — {b.cuenta || b.numero_cuenta} (VES)</option>
                ))}
              </select>
            </div>

            {/* Fecha de corte */}
            <div className="md:col-span-3 flex flex-col">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Fecha de Corte
                </label>
                <button
                  type="button"
                  onClick={() => setSapsForm({ ...sapsForm, fecha: fechaHoy })}
                  className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 uppercase cursor-pointer"
                >
                  Hoy
                </button>
              </div>
              <input 
                type="date" 
                className="w-full h-11 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 outline-none transition-all" 
                value={sapsForm.fecha} 
                onChange={e => setSapsForm({...sapsForm, fecha: e.target.value})} 
              />
            </div>

            {/* Tasa BCV */}
            <div className="md:col-span-2 flex flex-col">
              <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-slate-400" /> Tasa BCV Cierre
              </label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.0001" 
                  className="w-full h-11 pl-3.5 pr-14 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 outline-none transition-all" 
                  value={sapsForm.tasa} 
                  onChange={e => setSapsForm({...sapsForm, tasa: e.target.value})} 
                  placeholder="0.00" 
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">Bs/$</div>
              </div>
            </div>

            {/* Botón de Cálculo */}
            <div className="md:col-span-3">
              <button 
                type="button"
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer" 
                onClick={handleCalcularSAPS}
              >
                <Calculator className="w-4 h-4"/>
                <span>Calcular Ajuste FX</span>
              </button>
            </div>
          </div>
        </div>

        {/* Estado Vacío o Resultados */}
        {!sapsResult ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-4 border border-indigo-100 shadow-xs">
              <Calculator className="w-8 h-8 text-indigo-600" />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">Esperando Parámetros de Análisis</h4>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed mb-4">
              Seleccione la cuenta bancaria en Bolívares (VES), fije la fecha de corte y la tasa oficial del BCV para generar la cédula analítica y el cálculo del diferencial.
            </p>
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
              <span>SAPS respeta los cierres previos y procesa transacciones no consolidadas.</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* HERO BANNER: Resultado Diferencial Cambiario */}
            <div className={`p-6 rounded-3xl border shadow-xs transition-all ${
              sapsResult.tipo === 'ajuste_ganancia' 
                ? 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 border-emerald-200' 
                : sapsResult.tipo === 'ajuste_perdida' 
                ? 'bg-gradient-to-br from-rose-50 via-white to-rose-50/30 border-rose-200' 
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3.5 rounded-2xl shrink-0 ${
                    sapsResult.tipo === 'ajuste_ganancia' 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : sapsResult.tipo === 'ajuste_perdida' 
                      ? 'bg-rose-100 text-rose-700' 
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {sapsResult.tipo === 'ajuste_ganancia' ? <TrendingUp className="w-7 h-7" /> : sapsResult.tipo === 'ajuste_perdida' ? <TrendingDown className="w-7 h-7" /> : <Scale className="w-7 h-7" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Resultado del Análisis FX
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        sapsResult.tipo === 'ajuste_ganancia' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : sapsResult.tipo === 'ajuste_perdida' 
                          ? 'bg-rose-100 text-rose-800' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {sapsResult.tipo === 'ajuste_ganancia' ? 'Ganancia Cambiaria' : sapsResult.tipo === 'ajuste_perdida' ? 'Pérdida Cambiaria' : 'Saldos Sincronizados'}
                      </span>
                    </div>

                    <h3 className={`text-2xl sm:text-3xl font-black font-mono mt-1 ${
                      sapsResult.tipo === 'ajuste_ganancia' 
                        ? 'text-emerald-700' 
                        : sapsResult.tipo === 'ajuste_perdida' 
                        ? 'text-rose-700' 
                        : 'text-slate-800'
                    }`}>
                      {sapsResult.tipo === 'ajuste_ganancia' ? '+' : sapsResult.tipo === 'ajuste_perdida' ? '-' : ''}$ {formatoES(sapsResult.monto)}
                    </h3>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                      {sapsResult.tipo === 'ajuste_ganancia' 
                        ? 'El poder adquisitivo real en dólares supera al registrado en libros. Aplicar este ajuste aumentará el saldo oficial en USD de su banco en libros contables.'
                        : sapsResult.tipo === 'ajuste_perdida'
                        ? 'Debido al incremento del tipo de cambio BCV, los bolívares representan menos dólares en libros contables. Se generará un débito a Gasto por Pérdida Cambiaria y se ajustará la cuenta de banco.'
                        : 'La diferencia es menor a 0.05 USD. Los saldos se encuentran sincronizados y no se requiere asiento contable.'
                      }
                    </p>
                  </div>
                </div>

                {sapsResult.tipo !== 'none' && (
                  <button 
                    type="button"
                    onClick={handleOpenSapsConfirmModal}
                    className={`px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2.5 shadow-md hover:shadow-lg transition-all active:scale-98 shrink-0 text-white cursor-pointer ${
                      sapsResult.tipo === 'ajuste_ganancia'
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                        : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Ver y Registrar Asiento Contable</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4 CARDS FINANCIERAS (KPIS EJECUTIVOS) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tarjeta 1: Saldo Teórico en Dólares */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:border-indigo-200 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">Libros Contables</span>
                    <HelpCircle className="w-4 h-4 text-slate-300 cursor-help" title="Saldo acumulado en USD que debería existir en libros según los registros individuales de ingresos y egresos." />
                  </div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Saldo Teórico (USD)</h4>
                  <p className="text-2xl font-black text-slate-900 font-mono mt-1.5">$ {formatoES(sapsResult.sTeoricoUSD)}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-mono leading-tight">
                  <span className="text-slate-400 font-bold block mb-0.5">Composición:</span>
                  Arrastre (${formatoES(sapsResult.arrUSD)}) + Ing. (${formatoES(sapsResult.ingUSD)}) - Egr. (${formatoES(sapsResult.egrUSD)})
                </div>
              </div>

              {/* Tarjeta 2: Saldo Físico en Bolívares */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:border-indigo-200 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700">Moneda Local</span>
                    <HelpCircle className="w-4 h-4 text-slate-300 cursor-help" title="Saldo total disponible en la cuenta bancaria expresado en Bolívares." />
                  </div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Saldo Físico (VES)</h4>
                  <p className="text-2xl font-black text-indigo-700 font-mono mt-1.5">Bs. {formatoES(sapsResult.sFinalVES)}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-mono leading-tight">
                  <span className="text-slate-400 font-bold block mb-0.5">Composición:</span>
                  Arrastre (Bs. {formatoES(sapsResult.arrVES)}) + Ing. (Bs. {formatoES(sapsResult.ingVES)}) - Egr. (Bs. {formatoES(sapsResult.egrVES)})
                </div>
              </div>

              {/* Tarjeta 3: Valor Real a Tasa BCV */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:border-indigo-200 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">Tasa: {formatoES(sapsResult.tasaCierre)}</span>
                    <HelpCircle className="w-4 h-4 text-slate-300 cursor-help" title="Conversión del saldo en bolívares a dólares usando la tasa BCV de corte seleccionada." />
                  </div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Valor Real al Cierre (USD)</h4>
                  <p className="text-2xl font-black text-slate-900 font-mono mt-1.5">$ {formatoES(sapsResult.valorRealUSD)}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-mono leading-tight">
                  <span className="text-slate-400 font-bold block mb-0.5">Cálculo:</span>
                  Bs. {formatoES(sapsResult.sFinalVES)} ÷ {formatoES(sapsResult.tasaCierre)} Bs/$
                </div>
              </div>

              {/* Tarjeta 4: Diferencial Cambiario */}
              <div className={`p-5 rounded-3xl border shadow-xs transition-all flex flex-col justify-between ${
                sapsResult.tipo === 'ajuste_ganancia'
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : sapsResult.tipo === 'ajuste_perdida'
                  ? 'bg-rose-50/50 border-rose-200'
                  : 'bg-white border-slate-200/80'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      sapsResult.tipo === 'ajuste_ganancia'
                        ? 'bg-emerald-100 text-emerald-800'
                        : sapsResult.tipo === 'ajuste_perdida'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      Diferencia Neta
                    </span>
                    <HelpCircle className="w-4 h-4 text-slate-300 cursor-help" title="Variación entre el valor real ajustado y el saldo teórico que reflejan los libros." />
                  </div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Diferencial FX</h4>
                  <p className={`text-2xl font-black font-mono mt-1.5 ${
                    sapsResult.tipo === 'ajuste_ganancia'
                      ? 'text-emerald-700'
                      : sapsResult.tipo === 'ajuste_perdida'
                      ? 'text-rose-700'
                      : 'text-slate-800'
                  }`}>
                    {sapsResult.diferencial >= 0 ? '+' : '-'}$ {formatoES(Math.abs(sapsResult.diferencial))}
                  </p>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200/60 text-[10px] text-slate-500 font-mono leading-tight">
                  <span className="text-slate-400 font-bold block mb-0.5">Diferencia:</span>
                  USD Real (${formatoES(sapsResult.valorRealUSD)}) - USD Teórico (${formatoES(sapsResult.sTeoricoUSD)})
                </div>
              </div>
            </div>

            {/* Asiento Contable Proyectado */}
            {sapsResult.tipo !== 'none' && (
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">Asiento Contable Proyectado</h4>
                      <p className="text-xs text-slate-500 font-medium">Comprobante de Diario generado automáticamente bajo la referencia <span className="font-mono font-bold text-slate-700">AUTO-FX</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60 w-max">
                      Borrador Automático SAPS
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenSapsConfirmModal}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition active:scale-98 cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Registrar Asiento</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-black border-b border-slate-200 uppercase tracking-wider text-[10px]">
                        <th className="p-3.5 w-28">Código</th>
                        <th className="p-3.5">Cuenta Contable</th>
                        <th className="p-3.5 text-right w-32">Debe ($)</th>
                        <th className="p-3.5 text-right w-32">Haber ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {sapsResult.tipo === 'ajuste_ganancia' ? (
                        <>
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-indigo-700">{ctaBankObj?.codigo || ctaB}</td>
                            <td className="p-3.5 text-slate-800">
                              <span className="font-bold">{ctaBankObj ? ctaBankObj.nombre : `Banco: ${selectedBankObj?.banco}`}</span>
                              <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50">Revalorización Bancaria</span>
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-slate-900">$ {formatoES(sapsResult.monto)}</td>
                            <td className="p-3.5 text-right font-mono text-slate-400">0,00</td>
                          </tr>
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-indigo-700">{ctaPGObj?.codigo || '4.1.1'}</td>
                            <td className="p-3.5 text-slate-800">
                              <span className="font-bold">{ctaPGObj?.nombre || 'Ingreso por Diferencial Cambiario'}</span>
                              <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/50">Ganancia Cambiaria</span>
                            </td>
                            <td className="p-3.5 text-right font-mono text-slate-400">0,00</td>
                            <td className="p-3.5 text-right font-mono font-bold text-slate-900">$ {formatoES(sapsResult.monto)}</td>
                          </tr>
                        </>
                      ) : (
                        <>
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-indigo-700">{ctaPPObj?.codigo || '5.2.1'}</td>
                            <td className="p-3.5 text-slate-800">
                              <span className="font-bold">{ctaPPObj?.nombre || 'Gasto por Diferencial Cambiario'}</span>
                              <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/50">Pérdida Cambiaria</span>
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-slate-900">$ {formatoES(sapsResult.monto)}</td>
                            <td className="p-3.5 text-right font-mono text-slate-400">0,00</td>
                          </tr>
                          <tr className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3.5 font-mono font-bold text-indigo-700">{ctaBankObj?.codigo || ctaB}</td>
                            <td className="p-3.5 text-slate-800">
                              <span className="font-bold">{ctaBankObj ? ctaBankObj.nombre : `Banco: ${selectedBankObj?.banco}`}</span>
                              <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Devaluación en Libros</span>
                            </td>
                            <td className="p-3.5 text-right font-mono text-slate-400">0,00</td>
                            <td className="p-3.5 text-right font-mono font-bold text-slate-900">$ {formatoES(sapsResult.monto)}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200 font-black text-slate-800">
                        <td colSpan={2} className="p-3.5 text-right uppercase tracking-wider text-[11px]">Totales Balanceados:</td>
                        <td className="p-3.5 text-right font-mono text-sm text-slate-900">$ {formatoES(sapsResult.monto)}</td>
                        <td className="p-3.5 text-right font-mono text-sm text-slate-900">$ {formatoES(sapsResult.monto)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* CÉDULA ANALÍTICA DE MOVIMIENTOS BANCARIOS */}
            {sapsResult.detalles && sapsResult.detalles.length > 0 && (
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">Cédula Analítica de Movimientos (SAPS)</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          {filteredDetalles.length} {filteredDetalles.length === 1 ? 'registro' : 'registros'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Auditoría cronológica de ingresos, egresos y tasas cambiarias de cada movimiento</p>
                    </div>
                  </div>

                  {/* Buscador de la cédula */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text" 
                        placeholder="Buscar referencia o concepto..." 
                        value={sapsTableSearch}
                        onChange={e => setSapsTableSearch(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs z-10">
                      <tr className="text-slate-600 font-black border-b border-slate-200 uppercase tracking-wider text-[10px]">
                        <th className="p-3 text-center w-24">Fecha</th>
                        <th className="p-3">Ref / Descripción</th>
                        <th className="p-3 text-center w-20">Tipo</th>
                        <th className="p-3 text-right w-24">Tasa Aplicada</th>
                        <th className="p-3 text-right w-28">Movimiento USD</th>
                        <th className="p-3 text-right w-32">Importe VES</th>
                        <th className="p-3 text-right bg-slate-200/50 w-28">Saldo USD</th>
                        <th className="p-3 text-right bg-indigo-50/60 text-indigo-950 w-32 border-l border-indigo-100">Saldo VES</th>
                        <th className="p-3 text-right w-24">USD Cierre</th>
                        <th className="p-3 text-right bg-indigo-50/60 text-indigo-950 font-black w-24">Dif. FX</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {filteredDetalles.map((d: any, idx: number) => {
                        const diffRow = getDiferencialFila(d, sapsResult.tasaCierre);
                        const usdCierreVal = Math.round((d.tipo === 'arrastre' ? (d.saldoVES / sapsResult.tasaCierre) : (d.montoVES / sapsResult.tasaCierre)) * 100) / 100;
                        return (
                          <tr key={`${d.id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-3 text-center whitespace-nowrap text-[10px] font-bold text-slate-500">
                              {d.fecha !== '-' ? d.fecha : 'INICIAL'}
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-slate-900">{d.referencia}</span>
                              {d.descripcion && d.descripcion !== '-' && d.descripcion !== d.referencia && (
                                <span className="block text-[10px] text-slate-400 font-medium truncate max-w-xs">{d.descripcion}</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {d.tipo === 'arrastre' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 text-slate-600">Previo</span>
                              ) : d.tipo === 'ingreso' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/60">Ingreso</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200/60">Egreso</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-600">{d.tasa ? formatoES(d.tasa) : '-'}</td>
                            <td className={`p-3 text-right font-mono font-bold ${
                              d.tipo === 'ingreso' ? 'text-emerald-700' : d.tipo === 'egreso' ? 'text-rose-700' : 'text-slate-600'
                            }`}>
                              {d.tipo === 'arrastre' ? '-' : `${d.tipo === 'egreso' ? '-' : ''}$${formatoES(d.montoUSD)}`}
                            </td>
                            <td className="p-3 text-right font-mono text-indigo-700 font-extrabold">
                              {d.tipo === 'arrastre' ? '-' : `Bs. ${formatoES(d.montoVES)}`}
                            </td>
                            <td className="p-3 text-right font-mono bg-slate-50/50 font-black text-slate-900">
                              ${formatoES(d.saldoUSD)}
                            </td>
                            <td className="p-3 text-right font-mono bg-indigo-50/30 font-black text-indigo-900 border-l border-indigo-100">
                              Bs. {formatoES(d.saldoVES)}
                            </td>
                            <td className="p-3 text-right font-mono text-slate-600 font-bold">
                              ${formatoES(usdCierreVal)}
                            </td>
                            <td className={`p-3 text-right font-mono font-black ${
                              diffRow > 0.005 ? 'text-emerald-700 bg-emerald-50/40' : diffRow < -0.005 ? 'text-rose-700 bg-rose-50/40' : 'text-slate-400'
                            }`}>
                              {diffRow >= 0 ? '+' : '-'}${formatoES(Math.abs(diffRow))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-slate-100 border-t-2 border-slate-300 z-10">
                      <tr className="border-b border-slate-200">
                        <td colSpan={6} className="p-3 text-right font-black text-slate-700 text-xs uppercase tracking-wider">Saldo Teórico SAPS Final:</td>
                        <td className="p-3 text-right font-mono font-black text-slate-900 text-sm">${formatoES(sapsResult.sTeoricoUSD)}</td>
                        <td className="p-3 text-right font-mono font-black text-indigo-900 text-sm border-l border-indigo-200">Bs. {formatoES(sapsResult.sFinalVES)}</td>
                        <td className="p-3 text-right font-mono text-slate-400 font-bold">-</td>
                        <td className="p-3 text-right font-mono text-slate-400 font-bold">-</td>
                      </tr>
                      <tr className="bg-indigo-50/80">
                        <td colSpan={6} className="p-3 text-right font-black text-indigo-900 text-xs uppercase tracking-wider">Saldo Real a Tasa BCV ({formatoES(sapsResult.tasaCierre)}):</td>
                        <td className="p-3 text-right font-mono font-black text-indigo-900 text-sm">${formatoES(sapsResult.valorRealUSD)}</td>
                        <td className="p-3 text-right font-mono font-black text-indigo-900 text-sm border-l border-indigo-200">Bs. {formatoES(sapsResult.sFinalVES)}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-600">Tc: {formatoES(sapsResult.tasaCierre)}</td>
                        <td className={`p-3 text-right font-mono font-black text-sm ${
                          sapsResult.diferencial >= 0 ? 'text-emerald-700 bg-emerald-100/60' : 'text-rose-700 bg-rose-100/60'
                        }`}>
                          {sapsResult.diferencial >= 0 ? '+' : '-'}${formatoES(Math.abs(sapsResult.diferencial))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        
        <PrintPreview 
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          title={printModalTitle}
          defaultOrientation={printModalOrientation}
          defaultShowHeader={false}
          defaultShowFooter={false}
          defaultCompactSpacing={true}
        >
          {printModalContent}
        </PrintPreview>

        {/* Modal Opciones de Impresión SAPS */}
        {showSapsPrintOptionModal && sapsResult && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setShowSapsPrintOptionModal(false)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Printer className="w-6 h-6 text-indigo-600" /> Formato de Impresión SAPS
                </h3>
                <button className="text-slate-400 hover:text-red-500 bg-white p-2 rounded-full shadow-sm" onClick={() => setShowSapsPrintOptionModal(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-500 mb-2">
                  Seleccione el nivel de detalle para la exportación de la Cédula de Revalorización Cambiaria:
                </p>
                
                <div className="grid grid-cols-1 gap-3">
                  {/* Opción Detallado */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowSapsPrintOptionModal(false);
                      handlePrintSapsReportEx('detallado');
                    }}
                    className="flex items-start gap-4 p-4 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all text-left group w-full"
                  >
                    <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 group-hover:text-indigo-900 text-sm">Reporte Detallado (Línea por Línea)</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Muestra la lista cronológica de todos los movimientos individuales, detallando su tasa original, montos y los saldos acumulados en USD y VES.
                      </p>
                    </div>
                  </button>

                  {/* Opción Resumido */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowSapsPrintOptionModal(false);
                      handlePrintSapsReportEx('resumido');
                    }}
                    className="flex items-start gap-4 p-4 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all text-left group w-full"
                  >
                    <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 group-hover:text-indigo-900 text-sm">Reporte Resumido (Totalizado por Día)</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Consolida los ingresos y egresos agrupados por día. Muestra los totales de flujos diarios y el saldo acumulado al final de cada jornada.
                      </p>
                    </div>
                  </button>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-150">
                  <button className="btn-secondary" onClick={() => setShowSapsPrintOptionModal(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EJECUTIVO: CONFIRMAR Y REGISTRAR ASIENTO CONTABLE SAPS (FX) */}
        {showSapsConfirmModal && sapsResult && (
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[110] flex items-center justify-center p-3 sm:p-5 overflow-y-auto" 
            onClick={() => !isApplyingSaps && setShowSapsConfirmModal(false)}
          >
            <div 
              className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 my-auto" 
              onClick={e => e.stopPropagation()}
            >
              {/* Header con Membrete y Estilo de Comprobante */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative overflow-hidden">
                <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex items-start justify-between relative z-10 gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-indigo-300 shadow-inner">
                      <BookOpen className="w-6 h-6 text-indigo-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                          Comprobante de Diario • SAPS FX
                        </span>
                        <span className="text-[11px] font-mono text-slate-300 font-bold">
                          Ref: AUTO-FX
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-black text-white mt-1 tracking-tight">
                        Confirmación de Asiento Contable
                      </h3>
                      <p className="text-xs text-slate-300 font-medium">
                        Revalorización por Diferencial Cambiario al Cierre (NIC 21 / NIIF)
                      </p>
                    </div>
                  </div>

                  <button 
                    disabled={isApplyingSaps}
                    className="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition cursor-pointer" 
                    onClick={() => setShowSapsConfirmModal(false)}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Cuerpo del Modal */}
              <div className="p-6 space-y-5 max-h-[calc(85vh-130px)] overflow-y-auto">
                {/* 4 Cards con Metadatos Clave */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Fecha Contable</span>
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      {sapsResult.fecha}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Tasa BCV Cierre</span>
                    <span className="text-xs font-black text-indigo-700 flex items-center gap-1.5 font-mono">
                      <Coins className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Bs. {formatoES(sapsResult.tasaCierre)}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Banco Objeto</span>
                    <span className="text-xs font-black text-slate-800 truncate block" title={selectedBankObj?.banco}>
                      {selectedBankObj?.banco || 'Banco'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block truncate">
                      {selectedBankObj?.cuenta || 'Moneda VES'}
                    </span>
                  </div>

                  <div className={`p-3 rounded-2xl border ${
                    sapsResult.tipo === 'ajuste_ganancia' 
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                      : 'bg-rose-50/80 border-rose-200 text-rose-900'
                  }`}>
                    <span className="text-[10px] uppercase font-bold opacity-75 block mb-0.5">
                      {sapsResult.tipo === 'ajuste_ganancia' ? 'Ganancia Neta' : 'Pérdida Neta'}
                    </span>
                    <span className="text-sm font-black font-mono block">
                      {sapsResult.tipo === 'ajuste_ganancia' ? '+' : '-'}$ {formatoES(sapsResult.monto)}
                    </span>
                    <span className="text-[10px] font-mono opacity-80 block">
                      Bs. {formatoES(sapsResult.monto * sapsResult.tasaCierre)}
                    </span>
                  </div>
                </div>

                {/* Glosa / Concepto Editable */}
                <div className="bg-slate-50/60 p-3.5 rounded-2xl border border-slate-200">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block mb-1.5">
                    Concepto / Glosa del Asiento:
                  </label>
                  <input
                    type="text"
                    value={sapsCustomConcept}
                    onChange={(e) => setSapsCustomConcept(e.target.value)}
                    placeholder="Descripción para el libro diario..."
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:border-indigo-600 outline-none transition"
                  />
                </div>

                {/* Tabla del Asiento Contable (Partida Doble) */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-indigo-600" />
                      Detalle de Partidas (Débitos & Créditos)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Balanceado (100% Cuadrado)
                    </span>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3.5">Cuenta Contable</th>
                        <th className="py-2.5 px-3.5">Descripción de la Partida</th>
                        <th className="py-2.5 px-3.5 text-right">Debe ($)</th>
                        <th className="py-2.5 px-3.5 text-right">Haber ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {sapsResult.tipo === 'ajuste_ganancia' ? (
                        <>
                          {/* Fila 1: Banco (Débito) */}
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5">
                              <span className="font-mono font-black text-indigo-600 block">
                                {ctaBankObj?.codigo || ctaB}
                              </span>
                              <span className="font-bold text-slate-900 block text-xs">
                                {ctaBankObj ? ctaBankObj.nombre : `Banco: ${selectedBankObj?.banco}`}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="text-slate-800 block">
                                Revalorización de saldo bancario a tasa BCV Bs. {formatoES(sapsResult.tasaCierre)}
                              </span>
                              <span className="text-[10px] text-emerald-600 font-bold">
                                [Activo • Aumento de valor contable en USD]
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900">
                              <div>$ {formatoES(sapsResult.monto)}</div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                Bs. {formatoES(sapsResult.monto * sapsResult.tasaCierre)}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono text-slate-300 font-bold">
                              $ 0,00
                            </td>
                          </tr>

                          {/* Fila 2: Ganancia Cambiaria (Crédito) */}
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5">
                              <span className="font-mono font-black text-indigo-600 block">
                                {ctaPGObj?.codigo || '4.1.1'}
                              </span>
                              <span className="font-bold text-slate-900 block text-xs">
                                {ctaPGObj?.nombre || 'Ganancia en Diferencial Cambiario'}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="text-slate-800 block">
                                Ingreso por ganancia cambiaria no realizada (Ajuste SAPS)
                              </span>
                              <span className="text-[10px] text-indigo-600 font-bold">
                                [Ingreso • Ganancia neta por tipo de cambio]
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono text-slate-300 font-bold">
                              $ 0,00
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900">
                              <div>$ {formatoES(sapsResult.monto)}</div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                Bs. {formatoES(sapsResult.monto * sapsResult.tasaCierre)}
                              </div>
                            </td>
                          </tr>
                        </>
                      ) : (
                        <>
                          {/* Fila 1: Pérdida Cambiaria (Débito) */}
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5">
                              <span className="font-mono font-black text-indigo-600 block">
                                {ctaPPObj?.codigo || '5.2.1'}
                              </span>
                              <span className="font-bold text-slate-900 block text-xs">
                                {ctaPPObj?.nombre || 'Pérdida en Diferencial Cambiario'}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="text-slate-800 block">
                                Gasto por pérdida cambiaria por incremento de tasa BCV
                              </span>
                              <span className="text-[10px] text-rose-600 font-bold">
                                [Gasto • Pérdida por depreciación cambiaria]
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900">
                              <div>$ {formatoES(sapsResult.monto)}</div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                Bs. {formatoES(sapsResult.monto * sapsResult.tasaCierre)}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono text-slate-300 font-bold">
                              $ 0,00
                            </td>
                          </tr>

                          {/* Fila 2: Banco (Crédito) */}
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5">
                              <span className="font-mono font-black text-indigo-600 block">
                                {ctaBankObj?.codigo || ctaB}
                              </span>
                              <span className="font-bold text-slate-900 block text-xs">
                                {ctaBankObj ? ctaBankObj.nombre : `Banco: ${selectedBankObj?.banco}`}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="text-slate-800 block">
                                Ajuste por devaluación / diferencial cambiario a tasa BCV Bs. {formatoES(sapsResult.tasaCierre)}
                              </span>
                              <span className="text-[10px] text-slate-500 font-bold">
                                [Activo • Disminución de saldo contable en USD]
                              </span>
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono text-slate-300 font-bold">
                              $ 0,00
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-black text-slate-900">
                              <div>$ {formatoES(sapsResult.monto)}</div>
                              <div className="text-[10px] text-slate-400 font-normal">
                                Bs. {formatoES(sapsResult.monto * sapsResult.tasaCierre)}
                              </div>
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-200 text-xs">
                      <tr>
                        <td colSpan={2} className="py-3 px-3.5 text-right uppercase tracking-wider text-slate-700 text-[11px]">
                          Totales Cuadrados:
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-slate-900">
                          $ {formatoES(sapsResult.monto)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono text-slate-900">
                          $ {formatoES(sapsResult.monto)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Nota NIIF Informativa */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-900">
                  <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed text-[11px]">
                    <strong>Garantía de Cuadre:</strong> Al confirmar, se creará el movimiento bancario con referencia 
                    <span className="font-mono font-bold text-indigo-700 mx-1">AUTO-FX</span> y el Asiento en el Libro Diario. 
                    El saldo físico en Bolívares (<span className="font-mono font-bold">Bs. {formatoES(sapsResult.sFinalVES)}</span>) se mantendrá 100% inalterado.
                  </div>
                </div>
              </div>

              {/* Botones de Acción al Pie */}
              <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button 
                  type="button"
                  disabled={isApplyingSaps}
                  onClick={() => setShowSapsConfirmModal(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button 
                  type="button"
                  disabled={isApplyingSaps}
                  onClick={handleAplicarSAPS}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 cursor-pointer ${
                    isApplyingSaps
                      ? 'bg-slate-400 cursor-not-allowed'
                      : sapsResult.tipo === 'ajuste_ganancia'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                  }`}
                >
                  {isApplyingSaps ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Registrando Asiento...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Confirmar y Registrar Asiento</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (subView === 'historial_traspasos') {
    const filteredTraspasos = listadoTraspasos.filter(t => {
      const q = searchTraspaso.toLowerCase();
      return (
        t.id.toLowerCase().includes(q) ||
        t.concepto.toLowerCase().includes(q) ||
        t.bancoOrigen.toLowerCase().includes(q) ||
        t.bancoDestino.toLowerCase().includes(q) ||
        (t.comp?.numero && t.comp.numero.toLowerCase().includes(q))
      );
    });

    const TRASPASOS_PER_PAGE = 8;
    const totalTraspasoPages = Math.ceil(filteredTraspasos.length / TRASPASOS_PER_PAGE) || 1;
    const paginatedTraspasos = filteredTraspasos.slice(
      (traspasoPage - 1) * TRASPASOS_PER_PAGE,
      traspasoPage * TRASPASOS_PER_PAGE
    );

    return (
      <div className="px-3 sm:px-6 pt-1 pb-6 max-w-7xl mx-auto w-full animate-in slide-in-from-bottom-4">
        {renderTabs()}
        
        <div className="odoo-card p-6 md:p-8 bg-white shadow-sm rounded-3xl border border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-150">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <History className="w-6 h-6 text-indigo-600" />
                Historial de Traspasos Bancarios
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Visualice, audite y revierta de forma completa los traspasos realizados entre cuentas bancarias.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => setTransferForm({...transferForm, showModal: true})} 
                className="inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg h-10 px-4"
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Nuevo Traspaso
              </button>
              <BackButton onClick={() => { setSearchTraspaso(''); setSubView('cuentas'); }} label="Volver a Cuentas" />
            </div>
          </div>

          <div className="my-6 max-w-md relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar por banco, concepto, N° de transacción..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-sm transition-all outline-none text-slate-800 placeholder-slate-400"
              value={searchTraspaso}
              onChange={e => setSearchTraspaso(e.target.value)}
            />
          </div>

          {filteredTraspasos.length > 0 ? (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-black tracking-widest">
                      <th className="py-4 pl-6">Fecha</th>
                      <th className="py-4 px-4">Transferencia ID</th>
                      <th className="py-4 px-4">Concepto / Glosa</th>
                      <th className="py-4 px-4">Ruta (Origen → Destino)</th>
                      <th className="py-4 px-4 text-right">Monto</th>
                      <th className="py-4 pr-6 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {paginatedTraspasos.map(t => {
                      const formattedDate = (t.fecha || '').split('T')[0].split('-').reverse().join('/');
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 pl-6 font-semibold text-slate-700 whitespace-nowrap">
                            {formattedDate}
                          </td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 font-mono font-bold text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-lg">
                              TRF-{t.id}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <p className="font-semibold text-slate-800 line-clamp-1">{t.concepto}</p>
                            {t.comp?.numero && (
                              <p className="text-[11px] text-indigo-500 font-bold mt-0.5">Asiento: {t.comp.numero}</p>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2 text-xs font-bold">
                                <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 truncate max-w-[150px]" title={t.bancoOrigen}>
                                  {t.bancoOrigen}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 truncate max-w-[150px]" title={t.bancoDestino}>
                                  {t.bancoDestino}
                                </span>
                              </div>
                              {(t.bancoOrigenMoneda === 'Bolivares' || t.bancoDestinoMoneda === 'Bolivares') && (
                                <p className="text-[10px] text-slate-500 font-medium">
                                  Tasas: {t.bancoOrigenMoneda === 'Bolivares' ? `Origen Bs. ${formatoES(t.tasaOrigen)}` : ''} 
                                  {t.bancoOrigenMoneda === 'Bolivares' && t.bancoDestinoMoneda === 'Bolivares' ? ' | ' : ''}
                                  {t.bancoDestinoMoneda === 'Bolivares' ? `Destino Bs. ${formatoES(t.tasaDestino)}` : ''}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <p className="font-extrabold text-slate-900">$ {formatoES(t.monto)}</p>
                            {t.bancoOrigenMoneda === 'Bolivares' && t.montoBsOrigen && (
                              <p className="text-[10px] font-bold text-red-500">Egreso: Bs. {formatoES(t.montoBsOrigen)}</p>
                            )}
                            {t.bancoDestinoMoneda === 'Bolivares' && t.montoBsDestino && (
                              <p className="text-[10px] font-bold text-emerald-600">Ingreso: Bs. {formatoES(t.montoBsDestino)}</p>
                            )}
                          </td>
                          <td className="py-4 pr-6 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              {t.comp ? (
                                <button
                                  onClick={() => setViewingComprobante(t.comp)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-indigo-600 hover:text-white border border-slate-200 transition-colors"
                                  title="Ver Asiento Contable NIIF"
                                >
                                  <BookOpen className="w-3.5 h-3.5" />
                                  Ver Asiento
                                </button>
                              ) : (
                                <span className="inline-flex items-center text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-150">
                                  Sin Asiento
                                </span>
                              )}
                              
                              <button
                                onClick={() => {
                                  const bancoO = bancos.find(b => String(b.id) === String(t.outMov?.banco_id));
                                  if (t.outMov) {
                                    navigate('/reports/comprobante-movimiento-banco', { state: { movimiento: t.outMov, banco: bancoO } });
                                  } else {
                                    showToast('Movimiento de egreso no encontrado.', 'error');
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-emerald-600 hover:text-white border border-slate-200 transition-colors"
                                title="Ver Comprobante de Banco (Egreso)"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Comprobante
                              </button>

                              <button
                                onClick={() => handleDeleteTraspaso(t)}
                                className="inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-150 transition-colors"
                                title="Eliminar Traspaso y Revertir Trayectoria"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalTraspasoPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
                  <span className="text-xs text-slate-500 font-semibold">
                    Mostrando {((traspasoPage - 1) * TRASPASOS_PER_PAGE) + 1} a {Math.min(traspasoPage * TRASPASOS_PER_PAGE, filteredTraspasos.length)} de {filteredTraspasos.length} traspasos
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={traspasoPage === 1}
                      onClick={() => setTraspasoPage(p => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
                      {traspasoPage} / {totalTraspasoPages}
                    </span>
                    <button
                      disabled={traspasoPage === totalTraspasoPages}
                      onClick={() => setTraspasoPage(p => Math.min(totalTraspasoPages, p + 1))}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-slate-200 rounded-3xl p-12 text-center bg-slate-50/50">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h4 className="font-extrabold text-slate-800 text-base">No se encontraron traspasos</h4>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                {searchTraspaso 
                  ? 'No hay registros que coincidan con los criterios de búsqueda ingresados.' 
                  : 'Aún no se han registrado operaciones de traspaso en el sistema de tesorería.'}
              </p>
              {searchTraspaso ? (
                <button 
                  onClick={() => setSearchTraspaso('')}
                  className="mt-4 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-indigo-600 transition-colors"
                >
                  Limpiar búsqueda
                </button>
              ) : (
                <button 
                  onClick={() => setTransferForm({...transferForm, showModal: true})}
                  className="mt-4 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Realizar Primer Traspaso
                </button>
              )}
            </div>
          )}
        </div>

        {/* Global Modals rendered for this subView too */}
        {renderTraspasoModal()}
        {renderLightbox()}
        {renderComprobanteViewerModal()}
        
        {/* Accounting Voucher Preview Modal before registering */}
        {pendingVoucher && (
          <VoucherPreviewModal
            isOpen={!!pendingVoucher}
            onClose={() => setPendingVoucher(null)}
            initialComprobante={pendingVoucher.comprobante}
            cuentasContables={cuentasContables}
            onConfirm={pendingVoucher.onConfirm}
            showToast={showToast}
          />
        )}
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-6 pt-1 pb-6 max-w-7xl mx-auto w-full animate-in fade-in duration-300 relative font-sans">
      {/* Modal para Seleccionar Cuenta NIIF */}
      <CuentaContableModal
        isOpen={showCuentaModal}
        onClose={() => setShowCuentaModal(false)}
        onSelect={(c) => {
          setMovForm({ ...movForm, cuentaContrapartida: c.id });
          setShowCuentaModal(false);
        }}
        cuentasContables={cuentasContables}
        selectedCuentaId={movForm.cuentaContrapartida}
        title="Seleccionar Contrapartida NIIF"
        subtitle="Busque y seleccione la cuenta contable de destino para este movimiento"
      />

      {/* Modal Traspaso Flotante */}
      {renderTraspasoModal()}

      {renderTabs()}

      {renderLightbox()}

      {renderComprobanteViewerModal()}
      
      {/* Accounting Voucher Preview Modal before registering */}
      {pendingVoucher && (
        <VoucherPreviewModal
          isOpen={!!pendingVoucher}
          onClose={() => setPendingVoucher(null)}
          initialComprobante={pendingVoucher.comprobante}
          cuentasContables={cuentasContables}
          onConfirm={pendingVoucher.onConfirm}
          showToast={showToast}
        />
      )}

      {/* Renderizado de Cuentas: Modo Tarjetas (Foto 2) o Modo Lista */}
      {viewMode === 'tarjetas' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in slide-in-from-bottom-4">
          {filteredBancos.map(b => {
            const isVES = b.moneda === 'Bolivares';
            const isOverdraft = b.saldoUSD < 0;
            const isCaja = (b.tipo || '').toLowerCase().includes('caja');

            return (
              <div 
                key={b.id} 
                className="bg-white border border-slate-200/90 hover:border-indigo-300 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                onClick={() => { setSelectedBancoId(b.id); setSubView('mayor_analitico'); }}
              >
                {/* Cabecera: Icono, Nombre, N° Cuenta y Acciones */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/60 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        {isCaja ? <Wallet className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight truncate leading-tight">
                          {b.banco}
                        </h4>
                        <span className="font-mono text-[11px] font-bold text-slate-400 block truncate mt-0.5">
                          {b.cuenta ? `N° ${b.cuenta}` : 'Cuenta Operativa'}
                        </span>
                      </div>
                    </div>

                    {/* Botones de Edición y Eliminación */}
                    <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button 
                        type="button"
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer" 
                        title="Editar Banco / Cuenta" 
                        onClick={() => handleEditBanco(b)}
                      >
                        <Pencil className="w-3.5 h-3.5"/>
                      </button>
                      <button 
                        type="button"
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" 
                        title="Eliminar Banco" 
                        onClick={() => handleDeleteBanco(b.id, b.banco)}
                      >
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </div>

                  {/* Sección Central de Saldo */}
                  <div className="my-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-slate-500">Saldo Disponible</span>
                      <span className={`inline-flex items-center text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        isVES 
                          ? 'bg-blue-50 text-blue-700 border-blue-200' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isVES ? 'VES' : 'USD'}
                      </span>
                    </div>

                    <div className={`text-xl sm:text-2xl font-black tracking-tight font-mono ${
                      isOverdraft ? 'text-rose-600' : 'text-slate-900'
                    }`}>
                      <>{isOverdraft ? '-' : ''}$ {formatoES(Math.abs(b.saldoUSD))}</>
                    </div>

                    {isVES && (
                      <div className="text-[10px] text-slate-400 font-bold font-mono mt-0.5">
                        Equiv: {isOverdraft ? '-' : ''}Bs. {formatoES(Math.abs(b.saldoVES))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Link de Movimientos */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-slate-500 group-hover:text-indigo-600 transition-colors">
                  <span>Ver movimientos</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}

          {/* Tarjeta Rápida de Añadir Cuenta */}
          <div 
            onClick={() => {
              setEditBancoId(null); 
              setCuentaForm({banco:'', cuenta:'', tipo:'Corriente', moneda:'USD', tasa:'1', saldo:'0', saldoBs:'0', cuenta_contable_id:''}); 
              setSubView('nueva_cuenta');
            }}
            className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl bg-white hover:bg-indigo-50/20 transition-all duration-200 cursor-pointer flex flex-col items-center justify-center text-center p-6 min-h-[190px] group shadow-2xs hover:shadow-xs"
          >
            <div className="w-10 h-10 bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white text-slate-500 rounded-xl flex items-center justify-center mb-2.5 transition-all group-hover:scale-105">
              <Plus className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-800 group-hover:text-indigo-900 text-xs sm:text-sm">Añadir Nueva Cuenta</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-[190px]">
              Cuentas corrientes, de ahorro o cajas en divisas / Bs.
            </p>
          </div>
        </div>
      ) : (
        /* Vista en Lista (Estilo Saint / Gálac) */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden animate-in fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Institución / Banco</th>
                  <th className="px-4 py-3">N° Cuenta / Tipo</th>
                  <th className="px-3 py-3 text-center">Moneda</th>
                  <th className="px-4 py-3 text-right">Saldo Disponible (USD)</th>
                  <th className="px-4 py-3 text-right">Saldo Disponible (VES)</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredBancos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      No se encontraron cuentas que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredBancos.map(b => {
                    const isVES = b.moneda === 'Bolivares';
                    const isOverdraft = b.saldoUSD < 0;
                    const isCaja = (b.tipo || '').toLowerCase().includes('caja');

                    return (
                      <tr 
                        key={b.id} 
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        onClick={() => { setSelectedBancoId(b.id); setSubView('mayor_analitico'); }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                              {isCaja ? <Wallet className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="font-black text-slate-900 uppercase">{b.banco}</div>
                              <div className="text-[10px] text-slate-400">{b.tipo}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono font-bold text-slate-700">
                          {b.cuenta || 'Cuenta Operativa'}
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            isVES 
                              ? 'bg-blue-50 text-blue-700 border-blue-200' 
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {isVES ? 'VES' : 'USD'}
                          </span>
                        </td>

                        <td className={`px-4 py-3 text-right font-mono font-bold ${
                          isOverdraft ? 'text-rose-600' : 'text-slate-900'
                        }`}>
                          {isOverdraft ? '-' : ''}$ {formatoES(Math.abs(b.saldoUSD))}
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-600">
                          {isVES ? `Bs. ${formatoES(Math.abs(b.saldoVES))}` : '-'}
                        </td>

                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => { setSelectedBancoId(b.id); setSubView('mayor_analitico'); }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Ver Mayor Analítico"
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditBanco(b)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBanco(b.id, b.banco)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      )}
    </div>
  );
}