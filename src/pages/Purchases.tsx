import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Truck, Plus, Search, Printer, Trash2, 
  Calendar, CheckCircle2, Clock, DollarSign, 
  TrendingUp, Download, Eye, ArrowRight,
  Package, Building2, RefreshCw, X, FileText,
  AlertTriangle, ShieldAlert, Briefcase, Coffee,
  Wrench, Receipt, Megaphone
} from 'lucide-react';
import BackButton from '../components/common/BackButton';
import MasterAuthModal from '../components/common/MasterAuthModal';
import ServiceExpenseModal from '../components/purchases/ServiceExpenseModal';
import { getTasaForDate } from '../services/exchangeRateService';
import { FacturaCompraModel, AlmacenModel } from '../types/database';
import { formatDate, getTodayLocalDate } from '../utils/dateUtils';
import { formatNumber } from '../utils/numberFormat';
import { useCompany } from '../context/CompanyContext';

const purchaseIsPaid = (p: FacturaCompraModel): boolean => {
  if (p.estado === 'anulada') return false;
  if (p.estado === 'pagada') return true;
  if (p.condicion === 'contado') return true;
  if (p.saldo_pendiente !== undefined && Number(p.saldo_pendiente) <= 0.01) return true;
  return false;
};

export default function Purchases({
  facturasCompra = [],
  cxp = [],
  comprobantes = [],
  movimientosInventario = [],
  movimientosBancos = [],
  pagosRealizados = [],
  products = [],
  contactos = [],
  cuentasContables = [],
  categoriasProducto = [],
  bancos = [],
  configContable,
  workingYear,
  empresa,
  onSave,
  showToast
}: {
  facturasCompra?: FacturaCompraModel[];
  cxp?: any[];
  comprobantes?: any[];
  movimientosInventario?: any[];
  movimientosBancos?: any[];
  pagosRealizados?: any[];
  products?: any[];
  contactos?: any[];
  cuentasContables?: any[];
  categoriasProducto?: any[];
  bancos?: any[];
  configContable?: any;
  workingYear?: string;
  empresa?: any;
  onSave?: (collection: string, data: any) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const { submodule } = useParams<{ submodule?: string }>();
  const navigate = useNavigate();
  const { activeCompanyId } = useCompany();
  const currentCompanyId = activeCompanyId || empresa?.id || '';

  const handleOpenPurchaseWindow = () => {
    window.open('/purchases/new', 'NuevaCompra', 'width=1450,height=900,left=50,top=50');
  };

  // Estado de Tasa
  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    return getTasaForDate(getTodayLocalDate());
  });
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'VES'>('USD');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todas' | 'pagada' | 'pendiente' | 'anulada'>('todas');
  
  const currentMonth = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  // Submódulo Activo: 'compras' (Mercancía) o 'servicios' (Gastos y Servicios)
  const [activeSubmodule, setActiveSubmodule] = useState<'compras' | 'servicios'>(() => {
    if (submodule === 'servicios' || submodule === 'services') return 'servicios';
    return 'compras';
  });

  useEffect(() => {
    if (submodule === 'servicios' || submodule === 'services') {
      setActiveSubmodule('servicios');
    } else if (submodule === 'compras' || submodule === 'inventario' || submodule === 'merchandise') {
      setActiveSubmodule('compras');
    }
  }, [submodule]);

  const [isServiceModalOpen, setIsServiceModalOpen] = useState<boolean>(false);

  // Modal de Detalle / Imprimir
  const [selectedPurchase, setSelectedPurchase] = useState<FacturaCompraModel | null>(null);

  // Modal Master para Anulación
  const [isMasterAuthModalOpen, setIsMasterAuthModalOpen] = useState(false);
  const [purchaseToAnular, setPurchaseToAnular] = useState<FacturaCompraModel | null>(null);

  // Separación en los 2 submódulos
  const purchasesList = useMemo(() => {
    return facturasCompra.filter(p => p.categoria_compra !== 'servicio' && p.tipo_documento !== 'servicio');
  }, [facturasCompra]);

  const servicesList = useMemo(() => {
    return facturasCompra.filter(p => p.categoria_compra === 'servicio' || p.tipo_documento === 'servicio');
  }, [facturasCompra]);

  const currentDataset = activeSubmodule === 'compras' ? purchasesList : servicesList;

  // Filtrado de Compras / Servicios
  const filteredPurchases = useMemo(() => {
    return currentDataset.filter(p => {
      // Filtro mes
      if (selectedMonth && selectedMonth !== 'todos') {
        const fecha = p.fecha_emision || p.created_at || '';
        if (!fecha.startsWith(selectedMonth)) return false;
      }

      // Filtro estado
      if (statusFilter !== 'todas') {
        if (statusFilter === 'pendiente' && p.estado !== 'emitida') return false;
        if (statusFilter === 'pagada' && p.estado !== 'pagada') return false;
        if (statusFilter === 'anulada' && p.estado !== 'anulada') return false;
      }

      // Búsqueda
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const prov = (p.proveedor_nombre || '').toLowerCase();
        const rif = (p.proveedor_rif || '').toLowerCase();
        const num = (p.numero || '').toLowerCase();
        const ctrl = (p.control_numero || '').toLowerCase();
        const conc = ((p as any).concepto_gasto || (p.items?.[0]?.descripcion) || '').toLowerCase();
        return prov.includes(term) || rif.includes(term) || num.includes(term) || ctrl.includes(term) || conc.includes(term);
      }

      return true;
    }).sort((a, b) => new Date(b.created_at || b.fecha_emision).getTime() - new Date(a.created_at || a.fecha_emision).getTime());
  }, [currentDataset, selectedMonth, statusFilter, searchTerm]);

  // Métricas del mes seleccionado según el submódulo activo
  const metrics = useMemo(() => {
    let totalMesUSD = 0;
    let totalMesBs = 0;
    let totalPendienteUSD = 0;
    let totalPagadoUSD = 0;
    let totalArticulos = 0;
    const proveedoresSet = new Set<string>();

    filteredPurchases.forEach(p => {
      if (p.estado !== 'anulada') {
        totalMesUSD += Number(p.total) || 0;
        totalMesBs += Number(p.total_bs) || (Number(p.total) * (p.tasa_cambio || exchangeRate));
        const isPaid = purchaseIsPaid(p);
        if (p.condicion === 'credito' && !isPaid) {
          totalPendienteUSD += Number(p.saldo_pendiente !== undefined ? p.saldo_pendiente : p.total) || 0;
        } else {
          totalPagadoUSD += Number(p.total) || 0;
        }
        if (p.items && Array.isArray(p.items)) {
          p.items.forEach(it => {
            totalArticulos += Number(it.cantidad) || 0;
          });
        }
        if (p.proveedor_nombre) {
          proveedoresSet.add(p.proveedor_nombre.toLowerCase());
        }
      }
    });

    return {
      totalMesUSD,
      totalMesBs,
      totalPendienteUSD,
      totalPagadoUSD,
      totalArticulos,
      proveedoresCount: proveedoresSet.size,
      count: filteredPurchases.filter(p => p.estado !== 'anulada').length
    };
  }, [filteredPurchases, exchangeRate]);

  // Ejecutar anulación con clave master
  const handleConfirmAnulacion = () => {
    if (!purchaseToAnular) return;

    const isServicio = purchaseToAnular.categoria_compra === 'servicio' || purchaseToAnular.tipo_documento === 'servicio';

    // 1. Revertir stock en inventario SOLO si es compra de mercancía
    if (!isServicio && purchaseToAnular.items && Array.isArray(purchaseToAnular.items)) {
      purchaseToAnular.items.forEach(item => {
        if (item.producto_id) {
          const prod = products.find(p => p.id === item.producto_id);
          if (prod) {
            const currentStock = Number(prod.stock_actual) || 0;
            const cantComprada = Number(item.cantidad) || 0;
            const revertedStock = currentStock - cantComprada;

            onSave?.('products', {
              ...prod,
              stock_actual: revertedStock,
              updated_at: new Date().toISOString()
            });

            onSave?.('movimientosInventario', {
              id: crypto.randomUUID(),
              empresa_id: currentCompanyId,
              producto_id: prod.id,
              producto_nombre: prod.nombre,
              producto_codigo: prod.codigo,
              tipo: 'ajuste_negativo',
              cantidad: cantComprada,
              stock_anterior: currentStock,
              stock_resultante: revertedStock,
              costo_unitario: item.costo_unitario,
              referencia: `Anulación Compra Prov N° ${purchaseToAnular.numero}`,
              fecha: getTodayLocalDate(),
              usuario: 'Administrador (Anulación)',
              created_at: new Date().toISOString()
            });
          }
        }
      });
    }

    // 2. Anular el documento
    const updatedPurchase: FacturaCompraModel = {
      ...purchaseToAnular,
      estado: 'anulada',
      saldo_pendiente: 0,
      saldo_pendiente_bs: 0
    };
    onSave?.('facturasCompra', updatedPurchase);

    // 3. Anular CxP si existe
    if (purchaseToAnular.cxp_id || purchaseToAnular.numero) {
      const existingCxp = cxp.find(c => (purchaseToAnular.cxp_id && c.id === purchaseToAnular.cxp_id) || c.factura_id === purchaseToAnular.numero || c.numero === purchaseToAnular.numero);
      if (existingCxp) {
        onSave?.('cxp', {
          ...existingCxp,
          saldo: 0,
          saldo_bs: 0,
          estado: 'anulada',
          descripcion: `[ANULADA] ${existingCxp.descripcion || existingCxp.concepto || ''}`
        });
      }
    }

    // 4. Anular Comprobante Contable si existe
    if (purchaseToAnular.comprobante_id) {
      const existingComp = comprobantes.find(c => c.id === purchaseToAnular.comprobante_id);
      if (existingComp) {
        onSave?.('comprobantes', {
          ...existingComp,
          estado: 'Anulado',
          descripcion: `[ANULADO] ${existingComp.descripcion}`
        });
      }
    }

    // 5. Eliminar movimientos bancarios vinculados (si fue de contado)
    const bankMatches = (movimientosBancos || []).filter((mov: any) => {
      const matchComp = purchaseToAnular.comprobante_id && String(mov.comprobante_id) === String(purchaseToAnular.comprobante_id);
      const matchRef = mov.ref && (String(mov.ref) === String(purchaseToAnular.numero) || String(mov.ref).includes(String(purchaseToAnular.numero)));
      return matchComp || matchRef;
    });

    bankMatches.forEach((mov: any) => {
      onSave?.('movimientosBancos', { id: mov.id, _delete: true });
    });

    // 6. Eliminar pagos-realizados vinculados
    const pagoMatches = (pagosRealizados || []).filter((pago: any) => {
      const matchComp = purchaseToAnular.comprobante_id && String(pago.comprobanteId) === String(purchaseToAnular.comprobante_id);
      const matchRef = pago.comprobantePago && String(pago.comprobantePago).includes(String(purchaseToAnular.numero));
      const matchDet = pago.detalles && Array.isArray(pago.detalles) && pago.detalles.some((d: any) => d.docId === purchaseToAnular.id || d.numDoc === purchaseToAnular.numero);
      return matchComp || matchRef || matchDet;
    });

    pagoMatches.forEach((pago: any) => {
      onSave?.('pagos-realizados', { id: pago.id, _delete: true });
    });

    showToast?.(`${isServicio ? 'Gasto/Servicio' : 'Compra'} ${purchaseToAnular.numero} anulada exitosamente${!isServicio ? ' y stock revertido' : ''}.`, 'success');
    setPurchaseToAnular(null);
    setIsMasterAuthModalOpen(false);
  };

  // Exportar histórico a CSV
  const handleExportCSV = () => {
    if (filteredPurchases.length === 0) {
      showToast?.('No hay compras para exportar en el período seleccionado', 'info');
      return;
    }
    const headers = ['Fecha', 'Tipo', 'N° Factura', 'N° Control', 'Proveedor', 'RIF', 'Condición', 'Artículos', 'Subtotal ($)', 'IVA ($)', 'Ret. IVA ($)', 'Ret. ISLR ($)', 'Total ($)', 'Total (Bs.)', 'Estado'];
    const rows = filteredPurchases.map(p => [
      p.fecha_emision,
      p.tipo_documento,
      p.numero,
      p.control_numero || '',
      `"${(p.proveedor_nombre || '').replace(/"/g, '""')}"`,
      p.proveedor_rif || '',
      p.condicion,
      p.items?.length || 0,
      p.subtotal,
      p.iva_monto,
      p.retencion_iva_monto || 0,
      p.retencion_islr_monto || 0,
      p.total,
      p.total_bs || (p.total * (p.tasa_cambio || exchangeRate)),
      p.estado
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `compras_${selectedMonth}_${getTodayLocalDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.('Histórico de compras exportado a CSV', 'success');
  };

  return (
    <div className="px-3 sm:px-6 pt-1 pb-10 max-w-7xl mx-auto space-y-3.5 animate-in fade-in duration-300">
      
      {/* 1. TOP BAR: RETORNO + CONTROL MULTIMONEDA BCV */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <BackButton 
          to={submodule ? "/purchases" : "/"} 
          label={submodule ? "Volver a Compras" : "Volver al Menú Principal"} 
        />

        <div className="flex items-center gap-2 self-end sm:self-auto bg-white border border-slate-200/80 px-3 py-1 rounded-xl shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-400">Tasa:</span>
            <span className="font-bold text-indigo-900">Bs. {exchangeRate.toFixed(2)}</span>
          </div>

          <div className="w-px h-3.5 bg-slate-200"></div>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setDisplayCurrency('USD')}
              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                displayCurrency === 'USD' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => setDisplayCurrency('VES')}
              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                displayCurrency === 'VES' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Bs. (VES)
            </button>
          </div>
        </div>
      </div>

      {/* 2. SELECTOR DE SUBMÓDULOS (SI SE ACCEDE DIRECTO SIN SUBMÓDULO) */}
      {!submodule && (
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200/90 shadow-xs flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubmodule('compras')}
            className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeSubmodule === 'compras'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Truck size={16} />
            <span>Submódulo Compras (Mercancía / Inventario)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeSubmodule === 'compras' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {purchasesList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubmodule('servicios')}
            className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeSubmodule === 'servicios'
                ? 'bg-gradient-to-r from-indigo-700 to-purple-700 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Briefcase size={16} />
            <span>Submódulo Servicios (Gastos, Honorarios & Víveres)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              activeSubmodule === 'servicios' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {servicesList.length}
            </span>
          </button>
        </div>
      )}

      {/* 3. ENCABEZADO PRINCIPAL DINÁMICO */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0 ${
            activeSubmodule === 'compras' 
              ? 'bg-gradient-to-tr from-blue-600 to-indigo-700 shadow-indigo-500/20'
              : 'bg-gradient-to-tr from-indigo-700 to-purple-800 shadow-purple-500/20'
          }`}>
            {activeSubmodule === 'compras' ? <Truck className="w-6 h-6" /> : <Briefcase className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {activeSubmodule === 'compras' ? 'Compras & Ingreso de Inventario' : 'Gastos y Servicios de la Compañía'}
              </h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                activeSubmodule === 'compras'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}>
                {activeSubmodule === 'compras' ? 'MERCANCÍA & STOCK' : 'GASTOS OPERATIVOS'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {activeSubmodule === 'compras'
                ? 'Recepción de mercancía a almacén, facturas de proveedores, actualización de costos y cuentas por pagar'
                : 'Honorarios profesionales, víveres, servicios básicos, papelería y mantenimiento con CxP y contabilidad'
              }
            </p>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all border border-slate-200/90 shadow-xs cursor-pointer"
            title="Exportar listado a CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exportar CSV</span>
          </button>

          {activeSubmodule === 'compras' ? (
            <button
              onClick={handleOpenPurchaseWindow}
              className="btn-primary text-xs py-2.5 px-4 shadow-xs hover:shadow-md cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Registrar Compra / Ingreso</span>
            </button>
          ) : (
            <button
              onClick={() => setIsServiceModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 cursor-pointer flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Registrar Gasto / Servicio</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. TARJETAS DE KPIS / MÉTRICAS DEL MES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {activeSubmodule === 'compras' ? 'Total Comprado' : 'Total Gastos/Servicios'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign size={15} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900">
            {displayCurrency === 'USD' 
              ? `$ ${formatNumber(metrics.totalMesUSD)}`
              : `Bs. ${formatNumber(metrics.totalMesBs)}`
            }
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {metrics.count} {metrics.count === 1 ? 'registro' : 'registros'} en este período
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Por Pagar (CxP)</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={15} />
            </div>
          </div>
          <div className="text-xl font-black text-amber-600">
            {displayCurrency === 'USD'
              ? `$ ${formatNumber(metrics.totalPendienteUSD)}`
              : `Bs. ${formatNumber(metrics.totalPendienteUSD * exchangeRate)}`
            }
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Pendiente a crédito</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {activeSubmodule === 'compras' ? 'Artículos Recibidos' : 'Pagado de Contado'}
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              {activeSubmodule === 'compras' ? <Package size={15} /> : <CheckCircle2 size={15} />}
            </div>
          </div>
          <div className="text-xl font-black text-emerald-700">
            {activeSubmodule === 'compras'
              ? `${metrics.totalArticulos.toLocaleString('es-VE')} unids`
              : (displayCurrency === 'USD' ? `$ ${formatNumber(metrics.totalPagadoUSD)}` : `Bs. ${formatNumber(metrics.totalPagadoUSD * exchangeRate)}`)
            }
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {activeSubmodule === 'compras' ? 'Ingresadas al inventario' : 'Desembolso bancario/caja'}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Proveedores Activos</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 size={15} />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900">
            {metrics.proveedoresCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Con operaciones en el período</p>
        </div>
      </div>

      {/* 5. BARRA DE CONTROL Y FILTROS */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 flex-1 flex-wrap sm:flex-nowrap">
          {/* Buscador */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={activeSubmodule === 'compras' 
                ? "Buscar por proveedor, RIF, N° de factura, control..." 
                : "Buscar por proveedor, RIF, concepto, N° de factura..."
              }
              className="w-full pl-9.5 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Selector de Mes */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Calendar size={14} className="text-slate-400" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer text-xs"
            >
              <option value="todos">Todos los meses</option>
              <option value="2026-09">Septiembre 2026</option>
              <option value="2026-08">Agosto 2026</option>
              <option value="2026-07">Julio 2026</option>
              <option value="2026-06">Junio 2026</option>
              <option value="2026-05">Mayo 2026</option>
            </select>
          </div>

          {/* Filtro por Estado */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none cursor-pointer text-xs"
          >
            <option value="todas">Todos los Estados</option>
            <option value="pagada">Pagadas (Contado)</option>
            <option value="pendiente">Pendientes (Crédito)</option>
            <option value="anulada">Anuladas</option>
          </select>
        </div>
      </div>

      {/* 6. TABLA DE REGISTROS (COMPRAS O SERVICIOS) */}
      <div className="table-container">
        <table className="table-odoo">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>N° Factura / Control</th>
              <th>Proveedor</th>
              {activeSubmodule === 'compras' ? (
                <th className="text-center">Ítems</th>
              ) : (
                <th>Concepto / Categoría</th>
              )}
              <th className="text-center">Condición</th>
              <th className="text-right">Subtotal ($)</th>
              <th className="text-right">Total ($)</th>
              <th className="text-right">Total (Bs.)</th>
              <th className="text-center">Estado</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPurchases.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-14 text-center">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2.5 ${
                    activeSubmodule === 'compras' ? 'bg-indigo-50 text-indigo-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {activeSubmodule === 'compras' ? <Truck size={24} /> : <Briefcase size={24} />}
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {activeSubmodule === 'compras' 
                      ? 'No hay compras de mercancía registradas en este período' 
                      : 'No hay gastos o servicios registrados en este período'
                    }
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {activeSubmodule === 'compras'
                      ? 'Presione el botón "Registrar Compra / Ingreso" para incorporar facturas de proveedores y surtir el inventario.'
                      : 'Presione el botón "+ Registrar Gasto / Servicio" para asentar honorarios, víveres, servicios y otros gastos.'
                    }
                  </p>
                  {activeSubmodule === 'compras' ? (
                    <button
                      onClick={() => navigate('/purchases/new')}
                      className="mt-3.5 btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Registrar Primera Compra</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsServiceModalOpen(true)}
                      className="mt-3.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Registrar Primer Gasto / Servicio</span>
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredPurchases.map(purchase => {
                const totalBs = purchase.total_bs || (purchase.total * (purchase.tasa_cambio || exchangeRate));
                const itemsCount = purchase.items?.length || 0;
                const totalUnidades = purchase.items?.reduce((acc, it) => acc + (Number(it.cantidad) || 0), 0) || 0;
                const conceptoGasto = purchase.concepto_gasto || purchase.items?.[0]?.descripcion || purchase.notas || 'Gasto / Servicio general';
                const isServicio = purchase.categoria_compra === 'servicio' || purchase.tipo_documento === 'servicio';

                return (
                  <tr key={purchase.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="font-mono text-xs text-slate-600 whitespace-nowrap">
                      {purchase.fecha_emision}
                    </td>

                    <td>
                      <div className="font-mono font-bold text-xs text-slate-800">
                        {purchase.numero}
                      </div>
                      {purchase.control_numero && (
                        <div className="font-mono text-[10px] text-slate-400">
                          Ctrl: {purchase.control_numero}
                        </div>
                      )}
                    </td>

                    <td>
                      <div className="font-bold text-xs text-slate-900 max-w-[200px] truncate">
                        {purchase.proveedor_nombre || contactos.find(c => c.id === purchase.proveedor_id)?.name || 'Proveedor'}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {purchase.proveedor_rif || contactos.find(c => c.id === purchase.proveedor_id)?.tax_id || (contactos.find(c => c.id === purchase.proveedor_id) as any)?.taxId || ''}
                      </div>
                    </td>

                    {activeSubmodule === 'compras' ? (
                      <td className="text-center text-xs">
                        <span className="font-bold text-slate-700">{itemsCount}</span>
                        <span className="text-[10px] text-slate-400 block">({totalUnidades} unids)</span>
                      </td>
                    ) : (
                      <td>
                        <div className="font-semibold text-xs text-slate-800 max-w-[220px] truncate">
                          {conceptoGasto}
                        </div>
                        {purchase.categoria_gasto && (
                          <span className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 capitalize">
                            {purchase.categoria_gasto.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                    )}

                    <td className="text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        purchase.condicion === 'credito'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {purchase.condicion === 'credito' ? 'Crédito' : 'Contado'}
                      </span>
                    </td>

                    <td className="text-right font-mono text-xs text-slate-600">
                      ${formatNumber(purchase.subtotal)}
                    </td>

                    <td className="text-right font-mono font-bold text-xs text-slate-900">
                      ${formatNumber(purchase.total)}
                    </td>

                    <td className="text-right font-mono font-bold text-xs text-indigo-900">
                      Bs. {formatNumber(totalBs)}
                    </td>

                    <td className="text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        purchase.estado === 'anulada'
                          ? 'bg-rose-100 text-rose-700'
                          : purchaseIsPaid(purchase)
                            ? 'bg-emerald-100 text-emerald-800'
                            : purchase.estado === 'parcial'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                      }`}>
                        {purchase.estado === 'anulada' ? 'Anulada' : purchaseIsPaid(purchase) ? 'Pagada' : purchase.estado === 'parcial' ? 'Parcial' : 'Pendiente'}
                      </span>
                    </td>

                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPurchase(purchase)}
                          title={isServicio ? "Ver detalle del gasto/servicio" : "Ver detalle del ingreso a almacén"}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition cursor-pointer"
                        >
                          <Eye size={15} />
                        </button>

                        {purchase.estado !== 'anulada' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPurchaseToAnular(purchase);
                              setIsMasterAuthModalOpen(true);
                            }}
                            title="Anular documento (Requiere clave Master)"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                          >
                            <Trash2 size={15} />
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

      {/* MODAL DE DETALLE DEL DOCUMENTO */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Cabecera Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedPurchase.categoria_compra === 'servicio' || selectedPurchase.tipo_documento === 'servicio'
                    ? 'bg-purple-50 text-purple-600'
                    : 'bg-indigo-50 text-indigo-600'
                }`}>
                  {selectedPurchase.categoria_compra === 'servicio' || selectedPurchase.tipo_documento === 'servicio' ? (
                    <Briefcase size={20} />
                  ) : (
                    <FileText size={20} />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {selectedPurchase.categoria_compra === 'servicio' || selectedPurchase.tipo_documento === 'servicio'
                      ? 'Comprobante de Gasto / Servicio'
                      : 'Comprobante de Recepción de Mercancía'
                    }
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Doc. N° {selectedPurchase.numero} {selectedPurchase.control_numero ? `| Control: ${selectedPurchase.control_numero}` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              
              {/* Datos del Proveedor y Fecha */}
              {(() => {
                const supp = contactos.find(c => c.id === selectedPurchase.proveedor_id);
                const provNombre = selectedPurchase.proveedor_nombre || supp?.name || 'Proveedor';
                const provRif = selectedPurchase.proveedor_rif || supp?.tax_id || (supp as any)?.taxId || '';
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Proveedor</span>
                      <span className="font-bold text-slate-900">{provNombre}</span>
                      {provRif && <span className="text-[11px] font-mono text-slate-500 block">{provRif}</span>}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Fecha Emisión</span>
                      <span className="font-mono font-bold text-slate-800">{selectedPurchase.fecha_emision}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Condición</span>
                      <span className="font-bold text-slate-800">{selectedPurchase.condicion === 'credito' ? 'Crédito' : 'Contado'}</span>
                      {selectedPurchase.dias_credito ? <span className="text-[10px] text-slate-400 block">{selectedPurchase.dias_credito} días</span> : null}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Tasa Aplicada</span>
                      <span className="font-mono font-bold text-indigo-900">Bs. {Number(selectedPurchase.tasa_cambio || 0).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Detalle de ítems o concepto del servicio */}
              {selectedPurchase.categoria_compra === 'servicio' || selectedPurchase.tipo_documento === 'servicio' ? (
                <div className="p-4 bg-purple-50/40 border border-purple-100 rounded-xl space-y-2">
                  <span className="text-[10px] uppercase font-bold text-purple-700 block tracking-wider">Concepto del Gasto / Servicio</span>
                  <p className="text-sm font-semibold text-slate-800">
                    {selectedPurchase.concepto_gasto || selectedPurchase.items?.[0]?.descripcion || 'Servicio prestado a la compañía'}
                  </p>
                  {selectedPurchase.categoria_gasto && (
                    <span className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 capitalize">
                      Categoría: {selectedPurchase.categoria_gasto.replace('_', ' ')}
                    </span>
                  )}
                  {selectedPurchase.condicion === 'credito' && (
                    <p className="text-xs text-amber-700 font-semibold mt-1">
                      ⚠️ Registrado a crédito. Cuenta por Pagar activa con saldo pendiente: ${formatNumber(selectedPurchase.saldo_pendiente || selectedPurchase.total)}.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                    Artículos Ingresados al Inventario
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Código / SKU</th>
                          <th className="p-2.5">Descripción del Artículo</th>
                          <th className="p-2.5 text-center">Cant.</th>
                          <th className="p-2.5 text-right">Costo Unit. ($)</th>
                          <th className="p-2.5 text-right">Subtotal ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedPurchase.items && selectedPurchase.items.length > 0 ? (
                          selectedPurchase.items.map((it, idx) => {
                            const prod = products.find(p => p.id === it.producto_id);
                            const codigo = it.codigo || it.producto_codigo || prod?.codigo || '-';
                            const desc = it.descripcion || prod?.nombre || 'Artículo';
                            const cant = Number(it.cantidad) || 1;
                            const costo = Number(it.costo_unitario) || 0;
                            const subt = Number(it.subtotal || (cant * costo));
                            return (
                              <tr key={idx} className="hover:bg-slate-50/50">
                                <td className="p-2.5 font-mono font-bold text-slate-700">{codigo}</td>
                                <td className="p-2.5 font-semibold text-slate-900">{desc}</td>
                                <td className="p-2.5 text-center font-bold text-slate-800">{cant} {it.unidad_medida || prod?.unidad_medida || 'UND'}</td>
                                <td className="p-2.5 text-right font-mono text-slate-700">${costo.toFixed(2)}</td>
                                <td className="p-2.5 text-right font-mono font-bold text-slate-900">${subt.toFixed(2)}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-400">
                              No se encontraron renglones detallados para este documento.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Resumen de Totales */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1.5 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold">${Number(selectedPurchase.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>IVA (Crédito Fiscal):</span>
                    <span className="font-mono font-bold">${Number(selectedPurchase.iva_monto || 0).toFixed(2)}</span>
                  </div>
                  {Number(selectedPurchase.retencion_iva_monto || 0) > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Ret. IVA ({selectedPurchase.retencion_iva_porcentaje}%):</span>
                      <span className="font-mono font-bold">-${Number(selectedPurchase.retencion_iva_monto || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(selectedPurchase.retencion_islr_monto || 0) > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Ret. ISLR ({selectedPurchase.retencion_islr_porcentaje}%):</span>
                      <span className="font-mono font-bold">-${Number(selectedPurchase.retencion_islr_monto || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-sm text-slate-900">
                    <span>Total USD:</span>
                    <span className="font-mono text-indigo-600">${Number(selectedPurchase.total || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-xs text-indigo-900">
                    <span>Total Bs.:</span>
                    <span className="font-mono">
                      Bs. {Number(selectedPurchase.total_bs || (selectedPurchase.total * (selectedPurchase.tasa_cambio || exchangeRate))).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie Modal */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                <span>Imprimir Comprobante</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPurchase(null)}
                className="btn-primary text-xs py-2 px-4 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ESPECIALIZADO DE GASTOS Y SERVICIOS */}
      {isServiceModalOpen && (
        <ServiceExpenseModal
          isOpen={isServiceModalOpen}
          onClose={() => setIsServiceModalOpen(false)}
          contactos={contactos}
          cuentasContables={cuentasContables}
          categorias={categoriasProducto}
          bancos={bancos}
          configContable={configContable}
          currentExchangeRate={exchangeRate}
          workingYear={workingYear}
          onSave={onSave}
          showToast={showToast}
        />
      )}

      {/* MODAL DE AUTORIZACIÓN MASTER PARA ANULACIÓN */}
      <MasterAuthModal
        isOpen={isMasterAuthModalOpen}
        onClose={() => {
          setIsMasterAuthModalOpen(false);
          setPurchaseToAnular(null);
        }}
        onSuccess={handleConfirmAnulacion}
        title="Autorización para Anular Operación"
        actionDetails={`Está a punto de anular el documento N° ${purchaseToAnular?.numero || ''} de ${purchaseToAnular?.proveedor_nombre || ''}. Esta acción anulará el comprobante contable y la cuenta por pagar vinculada.`}
      />
    </div>
  );
}
