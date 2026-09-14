import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, ArrowLeft, Search, Plus, Trash2, CheckCircle2, 
  Save, AlertTriangle, User, Building2, DollarSign, Calendar, 
  BookOpen, Eye, X, HelpCircle, Package, ShieldCheck, ShieldAlert, KeyRound,
  CreditCard, Landmark, Check, CornerDownRight, Coins, 
  Clock, ArrowRight, Sparkles, RefreshCw, Mail, Phone, Lock, Printer
} from 'lucide-react';
import BackButton from '../components/common/BackButton';
import CuentaSelectorTrigger from '../components/common/CuentaSelectorTrigger';
import CuentaContableModal from '../components/common/CuentaContableModal';
import TasaCambioModal from '../components/invoicing/TasaCambioModal';
import MasterAuthModal from '../components/common/MasterAuthModal';
import InvoicePrintModal from '../components/invoicing/InvoicePrintModal';
import { getTasaForDate, fetchLiveBcvRate } from '../services/exchangeRateService';
import { dbFetchTerminalesPos, dbFetchLotesPos, dbSaveLotePos } from '../services/db';
import { FacturaVentaModel, FacturaItemModel, ProductModel, TerminalPosModel, LotePosTransaccion } from '../types/database';
import { formatDate } from '../utils/dateUtils';

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

  // Document Info
  const [docType, setDocType] = useState<'factura' | 'nota_entrega' | 'nota_credito' | 'nota_debito'>('factura');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(() => {
    const today = new Date().toISOString().split('T')[0];
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
    const today = new Date().toISOString().split('T')[0];
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

  // Artículos con stock 0 o insuficiente
  const zeroStockItems = useMemo(() => {
    return items.filter(item => {
      if (!item.producto_id) return false;
      const prod = products.find(p => p.id === item.producto_id);
      if (!prod) return false;
      const stock = Number(prod.stock_actual) || 0;
      const qty = Number(item.cantidad) || 0;
      return stock <= 0 || qty > stock;
    });
  }, [items, products]);

  // Opciones de Retenciones e IGTF (Leyes Tributarias Venezolanas - SENIAT)
  const [applyRetIva, setApplyRetIva] = useState(false);
  const [retIvaPercent, setRetIvaPercent] = useState<number>(75); // 75% o 100% (Providencia SNAT/2015/0049)

  const [applyRetIslr, setApplyRetIslr] = useState(false);
  const [retIslrPercent, setRetIslrPercent] = useState<number>(2); // 2%, 5%, 1%, 3% (Decreto 1808)

  const [applyIgtf, setApplyIgtf] = useState(false);
  const [igtfPercent, setIgtfPercent] = useState<number>(3); // 3% Ley IGTF 2022

  // Modal de Cobranza (para facturas de Contado)
  const [isCobranzaModalOpen, setIsCobranzaModalOpen] = useState(false);
  const [cobranzaForm, setCobranzaForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
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
    dbFetchTerminalesPos().then(res => {
      if (res && res.length > 0) setTerminalesPos(res);
    });
  }, []);

  // Modal de Asiento Contable
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [pendingVoucher, setPendingVoucher] = useState<any>(null);

  // Generar correlativo inicial
  useEffect(() => {
    const prefix = docType === 'nota_credito' ? 'NC-' : docType === 'nota_debito' ? 'ND-' : docType === 'nota_entrega' ? 'NE-' : (configContable?.prefijoFactura || 'FAC-');
    const baseCorrelativo = configContable?.correlativoFactura || '00001';
    setInvoiceNumber(`${prefix}${baseCorrelativo}`);
    setControlNumber(`00-${Math.floor(100000 + Math.random() * 900000)}`);
  }, [configContable, docType]);

  // Recalcular vencimiento al cambiar días de crédito o fecha de emisión
  useEffect(() => {
    const base = new Date(issueDate);
    base.setDate(base.getDate() + Number(creditDays || 0));
    setCalculatedDueDate(base.toISOString().split('T')[0]);
  }, [issueDate, creditDays]);

  // Atajos de teclado estilo ERP (F2: Emitir Factura, F3: Buscar Catálogo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        const formEl = document.getElementById('invoice-main-form') as HTMLFormElement;
        if (formEl) formEl.requestSubmit();
      } else if (e.key === 'F3') {
        e.preventDefault();
        handleOpenProductModal(null);
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
      const lineSubtotal = (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0);
      subtotal += lineSubtotal;
      if (item.exento) {
        montoExento += lineSubtotal;
      } else {
        baseImponible += lineSubtotal;
        ivaMonto += lineSubtotal * 0.16;
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

  const handleSelectProductFromModal = (prod: ProductModel) => {
    let targetIndex = activeItemIndexForProduct;

    // Si no había índice activo (ej. botón global "+ Buscar en Catálogo"), buscamos una línea vacía o agregamos una nueva
    if (targetIndex === null || targetIndex < 0 || targetIndex >= items.length) {
      const emptyIdx = items.findIndex(it => !it.producto_id && !it.descripcion && (it.precio_unitario === 0 || !it.precio_unitario));
      if (emptyIdx !== -1) {
        targetIndex = emptyIdx;
      } else {
        targetIndex = items.length;
      }
    }

    setItems(prev => {
      const updated = [...prev];
      const existingLine = targetIndex !== null && targetIndex < updated.length ? updated[targetIndex] : null;
      const qty = existingLine ? (Number(existingLine.cantidad) || 1) : 1;

      // Calcular precio unitario según la moneda de emisión (USD o VES)
      let price = Number(prod.precio_venta) || 0;
      if (currency === 'VES' && exchangeRate > 0) {
        price = price * exchangeRate;
      }

      const lineSubtotal = qty * price;
      const isExempt = !prod.aplica_iva;
      const iva = isExempt ? 0 : lineSubtotal * 0.16;
      const cleanName = (prod.nombre || '').replace(/\s*\(E\)\s*$/i, '').trim();
      const itemDescription = isExempt ? `${cleanName} (E)` : cleanName;

      const newItem: FacturaItemModel = {
        id: existingLine?.id || `item_${Date.now()}_${targetIndex}`,
        producto_id: prod.id,
        codigo: prod.codigo,
        descripcion: itemDescription,
        cantidad: qty,
        precio_unitario: price,
        exento: isExempt,
        subtotal: lineSubtotal,
        iva_monto: iva,
        total: lineSubtotal + iva,
        cuenta_ingreso_id: prod.cuenta_venta_id || '4.1.01.001',
        cuenta_costo_id: prod.cuenta_costo_id || '5.1.01.001',
        cuenta_inventario_id: prod.cuenta_inventario_id || '1.1.04.001'
      };

      if (targetIndex !== null && targetIndex < updated.length) {
        updated[targetIndex] = newItem;
      } else {
        updated.push(newItem);
      }
      return updated;
    });

    setIsProductModalOpen(false);
    setActiveItemIndexForProduct(null);
    showToast?.(`Artículo "${prod.nombre}" añadido a la factura`, 'success');
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
          // AL CAMBIAR A BOLÍVARES: Tomar el precio del producto y multiplicarlo por la tasa de cambio
          if (prod && Number(prod.precio_venta) > 0) {
            newUnitPrice = Number(prod.precio_venta) * exchangeRate;
          } else if (newUnitPrice > 0 && exchangeRate > 0) {
            newUnitPrice = newUnitPrice * exchangeRate;
          }
        } else {
          // AL CAMBIAR A DÓLARES: Restaurar el precio base del producto en USD o dividir por la tasa
          if (prod && Number(prod.precio_venta) > 0) {
            newUnitPrice = Number(prod.precio_venta);
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
        if (prod && Number(prod.precio_venta) > 0) {
          newUnitPrice = Number(prod.precio_venta) * rate;
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
      id: `ct_${Date.now()}`,
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

      const qty = Number(item.cantidad) || 0;
      const price = Number(item.precio_unitario) || 0;
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

    if (items.some(i => !i.descripcion.trim() || i.cantidad <= 0)) {
      showToast?.('Complete la descripción y cantidad válida en cada línea', 'error');
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
      setApplyRetIslr(false);
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
      // Si es crédito, armar el comprobante directo con CxC y abrir el modal contable
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

  // Proceder desde Cobranza al Asiento Contable
  const handleConfirmCobranzaToVoucher = () => {
    const totalPagado = cobranzaForm.pagos.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0);
    if (cobranzaForm.pagos.length === 0 || totalPagado <= 0) {
      showToast?.('Ingrese al menos un pago con monto válido en la cobranza', 'error');
      return;
    }

    setIsCobranzaModalOpen(false);
    buildAndShowVoucher('contado');
  };

  // =========================================================================
  // PASO 3: Construir Asiento Contable y Mostrar Previsualización
  // =========================================================================
  const buildAndShowVoucher = (condition: 'contado' | 'credito') => {
    const mainCustomerAccount = configContable?.cuentaCxc || '1.1.02.001';
    const mainSalesAccount = configContable?.cuentaVentas || '4.1.01.001';
    const mainTaxAccount = configContable?.cuentaDebitoFiscal || '2.1.02.001';

    const linesVoucher: any[] = [];
    const totalAmount = totals.totalUSD;
    const netoAmount = totals.netoCobrarUSD;

    if (condition === 'credito') {
      // Debe: CxC Clientes (por el monto neto a percibir de la factura en USD)
      linesVoucher.push({
        id: `vl_cxc`,
        cuentaId: mainCustomerAccount,
        nombreCuenta: `Cuentas por Cobrar Clientes (${customerName})`,
        descripcion: `Factura a crédito ${invoiceNumber} - Venc. ${formatDate(calculatedDueDate)}`,
        debe: netoAmount,
        haber: 0
      });
    } else {
      // Debe: Banco(s) o Cuenta Puente POS según pagos registrados en el modal de cobranza
      cobranzaForm.pagos.forEach((pago, pIdx) => {
        const isPos = pago.metodoPago === 'Punto de Venta';
        const bank = bancos.find(b => b.id === pago.bancoId);
        const term = terminalesPos.find(t => t.id === pago.terminalId);
        
        const accountId = isPos
          ? (term?.cuenta_transitoria_id || '1.1.01.03')
          : (bank?.cuenta_contable_id || configContable?.cuentaBancos || '1.1.01.004');

        const accountName = isPos
          ? `Puntos de Venta por Liquidar (${term?.nombre || 'Tarjetas'})`
          : (bank ? `${bank.banco} (${bank.moneda})` : 'Efectivo en Bancos');

        const pagoMonto = parseFloat(pago.monto) || (netoAmount / cobranzaForm.pagos.length);

        linesVoucher.push({
          id: `vl_bnk_${pIdx}`,
          cuentaId: accountId,
          nombreCuenta: accountName,
          descripcion: isPos 
            ? `Cobro POS ${term?.nombre || 'Punto'} Fac ${invoiceNumber} - Voucher: ${pago.referencia || 'S/R'}`
            : `Cobro contado Fac ${invoiceNumber} - Ref: ${pago.referencia || 'S/R'}`,
          debe: pagoMonto,
          haber: 0
        });
      });
    }

    // Debe: Anticipo Retención de IVA si aplica (Providencia SNAT/2015/0049) en USD
    if (applyRetIva && totals.retIvaMontoUSD > 0) {
      linesVoucher.push({
        id: `vl_ret_iva`,
        cuentaId: configContable?.cuentaRetencionIvaVentas || '1.1.02.003',
        nombreCuenta: `Anticipo IVA Retenido por Clientes (${retIvaPercent}%)`,
        descripcion: `Retención IVA Providencia 0049 Fac ${invoiceNumber}`,
        debe: totals.retIvaMontoUSD,
        haber: 0
      });
    }

    // Debe: Anticipo Retención de ISLR si aplica (Decreto 1808) en USD
    if (applyRetIslr && totals.retIslrMontoUSD > 0) {
      linesVoucher.push({
        id: `vl_ret_islr`,
        cuentaId: configContable?.cuentaRetencionIslrVentas || '1.1.02.004',
        nombreCuenta: `Anticipo ISLR Retenido por Clientes (${retIslrPercent}%)`,
        descripcion: `Retención ISLR Dto 1808 Fac ${invoiceNumber}`,
        debe: totals.retIslrMontoUSD,
        haber: 0
      });
    }

    // Haber: Ventas por el subtotal neto en USD
    linesVoucher.push({
      id: `vl_vta`,
      cuentaId: mainSalesAccount,
      nombreCuenta: 'Ventas de Mercancías',
      descripcion: `Ingreso por venta Factura ${invoiceNumber}`,
      debe: 0,
      haber: totals.subtotalUSD
    });

    // Haber: IVA Débito Fiscal si aplica en USD
    if (totals.ivaMontoUSD > 0) {
      linesVoucher.push({
        id: `vl_iva`,
        cuentaId: mainTaxAccount,
        nombreCuenta: 'IVA Débito Fiscal (16%)',
        descripcion: `IVA 16% Factura ${invoiceNumber}`,
        debe: 0,
        haber: totals.ivaMontoUSD
      });
    }

    // Haber: IGTF Percibido por Pagar si aplica (Ley IGTF 2022) en USD
    if (applyIgtf && totals.igtfMontoUSD > 0) {
      linesVoucher.push({
        id: `vl_igtf`,
        cuentaId: configContable?.cuentaIgtfPorPagar || '2.1.03.002',
        nombreCuenta: 'IGTF Percibido por Pagar (3%)',
        descripcion: `IGTF 3% Ley Pagos Divisas Fac ${invoiceNumber}`,
        debe: 0,
        haber: totals.igtfMontoUSD
      });
    }

    const voucher = {
      id: `comp_${Date.now()}`,
      numero: `AS-FAC-${invoiceNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
      fecha: issueDate,
      concepto: `Registro de Factura de Venta ${invoiceNumber} a ${customerName} (${condition.toUpperCase()})`,
      total: totalAmount,
      lineas: linesVoucher,
      estado: 'Contabilizado',
      modulo: 'facturacion'
    };

    setPendingVoucher(voucher);
    setIsVoucherModalOpen(true);
  };

  // =========================================================================
  // PASO 4: Confirmación Final y Guardado Transaccional
  // =========================================================================
  const handleFinalSaveInvoice = async () => {
    try {
      const factId = `fac_${Date.now()}`;
      const cxcDocId = `cxc_${Date.now()}`;
      const voucherId = pendingVoucher ? pendingVoucher.id : `comp_${Date.now()}`;

      let effectiveCustomerId = selectedCustomerId;
      let existingContact = contactos.find(c => 
        (selectedCustomerId && c.id === selectedCustomerId) ||
        (customerRif && c.taxId?.trim().toLowerCase() === customerRif.trim().toLowerCase()) ||
        (customerName && c.name?.trim().toLowerCase() === customerName.trim().toLowerCase())
      );

      // Si el cliente no existe aún en la lista de contactos, crearlo automáticamente con cuentas contables NIIF
      if (!existingContact && customerName.trim()) {
        const newContactId = `cli_${Date.now()}`;
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
        onSave?.('contactos', newContact);
        effectiveCustomerId = newContactId;
        existingContact = newContact;
      } else if (existingContact) {
        effectiveCustomerId = existingContact.id;
      }

      // Preparar items de la factura: base en USD y valores equivalentes en Bolívares
      const isVes = currency === 'VES' && exchangeRate > 0;
      const itemsToSave: FacturaItemModel[] = items.map(item => {
        const rawUnitPrice = Number(item.precio_unitario) || 0;
        const unitPriceUSD = isVes ? (rawUnitPrice / exchangeRate) : rawUnitPrice;
        const unitPriceBs = isVes ? rawUnitPrice : (rawUnitPrice * exchangeRate);

        const subtotalUSD = isVes ? (Number(item.subtotal) / exchangeRate) : Number(item.subtotal);
        const subtotalBs = isVes ? Number(item.subtotal) : (Number(item.subtotal) * exchangeRate);

        const ivaUSD = isVes ? (Number(item.iva_monto) / exchangeRate) : Number(item.iva_monto);
        const ivaBs = isVes ? Number(item.iva_monto) : (Number(item.iva_monto) * exchangeRate);

        const totalUSD = isVes ? (Number(item.total) / exchangeRate) : Number(item.total);
        const totalBs = isVes ? Number(item.total) : (Number(item.total) * exchangeRate);

        return {
          ...item,
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

      // 1. Guardar la Factura (La moneda principal siempre es USD, con moneda de presentación)
      const newFactura: FacturaVentaModel = {
        id: factId,
        empresa_id: '',
        numero: invoiceNumber.trim().toUpperCase(),
        control_numero: controlNumber.trim(),
        tipo_documento: docType,
        condicion: selectedCondition,
        dias_credito: selectedCondition === 'credito' ? creditDays : 0,
        cliente_id: effectiveCustomerId || selectedCustomerId || `ct_${Date.now()}`,
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
        retencion_islr_porcentaje: applyRetIslr ? retIslrPercent : 0,
        retencion_islr_monto: Number(totals.retIslrMontoUSD.toFixed(2)),
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
        notas: notes.trim(),
        created_at: new Date().toISOString()
      };

      onSave?.('facturasVenta', newFactura);

      // 2. Descontar Stock de Inventario y Registrar Kardex
      items.forEach(item => {
        if (item.producto_id) {
          const originalProd = products.find(p => p.id === item.producto_id);
          if (originalProd) {
            const currentStock = Number(originalProd.stock_actual) || 0;
            const cantFacturada = Number(item.cantidad) || 0;
            // Permitir stock resultante negativo cuando se autorizó con stock 0
            const newStock = currentStock - cantFacturada;

            onSave?.('products', {
              ...originalProd,
              stock_actual: newStock,
              updated_at: new Date().toISOString()
            });

            const fueSinStock = currentStock <= 0 || (currentStock - cantFacturada < 0);
            onSave?.('movimientosInventario', {
              id: `mov_vta_${Date.now()}_${item.id}`,
              empresa_id: '',
              producto_id: originalProd.id,
              producto_nombre: originalProd.nombre,
              producto_codigo: originalProd.codigo,
              tipo: 'venta',
              cantidad: cantFacturada,
              stock_anterior: currentStock,
              stock_resultante: newStock,
              costo_unitario: originalProd.costo_unitario,
              referencia: `Venta Factura ${newFactura.numero}${fueSinStock ? ' [Stock 0 Aut. Master]' : ''}`,
              fecha: issueDate,
              usuario: 'Administrador',
              created_at: new Date().toISOString()
            });
          }
        }
      });

      // 3. Crear CxC si es a Crédito asociada al cliente (Moneda base: USD)
      if (selectedCondition === 'credito') {
        const montoCxCUSD = Number(totals.netoCobrarUSD.toFixed(2));
        const montoCxCBs = Number(totals.netoCobrarBs.toFixed(2));

        onSave?.('cxc', {
          id: cxcDocId,
          factura_id: newFactura.numero,
          factura: newFactura.numero,
          numero: newFactura.numero,
          factura_db_id: newFactura.id,
          cliente_id: effectiveCustomerId || newFactura.cliente_id,
          cliente: newFactura.cliente_nombre,
          cliente_nombre: newFactura.cliente_nombre,
          cliente_rif: newFactura.cliente_rif,
          taxId: newFactura.cliente_rif,
          categoria: 'clientes',
          fecha: issueDate,
          fecha_emision: issueDate,
          vencimiento: calculatedDueDate,
          fecha_vencimiento: calculatedDueDate,
          descripcion: `Factura de Venta ${newFactura.numero}`,
          tipo: 'factura',
          total: montoCxCUSD,
          monto: montoCxCUSD,
          monto_total: montoCxCUSD,
          saldo: montoCxCUSD,
          saldo_pendiente: montoCxCUSD,
          monto_bs: montoCxCBs,
          saldo_bs: montoCxCBs,
          moneda: 'USD',
          tasa: exchangeRate,
          tasa_cambio: exchangeRate,
          estado: 'pendiente',
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
        });
      }

      // 4. Registrar Cobranza y Movimiento Bancario o Lote POS si fue de Contado
      if (selectedCondition === 'contado') {
        cobranzaForm.pagos.forEach(async (pago, idx) => {
          const isPos = pago.metodoPago === 'Punto de Venta';
          const pagoMontoNum = parseFloat(pago.monto) || totals.netoCobrarUSD;
          const pagoMontoBsNum = parseFloat(pago.montoBs) || totals.netoCobrarBs;

          if (isPos) {
            // Acumular en el Lote Abierto del Terminal POS
            const termId = pago.terminalId || (terminalesPos.length > 0 ? terminalesPos[0].id : 'pos_term_1');
            const termObj = terminalesPos.find(t => t.id === termId);
            
            try {
              const existingLotes = await dbFetchLotesPos();
              let openLote = existingLotes.find((l: any) => l.terminal_id === termId && l.estado === 'abierto');
              if (!openLote) {
                openLote = {
                  id: `lote_${Date.now()}_${idx}`,
                  terminal_id: termId,
                  terminal_nombre: termObj ? termObj.nombre : 'Punto de Venta',
                  banco_id: termObj ? termObj.banco_id : (bancos.length > 0 ? bancos[0].id : ''),
                  lote_numero: 'EN CURSO',
                  fecha_apertura: issueDate,
                  total_operaciones: 0,
                  monto_bruto_sistema: 0,
                  monto_bruto_ticket: 0,
                  diferencia: 0,
                  comision_monto: 0,
                  monto_neto_banco: 0,
                  estado: 'abierto',
                  transacciones: []
                };
              }

              const newTx: LotePosTransaccion = {
                id: `tx_pos_${Date.now()}_${idx}`,
                factura_id: newFactura.id,
                factura_numero: newFactura.numero,
                cliente_nombre: customerName,
                referencia: pago.referencia || 'VOUCHER',
                monto_bs: pagoMontoBsNum,
                monto_usd: pagoMontoNum,
                hora: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
                fecha: issueDate
              };

              const updatedLote = {
                ...openLote,
                total_operaciones: (openLote.transacciones?.length || 0) + 1,
                monto_bruto_sistema: Number(((openLote.monto_bruto_sistema || 0) + pagoMontoBsNum).toFixed(2)),
                monto_bruto_usd: Number(((openLote.monto_bruto_usd || 0) + pagoMontoNum).toFixed(2)),
                transacciones: [...(openLote.transacciones || []), newTx],
                updated_at: new Date().toISOString()
              };

              await dbSaveLotePos(updatedLote);
              onSave?.('lotesPos', updatedLote);
            } catch (err) {
              console.error("Error acumulando en lote POS:", err);
            }
          } else {
            const bank = bancos.find(b => b.id === pago.bancoId);
            if (bank) {
              const isBankVES = bank.moneda === 'VES' || bank.moneda === 'Bs';
              onSave?.('movimientosBancos', {
                id: `mov_bnk_${Date.now()}_${idx}`,
                banco_id: bank.id,
                fecha: issueDate,
                ref: pago.referencia || newFactura.numero,
                descripcion: `Ingreso Cobranza Factura ${newFactura.numero} (${customerName}) - ${pago.metodoPago}`,
                tipo: 'ingreso',
                monto: isBankVES ? pagoMontoBsNum : pagoMontoNum,
                tasa: exchangeRate,
                estado: 'conciliado',
                comprobante_id: voucherId,
                created_at: new Date().toISOString()
              });
            }
          }
        });
      }

      // 5. Guardar Asiento Contable
      if (pendingVoucher) {
        onSave?.('comprobantes', pendingVoucher);
      }

      // 6. Incrementar correlativo
      let nextCorrelativo = '00002';
      if (configContable) {
        const numPart = parseInt(configContable.correlativoFactura || '1', 10);
        nextCorrelativo = String(numPart + 1).padStart(5, '0');
        onSave?.('configContable', {
          ...configContable,
          correlativoFactura: nextCorrelativo
        });
      }

      showToast?.(`Factura ${newFactura.numero} emitida exitosamente (${selectedCondition.toUpperCase()})`, 'success');
      setIsVoucherModalOpen(false);

      // Guardar última factura emitida para permitir impresión o consulta
      setLastEmittedInvoice(newFactura);

      // Preparar automáticamente la siguiente factura continua
      const prefix = docType === 'nota_credito' ? 'NC-' : docType === 'nota_debito' ? 'ND-' : docType === 'nota_entrega' ? 'NE-' : (configContable?.prefijoFactura || 'FAC-');
      setInvoiceNumber(`${prefix}${nextCorrelativo}`);
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
      setApplyRetIslr(false);
      setApplyIgtf(false);
      setIsZeroStockAuthorized(false);
    } catch (err: any) {
      console.error("Error guardando factura:", err);
      showToast?.('Error al emitir la factura', 'error');
    }
  };

  return (
    <div className="px-2 sm:px-4 lg:px-6 pt-1 pb-16 max-w-[1400px] mx-auto animate-in fade-in duration-300 text-slate-800">
      
      {/* ========================================================================= */}
      {/* AVISO DE FACTURA EMITIDA EXITOSAMENTE (MODO CONTINUO) */}
      {/* ========================================================================= */}
      {lastEmittedInvoice && (
        <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-2xl p-3.5 mb-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-emerald-950 animate-in fade-in slide-in-from-top-2 duration-300 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-black text-sm text-emerald-950">
                  ¡Factura {lastEmittedInvoice.numero} emitida exitosamente!
                </h4>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                  {lastEmittedInvoice.condicion?.toUpperCase()}
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-800">
                  Total: ${Number(lastEmittedInvoice.total || 0).toFixed(2)} (Bs. {Number(lastEmittedInvoice.total_bs || 0).toFixed(2)})
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                Comprobante e inventario actualizados. Formulario reiniciado y listo para facturar el siguiente documento ({invoiceNumber}).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer size={13} />
              <span>Imprimir Factura</span>
            </button>
            <button
              type="button"
              onClick={() => setLastEmittedInvoice(null)}
              className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <span>Ocultar Aviso</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/invoicing')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <span>Volver al Listado</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. BARRA SUPERIOR ERP (COMMAND TOOLBAR) */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 text-white px-3 sm:px-5 py-2.5 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 mb-3">
        {/* Izquierda: Volver, Tipo Documento, Número y Conmutador de Moneda */}
        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
          <BackButton to="/invoicing" label="Listado" />

          <div className="h-5 w-px bg-slate-700 hidden sm:block"></div>

          {/* Selector Tipo de Documento */}
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <FileText size={15} />
            </div>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as any)}
              className="bg-slate-800 text-white font-black text-xs px-2.5 py-1.5 rounded-xl border border-slate-700 outline-none cursor-pointer hover:border-indigo-500 transition"
            >
              <option value="factura">FACTURA DE VENTA</option>
              <option value="nota_entrega">NOTA DE ENTREGA</option>
              <option value="nota_credito">NOTA DE CRÉDITO</option>
              <option value="nota_debito">NOTA DE DÉBITO</option>
            </select>
          </div>

          {/* Badge Número Correlativo */}
          <span className="font-mono text-xs font-black text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-xl border border-indigo-800/70">
            N° {invoiceNumber || '---'}
          </span>

          {/* Conmutador Multimoneda USD vs VES */}
          <div className="inline-flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => handleCurrencyChange('USD')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                currency === 'USD' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => handleCurrencyChange('VES')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                currency === 'VES' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Bs. (VES)
            </button>
          </div>

          {/* Tasa Oficial BCV con sincronización en vivo */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-xl border border-slate-700 text-[11px]">
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
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={() => buildAndShowVoucher(selectedCondition)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Previsualizar el Asiento Contable que generará esta factura"
          >
            <BookOpen size={13} className="text-indigo-400" />
            <span className="hidden sm:inline">Previsualizar</span> Asiento
          </button>
          <button
            type="button"
            onClick={handleResetForm}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
            title="Limpiar formulario y reiniciar documento"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
          <button
            type="submit"
            form="invoice-main-form"
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-500/25 transition cursor-pointer"
          >
            <Save size={14} />
            <span>EMITIR FACTURA (F2)</span>
          </button>
        </div>
      </div>

      <form id="invoice-main-form" onSubmit={handleStartEmission} className="space-y-3">
        
        {/* ========================================================================= */}
        {/* 2. ENCABEZADO ADMINISTRATIVO UNIFICADO (ESTILO ERP SAINT / GÁLAC) */}
        {/* ========================================================================= */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 text-xs">
            
            {/* SECCIÓN A: DATOS DE CONTROL Y EMISIÓN (4 COLS) */}
            <div className="md:col-span-4 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                <span className="font-black text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={13} className="text-indigo-600" />
                  Datos del Documento
                </span>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">SENIAT</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold text-[10px] uppercase mb-0.5">N° Factura *</label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-indigo-700 focus:border-indigo-600 outline-none uppercase text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold text-[10px] uppercase mb-0.5">N° Control</label>
                  <input
                    type="text"
                    placeholder="00-000000"
                    value={controlNumber}
                    onChange={(e) => setControlNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-semibold text-slate-700 focus:border-indigo-600 outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-bold text-[10px] uppercase mb-0.5">Fecha Emisión</label>
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:border-indigo-600 outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold text-[10px] uppercase mb-0.5">Tasa BCV (Bs./$)</label>
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
                    className="w-full px-2 py-1 bg-emerald-50 border border-emerald-300 rounded-lg font-mono font-black text-emerald-800 text-xs text-right focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN B: DATOS DEL CLIENTE / RECEPTOR (5 COLS) */}
            <div className="md:col-span-5 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                <span className="font-black text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <User size={13} className="text-indigo-600" />
                  Cliente / Facturado a:
                </span>
                <div className="flex items-center gap-1">
                  {selectedCustomerId ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsCustomerModalOpen(true)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-50 transition cursor-pointer"
                        title="Cambiar cliente"
                      >
                        Cambiar
                      </button>
                      <button
                        type="button"
                        onClick={handleClearCustomer}
                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 px-1.5 py-0.5 rounded hover:bg-rose-50 transition cursor-pointer"
                        title="Desvincular cliente"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsCustomerModalOpen(true)}
                        className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1"
                      >
                        <Search size={10} /> Buscar
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenNewCustomerModal}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1"
                      >
                        <Plus size={10} /> Nuevo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <label className="block text-slate-600 font-bold text-[10px] uppercase mb-0.5">RIF / Cédula *</label>
                  <input
                    type="text"
                    required
                    readOnly={Boolean(selectedCustomerId)}
                    placeholder="J-12345678-9"
                    value={customerRif}
                    onChange={(e) => setCustomerRif(e.target.value.toUpperCase())}
                    className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition ${
                      selectedCustomerId
                        ? 'bg-slate-100 border border-slate-200 text-slate-700 cursor-not-allowed'
                        : 'bg-white border border-slate-200 text-slate-900 focus:border-indigo-600 outline-none'
                    }`}
                  />
                </div>
                <div className="col-span-8">
                  <label className="block text-slate-600 font-bold text-[10px] uppercase mb-0.5">Razón Social / Nombre *</label>
                  <input
                    type="text"
                    required
                    readOnly={Boolean(selectedCustomerId)}
                    placeholder="Nombre o empresa del cliente"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold transition truncate ${
                      selectedCustomerId
                        ? 'bg-slate-100 border border-slate-200 text-slate-800 cursor-not-allowed'
                        : 'bg-white border border-slate-200 text-slate-900 focus:border-indigo-600 outline-none'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5">
                  <input
                    type="text"
                    readOnly={Boolean(selectedCustomerId)}
                    placeholder="Teléfono de contacto"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className={`w-full px-2 py-1 rounded-lg text-[11px] transition ${
                      selectedCustomerId
                        ? 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed'
                        : 'bg-white border border-slate-200 text-slate-700 focus:border-indigo-600 outline-none'
                    }`}
                  />
                </div>
                <div className="col-span-7">
                  <input
                    type="text"
                    readOnly={Boolean(selectedCustomerId)}
                    placeholder="Dirección fiscal del cliente"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className={`w-full px-2 py-1 rounded-lg text-[11px] transition truncate ${
                      selectedCustomerId
                        ? 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed'
                        : 'bg-white border border-slate-200 text-slate-700 focus:border-indigo-600 outline-none'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN C: CONDICIÓN DE PAGO & CRÉDITO DIRECTO (3 COLS) */}
            <div className="md:col-span-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200/70 pb-1.5">
                <span className="font-black text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard size={13} className="text-indigo-600" />
                  Condición de Pago
                </span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  selectedCondition === 'contado' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  {selectedCondition.toUpperCase()}
                </span>
              </div>

              {/* Selector Directo Contado vs Crédito */}
              <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-200/70 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSelectedCondition('contado')}
                  className={`py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                    selectedCondition === 'contado'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Contado
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCondition('credito')}
                  className={`py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${
                    selectedCondition === 'credito'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Crédito
                </button>
              </div>

              {selectedCondition === 'credito' ? (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Días Crédito:</span>
                    <div className="flex items-center gap-1">
                      {[15, 30, 45].map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setCreditDays(d)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
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
                        className="w-10 px-1 py-0.5 bg-white border border-slate-200 rounded text-center text-[10px] font-bold"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] bg-indigo-50/70 p-1.5 rounded-lg border border-indigo-100 font-bold">
                    <span className="text-indigo-800">Vencimiento:</span>
                    <span className="font-mono text-indigo-950">{formatDate(calculatedDueDate)}</span>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-emerald-50/80 border border-emerald-100 rounded-lg text-emerald-800 text-[11px] font-semibold space-y-1">
                  <div className="flex items-center gap-1 text-emerald-900 font-bold text-[10px] uppercase">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    <span>Cobro Inmediato</span>
                  </div>
                  <p className="text-[10px] text-emerald-700 leading-tight">
                    Al emitir se registrará el ingreso bancario o por caja/POS correspondiente.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. GRILLA DE RENGLONES / ARTÍCULOS (HIGH-DENSITY ERP GRID) */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          
          {/* Sub-barra de Grilla */}
          <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Package size={15} className="text-indigo-600" />
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
                  <span>{zeroStockItems.length} en Stock 0: {isZeroStockAuthorized ? 'AUTORIZADO' : 'REQUIERE CLAVE MASTER'}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => handleOpenProductModal(null)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                title="Abrir catálogo de inventario (F3)"
              >
                <Search size={13} />
                <span>Catálogo de Inventario (F3)</span>
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Añadir renglón vacío"
              >
                <Plus size={13} />
                <span>Fila Vacía</span>
              </button>
            </div>
          </div>

          {/* Tabla de Artículos: Renglones de la Factura en Media Pantalla con Scroll Interno */}
          <div className="overflow-x-auto overflow-y-auto max-h-[42vh] min-h-[190px] border-b border-slate-200/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 select-none sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="px-3 py-2 w-10 text-center">#</th>
                  <th className="px-3 py-2 w-28">Código / SKU</th>
                  <th className="px-3 py-2">Descripción / Concepto</th>
                  <th className="px-2 py-2 w-28 text-center">Stock</th>
                  <th className="px-2 py-2 w-20 text-center">Cant.</th>
                  <th className="px-2 py-2 w-28 text-right">P. Unitario ({currency === 'USD' ? '$' : 'Bs.'})</th>
                  <th className="px-2 py-2 w-20 text-center">IVA</th>
                  <th className="px-3 py-2 w-28 text-right">Total ({currency === 'USD' ? '$' : 'Bs.'})</th>
                  <th className="px-2 py-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((item, idx) => {
                  const selectedProd = products.find(p => p.id === item.producto_id);
                  const isStockWarning = selectedProd && (Number(item.cantidad) > Number(selectedProd.stock_actual));
                  const isZeroStock = selectedProd && selectedProd.stock_actual <= 0;

                  return (
                    <tr key={item.id} className="hover:bg-indigo-50/20 transition-colors">
                      {/* # Índice */}
                      <td className="px-3 py-2 text-center text-slate-400 font-mono font-bold text-[11px] align-middle">
                        {idx + 1}
                      </td>

                      {/* Código SKU */}
                      <td className="px-3 py-2 align-middle font-mono font-bold text-[11px] text-indigo-700">
                        {item.codigo || selectedProd?.codigo || (
                          <span className="text-slate-300 italic font-normal">S/C</span>
                        )}
                      </td>

                      {/* Descripción */}
                      <td className="px-3 py-2 align-middle">
                        {!item.producto_id ? (
                          <button
                            type="button"
                            onClick={() => handleOpenProductModal(idx)}
                            className="w-full px-2.5 py-1.5 bg-indigo-50/50 hover:bg-indigo-50 border border-dashed border-indigo-200 hover:border-indigo-400 rounded-lg text-left transition flex items-center justify-between gap-1.5 text-xs text-indigo-700 font-semibold cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <Search size={12} className="text-indigo-500" />
                              <span>Buscar o seleccionar artículo...</span>
                            </span>
                            <span className="text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.2 rounded">
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
                          type="number"
                          min="1"
                          step="1"
                          value={item.cantidad === 0 ? '' : item.cantidad}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            handleItemFieldChange(idx, 'cantidad', isNaN(val) ? 0 : val);
                          }}
                          onBlur={() => {
                            if (!item.cantidad || item.cantidad <= 0) {
                              handleItemFieldChange(idx, 'cantidad', 1);
                            }
                          }}
                          className="w-16 px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black text-center text-slate-900 focus:border-indigo-600 outline-none font-mono"
                        />
                      </td>

                      {/* Precio Unitario */}
                      <td className="px-2 py-2 text-right align-middle">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={item.precio_unitario === 0 ? '' : item.precio_unitario}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            handleItemFieldChange(idx, 'precio_unitario', isNaN(val) ? 0 : val);
                          }}
                          className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black text-right text-slate-900 focus:border-indigo-600 outline-none font-mono"
                        />
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
          <div className="p-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-medium">
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
              <span>Añadir otro renglón</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. SECCIÓN INFERIOR DUAL: RETENCIONES / NOTAS (IZQ) vs TOTALES ERP (DER) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          
          {/* COLUMNA IZQUIERDA (7 COLS): TRIBUTOS FISCALES SENIAT, RETENCIONES Y NOTAS */}
          <div className="lg:col-span-7 space-y-3">
            
            {/* RETENCIONES FISCALES Y TRIBUTOS */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-amber-600" />
                  <span className="font-black text-slate-800 text-xs uppercase tracking-wider">
                    Retenciones Fiscales & IGTF (SENIAT)
                  </span>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                  Normativa Fiscal
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                
                {/* Retención IVA */}
                <div className={`p-2.5 rounded-xl border transition ${
                  applyRetIva ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50/60 border-slate-200'
                }`}>
                  <label className="flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={applyRetIva}
                      onChange={(e) => setApplyRetIva(e.target.checked)}
                      className="rounded text-amber-600 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Retención IVA</span>
                  </label>
                  {applyRetIva && (
                    <div className="mt-1.5 pt-1.5 border-t border-amber-200/80 flex items-center justify-between">
                      <select
                        value={retIvaPercent}
                        onChange={(e) => setRetIvaPercent(parseInt(e.target.value, 10))}
                        className="bg-white border border-amber-300 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-800 outline-none"
                      >
                        <option value={75}>75% IVA</option>
                        <option value={100}>100% IVA</option>
                      </select>
                      <span className="font-mono font-bold text-amber-800 text-[11px]">
                        -{formatMoney(totals.retIvaMonto, currency)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Retención ISLR */}
                <div className={`p-2.5 rounded-xl border transition ${
                  applyRetIslr ? 'bg-indigo-50/70 border-indigo-200' : 'bg-slate-50/60 border-slate-200'
                }`}>
                  <label className="flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={applyRetIslr}
                      onChange={(e) => setApplyRetIslr(e.target.checked)}
                      className="rounded text-indigo-600 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Retención ISLR</span>
                  </label>
                  {applyRetIslr && (
                    <div className="mt-1.5 pt-1.5 border-t border-indigo-200/80 flex items-center justify-between">
                      <select
                        value={retIslrPercent}
                        onChange={(e) => setRetIslrPercent(parseFloat(e.target.value))}
                        className="bg-white border border-indigo-300 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-800 outline-none"
                      >
                        <option value={1}>1% ISLR</option>
                        <option value={2}>2% ISLR</option>
                        <option value={3}>3% ISLR</option>
                        <option value={5}>5% ISLR</option>
                      </select>
                      <span className="font-mono font-bold text-indigo-800 text-[11px]">
                        -{formatMoney(totals.retIslrMonto, currency)}
                      </span>
                    </div>
                  )}
                </div>

                {/* IGTF 3% Divisas */}
                <div className={`p-2.5 rounded-xl border transition ${
                  applyIgtf ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50/60 border-slate-200'
                }`}>
                  <label className="flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer select-none text-xs">
                    <input
                      type="checkbox"
                      checked={applyIgtf}
                      onChange={(e) => setApplyIgtf(e.target.checked)}
                      className="rounded text-emerald-600 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>IGTF Divisas (3%)</span>
                  </label>
                  {applyIgtf && (
                    <div className="mt-1.5 pt-1.5 border-t border-emerald-200/80 flex items-center justify-between">
                      <span className="text-[10px] text-emerald-700 font-bold">Ley IGTF</span>
                      <span className="font-mono font-bold text-emerald-800 text-[11px]">
                        +{formatMoney(totals.igtfMonto, currency)}
                      </span>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* SI ES FACTURA DE CONTADO: ACCESO DIRECTO A DESGLOSE DE COBRO */}
            {selectedCondition === 'contado' && (
              <div className="bg-emerald-50/60 border border-emerald-200/80 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <h4 className="font-black text-emerald-950 text-xs">Desglose de Formas de Pago Contado</h4>
                    <p className="text-[11px] text-emerald-800">
                      Puntos de Venta (POS), Efectivo USD/Bs, Transferencias, Pago Móvil o Zelle.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectCondition('contado')}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition shrink-0 cursor-pointer"
                >
                  Configurar Pagos
                </button>
              </div>
            )}

            {/* NOTAS Y TÉRMINOS */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
              <label className="block text-slate-700 font-bold mb-1.5 text-xs">
                Observaciones / Términos de la Factura
              </label>
              <textarea
                rows={2}
                placeholder="Condiciones de despacho, garantía, cuentas bancarias de la empresa para pago..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:border-indigo-600 outline-none resize-none"
              />
            </div>

          </div>

          {/* COLUMNA DERECHA (5 COLS): RESUMEN FISCAL DUAL MULTIMONEDA (USD vs VES) */}
          <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-md space-y-3 text-xs">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Coins size={14} className="text-indigo-600" />
                Liquidación Fiscal Multimoneda
              </h3>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                  Dólares ($)
                </span>
                <span className="font-bold text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                  Bolívares (Bs.)
                </span>
              </div>
            </div>

            {/* FILAS DE CÁLCULO DUAL EN PARALELO */}
            <div className="space-y-1.5 font-mono text-xs">
              
              {/* Subtotal Neto */}
              <div className="flex justify-between items-center py-0.5 text-slate-600">
                <span className="font-sans font-semibold">Subtotal Neto:</span>
                <div className="text-right space-x-3">
                  <span className="font-bold text-slate-800">{formatMoney(totals.subtotalUSD, 'USD')}</span>
                  <span className="text-slate-500">{formatMoney(totals.subtotalBs, 'VES')}</span>
                </div>
              </div>

              {/* Monto Exento */}
              {totals.montoExento > 0 && (
                <div className="flex justify-between items-center py-0.5 text-slate-600">
                  <span className="font-sans font-semibold">Monto Exento (E):</span>
                  <div className="text-right space-x-3">
                    <span className="font-bold text-slate-800">{formatMoney(totals.montoExentoUSD, 'USD')}</span>
                    <span className="text-slate-500">{formatMoney(totals.montoExentoBs, 'VES')}</span>
                  </div>
                </div>
              )}

              {/* Base Imponible */}
              <div className="flex justify-between items-center py-0.5 text-slate-600">
                <span className="font-sans font-semibold">Base Imponible (16%):</span>
                <div className="text-right space-x-3">
                  <span className="font-bold text-slate-800">{formatMoney(totals.baseImponibleUSD, 'USD')}</span>
                  <span className="text-slate-500">{formatMoney(totals.baseImponibleBs, 'VES')}</span>
                </div>
              </div>

              {/* IVA 16% */}
              <div className="flex justify-between items-center py-0.5 text-slate-600">
                <span className="font-sans font-semibold">IVA Débito Fiscal (16%):</span>
                <div className="text-right space-x-3">
                  <span className="font-bold text-slate-800">{formatMoney(totals.ivaMontoUSD, 'USD')}</span>
                  <span className="text-slate-500">{formatMoney(totals.ivaMontoBs, 'VES')}</span>
                </div>
              </div>

              {/* IGTF 3% */}
              {applyIgtf && totals.igtfMonto > 0 && (
                <div className="flex justify-between items-center py-0.5 text-emerald-700 font-bold bg-emerald-50/70 px-2 rounded">
                  <span className="font-sans">(+) IGTF Percibido (3%):</span>
                  <div className="text-right space-x-3">
                    <span>+{formatMoney(totals.igtfMontoUSD, 'USD')}</span>
                    <span>+{formatMoney(totals.igtfMontoBs, 'VES')}</span>
                  </div>
                </div>
              )}

              {/* Total Factura */}
              <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center text-slate-900 font-bold">
                <span className="font-sans">Total Facturado:</span>
                <div className="text-right space-x-3">
                  <span className="text-sm font-black">{formatMoney(totals.totalUSD, 'USD')}</span>
                  <span className="text-xs text-slate-600 font-bold">{formatMoney(totals.totalBs, 'VES')}</span>
                </div>
              </div>

              {/* Deducción Retención IVA */}
              {applyRetIva && totals.retIvaMonto > 0 && (
                <div className="flex justify-between items-center py-0.5 text-amber-700 bg-amber-50/60 px-2 rounded">
                  <span className="font-sans">(-) Retención IVA ({retIvaPercent}%):</span>
                  <div className="text-right space-x-3 font-bold">
                    <span>-{formatMoney(totals.retIvaMontoUSD, 'USD')}</span>
                    <span>-{formatMoney(totals.retIvaMontoBs, 'VES')}</span>
                  </div>
                </div>
              )}

              {/* Deducción Retención ISLR */}
              {applyRetIslr && totals.retIslrMonto > 0 && (
                <div className="flex justify-between items-center py-0.5 text-indigo-700 bg-indigo-50/60 px-2 rounded">
                  <span className="font-sans">(-) Retención ISLR ({retIslrPercent}%):</span>
                  <div className="text-right space-x-3 font-bold">
                    <span>-{formatMoney(totals.retIslrMontoUSD, 'USD')}</span>
                    <span>-{formatMoney(totals.retIslrMontoBs, 'VES')}</span>
                  </div>
                </div>
              )}

            </div>

            {/* GRAN TOTAL NETO A COBRAR DESTACADO */}
            <div className="border-t-2 border-slate-900 pt-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[11px] font-black uppercase text-slate-500 block">
                    TOTAL NETO A COBRAR:
                  </span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded inline-block mt-0.5 ${
                    selectedCondition === 'contado' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    Condición: {selectedCondition.toUpperCase()}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-indigo-600 font-mono tracking-tight">
                    {formatMoney(totals.netoCobrarUSD, 'USD')}
                  </div>
                  <div className="text-xs font-bold text-slate-600 font-mono mt-0.5">
                    Equiv: {formatMoney(totals.netoCobrarBs, 'VES')}
                  </div>
                </div>
              </div>
            </div>

            {/* ALERTA DE STOCK 0 REQUERIDA */}
            {zeroStockItems.length > 0 && (
              !isZeroStockAuthorized ? (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-black text-rose-900 text-[11px]">
                      {zeroStockItems.length} Producto(s) sin Stock Disponible
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsMasterAuthModalOpen(true)}
                      className="mt-1.5 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[10px] shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <KeyRound size={11} />
                      <span>Ingresar Clave Especial Master</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-center gap-1.5 font-bold">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>Stock 0 Autorizado con Clave de Operaciones</span>
                </div>
              )
            )}

            {/* BOTÓN PRINCIPAL DE EMISIÓN */}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm transition shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <Save size={16} />
              <span>Emitir Factura ({selectedCondition.toUpperCase()}) [F2]</span>
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
