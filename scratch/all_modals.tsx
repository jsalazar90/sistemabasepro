Created At: 2026-09-12T20:01:40-04:00
Completed At: 2026-09-12T20:01:40-04:00

The command exited with code 0.
Output:
<truncated 51 lines>
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
  workingYear?: string;
}) {
  const navigate = useNavigate();

  // Document Info
  const [docType, setDocType] = useState<'factura' | 'nota_entrega' | 'nota_credito' | 'nota_debito'>('factura');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(36.50);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [controlNumber, setControlNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

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
    debitAccount: '1.1.02.001',
    creditAccount: '2.1.01.001'
  });
  const [showCustomerCuentaModal, setShowCustomerCuentaModal] = useState(false);
  const [activeCustomerAccountKey, setActiveCustomerAccountKey] = useState<'debitAccount' | 'creditAccount' | null>(null);

  // Modal de Selecci�n de Productos de Inventario
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [activeItemIndexForProduct, setActiveItemIndexForProduct] = useState<number | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedProductCategory, setSelectedProductCategory] = useState('all');

  // Items / L�neas de la Factura
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

  // Modales del flujo de emisi�n
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<'contado' | 'credito'>('contado');
/* --- EDIT --- */
  // Modales del flujo de emisi�n
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState<'contado' | 'credito'>('contado');
  const [creditDays, setCreditDays] = useState(15);
  const [calculatedDueDate, setCalculatedDueDate] = useState('');

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

  // Recalcular vencimiento al cambiar d�as de crǸdito o fecha de emisi�n
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

    // 1. IGTF 3% (Ley de Reforma del IGTF: Percepci�n por cobro en divisas o moneda extranjera)
    const igtfMonto = applyIgtf ? (subtotal + ivaMonto) * (igtfPercent / 100) : 0;

    // Total de la Factura (Subtotal + IVA + IGTF si aplica)
    const totalFactura = subtotal + ivaMonto + igtfMonto;

    // 2. Retenci�n de IVA (Providencia SNAT/2015/0049: 75% o 100% sobre el IVA facturado)
    const retIvaMonto = applyRetIva ? ivaMonto * (retIvaPercent / 100) : 0;

    // 3. Retenci�n de ISLR (Decreto 1808: 2%, 5%, 1% o 3% sobre la Base Imponible)
    const retIslrMonto = applyRetIslr ? baseImponible * (retIslrPercent / 100) : 0;

    // 4. Neto a Cobrar / Pagar (Total Facturado menos Retenciones que el cliente entrega en comprobante)
    const netoCobrar = Math.max(0, totalFactura - retIvaMonto - retIslrMonto);

    // Calcular montos en USD y Bs. segǧn la moneda seleccionada
    let totalUSD = 0;
    let totalBs = 0;
    let netoCobrarUSD = 0;
    let netoCobrarBs = 0;

    if (currency === 'USD') {
      totalUSD = totalFactura;
      totalBs = totalFactura * (exchangeRate || 1);
      netoCobrarUSD = netoCobrar;
      netoCobrarBs = netoCobrar * (exchangeRate || 1);
    } else {
      totalBs = totalFactura;
      totalUSD = (exchangeRate > 0) ? (totalFactura / exchangeRate) : totalFactura;
      netoCobrarBs = netoCobrar;
      netoCobrarUSD = (exchangeRate > 0) ? (netoCobrar / exchangeRate) : netoCobrar;
    }

    return { 
      subtotal, 
      montoExento, 
      baseImponible, 
      ivaMonto, 
      igtfMonto,
      total: totalFactura, 
      totalUSD, 
      totalBs,
      retIvaMonto,
      retIslrMonto,
      netoCobrar,
      netoCobrarUSD,
      netoCobrarBs
    };
  }, [items, currency, exchangeRate, applyRetIva, retIvaPercent, applyRetIslr, retIslrPercent, applyIgtf, igtfPercent]);

