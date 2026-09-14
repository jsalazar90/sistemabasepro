import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, ArrowLeft, Search, Plus, Trash2, CheckCircle2, 
  Save, AlertTriangle, User, Building2, DollarSign, Calendar, 
  BookOpen, Eye, X, HelpCircle, Package, ShieldCheck
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
  const [docType, setDocType] = useState<'factura' | 'nota_entrega'>('factura');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [controlNumber, setControlNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentCondition, setPaymentCondition] = useState<'contado' | 'credito'>('contado');
  const [creditDays, setCreditDays] = useState(15);
  const [dueDate, setDueDate] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(36.50);
  const [notes, setNotes] = useState('');

  // Cliente Info
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerRif, setCustomerRif] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Modal selector de clientes
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  // Modal nuevo cliente rápido
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

  // Modal Previsualización de Asiento Contable
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [pendingVoucher, setPendingVoucher] = useState<any>(null);

  // Generar correlativo inicial
  useEffect(() => {
    const prefix = configContable?.prefijoFactura || 'FAC-';
    const baseCorrelativo = configContable?.correlativoFactura || '00001';
    setInvoiceNumber(`${prefix}${baseCorrelativo}`);
    setControlNumber(`00-${Math.floor(100000 + Math.random() * 900000)}`);
  }, [configContable]);

  // Recalcular fecha de vencimiento según condición
  useEffect(() => {
    if (paymentCondition === 'credito') {
      const base = new Date(issueDate);
      base.setDate(base.getDate() + Number(creditDays || 0));
      setDueDate(base.toISOString().split('T')[0]);