import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PrintPreview } from '../components/PrintPreview';
import BackButton from '../components/common/BackButton';
import { 
  ArrowLeft, 
  Printer, 
  AlertCircle, 
  Check, 
  FileText, 
  Search, 
  Building, 
  CreditCard,
  User,
  Calendar,
  Layers,
  HelpCircle,
  BookOpen,
  X,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface BankMovementProp {
  id: string;
  banco_id: string;
  fecha: string;
  ref: string;
  descripcion: string;
  tipo: 'ingreso' | 'egreso' | 'ajuste_ganancia' | 'ajuste_perdida';
  monto: number;
  tasa: number;
  estado: string;
  isCuarentena?: boolean;
  cuentaContrapartida?: string;
  cuarentenaStatus?: string | null;
  createdAt?: string | number;
  montoBs?: number | string;
}

interface BankProp {
  id: string;
  banco: string;
  cuenta: string;
  moneda: string;
  tasa: string;
  saldo: string;
  cuenta_contable_id?: string;
}

interface CuentaContableProp {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

interface ComprobanteMovimientoBancoProps {
  bancos?: BankProp[];
  movimientosBancos?: BankMovementProp[];
  cuentasContables?: CuentaContableProp[];
  empresa?: {
    nombre?: string;
    rif?: string;
    direccion?: string;
    telefono?: string;
    email?: string;
    monedaPrincipal?: string;
    logo?: string | null;
  };
  configContable?: any;
  comprobantes?: any[];
}

const formatoES = (num: number | string) => {
  if (num === undefined || num === null || num === "") return "0,00";
  const parsed = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(parsed)) return "0,00";
  return parsed.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ComprobanteMovimientoBanco({
  bancos = [],
  movimientosBancos = [],
  cuentasContables = [],
  empresa = {},
  configContable = {},
  comprobantes = []
}: ComprobanteMovimientoBancoProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Retrieve matching bank search list or active selection
  const [selectedMovId, setSelectedMovId] = useState<string>('');
  
  // Custom print-ready state
  const [repRealizado, setRepRealizado] = useState('Administrador de Créditos / Cobranzas');
  const [repAprobado, setRepAprobado] = useState('Gerente de Finanzas y Tesorería');
  const [repAuditado, setRepAuditado] = useState('Contador Público / Auditor Interno');
  
  const [documentTitle, setDocumentTitle] = useState('Comprobante de Movimiento en Cuenta');
  const [watermark, setWatermark] = useState('Procesado'); // 'none', 'copia', 'procesado', 'original'
  const [accentColor, setAccentColor] = useState('indigo'); // indigo, emerald, slate, blue, sky
  const [doubleLineTotal, setDoubleLineTotal] = useState(true);
  const [showVoucherBorder, setShowVoucherBorder] = useState(true);

  // PrintPreview state variables
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printModalTitle, setPrintModalTitle] = useState('');
  const [printModalOrientation, setPrintModalOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [printModalContent, setPrintModalContent] = useState<React.ReactNode | null>(null);
  const [showComprobanteModal, setShowComprobanteModal] = useState(false);

  const triggerPrintPreview = (title: string, orientation: 'portrait' | 'landscape', content: React.ReactNode) => {
    setPrintModalTitle(title);
    setPrintModalOrientation(orientation);
    setPrintModalContent(content);
    setPrintModalOpen(true);
  };

  // Initialize selected from location state if available
  useEffect(() => {
    if (location.state && location.state.movimiento) {
      setSelectedMovId(location.state.movimiento.id);
    } else if (movimientosBancos && movimientosBancos.length > 0) {
      // Find the latest movement
      const sorted = [...movimientosBancos].sort((a, b) => b.fecha.localeCompare(a.fecha));
      setSelectedMovId(sorted[0]?.id || '');
    }
  }, [location.state, movimientosBancos]);

  // Find the currently active bank movement
  // List of all movements chronologically sorted ascending to assign a continuous correlative number
  const allSortedMovementsAsc = useMemo(() => {
    if (!movimientosBancos) return [];
    // Sort ascending by date, then by createdAt or id to guarantee determinism
    return [...movimientosBancos].sort((a, b) => {
      const dateCompare = a.fecha.localeCompare(b.fecha);
      if (dateCompare !== 0) return dateCompare;
      
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      
      return String(a.id).localeCompare(String(b.id));
    });
  }, [movimientosBancos]);

  // Map to quickly find the correlative of any movement id
  const movementCorrelatives = useMemo(() => {
    const map = new Map<string, string>();
    allSortedMovementsAsc.forEach((m, index) => {
      const padNum = String(index + 1).padStart(5, '0');
      map.set(String(m.id), `CMC-${padNum}`);
    });
    return map;
  }, [allSortedMovementsAsc]);

  const selectedMov = useMemo(() => {
    if (!selectedMovId) return null;
    return movimientosBancos.find(m => String(m.id) === String(selectedMovId)) || null;
  }, [selectedMovId, movimientosBancos]);

  // Find the bank linked to the current movement
  const selectedBank = useMemo(() => {
    if (!selectedMov) return null;
    return bancos.find(b => String(b.id) === String(selectedMov.banco_id)) || null;
  }, [selectedMov, bancos]);

  // Handle printing action
  const handlePrint = () => {
    const element = document.getElementById('printable-voucher');
    if (element) {
      // Clone the DOM node to avoid mutating the real screen element
      const clone = element.cloneNode(true) as HTMLElement;

      // Remove non-printable screen interactive widgets
      clone.querySelectorAll('.no-print').forEach(el => el.remove());
      clone.querySelectorAll('button').forEach(el => el.remove());
      clone.querySelectorAll('style').forEach(el => el.remove());

      // Wrap back and pass to state
      triggerPrintPreview(
        documentTitle || 'Comprobante de Movimiento en Cuenta',
        'portrait',
        <div className="w-full flex-1 flex flex-col justify-between h-full" dangerouslySetInnerHTML={{ __html: clone.innerHTML }} />
      );
    } else {
      window.print();
    }
  };

  // Find the real auto-generated matching comprobante in the database list
  const currentMatchedComprobante = useMemo(() => {
    if (!selectedMov || !selectedBank) return null;

    return (comprobantes || []).find(c => {
      // 0. Match by explicit comprobanteId or movimientoBancoId
      if (selectedMov.comprobanteId && (String(c.id) === String(selectedMov.comprobanteId) || String(c.id) === String(selectedMov.comprobante_id))) {
        return true;
      }
      if (selectedMov.comprobante_id && (String(c.id) === String(selectedMov.comprobante_id))) {
        return true;
      }
      if (c.movimientoBancoId && String(c.movimientoBancoId) === String(selectedMov.id)) {
        return true;
      }

      // 1. Match by exact ID substring (highly reliable for new/modified entries using Date.now() or IDs containing the numeric string)
      if (c.id && selectedMov.id) {
        const idStr = String(selectedMov.id).toLowerCase();
        const cIdStr = String(c.id).toLowerCase();
        if (cIdStr === `comp-${idStr}` || cIdStr === idStr) {
          return true;
        }
        // Extract 13-digit timestamp if present
        const m13 = idStr.match(/\d{13}/)?.[0];
        const c13 = cIdStr.match(/\d{13}/)?.[0];
        if (m13 && c13) {
          const mTime = parseInt(m13, 10);
          const cTime = parseInt(c13, 10);
          if (mTime === cTime) {
            return true;
          }
          // Same transaction fallback: split by small millisecond skew (< 2500 ms) with same total and date
          if (Math.abs(mTime - cTime) < 2500 && Math.abs(Number(c.total) - Number(selectedMov.monto)) < 0.01 && c.fecha === selectedMov.fecha) {
            return true;
          }
        }
        if (cIdStr.includes(idStr) || idStr.includes(cIdStr)) {
          return true;
        }
      }

      // 2. Matching by reference cleaning (ONLY if comprobante doesn't belong to another movement)
      if (c.referencia && selectedMov.ref) {
        if (c.movimientoBancoId && String(c.movimientoBancoId) !== String(selectedMov.id)) {
          return false;
        }
        const cleanRef = (str: string) => String(str).trim().toLowerCase().replace(/^(out|in|trf|rec|asig|pag|cob|comp|mov|si|ant)-/, '');
        const refClean = cleanRef(selectedMov.ref);
        const compRefClean = cleanRef(c.referencia);
        const isGeneric = !refClean || refClean === 's/r' || refClean === 'sr';
        if (!isGeneric && refClean === compRefClean) {
          if (Math.abs(Number(c.total) - Number(selectedMov.monto)) < 0.01 && c.fecha === selectedMov.fecha) {
            return true;
          }
        }
      }

      // 3. Fallback match: if date match, and amount match, and descriptions are highly related or reference is close
      if (Number(c.total) === Number(selectedMov.monto) && c.fecha === selectedMov.fecha) {
        // Safe check for descriptions
        const desc1 = String(c.descripcion || '').toLowerCase();
        const desc2 = String(selectedMov.descripcion || '').toLowerCase();
        const cleanWords = (txt: string) => txt.split(/\s+/).filter(w => w.length > 3 && !['de', 'el', 'la', 'un', 'los', 'con', 'para', 'banco', 'pago'].includes(w));
        const words1 = cleanWords(desc1);
        const words2 = cleanWords(desc2);
        const common = words1.filter(w => words2.includes(w));
        
        if (common.length >= 2 || desc1.includes(desc2) || desc2.includes(desc1)) {
          return true;
        }

        // If they both have references that match partially, we can accept
        if (c.referencia && selectedMov.ref) {
          const r1 = String(c.referencia).toLowerCase();
          const r2 = String(selectedMov.ref).toLowerCase();
          if (r1.includes(r2) || r2.includes(r1)) {
            return true;
          }
        }
      }

      return false;
    });
  }, [selectedMov, selectedBank, comprobantes]);

  // Build the Double Entry lines
  const accountingEntries = useMemo(() => {
    if (!selectedMov || !selectedBank) return [];

    if (currentMatchedComprobante && currentMatchedComprobante.lineas && currentMatchedComprobante.lineas.length > 0) {
      return currentMatchedComprobante.lineas.map((l: any) => {
        const cuentaObj = cuentasContables.find(c => String(c.id) === String(l.cuentaId));
        return {
          cuenta: cuentaObj || {
            id: l.cuentaId,
            codigo: '---',
            nombre: `Cuenta ${l.cuentaId}`
          },
          tipo: l.debe > 0 ? 'Debe' : 'Haber',
          debe: Number(l.debe) || 0,
          haber: Number(l.haber) || 0,
          glosa: l.descripcion || currentMatchedComprobante.descripcion || selectedMov.descripcion || ''
        };
      });
    }
    
    // Bank account contrapartida (normally represented in assets) if no real comprobante is found
    const bancoCtaId = selectedBank.cuenta_contable_id || '1.1.2';
    const bancoCta = cuentasContables.find(c => String(c.id) === String(bancoCtaId)) || {
      id: bancoCtaId,
      codigo: '1.1.02.01',
      nombre: `Banco - ${selectedBank.banco} (${selectedBank.cuenta.slice(-4)})`
    };

    // Counterpart account
    const contraCtaId = selectedMov.cuentaContrapartida || '2.1.1';
    const contraCta = cuentasContables.find(c => String(c.id) === String(contraCtaId)) || {
      id: contraCtaId,
      codigo: '1.1.03.01' ,
      nombre: 'Cuenta de Transición o Cobranzas'
    };

    const t = (selectedMov.tipo || '').toLowerCase();
    const isIngreso = t === 'ingreso' || t === 'ingreso_directo' || t === 'deposito' || t === 'cobro' || t === 'cobranza' || t === 'transferencia_recibida' || t === 'ajuste_ganancia';
    const mAbs = Math.abs(Number(selectedMov.monto) || 0);
    
    if (isIngreso) {
      return [
        {
          cuenta: bancoCta,
          tipo: 'Debe',
          debe: mAbs,
          haber: 0,
          glosa: `Recepción de fondos Ref: ${selectedMov.ref}`
        },
        {
          cuenta: contraCta,
          tipo: 'Haber',
          debe: 0,
          haber: mAbs,
          glosa: selectedMov.descripcion || `Abono de cliente / Cobranza`
        }
      ];
    } else {
      return [
        {
          cuenta: contraCta,
          tipo: 'Debe',
          debe: mAbs,
          haber: 0,
          glosa: selectedMov.descripcion || `Gasto administratvo / Egreso`
        },
        {
          cuenta: bancoCta,
          tipo: 'Haber',
          debe: 0,
          haber: mAbs,
          glosa: `Debito de fondos Ref: ${selectedMov.ref}`
        }
      ];
    }
  }, [selectedMov, selectedBank, cuentasContables, currentMatchedComprobante]);

  const colorClasses = {
    indigo: {
      text: 'text-indigo-600',
      border: 'border-indigo-600',
      bgLight: 'bg-indigo-50/50',
      accent: 'indigo-600',
      hoverBg: 'hover:bg-indigo-50',
      bannerBg: 'bg-indigo-700'
    },
    emerald: {
      text: 'text-emerald-600',
      border: 'border-emerald-600',
      bgLight: 'bg-emerald-50/50',
      accent: 'emerald-600',
      hoverBg: 'hover:bg-emerald-50',
      bannerBg: 'bg-emerald-700'
    },
    slate: {
      text: 'text-slate-700',
      border: 'border-slate-800',
      bgLight: 'bg-slate-50/50',
      accent: 'slate-800',
      hoverBg: 'hover:bg-slate-100',
      bannerBg: 'bg-slate-800'
    },
    blue: {
      text: 'text-blue-600',
      border: 'border-blue-600',
      bgLight: 'bg-blue-50/50',
      accent: 'blue-600',
      hoverBg: 'hover:bg-blue-50',
      bannerBg: 'bg-blue-700'
    },
    sky: {
      text: 'text-sky-600',
      border: 'border-sky-600',
      bgLight: 'bg-sky-50/50',
      accent: 'sky-600',
      hoverBg: 'hover:bg-sky-50',
      bannerBg: 'bg-sky-700'
    }
  }[accentColor as 'indigo' | 'emerald' | 'slate' | 'blue' | 'sky'] || {
    text: 'text-indigo-600',
    border: 'border-indigo-600',
    bgLight: 'bg-indigo-50/50',
    accent: 'indigo-600',
    hoverBg: 'hover:bg-indigo-50',
    bannerBg: 'bg-indigo-700'
  };

  const renderComprobanteModal = () => {
    if (!showComprobanteModal || !currentMatchedComprobante) return null;

    const totalDebe = (currentMatchedComprobante.lineas || []).reduce((acc: number, curr: any) => acc + (Number(curr.debe) || 0), 0);
    const totalHaber = (currentMatchedComprobante.lineas || []).reduce((acc: number, curr: any) => acc + (Number(curr.haber) || 0), 0);

    return (
      <div 
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={() => setShowComprobanteModal(false)}
      >
        <div 
          className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100" 
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white flex justify-between items-center shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white/10 text-indigo-200 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border border-white/5">
                  Asiento Contable Relacionado
                </span>
                <span className="bg-emerald-500 text-white px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  {currentMatchedComprobante.estado || 'Contabilizado'}
                </span>
              </div>
              <h3 className="text-xl font-black mt-1.5 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Comprobante Contable: {currentMatchedComprobante.numero}
              </h3>
              <p className="text-xs text-indigo-200/80 font-medium mt-0.5">Visor oficial de partida contable doble generada por el sistema.</p>
            </div>
            <button 
              type="button"
              onClick={() => setShowComprobanteModal(false)} 
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
                <p className="text-sm font-extrabold text-slate-800 mt-1">{currentMatchedComprobante.fecha}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Referencia de Origen</label>
                <p className="text-sm font-bold text-indigo-650 mt-1 font-mono tracking-tight">{currentMatchedComprobante.referencia}</p>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Monto Consolidado</label>
                <p className="text-sm font-black text-slate-800 mt-1 font-mono hover:text-indigo-605 transition-colors">$ {formatoES(currentMatchedComprobante.total || totalDebe)}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200/65 shadow-sm space-y-1 text-xs">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Descripción o Concepto General</label>
              <p className="text-sm text-slate-700 font-extrabold">{currentMatchedComprobante.descripcion}</p>
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
                  {(currentMatchedComprobante.lineas || []).map((line: any, idx: number) => {
                    const cta = cuentasContables.find(c => String(c.id) === String(line.cuentaId));
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-4 pl-6">
                          <div className="font-extrabold text-slate-800">{cta?.nombre || `Cuenta ${line.cuentaId}`}</div>
                          <div className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">{cta?.codigo || '---'}</div>
                        </td>
                        <td className="p-4 text-slate-500 font-medium">
                          {line.descripcion || currentMatchedComprobante.descripcion}
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
              onClick={() => setShowComprobanteModal(false)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
            >
              Cerrar Vista de Asiento
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/30 font-sans print:bg-white pb-16">
      {/* Search and control bar (hidden in print) */}
      <div className="bg-white border-b border-slate-200 py-2 sm:py-2.5 px-4 sm:px-6 sticky top-0 z-50 print:hidden shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BackButton onClick={() => navigate(-1)} label="Volver a Tesorería" />
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 select-none">Comprobante de Caja y Bancos</h1>
              <p className="text-xs text-slate-400 font-medium">Soporte y validador de transacciones autorizadas</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Quick selectors for matching movements */}
            <div className="relative w-full md:w-72">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                <Search className="w-4 h-4" />
              </span>
              <select
                value={selectedMovId}
                onChange={(e) => setSelectedMovId(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 bg-white rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-slate-300 transition-colors shadow-sm"
              >
                <option value="" disabled>Seleccione un movimiento...</option>
                {movimientosBancos && [...movimientosBancos]
                  .sort((a,b) => b.fecha.localeCompare(a.fecha))
                  .map(m => {
                    const b = bancos.find(x => String(x.id) === String(m.banco_id));
                    const corrCode = movementCorrelatives.get(String(m.id)) || 'CMC-00000';
                    return (
                      <option key={m.id} value={m.id}>
                        [{corrCode}] {m.fecha} - {m.ref} - {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} ({b?.banco || 'Banco'})
                      </option>
                    );
                  })}
              </select>
            </div>

            {/* Ledger View Action */}
            <button
              onClick={() => navigate('/banks', { state: { subView: 'mayor_analitico', selectedBancoId: selectedMov?.banco_id } })}
              className="bg-indigo-600 border border-indigo-700 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-2 text-sm justify-center w-full md:w-auto cursor-pointer"
              title="Ir al Mayor Analítico de esta Cuenta"
            >
              <BookOpen className="w-4 h-4" />
              Mayor Analítico
            </button>

            {/* Print Action */}
            <button
              onClick={handlePrint}
              className="bg-slate-900 border border-slate-800 text-white font-bold px-4.5 py-2 rounded-xl transition-all shadow-md hover:bg-slate-800 flex items-center gap-2 text-sm justify-center w-full md:w-auto cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir / PDF
            </button>
          </div>
        </div>
      </div>

      {/* Main dashboard view layout */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-2 grid grid-cols-1 xl:grid-cols-4 gap-6 print:block print:p-0">
        
        {/* Formatting Settings panel (hidden in print) */}
        <div className="xl:col-span-1 space-y-4 print:hidden">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
            {/* Panel Header */}
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Opciones de Soporte</h3>
                <p className="text-[10px] text-slate-400 font-medium">Personalización de documento</p>
              </div>
            </div>
            
            {/* Template Accent Color Selector */}
            <div className="space-y-1.5 animate-in fade-in">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Color de Acento
              </label>
              <div className="flex items-center gap-2 pt-0.5">
                {[
                  { id: 'indigo', name: 'Índigo', bg: '#4f46e5' },
                  { id: 'emerald', name: 'Esmeralda', bg: '#10b981' },
                  { id: 'slate', name: 'Pizarra', bg: '#1e293b' },
                  { id: 'blue', name: 'Azul Real', bg: '#2563eb' },
                  { id: 'sky', name: 'Cian', bg: '#0ea5e9' }
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setAccentColor(c.id)}
                    style={{ backgroundColor: c.bg }}
                    className={`w-7 h-7 rounded-full transition-all flex items-center justify-center cursor-pointer shadow-xs ${
                      accentColor === c.id 
                        ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' 
                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                    title={c.name}
                  >
                    {accentColor === c.id && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Watermark Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Marca de Agua
              </label>
              <select
                value={watermark}
                onChange={(e) => setWatermark(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="none">Sin Marca de Agua</option>
                <option value="Procesado">Procesado (Recomendado)</option>
                <option value="Original">Original</option>
                <option value="Copia">Copia de Archivo</option>
                <option value="Auditado">Auditado</option>
              </select>
            </div>

            {/* Support Document Title */}
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                Título del Comprobante
              </label>
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                placeholder="Título del Comprobante"
              />
            </div>

            {/* Firmas de Soporte */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                  Firmas Responsables
                </span>
                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  Oficial
                </span>
              </div>
              
              {/* Realizado por */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-2.5 h-2.5" /> Realizado por
                </label>
                <input
                  type="text"
                  value={repRealizado}
                  onChange={(e) => setRepRealizado(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Aprobado por */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Aprobado por
                </label>
                <input
                  type="text"
                  value={repAprobado}
                  onChange={(e) => setRepAprobado(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Auditado por */}
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5" /> Auditado por
                </label>
                <input
                  type="text"
                  value={repAuditado}
                  onChange={(e) => setRepAuditado(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Extra formatting options checkboxes */}
            <div className="pt-3 border-t border-slate-100">
              <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 hover:text-slate-900 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showVoucherBorder}
                  onChange={(e) => setShowVoucherBorder(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span>Borde Exterior del Documento</span>
              </label>
            </div>
          </div>
          
          {/* Quick Info details */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-slate-800/80 rounded-2xl p-4 text-white shadow-sm text-xs">
            <div className="flex items-center gap-2 text-indigo-300 text-[10px] font-black uppercase tracking-wider mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Ajuste de Impresión</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Use orientación <strong>Vertical</strong> y márgenes <strong>Mínimos</strong> para una distribución limpia en 1 sola hoja física.
            </p>
          </div>
        </div>

        {/* Voucher card container */}
        <div className="xl:col-span-3 print:w-full print:block">
          {selectedMov && selectedBank ? (
            <>
              {currentMatchedComprobante && (
                <div className="mb-4 bg-white rounded-2xl border border-indigo-100 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 p-2.5 rounded-xl border border-indigo-100 text-indigo-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800">Se ha creado el asiento contable para este movimiento</h4>
                      <p className="text-xs text-slate-400 font-medium">Asiento {currentMatchedComprobante.numero} balanceado y contabilizado exitosamente.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowComprobanteModal(true)}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs uppercase tracking-wider px-4 py-2 rounded-xl transition-all border border-indigo-200/50 flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
                  >
                    Ver Comprobante Contable Creado
                  </button>
                </div>
              )}

              <div 
                id="printable-voucher"
                className={`bg-white rounded-2xl p-7 sm:p-9 relative overflow-hidden flex-1 flex flex-col justify-between min-h-[960px] print:min-h-0 print:h-[250mm] print:p-0 ${
                  showVoucherBorder ? 'border border-slate-300' : ''
                }`}
              >
                
                {/* Watermark Logo Display */}
                {watermark !== 'none' && (
                  <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.035] select-none pointer-events-none">
                    <span className="text-7xl md:text-8xl font-black tracking-widest uppercase origin-center rotate-[-25deg] text-slate-900 whitespace-nowrap">
                      {watermark}
                    </span>
                  </div>
                )}

                {/* Printable Body with Full-Height Flex Distribution */}
                <div className="relative z-10 flex-1 flex flex-col justify-between">
                  
                  {/* Top & Middle Content Group */}
                  <div className="space-y-6 sm:space-y-7 print:space-y-5">
                    
                    {/* 1. HEADER SECTION */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-slate-300">
                      {/* Company credentials */}
                      <div className="space-y-1 text-left">
                        {empresa?.logo ? (
                          <img 
                            src={empresa.logo} 
                            alt="Logo Empresa" 
                            className="max-h-11 w-auto object-contain object-left mb-1.5 print:max-h-10" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-7 h-7 rounded-lg ${colorClasses.bannerBg} flex items-center justify-center text-white font-bold text-xs`}>
                              {(empresa?.nombre || 'Mi Empresa S.A.')[0]}
                            </div>
                            <span className="text-sm font-bold tracking-tight text-slate-800">{empresa?.nombre || 'Mi Empresa S.A.'}</span>
                          </div>
                        )}
                        <h2 className="text-xs font-bold uppercase text-slate-800 leading-tight">{empresa?.nombre || 'Mi Empresa S.A.'}</h2>
                        <p className="text-[10px] font-semibold text-slate-500 font-mono tracking-wider uppercase">
                          RIF: {empresa?.rif || 'J-40003000-0'} {empresa?.telefono ? `| TEL: ${empresa.telefono}` : ''}
                        </p>
                        <p className="text-[10px] text-slate-400 leading-snug max-w-sm font-medium">{empresa?.direccion || 'Sede Administrativa Principal'}</p>
                      </div>

                      {/* Document metadata */}
                      <div className="text-left sm:text-right space-y-1.5">
                        <div className="flex items-center sm:justify-end gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full border ${
                            selectedMov.tipo === 'ingreso' || selectedMov.tipo === 'ajuste_ganancia' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                            : 'bg-rose-50 text-rose-700 border-rose-300'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${selectedMov.tipo === 'ingreso' || selectedMov.tipo === 'ajuste_ganancia' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            {selectedMov.tipo === 'ingreso' || selectedMov.tipo === 'ajuste_ganancia' ? 'SOPORTE DE INGRESO' : 'SOPORTE DE EGRESO'}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight uppercase tracking-tight">{documentTitle}</h3>
                        <div className="flex flex-wrap items-center gap-x-2 sm:justify-end text-xs font-mono font-medium text-slate-600">
                          <span>Nº Referencia:</span>
                          <strong className="text-slate-800 font-bold">{selectedMov.ref}</strong>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 sm:justify-end text-xs font-mono font-medium text-slate-600">
                          <span>Correlativo:</span>
                          <strong className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-bold text-[11px]">
                            {movementCorrelatives.get(String(selectedMov.id)) || 'CMC-00000'}
                          </strong>
                          {currentMatchedComprobante?.numero ? (
                            <strong className="text-indigo-600 font-semibold bg-indigo-50/70 px-1.5 py-0.5 rounded border border-indigo-200/60 text-[11px]">
                              Asiento #{currentMatchedComprobante.numero}
                            </strong>
                          ) : (
                            <strong className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 text-[10px] font-semibold">
                              SIN ASIENTO
                            </strong>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">
                          Generado: {new Date(selectedMov.createdAt || Date.now()).toLocaleDateString('es-ES')} - {new Date(selectedMov.createdAt || Date.now()).toLocaleTimeString('es-ES')}
                        </div>
                      </div>
                    </div>

                    {/* 2. TRANSACTION MAIN FIELDS */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 bg-slate-50/80 border border-slate-300 rounded-xl p-3.5 text-slate-700">
                      
                      {/* Column 1: Date */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" /> Fecha Valor
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-800">{selectedMov.fecha}</p>
                      </div>

                      {/* Column 2: Account info */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-slate-400" /> Cuenta de Cargo
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-800 truncate" title={selectedBank.banco}>
                          {selectedBank.banco}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 tracking-wider">
                          {selectedBank.cuenta}
                        </p>
                      </div>

                      {/* Column 3: Operation type */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <Layers className="w-3 h-3 text-slate-400" /> Operación
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-800 capitalize">
                          {selectedMov.tipo === 'ingreso' ? 'Ingreso de Fondos' : 
                           selectedMov.tipo === 'egreso' ? 'Egreso de Fondos' : 
                           selectedMov.tipo === 'ajuste_ganancia' ? 'Ajuste Ganancia FX' : 'Ajuste Pérdida FX'}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 tracking-wider">
                          {selectedMov.isCuarentena ? 'En Cuarentena' : 'Asentado en Mayor'}
                        </p>
                      </div>

                      {/* Column 4: Currency & Status */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" /> Moneda & Estatus
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1">
                          <span>{selectedBank.moneda}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedMov.estado === 'activo' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span className="text-[10px] font-semibold font-mono text-slate-500 capitalize">{selectedMov.estado}</span>
                        </p>
                        {selectedMov.tasa && selectedMov.tasa !== 1 ? (
                          <p className="text-[10px] font-mono text-slate-500">
                            Tasa: Bs. {formatoES(selectedMov.tasa)}
                          </p>
                        ) : (
                          <p className="text-[10px] font-mono text-slate-400">Multidivisa: No</p>
                        )}
                      </div>
                    </div>

                    {/* 3. ORIGINAL CONCEPT DESCRIPTION */}
                    <div className="border border-slate-300 rounded-xl p-3.5 bg-slate-50/50 space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                        Concepto de Transacción / Glosa descriptiva
                      </span>
                      <p className="text-xs sm:text-sm font-medium text-slate-800 break-words leading-relaxed">
                        {selectedMov.descripcion || '(Sin glosa descriptiva registrada)'}
                      </p>
                    </div>

                    {/* 4. DETAILS - CONTABILIZACIÓN POR PARTIDA DOBLE ASOCIADA */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <span>Detalle Tributario y Contable (Asiento Generado)</span>
                        </h4>
                        <span className="text-[10px] font-mono font-medium text-slate-400">
                          {accountingEntries.length} {accountingEntries.length === 1 ? 'partida' : 'partidas'}
                        </span>
                      </div>

                      <div className="border border-slate-300 rounded-xl overflow-hidden">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-bold uppercase text-slate-600 font-mono tracking-wider">
                              <th className="py-2.5 px-4 pl-4.5">Código Cuenta</th>
                              <th className="py-2.5 px-4">Nombre de la Cuenta</th>
                              <th className="py-2.5 px-4">Glosa Detalle</th>
                              <th className="py-2.5 px-4 text-right">Débito (Debe)</th>
                              <th className="py-2.5 px-4 text-right pr-4.5">Crédito (Haber)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-medium">
                            {accountingEntries.map((line, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="py-3 px-4 pl-4.5 font-mono text-slate-600 font-semibold text-xs">
                                  {line.cuenta?.codigo || '---'}
                                </td>
                                <td className="py-3 px-4 text-slate-800 font-semibold text-xs">
                                  {line.cuenta?.nombre || 'Cuenta Contable'}
                                </td>
                                <td className="py-3 px-4 text-slate-400 font-normal text-[11px] max-w-xs truncate">
                                  {line.glosa}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-slate-800 font-mono text-xs">
                                  {line.debe > 0 ? `$ ${formatoES(line.debe)}` : '-'}
                                </td>
                                <td className="py-3 px-4 text-right font-bold text-slate-800 font-mono text-xs pr-4.5">
                                  {line.haber > 0 ? `$ ${formatoES(line.haber)}` : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 5. FINANCIAL VALUE TOTALS */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-stretch gap-4 pt-1">
                      {/* Legal note */}
                      <div className="flex-1 border border-slate-300 bg-slate-50/40 rounded-xl p-3.5 text-slate-500 text-[11px] leading-relaxed flex items-center gap-2.5">
                        <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                        <p>
                          Este soporte de tesorería constituye un duplicado fiel y permanente de la operación bancaria asentada en el libro auxiliar de mayor analítico contable.
                        </p>
                      </div>

                      {/* Summary card with totals */}
                      <div className="p-3.5 sm:p-4 rounded-xl border border-slate-300 flex flex-col justify-center min-w-[270px] text-right bg-slate-50 text-slate-800">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                          Monto Consolidado
                        </span>
                        
                        {/* Primary USD display */}
                        <div className="flex justify-between items-center gap-4 font-mono border-b border-slate-200 pb-1.5 mb-1.5">
                          <span className="text-xs font-bold text-slate-500 font-sans uppercase">Total Operación:</span>
                          <strong className="text-base sm:text-lg font-bold text-slate-900">$ {formatoES(selectedMov.monto)}</strong>
                        </div>

                        {/* Secondary currency conversion */}
                        {selectedBank.moneda === 'Bolivares' || (selectedMov.tasa && selectedMov.tasa > 1) ? (
                          <div className="flex justify-between items-center gap-4 font-mono text-xs">
                            <span className="font-semibold text-slate-500 font-sans uppercase text-[10px]">Monto VES:</span>
                            <strong className="text-indigo-700 font-bold">
                              Bs. {formatoES(
                                (selectedMov.montoBs !== undefined && selectedMov.montoBs !== null && selectedMov.montoBs !== '')
                                  ? selectedMov.montoBs
                                  : (selectedMov.monto * (selectedMov.tasa || parseFloat(selectedBank.tasa) || 1))
                              )}
                            </strong>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center gap-4 font-mono text-[9px] text-slate-400">
                            <span className="font-semibold font-sans uppercase">Ajuste de Cierre:</span>
                            <span>Multi-Tasa no requerida</span>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* 6. SIGNATURES SECTION (Anchored at the bottom of the page) */}
                  <div className="pt-10 sm:pt-14 pb-2 print:pb-0">
                    <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto">
                      {/* Signature 1: Realizado */}
                      <div className="flex flex-col items-center text-center">
                        <div className="w-full max-w-[170px] border-b border-slate-400 pb-1 mx-auto" />
                        <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider mt-1.5 block">
                          Elaborado / Realizado
                        </span>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">{repRealizado}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-mono tracking-wider">Firma Autorizada</p>
                      </div>

                      {/* Signature 2: Aprobado */}
                      <div className="flex flex-col items-center text-center">
                        <div className="w-full max-w-[170px] border-b border-slate-400 pb-1 mx-auto" />
                        <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider mt-1.5 block">
                          Revisado / Aprobado
                        </span>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">{repAprobado}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-mono tracking-wider">Gerencia General</p>
                      </div>

                      {/* Signature 3: Auditado */}
                      <div className="flex flex-col items-center text-center">
                        <div className="w-full max-w-[170px] border-b border-slate-400 pb-1 mx-auto" />
                        <span className="text-[9px] font-bold uppercase text-slate-500 tracking-wider mt-1.5 block">
                          Auditado / Validado
                        </span>
                        <p className="text-xs font-bold text-slate-800 mt-0.5">{repAuditado}</p>
                        <p className="text-[9px] text-slate-400 uppercase font-mono tracking-wider">Unidad Contralora</p>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm flex flex-col items-center justify-center min-h-[400px]">
              <AlertCircle className="w-12 h-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-extrabold text-slate-800">Cargando transacción...</h3>
              <p className="text-sm text-slate-400 mt-1">
                Seleccione un movimiento en el selector superior para generar su soporte de impresión contable.
              </p>
            </div>
          )}
        </div>

      </div>

      {showComprobanteModal && renderComprobanteModal()}

      <PrintPreview 
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title={printModalTitle}
        defaultOrientation={printModalOrientation}
        defaultShowHeader={false}
        defaultShowFooter={false}
        defaultCompactSpacing={false}
        defaultAutoFitOnePage={false}
        hideDocumentTitle={true}
      >
        {printModalContent}
      </PrintPreview>
    </div>
  );
}
