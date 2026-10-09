import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, ArrowLeft, Search, Plus, Trash2, CheckCircle2, 
  Save, AlertTriangle, User, Building2, DollarSign, Calendar, 
  BookOpen, Eye, X, HelpCircle, Package, ShieldCheck, ShieldAlert, KeyRound,
  CreditCard, Landmark, Check, CornerDownRight, Coins, 
  Clock, ArrowRight, Sparkles, RefreshCw, Mail, Phone, Lock, Unlock, Tag, ChevronDown, Printer,
  ScanBarcode, Barcode, Settings, Info
} from 'lucide-react';
import BackButton from '../components/common/BackButton';
import CuentaSelectorTrigger from '../components/common/CuentaSelectorTrigger';
import CuentaContableModal from '../components/common/CuentaContableModal';
import TasaCambioModal from '../components/invoicing/TasaCambioModal';
import MasterAuthModal from '../components/common/MasterAuthModal';
import VoucherPreviewModal from '../components/common/VoucherPreviewModal';
import InvoicePrintModal from '../components/invoicing/InvoicePrintModal';
import { getTasaForDate, fetchLiveBcvRate } from '../services/exchangeRateService';
import { 
  dbFetchTerminalesPos, 
  dbFetchLotesPos, 
  dbSaveLotePos, 
  dbObtenerSiguienteCorrelativo, 
  dbActualizarStockLoteAtomico,
  dbAcumularTransaccionLotePosAtomico,
  isUUID 
} from '../services/db';
import { FacturaVentaModel, FacturaItemModel, ProductModel, TerminalPosModel, LotePosTransaccion } from '../types/database';
import { formatDate, getTodayLocalDate, addDaysToDate } from '../utils/dateUtils';
import { formatDocumentNumber, getNextCorrelativo, parseMoney } from '../utils/numberFormat';
import { useCompany } from '../context/CompanyContext';

export default function InvoiceForm({
  contactos = [],
  products = [],
  cuentasContables = [],
  bancos = [],
  configContable,
  onSave,
  showToast,
  workingYear,
  isModal = false,
  onClose,
  empresa
}: {
  contactos?: any[];
  products?: ProductModel[];
  cuentasContables?: any[];
  bancos?: any[];
  configContable?: any;
  onSave?: (collection: string, data: any) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
  workingYear?: string;
  isModal?: boolean;
  onClose?: () => void;
  empresa?: any;
}) {
  const navigate = useNavigate();
  const { activeCompanyId } = useCompany();
  const currentCompanyId = activeCompanyId || empresa?.id || '';

  // Document Info
  const [docType, setDocType] = useState<'factura' | 'nota_entrega' | 'nota_credito' | 'nota_debito'>('factura');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [issueDate, setIssueDate] = useState(() => getTodayLocalDate());
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(() => {
    const today = getTodayLocalDate();
    return getTasaForDate(today).toFixed(2);
  });
  const exchangeRate = useMemo(() => {
    const clean = exchangeRateInput.replace(',', '.');
    const val = parseFloat(clean);
    return isNaN(val) || val <= 0 ? 1 : val;
  }, [exchangeRateInput]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [controlNumber, setControlNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isTasaModalOpen, setIsTasaModalOpen] = useState(false);
  const [isSyncingBcvLive, setIsSyncingBcvLive] = useState(false);
  const [lastEmittedInvoice, setLastEmittedInvoice] = useState<FacturaVentaModel | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Sincronizar en vivo desde la página oficial del BCV
  const handleSyncLiveBcv = async () => {
    setIsSyncingBcvLive(true);
    try {
      const res = await fetchLiveBcvRate(true);
      if (res.success && res.tasa) {
        const rateStr = res.tasa.toFixed(2);
        setExchangeRateInput(rateStr);
        showToast?.(`Tasa BCV actualizada en vivo: Bs. ${res.tasa.toFixed(2)} / $ (${res.fuente})`, 'success');
        if (currency === 'VES') {
          recalculateItemsInVES(res.tasa);
        }
      } else {
        showToast?.(res.error || 'No se pudo obtener la tasa en vivo del BCV', 'error');
      }
    } catch (e: any) {
      showToast?.('Error al conectar con el servidor oficial del BCV', 'error');
    } finally {
      setIsSyncingBcvLive(false);
    }
  };

  // Auto-sincronizar tasa BCV al ingresar si está en valor por defecto
  useEffect(() => {
    const today = getTodayLocalDate();
    const stored = getTasaForDate(today);
    if (stored === 36.5) {
      fetchLiveBcvRate(false).then(res => {
        if (res.success && res.tasa) {
          setExchangeRateInput(res.tasa.toFixed(2));
        }
      });
    }
  }, []);

  // Sincronizar tasa si cambia la fecha de emisión
  useEffect(() => {
    const rate = getTasaForDate(issueDate);
    setExchangeRateInput(rate.toFixed(2));
  }, [issueDate]);

  // Escuchar eventos globales de actualización de tasa
  useEffect(() => {
    const handleTasaUpdated = (e: any) => {
      const detail = e.detail;
      if (detail && detail.tasa) {
        if (!detail.fecha || detail.fecha === issueDate) {
          setExchangeRateInput(Number(detail.tasa).toFixed(2));
        }
      }
    };
    window.addEventListener('tasa-cambio-updated', handleTasaUpdated);
    return () => window.removeEventListener('tasa-cambio-updated', handleTasaUpdated);
  }, [issueDate]);

  // Cliente Info
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerRif, setCustomerRif] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Modales de Cliente
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [activeCustomerModalTab, setActiveCustomerModalTab] = useState<'info' | 'contabilidad'>('info');
  const [customerModalForm, setCustomerModalForm] = useState({
    name: '',
    isCompany: true,
    taxIdPrefix: 'J',
    taxIdNumber: '',
    email: '',
    phone: '',
    personaContacto: '',
    cargo: '',
    address: '',
    debitAccount: '',
    creditAccount: ''
  });
  const [customerAccountError, setCustomerAccountError] = useState<string | null>(null);
  const [showCustomerCuentaModal, setShowCustomerCuentaModal] = useState(false);
  const [activeCustomerAccountKey, setActiveCustomerAccountKey] = useState<'debitAccount' | 'creditAccount' | null>(null);

  // Modal de Selección de Productos de Inventario
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [activeItemIndexForProduct, setActiveItemIndexForProduct] = useState<number | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedProductCategory, setSelectedProductCategory] = useState('all');

  // Lector de Código de Barras / SKU rápido
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Items / Líneas de la Factura
  const [items, setItems] = useState<FacturaItemModel[]>([
    {
      id: `item_${Date.now()}_1`,
      producto_id: '',
      codigo: '',
      descripcion: '',
      cantidad: 1,
      precio_unitario: 0,
      exento: false,
      subtotal: 0,
      iva_monto: 0,
      total: 0,
      cuenta_ingreso_id: '4.1.01.001',
      cuenta_costo_id: '5.1.01.001',
      cuenta_inventario_id: '1.1.04.001'
    }
  ]);

  // Modales y estados del flujo de emisión
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<'contado' | 'credito'>('contado');
  const [creditDays, setCreditDays] = useState(15);
  const [calculatedDueDate, setCalculatedDueDate] = useState('');

  // Autorización de Stock 0 con Clave Especial de Operaciones Master
  const [isZeroStockAuthorized, setIsZeroStockAuthorized] = useState(false);
  const [isMasterAuthModalOpen, setIsMasterAuthModalOpen] = useState(false);

  // Modal de Selección de Tarifas de Precios de Inventario
  const [priceModalItemIndex, setPriceModalItemIndex] = useState<number | null>(null);

  // Desbloqueo de Precio Manual por Renglón con Clave Especial / Supervisor
  const [isPriceUnlockAuthOpen, setIsPriceUnlockAuthOpen] = useState(false);
  const [priceUnlockTargetIndex, setPriceUnlockTargetIndex] = useState<number | null>(null);
  const [unlockedPriceRows, setUnlockedPriceRows] = useState<Record<number, boolean>>({});

  // Artículos con stock 0 o insuficiente
  const zeroStockItems = useMemo(() => {
    return items.filter(item => {
      if (!item.producto_id) return false;
      const prod = products.find(p => p.id === item.producto_id);
      if (!prod) return false;
      const stock = Number(prod.stock_actual) || 0;
      const qty = typeof item.cantidad === 'number' ? item.cantidad : parseMoney(item.cantidad);
      return stock <= 0 || qty > stock;
    });
  }, [items, products]);

  // Opciones de Retenciones e IGTF (Leyes Tributarias Venezolanas - SENIAT)
  const [applyRetIva, setApplyRetIva] = useState(false);
  const [retIvaPercent, setRetIvaPercent] = useState<number>(75); // 75% o 100% (Providencia SNAT/2015/0049)
  const [retIvaNumero, setRetIvaNumero] = useState('');
  const [retIvaFecha, setRetIvaFecha] = useState(getTodayLocalDate());

  const [applyRetIslr, setApplyRetIslr] = useState(false);
  const [retIslrPercent, setRetIslrPercent] = useState<number>(2); // 2%, 5%, 1%, 3% (Decreto 1808)
  const [retIslrNumero, setRetIslrNumero] = useState('');
  const [retIslrFecha, setRetIslrFecha] = useState(getTodayLocalDate());

  const [applyIgtf, setApplyIgtf] = useState(false);
  const [igtfPercent, setIgtfPercent] = useState<number>(3); // 3% Ley IGTF 2022

  // Modal para ingresar datos de Comprobantes de Retención (IVA / ISLR) sin saturar la barra lateral
  const [isRetencionModalOpen, setIsRetencionModalOpen] = useState(false);

  // Modal de Cobranza (para facturas de Contado)
  const [isCobranzaModalOpen, setIsCobranzaModalOpen] = useState(false);
  const [cobranzaForm, setCobranzaForm] = useState({
    fecha: getTodayLocalDate(),
    tasa: 36.50,
    pagos: [] as Array<{
      id: string;
      bancoId: string;
      metodoPago: string;
      terminalId?: string;
      referencia: string;
      monto: string;
      montoBs: string;
    }>
  });

  // Terminales POS para cobranzas con tarjeta
  const [terminalesPos, setTerminalesPos] = useState<TerminalPosModel[]>([]);
  useEffect(() => {
    dbFetchTerminalesPos(currentCompanyId).then(res => {
      if (res && res.length > 0) setTerminalesPos(res);
    });
  }, [currentCompanyId]);

  // Modal de Asiento Contable
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [pendingVoucher, setPendingVoucher] = useState<any>(null);

  // Generar correlativo inicial
  useEffect(() => {
    let prefix = '';
    let rawCorrelativo: string | number = '000001';

    if (docType === 'nota_credito') {
      prefix = 'NC-';
      rawCorrelativo = configContable?.correlativoFactura || '000001';
    } else if (docType === 'nota_debito') {
      prefix = 'ND-';
      rawCorrelativo = configContable?.correlativoFactura || '000001';
    } else if (docType === 'nota_entrega') {
      prefix = configContable?.prefijoNotaEntrega ?? '';
      rawCorrelativo = configContable?.correlativoNotaEntrega || '000001';
    } else {
      // Factura
      prefix = configContable?.prefijoFactura ?? '';
      rawCorrelativo = configContable?.correlativoFactura || '000001';
    }

    setInvoiceNumber(formatDocumentNumber(prefix, rawCorrelativo, 6));
    setControlNumber(`00-${Math.floor(100000 + Math.random() * 900000)}`);
  }, [configContable, docType]);

  // Recalcular vencimiento al cambiar días de crédito o fecha de emisión
  useEffect(() => {
    setCalculatedDueDate(addDaysToDate(issueDate, Number(creditDays || 0)));
  }, [issueDate, creditDays]);

  // Atajos de teclado estilo ERP (F2: Emitir Factura, F3: Buscar Catálogo, F4: Lector de Código de Barras)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        const formEl = document.getElementById('invoice-main-form') as HTMLFormElement;
        if (formEl) formEl.requestSubmit();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleOpenProductModal(null);
      } else if (e.key === 'F4') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lista filtrada de clientes
  const customersList = useMemo(() => {
    const term = customerSearchTerm.toLowerCase();
    return contactos.filter(c => {
      const isCust = c.type === 'customer' || c.type === 'both';
      const match = !term || 
        (c.name || '').toLowerCase().includes(term) ||
        (c.taxId || '').toLowerCase().includes(term);
      return isCust && match;
    });
  }, [contactos, customerSearchTerm]);

  // Totales calculados en tiempo real (con Retenciones e IGTF de acuerdo a leyes venezolanas)
  const totals = useMemo(() => {
    let subtotal = 0;
    let montoExento = 0;
    let baseImponible = 0;
    let ivaMonto = 0;

    items.forEach(item => {
      const cant = typeof item.cantidad === 'number' ? item.cantidad : parseMoney(item.cantidad);
      const price = typeof item.precio_unitario === 'number' ? item.precio_unitario : parseMoney(item.precio_unitario);
      const lineSubtotal = typeof item.subtotal === 'number' && item.subtotal > 0 ? item.subtotal : (cant * price);
      subtotal += lineSubtotal;
      if (item.exento) {
        montoExento += lineSubtotal;
      } else {
        baseImponible += lineSubtotal;
        ivaMonto += (typeof item.iva_monto === 'number' && item.iva_monto >= 0 ? item.iva_monto : (lineSubtotal * 0.16));
      }
    });

    // 1. IGTF 3% (Ley de Reforma del IGTF: Percepción por cobro en divisas o moneda extranjera)
    const igtfMonto = applyIgtf ? (subtotal + ivaMonto) * (igtfPercent / 100) : 0;

    // Total de la Factura (Subtotal + IVA + IGTF si aplica)
    const totalFactura = subtotal + ivaMonto + igtfMonto;

    // 2. Retención de IVA (Providencia SNAT/2015/0049: 75% o 100% sobre el IVA facturado)
    const retIvaMonto = applyRetIva ? ivaMonto * (retIvaPercent / 100) : 0;

    // 3. Retención de ISLR (Decreto 1808: 2%, 5%, 1% o 3% sobre la Base Imponible)
    const retIslrMonto = applyRetIslr ? baseImponible * (retIslrPercent / 100) : 0;

    // 4. Neto a Cobrar / Pagar (Total Facturado menos Retenciones que el cliente entrega en comprobante)
    const netoCobrar = Math.max(0, totalFactura - retIvaMonto - retIslrMonto);

    // Calcular montos en USD y Bs. según la moneda seleccionada en pantalla
    const isVes = currency === 'VES' && exchangeRate > 0;
    const factorToUSD = isVes ? (1 / exchangeRate) : 1;
    const factorToBs = isVes ? 1 : (exchangeRate || 1);

    const subtotalUSD = subtotal * factorToUSD;
    const subtotalBs = subtotal * factorToBs;
    const montoExentoUSD = montoExento * factorToUSD;
    const montoExentoBs = montoExento * factorToBs;
    const baseImponibleUSD = baseImponible * factorToUSD;
    const baseImponibleBs = baseImponible * factorToBs;
    const ivaMontoUSD = ivaMonto * factorToUSD;
    const ivaMontoBs = ivaMonto * factorToBs;
    const igtfMontoUSD = igtfMonto * factorToUSD;
    const igtfMontoBs = igtfMonto * factorToBs;
    const totalUSD = totalFactura * factorToUSD;
    const totalBs = totalFactura * factorToBs;
    const retIvaMontoUSD = retIvaMonto * factorToUSD;
    const retIvaMontoBs = retIvaMonto * factorToBs;
    const retIslrMontoUSD = retIslrMonto * factorToUSD;
    const retIslrMontoBs = retIslrMonto * factorToBs;
    const netoCobrarUSD = netoCobrar * factorToUSD;
    const netoCobrarBs = netoCobrar * factorToBs;

    return { 
      subtotal, 
      montoExento, 
      baseImponible, 
      ivaMonto, 
      igtfMonto,
      total: totalFactura, 
      totalUSD, 
      totalBs,
      subtotalUSD,
      subtotalBs,
      montoExentoUSD,
      montoExentoBs,
      baseImponibleUSD,
      baseImponibleBs,
      ivaMontoUSD,
      ivaMontoBs,
      igtfMontoUSD,
      igtfMontoBs,
      retIvaMonto,
      retIvaMontoUSD,
      retIvaMontoBs,
      retIslrMonto,
      retIslrMontoUSD,
      retIslrMontoBs,
      netoCobrar,
      netoCobrarUSD,
      netoCobrarBs
    };
  }, [items, currency, exchangeRate, applyRetIva, retIvaPercent, applyRetIslr, retIslrPercent, applyIgtf, igtfPercent]);

  // Formateador de moneda
  const formatMoney = (amount: number, curr = currency) => {
    return new Intl.NumberFormat('es-VE', { 
      style: 'currency', 
      currency: curr === 'VES' ? 'VES' : 'USD',
      minimumFractionDigits: 2 
    }).format(amount || 0).replace('USD', '$').replace('VES', 'Bs.');
  };

  // Manejo de Cliente
  const handleSelectCustomer = (cust: any) => {
    setSelectedCustomerId(cust.id);
    setCustomerName(cust.name || cust.nombre || '');
    setCustomerRif(cust.taxId || cust.rif || '');
    setCustomerAddress(cust.address || cust.direccion || '');
    setCustomerPhone(cust.phone || cust.telefono || '');
    setCustomerEmail(cust.email || '');
    setIsCustomerModalOpen(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerRif('');
    setCustomerAddress('');
    setCustomerPhone('');
    setCustomerEmail('');
  };

  // Categorías únicas de productos
  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.categoria && p.categoria.trim()) {
        cats.add(p.categoria.trim());
      }
    });
    return Array.from(cats);
  }, [products]);

  // Lista de productos filtrada para el modal
  const filteredProducts = useMemo(() => {
    const term = productSearchTerm.toLowerCase().trim();
    return products.filter(p => {
      const matchesCategory = selectedProductCategory === 'all' || p.categoria === selectedProductCategory;
      if (!matchesCategory) return false;
      if (!term) return true;
      return (
        (p.codigo || '').toLowerCase().includes(term) ||
        (p.nombre || '').toLowerCase().includes(term) ||
        (p.descripcion || '').toLowerCase().includes(term) ||
        (p.categoria || '').toLowerCase().includes(term)
      );
    });
  }, [products, productSearchTerm, selectedProductCategory]);

  const handleOpenProductModal = (index: number | null = null) => {
    setActiveItemIndexForProduct(index);
    setProductSearchTerm('');
    setSelectedProductCategory('all');
    setIsProductModalOpen(true);
  };

  // Obtener el precio base en USD según la tarifa establecida en el inventario
  const getProductPriceForTier = (prod: ProductModel, tier?: 'detal' | 'mayor' | 'vip' | 'minimo' | string) => {
    if (!prod) return 0;
    switch (tier) {
      case 'mayor':
        return (Number(prod.precio_mayor) > 0 ? Number(prod.precio_mayor) : Number(prod.precio_venta)) || 0;
      case 'vip':
        return (Number(prod.precio_vip) > 0 ? Number(prod.precio_vip) : Number(prod.precio_venta)) || 0;
      case 'minimo':
        return (Number(prod.precio_minimo) > 0 ? Number(prod.precio_minimo) : Number(prod.precio_venta)) || 0;
      case 'detal':
      default:
        return Number(prod.precio_venta) || 0;
    }
  };

  // Obtener lista de tarifas de precios establecidas en inventario para un producto
  const getAvailablePriceTiers = (prod: ProductModel) => {
    const tiers: Array<{ id: 'detal' | 'mayor' | 'vip' | 'minimo'; label: string; priceUSD: number }> = [
      { id: 'detal', label: 'PVP (Detal)', priceUSD: Number(prod.precio_venta) || 0 }
    ];
    if (Number(prod.precio_mayor) > 0) {
      tiers.push({ id: 'mayor', label: 'Mayorista', priceUSD: Number(prod.precio_mayor) });
    }
    if (Number(prod.precio_vip) > 0) {
      tiers.push({ id: 'vip', label: 'VIP / Especial', priceUSD: Number(prod.precio_vip) });
    }
    if (Number(prod.precio_minimo) > 0) {
      tiers.push({ id: 'minimo', label: 'Precio Mínimo', priceUSD: Number(prod.precio_minimo) });
    }
    return tiers;
  };

  const addProductToItems = (prod: ProductModel, targetIndex: number | null = null, tier: 'detal' | 'mayor' | 'vip' | 'minimo' = 'detal') => {
    let idx = targetIndex;

    // Si no había índice activo (ej. botón global "+ Buscar en Catálogo"), buscamos una línea vacía o agregamos una nueva
    if (idx === null || idx < 0 || idx >= items.length) {
      const emptyIdx = items.findIndex(it => !it.producto_id && !it.descripcion && (it.precio_unitario === 0 || !it.precio_unitario));
      if (emptyIdx !== -1) {
        idx = emptyIdx;
      } else {
        idx = items.length;
      }
    }

    setItems(prev => {
      const updated = [...prev];
      const existingLine = idx !== null && idx < updated.length ? updated[idx] : null;
      const qty = existingLine ? (Number(existingLine.cantidad) || 1) : 1;

      // Calcular precio unitario bloqueado según la tarifa establecida y la moneda de emisión (USD o VES)
      const baseUSD = getProductPriceForTier(prod, tier);
      let price = baseUSD;
      if (currency === 'VES' && exchangeRate > 0) {
        price = Number((baseUSD * exchangeRate).toFixed(2));
      } else {
        price = Number(baseUSD.toFixed(2));
      }

      const lineSubtotal = Number((qty * price).toFixed(2));
      const isExempt = !prod.aplica_iva;
      const iva = isExempt ? 0 : Number((lineSubtotal * 0.16).toFixed(2));
      const cleanName = (prod.nombre || '').replace(/\s*\(E\)\s*$/i, '').trim();
      const itemDescription = isExempt ? `${cleanName} (E)` : cleanName;

      const newItem: FacturaItemModel = {
        id: existingLine?.id || `item_${Date.now()}_${idx}`,
        producto_id: prod.id,
        codigo: prod.codigo,
        descripcion: itemDescription,
        cantidad: qty,
        precio_unitario: price,
        tipo_precio: tier,
        exento: isExempt,
        subtotal: lineSubtotal,
        iva_monto: iva,
        total: Number((lineSubtotal + iva).toFixed(2)),
        cuenta_ingreso_id: prod.cuenta_venta_id || '4.1.01.001',
        cuenta_costo_id: prod.cuenta_costo_id || '5.1.01.001',
        cuenta_inventario_id: prod.cuenta_inventario_id || '1.1.04.001'
      };

      if (idx !== null && idx < updated.length) {
        updated[idx] = newItem;
      } else {
        updated.push(newItem);
      }
      return updated;
    });
  };

  // Manejar cambio de tarifa de precio establecida en inventario para una fila
  const handlePriceTierChange = (index: number, tier: 'detal' | 'mayor' | 'vip' | 'minimo') => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const prod = products.find(p => p.id === item.producto_id || (item.codigo && p.codigo && p.codigo.trim().toLowerCase() === item.codigo.trim().toLowerCase()));
      if (!prod) return prev;

      const baseUSD = getProductPriceForTier(prod, tier);
      let price = baseUSD;
      if (currency === 'VES' && exchangeRate > 0) {
        price = Number((baseUSD * exchangeRate).toFixed(2));
      } else {
        price = Number(baseUSD.toFixed(2));
      }

      const qty = typeof item.cantidad === 'number' ? item.cantidad : parseMoney(item.cantidad);
      const lineSubtotal = Number((qty * price).toFixed(2));
      const iva = item.exento ? 0 : Number((lineSubtotal * 0.16).toFixed(2));

      item.tipo_precio = tier;
      item.precio_unitario = price;
      item.subtotal = lineSubtotal;
      item.iva_monto = iva;
      item.total = Number((lineSubtotal + iva).toFixed(2));

      updated[index] = item;
      return updated;
    });
  };

  // Manejo de edición manual de precio para una fila desbloqueada con clave de supervisor
  const handleManualPriceChange = (index: number, rawVal: string) => {
    const cleanVal = rawVal.replace(/[^0-9.,]/g, '');
    const parsed = parseMoney(cleanVal);
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const qty = typeof item.cantidad === 'number' ? item.cantidad : parseMoney(item.cantidad);
      const lineSubtotal = Number((qty * parsed).toFixed(2));
      const iva = item.exento ? 0 : Number((lineSubtotal * 0.16).toFixed(2));

      item.tipo_precio = 'manual';
      item.precio_unitario = cleanVal as any;
      item.subtotal = lineSubtotal;
      item.iva_monto = iva;
      item.total = Number((lineSubtotal + iva).toFixed(2));

      updated[index] = item;
      return updated;
    });
  };

  const handleManualPriceBlur = (index: number) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const numPrice = parseMoney(item.precio_unitario);
      const qty = typeof item.cantidad === 'number' ? item.cantidad : parseMoney(item.cantidad);
      const lineSubtotal = Number((qty * numPrice).toFixed(2));
      const iva = item.exento ? 0 : Number((lineSubtotal * 0.16).toFixed(2));

      item.precio_unitario = numPrice;
      item.subtotal = lineSubtotal;
      item.iva_monto = iva;
      item.total = Number((lineSubtotal + iva).toFixed(2));

      updated[index] = item;
      return updated;
    });
  };

  const handleSelectProductFromModal = (prod: ProductModel, tier: 'detal' | 'mayor' | 'vip' | 'minimo' = 'detal') => {
    addProductToItems(prod, activeItemIndexForProduct, tier);
    setIsProductModalOpen(false);
    setActiveItemIndexForProduct(null);
    showToast?.(`Artículo "${prod.nombre}" añadido a la factura`, 'success');
  };

  // Escaneo y búsqueda por lector de código de barras o SKU
  const handleBarcodeScan = (scannedCode: string) => {
    const code = scannedCode.trim();
    if (!code) return;

    const term = code.toLowerCase();
    // 1. Buscar coincidencia exacta por código SKU / código de barras
    let prod = products.find(p => p.codigo && p.codigo.trim().toLowerCase() === term);

    // 2. Si no, buscar por ID directo
    if (!prod) {
      prod = products.find(p => p.id && p.id.toLowerCase() === term);
    }

    // 3. Si no, buscar por coincidencia parcial en código
    if (!prod) {
      prod = products.find(p => p.codigo && p.codigo.trim().toLowerCase().includes(term));
    }

    if (!prod) {
      showToast?.(`Código de barras o SKU "${code}" no encontrado en el inventario`, 'error');
      barcodeInputRef.current?.select();
      return;
    }

    // Si el producto ya está en la factura, aumentamos su cantidad en 1
    const existingIdx = items.findIndex(it => it.producto_id === prod!.id);
    if (existingIdx !== -1) {
      const currentQty = Number(items[existingIdx].cantidad) || 1;
      handleItemFieldChange(existingIdx, 'cantidad', currentQty + 1);
      showToast?.(`+1 "${prod.nombre}" escaneado (Cantidad: ${currentQty + 1})`, 'success');
    } else {
      addProductToItems(prod);
      showToast?.(`"${prod.nombre}" añadido por lector de código de barras`, 'success');
    }

    setBarcodeInput('');
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 60);
  };

  // Asignar producto por código/SKU directamente en la celda de una fila
  const handleLookupSkuInRow = (rowIndex: number, skuCode: string) => {
    const code = skuCode.trim().toLowerCase();
    if (!code) return;

    let prod = products.find(p => p.codigo && p.codigo.trim().toLowerCase() === code);
    if (!prod) {
      prod = products.find(p => p.id && p.id.toLowerCase() === code);
    }
    if (!prod) {
      prod = products.find(p => p.codigo && p.codigo.trim().toLowerCase().includes(code));
    }

    if (prod) {
      addProductToItems(prod, rowIndex);
      showToast?.(`Artículo "${prod.nombre}" cargado en fila #${rowIndex + 1}`, 'success');
    } else {
      showToast?.(`No se encontró producto con código/SKU "${skuCode}"`, 'error');
    }
  };

  // Conversión automática de moneda y multiplicación por tasa de cambio al cambiar a Bolívares
  const handleCurrencyChange = (newCurrency: 'USD' | 'VES') => {
    if (newCurrency === currency) return;

    setCurrency(newCurrency);

    setItems(prevItems => {
      return prevItems.map(item => {
        // Si la fila está completamente vacía, conservarla sin cambios
        if (!item.producto_id && !item.descripcion && !item.precio_unitario) {
          return item;
        }

        const qty = Number(item.cantidad) || 1;
        const prod = products.find(p => p.id === item.producto_id);

        let newUnitPrice = Number(item.precio_unitario) || 0;

        if (newCurrency === 'VES') {
          // AL CAMBIAR A BOLÍVARES: Tomar la tarifa seleccionada del producto y multiplicarla por la tasa de cambio
          if (prod && item.tipo_precio !== 'manual') {
            const baseUSD = getProductPriceForTier(prod, item.tipo_precio || 'detal');
            newUnitPrice = baseUSD * exchangeRate;
          } else if (newUnitPrice > 0 && exchangeRate > 0) {
            newUnitPrice = newUnitPrice * exchangeRate;
          }
        } else {
          // AL CAMBIAR A DÓLARES: Restaurar la tarifa seleccionada del producto en USD o dividir por la tasa
          if (prod && item.tipo_precio !== 'manual') {
            newUnitPrice = getProductPriceForTier(prod, item.tipo_precio || 'detal');
          } else if (newUnitPrice > 0 && exchangeRate > 0) {
            newUnitPrice = newUnitPrice / exchangeRate;
          }
        }

        newUnitPrice = Number(newUnitPrice.toFixed(2));
        const isExempt = item.exento;
        const lineSubtotal = Number((qty * newUnitPrice).toFixed(2));
        const lineIva = isExempt ? 0 : Number((lineSubtotal * 0.16).toFixed(2));

        return {
          ...item,
          precio_unitario: newUnitPrice,
          subtotal: lineSubtotal,
          iva_monto: lineIva,
          total: Number((lineSubtotal + lineIva).toFixed(2))
        };
      });
    });

    if (showToast) {
      showToast(
        newCurrency === 'VES'
          ? `Precios convertidos a Bolívares (Tasa: Bs. ${exchangeRate.toFixed(2)})`
          : 'Precios convertidos a Dólares ($)',
        'info'
      );
    }
  };

  const recalculateItemsInVES = (customRate?: number) => {
    const rate = customRate || exchangeRate;
    if (rate <= 0) return;

    setItems(prevItems => {
      return prevItems.map(item => {
        if (!item.producto_id && !item.descripcion && !item.precio_unitario) {
          return item;
        }

        const qty = Number(item.cantidad) || 1;
        const prod = products.find(p => p.id === item.producto_id);

        let newUnitPrice = Number(item.precio_unitario) || 0;
        if (prod && item.tipo_precio !== 'manual') {
          const baseUSD = getProductPriceForTier(prod, item.tipo_precio || 'detal');
          newUnitPrice = baseUSD * rate;
        } else if (currency === 'VES' && newUnitPrice > 0 && exchangeRate > 0) {
          newUnitPrice = (newUnitPrice / exchangeRate) * rate;
        }

        newUnitPrice = Number(newUnitPrice.toFixed(2));
        const isExempt = item.exento;
        const lineSubtotal = Number((qty * newUnitPrice).toFixed(2));
        const lineIva = isExempt ? 0 : Number((lineSubtotal * 0.16).toFixed(2));

        return {
          ...item,
          precio_unitario: newUnitPrice,
          subtotal: lineSubtotal,
          iva_monto: lineIva,
          total: Number((lineSubtotal + lineIva).toFixed(2))
        };
      });
    });

    showToast?.(`Precios recalculados a la tasa de Bs. ${rate.toFixed(2)}`, 'success');
  };

  const handleOpenNewCustomerModal = () => {
    setCustomerModalForm({
      name: '',
      isCompany: true,
      taxIdPrefix: 'J',
      taxIdNumber: '',
      email: '',
      phone: '',
      personaContacto: '',
      cargo: '',
      address: '',
      debitAccount: '',
      creditAccount: ''
    });
    setCustomerAccountError(null);
    setActiveCustomerModalTab('info');
    setIsNewCustomerModalOpen(true);
  };

  const handleSaveCustomerFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerModalForm.name.trim()) {
      showToast?.('El nombre o razón social es obligatorio', 'error');
      return;
    }

    // Validación obligatoria de cuentas contables vinculadas manualmente
    if (!customerModalForm.debitAccount?.trim() || !customerModalForm.creditAccount?.trim()) {
      setActiveCustomerModalTab('contabilidad');
      const msg = !customerModalForm.debitAccount?.trim() && !customerModalForm.creditAccount?.trim()
        ? 'Debe vincular las cuentas contables (Cuenta por Cobrar y Anticipo) de forma manual antes de registrar el cliente'
        : !customerModalForm.debitAccount?.trim()
          ? 'Debe vincular la Cuenta por Cobrar del cliente de forma manual'
          : 'Debe vincular la Cuenta de Anticipo del cliente de forma manual';
      setCustomerAccountError(msg);
      showToast?.(msg, 'error');
      return;
    }

    const fullTaxId = customerModalForm.taxIdNumber.trim()
      ? `${customerModalForm.taxIdPrefix}-${customerModalForm.taxIdNumber.trim().toUpperCase()}`
      : `${customerModalForm.taxIdPrefix}-00000000-0`;

    const newContact = {
      id: crypto.randomUUID(),
      name: customerModalForm.name.trim(),
      type: 'customer',
      taxId: fullTaxId,
      email: customerModalForm.email.trim(),
      phone: customerModalForm.phone.trim(),
      address: customerModalForm.address.trim(),
      isCompany: customerModalForm.isCompany,
      personaContacto: customerModalForm.personaContacto.trim(),
      cargo: customerModalForm.cargo.trim(),
      debitAccount: customerModalForm.debitAccount,
      creditAccount: customerModalForm.creditAccount,
      saldo: 0,
      activo: true,
      created_at: new Date().toISOString()
    };

    onSave?.('contactos', newContact);
    handleSelectCustomer(newContact);
    setIsNewCustomerModalOpen(false);
    showToast?.('Cliente registrado y seleccionado en la factura', 'success');
  };

  // Manejo de Items
  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item_${Date.now()}_${prev.length + 1}`,
        producto_id: '',
        codigo: '',
        descripcion: '',
        cantidad: 1,
        precio_unitario: 0,
        exento: false,
        subtotal: 0,
        iva_monto: 0,
        total: 0,
        cuenta_ingreso_id: '4.1.01.001',
        cuenta_costo_id: '5.1.01.001',
        cuenta_inventario_id: '1.1.04.001'
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) {
      showToast?.('La factura debe tener al menos una línea', 'info');
      return;
    }
    setItems(prev => prev.filter((_, idx) => idx !== index));
    setUnlockedPriceRows(prev => {
      const next: Record<number, boolean> = {};
      Object.keys(prev).forEach(k => {
        const rowIdx = Number(k);
        if (rowIdx < index) {
          next[rowIdx] = prev[rowIdx];
        } else if (rowIdx > index) {
          next[rowIdx - 1] = prev[rowIdx];
        }
      });
      return next;
    });
  };

  const handleProductSelect = (index: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    setItems(prev => {
      const updated = [...prev];
      if (prod) {
        const qty = updated[index].cantidad || 1;
        // Si la moneda es VES, convertir el precio venta en USD a VES
        let price = prod.precio_venta || 0;
        if (currency === 'VES' && exchangeRate > 0) {
          price = price * exchangeRate;
        }

        const lineSubtotal = qty * price;
        const isExempt = !prod.aplica_iva;
        const iva = isExempt ? 0 : lineSubtotal * 0.16;

        updated[index] = {
          ...updated[index],
          producto_id: prod.id,
          codigo: prod.codigo,
          descripcion: prod.nombre,
          precio_unitario: price,
          exento: isExempt,
          subtotal: lineSubtotal,
          iva_monto: iva,
          total: lineSubtotal + iva,
          cuenta_ingreso_id: prod.cuenta_venta_id || '4.1.01.001',
          cuenta_costo_id: prod.cuenta_costo_id || '5.1.01.001',
          cuenta_inventario_id: prod.cuenta_inventario_id || '1.1.04.001'
        };
      } else {
        updated[index] = {
          ...updated[index],
          producto_id: '',
          codigo: '',
          descripcion: '',
          precio_unitario: 0,
          subtotal: 0,
          iva_monto: 0,
          total: 0
        };
      }
      return updated;
    });
  };

  const handleItemFieldChange = (index: number, field: string, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      const qty = typeof item.cantidad === 'number' ? item.cantidad : parseMoney(item.cantidad);
      const price = typeof item.precio_unitario === 'number' ? item.precio_unitario : parseMoney(item.precio_unitario);
      const lineSubtotal = qty * price;
      const iva = item.exento ? 0 : lineSubtotal * 0.16;

      item.subtotal = lineSubtotal;
      item.iva_monto = iva;
      item.total = lineSubtotal + iva;

      updated[index] = item;
      return updated;
    });
  };

  // =========================================================================
  // PASO 1: Validar Formulario y Abrir Modal de Condición (Contado o Crédito)
  // =========================================================================
  const handleStartEmission = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName || !customerRif) {
      showToast?.('Seleccione o registre el cliente a quien se emitirá la factura', 'error');
      return;
    }

    if (!invoiceNumber.trim()) {
      showToast?.('El número de documento es obligatorio', 'error');
      return;
    }

    if (!items || items.length === 0) {
      showToast?.('Debe registrar al menos un producto o artículo para emitir la factura', 'error');
      return;
    }

    const invalidItemIndex = items.findIndex(
      i => (!i.producto_id && !i.codigo) || !i.descripcion.trim() || parseMoney(i.cantidad) <= 0 || parseMoney(i.precio_unitario) <= 0
    );

    if (invalidItemIndex !== -1) {
      const rowNum = invalidItemIndex + 1;
      const row = items[invalidItemIndex];
      if (!row.producto_id && !row.codigo) {
        showToast?.(`Renglón #${rowNum}: Debe seleccionar un producto o artículo del inventario`, 'error');
      } else if (!row.descripcion.trim()) {
        showToast?.(`Renglón #${rowNum}: Ingrese la descripción del producto o artículo`, 'error');
      } else if (parseMoney(row.cantidad) <= 0) {
        showToast?.(`Renglón #${rowNum}: La cantidad debe ser mayor a 0`, 'error');
      } else {
        showToast?.(`Renglón #${rowNum}: El precio unitario debe ser mayor a 0`, 'error');
      }
      return;
    }

    if (totals.total <= 0) {
      showToast?.('El total de la factura debe ser mayor a 0', 'error');
      return;
    }

    // Validar año contable
    if (workingYear && issueDate) {
      const yr = issueDate.substring(0, 4);
      if (yr !== workingYear) {
        showToast?.(`La fecha (${yr}) no coincide con el período contable seleccionado (${workingYear})`, 'error');
        return;
      }
    }

    // Validar comprobantes de retención si se activaron: si falta alguno, abrir modal de retenciones
    if (applyRetIva && (!retIvaNumero.trim() || !retIvaFecha)) {
      setIsRetencionModalOpen(true);
      showToast?.('Por favor ingrese el número y fecha del comprobante de Retención IVA', 'info');
      return;
    }

    if (applyRetIslr && (!retIslrNumero.trim() || !retIslrFecha)) {
      setIsRetencionModalOpen(true);
      showToast?.('Por favor ingrese el número y fecha del comprobante de Retención ISLR', 'info');
      return;
    }

    // Si hay productos con stock 0 o insuficiente y aún no han sido autorizados con clave master
    if (zeroStockItems.length > 0 && !isZeroStockAuthorized) {
      setIsMasterAuthModalOpen(true);
      return;
    }

    // Proceder directamente según la condición de pago seleccionada en la cabecera
    if (selectedCondition === 'credito') {
      buildAndShowVoucher('credito');
    } else {
      handleSelectCondition('contado');
    }
  };

  const handleResetForm = () => {
    if (window.confirm('¿Está seguro de reiniciar y vaciar los datos de la factura actual?')) {
      handleClearCustomer();
      setItems([{
        id: `item_${Date.now()}_1`,
        producto_id: '',
        codigo: '',
        descripcion: '',
        cantidad: 1,
        precio_unitario: 0,
        exento: false,
        subtotal: 0,
        iva_monto: 0,
        total: 0,
        cuenta_ingreso_id: '4.1.01.001',
        cuenta_costo_id: '5.1.01.001',
        cuenta_inventario_id: '1.1.04.001'
      }]);
      setNotes('');
      setApplyRetIva(false);
      setRetIvaNumero('');
      setRetIvaFecha(getTodayLocalDate());
      setApplyRetIslr(false);
      setRetIslrNumero('');
      setRetIslrFecha(getTodayLocalDate());
      setApplyIgtf(false);
      setSelectedCondition('contado');
      showToast?.('Formulario reiniciado', 'info');
    }
  };

  // =========================================================================
  // PASO 2: Elegir Condición y Pasar a Cobranza o Asiento Contable
  // =========================================================================
  const handleSelectCondition = (cond: 'contado' | 'credito') => {
    setSelectedCondition(cond);
    setIsConditionModalOpen(false);

    if (cond === 'credito') {
      // Si es crédito, mostrar el asiento contable para verificación del usuario
      buildAndShowVoucher('credito');
    } else {
      // Si es contado, abrir el modal de Cobranza idéntico al del ERP
      const defaultBanco = bancos.length > 0 ? bancos[0] : null;
      
      const pagoInicial = {
        id: `pg_${Date.now()}`,
        bancoId: defaultBanco ? defaultBanco.id : '',
        metodoPago: 'Transferencia',
        referencia: '',
        monto: currency === 'USD' ? totals.netoCobrar.toFixed(2) : totals.netoCobrarUSD.toFixed(2),
        montoBs: currency === 'VES' ? totals.netoCobrar.toFixed(2) : totals.netoCobrarBs.toFixed(2)
      };

      setCobranzaForm({
        fecha: issueDate,
        tasa: exchangeRate,
        pagos: [pagoInicial]
      });
      setIsCobranzaModalOpen(true);
    }
  };

  // Manejo de pagos en el Modal de Cobranza
  const handleAddPagoCobranza = () => {
    const defaultBanco = bancos.length > 0 ? bancos[0] : null;
    setCobranzaForm(prev => ({
      ...prev,
      pagos: [
        ...prev.pagos,
        {
          id: `pg_${Date.now()}_${prev.pagos.length + 1}`,
          bancoId: defaultBanco ? defaultBanco.id : '',
          metodoPago: 'Transferencia',
          referencia: '',
          monto: '0.00',
          montoBs: '0.00'
        }
      ]
    }));
  };

  const handleRemovePagoCobranza = (index: number) => {
    if (cobranzaForm.pagos.length === 1) return;
    setCobranzaForm(prev => ({
      ...prev,
      pagos: prev.pagos.filter((_, i) => i !== index)
    }));
  };

  // Cálculos dinámicos de cobranza, validación de monto facturado vs cobrado y vuelto
  const cobranzaCalculations = useMemo(() => {
    const totalPagadoUSD = cobranzaForm.pagos.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0);
    const totalPagadoBs = cobranzaForm.pagos.reduce((acc, p) => acc + (parseFloat(p.montoBs) || 0), 0);
    const totalAFacturarUSD = totals.netoCobrarUSD;
    const totalAFacturarBs = totals.netoCobrarBs;

    const diffUSD = Number((totalPagadoUSD - totalAFacturarUSD).toFixed(2));
    const diffBs = Number((totalPagadoBs - totalAFacturarBs).toFixed(2));

    const isExact = Math.abs(diffUSD) <= 0.01;
    const isUnderpaid = diffUSD < -0.01;
    const isOverpaid = diffUSD > 0.01;

    const vueltoUSD = isOverpaid ? diffUSD : 0;
    const vueltoBs = isOverpaid ? (diffBs > 0 ? diffBs : Number((diffUSD * exchangeRate).toFixed(2))) : 0;

    const faltanteUSD = isUnderpaid ? Math.abs(diffUSD) : 0;
    const faltanteBs = isUnderpaid ? (Math.abs(diffBs) > 0 ? Math.abs(diffBs) : Number((faltanteUSD * exchangeRate).toFixed(2))) : 0;

    return {
      totalPagadoUSD,
      totalPagadoBs,
      totalAFacturarUSD,
      totalAFacturarBs,
      diffUSD,
      diffBs,
      isExact,
      isUnderpaid,
      isOverpaid,
      vueltoUSD,
      vueltoBs,
      faltanteUSD,
      faltanteBs
    };
  }, [cobranzaForm.pagos, totals.netoCobrarUSD, totals.netoCobrarBs, exchangeRate]);

  // Proceder desde Cobranza al Asiento Contable con Check Estricto de Monto y Vuelto
  const handleConfirmCobranzaToVoucher = () => {
    const totalPagado = cobranzaCalculations.totalPagadoUSD;
    if (cobranzaForm.pagos.length === 0 || totalPagado <= 0) {
      showToast?.('Ingrese al menos un pago con monto válido en la cobranza', 'error');
      return;
    }

    // CHECK OBLIGATORIO: Validar cada pago registrado en el desglose
    for (let i = 0; i < cobranzaForm.pagos.length; i++) {
      const p = cobranzaForm.pagos[i];
      const pNum = i + 1;
      const montoUSD = Number(p.monto) || 0;
      const montoBs = Number(p.montoBs) || 0;

      if (montoUSD <= 0 && montoBs <= 0) {
        showToast?.(`Pago #${pNum}: Ingrese un monto válido mayor a 0`, 'error');
        return;
      }

      if (!p.bancoId && p.metodoPago !== 'Punto de Venta') {
        showToast?.(`Pago #${pNum}: Seleccione la cuenta bancaria o caja receptora`, 'error');
        return;
      }

      if (p.metodoPago === 'Punto de Venta' && !p.terminalId && terminalesPos.length > 0) {
        showToast?.(`Pago #${pNum}: Seleccione el punto de venta / terminal POS`, 'error');
        return;
      }

      if (p.metodoPago !== 'Efectivo' && (!p.referencia || !p.referencia.trim())) {
        showToast?.(`Pago #${pNum} (${p.metodoPago}): El número de referencia o comprobante es obligatorio para transacciones electrónicas`, 'error');
        return;
      }
    }

    // CHECK OBLIGATORIO: El monto debe ser igual o superior al facturado
    if (cobranzaCalculations.isUnderpaid) {
      showToast?.(
        `Monto cobrado insuficiente ($${totalPagado.toFixed(2)}). Falta por cobrar: $${cobranzaCalculations.faltanteUSD.toFixed(2)} (Bs. ${cobranzaCalculations.faltanteBs.toFixed(2)})`, 
        'error'
      );
      return;
    }

    if (cobranzaCalculations.isOverpaid) {
      showToast?.(
        `Cobro validado. Entregar VUELTO de $${cobranzaCalculations.vueltoUSD.toFixed(2)} (Bs. ${cobranzaCalculations.vueltoBs.toFixed(2)}) al cliente`,
        'success'
      );
    }

    setIsCobranzaModalOpen(false);
    buildAndShowVoucher('contado');
  };

  // =========================================================================
  // =========================================================================
  // PASO 3: Construir Asiento Contable y Mostrar Previsualización
  // =========================================================================
  const buildVoucher = (condition: 'contado' | 'credito') => {
    const mainTaxAccount = configContable?.cuentaDebitoFiscal || '2.1.02.001';

    // Helper para obtener código y nombre formal de una cuenta contable
    const getAccountInfo = (accountIdOrCode: string, fallbackName: string) => {
      const found = cuentasContables.find((c: any) => c.id === accountIdOrCode || c.codigo === accountIdOrCode);
      return {
        cuentaId: found?.codigo || accountIdOrCode,
        nombreCuenta: found?.nombre || fallbackName
      };
    };

    const linesVoucher: any[] = [];
    const netoAmount = totals.netoCobrarUSD;
    const isVes = currency === 'VES' && exchangeRate > 0;
    const factorToUSD = isVes ? (1 / exchangeRate) : 1;
    const voucherConcepto = `Registro de Factura de Venta ${invoiceNumber} a ${customerName} (${condition.toUpperCase()})`;

    // 1. DÉBITO: COBRANZA O CUENTAS POR COBRAR CLIENTES
    if (condition === 'credito') {
      // Si la facturación es a crédito, se va a la cuenta contable del contacto seleccionado
      const selectedContact = contactos.find(c => 
        (selectedCustomerId && c.id === selectedCustomerId) ||
        (customerRif && c.taxId?.trim().toLowerCase() === customerRif.trim().toLowerCase()) ||
        (customerName && c.name?.trim().toLowerCase() === customerName.trim().toLowerCase())
      );
      const rawCxcAccount = selectedContact?.debitAccount || configContable?.cuentaCxc || '1.1.02.001';
      const cxcInfo = getAccountInfo(rawCxcAccount, `Cuentas por Cobrar Clientes (${customerName || 'Nacional'})`);

      linesVoucher.push({
        id: `vl_cxc`,
        cuentaId: cxcInfo.cuentaId,
        nombreCuenta: cxcInfo.nombreCuenta,
        descripcion: voucherConcepto,
        debe: Number(netoAmount.toFixed(2)),
        haber: 0
      });
    } else {
      // Si es de contado, ingresa a la cuenta contable del banco seleccionado o terminal POS
      const totalPagadoMonto = cobranzaForm.pagos.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0);
      const scale = totalPagadoMonto > netoAmount && totalPagadoMonto > 0 ? (netoAmount / totalPagadoMonto) : 1;

      cobranzaForm.pagos.forEach((pago, pIdx) => {
        const isPos = pago.metodoPago === 'Punto de Venta';
        const bank = bancos.find(b => b.id === pago.bancoId);
        const term = terminalesPos.find(t => t.id === pago.terminalId);
        
        const rawAccountId = isPos
          ? (term?.cuenta_transitoria_id || '1.1.01.03')
          : (bank?.cuenta_contable_id || configContable?.cuentaBancos || '1.1.01.004');

        const fallbackName = isPos
          ? `Puntos de Venta por Liquidar (${term?.nombre || 'Tarjetas'})`
          : (bank ? `${bank.banco} (${bank.moneda})` : 'Efectivo en Bancos');

        const bnkInfo = getAccountInfo(rawAccountId, fallbackName);

        const rawMonto = parseFloat(pago.monto) || 0;
        // Si pagó de más, el asiento registra el valor neto recibido por la factura (ya que el vuelto fue devuelto al cliente)
        const pagoMonto = Number((rawMonto * scale).toFixed(2));

        linesVoucher.push({
          id: `vl_bnk_${pIdx}`,
          cuentaId: bnkInfo.cuentaId,
          nombreCuenta: bnkInfo.nombreCuenta,
          descripcion: voucherConcepto,
          debe: pagoMonto,
          haber: 0
        });
      });
    }

    // 2. DÉBITO: RETENCIONES FISCALES DEL CLIENTE (SI APLICAN)
    if (applyRetIva && totals.retIvaMontoUSD > 0) {
      const retIvaInfo = getAccountInfo(
        configContable?.cuentaRetencionIvaVentas || '1.1.02.003',
        `Anticipo IVA Retenido por Clientes (${retIvaPercent}%)`
      );
      linesVoucher.push({
        id: `vl_ret_iva`,
        cuentaId: retIvaInfo.cuentaId,
        nombreCuenta: retIvaInfo.nombreCuenta,
        descripcion: voucherConcepto,
        debe: Number(totals.retIvaMontoUSD.toFixed(2)),
        haber: 0
      });
    }

    if (applyRetIslr && totals.retIslrMontoUSD > 0) {
      const retIslrInfo = getAccountInfo(
        configContable?.cuentaRetencionIslrVentas || '1.1.02.004',
        `Anticipo ISLR Retenido por Clientes (${retIslrPercent}%)`
      );
      linesVoucher.push({
        id: `vl_ret_islr`,
        cuentaId: retIslrInfo.cuentaId,
        nombreCuenta: retIslrInfo.nombreCuenta,
        descripcion: voucherConcepto,
        debe: Number(totals.retIslrMontoUSD.toFixed(2)),
        haber: 0
      });
    }

    // 3. COSTO DE VENTA (DÉBITO) E INVENTARIO DE MERCANCÍA (CRÉDITO) AGRUPADO POR CUENTAS COMUNES
    const costGroups: { [cuentaId: string]: { totalCostUSD: number; accountName: string } } = {};
    const invGroups: { [cuentaId: string]: { totalCostUSD: number; accountName: string } } = {};

    items.forEach(it => {
      const prod = products.find(p => p.id === it.producto_id);
      const qty = typeof it.cantidad === 'number' ? it.cantidad : parseMoney(it.cantidad);
      const unitCost = Number(prod?.costo_unitario) || 0;
      const lineCostUSD = Number((qty * unitCost).toFixed(2));

      if (lineCostUSD > 0) {
        const rawCtaCosto = it.cuenta_costo_id || prod?.cuenta_costo_id || configContable?.cuentaCostoVentas || '5.1.01.001';
        const costInfo = getAccountInfo(rawCtaCosto, 'Costo de Ventas de Mercancías');

        const rawCtaInv = it.cuenta_inventario_id || prod?.cuenta_inventario_id || configContable?.cuentaInventario || '1.1.04.001';
        const invInfo = getAccountInfo(rawCtaInv, 'Inventario de Mercancías');

        if (!costGroups[costInfo.cuentaId]) {
          costGroups[costInfo.cuentaId] = { totalCostUSD: 0, accountName: costInfo.nombreCuenta };
        }
        costGroups[costInfo.cuentaId].totalCostUSD = Number((costGroups[costInfo.cuentaId].totalCostUSD + lineCostUSD).toFixed(2));

        if (!invGroups[invInfo.cuentaId]) {
          invGroups[invInfo.cuentaId] = { totalCostUSD: 0, accountName: invInfo.nombreCuenta };
        }
        invGroups[invInfo.cuentaId].totalCostUSD = Number((invGroups[invInfo.cuentaId].totalCostUSD + lineCostUSD).toFixed(2));
      }
    });

    // Débito: Costo de Ventas
    Object.entries(costGroups).forEach(([accId, group], idx) => {
      linesVoucher.push({
        id: `vl_costo_${idx}`,
        cuentaId: accId,
        nombreCuenta: group.accountName,
        descripcion: voucherConcepto,
        debe: group.totalCostUSD,
        haber: 0
      });
    });

    // Crédito: Inventario de Mercancía
    Object.entries(invGroups).forEach(([accId, group], idx) => {
      linesVoucher.push({
        id: `vl_inv_${idx}`,
        cuentaId: accId,
        nombreCuenta: group.accountName,
        descripcion: voucherConcepto,
        debe: 0,
        haber: group.totalCostUSD
      });
    });

    // 4. CRÉDITO: INGRESOS POR VENTAS AGRUPADOS POR CUENTAS COMUNES DE ARTÍCULOS
    const salesGroups: { [cuentaId: string]: { totalSubtotalUSD: number; accountName: string } } = {};

    items.forEach(it => {
      const prod = products.find(p => p.id === it.producto_id);
      const qty = typeof it.cantidad === 'number' ? it.cantidad : parseMoney(it.cantidad);
      const price = typeof it.precio_unitario === 'number' ? it.precio_unitario : parseMoney(it.precio_unitario);
      const lineSubUSD = Number(((qty * price) * factorToUSD).toFixed(2));

      const rawCtaVta = it.cuenta_ingreso_id || prod?.cuenta_ingreso_id || prod?.cuenta_venta_id || configContable?.cuentaVentas || '4.1.01.001';
      const vtaInfo = getAccountInfo(rawCtaVta, 'Ventas de Mercancías');

      if (!salesGroups[vtaInfo.cuentaId]) {
        salesGroups[vtaInfo.cuentaId] = { totalSubtotalUSD: 0, accountName: vtaInfo.nombreCuenta };
      }
      salesGroups[vtaInfo.cuentaId].totalSubtotalUSD = Number((salesGroups[vtaInfo.cuentaId].totalSubtotalUSD + lineSubUSD).toFixed(2));
    });

    // Ajuste por redondeo si la suma agrupada difiere por centavos respecto a totals.subtotalUSD
    const sumGroupedSales = Object.values(salesGroups).reduce((acc, g) => acc + g.totalSubtotalUSD, 0);
    const salesDiff = Number((totals.subtotalUSD - sumGroupedSales).toFixed(2));
    if (Math.abs(salesDiff) > 0 && Object.keys(salesGroups).length > 0) {
      const firstKey = Object.keys(salesGroups)[0];
      salesGroups[firstKey].totalSubtotalUSD = Number((salesGroups[firstKey].totalSubtotalUSD + salesDiff).toFixed(2));
    }

    Object.entries(salesGroups).forEach(([accId, group], idx) => {
      linesVoucher.push({
        id: `vl_vta_${idx}`,
        cuentaId: accId,
        nombreCuenta: group.accountName,
        descripcion: voucherConcepto,
        debe: 0,
        haber: group.totalSubtotalUSD
      });
    });

    // 5. CRÉDITO: IVA DÉBITO FISCAL
    if (totals.ivaMontoUSD > 0) {
      const ivaInfo = getAccountInfo(mainTaxAccount, 'IVA Débito Fiscal (16%)');
      linesVoucher.push({
        id: `vl_iva`,
        cuentaId: ivaInfo.cuentaId,
        nombreCuenta: ivaInfo.nombreCuenta,
        descripcion: voucherConcepto,
        debe: 0,
        haber: Number(totals.ivaMontoUSD.toFixed(2))
      });
    }

    // 6. CRÉDITO: IGTF PERCIBIDO POR PAGAR
    if (applyIgtf && totals.igtfMontoUSD > 0) {
      const igtfInfo = getAccountInfo(
        configContable?.cuentaIgtfPorPagar || '2.1.03.002',
        'IGTF Percibido por Pagar (3%)'
      );
      linesVoucher.push({
        id: `vl_igtf`,
        cuentaId: igtfInfo.cuentaId,
        nombreCuenta: igtfInfo.nombreCuenta,
        descripcion: voucherConcepto,
        debe: 0,
        haber: Number(totals.igtfMontoUSD.toFixed(2))
      });
    }

    // Calcular suma balanceada de débitos
    const sumDebits = linesVoucher.reduce((acc, l) => acc + (Number(l.debe) || 0), 0);
    const voucherTotal = Number(sumDebits.toFixed(2));

    const voucher = {
      id: crypto.randomUUID(),
      numero: `AS-FAC-${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
      fecha: issueDate,
      concepto: voucherConcepto,
      descripcion: voucherConcepto,
      total: voucherTotal,
      tipo: 'Diario',
      lineas: linesVoucher,
      estado: 'Contabilizado',
      modulo: 'facturacion'
    };

    setPendingVoucher(voucher);
    return voucher;
  };

  const buildAndShowVoucher = (condition: 'contado' | 'credito') => {
    const v = buildVoucher(condition);
    setIsVoucherModalOpen(true);
    return v;
  };

  // =========================================================================
  // PASO 4: Confirmación Final y Guardado Transaccional
  // =========================================================================
  const handleFinalSaveInvoice = async (voucherParam?: any) => {
    try {
      const factId = crypto.randomUUID();
      const cxcDocId = crypto.randomUUID();
      const currentVoucher = voucherParam || pendingVoucher;
      const voucherId = currentVoucher ? (isUUID(currentVoucher.id) ? currentVoucher.id : crypto.randomUUID()) : crypto.randomUUID();

      let effectiveCustomerId = selectedCustomerId;
      let existingContact = contactos.find(c => 
        (selectedCustomerId && c.id === selectedCustomerId) ||
        (customerRif && c.taxId?.trim().toLowerCase() === customerRif.trim().toLowerCase()) ||
        (customerName && c.name?.trim().toLowerCase() === customerName.trim().toLowerCase())
      );

      // Si el cliente no existe aún en la lista de contactos, crearlo automáticamente con cuentas contables NIIF
      if (!existingContact && customerName.trim()) {
        const newContactId = crypto.randomUUID();
        const newContact = {
          id: newContactId,
          name: customerName.trim(),
          isCompany: !customerRif.toUpperCase().startsWith('V'),
          taxId: customerRif.trim() || 'J-00000000-0',
          email: customerEmail.trim(),
          phone: customerPhone.trim(),
          address: customerAddress.trim(),
          type: 'customer',
          debitAccount: configContable?.cuentaCxc || '1.1.02.001',
          creditAccount: configContable?.cuentaAnticipoRecibido || '2.1.01.002',
          created_at: new Date().toISOString()
        };
        await onSave?.('contactos', newContact);
        effectiveCustomerId = newContactId;
        existingContact = newContact;
      } else if (existingContact) {
        if (!isUUID(existingContact.id)) {
          const updatedContact = { ...existingContact, id: crypto.randomUUID() };
          await onSave?.('contactos', updatedContact);
          effectiveCustomerId = updatedContact.id;
          existingContact = updatedContact;
        } else {
          effectiveCustomerId = existingContact.id;
        }
      }

      // Preparar items de la factura: base en USD y valores equivalentes en Bolívares
      const isVes = currency === 'VES' && exchangeRate > 0;
      const itemsToSave: FacturaItemModel[] = items.map(item => {
        const rawQty = typeof item.cantidad === 'number' ? item.cantidad : parseMoney(item.cantidad);
        const rawUnitPrice = typeof item.precio_unitario === 'number' ? item.precio_unitario : parseMoney(item.precio_unitario);
        const unitPriceUSD = isVes ? (rawUnitPrice / exchangeRate) : rawUnitPrice;
        const unitPriceBs = isVes ? rawUnitPrice : (rawUnitPrice * exchangeRate);

        const rawSubtotal = typeof item.subtotal === 'number' ? item.subtotal : (rawQty * rawUnitPrice);
        const subtotalUSD = isVes ? (rawSubtotal / exchangeRate) : rawSubtotal;
        const subtotalBs = isVes ? rawSubtotal : (rawSubtotal * exchangeRate);

        const rawIva = typeof item.iva_monto === 'number' ? item.iva_monto : (item.exento ? 0 : rawSubtotal * 0.16);
        const ivaUSD = isVes ? (rawIva / exchangeRate) : rawIva;
        const ivaBs = isVes ? rawIva : (rawIva * exchangeRate);

        const rawTotal = typeof item.total === 'number' ? item.total : (rawSubtotal + rawIva);
        const totalUSD = isVes ? (rawTotal / exchangeRate) : rawTotal;
        const totalBs = isVes ? rawTotal : (rawTotal * exchangeRate);

        return {
          ...item,
          cantidad: rawQty,
          precio_unitario: Number(unitPriceUSD.toFixed(2)),
          subtotal: Number(subtotalUSD.toFixed(2)),
          iva_monto: Number(ivaUSD.toFixed(2)),
          total: Number(totalUSD.toFixed(2)),
          precio_unitario_bs: Number(unitPriceBs.toFixed(2)),
          subtotal_bs: Number(subtotalBs.toFixed(2)),
          iva_monto_bs: Number(ivaBs.toFixed(2)),
          total_bs: Number(totalBs.toFixed(2))
        };
      });

      // Asignar correlativo atómico con bloqueo pesimista en PostgreSQL para evitar colisiones
      let finalInvoiceNumber = invoiceNumber.trim().toUpperCase();
      let atomicResult: any = null;
      if (currentCompanyId) {
        try {
          atomicResult = await dbObtenerSiguienteCorrelativo(currentCompanyId, docType);
          if (atomicResult && atomicResult.numero_formateado) {
            finalInvoiceNumber = atomicResult.numero_formateado;
          }
        } catch (e) {
          console.warn("Error obteniendo correlativo atómico, usando preasignado:", e);
        }
      }

      // 1. Guardar Asiento Contable PRIMERO para que su UUID exista en base de datos antes de que la factura lo referencie
      if (currentVoucher) {
        const voucherToSave = {
          ...currentVoucher,
          id: voucherId,
          numero: `AS-FAC-${finalInvoiceNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
          referencia: finalInvoiceNumber,
          descripcion: currentVoucher.concepto || currentVoucher.descripcion || `Registro de Factura de Venta ${finalInvoiceNumber}`
        };
        await onSave?.('comprobantes', voucherToSave);
      }

      // 2. Guardar la Factura (La moneda principal siempre es USD, con moneda de presentación)
      const newFactura: FacturaVentaModel = {
        id: factId,
        empresa_id: currentCompanyId,
        numero: finalInvoiceNumber,
        control_numero: controlNumber.trim(),
        tipo_documento: docType,
        condicion: selectedCondition,
        dias_credito: selectedCondition === 'credito' ? creditDays : 0,
        cliente_id: effectiveCustomerId || selectedCustomerId || crypto.randomUUID(),
        cliente_nombre: customerName.trim(),
        cliente_rif: customerRif.trim(),
        cliente_direccion: customerAddress.trim(),
        cliente_telefono: customerPhone.trim(),
        cliente_email: customerEmail.trim(),
        fecha_emision: issueDate,
        fecha_vencimiento: selectedCondition === 'credito' ? calculatedDueDate : issueDate,
        moneda: 'USD',
        moneda_presentacion: currency,
        tasa_cambio: exchangeRate,
        items: itemsToSave,
        subtotal: Number(totals.subtotalUSD.toFixed(2)),
        base_imponible: Number(totals.baseImponibleUSD.toFixed(2)),
        monto_exento: Number(totals.montoExentoUSD.toFixed(2)),
        iva_porcentaje: 16,
        iva_monto: Number(totals.ivaMontoUSD.toFixed(2)),
        igtf_porcentaje: applyIgtf ? igtfPercent : 0,
        igtf_monto: Number(totals.igtfMontoUSD.toFixed(2)),
        retencion_iva_porcentaje: applyRetIva ? retIvaPercent : 0,
        retencion_iva_monto: Number(totals.retIvaMontoUSD.toFixed(2)),
        comprobante_retencion_iva_numero: applyRetIva ? retIvaNumero.trim() : undefined,
        comprobante_retencion_iva_fecha: applyRetIva ? retIvaFecha : undefined,
        retencion_islr_porcentaje: applyRetIslr ? retIslrPercent : 0,
        retencion_islr_monto: Number(totals.retIslrMontoUSD.toFixed(2)),
        comprobante_retencion_islr_numero: applyRetIslr ? retIslrNumero.trim() : undefined,
        comprobante_retencion_islr_fecha: applyRetIslr ? retIslrFecha : undefined,
        neto_cobrar: Number(totals.netoCobrarUSD.toFixed(2)),
        total: Number(totals.totalUSD.toFixed(2)),
        saldo_pendiente: selectedCondition === 'credito' ? Number(totals.netoCobrarUSD.toFixed(2)) : 0,
        subtotal_bs: Number(totals.subtotalBs.toFixed(2)),
        base_imponible_bs: Number(totals.baseImponibleBs.toFixed(2)),
        monto_exento_bs: Number(totals.montoExentoBs.toFixed(2)),
        iva_monto_bs: Number(totals.ivaMontoBs.toFixed(2)),
        igtf_monto_bs: Number(totals.igtfMontoBs.toFixed(2)),
        retencion_iva_monto_bs: Number(totals.retIvaMontoBs.toFixed(2)),
        retencion_islr_monto_bs: Number(totals.retIslrMontoBs.toFixed(2)),
        neto_cobrar_bs: Number(totals.netoCobrarBs.toFixed(2)),
        total_bs: Number(totals.totalBs.toFixed(2)),
        saldo_pendiente_bs: selectedCondition === 'credito' ? Number(totals.netoCobrarBs.toFixed(2)) : 0,
        estado: selectedCondition === 'credito' ? 'emitida' : 'cobrada',
        banco_id: selectedCondition === 'contado' && cobranzaForm.pagos.length > 0 ? cobranzaForm.pagos[0].bancoId : undefined,
        comprobante_id: voucherId,
        cxc_id: selectedCondition === 'credito' ? cxcDocId : undefined,
        monto_recibido: selectedCondition === 'contado' ? Number(cobranzaCalculations.totalPagadoUSD.toFixed(2)) : undefined,
        monto_recibido_bs: selectedCondition === 'contado' ? Number(cobranzaCalculations.totalPagadoBs.toFixed(2)) : undefined,
        vuelto: selectedCondition === 'contado' && cobranzaCalculations.vueltoUSD > 0 ? Number(cobranzaCalculations.vueltoUSD.toFixed(2)) : 0,
        vuelto_bs: selectedCondition === 'contado' && cobranzaCalculations.vueltoBs > 0 ? Number(cobranzaCalculations.vueltoBs.toFixed(2)) : 0,
        notas: notes.trim(),
        created_at: new Date().toISOString()
      };

      await onSave?.('facturasVenta', newFactura);

      // 2. Descontar Stock de Inventario y Registrar Kardex de Forma Atómica (Bloqueo Pesimista FOR UPDATE en Postgres)
      const batchStockItems = items
        .filter(it => it.producto_id)
        .map(it => {
          const originalProd = products.find(p => p.id === it.producto_id);
          const cantFacturada = typeof it.cantidad === 'number' ? it.cantidad : parseMoney(it.cantidad);
          return {
            producto_id: it.producto_id!,
            cantidad: cantFacturada,
            costo_unitario: originalProd?.costo_unitario || 0,
            almacen_origen_id: isUUID(originalProd?.almacen_id) ? originalProd?.almacen_id : null
          };
        });

      if (batchStockItems.length > 0 && currentCompanyId) {
        await dbActualizarStockLoteAtomico(
          currentCompanyId,
          batchStockItems,
          'venta',
          {
            referencia: `Venta Factura ${newFactura.numero}`,
            usuario: 'Vendedor',
            permitirNegativo: true // Ya validado con clave maestra si correspondía
          }
        );

        // Actualizar el estado visual del cliente en memoria React sin sobreescribir la fila completa en Supabase
        for (const bItem of batchStockItems) {
          const originalProd = products.find(p => p.id === bItem.producto_id);
          if (originalProd) {
            const currentStock = Number(originalProd.stock_actual) || 0;
            const newStock = currentStock - bItem.cantidad;
            onSave?.('products', {
              ...originalProd,
              stock_actual: newStock,
              _localOnly: true
            });
          }
        }
      }

      // 3. Crear CxC asociada al cliente (Moneda base: USD) para crédito y contado (con saldo 0 si es de contado)
      const montoCxCUSD = Number(totals.netoCobrarUSD.toFixed(2));
      const montoCxCBs = Number(totals.netoCobrarBs.toFixed(2));
      const isContadoVenta = selectedCondition === 'contado';

      const cxcPayload = {
        id: cxcDocId,
        empresa_id: currentCompanyId,
        factura_id: factId,
        factura: newFactura.numero,
        numero: newFactura.numero,
        factura_db_id: factId,
        cliente_id: effectiveCustomerId || newFactura.cliente_id,
        cliente: newFactura.cliente_nombre,
        cliente_nombre: newFactura.cliente_nombre,
        cliente_rif: newFactura.cliente_rif,
        taxId: newFactura.cliente_rif,
        categoria: 'clientes',
        condicion: selectedCondition,
        fecha: issueDate,
        fecha_emision: issueDate,
        vencimiento: isContadoVenta ? issueDate : (calculatedDueDate || issueDate),
        fecha_vencimiento: isContadoVenta ? issueDate : (calculatedDueDate || issueDate),
        descripcion: `Factura de Venta ${newFactura.numero} - Cliente: ${newFactura.cliente_nombre} [${newFactura.cliente_rif}]`,
        tipo: 'factura',
        total: montoCxCUSD,
        monto: montoCxCUSD,
        monto_total: montoCxCUSD,
        saldo: isContadoVenta ? 0 : montoCxCUSD,
        saldo_pendiente: isContadoVenta ? 0 : montoCxCUSD,
        monto_bs: montoCxCBs,
        saldo_bs: isContadoVenta ? 0 : montoCxCBs,
        moneda: 'USD',
        tasa: exchangeRate,
        tasa_cambio: exchangeRate,
        estado: isContadoVenta ? 'pagada' : 'pendiente',
        metadata: {
          factura_id: newFactura.id,
          factura_numero: newFactura.numero,
          control_numero: newFactura.control_numero,
          moneda: 'USD',
          moneda_presentacion: currency,
          tasa_cambio: exchangeRate,
          cliente_rif: newFactura.cliente_rif,
          monto_original: montoCxCUSD,
          monto_bs: montoCxCBs,
          monto_usd: montoCxCUSD
        },
        created_at: new Date().toISOString()
      };

      await onSave?.('cxc', cxcPayload);

      // 4. Registrar Cobranza y Movimiento Bancario o Lote POS si fue de Contado
      if (selectedCondition === 'contado') {
        for (const pago of cobranzaForm.pagos) {
          const isPos = pago.metodoPago === 'Punto de Venta';
          const pagoMontoNum = parseFloat(pago.monto) || totals.netoCobrarUSD;
          const pagoMontoBsNum = parseFloat(pago.montoBs) || totals.netoCobrarBs;

          if (isPos) {
            // Acumular atómicamente en el Lote del Terminal POS (Bloqueo Pesimista FOR UPDATE)
            const termId = pago.terminalId || (terminalesPos.length > 0 ? terminalesPos[0].id : 'pos_term_1');
            const termObj = terminalesPos.find(t => t.id === termId);
            const bancoEfectivo = termObj ? termObj.banco_id : (bancos.length > 0 ? bancos[0].id : '');

            try {
              const newTx: LotePosTransaccion = {
                id: crypto.randomUUID(),
                factura_id: newFactura.id,
                factura_numero: newFactura.numero,
                cliente_nombre: customerName,
                referencia: pago.referencia || 'VOUCHER',
                monto_bs: pagoMontoBsNum,
                monto_usd: pagoMontoNum,
                hora: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
                fecha: issueDate
              };

              await dbAcumularTransaccionLotePosAtomico(
                currentCompanyId,
                termId,
                newTx,
                pagoMontoBsNum,
                pagoMontoNum
              );

              await onSave?.('cobranzas', {
                id: crypto.randomUUID(),
                reciboNumero: pago.referencia || newFactura.numero,
                clienteId: effectiveCustomerId || newFactura.cliente_id,
                clienteNombre: customerName,
                fecha: issueDate,
                montoTotal: pagoMontoNum,
                bancoId: bancoEfectivo,
                comprobanteId: voucherId,
                retencionIva: totals.retIvaMontoUSD,
                retencionIslr: totals.retIslrMontoUSD,
                diferencialCambiario: 0,
                detalles: [{ docId: factId, monto: pagoMontoNum, numDoc: newFactura.numero }],
                notas: `Cobranza POS - Factura ${newFactura.numero}`,
                estado: 'activo'
              });
            } catch (err) {
              console.error("Error acumulando atómicamente en lote POS:", err);
            }
          } else {
            const bank = bancos.find(b => b.id === pago.bancoId) || (pago.metodoPago === 'efectivo' || pago.metodoPago === 'Efectivo' ? bancos.find(b => b.es_caja || (b.tipo || '').toLowerCase().includes('caja')) : null) || (bancos && bancos.length > 0 ? bancos[0] : null);
            if (bank) {
              const movId = crypto.randomUUID();
              await onSave?.('movimientosBancos', {
                id: movId,
                banco_id: bank.id,
                fecha: issueDate,
                ref: pago.referencia || newFactura.numero,
                descripcion: `Ingreso Cobranza Factura ${newFactura.numero} (${customerName}) - ${pago.metodoPago}`,
                tipo: 'ingreso',
                monto: pagoMontoNum,
                montoBs: pagoMontoBsNum,
                tasa: exchangeRate,
                estado: 'conciliado',
                comprobante_id: voucherId,
                created_at: new Date().toISOString()
              });
              
              await onSave?.('cobranzas', {
                id: crypto.randomUUID(),
                reciboNumero: pago.referencia || newFactura.numero,
                clienteId: effectiveCustomerId || newFactura.cliente_id,
                clienteNombre: customerName,
                fecha: issueDate,
                montoTotal: pagoMontoNum,
                bancoId: bank.id,
                comprobanteId: voucherId,
                retencionIva: totals.retIvaMontoUSD,
                retencionIslr: totals.retIslrMontoUSD,
                diferencialCambiario: 0,
                detalles: [{ docId: factId, monto: pagoMontoNum, numDoc: newFactura.numero }],
                notas: `Cobranza de contado - Factura ${newFactura.numero}`,
                estado: 'activo'
              });
            }
          }
        }
      }

      // 5. Incrementar / sincronizar correlativo
      let nextCorrelativo = '000002';
      if (configContable) {
        const assignedNext = atomicResult?.siguiente_correlativo_str;
        if (docType === 'nota_entrega') {
          nextCorrelativo = assignedNext || getNextCorrelativo(configContable.correlativoNotaEntrega, 6);
          await onSave?.('configContable', {
            ...configContable,
            correlativoNotaEntrega: nextCorrelativo
          });
        } else if (docType === 'factura') {
          nextCorrelativo = assignedNext || getNextCorrelativo(configContable.correlativoFactura, 6);
          await onSave?.('configContable', {
            ...configContable,
            correlativoFactura: nextCorrelativo
          });
        }
      }

      showToast?.(`Factura ${newFactura.numero} emitida exitosamente (${selectedCondition.toUpperCase()})`, 'success');
      setIsVoucherModalOpen(false);

      // Guardar última factura emitida para permitir impresión o consulta
      setLastEmittedInvoice(newFactura);

      // Preparar automáticamente la siguiente factura continua
      let prefix = '';
      if (docType === 'nota_credito') {
        prefix = 'NC-';
      } else if (docType === 'nota_debito') {
        prefix = 'ND-';
      } else if (docType === 'nota_entrega') {
        prefix = configContable?.prefijoNotaEntrega ?? '';
      } else {
        prefix = configContable?.prefijoFactura ?? '';
      }
      setInvoiceNumber(formatDocumentNumber(prefix, nextCorrelativo, 6));
      setControlNumber(`00-${Math.floor(100000 + Math.random() * 900000)}`);

      // Limpiar cliente y campos para la próxima factura
      setSelectedCustomerId('');
      setCustomerName('');
      setCustomerRif('');
      setCustomerAddress('');
      setCustomerPhone('');
      setCustomerEmail('');

      setItems([{
        id: `item_${Date.now()}_1`,
        producto_id: '',
        codigo: '',
        descripcion: '',
        cantidad: 1,
        precio_unitario: 0,
        exento: false,
        subtotal: 0,
        iva_monto: 0,
        total: 0,
        cuenta_ingreso_id: '4.1.01.001',
        cuenta_costo_id: '5.1.01.001',
        cuenta_inventario_id: '1.1.04.001'
      }]);
      setNotes('');
      setApplyRetIva(false);
      setRetIvaNumero('');
      setRetIvaFecha(getTodayLocalDate());
      setApplyRetIslr(false);
      setRetIslrNumero('');
      setRetIslrFecha(getTodayLocalDate());
      setApplyIgtf(false);
      setIsZeroStockAuthorized(false);
    } catch (err: any) {
      console.error("Error guardando factura:", err);
      showToast?.('Error al emitir la factura', 'error');
    }
  };

  return (
    <div className={isModal ? "fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200" : "h-screen w-full max-h-screen overflow-hidden flex flex-col p-2.5 gap-2 bg-slate-100 text-slate-800 select-none"}>
      <div className={isModal ? "bg-slate-50 w-full max-w-[1600px] h-[96vh] rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-300 p-3 flex flex-col overflow-hidden gap-2" : "w-full h-full flex flex-col overflow-hidden gap-2"}>
        {isModal && (
          <button type="button" onClick={onClose} className="absolute top-4 right-4 bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition cursor-pointer z-[450] shadow-sm">
            <X size={20} />
          </button>
        )}
      
      {/* ========================================================================= */}
      {/* AVISO DE FACTURA EMITIDA EXITOSAMENTE (MODO CONTINUO) */}
      {/* ========================================================================= */}
      {lastEmittedInvoice && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 flex items-center justify-between gap-3 text-emerald-950 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-black text-xs text-emerald-950">
                  ¡Factura {lastEmittedInvoice.numero} emitida exitosamente!
                </h4>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                  {lastEmittedInvoice.condicion?.toUpperCase()}
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-800">
                  Total: ${Number(lastEmittedInvoice.total || 0).toFixed(2)} (Bs. {Number(lastEmittedInvoice.total_bs || 0).toFixed(2)})
                </span>
              </div>
              <p className="text-[11px] text-emerald-800">
                Comprobante e inventario actualizados. Formulario reiniciado y listo para ({invoiceNumber}).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={12} />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={() => setLastEmittedInvoice(null)}
              className="px-2.5 py-1 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <span>✕</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. BARRA SUPERIOR ERP (COMMAND TOOLBAR) */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 text-white px-3 sm:px-4 py-1.5 rounded-xl shadow-xs border border-slate-800 flex items-center justify-between gap-3 shrink-0 h-11">
        {/* Izquierda: Volver, Tipo Documento, Número y Conmutador de Moneda */}
        <div className="flex items-center gap-2 flex-wrap">
          <BackButton
            to="/invoicing"
            label="Listado"
            onClick={() => {
              if (window.opener && window.history.length <= 1) {
                window.close();
              } else {
                navigate('/invoicing');
              }
            }}
            className="!py-1 !px-2.5 !text-xs !rounded-lg"
          />

          {/* Selector Tipo de Documento */}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <FileText size={13} />
            </div>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as any)}
              className="bg-slate-800 text-white font-black text-xs px-2.5 py-1 rounded-lg border border-slate-700 outline-none cursor-pointer hover:border-indigo-500 transition"
            >
              <option value="factura">FACTURA DE VENTA</option>
              <option value="nota_entrega">NOTA DE ENTREGA</option>
              <option value="nota_credito">NOTA DE CRÉDITO</option>
              <option value="nota_debito">NOTA DE DÉBITO</option>
            </select>
          </div>

          {/* Badge Número Correlativo */}
          <span className="font-mono text-xs font-black text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-800/70">
            N° {invoiceNumber || '---'}
          </span>

          {/* Conmutador Multimoneda USD vs VES */}
          <div className="inline-flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => handleCurrencyChange('USD')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-black transition cursor-pointer ${
                currency === 'USD' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => handleCurrencyChange('VES')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-black transition cursor-pointer ${
                currency === 'VES' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Bs. (VES)
            </button>
          </div>

          {/* Tasa Oficial BCV con sincronización en vivo */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-0.5 rounded-lg border border-slate-700 text-[11px]">
            <span className="text-slate-400 font-medium">Tasa BCV:</span>
            <span className="font-mono font-black text-emerald-400">Bs. {exchangeRate.toFixed(2)}</span>
            <button
              type="button"
              onClick={handleSyncLiveBcv}
              disabled={isSyncingBcvLive}
              title="Sincronizar tasa oficial en vivo desde el BCV"
              className="text-slate-400 hover:text-emerald-400 p-0.5 rounded transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={11} className={isSyncingBcvLive ? 'animate-spin text-emerald-400' : ''} />
            </button>
            <button
              type="button"
              onClick={() => setIsTasaModalOpen(true)}
              className="text-[10px] text-slate-400 hover:text-white font-bold ml-1 cursor-pointer"
              title="Histórico de tasas oficiales"
            >
              <Coins size={11} />
            </button>
          </div>
        </div>

        {/* Derecha: Botones de Acción Rápida ERP */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => buildAndShowVoucher(selectedCondition)}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Previsualizar el Asiento Contable que generará esta factura"
          >
            <BookOpen size={13} className="text-indigo-400" />
            <span className="hidden sm:inline">Previsualizar Asiento</span>
          </button>
          <button
            type="button"
            onClick={handleResetForm}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
            title="Limpiar formulario y reiniciar documento"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
          <button
            type="submit"
            form="invoice-main-form"
            className="px-3.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <Save size={13} />
            <span>EMITIR FACTURA (F2)</span>
          </button>
        </div>
      </div>

      <form id="invoice-main-form" onSubmit={handleStartEmission} className="flex-1 min-h-0 flex gap-2.5 overflow-hidden">
        
        {/* COLUMNA IZQUIERDA: DATOS, CLIENTE, CONDICION, LIQUIDACION Y OBSERVACIONES */}
        <div className="w-[490px] xl:w-[530px] 2xl:w-[560px] flex flex-col gap-2 shrink-0 h-full overflow-y-auto pr-1 select-none">
          
          {/* 1. DATOS DEL DOCUMENTO */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="font-black text-slate-700 text-[10px] uppercase tracking-wider flex items-center gap-1">
                <FileText size={12} className="text-indigo-600" />
                Datos del Documento
              </span>
              <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">SENIAT</span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-0.5">
              <div>
                <label className="block text-slate-500 font-bold text-[9px] uppercase mb-0.5">N° Factura *</label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-mono font-bold text-indigo-700 focus:border-indigo-600 outline-none uppercase text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-bold text-[9px] uppercase mb-0.5">N° Control</label>
                <input
                  type="text"
                  placeholder="00-000000"
                  value={controlNumber}
                  onChange={(e) => setControlNumber(e.target.value)}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-mono font-semibold text-slate-700 focus:border-indigo-600 outline-none text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-bold text-[9px] uppercase mb-0.5">Fecha Emisión</label>
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:border-indigo-600 outline-none text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-bold text-[9px] uppercase mb-0.5">Tasa BCV (Bs./$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={exchangeRateInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^[0-9]*[.,]?[0-9]*$/.test(val)) setExchangeRateInput(val);
                  }}
                  onBlur={() => {
                    if (!exchangeRateInput.trim() || parseFloat(exchangeRateInput.replace(',', '.')) <= 0) {
                      setExchangeRateInput('1.00');
                    }
                  }}
                  className="w-full px-1.5 py-1 bg-emerald-50 border border-emerald-300 rounded-lg font-mono font-black text-emerald-800 text-xs text-right focus:border-emerald-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. CLIENTE / FACTURADO A */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="font-black text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <User size={13} className="text-indigo-600" />
                Cliente / Facturado A:
              </span>
              <div className="flex items-center gap-1.5">
                {selectedCustomerId ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 px-2 py-0.5 rounded hover:bg-indigo-50 transition cursor-pointer"
                      title="Cambiar cliente"
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={handleClearCustomer}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-700 px-2 py-0.5 rounded hover:bg-rose-50 transition cursor-pointer"
                      title="Desvincular cliente"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <Search size={10} /> Buscar
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenNewCustomerModal}
                      className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <Plus size={10} /> Nuevo
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2 pt-0.5">
              <div className="col-span-4">
                <label className="block text-slate-500 font-bold text-[10px] uppercase mb-1">RIF / Cédula *</label>
                <input
                  type="text"
                  required
                  readOnly={Boolean(selectedCustomerId)}
                  placeholder="J-12345678-9"
                  value={customerRif}
                  onChange={(e) => setCustomerRif(e.target.value.toUpperCase())}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition ${
                    selectedCustomerId
                      ? 'bg-slate-100 border border-slate-200 text-slate-700 cursor-not-allowed'
                      : 'bg-white border border-slate-200 text-slate-900 focus:border-indigo-600 outline-none'
                  }`}
                />
              </div>
              <div className="col-span-8">
                <label className="block text-slate-500 font-bold text-[10px] uppercase mb-1">Razón Social / Nombre *</label>
                <input
                  type="text"
                  required
                  readOnly={Boolean(selectedCustomerId)}
                  placeholder="Nombre o empresa del cliente"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-lg text-xs font-bold transition truncate ${
                    selectedCustomerId
                      ? 'bg-slate-100 border border-slate-200 text-slate-800 cursor-not-allowed'
                      : 'bg-white border border-slate-200 text-slate-900 focus:border-indigo-600 outline-none'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-4">
                <label className="block text-slate-500 font-bold text-[9px] uppercase mb-1">Teléfono</label>
                <input
                  type="text"
                  readOnly={Boolean(selectedCustomerId)}
                  placeholder="+58 414 0000000"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs transition ${
                    selectedCustomerId
                      ? 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed'
                      : 'bg-white border border-slate-200 text-slate-700 focus:border-indigo-600 outline-none'
                  }`}
                />
              </div>
              <div className="col-span-8">
                <label className="block text-slate-500 font-bold text-[9px] uppercase mb-1">Dirección Fiscal</label>
                <input
                  type="text"
                  readOnly={Boolean(selectedCustomerId)}
                  placeholder="Dirección fiscal del cliente"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs transition truncate ${
                    selectedCustomerId
                      ? 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed'
                      : 'bg-white border border-slate-200 text-slate-700 focus:border-indigo-600 outline-none'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* 3. CONDICIÓN DE PAGO & RETENCIONES (GRID 2 COLUMNAS) */}
          <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs">
            <div className="grid grid-cols-2 gap-2">
              {/* Left: CONDICIÓN DE PAGO */}
              <div className="border-r border-slate-100 pr-2 space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-black text-slate-700 text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <CreditCard size={11} className="text-indigo-600" />
                    Condición de Pago
                  </span>
                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                    selectedCondition === 'contado' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {selectedCondition.toUpperCase()}
                  </span>
                </div>

                {/* Selector Contado vs Crédito */}
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSelectedCondition('contado')}
                    className={`py-1 text-xs font-black rounded-md transition cursor-pointer ${
                      selectedCondition === 'contado'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Contado
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCondition('credito')}
                    className={`py-1 text-xs font-black rounded-md transition cursor-pointer ${
                      selectedCondition === 'credito'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Crédito
                  </button>
                </div>

                {selectedCondition === 'credito' ? (
                  <div className="space-y-1 pt-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Días Crédito:</span>
                      <div className="flex items-center gap-1">
                        {[15, 30, 45].map(d => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setCreditDays(d)}
                            className={`px-1 py-0.5 rounded text-[9px] font-bold transition cursor-pointer ${
                              creditDays === d ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                            }`}
                          >
                            {d}d
                          </button>
                        ))}
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={creditDays}
                          onChange={(e) => setCreditDays(Math.max(1, parseInt(e.target.value || '1', 10)))}
                          className="w-9 px-1 py-0.5 bg-white border border-slate-200 rounded text-center text-[10px] font-bold"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] bg-indigo-50/70 p-1 rounded-lg border border-indigo-100 font-bold">
                      <span className="text-indigo-800">Vencimiento:</span>
                      <span className="font-mono text-indigo-950">{formatDate(calculatedDueDate)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="p-1.5 bg-emerald-50/80 border border-emerald-100 rounded-lg text-emerald-800 text-[10px] font-semibold space-y-0.5">
                      <div className="flex items-center gap-1 text-emerald-900 font-bold text-[9px] uppercase">
                        <CheckCircle2 size={11} className="text-emerald-600" />
                        <span>Cobro Inmediato</span>
                      </div>
                      <p className="text-[9px] text-emerald-700 leading-tight">
                        Al emitir se registrará el ingreso bancario o por caja/POS correspondiente.
                      </p>
                    </div>

                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-lg">
                      <span className="text-[9px] text-slate-600 font-semibold truncate">Desglose de Formas de Pago</span>
                      <button
                        type="button"
                        onClick={() => handleSelectCondition('contado')}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-bold transition cursor-pointer shrink-0"
                      >
                        Configurar Pagos
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right: RETENCIONES FISCALES & IGTF */}
              <div className="pl-1 space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-0.5">
                  <span className="font-black text-slate-700 text-[10px] uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck size={11} className="text-amber-600" />
                    Retenciones Fiscales & IGTF (SENIAT)
                  </span>
                </div>

                <div className="space-y-1 pt-0.5">
                  {/* Retención ISLR */}
                  <div className={`p-1.5 rounded-lg border transition ${
                    applyRetIslr ? 'bg-indigo-50/80 border-indigo-200' : 'bg-slate-50/60 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between gap-1">
                      <label className="flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer select-none text-[11px]">
                        <input
                          type="checkbox"
                          checked={applyRetIslr}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setApplyRetIslr(checked);
                            if (checked && !retIslrNumero) {
                              setIsRetencionModalOpen(true);
                            }
                          }}
                          className="rounded text-indigo-600 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>Ret. ISLR</span>
                      </label>

                      {applyRetIslr ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={retIslrPercent}
                            onChange={(e) => setRetIslrPercent(parseFloat(e.target.value))}
                            className="bg-white border border-indigo-200 rounded px-1 py-0.5 text-[9px] font-bold text-slate-800 outline-none"
                          >
                            <option value={1}>1%</option>
                            <option value={2}>2%</option>
                            <option value={3}>3%</option>
                            <option value={5}>5%</option>
                          </select>
                          <span className="font-mono font-bold text-indigo-800 text-[10px]">
                            -{formatMoney(totals.retIslrMonto, currency)}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {applyRetIslr && (
                      <div className="mt-1 pt-1 border-t border-indigo-200/60 flex items-center justify-between text-[9px]">
                        <span className="text-slate-600 font-medium truncate max-w-[150px]">
                          {retIslrNumero ? `N° ${retIslrNumero}` : 'Sin comprobante'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsRetencionModalOpen(true)}
                          className="text-indigo-700 hover:text-indigo-900 font-black underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Settings size={10} />
                          <span>{retIslrNumero ? 'Editar' : 'Comprobante'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Retención IVA */}
                  <div className={`p-1.5 rounded-lg border transition ${
                    applyRetIva ? 'bg-amber-50/80 border-amber-200' : 'bg-slate-50/60 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between gap-1">
                      <label className="flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer select-none text-[11px]">
                        <input
                          type="checkbox"
                          checked={applyRetIva}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setApplyRetIva(checked);
                            if (checked && !retIvaNumero) {
                              setIsRetencionModalOpen(true);
                            }
                          }}
                          className="rounded text-amber-600 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>Ret. IVA</span>
                      </label>

                      {applyRetIva ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={retIvaPercent}
                            onChange={(e) => setRetIvaPercent(parseInt(e.target.value, 10))}
                            className="bg-white border border-amber-200 rounded px-1 py-0.5 text-[9px] font-bold text-slate-800 outline-none"
                          >
                            <option value={75}>75%</option>
                            <option value={100}>100%</option>
                          </select>
                          <span className="font-mono font-bold text-amber-800 text-[10px]">
                            -{formatMoney(totals.retIvaMonto, currency)}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {applyRetIva && (
                      <div className="mt-1 pt-1 border-t border-amber-200/60 flex items-center justify-between text-[9px]">
                        <span className="text-slate-600 font-medium truncate max-w-[150px]">
                          {retIvaNumero ? `N° ${retIvaNumero}` : 'Sin comprobante'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsRetencionModalOpen(true)}
                          className="text-amber-700 hover:text-amber-900 font-black underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Settings size={10} />
                          <span>{retIvaNumero ? 'Editar' : 'Comprobante'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* IGTF Divisas 3% */}
                  <div className={`p-1.5 rounded-lg border transition ${
                    applyIgtf ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50/60 border-slate-200'
                  }`}>
                    <label className="flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer select-none text-[11px]">
                      <input
                        type="checkbox"
                        checked={applyIgtf}
                        onChange={(e) => setApplyIgtf(e.target.checked)}
                        className="rounded text-emerald-600 w-3 h-3 cursor-pointer"
                      />
                      <span>IGTF Divisas (3%)</span>
                    </label>
                    {applyIgtf && (
                      <div className="mt-1 pt-1 border-t border-emerald-200/80 flex items-center justify-between">
                        <span className="text-[9px] text-emerald-700 font-bold">Ley IGTF</span>
                        <span className="font-mono font-bold text-emerald-800 text-[10px]">
                          +{formatMoney(totals.igtfMonto, currency)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. LIQUIDACIÓN FISCAL MULTIMONEDA (MÁS GRANDE Y DESTACADA) */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex-1 flex flex-col justify-between min-h-0 space-y-2">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
                <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Coins size={14} className="text-indigo-600" />
                  Liquidación Fiscal Multimoneda
                </h3>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                    Dólares ($)
                  </span>
                  <span className="font-bold text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                    Bolívares (Bs.)
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 font-mono text-xs">
                {/* Subtotal Neto */}
                <div className="flex justify-between items-center py-0.5 text-slate-600">
                  <span className="font-sans font-semibold">Subtotal Neto:</span>
                  <div className="text-right space-x-3">
                    <span className="font-bold text-slate-800 text-xs">{formatMoney(totals.subtotalUSD, 'USD')}</span>
                    <span className="text-slate-500 text-[11px]">{formatMoney(totals.subtotalBs, 'VES')}</span>
                  </div>
                </div>

                {/* Monto Exento */}
                {totals.montoExento > 0 && (
                  <div className="flex justify-between items-center py-0.5 text-slate-600">
                    <span className="font-sans font-semibold">Monto Exento (E):</span>
                    <div className="text-right space-x-3">
                      <span className="font-bold text-slate-800 text-xs">{formatMoney(totals.montoExentoUSD, 'USD')}</span>
                      <span className="text-slate-500 text-[11px]">{formatMoney(totals.montoExentoBs, 'VES')}</span>
                    </div>
                  </div>
                )}

                {/* Base Imponible */}
                <div className="flex justify-between items-center py-0.5 text-slate-600">
                  <span className="font-sans font-semibold">Base Imponible (16%):</span>
                  <div className="text-right space-x-3">
                    <span className="font-bold text-slate-800 text-xs">{formatMoney(totals.baseImponibleUSD, 'USD')}</span>
                    <span className="text-slate-500 text-[11px]">{formatMoney(totals.baseImponibleBs, 'VES')}</span>
                  </div>
                </div>

                {/* IVA Débito Fiscal */}
                <div className="flex justify-between items-center py-0.5 text-slate-600">
                  <span className="font-sans font-semibold">IVA Débito Fiscal (16%):</span>
                  <div className="text-right space-x-3">
                    <span className="font-bold text-slate-800 text-xs">{formatMoney(totals.ivaMontoUSD, 'USD')}</span>
                    <span className="text-slate-500 text-[11px]">{formatMoney(totals.ivaMontoBs, 'VES')}</span>
                  </div>
                </div>

                {/* IGTF 3% */}
                {applyIgtf && totals.igtfMonto > 0 && (
                  <div className="flex justify-between items-center py-0.5 text-emerald-700 font-bold bg-emerald-50/70 px-2 rounded text-xs">
                    <span className="font-sans">(+) IGTF Percibido (3%):</span>
                    <div className="text-right space-x-3">
                      <span>+{formatMoney(totals.igtfMontoUSD, 'USD')}</span>
                      <span>+{formatMoney(totals.igtfMontoBs, 'VES')}</span>
                    </div>
                  </div>
                )}

                {/* Total Facturado */}
                <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center text-slate-900 font-bold">
                  <span className="font-sans">Total Facturado:</span>
                  <div className="text-right space-x-3">
                    <span className="text-sm font-black">{formatMoney(totals.totalUSD, 'USD')}</span>
                    <span className="text-xs text-slate-600 font-bold">{formatMoney(totals.totalBs, 'VES')}</span>
                  </div>
                </div>

                {/* Retención IVA */}
                {applyRetIva && totals.retIvaMonto > 0 && (
                  <div className="flex justify-between items-center py-0.5 text-amber-700 bg-amber-50/60 px-2 rounded text-[11px]">
                    <span className="font-sans">(-) Retención IVA ({retIvaPercent}%):</span>
                    <div className="text-right space-x-3 font-bold">
                      <span>-{formatMoney(totals.retIvaMontoUSD, 'USD')}</span>
                      <span>-{formatMoney(totals.retIvaMontoBs, 'VES')}</span>
                    </div>
                  </div>
                )}

                {/* Retención ISLR */}
                {applyRetIslr && totals.retIslrMonto > 0 && (
                  <div className="flex justify-between items-center py-0.5 text-indigo-700 bg-indigo-50/60 px-2 rounded text-[11px]">
                    <span className="font-sans">(-) Retención ISLR ({retIslrPercent}%):</span>
                    <div className="text-right space-x-3 font-bold">
                      <span>-{formatMoney(totals.retIslrMontoUSD, 'USD')}</span>
                      <span>-{formatMoney(totals.retIslrMontoBs, 'VES')}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              {/* GRAN TOTAL NETO A COBRAR DESTACADO */}
              <div className="border border-indigo-100/90 bg-gradient-to-r from-indigo-50/60 to-slate-50 p-2.5 rounded-xl shadow-2xs">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-500 block">
                      TOTAL NETO A COBRAR:
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                      selectedCondition === 'contado' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      CONDICIÓN: {selectedCondition.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono tracking-tight leading-none">
                      {formatMoney(totals.netoCobrarUSD, 'USD')}
                    </div>
                    <div className="text-xs font-bold text-slate-600 font-mono mt-1">
                      Equiv: {formatMoney(totals.netoCobrarBs, 'VES')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Alerta de Stock 0 */}
              {zeroStockItems.length > 0 && (
                !isZeroStockAuthorized ? (
                  <div className="mt-1.5 p-1.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span className="font-bold text-rose-900 text-[10px]">
                        {zeroStockItems.length} Producto(s) sin Stock
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMasterAuthModalOpen(true)}
                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[9px] cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <KeyRound size={10} />
                      <span>Clave Master</span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-1.5 p-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[10px] text-emerald-800 flex items-center gap-1 font-bold">
                    <ShieldCheck size={12} className="text-emerald-600" />
                    <span>Stock 0 Autorizado</span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* 5. OBSERVACIONES / TÉRMINOS DE LA FACTURA (COMPACTO) */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs shrink-0">
            <label className="block text-slate-600 font-bold mb-1 text-[10px] uppercase">
              Observaciones / Términos de la Factura
            </label>
            <textarea
              rows={2}
              placeholder="Condiciones de despacho, garantía, cuentas bancarias de la empresa para pago..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-11 p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:border-indigo-600 outline-none resize-none leading-snug"
            />
          </div>

          {/* 6. BOTÓN PRINCIPAL DE EMISIÓN DE FACTURA (AL FINAL DE LA COLUMNA) */}
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider shrink-0 active:scale-[0.99]"
          >
            <Save size={16} />
            <span>EMITIR FACTURA ({selectedCondition.toUpperCase()}) [F2]</span>
          </button>

        </div>

        {/* COLUMNA DERECHA: GRILLA DE RENGLONES CON SCROLL INTERNO ÚNICAMENTE */}
        <div className="flex-1 min-w-0 flex flex-col h-full bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          {/* Sub-barra de Grilla */}
          <div className="px-3.5 py-2 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Package size={14} className="text-indigo-600" />
                Renglones de la Factura
              </span>
              <span className="text-[10px] bg-slate-200/80 text-slate-700 font-bold px-2 py-0.5 rounded-full font-mono">
                {items.length} {items.length === 1 ? 'renglón' : 'renglones'}
              </span>

              {/* Alerta de Stock 0 */}
              {zeroStockItems.length > 0 && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
                  isZeroStockAuthorized
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                }`}>
                  <ShieldAlert size={11} />
                  <span>{zeroStockItems.length} en Stock 0</span>
                </span>
              )}
            </div>

            {/* Lector de Código de Barras / SKU Bar */}
            <div className="flex-1 max-w-md relative flex items-center">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none flex items-center gap-1">
                <ScanBarcode size={15} />
              </div>
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Escanear Código de Barras / SKU... [F4]"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeScan(barcodeInput);
                  }
                }}
                className="w-full pl-8 pr-20 py-1.5 bg-white border border-indigo-200 hover:border-indigo-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition font-mono shadow-2xs"
              />
              <button
                type="button"
                onClick={() => handleBarcodeScan(barcodeInput)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black tracking-wide flex items-center gap-1 cursor-pointer transition shadow-xs"
              >
                <span>Enter</span>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenProductModal(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                title="Abrir catálogo de inventario (F3)"
              >
                <Search size={13} />
                <span>Catálogo (F3)</span>
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                title="Añadir renglón vacío"
              >
                <Plus size={13} />
                <span>+ Fila</span>
              </button>
            </div>
          </div>

          {/* Tabla de Artículos: Renglones de la Factura con Scroll Interno Únicamente */}
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 border-b border-slate-100">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 select-none sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="px-3 py-2 w-10 text-center">#</th>
                  <th className="px-3 py-2 w-28">Código / SKU</th>
                  <th className="px-3 py-2">Descripción / Concepto</th>
                  <th className="px-2 py-2 w-24 text-center">Stock</th>
                  <th className="px-2 py-2 w-20 text-center">Cant.</th>
                  <th className="px-2 py-2 w-36 text-right">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Lock size={10} className="text-slate-400" />
                      <span>P. Unitario ({currency === 'USD' ? '$' : 'Bs.'})</span>
                    </span>
                  </th>
                  <th className="px-2 py-2 w-20 text-center">IVA</th>
                  <th className="px-3 py-2 w-28 text-right">Total ({currency === 'USD' ? '$' : 'Bs.'})</th>
                  <th className="px-2 py-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((item, idx) => {
                  const selectedProd = products.find(p => p.id === item.producto_id || (item.codigo && p.codigo === item.codigo));
                  const itemQty = typeof item.cantidad === 'number' ? item.cantidad : parseMoney(item.cantidad);
                  const isStockWarning = selectedProd && (itemQty > Number(selectedProd.stock_actual));
                  const isZeroStock = selectedProd && Number(selectedProd.stock_actual) <= 0;

                  return (
                    <tr key={item.id} className="hover:bg-indigo-50/20 transition-colors">
                      {/* # Índice */}
                      <td className="px-3 py-2 text-center text-slate-400 font-mono font-bold text-[11px] align-middle">
                        {idx + 1}
                      </td>

                      {/* Código SKU Interactivo */}
                      <td className="px-2 py-1 align-middle">
                        <input
                          type="text"
                          placeholder="Código / SKU"
                          value={item.codigo || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleItemFieldChange(idx, 'codigo', val);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleLookupSkuInRow(idx, item.codigo || '');
                            }
                          }}
                          onBlur={() => {
                            if (item.codigo && (!item.producto_id || (selectedProd && item.codigo.trim().toLowerCase() !== selectedProd.codigo.trim().toLowerCase()))) {
                              handleLookupSkuInRow(idx, item.codigo);
                            }
                          }}
                          className="w-24 px-1.5 py-1 bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-600 rounded-lg text-xs font-mono font-bold text-indigo-700 uppercase outline-none"
                          title="Escriba o escanee el código/SKU y presione Enter"
                        />
                      </td>

                      {/* Descripción */}
                      <td className="px-3 py-2 align-middle">
                        {!item.producto_id ? (
                          <button
                            type="button"
                            onClick={() => handleOpenProductModal(idx)}
                            className="w-full px-2.5 py-1.5 bg-indigo-50/40 hover:bg-indigo-50/80 border border-dashed border-indigo-200 hover:border-indigo-400 rounded-lg text-left transition flex items-center justify-between gap-1.5 text-xs text-indigo-700 font-semibold cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <Search size={12} className="text-indigo-500" />
                              <span>Buscar o seleccionar artículo...</span>
                            </span>
                            <span className="text-[10px] bg-slate-900 text-white font-bold px-1.5 py-0.2 rounded">
                              F3 Catálogo
                            </span>
                          </button>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900 text-xs truncate">
                              {item.descripcion || selectedProd?.nombre}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenProductModal(idx)}
                              title="Cambiar artículo"
                              className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-100 transition shrink-0 cursor-pointer"
                            >
                              <RefreshCw size={11} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="px-2 py-2 text-center align-middle">
                        {selectedProd ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black font-mono ${
                            isZeroStock
                              ? isZeroStockAuthorized
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                              : isStockWarning
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            <span>{selectedProd.stock_actual} disp.</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Cantidad */}
                      <td className="px-2 py-2 text-center align-middle">
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="1"
                          value={item.cantidad !== undefined && item.cantidad !== null && item.cantidad !== '' ? String(item.cantidad).replace('.', ',') : ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9.,]/g, '');
                            handleItemFieldChange(idx, 'cantidad', raw);
                          }}
                          onBlur={() => {
                            const val = typeof item.cantidad === 'number' ? item.cantidad : parseMoney(item.cantidad);
                            if (val <= 0) {
                              handleItemFieldChange(idx, 'cantidad', 1);
                            }
                          }}
                          className="w-16 px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black text-center text-slate-900 focus:border-indigo-600 outline-none font-mono"
                        />
                      </td>

                      {/* Precio Unitario Bloqueado & Selector Modal de Tarifas / Candado con Clave */}
                      <td className="px-2 py-2 text-right align-middle">
                        <div className="flex flex-col items-end gap-1 min-w-[130px]">
                          {selectedProd ? (
                            <button
                              type="button"
                              onClick={() => setPriceModalItemIndex(idx)}
                              className={`w-full text-[10px] font-black rounded-md px-2 py-0.5 border flex items-center justify-between gap-1 transition cursor-pointer shadow-2xs ${
                                item.tipo_precio === 'manual'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                  : item.tipo_precio === 'mayor'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                                  : item.tipo_precio === 'vip'
                                  ? 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                                  : item.tipo_precio === 'minimo'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                              }`}
                              title="Haga clic para abrir el modal de tarifas de inventario y seleccionar un precio"
                            >
                              <span className="flex items-center gap-1 truncate">
                                <Tag size={10} className="shrink-0" />
                                <span>
                                  {item.tipo_precio === 'manual'
                                    ? 'Tarifa: Manual'
                                    : item.tipo_precio === 'mayor'
                                    ? 'Mayorista'
                                    : item.tipo_precio === 'vip'
                                    ? 'VIP'
                                    : item.tipo_precio === 'minimo'
                                    ? 'Mínimo'
                                    : 'PVP (Detal)'}
                                </span>
                              </span>
                              <ChevronDown size={10} className="shrink-0 opacity-60" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Sin producto</span>
                          )}

                          <div className="relative w-full flex items-center">
                            {unlockedPriceRows[idx] ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setUnlockedPriceRows(prev => ({ ...prev, [idx]: false }));
                                  showToast?.('Precio bloqueado nuevamente', 'info');
                                }}
                                title="Precio manual desbloqueado. Haga clic para volver a bloquear"
                                className="absolute left-1 text-emerald-600 hover:text-emerald-700 transition cursor-pointer p-1 rounded hover:bg-emerald-100 z-10"
                              >
                                <Unlock size={12} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setPriceUnlockTargetIndex(idx);
                                  setIsPriceUnlockAuthOpen(true);
                                }}
                                title="Precio unitario bloqueado. Haga clic en el candado para ingresar la clave y desbloquear precio manual"
                                className="absolute left-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer p-1 rounded hover:bg-slate-200 z-10"
                              >
                                <Lock size={12} />
                              </button>
                            )}

                            <input
                              type="text"
                              readOnly={!unlockedPriceRows[idx]}
                              tabIndex={unlockedPriceRows[idx] ? 0 : -1}
                              placeholder="0,00"
                              value={
                                unlockedPriceRows[idx]
                                  ? (item.precio_unitario !== undefined && item.precio_unitario !== null ? String(item.precio_unitario).replace('.', ',') : '')
                                  : (item.precio_unitario !== undefined && item.precio_unitario !== null && item.precio_unitario !== '' ? String(Number(item.precio_unitario).toFixed(2)).replace('.', ',') : '0,00')
                              }
                              onChange={(e) => {
                                if (unlockedPriceRows[idx]) {
                                  handleManualPriceChange(idx, e.target.value);
                                }
                              }}
                              onBlur={() => {
                                if (unlockedPriceRows[idx]) {
                                  handleManualPriceBlur(idx);
                                }
                              }}
                              className={`w-full pl-6 pr-2 py-1 rounded-lg text-xs font-black text-right outline-none font-mono transition ${
                                unlockedPriceRows[idx]
                                  ? 'bg-amber-50/50 border border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 text-slate-900 cursor-text shadow-2xs'
                                  : 'bg-slate-100/90 border border-slate-200 text-slate-800 cursor-not-allowed select-none'
                              }`}
                              title={
                                unlockedPriceRows[idx]
                                  ? 'Precio manual editable. Ingrese el valor unitario.'
                                  : 'Precio bloqueado. Clic en el candado para autorizar precio manual con clave.'
                              }
                            />
                          </div>
                        </div>
                      </td>

                      {/* IVA (Toggle 16% / Exento E) */}
                      <td className="px-2 py-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleItemFieldChange(idx, 'exento', !item.exento)}
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition cursor-pointer ${
                            item.exento
                              ? 'bg-slate-200 text-slate-800 border border-slate-300'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}
                          title={item.exento ? 'Haga clic para aplicar IVA 16%' : 'Haga clic para marcar como Exento (E)'}
                        >
                          {item.exento ? 'EXENTO (E)' : '16%'}
                        </button>
                      </td>

                      {/* Total Renglón */}
                      <td className="px-3 py-2 text-right align-middle font-mono font-black text-slate-900 whitespace-nowrap">
                        {formatMoney(item.total, currency)}
                      </td>

                      {/* Acciones */}
                      <td className="px-2 py-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition rounded-md cursor-pointer"
                          title="Eliminar renglón"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pie de Grilla */}
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs text-slate-500 font-medium">
            <div>
              <span>Total Items: <b className="text-slate-800">{items.length}</b></span>
              <span className="mx-2">•</span>
              <span>Total Unidades: <b className="text-slate-800">{items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0)}</b></span>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus size={13} />
              <span>+ Añadir otro renglón</span>
            </button>
          </div>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* PASO 1: MODAL SOLICITUD DE CONDICIÓN (CONTADO VS CRÉDITO) */}
      {/* ========================================================================= */}
      {isConditionModalOpen && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-slate-900">Condición de la Factura</h3>
                <p className="text-xs text-slate-400 font-semibold">
                  Seleccione si la venta es de contado (cobro inmediato) o a crédito
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConditionModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold uppercase text-indigo-500">Cliente:</p>
                  <p className="font-bold text-slate-900 text-sm">{customerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-indigo-500">Total Documento:</p>
                  <p className="font-black text-indigo-600 text-base">{formatMoney(totals.total, currency)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* TARJETA CONTADO */}
                <div 
                  onClick={() => handleSelectCondition('contado')}
                  className="p-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-500 cursor-pointer transition flex flex-col justify-between gap-3 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <DollarSign size={22} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm group-hover:text-emerald-700 transition">
                      Factura de Contado
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      El cliente cancela de inmediato. Se registrará la cobranza y el ingreso bancario.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <span>Cobrar ahora</span>
                    <ArrowRight size={14} />
                  </span>
                </div>

                {/* TARJETA CRÉDITO */}
                <div 
                  className="p-5 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 transition flex flex-col justify-between gap-3 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <Calendar size={22} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">
                      Factura a Crédito
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Se generará una cuenta por cobrar (CxC) pendiente con fecha de vencimiento.
                    </p>

                    <div className="mt-3 p-2.5 bg-white rounded-xl border border-indigo-100 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600">Plazo:</span>
                        <div className="flex items-center gap-1">
                          {[7, 15, 30, 45].map((days) => (
                            <button
                              key={days}
                              type="button"
                              onClick={() => setCreditDays(days)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                creditDays === days
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {days}d
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                        <span className="text-slate-500 font-semibold">Vencimiento:</span>
                        <span className="font-black text-indigo-700 font-mono">
                          {formatDate(calculatedDueDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectCondition('credito')}
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                  >
                    <span>Asignar crédito ({creditDays} días)</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 2 (SI ES CONTADO): MODAL DE COBRANZA (IDÉNTICO AL SISTEMA) */}
      {/* ========================================================================= */}
      {isCobranzaModalOpen && (
        <div className="fixed inset-0 z-[360] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col border border-slate-100">
            {/* Header del Modal de Cobranza */}
            <div className="p-5 border-b border-slate-100 bg-emerald-50/70 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Registro de Cobranza (Contado)</h3>
                  <p className="text-xs text-emerald-800 font-semibold">
                    Factura {invoiceNumber} • {customerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCobranzaModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo del Modal de Cobranza */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              
              {/* Tarjeta de Resumen del Cobro */}
              <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-slate-500">Total a Cobrar:</span>
                    <span className="text-lg font-bold text-slate-900 font-mono">{formatMoney(totals.netoCobrarUSD, 'USD')}</span>
                    <span className="text-xs font-semibold text-slate-500 font-mono">
                      (Bs. {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(totals.netoCobrarBs)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Total Ingresado:</span>
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                      cobranzaCalculations.isUnderpaid 
                        ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                        : cobranzaCalculations.isOverpaid 
                          ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      ${cobranzaCalculations.totalPagadoUSD.toFixed(2)} / Bs. {cobranzaCalculations.totalPagadoBs.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Fecha de Pago</label>
                    <input
                      type="date"
                      value={cobranzaForm.fecha}
                      onChange={(e) => setCobranzaForm({ ...cobranzaForm, fecha: e.target.value })}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (cobranzaForm.pagos.length > 0) {
                        const updated = [...cobranzaForm.pagos];
                        updated[0].monto = totals.netoCobrarUSD.toFixed(2);
                        updated[0].montoBs = totals.netoCobrarBs.toFixed(2);
                        setCobranzaForm({ ...cobranzaForm, pagos: updated });
                        showToast?.('Monto ajustado al total', 'info');
                      }
                    }}
                    className="self-end px-2.5 py-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition"
                  >
                    Monto Exacto
                  </button>
                </div>
              </div>

              {/* Lista de Formas de Pago */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 text-xs">Métodos de Pago</h4>
                  <button
                    type="button"
                    onClick={handleAddPagoCobranza}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Agregar método</span>
                  </button>
                </div>

                {cobranzaForm.pagos.map((pago, pIdx) => {
                  const selB = bancos.find(b => b.id === pago.bancoId);
                  const isCaja = !!(selB?.es_caja || (selB?.tipo || '').toLowerCase().includes('caja') || (selB?.banco || '').toLowerCase().includes('caja'));
                  const isUSD = !isCaja && (selB?.moneda === 'USD' || selB?.moneda === 'Dolares');
                  const isBVES = !isCaja && (selB?.moneda === 'VES' || selB?.moneda === 'Bs' || selB?.moneda === 'Bolivares');

                  // Opciones de método de pago según cuenta seleccionada
                  let availableMethods = ['Transferencia', 'Depósito', 'Punto de Venta', 'Pago Móvil', 'Efectivo', 'Zelle', 'Binance'];
                  if (isCaja) {
                    availableMethods = ['Efectivo'];
                  } else if (isUSD) {
                    availableMethods = ['Transferencia', 'Depósito', 'Zelle', 'Binance', 'Punto de Venta'];
                  } else if (isBVES) {
                    availableMethods = ['Transferencia', 'Depósito', 'Pago Móvil', 'Punto de Venta'];
                  }

                  const isPos = pago.metodoPago === 'Punto de Venta';
                  const activeTerminals = terminalesPos.filter(t => t.activo !== false);
                  const selectedTerm = isPos 
                    ? (terminalesPos.find(t => t.id === pago.terminalId) || activeTerminals[0] || terminalesPos[0])
                    : null;
                  const isTermUSD = selectedTerm ? (selectedTerm.tipo_cuenta === 'internacional' || selectedTerm.moneda === 'USD') : false;

                  // Cuentas internacionales no manejan tasas
                  const isEffectiveVES = isPos ? !isTermUSD : isBVES;

                  return (
                    <div key={pago.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        {/* Selector de Destino / Terminal */}
                        <div className="sm:col-span-7">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-slate-600">
                              {isPos ? 'Terminal POS' : 'Cuenta / Caja'}
                            </label>
                            {isPos ? (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                isTermUSD ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                              }`}>
                                {isTermUSD ? 'USD Directo' : 'VES (Tasa BCV)'}
                              </span>
                            ) : isCaja ? (
                              <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded">
                                Caja
                              </span>
                            ) : null}
                          </div>

                          {isPos ? (
                            <select
                              value={pago.terminalId || (activeTerminals.length > 0 ? activeTerminals[0].id : '')}
                              onChange={(e) => {
                                const updated = [...cobranzaForm.pagos];
                                const termId = e.target.value;
                                updated[pIdx].terminalId = termId;
                                const term = terminalesPos.find(t => t.id === termId);
                                if (term && term.banco_id) updated[pIdx].bancoId = term.banco_id;
                                const termIsUSD = term ? (term.tipo_cuenta === 'internacional' || term.moneda === 'USD') : false;
                                if (termIsUSD) {
                                  updated[pIdx].montoBs = '0';
                                }
                                setCobranzaForm({ ...cobranzaForm, pagos: updated });
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 outline-none text-xs focus:border-indigo-500"
                            >
                              {activeTerminals.length === 0 ? (
                                <option value="">No hay terminales configurados</option>
                              ) : (
                                activeTerminals.map(t => {
                                  const isInt = t.tipo_cuenta === 'internacional' || t.moneda === 'USD';
                                  return (
                                    <option key={t.id} value={t.id}>
                                      {t.nombre} ({t.codigo}) - {isInt ? 'USD' : 'VES'}
                                    </option>
                                  );
                                })
                              )}
                            </select>
                          ) : (
                            <select
                              value={pago.bancoId}
                              onChange={(e) => {
                                const newBankId = e.target.value;
                                const newSelB = bancos.find(b => b.id === newBankId);
                                const newIsCaja = !!(newSelB?.es_caja || (newSelB?.tipo || '').toLowerCase().includes('caja') || (newSelB?.banco || '').toLowerCase().includes('caja'));
                                const newIsUSD = !newIsCaja && (newSelB?.moneda === 'USD' || newSelB?.moneda === 'Dolares');
                                const newIsVES = !newIsCaja && (newSelB?.moneda === 'VES' || newSelB?.moneda === 'Bs' || newSelB?.moneda === 'Bolivares');

                                const updated = [...cobranzaForm.pagos];
                                updated[pIdx].bancoId = newBankId;

                                if (newIsCaja) {
                                  updated[pIdx].metodoPago = 'Efectivo';
                                } else if (newIsUSD) {
                                  if (!['Transferencia', 'Depósito', 'Zelle', 'Binance', 'Punto de Venta'].includes(updated[pIdx].metodoPago)) {
                                    updated[pIdx].metodoPago = 'Transferencia';
                                  }
                                } else if (newIsVES) {
                                  if (!['Transferencia', 'Depósito', 'Pago Móvil', 'Punto de Venta'].includes(updated[pIdx].metodoPago)) {
                                    updated[pIdx].metodoPago = 'Transferencia';
                                  }
                                }
                                setCobranzaForm({ ...cobranzaForm, pagos: updated });
                              }}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 outline-none text-xs focus:border-indigo-500"
                            >
                              <option value="">Seleccione cuenta o caja...</option>
                              {bancos.map(b => {
                                const isBox = !!(b.es_caja || (b.tipo || '').toLowerCase().includes('caja') || (b.banco || '').toLowerCase().includes('caja'));
                                return (
                                  <option key={b.id} value={b.id}>
                                    {isBox ? '💵 ' : '🏦 '}{b.banco} ({b.moneda}) - {b.numero_cuenta}
                                  </option>
                                );
                              })}
                            </select>
                          )}
                        </div>

                        {/* Selector de Método de Pago */}
                        <div className="sm:col-span-5">
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            Método de Pago
                          </label>
                          <select
                            value={pago.metodoPago}
                            onChange={(e) => {
                              const nextMetodo = e.target.value;
                              const updated = [...cobranzaForm.pagos];
                              updated[pIdx].metodoPago = nextMetodo;
                              if (nextMetodo === 'Punto de Venta' && activeTerminals.length > 0) {
                                const term = activeTerminals[0];
                                updated[pIdx].terminalId = term.id;
                                if (term.banco_id) updated[pIdx].bancoId = term.banco_id;
                              }
                              setCobranzaForm({ ...cobranzaForm, pagos: updated });
                            }}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 outline-none text-xs focus:border-indigo-500"
                          >
                            {availableMethods.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Fila 2: Referencia y Monto */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                        <div className="sm:col-span-6">
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            {isPos ? 'N° Comprobante / Lote' : pago.metodoPago === 'Pago Móvil' ? 'N° Referencia / Teléfono' : 'Referencia'}
                            {pago.metodoPago !== 'Efectivo' && <span className="text-red-500 font-bold ml-1">*</span>}
                          </label>
                          <input
                            type="text"
                            placeholder={pago.metodoPago === 'Efectivo' ? 'Ej: Opcional para efectivo' : 'Ej: 987410 (Obligatorio)'}
                            value={pago.referencia}
                            onChange={(e) => {
                              const updated = [...cobranzaForm.pagos];
                              updated[pIdx].referencia = e.target.value;
                              setCobranzaForm({ ...cobranzaForm, pagos: updated });
                            }}
                            className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs text-slate-800 outline-none focus:border-indigo-500 ${
                              pago.metodoPago !== 'Efectivo' && !pago.referencia?.trim() ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200'
                            }`}
                          />
                        </div>

                        <div className="sm:col-span-5">
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            Monto Recibido ({isEffectiveVES ? 'Bs.' : '$'})
                          </label>
                          {isEffectiveVES ? (
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Bs.</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={pago.montoBs}
                                onChange={(e) => {
                                  const updated = [...cobranzaForm.pagos];
                                  const valBs = e.target.value;
                                  updated[pIdx].montoBs = valBs;
                                  const t = exchangeRate || 1;
                                  updated[pIdx].monto = t > 0 ? (Number(valBs) / t).toFixed(2) : '0';
                                  setCobranzaForm({ ...cobranzaForm, pagos: updated });
                                }}
                                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 outline-none text-xs focus:border-indigo-500 text-right"
                              />
                            </div>
                          ) : (
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={pago.monto}
                                onChange={(e) => {
                                  const updated = [...cobranzaForm.pagos];
                                  const valUsd = e.target.value;
                                  updated[pIdx].monto = valUsd;
                                  if (!isTermUSD) {
                                    const t = exchangeRate || 1;
                                    updated[pIdx].montoBs = (Number(valUsd) * t).toFixed(2);
                                  } else {
                                    updated[pIdx].montoBs = '0';
                                  }
                                  setCobranzaForm({ ...cobranzaForm, pagos: updated });
                                }}
                                className="w-full pl-6 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 outline-none text-xs focus:border-indigo-500 text-right"
                              />
                            </div>
                          )}
                        </div>

                        <div className="sm:col-span-1 flex justify-center pb-0.5">
                          {cobranzaForm.pagos.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePagoCobranza(pIdx)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                              title="Eliminar forma de pago"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Estado y Balance del Cobro */}
              <div>
                {cobranzaCalculations.isUnderpaid && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-900 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-amber-800">
                      <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                      <span>Falta por cobrar:</span>
                    </div>
                    <span className="font-bold font-mono text-sm text-amber-800">
                      ${cobranzaCalculations.faltanteUSD.toFixed(2)} (Bs. {cobranzaCalculations.faltanteBs.toFixed(2)})
                    </span>
                  </div>
                )}

                {cobranzaCalculations.isExact && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-900 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-emerald-800">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span>Cobro exacto cubierto al 100%</span>
                    </div>
                    <span className="text-xs font-bold text-emerald-700">Sin diferencias</span>
                  </div>
                )}

                {cobranzaCalculations.isOverpaid && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-blue-900 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-blue-800">
                      <Coins size={16} className="text-blue-600 shrink-0" />
                      <span>Vuelto / Cambio a entregar:</span>
                    </div>
                    <span className="font-bold font-mono text-sm text-blue-700">
                      ${cobranzaCalculations.vueltoUSD.toFixed(2)} (Bs. {cobranzaCalculations.vueltoBs.toFixed(2)})
                    </span>
                  </div>
                )}
              </div>

              {/* Botones de acción del Modal de Cobranza */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCobranzaModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={cobranzaCalculations.isUnderpaid}
                  onClick={handleConfirmCobranzaToVoucher}
                  className={`px-5 py-2.5 rounded-xl font-black transition shadow-md flex items-center gap-1.5 cursor-pointer ${
                    cobranzaCalculations.isUnderpaid
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-75 shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 active:scale-[0.99]'
                  }`}
                  title={cobranzaCalculations.isUnderpaid ? `Falta por cobrar $${cobranzaCalculations.faltanteUSD.toFixed(2)}` : 'Confirmar cobranza y generar comprobante contable'}
                >
                  {cobranzaCalculations.isUnderpaid ? (
                    <>
                      <AlertTriangle size={15} className="text-amber-700" />
                      <span>Falta Cobrar ${cobranzaCalculations.faltanteUSD.toFixed(2)}</span>
                    </>
                  ) : cobranzaCalculations.isOverpaid ? (
                    <>
                      <span>Continuar y Entregar Vuelto (${cobranzaCalculations.vueltoUSD.toFixed(2)})</span>
                      <ArrowRight size={16} />
                    </>
                  ) : (
                    <>
                      <span>Continuar a Asiento Contable</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 3: MODAL DE PREVISUALIZACIÓN DE ASIENTO CONTABLE */}
      {/* ========================================================================= */}
      {isVoucherModalOpen && pendingVoucher && (
        <VoucherPreviewModal
          isOpen={isVoucherModalOpen}
          onClose={() => setIsVoucherModalOpen(false)}
          initialComprobante={pendingVoucher}
          cuentasContables={cuentasContables}
          onConfirm={async (finalComprobante) => {
            await handleFinalSaveInvoice(finalComprobante);
          }}
          showToast={showToast}
          title="Asiento Contable de Venta"
          subtitle={`${pendingVoucher.numero || ''} • Comprobante Automático (${selectedCondition.toUpperCase()}) - Verifique o ajuste cuentas antes de finalizar`}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL BUSCAR CLIENTE */}
      {/* ========================================================================= */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[370] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] border border-slate-100">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">Seleccionar Cliente</h3>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o RIF..."
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>
            </div>

            <div className="overflow-y-auto divide-y divide-slate-100 text-xs p-2">
              {customersList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-bold">
                  No se encontraron clientes registrados con ese criterio.
                </div>
              ) : (
                customersList.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectCustomer(c)}
                    className="w-full p-3 text-left hover:bg-slate-50 rounded-xl transition flex justify-between items-center group"
                  >
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-indigo-600">{c.name}</p>
                      <p className="font-mono text-slate-400 text-[11px]">{c.taxId}</p>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      Seleccionar
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CREAR CLIENTE (IDÉNTICO AL DEL MÓDULO DE CONTACTOS) */}
      {/* ========================================================================= */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 z-[380] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200 border border-slate-100">
            {/* Header Modal */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Registrar Cliente
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Complete los campos para registrar un nuevo cliente en el sistema
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            {/* Pestañas del Modal */}
            <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-3 gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveCustomerModalTab('info')}
                className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                  activeCustomerModalTab === 'info'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <User size={14} />
                <span>1. Información General</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCustomerModalTab('contabilidad')}
                className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                  activeCustomerModalTab === 'contabilidad'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <BookOpen size={14} />
                <span>2. Enlace Contable</span>
                {(!customerModalForm.debitAccount || !customerModalForm.creditAccount) && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                    Requerido
                  </span>
                )}
              </button>
            </div>

            <form onSubmit={handleSaveCustomerFromModal} className="overflow-y-auto flex-1 flex flex-col justify-between">
              <div className="p-6 space-y-4 flex-1">
                {/* PESTAÑA 1: INFORMACIÓN GENERAL */}
                {activeCustomerModalTab === 'info' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Selector de Naturaleza Jurídica */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Naturaleza Jurídica
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCustomerModalForm(prev => ({ ...prev, isCompany: true, taxIdPrefix: 'J' }))}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                            customerModalForm.isCompany
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Building2 size={16} />
                          <span>Persona Jurídica (Empresa)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomerModalForm(prev => ({ ...prev, isCompany: false, taxIdPrefix: 'V', personaContacto: '', cargo: '' }))}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                            !customerModalForm.isCompany
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <User size={16} />
                          <span>Persona Natural</span>
                        </button>
                      </div>
                    </div>

                    {/* Nombre o Razón Social */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Nombre o Razón Social *
                      </label>
                      <input 
                        type="text" 
                        required
                        placeholder={
                          customerModalForm.isCompany 
                            ? 'Ej: Inversiones Globales C.A.' 
                            : 'Ej: Juan Alberto Pérez'
                        }
                        value={customerModalForm.name}
                        onChange={(e) => setCustomerModalForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none" 
                      />
                    </div>

                    {/* RIF / Documento de Identidad */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Documento de Identidad / RIF
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={customerModalForm.taxIdPrefix}
                          onChange={(e) => setCustomerModalForm(prev => ({ ...prev, taxIdPrefix: e.target.value }))}
                          className="w-20 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                        >
                          <option value="J">J -</option>
                          <option value="V">V -</option>
                          <option value="G">G -</option>
                          <option value="E">E -</option>
                          <option value="P">P -</option>
                          <option value="C">C -</option>
                        </select>
                        <input
                          type="text"
                          placeholder="12345678-9"
                          value={customerModalForm.taxIdNumber}
                          onChange={(e) => setCustomerModalForm(prev => ({ ...prev, taxIdNumber: e.target.value }))}
                          className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition font-mono"
                        />
                      </div>
                    </div>

                    {/* Correo y Teléfono */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
                        <div className="relative">
                          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="email" 
                            placeholder="contacto@ejemplo.com"
                            value={customerModalForm.email}
                            onChange={(e) => setCustomerModalForm(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none" 
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono de Contacto</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="tel" 
                            placeholder="+58 412 1234567"
                            value={customerModalForm.phone}
                            onChange={(e) => setCustomerModalForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Persona de Contacto & Cargo (Solo para Persona Jurídica / Empresa) */}
                    {customerModalForm.isCompany && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Persona de Contacto</label>
                          <input 
                            type="text" 
                            placeholder="Nombre del responsable"
                            value={customerModalForm.personaContacto}
                            onChange={(e) => setCustomerModalForm(prev => ({ ...prev, personaContacto: e.target.value }))}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none" 
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Cargo o Departamento</label>
                          <input 
                            type="text" 
                            placeholder="Ej: Gerente de Compras / Administración"
                            value={customerModalForm.cargo}
                            onChange={(e) => setCustomerModalForm(prev => ({ ...prev, cargo: e.target.value }))}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none" 
                          />
                        </div>
                      </div>
                    )}

                    {/* Dirección */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Dirección Fiscal / Ubicación</label>
                      <textarea 
                        placeholder="Ciudad, dirección de oficina o residencia"
                        value={customerModalForm.address}
                        onChange={(e) => setCustomerModalForm(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none resize-none h-16" 
                      />
                    </div>
                  </div>
                )}

                {/* PESTAÑA 2: ENLACE CONTABLE */}
                {activeCustomerModalTab === 'contabilidad' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Aviso si faltan vincular cuentas contables */}
                    {customerAccountError && (
                      <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-bold animate-in fade-in duration-200">
                        <AlertTriangle size={18} className="shrink-0 text-rose-600" />
                        <span>{customerAccountError}</span>
                      </div>
                    )}

                    <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80">
                      <div className="flex items-start gap-2.5 text-amber-900">
                        <AlertTriangle size={17} className="shrink-0 mt-0.5 text-amber-600" />
                        <div>
                          <p className="text-xs font-bold text-amber-950">Vinculación Contable Obligatoria *</p>
                          <p className="text-[11px] text-amber-800/90 font-medium mt-0.5 leading-relaxed">
                            Para poder registrar el cliente, debe vincular manualmente las cuentas contables de <b>Débito (CxC)</b> y <b>Crédito (Anticipos)</b>.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className={!customerModalForm.debitAccount ? 'ring-2 ring-amber-400 rounded-2xl p-0.5' : ''}>
                        <CuentaSelectorTrigger
                          label="Cuenta de Débito (Cuentas por Cobrar Clientes) *"
                          value={customerModalForm.debitAccount}
                          cuentasContables={cuentasContables}
                          onClick={() => {
                            setActiveCustomerAccountKey('debitAccount');
                            setShowCustomerCuentaModal(true);
                          }}
                        />
                      </div>

                      <div className={!customerModalForm.creditAccount ? 'ring-2 ring-amber-400 rounded-2xl p-0.5' : ''}>
                        <CuentaSelectorTrigger
                          label="Cuenta de Crédito (Anticipos Recibidos de Clientes) *"
                          value={customerModalForm.creditAccount}
                          cuentasContables={cuentasContables}
                          onClick={() => {
                            setActiveCustomerAccountKey('creditAccount');
                            setShowCustomerCuentaModal(true);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Modal Acciones */}
              <div className="p-4 px-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-2.5 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Registrar y Seleccionar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Selector de Cuenta para el Cliente */}
      <CuentaContableModal
        isOpen={showCustomerCuentaModal}
        onClose={() => {
          setShowCustomerCuentaModal(false);
          setActiveCustomerAccountKey(null);
        }}
        cuentasContables={cuentasContables}
        selectedCuentaId={activeCustomerAccountKey ? (customerModalForm as any)[activeCustomerAccountKey] : ''}
        onSelect={(cuenta) => {
          if (activeCustomerAccountKey && cuenta) {
            setCustomerModalForm(prev => ({ ...prev, [activeCustomerAccountKey]: cuenta.id }));
            setCustomerAccountError(null);
          }
          setShowCustomerCuentaModal(false);
          setActiveCustomerAccountKey(null);
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL DE SELECCIÓN RÁPIDA DE ARTÍCULOS DE INVENTARIO */}
      {/* ========================================================================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[375] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[90vh] border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/20">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Catálogo de Inventario de Mercancía
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Busque y seleccione el artículo para cargarlo a la factura
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsProductModalOpen(false);
                  setActiveItemIndexForProduct(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Barra de Búsqueda y Filtros de Categoría */}
            <div className="p-4 border-b border-slate-100 bg-white space-y-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar por código, SKU, nombre, categoría o escanear con lector de barras... [Enter]"
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const term = productSearchTerm.trim().toLowerCase();
                      if (!term) return;

                      // 1. Coincidencia exacta de código / SKU
                      const exactProd = products.find(p => p.codigo && p.codigo.trim().toLowerCase() === term);
                      if (exactProd) {
                        handleSelectProductFromModal(exactProd);
                        return;
                      }

                      // 2. Coincidencia exacta por ID
                      const idProd = products.find(p => p.id && p.id.toLowerCase() === term);
                      if (idProd) {
                        handleSelectProductFromModal(idProd);
                        return;
                      }

                      // 3. Si sólo queda un producto resultante en la lista filtrada
                      if (filteredProducts.length === 1) {
                        handleSelectProductFromModal(filteredProducts[0]);
                        return;
                      }
                    }
                  }}
                  className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none transition"
                />
                {productSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setProductSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filtros de Categoría */}
              {productCategories.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
                    Categoría:
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedProductCategory('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                      selectedProductCategory === 'all'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Todas ({products.length})
                  </button>
                  {productCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedProductCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                        selectedProductCategory === cat
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Listado de Artículos */}
            <div className="overflow-y-auto flex-1 p-4">
              {filteredProducts.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Package size={40} className="mx-auto mb-3 opacity-30 text-slate-400" />
                  <p className="font-bold text-sm text-slate-700">No se encontraron artículos</p>
                  <p className="text-xs mt-1 text-slate-400">
                    {productSearchTerm
                      ? `No hay coincidencias para "${productSearchTerm}". Intente con otro término.`
                      : 'No hay productos registrados en el inventario.'}
                  </p>
                  {productSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductSearchTerm('');
                        setSelectedProductCategory('all');
                      }}
                      className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      Limpiar búsqueda
                    </button>
                  )}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-3.5 py-2.5 w-24">Código</th>
                        <th className="px-3.5 py-2.5">Artículo / Categoría</th>
                        <th className="px-3.5 py-2.5 w-32 text-center">Stock Actual</th>
                        <th className="px-3.5 py-2.5 w-32 text-right">Precio Ref. ($)</th>
                        <th className="px-3.5 py-2.5 w-32 text-right">
                          Precio ({currency === 'USD' ? '$' : 'Bs.'})
                        </th>
                        <th className="px-3.5 py-2.5 w-20 text-center">IVA</th>
                        <th className="px-3.5 py-2.5 w-28 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map(prod => {
                        const isOutOfStock = (Number(prod.stock_actual) || 0) <= 0;
                        const isLowStock = !isOutOfStock && (Number(prod.stock_actual) <= (Number(prod.stock_minimo) || 5));
                        
                        // Precio en la moneda activa de la factura
                        let displayPriceInCurrency = prod.precio_venta || 0;
                        if (currency === 'VES' && exchangeRate > 0) {
                          displayPriceInCurrency = displayPriceInCurrency * exchangeRate;
                        }

                        return (
                          <tr
                            key={prod.id}
                            onClick={() => handleSelectProductFromModal(prod)}
                            className="hover:bg-indigo-50/60 cursor-pointer transition group"
                          >
                            <td className="px-3.5 py-3">
                              <span className="font-mono font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                {prod.codigo}
                              </span>
                            </td>
                            <td className="px-3.5 py-3">
                              <p className="font-bold text-slate-900 group-hover:text-indigo-700 transition">
                                {prod.nombre}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                {prod.categoria && (
                                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[10px] font-medium">
                                    {prod.categoria}
                                  </span>
                                )}
                                {prod.descripcion && (
                                  <span className="truncate max-w-xs">{prod.descripcion}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3.5 py-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                isOutOfStock
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : isLowStock
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {prod.stock_actual} {prod.unidad_medida || 'un.'}
                                {isOutOfStock && <span className="ml-1 text-[9px] text-rose-600 font-medium">(Aut. Master)</span>}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-600">
                              ${Number(prod.precio_venta || 0).toFixed(2)}
                            </td>
                            <td className="px-3.5 py-3 text-right">
                              <div className="flex flex-col items-end gap-0.5 font-mono">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-bold text-slate-400">PVP:</span>
                                  <span className="font-black text-slate-900">{formatMoney(displayPriceInCurrency, currency)}</span>
                                </div>
                                {Number(prod.precio_mayor) > 0 && (
                                  <div className="flex items-center gap-1 text-[10px]">
                                    <span className="text-[9px] font-bold text-indigo-600">Mayor:</span>
                                    <span className="font-semibold text-slate-700">
                                      {formatMoney(currency === 'VES' && exchangeRate > 0 ? Number(prod.precio_mayor) * exchangeRate : Number(prod.precio_mayor), currency)}
                                    </span>
                                  </div>
                                )}
                                {Number(prod.precio_vip) > 0 && (
                                  <div className="flex items-center gap-1 text-[10px]">
                                    <span className="text-[9px] font-bold text-purple-600">VIP:</span>
                                    <span className="font-semibold text-slate-700">
                                      {formatMoney(currency === 'VES' && exchangeRate > 0 ? Number(prod.precio_vip) * exchangeRate : Number(prod.precio_vip), currency)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3.5 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                prod.aplica_iva
                                  ? 'bg-indigo-50 text-indigo-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}>
                                {prod.aplica_iva ? '16%' : 'Exento'}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-center">
                              <div className="flex flex-col gap-1 items-center max-w-[90px] mx-auto">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectProductFromModal(prod, 'detal');
                                  }}
                                  className="w-full px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] shadow-xs transition flex items-center justify-center gap-1 cursor-pointer"
                                  title="Cargar con Precio PVP (Detal)"
                                >
                                  <Check size={11} />
                                  <span>PVP</span>
                                </button>
                                {Number(prod.precio_mayor) > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectProductFromModal(prod, 'mayor');
                                    }}
                                    className="w-full px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[9px] font-bold transition cursor-pointer"
                                    title="Cargar con Precio Mayorista"
                                  >
                                    Mayor
                                  </button>
                                )}
                                {Number(prod.precio_vip) > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectProductFromModal(prod, 'vip');
                                    }}
                                    className="w-full px-2 py-0.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded text-[9px] font-bold transition cursor-pointer"
                                    title="Cargar con Precio VIP"
                                  >
                                    VIP
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="p-4 px-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-xs shrink-0">
              <span className="text-slate-500 font-medium">
                Mostrando <b>{filteredProducts.length}</b> de <b>{products.length}</b> artículos en catálogo
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsProductModalOpen(false);
                  setActiveItemIndexForProduct(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
              >
                Cerrar Catálogo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Tasa de Cambio BCV */}
      <TasaCambioModal
        isOpen={isTasaModalOpen}
        onClose={() => setIsTasaModalOpen(false)}
        onSaveSuccess={(f, t) => {
          if (f === issueDate) {
            setExchangeRateInput(t.toFixed(2));
          }
          showToast?.(`Tasa BCV guardada: Bs. ${t.toFixed(2)}`, 'success');
        }}
      />

      {/* Modal de Autorización Master para Stock 0 */}
      <MasterAuthModal
        isOpen={isMasterAuthModalOpen}
        onClose={() => setIsMasterAuthModalOpen(false)}
        title="Autorización Especial de Operaciones"
        subtitle="Se requiere Clave Especial de Operaciones para proceder con la facturación de productos en stock 0"
        actionName="Facturación con Stock Cero / Insuficiente"
        actionDetails={
          zeroStockItems.map(item => {
            const p = products.find(prod => prod.id === item.producto_id);
            const stock = Number(p?.stock_actual) || 0;
            return `• ${item.codigo || p?.codigo || 'ART'} - ${item.descripcion || p?.nombre} | Stock: ${stock} | Cantidad a facturar: ${item.cantidad}`;
          }).join('\n')
        }
        onSuccess={() => {
          setIsZeroStockAuthorized(true);
          showToast?.('Autorización Master aprobada para facturar productos con stock 0', 'success');
          setIsConditionModalOpen(true);
        }}
      />

      {/* Modal de Impresión de Factura Emitida */}
      <InvoicePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        factura={lastEmittedInvoice}
        empresa={empresa}
      />

      {/* MODAL DEDICADO: CONFIGURACIÓN DE COMPROBANTES DE RETENCIÓN (IVA & ISLR) */}
      {isRetencionModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/20 rounded-xl border border-amber-500/40 text-amber-400">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wide">Comprobantes de Retención Fiscal</h3>
                  <p className="text-[11px] text-slate-300">Datos emitidos por el Cliente (Contribuyente Especial - SENIAT)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRetencionModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Bloque Retención IVA */}
              <div className={`p-4 rounded-xl border transition ${
                applyRetIva ? 'bg-amber-50/50 border-amber-200 ring-1 ring-amber-200' : 'bg-slate-50 border-slate-200 opacity-70'
              }`}>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs select-none">
                    <input
                      type="checkbox"
                      checked={applyRetIva}
                      onChange={(e) => setApplyRetIva(e.target.checked)}
                      className="rounded text-amber-600 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-slate-900 font-black">Retención IVA (Providencia 0049)</span>
                  </label>
                  {applyRetIva && (
                    <div className="flex items-center gap-2">
                      <select
                        value={retIvaPercent}
                        onChange={(e) => setRetIvaPercent(parseInt(e.target.value, 10))}
                        className="bg-white border border-amber-300 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value={75}>75% IVA</option>
                        <option value={100}>100% IVA</option>
                      </select>
                      <span className="font-mono font-black text-amber-700 text-xs">
                        -{formatMoney(totals.retIvaMonto, currency)}
                      </span>
                    </div>
                  )}
                </div>

                {applyRetIva ? (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-200/80">
                    <div>
                      <label className="text-[10px] font-black uppercase text-amber-950 block mb-1">
                        Nº Comprobante IVA *
                      </label>
                      <input
                        type="text"
                        value={retIvaNumero}
                        onChange={(e) => setRetIvaNumero(e.target.value)}
                        placeholder="Ej: 20260900000012"
                        className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-amber-950 block mb-1">
                        Fecha Comprobante IVA *
                      </label>
                      <input
                        type="date"
                        value={retIvaFecha}
                        onChange={(e) => setRetIvaFecha(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono text-slate-900 outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">Active esta casilla si el cliente retiene IVA sobre esta factura.</p>
                )}
              </div>

              {/* Bloque Retención ISLR */}
              <div className={`p-4 rounded-xl border transition ${
                applyRetIslr ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-slate-50 border-slate-200 opacity-70'
              }`}>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 text-xs select-none">
                    <input
                      type="checkbox"
                      checked={applyRetIslr}
                      onChange={(e) => setApplyRetIslr(e.target.checked)}
                      className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-slate-900 font-black">Retención ISLR (Decreto 1808)</span>
                  </label>
                  {applyRetIslr && (
                    <div className="flex items-center gap-2">
                      <select
                        value={retIslrPercent}
                        onChange={(e) => setRetIslrPercent(parseFloat(e.target.value))}
                        className="bg-white border border-indigo-300 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value={1}>1% ISLR</option>
                        <option value={2}>2% ISLR</option>
                        <option value={3}>3% ISLR</option>
                        <option value={5}>5% ISLR</option>
                      </select>
                      <span className="font-mono font-black text-indigo-700 text-xs">
                        -{formatMoney(totals.retIslrMonto, currency)}
                      </span>
                    </div>
                  )}
                </div>

                {applyRetIslr ? (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-indigo-200/80">
                    <div>
                      <label className="text-[10px] font-black uppercase text-indigo-950 block mb-1">
                        Nº Comprobante ISLR *
                      </label>
                      <input
                        type="text"
                        value={retIslrNumero}
                        onChange={(e) => setRetIslrNumero(e.target.value)}
                        placeholder="Ej: 20260900000015"
                        className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-indigo-950 block mb-1">
                        Fecha Comprobante ISLR *
                      </label>
                      <input
                        type="date"
                        value={retIslrFecha}
                        onChange={(e) => setRetIslrFecha(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-mono text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">Active esta casilla si el cliente aplica retención de ISLR.</p>
                )}
              </div>

              {/* Nota Informativa */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                <Info size={15} className="text-blue-600 shrink-0 mt-0.5" />
                <p>
                  Estos datos serán incorporados en los libros fiscales (Libro de Ventas SENIAT) inmediatamente debajo de la factura correspondiente para auditoría tributaria oficial.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRetencionModalOpen(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition cursor-pointer"
              >
                Aceptar y Guardar Comprobantes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SELECCIÓN DE PRECIOS ESTABLECIDOS EN INVENTARIO */}
      {/* ========================================================================= */}
      {priceModalItemIndex !== null && items[priceModalItemIndex] && (() => {
        const item = items[priceModalItemIndex];
        const prod = products.find(p => p.id === item.producto_id || (item.codigo && p.codigo && p.codigo.trim().toLowerCase() === item.codigo.trim().toLowerCase()));
        if (!prod) return null;

        const tiers = getAvailablePriceTiers(prod);

        return (
          <div className="fixed inset-0 z-[500] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col">
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
                    <Tag size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black tracking-tight text-white">Precios Establecidos en Inventario</h3>
                    <p className="text-xs text-indigo-200 font-semibold mt-0.5 truncate max-w-xs" title={prod.nombre}>
                      {prod.codigo ? `[${prod.codigo}] ` : ''}{prod.nombre}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPriceModalItemIndex(null)}
                  className="w-8 h-8 rounded-full hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Subheader: Stock e información */}
              <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <span>Stock disponible:</span>
                  <span className={`font-mono font-black px-2 py-0.5 rounded text-[11px] ${
                    Number(prod.stock_actual) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {prod.stock_actual} {prod.unidad_medida || 'unid.'}
                  </span>
                </div>
                <div className="text-slate-500 font-medium text-[11px]">
                  Moneda actual: <b className="text-slate-800 font-bold">{currency === 'USD' ? 'Dólares ($)' : 'Bolívares (Bs.)'}</b>
                </div>
              </div>

              {/* Body: Lista de Tarifas de Precios Establecidos */}
              <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
                <p className="text-xs text-slate-500 mb-2 font-medium">
                  Seleccione una de las tarifas oficiales establecidas para este producto para aplicarla al renglón:
                </p>

                {tiers.map((tier) => {
                  const isSelected = item.tipo_precio === tier.id;
                  const priceUSD = tier.priceUSD;
                  const priceBs = exchangeRate > 0 ? priceUSD * exchangeRate : 0;
                  const mainPriceFormatted = currency === 'USD' ? `$${priceUSD.toFixed(2)}` : `Bs. ${priceBs.toFixed(2)}`;
                  const secondaryPriceFormatted = currency === 'USD' ? `Equiv: Bs. ${priceBs.toFixed(2)}` : `Equiv: $${priceUSD.toFixed(2)}`;

                  let tierBadgeColor = 'bg-indigo-100 text-indigo-800 border-indigo-200';
                  let tierDescription = 'Precio de venta al público estándar';

                  if (tier.id === 'mayor') {
                    tierBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
                    tierDescription = 'Tarifa especial para compras al mayor';
                  } else if (tier.id === 'vip') {
                    tierBadgeColor = 'bg-purple-100 text-purple-800 border-purple-200';
                    tierDescription = 'Tarifa preferencial para clientes VIP';
                  } else if (tier.id === 'minimo') {
                    tierBadgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
                    tierDescription = 'Precio piso de venta mínimo autorizado';
                  }

                  return (
                    <div
                      key={tier.id}
                      onClick={() => {
                        handlePriceTierChange(priceModalItemIndex, tier.id);
                        setUnlockedPriceRows(prev => ({ ...prev, [priceModalItemIndex]: false }));
                        setPriceModalItemIndex(null);
                        showToast?.(`Tarifa "${tier.label}" seleccionada (${mainPriceFormatted})`, 'success');
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-200 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition ${
                          isSelected ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700'
                        }`}>
                          {isSelected ? <Check size={16} /> : <Tag size={15} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs text-slate-900">{tier.label}</span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${tierBadgeColor}`}>
                              {tier.id.toUpperCase()}
                            </span>
                            {isSelected && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-0.5">
                                <Check size={10} /> Activo
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{tierDescription}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-sm text-slate-900 group-hover:text-indigo-600 transition">
                          {mainPriceFormatted}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {secondaryPriceFormatted}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Opción de Desbloqueo de Precio Manual con Clave de Supervisor */}
                <div className="pt-2">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Lock size={14} className="text-slate-400 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-700 text-xs">¿Desea ingresar un precio manual libre?</p>
                        <p className="text-[10px] text-slate-500">Requiere clave especial de operaciones / supervisor.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const targetIdx = priceModalItemIndex;
                        setPriceModalItemIndex(null);
                        setPriceUnlockTargetIndex(targetIdx);
                        setIsPriceUnlockAuthOpen(true);
                      }}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                    >
                      <KeyRound size={12} />
                      <span>Desbloquear con Clave</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-3.5 px-5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setPriceModalItemIndex(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL: AUTORIZACIÓN PARA DESBLOQUEO DE PRECIO MANUAL CON CLAVE */}
      {/* ========================================================================= */}
      <MasterAuthModal
        isOpen={isPriceUnlockAuthOpen}
        onClose={() => {
          setIsPriceUnlockAuthOpen(false);
          setPriceUnlockTargetIndex(null);
        }}
        title="Desbloqueo de Precio Manual"
        subtitle="Se requiere Clave Especial de Operaciones / Supervisor"
        actionName="Modificación Manual de Precio Unitario"
        actionDetails={
          priceUnlockTargetIndex !== null && items[priceUnlockTargetIndex]
            ? `Renglón #${priceUnlockTargetIndex + 1}: ${items[priceUnlockTargetIndex].descripcion || items[priceUnlockTargetIndex].codigo || 'Artículo'} | Precio actual: ${currency === 'USD' ? '$' : 'Bs.'}${Number(items[priceUnlockTargetIndex].precio_unitario || 0).toFixed(2)}`
            : undefined
        }
        onSuccess={() => {
          if (priceUnlockTargetIndex !== null) {
            setUnlockedPriceRows(prev => ({ ...prev, [priceUnlockTargetIndex]: true }));
            showToast?.(`Precio del renglón #${priceUnlockTargetIndex + 1} desbloqueado. Ahora puede editar el precio manualmente.`, 'success');
          }
          setIsPriceUnlockAuthOpen(false);
          setPriceUnlockTargetIndex(null);
        }}
      />

      </div>
    </div>
  );
}