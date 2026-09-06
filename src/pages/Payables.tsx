import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  Users, Building, Briefcase, UserCircle, PhoneCall, Search, Filter, Download, Plus, 
  ArrowRight, ArrowLeft, Landmark, FileText, CheckCircle, ShoppingCart, X, Save, 
  CornerDownRight, Package, Trash2, ChevronDown, Eye, EyeOff, Handshake, Plane, 
  UserCheck, Percent, Clock, AlertTriangle, ShieldCheck, Mail, Phone, ExternalLink, 
  DollarSign, ArrowDownLeft, FileSpreadsheet, Send, BarChart2, Coins, RotateCcw, 
  MessageSquare, Calendar, Printer, Lock 
} from 'lucide-react';
import CuentaContableModal from '../components/common/CuentaContableModal';
import { PrintPreview } from '../components/PrintPreview';
import { dbResetAllTestData } from '../services/db';
import { useCompany } from '../context/CompanyContext';
import MasterAuthModal from '../components/common/MasterAuthModal';
import BackButton from '../components/common/BackButton';

const VoucherPreviewModal = ({ 
  isOpen, 
  onClose, 
  initialComprobante, 
  cuentasContables = [], 
  onConfirm 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  initialComprobante: any; 
  cuentasContables: any[]; 
  onConfirm: (finalComprobante: any) => void; 
}) => {
  const [comprobante, setComprobante] = useState<any>(null);

  useEffect(() => {
    if (initialComprobante) {
      setComprobante(JSON.parse(JSON.stringify(initialComprobante))); // Deep clone
    }
  }, [initialComprobante]);

  if (!isOpen || !comprobante) return null;

  const handleLineChange = (index: number, field: string, value: any) => {
    const updatedLineas = [...comprobante.lineas];
    updatedLineas[index] = { ...updatedLineas[index], [field]: value };
    
    // Recalculate totals
    const totalDebe = updatedLineas.reduce((acc, curr) => acc + (Number(curr.debe) || 0), 0);
    const totalHaber = updatedLineas.reduce((acc, curr) => acc + (Number(curr.haber) || 0), 0);
    const isBalanced = Math.abs(totalDebe - totalHaber) < 0.01;

    setComprobante({
      ...comprobante,
      lineas: updatedLineas,
      total: Math.max(totalDebe, totalHaber),
      estado: isBalanced ? 'Contabilizado' : 'Descuadrado'
    });
  };

  const handleAddLine = () => {
    const newLine = {
      id: `l-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      cuentaId: '',
      descripcion: comprobante.descripcion || 'Línea de Comprobante',
      debe: 0,
      haber: 0
    };
    setComprobante({
      ...comprobante,
      lineas: [...comprobante.lineas, newLine]
    });
  };

  const handleRemoveLine = (index: number) => {
    const updatedLineas = comprobante.lineas.filter((_: any, i: number) => i !== index);
    const totalDebe = updatedLineas.reduce((acc: number, curr: any) => acc + (Number(curr.debe) || 0), 0);
    const totalHaber = updatedLineas.reduce((acc: number, curr: any) => acc + (Number(curr.haber) || 0), 0);
    const isBalanced = Math.abs(totalDebe - totalHaber) < 0.01;

    setComprobante({
      ...comprobante,
      lineas: updatedLineas,
      total: Math.max(totalDebe, totalHaber),
      estado: isBalanced ? 'Contabilizado' : 'Descuadrado'
    });
  };

  const totalDebe = comprobante.lineas.reduce((acc: number, curr: any) => acc + (Number(curr.debe) || 0), 0);
  const totalHaber = comprobante.lineas.reduce((acc: number, curr: any) => acc + (Number(curr.haber) || 0), 0);
  const diff = totalDebe - totalHaber;
  const isBalanced = Math.abs(diff) < 0.01;

  const activeCuentas = cuentasContables
    .filter(c => c.tipo === 'Movimiento')
    .sort((a,b)=>(a.codigo||'').localeCompare(b.codigo||''));

  const formatES = (num: number | string) => {
    if (num === undefined || num === null || num === "") return "0,00";
    const parsed = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(parsed)) return "0,00";
    return parsed.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
        <div className="bg-gradient-to-r from-violet-700 to-indigo-700 p-6 text-white flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                Previsualización de Asiento
              </span>
              {!isBalanced && (
                <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider animate-pulse">
                  Descuadrado
                </span>
              )}
            </div>
            <h3 className="text-xl font-black mt-1">Revisión de Comprobante Contable</h3>
            <p className="text-xs text-indigo-200 font-medium mt-0.5">Asigne las cuentas contables correctas para evitar errores de comprobantes.</p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50">
          <div className="bg-white p-4 rounded-xl border border-slate-200/65 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Número de Comprobante</label>
              <p className="text-sm font-bold text-slate-800 mt-1">{comprobante.numero}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha de Registro</label>
              <input
                type="date"
                className="w-full px-2 py-1 mt-1 bg-slate-50 border border-slate-200 rounded text-sm font-bold text-slate-700 outline-none"
                value={comprobante.fecha}
                onChange={e => setComprobante({ ...comprobante, fecha: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Referencia Física / ID</label>
              <p className="text-sm font-mono font-bold text-slate-700 mt-1">{comprobante.referencia}</p>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Estado Comprobante</label>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mt-1 shadow-sm ${isBalanced ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                <span className={`w-2 h-2 rounded-full ${isBalanced ? 'bg-emerald-500' : 'bg-red-500 animate-ping'}`} />
                {isBalanced ? 'Listo' : 'Por cuadrar'}
              </span>
            </div>
            <div className="col-span-1 md:col-span-4 border-t border-slate-100 pt-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Descripción Principal</label>
              <input
                type="text"
                className="w-full px-3 py-1.5 mt-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 outline-none focus:border-indigo-500"
                value={comprobante.descripcion}
                onChange={e => setComprobante({ ...comprobante, descripcion: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detalle del Asiento (Partida Doble)</span>
              <button
                type="button"
                onClick={handleAddLine}
                className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1.5"
              >
                <Plus size={14} />
                Agregar Línea
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 shadow-md overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="py-3 px-4 w-1/3">Cuenta Contable</th>
                    <th className="py-3 px-4 w-2/5">Descripción de Línea</th>
                    <th className="py-3 px-4 text-right w-24">Debe ($)</th>
                    <th className="py-3 px-4 text-right w-24">Haber ($)</th>
                    <th className="py-3 px-4 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comprobante.lineas.map((line: any, index: number) => (
                    <tr key={line.id} className="hover:bg-slate-50/50 transition-colors font-medium">
                      <td className="p-2">
                        <select
                          className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold focus:border-indigo-500 outline-none max-w-md"
                          value={line.cuentaId}
                          onChange={e => handleLineChange(index, 'cuentaId', e.target.value)}
                        >
                          <option value="">Seleccione cuenta...</option>
                          {activeCuentas.map(c => (
                            <option key={c.id} value={c.id}>{c.codigo} - {c.nombre}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:border-indigo-500 outline-none"
                          value={line.descripcion}
                          onChange={e => handleLineChange(index, 'descripcion', e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-24 p-2 text-right border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:border-indigo-500 outline-none"
                          value={line.debe || ''}
                          onChange={e => handleLineChange(index, 'debe', e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-24 p-2 text-right border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:border-indigo-500 outline-none"
                          value={line.haber || ''}
                          onChange={e => handleLineChange(index, 'haber', e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-center text-slate-400">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(index)}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100/60 transition-colors"
                          title="Eliminar línea"
                          disabled={comprobante.lineas.length <= 1}
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="text-slate-500 flex flex-wrap gap-4 text-xs font-semibold">
                  <span>Diferencia: 
                    <span className={`ml-1.5 font-bold ${isBalanced ? 'text-emerald-600' : 'text-red-600'}`}>
                      $ {formatES(diff)}
                    </span>
                  </span>
                  <span>Líneas: <span className="text-slate-800 font-bold">{comprobante.lineas.length}</span></span>
                </div>
                <div className="flex gap-6 text-sm font-bold text-slate-700">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase font-black">Total Debe</p>
                    <p className="text-base text-indigo-700">$ {formatES(totalDebe)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase font-black">Total Haber</p>
                    <p className="text-base text-violet-700">$ {formatES(totalHaber)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200/80 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(comprobante)}
            disabled={!isBalanced}
            className={`px-6 py-2.5 rounded-xl text-sm font-black text-white shadow-sm flex items-center gap-2 transition-colors ${isBalanced ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed text-slate-500'}`}
          >
            <CheckCircle size={16} />
            Confirmar y Registrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Payables({ cxc = [], cxp = [], pagosRealizados = [], comprobantes = [], bancos = [], movimientosBancos = [], proveedores = [], contactos = [], cuentasContables = [], configContable, onSave, showToast, workingYear }: { cxc?: any[], cxp?: any[], pagosRealizados?: any[], comprobantes?: any[], bancos?: any[], movimientosBancos?: any[], proveedores?: any[], contactos?: any[], cuentasContables?: any[], configContable?: any, onSave?: any, showToast?: any, workingYear?: string }) {
  const { activeCompanyId } = useCompany();
  const { category } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(category || 'proveedores');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [hideZeroBalances, setHideZeroBalances] = useState(true);

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

  // Estado para el módulo de pago
  const [pagoForm, setPagoForm] = useState({
    bancoId: '',
    referencia: '',
    fecha: new Date().toISOString().split('T')[0],
    proveedorId: '',
    tasa: 1
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

  // Estado para el modal de nuevo movimiento bancario (Cuentas por pagar no proveedores)
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
    const term = (newMovSupplierSearchTerm || '').toLowerCase();
    
    return contactos.filter(c => {
      let isMatch = false;
      switch(activeTab) {
         case 'aerolineas':
           isMatch = c.type === 'airline';
           break;
         case 'freelance':
           isMatch = c.type === 'freelance' || c.type === 'customs_agency';
           break;
         case 'proveedores':
         case 'pago':
           isMatch = ['supplier', 'both', 'airline'].includes(c.type);
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
           isMatch = ['supplier', 'both', 'airline', 'freelance', 'customs_agency', 'aliado', 'intercompany', 'shareholder', 'employee'].includes(c.type);
      }
      return isMatch && ((c.taxId || '').toLowerCase().includes(term) || (c.name || '').toLowerCase().includes(term));
    });
  }, [contactos, newMovSupplierSearchTerm, activeTab]);

  const filteredProvisionEntities = useMemo(() => {
    const term = (provisionSupplierSearchTerm || '').toLowerCase();
    
    return contactos.filter(c => {
      let isMatch = false;
      switch(activeTab) {
         case 'aerolineas':
           isMatch = c.type === 'airline';
           break;
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
           isMatch = ['supplier', 'both', 'airline', 'freelance', 'customs_agency', 'aliado', 'intercompany', 'shareholder', 'employee'].includes(c.type);
      }
      return isMatch && ((c.taxId || '').toLowerCase().includes(term) || (c.name || '').toLowerCase().includes(term));
    });
  }, [contactos, provisionSupplierSearchTerm, activeTab]);

  const filteredAnticipoEntities = useMemo(() => {
    const term = (anticipoSupplierSearchTerm || '').toLowerCase();
    
    return contactos.filter(c => {
      let isMatch = false;
      switch(activeTab) {
         case 'aerolineas':
           isMatch = c.type === 'airline';
           break;
         case 'freelance':
           isMatch = c.type === 'freelance' || c.type === 'customs_agency';
           break;
         case 'proveedores':
         case 'pago':
           isMatch = ['supplier', 'both', 'airline'].includes(c.type);
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
           isMatch = ['supplier', 'both', 'airline', 'freelance', 'customs_agency', 'aliado', 'intercompany', 'shareholder', 'employee'].includes(c.type);
      }
      return isMatch && ((c.taxId || '').toLowerCase().includes(term) || (c.name || '').toLowerCase().includes(term));
    });
  }, [contactos, anticipoSupplierSearchTerm, activeTab]);

  const filteredSaldoInicialSupplierEntities = useMemo(() => {
    const term = (saldoInicialSupplierSearchTerm || '').toLowerCase();
    
    return contactos.filter(c => {
      let isMatch = false;
      switch(activeTab) {
         case 'aerolineas':
           isMatch = c.type === 'airline';
           break;
         case 'freelance':
           isMatch = c.type === 'freelance' || c.type === 'customs_agency';
           break;
         case 'proveedores':
         case 'pago':
           isMatch = ['supplier', 'both', 'airline'].includes(c.type);
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
           isMatch = ['supplier', 'both', 'airline', 'freelance', 'customs_agency', 'aliado', 'intercompany', 'shareholder', 'employee'].includes(c.type);
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
    { id: 'aerolineas', label: 'Aerolíneas', icon: Plane },
    { id: 'proveedores', label: 'Proveedores', icon: Users },
    { id: 'freelance', label: 'Freelance', icon: UserCheck },
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
      return cat === activeTab;
    });
  }, [cxp, activeTab]);

  // Group data by supplier for the main table
  const groupedData = useMemo(() => {
    if (activeTab === 'pago') return [];
    
    const groups: Record<string, any> = {};
    
    tabData.forEach(item => {
      const contactObj = contactos.find(c => 
        (item.proveedor_id && (c.id === item.proveedor_id || c.taxId === item.proveedor_id)) ||
        (item.proveedor && c.name?.toLowerCase() === item.proveedor.toLowerCase())
      );
      
      const key = contactObj?.taxId || contactObj?.id || item.proveedor_id || item.proveedor;
      
      if (!groups[key]) {
        groups[key] = {
          id: key,
          proveedor: item.proveedor || contactObj?.name,
          montoAdeudo: 0,
          abonosAplicados: 0,
          saldoPendiente: 0,
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
      
      // 1. Calculate active pagos (payments) from the pagosRealizados collection
      const activePagos = (pagosRealizados || []).filter((p: any) => {
        if (p.estado === 'anulado') return false;
        if (p.proveedorId && String(p.proveedorId) === supplierIdStr) return true;
        if (p.proveedorNombre && p.proveedorNombre.toLowerCase() === supplierNameLower) return true;
        return false;
      });
      
      const totalPagadoEnPagosRealizados = activePagos.reduce((sum: number, p: any) => sum + (Number(p.monto) || 0), 0);
      
      // 2. Calculate payments applied directly within the cxp documents (total - saldo)
      const pagosEnDocs = g.documentos.reduce((sum: number, d: any) => {
        const totalDoc = Number(d.total) || 0;
        const saldoDoc = Number(d.saldo) || 0;
        if (totalDoc > 0) {
          const paid = totalDoc - saldoDoc;
          return sum + (paid > 0 ? paid : 0);
        }
        return sum;
      }, 0);
      
      // 3. Also account for unused/available anticipos (anticipos in cxp have total < 0 and act as abonos while they have negative saldo)
      const totalAnticiposUnused = g.documentos.reduce((sum: number, d: any) => {
        const t = Number(d.total) || 0;
        const s = Number(d.saldo) || 0;
        return sum + (t < 0 ? Math.abs(s) : 0);
      }, 0);
      
      // Use the maximum of payments and document-applied payments to be 100% robust
      const basePagado = Math.max(pagosEnDocs, totalPagadoEnPagosRealizados);
      
      g.abonosAplicados = basePagado + totalAnticiposUnused;
      g.saldoPendiente = g.montoAdeudo - g.abonosAplicados;
      
      g.documentos.sort((a: any, b: any) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
    });

    return Object.values(groups)
      .filter((g: any) => {
        const matchesSearch = (g.proveedor?.toLowerCase() || '').includes((searchTerm || '').toLowerCase());
        if (!matchesSearch) return false;
        if (hideZeroBalances) {
          return Math.abs(g.saldoPendiente) > 0.009 || Math.abs(g.montoAdeudo) > 0.009;
        }
        return true;
      })
      .sort((a: any, b: any) => b.saldoPendiente - a.saldoPendiente);
  }, [tabData, activeTab, searchTerm, hideZeroBalances, contactos, pagosRealizados]);

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
    return groupedData.find(g => g.id === selectedSupplier.id) || selectedSupplier;
  }, [groupedData, selectedSupplier]);

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
    const supplierNameLow = selectedSupplierObj?.nombre?.toLowerCase() || '';
    return cxp.filter(item => {
      const matchId = String(item.proveedor_id) === String(pagoForm.proveedorId) || String(item.proveedor) === String(pagoForm.proveedorId);
      const matchName = supplierNameLow && item.proveedor && item.proveedor.toLowerCase() === supplierNameLow;
      return (matchId || matchName) && Number(item.saldo) > 0;
    }).sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
  }, [cxp, pagoForm.proveedorId, selectedSupplierObj]);

  const selectedSupplierAnticipos = useMemo(() => {
    if (!pagoForm.proveedorId) return [];
    const supplierNameLow = selectedSupplierObj?.nombre?.toLowerCase() || '';
    return cxp.filter(item => {
      const matchId = String(item.proveedor_id) === String(pagoForm.proveedorId) || String(item.proveedor) === String(pagoForm.proveedorId);
      const matchName = supplierNameLow && item.proveedor && item.proveedor.toLowerCase() === supplierNameLow;
      return (matchId || matchName) && Number(item.saldo) < 0;
    }).sort((a, b) => new Date(a.fecha || 0).getTime() - new Date(b.fecha || 0).getTime());
  }, [cxp, pagoForm.proveedorId, selectedSupplierObj]);

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

    if (totalFacturasAplicadas <= 0 && totalAnticiposAplicados <= 0) return showToast?.('Debe aplicar al menos un monto', 'error');
    if (montoBanco < 0) return showToast?.('El total de anticipos aplicados no puede superar el total de facturas a pagar', 'error');
    if (montoBanco > 0 && !pagoForm.bancoId) return showToast?.('Seleccione un banco para el pago', 'error');
    if (montoBanco > 0 && !pagoForm.referencia) return showToast?.('Ingrese un número de referencia para el pago', 'error');

    if (montoBanco > 0 && pagoForm.bancoId) {
      const lockDate = getSapsLockDate(pagoForm.bancoId);
      if (lockDate && pagoForm.fecha <= lockDate) {
        return showToast?.(`Error: Existe un cierre SAPS en ${lockDate}. Use una fecha posterior.`, 'error');
      }
    }

    try {
      const nowTs = Date.now().toString();

      // 0. Obtener cuentas contables correspondientes
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

      const entidadNombre = contactObj?.name || proveedorObj?.nombre || selectedSupplierObj?.nombre || 'Colaborador/Proveedor';

      const finalRef = pagoForm.referencia || `PAG-${nowTs.slice(-4)}`;

      // 1. Preparar borrador de movimiento bancario (egreso) si hay monto a pagar
      const draftMov = montoBanco > 0 ? {
        id: nowTs,
        banco_id: pagoForm.bancoId,
        fecha: pagoForm.fecha,
        ref: finalRef,
        descripcion: `Pago a ${isEmployeeOrFreelancer ? 'colaborador' : 'proveedor'} ${entidadNombre}`,
        tipo: 'egreso' as const,
        monto: montoBanco,
        tasa: pagoForm.tasa || 1,
        estado: 'activo',
        cuenta_contable_id: cuentaEntidad
      } : null;

      // 4. Crear comprobante contable
      const banco = bancos.find(b => b.id === pagoForm.bancoId);
      
      const cuentaBanco = banco?.cuenta_contable_id || '1.1.3';
      const cuentaAnticipo = configContable?.cuentaAnticipoOtorgado || '1.1.4';

      const lineas = [];
      
      if (totalFacturasAplicadas > 0) {
        lineas.push({
          id: `l1-${nowTs}`,
          cuentaId: cuentaEntidad,
          descripcion: `Pago a ${isEmployeeOrFreelancer ? 'colaborador' : 'proveedor'} ${entidadNombre} - CxP`,
          debe: totalFacturasAplicadas,
          haber: 0
        });
      }

      if (montoBanco > 0) {
        lineas.push({
          id: `l2-${nowTs}`,
          cuentaId: cuentaBanco,
          descripcion: `Transf. Banco ${banco?.banco || ''} - Pago a ${isEmployeeOrFreelancer ? 'colaborador' : 'proveedor'} ${entidadNombre}`,
          debe: 0,
          haber: montoBanco
        });
      }
      
      if (totalAnticiposAplicados > 0) {
        lineas.push({
          id: `l3-${nowTs}`,
          cuentaId: cuentaAnticipo,
          descripcion: `Aplicación de anticipo - ${isEmployeeOrFreelancer ? 'Colaborador' : 'Proveedor'} ${entidadNombre}`,
          debe: 0,
          haber: totalAnticiposAplicados
        });
      }

      let newComprobante: any = null;
      if (lineas.length > 0) {
        const isBalanced = Math.abs(lineas.reduce((s,l)=>s+(Number(l.debe)||0),0) - lineas.reduce((s,l)=>s+(Number(l.haber)||0),0)) < 0.01;
        const isDescuadrado = !isBalanced || lineas.some(l => !l.cuentaId);
        newComprobante = {
          id: `comp-pago-${nowTs}`,
          fecha: pagoForm.fecha,
          numero: `CMP-${nowTs.slice(-6)}`,
          tipo: 'Diario',
          descripcion: `Pago de facturas - ${isEmployeeOrFreelancer ? 'Colaborador' : 'Proveedor'} ${entidadNombre}`,
          referencia: finalRef,
          total: totalFacturasAplicadas,
          estado: isDescuadrado ? 'Descuadrado' : 'Contabilizado',
          lineas
        };
      }

      if (newComprobante) {
        setPendingVoucher({
          comprobante: newComprobante,
          movimiento: draftMov,
          onConfirm: async (finalComprobante: any) => {
            if (onSave) {
              if (draftMov) {
                onSave('movimientosBancos', draftMov);
              }

              // 2. Actualizar saldos de las facturas en cxp
              Object.entries(abonos).forEach(([docId, montoAbonado]) => {
                const montoNum = Number(montoAbonado);
                if (montoNum > 0) {
                  const doc = cxp.find(d => d.id === docId);
                  if (doc) {
                    const newSaldo = doc.saldo - montoNum;
                    const newEstado = newSaldo <= 0.01 ? 'pagada' : (doc.estado || 'activo');
                    onSave('cxp', { ...doc, saldo: newSaldo, estado: newEstado });
                  }
                }
              });

              // 3. Actualizar saldos de los anticipos en cxp usando FIFO
              let remainingAnticipoToApply = totalAnticiposAplicados;
              for (const anticipoDoc of selectedSupplierAnticipos) {
                if (remainingAnticipoToApply <= 0) break;
                
                const saldoAbs = Math.abs(Number(anticipoDoc.saldo) || 0);
                if (saldoAbs > 0) {
                  const amountToApplyToThisDoc = Math.min(saldoAbs, remainingAnticipoToApply);
                  
                  onSave('cxp', { 
                    ...anticipoDoc, 
                    saldo: anticipoDoc.saldo + amountToApplyToThisDoc
                  });
                  
                  remainingAnticipoToApply -= amountToApplyToThisDoc;
                }
              }

              onSave('comprobantes', finalComprobante);

              // 4. Registrar historial de pago realizado
              const newPagoRealizado = {
                id: `pago-${nowTs}`,
                fecha: pagoForm.fecha,
                proveedorNombre: entidadNombre,
                proveedorId: String(pagoForm.proveedorId),
                monto: totalFacturasAplicadas,
                referencia: pagoForm.referencia || `PAG-${nowTs.slice(-4)}`,
                comprobanteId: finalComprobante.id,
                movimientoBancoId: draftMov?.id || null,
                estado: 'activo',
                abonos: abonos, // mapping of docId to amount paid
                anticiposAplicados: totalAnticiposAplicados,
                bancoId: pagoForm.bancoId,
                tasa: pagoForm.tasa || 1,
              };
              onSave('pagos-realizados', newPagoRealizado);
            }

            showToast?.('Pago procesado exitosamente', 'success');
            setPendingVoucher(null);
            setPagoForm({ ...pagoForm, referencia: '', proveedorId: '' });
            setAbonos({});
            setAnticipoGlobal('');

            if (draftMov) {
              navigate('/reports/comprobante-movimiento-banco', { state: { movimiento: draftMov } });
            }
          }
        });
      } else {
        // No accounting entry necessary, execute directly
        if (onSave) {
          // 2. Actualizar saldos de las facturas en cxp
          Object.entries(abonos).forEach(([docId, montoAbonado]) => {
            const montoNum = Number(montoAbonado);
            if (montoNum > 0) {
              const doc = cxp.find(d => d.id === docId);
              if (doc) {
                const newSaldo = doc.saldo - montoNum;
                const newEstado = newSaldo <= 0.01 ? 'pagada' : (doc.estado || 'activo');
                onSave('cxp', { ...doc, saldo: newSaldo, estado: newEstado });
              }
            }
          });

          // 3. Actualizar saldos de los anticipos en cxp usando FIFO
          let remainingAnticipoToApply = totalAnticiposAplicados;
          for (const anticipoDoc of selectedSupplierAnticipos) {
            if (remainingAnticipoToApply <= 0) break;
            
            const saldoAbs = Math.abs(Number(anticipoDoc.saldo) || 0);
            if (saldoAbs > 0) {
              const amountToApplyToThisDoc = Math.min(saldoAbs, remainingAnticipoToApply);
              
              onSave('cxp', { 
                ...anticipoDoc, 
                saldo: anticipoDoc.saldo + amountToApplyToThisDoc
              });
              
              remainingAnticipoToApply -= amountToApplyToThisDoc;
            }
          }
        }

        showToast?.('Pago procesado exitosamente', 'success');
        setPagoForm({ ...pagoForm, referencia: '', proveedorId: '' });
        setAbonos({});
        setAnticipoGlobal('');
      }
    } catch (error) {
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

    // 1. Crear movimiento bancario (ingreso)
    const newMov = {
      id: nowTs,
      banco_id: newMovForm.bancoId,
      fecha: newMovForm.fecha,
      ref: newMovForm.referencia || `REF-${nowTs.slice(-4)}`,
      descripcion: newMovForm.descripcion,
      tipo: 'ingreso' as const,
      monto: montoNum,
      tasa: isNewMovVES ? Number(newMovForm.tasa) : (banco.tasa || 1),
      estado: 'activo'
    };

    // 2. Crear registro en CXP
    const newCxp = {
      id: nowTs + '-cxp',
      categoria: activeTab,
      proveedor: newMovForm.entidad,
      proveedor_id: newMovForm.entidad_id || `ENT-${nowTs.slice(-4)}`,
      factura_id: `MOV-${nowTs.slice(-4)}`,
      fecha: newMovForm.fecha,
      vencimiento: newMovForm.fecha,
      descripcion: newMovForm.descripcion,
      tipo: 'prestamo',
      total: montoNum,
      saldo: montoNum
    };

    // 3. Crear comprobante contable
    let cuentaEntidad = configContable?.cuentaCxp || '2.1.1';
    if (activeTab === 'intercompanias' || activeTab === 'accionistas' || activeTab === 'aliados') {
      const contact = contactos.find(c => c.id === newMovForm.entidad_id);
      if (contact) {
        cuentaEntidad = contact.creditAccount || contact.expenseAccount || cuentaEntidad;
        newCxp.proveedor = contact.name;
        newCxp.proveedor_id = contact.taxId || contact.id;
      }
    }

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
        cuentaId: cuentaEntidad,
        descripcion: `CxP ${newCxp.proveedor}`,
        debe: 0,
        haber: montoNum
      }
    ];

    const isBalanced = Math.abs(lineas.reduce((s,l)=>s+(Number(l.debe)||0),0) - lineas.reduce((s,l)=>s+(Number(l.haber)||0),0)) < 0.01;
    const isDescuadrado = !isBalanced || lineas.some(l => !l.cuentaId);

    const newComprobante = {
      id: `comp-${nowTs}`,
      fecha: newMovForm.fecha,
      numero: `CMP-${nowTs.slice(-6)}`,
      tipo: 'Diario',
      descripcion: `Préstamo/Anticipo de ${newCxp.proveedor}`,
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

        showToast?.('Movimiento y cuenta por pagar registrados exitosamente', 'success');
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
      id: nowTs + '-cxp',
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
      id: `comp-${nowTs}`,
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
      id: nowTs,
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
      id: nowTs + '-cxp',
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
      id: `comp-${nowTs}`,
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
      id: nowTs + '-cxp',
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
        id: `comp-${nowTs}`,
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
    const pagos = (pagosRealizados || []).filter((p: any) => {
      if (p.estado === 'anulado') return false;
      // Filtrar pagos por ID de proveedor, o nombre como fallback
      if (p.proveedorId && String(p.proveedorId) === supplierIdStr) return true;
      if (p.proveedorNombre && currentSupplier?.proveedor && p.proveedorNombre.toLowerCase() === currentSupplier.proveedor.toLowerCase()) return true;
      return false;
    }).map((p: any) => ({
      ...p,
      _tipo: 'pago',
      _fecha: new Date(p.fecha || p.createdAt || 0).getTime(),
      fechaStr: p.fecha || new Date(p.createdAt || 0).toISOString().split('T')[0],
      totalAnticiposAplicados: Number(p.anticiposAplicados) || 0
    }));

    const allMovs = [...docs, ...pagos].sort((a, b) => a._fecha - b._fecha);

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
        // Pero para evitar la duplicidad con los anticipos que ya fueron registrados
        // como abonos independientes al momento de su creación, restamos el monto de anticipos aplicados.
        const appliedAnt = Number(item.totalAnticiposAplicados) || Number(item.anticiposAplicados) || 0;
        abono = Math.max(0, (Number(item.monto) || 0) - appliedAnt);
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
            onSave?.('pagos-realizados', { ...pago, id: `pago-${Date.now()}`, isSynthetic: false, estado: 'anulado' });
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
      const docReintegroId = `cxp-reint-${Date.now()}`;
      onSave?.('cxp', {
        id: docReintegroId,
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
      const movBancoId = `mov-reint-${Date.now()}`;
      const cuentaBancoContable = selectedBanco?.cuentaContableId || '1.1.3';
      onSave?.('movimientosBancos', {
        id: movBancoId,
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
      const compId = `comp-reint-${Date.now()}`;
      onSave?.('comprobantes', {
        id: compId,
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
      return tab ? tab.label.slice(0, -1) : 'Entidad'; // e.g. "Proveedor", "Accionista"
    };

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto flex-1">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder={`Buscar ${getEntityLabel().toLowerCase()} por nombre o RIF...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setHideZeroBalances(!hideZeroBalances)}
              className={`px-3 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-sm ${
                hideZeroBalances 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' 
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
              title={hideZeroBalances ? 'Mostrando solo entidades con saldo pendiente o a favor. Haz clic para ver saldos $0' : 'Mostrando todas las entidades incluyendo saldo $0'}
            >
              <EyeOff size={16} className={hideZeroBalances ? 'text-indigo-600' : 'text-slate-400'} />
              <span className="hidden md:inline">{hideZeroBalances ? 'Ocultando Saldos $0' : 'Mostrando Todos ($0)'}</span>
            </button>
          </div>

          <div className="flex gap-2 w-full sm:w-auto flex-wrap">
            <button 
              onClick={() => {
                if (window.confirm('¿Desea restablecer todos los ejemplos de prueba del sistema? Esto cargará un nuevo conjunto limpio de cuentas por pagar, compras y pagos para pruebas.')) {
                  dbResetAllTestData(activeCompanyId);
                  window.location.reload();
                }
              }}
              title="Restablecer datos de prueba limpios"
              className="flex-1 sm:flex-none px-3 py-2 bg-slate-100 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw size={15} className="text-slate-500" />
              <span>Resetear Pruebas</span>
            </button>

            <button className="flex-1 sm:flex-none px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium flex items-center justify-center gap-2">
              <Download size={16} /> Exportar
            </button>
            <button 
              onClick={() => setShowAnticipoModal(true)}
              className="flex-1 sm:flex-none px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus size={16} /> Generar Anticipo
            </button>
            {activeTab === 'proveedores' && (
              <button 
                onClick={() => navigate('/purchases/new')}
                className="flex-1 sm:flex-none px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center justify-center gap-2 shadow-sm"
              >
                <ShoppingCart size={16} /> Nueva Factura de Compra / Gasto
              </button>
            )}
            {activeTab !== 'proveedores' && (
              <>
                {activeTab === 'accionistas' && (
                  <button 
                    onClick={() => setShowProvisionModal(true)}
                    className="flex-1 sm:flex-none px-3 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> Nueva Provisión
                  </button>
                )}
                {activeTab === 'aliados' && (
                  <>
                    <button 
                      onClick={() => navigate('/billing/transport')}
                      className="flex-1 sm:flex-none px-3 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <FileText size={16} /> Facturación Transporte
                    </button>
                    <button 
                      onClick={() => setShowAnticipoModal(true)}
                      className="flex-1 sm:flex-none px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Anticipo
                    </button>
                  </>
                )}
                <button 
                  onClick={() => setShowNewModal(true)}
                  className="flex-1 sm:flex-none px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Nuevo
                </button>
              </>
            )}
            {activeTab !== 'pago' && (
              <button 
                onClick={() => {
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
                className="flex-1 sm:flex-none px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Saldo Inicial
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider select-none">
              <tr>
                <th className="px-4 py-3 w-12 text-center">N°</th>
                <th className="px-4 py-3">{getEntityLabel()}</th>
                <th className="px-4 py-3 text-right">Monto Adeudo</th>
                <th className="px-4 py-3 text-right">Abonos Aplicados</th>
                <th className="px-4 py-3 text-right">Saldo Pendiente</th>
                <th className="px-4 py-3 text-center w-28 whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {groupedData.map((item, i) => (
                <tr 
                  key={item.id} 
                  onClick={() => setSelectedSupplier(item)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-2.5 text-slate-400 font-medium text-center text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5 font-bold text-rose-600 group-hover:text-rose-700">{item.proveedor}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 font-medium">${formatoES(item.montoAdeudo)}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600 font-medium">${formatoES(item.abonosAplicados)}</td>
                  <td className={`px-4 py-2.5 text-right font-black ${item.saldoPendiente < 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {item.saldoPendiente < 0 ? `A Favor: $${formatoES(Math.abs(item.saldoPendiente))}` : `$${formatoES(item.saldoPendiente)}`}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSupplier(item);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50/80 hover:bg-rose-600 text-rose-700 hover:text-white rounded-md text-xs font-semibold transition-all border border-rose-200/70 hover:border-rose-600 shadow-xs whitespace-nowrap"
                      title="Ver detalle de facturas y pagos"
                    >
                      <Eye size={12} className="shrink-0" />
                      <span>Ver Detalle</span>
                    </button>
                  </td>
                </tr>
              ))}
              {groupedData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No hay registros en esta categoría.
                  </td>
                </tr>
              )}
            </tbody>
            {groupedData.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right">TOTALES GENERALES:</td>
                  <td className="px-4 py-3 text-right">${formatoES(totals.montoAdeudo)}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">${formatoES(totals.abonosAplicados)}</td>
                  <td className="px-4 py-3 text-right text-rose-700">${formatoES(totals.saldoPendiente)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
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
        {/* 1. CABECERA DE PERFIL (HEADER) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 flex flex-col gap-6">
          {/* Top Bar: Botón volver + Badges de estado + Acciones rápidas */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <BackButton onClick={() => setSelectedSupplier(null)} label="Volver al Listado" />

              {/* Status Badge */}
              {currentSupplier.saldoPendiente < 0 ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-xs font-black uppercase tracking-wider">
                  <Coins size={13} /> Saldo a Favor
                </span>
              ) : hasOverdueInvoices ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-black uppercase tracking-wider animate-pulse">
                  <AlertTriangle size={13} /> En Mora
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-black uppercase tracking-wider">
                  <CheckCircle size={13} /> Al Día
                </span>
              )}

              <span className="text-[11px] font-bold px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-lg capitalize">
                {getEntityLabel()}
              </span>
            </div>

            {/* Quick Actions Header: Imprimir PDF & WhatsApp */}
            <div className="flex items-center gap-2">
              <a 
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-xs"
                title="Enviar resumen del estado de cuenta por WhatsApp"
              >
                <MessageSquare size={14} className="text-emerald-600" />
                <span>Enviar por WhatsApp</span>
              </a>

              <button 
                onClick={() => {
                  window.print();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Imprimir Estado de Cuenta"
              >
                <Printer size={14} />
                <span>Imprimir PDF</span>
              </button>
            </div>
          </div>

          {/* Supplier Profile Info Grid */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {currentSupplier.proveedor}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 font-medium">
                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">
                  {contactObj?.taxId || currentSupplier.id}
                </span>
                {contactObj?.codigoIata && (
                  <span className="bg-sky-100 text-sky-800 font-mono font-bold px-2 py-0.5 rounded">
                    IATA: {contactObj.codigoIata} ({contactObj.codigoDosLetras || ''})
                  </span>
                )}
                {contactObj?.phone && (
                  <span className="flex items-center gap-1 text-slate-600">
                    <Phone size={13} className="text-slate-400" /> {contactObj.phone}
                  </span>
                )}
                {contactObj?.email && (
                  <span className="flex items-center gap-1 text-slate-600">
                    <Mail size={13} className="text-slate-400" /> {contactObj.email}
                  </span>
                )}
              </div>
            </div>

            {/* Saldo Global Exigible Highlight */}
            <div className="bg-slate-50/80 p-4 px-6 rounded-2xl border border-slate-200 text-left lg:text-right shrink-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {currentSupplier.saldoPendiente < 0 ? 'Saldo a Favor Disponible' : 'Saldo Pendiente por Pagar'}
              </p>
              <p className={`text-2xl sm:text-3xl font-black ${currentSupplier.saldoPendiente < 0 ? 'text-teal-600' : 'text-rose-600'}`}>
                ${formatoES(Math.abs(currentSupplier.saldoPendiente))}
              </p>
            </div>
          </div>
        </div>

        {/* 2. TARJETAS DE INDICADORES FINANCIEROS (KPI CARDS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Monto Adeudo Total</span>
              <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
                <FileSpreadsheet size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-800">${formatoES(currentSupplier.montoAdeudo)}</p>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Facturación histórica total</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pagos Aplicados</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <ArrowDownLeft size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-600">${formatoES(currentSupplier.abonosAplicados)}</p>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Pagos y abonos ejecutados</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Saldo Pendiente</span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <DollarSign size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-rose-600">${formatoES(Math.max(0, currentSupplier.saldoPendiente))}</p>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Deuda actual exigible</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Anticipos a Favor</span>
              <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                <Coins size={16} />
              </div>
            </div>
            <p className="text-2xl font-black text-teal-600">
              ${formatoES(currentSupplier.saldoPendiente < 0 ? Math.abs(currentSupplier.saldoPendiente) : totalAnticiposDisponibles)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">Saldos prepagados a favor</p>
          </div>
        </div>

        {/* 3. ANÁLISIS DE ANTIGÜEDAD DE DEUDAS (AGING MATRIX) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Análisis de Antigüedad de Deuda</h3>
            </div>
            {hasOverdueInvoices ? (
              <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                ⚠️ Facturas vencidas pendientes
              </span>
            ) : (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                ✅ Sin facturas vencidas
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/60">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Por Vencer</p>
              <p className="text-lg font-black text-slate-800">${formatoES(porVencer)}</p>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/60">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">1 - 30 Días</p>
              <p className={`text-lg font-black ${dias0a30 > 0 ? 'text-amber-600' : 'text-slate-800'}`}>${formatoES(dias0a30)}</p>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/60">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">31 - 60 Días</p>
              <p className={`text-lg font-black ${dias31a60 > 0 ? 'text-orange-600' : 'text-slate-800'}`}>${formatoES(dias31a60)}</p>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/60">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">61 - 90 Días</p>
              <p className={`text-lg font-black ${dias61a90 > 0 ? 'text-rose-500' : 'text-slate-800'}`}>${formatoES(dias61a90)}</p>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/60">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">+90 Días</p>
              <p className={`text-lg font-black ${diasMas90 > 0 ? 'text-rose-700' : 'text-slate-800'}`}>${formatoES(diasMas90)}</p>
            </div>
          </div>
        </div>

        {/* 4. BARRA DE ACCIONES OPERATIVAS Y FILTROS */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
            {/* Botón Registrar Pago */}
            <button 
              onClick={() => {
                setPagoForm(prev => ({ ...prev, proveedorId: currentSupplier.id }));
                setActiveTab('pago');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Plus size={13} />
              <span>Registrar Pago</span>
            </button>

            {/* Botón Generar Anticipo */}
            <button 
              onClick={() => {
                setAnticipoForm(prev => ({
                  ...prev,
                  proveedor: currentSupplier.proveedor,
                  proveedor_id: currentSupplier.id
                }));
                setShowAnticipoModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Coins size={13} />
              <span>Generar Anticipo</span>
            </button>

            {/* Botón Reintegrar Saldo (Sólo si tiene saldo a favor neto) */}
            {currentSupplier.saldoPendiente < -0.009 && (
              <button 
                onClick={() => {
                  setReintegroForm({
                    bancoId: bancos[0]?.id || '',
                    fecha: new Date().toISOString().split('T')[0],
                    referencia: `REINT-${Date.now().toString().slice(-4)}`,
                    monto: String(Math.abs(currentSupplier.saldoPendiente).toFixed(2)),
                    notas: `Reintegro de saldo a favor de ${currentSupplier.proveedor}`
                  });
                  setShowReintegroModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer animate-in fade-in"
                title="Recibir y registrar el reintegro del saldo a favor hacia nuestra cuenta bancaria"
              >
                <RotateCcw size={13} />
                <span>Reintegrar Saldo (${formatoES(Math.abs(currentSupplier.saldoPendiente))})</span>
              </button>
            )}
          </div>

          {/* Filtros de período */}
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período:</span>
              <select 
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500" 
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
              <div className="flex items-center gap-2">
                <select 
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none" 
                  value={filtrosHistorial.mes} 
                  onChange={e=>setFiltrosHistorial({...filtrosHistorial, mes: e.target.value})}
                >
                  {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m,i)=><option key={i} value={String(i+1).padStart(2,'0')}>{m}</option>)}
                </select>
                <select 
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none" 
                  value={filtrosHistorial.ano} 
                  onChange={e=>setFiltrosHistorial({...filtrosHistorial, ano: e.target.value})}
                >
                  {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}

            {filtrosHistorial.tipo==='rango' && (
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none" 
                  value={filtrosHistorial.desde} 
                  onChange={e=>setFiltrosHistorial({...filtrosHistorial, desde: e.target.value})}
                />
                <span className="text-xs text-slate-400">a</span>
                <input 
                  type="date" 
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none" 
                  value={filtrosHistorial.hasta} 
                  onChange={e=>setFiltrosHistorial({...filtrosHistorial, hasta: e.target.value})}
                />
              </div>
            )}
          </div>
        </div>

        {/* 5. TABLA DE DETALLES Y MOVIMIENTOS */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
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
                    docId = item.referencia || item.id;
                    const appliedAnt = Number(item.totalAnticiposAplicados) || Number(item.anticiposAplicados) || 0;
                    if (appliedAnt > 0) {
                      descripcion = `Pago a proveedor ${item.proveedorNombre || ''} (Anticipo aplicado: $${formatoES(appliedAnt)})`;
                    } else {
                      descripcion = item.descripcion || `Pago a proveedor ${item.proveedorNombre || ''}`;
                    }
                  } else {
                    docId = item.factura_id || item.id;
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
                                  actionDetails: `Documento ${item.factura_id || item.id} - Monto: $${formatoES(item.total || item.monto)} (${currentSupplier?.proveedor || ''})`,
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
    return (
      <div className="flex flex-col lg:flex-row gap-6 animate-in fade-in duration-300">
        {/* Columna Izquierda: Formulario */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex-1">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-indigo-600" />
              Detalles del Pago
            </h3>
            
            <div className="space-y-5">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Banco a Afectar</label>
                <select 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-700"
                  value={pagoForm.bancoId}
                  onChange={e => setPagoForm({ ...pagoForm, bancoId: e.target.value })}
                >
                  <option value="">Seleccione un banco...</option>
                  {bancos.map(b => (
                    <option key={b.id} value={b.id}>{b.banco} ({b.moneda})</option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">N° Referencia</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-700"
                  placeholder="Ej. TRF-00123"
                  value={pagoForm.referencia}
                  onChange={e => setPagoForm({ ...pagoForm, referencia: e.target.value })}
                />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Fecha de Pago</label>
                <input 
                  type="date" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-medium text-slate-700"
                  value={pagoForm.fecha}
                  onChange={e => setPagoForm({ ...pagoForm, fecha: e.target.value })}
                />
              </div>

              <div className="flex flex-col pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Proveedor / Entidad</label>
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                    <button 
                      onClick={() => setEntityFilters(prev => ({...prev, proveedores: !prev.proveedores}))}
                      className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-md transition-colors ${entityFilters.proveedores ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Proveedores"
                    >P</button>
                    <button 
                      onClick={() => setEntityFilters(prev => ({...prev, aliados: !prev.aliados}))}
                      className={`px-1.5 h-6 flex items-center justify-center text-[10px] font-bold rounded-md transition-colors ${entityFilters.aliados ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Aliados"
                    >Al</button>
                    <button 
                      onClick={() => setEntityFilters(prev => ({...prev, intercompanias: !prev.intercompanias}))}
                      className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-md transition-colors ${entityFilters.intercompanias ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Intercompañías"
                    >I</button>
                    <button 
                      onClick={() => setEntityFilters(prev => ({...prev, accionistas: !prev.accionistas}))}
                      className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-md transition-colors ${entityFilters.accionistas ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Accionistas"
                    >A</button>
                    <button 
                      onClick={() => setEntityFilters(prev => ({...prev, empleados: !prev.empleados}))}
                      className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-md transition-colors ${entityFilters.empleados ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      title="Empleados"
                    >E</button>
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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-650 transition-colors"
                  >
                    <Search size={16} />
                  </button>
                </div>
              </div>

              {isVES && (
                <div className="flex flex-col animate-in fade-in zoom-in-95 duration-200 pt-2 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tasa de Pago (Bs./$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0.01"
                    className="w-full px-4 py-2.5 bg-indigo-50/50 border border-indigo-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-indigo-700"
                    value={pagoForm.tasa || ''}
                    onChange={e => setPagoForm({ ...pagoForm, tasa: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Columna Derecha: Cuentas y Resumen */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
          {pagoForm.proveedorId ? (
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
                    <div className="flex justify-between items-center gap-8 text-emerald-300 text-sm mt-2 pt-2 border-t border-indigo-500/30">
                      <div className="flex flex-col">
                        <span>Anticipo Disponible:</span>
                        <span className="text-xs text-emerald-400/70">Monto máximo a usar</span>
                      </div>
                      <span className="font-bold">${formatoES(totalAnticiposDisponibles)}</span>
                    </div>
                  )}
                  
                  {totalAnticiposDisponibles > 0 && (
                    <div className="flex justify-between items-center gap-8 text-emerald-200 text-sm mt-2">
                      <span className="whitespace-nowrap">Anticipo a Usar:</span>
                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">$</span>
                        <input 
                          type="number" 
                          step="0.01"
                          min="0"
                          max={Math.min(totalFacturasAplicadas, totalAnticiposDisponibles)}
                          className="w-full pl-7 pr-3 py-1.5 text-sm border-none rounded-lg focus:ring-2 focus:ring-emerald-400 outline-none font-bold text-emerald-800 bg-emerald-50 shadow-inner text-right transition-all"
                          placeholder="0.00"
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

                  <div className="h-px w-full bg-indigo-500/50 my-2" />
                  <div className="flex justify-between items-end gap-8 mt-1">
                    <span className="text-indigo-200 font-medium text-sm uppercase tracking-wider mb-1">Total Efectivo/Banco</span>
                    <div className="flex items-baseline gap-3">
                      <p className="text-3xl sm:text-4xl font-black tracking-tight">${formatoES(montoBanco)}</p>
                      {isVES && montoBanco > 0 && (
                        <p className="text-base font-medium text-indigo-300">
                          ≈ Bs. {formatoES(montoBanco * (pagoForm.tasa || 1))}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleProcesarPago}
                  disabled={totalFacturasAplicadas <= 0}
                  className="relative z-10 w-full sm:w-auto bg-white text-indigo-600 hover:bg-indigo-50 text-lg font-bold px-8 py-4 rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-6 h-6" /> 
                  Procesar Pago
                </button>
              </div>

              {/* Tabla de Cuentas por Pagar del Proveedor */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
                <div className="p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">Facturas Pendientes</h4>
                      <p className="text-xs text-slate-500 font-medium">Seleccione los montos a abonar por cada documento</p>
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
                      {selectedSupplierDebts.map((item, i) => {
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
                                <button 
                                  onClick={() => handlePagarTotal(item.id, saldoNum)}
                                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors text-right w-full"
                                >
                                  Aplicar total
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {selectedSupplierDebts.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-400">
                              <CheckCircle className="w-12 h-12 mb-3 text-emerald-400" strokeWidth={1.5} />
                              <p className="font-medium text-slate-600">Esta entidad no tiene facturas pendientes.</p>
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
              <h3 className="text-xl font-bold text-slate-800 mb-2">Seleccione una entidad</h3>
              <p className="text-slate-500 max-w-md">
                Elija una entidad en el panel de detalles para ver sus cuentas pendientes y registrar un nuevo pago.
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
            <BackButton to="/payables" label="Volver a Cuentas por Pagar" />
          ) : (
            <BackButton to="/" label="Volver al Inicio" />
          )}
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            {category ? tabs.find(t => t.id === category)?.label : 'Cuentas por Pagar'}
          </h2>
        </div>
        <p className="text-sm text-slate-500 font-medium mt-1">Gestión de obligaciones, pagos a proveedores y antigüedad de saldos</p>
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
      {activeTab === 'pago' ? (
        renderPago()
      ) : activeTab === 'historial-pagos' ? (
        renderHistorialPagos()
      ) : (
        renderTable()
      )}

      {/* Modal Nuevo Movimiento */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Landmark size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">Nuevo Movimiento Bancario</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
                    {activeTab === 'intercompanias' ? 'Préstamo Intercompañía' : 
                     activeTab === 'accionistas' ? 'Aporte/Préstamo Accionista' : 
                     activeTab === 'aliados' ? 'Cuenta por Pagar a Aliado' :
                     'Registro de Cuenta por Pagar'}
                  </p>
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
                    onClick={() => setIsNewMovSupplierModalOpen(true)}
                  >
                    <span className={newMovForm.entidad ? 'text-slate-800' : 'text-slate-400 font-normal'}>
                      {newMovForm.entidad || 'Seleccionar entidad...'}
                    </span>
                    <Search className="w-4 h-4 text-indigo-500" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Cuenta Bancaria (Destino)</label>
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
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Concepto</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all font-bold text-slate-700"
                  placeholder="Ej. Préstamo para capital de trabajo..."
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
                <div className="flex flex-col animate-in fade-in zoom-in-95 duration-200 pt-6 border-t border-slate-100 gap-4 mt-4">
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
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <Save size={16} />
                Registrar Movimiento
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
                Buscar Entidad / Nombre
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
                  placeholder="Buscar por nombre o identificación..."
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
                  <p className="font-medium text-slate-700">No se encontraron entidades</p>
                  <p className="text-sm mt-1">Verifique los términos de búsqueda o registre una nueva entidad en el módulo de Contactos.</p>
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
                            <span className="font-mono text-xs text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">{originalInvoice?.factura_id || docId}</span>
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
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Asiento Contable Generado</h4>
                  {selectedPago.comprobanteId && (
                    <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-500 font-mono font-bold px-2 py-0.5 rounded-full">
                      Voucher: {selectedPago.comprobanteId}
                    </span>
                  )}
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
                        // Locate lines of this comprobante
                        const matchedComp = comprobantes.find(c => c.id === selectedPago.comprobanteId) || selectedPago;
                        const linesObj = matchedComp?.lineas || [];

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
                              const cuenta = cuentasContables.find(c => c.codigo === l.cuentaId || c.id === l.cuentaId);
                              const debe = Number(l.debe) || 0;
                              const haber = Number(l.haber) || 0;
                              totalDebe += debe;
                              totalHaber += haber;

                              return (
                                <tr key={l.id || i} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-2.5 font-mono text-indigo-600 font-bold">{l.cuentaId}</td>
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
