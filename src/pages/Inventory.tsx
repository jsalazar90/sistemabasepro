import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Package, Search, Plus, ArrowUpRight, ArrowDownRight, 
  AlertTriangle, CheckCircle2, Edit2, Trash2, RotateCcw, 
  History, DollarSign, Filter, Layers, Box, Tag, BookOpen, 
  RefreshCw, TrendingUp, Info, Printer, Download, Eye, 
  Barcode, Building, ArrowRight, ArrowLeftRight, 
  Check, X, ShieldCheck, Warehouse, ChevronRight, Hash,
  Sparkles, FileText, Share2, CornerDownRight, Lock, Key,
  ClipboardCheck, ShieldAlert, LayoutGrid, List, CheckCircle,
  Building2, MoreVertical, Boxes, Percent, SlidersHorizontal,
  ExternalLink, FileSpreadsheet
} from 'lucide-react';
import BackButton from '../components/common/BackButton';
import CuentaSelectorTrigger from '../components/common/CuentaSelectorTrigger';
import CuentaContableModal from '../components/common/CuentaContableModal';
import { ProductModel, MovimientoInventarioModel, AlmacenModel, CategoriaProductoModel } from '../types/database';
import { getTasaForDate, fetchLiveBcvRate } from '../services/exchangeRateService';
import { getTodayLocalDate } from '../utils/dateUtils';
import { useCompany } from '../context/CompanyContext';
import { dbFetchAlmacenes, dbSaveAlmacen, dbDeleteAlmacen, dbActualizarStockAtomico, dbActualizarStockLoteAtomico, isUUID } from '../services/db';

const DEFAULT_ALMACENES: AlmacenModel[] = [
  { id: '00000000-0000-4000-8000-000000000001', empresa_id: '', codigo: 'DEP-01', nombre: 'Almacén Principal (Central)', ubicacion: 'Galpón Central A', responsable: 'Administración', es_principal: true, activo: true }
];


const getCategoryColorBadge = (color?: string) => {
  switch (color) {
    case 'emerald':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'amber':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'blue':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'orange':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'cyan':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'purple':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'rose':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'slate':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'indigo':
    default:
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  }
};

export default function Inventory({
  products = [],
  movimientosInventario = [],
  cuentasContables = [],
  categoriasProducto = [],
  almacenes: propAlmacenes = [],
  onSave,
  showToast
}: {
  products?: ProductModel[];
  movimientosInventario?: MovimientoInventarioModel[];
  cuentasContables?: any[];
  categoriasProducto?: any[];
  almacenes?: AlmacenModel[];
  onSave?: (collection: string, data: any) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const { activeCompanyId } = useCompany();
  const { submodule } = useParams<{ submodule?: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'catalogo' | 'categorias' | 'auditoria' | 'kardex' | 'almacenes' | 'precios'>(() => {
    if (submodule === 'auditoria') return 'auditoria';
    if (submodule === 'kardex') return 'kardex';
    if (submodule === 'precios') return 'precios';
    if (submodule === 'categorias') return 'categorias';
    if (submodule === 'almacenes' || submodule === 'depositos') return 'almacenes';
    return 'catalogo';
  });

  useEffect(() => {
    if (submodule) {
      if (submodule === 'auditoria') setActiveTab('auditoria');
      else if (submodule === 'kardex') setActiveTab('kardex');
      else if (submodule === 'precios') setActiveTab('precios');
      else if (submodule === 'categorias') setActiveTab('categorias');
      else if (submodule === 'almacenes' || submodule === 'depositos') setActiveTab('almacenes');
      else if (submodule === 'catalogo') {
        if (!['catalogo', 'categorias', 'almacenes'].includes(activeTab)) {
          setActiveTab('catalogo');
        }
      }
    }
  }, [submodule]);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(() => {
    const today = getTodayLocalDate();
    return getTasaForDate(today);
  });
  const [isSyncingBcv, setIsSyncingBcv] = useState(false);

  const handleSyncBcv = async () => {
    setIsSyncingBcv(true);
    try {
      const res = await fetchLiveBcvRate(true);
      if (res.success && res.tasa) {
        setExchangeRate(res.tasa);
        showToast?.(`Tasa BCV oficial actualizada: Bs. ${res.tasa.toFixed(2)}`, 'success');
      } else {
        showToast?.(res.error || 'No se pudo sincronizar la tasa en vivo', 'error');
      }
    } catch {
      showToast?.('Error al conectar con el BCV', 'error');
    } finally {
      setIsSyncingBcv(false);
    }
  };

  useEffect(() => {
    const today = getTodayLocalDate();
    const stored = getTasaForDate(today);
    if (stored === 36.5) {
      fetchLiveBcvRate(false).then(res => {
        if (res.success && res.tasa) setExchangeRate(res.tasa);
      });
    }
  }, []);

  const [almacenes, setAlmacenes] = useState<AlmacenModel[]>(() => {
    if (propAlmacenes && propAlmacenes.length > 0) return propAlmacenes;
    return DEFAULT_ALMACENES;
  });

  useEffect(() => {
    if (propAlmacenes && propAlmacenes.length > 0) {
      setAlmacenes(propAlmacenes);
    } else if (activeCompanyId) {
      dbFetchAlmacenes(activeCompanyId).then(list => {
        if (list && list.length > 0) setAlmacenes(list);
      });
    }
  }, [propAlmacenes, activeCompanyId]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('Todos');
  const [stockStatusFilter, setStockStatusFilter] = useState<'todos' | 'en_stock' | 'bajo_stock' | 'agotados'>('todos');

  // Modales
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductModel | null>(null);
  const [productModalTab, setProductModalTab] = useState<'general' | 'precios' | 'stock' | 'contabilidad'>('general');

  // Estados de Categorías de Inventario (exclusivamente desde la base de datos)
  const [categorias, setCategorias] = useState<CategoriaProductoModel[]>(() => {
    try {
      localStorage.removeItem('sistema_categorias_inventario');
    } catch {}
    return Array.isArray(categoriasProducto) ? categoriasProducto : [];
  });

  useEffect(() => {
    if (Array.isArray(categoriasProducto)) {
      setCategorias(categoriasProducto);
    }
  }, [categoriasProducto]);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoriaProductoModel | null>(null);
  const [isCategoryCreatedFromProductModal, setIsCategoryCreatedFromProductModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    codigo: '',
    nombre: '',
    descripcion: '',
    color: 'indigo',
    activo: true
  });

  // Estados de Almacenes / Depósitos
  const [isAlmacenModalOpen, setIsAlmacenModalOpen] = useState(false);
  const [editingAlmacen, setEditingAlmacen] = useState<AlmacenModel | null>(null);
  const [almacenSearchTerm, setAlmacenSearchTerm] = useState('');
  const [almacenForm, setAlmacenForm] = useState({
    codigo: '',
    nombre: '',
    ubicacion: '',
    responsable: '',
    es_principal: false,
    activo: true
  });

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferProduct, setTransferProduct] = useState<ProductModel | null>(null);

  // Estados de Auditoría
  const [auditCounts, setAuditCounts] = useState<Record<string, string>>({});
  const [auditWarehouseFilter, setAuditWarehouseFilter] = useState<string>('todos');
  const [auditStatusFilter, setAuditStatusFilter] = useState<'todos' | 'diferencias' | 'cuadrados' | 'pendientes'>('todos');
  const [auditSearchTerm, setAuditSearchTerm] = useState('');

  // Modal Clave de Supervisor
  const [isAuditSecurityModalOpen, setIsAuditSecurityModalOpen] = useState(false);
  const [auditTargetItem, setAuditTargetItem] = useState<{
    product: ProductModel;
    systemStock: number;
    physicalCount: number;
    diff: number;
  } | null>(null);
  const [isBatchAuditModalOpen, setIsBatchAuditModalOpen] = useState(false);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [auditMotivo, setAuditMotivo] = useState('Ajuste por Auditoría Física de Inventario');

  const VALID_PINS = ['admin', '1234', 'super', 'audit2026', '0000'];

  // Formulario Producto
  const [productForm, setProductForm] = useState({
    codigo: '',
    codigo_barra: '',
    referencia_fabrica: '',
    nombre: '',
    descripcion: '',
    categoria: '',
    marca: '',
    ubicacion: 'Central',
    unidad_medida: 'UND',
    costo_unitario: '',
    precio_venta: '',
    precio_mayor: '',
    stock_actual: '0',
    stock_minimo: '5',
    punto_reorden: '10',
    almacen_id: DEFAULT_ALMACENES[0].id,
    aplica_iva: true,
    alicuota_iva: 'general',
    cuenta_inventario_id: '',
    cuenta_costo_id: '',
    cuenta_ingreso_id: '',
    cuenta_venta_id: '',
    activo: true
  });

  // Helper para mostrar código de cuenta contable legible
  const getAccCode = (idOrCode?: string) => {
    if (!idOrCode) return '-';
    const found = cuentasContables.find(c => String(c.id) === String(idOrCode) || String(c.codigo) === String(idOrCode));
    return found?.codigo || idOrCode;
  };

  // Selector de cuenta contable
  const [activeAccountKey, setActiveAccountKey] = useState<string | null>(null);
  const [showCuentaModal, setShowCuentaModal] = useState(false);

  // Formulario Transferencia
  const [transferForm, setTransferForm] = useState({
    producto_id: '',
    almacen_origen_id: DEFAULT_ALMACENES[0].id,
    almacen_destino_id: DEFAULT_ALMACENES[0].id,
    cantidad: '',
    referencia: ''
  });

  // Filtros Kardex con selector de producto
  const [selectedKardexProductId, setSelectedKardexProductId] = useState<string>('');
  const [kardexTypeFilter, setKardexTypeFilter] = useState('todos');
  const [kardexDateFrom, setKardexDateFrom] = useState('');
  const [kardexDateTo, setKardexDateTo] = useState('');

  const selectedKardexProduct = useMemo(() => {
    if (!selectedKardexProductId || selectedKardexProductId === 'todos') return null;
    return products.find(p => p.id === selectedKardexProductId) || null;
  }, [products, selectedKardexProductId]);

  const filteredKardexMovements = useMemo(() => {
    if (!selectedKardexProductId) return [];
    return movimientosInventario
      .filter(m => {
        if (selectedKardexProductId !== 'todos') {
          if (m.producto_id !== selectedKardexProductId && m.producto_codigo !== selectedKardexProduct?.codigo) {
            return false;
          }
        }
        if (kardexTypeFilter !== 'todos' && m.tipo !== kardexTypeFilter) return false;
        if (kardexDateFrom && m.fecha < kardexDateFrom) return false;
        if (kardexDateTo && m.fecha > kardexDateTo) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at || b.fecha).getTime() - new Date(a.created_at || a.fecha).getTime());
  }, [movimientosInventario, selectedKardexProductId, selectedKardexProduct, kardexTypeFilter, kardexDateFrom, kardexDateTo]);

  // Consolidado de Categorías para el filtro en Catálogo (exclusivamente categorías activas de la BD)
  const categoriesList = useMemo(() => {
    const list = categorias.filter(c => c.activo).map(c => c.nombre.trim());
    return ['Todos', ...list];
  }, [categorias]);

  // Métricas de Categorías
  const filteredCategorias = useMemo(() => {
    const q = categorySearchTerm.toLowerCase().trim();
    if (!q) return categorias;
    return categorias.filter(c => 
      c.nombre.toLowerCase().includes(q) || 
      c.codigo.toLowerCase().includes(q) || 
      (c.descripcion && c.descripcion.toLowerCase().includes(q))
    );
  }, [categorias, categorySearchTerm]);

  // Artículos Filtrados en Catálogo
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || 
        p.nombre?.toLowerCase().includes(q) || 
        p.codigo?.toLowerCase().includes(q) ||
        p.codigo_barra?.toLowerCase().includes(q) ||
        p.marca?.toLowerCase().includes(q);

      const matchCat = selectedCategory === 'Todos' || p.categoria === selectedCategory;
      const matchWarehouse = selectedWarehouseFilter === 'Todos' || p.almacen_id === selectedWarehouseFilter;

      const stock = Number(p.stock_actual) || 0;
      const reorder = Number(p.punto_reorden) || 10;

      let matchStatus = true;
      if (stockStatusFilter === 'agotados') matchStatus = stock <= 0;
      else if (stockStatusFilter === 'bajo_stock') matchStatus = stock > 0 && stock <= reorder;
      else if (stockStatusFilter === 'en_stock') matchStatus = stock > reorder;

      return matchSearch && matchCat && matchWarehouse && matchStatus;
    });
  }, [products, searchTerm, selectedCategory, selectedWarehouseFilter, stockStatusFilter]);

  // Artículos Filtrados en Auditoría
  const filteredAuditProducts = useMemo(() => {
    return products.filter(p => {
      if (auditWarehouseFilter !== 'todos' && p.almacen_id !== auditWarehouseFilter) {
        return false;
      }

      if (auditSearchTerm.trim()) {
        const q = auditSearchTerm.toLowerCase();
        const matchSku = p.codigo?.toLowerCase().includes(q);
        const matchBar = p.codigo_barra?.toLowerCase().includes(q);
        const matchNom = p.nombre?.toLowerCase().includes(q);
        if (!matchSku && !matchBar && !matchNom) return false;
      }

      const inputVal = auditCounts[p.id];
      const hasCount = inputVal !== undefined && inputVal.trim() !== '';
      const physical = hasCount ? parseFloat(inputVal) : NaN;
      const system = Number(p.stock_actual) || 0;
      const isSquare = hasCount && !isNaN(physical) && physical === system;
      const hasDiff = hasCount && !isNaN(physical) && physical !== system;

      if (auditStatusFilter === 'diferencias') return hasDiff;
      if (auditStatusFilter === 'cuadrados') return isSquare;
      if (auditStatusFilter === 'pendientes') return !hasCount;

      return true;
    });
  }, [products, auditCounts, auditWarehouseFilter, auditSearchTerm, auditStatusFilter]);

  // Métricas de Auditoría
  const auditMetrics = useMemo(() => {
    let counted = 0;
    let differencesCount = 0;
    let squaresCount = 0;
    let netUnitDiff = 0;
    let netFinancialDiffUSD = 0;

    products.forEach(p => {
      const inputVal = auditCounts[p.id];
      if (inputVal !== undefined && inputVal.trim() !== '') {
        const physical = parseFloat(inputVal);
        if (!isNaN(physical)) {
          counted++;
          const system = Number(p.stock_actual) || 0;
          const diff = physical - system;
          if (diff === 0) {
            squaresCount++;
          } else {
            differencesCount++;
            netUnitDiff += diff;
            const cost = Number(p.costo_unitario) || 0;
            netFinancialDiffUSD += (diff * cost);
          }
        }
      }
    });

    return {
      totalProducts: products.length,
      counted,
      differencesCount,
      squaresCount,
      netUnitDiff,
      netFinancialDiffUSD
    };
  }, [products, auditCounts]);

  // Estadísticas del Inventario de Alto Impacto
  const stats = useMemo(() => {
    let totalUnits = 0;
    let totalCostValuationUSD = 0;
    let totalRetailValuationUSD = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      const stock = Number(p.stock_actual) || 0;
      const cost = Number(p.costo_unitario) || 0;
      const pvp = Number(p.precio_venta) || 0;
      const reorder = Number(p.punto_reorden) || 10;

      totalUnits += stock;
      totalCostValuationUSD += (stock * cost);
      totalRetailValuationUSD += (stock * pvp);

      if (stock <= 0) outOfStockCount++;
      else if (stock <= reorder) lowStockCount++;
    });

    const inStockCount = Math.max(0, products.length - outOfStockCount - lowStockCount);
    const totalMarginUSD = Math.max(0, totalRetailValuationUSD - totalCostValuationUSD);
    const avgMarginPercent = totalRetailValuationUSD > 0 
      ? (totalMarginUSD / totalRetailValuationUSD) * 100 
      : 0;
    const availabilityRate = products.length > 0
      ? Math.round((inStockCount / products.length) * 100)
      : 100;

    return {
      totalUnits,
      totalCostValuationUSD,
      totalRetailValuationUSD,
      totalMarginUSD,
      avgMarginPercent,
      availabilityRate,
      outOfStockCount,
      lowStockCount,
      inStockCount
    };
  }, [products]);

  // Handlers Auditoría
  const handleAuditCountChange = (productId: string, val: string) => {
    setAuditCounts(prev => ({ ...prev, [productId]: val }));
  };

  const handleQuickCountAdjust = (productId: string, delta: number, currentStock: number) => {
    const currentVal = auditCounts[productId] !== undefined 
      ? parseFloat(auditCounts[productId]) 
      : currentStock;
    const nextVal = Math.max(0, (isNaN(currentVal) ? 0 : currentVal) + delta);
    setAuditCounts(prev => ({ ...prev, [productId]: String(nextVal) }));
  };

  const handleSetCountToSystem = (productId: string, stock: number) => {
    setAuditCounts(prev => ({ ...prev, [productId]: String(stock) }));
  };

  const handleResetAuditCounts = () => {
    if (window.confirm('¿Reiniciar los conteos físicos de la auditoría?')) {
      setAuditCounts({});
      showToast?.('Conteos reiniciados', 'info');
    }
  };

  const handleOpenAuditAdjustModal = (product: ProductModel, systemStock: number, physicalCount: number, diff: number) => {
    setAuditTargetItem({ product, systemStock, physicalCount, diff });
    setSupervisorPin('');
    setPinError('');
    setShowPin(false);
    setAuditMotivo(`Auditoría Física: Diferencia de ${diff > 0 ? '+' : ''}${diff} ${product.unidad_medida} (Sistema: ${systemStock}, Físico: ${physicalCount})`);
    setIsAuditSecurityModalOpen(true);
  };

  const handleConfirmAuditAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditTargetItem) return;

    const pin = supervisorPin.trim();
    if (!pin) {
      setPinError('Ingrese la clave de supervisor');
      return;
    }
    if (!VALID_PINS.includes(pin)) {
      setPinError('Clave incorrecta (prueba: admin o 1234)');
      return;
    }

    const { product, systemStock, physicalCount, diff } = auditTargetItem;

    if (activeCompanyId) {
      try {
        await dbActualizarStockAtomico(
          activeCompanyId,
          product.id,
          Math.abs(diff),
          diff > 0 ? 'ajuste_positivo' : 'ajuste_negativo',
          {
            referencia: auditMotivo.trim() || 'Ajuste de Auditoría Física',
            usuario: 'Supervisor Autorizado'
          }
        );
      } catch (err) {
        console.warn('Error en ajuste atómico de inventario:', err);
      }
    }

    const updatedProd: ProductModel = {
      ...product,
      stock_actual: physicalCount,
      updated_at: new Date().toISOString()
    };
    await onSave?.('products', updatedProd);

    const movement: MovimientoInventarioModel = {
      id: crypto.randomUUID(),
      empresa_id: activeCompanyId || product.empresa_id || '',
      producto_id: product.id,
      producto_nombre: product.nombre,
      producto_codigo: product.codigo,
      tipo: diff > 0 ? 'ajuste_positivo' : 'ajuste_negativo',
      cantidad: Math.abs(diff),
      stock_anterior: systemStock,
      stock_resultante: physicalCount,
      costo_unitario: product.costo_unitario || 0,
      referencia: auditMotivo.trim() || 'Ajuste de Auditoría Física',
      fecha: getTodayLocalDate(),
      usuario: 'Supervisor Autorizado',
      created_at: new Date().toISOString()
    };
    await onSave?.('movimientosInventario', movement);

    const diffCost = Math.abs(diff) * (product.costo_unitario || 0);
    if (diffCost > 0) {
      const cuentaInv = product.cuenta_inventario_id || '1.1.04.001';
      const ctaContrapartida = diff > 0 ? '4.2.01.001' : '6.1.05.001';
      const voucherLineas = diff > 0 ? [
        { id: crypto.randomUUID(), cuentaId: cuentaInv, cuenta_id: cuentaInv, descripcion: `Ajuste Auditoría: ${product.nombre} (Sobrante)`, debe: Number(diffCost.toFixed(2)), haber: 0 },
        { id: crypto.randomUUID(), cuentaId: ctaContrapartida, cuenta_id: ctaContrapartida, descripcion: `Ganancia por Ajuste Físico: ${product.nombre}`, debe: 0, haber: Number(diffCost.toFixed(2)) }
      ] : [
        { id: crypto.randomUUID(), cuentaId: ctaContrapartida, cuenta_id: ctaContrapartida, descripcion: `Pérdida por Ajuste Físico: ${product.nombre}`, debe: Number(diffCost.toFixed(2)), haber: 0 },
        { id: crypto.randomUUID(), cuentaId: cuentaInv, cuenta_id: cuentaInv, descripcion: `Ajuste Auditoría: ${product.nombre} (Faltante)`, debe: 0, haber: Number(diffCost.toFixed(2)) }
      ];

      const voucher = {
        id: crypto.randomUUID(),
        empresa_id: activeCompanyId,
        numero: `AUD-${Date.now().toString().slice(-6)}`,
        fecha: getTodayLocalDate(),
        tipo: 'Diario',
        descripcion: `Ajuste de Auditoría: ${product.nombre} (${diff > 0 ? 'Sobrante' : 'Faltante'})`,
        total: Number(diffCost.toFixed(2)),
        estado: 'Contabilizado',
        lineas: voucherLineas,
        detalles: voucherLineas
      };
      await onSave?.('comprobantes', voucher);
    }

    showToast?.(`Stock actualizado a ${physicalCount} ${product.unidad_medida}`, 'success');
    setIsAuditSecurityModalOpen(false);
    setAuditTargetItem(null);
  };

  const handleOpenBatchAuditModal = () => {
    setSupervisorPin('');
    setPinError('');
    setShowPin(false);
    setIsBatchAuditModalOpen(true);
  };

  const handleConfirmBatchAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pin = supervisorPin.trim();
    if (!VALID_PINS.includes(pin)) {
      setPinError('Clave de supervisor incorrecta (prueba: admin o 1234)');
      return;
    }

    const itemsToAdjust = products.filter(p => {
      const inputVal = auditCounts[p.id];
      if (!inputVal || inputVal.trim() === '') return false;
      const physical = parseFloat(inputVal);
      if (isNaN(physical)) return false;
      return physical !== (Number(p.stock_actual) || 0);
    });

    if (itemsToAdjust.length === 0) {
      showToast?.('No hay diferencias pendientes para ajustar', 'info');
      setIsBatchAuditModalOpen(false);
      return;
    }

    const batchStockItems = itemsToAdjust.map(p => {
      const physical = parseFloat(auditCounts[p.id]);
      const system = Number(p.stock_actual) || 0;
      const diff = physical - system;
      return {
        producto_id: p.id,
        cantidad: Math.abs(diff),
        costo_unitario: p.costo_unitario || 0
      };
    });

    if (activeCompanyId && batchStockItems.length > 0) {
      try {
        await dbActualizarStockLoteAtomico(
          activeCompanyId,
          batchStockItems,
          'ajuste',
          {
            referencia: 'Ajuste Masivo de Auditoría Física',
            usuario: 'Supervisor Autorizado (Masivo)'
          }
        );
      } catch (err) {
        console.warn('Error en ajuste masivo atómico:', err);
      }
    }

    const batchLines: any[] = [];

    for (const p of itemsToAdjust) {
      const physical = parseFloat(auditCounts[p.id]);
      const system = Number(p.stock_actual) || 0;
      const diff = physical - system;

      // 1. Actualizar stock del producto
      await onSave?.('products', {
        ...p,
        stock_actual: physical,
        updated_at: new Date().toISOString()
      });

      // 2. Registrar movimiento de auditoría
      await onSave?.('movimientosInventario', {
        id: crypto.randomUUID(),
        empresa_id: activeCompanyId || p.empresa_id || '',
        producto_id: p.id,
        producto_nombre: p.nombre,
        producto_codigo: p.codigo,
        tipo: diff > 0 ? 'ajuste_positivo' : 'ajuste_negativo',
        cantidad: Math.abs(diff),
        stock_anterior: system,
        stock_resultante: physical,
        costo_unitario: p.costo_unitario || 0,
        referencia: `Ajuste Masivo de Auditoría (${diff > 0 ? '+' : ''}${diff} ${p.unidad_medida})`,
        fecha: getTodayLocalDate(),
        usuario: 'Supervisor Autorizado (Masivo)',
        created_at: new Date().toISOString()
      });

      // 3. Agregar línea contable al comprobante masivo
      const diffCost = Math.abs(diff) * (p.costo_unitario || 0);
      if (diffCost > 0) {
        const cuentaInv = p.cuenta_inventario_id || '1.1.04.001';
        if (diff > 0) {
          batchLines.push({ id: crypto.randomUUID(), cuentaId: cuentaInv, cuenta_id: cuentaInv, descripcion: `Sobrante Inventario: ${p.nombre}`, debe: Number(diffCost.toFixed(2)), haber: 0 });
          batchLines.push({ id: crypto.randomUUID(), cuentaId: '4.2.01.001', cuenta_id: '4.2.01.001', descripcion: `Ganancia Ajuste: ${p.nombre}`, debe: 0, haber: Number(diffCost.toFixed(2)) });
        } else {
          batchLines.push({ id: crypto.randomUUID(), cuentaId: '6.1.05.001', cuenta_id: '6.1.05.001', descripcion: `Faltante Inventario: ${p.nombre}`, debe: Number(diffCost.toFixed(2)), haber: 0 });
          batchLines.push({ id: crypto.randomUUID(), cuentaId: cuentaInv, cuenta_id: cuentaInv, descripcion: `Baja Inventario: ${p.nombre}`, debe: 0, haber: Number(diffCost.toFixed(2)) });
        }
      }
    }

    if (batchLines.length > 0) {
      const totalBatch = batchLines.reduce((acc, l) => acc + (Number(l.debe) || 0), 0);
      await onSave?.('comprobantes', {
        id: crypto.randomUUID(),
        empresa_id: activeCompanyId,
        numero: `ABATCH-${Date.now().toString().slice(-6)}`,
        fecha: getTodayLocalDate(),
        tipo: 'Diario',
        descripcion: `Ajuste Masivo de Auditoría (${itemsToAdjust.length} artículos)`,
        total: Number(totalBatch.toFixed(2)),
        estado: 'Contabilizado',
        lineas: batchLines,
        detalles: batchLines
      });
    }

    showToast?.(`Se ajustaron exitosamente ${itemsToAdjust.length} artículos`, 'success');
    setIsBatchAuditModalOpen(false);
  };

  // Guardar Producto
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.nombre.trim() || !productForm.codigo.trim()) {
      showToast?.('Código SKU y Nombre son obligatorios', 'error');
      return;
    }

    const costo = parseFloat(productForm.costo_unitario) || 0;
    const precio = parseFloat(productForm.precio_venta) || 0;
    const precioMayor = parseFloat(productForm.precio_mayor) || (precio * 0.9);
    const stockActual = parseFloat(productForm.stock_actual) || 0;
    const stockMinimo = parseFloat(productForm.stock_minimo) || 0;
    const puntoReorden = parseFloat(productForm.punto_reorden) || 10;
    const prodId = (editingProduct && isUUID(editingProduct.id)) ? editingProduct.id : crypto.randomUUID();
    const targetAlmacen = almacenes.find(a => a.id === productForm.almacen_id) || almacenes[0];

    const newProd: ProductModel = {
      id: prodId,
      empresa_id: activeCompanyId,
      codigo: productForm.codigo.trim().toUpperCase(),
      codigo_barra: productForm.codigo_barra.trim(),
      referencia_fabrica: productForm.referencia_fabrica.trim().toUpperCase(),
      nombre: productForm.nombre.trim(),
      descripcion: productForm.descripcion.trim(),
      categoria: productForm.categoria.trim() || (categorias.find(c => c.activo)?.nombre || ''),
      marca: productForm.marca.trim(),
      ubicacion: productForm.ubicacion.trim(),
      unidad_medida: productForm.unidad_medida.trim() || 'UND',
      costo_unitario: costo,
      costo_promedio: costo,
      precio_venta: precio,
      precio_mayor: precioMayor,
      stock_actual: editingProduct ? editingProduct.stock_actual : stockActual,
      stock_minimo: stockMinimo,
      punto_reorden: puntoReorden,
      almacen_id: targetAlmacen.id,
      almacen_nombre: targetAlmacen.nombre,
      aplica_iva: productForm.alicuota_iva !== 'exento',
      alicuota_iva: productForm.alicuota_iva,
      cuenta_inventario_id: productForm.cuenta_inventario_id || '',
      cuenta_costo_id: productForm.cuenta_costo_id || '',
      cuenta_ingreso_id: productForm.cuenta_ingreso_id || productForm.cuenta_venta_id || '',
      cuenta_venta_id: productForm.cuenta_venta_id || productForm.cuenta_ingreso_id || '',
      activo: productForm.activo !== false,
      updated_at: new Date().toISOString(),
      created_at: editingProduct ? editingProduct.created_at : new Date().toISOString()
    };

    onSave?.('products', newProd);

    if (!editingProduct && stockActual > 0) {
      onSave?.('movimientosInventario', {
        id: crypto.randomUUID(),
        empresa_id: activeCompanyId,
        producto_id: prodId,
        producto_nombre: newProd.nombre,
        producto_codigo: newProd.codigo,
        tipo: 'entrada',
        cantidad: stockActual,
        stock_anterior: 0,
        stock_resultante: stockActual,
        costo_unitario: costo,
        referencia: `Inventario Inicial (${targetAlmacen.codigo})`,
        fecha: getTodayLocalDate(),
        usuario: 'Administrador',
        created_at: new Date().toISOString()
      });

      const totalCost = stockActual * costo;
      if (totalCost > 0) {
        onSave?.('comprobantes', {
          id: crypto.randomUUID(),
          empresa_id: activeCompanyId,
          numero: `INV-${Date.now().toString().slice(-6)}`,
          fecha: getTodayLocalDate(),
          descripcion: `Inventario Inicial: ${newProd.nombre}`,
          estado: 'procesado',
          detalles: [
            { cuenta_id: newProd.cuenta_inventario_id || '', descripcion: `Ingreso por Inventario Inicial`, debe: totalCost, haber: 0 },
            { cuenta_id: '3.1.01.001', descripcion: `Ajuste de Capital (Inventario Inicial)`, debe: 0, haber: totalCost }
          ]
        });
      }
    }

    showToast?.(editingProduct ? 'Artículo actualizado con éxito' : 'Artículo registrado con éxito', 'success');
    setIsProductModalOpen(false);
  };

  const handleDeleteProduct = (prod: ProductModel) => {
    // 1. Validar si el artículo tiene movimientos de entrada o salida de inventario
    const movimientosAsociados = movimientosInventario.filter(
      m => m.producto_id === prod.id || (prod.codigo && m.producto_codigo === prod.codigo)
    );

    const hasMovements = movimientosAsociados.length > 0;
    const hasStock = Number(prod.stock_actual) > 0;

    if (hasMovements || hasStock) {
      const entradas = movimientosAsociados.filter(
        m => m.tipo === 'entrada' || m.tipo?.includes('positivo') || m.tipo?.includes('ingreso')
      ).length;
      const salidas = movimientosAsociados.filter(
        m => m.tipo === 'salida' || m.tipo?.includes('negativo') || m.tipo?.includes('egreso') || m.tipo === 'venta'
      ).length;

      const detalle = hasMovements
        ? `posee ${movimientosAsociados.length} movimiento(s) en el inventario (${entradas} entrada(s), ${salidas} salida(s))`
        : `cuenta con un stock actual de ${prod.stock_actual} ${prod.unidad_medida}`;

      const confirmDesactivar = window.confirm(
        `⛔ No se puede eliminar el artículo "${prod.nombre}".\n\nMotivo: El producto ${detalle}.\n\nPara garantizar la consistencia contable e histórica del Kardex, los artículos con movimientos o existencias no pueden eliminarse.\n\n¿Desea marcarlo como INACTIVO en su lugar? (No estará disponible para nuevas ventas o compras pero conservará su historial).`
      );

      if (confirmDesactivar) {
        onSave?.('products', {
          ...prod,
          activo: false,
          updated_at: new Date().toISOString()
        });
        showToast?.(`Artículo "${prod.nombre}" marcado como Inactivo`, 'info');
      } else {
        showToast?.('Eliminación rechazada: El artículo registra movimientos de inventario', 'error');
      }
      return;
    }

    if (window.confirm(`¿Está seguro de eliminar "${prod.nombre}"? Esta acción no se puede deshacer.`)) {
      onSave?.('products', { id: prod.id, _delete: true });
      showToast?.('Artículo eliminado con éxito', 'info');
    }
  };

  const handleOpenEditProduct = (prod: ProductModel) => {
    setEditingProduct(prod);
    setProductForm({
      codigo: prod.codigo || '',
      codigo_barra: prod.codigo_barra || '',
      referencia_fabrica: prod.referencia_fabrica || '',
      nombre: prod.nombre || '',
      descripcion: prod.descripcion || '',
      categoria: prod.categoria || 'General',
      marca: prod.marca || '',
      ubicacion: prod.ubicacion || 'Central',
      unidad_medida: prod.unidad_medida || 'UND',
      costo_unitario: String(prod.costo_unitario ?? ''),
      precio_venta: String(prod.precio_venta ?? ''),
      precio_mayor: String(prod.precio_mayor ?? ''),
      stock_actual: String(prod.stock_actual ?? 0),
      stock_minimo: String(prod.stock_minimo ?? 5),
      punto_reorden: String(prod.punto_reorden ?? 10),
      almacen_id: prod.almacen_id || almacenes[0]?.id || DEFAULT_ALMACENES[0].id,
      aplica_iva: prod.aplica_iva ?? true,
      alicuota_iva: prod.alicuota_iva || (prod.aplica_iva ? 'general' : 'exento'),
      cuenta_inventario_id: prod.cuenta_inventario_id || '',
      cuenta_costo_id: prod.cuenta_costo_id || '',
      cuenta_ingreso_id: prod.cuenta_ingreso_id || prod.cuenta_venta_id || '',
      cuenta_venta_id: prod.cuenta_venta_id || prod.cuenta_ingreso_id || '',
      activo: prod.activo ?? true
    });
    setProductModalTab('general');
    setIsProductModalOpen(true);
  };

  const handleOpenNewProduct = () => {
    setEditingProduct(null);
    setProductForm({
      codigo: `ART-${String(products.length + 1).padStart(4, '0')}`,
      codigo_barra: '',
      referencia_fabrica: '',
      nombre: '',
      descripcion: '',
      categoria: categorias.find(c => c.activo)?.nombre || '',
      marca: '',
      ubicacion: 'Central',
      unidad_medida: 'UND',
      costo_unitario: '',
      precio_venta: '',
      precio_mayor: '',
      stock_actual: '0',
      stock_minimo: '5',
      punto_reorden: '10',
      almacen_id: almacenes[0]?.id || DEFAULT_ALMACENES[0].id,
      aplica_iva: true,
      alicuota_iva: 'general',
      cuenta_inventario_id: '',
      cuenta_costo_id: '',
      cuenta_ingreso_id: '',
      cuenta_venta_id: '',
      activo: true
    });
    setProductModalTab('general');
    setIsProductModalOpen(true);
  };

  // Navegar directamente al Kardex de un artículo específico
  const handleViewProductKardex = (productId: string) => {
    setSelectedKardexProductId(productId);
    setActiveTab('kardex');
    navigate('/inventory/kardex');
  };

  // Abrir modal de transferencia rápida para un artículo
  const handleOpenTransferForProduct = (prod: ProductModel) => {
    setTransferProduct(prod);
    setTransferForm({
      producto_id: prod.id,
      almacen_origen_id: prod.almacen_id || almacenes[0]?.id || DEFAULT_ALMACENES[0].id,
      almacen_destino_id: almacenes.find(a => a.id !== prod.almacen_id)?.id || almacenes[0]?.id || DEFAULT_ALMACENES[0].id,
      cantidad: '',
      referencia: `Transferencia rápida ${prod.codigo}`
    });
    setIsTransferModalOpen(true);
  };

  // Exportar Catálogo de Productos a CSV
  const handleExportProductsCSV = () => {
    if (filteredProducts.length === 0) {
      showToast?.('No hay artículos para exportar con los filtros actuales', 'info');
      return;
    }
    const headers = ['Código SKU', 'Código Barra', 'Nombre', 'Categoría', 'Marca', 'Ubicación', 'Unidad', 'Costo USD', 'PVP USD', 'PVP Bs (BCV)', 'Stock Actual', 'Mínimo', 'Punto Reorden', 'Estado'];
    const rows = filteredProducts.map(p => [
      p.codigo,
      p.codigo_barra || '',
      `"${(p.nombre || '').replace(/"/g, '""')}"`,
      `"${(p.categoria || '').replace(/"/g, '""')}"`,
      `"${(p.marca || '').replace(/"/g, '""')}"`,
      `"${(p.ubicacion || '').replace(/"/g, '""')}"`,
      p.unidad_medida,
      (Number(p.costo_unitario) || 0).toFixed(2),
      (Number(p.precio_venta) || 0).toFixed(2),
      ((Number(p.precio_venta) || 0) * exchangeRate).toFixed(2),
      Number(p.stock_actual) || 0,
      Number(p.stock_minimo) || 0,
      Number(p.punto_reorden) || 10,
      p.activo !== false ? 'Activo' : 'Inactivo'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `inventario_${getTodayLocalDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast?.('Catálogo de inventario exportado exitosamente', 'success');
  };

  // Handlers de Categorías
  const handleOpenNewCategory = (fromProductModal: boolean = false) => {
    setEditingCategory(null);
    setIsCategoryCreatedFromProductModal(fromProductModal);
    setCategoryForm({
      codigo: `CAT-${String(categorias.length + 1).padStart(2, '0')}`,
      nombre: '',
      descripcion: '',
      color: 'indigo',
      activo: true
    });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: CategoriaProductoModel) => {
    setEditingCategory(cat);
    setIsCategoryCreatedFromProductModal(false);
    setCategoryForm({
      codigo: cat.codigo || '',
      nombre: cat.nombre || '',
      descripcion: cat.descripcion || '',
      color: cat.color || 'indigo',
      activo: cat.activo ?? true
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNombre = categoryForm.nombre.trim();
    if (!cleanNombre) {
      showToast?.('El nombre de la categoría es obligatorio', 'error');
      return;
    }

    const code = categoryForm.codigo.trim() || cleanNombre.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'CAT');
    let updatedList: CategoriaProductoModel[];

    if (editingCategory) {
      const updatedCat: CategoriaProductoModel = {
        ...editingCategory,
        codigo: code,
        nombre: cleanNombre,
        descripcion: categoryForm.descripcion.trim(),
        color: categoryForm.color,
        activo: categoryForm.activo,
        updated_at: new Date().toISOString()
      };
      updatedList = categorias.map(c => c.id === editingCategory.id ? updatedCat : c);
      onSave?.('categorias_producto', updatedCat);
      showToast?.(`Categoría "${updatedCat.nombre}" actualizada con éxito`, 'success');
    } else {
      const genId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });

      const newCat: CategoriaProductoModel = {
        id: genId,
        empresa_id: activeCompanyId,
        codigo: code,
        nombre: cleanNombre,
        descripcion: categoryForm.descripcion.trim(),
        color: categoryForm.color,
        activo: categoryForm.activo,
        created_at: new Date().toISOString()
      };
      updatedList = [...categorias, newCat];
      onSave?.('categorias_producto', newCat);
      showToast?.(`Categoría "${newCat.nombre}" creada con éxito`, 'success');

      if (isCategoryCreatedFromProductModal) {
        setProductForm(prev => ({ ...prev, categoria: newCat.nombre }));
      }
    }

    setCategorias(updatedList);
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
    setIsCategoryCreatedFromProductModal(false);
  };

  const handleDeleteCategory = (cat: CategoriaProductoModel) => {
    const associatedCount = products.filter(p => (p.categoria || '').trim().toLowerCase() === (cat.nombre || '').trim().toLowerCase()).length;
    if (associatedCount > 0) {
      if (!window.confirm(`Atención: Hay ${associatedCount} artículo(s) vinculados a la categoría "${cat.nombre}". ¿Desea eliminarla de todas formas?`)) {
        return;
      }
    } else {
      if (!window.confirm(`¿Está seguro de eliminar la categoría "${cat.nombre}"?`)) {
        return;
      }
    }

    const updated = categorias.filter(c => c.id !== cat.id);
    setCategorias(updated);
    onSave?.('categorias_producto', { id: cat.id, _delete: true });
    showToast?.(`Categoría "${cat.nombre}" eliminada`, 'info');
  };

  const handleToggleCategoryActive = (cat: CategoriaProductoModel) => {
    const nextStatus = !cat.activo;
    const updated = categorias.map(c => c.id === cat.id ? { ...c, activo: nextStatus } : c);
    setCategorias(updated);
    const targetCat = updated.find(c => c.id === cat.id);
    if (targetCat) {
      onSave?.('categorias_producto', targetCat);
    }
    showToast?.(`Categoría "${cat.nombre}" ${nextStatus ? 'activada' : 'desactivada'}`, 'info');
  };

  // Handlers de Almacenes / Depósitos
  const handleOpenNewAlmacen = () => {
    setEditingAlmacen(null);
    setAlmacenForm({
      codigo: `DEP-${String(almacenes.length + 1).padStart(2, '0')}`,
      nombre: '',
      ubicacion: '',
      responsable: '',
      es_principal: almacenes.length === 0,
      activo: true
    });
    setIsAlmacenModalOpen(true);
  };

  const handleOpenEditAlmacen = (alm: AlmacenModel) => {
    setEditingAlmacen(alm);
    setAlmacenForm({
      codigo: alm.codigo || '',
      nombre: alm.nombre || '',
      ubicacion: alm.ubicacion || '',
      responsable: alm.responsable || '',
      es_principal: Boolean(alm.es_principal),
      activo: alm.activo !== false
    });
    setIsAlmacenModalOpen(true);
  };

  const handleSaveAlmacen = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNombre = almacenForm.nombre.trim();
    if (!cleanNombre) {
      showToast?.('El nombre del almacén es obligatorio', 'error');
      return;
    }

    const code = almacenForm.codigo.trim() || `DEP-${String(almacenes.length + 1).padStart(2, '0')}`;
    const newAlm: AlmacenModel = {
      id: (editingAlmacen && isUUID(editingAlmacen.id)) ? editingAlmacen.id : crypto.randomUUID(),
      empresa_id: activeCompanyId || '',
      codigo: code,
      nombre: cleanNombre,
      ubicacion: almacenForm.ubicacion.trim(),
      responsable: almacenForm.responsable.trim(),
      es_principal: almacenForm.es_principal,
      activo: almacenForm.activo
    };

    let updatedList: AlmacenModel[];
    if (editingAlmacen) {
      updatedList = almacenes.map(a => a.id === editingAlmacen.id ? newAlm : a);
    } else {
      updatedList = [...almacenes, newAlm];
    }

    if (newAlm.es_principal) {
      updatedList = updatedList.map(a => a.id === newAlm.id ? a : { ...a, es_principal: false });
    }

    setAlmacenes(updatedList);
    setIsAlmacenModalOpen(false);

    if (onSave) {
      onSave('almacenes', newAlm);
    } else if (activeCompanyId) {
      await dbSaveAlmacen(newAlm, activeCompanyId);
    }

    showToast?.(editingAlmacen ? 'Almacén actualizado con éxito' : 'Nuevo almacén registrado en el sistema', 'success');
  };

  const handleDeleteAlmacen = async (alm: AlmacenModel) => {
    if (alm.es_principal) {
      showToast?.('El almacén principal no se puede eliminar', 'error');
      return;
    }

    const count = products.filter(p => p.almacen_id === alm.id).length;
    if (count > 0) {
      showToast?.(`No se puede eliminar este almacén porque tiene ${count} artículo(s) asignado(s)`, 'error');
      return;
    }

    if (window.confirm(`¿Está seguro de eliminar el almacén "${alm.nombre}"?`)) {
      const updatedList = almacenes.filter(a => a.id !== alm.id);
      setAlmacenes(updatedList);
      if (onSave) {
        onSave('almacenes', { id: alm.id, _delete: true });
      } else if (activeCompanyId) {
        await dbDeleteAlmacen(alm.id, activeCompanyId);
      }
      showToast?.('Almacén eliminado correctamente', 'success');
    }
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(transferForm.cantidad);
    if (!transferForm.producto_id || isNaN(qty) || qty <= 0) {
      showToast?.('Cantidad inválida', 'error');
      return;
    }
    if (transferForm.almacen_origen_id === transferForm.almacen_destino_id) {
      showToast?.('El almacén de destino debe ser diferente al de origen', 'error');
      return;
    }
    const prod = products.find(p => p.id === transferForm.producto_id);
    if (!prod) return;

    const availableStock = Number(prod.stock_actual) || 0;
    if (qty > availableStock) {
      showToast?.(`La cantidad a transferir (${qty}) supera el stock disponible (${availableStock})`, 'error');
      return;
    }

    const almOrigen = almacenes.find(a => a.id === transferForm.almacen_origen_id);
    const almDestino = almacenes.find(a => a.id === transferForm.almacen_destino_id);

    if (activeCompanyId) {
      try {
        await dbActualizarStockAtomico(
          activeCompanyId,
          prod.id,
          qty,
          'transferencia',
          {
            almacenOrigenId: transferForm.almacen_origen_id,
            almacenDestinoId: transferForm.almacen_destino_id,
            referencia: transferForm.referencia.trim() || `Transferencia de ${almOrigen?.codigo || 'DEP'} a ${almDestino?.codigo || 'DEP'}`,
            usuario: 'Administrador'
          }
        );
      } catch (err) {
        console.warn('Error en transferencia atómica de stock:', err);
      }
    }

    // Actualizar depósito asignado del producto si correspondía a dicho depósito
    const updatedProd: ProductModel = {
      ...prod,
      almacen_id: transferForm.almacen_destino_id,
      almacen_nombre: almDestino?.nombre,
      updated_at: new Date().toISOString()
    };
    onSave?.('products', updatedProd);

    onSave?.('movimientosInventario', {
      id: crypto.randomUUID(),
      empresa_id: activeCompanyId,
      producto_id: prod.id,
      producto_nombre: prod.nombre,
      producto_codigo: prod.codigo,
      tipo: 'transferencia',
      almacen_origen_id: transferForm.almacen_origen_id,
      almacen_destino_id: transferForm.almacen_destino_id,
      cantidad: qty,
      stock_anterior: availableStock,
      stock_resultante: availableStock,
      costo_unitario: prod.costo_unitario,
      referencia: transferForm.referencia.trim() || `Transferencia de ${almOrigen?.codigo || 'DEP'} a ${almDestino?.codigo || 'DEP'}`,
      fecha: getTodayLocalDate(),
      usuario: 'Administrador',
      created_at: new Date().toISOString()
    });

    showToast?.(`Transferencia de ${qty} ${prod.unidad_medida} a ${almDestino?.nombre} registrada`, 'success');
    setIsTransferModalOpen(false);
  };

  return (
    <div className="px-3 sm:px-6 pt-3 pb-12 max-w-7xl mx-auto space-y-3.5 animate-in fade-in duration-300">
      
      {/* 1. HEADER DE PÁGINA CONSOLIDADO (UNIFIED PAGE HEADER) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Izquierda: Retorno + Título + Badges de Estado */}
        <div className="flex items-center gap-3.5">
          <BackButton to="/inventory" label="Volver a Inventario" />
          <div className="w-px h-7 bg-slate-200 hidden sm:block" />
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Boxes size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Inventario & Existencias
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 uppercase tracking-wider">
                Multi-Depósito
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                {stats.availabilityRate}% Stock Saludable
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Control de artículos, valorización bimonetaria, trazabilidad analítica en Kardex y auditoría física.
            </p>
          </div>
        </div>

        {/* Derecha: Control Multimoneda BCV + Acciones de Negocio */}
        <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto">
          {/* Píldora de Tasa Oficial BCV */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
            <span className="text-[10px] uppercase font-bold text-slate-400">BCV:</span>
            <span className="font-mono font-black text-slate-900">Bs. {exchangeRate.toFixed(2)}</span>
            <button
              type="button"
              onClick={handleSyncBcv}
              disabled={isSyncingBcv}
              title="Sincronizar tasa oficial en vivo con el Banco Central"
              className="p-0.5 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
            >
              <RefreshCw size={11} className={isSyncingBcv ? 'animate-spin text-indigo-600' : ''} />
            </button>
          </div>

          {/* Toggle de Moneda */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold border border-slate-200/60">
            <button
              type="button"
              onClick={() => setDisplayCurrency('USD')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                displayCurrency === 'USD' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              $ USD
            </button>
            <button
              type="button"
              onClick={() => setDisplayCurrency('VES')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                displayCurrency === 'VES' ? 'bg-white text-emerald-700 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Bs. VES
            </button>
          </div>

          <div className="w-px h-6 bg-slate-200 hidden sm:block" />

          {/* Botones de Acción */}
          <button
            onClick={() => {
              setTransferProduct(products[0] || null);
              setTransferForm({
                producto_id: products[0]?.id || '',
                almacen_origen_id: almacenes[0]?.id || DEFAULT_ALMACENES[0].id,
                almacen_destino_id: almacenes[1]?.id || almacenes[0]?.id || DEFAULT_ALMACENES[0].id,
                cantidad: '',
                referencia: ''
              });
              setIsTransferModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition border border-slate-200 shadow-2xs cursor-pointer active:scale-95"
            title="Transferir existencias entre almacenes"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500" />
            <span>Transferir</span>
          </button>

          <button
            onClick={handleExportProductsCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 transition border border-slate-200 shadow-2xs cursor-pointer active:scale-95"
            title="Exportar catálogo filtrado a CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exportar</span>
          </button>

          <button
            onClick={handleOpenNewProduct}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuevo Artículo</span>
          </button>
        </div>
      </div>

      {/* 2. BANDA EJECUTIVA DE MÉTRICAS CONTINUA (UNIFIED KPI HORIZON) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          
          {/* Col 1: Capital Inmovilizado a Costo */}
          <div className="p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Capital en Stock (Costo)
              </span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <DollarSign size={14} />
              </div>
            </div>
            <div className="my-1.5">
              <div className="text-lg font-black text-slate-900 tracking-tight font-mono">
                ${stats.totalCostValuationUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] font-semibold text-slate-400 mt-0.5 font-mono">
                Bs. {(stats.totalCostValuationUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-50">
              <span>Capital neto inmovilizado</span>
              <span className="font-mono font-bold text-slate-700">{products.length} SKUs</span>
            </div>
          </div>

          {/* Col 2: Valorización a Venta & Margen */}
          <div className="p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Valorización a Venta (PVP)
              </span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <TrendingUp size={14} />
              </div>
            </div>
            <div className="my-1.5">
              <div className="text-lg font-black text-emerald-950 tracking-tight font-mono">
                ${stats.totalRetailValuationUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200/60 font-mono">
                  +{stats.avgMarginPercent.toFixed(1)}% margen
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  (+${stats.totalMarginUSD.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ganancia)
                </span>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-50">
              <span>Ingreso bruto estimado</span>
              <span className="font-bold text-emerald-700">Margen Saludable</span>
            </div>
          </div>

          {/* Col 3: Unidades Físicas & Depósitos */}
          <div className="p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Unidades Físicas
              </span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <Package size={14} />
              </div>
            </div>
            <div className="my-1.5">
              <div className="text-lg font-black text-slate-900 tracking-tight font-mono">
                {stats.totalUnits.toLocaleString('es-VE')} <span className="text-xs font-bold text-slate-400">UND</span>
              </div>
              <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                Distribuidas en <strong className="text-slate-700">{almacenes.length} depósitos</strong>
              </div>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-50">
              <span>Trazabilidad</span>
              <span className="font-mono font-bold text-purple-700">{movimientosInventario.length} movs</span>
            </div>
          </div>

          {/* Col 4: Alertas de Abastecimiento (Interactivas) */}
          <div className="p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Alertas de Stock
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                stats.outOfStockCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-600' : stats.lowStockCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
              }`}>
                <AlertTriangle size={14} />
              </div>
            </div>
            <div className="my-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('catalogo');
                  setStockStatusFilter('bajo_stock');
                }}
                className="flex-1 px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200/70 text-left transition cursor-pointer"
                title="Filtrar artículos con stock bajo"
              >
                <span className="text-[9px] font-bold text-amber-800 uppercase block">Bajo Stock</span>
                <span className="text-sm font-black text-amber-900 font-mono">{stats.lowStockCount}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('catalogo');
                  setStockStatusFilter('agotados');
                }}
                className="flex-1 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200/70 text-left transition cursor-pointer"
                title="Filtrar artículos agotados"
              >
                <span className="text-[9px] font-bold text-rose-800 uppercase block">Agotados</span>
                <span className="text-sm font-black text-rose-900 font-mono">{stats.outOfStockCount}</span>
              </button>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1.5 border-t border-slate-50">
              <span>Nivel óptimo</span>
              <span className="font-bold text-emerald-700">{stats.inStockCount} artículos</span>
            </div>
          </div>

        </div>
      </div>

      {/* 3. SELECTOR DE LOS 4 MÓDULOS DE INVENTARIO (CON ICONOS TAMAÑO PEQUEÑO-MEDIANO) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 select-none">
        {/* 1. MÓDULO: CATÁLOGO */}
        <button
          type="button"
          onClick={() => {
            if (!['catalogo', 'categorias', 'almacenes'].includes(activeTab)) {
              setActiveTab('catalogo');
            }
            navigate('/inventory/catalogo');
          }}
          className={`group flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
            ['catalogo', 'categorias', 'almacenes'].includes(activeTab)
              ? 'bg-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/10'
              : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs hover:border-indigo-200'
          }`}
        >
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 shadow-md shadow-blue-500/20 shrink-0 group-hover:scale-105 transition-transform">
            <Boxes size={20} strokeWidth={2} className="text-white relative z-10 drop-shadow-xs" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className={`text-xs sm:text-sm font-black truncate ${
                ['catalogo', 'categorias', 'almacenes'].includes(activeTab) ? 'text-indigo-900' : 'text-slate-800'
              }`}>
                Catálogo
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/70 shrink-0">
                3 áreas
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
              Productos, Categorías, Depósitos
            </p>
          </div>
        </button>

        {/* 2. MÓDULO: AUDITORÍA FÍSICA */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('auditoria');
            navigate('/inventory/auditoria');
          }}
          className={`group flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
            activeTab === 'auditoria'
              ? 'bg-white border-purple-600 shadow-sm ring-2 ring-purple-500/10'
              : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs hover:border-purple-200'
          }`}
        >
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-700 shadow-md shadow-purple-500/20 shrink-0 group-hover:scale-105 transition-transform">
            <ShieldCheck size={20} strokeWidth={2} className="text-white relative z-10 drop-shadow-xs" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className={`text-xs sm:text-sm font-black truncate ${
                activeTab === 'auditoria' ? 'text-purple-900' : 'text-slate-800'
              }`}>
                Auditoría Física
              </span>
              {auditMetrics.differencesCount > 0 ? (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0 font-mono">
                  {auditMetrics.differencesCount} descuadres
                </span>
              ) : (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-700 border border-purple-200/70 shrink-0">
                  Toma
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
              Conteo físico y ajustes de stock
            </p>
          </div>
        </button>

        {/* 3. MÓDULO: KARDEX */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('kardex');
            navigate('/inventory/kardex');
          }}
          className={`group flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
            activeTab === 'kardex'
              ? 'bg-white border-amber-600 shadow-sm ring-2 ring-amber-500/10'
              : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs hover:border-amber-200'
          }`}
        >
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/20 shrink-0 group-hover:scale-105 transition-transform">
            <History size={20} strokeWidth={2} className="text-white relative z-10 drop-shadow-xs" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className={`text-xs sm:text-sm font-black truncate ${
                activeTab === 'kardex' ? 'text-amber-900' : 'text-slate-800'
              }`}>
                Kardex
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70 shrink-0 font-mono">
                {movimientosInventario.length} movs
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
              Historial y trazabilidad de SKU
            </p>
          </div>
        </button>

        {/* 4. MÓDULO: LISTA DE PRECIOS */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('precios');
            navigate('/inventory/precios');
          }}
          className={`group flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
            activeTab === 'precios'
              ? 'bg-white border-emerald-600 shadow-sm ring-2 ring-emerald-500/10'
              : 'bg-white hover:bg-slate-50 border-slate-200/90 shadow-2xs hover:border-emerald-200'
          }`}
        >
          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20 shrink-0 group-hover:scale-105 transition-transform">
            <Printer size={20} strokeWidth={2} className="text-white relative z-10 drop-shadow-xs" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className={`text-xs sm:text-sm font-black truncate ${
                activeTab === 'precios' ? 'text-emerald-900' : 'text-slate-800'
              }`}>
                Lista de Precios
              </span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                PVP
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
              Márgenes y emisión para impresión
            </p>
          </div>
        </button>
      </div>

      {/* 4. ESTACIÓN MAESTRA DE TRABAJO (UNIFIED DATA WORKBENCH) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        
        {/* SUB-PESTAÑAS CUANDO ESTÁ ACTIVO EL MÓDULO CATÁLOGO */}
        {['catalogo', 'categorias', 'almacenes'].includes(activeTab) && (
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 pt-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none select-none">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1 shrink-0">
              <Boxes size={13} className="text-indigo-600" />
              <span>Vistas de Catálogo:</span>
            </div>

            <button
              onClick={() => setActiveTab('catalogo')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all cursor-pointer shrink-0 border-t-2 border-x ${
                activeTab === 'catalogo'
                  ? 'bg-white text-indigo-700 border-t-indigo-600 border-x-slate-200 border-b-white -mb-px shadow-2xs font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              <Package size={14} />
              <span>Catálogo ({products.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('categorias')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all cursor-pointer shrink-0 border-t-2 border-x ${
                activeTab === 'categorias'
                  ? 'bg-white text-indigo-700 border-t-indigo-600 border-x-slate-200 border-b-white -mb-px shadow-2xs font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              <Tag size={14} />
              <span>Categorías ({categorias.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('almacenes')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all cursor-pointer shrink-0 border-t-2 border-x ${
                activeTab === 'almacenes'
                  ? 'bg-white text-indigo-700 border-t-indigo-600 border-x-slate-200 border-b-white -mb-px shadow-2xs font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
              }`}
            >
              <Warehouse size={14} />
              <span>Depósitos ({almacenes.length})</span>
            </button>
          </div>
        )}

        {/* CUERPO INTERNO DEL WORKBENCH */}
        <div className="flex-1 bg-white">
          {activeTab === 'catalogo' && (
            <div className="flex flex-col">
              
              {/* BARRA DE CONTROL Y FILTROS INTEGRADOS (SIN SCROLL HORIZONTAL) */}
              <div className="p-4 border-b border-slate-100 bg-white space-y-3">
                {/* Fila 1: Búsqueda Omnicanal + Selector de Categoría + Selector de Almacén */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {/* Buscador omnicanal */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="Buscar por código SKU, nombre, código de barra, marca..."
                      className="w-full pl-9.5 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all"
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

                  {/* Selector de Categoría */}
                  <div className="relative shrink-0 sm:w-56">
                    <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={selectedCategory}
                      onChange={e => setSelectedCategory(e.target.value)}
                      className="w-full pl-8.5 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none cursor-pointer"
                    >
                      <option value="Todos">Todas las Categorías ({products.length})</option>
                      {categoriesList.filter(c => c !== 'Todos').map(cat => {
                        const count = products.filter(p => p.categoria === cat).length;
                        return (
                          <option key={cat} value={cat}>
                            {cat} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Selector de Almacén */}
                  <div className="relative shrink-0 sm:w-52">
                    <Warehouse className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={selectedWarehouseFilter}
                      onChange={e => setSelectedWarehouseFilter(e.target.value)}
                      className="w-full pl-8.5 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none cursor-pointer"
                    >
                      <option value="Todos">Todos los Almacenes</option>
                      {almacenes.map(alm => {
                        const count = products.filter(p => p.almacen_id === alm.id).length;
                        return (
                          <option key={alm.id} value={alm.id}>
                            {alm.codigo} - {alm.nombre} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Fila 2: Segmented Control de Estados de Stock + Toggle de Vista */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                  {/* Segmented Control de Existencia (Cero Scroll, diseño integrado moderno) */}
                  <div className="flex items-center bg-slate-100/90 p-1 rounded-xl text-xs font-bold gap-1 flex-wrap sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={() => setStockStatusFilter('todos')}
                      className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        stockStatusFilter === 'todos'
                          ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Todos ({products.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockStatusFilter('en_stock')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        stockStatusFilter === 'en_stock'
                          ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-emerald-700'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>En Stock ({stats.inStockCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockStatusFilter('bajo_stock')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        stockStatusFilter === 'bajo_stock'
                          ? 'bg-white text-amber-800 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-amber-700'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>Bajo Stock ({stats.lowStockCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStockStatusFilter('agotados')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        stockStatusFilter === 'agotados'
                          ? 'bg-white text-rose-800 shadow-2xs font-extrabold'
                          : 'text-slate-600 hover:text-rose-700'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>Agotados ({stats.outOfStockCount})</span>
                    </button>
                  </div>

                  {/* Lado Derecho: Toggle de Vista (Tabla / Tarjetas) */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>Tabla</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Tarjetas</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tira de Resumen Ejecutivo y Totales del Filtro */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span>Mostrando: <strong className="text-slate-800 font-bold">{filteredProducts.length} artículos</strong></span>
                    <span>•</span>
                    <span>Unidades: <strong className="text-slate-800 font-bold font-mono">
                      {filteredProducts.reduce((sum, p) => sum + (Number(p.stock_actual) || 0), 0).toLocaleString('es-VE')} UND
                    </strong></span>
                    <span>•</span>
                    <span>Valorización a Costo: <strong className="text-slate-900 font-bold font-mono">
                      {displayCurrency === 'USD' 
                        ? `$${filteredProducts.reduce((sum, p) => sum + (Number(p.stock_actual) || 0) * (Number(p.costo_unitario) || 0), 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                        : `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(filteredProducts.reduce((sum, p) => sum + (Number(p.stock_actual) || 0) * (Number(p.costo_unitario) || 0), 0) * exchangeRate)}`}
                    </strong></span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Tasa BCV oficial: <strong className="font-mono text-slate-700">Bs. {exchangeRate.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              {/* VISTA EN TABLA (ALTA DENSIDAD, PROFESIONAL, SIN SCROLL FORZADO) */}
              {viewMode === 'table' && (
                <div className="overflow-x-auto scrollbar-none">
                  <table className="table-odoo">
                    <thead>
                      <tr>
                        <th className="w-24">Código SKU</th>
                        <th>Artículo / Descripción</th>
                        <th>Categoría</th>
                        <th className="text-right">Costo</th>
                        <th className="text-right">Precio Detal (PVP)</th>
                        <th className="text-right">Margen</th>
                        <th className="text-center">Existencia</th>
                        <th>Depósito</th>
                        <th className="text-right w-28">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-12 text-center text-slate-400">
                            No se encontraron artículos registrados con los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map(prod => {
                          const stock = Number(prod.stock_actual) || 0;
                          const costo = Number(prod.costo_unitario) || 0;
                          const pvp = Number(prod.precio_venta) || 0;
                          const pvpBs = pvp * exchangeRate;
                          const reorder = Number(prod.punto_reorden) || 10;
                          const marginPct = pvp > 0 ? ((pvp - costo) / pvp) * 100 : 0;
                          const almNombre = almacenes.find(a => a.id === prod.almacen_id)?.nombre || prod.ubicacion || 'Central';

                          return (
                            <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="font-mono font-bold text-slate-800 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs">
                                  {prod.codigo}
                                </span>
                                {prod.codigo_barra && (
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    {prod.codigo_barra}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{prod.nombre}</span>
                                  {prod.activo === false && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                      Inactivo
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                  {prod.marca && <span>Marca: {prod.marca}</span>}
                                  {prod.marca && prod.cuenta_inventario_id && <span>•</span>}
                                  {prod.cuenta_inventario_id && (
                                    <span 
                                      className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500 bg-slate-100/80 px-1.5 py-0.2 rounded border border-slate-200/60 cursor-help" 
                                      title={`Cuentas Contables NIIF:\n• Inventario: ${getAccCode(prod.cuenta_inventario_id)}\n• Costo: ${getAccCode(prod.cuenta_costo_id)}\n• Venta: ${getAccCode(prod.cuenta_ingreso_id || prod.cuenta_venta_id)}`}
                                    >
                                      <BookOpen size={9} className="text-indigo-500 shrink-0" />
                                      <span>NIIF {getAccCode(prod.cuenta_inventario_id)}</span>
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                                  {prod.categoria}
                                </span>
                              </td>
                              <td className="text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                                ${costo.toFixed(2)}
                              </td>
                              <td className="text-right whitespace-nowrap">
                                <div className="font-bold text-slate-900 font-mono">
                                  {displayCurrency === 'USD' ? `$${pvp.toFixed(2)}` : `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(pvpBs)}`}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {displayCurrency === 'USD' ? `Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(pvpBs)}` : `$${pvp.toFixed(2)}`}
                                </div>
                              </td>
                              <td className="text-right whitespace-nowrap">
                                <span className={`inline-flex items-center gap-0.5 font-mono font-bold text-[11px] px-1.5 py-0.5 rounded-md ${
                                  marginPct >= 30 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  marginPct > 15 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                  marginPct > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}>
                                  <Percent size={10} />
                                  {marginPct.toFixed(1)}%
                                </span>
                              </td>
                              <td className="text-center whitespace-nowrap">
                                {stock <= 0 ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                    0 {prod.unidad_medida} (Agotado)
                                  </span>
                                ) : stock <= reorder ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    {stock} {prod.unidad_medida} (Bajo)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    {stock} {prod.unidad_medida}
                                  </span>
                                )}
                              </td>
                              <td className="text-slate-600 text-xs whitespace-nowrap">
                                <span className="truncate max-w-[120px] block" title={almNombre}>
                                  {almNombre}
                                </span>
                              </td>
                              <td className="text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleViewProductKardex(prod.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                                    title="Ver trazabilidad y movimientos en Kardex"
                                  >
                                    <History size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenTransferForProduct(prod)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                                    title="Transferir a otro depósito"
                                  >
                                    <ArrowLeftRight size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditProduct(prod)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                                    title="Editar ficha técnica"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(prod)}
                                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                                      movimientosInventario.some(m => m.producto_id === prod.id || (prod.codigo && m.producto_codigo === prod.codigo)) || Number(prod.stock_actual) > 0
                                        ? 'text-slate-300 hover:text-amber-600 hover:bg-amber-50'
                                        : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                    }`}
                                    title={
                                      movimientosInventario.some(m => m.producto_id === prod.id || (prod.codigo && m.producto_codigo === prod.codigo)) || Number(prod.stock_actual) > 0
                                        ? 'Artículo con movimientos en inventario (Bloqueado para eliminar)'
                                        : 'Eliminar artículo'
                                    }
                                  >
                                    <Trash2 size={14} />
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
              )}

          {/* VISTA EN TARJETAS (GRID PRO) */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredProducts.map(prod => {
                const stock = Number(prod.stock_actual) || 0;
                const pvp = Number(prod.precio_venta) || 0;
                const costo = Number(prod.costo_unitario) || 0;
                const reorder = Number(prod.punto_reorden) || 10;
                const marginPct = pvp > 0 ? ((pvp - costo) / pvp) * 100 : 0;
                const almNombre = almacenes.find(a => a.id === prod.almacen_id)?.nombre || prod.ubicacion || 'Central';

                return (
                  <div key={prod.id} className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                          {prod.codigo}
                        </span>
                        {stock <= 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Agotado
                          </span>
                        ) : stock <= reorder ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Bajo Stock ({stock} {prod.unidad_medida})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            {stock} {prod.unidad_medida}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-slate-900 text-sm line-clamp-1" title={prod.nombre}>
                          {prod.nombre}
                        </h3>
                        {prod.activo === false && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {prod.categoria} {prod.marca ? `• ${prod.marca}` : ''}
                      </p>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Precio Venta</span>
                          <span className="text-base font-bold text-slate-900 font-mono">${pvp.toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Bs. {(pvp * exchangeRate).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Costo / Margen</span>
                          <span className="text-xs font-semibold text-slate-600 font-mono">${costo.toFixed(2)}</span>
                          <span className="text-[10px] font-bold text-emerald-700 block font-mono">
                            +{marginPct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px] truncate max-w-[120px]" title={almNombre}>
                        📍 {almNombre}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleViewProductKardex(prod.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                          title="Ver Kardex"
                        >
                          <History size={13} />
                        </button>
                        <button
                          onClick={() => handleOpenTransferForProduct(prod)}
                          className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                          title="Transferir"
                        >
                          <ArrowLeftRight size={13} />
                        </button>
                        <button
                          onClick={() => handleOpenEditProduct(prod)}
                          className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod)}
                          className={`p-1.5 rounded cursor-pointer transition ${
                            movimientosInventario.some(m => m.producto_id === prod.id || (prod.codigo && m.producto_codigo === prod.codigo)) || Number(prod.stock_actual) > 0
                              ? 'text-slate-300 hover:text-amber-600 hover:bg-amber-50'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA: GESTIÓN DE CATEGORÍAS */}
      {/* ========================================================================= */}
      {activeTab === 'categorias' && (
        <div className="flex flex-col">
          {/* BARRA DE CONTROL Y BÚSQUEDA DE CATEGORÍAS */}
          <div className="p-4 border-b border-slate-100 bg-white">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  value={categorySearchTerm}
                  onChange={e => setCategorySearchTerm(e.target.value)}
                  placeholder="Buscar categoría por nombre o código..."
                  className="w-full pl-9.5 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenNewCategory(false)}
                  className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Nueva Categoría</span>
                </button>
              </div>
            </div>
          </div>

          {/* TABLA DE CATEGORÍAS */}
          <div className="overflow-x-auto scrollbar-none">
            <table className="table-odoo">
              <thead>
                <tr>
                  <th className="w-24">Código</th>
                  <th>Nombre de la Categoría</th>
                  <th>Descripción</th>
                  <th className="text-center">Artículos Asociados</th>
                  <th className="text-center w-28">Estado</th>
                  <th className="text-right w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategorias.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Tag className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <div className="font-semibold text-slate-600">No se encontraron categorías</div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {categorySearchTerm ? 'Pruebe con otros términos de búsqueda' : 'Cree la primera categoría haciendo clic en "Nueva Categoría"'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredCategorias.map(cat => {
                    const associatedProducts = products.filter(
                      p => (p.categoria || '').trim().toLowerCase() === (cat.nombre || '').trim().toLowerCase()
                    );
                    const count = associatedProducts.length;

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                        <td>
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                            {cat.codigo}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              cat.color === 'emerald' ? 'bg-emerald-500' :
                              cat.color === 'amber' ? 'bg-amber-500' :
                              cat.color === 'blue' ? 'bg-blue-500' :
                              cat.color === 'orange' ? 'bg-orange-500' :
                              cat.color === 'cyan' ? 'bg-cyan-500' :
                              cat.color === 'purple' ? 'bg-purple-500' :
                              cat.color === 'rose' ? 'bg-rose-500' :
                              cat.color === 'slate' ? 'bg-slate-500' : 'bg-indigo-500'
                            }`}></span>
                            <span className="font-bold text-slate-900">{cat.nombre}</span>
                          </div>
                        </td>
                        <td className="text-slate-500 text-xs">
                          {cat.descripcion || <span className="text-slate-300 italic">Sin descripción</span>}
                        </td>
                        <td className="text-center">
                          {count > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCategory(cat.nombre);
                                setActiveTab('catalogo');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer"
                              title={`Ver los ${count} artículos en el catálogo`}
                            >
                              <Package size={11} />
                              <span>{count} artículos</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">0 artículos</span>
                          )}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleCategoryActive(cat)}
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                              cat.activo 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Haga clic para alternar estado activo/inactivo"
                          >
                            {cat.activo ? 'Activa' : 'Inactiva'}
                          </button>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCategory(cat)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                              title="Editar categoría"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(cat)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                              title="Eliminar categoría"
                            >
                              <Trash2 size={14} />
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

          {/* BARRA DE ESTADO / FOOTER DE CATEGORÍAS */}
          <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-3">
              <span>Total: <strong className="text-slate-800 font-bold">{categorias.length}</strong></span>
              <span>•</span>
              <span>Activas: <strong className="text-emerald-700 font-bold">{categorias.filter(c => c.activo).length}</strong></span>
              <span>•</span>
              <span>Inactivas: <strong className="text-slate-600 font-bold">{categorias.filter(c => !c.activo).length}</strong></span>
              <span>•</span>
              <span>Artículos Asociados: <strong className="text-indigo-900 font-bold">{products.length}</strong></span>
            </div>
            <div className="text-[11px] text-slate-400">
              Las categorías activas se presentan automáticamente al registrar o editar artículos
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: AUDITORÍA DE INVENTARIO (TOMA FÍSICA Y AJUSTE CON CLAVE) */}
      {/* ========================================================================= */}
      {activeTab === 'auditoria' && (
        <div className="flex flex-col">
          
          {/* BARRA DE CONTROL DE AUDITORÍA */}
          <div className="p-4 border-b border-slate-100 bg-white space-y-3">
            
            {/* Tira de Resumen de Avance del Conteo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avance del Conteo</span>
                <div className="text-lg font-bold text-slate-900 mt-0.5">
                  {auditMetrics.counted} <span className="text-xs font-normal text-slate-400">/ {auditMetrics.totalProducts}</span>
                </div>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200/80 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Sin Variación (OK)</span>
                <div className="text-lg font-bold text-emerald-700 mt-0.5">
                  {auditMetrics.squaresCount} <span className="text-xs font-normal">Exactos</span>
                </div>
              </div>

              <div className="bg-rose-50/60 border border-rose-200/80 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Con Descuadre</span>
                <div className="text-lg font-bold text-rose-700 mt-0.5">
                  {auditMetrics.differencesCount} <span className="text-xs font-normal">Artículos</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Impacto Financiero</span>
                <div className={`text-lg font-bold mt-0.5 ${auditMetrics.netFinancialDiffUSD < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                  {auditMetrics.netFinancialDiffUSD > 0 ? '+' : ''}${Math.abs(auditMetrics.netFinancialDiffUSD).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Buscador + Filtros + Acciones de Auditoría */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="relative flex-1 w-full max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={auditSearchTerm}
                  onChange={e => setAuditSearchTerm(e.target.value)}
                  placeholder="Escanear código de barra, SKU o nombre..."
                  className="w-full pl-9.5 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-all"
                />
                {auditSearchTerm && (
                  <button
                    onClick={() => setAuditSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center bg-slate-100/90 p-1 rounded-xl text-xs font-bold gap-1 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setAuditStatusFilter('todos')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    auditStatusFilter === 'todos' ? 'bg-white text-slate-900 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({products.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAuditStatusFilter('diferencias')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    auditStatusFilter === 'diferencias' ? 'bg-white text-rose-800 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-rose-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>Con Descuadre ({auditMetrics.differencesCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuditStatusFilter('cuadrados')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    auditStatusFilter === 'cuadrados' ? 'bg-white text-emerald-800 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-emerald-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Cuadrados ({auditMetrics.squaresCount})</span>
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleResetAuditCounts}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                  title="Reiniciar conteos de la toma física"
                >
                  Limpiar
                </button>
                {auditMetrics.differencesCount > 0 && (
                  <button
                    type="button"
                    onClick={handleOpenBatchAuditModal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <Key size={13} />
                    <span>Ajustar Todo ({auditMetrics.differencesCount})</span>
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* TABLA DE AUDITORÍA: STOCK SISTEMA VS CONTEO FÍSICO VS DIFERENCIA */}
          <div className="overflow-x-auto scrollbar-none">
            <table className="table-odoo">
              <thead>
                <tr>
                  <th className="w-28">Código SKU</th>
                  <th>Artículo & Ubicación</th>
                  <th>Almacén</th>
                  <th className="text-center bg-slate-100/70">Stock del Sistema</th>
                  <th className="text-center bg-purple-50/50 text-purple-950">Conteo Físico</th>
                  <th className="text-center">Diferencia</th>
                  <th className="text-right">Impacto Financiero</th>
                  <th className="text-center w-28">Acción de Ajuste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAuditProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No se encontraron artículos que coincidan con la búsqueda o filtro de auditoría.
                    </td>
                  </tr>
                ) : (
                  filteredAuditProducts.map(prod => {
                    const systemStock = Number(prod.stock_actual) || 0;
                    const countInput = auditCounts[prod.id];
                    const hasCount = countInput !== undefined && countInput.trim() !== '';
                    const physicalCount = hasCount ? parseFloat(countInput) : NaN;
                    const hasValidCount = !isNaN(physicalCount);
                    const diff = hasValidCount ? (physicalCount - systemStock) : 0;
                    const unitCost = Number(prod.costo_unitario) || 0;
                    const financialDiffUSD = diff * unitCost;

                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="font-mono font-bold text-slate-800">
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs">
                            {prod.codigo}
                          </span>
                        </td>
                        <td>
                          <div className="font-bold text-slate-900">{prod.nombre}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>📍 {prod.ubicacion || 'Central'}</span>
                            {prod.categoria && <span>• {prod.categoria}</span>}
                          </div>
                        </td>
                        <td className="text-slate-600 text-xs">
                          {prod.almacen_nombre || 'Principal'}
                        </td>
                        
                        {/* Stock del Sistema */}
                        <td className="text-center font-bold text-slate-900 bg-slate-50/60">
                          <span className="text-sm">{systemStock}</span>
                          <span className="text-[10px] text-slate-400 ml-1 uppercase">{prod.unidad_medida}</span>
                        </td>

                        {/* Conteo Físico Interactivo */}
                        <td className="text-center bg-purple-50/20">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleQuickCountAdjust(prod.id, -1, systemStock)}
                              className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder={String(systemStock)}
                              value={countInput !== undefined ? countInput : ''}
                              onChange={e => handleAuditCountChange(prod.id, e.target.value)}
                              className={`w-18 px-2 py-1 text-center font-bold text-sm rounded-lg border outline-none transition ${
                                hasValidCount && diff !== 0
                                  ? 'border-rose-300 bg-rose-50/40 text-rose-800'
                                  : hasValidCount && diff === 0
                                    ? 'border-emerald-300 bg-emerald-50/40 text-emerald-800'
                                    : 'border-slate-300 bg-white text-slate-900 focus:border-purple-500'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleQuickCountAdjust(prod.id, 1, systemStock)}
                              className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center font-bold text-xs cursor-pointer"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetCountToSystem(prod.id, systemStock)}
                              className="ml-1 px-1.5 py-1 text-[10px] font-bold bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 rounded cursor-pointer"
                              title="Copiar existencia del sistema al conteo"
                            >
                              =
                            </button>
                          </div>
                        </td>

                        {/* Diferencia */}
                        <td className="text-center">
                          {!hasValidCount ? (
                            <span className="text-[11px] text-slate-400">Pendiente</span>
                          ) : diff === 0 ? (
                            <span className="badge-modern-success text-[10px]">Exacto (0)</span>
                          ) : diff < 0 ? (
                            <span className="badge-modern-error text-[10px]">
                              {diff} {prod.unidad_medida} (Faltante)
                            </span>
                          ) : (
                            <span className="badge-modern-info text-[10px]">
                              +{diff} {prod.unidad_medida} (Sobrante)
                            </span>
                          )}
                        </td>

                        {/* Impacto Financiero */}
                        <td className="text-right text-xs">
                          {!hasValidCount || diff === 0 ? (
                            <span className="text-slate-400">$0.00</span>
                          ) : (
                            <div className={`font-bold ${financialDiffUSD < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                              {financialDiffUSD > 0 ? '+' : ''}${financialDiffUSD.toFixed(2)}
                            </div>
                          )}
                        </td>

                        {/* Botón de Ajuste Protegido con Clave */}
                        <td className="text-center">
                          {!hasValidCount ? (
                            <span className="text-[11px] text-slate-400 italic">-</span>
                          ) : diff === 0 ? (
                            <span className="text-emerald-600 text-xs font-semibold">OK</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenAuditAdjustModal(prod, systemStock, physicalCount, diff)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition cursor-pointer shadow-2xs"
                              title="Ajustar con clave de supervisor"
                            >
                              <Lock size={12} />
                              <span>Ajustar</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* BARRA DE ESTADO / FOOTER DE AUDITORÍA */}
          <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-3">
              <span>Auditados: <strong className="text-slate-800 font-bold">{auditMetrics.counted} / {auditMetrics.totalProducts}</strong></span>
              <span>•</span>
              <span>Sin variación: <strong className="text-emerald-700 font-bold">{auditMetrics.squaresCount}</strong></span>
              <span>•</span>
              <span>Descuadres: <strong className="text-rose-700 font-bold">{auditMetrics.differencesCount}</strong></span>
              <span>•</span>
              <span>Impacto neto: <strong className={auditMetrics.netFinancialDiffUSD < 0 ? 'text-rose-600 font-bold font-mono' : 'text-slate-800 font-bold font-mono'}>
                {auditMetrics.netFinancialDiffUSD > 0 ? '+' : ''}${Math.abs(auditMetrics.netFinancialDiffUSD).toFixed(2)}
              </strong></span>
            </div>
            <div className="text-[11px] text-slate-400">
              {auditMetrics.differencesCount > 0 ? 'Requiere clave de supervisor para autorizar ajustes' : 'Inventario 100% conciliado'}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: KARDEX DE MOVIMIENTOS (FILTRO POR ARTÍCULO OPTIMIZADO) */}
      {/* ========================================================================= */}
      {activeTab === 'kardex' && (
        <div className="flex flex-col">
          {/* BARRA DE FILTROS DEL KARDEX */}
          <div className="p-4 border-b border-slate-100 bg-white space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs">
              
              {/* Selector Principal de Producto */}
              <div className="flex-1 min-w-[280px] relative">
                <Package className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <select
                  value={selectedKardexProductId}
                  onChange={e => setSelectedKardexProductId(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all cursor-pointer text-xs"
                >
                  <option value="">-- Seleccione un artículo para consultar su Kardex --</option>
                  <option value="todos">📦 Ver todos los artículos (Historial Global)</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.codigo}] {p.nombre} (Stock actual: {p.stock_actual} {p.unidad_medida})
                    </option>
                  ))}
                </select>
                {selectedKardexProductId && (
                  <button
                    type="button"
                    onClick={() => setSelectedKardexProductId('')}
                    title="Limpiar filtro de producto"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filtros secundarios: Tipo y Fechas */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={kardexTypeFilter}
                  onChange={e => setKardexTypeFilter(e.target.value)}
                  className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none text-xs"
                >
                  <option value="todos">Todos los Tipos</option>
                  <option value="entrada">Entradas (Compras / Ingresos)</option>
                  <option value="salida">Salidas (Ventas / Despachos)</option>
                  <option value="ajuste_positivo">Ajustes Positivos</option>
                  <option value="ajuste_negativo">Ajustes Negativos</option>
                  <option value="transferencia">Transferencias</option>
                </select>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl">
                  <input
                    type="date"
                    value={kardexDateFrom}
                    onChange={e => setKardexDateFrom(e.target.value)}
                    className="bg-transparent font-medium text-slate-700 outline-none text-xs"
                  />
                  <span className="text-slate-400 text-xs">a</span>
                  <input
                    type="date"
                    value={kardexDateTo}
                    onChange={e => setKardexDateTo(e.target.value)}
                    className="bg-transparent font-medium text-slate-700 outline-none text-xs"
                  />
                </div>

                <button
                  onClick={() => {
                    if (filteredKardexMovements.length === 0) {
                      showToast?.('No hay movimientos que exportar para la selección actual', 'info');
                      return;
                    }
                    const headers = ['Fecha', 'Tipo', 'Código/SKU', 'Producto', 'Cantidad', 'Stock Anterior', 'Stock Resultante', 'Costo Unitario ($)', 'Referencia', 'Usuario'];
                    const rows = filteredKardexMovements.map(m => [
                      m.fecha, m.tipo, m.producto_codigo || '', `"${(m.producto_nombre || '').replace(/"/g, '""')}"`,
                      m.cantidad, m.stock_anterior, m.stock_resultante, m.costo_unitario, `"${(m.referencia || '').replace(/"/g, '""')}"`, m.usuario || 'Sistema'
                    ]);
                    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                    const link = document.createElement('a');
                    link.setAttribute('href', encodeURI(csvContent));
                    const filenamePrefix = selectedKardexProduct ? `kardex_${selectedKardexProduct.codigo}_` : 'kardex_';
                    link.setAttribute('download', `${filenamePrefix}${getTodayLocalDate()}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showToast?.('Kardex exportado exitosamente', 'success');
                  }}
                  disabled={filteredKardexMovements.length === 0}
                  className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Download size={14} />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            {/* FICHA EJECUTIVA DEL ARTÍCULO SELECCIONADO */}
            {selectedKardexProduct && (
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold shadow-2xs shrink-0">
                    <Box size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                        {selectedKardexProduct.codigo}
                      </span>
                      <h4 className="font-black text-slate-900 text-sm">
                        {selectedKardexProduct.nombre}
                      </h4>
                      {selectedKardexProduct.categoria && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                          {selectedKardexProduct.categoria}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Ubicación / Depósito: <span className="font-medium text-slate-700">{almacenes.find(a => a.id === selectedKardexProduct.almacen_id)?.nombre || 'Principal'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Stock Actual</span>
                    <span className={`font-mono font-black text-sm ${
                      selectedKardexProduct.stock_actual <= 0 ? 'text-rose-600' :
                      selectedKardexProduct.stock_actual <= (selectedKardexProduct.stock_minimo || 5) ? 'text-amber-600' : 'text-emerald-700'
                    }`}>
                      {selectedKardexProduct.stock_actual} {selectedKardexProduct.unidad_medida}
                    </span>
                  </div>

                  <div className="w-px h-7 bg-indigo-200/60 hidden sm:block" />

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Costo / Venta</span>
                    <span className="font-mono font-bold text-xs text-slate-700">
                      ${selectedKardexProduct.costo_unitario.toFixed(2)} / ${selectedKardexProduct.precio_venta.toFixed(2)}
                    </span>
                  </div>

                  <div className="w-px h-7 bg-indigo-200/60 hidden sm:block" />

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Movimientos</span>
                    <span className="font-mono font-black text-xs text-indigo-700">
                      {filteredKardexMovements.length} regs
                    </span>
                  </div>
                </div>
              </div>
            )}

            {selectedKardexProductId === 'todos' && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <Layers size={15} className="text-indigo-600 shrink-0" />
                  <span>
                    Visualizando historial global consolidado de <strong>todos los artículos</strong> ({filteredKardexMovements.length} movimientos).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedKardexProductId('')}
                  className="text-indigo-600 hover:text-indigo-800 font-bold text-xs cursor-pointer shrink-0"
                >
                  Filtrar por artículo
                </button>
              </div>
            )}
          </div>

          {/* VISTA CUANDO NO SE HA SELECCIONADO NINGÚN PRODUCTO */}
          {!selectedKardexProductId ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <History className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-black text-slate-800">
                  Consulta de Kardex por Artículo
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Para garantizar máxima velocidad y no sobrecargar la vista con datos innecesarios, seleccione un producto específico del selector superior para auditar su trazabilidad completa.
                </p>
              </div>
              
              <div className="pt-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                  Acceso rápido a artículos recientes:
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
                  {products.slice(0, 8).map(prod => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => setSelectedKardexProductId(prod.id)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="font-mono text-[11px] font-bold text-slate-500">{prod.codigo}</span>
                      <span className="truncate max-w-[150px]">{prod.nombre}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedKardexProductId('todos')}
                    className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Ver Todos ({movimientosInventario.length})
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TABLA DE MOVIMIENTOS CUANDO HAY UN PRODUCTO O "TODOS" SELECCIONADO */
            <div className="overflow-x-auto scrollbar-none">
              <table className="table-odoo">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Código / SKU</th>
                    <th>Producto</th>
                    <th className="text-right">Cantidad</th>
                    <th className="text-center">Stock Ant.</th>
                    <th className="text-center">Stock Resultante</th>
                    <th className="text-right">Costo ($)</th>
                    <th>Referencia / Justificación</th>
                    <th>Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredKardexMovements.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        No se encontraron movimientos registrados para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredKardexMovements.map(mov => {
                      const isPositive = mov.tipo === 'entrada' || mov.tipo === 'ajuste_positivo';
                      return (
                        <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="font-mono text-slate-600 text-xs whitespace-nowrap">{mov.fecha}</td>
                          <td>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isPositive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : mov.tipo === 'transferencia'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {mov.tipo.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="font-mono font-bold text-slate-700">{mov.producto_codigo}</td>
                          <td className="font-bold text-slate-900">{mov.producto_nombre}</td>
                          <td className={`text-right font-mono font-bold ${
                            isPositive ? 'text-emerald-700' : mov.tipo === 'transferencia' ? 'text-indigo-700' : 'text-rose-700'
                          }`}>
                            {isPositive ? `+${mov.cantidad}` : `-${mov.cantidad}`}
                          </td>
                          <td className="text-center font-mono text-slate-500 text-xs">{mov.stock_anterior ?? '-'}</td>
                          <td className="text-center font-mono font-bold text-slate-800">{mov.stock_resultante}</td>
                          <td className="text-right font-mono text-slate-600 text-xs">
                            ${Number(mov.costo_unitario || 0).toFixed(2)}
                          </td>
                          <td className="text-slate-600 text-xs max-w-xs truncate" title={mov.referencia}>
                            {mov.referencia || '-'}
                          </td>
                          <td className="text-slate-500 text-xs whitespace-nowrap">{mov.usuario || 'Sistema'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* BARRA DE ESTADO / FOOTER DE KARDEX */}
          <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-3">
              <span>Registros: <strong className="text-slate-800 font-bold">{filteredKardexMovements.length}</strong></span>
              <span>•</span>
              <span>Entradas: <strong className="text-emerald-700 font-bold">{filteredKardexMovements.filter(m => m.tipo === 'entrada' || m.tipo === 'ajuste_positivo').length}</strong></span>
              <span>•</span>
              <span>Salidas: <strong className="text-rose-700 font-bold">{filteredKardexMovements.filter(m => m.tipo === 'salida' || m.tipo === 'ajuste_negativo').length}</strong></span>
              <span>•</span>
              <span>Transferencias: <strong className="text-indigo-700 font-bold">{filteredKardexMovements.filter(m => m.tipo === 'transferencia').length}</strong></span>
            </div>
            <div className="text-[11px] text-slate-400">
              {selectedKardexProduct ? `Kardex individual de [${selectedKardexProduct.codigo}] ${selectedKardexProduct.nombre}` : 'Historial general de movimientos'}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 4: ALMACENES / DEPÓSITOS */}
      {/* ========================================================================= */}
      {activeTab === 'almacenes' && (
        <div className="flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Almacenes y Centros de Distribución</h3>
              <p className="text-xs text-slate-500 mt-0.5">Control de depósitos físicos, bodegas y ubicaciones de stock de la empresa.</p>
            </div>
            <button
              onClick={handleOpenNewAlmacen}
              className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus size={14} />
              <span>Nuevo Almacén</span>
            </button>
          </div>

          <div className="p-4 bg-slate-50/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {almacenes.map(alm => {
                const countProds = products.filter(p => p.almacen_id === alm.id).length;
                return (
                  <div key={alm.id} className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                          {alm.codigo}
                        </span>
                        <div className="flex items-center gap-1">
                          {alm.es_principal && (
                            <span className="badge-modern-info text-[10px]">Principal</span>
                          )}
                          <button
                            onClick={() => handleOpenEditAlmacen(alm)}
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar Almacén"
                          >
                            <Edit2 size={13} />
                          </button>
                          {!alm.es_principal && (
                            <button
                              onClick={() => handleDeleteAlmacen(alm)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar Almacén"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">{alm.nombre}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <span>📍</span>
                        <span>{alm.ubicacion || 'Sin ubicación especificada'}</span>
                      </p>
                      {alm.responsable && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Responsable: <span className="text-slate-600 font-medium">{alm.responsable}</span>
                        </p>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs flex justify-between items-center">
                      <span className="text-slate-500">Artículos asignados:</span>
                      <strong className="text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">
                        {countProds}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* BARRA DE ESTADO / FOOTER DE ALMACENES */}
          <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-3">
              <span>Depósitos registrados: <strong className="text-slate-800 font-bold">{almacenes.length}</strong></span>
              <span>•</span>
              <span>Depósito principal: <strong className="text-indigo-700 font-bold">{almacenes.find(a => a.es_principal)?.nombre || 'Principal'}</strong></span>
              <span>•</span>
              <span>Artículos con stock: <strong className="text-slate-800 font-bold">{products.length}</strong></span>
            </div>
            <div className="text-[11px] text-slate-400">
              Soporte multi-depósito activo con transferencias internas inmediatas
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 5: LISTA DE PRECIOS */}
      {/* ========================================================================= */}
      {activeTab === 'precios' && (
        <div className="flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700">Catálogo de Tarifas y Precios Oficiales</span>
            <button
              onClick={() => window.print()}
              className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
            >
              <Printer size={14} />
              <span>Imprimir Lista</span>
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-none">
            <table className="table-odoo">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th className="text-right">Precio Detal ($)</th>
                  <th className="text-right">Precio Detal (Bs. BCV)</th>
                  <th className="text-right">Precio Mayor ($)</th>
                  <th className="text-center">IVA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(prod => {
                  const pvp = Number(prod.precio_venta) || 0;
                  const pvpMayor = Number(prod.precio_mayor) || (pvp * 0.9);
                  const pvpBs = pvp * exchangeRate;
                  return (
                    <tr key={prod.id}>
                      <td className="font-mono font-bold text-slate-800">{prod.codigo}</td>
                      <td className="font-bold text-slate-900">{prod.nombre}</td>
                      <td className="text-slate-500 text-xs">{prod.categoria}</td>
                      <td className="text-right font-bold text-slate-900">${pvp.toFixed(2)}</td>
                      <td className="text-right font-bold text-emerald-700">
                        Bs. {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(pvpBs)}
                      </td>
                      <td className="text-right text-slate-600 font-medium">${pvpMayor.toFixed(2)}</td>
                      <td className="text-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {prod.aplica_iva ? '16%' : 'Exento'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* BARRA DE ESTADO / FOOTER DE LISTA DE PRECIOS */}
          <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-3">
              <span>Tarifas vigentes: <strong className="text-slate-800 font-bold">{products.length} artículos</strong></span>
              <span>•</span>
              <span>Tasa de cambio referencial BCV: <strong className="text-indigo-700 font-mono font-bold">Bs. {exchangeRate.toFixed(4)}</strong></span>
            </div>
            <div className="text-[11px] text-slate-400">
              Valores calculados en tiempo real listos para emisión física o digital
            </div>
          </div>
        </div>
      )}

        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL FICHA TÉCNICA DE PRODUCTO (CREAR / EDITAR) */}
      {/* ========================================================================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200">
            
            {/* Header del Modal */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingProduct ? `Editar: ${editingProduct.codigo} - ${editingProduct.nombre}` : 'Nuevo Artículo de Inventario'}
                  </h3>
                  <p className="text-xs text-slate-400">Datos técnicos, precios y configuración contable</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Sub-Pestañas del Modal */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-6 text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setProductModalTab('general')}
                className={`py-2.5 transition border-b-2 cursor-pointer ${
                  productModalTab === 'general' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                1. General
              </button>
              <button
                type="button"
                onClick={() => setProductModalTab('precios')}
                className={`py-2.5 transition border-b-2 cursor-pointer ${
                  productModalTab === 'precios' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                2. Costos & Precios
              </button>
              <button
                type="button"
                onClick={() => setProductModalTab('stock')}
                className={`py-2.5 transition border-b-2 cursor-pointer ${
                  productModalTab === 'stock' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                3. Existencias & Ubicación
              </button>
              <button
                type="button"
                onClick={() => setProductModalTab('contabilidad')}
                className={`py-2.5 transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  productModalTab === 'contabilidad' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <BookOpen size={13} className={productModalTab === 'contabilidad' ? 'text-indigo-600' : 'text-slate-400'} />
                4. Contabilidad NIIF
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveProduct} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {productModalTab === 'general' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Código SKU *</label>
                      <input
                        type="text"
                        required
                        value={productForm.codigo}
                        onChange={e => setProductForm({ ...productForm, codigo: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Código de Barras</label>
                      <input
                        type="text"
                        value={productForm.codigo_barra}
                        onChange={e => setProductForm({ ...productForm, codigo_barra: e.target.value })}
                        placeholder="EAN-13 o UPC"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Nombre Comercial *</label>
                    <input
                      type="text"
                      required
                      value={productForm.nombre}
                      onChange={e => setProductForm({ ...productForm, nombre: e.target.value })}
                      placeholder="Nombre descriptivo del artículo"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-indigo-600 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-slate-700 font-bold">Categoría *</label>
                        <button
                          type="button"
                          onClick={() => handleOpenNewCategory(true)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition"
                          title="Crear nueva categoría"
                        >
                          <Plus size={12} />
                          <span>+ Nueva Categoría</span>
                        </button>
                      </div>
                      <select
                        required
                        value={productForm.categoria}
                        onChange={e => setProductForm({ ...productForm, categoria: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-xs focus:bg-white focus:border-indigo-600 outline-none cursor-pointer"
                      >
                        {categorias.filter(c => c.activo || c.nombre === productForm.categoria).map(cat => (
                          <option key={cat.id} value={cat.nombre}>
                            {cat.codigo} - {cat.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Marca</label>
                      <input
                        type="text"
                        value={productForm.marca}
                        onChange={e => setProductForm({ ...productForm, marca: e.target.value })}
                        placeholder="Ej: HP, Logitech, Bixolon..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Descripción</label>
                    <textarea
                      rows={2}
                      value={productForm.descripcion}
                      onChange={e => setProductForm({ ...productForm, descripcion: e.target.value })}
                      placeholder="Detalles y especificaciones adicionales..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-600 outline-none resize-none"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/60 cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={productForm.activo}
                        onChange={e => setProductForm({ ...productForm, activo: e.target.checked })}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <div className="text-xs">
                        <span className="font-bold text-slate-800 block">Artículo Activo</span>
                        <span className="text-slate-500 text-[11px]">
                          Desmarque esta casilla para suspender el artículo sin perder su historial ni movimientos contables en el Kardex.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {productModalTab === 'precios' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Costo Unitario ($)</label>
                      <input
                        type="number"
                        step="any"
                        value={productForm.costo_unitario}
                        onChange={e => setProductForm({ ...productForm, costo_unitario: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Precio Venta Detal ($) *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={productForm.precio_venta}
                        onChange={e => setProductForm({ ...productForm, precio_venta: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-indigo-600 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Precio Mayorista ($)</label>
                      <input
                        type="number"
                        step="any"
                        value={productForm.precio_mayor}
                        onChange={e => setProductForm({ ...productForm, precio_mayor: e.target.value })}
                        placeholder="Opcional"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:bg-white focus:border-indigo-600 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Alícuota IVA</label>
                      <select
                        value={productForm.alicuota_iva}
                        onChange={e => setProductForm({ ...productForm, alicuota_iva: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none"
                      >
                        <option value="general">General (16%)</option>
                        <option value="reducida">Reducida (8%)</option>
                        <option value="exento">Exento (0%)</option>
                      </select>
                    </div>
                  </div>

                  {/* Calculadora en Tiempo Real de Rentabilidad y Precios */}
                  {(() => {
                    const costVal = parseFloat(productForm.costo_unitario) || 0;
                    const priceVal = parseFloat(productForm.precio_venta) || 0;
                    const profitVal = priceVal - costVal;
                    const marginPercent = priceVal > 0 ? (profitVal / priceVal) * 100 : 0;
                    const markupPercent = costVal > 0 ? (profitVal / costVal) * 100 : 0;
                    const priceBs = priceVal * exchangeRate;

                    return (
                      <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 border border-slate-200/90 rounded-2xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-black text-indigo-900 tracking-wider flex items-center gap-1.5">
                            <Percent size={12} className="text-indigo-600" />
                            Rentabilidad Comercial & Conversión BCV en Vivo
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 font-mono">
                            Tasa Oficial: Bs. {exchangeRate.toFixed(2)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                            <span className="text-[10px] text-slate-400 block font-bold">Margen Bruto</span>
                            <span className={`text-xs font-black font-mono ${marginPercent >= 30 ? 'text-emerald-700' : marginPercent > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                              {marginPercent.toFixed(1)}%
                            </span>
                          </div>

                          <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                            <span className="text-[10px] text-slate-400 block font-bold">Ganancia / Und</span>
                            <span className={`text-xs font-black font-mono ${profitVal >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              ${profitVal.toFixed(2)}
                            </span>
                          </div>

                          <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                            <span className="text-[10px] text-slate-400 block font-bold">Markup s/ Costo</span>
                            <span className="text-xs font-black font-mono text-indigo-700">
                              {markupPercent.toFixed(1)}%
                            </span>
                          </div>

                          <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
                            <span className="text-[10px] text-slate-400 block font-bold">PVP en Bolívares</span>
                            <span className="text-xs font-black font-mono text-slate-900">
                              Bs. {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(priceBs)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Resumen de cuentas contables vinculadas */}
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen size={14} className="text-indigo-600 shrink-0" />
                      <div className="text-[11px] text-slate-600 truncate">
                        <span className="font-bold text-slate-800">Cuentas NIIF:</span>{' '}
                        Inv: <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">{getAccCode(productForm.cuenta_inventario_id)}</span> •{' '}
                        Costo: <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-100">{getAccCode(productForm.cuenta_costo_id)}</span> •{' '}
                        Ingreso: <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1 py-0.5 rounded border border-blue-100">{getAccCode(productForm.cuenta_ingreso_id || productForm.cuenta_venta_id)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProductModalTab('contabilidad')}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline shrink-0 cursor-pointer self-end sm:self-auto"
                    >
                      Configurar Cuentas →
                    </button>
                  </div>
                </div>
              )}

              {productModalTab === 'stock' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Almacén Asignado</label>
                      <select
                        value={productForm.almacen_id}
                        onChange={e => setProductForm({ ...productForm, almacen_id: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none"
                      >
                        {almacenes.map(a => (
                          <option key={a.id} value={a.id}>{a.codigo} - {a.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Ubicación Física</label>
                      <input
                        type="text"
                        value={productForm.ubicacion}
                        onChange={e => setProductForm({ ...productForm, ubicacion: e.target.value })}
                        placeholder="Ej: Pasillo 1 - Tramo B"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        {editingProduct ? 'Stock Actual' : 'Stock Inicial'}
                      </label>
                      <input
                        type="number"
                        disabled={!!editingProduct}
                        value={productForm.stock_actual}
                        onChange={e => setProductForm({ ...productForm, stock_actual: e.target.value })}
                        className={`w-full px-3 py-2 rounded-xl font-bold ${editingProduct ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border border-slate-200 text-slate-900'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Stock Mínimo</label>
                      <input
                        type="number"
                        value={productForm.stock_minimo}
                        onChange={e => setProductForm({ ...productForm, stock_minimo: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Punto Reorden</label>
                      <input
                        type="number"
                        value={productForm.punto_reorden}
                        onChange={e => setProductForm({ ...productForm, punto_reorden: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Pestaña 4: Contabilidad NIIF */}
              {productModalTab === 'contabilidad' && (
                <div className="space-y-3.5 animate-in fade-in duration-150">
                  <div className="bg-gradient-to-r from-indigo-50/90 via-slate-50 to-white border border-indigo-100/80 rounded-xl p-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                      <BookOpen size={16} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold text-indigo-950">Asignación de Cuentas Contables NIIF / VEN-NIF</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100/80 text-indigo-700">
                          Automatización Contable
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                        Defina las cuentas contables para este artículo. El sistema automatizará los asientos en el Libro Diario al registrar compras, facturar ventas y descargar el costo de mercancías vendidas.
                      </p>
                    </div>
                  </div>

                  {/* 1. Cuenta de Inventario (Activo) */}
                  <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-2 hover:border-emerald-300 transition-colors shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100"></span>
                        <label className="font-bold text-slate-800 text-xs">1. Cuenta de Inventario (Activo Realizable)</label>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Activo Realizable (1.1.04)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Cuenta donde se registra el valor monetario de las existencias. Se debita al recibir compras y se acredita en despachos y salidas de inventario.
                    </p>
                    <CuentaSelectorTrigger
                      value={productForm.cuenta_inventario_id}
                      cuentasContables={cuentasContables}
                      placeholder="Seleccionar cuenta de inventario (Ej: 1.1.04.001)..."
                      onClick={() => {
                        setActiveAccountKey('cuenta_inventario_id');
                        setShowCuentaModal(true);
                      }}
                    />
                  </div>

                  {/* 2. Cuenta de Costo de Venta (Costo / Egreso) */}
                  <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-2 hover:border-amber-300 transition-colors shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-100"></span>
                        <label className="font-bold text-slate-800 text-xs">2. Cuenta de Costo de Venta (Costo / Egreso)</label>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Costo de Ventas (5.1)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Cuenta que se debita automáticamente al emitir una factura de venta para reconocer el costo de venta y calcular la utilidad bruta en el Estado de Resultados.
                    </p>
                    <CuentaSelectorTrigger
                      value={productForm.cuenta_costo_id}
                      cuentasContables={cuentasContables}
                      placeholder="Seleccionar cuenta de costo de venta (Ej: 5.1.01.001)..."
                      onClick={() => {
                        setActiveAccountKey('cuenta_costo_id');
                        setShowCuentaModal(true);
                      }}
                    />
                  </div>

                  {/* 3. Cuenta de Ingresos (Ventas) */}
                  <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 space-y-2 hover:border-blue-300 transition-colors shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-100"></span>
                        <label className="font-bold text-slate-800 text-xs">3. Cuenta de Ingresos (Ventas de Mercancía)</label>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        Ingresos Operacionales (4.1)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Cuenta de ingresos que se acredita al facturar este artículo a clientes en el módulo de ventas y facturación comercial.
                    </p>
                    <CuentaSelectorTrigger
                      value={productForm.cuenta_ingreso_id || productForm.cuenta_venta_id}
                      cuentasContables={cuentasContables}
                      placeholder="Seleccionar cuenta de ingresos por ventas (Ej: 4.1.01.001)..."
                      onClick={() => {
                        setActiveAccountKey('cuenta_ingreso_id');
                        setShowCuentaModal(true);
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-2 px-5"
                >
                  Guardar Artículo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CREAR / EDITAR CATEGORÍA */}
      {/* ========================================================================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCategoryModalOpen(false);
                  setEditingCategory(null);
                  setIsCategoryCreatedFromProductModal(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-slate-700 font-bold mb-1">Código / SKU *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={categoryForm.codigo}
                    onChange={e => setCategoryForm({ ...categoryForm, codigo: e.target.value.toUpperCase() })}
                    placeholder="GEN"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 uppercase focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">Nombre de la Categoría *</label>
                  <input
                    type="text"
                    required
                    value={categoryForm.nombre}
                    onChange={e => {
                      const val = e.target.value;
                      const suggestedCode = !categoryForm.codigo || categoryForm.codigo.startsWith('CAT-')
                        ? val.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '')
                        : categoryForm.codigo;
                      setCategoryForm({
                        ...categoryForm,
                        nombre: val,
                        codigo: editingCategory ? categoryForm.codigo : (suggestedCode || categoryForm.codigo)
                      });
                    }}
                    placeholder="Ej: Lácteos y Embutidos"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Descripción (Opcional)</label>
                <textarea
                  rows={2}
                  value={categoryForm.descripcion}
                  onChange={e => setCategoryForm({ ...categoryForm, descripcion: e.target.value })}
                  placeholder="Detalles sobre los productos de esta categoría..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Color de Distintivo / Etiqueta</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'indigo', label: 'Índigo', bg: 'bg-indigo-500' },
                    { id: 'emerald', label: 'Verde', bg: 'bg-emerald-500' },
                    { id: 'amber', label: 'Ámbar', bg: 'bg-amber-500' },
                    { id: 'blue', label: 'Azul', bg: 'bg-blue-500' },
                    { id: 'orange', label: 'Naranja', bg: 'bg-orange-500' },
                    { id: 'cyan', label: 'Cian', bg: 'bg-cyan-500' },
                    { id: 'purple', label: 'Púrpura', bg: 'bg-purple-500' },
                    { id: 'rose', label: 'Rosa', bg: 'bg-rose-500' },
                    { id: 'slate', label: 'Gris', bg: 'bg-slate-500' }
                  ].map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoryForm({ ...categoryForm, color: c.id })}
                      className={`h-7 px-2.5 rounded-lg flex items-center gap-1.5 border text-xs font-semibold cursor-pointer transition ${
                        categoryForm.color === c.id 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500/20' 
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${c.bg}`}></span>
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={categoryForm.activo}
                    onChange={e => setCategoryForm({ ...categoryForm, activo: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span className="text-slate-800 font-bold">Categoría Activa (Visible en catálogo y selección)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCategoryModalOpen(false);
                    setEditingCategory(null);
                    setIsCategoryCreatedFromProductModal(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-2 px-5"
                >
                  {editingCategory ? 'Guardar Cambios' : 'Crear Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE TRANSFERENCIA ENTRE ALMACENES */}
      {/* ========================================================================= */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-base">Transferencia entre Depósitos</h3>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTransfer} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Artículo *</label>
                <select
                  value={transferForm.producto_id}
                  onChange={e => {
                    const found = products.find(p => p.id === e.target.value);
                    setTransferProduct(found || null);
                    setTransferForm({ ...transferForm, producto_id: e.target.value });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.codigo} - {p.nombre} (Stock: {p.stock_actual} {p.unidad_medida})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Origen</label>
                  <select
                    value={transferForm.almacen_origen_id}
                    onChange={e => setTransferForm({ ...transferForm, almacen_origen_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none font-medium"
                  >
                    {almacenes.map(a => (
                      <option key={a.id} value={a.id}>{a.codigo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Destino</label>
                  <select
                    value={transferForm.almacen_destino_id}
                    onChange={e => setTransferForm({ ...transferForm, almacen_destino_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none font-medium"
                  >
                    {almacenes.map(a => (
                      <option key={a.id} value={a.id}>{a.codigo}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Cantidad a Transferir *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={transferForm.cantidad}
                  onChange={e => setTransferForm({ ...transferForm, cantidad: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs py-2 px-4"
                >
                  Transferir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE SEGURIDAD: AUTORIZACIÓN DE AJUSTE CON CLAVE (INDIVIDUAL) */}
      {/* ========================================================================= */}
      {isAuditSecurityModalOpen && auditTargetItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Autorización de Ajuste</h3>
                  <p className="text-xs text-purple-700">Clave de supervisor requerida</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAuditSecurityModalOpen(false);
                  setAuditTargetItem(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAuditAdjust} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="font-mono text-xs font-bold text-purple-700">{auditTargetItem.product.codigo}</div>
                <div className="font-bold text-sm text-slate-900 mt-0.5">{auditTargetItem.product.nombre}</div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                  <span className="block text-[10px] font-bold uppercase text-slate-400">Stock Sistema</span>
                  <span className="text-base font-bold text-slate-800">{auditTargetItem.systemStock}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200">
                  <span className="block text-[10px] font-bold uppercase text-purple-600">Conteo Físico</span>
                  <span className="text-base font-bold text-purple-900">{auditTargetItem.physicalCount}</span>
                </div>
                <div className={`p-2.5 rounded-xl border ${
                  auditTargetItem.diff < 0 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                }`}>
                  <span className="block text-[10px] font-bold uppercase">Diferencia</span>
                  <span className="text-base font-bold">
                    {auditTargetItem.diff > 0 ? '+' : ''}{auditTargetItem.diff}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Motivo / Justificación</label>
                <input
                  type="text"
                  required
                  value={auditMotivo}
                  onChange={e => setAuditMotivo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-bold">Clave de Supervisor *</label>
                  <span className="text-[10px] text-slate-400">admin o 1234</span>
                </div>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Ingrese clave autorizada"
                    value={supervisorPin}
                    onChange={e => {
                      setSupervisorPin(e.target.value);
                      if (pinError) setPinError('');
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:border-purple-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    {showPin ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
                {pinError && (
                  <p className="text-rose-600 text-[11px] font-bold mt-1">{pinError}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAuditSecurityModalOpen(false);
                    setAuditTargetItem(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition cursor-pointer"
                >
                  Validar y Aplicar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE SEGURIDAD: AJUSTE MASIVO */}
      {/* ========================================================================= */}
      {isBatchAuditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Ajuste Masivo de Auditoría</h3>
                  <p className="text-xs text-purple-700">Aplicar todas las diferencias</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchAuditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmBatchAudit} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-600">Artículos con descuadre:</span>
                  <strong className="text-purple-900 font-bold">{auditMetrics.differencesCount}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Diferencia neta:</span>
                  <strong className="text-slate-900 font-bold">
                    {auditMetrics.netUnitDiff > 0 ? '+' : ''}{auditMetrics.netUnitDiff} unids
                  </strong>
                </div>
                <div className="flex justify-between border-t border-purple-200/60 pt-1">
                  <span className="text-slate-600">Impacto financiero:</span>
                  <strong className="text-slate-900 font-bold">
                    {auditMetrics.netFinancialDiffUSD > 0 ? '+' : ''}${auditMetrics.netFinancialDiffUSD.toFixed(2)} USD
                  </strong>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-bold">Clave de Supervisor *</label>
                  <span className="text-[10px] text-slate-400">admin o 1234</span>
                </div>
                <input
                  type={showPin ? 'text' : 'password'}
                  required
                  autoFocus
                  placeholder="Ingrese clave autorizada"
                  value={supervisorPin}
                  onChange={e => {
                    setSupervisorPin(e.target.value);
                    if (pinError) setPinError('');
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 outline-none focus:border-purple-600"
                />
                {pinError && (
                  <p className="text-rose-600 text-[11px] font-bold mt-1">{pinError}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBatchAuditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition cursor-pointer"
                >
                  Autorizar y Aplicar Todo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Selector de Cuenta Contable NIIF */}
      <CuentaContableModal
        isOpen={showCuentaModal}
        onClose={() => {
          setShowCuentaModal(false);
          setActiveAccountKey(null);
        }}
        cuentasContables={cuentasContables}
        selectedCuentaId={activeAccountKey ? (productForm as any)[activeAccountKey] : ''}
        onSelect={cuenta => {
          if (activeAccountKey && cuenta) {
            const accValue = cuenta.id || cuenta.codigo;
            setProductForm(prev => {
              const updated = { ...prev, [activeAccountKey]: accValue };
              if (activeAccountKey === 'cuenta_ingreso_id' || activeAccountKey === 'cuenta_venta_id') {
                updated.cuenta_ingreso_id = accValue;
                updated.cuenta_venta_id = accValue;
              }
              return updated;
            });
          }
          setShowCuentaModal(false);
          setActiveAccountKey(null);
        }}
      />

      {/* MODAL CREAR / EDITAR ALMACÉN O DEPÓSITO */}
      {isAlmacenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Warehouse size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {editingAlmacen ? 'Editar Almacén / Depósito' : 'Registrar Nuevo Almacén'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Ubicación física de almacenamiento y stock</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAlmacenModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAlmacen} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Código del Depósito *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: DEP-01"
                  value={almacenForm.codigo}
                  onChange={e => setAlmacenForm({ ...almacenForm, codigo: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase font-bold focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nombre del Almacén *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Almacén Principal (Central)"
                  value={almacenForm.nombre}
                  onChange={e => setAlmacenForm({ ...almacenForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Ubicación Física</label>
                <input
                  type="text"
                  placeholder="Ej: Galpón Central A, Piso 1"
                  value={almacenForm.ubicacion}
                  onChange={e => setAlmacenForm({ ...almacenForm, ubicacion: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Responsable / Encargado</label>
                <input
                  type="text"
                  placeholder="Ej: Jefe de Inventario / Administración"
                  value={almacenForm.responsable}
                  onChange={e => setAlmacenForm({ ...almacenForm, responsable: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-700 block">Almacén Principal</span>
                  <span className="text-[11px] text-slate-400">Depósito predeterminado para compras y ventas</span>
                </div>
                <input
                  type="checkbox"
                  checked={almacenForm.es_principal}
                  onChange={e => setAlmacenForm({ ...almacenForm, es_principal: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAlmacenModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2 px-5 text-xs shadow-md cursor-pointer"
                >
                  {editingAlmacen ? 'Guardar Cambios' : 'Registrar Almacén'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
