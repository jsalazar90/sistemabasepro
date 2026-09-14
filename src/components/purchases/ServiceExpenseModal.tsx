import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Building2, Calendar, DollarSign, FileText, CheckCircle2, 
  CreditCard, Landmark, AlertCircle, Percent, Plus, Briefcase,
  Search, Trash2, Clock, Check, Save, User, BookOpen, AlertTriangle, Truck, Mail, Phone, MapPin
} from 'lucide-react';
import { ContactoModel, FacturaCompraModel, FacturaCompraItemModel } from '../../types/database';
import { formatNumber } from '../../utils/numberFormat';
import { getTodayLocalDate } from '../../utils/dateUtils';
import { isUUID } from '../../services/db';
import CuentaContableModal from '../common/CuentaContableModal';
import CuentaSelectorTrigger from '../common/CuentaSelectorTrigger';
import VoucherPreviewModal from '../common/VoucherPreviewModal';

interface ServiceExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactos: ContactoModel[];
  cuentasContables: any[];
  categorias?: any[];
  bancos: any[];
  configContable?: any;
  currentExchangeRate: number;
  workingYear?: string;
  onSave?: (collection: string, data: any) => Promise<any> | void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function ServiceExpenseModal({
  isOpen,
  onClose,
  contactos = [],
  cuentasContables = [],
  bancos = [],
  configContable,
  currentExchangeRate = 1.0,
  onSave,
  showToast
}: ServiceExpenseModalProps) {

  // 1. Datos del Documento
  const [docType, setDocType] = useState<'factura' | 'recibo' | 'nota_debito' | 'comprobante'>('factura');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [controlNumber, setControlNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(getTodayLocalDate());
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');

  // Tasa de cambio editable manualmente
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(() => {
    return (currentExchangeRate > 0 ? currentExchangeRate : 1.0).toFixed(2);
  });

  const exchangeRate = useMemo(() => {
    const val = parseFloat(exchangeRateInput.replace(',', '.'));
    return isNaN(val) || val <= 0 ? 1 : val;
  }, [exchangeRateInput]);

  // Actualizar tasa si cambia la prop
  useEffect(() => {
    if (currentExchangeRate > 0) {
      setExchangeRateInput(currentExchangeRate.toFixed(2));
    }
  }, [currentExchangeRate]);

  // 2. Proveedor Seleccionado
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierRif, setSupplierRif] = useState<string>('');
  const [supplierAddress, setSupplierAddress] = useState<string>('');
  const [supplierPhone, setSupplierPhone] = useState<string>('');
  const [supplierExpenseAccount, setSupplierExpenseAccount] = useState<string>('');

  // Modales de Búsqueda y Creación de Proveedor
  const [isSearchSupplierModalOpen, setIsSearchSupplierModalOpen] = useState<boolean>(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState<string>('');

  // MODAL OFICIAL DE CONTACTOS PARA CREAR PROVEEDOR
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState<boolean>(false);
  const [activeSupplierModalTab, setActiveSupplierModalTab] = useState<'info' | 'contabilidad'>('info');
  const [supplierForm, setSupplierForm] = useState({
    type: 'supplier',
    isCompany: true,
    name: '',
    taxIdPrefix: 'J',
    taxIdNumber: '',
    email: '',
    phone: '',
    address: '',
    personaContacto: '',
    cargo: '',
    debitAccount: '',
    creditAccount: ''
  });

  // Selector de Cuenta Contable Modal dentro de la Creación de Proveedor
  const [showCuentaModal, setShowCuentaModal] = useState<boolean>(false);
  const [activeAccountKey, setActiveAccountKey] = useState<'debitAccount' | 'creditAccount' | null>(null);
  const [accountValidationError, setAccountValidationError] = useState<string | null>(null);

  // 3. Detalle del Servicio: Base Imponible Gravada y Monto Exento
  const [concepto, setConcepto] = useState<string>('');
  const [baseImponibleInput, setBaseImponibleInput] = useState<string>('');
  const [montoExentoInput, setMontoExentoInput] = useState<string>('');

  // 4. Retenciones Fiscales SENIAT
  const [applyRetIva, setApplyRetIva] = useState<boolean>(false);
  const [retIvaPercent, setRetIvaPercent] = useState<number>(75);
  const [applyRetIslr, setApplyRetIslr] = useState<boolean>(false);
  const [retIslrPercent, setRetIslrPercent] = useState<number>(2);

  // 5. Condición de Pago
  const [paymentCondition, setPaymentCondition] = useState<'contado' | 'credito'>('credito');
  const [creditDays, setCreditDays] = useState<number>(15);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Transferencia');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [pendingVoucher, setPendingVoucher] = useState<{
    comprobante: any;
    onConfirm: (finalComprobante: any) => Promise<void>;
  } | null>(null);

  // Selección automática de banco al pasar a contado
  useEffect(() => {
    if (paymentCondition === 'contado' && !selectedBankId && bancos.length > 0) {
      setSelectedBankId(bancos[0].id);
    }
  }, [paymentCondition, selectedBankId, bancos]);

  // Lista de proveedores filtrada
  const suppliersList = useMemo(() => {
    return contactos.filter(c => {
      const type = String(c.type || (c as any).tipo || '').toLowerCase().trim();
      return !type || type === 'supplier' || type === 'proveedor' || type === 'both' || type === 'ambos';
    });
  }, [contactos]);

  const filteredSuppliers = useMemo(() => {
    const term = supplierSearchTerm.trim().toLowerCase();
    if (!term) return suppliersList;
    return suppliersList.filter(s => 
      (s.name || '').toLowerCase().includes(term) ||
      (s.tax_id || (s as any).taxId || '').toLowerCase().includes(term)
    );
  }, [suppliersList, supplierSearchTerm]);

  // Manejar selección de proveedor
  const handleSelectSupplier = (s: any) => {
    setSelectedSupplierId(s.id);
    setSupplierName(s.name || '');
    setSupplierRif((s as any).tax_id || (s as any).taxId || (s as any).rif || '');
    setSupplierPhone(s.phone || (s as any).telefono || '');
    setSupplierAddress(s.address || (s as any).direccion || '');
    setSupplierExpenseAccount(s.expense_account || s.debitAccount || (s as any).debit_account || '');
    setIsSearchSupplierModalOpen(false);
  };

  const handleClearSupplier = () => {
    setSelectedSupplierId('');
    setSupplierName('');
    setSupplierRif('');
    setSupplierPhone('');
    setSupplierAddress('');
    setSupplierExpenseAccount('');
  };

  // Abrir modal de nuevo proveedor con cuentas predeterminadas
  const handleOpenNewSupplierModal = () => {
    const defaultExpense = configContable?.cuentaGastos || '5.1.01.001';
    const defaultCxp = configContable?.cuentaCxp || '2.1.01.001';

    setSupplierForm({
      type: 'supplier',
      isCompany: true,
      name: '',
      taxIdPrefix: 'J',
      taxIdNumber: '',
      email: '',
      phone: '',
      address: '',
      personaContacto: '',
      cargo: '',
      debitAccount: defaultExpense,
      creditAccount: defaultCxp
    });
    setActiveSupplierModalTab('info');
    setAccountValidationError(null);
    setIsNewSupplierModalOpen(true);
  };

  // Selector de cuentas contables dentro del modal de contactos
  const handleOpenCuentaModal = (key: 'debitAccount' | 'creditAccount') => {
    setActiveAccountKey(key);
    setShowCuentaModal(true);
  };

  const handleSelectCuenta = (cuenta: any) => {
    if (activeAccountKey && cuenta) {
      setSupplierForm(prev => ({ ...prev, [activeAccountKey]: cuenta.id || cuenta.codigo }));
      setAccountValidationError(null);
    }
    setShowCuentaModal(false);
    setActiveAccountKey(null);
  };

  // Guardar nuevo proveedor con el modal oficial de contactos
  const handleCreateOfficialSupplier = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierForm.name.trim()) {
      showToast?.('El nombre o razón social es obligatorio', 'error');
      return;
    }

    if (!supplierForm.debitAccount?.trim() || !supplierForm.creditAccount?.trim()) {
      setActiveSupplierModalTab('contabilidad');
      const msg = 'Debe vincular las cuentas contables de Gasto (Débito) y CxP (Crédito) para el proveedor';
      setAccountValidationError(msg);
      showToast?.(msg, 'error');
      return;
    }

    const fullTaxId = supplierForm.taxIdNumber.trim()
      ? `${supplierForm.taxIdPrefix}-${supplierForm.taxIdNumber.trim().toUpperCase()}`
      : 'J-00000000-0';

    const newId = crypto.randomUUID();
    const newContact: ContactoModel = {
      id: newId,
      empresa_id: '',
      name: supplierForm.name.trim(),
      tax_id: fullTaxId,
      taxId: fullTaxId,
      type: 'supplier',
      email: supplierForm.email.trim() || undefined,
      phone: supplierForm.phone.trim() || undefined,
      address: supplierForm.address.trim() || undefined,
      isCompany: supplierForm.isCompany,
      personaContacto: supplierForm.personaContacto.trim() || undefined,
      cargo: supplierForm.cargo.trim() || undefined,
      debitAccount: supplierForm.debitAccount,
      creditAccount: supplierForm.creditAccount,
      expense_account: supplierForm.debitAccount,
      saldo: 0,
      saldo_cxp: 0,
      tipo_contribuyente: 'ordinario',
      activo: true,
      created_at: new Date().toISOString()
    } as any;

    try {
      await onSave?.('contactos', newContact);
      handleSelectSupplier(newContact);
      setIsNewSupplierModalOpen(false);
      showToast?.(`Proveedor ${newContact.name} registrado exitosamente`, 'success');
    } catch (err) {
      console.error('Error al guardar proveedor:', err);
      showToast?.('Error al registrar el proveedor', 'error');
    }
  };

  // Fecha de vencimiento para compras a crédito
  const calculatedDueDate = useMemo(() => {
    if (!issueDate) return getTodayLocalDate();
    try {
      const d = new Date(issueDate + 'T12:00:00');
      d.setDate(d.getDate() + (Number(creditDays) || 0));
      return d.toISOString().split('T')[0];
    } catch {
      return issueDate;
    }
  }, [issueDate, creditDays]);

  // CÁLCULOS MATEMÁTICOS INTEGRALES CON BASE IMPONIBLE Y MONTO EXENTO
  const calculations = useMemo(() => {
    const rawBase = parseFloat(baseImponibleInput.replace(',', '.')) || 0;
    const rawExento = parseFloat(montoExentoInput.replace(',', '.')) || 0;
    const isVes = currency === 'VES' && exchangeRate > 0;
    
    // Valores en USD
    const baseImponibleUSD = isVes ? (rawBase / exchangeRate) : rawBase;
    const montoExentoUSD = isVes ? (rawExento / exchangeRate) : rawExento;

    // Valores en Bolívares
    const baseImponibleBs = isVes ? rawBase : (rawBase * exchangeRate);
    const montoExentoBs = isVes ? rawExento : (rawExento * exchangeRate);

    // Subtotal antes de impuesto
    const subtotalUSD = baseImponibleUSD + montoExentoUSD;
    const subtotalBs = baseImponibleBs + montoExentoBs;

    // IVA 16% (Aplica EXCLUSIVAMENTE a la Base Imponible Gravada)
    const ivaMontoUSD = baseImponibleUSD * 0.16;
    const ivaMontoBs = baseImponibleBs * 0.16;

    // Total Factura
    const totalFacturaUSD = subtotalUSD + ivaMontoUSD;
    const totalFacturaBs = subtotalBs + ivaMontoBs;

    // Retención IVA (calculada sobre el IVA generado)
    const retIvaUSD = applyRetIva ? (ivaMontoUSD * (retIvaPercent / 100)) : 0;
    const retIvaBs = applyRetIva ? (ivaMontoBs * (retIvaPercent / 100)) : 0;

    // Retención ISLR (calculada sobre la Base Imponible Gravada)
    const retIslrUSD = applyRetIslr ? (baseImponibleUSD * (retIslrPercent / 100)) : 0;
    const retIslrBs = applyRetIslr ? (baseImponibleBs * (retIslrPercent / 100)) : 0;

    // Total Retenido
    const totalRetencionesUSD = retIvaUSD + retIslrUSD;
    const totalRetencionesBs = retIvaBs + retIslrBs;

    // Neto a Pagar
    const netoPagarUSD = Math.max(0, totalFacturaUSD - totalRetencionesUSD);
    const netoPagarBs = Math.max(0, totalFacturaBs - totalRetencionesBs);

    return {
      baseImponibleUSD: Number(baseImponibleUSD.toFixed(2)),
      baseImponibleBs: Number(baseImponibleBs.toFixed(2)),
      montoExentoUSD: Number(montoExentoUSD.toFixed(2)),
      montoExentoBs: Number(montoExentoBs.toFixed(2)),
      subtotalUSD: Number(subtotalUSD.toFixed(2)),
      subtotalBs: Number(subtotalBs.toFixed(2)),
      ivaMontoUSD: Number(ivaMontoUSD.toFixed(2)),
      ivaMontoBs: Number(ivaMontoBs.toFixed(2)),
      totalFacturaUSD: Number(totalFacturaUSD.toFixed(2)),
      totalFacturaBs: Number(totalFacturaBs.toFixed(2)),
      retIvaUSD: Number(retIvaUSD.toFixed(2)),
      retIvaBs: Number(retIvaBs.toFixed(2)),
      retIslrUSD: Number(retIslrUSD.toFixed(2)),
      retIslrBs: Number(retIslrBs.toFixed(2)),
      totalRetencionesUSD: Number(totalRetencionesUSD.toFixed(2)),
      totalRetencionesBs: Number(totalRetencionesBs.toFixed(2)),
      netoPagarUSD: Number(netoPagarUSD.toFixed(2)),
      netoPagarBs: Number(netoPagarBs.toFixed(2))
    };
  }, [baseImponibleInput, montoExentoInput, currency, exchangeRate, applyRetIva, retIvaPercent, applyRetIslr, retIslrPercent]);

  // Helper para resolver UUID de cuenta contable
  const resolveCuentaId = (cuentaRef: string, fallbackCode: string): string => {
    if (!cuentaRef && !fallbackCode) return '';
    if (isUUID(cuentaRef)) return cuentaRef;
    const found = cuentasContables.find(c => c.id === cuentaRef || c.codigo === cuentaRef || c.codigo === fallbackCode);
    if (found && isUUID(found.id)) return found.id;
    return cuentaRef || fallbackCode;
  };

  // Guardar Gasto/Servicio y Contabilizar Automáticamente
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierName.trim() || !supplierRif.trim()) {
      showToast?.('Por favor selecciona o registra un proveedor.', 'error');
      return;
    }
    if (!invoiceNumber.trim()) {
      showToast?.('Por favor ingresa el número de documento / factura.', 'error');
      return;
    }
    if (!concepto.trim()) {
      showToast?.('Por favor ingresa el concepto o descripción del gasto/servicio.', 'error');
      return;
    }
    if (calculations.subtotalUSD <= 0) {
      showToast?.('Por favor ingresa un monto válido en Base Imponible o Monto Exento.', 'error');
      return;
    }
    if (paymentCondition === 'contado' && !selectedBankId) {
      showToast?.('Por favor selecciona el banco o caja de salida para el pago de contado.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const timestamp = Date.now();
      const purchaseId = crypto.randomUUID();
      const cxpId = crypto.randomUUID();
      const voucherId = crypto.randomUUID();

      // 1. Resolver cuenta contable de egreso desde el proveedor o configuración del sistema
      const ctaGastoRaw = supplierExpenseAccount || configContable?.cuentaGastos || '5.1.01.001';
      const ctaGastoId = resolveCuentaId(ctaGastoRaw, '5.1.01.001');

      // 2. Resolver cuentas contables para el asiento de partida doble automático
      const ctaCreditoFiscalId = resolveCuentaId(configContable?.cuentaCreditoFiscal || '1.1.08.001', '1.1.08.001');
      const ctaRetIvaId = resolveCuentaId(configContable?.cuentaIvaRetenidoCompras || '2.1.03.001', '2.1.03.001');
      const ctaRetIslrId = resolveCuentaId(configContable?.cuentaIslrRetenidoCompras || '2.1.04.001', '2.1.04.001');
      
      const selectedBank = bancos.find(b => b.id === selectedBankId);
      const ctaBancoId = selectedBank?.cuenta_contable_id ? resolveCuentaId(selectedBank.cuenta_contable_id, '1.1.01.001') : resolveCuentaId('1.1.01.001', '1.1.01.001');
      const ctaCxpId = resolveCuentaId(configContable?.cuentaCxp || '2.1.01.001', '2.1.01.001');

      // Glosa del comprobante contable (idéntica al concepto)
      const voucherDescripcion = `${concepto.trim()} (Doc. ${invoiceNumber.trim().toUpperCase()}) - ${supplierName.trim()}`;

      // Líneas del Asiento NIIF Cuadrado
      const lineasAsiento = [
        {
          id: crypto.randomUUID(),
          cuentaId: ctaGastoId,
          descripcion: voucherDescripcion,
          debe: calculations.subtotalUSD,
          haber: 0
        },
        ...(calculations.ivaMontoUSD > 0 ? [{
          id: crypto.randomUUID(),
          cuentaId: ctaCreditoFiscalId,
          descripcion: voucherDescripcion,
          debe: calculations.ivaMontoUSD,
          haber: 0
        }] : []),
        ...(calculations.retIvaUSD > 0 ? [{
          id: crypto.randomUUID(),
          cuentaId: ctaRetIvaId,
          descripcion: voucherDescripcion,
          debe: 0,
          haber: calculations.retIvaUSD
        }] : []),
        ...(calculations.retIslrUSD > 0 ? [{
          id: crypto.randomUUID(),
          cuentaId: ctaRetIslrId,
          descripcion: voucherDescripcion,
          debe: 0,
          haber: calculations.retIslrUSD
        }] : []),
        {
          id: crypto.randomUUID(),
          cuentaId: paymentCondition === 'credito' ? ctaCxpId : ctaBancoId,
          descripcion: voucherDescripcion,
          debe: 0,
          haber: calculations.netoPagarUSD
        }
      ];

      // 3. Guardar Comprobante Contable de Diario
      const newVoucher = {
        id: voucherId,
        fecha: issueDate,
        numero: `CMP-SRV-${timestamp.toString().slice(-6)}`,
        tipo: 'Diario',
        descripcion: voucherDescripcion,
        referencia: `SRV-${invoiceNumber.trim().toUpperCase()}`,
        total: calculations.totalFacturaUSD,
        estado: 'Contabilizado',
        lineas: lineasAsiento,
        created_at: new Date().toISOString()
      };

      // Previsualizar comprobante contable antes de persistir la operación
      setPendingVoucher({
        comprobante: newVoucher,
        onConfirm: async (finalVoucher: any) => {
          await executeSaveService(finalVoucher, purchaseId, cxpId, ctaGastoId);
        }
      });
    } catch (err) {
      console.error('Error preparando gasto/servicio:', err);
      showToast?.('Ocurrió un error al preparar los datos del gasto/servicio.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeSaveService = async (
    finalVoucher: any,
    purchaseId: string,
    cxpId: string,
    ctaGastoId: string | null
  ) => {
    setIsSubmitting(true);
    try {
      const voucherIdToUse = finalVoucher?.id || crypto.randomUUID();

      // 1. Guardar Comprobante Contable de Diario confirmado
      await onSave?.('comprobantes', {
        ...finalVoucher,
        id: voucherIdToUse
      });

      // 2. Guardar Documento de Compra / Servicio
      const itemServicio: FacturaCompraItemModel = {
        id: crypto.randomUUID(),
        descripcion: concepto.trim(),
        unidad_medida: 'UND',
        cantidad: 1,
        costo_unitario: calculations.subtotalUSD,
        costo_unitario_bs: calculations.subtotalBs,
        exento: calculations.montoExentoUSD > 0,
        alicuota_iva: calculations.baseImponibleUSD > 0 ? 16 : 0,
        subtotal: calculations.subtotalUSD,
        subtotal_bs: calculations.subtotalBs,
        iva_monto: calculations.ivaMontoUSD,
        iva_monto_bs: calculations.ivaMontoBs,
        total: calculations.totalFacturaUSD,
        total_bs: calculations.totalFacturaBs,
        cuenta_gasto_id: ctaGastoId
      };

      const newServiceDoc: FacturaCompraModel = {
        id: purchaseId,
        empresa_id: '',
        numero: invoiceNumber.trim().toUpperCase(),
        control_numero: controlNumber.trim() || undefined,
        tipo_documento: 'servicio',
        categoria_compra: 'servicio',
        cuenta_gasto_id: ctaGastoId,
        concepto_gasto: concepto.trim(),
        condicion: paymentCondition,
        dias_credito: paymentCondition === 'credito' ? creditDays : 0,
        proveedor_id: selectedSupplierId || undefined,
        proveedor_nombre: supplierName.trim(),
        proveedor_rif: supplierRif.trim(),
        proveedor_direccion: supplierAddress.trim() || undefined,
        proveedor_telefono: supplierPhone.trim() || undefined,
        fecha_emision: issueDate,
        fecha_vencimiento: paymentCondition === 'credito' ? calculatedDueDate : issueDate,
        moneda: 'USD',
        moneda_presentacion: currency,
        tasa_cambio: exchangeRate,
        items: [itemServicio],
        subtotal: calculations.subtotalUSD,
        base_imponible: calculations.baseImponibleUSD,
        monto_exento: calculations.montoExentoUSD,
        iva_porcentaje: calculations.baseImponibleUSD > 0 ? 16 : 0,
        iva_monto: calculations.ivaMontoUSD,
        retencion_iva_porcentaje: applyRetIva ? retIvaPercent : 0,
        retencion_iva_monto: calculations.retIvaUSD,
        retencion_islr_porcentaje: applyRetIslr ? retIslrPercent : 0,
        retencion_islr_monto: calculations.retIslrUSD,
        igtf_monto: 0,
        neto_pagar: calculations.netoPagarUSD,
        total: calculations.totalFacturaUSD,
        saldo_pendiente: paymentCondition === 'credito' ? calculations.netoPagarUSD : 0,
        subtotal_bs: calculations.subtotalBs,
        base_imponible_bs: calculations.baseImponibleBs,
        monto_exento_bs: calculations.montoExentoBs,
        iva_monto_bs: calculations.ivaMontoBs,
        retencion_iva_monto_bs: calculations.retIvaBs,
        retencion_islr_monto_bs: calculations.retIslrBs,
        total_bs: calculations.totalFacturaBs,
        saldo_pendiente_bs: paymentCondition === 'credito' ? calculations.netoPagarBs : 0,
        estado: paymentCondition === 'credito' ? 'emitida' : 'pagada',
        banco_id: paymentCondition === 'contado' ? selectedBankId : undefined,
        metodo_pago: paymentCondition === 'contado' ? paymentMethod : undefined,
        comprobante_id: voucherIdToUse,
        cxp_id: paymentCondition === 'credito' ? cxpId : undefined,
        notas: notes.trim() || undefined,
        created_at: new Date().toISOString()
      };

      await onSave?.('facturasCompra', newServiceDoc);

      // 3. Si es a Crédito, Guardar Cuenta por Pagar (CxP)
      if (paymentCondition === 'credito') {
        await onSave?.('cxp', {
          id: cxpId,
          factura_id: purchaseId,
          factura_db_id: purchaseId,
          factura: newServiceDoc.numero,
          numero: newServiceDoc.numero,
          proveedor_id: selectedSupplierId || undefined,
          proveedor: newServiceDoc.proveedor_nombre,
          proveedor_nombre: newServiceDoc.proveedor_nombre,
          proveedor_rif: newServiceDoc.proveedor_rif,
          taxId: newServiceDoc.proveedor_rif,
          categoria: 'proveedores',
          fecha: issueDate,
          fecha_emision: issueDate,
          vencimiento: calculatedDueDate,
          fecha_vencimiento: calculatedDueDate,
          descripcion: `Servicio / Gasto: ${concepto.trim()} (Doc. ${newServiceDoc.numero})`,
          tipo: 'factura',
          total: calculations.netoPagarUSD,
          monto: calculations.netoPagarUSD,
          monto_total: calculations.netoPagarUSD,
          saldo: calculations.netoPagarUSD,
          saldo_pendiente: calculations.netoPagarUSD,
          monto_bs: calculations.netoPagarBs,
          saldo_bs: calculations.netoPagarBs,
          moneda: 'USD',
          tasa: exchangeRate,
          tasa_cambio: exchangeRate,
          estado: 'pendiente'
        });
      }

      // 4. Si es de Contado, Registrar Egreso Bancario y Pago Realizado
      if (paymentCondition === 'contado' && selectedBankId) {
        await onSave?.('movimientosBancos', {
          id: crypto.randomUUID(),
          empresa_id: '',
          banco_id: selectedBankId,
          fecha: issueDate,
          ref: paymentRef.trim() || newServiceDoc.numero,
          descripcion: `Pago Gasto/Servicio Doc. ${newServiceDoc.numero} - ${supplierName.trim()} (${concepto.trim()})`,
          tipo: 'egreso',
          monto: calculations.netoPagarUSD,
          montoBs: calculations.netoPagarBs,
          tasa: exchangeRate,
          comprobante_id: voucherIdToUse,
          created_at: new Date().toISOString()
        });

        await onSave?.('pagos-realizados', {
          id: crypto.randomUUID(),
          comprobantePago: paymentRef.trim() || newServiceDoc.numero,
          proveedorId: selectedSupplierId || undefined,
          proveedorNombre: supplierName.trim(),
          fecha: issueDate,
          montoTotal: calculations.netoPagarUSD,
          bancoId: selectedBankId,
          comprobanteId: voucherIdToUse,
          retencionIva: calculations.retIvaUSD,
          retencionIslr: calculations.retIslrUSD,
          detalles: [{ docId: purchaseId, monto: calculations.netoPagarUSD, numDoc: newServiceDoc.numero }],
          notas: `Pago directo de Gasto / Servicio: ${concepto.trim()}`,
          estado: 'activo'
        });
      }

      showToast?.(
        paymentCondition === 'credito'
          ? `Gasto / Servicio registrado exitosamente. Se generó Cuenta por Pagar para ${supplierName}.`
          : `Gasto / Servicio pagado de contado y contabilizado exitosamente.`,
        'success'
      );

      setPendingVoucher(null);
      onClose();
    } catch (err) {
      console.error('Error al guardar gasto/servicio:', err);
      showToast?.('Ocurrió un error al registrar el gasto/servicio.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* ========================================================================= */}
        {/* BARRA SUPERIOR ESTILO ERP COMPRAS / VENTAS CON TASA EDITABLE              */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Briefcase size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black tracking-tight text-white uppercase">
                  Registrar Gasto / Servicio
                </h2>
                <span className="font-mono text-[11px] font-black text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                  N° {invoiceNumber || '---'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Conmutador Multimoneda USD vs VES */}
            <div className="inline-flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setCurrency('USD')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-black transition cursor-pointer ${
                  currency === 'USD' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                USD ($)
              </button>
              <button
                type="button"
                onClick={() => setCurrency('VES')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-black transition cursor-pointer ${
                  currency === 'VES' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Bs. (VES)
              </button>
            </div>

            {/* Tasa BCV Editable Manualmente */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 text-[11px]">
              <span className="text-slate-400 font-medium">Tasa:</span>
              <span className="text-slate-400 text-xs font-bold">Bs.</span>
              <input
                type="text"
                value={exchangeRateInput}
                onChange={e => setExchangeRateInput(e.target.value)}
                placeholder="0.00"
                className="w-16 px-1 py-0.5 bg-slate-900 border border-slate-600 rounded text-emerald-400 font-mono font-black text-xs text-right outline-none focus:border-emerald-400"
                title="Tasa de cambio editable para esta factura"
              />
            </div>

            <button 
              type="button" 
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CUERPO PRINCIPAL EN UN SOLO LUGAR (2 COLUMNAS INTEGRALES)                 */}
        {/* ========================================================================= */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          
          <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 bg-slate-100/70 text-slate-800">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              
              {/* ------------------------------------------------------------------- */}
              {/* COLUMNA IZQUIERDA (5 columnas): Documento, Proveedor y Pago         */}
              {/* ------------------------------------------------------------------- */}
              <div className="lg:col-span-5 space-y-3">
                
                {/* 1. DATOS DEL DOCUMENTO FISCAL */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                    <span className="font-black text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <FileText size={13} className="text-indigo-600" />
                      Datos del Comprobante
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">GASTO / SENIAT</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Tipo de Documento
                      </label>
                      <select
                        value={docType}
                        onChange={e => setDocType(e.target.value as any)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 outline-none text-xs"
                      >
                        <option value="factura">Factura Formal (01)</option>
                        <option value="recibo">Recibo / Comprobante</option>
                        <option value="nota_debito">Nota de Débito (03)</option>
                        <option value="comprobante">Gasto Operacional</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        Fecha de Emisión *
                      </label>
                      <input
                        type="date"
                        required
                        value={issueDate}
                        onChange={e => setIssueDate(e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 outline-none text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        N° Factura / Doc *
                      </label>
                      <input
                        type="text"
                        required
                        value={invoiceNumber}
                        onChange={e => setInvoiceNumber(e.target.value.toUpperCase())}
                        placeholder="Ej. FC-00129"
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 text-xs uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                        N° Control SENIAT
                      </label>
                      <input
                        type="text"
                        value={controlNumber}
                        onChange={e => setControlNumber(e.target.value.toUpperCase())}
                        placeholder="Ej. 00-128495"
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500 text-xs uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. SELECTOR DE PROVEEDOR (IDÉNTICO A COMPRAS DE MERCANCÍA) */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                    <span className="font-black text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 size={13} className="text-indigo-600" />
                      Proveedor / Beneficiario *
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsSearchSupplierModalOpen(true)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5"
                      >
                        <Search size={11} />
                        <span>Buscar</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleOpenNewSupplierModal}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-0.5"
                      >
                        <Plus size={11} />
                        <span>+ Nuevo</span>
                      </button>
                    </div>
                  </div>

                  {supplierName ? (
                    <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-2.5 flex items-center justify-between">
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
                        {supplierPhone && (
                          <p className="text-[10px] text-slate-400">📞 {supplierPhone}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleClearSupplier}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-white transition cursor-pointer shrink-0"
                        title="Cambiar proveedor"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => setIsSearchSupplierModalOpen(true)}
                      className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-3 text-center cursor-pointer transition bg-slate-50/60 hover:bg-indigo-50/40 flex items-center justify-center gap-2"
                    >
                      <Building2 size={16} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-600">
                        Haga clic para buscar o registrar proveedor
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. CONDICIÓN DE PAGO & TESORERÍA */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                    <span className="font-black text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <CreditCard size={13} className="text-indigo-600" />
                      Condición de Pago & Cuentas por Pagar (CxP)
                    </span>
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setPaymentCondition('contado')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                          paymentCondition === 'contado' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600'
                        }`}
                      >
                        Contado
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentCondition('credito')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                          paymentCondition === 'credito' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600'
                        }`}
                      >
                        A Crédito
                      </button>
                    </div>
                  </div>

                  {paymentCondition === 'credito' ? (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-amber-600" />
                          <span className="font-bold text-amber-900">Días de Crédito:</span>
                          <input
                            type="number"
                            min="1"
                            value={creditDays}
                            onChange={e => setCreditDays(parseInt(e.target.value) || 0)}
                            className="w-14 px-1.5 py-0.5 bg-white border border-amber-300 rounded font-bold text-center text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold">Vence:</span>{' '}
                          <span className="font-mono font-black text-amber-900">{calculatedDueDate}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-amber-800">
                        ℹ️ Se generará saldo pendiente en la cartera de CxP del proveedor.
                      </p>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-lg text-xs space-y-2 animate-in fade-in">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-950 mb-0.5">
                            Banco / Caja Salida *
                          </label>
                          <select
                            value={selectedBankId}
                            onChange={e => setSelectedBankId(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-semibold"
                            required={paymentCondition === 'contado'}
                          >
                            {bancos.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.banco} ({b.moneda})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-950 mb-0.5">
                            Método de Pago
                          </label>
                          <select
                            value={paymentMethod}
                            onChange={e => setPaymentMethod(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-emerald-300 rounded-lg text-xs font-semibold"
                          >
                            <option value="Transferencia">Transferencia</option>
                            <option value="Pago Móvil">Pago Móvil</option>
                            <option value="Efectivo">Efectivo / Caja</option>
                            <option value="Punto de Venta">Punto de Venta</option>
                            <option value="Zelle">Zelle</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="N° de Referencia Bancaria (Ej. 984512)"
                          value={paymentRef}
                          onChange={e => setPaymentRef(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-emerald-300 rounded-lg font-mono text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* ------------------------------------------------------------------- */}
              {/* COLUMNA DERECHA (7 columnas): Montos, Bases, Retenciones & Totales  */}
              {/* ------------------------------------------------------------------- */}
              <div className="lg:col-span-7 space-y-3">
                
                {/* 1. CONCEPTO Y DISCRIMINACIÓN DE BASES FISCALES */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                    <span className="font-black text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                      <Percent size={13} className="text-indigo-600" />
                      Detalle del Gasto & Montos Fiscales
                    </span>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      Moneda: {currency}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                      Concepto / Descripción del Gasto o Servicio *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Mantenimiento mensual de servidores / Honorarios contables..."
                      value={concepto}
                      onChange={e => setConcepto(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  {/* CAJAS SEPARADAS DE BASE IMPONIBLE GRAVADA Y MONTO EXENTO */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    
                    {/* Base Imponible Gravada */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] font-bold text-slate-700 uppercase">
                          Base Imponible (Gravada 16%)
                        </label>
                        <span className="text-[9px] font-bold text-indigo-600 uppercase">Sujeto a IVA</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold text-xs">
                          {currency === 'USD' ? '$' : 'Bs.'}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={baseImponibleInput}
                          onChange={e => setBaseImponibleInput(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-black text-sm text-slate-900 outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                        <span>IVA (16%):</span>
                        <span className="font-bold text-slate-700">+${formatNumber(calculations.ivaMontoUSD)}</span>
                      </div>
                    </div>

                    {/* Monto Exento / No Sujeto */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] font-bold text-slate-700 uppercase">
                          Monto Exento / No Sujeto
                        </label>
                        <span className="text-[9px] font-bold text-emerald-600 uppercase">Sin IVA (0%)</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold text-xs">
                          {currency === 'USD' ? '$' : 'Bs.'}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={montoExentoInput}
                          onChange={e => setMontoExentoInput(e.target.value)}
                          className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-black text-sm text-slate-900 outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                        <span>Equiv. en {currency === 'USD' ? 'Bs.' : 'USD'}:</span>
                        <span className="font-bold text-slate-700">
                          {currency === 'USD' ? `Bs. ${formatNumber(calculations.montoExentoBs)}` : `$${formatNumber(calculations.montoExentoUSD)}`}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 2. RETENCIONES SENIAT */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
                  <span className="font-black text-slate-700 text-[11px] uppercase tracking-wider block border-b border-slate-100 pb-1">
                    Retenciones Fiscales (Libro de Compras SENIAT)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Retención IVA */}
                    <div className={`p-2 rounded-xl border transition-all ${
                      applyRetIva && calculations.ivaMontoUSD > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50/50 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            disabled={calculations.ivaMontoUSD <= 0}
                            checked={applyRetIva && calculations.ivaMontoUSD > 0}
                            onChange={e => setApplyRetIva(e.target.checked)}
                            className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300"
                          />
                          <span className="text-xs font-bold text-slate-800">Retención IVA</span>
                        </label>
                        {applyRetIva && calculations.ivaMontoUSD > 0 && (
                          <select
                            value={retIvaPercent}
                            onChange={e => setRetIvaPercent(Number(e.target.value))}
                            className="text-[11px] font-black py-0.5 px-1.5 border border-amber-300 rounded bg-white"
                          >
                            <option value={75}>75%</option>
                            <option value={100}>100%</option>
                          </select>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between pt-1 mt-1 border-t border-slate-200/60 font-mono">
                        <span>Retenido:</span>
                        <span className="font-bold text-amber-800">-${formatNumber(calculations.retIvaUSD)}</span>
                      </div>
                    </div>

                    {/* Retención ISLR */}
                    <div className={`p-2 rounded-xl border transition-all ${
                      applyRetIslr && calculations.baseImponibleUSD > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50/50 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            disabled={calculations.baseImponibleUSD <= 0}
                            checked={applyRetIslr && calculations.baseImponibleUSD > 0}
                            onChange={e => setApplyRetIslr(e.target.checked)}
                            className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300"
                          />
                          <span className="text-xs font-bold text-slate-800">Retención ISLR</span>
                        </label>
                        {applyRetIslr && calculations.baseImponibleUSD > 0 && (
                          <select
                            value={retIslrPercent}
                            onChange={e => setRetIslrPercent(Number(e.target.value))}
                            className="text-[11px] font-black py-0.5 px-1.5 border border-amber-300 rounded bg-white"
                          >
                            <option value={1}>1% (Bienes)</option>
                            <option value={2}>2% (Servicios)</option>
                            <option value={3}>3% (Honorarios PJ)</option>
                            <option value={5}>5% (Alquileres)</option>
                          </select>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between pt-1 mt-1 border-t border-slate-200/60 font-mono">
                        <span>Retenido:</span>
                        <span className="font-bold text-amber-800">-${formatNumber(calculations.retIslrUSD)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. RESUMEN DE TOTALIZADORES ESTILO VENTAS / COMPRAS */}
                <div className="bg-slate-900 text-white rounded-xl p-3.5 shadow-md space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between items-center text-slate-300 pb-1 border-b border-slate-800 text-[11px]">
                    <span className="font-sans font-bold">Base Imponible Gravada:</span>
                    <span className="font-bold text-white">${formatNumber(calculations.baseImponibleUSD)}</span>
                  </div>

                  {calculations.montoExentoUSD > 0 && (
                    <div className="flex justify-between items-center text-emerald-300 text-[11px]">
                      <span className="font-sans font-bold">Monto Exento / No Sujeto:</span>
                      <span className="font-bold">${formatNumber(calculations.montoExentoUSD)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-indigo-300">
                    <span className="font-sans font-semibold">IVA (16%):</span>
                    <span className="font-bold">+${formatNumber(calculations.ivaMontoUSD)}</span>
                  </div>

                  {calculations.totalRetencionesUSD > 0 && (
                    <div className="flex justify-between items-center text-amber-400">
                      <span className="font-sans font-semibold">Retenciones Aplicadas:</span>
                      <span className="font-bold">-${formatNumber(calculations.totalRetencionesUSD)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-white pt-1.5 border-t border-slate-800">
                    <span className="font-sans font-bold text-xs">Total Factura:</span>
                    <span className="font-bold">${formatNumber(calculations.totalFacturaUSD)}</span>
                  </div>

                  {/* NETO A PAGAR ENORME */}
                  <div className="flex justify-between items-baseline pt-2 border-t-2 border-indigo-500/60 text-emerald-400">
                    <div className="font-sans">
                      <span className="text-[11px] font-black uppercase tracking-wider block text-emerald-300">
                        Neto a Liquidar ({paymentCondition === 'credito' ? 'CxP' : 'Contado'}):
                      </span>
                      <span className="text-[10px] text-slate-400">
                        (Bs. {formatNumber(calculations.netoPagarBs)})
                      </span>
                    </div>
                    <span className="text-xl font-black tracking-tight text-emerald-400">
                      ${formatNumber(calculations.netoPagarUSD)}
                    </span>
                  </div>
                </div>

                {/* NOTAS ADICIONALES */}
                <div>
                  <input
                    type="text"
                    placeholder="Notas u observaciones del gasto (Opcional)..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500"
                  />
                </div>

              </div>

            </div>
          </div>

          {/* ========================================================================= */}
          {/* BARRA INFERIOR DE ACCIONES                                                */}
          {/* ========================================================================= */}
          <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <span className="text-[11px] text-slate-500 font-medium">
              * El asiento contable de partida doble se generará automáticamente con las cuentas del proveedor y tesorería.
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-400 text-white rounded-xl font-black text-xs shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Save size={14} />
                <span>{isSubmitting ? 'Registrando...' : 'REGISTRAR GASTO / SERVICIO'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE BÚSQUEDA DE PROVEEDOR EXISTENTE                                  */}
      {/* ========================================================================= */}
      {isSearchSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-60 flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[80vh]">
            <div className="px-4 py-3 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-indigo-400" />
                <h3 className="font-bold text-xs uppercase tracking-wider">Buscar Proveedor</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSearchSupplierModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 bg-slate-50">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar por nombre o RIF (Ej. J-12345678)..."
                  value={supplierSearchTerm}
                  onChange={e => setSupplierSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {filteredSuppliers.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No se encontraron proveedores que coincidan.
                </div>
              ) : (
                filteredSuppliers.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSupplier(s)}
                    className="w-full p-2.5 hover:bg-indigo-50/70 rounded-xl flex items-center justify-between text-left transition border border-transparent hover:border-indigo-200 group cursor-pointer"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 group-hover:text-indigo-900">{s.name}</h4>
                      <p className="font-mono text-[10px] text-slate-500">{((s as any).tax_id || (s as any).taxId || (s as any).rif)}</p>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition">
                      Seleccionar →
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="p-2.5 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setIsSearchSupplierModalOpen(false);
                  handleOpenNewSupplierModal();
                }}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                <Plus size={13} />
                <span>+ Registrar Nuevo Proveedor</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSearchSupplierModalOpen(false)}
                className="px-3 py-1 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL OFICIAL DE CREACIÓN DE PROVEEDOR (IDÉNTICO A CONTACTOS)            */}
      {/* ========================================================================= */}
      {isNewSupplierModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col border border-slate-200">
            
            {/* Header del Modal idéntico a Contactos */}
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-rose-500 to-orange-500 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white shadow-2xs">
                  <Truck size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black">Registrar Nuevo Proveedor</h2>
                  <p className="text-white/80 text-xs">Datos generales y configuración contable</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsNewSupplierModalOpen(false)} 
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Pestañas del Formulario idénticas a Contactos */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveSupplierModalTab('info')}
                className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                  activeSupplierModalTab === 'info'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <User size={14} />
                <span>1. Información General</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSupplierModalTab('contabilidad')}
                className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                  activeSupplierModalTab === 'contabilidad'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <BookOpen size={14} />
                <span>2. Enlace Contable</span>
                {(!supplierForm.debitAccount || !supplierForm.creditAccount) && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                    Requerido
                  </span>
                )}
              </button>
            </div>

            <form onSubmit={handleCreateOfficialSupplier} className="overflow-y-auto flex-1 flex flex-col justify-between">
              <div className="p-6 space-y-4 flex-1">
                
                {/* PESTAÑA 1: INFORMACIÓN GENERAL */}
                {activeSupplierModalTab === 'info' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Selector de Naturaleza Jurídica */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Naturaleza Jurídica
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSupplierForm(prev => ({ ...prev, isCompany: true, taxIdPrefix: 'J' }))}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                            supplierForm.isCompany
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Building2 size={16} />
                          <span>Persona Jurídica (Empresa)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSupplierForm(prev => ({ ...prev, isCompany: false, taxIdPrefix: 'V', personaContacto: '', cargo: '' }))}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                            !supplierForm.isCompany
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
                          supplierForm.isCompany 
                            ? 'Ej: Inversiones y Servicios Globales C.A.' 
                            : 'Ej: Juan Alberto Pérez'
                        }
                        value={supplierForm.name}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none" 
                      />
                    </div>

                    {/* RIF / Documento de Identidad */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Documento de Identidad / RIF *
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={supplierForm.taxIdPrefix}
                          onChange={(e) => setSupplierForm(prev => ({ ...prev, taxIdPrefix: e.target.value }))}
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
                          required
                          placeholder="12345678-9"
                          value={supplierForm.taxIdNumber}
                          onChange={(e) => setSupplierForm(prev => ({ ...prev, taxIdNumber: e.target.value }))}
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
                            placeholder="proveedor@ejemplo.com"
                            value={supplierForm.email}
                            onChange={(e) => setSupplierForm(prev => ({ ...prev, email: e.target.value }))}
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
                            placeholder="+58 414 1234567"
                            value={supplierForm.phone}
                            onChange={(e) => setSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Persona de Contacto & Cargo (Solo visible para Persona Jurídica / Empresa) */}
                    {supplierForm.isCompany && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Persona de Contacto</label>
                          <input 
                            type="text" 
                            placeholder="Nombre del responsable"
                            value={supplierForm.personaContacto}
                            onChange={(e) => setSupplierForm(prev => ({ ...prev, personaContacto: e.target.value }))}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none" 
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Cargo o Departamento</label>
                          <input 
                            type="text" 
                            placeholder="Ej: Gerente de Ventas"
                            value={supplierForm.cargo}
                            onChange={(e) => setSupplierForm(prev => ({ ...prev, cargo: e.target.value }))}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none" 
                          />
                        </div>
                      </div>
                    )}

                    {/* Dirección */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Dirección Fiscal / Ubicación</label>
                      <textarea 
                        placeholder="Ciudad, dirección de oficina o local comercial"
                        value={supplierForm.address}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none resize-none h-16" 
                      />
                    </div>
                  </div>
                )}

                {/* PESTAÑA 2: ENLACE CONTABLE OFICIAL */}
                {activeSupplierModalTab === 'contabilidad' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {accountValidationError && (
                      <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-bold">
                        <AlertTriangle size={18} className="shrink-0 text-rose-600" />
                        <span>{accountValidationError}</span>
                      </div>
                    )}

                    <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80">
                      <div className="flex items-start gap-2.5 text-amber-900">
                        <AlertTriangle size={17} className="shrink-0 mt-0.5 text-amber-600" />
                        <div>
                          <p className="text-xs font-bold text-amber-950">Vinculación Contable Automática *</p>
                          <p className="text-[11px] text-amber-800/90 font-medium mt-0.5 leading-relaxed">
                            Asocia las cuentas contables de <b>Gasto / Compras</b> y <b>Cuentas por Pagar</b> para este proveedor. Estas se usarán automáticamente al contabilizar sus facturas.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className={!supplierForm.debitAccount ? 'ring-2 ring-amber-400 rounded-2xl p-0.5' : ''}>
                        <CuentaSelectorTrigger
                          label="Cuenta de Gasto / Compras (Débito) *"
                          value={supplierForm.debitAccount}
                          cuentasContables={cuentasContables}
                          onClick={() => handleOpenCuentaModal('debitAccount')}
                        />
                      </div>

                      <div className={!supplierForm.creditAccount ? 'ring-2 ring-amber-400 rounded-2xl p-0.5' : ''}>
                        <CuentaSelectorTrigger
                          label="Cuenta por Pagar Proveedor (Crédito) *"
                          value={supplierForm.creditAccount}
                          cuentasContables={cuentasContables}
                          onClick={() => handleOpenCuentaModal('creditAccount')}
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
                  onClick={() => setIsNewSupplierModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
                >
                  Registrar Proveedor
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL SELECTOR DE CUENTAS CONTABLES (CUANDO SE BUSCA EN ENLACE CONTABLE) */}
      {/* ========================================================================= */}
      {showCuentaModal && (
        <CuentaContableModal
          isOpen={showCuentaModal}
          onClose={() => setShowCuentaModal(false)}
          onSelect={handleSelectCuenta}
          cuentasContables={cuentasContables}
          title={activeAccountKey === 'debitAccount' ? 'Cuenta de Gasto / Compras (Débito)' : 'Cuenta por Pagar (Crédito)'}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL PREVISUALIZACIÓN DE ASIENTO CONTABLE                                 */}
      {/* ========================================================================= */}
      {pendingVoucher && (
        <VoucherPreviewModal
          isOpen={!!pendingVoucher}
          onClose={() => setPendingVoucher(null)}
          initialComprobante={pendingVoucher.comprobante}
          cuentasContables={cuentasContables}
          onConfirm={pendingVoucher.onConfirm}
          showToast={showToast}
          title="Asiento Contable de Gasto / Servicio"
          subtitle="Verifique las cuentas de gasto, crédito fiscal y contrapartida antes de confirmar"
        />
      )}

    </div>
  );
}
