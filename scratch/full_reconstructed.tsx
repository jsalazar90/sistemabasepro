








import BackButton from '../components/common/BackButton';
import CuentaSelectorTrigger from '../components/common/CuentaSelectorTrigger';
import CuentaContableModal from '../components/common/CuentaContableModal';
import TasaCambioModal from '../components/invoicing/TasaCambioModal';
import { getTasaForDate } from '../services/exchangeRateService';

export default function InvoiceForm({
  contactos = [],
  products = [],
  cuentasContables = [],

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
  const navigate = useNavigate();

  // Document Info

  // Document Info
  const [docType, setDocType] = useState<'factura' | 'nota_entrega' | 'nota_credito' | 'nota_debito'>('factura');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(() => {
    const today = new Date().toISOString().split('T')[0];
  // Cliente Info
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerRif, setCustomerRif] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(() => {
    const today = new Date().toISOString().split('T')[0];
    return getTasaForDate(today).toFixed(2);
  const [isTasaModalOpen, setIsTasaModalOpen] = useState(false);

  // Sincronizar tasa si cambia la fecha de emisión
  useEffect(() => {
    const rate = getTasaForDate(issueDate);
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
      cuenta_inventario_id: '1.1.04.001'
    }
  ]);

  // Modales del flujo de emisión
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<'contado' | 'credito'>('contado');
  const [creditDays, setCreditDays] = useState(15);
  const [calculatedDueDate, setCalculatedDueDate] = useState('');

  // Modal de Cobranza (para facturas de Contado)
  const [isCobranzaModalOpen, setIsCobranzaModalOpen] = useState(false);
  const [cobranzaForm, setCobranzaForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    tasa: 36.50,
    pagos: [] as Array<{
      id: string;
      bancoId: string;
      metodoPago: string;
      referencia: string;
      monto: string;
      montoBs: string;
    }>
  });

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

  // Lista filtrada de clientes
  const customersList = useMemo(() => {
    const term = customerSearchTerm.toLowerCase();
    return contactos.filter(c => {
      const isCust = c.type === 'customer' || c.type === 'both';
      const match = !term || 
        (c.name || '').toLowerCase().includes(term) ||
    address: '',
    debitAccount: '',
    creditAccount: ''
  });
  const [customerAccountError, setCustomerAccountError] = useState<string | null>(null);
  // Totales calculados en tiempo real
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
      cuenta_inventario_id: '1.1.04.001'
    }
  ]);

  // Modales del flujo de emisión
      currency: curr === 'VES' ? 'VES' : 'USD',
      minimumFractionDigits: 2 
    }).format(amount || 0).replace('USD', '$').replace('VES', 'Bs.');
  };

  // Manejo de Cliente
  const handleSelectCustomer = (cust: any) => {
    setSelectedCustomerId(cust.id);
    setCustomerName(cust.name || cust.nombre || '');
    setCustomerRif(cust.taxId || cust.rif || '');
    setCustomerName(cust.name || cust.nombre || '');
    setCustomerRif(cust.taxId || cust.rif || '');
    setCustomerAddress(cust.address || cust.direccion || '');
    setCustomerPhone(cust.phone || cust.telefono || '');
    setCustomerEmail(cust.email || '');
    setIsCustomerModalOpen(false);
  };

  const handleSaveQuickCustomer = () => {
    if (!newCustName.trim() || !newCustRif.trim()) {
    const retIslrMonto = applyRetIslr ? baseImponible * (retIslrPercent / 100) : 0;

    // 4. Neto a Cobrar / Pagar (Total Facturado menos Retenciones que el cliente entrega en comprobante)
    const netoCobrar = Math.max(0, totalFactura - retIvaMonto - retIslrMonto);

  // Manejo de Cliente
  const handleSelectCustomer = (cust: any) => {
    setSelectedCustomerId(cust.id);
    setCustomerName(cust.name || cust.nombre || '');
    setCustomerRif(cust.taxId || cust.rif || '');

  // Modal de Cobranza (para facturas de Contado)
  const [isCobranzaModalOpen, setIsCobranzaModalOpen] = useState(false);
  const [cobranzaForm, setCobranzaForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    fecha: new Date().toISOString().split('T')[0],
    tasa: 36.50,
    pagos: [] as Array<{
      id: string;
      bancoId: string;
      metodoPago: string;
      referencia: string;
      monto: string;
      montoBs: string;
    }>
  });

  // Modal de Asiento Contable
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [pendingVoucher, setPendingVoucher] = useState<any>(null);
    const retIvaMonto = applyRetIva ? ivaMonto * (retIvaPercent / 100) : 0;

    // 3. Retención de ISLR (Decreto 1808: 2%, 5%, 1% o 3% sobre la Base Imponible)
    const retIslrMonto = applyRetIslr ? baseImponible * (retIslrPercent / 100) : 0;

    // 4. Neto a Cobrar / Pagar (Total Facturado menos Retenciones que el cliente entrega en comprobante)
    const netoCobrar = Math.max(0, totalFactura - retIvaMonto - retIslrMonto);

    // Calcular montos en USD y Bs. según la moneda seleccionada
    let totalUSD = 0;
    let totalBs = 0;
    let netoCobrarUSD = 0;
    let netoCobrarBs = 0;

    if (currency === 'USD') {
    setControlNumber(`00-${Math.floor(100000 + Math.random() * 900000)}`);
  }, [configContable, docType]);

  // Recalcular vencimiento al cambiar días de crédito o fecha de emisión
  useEffect(() => {
    const base = new Date(issueDate);
    base.setDate(base.getDate() + Number(creditDays || 0));
    setCalculatedDueDate(base.toISOString().split('T')[0]);
  }, [issueDate, creditDays]);


    return { 
      subtotal, 
      montoExento, 
      baseImponible, 
      const match = !term || 
        (c.name || '').toLowerCase().includes(term) ||
        (c.taxId || '').toLowerCase().includes(term);
      return isCust && match;
    });
  }, [contactos, customerSearchTerm]);

  // Totales calculados en tiempo real (con Retenciones e IGTF de acuerdo a leyes venezolanas)
  const totals = useMemo(() => {
  // Manejo de Items
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
      retIslrMonto,
      retIslrMontoUSD,
      retIslrMontoBs,
      netoCobrar,
      netoCobrarUSD,
        price = price * exchangeRate;
      }

      const lineSubtotal = qty * price;
      const isExempt = !prod.aplica_iva;
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
    setCustomerModalForm({
      name: '',
      isCompany: true,
      taxIdPrefix: 'J',
      taxIdNumber: '',
      phone: '',
      personaContacto: '',
      cargo: '',
      address: '',
      debitAccount: configContable?.cuentaCxc || '1.1.02.001',
      creditAccount: configContable?.cuentaAnticipoRecibido || '2.1.01.001'
    });
    setActiveCustomerModalTab('info');
    setIsNewCustomerModalOpen(true);
  };

  const handleSaveCustomerFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerModalForm.name.trim()) {
      showToast?.('El nombre o razón social es obligatorio', 'error');
        updated.push(newItem);
      }
      return updated;
    });

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


  const handleOpenProductModal = (index: number | null = null) => {
    setActiveItemIndexForProduct(index);
    setProductSearchTerm('');
    setSelectedProductCategory('all');
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
  const handleSelectCondition = (cond: 'contado' | 'credito') => {
    setSelectedCondition(cond);
    setIsConditionModalOpen(false);

    if (cond === 'credito') {
      // Si es crédito, armar el comprobante directo con CxC y abrir el modal contable
      buildAndShowVoucher('credito');
    } else {
      // Si es contado, abrir el modal de Cobranza idéntico al del ERP
      const defaultBanco = bancos.length > 0 ? bancos[0] : null;
      const isBancoVES = defaultBanco && (defaultBanco.moneda === 'VES' || defaultBanco.moneda === 'Bs');
      
      const pagoInicial = {
        id: `pg_${Date.now()}`,
        bancoId: defaultBanco ? defaultBanco.id : '',
        metodoPago: 'Transferencia',
        referencia: '',
        monto: currency === 'USD' ? totals.netoCobrar.toFixed(2) : totals.netoCobrarUSD.toFixed(2),
        montoBs: currency === 'VES' ? totals.netoCobrar.toFixed(2) : totals.netoCobrarBs.toFixed(2)
      };

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

    // Validación obligatoria de cuentas contables vinculadas manualmente
    if (!customerModalForm.debitAccount?.trim() || !customerModalForm.creditAccount?.trim()) {
      setActiveCustomerModalTab('contabilidad');
      const msg = !customerModalForm.debitAccount?.trim() && !customerModalForm.creditAccount?.trim()
        ? 'Debe vincular las cuentas contables (Cuenta por Cobrar y Anticipo) de forma manual antes de registrar el cliente'
  };

  // Proceder desde Cobranza al Asiento Contable
  const handleConfirmCobranzaToVoucher = () => {
    const totalPagado = cobranzaForm.pagos.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0);
    if (cobranzaForm.pagos.length === 0 || totalPagado <= 0) {
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
    const netoAmount = totals.netoCobrar;

    if (condition === 'credito') {
      // Debe: CxC Clientes (por el monto neto a percibir de la factura)
      linesVoucher.push({
        id: `vl_cxc`,
        cuentaId: mainCustomerAccount,
        nombreCuenta: `Cuentas por Cobrar Clientes (${customerName})`,
        descripcion: `Factura a crédito ${invoiceNumber} - Venc. ${calculatedDueDate}`,
        debe: netoAmount,
        haber: 0
      });
    } else {
      // Debe: Banco(s) según pagos registrados en el modal de cobranza
      cobranzaForm.pagos.forEach((pago, pIdx) => {
        const bank = bancos.find(b => b.id === pago.bancoId);
      item.iva_monto = iva;
      item.total = lineSubtotal + iva;

      updated[index] = item;
        const qty = updated[index].cantidad || 1;
        // Si la moneda es VES, convertir el precio venta en USD a VES
        let price = prod.precio_venta || 0;
        if (currency === 'VES' && exchangeRate > 0) {
          price = price * exchangeRate;
        }

        const lineSubtotal = qty * price;
        const isExempt = !prod.aplica_iva;
        const iva = isExempt ? 0 : lineSubtotal * 0.16;
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
    setIsConditionModalOpen(true);
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
      const isBancoVES = defaultBanco && (defaultBanco.moneda === 'VES' || defaultBanco.moneda === 'Bs');
      
      const pagoInicial = {
        id: `pg_${Date.now()}`,
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

  // =========================================================================
  // PASO 1: Validar Formulario y Abrir Modal de Condición (Contado o Crédito)
  // =========================================================================
  const handleStartEmission = (e: React.FormEvent) => {

      updated[index] = item;
      return updated;
    });
  };

  // =========================================================================
  // PASO 1: Validar Formulario y Abrir Modal de Condición (Contado o Crédito)
  // =========================================================================
  const handleStartEmission = (e: React.FormEvent) => {
        showToast?.(`La fecha (${yr}) no coincide con el período contable seleccionado (${workingYear})`, 'error');
        return;
      }
    }

    // Abrir modal de selección Contado vs Crédito
    setIsConditionModalOpen(true);
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
      const isBancoVES = defaultBanco && (defaultBanco.moneda === 'VES' || defaultBanco.moneda === 'Bs');
      
      const pagoInicial = {
        id: `pg_${Date.now()}`,
        bancoId: defaultBanco ? defaultBanco.id : '',
        metodoPago: 'Transferencia',
        referencia: '',
        monto: currency === 'USD' ? totals.netoCobrar.toFixed(2) : totals.netoCobrarUSD.toFixed(2),

    // Si hay productos con stock 0 o insuficiente y aún no han sido autorizados con clave master
    if (zeroStockItems.length > 0 && !isZeroStockAuthorized) {
      setIsMasterAuthModalOpen(true);
      return;
    }

    // Abrir modal de selección Contado vs Crédito
    setIsConditionModalOpen(true);
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
      const isBancoVES = defaultBanco && (defaultBanco.moneda === 'VES' || defaultBanco.moneda === 'Bs');
      
      const pagoInicial = {
        id: `pg_${Date.now()}`,
        bancoId: defaultBanco ? defaultBanco.id : '',
        metodoPago: 'Transferencia',
                    <Search size={14} />
                    <span>Buscar Cliente</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomerModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <Plus size={14} />
                    <span>Nuevo Cliente</span>
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
            {/* TARJETA DE CLIENTE */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <User size={18} className="text-indigo-600" />
                  <span>Datos del Cliente / Facturado a:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <Search size={14} />
                    <span>Buscar Cliente</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewCustomerModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <Plus size={14} />
                    <span>Nuevo Cliente</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Razón Social / Nombre *</label>
  // Manejo de pagos en el Modal de Cobranza
  const handleAddPagoCobranza = () => {
    const defaultBanco = bancos.length > 0 ? bancos[0] : null;
    setCobranzaForm(prev => ({
      ...prev,
    if (condition === 'credito') {
      // Debe: CxC Clientes (por el monto neto a percibir de la factura en USD)
      linesVoucher.push({
        id: `vl_cxc`,
        cuentaId: mainCustomerAccount,
        const pagoMonto = parseFloat(pago.monto) || (netoAmount / cobranzaForm.pagos.length);

        linesVoucher.push({
          id: `vl_bnk_${pIdx}`,
          cuentaId: bankAccount,
          nombreCuenta: bank ? `${bank.banco} (${bank.moneda})` : 'Efectivo en Bancos',
          descripcion: `Cobro contado Fac ${invoiceNumber} - Ref: ${pago.referencia || 'S/R'}`,
          debe: pagoMonto,
          haber: 0
        });
        const term = terminalesPos.find(t => t.id === pago.terminalId);
        
        const accountId = isPos
          ? (term?.cuenta_transitoria_id || '1.1.01.03')
          : (bank?.cuenta_contable_id || configContable?.cuentaBancos || '1.1.01.004');

        const accountName = isPos
          ? `Puntos de Venta por Liquidar (${term?.nombre || 'Tarjetas'})`
          : (bank ? `${bank.banco} (${bank.moneda})` : 'Efectivo en Bancos');

        empresa_id: '',
        numero: invoiceNumber.trim().toUpperCase(),
        control_numero: controlNumber.trim(),
        tipo_documento: docType,
        condicion: selectedCondition,
        dias_credito: selectedCondition === 'credito' ? creditDays : 0,
        cliente_id: selectedCustomerId || `ct_${Date.now()}`,
        cliente_nombre: customerName.trim(),
        cliente_rif: customerRif.trim(),
        cliente_direccion: customerAddress.trim(),
        cliente_telefono: customerPhone.trim(),
        cliente_email: customerEmail.trim(),
        fecha_emision: issueDate,
        fecha_vencimiento: selectedCondition === 'credito' ? calculatedDueDate : issueDate,
        moneda: currency,
        tasa_cambio: exchangeRate,
        items: items,
        subtotal: totals.subtotal,
        base_imponible: totals.baseImponible,
        monto_exento: totals.montoExento,
        iva_porcentaje: 16,
        iva_monto: totals.ivaMonto,
        igtf_porcentaje: applyIgtf ? igtfPercent : 0,
        igtf_monto: totals.igtfMonto,
        retencion_iva_porcentaje: applyRetIva ? retIvaPercent : 0,
        retencion_iva_monto: totals.retIvaMonto,
        retencion_islr_porcentaje: applyRetIslr ? retIslrPercent : 0,
        retencion_islr_monto: totals.retIslrMonto,
        neto_cobrar: totals.netoCobrar,
        total: totals.total,
          isCompany: !customerRif.toUpperCase().startsWith('V'),
          taxId: customerRif.trim() || 'J-00000000-0',
          email: customerEmail.trim(),
          phone: customerPhone.trim(),
          address: customerAddress.trim(),
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DISTRIBUCIÓN PRINCIPAL DE PANTALLA: 2 COLUMNAS */}
                        Precio Unit. ({currency === 'USD' ? '$' : 'Bs.'})
                      </th>
                      <th className="px-3 py-2.5 w-20 text-center">IVA</th>
                      <th className="px-3 py-2.5 w-32 text-right">
                        Total ({currency === 'USD' ? '$' : 'Bs.'})
                      </th>
                      <th className="px-3 py-2.5 w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      Bolívares (Bs.)
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Moneda de emisión activa: <b className="text-slate-700">{currency === 'USD' ? 'Dólares Estadounidenses ($)' : 'Bolívares Digitales (Bs.)'}</b>
                </p>
              </div>
            </div>

              producto_nombre: originalProd.nombre,
              producto_codigo: originalProd.codigo,
              tipo: 'venta',
              cantidad: item.cantidad,
              stock_anterior: currentStock,
                                  {p.codigo} - {p.nombre} (Stock: {p.stock_actual} {p.unidad_medida} • Ref: ${p.precio_venta})
                                </option>
                              ))}
                            </select>

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

                    <button
                      type="button"
                      onClick={() => setCurrency('VES')}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                        currency === 'VES'
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Fecha de Emisión *</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Tasa de Cambio Oficial (Bs./$)</label>
              <div className="px-4 py-2 bg-indigo-50/80 border border-indigo-100 rounded-2xl text-right">
                <span className="block text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                  N° Documento
                </span>
                <span className="font-mono font-black text-base text-indigo-900">
                  {invoiceNumber}
                </span>
              </div>
            </div>
          </div>

          {/* Fila de Datos del Documento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1">N° de Factura / Correlativo *</label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-indigo-600 focus:bg-white focus:border-indigo-600 outline-none uppercase"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">N° de Control Fiscal</label>
              <input
                type="text"
                placeholder="00-000000"
                value={controlNumber}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition rounded-lg"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* NOTAS Y TÉRMINOS */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <label className="block text-slate-700 font-bold mb-2 text-xs">
                Notas / Términos de la Factura
              </label>
              <textarea
                rows={3}
                placeholder="Condiciones de despacho, garantía, cuentas bancarias de la empresa para pago..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 focus:bg-white focus:border-indigo-600 outline-none resize-none"
              />
            </div>
          </div>

          {/* COLUMNA DERECHA (1/3): PANEL DE TOTALES Y BOTÓN DE ACCIÓN STICKY */}
          <div className="lg:sticky lg:top-4 space-y-4">
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
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenProductModal(idx)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 hover:border-indigo-400 rounded-xl cursor-pointer text-left transition flex items-center justify-between gap-1.5 group min-w-0"
                                title="Haga clic para cambiar de artículo"
                              >
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  <span className="font-mono font-black text-indigo-700 text-[11px] bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 shrink-0">
                                    {item.codigo || selectedProd?.codigo}
              </div>
            </div>

            {/* GRILLA DE PRODUCTOS / ARTÍCULOS */}
            <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Package size={18} className="text-indigo-600" />
                  <span>Artículos de Inventario & Servicios Facturados</span>
                </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      El cliente cancela de inmediato. Se registrará la cobranza y el ingreso bancario.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <span>Cobrar ahora</span>
                    <ArrowRight size={14} />
                  </span>
                </div>

                  <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <span>Cobrar ahora</span>
                    <ArrowRight size={14} />
                  </span>
                </div>

                {/* TARJETA CRÉDITO */}
                <div 
                  onClick={() => handleSelectCondition('credito')}
                  className="p-5 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 hover:border-indigo-500 cursor-pointer transition flex flex-col justify-between gap-3 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <Calendar size={22} />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm group-hover:text-indigo-700 transition">
                      Factura a Crédito
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Se generará una cuenta por cobrar (CxC) pendiente con fecha de vencimiento.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
                    <span>Asignar crédito</span>
                    <ArrowRight size={14} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PASO 2 (SI ES CONTADO): MODAL DE COBRANZA (IDÉNTICO AL SISTEMA) */}
      {/* ========================================================================= */}
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Registro de Cobranza (Contado)</h3>
                                  <Search size={13} className="text-indigo-500 group-hover:scale-110 transition-transform shrink-0" />
                                  <span className="truncate">Buscar artículo en inventario...</span>
                                </span>
                                <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded shadow-2xs shrink-0">
                                  Catálogo
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenProductModal(idx)}
                                className="w-full px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/90 border border-slate-200 hover:border-indigo-400 rounded-xl cursor-pointer text-left transition flex items-center justify-between gap-1.5 group min-w-0"
                                title="Haga clic para cambiar de artículo"
                              >
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  <span className="font-mono font-black text-indigo-700 text-[11px] bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 shrink-0">
                                    {item.codigo || selectedProd?.codigo}
                                  </span>
                                  <span className="font-bold text-slate-800 text-xs truncate">
                                    {item.descripcion || selectedProd?.nombre}
                                  </span>
                                  {item.exento && !(item.descripcion || '').includes('(E)') && (
                                    <span 
                                      className="font-black text-slate-900 font-mono text-[10px] bg-slate-200/80 px-1 py-0.2 rounded border border-slate-300 shrink-0" 
                                      title="Artículo exento de IVA"
                                    >
                                      (E)
                                    </span>
                                  )}
                    <p className="text-[11px] font-bold text-emerald-600">
                      Equiv: Bs. {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(totals.totalBs)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Fecha de Pago</label>
                  <input
                    type="date"
                    value={cobranzaForm.fecha}
                    onChange={(e) => setCobranzaForm({ ...cobranzaForm, fecha: e.target.value })}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Lista de Pagos Recibidos */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-slate-800 text-xs">Desglose de Formas de Pago Recibidas</h4>
                  <button
                    type="button"
                    onClick={handleAddPagoCobranza}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1 transition"
                  >
                    <Plus size={13} />
                                  )}
                                  <RefreshCw size={11} className="text-slate-400 group-hover:text-indigo-600 transition" />
                                </div>
                              </button>
                  {currency === 'USD' && (
                    <p className="text-[11px] font-bold text-emerald-600">
                      Equiv: Bs. {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(totals.totalBs)}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Fecha de Pago</label>
                  <input
                    type="date"
                    value={cobranzaForm.fecha}
                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                handleItemFieldChange(idx, 'cantidad', isNaN(val) ? 0 : val);
                              }}
                              onBlur={() => {
                                if (!item.cantidad || item.cantidad <= 0) {
                                  handleItemFieldChange(idx, 'cantidad', 1);
                                }
                              }}
                              className="w-14 px-1 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-center text-slate-900 focus:bg-white focus:border-indigo-600 outline-none"
                            />
                          </td>

                          {/* Precio Unitario */}
                          <td className="px-1 py-2 text-right align-middle">
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
                              className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-right text-slate-900 focus:bg-white focus:border-indigo-600 outline-none"
                            />
                          </td>

                          {/* Subtotal Línea */}
                          <td className="px-1 py-2 text-right align-middle font-black text-slate-900 whitespace-nowrap">
                            {formatMoney(item.total, currency)}
                          </td>

                          {/* Botón Eliminar */}
                          <td className="px-1 py-2 text-center align-middle">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition rounded-lg cursor-pointer"
                              title="Eliminar renglón"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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

        {/* ========================================================================= */}
        {/* 4. SECCIÓN INFERIOR DUAL: RETENCIONES / NOTAS (IZQ) vs TOTALES ERP (DER) */}
        {/* ========================================================================= */}
        <div className="w-full flex flex-col gap-3.5 items-stretch">
          
          {/* COLUMNA IZQUIERDA (7 COLS): TRIBUTOS FISCALES SENIAT, RETENCIONES Y NOTAS */}
          <div className="w-full space-y-3">
            
            {/* RETENCIONES FISCALES Y TRIBUTOS */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-2.5 text-xs">
                Renglones de la Factura
              </span>
              <span className="text-[10px] bg-slate-200/80 text-slate-700 font-bold px-2 py-0.5 rounded-full font-mono">
                {items.length} {items.length === 1 ? 'renglón' : 'renglones'}
              </span>
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
                          )}
                        </div>

                        {/* Botón eliminar pago */}
                        <div className="flex justify-end sm:pt-4">
                          {cobranzaForm.pagos.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePagoCobranza(pIdx)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Botones de acción del Modal de Cobranza */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCobranzaModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCobranzaToVoucher}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black transition shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                >
                  <span>Continuar a Asiento Contable</span>
                  <ArrowRight size={16} />
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
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-slate-100">
            <div className="p-5 border-b border-slate-100 bg-indigo-50/70 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Asiento Contable de Venta</h3>
                  <p className="text-xs text-indigo-700/80 font-semibold">
                    {pendingVoucher.numero} • Comprobante Automático ({selectedCondition.toUpperCase()})
                  </p>
                  </span>
                  {(applyRetIva || applyRetIslr) && (
                    <span className="text-[10px] text-slate-400 font-semibold">Deducidas las retenciones fiscales</span>
                  )}
                </div>
                <span className="text-xl font-black text-indigo-600">
                  {formatMoney(totals.netoCobrar, currency)}
                </span>
              </div>

                onClick={() => setIsVoucherModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between text-slate-600 font-medium">
                <span>Concepto: <b>{pendingVoucher.concepto}</b></span>
                  <span>(-) Retención IVA ({retIvaPercent}%):</span>
                  <span className="font-mono font-bold">-{formatMoney(totals.retIvaMonto, currency)}</span>
                </div>
              )}

              {/* Retención ISLR si aplica */}
              {applyRetIslr && totals.retIslrMonto > 0 && (
                <div className="flex justify-between text-indigo-700 font-semibold bg-indigo-50/60 px-2 py-1 rounded-lg border border-indigo-100">
                  <span>(-) Retención ISLR ({retIslrPercent}%):</span>
                  <span className="font-mono font-bold">-{formatMoney(totals.retIslrMonto, currency)}</span>
                    <input
                      type="checkbox"
                      checked={applyIgtf}
                      onChange={(e) => setApplyIgtf(e.target.checked)}
                      className="rounded text-emerald-600 w-4 h-4 cursor-pointer"
                    />
                    <span>Percepción IGTF (3%)</span>
                  </label>
                  {applyIgtf && (
                    <span className="font-mono font-bold text-emerald-800 text-[11px]">
        {/* ========================================================================= */}
        {/* 4. SECCIÓN INFERIOR DUAL: RETENCIONES / NOTAS (IZQ) vs TOTALES ERP (DER) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
          
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between text-slate-600 font-medium">
                <span>Concepto: <b>{pendingVoucher.concepto}</b></span>
                <span>Fecha: <b>{pendingVoucher.fecha}</b></span>
                </span>
              </div>

              {/* BOTÓN PRINCIPAL DE EMISIÓN */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm transition shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                <Save size={18} />
                <span>Emitir y Contabilizar</span>
              </button>
            </div>
          </div>

        </div>
      </form>

      {/* ========================================================================= */}
      {/* PASO 1: MODAL SOLICITUD DE CONDICIÓN (CONTADO VS CRÉDITO) */}
      {/* ========================================================================= */}
      {isConditionModalOpen && (
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
              <span>Total Unidades: <b className="text-slate-800">{items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0)}</b></span>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
                <span className="font-sans">Total Facturado:</span>
                <div className="text-right space-x-3">
                  <span className="text-sm font-black">{formatMoney(totals.totalUSD, 'USD')}</span>
                  <span className="text-xs text-slate-600 font-bold">{formatMoney(totals.totalBs, 'VES')}</span>
                </div>
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
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer transition"
                      >
                        <KeyRound size={13} />
                        <span>Ingresar Clave de Operaciones</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs flex items-start gap-2.5 text-emerald-800 animate-in fade-in">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-bold text-emerald-900">Operación Autorizada</p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Se autorizó la facturación de artículos en stock 0 mediante la Clave Especial de Operaciones.
                      </p>
                    </div>
                  </div>
                )
              )}

              {/* BOTÓN PRINCIPAL DE EMISIÓN */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm transition shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                <Save size={18} />
                <span>Emitir y Contabilizar</span>
              </button>
            </div>
          </div>

        </div>
      </form>

      {/* ========================================================================= */}
      {/* PASO 1: MODAL SOLICITUD DE CONDICIÓN (CONTADO VS CRÉDITO) */}
      {/* ========================================================================= */}
      {isConditionModalOpen && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
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

              {/* BOTÓN PRINCIPAL DE EMISIÓN */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm transition shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 mt-4 cursor-pointer"
              >
                <Save size={18} />
                <span>Emitir y Contabilizar</span>
              </button>
            </div>
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

        {/* Cerramos la columna izquierda */}
        </div>

        {/* COLUMNA DERECHA: GRILLA DE RENGLONES */}
        <div className="w-full lg:w-[55%] xl:w-[65%] flex flex-col min-h-[500px] lg:h-full bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden relative">
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
                          onClick={() => setCustomerModalForm(prev => ({ ...prev, isCompany: false, taxIdPrefix: 'V' }))}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                            !customerModalForm.isCompany
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <User size={16} />
                          <span>Persona Natural</span>
                        </button>
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 select-none sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="px-3 py-2 w-10 text-center">#</th>
                  <th className="px-3 py-2 w-28">Código / SKU</th>
                  <th className="px-3 py-2">Descripción / Concepto</th>
                rows={2}
                placeholder="Condiciones de despacho, garantía, cuentas bancarias de la empresa para pago..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
      {/* ========================================================================= */}
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
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                            Banco / Caja de Destino *
                          </label>
                          <select
                              <option key={b.id} value={b.id}>
                                {b.banco} ({b.moneda}) - {b.numero_cuenta}
                              </option>
                            ))}
                          </select>
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
                              const updated = [...cobranzaForm.pagos];
                              updated[pIdx].metodoPago = e.target.value;
                              setCobranzaForm({ ...cobranzaForm, pagos: updated });
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none"
                          >
                            <option value="Transferencia">Transferencia</option>
                            <option value="Pago Móvil">Pago Móvil</option>
                            <option value="Punto de Venta">Punto de Venta</option>
                            <option value="Zelle">Zelle</option>
                            onChange={(e) => setCustomerModalForm(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none" 
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono de Contacto</label>
                        <div className="relative">
                          <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            >
              <Save size={16} />
              <span>Emitir Factura ({selectedCondition.toUpperCase()}) [F2]</span>
            </button>

          </div>

        </div>

      </form>
                    type="button"
                    onClick={handleAddPagoCobranza}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1 transition"
                  >
                    <Plus size={13} />
                    <span>Agregar otra forma de pago</span>
                  </button>
                </div>

                {cobranzaForm.pagos.map((pago, pIdx) => {

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
                    <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100">
                      <div className="flex items-start gap-2.5 text-indigo-900">
                        <BookOpen size={16} className="shrink-0 mt-0.5 text-indigo-600" />
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
                  </p>
                </div>
              </div>
              <button
                type="button"
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                            N° de Referencia / Comprobante
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: REF-987410"
                            value={pago.referencia}
                            onChange={(e) => {
                              const updated = [...cobranzaForm.pagos];
                              updated[pIdx].referencia = e.target.value;
                              setCobranzaForm({ ...cobranzaForm, pagos: updated });
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-600"
                          />
            </form>
          </div>
        </div>
      )}

      {/* Modal Selector de Cuenta para el Cliente */}
      <CuentaContableModal
        isOpen={showCustomerCuentaModal}
        onClose={() => {
          setShowCustomerCuentaModal(false);
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm transition shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <Save size={16} />
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
        }}
        cuentasContables={cuentasContables}
        selectedCuentaId={activeCustomerAccountKey ? (customerModalForm as any)[activeCustomerAccountKey] : ''}
        onSelect={(cuenta) => {
          if (activeCustomerAccountKey && cuenta) {
            setCustomerModalForm(prev => ({ ...prev, [activeCustomerAccountKey]: cuenta.id }));
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




                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-600">
                              ${Number(prod.precio_venta || 0).toFixed(2)}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900">
                              {formatMoney(displayPriceInCurrency, currency)}
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectProductFromModal(prod);
                                }}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs group-hover:scale-105 transition flex items-center gap-1 mx-auto cursor-pointer"
                              >
                                <Check size={13} />
                                <span>Seleccionar</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>



















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
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-600">
                              ${Number(prod.precio_venta || 0).toFixed(2)}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900">
                              {formatMoney(displayPriceInCurrency, currency)}
                            </td>
                            <td className="px-3.5 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  e.stopPropagation();
                                  handleSelectProductFromModal(prod);
                                }}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs group-hover:scale-105 transition flex items-center gap-1 mx-auto cursor-pointer"
                              >
                                <Check size={13} />
                                <span>Seleccionar</span>
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

    </div>
  );
}



















































































































































































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
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-600">
                              ${Number(prod.precio_venta || 0).toFixed(2)}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900">
                              {formatMoney(displayPriceInCurrency, currency)}
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
                onClick={() => {
                  setIsProductModalOpen(false);
                  setActiveItemIndexForProduct(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
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
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-bold text-slate-600">
                              ${Number(prod.precio_venta || 0).toFixed(2)}
                            </td>
                            <td className="px-3.5 py-3 text-right font-mono font-black text-slate-900">
                              {formatMoney(displayPriceInCurrency, currency)}
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectProductFromModal(prod);
                                }}
                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs group-hover:scale-105 transition flex items-center gap-1 mx-auto cursor-pointer"
                              >
                                <Check size={13} />
                                <span>Seleccionar</span>
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

    </div>
  );
}




















































































































































































































































      />

      {/* Modal de Impresión de Factura Emitida */}
      <InvoicePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        factura={lastEmittedInvoice}
        empresa={empresa}
      />

    </div>
  );
}
 : 'Bs.'})</th>
                  <th className="px-2 py-2 w-20 text-center">IVA</th>
                  <th className="px-3 py-2 w-28 text-right">Total ({currency === 'USD' ? '


































        }}
      />

      {/* Modal de Autorización Master para Stock 0 */}
      <MasterAuthModal
        isOpen={isMasterAuthModalOpen}
        onClose={() => setIsMasterAuthModalOpen(false)}
        title="Autorización Especial de Operaciones"
        subtitle="Se requiere Clave Especial de Operaciones para proceder con la facturación de productos en stock 0"
        actionName="Facturación con Stock Cero / Insuficiente"
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

    </div>
  );
}



























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
      />

      {/* Modal de Impresión de Factura Emitida */}
      <InvoicePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        factura={lastEmittedInvoice}
        empresa={empresa}
      />

    </div>
  );
}
        actionDetails={
          zeroStockItems.map(item => {
    return (
      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
        <div className="bg-slate-100 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-[1440px] max-h-[96vh] flex flex-col overflow-hidden border border-slate-700/30">
          <div className="overflow-y-auto flex-1 p-2 sm:p-4">
            {formElement}
          </div>
        </div>
      </div>
    );
  }
      />

      {/* Modal de Impresión de Factura Emitida */}
      <InvoicePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        factura={lastEmittedInvoice}
        empresa={empresa}
      />

    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
        <div className="bg-slate-100 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-[1440px] max-h-[96vh] flex flex-col overflow-hidden border border-slate-700/30">
          <div className="overflow-y-auto flex-1 p-2 sm:p-4">
            {formElement}
          </div>
        </div>
      </div>
    );
  }

  return formElement;
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

    </div>
  );
}

