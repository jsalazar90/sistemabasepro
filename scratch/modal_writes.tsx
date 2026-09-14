
/* --- WRITE --- */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, ArrowLeft, Search, Plus, Trash2, CheckCircle2, 
  Save, AlertTriangle, User, Building2, DollarSign, Calendar, 
  BookOpen, Eye, X, HelpCircle, Package, ShieldCheck, 
  CreditCard, Landmark, Check, CornerDownRight, Coins, 
  Clock, ArrowRight, Sparkles, RefreshCw
} from 'lucide-react';
import BackButton from '../components/common/BackButton';
import { FacturaVentaModel, FacturaItemModel, ProductModel } from '../types/database';

export default function InvoiceForm({
  contactos = [],
  products = [],
  cuentasContables = [],
  bancos = [],
  configContable,
  onSave,
  showToast,
  workingYear
}: {
  contactos?: any[];
  products?: ProductModel[];
  cuentasContables?: any[];
  bancos?: any[];
  configContable?: any;
  onSave?: (collection: string, data: any) => void;
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
  const [newCustName, setNewCustName] = useState('');
  const [newCustRif, setNewCustRif] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

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
        (c.taxId || '').toLowerCase().includes(term);
      return isCust && match;
    });
  }, [contactos, customerSearchTerm]);

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
        ivaMonto += lineSubtotal * 0.16;
      }
    });

    const total = subtotal + ivaMonto;

    // Calcular montos en USD y Bs. según la moneda seleccionada
    let totalUSD = 0;
    let totalBs = 0;

    if (currency === 'USD') {
      totalUSD = total;
      totalBs = total * (exchangeRate || 1);
    } else {
      totalBs = total;
      totalUSD = (exchangeRate > 0) ? (total / exchangeRate) : total;
    }

    return { subtotal, montoExento, baseImponible, ivaMonto, total, totalUSD, totalBs };
  }, [items, currency, exchangeRate]);

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

  const handleSaveQuickCustomer = () => {
    if (!newCustName.trim() || !newCustRif.trim()) {
      showToast?.('Nombre y RIF son requeridos para el cliente', 'error');
      return;
    }

    const newCust = {
      id: `ct_${Date.now()}`,
      name: newCustName.trim(),
      taxId: newCustRif.trim(),
      type: 'customer',
      address: newCustAddress.trim(),
      phone: newCustPhone.trim(),
      isCompany: true
    };

    onSave?.('contactos', newCust);
    handleSelectCustomer(newCust);
    setIsNewCustomerModalOpen(false);
    showToast?.('Cliente registrado y seleccionado', 'success');
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
        monto: currency === 'USD' ? totals.total.toFixed(2) : totals.totalUSD.toFixed(2),
        montoBs: currency === 'VES' ? totals.total.toFixed(2) : totals.totalBs.toFixed(2)
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
    const totalAmount = totals.total;

    if (condition === 'credito') {
      // Debe: CxC Clientes
      linesVoucher.push({
        id: `vl_cxc`,
        cuentaId: mainCustomerAccount,
        nombreCuenta: `Cuentas por Cobrar Clientes (${customerName})`,
        descripcion: `Factura a crédito ${invoiceNumber} - Venc. ${calculatedDueDate}`,
        debe: totalAmount,
        haber: 0
      });
    } else {
      // Debe: Banco(s) según pagos registrados en el modal de cobranza
      cobranzaForm.pagos.forEach((pago, pIdx) => {
        const bank = bancos.find(b => b.id === pago.bancoId);
        const bankAccount = bank?.cuenta_contable_id || configContable?.cuentaBancos || '1.1.01.004';
        const pagoMonto = parseFloat(pago.monto) || (totalAmount / cobranzaForm.pagos.length);

        linesVoucher.push({
          id: `vl_bnk_${pIdx}`,
          cuentaId: bankAccount,
          nombreCuenta: bank ? `${bank.banco} (${bank.moneda})` : 'Efectivo en Bancos',
          descripcion: `Cobro contado Fac ${invoiceNumber} - Ref: ${pago.referencia || 'S/R'}`,
          debe: pagoMonto,
          haber: 0
        });
      });
    }

    // Haber: Ventas por el subtotal neto
    linesVoucher.push({
      id: `vl_vta`,
      cuentaId: mainSalesAccount,
      nombreCuenta: 'Ventas de Mercancías',
      descripcion: `Ingreso por venta Factura ${invoiceNumber}`,
      debe: 0,
      haber: totals.subtotal
    });

    // Haber: IVA Débito Fiscal si aplica
    if (totals.ivaMonto > 0) {
      linesVoucher.push({
        id: `vl_iva`,
        cuentaId: mainTaxAccount,
        nombreCuenta: 'IVA Débito Fiscal (16%)',
        descripcion: `IVA 16% Factura ${invoiceNumber}`,
        debe: 0,
        haber: totals.ivaMonto
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

      // 1. Guardar la Factura
      const newFactura: FacturaVentaModel = {
        id: factId,
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
        igtf_monto: 0,
        total: totals.total,
        total_bs: totals.totalBs,
        saldo_pendiente: selectedCondition === 'credito' ? totals.total : 0,
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
            const newStock = Math.max(0, currentStock - (Number(item.cantidad) || 0));

            onSave?.('products', {
              ...originalProd,
              stock_actual: newStock,
              updated_at: new Date().toISOString()
            });

            onSave?.('movimientosInventario', {
              id: `mov_vta_${Date.now()}_${item.id}`,
              empresa_id: '',
              producto_id: originalProd.id,
              producto_nombre: originalProd.nombre,
              producto_codigo: originalProd.codigo,
              tipo: 'venta',
              cantidad: item.cantidad,
              stock_anterior: currentStock,
              stock_resultante: newStock,
              costo_unitario: originalProd.costo_unitario,
              referencia: `Venta Factura ${newFactura.numero}`,
              fecha: issueDate,
              usuario: 'Administrador',
              created_at: new Date().toISOString()
            });
          }
        }
      });

      // 3. Crear CxC si es a Crédito
      if (selectedCondition === 'credito') {
        onSave?.('cxc', {
          id: cxcDocId,
          factura_id: newFactura.id,
          cliente_id: newFactura.cliente_id,
          cliente: newFactura.cliente_nombre,
          categoria: 'customer',
          fecha: issueDate,
          vencimiento: calculatedDueDate,
          descripcion: `Factura de Venta ${newFactura.numero}`,
          tipo: 'factura',
          total: totals.total,
          saldo: totals.total,
          moneda: currency,
          tasa: exchangeRate,
          created_at: new Date().toISOString()
        });
      }

      // 4. Registrar Cobranza y Movimiento Bancario si fue de Contado
      if (selectedCondition === 'contado') {
        cobranzaForm.pagos.forEach((pago, idx) => {
          const bank = bancos.find(b => b.id === pago.bancoId);
          if (bank) {
            onSave?.('movimientosBancos', {
              id: `mov_bnk_${Date.now()}_${idx}`,
              banco_id: bank.id,
              fecha: issueDate,
              ref: pago.referencia || newFactura.numero,
              descripcion: `Ingreso Cobranza Factura ${newFactura.numero} (${customerName})`,
              tipo: 'ingreso',
              monto: parseFloat(pago.monto) || totals.total,
              tasa: exchangeRate,
              estado: 'conciliado',
              comprobante_id: voucherId,
              created_at: new Date().toISOString()
            });
          }
        });
      }

      // 5. Guardar Asiento Contable
      if (pendingVoucher) {
        onSave?.('comprobantes', pendingVoucher);
      }

      // 6. Incrementar correlativo
      if (configContable) {
        const numPart = parseInt(configContable.correlativoFactura || '1', 10);
        const nextCorrelativo = String(numPart + 1).padStart(5, '0');
        onSave?.('configContable', {
          ...configContable,
          correlativoFactura: nextCorrelativo
        });
      }

      showToast?.(`Factura ${newFactura.numero} emitida exitosamente (${selectedCondition.toUpperCase()})`, 'success');
      setIsVoucherModalOpen(false);
      navigate('/invoicing');
    } catch (err: any) {
      console.error("Error guardando factura:", err);
      showToast?.('Error al emitir la factura', 'error');
    }
  };

  return (
    <div className="px-3 sm:px-6 pt-1 pb-16 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Botón Volver */}
      <div className="mb-3">
        <BackButton to="/invoicing" label="Volver al Listado de Facturación" />
      </div>

      <form onSubmit={handleStartEmission} className="space-y-6">
        
        {/* ========================================================================= */}
        {/* CABECERA: TIPO DE DOCUMENTO, MONEDA (USD/BS), CORRELATIVO Y FECHAS */}
        {/* ========================================================================= */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-5 border-b border-slate-100">
            {/* Título y Selector de Tipo Documento */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20 shrink-0">
                <FileText size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as any)}
                    className="text-base sm:text-lg font-black text-slate-900 bg-transparent border-none outline-none cursor-pointer hover:text-indigo-600 transition"
                  >
                    <option value="factura">Factura de Venta</option>
                    <option value="nota_entrega">Nota de Entrega</option>
                    <option value="nota_credito">Nota de Crédito</option>
                    <option value="nota_debito">Nota de Débito</option>
                  </select>

                  {/* CONMUTADOR DE MONEDA SOLICITADO: USD vs BS */}
                  <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 ml-1">
                    <button
                      type="button"
                      onClick={() => setCurrency('USD')}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                        currency === 'USD'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      USD ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('VES')}
                      className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                        currency === 'VES'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bolívares (Bs.)
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Moneda de emisión activa: <b className="text-slate-700">{currency === 'USD' ? 'Dólares Estadounidenses ($)' : 'Bolívares Digitales (Bs.)'}</b>
                </p>
              </div>
            </div>

            {/* Badge Correlativo */}
            <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
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
                onChange={(e) => setControlNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 focus:bg-white focus:border-indigo-600 outline-none"
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
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">Bs.</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 1)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl font-black text-emerald-800 focus:bg-white focus:border-emerald-600 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DISTRIBUCIÓN PRINCIPAL DE PANTALLA: 2 COLUMNAS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* COLUMNA IZQUIERDA (2/3): CLIENTE + GRILLA DE PRODUCTOS + NOTAS */}
          <div className="lg:col-span-2 space-y-6">
            
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
                  <input
                    type="text"
                    required
                    placeholder="Nombre del cliente o empresa"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">RIF / Cédula *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: J-12345678-0"
                    value={customerRif}
                    onChange={(e) => setCustomerRif(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-indigo-600 focus:bg-white focus:border-indigo-600 outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Teléfono</label>
                  <input
                    type="text"
                    placeholder="+58 412 000-0000"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-slate-700 font-bold mb-1">Dirección Fiscal</label>
                  <input
                    type="text"
                    placeholder="Dirección fiscal para el pie del documento..."
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* GRILLA DE PRODUCTOS / ARTÍCULOS */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs">
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <Package size={18} className="text-indigo-600" />
                  <span>Artículos de Inventario & Servicios Facturados</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
                >
                  <Plus size={14} />
                  <span>Añadir Línea</span>
                </button>
              </div>

              <div className="overflow-x-auto pt-3">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-3 py-2.5">Artículo / Concepto</th>
                      <th className="px-3 py-2.5 w-24 text-center">Cant.</th>
                      <th className="px-3 py-2.5 w-32 text-right">
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
                    {items.map((item, idx) => {
                      const selectedProd = products.find(p => p.id === item.producto_id);
                      const isStockWarning = selectedProd && (Number(item.cantidad) > Number(selectedProd.stock_actual));

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-3 py-2.5 space-y-1.5">
                            <select
                              value={item.producto_id || ''}
                              onChange={(e) => handleProductSelect(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none"
                            >
                              <option value="">Seleccionar del catálogo de inventario...</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.codigo} - {p.nombre} (Stock: {p.stock_actual} {p.unidad_medida} • Ref: ${p.precio_venta})
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              required
                              placeholder="Descripción o detalle del concepto..."
                              value={item.descripcion}
                              onChange={(e) => handleItemFieldChange(idx, 'descripcion', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:border-indigo-600 outline-none"
                            />

                            {/* Alerta de Stock Disponible */}
                            {selectedProd && (
                              <div className="flex items-center gap-2 text-[10px] font-semibold">
                                <span className={`px-2 py-0.5 rounded-md ${
                                  selectedProd.stock_actual <= 0
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}>
                                  Existencia en almacén: {selectedProd.stock_actual} {selectedProd.unidad_medida}
                                </span>
                                {isStockWarning && (
                                  <span className="text-amber-600 font-bold flex items-center gap-1">
                                    <AlertTriangle size={12} />
                                    Cantidad supera el stock físico
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-3 py-2.5 text-center align-top">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.cantidad}
                              onChange={(e) => handleItemFieldChange(idx, 'cantidad', parseFloat(e.target.value) || 1)}
                              className="w-20 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-center text-slate-900 focus:bg-white focus:border-indigo-600 outline-none"
                            />
                          </td>

                          <td className="px-3 py-2.5 text-right align-top">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.precio_unitario}
                              onChange={(e) => handleItemFieldChange(idx, 'precio_unitario', parseFloat(e.target.value) || 0)}
                              className="w-28 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-right text-slate-900 focus:bg-white focus:border-indigo-600 outline-none"
                            />
                          </td>

                          <td className="px-3 py-2.5 text-center align-top pt-3">
                            <label className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!item.exento}
                                onChange={(e) => handleItemFieldChange(idx, 'exento', !e.target.checked)}
                                className="rounded text-indigo-600"
                              />
                              <span>16%</span>
                            </label>
                          </td>

                          <td className="px-3 py-2.5 text-right align-top font-black text-slate-900 pt-3">
                            {formatMoney(item.total, currency)}
                          </td>

                          <td className="px-3 py-2.5 text-center align-top pt-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
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
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-3.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-black text-slate-900 text-sm">Resumen Financiero</h3>
                <span className="px-2 py-0.5 rounded-md font-mono font-bold text-[10px] bg-slate-100 text-slate-600">
                  {currency}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Subtotal Neto:</span>
                <span className="font-bold">{formatMoney(totals.subtotal, currency)}</span>
              </div>

              {totals.montoExento > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Monto Exento:</span>
                  <span className="font-semibold">{formatMoney(totals.montoExento, currency)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Base Imponible (16%):</span>
                <span className="font-semibold">{formatMoney(totals.baseImponible, currency)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>IVA General (16%):</span>
                <span className="font-semibold">{formatMoney(totals.ivaMonto, currency)}</span>
              </div>

              {/* TOTAL PRINCIPAL */}
              <div className="border-t-2 border-slate-900 pt-3 flex justify-between items-center">
                <span className="text-sm font-black uppercase text-slate-900">Total a Pagar:</span>
                <span className="text-xl font-black text-indigo-600">
                  {formatMoney(totals.total, currency)}
                </span>
              </div>

              {/* CONVERSIÓN A LA OTRA MONEDA */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-slate-800 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-500">
                  {currency === 'USD' ? 'Equiv. en Bolívares:' : 'Equiv. en Dólares:'}
                </span>
                <span className="font-black text-slate-900">
                  {currency === 'USD' ? formatMoney(totals.totalBs, 'VES') : formatMoney(totals.totalUSD, 'USD')}
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
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Total Factura a Cobrar:</p>
                  <p className="text-lg font-black text-slate-900">{formatMoney(totals.total, currency)}</p>
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
                    <span>Agregar otra forma de pago</span>
                  </button>
                </div>

                {cobranzaForm.pagos.map((pago, pIdx) => {
                  const selB = bancos.find(b => b.id === pago.bancoId);
                  const isBVES = selB && (selB.moneda === 'VES' || selB.moneda === 'Bs' || selB.moneda === 'Bolivares');

                  return (
                    <div key={pago.id} className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {/* Selector de Banco / Caja */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                            Banco / Caja de Destino *
                          </label>
                          <select
                            value={pago.bancoId}
                            onChange={(e) => {
                              const updated = [...cobranzaForm.pagos];
                              updated[pIdx].bancoId = e.target.value;
                              setCobranzaForm({ ...cobranzaForm, pagos: updated });
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-600"
                          >
                            <option value="">Seleccione cuenta bancaria...</option>
                            {bancos.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.banco} ({b.moneda}) - {b.numero_cuenta}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Método de Pago */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                            Método de Pago
                          </label>
                          <select
                            value={pago.metodoPago}
                            onChange={(e) => {
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
                            <option value="Efectivo">Efectivo</option>
                            <option value="Depósito">Depósito</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
                        {/* Referencia */}
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
                        </div>

                        {/* Monto Recibido */}
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">
                            Monto Recibido ({isBVES ? 'Bs.' : '$'}) *
                          </label>
                          {isBVES ? (
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">Bs.</span>
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
                                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl font-black text-slate-900 outline-none focus:border-indigo-600"
                              />
                            </div>
                          ) : (
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={pago.monto}
                                onChange={(e) => {
                                  const updated = [...cobranzaForm.pagos];
                                  const valUsd = e.target.value;
                                  updated[pIdx].monto = valUsd;
                                  const t = exchangeRate || 1;
                                  updated[pIdx].montoBs = (Number(valUsd) * t).toFixed(2);
                                  setCobranzaForm({ ...cobranzaForm, pagos: updated });
                                }}
                                className="w-full pl-6 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl font-black text-slate-900 outline-none focus:border-indigo-600"
                              />
                            </div>
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
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between text-slate-600 font-medium">
                <span>Concepto: <b>{pendingVoucher.concepto}</b></span>
                <span>Fecha: <b>{pendingVoucher.fecha}</b></span>
              </div>

              {/* Tabla de Cuentas */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Cuenta Contable</th>
                      <th className="px-3.5 py-2.5">Descripción / Concepto</th>
                      <th className="px-3.5 py-2.5 text-right w-28">Debe ({currency === 'USD' ? '$' : 'Bs.'})</th>
                      <th className="px-3.5 py-2.5 text-right w-28">Haber ({currency === 'USD' ? '$' : 'Bs.'})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingVoucher.lineas.map((line: any) => (
                      <tr key={line.id}>
                        <td className="px-3.5 py-2.5">
                          <span className="font-mono font-bold text-indigo-600">{line.cuentaId}</span>
                          <span className="block text-slate-700 font-semibold text-[11px]">{line.nombreCuenta}</span>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-500 font-medium">{line.descripcion}</td>
                        <td className="px-3.5 py-2.5 text-right font-black text-slate-900">
                          {line.debe > 0 ? formatMoney(line.debe, currency) : '-'}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-black text-slate-900">
                          {line.haber > 0 ? formatMoney(line.haber, currency) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-xs">
                    <tr>
                      <td colSpan={2} className="px-3.5 py-2.5 text-right text-slate-700 uppercase">Totales Balanceados:</td>
                      <td className="px-3.5 py-2.5 text-right text-emerald-600 font-black">{formatMoney(pendingVoucher.total, currency)}</td>
                      <td className="px-3.5 py-2.5 text-right text-emerald-600 font-black">{formatMoney(pendingVoucher.total, currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Botones de Confirmación Final */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsVoucherModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Volver a Revisar
                </button>
                <button
                  type="button"
                  onClick={handleFinalSaveInvoice}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black transition shadow-md shadow-indigo-500/20"
                >
                  Confirmar y Finalizar Factura
                </button>
              </div>
            </div>
          </div>
        </div>
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
      {/* MODAL NUEVO CLIENTE RÁPIDO */}
      {/* ========================================================================= */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 z-[370] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-100">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">Registrar Nuevo Cliente</h3>
              <button
                type="button"
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nombre / Razón Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Inversiones Los Andes, C.A."
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">RIF / Cédula *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: J-30948271-0"
                  value={newCustRif}
                  onChange={(e) => setNewCustRif(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-indigo-600 focus:bg-white focus:border-indigo-600 outline-none uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Teléfono</label>
                <input
                  type="text"
                  placeholder="+58 412 0000000"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Dirección Fiscal</label>
                <input
                  type="text"
                  placeholder="Ciudad, dirección de oficina"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickCustomer}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-xs"
                >
                  Guardar y Asignar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
