import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Truck, ArrowLeft, Search, Plus, Trash2, CheckCircle2, 
  Save, AlertTriangle, Building2, DollarSign, Calendar, 
  Package, Check, Coins, ArrowRight, RefreshCw, Mail, Phone,
  ScanBarcode, Barcode, X, HelpCircle, FileText, User,
  Warehouse, Landmark, Layers, Percent, ShieldCheck, Tag
} from 'lucide-react';
import BackButton from '../components/common/BackButton';
import VoucherPreviewModal from '../components/common/VoucherPreviewModal';
import { getTasaForDate } from '../services/exchangeRateService';
import { isUUID, dbActualizarStockLoteAtomico } from '../services/db';
import { 
  FacturaCompraModel, FacturaCompraItemModel, ProductModel, 
  AlmacenModel, ContactoModel 
} from '../types/database';
import { formatDate, getTodayLocalDate, addDaysToDate } from '../utils/dateUtils';
import { formatNumber, parseMoney } from '../utils/numberFormat';
import { useCompany } from '../context/CompanyContext';

const DEFAULT_ALMACENES: AlmacenModel[] = [
  { id: '00000000-0000-4000-8000-000000000001', empresa_id: '', codigo: 'DEP-01', nombre: 'Almacén Principal (Central)', ubicacion: 'Galpón Central A', es_principal: true, activo: true }
];

export default function PurchaseForm({
  contactos = [],
  products = [],
  almacenes = [],
  cuentasContables = [],
  bancos = [],
  configContable,
  onSave,
  showToast,
  workingYear,
  empresa
}: {
  contactos?: any[];
  products?: ProductModel[];
  almacenes?: AlmacenModel[];
  cuentasContables?: any[];
  bancos?: any[];
  configContable?: any;
  onSave?: (collection: string, data: any) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
  workingYear?: string;
  empresa?: any;
}) {
  const navigate = useNavigate();
  const { activeCompanyId } = useCompany();
  const currentCompanyId = activeCompanyId || empresa?.id || '';

  // 1. Configuración de Documento y Multimoneda
  const [docType, setDocType] = useState<'factura_compra' | 'nota_entrega' | 'nota_debito' | 'orden_compra'>('factura_compra');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [issueDate, setIssueDate] = useState(() => getTodayLocalDate());
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(() => {
    return getTasaForDate(getTodayLocalDate()).toFixed(2);
  });
  const exchangeRate = useMemo(() => {
    const val = parseFloat(exchangeRateInput.replace(',', '.'));
    return isNaN(val) || val <= 0 ? 1 : val;
  }, [exchangeRateInput]);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [controlNumber, setControlNumber] = useState('');
  const [selectedAlmacenId, setSelectedAlmacenId] = useState('');
  const [notes, setNotes] = useState('');
  const [pendingVoucher, setPendingVoucher] = useState<{
    comprobante: any;
    onConfirm: (finalComprobante: any) => Promise<void>;
  } | null>(null);

  // Sincronizar almacén seleccionado con el almacén principal o primero disponible
  useEffect(() => {
    if (almacenes && almacenes.length > 0) {
      const exists = almacenes.some(a => a.id === selectedAlmacenId);
      if (!exists || !selectedAlmacenId || selectedAlmacenId === 'alm_01') {
        const principal = almacenes.find(a => a.es_principal) || almacenes[0];
        if (principal) setSelectedAlmacenId(principal.id);
      }
    }
  }, [almacenes, selectedAlmacenId]);

  // 2. Proveedor Info y Modales
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierRif, setSupplierRif] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({
    name: '',
    taxId: '',
    email: '',
    phone: '',
    address: ''
  });

  const suppliersList = useMemo(() => {
    return contactos.filter(c => {
      const type = String(c.type || c.tipo || '').toLowerCase().trim();
      return type === 'supplier' || type === 'proveedor' || type === 'both' || type === 'ambos';
    });
  }, [contactos]);

  const filteredSuppliers = useMemo(() => {
    const term = supplierSearchTerm.trim().toLowerCase();
    if (!term) return suppliersList;
    return suppliersList.filter(s => 
      (s.name || s.nombre || '').toLowerCase().includes(term) ||
      (s.taxId || s.tax_id || s.rif || '').toLowerCase().includes(term)
    );
  }, [suppliersList, supplierSearchTerm]);

  const handleSelectSupplier = (s: any) => {
    setSelectedSupplierId(s.id);
    setSupplierName(s.name || s.nombre || '');
    setSupplierRif(s.taxId || s.tax_id || s.rif || '');
    setSupplierAddress(s.address || s.direccion || '');
    setSupplierPhone(s.phone || s.telefono || '');
    setSupplierEmail(s.email || '');
    setIsSupplierModalOpen(false);
  };

  const handleCreateSupplier = () => {
    if (!newSupplierForm.name.trim() || !newSupplierForm.taxId.trim()) {
      showToast?.('Nombre y RIF son obligatorios', 'error');
      return;
    }

    const newContact: any = {
      id: crypto.randomUUID(),
      empresa_id: currentCompanyId,
      name: newSupplierForm.name.trim(),
      nombre: newSupplierForm.name.trim(),
      tax_id: newSupplierForm.taxId.trim(),
      taxId: newSupplierForm.taxId.trim(),
      rif: newSupplierForm.taxId.trim(),
      type: 'supplier',
      tipo: 'proveedor',
      email: newSupplierForm.email.trim() || undefined,
      phone: newSupplierForm.phone.trim() || undefined,
      telefono: newSupplierForm.phone.trim() || undefined,
      address: newSupplierForm.address.trim() || undefined,
      direccion: newSupplierForm.address.trim() || undefined,
      tipo_contribuyente: 'ordinario',
      saldo: 0,
      activo: true,
      created_at: new Date().toISOString()
    };

    onSave?.('contactos', newContact);

    setSelectedSupplierId(newContact.id);
    setSupplierName(newContact.name);
    setSupplierRif(newContact.tax_id);
    setSupplierAddress(newContact.address || '');
    setSupplierPhone(newContact.phone || '');
    setSupplierEmail(newContact.email || '');

    setIsNewSupplierModalOpen(false);
    setNewSupplierForm({ name: '', taxId: '', email: '', phone: '', address: '' });
    showToast?.('Proveedor registrado y seleccionado', 'success');
  };

  // 3. Modal Selector de Inventario de Mercancía
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [activeItemIndexForProduct, setActiveItemIndexForProduct] = useState<number | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedProductCategory, setSelectedProductCategory] = useState('all');

  const productCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.categoria && p.categoria.trim()) {
        cats.add(p.categoria.trim());
      }
    });
    return Array.from(cats);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedProductCategory !== 'all' && p.categoria !== selectedProductCategory) {
        return false;
      }
      if (!productSearchTerm.trim()) return true;
      const term = productSearchTerm.toLowerCase();
      return (
        p.nombre?.toLowerCase().includes(term) ||
        p.codigo?.toLowerCase().includes(term) ||
        p.descripcion?.toLowerCase().includes(term) ||
        p.categoria?.toLowerCase().includes(term)
      );
    });
  }, [products, productSearchTerm, selectedProductCategory]);

  const handleOpenProductModal = (rowIndex: number | null = null) => {
    setActiveItemIndexForProduct(rowIndex);
    setProductSearchTerm('');
    setSelectedProductCategory('all');
    setIsProductModalOpen(true);
  };

  const handleSelectProductFromModal = (prod: ProductModel) => {
    addProductToItems(prod, activeItemIndexForProduct !== null ? activeItemIndexForProduct : undefined);
    setIsProductModalOpen(false);
    setActiveItemIndexForProduct(null);
  };

  // 4. Retenciones y Exoneración de IVA
  const [applyRetIva, setApplyRetIva] = useState(false);
  const [retIvaPercent, setRetIvaPercent] = useState<number>(75);

  const [applyRetIslr, setApplyRetIslr] = useState(false);
  const [retIslrPercent, setRetIslrPercent] = useState<number>(2);

  const [noAplicaIva, setNoAplicaIva] = useState(false);

  const [applyIgtf, setApplyIgtf] = useState(false);
  const igtfPercent = 3;

  // Condición de Pago y Días a Crédito
  const [paymentCondition, setPaymentCondition] = useState<'contado' | 'credito'>('contado');
  const [creditDays, setCreditDays] = useState<number>(15);
  const [selectedBankId, setSelectedBankId] = useState(() => bancos[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState<string>('Transferencia');
  const [paymentRef, setPaymentRef] = useState('');

  // Sincronizar automáticamente la cuenta bancaria o caja de egreso cuando bancos se carguen o cambien
  useEffect(() => {
    if (bancos && bancos.length > 0) {
      const exists = bancos.some(b => b.id === selectedBankId);
      if (!exists || !selectedBankId) {
        setSelectedBankId(bancos[0].id);
      }
    }
  }, [bancos, selectedBankId]);

  const calculatedDueDate = useMemo(() => {
    return addDaysToDate(issueDate, creditDays);
  }, [issueDate, creditDays]);

  // 5. Ítems de la Compra
  const [items, setItems] = useState<FacturaCompraItemModel[]>([
    {
      id: `item_${Date.now()}_1`,
      producto_id: '',
      codigo: '',
      descripcion: '',
      unidad_medida: 'UND',
      almacen_id: selectedAlmacenId,
      cantidad: 1,
      costo_unitario: 0,
      exento: false,
      alicuota_iva: 16,
      subtotal: 0,
      iva_monto: 0,
      total: 0,
      actualizar_costo: true,
      cuenta_inventario_id: '1.1.04.001',
      cuenta_gasto_id: '5.1.01.001'
    }
  ]);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [barcodeInput, setBarcodeInput] = useState('');

  const addProductToItems = (prod: ProductModel, targetIndex?: number) => {
    const isVes = currency === 'VES';
    const costInActiveCurrency = isVes ? (Number(prod.costo_unitario || 0) * exchangeRate) : Number(prod.costo_unitario || 0);

    const isExento = noAplicaIva || !prod.aplica_iva;
    const alicuota = isExento ? 0 : 16;
    const sub = Number(costInActiveCurrency.toFixed(2));
    const iva = isExento ? 0 : Number((sub * (alicuota / 100)).toFixed(2));

    const newItem: FacturaCompraItemModel = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      producto_id: prod.id,
      codigo: prod.codigo || '',
      descripcion: prod.nombre,
      unidad_medida: prod.unidad_medida || 'UND',
      almacen_id: selectedAlmacenId,
      cantidad: 1,
      costo_unitario: Number(costInActiveCurrency.toFixed(2)),
      exento: isExento,
      alicuota_iva: alicuota,
      subtotal: sub,
      iva_monto: iva,
      total: sub + iva,
      actualizar_costo: true,
      cuenta_inventario_id: '1.1.04.001',
      cuenta_gasto_id: '5.1.01.001'
    };

    setItems(prev => {
      if (targetIndex !== undefined && targetIndex >= 0 && targetIndex < prev.length) {
        const updated = [...prev];
        updated[targetIndex] = newItem;
        return updated;
      }
      if (prev.length === 1 && !prev[0].producto_id && !prev[0].descripcion) {
        return [newItem];
      }
      return [...prev, newItem];
    });
  };

  const handleItemFieldChange = (index: number, field: string, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      const qty = typeof item.cantidad === 'number' ? item.cantidad : parseMoney(item.cantidad);
      const cost = typeof item.costo_unitario === 'number' ? item.costo_unitario : parseMoney(item.costo_unitario);
      const lineSubtotal = Number((qty * cost).toFixed(2));
      const isExempt = noAplicaIva || item.exento;
      const alicuota = isExempt ? 0 : (Number(item.alicuota_iva) || 16);
      const iva = isExempt ? 0 : Number((lineSubtotal * (alicuota / 100)).toFixed(2));

      item.subtotal = lineSubtotal;
      item.iva_monto = iva;
      item.total = Number((lineSubtotal + iva).toFixed(2));

      updated[index] = item;
      return updated;
    });
  };

  // Conmutador "No Aplica IVA" para la factura completa
  const handleToggleNoAplicaIva = (checked: boolean) => {
    setNoAplicaIva(checked);
    setItems(prev => prev.map(item => {
      const qty = typeof item.cantidad === 'number' ? item.cantidad : parseMoney(item.cantidad);
      const cost = typeof item.costo_unitario === 'number' ? item.costo_unitario : parseMoney(item.costo_unitario);
      const lineSubtotal = qty * cost;
      const isExempt = checked || item.exento;
      const alicuota = isExempt ? 0 : 16;
      const iva = lineSubtotal * (alicuota / 100);
      return {
        ...item,
        exento: isExempt,
        alicuota_iva: alicuota,
        subtotal: lineSubtotal,
        iva_monto: iva,
        total: lineSubtotal + iva
      };
    }));
  };

  const handleAddItemRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item_${Date.now()}_${prev.length + 1}`,
        producto_id: '',
        codigo: '',
        descripcion: '',
        unidad_medida: 'UND',
        almacen_id: selectedAlmacenId,
        cantidad: 1,
        costo_unitario: 0,
        exento: noAplicaIva,
        alicuota_iva: noAplicaIva ? 0 : 16,
        subtotal: 0,
        iva_monto: 0,
        total: 0,
        actualizar_costo: true,
        cuenta_inventario_id: '1.1.04.001',
        cuenta_gasto_id: '5.1.01.001'
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setItems([{
        id: `item_${Date.now()}_1`,
        producto_id: '',
        codigo: '',
        descripcion: '',
        unidad_medida: 'UND',
        almacen_id: selectedAlmacenId,
        cantidad: 1,
        costo_unitario: 0,
        exento: noAplicaIva,
        alicuota_iva: noAplicaIva ? 0 : 16,
        subtotal: 0,
        iva_monto: 0,
        total: 0,
        actualizar_costo: true,
        cuenta_inventario_id: '1.1.04.001',
        cuenta_gasto_id: '5.1.01.001'
      }]);
    } else {
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleBarcodeScan = (code: string) => {
    if (!code.trim()) return;
    const term = code.trim().toLowerCase();

    const prod = products.find(p => 
      (p.codigo && p.codigo.trim().toLowerCase() === term) ||
      (p.id && p.id.toLowerCase() === term)
    );

    if (prod) {
      const existingIdx = items.findIndex(it => it.producto_id === prod.id);
      if (existingIdx !== -1) {
        const currentQty = Number(items[existingIdx].cantidad) || 1;
        handleItemFieldChange(existingIdx, 'cantidad', currentQty + 1);
        showToast?.(`+1 "${prod.nombre}" ingresado (Cantidad: ${currentQty + 1})`, 'success');
      } else {
        addProductToItems(prod);
        showToast?.(`"${prod.nombre}" añadido a la compra`, 'success');
      }
      setBarcodeInput('');
    } else {
      showToast?.(`Artículo con código/SKU "${code}" no encontrado en inventario`, 'error');
    }
  };

  // Modal para Crear Nuevo Producto Rápido en Catálogo
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newProdForm, setNewProdForm] = useState({
    codigo: '',
    nombre: '',
    categoria: 'General',
    unidad_medida: 'UND',
    costo_unitario: '',
    precio_venta: '',
    aplica_iva: true
  });

  const handleCreateProductInModal = () => {
    if (!newProdForm.codigo.trim() || !newProdForm.nombre.trim()) {
      showToast?.('Código y Nombre del artículo son obligatorios', 'error');
      return;
    }

    const costNum = parseFloat(newProdForm.costo_unitario) || 0;
    const priceNum = parseFloat(newProdForm.precio_venta) || 0;

    const newProd: ProductModel = {
      id: crypto.randomUUID(),
      empresa_id: currentCompanyId,
      codigo: newProdForm.codigo.trim().toUpperCase(),
      nombre: newProdForm.nombre.trim(),
      categoria: newProdForm.categoria || 'General',
      unidad_medida: newProdForm.unidad_medida || 'UND',
      costo_unitario: costNum,
      costo_promedio: costNum,
      precio_venta: priceNum,
      stock_actual: 0,
      stock_minimo: 5,
      aplica_iva: newProdForm.aplica_iva,
      almacen_id: selectedAlmacenId,
      cuenta_inventario_id: '1.1.04.001',
      cuenta_costo_id: '5.1.01.001',
      cuenta_ingreso_id: '4.1.01.001',
      cuenta_venta_id: '4.1.01.001',
      activo: true,
      created_at: new Date().toISOString()
    };

    onSave?.('products', newProd);
    addProductToItems(newProd);
    setIsNewProductModalOpen(false);
    setNewProdForm({
      codigo: '',
      nombre: '',
      categoria: 'General',
      unidad_medida: 'UND',
      costo_unitario: '',
      precio_venta: '',
      aplica_iva: true
    });
    showToast?.(`Artículo "${newProd.nombre}" incorporado al catálogo e insertado en la compra`, 'success');
  };

  // Cálculos de Totales Duales (USD y Bs.)
  const totals = useMemo(() => {
    const isVes = currency === 'VES';

    let subtotalRaw = 0;
    let exentoRaw = 0;
    let baseImponibleRaw = 0;
    let ivaMontoRaw = 0;

    items.forEach(it => {
      const lineSub = Number(it.subtotal) || 0;
      subtotalRaw += lineSub;
      if (noAplicaIva || it.exento) {
        exentoRaw += lineSub;
      } else {
        baseImponibleRaw += lineSub;
        ivaMontoRaw += Number(it.iva_monto) || 0;
      }
    });

    if (noAplicaIva) {
      exentoRaw = subtotalRaw;
      baseImponibleRaw = 0;
      ivaMontoRaw = 0;
    }

    const subtotalUSD = isVes ? (subtotalRaw / exchangeRate) : subtotalRaw;
    const baseImponibleUSD = isVes ? (baseImponibleRaw / exchangeRate) : baseImponibleRaw;
    const montoExentoUSD = isVes ? (exentoRaw / exchangeRate) : exentoRaw;
    const ivaMontoUSD = isVes ? (ivaMontoRaw / exchangeRate) : ivaMontoRaw;

    // Retenciones
    const retIvaMontoUSD = applyRetIva && !noAplicaIva ? ivaMontoUSD * (retIvaPercent / 100) : 0;
    const retIslrMontoUSD = applyRetIslr ? baseImponibleUSD * (retIslrPercent / 100) : 0;

    // IGTF
    const igtfMontoUSD = applyIgtf && !isVes ? (baseImponibleUSD + ivaMontoUSD) * (igtfPercent / 100) : 0;

    const totalFacturaUSD = subtotalUSD + ivaMontoUSD + igtfMontoUSD;
    const netoPagarUSD = totalFacturaUSD - retIvaMontoUSD - retIslrMontoUSD;

    return {
      subtotalUSD,
      baseImponibleUSD,
      montoExentoUSD,
      ivaMontoUSD,
      retIvaMontoUSD,
      retIslrMontoUSD,
      igtfMontoUSD,
      totalFacturaUSD,
      netoPagarUSD,
      // Conversión a Bolívares
      subtotalBs: subtotalUSD * exchangeRate,
      baseImponibleBs: baseImponibleUSD * exchangeRate,
      montoExentoBs: montoExentoUSD * exchangeRate,
      ivaMontoBs: ivaMontoUSD * exchangeRate,
      retIvaMontoBs: retIvaMontoUSD * exchangeRate,
      retIslrMontoBs: retIslrMontoUSD * exchangeRate,
      igtfMontoBs: igtfMontoUSD * exchangeRate,
      totalFacturaBs: totalFacturaUSD * exchangeRate,
      netoPagarBs: netoPagarUSD * exchangeRate
    };
  }, [items, currency, exchangeRate, applyRetIva, retIvaPercent, applyRetIslr, retIslrPercent, applyIgtf, noAplicaIva]);

  // Limpiar Formulario
  const handleResetForm = () => {
    setInvoiceNumber('');
    setControlNumber('');
    setSelectedSupplierId('');
    setSupplierName('');
    setSupplierRif('');
    setSupplierAddress('');
    setSupplierPhone('');
    setSupplierEmail('');
    setNoAplicaIva(false);
    setItems([{
      id: `item_${Date.now()}_1`,
      producto_id: '',
      codigo: '',
      descripcion: '',
      unidad_medida: 'UND',
      almacen_id: selectedAlmacenId,
      cantidad: 1,
      costo_unitario: 0,
      exento: false,
      alicuota_iva: 16,
      subtotal: 0,
      iva_monto: 0,
      total: 0,
      actualizar_costo: true,
      cuenta_inventario_id: '1.1.04.001',
      cuenta_gasto_id: '5.1.01.001'
    }]);
    setNotes('');
    setPaymentRef('');
    setApplyRetIva(false);
    setApplyRetIslr(false);
    showToast?.('Formulario de compra reiniciado', 'info');
  };

  // Atajos de Teclado F2 (Emitir), F3 (Catálogo), F4 (Barcode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        submitBtn?.click();
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
  }, [products]);

  // 6. REGISTRAR COMPRA E IMPACTAR INVENTARIO
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierName.trim() || !supplierRif.trim()) {
      showToast?.('Por favor seleccione o registre el proveedor de la factura', 'error');
      return;
    }

    if (!invoiceNumber.trim()) {
      showToast?.('El número de factura del proveedor es obligatorio', 'error');
      return;
    }

    if (!selectedAlmacenId) {
      showToast?.('Por favor seleccione el almacén de destino para el ingreso de la mercancía', 'error');
      return;
    }

    if (!items || items.length === 0) {
      showToast?.('Debe registrar al menos un producto o artículo en la compra', 'error');
      return;
    }

    // Validación estricta: cada renglón debe tener producto seleccionado, cantidad > 0 y costo > 0
    const invalidItemIndex = items.findIndex(it => {
      const hasProduct = !!(it.producto_id || it.codigo || it.descripcion?.trim());
      const cant = typeof it.cantidad === 'number' ? it.cantidad : parseMoney(it.cantidad);
      const costo = typeof it.costo_unitario === 'number' ? it.costo_unitario : parseMoney(it.costo_unitario);
      return !hasProduct || cant <= 0 || costo <= 0;
    });

    if (invalidItemIndex >= 0) {
      showToast?.(`Renglón #${invalidItemIndex + 1} incompleto: debe seleccionar un producto/artículo y especificar cantidad y costo válidos mayores a 0`, 'error');
      return;
    }

    // Determinar cuenta bancaria o caja efectiva de egreso para compras de contado
    const effectiveBankId = selectedBankId || (bancos && bancos.length > 0 ? bancos[0].id : '');

    // Validación estricta de pago si la condición es de contado
    if (paymentCondition === 'contado') {
      if (!effectiveBankId) {
        showToast?.('Debe seleccionar la cuenta bancaria o caja de egreso para el pago de contado', 'error');
        return;
      }
      if (!paymentMethod) {
        showToast?.('Debe seleccionar la forma de pago de contado', 'error');
        return;
      }
      if (paymentMethod !== 'Efectivo' && (!paymentRef || !paymentRef.trim())) {
        showToast?.('Debe ingresar el número de referencia del comprobante de pago', 'error');
        return;
      }
    }

    const validItems = items.filter(it => {
      const cant = typeof it.cantidad === 'number' ? it.cantidad : parseMoney(it.cantidad);
      return it.descripcion.trim() && cant > 0;
    });
    if (validItems.length === 0) {
      showToast?.('Debe registrar al menos un artículo con cantidad válida', 'error');
      return;
    }

    if (totals.totalFacturaUSD <= 0) {
      showToast?.('El total de la compra debe ser mayor a 0', 'error');
      return;
    }

    // Validar período contable
    if (workingYear && issueDate) {
      const yr = issueDate.substring(0, 4);
      if (yr !== workingYear) {
        showToast?.(`La fecha (${yr}) no coincide con el período contable seleccionado (${workingYear})`, 'error');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const isVes = currency === 'VES';
      const timestamp = Date.now();
      const purchaseId = crypto.randomUUID();
      const cxpId = crypto.randomUUID();
      const voucherId = crypto.randomUUID();

      // 1. Resolver proveedor existente o registrar uno nuevo con UUID válido
      let effectiveSupplierId: string | undefined = undefined;
      const existingSupplier = contactos.find(c => 
        (selectedSupplierId && c.id === selectedSupplierId) ||
        (supplierRif && (c.tax_id || (c as any).taxId)?.trim().toLowerCase() === supplierRif.trim().toLowerCase()) ||
        (supplierName && c.name?.trim().toLowerCase() === supplierName.trim().toLowerCase())
      );

      if (existingSupplier && isUUID(existingSupplier.id)) {
        effectiveSupplierId = existingSupplier.id;
      } else if (supplierName.trim()) {
        const newSuppId = crypto.randomUUID();
        const newContact: ContactoModel = {
          id: newSuppId,
          empresa_id: currentCompanyId,
          name: supplierName.trim(),
          tax_id: supplierRif.trim(),
          address: supplierAddress.trim() || undefined,
          phone: supplierPhone.trim() || undefined,
          email: supplierEmail.trim() || undefined,
          type: 'supplier',
          tipo_contribuyente: 'ordinario',
          saldo: 0,
          activo: true
        };
        onSave?.('contactos', newContact);
        effectiveSupplierId = newSuppId;
      }

      // 2. Resolver almacén de destino con UUID válido
      let effectiveAlmacenId: string | undefined = undefined;
      if (isUUID(selectedAlmacenId)) {
        effectiveAlmacenId = selectedAlmacenId;
      } else if (almacenes && almacenes.length > 0) {
        const foundAlm = almacenes.find(a => a.id === selectedAlmacenId || a.codigo === selectedAlmacenId || a.es_principal);
        if (foundAlm && isUUID(foundAlm.id)) {
          effectiveAlmacenId = foundAlm.id;
        }
      }

      // Helper para resolver UUID de cuenta contable
      const resolveCuentaId = (rawIdOrCode: string | undefined, defaultCode: string): string | null => {
        const target = rawIdOrCode || defaultCode;
        if (!target) return null;
        if (isUUID(target)) return target;
        const found = cuentasContables.find((c: any) => c.codigo === target || c.id === target);
        if (found && isUUID(found.id)) return found.id;
        return null;
      };

      // 3. Normalizar ítems a USD (moneda base del ERP)
      const itemsToSave: FacturaCompraItemModel[] = validItems.map(it => {
        const rawCost = typeof it.costo_unitario === 'number' ? it.costo_unitario : parseMoney(it.costo_unitario);
        const rawQty = typeof it.cantidad === 'number' ? it.cantidad : parseMoney(it.cantidad);
        const costUSD = isVes ? (rawCost / exchangeRate) : rawCost;
        const subUSD = isVes ? (Number(it.subtotal) / exchangeRate) : Number(it.subtotal);
        const isExempt = noAplicaIva || it.exento;
        const alicuota = isExempt ? 0 : (Number(it.alicuota_iva) || 16);
        const ivaUSD = isExempt ? 0 : (isVes ? (Number(it.iva_monto) / exchangeRate) : Number(it.iva_monto));
        const totalUSD = subUSD + ivaUSD;

        return {
          ...it,
          id: isUUID(it.id) ? it.id : crypto.randomUUID(),
          cantidad: rawQty,
          exento: isExempt,
          alicuota_iva: alicuota,
          almacen_id: effectiveAlmacenId,
          costo_unitario: Number(costUSD.toFixed(4)),
          subtotal: Number(subUSD.toFixed(2)),
          iva_monto: Number(ivaUSD.toFixed(2)),
          total: Number(totalUSD.toFixed(2)),
          costo_unitario_bs: Number((costUSD * exchangeRate).toFixed(2)),
          subtotal_bs: Number((subUSD * exchangeRate).toFixed(2)),
          iva_monto_bs: Number((ivaUSD * exchangeRate).toFixed(2)),
          total_bs: Number((totalUSD * exchangeRate).toFixed(2))
        };
      });

      // 4. Preparar Comprobante Contable Cuadrado NIIF
      const ctaInventario = configContable?.cuentaInventario || '1.1.04.001';
      const ctaCreditoFiscal = configContable?.cuentaCreditoFiscal || '1.1.08.001';
      const ctaRetIva = configContable?.cuentaIvaRetenidoCompras || '2.1.03.001';
      const ctaRetIslr = configContable?.cuentaIslrRetenidoCompras || '2.1.04.001';
      const ctaCxp = configContable?.cuentaCxp || '2.1.01.001';
      const selectedBankObj = bancos.find(b => b.id === effectiveBankId) || (paymentMethod === 'efectivo' ? bancos.find(b => b.es_caja || (b.tipo || '').toLowerCase().includes('caja')) : null) || (bancos && bancos.length > 0 ? bancos[0] : null);
      const ctaBanco = selectedBankObj?.cuenta_contable_id || (paymentMethod === 'efectivo' ? (configContable?.cuentaCaja || '1.1.01.001') : (configContable?.cuentaBancos || '1.1.01.004'));

      const voucherDescripcion = `Contabilización Compra Mercancía Fact. ${invoiceNumber.trim().toUpperCase()} - ${supplierName.trim()}`;

      const lineasAsiento = [
        {
          id: crypto.randomUUID(),
          cuentaId: resolveCuentaId(ctaInventario, '1.1.04.001'),
          descripcion: voucherDescripcion,
          debe: Number(totals.subtotalUSD.toFixed(2)),
          haber: 0
        },
        ...(totals.ivaMontoUSD > 0 ? [{
          id: crypto.randomUUID(),
          cuentaId: resolveCuentaId(ctaCreditoFiscal, '1.1.08.001'),
          descripcion: voucherDescripcion,
          debe: Number(totals.ivaMontoUSD.toFixed(2)),
          haber: 0
        }] : []),
        ...(totals.retIvaMontoUSD > 0 ? [{
          id: crypto.randomUUID(),
          cuentaId: resolveCuentaId(ctaRetIva, '2.1.03.001'),
          descripcion: voucherDescripcion,
          debe: 0,
          haber: Number(totals.retIvaMontoUSD.toFixed(2))
        }] : []),
        ...(totals.retIslrMontoUSD > 0 ? [{
          id: crypto.randomUUID(),
          cuentaId: resolveCuentaId(ctaRetIslr, '2.1.04.001'),
          descripcion: voucherDescripcion,
          debe: 0,
          haber: Number(totals.retIslrMontoUSD.toFixed(2))
        }] : []),
        {
          id: crypto.randomUUID(),
          cuentaId: paymentCondition === 'credito' ? resolveCuentaId(ctaCxp, '2.1.01.001') : resolveCuentaId(ctaBanco, '1.1.01.001'),
          descripcion: voucherDescripcion,
          debe: 0,
          haber: Number(totals.netoPagarUSD.toFixed(2))
        }
      ];

      const newVoucher = {
        id: voucherId,
        fecha: issueDate,
        numero: `CMP-${timestamp.toString().slice(-6)}`,
        tipo: 'Diario',
        descripcion: voucherDescripcion,
        referencia: `FAC-CMP-${invoiceNumber.trim().toUpperCase()}`,
        total: Number(totals.totalFacturaUSD.toFixed(2)),
        estado: 'Contabilizado',
        lineas: lineasAsiento,
        created_at: new Date().toISOString()
      };

      // Mostrar modal de confirmación del asiento contable antes de persistir la compra
      setPendingVoucher({
        comprobante: newVoucher,
        onConfirm: async (finalVoucher: any) => {
          await executeCommitPurchase(finalVoucher, purchaseId, cxpId, effectiveSupplierId, effectiveAlmacenId, itemsToSave, effectiveBankId);
        }
      });
    } catch (err: any) {
      console.error('Error preparando compra:', err);
      showToast?.('Ocurrió un error al preparar los datos de la compra', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeCommitPurchase = async (
    finalVoucher: any,
    purchaseId: string,
    cxpId: string,
    effectiveSupplierId: string | undefined,
    effectiveAlmacenId: string | undefined,
    itemsToSave: FacturaCompraItemModel[],
    finalBankId?: string
  ) => {
    setIsSubmitting(true);
    try {
      const effectiveBank = finalBankId || selectedBankId || (bancos && bancos.length > 0 ? bancos[0].id : '');
      const voucherIdToUse = finalVoucher?.id || crypto.randomUUID();

      // 1. Guardar comprobante contable confirmado primero (satisface foreign keys)
      await onSave?.('comprobantes', {
        ...finalVoucher,
        id: voucherIdToUse
      });

      // 2. Guardar la Factura de Compra
      const newPurchase: FacturaCompraModel = {
        id: purchaseId,
        empresa_id: currentCompanyId,
        numero: invoiceNumber.trim().toUpperCase(),
        control_numero: controlNumber.trim() || undefined,
        tipo_documento: docType,
        condicion: paymentCondition,
        dias_credito: paymentCondition === 'credito' ? creditDays : 0,
        proveedor_id: effectiveSupplierId,
        proveedor_nombre: supplierName.trim(),
        proveedor_rif: supplierRif.trim(),
        proveedor_direccion: supplierAddress.trim() || undefined,
        proveedor_telefono: supplierPhone.trim() || undefined,
        proveedor_email: supplierEmail.trim() || undefined,
        almacen_destino_id: effectiveAlmacenId,
        fecha_emision: issueDate,
        fecha_vencimiento: paymentCondition === 'credito' ? calculatedDueDate : issueDate,
        moneda: 'USD',
        moneda_presentacion: currency,
        tasa_cambio: exchangeRate,
        items: itemsToSave,
        subtotal: Number(totals.subtotalUSD.toFixed(2)),
        base_imponible: Number(totals.baseImponibleUSD.toFixed(2)),
        monto_exento: Number(totals.montoExentoUSD.toFixed(2)),
        iva_porcentaje: noAplicaIva ? 0 : 16,
        iva_monto: Number(totals.ivaMontoUSD.toFixed(2)),
        igtf_porcentaje: applyIgtf ? igtfPercent : 0,
        igtf_monto: Number(totals.igtfMontoUSD.toFixed(2)),
        retencion_iva_porcentaje: (applyRetIva && !noAplicaIva) ? retIvaPercent : 0,
        retencion_iva_monto: Number(totals.retIvaMontoUSD.toFixed(2)),
        retencion_islr_porcentaje: applyRetIslr ? retIslrPercent : 0,
        retencion_islr_monto: Number(totals.retIslrMontoUSD.toFixed(2)),
        neto_pagar: Number(totals.netoPagarUSD.toFixed(2)),
        total: Number(totals.totalFacturaUSD.toFixed(2)),
        saldo_pendiente: paymentCondition === 'credito' ? Number(totals.netoPagarUSD.toFixed(2)) : 0,
        subtotal_bs: Number(totals.subtotalBs.toFixed(2)),
        base_imponible_bs: Number(totals.baseImponibleBs.toFixed(2)),
        monto_exento_bs: Number(totals.montoExentoBs.toFixed(2)),
        iva_monto_bs: Number(totals.ivaMontoBs.toFixed(2)),
        igtf_monto_bs: Number(totals.igtfMontoBs.toFixed(2)),
        retencion_iva_monto_bs: Number(totals.retIvaMontoBs.toFixed(2)),
        retencion_islr_monto_bs: Number(totals.retIslrMontoBs.toFixed(2)),
        neto_pagar_bs: Number(totals.netoPagarBs.toFixed(2)),
        total_bs: Number(totals.totalFacturaBs.toFixed(2)),
        saldo_pendiente_bs: paymentCondition === 'credito' ? Number(totals.netoPagarBs.toFixed(2)) : 0,
        estado: paymentCondition === 'credito' ? 'emitida' : 'pagada',
        banco_id: paymentCondition === 'contado' ? effectiveBank : undefined,
        metodo_pago: paymentCondition === 'contado' ? paymentMethod : undefined,
        comprobante_id: voucherIdToUse,
        cxp_id: paymentCondition === 'credito' ? cxpId : undefined,
        notas: notes.trim() || undefined,
        created_at: new Date().toISOString()
      };

      await onSave?.('facturasCompra', newPurchase);

      // 3. Aumentar Stock en Inventario y Recalcular Costo Promedio de Forma Atómica (Bloqueo FOR UPDATE)
      const batchStockItems: any[] = [];
      for (const item of itemsToSave) {
        let prod = products.find(p => p.id === item.producto_id);
        if (!prod && item.codigo) {
          prod = products.find(p => p.codigo === item.codigo);
        }

        const cantComprada = Number(item.cantidad) || 0;
        const costoCompraUSD = Number(item.costo_unitario) || 0;

        if (prod && cantComprada > 0) {
          batchStockItems.push({
            producto_id: prod.id,
            cantidad: cantComprada,
            costo_unitario: costoCompraUSD,
            actualizar_costo: Boolean(item.actualizar_costo),
            almacen_destino_id: effectiveAlmacenId
          });
        }
      }

      if (batchStockItems.length > 0 && currentCompanyId) {
        await dbActualizarStockLoteAtomico(
          currentCompanyId,
          batchStockItems,
          'compra',
          {
            referencia: `Compra Fact. ${newPurchase.numero} - ${newPurchase.proveedor_nombre}`,
            usuario: 'Administrador (Compras)'
          }
        );

        // Actualizar visualmente la caché React sin enviar un upsert riesgoso a Supabase
        for (const bItem of batchStockItems) {
          const originalProd = products.find(p => p.id === bItem.producto_id);
          if (originalProd) {
            const currentStock = Number(originalProd.stock_actual) || 0;
            const newStock = currentStock + bItem.cantidad;
            onSave?.('products', {
              ...originalProd,
              stock_actual: newStock,
              _localOnly: true
            });
          }
        }
      }

      // 4. Registrar Cuenta por Pagar (CxP) para crédito y contado (con saldo 0 si es de contado)
      const montoNetoUSD = Number(totals.netoPagarUSD.toFixed(2));
      const montoNetoBs = Number(totals.netoPagarBs.toFixed(2));
      const isContado = paymentCondition === 'contado';

      await onSave?.('cxp', {
        id: cxpId,
        empresa_id: currentCompanyId,
        factura_id: purchaseId,
        factura_db_id: purchaseId,
        factura: newPurchase.numero,
        numero: newPurchase.numero,
        proveedor_id: effectiveSupplierId,
        proveedor: newPurchase.proveedor_nombre,
        proveedor_nombre: newPurchase.proveedor_nombre,
        proveedor_rif: newPurchase.proveedor_rif,
        taxId: newPurchase.proveedor_rif,
        categoria: 'proveedores',
        condicion: paymentCondition,
        fecha: issueDate,
        fecha_emision: issueDate,
        vencimiento: isContado ? issueDate : calculatedDueDate,
        fecha_vencimiento: isContado ? issueDate : calculatedDueDate,
        descripcion: `Compra Mercancía Fact. ${newPurchase.numero} (${newPurchase.items.length} artículos)`,
        tipo: 'factura',
        total: montoNetoUSD,
        monto: montoNetoUSD,
        monto_total: montoNetoUSD,
        saldo: isContado ? 0 : montoNetoUSD,
        saldo_pendiente: isContado ? 0 : montoNetoUSD,
        monto_bs: montoNetoBs,
        saldo_bs: isContado ? 0 : montoNetoBs,
        moneda: 'USD',
        tasa: exchangeRate,
        tasa_cambio: exchangeRate,
        estado: isContado ? 'pagada' : 'pendiente',
        created_at: new Date().toISOString()
      });

      if (paymentCondition !== 'credito') {
        // Registrar egreso bancario si es de contado
        const bancoSeleccionado = bancos.find(b => b.id === effectiveBank) || (paymentMethod === 'efectivo' ? bancos.find(b => b.es_caja || (b.tipo || '').toLowerCase().includes('caja')) : null) || (bancos && bancos.length > 0 ? bancos[0] : null);
        const actualBankId = bancoSeleccionado?.id || effectiveBank;
        if (actualBankId) {
          const egresoId = crypto.randomUUID();
          await onSave?.('movimientosBancos', {
            id: egresoId,
            empresa_id: currentCompanyId,
            banco_id: actualBankId,
            fecha: issueDate,
            ref: paymentRef.trim() || `${paymentMethod.toUpperCase()}-FAC-${newPurchase.numero}`,
            descripcion: `Pago Compra Mercancía (${paymentMethod}) Fact. ${newPurchase.numero} - ${newPurchase.proveedor_nombre}`,
            tipo: 'egreso',
            monto: Number(totals.netoPagarUSD.toFixed(2)),
            montoBs: Number(totals.netoPagarBs.toFixed(2)),
            tasa: exchangeRate,
            comprobante_id: voucherIdToUse,
            estado: 'conciliado',
            created_at: new Date().toISOString()
          });

          await onSave?.('pagos-realizados', {
            id: crypto.randomUUID(),
            empresa_id: currentCompanyId,
            empresaId: currentCompanyId,
            comprobantePago: paymentRef.trim() || `${paymentMethod.toUpperCase()}-FAC-${newPurchase.numero}`,
            proveedorId: effectiveSupplierId || undefined,
            proveedorNombre: newPurchase.proveedor_nombre,
            fecha: issueDate,
            montoTotal: Number(totals.netoPagarUSD.toFixed(2)),
            bancoId: actualBankId,
            comprobanteId: voucherIdToUse,
            retencionIva: totals.retIvaMontoUSD,
            retencionIslr: totals.retIslrMontoUSD,
            detalles: [{ docId: purchaseId, monto: totals.netoPagarUSD, numDoc: newPurchase.numero }],
            notas: `Pago directo de Compra de Mercancía (${paymentMethod})`,
            estado: 'activo'
          });
        }
      }

      showToast?.(`Compra Factura N° ${newPurchase.numero} registrada exitosamente. Inventario surtido.`, 'success');
      setPendingVoucher(null);
      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'PURCHASE_SAVED' }, '*');
        } catch {}
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        navigate('/purchases');
      }
    } catch (err: any) {
      console.error('Error registrando compra:', err);
      showToast?.('Ocurrió un error al procesar la compra', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-full max-h-screen overflow-hidden flex flex-col p-2.5 gap-2 bg-slate-100 text-slate-800 select-none">
      
      {/* 1. BARRA SUPERIOR ERP (COMMAND TOOLBAR) */}
      <div className="bg-slate-900 text-white px-3 sm:px-4 py-1.5 rounded-xl shadow-xs border border-slate-800 flex items-center justify-between gap-3 shrink-0 h-11">
        {/* Izquierda: Volver, Tipo Documento, Número Correlativo y Conmutador de Moneda */}
        <div className="flex items-center gap-2 flex-wrap">
          <BackButton
            to="/purchases"
            label="Listado"
            onClick={() => {
              if (window.opener && window.history.length <= 1) {
                window.close();
              } else {
                navigate('/purchases');
              }
            }}
            className="!py-1 !px-2.5 !text-xs !rounded-lg"
          />

          {/* Selector Tipo de Documento */}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <Truck size={13} />
            </div>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as any)}
              className="bg-slate-800 text-white font-black text-xs px-2.5 py-1 rounded-lg border border-slate-700 outline-none cursor-pointer hover:border-indigo-500 transition"
            >
              <option value="factura_compra">FACTURA DE COMPRA</option>
              <option value="nota_entrega">NOTA DE RECEPCIÓN / ENTREGA</option>
              <option value="nota_debito">NOTA DE DÉBITO</option>
              <option value="orden_compra">ORDEN DE COMPRA</option>
            </select>
          </div>

          {/* Badge Número de Factura */}
          <span className="font-mono text-xs font-black text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-800/70">
            N° {invoiceNumber || '---'}
          </span>

          {/* Conmutador Multimoneda USD vs VES */}
          <div className="inline-flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-black transition cursor-pointer ${
                currency === 'USD' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => setCurrency('VES')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-black transition cursor-pointer ${
                currency === 'VES' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              Bs. (VES)
            </button>
          </div>

          {/* Tasa Manual de la Compra (Sin sincronización en vivo BCV) */}
          <div className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-0.5 rounded-lg border border-slate-700 text-[11px]">
            <span className="text-slate-300 font-medium">Tasa:</span>
            <span className="text-slate-400 text-xs font-bold">Bs.</span>
            <input
              type="text"
              value={exchangeRateInput}
              onChange={(e) => setExchangeRateInput(e.target.value)}
              className="w-20 px-1.5 py-0.5 bg-slate-900 border border-slate-600 rounded text-emerald-400 font-mono font-black text-xs text-right outline-none focus:border-emerald-500"
              placeholder="0.00"
              title="Tasa de cambio manual para la compra"
            />
          </div>
        </div>

        {/* Derecha: Botón Limpiar & Registrar Compra */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetForm}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
            title="Limpiar formulario y reiniciar compra"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
          <button
            type="submit"
            form="purchase-main-form"
            disabled={isSubmitting}
            className="px-3.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <Save size={13} />
            <span>REGISTRAR COMPRA (F2)</span>
          </button>
        </div>
      </div>

      {/* 2. FORMULARIO PRINCIPAL DE 2 COLUMNAS (NO PAGE SCROLL) */}
      <form id="purchase-main-form" onSubmit={handleSavePurchase} className="flex-1 min-h-0 flex gap-2.5 overflow-hidden">
        
        {/* COLUMNA IZQUIERDA: DISTRIBUCIÓN INTEGRAL HASTA EL TOPE INFERIOR */}
        <div className="w-[460px] xl:w-[490px] 2xl:w-[520px] flex flex-col justify-between gap-2 shrink-0 h-full overflow-y-auto pr-1 select-none">
          
          <div className="flex flex-col gap-2">
            {/* 1. DATOS DEL COMPROBANTE & DESTINO */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5 shrink-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                <span className="font-black text-slate-700 text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <FileText size={12} className="text-indigo-600" />
                  Datos del Comprobante
                </span>
                <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">COMPRA / SENIAT</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    N° Factura Proveedor *
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="00045821"
                    required
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    N° Control SENIAT
                  </label>
                  <input
                    type="text"
                    value={controlNumber}
                    onChange={e => setControlNumber(e.target.value)}
                    placeholder="00-128495"
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono font-medium text-slate-700 outline-none focus:bg-white focus:border-indigo-500 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Fecha Emisión
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={e => setIssueDate(e.target.value)}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Almacén Destino
                  </label>
                  <select
                    value={selectedAlmacenId}
                    onChange={e => setSelectedAlmacenId(e.target.value)}
                    className="w-full px-1.5 py-1 bg-indigo-50/60 border border-indigo-200 rounded-lg font-bold text-indigo-950 outline-none text-xs"
                  >
                    {(almacenes && almacenes.length > 0 ? almacenes : DEFAULT_ALMACENES).map(alm => (
                      <option key={alm.id} value={alm.id}>
                        {alm.codigo} - {alm.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                    Tasa de Cambio Manual (Bs.) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Bs.</span>
                    <input
                      type="text"
                      value={exchangeRateInput}
                      onChange={e => setExchangeRateInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 text-xs"
                      title="Tasa de cambio manual para esta compra"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. PROVEEDOR DE LA MERCANCÍA */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5 shrink-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                <span className="font-black text-slate-700 text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <Building2 size={12} className="text-indigo-600" />
                  Proveedor de Mercancía
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsSupplierModalOpen(true)}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5"
                  >
                    <Search size={11} />
                    <span>Buscar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewSupplierModalOpen(true)}
                    className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5"
                  >
                    <Plus size={11} />
                    <span>+ Nuevo</span>
                  </button>
                </div>
              </div>

              {supplierName ? (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-2 flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded">
                        {supplierRif}
                      </span>
                      <h4 className="font-black text-slate-900 text-xs truncate">{supplierName}</h4>
                    </div>
                    {supplierAddress && (
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">📍 {supplierAddress}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSupplierId('');
                      setSupplierName('');
                      setSupplierRif('');
                      setSupplierAddress('');
                      setSupplierPhone('');
                      setSupplierEmail('');
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-white transition cursor-pointer shrink-0"
                    title="Cambiar proveedor"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => setIsSupplierModalOpen(true)}
                  className="border border-dashed border-slate-300 hover:border-indigo-400 rounded-lg p-2 text-center cursor-pointer transition bg-slate-50/60 hover:bg-indigo-50/30 flex items-center justify-center gap-1.5"
                >
                  <Building2 size={14} className="text-slate-400" />
                  <span className="text-[11px] font-bold text-slate-600">Seleccionar o registrar proveedor</span>
                </div>
              )}
            </div>

            {/* 3. CONDICIÓN DE PAGO & RETENCIONES SENIAT */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-1.5 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                {/* Condición de Pago */}
                <div className="space-y-1 border-r border-slate-100 pr-2 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-600 uppercase">Condición:</span>
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setPaymentCondition('contado')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition cursor-pointer ${
                            paymentCondition === 'contado' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600'
                          }`}
                        >
                          Contado
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentCondition('credito')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition cursor-pointer ${
                            paymentCondition === 'credito' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600'
                          }`}
                        >
                          Crédito
                        </button>
                      </div>
                    </div>

                    {paymentCondition === 'contado' ? (() => {
                      const effectiveBank = selectedBankId || (bancos && bancos.length > 0 ? bancos[0].id : '');
                      const selB = bancos.find(b => b.id === effectiveBank) || bancos[0];
                      const isCaja = !!(selB?.es_caja || (selB?.tipo || '').toLowerCase().includes('caja') || (selB?.banco || '').toLowerCase().includes('caja'));
                      const isUSD = !isCaja && (selB?.moneda === 'Dolares' || (selB?.moneda as string) === 'USD');
                      const isVES = !isCaja && (selB?.moneda === 'Bolivares' || (selB?.moneda as string) === 'VES' || (selB?.moneda as string) === 'Bs');

                      let availableMethods = ['Transferencia', 'Pago Móvil', 'Efectivo', 'Tarjeta de Débito', 'Tarjeta de Crédito', 'Zelle', 'Depósito'];
                      if (isCaja) {
                        availableMethods = ['Efectivo'];
                      } else if (isUSD) {
                        availableMethods = ['Transferencia', 'Zelle', 'Tarjeta de Crédito', 'Tarjeta de Débito', 'Depósito', 'Efectivo'];
                      } else if (isVES) {
                        availableMethods = ['Transferencia', 'Pago Móvil', 'Tarjeta de Débito', 'Depósito'];
                      }

                      const isRefRequired = paymentMethod !== 'Efectivo';

                      return (
                        <div className="space-y-1.5 pt-1">
                          {/* Selector de Banco o Caja */}
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center justify-between mb-0.5">
                              <span>Cuenta / Caja de Egreso *</span>
                              {isCaja && <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1 rounded font-bold">Caja</span>}
                            </label>
                            <select
                              value={effectiveBank}
                              onChange={e => {
                                const newId = e.target.value;
                                setSelectedBankId(newId);
                                const newB = bancos.find(b => b.id === newId);
                                const newIsCaja = !!(newB?.es_caja || (newB?.tipo || '').toLowerCase().includes('caja') || (newB?.banco || '').toLowerCase().includes('caja'));
                                const newIsUSD = !newIsCaja && (newB?.moneda === 'Dolares' || (newB?.moneda as string) === 'USD');
                                const newIsVES = !newIsCaja && (newB?.moneda === 'Bolivares' || (newB?.moneda as string) === 'VES');
                                if (newIsCaja) {
                                  setPaymentMethod('Efectivo');
                                } else if (newIsUSD) {
                                  if (!['Transferencia', 'Zelle', 'Tarjeta de Crédito', 'Tarjeta de Débito', 'Depósito', 'Efectivo'].includes(paymentMethod)) {
                                    setPaymentMethod('Transferencia');
                                  }
                                } else if (newIsVES) {
                                  if (!['Transferencia', 'Pago Móvil', 'Tarjeta de Débito', 'Depósito'].includes(paymentMethod)) {
                                    setPaymentMethod('Transferencia');
                                  }
                                }
                              }}
                              className="w-full px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-800 outline-none"
                            >
                              {bancos.map(b => {
                                const isBox = !!(b.es_caja || (b.tipo || '').toLowerCase().includes('caja') || (b.banco || '').toLowerCase().includes('caja'));
                                return (
                                  <option key={b.id} value={b.id}>
                                    {isBox ? '💵 [CAJA] ' : '🏦 '}{b.banco} ({b.moneda})
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Selector de Método de Pago */}
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block mb-0.5">
                              Forma de Pago *
                            </label>
                            <select
                              value={paymentMethod}
                              onChange={e => setPaymentMethod(e.target.value)}
                              className="w-full px-1.5 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-800 outline-none"
                            >
                              {availableMethods.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>

                          {/* Referencia de Pago */}
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase flex items-center justify-between mb-0.5">
                              <span>N° Referencia {isRefRequired ? <span className="text-rose-600">*</span> : '(Opcional)'}</span>
                              {isRefRequired && !paymentRef.trim() && (
                                <span className="text-[8px] text-rose-600 font-bold">Requerido</span>
                              )}
                            </label>
                            <input
                              type="text"
                              value={paymentRef}
                              onChange={e => setPaymentRef(e.target.value)}
                              placeholder={paymentMethod === 'Pago Móvil' ? 'N° Teléfono / Ref Pago Móvil...' : 'N° de Referencia / Comprobante...'}
                              className={`w-full px-1.5 py-1 bg-slate-50 border rounded font-mono text-[10px] text-slate-800 outline-none ${
                                isRefRequired && !paymentRef.trim() ? 'border-rose-400 bg-rose-50/40 focus:border-rose-600' : 'border-slate-200'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500 font-bold">Plazo:</span>
                          <div className="flex items-center gap-1">
                            {[15, 30, 45].map(d => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setCreditDays(d)}
                                className={`px-1 py-0.2 rounded text-[9px] font-bold border transition cursor-pointer ${
                                  creditDays === d ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200'
                                }`}
                              >
                                {d}d
                              </button>
                            ))}
                            {/* ENTRADA MANUAL DE DÍAS A CRÉDITO */}
                            <div className="flex items-center gap-0.5 bg-white border border-amber-300 rounded px-1 py-0.2">
                              <input
                                type="number"
                                min="0"
                                value={creditDays}
                                onChange={e => setCreditDays(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-9 font-mono font-bold text-[10px] text-amber-950 text-center outline-none"
                                placeholder="Días"
                                title="Ingresar cantidad de días manualmente"
                              />
                              <span className="text-[8px] text-slate-400 font-bold">d</span>
                            </div>
                          </div>
                        </div>
                        <div className="font-mono text-[9px] font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex justify-between items-center">
                          <span>Vencimiento:</span>
                          <span className="font-black text-amber-950">{calculatedDueDate}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Retenciones SENIAT & Botón No Aplica IVA */}
                <div className="space-y-1 pl-1">
                  <span className="text-[10px] font-black uppercase text-slate-600 block">
                    Retenciones SENIAT
                  </span>

                  <div className="space-y-1">
                    {/* Ret IVA */}
                    <div className={`p-1 rounded border transition ${applyRetIva && !noAplicaIva ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50/60 border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <label className={`flex items-center gap-1 font-bold cursor-pointer text-[10px] ${noAplicaIva ? 'opacity-40 pointer-events-none' : 'text-slate-700'}`}>
                          <input
                            type="checkbox"
                            checked={applyRetIva && !noAplicaIva}
                            onChange={e => setApplyRetIva(e.target.checked)}
                            disabled={noAplicaIva}
                            className="rounded text-amber-600 w-3 h-3 cursor-pointer"
                          />
                          <span>Ret. IVA</span>
                        </label>
                        {applyRetIva && !noAplicaIva && (
                          <select
                            value={retIvaPercent}
                            onChange={e => setRetIvaPercent(Number(e.target.value))}
                            className="px-1 py-0.2 bg-white border border-amber-300 rounded font-bold text-[9px] text-amber-800 outline-none"
                          >
                            <option value={75}>75%</option>
                            <option value={100}>100%</option>
                          </select>
                        )}
                      </div>
                    </div>

                    {/* Ret ISLR */}
                    <div className={`p-1 rounded border transition ${applyRetIslr ? 'bg-indigo-50/70 border-indigo-200' : 'bg-slate-50/60 border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1 font-bold text-slate-700 cursor-pointer text-[10px]">
                          <input
                            type="checkbox"
                            checked={applyRetIslr}
                            onChange={e => setApplyRetIslr(e.target.checked)}
                            className="rounded text-indigo-600 w-3 h-3 cursor-pointer"
                          />
                          <span>Ret. ISLR</span>
                        </label>
                        {applyRetIslr && (
                          <select
                            value={retIslrPercent}
                            onChange={e => setRetIslrPercent(Number(e.target.value))}
                            className="px-1 py-0.2 bg-white border border-indigo-300 rounded font-bold text-[9px] text-indigo-800 outline-none"
                          >
                            <option value={1}>1%</option>
                            <option value={2}>2%</option>
                            <option value={3}>3%</option>
                            <option value={5}>5%</option>
                          </select>
                        )}
                      </div>
                    </div>

                    {/* BOTÓN NO APLICA IVA (DEBAJO DE RET. ISLR) */}
                    <div className={`p-1 rounded border transition cursor-pointer select-none ${
                      noAplicaIva ? 'bg-emerald-50 border-emerald-300 shadow-2xs' : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100/60'
                    }`}>
                      <label className="flex items-center gap-1.5 font-bold cursor-pointer text-[10px]">
                        <input
                          type="checkbox"
                          checked={noAplicaIva}
                          onChange={e => handleToggleNoAplicaIva(e.target.checked)}
                          className="rounded text-emerald-600 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span className={noAplicaIva ? 'text-emerald-800 font-black' : 'text-slate-700'}>
                          No Aplica IVA (Compra Exenta)
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. TOTALES / RESUMEN DE LIQUIDACIÓN FISCAL (EXACTAMENTE COMO LO PIDIÓ) */}
            <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2 shrink-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                <span className="font-black text-slate-700 text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <DollarSign size={12} className="text-emerald-600" />
                  Liquidación Fiscal de la Compra
                </span>
                <span className="text-[10px] font-mono text-slate-400 font-bold">
                  TASA: Bs. {exchangeRate.toFixed(2)}
                </span>
              </div>

              <div className="space-y-1.5 font-mono text-xs">
                {/* 1. Subtotal Neto */}
                <div className="flex justify-between items-center text-slate-600 text-[11px]">
                  <span className="font-sans font-semibold">Subtotal Neto:</span>
                  <div className="text-right space-x-2">
                    <span className="font-bold text-slate-800">${formatNumber(totals.subtotalUSD)}</span>
                    <span className="text-slate-500 text-[10px]">Bs. {formatNumber(totals.subtotalBs)}</span>
                  </div>
                </div>

                {/* 2. Base Exenta */}
                <div className="flex justify-between items-center text-slate-600 text-[11px]">
                  <span className="font-sans font-semibold">Base Exenta:</span>
                  <div className="text-right space-x-2">
                    <span className="font-bold text-slate-800">${formatNumber(totals.montoExentoUSD)}</span>
                    <span className="text-slate-500 text-[10px]">Bs. {formatNumber(totals.montoExentoBs)}</span>
                  </div>
                </div>

                {/* 3. Base Imponible */}
                <div className="flex justify-between items-center text-slate-600 text-[11px]">
                  <span className="font-sans font-semibold">Base Imponible:</span>
                  <div className="text-right space-x-2">
                    <span className="font-bold text-slate-800">${formatNumber(totals.baseImponibleUSD)}</span>
                    <span className="text-slate-500 text-[10px]">Bs. {formatNumber(totals.baseImponibleBs)}</span>
                  </div>
                </div>

                {/* 4. IVA */}
                <div className="flex justify-between items-center text-slate-600 text-[11px]">
                  <span className="font-sans font-semibold">IVA (16%):</span>
                  <div className="text-right space-x-2">
                    <span className="font-bold text-slate-800">${formatNumber(totals.ivaMontoUSD)}</span>
                    <span className="text-slate-500 text-[10px]">Bs. {formatNumber(totals.ivaMontoBs)}</span>
                  </div>
                </div>

                {totals.retIvaMontoUSD > 0 && !noAplicaIva && (
                  <div className="flex justify-between items-center text-amber-700 bg-amber-50/60 px-1.5 py-0.5 rounded text-[10px]">
                    <span className="font-sans">(-) Retención IVA ({retIvaPercent}%):</span>
                    <span className="font-bold">-${formatNumber(totals.retIvaMontoUSD)}</span>
                  </div>
                )}

                {totals.retIslrMontoUSD > 0 && (
                  <div className="flex justify-between items-center text-indigo-700 bg-indigo-50/60 px-1.5 py-0.5 rounded text-[10px]">
                    <span className="font-sans">(-) Retención ISLR ({retIslrPercent}%):</span>
                    <span className="font-bold">-${formatNumber(totals.retIslrMontoUSD)}</span>
                  </div>
                )}

                {/* 5. Total Factura */}
                <div className="border-t border-slate-200 pt-1.5 flex justify-between items-center text-slate-900 font-bold text-xs">
                  <span className="font-sans font-black">Total Factura:</span>
                  <div className="text-right space-x-2">
                    <span className="text-xs font-black">${formatNumber(totals.totalFacturaUSD)}</span>
                    <span className="text-[10px] text-slate-600">Bs. {formatNumber(totals.totalFacturaBs)}</span>
                  </div>
                </div>

                {/* NETO A PAGAR PROVEEDOR CARD */}
                <div className="mt-2 bg-gradient-to-br from-indigo-50 to-indigo-100/60 p-2.5 rounded-xl border border-indigo-200/90 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-black uppercase text-indigo-900 tracking-wider block">
                      Neto a Pagar Proveedor
                    </span>
                    <span className="text-[9px] font-bold text-indigo-600 font-sans">
                      CONDICIÓN: {paymentCondition.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xl xl:text-2xl font-black text-indigo-600 font-mono tracking-tight leading-none">
                      ${formatNumber(totals.netoPagarUSD)}
                    </div>
                    <div className="text-[10px] font-bold text-slate-600 font-mono mt-0.5">
                      Equiv: Bs. {formatNumber(totals.netoPagarBs)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-auto pt-1">
            {/* 5. OBSERVACIONES */}
            <div className="bg-white p-2 rounded-xl border border-slate-200/90 shadow-2xs shrink-0">
              <label className="block text-slate-600 font-bold mb-0.5 text-[9px] uppercase">
                Observaciones / Guía de Despacho
              </label>
              <input
                type="text"
                placeholder="Observaciones de entrega, transporte, condiciones..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:border-indigo-600 outline-none"
              />
            </div>

            {/* 6. BOTÓN PRINCIPAL DE REGISTRO */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider shrink-0 active:scale-[0.99] disabled:opacity-50"
            >
              <Check size={16} className="stroke-[3]" />
              <span>{isSubmitting ? 'Procesando...' : `Registrar Compra (${paymentCondition.toUpperCase()}) [F2]`}</span>
            </button>
          </div>

        </div>

        {/* COLUMNA DERECHA: GRILLA DE ARTÍCULOS (SIN U.M, STOCK, IVA) */}
        <div className="flex-1 min-w-0 flex flex-col h-full bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          
          {/* Sub-barra de Grilla: Scanner + Botones */}
          <div className="px-3 py-1.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1">
                <Package size={14} className="text-indigo-600" />
                Renglones de Compra
              </span>
              <span className="text-[10px] bg-slate-200/80 text-slate-700 font-bold px-2 py-0.5 rounded-full font-mono">
                {items.length} {items.length === 1 ? 'artículo' : 'artículos'}
              </span>
            </div>

            {/* Lector de Código de Barras / SKU Bar */}
            <div className="flex-1 max-w-md relative flex items-center">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none flex items-center gap-1">
                <ScanBarcode size={14} />
              </div>
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder="Escanear Código de Barras o SKU... [F4]"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeScan(barcodeInput);
                  }
                }}
                className="w-full pl-8 pr-16 py-1 bg-white border border-indigo-200 hover:border-indigo-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 rounded-lg text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition font-mono shadow-2xs"
              />
              <button
                type="button"
                onClick={() => handleBarcodeScan(barcodeInput)}
                className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-black tracking-wide cursor-pointer transition shadow-xs"
              >
                Enter
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenProductModal(null)}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 transition shadow-2xs cursor-pointer"
                title="Abrir catálogo de inventario (F3)"
              >
                <Search size={13} />
                <span>Inventario (F3)</span>
              </button>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-2xs"
                title="Añadir renglón vacío"
              >
                <Plus size={13} />
                <span>+ Fila</span>
              </button>
              <button
                type="button"
                onClick={() => setIsNewProductModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer shadow-2xs"
                title="Crear nuevo producto en el catálogo"
              >
                <Plus size={13} />
                <span>+ Nuevo</span>
              </button>
            </div>
          </div>

          {/* Tabla de Artículos con Scroll Interno ÚNICAMENTE (SIN U.M, STOCK, IVA) */}
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 border-b border-slate-100">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 select-none sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="px-2.5 py-2 w-8 text-center">#</th>
                  <th className="px-2.5 py-2 w-32">Código / SKU</th>
                  <th className="px-2.5 py-2 min-w-[260px]">Artículo / Descripción</th>
                  <th className="px-2.5 py-2 w-24 text-right">Cant.</th>
                  <th className="px-2.5 py-2 w-28 text-right">Costo ({currency === 'USD' ? '$' : 'Bs.'})</th>
                  <th className="px-3 py-2 w-32 text-right">Total ({currency === 'USD' ? '$' : 'Bs.'})</th>
                  <th className="px-1.5 py-2 w-8 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((item, idx) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-2.5 py-1.5 text-center font-bold text-slate-400 text-[11px]">{idx + 1}</td>

                      {/* SKU / Código */}
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={item.codigo || ''}
                          onChange={e => handleItemFieldChange(idx, 'codigo', e.target.value.toUpperCase())}
                          onBlur={e => {
                            const val = e.target.value.trim().toLowerCase();
                            if (val) {
                              const found = products.find(p => p.codigo && p.codigo.trim().toLowerCase() === val);
                              if (found) {
                                addProductToItems(found, idx);
                              }
                            }
                          }}
                          placeholder="SKU..."
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 text-xs"
                        />
                      </td>

                      {/* Descripción + Botón Selector de Inventario */}
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={item.descripcion}
                            onChange={e => handleItemFieldChange(idx, 'descripcion', e.target.value)}
                            placeholder="Nombre del artículo o descripción..."
                            className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleOpenProductModal(idx)}
                            title="Seleccionar del inventario"
                            className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded border border-indigo-200 transition cursor-pointer shrink-0"
                          >
                            <Search size={12} />
                          </button>
                        </div>
                      </td>

                      {/* Cantidad Recibida */}
                      <td className="px-2 py-1 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.cantidad !== undefined && item.cantidad !== null && item.cantidad !== '' ? String(item.cantidad).replace('.', ',') : ''}
                          onChange={e => {
                            const raw = e.target.value.replace(/[^0-9.,]/g, '');
                            handleItemFieldChange(idx, 'cantidad', raw);
                          }}
                          placeholder="1"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 text-xs text-right"
                        />
                      </td>

                      {/* Costo Unitario */}
                      <td className="px-2 py-1 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.costo_unitario !== undefined && item.costo_unitario !== null && item.costo_unitario !== '' ? String(item.costo_unitario).replace('.', ',') : ''}
                          onChange={e => {
                            const raw = e.target.value.replace(/[^0-9.,]/g, '');
                            handleItemFieldChange(idx, 'costo_unitario', raw);
                          }}
                          placeholder="0,00"
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 text-xs text-right"
                        />
                      </td>

                      {/* Subtotal Línea */}
                      <td className="px-3 py-1 text-right font-mono font-black text-slate-900 text-xs">
                        {currency === 'USD' ? '$' : 'Bs.'} {formatNumber(item.total)}
                      </td>

                      {/* Eliminar Fila */}
                      <td className="px-1 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                          title="Eliminar fila"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* MODAL DE SELECTOR DE INVENTARIO DE MERCANCÍA */}
      {/* ========================================================================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[90vh] border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Header del Modal */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-500/20">
                  <Package size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Selector de Inventario de Mercancía
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Busque y seleccione el artículo para ingresarlo al comprobante de compra
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

                      const exactProd = products.find(p => p.codigo && p.codigo.trim().toLowerCase() === term);
                      if (exactProd) {
                        handleSelectProductFromModal(exactProd);
                        return;
                      }

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
                      ? `No hay coincidencias para "${productSearchTerm}".`
                      : 'No hay productos registrados en el inventario.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProductModalOpen(false);
                      setIsNewProductModalOpen(true);
                    }}
                    className="mt-3 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>+ Crear este producto en el catálogo</span>
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-3.5 py-2.5 w-24">Código</th>
                        <th className="px-3.5 py-2.5">Artículo / Categoría</th>
                        <th className="px-3.5 py-2.5 w-28 text-center">Stock Actual</th>
                        <th className="px-3.5 py-2.5 w-32 text-right">Último Costo ($)</th>
                        <th className="px-3.5 py-2.5 w-32 text-right">
                          Costo ({currency === 'USD' ? '$' : 'Bs.'})
                        </th>
                        <th className="px-3.5 py-2.5 w-20 text-center">IVA</th>
                        <th className="px-3.5 py-2.5 w-28 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map(prod => {
                        const isOutOfStock = (Number(prod.stock_actual) || 0) <= 0;
                        const isLowStock = !isOutOfStock && (Number(prod.stock_actual) <= (Number(prod.stock_minimo) || 5));
                        
                        let displayCostInCurrency = prod.costo_unitario || 0;
                        if (currency === 'VES' && exchangeRate > 0) {
                          displayCostInCurrency = displayCostInCurrency * exchangeRate;
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
                                {prod.stock_actual} {prod.unidad_medida || 'UND'}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-700">
                              ${Number(prod.costo_unitario || 0).toFixed(2)}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-indigo-900">
                              {currency === 'USD' ? `$ ${displayCostInCurrency.toFixed(2)}` : `Bs. ${displayCostInCurrency.toFixed(2)}`}
                            </td>
                            <td className="px-3.5 py-3 text-center">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                prod.aplica_iva ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {prod.aplica_iva ? '16%' : 'Exento'}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectProductFromModal(prod);
                                }}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer"
                              >
                                Seleccionar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA SELECCIONAR PROVEEDOR */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Building2 size={16} className="text-indigo-600" />
                <span>Seleccionar Proveedor</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={supplierSearchTerm}
                  onChange={e => setSupplierSearchTerm(e.target.value)}
                  placeholder="Buscar proveedor por RIF o Nombre..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="p-3 overflow-y-auto divide-y divide-slate-100 text-xs flex-1">
              {filteredSuppliers.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <p>No se encontraron proveedores coincidentes.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSupplierModalOpen(false);
                      setIsNewSupplierModalOpen(true);
                    }}
                    className="mt-2 text-indigo-600 font-bold hover:underline cursor-pointer"
                  >
                    + Registrar nuevo proveedor
                  </button>
                </div>
              ) : (
                filteredSuppliers.map(s => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSupplier(s)}
                    className="p-3 hover:bg-indigo-50/60 rounded-xl transition cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[11px] bg-slate-100 group-hover:bg-indigo-100 text-slate-700 group-hover:text-indigo-800 px-2 py-0.5 rounded">
                          {s.taxId || s.tax_id || s.rif}
                        </span>
                        <h5 className="font-bold text-slate-900 text-xs">{s.name || s.nombre}</h5>
                      </div>
                      {(s.address || s.direccion) && <p className="text-[11px] text-slate-400 mt-0.5">📍 {s.address || s.direccion}</p>}
                    </div>
                    <ArrowRight size={14} className="text-slate-300 group-hover:text-indigo-600 transition" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA CREAR NUEVO PROVEEDOR */}
      {isNewSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Plus size={16} className="text-emerald-600" />
                <span>Registrar Nuevo Proveedor</span>
              </div>
              <button
                type="button"
                onClick={() => setIsNewSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Razón Social / Nombre <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSupplierForm.name}
                  onChange={e => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
                  placeholder="Ej: Distribuidora Nacional, C.A."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    RIF / Documento <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newSupplierForm.taxId}
                    onChange={e => setNewSupplierForm({ ...newSupplierForm, taxId: e.target.value.toUpperCase() })}
                    placeholder="J-12345678-0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newSupplierForm.phone}
                    onChange={e => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                    placeholder="0414-1234567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={newSupplierForm.email}
                  onChange={e => setNewSupplierForm({ ...newSupplierForm, email: e.target.value })}
                  placeholder="ventas@proveedor.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dirección Fiscal</label>
                <input
                  type="text"
                  value={newSupplierForm.address}
                  onChange={e => setNewSupplierForm({ ...newSupplierForm, address: e.target.value })}
                  placeholder="Zona Industrial..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewSupplierModalOpen(false)}
                className="btn-secondary text-xs py-2 px-3.5 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateSupplier}
                className="btn-primary text-xs py-2 px-4 cursor-pointer"
              >
                Guardar Proveedor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA CREAR NUEVO PRODUCTO EN CATÁLOGO */}
      {isNewProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Package size={16} className="text-indigo-600" />
                <span>Incorporar Nuevo Artículo al Catálogo</span>
              </div>
              <button
                type="button"
                onClick={() => setIsNewProductModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Código SKU <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProdForm.codigo}
                    onChange={e => setNewProdForm({ ...newProdForm, codigo: e.target.value.toUpperCase() })}
                    placeholder="SKU-001"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unidad Medida</label>
                  <select
                    value={newProdForm.unidad_medida}
                    onChange={e => setNewProdForm({ ...newProdForm, unidad_medida: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none"
                  >
                    <option value="UND">Unidad (UND)</option>
                    <option value="KG">Kilogramos (KG)</option>
                    <option value="LTS">Litros (LTS)</option>
                    <option value="MTS">Metros (MTS)</option>
                    <option value="CJ">Cajas (CJ)</option>
                    <option value="PKT">Paquete (PKT)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Nombre del Artículo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newProdForm.nombre}
                  onChange={e => setNewProdForm({ ...newProdForm, nombre: e.target.value })}
                  placeholder="Ej: Aceite Motor 20W50 Sintético 1L"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Costo Unitario ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProdForm.costo_unitario}
                    onChange={e => setNewProdForm({ ...newProdForm, costo_unitario: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Precio Venta Sugerido ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProdForm.precio_venta}
                    onChange={e => setNewProdForm({ ...newProdForm, precio_venta: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={newProdForm.aplica_iva}
                    onChange={e => setNewProdForm({ ...newProdForm, aplica_iva: e.target.checked })}
                    className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
                  />
                  <span>Aplica IVA (16%)</span>
                </label>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewProductModalOpen(false)}
                className="btn-secondary text-xs py-2 px-3.5 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateProductInModal}
                className="btn-primary text-xs py-2 px-4 cursor-pointer"
              >
                Crear e Insertar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Previsualización y Confirmación de Asiento Contable */}
      {pendingVoucher && (
        <VoucherPreviewModal
          isOpen={!!pendingVoucher}
          onClose={() => setPendingVoucher(null)}
          initialComprobante={pendingVoucher.comprobante}
          cuentasContables={cuentasContables}
          onConfirm={pendingVoucher.onConfirm}
          showToast={showToast}
          title="Asiento Contable de Compra"
          subtitle="Verifique las cuentas de inventario, crédito fiscal y pasivo antes de registrar la factura de compra"
        />
      )}
    </div>
  );
}
