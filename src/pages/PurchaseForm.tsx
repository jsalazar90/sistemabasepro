import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Send, ShoppingCart, FileText, Building2, DollarSign, ArrowLeft, Search, X, User, Briefcase, Plus, MapPin, Mail, Phone, BookOpen, Check, AlertCircle, Trash2 } from 'lucide-react';
import CuentaContableModal from '../components/common/CuentaContableModal';
import BackButton from '../components/common/BackButton';

export default function PurchaseForm({ contactos = [], cuentasContables = [], onSave, showToast, configContable, workingYear }: { contactos?: any[], cuentasContables?: any[], onSave?: any, showToast?: any, configContable?: any, workingYear?: string }) {
  const navigate = useNavigate();
  // Document Info
  const [documentType, setDocumentType] = useState('Factura de Compra');
  const [controlNumber, setControlNumber] = useState('00-');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Currency & Taxes
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(36.50);
  const [applyIGTF, setApplyIGTF] = useState(false);
  const [purchaseDestination, setPurchaseDestination] = useState<'inventory' | 'expense'>('expense');

  // Supplier Info
  const [supplierName, setSupplierName] = useState('');
  const [supplierRif, setSupplierRif] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');

  // Modal Asiento Contable
  const [pendingVoucher, setPendingVoucher] = useState<{
    comprobante: any;
    cxpDoc: any;
    onConfirm: (finalComprobante: any) => Promise<void>;
  } | null>(null);

  // Selector de cuenta en modal de asiento
  const [showAccountSelectorModal, setShowAccountSelectorModal] = useState(false);
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const [isSavingVoucher, setIsSavingVoucher] = useState(false);

  // Supplier Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  
  // New Supplier Form State
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierRif, setNewSupplierRif] = useState('');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierIsCompany, setNewSupplierIsCompany] = useState(true);

  const filteredSuppliers = useMemo(() => {
    const term = (supplierSearchTerm || '').toLowerCase();
    return contactos.filter(c => 
      (c.type === 'supplier' || c.type === 'both' || c.type === 'intercompany' || c.type === 'shareholder') && 
      ((c.taxId || '').toLowerCase().includes(term) || 
       (c.name || '').toLowerCase().includes(term))
    );
  }, [contactos, supplierSearchTerm]);

  const handleSelectSupplier = (supplier: any) => {
    setSupplierRif(supplier.taxId);
    setSupplierName(supplier.name);
    setSupplierAddress(supplier.address || '');
    setIsSupplierModalOpen(false);
    setSupplierSearchTerm('');
  };

  const handleSaveNewSupplier = () => {
    if (!newSupplierName || !newSupplierRif) {
      if (showToast) showToast('El nombre y RIF son obligatorios', 'error');
      return;
    }

    const newContact = {
      id: Date.now().toString(),
      name: newSupplierName,
      type: 'supplier',
      taxId: newSupplierRif,
      email: newSupplierEmail,
      phone: newSupplierPhone,
      address: newSupplierAddress,
      isCompany: newSupplierIsCompany
    };

    if (onSave) {
      onSave('contactos', newContact);
    }

    handleSelectSupplier(newContact);
    setIsAddingSupplier(false);
    
    // Reset form
    setNewSupplierName('');
    setNewSupplierRif('');
    setNewSupplierAddress('');
    setNewSupplierEmail('');
    setNewSupplierPhone('');
    setNewSupplierIsCompany(true);
  };

  // Purchase Details
  const [description, setDescription] = useState('');
  const [montoExento, setMontoExento] = useState('');
  const [baseImponible, setBaseImponible] = useState('');
  const [taxType, setTaxType] = useState('G'); // G=16%, R=8%, A=31%

  // Retentions
  const [applyRetentions, setApplyRetentions] = useState(false);
  const [retentionIvaPercent, setRetentionIvaPercent] = useState<number>(75);
  const [retentionIslrPercent, setRetentionIslrPercent] = useState<number>(2);

  const totals = useMemo(() => {
    const exento = Number(montoExento) || 0;
    const base = Number(baseImponible) || 0;
    
    const ivaRate = taxType === 'G' ? 0.16 : taxType === 'R' ? 0.08 : 0.31;
    const iva = base * ivaRate;

    const subtotal = exento + base;
    const igtf = applyIGTF && currency === 'USD' ? (subtotal + iva) * 0.03 : 0;
    
    let retencionIva = 0;
    let retencionIslr = 0;

    if (applyRetentions) {
      retencionIva = iva * (retentionIvaPercent / 100);
      retencionIslr = base * (retentionIslrPercent / 100);
    }

    const total = subtotal + iva + igtf - retencionIva - retencionIslr;

    return { exento, base, iva, subtotal, igtf, retencionIva, retencionIslr, total };
  }, [montoExento, baseImponible, taxType, applyIGTF, currency, applyRetentions, retentionIvaPercent, retentionIslrPercent]);

  const formatoMoneda = (val: number) => {
    const n = Number(val) || 0;
    let str = n.toFixed(2);
    let parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.join(',');
  };

  const formatMoney = (amount: number, curr: string = currency) => {
    const n = Number(amount);
    if (isNaN(n) || amount === null) return "0,00";
    let str = n.toFixed(2);
    let parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const formatted = parts.join(',');
    return curr === 'VES' ? `Bs. ${formatted}` : curr === 'EUR' ? `€ ${formatted}` : `$ ${formatted}`;
  };

  const handleSave = async () => {
    if (workingYear && date) {
      const year = date.substring(0, 4);
      if (year !== workingYear) {
        showToast?.(`No se puede registrar esta compra porque el año seleccionado en la fecha (${year}) no coincide con el período contable seleccionado (${workingYear}).`, 'error');
        return;
      }
    }

    if (!supplierName || !supplierRif || !invoiceNumber || !controlNumber || !description) {
      if (showToast) {
        showToast('Por favor complete los datos obligatorios (Proveedor, Documento y Concepto).', 'error');
      } else {
        alert('Por favor complete los datos obligatorios (Proveedor, Documento y Concepto).');
      }
      return;
    }
    
    const timestamp = Date.now();
    const rate = currency === 'VES' && exchangeRate > 0 ? exchangeRate : 1;
    const exentoUsd = (Number(totals.exento) || 0) / rate;
    const baseUsd = (Number(totals.base) || 0) / rate;
    const gastoTotalUsd = exentoUsd + baseUsd;
    const ivaUsd = (Number(totals.iva) || 0) / rate;
    const igtfUsd = (Number(totals.igtf) || 0) / rate;
    const retencionIvaUsd = (Number(totals.retencionIva) || 0) / rate;
    const retencionIslrUsd = (Number(totals.retencionIslr) || 0) / rate;
    const totalNetoCxpUsd = (Number(totals.total) || 0) / rate;

    // Buscar proveedor y sus cuentas contables asignadas (Debe / Haber)
    const supplier = contactos?.find(c => c.taxId === supplierRif || (c.name || '').toLowerCase() === (supplierName || '').toLowerCase());
    const supplierAccount = supplier?.creditAccount || supplier?.credit_account || configContable?.cuentaCxp || '2.1.1';
    
    const debitAccount = supplier?.expenseAccount || supplier?.expense_account || supplier?.debitAccount || supplier?.debit_account || configContable?.cuentaGastos || '5.1.1';
    const debitDesc = `Gasto / Compra Proveedor - ${description || supplierName}`;

    const ctaCreditoFiscal = configContable?.cuentaCreditoFiscal || configContable?.cuentaIvaCredito || '1.1.8';
    const ctaIvaRetenido = configContable?.cuentaIvaRetenidoCompras || configContable?.cuentaIvaRetenido || '2.1.3';
    const ctaIslrRetenido = configContable?.cuentaIslrRetenidoCompras || configContable?.cuentaIslrRetenido || '2.1.4';
    const ctaGastoIgtf = configContable?.cuentaGastos || '5.1.1';

    // Generar Líneas de Asiento Cuadrado NIIF
    const lineas = [
      {
        id: `l1-${timestamp}`,
        cuentaId: debitAccount,
        descripcion: debitDesc,
        debe: Math.round(gastoTotalUsd * 100) / 100,
        haber: 0
      },
      ...(ivaUsd > 0 ? [{
        id: `l2-${timestamp}`,
        cuentaId: ctaCreditoFiscal,
        descripcion: `Crédito Fiscal IVA (${taxType === 'G' ? '16%' : taxType === 'R' ? '8%' : '31%'})`,
        debe: Math.round(ivaUsd * 100) / 100,
        haber: 0
      }] : []),
      ...(igtfUsd > 0 ? [{
        id: `l3-${timestamp}`,
        cuentaId: ctaGastoIgtf,
        descripcion: 'Impuesto IGTF 3%',
        debe: Math.round(igtfUsd * 100) / 100,
        haber: 0
      }] : []),
      ...(retencionIvaUsd > 0 ? [{
        id: `l4-${timestamp}`,
        cuentaId: ctaIvaRetenido,
        descripcion: `Retención IVA Compras (${retentionIvaPercent}%) - ${supplierName}`,
        debe: 0,
        haber: Math.round(retencionIvaUsd * 100) / 100
      }] : []),
      ...(retencionIslrUsd > 0 ? [{
        id: `l5-${timestamp}`,
        cuentaId: ctaIslrRetenido,
        descripcion: `Retención ISLR Compras (${retentionIslrPercent}%) - ${supplierName}`,
        debe: 0,
        haber: Math.round(retencionIslrUsd * 100) / 100
      }] : []),
      {
        id: `l6-${timestamp}`,
        cuentaId: supplierAccount,
        descripcion: `CxP ${supplierName} - Fact ${invoiceNumber}`,
        debe: 0,
        haber: Math.round(totalNetoCxpUsd * 100) / 100
      }
    ];

    const totalDebe = lineas.reduce((s, l) => s + (Number(l.debe) || 0), 0);
    const totalHaber = lineas.reduce((s, l) => s + (Number(l.haber) || 0), 0);
    const isBalanced = Math.abs(totalDebe - totalHaber) < 0.01;

    const comprobanteInicial = {
      id: `comp-com-${timestamp}`,
      fecha: date,
      numero: `CMP-${timestamp.toString().slice(-6)}`,
      tipo: 'Diario',
      descripcion: `Contabilización Compra ${invoiceNumber} - ${supplierName}`,
      referencia: `${documentType === 'Factura de Compra' ? 'FAC-COM' : 'ND'}-${invoiceNumber}`,
      total: Math.max(totalDebe, totalHaber),
      estado: isBalanced ? 'Contabilizado' : 'Descuadrado',
      lineas: lineas
    };

    const newCxp = {
      id: `cxp-${timestamp}`,
      categoria: 'proveedores',
      proveedor: supplierName,
      proveedor_id: supplier?.id || supplierRif,
      factura_id: `${documentType === 'Factura de Compra' ? 'FAC-COM' : 'ND'}-${invoiceNumber}`,
      fecha: date,
      vencimiento: date,
      descripcion: description,
      tipo: 'factura',
      monedaOriginal: currency,
      tasaCambio: rate,
      totalOriginal: totals.total,
      baseImponibleOriginal: totals.base,
      ivaOriginal: totals.iva,
      total: Math.round(totalNetoCxpUsd * 100) / 100,
      saldo: Math.round(totalNetoCxpUsd * 100) / 100,
      retencionIva: Math.round(retencionIvaUsd * 100) / 100,
      retencionIslr: Math.round(retencionIslrUsd * 100) / 100,
      baseImponible: Math.round(baseUsd * 100) / 100,
      iva: Math.round(ivaUsd * 100) / 100,
      moneda: 'USD',
      tasa: 1,
      estado: 'pendiente'
    };

    // Abrir Modal de Asiento Contable para Previsualización y Confirmación
    setPendingVoucher({
      comprobante: comprobanteInicial,
      cxpDoc: newCxp,
      onConfirm: async (finalComprobante) => {
        if (onSave) {
          await onSave('cxp', newCxp);
          await onSave('comprobantes', finalComprobante);
        }

        if (showToast) {
          showToast(`Compra ${documentType} ${invoiceNumber} y Asiento ${finalComprobante.numero} registrados exitosamente`, 'success');
        }

        setPendingVoucher(null);
        navigate('/payables');
      }
    });
  };

  return (
    <div className="px-3 sm:px-6 pt-1 pb-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      <div className="mb-2.5">
        <BackButton to="/payables" label="Volver a Cuentas por Pagar" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50">
          <div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-600" />
              Registro de Compras
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Ingreso rápido de facturas de gastos</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm">
              <Save size={16} /> Borrador
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Send size={16} /> Registrar
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          
          {/* Section 1: Document Info */}
          <div>
            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> 1. Datos del Documento
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                >
                  <option value="Factura de Compra">Factura</option>
                  <option value="Nota de Débito">Nota Débito</option>
                  <option value="Nota de Crédito">Nota Crédito</option>
                  <option value="Recibo">Recibo</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Clasificación</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-slate-50"
                  value={purchaseDestination}
                  onChange={(e) => setPurchaseDestination(e.target.value as 'expense')}
                >
                  <option value="expense">Gasto / Servicio Operativo</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha</label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nro. Factura</label>
                <input 
                  type="text" 
                  placeholder="00001234"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nro. Control</label>
                <input 
                  type="text" 
                  placeholder="00-0001234"
                  value={controlNumber}
                  onChange={(e) => setControlNumber(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Supplier Info */}
          <div>
            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> 2. Datos del Proveedor
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1 relative">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RIF / CI</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Buscar..."
                    value={supplierRif}
                    readOnly
                    onClick={() => setIsSupplierModalOpen(true)}
                    className="w-full border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 cursor-pointer bg-slate-50"
                  />
                  <button 
                    type="button"
                    onClick={() => setIsSupplierModalOpen(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                  >
                    <Search size={16} />
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Razón Social / Nombre</label>
                <input 
                  type="text" 
                  placeholder="Nombre de la empresa o proveedor"
                  value={supplierName}
                  readOnly
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-slate-50"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección (Opcional)</label>
                <input 
                  type="text"
                  placeholder="Ciudad, Estado..."
                  value={supplierAddress}
                  readOnly
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium bg-slate-50"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Amounts & Currency */}
          <div>
            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> 3. Importes y Moneda
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
              <div className="col-span-2 md:col-span-4">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Concepto / Descripción General</label>
                <input 
                  type="text" 
                  placeholder="Ej: Honorarios profesionales, Servicios de internet..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>
              <div className="col-span-1 md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Moneda</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="VES">VES</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div className="col-span-1 md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tasa (Bs)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(Number(e.target.value))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monto Exento (E)</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={montoExento}
                  onChange={(e) => setMontoExento(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-right"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Base Imponible</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={baseImponible}
                  onChange={(e) => setBaseImponible(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-right"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo de IVA</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  value={taxType}
                  onChange={(e) => setTaxType(e.target.value)}
                >
                  <option value="G">General (16%)</option>
                  <option value="R">Reducida (8%)</option>
                  <option value="A">Adicional (31%)</option>
                </select>
              </div>
            </div>

            {currency === 'USD' && (
              <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <input 
                  type="checkbox" 
                  id="igtf"
                  checked={applyIGTF}
                  onChange={(e) => setApplyIGTF(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="igtf" className="text-sm font-bold text-amber-800 cursor-pointer">
                  Aplicar IGTF (3%) por pago en divisas
                </label>
              </div>
            )}

            {/* Retenciones Section */}
            <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Retenciones de Impuestos</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Aplicar retenciones de IVA e ISLR a esta compra</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={applyRetentions}
                    onChange={(e) => setApplyRetentions(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {applyRetentions && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Retención de IVA (%)
                    </label>
                    <select
                      value={retentionIvaPercent}
                      onChange={(e) => setRetentionIvaPercent(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    >
                      <option value={75}>75%</option>
                      <option value={100}>100%</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Monto a retener: <span className="font-bold text-slate-700">{formatMoney(totals.retencionIva)}</span>
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Retención de ISLR (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={retentionIslrPercent}
                        onChange={(e) => setRetentionIslrPercent(Number(e.target.value))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-medium pr-8"
                      />
                      <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Monto a retener: <span className="font-bold text-slate-700">{formatMoney(totals.retencionIslr)}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer Totals */}
        <div className="bg-slate-800 text-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="block text-slate-400 text-xs font-bold uppercase mb-0.5">Exento</span>
              <span className="font-medium">{formatMoney(totals.exento)}</span>
            </div>
            <div>
              <span className="block text-slate-400 text-xs font-bold uppercase mb-0.5">Base</span>
              <span className="font-medium">{formatMoney(totals.base)}</span>
            </div>
            <div>
              <span className="block text-slate-400 text-xs font-bold uppercase mb-0.5">IVA ({taxType === 'G' ? '16%' : taxType === 'R' ? '8%' : '31%'})</span>
              <span className="font-medium">{formatMoney(totals.iva)}</span>
            </div>
            {totals.igtf > 0 && (
              <div>
                <span className="block text-amber-400 text-xs font-bold uppercase mb-0.5">IGTF (3%)</span>
                <span className="font-medium text-amber-300">{formatMoney(totals.igtf)}</span>
              </div>
            )}
            {applyRetentions && totals.retencionIva > 0 && (
              <div>
                <span className="block text-rose-400 text-xs font-bold uppercase mb-0.5">Ret. IVA ({retentionIvaPercent}%)</span>
                <span className="font-medium text-rose-300">-{formatMoney(totals.retencionIva)}</span>
              </div>
            )}
            {applyRetentions && totals.retencionIslr > 0 && (
              <div>
                <span className="block text-rose-400 text-xs font-bold uppercase mb-0.5">Ret. ISLR ({retentionIslrPercent}%)</span>
                <span className="font-medium text-rose-300">-{formatMoney(totals.retencionIslr)}</span>
              </div>
            )}
          </div>
          <div className="text-right w-full sm:w-auto border-t border-slate-700 sm:border-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
            <span className="block text-slate-400 text-xs font-bold uppercase mb-0.5">Total a Pagar</span>
            <span className="text-2xl font-black text-emerald-400">{formatMoney(totals.total)}</span>
            {currency !== 'VES' && (
              <span className="block text-xs text-slate-400 mt-1">
                Ref: Bs. {formatMoney(totals.total * exchangeRate, 'VES')}
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Supplier Selection Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                {isAddingSupplier ? 'Nuevo Proveedor' : 'Seleccionar Proveedor'}
              </h2>
              <button 
                onClick={() => {
                  setIsSupplierModalOpen(false);
                  setIsAddingSupplier(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!isAddingSupplier ? (
                <>
                  <div className="flex gap-3 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input 
                        type="text" 
                        placeholder="Buscar por nombre o RIF..."
                        value={supplierSearchTerm}
                        onChange={(e) => setSupplierSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                        autoFocus
                      />
                    </div>
                    <button 
                      onClick={() => setIsAddingSupplier(true)}
                      className="bg-indigo-50 text-indigo-600 px-4 py-2.5 rounded-xl hover:bg-indigo-100 transition-colors font-medium text-sm flex items-center gap-2 whitespace-nowrap"
                    >
                      <Plus size={18} />
                      Nuevo Proveedor
                    </button>
                  </div>

                  <div className="space-y-2">
                    {filteredSuppliers.length > 0 ? (
                      filteredSuppliers.map(supplier => (
                        <div 
                          key={supplier.id}
                          onClick={() => handleSelectSupplier(supplier)}
                          className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${supplier.isCompany ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                              {supplier.isCompany ? <Building2 size={20} /> : <User size={20} />}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{supplier.name}</div>
                              <div className="text-sm text-slate-500 font-mono mt-0.5">{supplier.taxId}</div>
                            </div>
                          </div>
                          <div className="text-sm text-slate-400 truncate max-w-[200px] hidden sm:block">
                            {supplier.email || supplier.address}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Search className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-slate-600 font-medium mb-1">No se encontraron proveedores</p>
                        <p className="text-slate-400 text-sm mb-4">Intenta con otros términos de búsqueda o crea uno nuevo.</p>
                        <button 
                          onClick={() => setIsAddingSupplier(true)}
                          className="text-indigo-600 font-medium text-sm hover:underline"
                        >
                          Crear nuevo proveedor
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        checked={newSupplierIsCompany} 
                        onChange={() => setNewSupplierIsCompany(true)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Empresa (Jurídico)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        checked={!newSupplierIsCompany} 
                        onChange={() => setNewSupplierIsCompany(false)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Persona (Natural)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RIF / CI *</label>
                      <input 
                        type="text" 
                        value={newSupplierRif}
                        onChange={(e) => setNewSupplierRif(e.target.value.toUpperCase())}
                        placeholder="J-12345678-9"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Razón Social / Nombre *</label>
                      <input 
                        type="text" 
                        value={newSupplierName}
                        onChange={(e) => setNewSupplierName(e.target.value)}
                        placeholder="Nombre completo"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                      <input 
                        type="email" 
                        value={newSupplierEmail}
                        onChange={(e) => setNewSupplierEmail(e.target.value)}
                        placeholder="correo@empresa.com"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Teléfono</label>
                      <input 
                        type="tel" 
                        value={newSupplierPhone}
                        onChange={(e) => setNewSupplierPhone(e.target.value)}
                        placeholder="+58 414 1234567"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dirección Fiscal</label>
                      <textarea 
                        value={newSupplierAddress}
                        onChange={(e) => setNewSupplierAddress(e.target.value)}
                        rows={2}
                        placeholder="Dirección completa..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isAddingSupplier && (
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                <button 
                  onClick={() => setIsAddingSupplier(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveNewSupplier}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <Save size={16} />
                  Guardar y Seleccionar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PREVISUALIZACIÓN DE ASIENTO CONTABLE NIIF (COMPRAS)               */}
      {/* ========================================================================= */}
      {pendingVoucher && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black shrink-0">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      Comprobante de Diario NIIF (Compras & Gastos)
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-300">
                      {supplierName || 'Proveedor'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    Revise y confirme las cuentas del Debe y Haber antes de asentar en el Libro Diario
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setPendingVoucher(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors self-end sm:self-auto cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Tabla de Líneas */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-950 font-bold">
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-600 block">Concepto del Asiento:</span>
                  <p className="mt-0.5 text-slate-800">{pendingVoucher.comprobante.descripcion}</p>
                </div>
                <div className="text-right sm:border-l sm:border-indigo-200/80 sm:pl-4">
                  <span className="text-[10px] font-black uppercase text-indigo-600 block">Fecha Contable:</span>
                  <p className="font-mono text-slate-900">{pendingVoucher.comprobante.fecha}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 w-72">Cuenta Contable</th>
                        <th className="py-3 px-4">Descripción de la Línea</th>
                        <th className="py-3 px-4 text-right w-32">Debe ($)</th>
                        <th className="py-3 px-4 text-right w-32">Haber ($)</th>
                        <th className="py-3 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                      {pendingVoucher.comprobante.lineas.map((linea: any, idx: number) => {
                        const cuentaObj = cuentasContables.find(c => c.id === linea.cuentaId || c.codigo === linea.cuentaId);
                        return (
                          <tr key={linea.id || idx} className="hover:bg-slate-50/50 transition-colors">
                            {/* Selector de Cuenta */}
                            <td className="py-2.5 px-4">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedLineIndex(idx);
                                  setShowAccountSelectorModal(true);
                                }}
                                className="w-full text-left p-2 bg-white hover:bg-indigo-50/40 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all flex items-center justify-between group cursor-pointer"
                              >
                                <div className="truncate pr-2">
                                  <span className="font-mono text-[11px] font-black text-indigo-700 block">
                                    {cuentaObj ? cuentaObj.codigo : (linea.cuentaId || 'Sin asignar')}
                                  </span>
                                  <span className="text-xs text-slate-800 font-bold block truncate group-hover:text-indigo-900">
                                    {cuentaObj ? cuentaObj.nombre : 'Haz clic para seleccionar cuenta...'}
                                  </span>
                                </div>
                                <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                              </button>
                            </td>

                            {/* Descripción */}
                            <td className="py-2.5 px-4">
                              <input
                                type="text"
                                value={linea.descripcion || ''}
                                onChange={(e) => {
                                  const updated = [...pendingVoucher.comprobante.lineas];
                                  updated[idx] = { ...updated[idx], descripcion: e.target.value };
                                  setPendingVoucher({
                                    ...pendingVoucher,
                                    comprobante: { ...pendingVoucher.comprobante, lineas: updated }
                                  });
                                }}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                                placeholder="Descripción de la línea..."
                              />
                            </td>

                            {/* Debe */}
                            <td className="py-2.5 px-4 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={linea.debe !== undefined ? linea.debe : ''}
                                onChange={(e) => {
                                  const updated = [...pendingVoucher.comprobante.lineas];
                                  updated[idx] = { ...updated[idx], debe: parseFloat(e.target.value) || 0 };
                                  const tDebe = updated.reduce((s, l) => s + (Number(l.debe) || 0), 0);
                                  const tHaber = updated.reduce((s, l) => s + (Number(l.haber) || 0), 0);
                                  setPendingVoucher({
                                    ...pendingVoucher,
                                    comprobante: {
                                      ...pendingVoucher.comprobante,
                                      lineas: updated,
                                      total: Math.max(tDebe, tHaber),
                                      estado: Math.abs(tDebe - tHaber) < 0.01 ? 'Contabilizado' : 'Descuadrado'
                                    }
                                  });
                                }}
                                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900 text-right outline-none focus:bg-white focus:border-indigo-500"
                                placeholder="0.00"
                              />
                            </td>

                            {/* Haber */}
                            <td className="py-2.5 px-4 text-right">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={linea.haber !== undefined ? linea.haber : ''}
                                onChange={(e) => {
                                  const updated = [...pendingVoucher.comprobante.lineas];
                                  updated[idx] = { ...updated[idx], haber: parseFloat(e.target.value) || 0 };
                                  const tDebe = updated.reduce((s, l) => s + (Number(l.debe) || 0), 0);
                                  const tHaber = updated.reduce((s, l) => s + (Number(l.haber) || 0), 0);
                                  setPendingVoucher({
                                    ...pendingVoucher,
                                    comprobante: {
                                      ...pendingVoucher.comprobante,
                                      lineas: updated,
                                      total: Math.max(tDebe, tHaber),
                                      estado: Math.abs(tDebe - tHaber) < 0.01 ? 'Contabilizado' : 'Descuadrado'
                                    }
                                  });
                                }}
                                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-900 text-right outline-none focus:bg-white focus:border-indigo-500"
                                placeholder="0.00"
                              />
                            </td>

                            {/* Eliminar */}
                            <td className="py-2.5 px-2 text-center">
                              {pendingVoucher.comprobante.lineas.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = pendingVoucher.comprobante.lineas.filter((_: any, i: number) => i !== idx);
                                    const tDebe = updated.reduce((s: number, l: any) => s + (Number(l.debe) || 0), 0);
                                    const tHaber = updated.reduce((s: number, l: any) => s + (Number(l.haber) || 0), 0);
                                    setPendingVoucher({
                                      ...pendingVoucher,
                                      comprobante: {
                                        ...pendingVoucher.comprobante,
                                        lineas: updated,
                                        total: Math.max(tDebe, tHaber),
                                        estado: Math.abs(tDebe - tHaber) < 0.01 ? 'Contabilizado' : 'Descuadrado'
                                      }
                                    });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar línea"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer de Totales & Balance */}
                {(() => {
                  const tDebe = pendingVoucher.comprobante.lineas.reduce((s: number, l: any) => s + (Number(l.debe) || 0), 0);
                  const tHaber = pendingVoucher.comprobante.lineas.reduce((s: number, l: any) => s + (Number(l.haber) || 0), 0);
                  const diff = tDebe - tHaber;
                  const isBal = Math.abs(diff) < 0.01;
                  return (
                    <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          const newLine = {
                            id: `l-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
                            cuentaId: '',
                            descripcion: `Detalle Compra - ${supplierName}`,
                            debe: 0,
                            haber: 0
                          };
                          setPendingVoucher({
                            ...pendingVoucher,
                            comprobante: {
                              ...pendingVoucher.comprobante,
                              lineas: [...pendingVoucher.comprobante.lineas, newLine]
                            }
                          });
                        }}
                        className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-4 h-4 text-indigo-600" />
                        <span>+ Agregar Línea</span>
                      </button>

                      <div className="flex items-center gap-6 font-mono text-xs font-bold">
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 font-sans block">Total Debe:</span>
                          <span className="text-sm font-black text-slate-900">${formatoMoneda(tDebe)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 font-sans block">Total Haber:</span>
                          <span className="text-sm font-black text-slate-900">${formatoMoneda(tHaber)}</span>
                        </div>
                        <div className={`px-3 py-1 rounded-xl font-sans text-xs font-black flex items-center gap-1.5 ${
                          isBal 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}>
                          {isBal ? (
                            <>
                              <Check className="w-4 h-4" /> Cuadrado
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4" /> Descuadre: ${formatoMoneda(Math.abs(diff))}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Actions */}
            {(() => {
              const tDebe = pendingVoucher.comprobante.lineas.reduce((s: number, l: any) => s + (Number(l.debe) || 0), 0);
              const tHaber = pendingVoucher.comprobante.lineas.reduce((s: number, l: any) => s + (Number(l.haber) || 0), 0);
              const isBal = Math.abs(tDebe - tHaber) < 0.01;
              return (
                <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/90 flex flex-col-reverse sm:flex-row items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setPendingVoucher(null)}
                    disabled={isSavingVoucher}
                    className="w-full sm:w-auto px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Descartar / Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (isSavingVoucher) return;
                      const hasEmpty = pendingVoucher.comprobante.lineas.some((l: any) => !l.cuentaId);
                      if (hasEmpty) {
                        if (showToast) showToast('Debe asignar una cuenta contable a cada línea.', 'error');
                        return;
                      }
                      if (!isBal) {
                        if (showToast) showToast('El asiento contable debe estar cuadrado (Debe = Haber).', 'error');
                        return;
                      }
                      setIsSavingVoucher(true);
                      try {
                        await pendingVoucher.onConfirm(pendingVoucher.comprobante);
                      } finally {
                        setIsSavingVoucher(false);
                      }
                    }}
                    disabled={!isBal || isSavingVoucher}
                    className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isBal && !isSavingVoucher
                        ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-indigo-600/25'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Check size={16} strokeWidth={3} />
                    <span>{isSavingVoucher ? 'Contabilizando...' : 'Confirmar y Contabilizar Asiento'}</span>
                  </button>
                </div>
              );
            })()}

            {/* Modal Auxiliar de Catálogo NIIF para cambiar cuenta */}
            {selectedLineIndex !== null && (
              <CuentaContableModal
                isOpen={showAccountSelectorModal}
                onClose={() => {
                  setShowAccountSelectorModal(false);
                  setSelectedLineIndex(null);
                }}
                onSelect={(c) => {
                  const updated = [...pendingVoucher.comprobante.lineas];
                  updated[selectedLineIndex] = { ...updated[selectedLineIndex], cuentaId: c.codigo || c.id };
                  setPendingVoucher({
                    ...pendingVoucher,
                    comprobante: { ...pendingVoucher.comprobante, lineas: updated }
                  });
                  setShowAccountSelectorModal(false);
                  setSelectedLineIndex(null);
                }}
                cuentasContables={cuentasContables}
                selectedCuentaId={pendingVoucher.comprobante.lineas[selectedLineIndex]?.cuentaId}
                title="Seleccionar Cuenta Contable NIIF"
                subtitle="Asigne la cuenta contable para esta línea del asiento de compra"
              />
            )}
          </div>
        </div>
      )}

    </div>
  );
}
