import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Save, Send, ShoppingCart, FileText, Building2, DollarSign, 
  Search, X, User, Plus, Check, MapPin, Mail, Phone, Tag, Users, Calendar, Briefcase,
  UserCheck
} from 'lucide-react';
import { Articulo } from '../services/db';
import BackButton from '../components/common/BackButton';

interface EmisionProductoPageProps {
  cxc?: any[];
  contactos?: any[];
  articulos?: Articulo[];
  onSave?: (collection: string, data: any) => void;
  showToast?: (msg: string, type: string) => void;
}

interface Pax {
  nombre: string;
  cedula: string;
  telefono: string;
}

export default function EmisionProductoPage({
  cxc = [],
  contactos = [],
  articulos = [],
  onSave,
  showToast
}: EmisionProductoPageProps) {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  // Document Info
  const [existingId, setExistingId] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState('Emisión');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState('USD');
  const [tasaCambio, setTasaCambio] = useState(36.50);
  const [applyIGTF, setApplyIGTF] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [showCosto, setShowCosto] = useState(false);

  // Modals State
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [providerSearchTerm, setProviderSearchTerm] = useState('');
  const [activeItemIndexForProvider, setActiveItemIndexForProvider] = useState<number | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');

  // Entities
  const [clientName, setClientName] = useState('');
  const [clientRif, setClientRif] = useState('');
  const [agenteViajes, setAgenteViajes] = useState('');
  const [emisionPropiaAliado, setEmisionPropiaAliado] = useState(false);
  const [providerName, setProviderName] = useState('');
  const [providerRif, setProviderRif] = useState('');

  // PAX List
  const [paxList, setPaxList] = useState<Pax[]>([{ nombre: '', cedula: '', telefono: '' }]);

  // Items State
  const [items, setItems] = useState<any[]>([]);

  // Tax Settings
  const [taxType, setTaxType] = useState('G');
  const [applyRetentions, setApplyRetentions] = useState(false);

  // Formateador de teléfono internacional para WhatsApp (+58 para Venezuela por defecto)
  const formatPhoneNumber = (val: string) => {
    let clean = val.replace(/\D/g, '');
    if (!clean) return '';
    // Si empieza por 0 (ej: 0414...), convertir 0414 en +58 414
    if (clean.startsWith('0')) {
      clean = '58' + clean.slice(1);
    } else if (!clean.startsWith('58') && (clean.startsWith('414') || clean.startsWith('424') || clean.startsWith('412') || clean.startsWith('416') || clean.startsWith('426'))) {
      clean = '58' + clean;
    }
    return '+' + clean;
  };

  // Cargar emisión existente si viene por URL param ?id=
  useEffect(() => {
    if (editId) {
      // Buscar en cxc o localStorage
      let found = cxc.find(c => String(c.id) === String(editId) || String(c.factura_id) === String(editId));
      if (!found) {
        try {
          const keys = Object.keys(localStorage).filter(k => k.startsWith('erp_local_cxc_'));
          for (const k of keys) {
            const list = JSON.parse(localStorage.getItem(k) || '[]');
            found = list.find((c: any) => String(c.id) === String(editId) || String(c.factura_id) === String(editId));
            if (found) break;
          }
        } catch {}
      }

      if (found) {
        setExistingId(found.id);
        setInvoiceNumber(found.factura_id || found.id || '');
        setDate(found.fecha_emision || found.fecha || new Date().toISOString().split('T')[0]);
        setCurrency(found.moneda || 'USD');
        if (found.tasa_cambio || found.tasa) setTasaCambio(Number(found.tasa_cambio || found.tasa));
        setClientRif(found.proveedor_id || found.cliente_id || '');
        setClientName(found.proveedor_nombre || found.cliente || '');
        
        if (found.metadata) {
          if (found.metadata.operador_rif) setProviderRif(found.metadata.operador_rif);
          if (found.metadata.operador_nombre) setProviderName(found.metadata.operador_nombre);
          if (found.metadata.observaciones) setObservaciones(found.metadata.observaciones);
          if (found.metadata.pax && Array.isArray(found.metadata.pax)) {
            setPaxList(found.metadata.pax.length > 0 ? found.metadata.pax : [{ nombre: '', cedula: '', telefono: '' }]);
          }
          if (found.metadata.items && Array.isArray(found.metadata.items)) {
            const mappedItems = found.metadata.items.map((it: any) => ({
              ...it,
              proveedorNombre: it.proveedorNombre || it.detalleExtra || found.metadata.operador_nombre || '',
              proveedorRif: it.proveedorRif || found.metadata.operador_rif || '',
              proveedorId: it.proveedorId || ''
            }));
            setItems(mappedItems);
            // Si algún item tiene costo mayor a 0, activar costo
            if (found.metadata.items.some((it: any) => Number(it.costo) > 0)) {
              setShowCosto(true);
            }
          }
        }
      }
    }
  }, [editId, cxc]);

  // Filtros
  const filteredClients = useMemo(() => {
    const term = clientSearchTerm.toLowerCase();
    return contactos.filter(c => 
      (c.type === 'customer' || c.type === 'both' || c.type === 'aliados') && 
      ((c.taxId || '').toLowerCase().includes(term) || 
       (c.name || '').toLowerCase().includes(term))
    );
  }, [contactos, clientSearchTerm]);

  const filteredProviders = useMemo(() => {
    const term = providerSearchTerm.toLowerCase();
    return contactos.filter(c => 
      (c.type === 'supplier' || c.type === 'both' || c.type === 'proveedores' || c.type === 'operador' || c.type === 'airline') && 
      ((c.taxId || '').toLowerCase().includes(term) || 
       (c.name || '').toLowerCase().includes(term))
    );
  }, [contactos, providerSearchTerm]);

  const travelAgents = useMemo(() => {
    const list = contactos.filter(c => 
      c.type === 'agentes' || 
      c.type === 'travel_agent' || 
      (c.type === 'employee' && c.employeeType !== 'empleado_general') ||
      c.employeeType === 'agente_emisor' ||
      c.employeeType === 'counter' ||
      c.employeeType === 'asesor' ||
      c.type === 'freelance'
    );
    if (list.length === 0) {
      return contactos.filter(c => c.type === 'employee' || c.type === 'empleados');
    }
    return list;
  }, [contactos]);

  const filteredArticulos = useMemo(() => {
    const term = itemSearchTerm.toLowerCase();
    return articulos.filter(a => 
      a.activo && (
        a.nombre.toLowerCase().includes(term) || 
        a.codigo.toLowerCase().includes(term)
      )
    );
  }, [articulos, itemSearchTerm]);

  // Handlers
  const handleSelectClient = (client: any) => {
    setClientRif(client.taxId);
    setClientName(client.name);
    setIsClientModalOpen(false);
    setClientSearchTerm('');
  };

  const handleSelectProvider = (provider: any) => {
    if (activeItemIndexForProvider !== null && items[activeItemIndexForProvider]) {
      const updated = [...items];
      updated[activeItemIndexForProvider] = {
        ...updated[activeItemIndexForProvider],
        proveedorId: provider.id || provider.taxId,
        proveedorNombre: provider.name,
        proveedorRif: provider.taxId || provider.rif || ''
      };
      setItems(updated);
    }
    setIsProviderModalOpen(false);
    setProviderSearchTerm('');
    setActiveItemIndexForProvider(null);
  };

  const handleSelectItem = (articulo: Articulo) => {
    setItems([...items, {
      ...articulo,
      fechaDesde: '',
      fechaHasta: '',
      dias: 1,
      costo: 0,
      precio: 0,
      proveedorId: '',
      proveedorNombre: '',
      proveedorRif: '',
    }]);
    setIsItemModalOpen(false);
    setItemSearchTerm('');
  };

  const getDurationText = (desde?: string, hasta?: string) => {
    if (!desde || !hasta) return '...';
    const d1 = new Date(desde);
    const d2 = new Date(hasta);
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      return `${diffDays + 1} Días / ${diffDays} Noches`;
    } else if (diffDays === 0) {
      return '1 Día / 0 Noches (Misma fecha)';
    }
    return 'Fechas inválidas';
  };

  const formatLiveNumberInput = (raw: string): { formatted: string; numeric: number } => {
    if (!raw) return { formatted: '', numeric: 0 };
    
    // Find if user typed comma or dot as decimal separator
    // If they typed multiple dots or commas, the last one entered is considered the decimal separator if any
    let lastSeparatorIdx = -1;
    let sepChar = '';
    for (let i = raw.length - 1; i >= 0; i--) {
      if (raw[i] === ',' || raw[i] === '.') {
        lastSeparatorIdx = i;
        sepChar = raw[i];
        break;
      }
    }

    let intPart = raw;
    let decPart = '';
    let hasDecSep = false;

    if (lastSeparatorIdx !== -1) {
      // Check if it's acting as a decimal separator
      hasDecSep = true;
      intPart = raw.slice(0, lastSeparatorIdx);
      decPart = raw.slice(lastSeparatorIdx + 1);
    }

    // Clean integer part to digits only
    const cleanIntDigits = intPart.replace(/\D/g, '');
    const cleanDecDigits = decPart.replace(/\D/g, '').slice(0, 2); // max 2 decimals

    if (!cleanIntDigits && !cleanDecDigits && !hasDecSep) {
      return { formatted: '', numeric: 0 };
    }

    // Format thousands with dot
    const formattedInt = (cleanIntDigits || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    let formatted = formattedInt;
    if (hasDecSep) {
      formatted += ',' + cleanDecDigits;
    }

    const numStr = (cleanIntDigits || '0') + (cleanDecDigits ? '.' + cleanDecDigits : '');
    const numeric = parseFloat(numStr) || 0;

    return { formatted, numeric };
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

    const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;

    if (field === 'fechaDesde' || field === 'fechaHasta') {
      const item = newItems[index];
      if (item.fechaDesde && item.fechaHasta) {
        const d1 = new Date(item.fechaDesde);
        const d2 = new Date(item.fechaHasta);
        const diffDays = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
          newItems[index].dias = diffDays + 1;
        }
      }
    }

    setItems(newItems);
  };

  const addPax = () => setPaxList([...paxList, { nombre: '', cedula: '', telefono: '' }]);
  const removePax = (idx: number) => {
    const newList = [...paxList];
    newList.splice(idx, 1);
    setPaxList(newList);
  };
  const updatePax = (idx: number, field: keyof Pax, val: string) => {
    const newList = [...paxList];
    newList[idx][field] = val;
    setPaxList(newList);
  };

  // Totales
  const totals = useMemo(() => {
    let base = 0;
    items.forEach(item => {
      base += Number(item.precio) || 0;
    });
    const ivaRate = taxType === 'G' ? 0.16 : taxType === 'R' ? 0.08 : 0.31;
    const iva = base * ivaRate;
    const subtotal = base;
    const igtf = applyIGTF && currency === 'USD' ? (subtotal + iva) * 0.03 : 0;
    const total = subtotal + iva + igtf;
    return { base, iva, subtotal, igtf, total };
  }, [items, taxType, applyIGTF, currency]);

  const formatMoney = (amount: number, curr: string = currency) => {
    const n = Number(amount) || 0;
    let parts = n.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const formatted = parts.join(',');
    return curr === 'VES' ? `Bs. ${formatted}` : curr === 'EUR' ? `€ ${formatted}` : `$ ${formatted}`;
  };

  const formatNumberDisplay = (amount: any) => {
    if (amount === '' || amount === null || amount === undefined || isNaN(Number(amount))) return '';
    const num = Number(amount);
    let parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.join(',');
  };

  const handleSaveInvoice = () => {
    if (!clientRif || !clientName) {
      if (showToast) showToast('Debe seleccionar un Aliado / Cliente', 'error');
      return;
    }
    if (items.length === 0) {
      if (showToast) showToast('Debe agregar al menos un servicio', 'error');
      return;
    }
    if (!invoiceNumber) {
      if (showToast) showToast('Debe ingresar el N° Tripplanners', 'error');
      return;
    }

    const cxcPayload = {
      id: existingId || `cxc_${Date.now()}`,
      factura_id: invoiceNumber,
      tipo: documentType.toLowerCase().includes('emisi') ? 'emision' : 'factura',
      fecha_emision: date,
      fecha_vencimiento: date, 
      proveedor_id: clientRif,
      proveedor_nombre: clientName,
      moneda: currency,
      tasa_cambio: currency === 'VES' ? tasaCambio : undefined,
      monto_total: totals.total,
      monto_pagado: 0,
      saldo_pendiente: totals.total,
      estatus: 'Pendiente',
      descripcion: `${documentType} para ${paxList[0]?.nombre || clientName}`,
      metadata: {
        pax: paxList.filter(p => p.nombre.trim() !== ''),
        agente_viajes: emisionPropiaAliado ? '' : agenteViajes,
        emision_propia_aliado: emisionPropiaAliado,
        operador_rif: items.find(i => i.proveedorRif)?.proveedorRif || providerRif || '',
        operador_nombre: items.map(i => i.proveedorNombre).filter(Boolean).join(', ') || providerName || '',
        observaciones: observaciones,
        items: items
      }
    };

    if (onSave) {
      onSave('cxc', cxcPayload);
    }
    
    if (showToast) {
      showToast(existingId ? `${documentType} actualizada exitosamente` : `${documentType} generada exitosamente`, 'success');
    }

    if (existingId) {
      // If we were editing from a popup, close after short delay or reset
      setTimeout(() => {
        window.close();
      }, 1000);
      return;
    }

    // Reset Form for next emission (Do not close the window automatically)
    setExistingId(null);
    setInvoiceNumber('');
    setItems([]);
    setClientRif('');
    setClientName('');
    setAgenteViajes('');
    setEmisionPropiaAliado(false);
    setProviderRif('');
    setProviderName('');
    setObservaciones('');
    setPaxList([{ nombre: '', cedula: '', telefono: '' }]);
  };

  const handleCloseWindow = () => {
    window.close();
  };

  return (
    <div className="bg-slate-100 min-h-screen px-3 sm:px-6 pt-1 pb-8">
      <div className="max-w-[1500px] mx-auto space-y-4">
        
        {/* Header Fixed */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Emisión de Producto / Servicio
              </h1>
              <p className="text-sm text-slate-500 font-medium mt-0.5">
                Generar nuevo documento operativo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <BackButton onClick={handleCloseWindow} label="Cerrar / Volver" />
            <button
              onClick={handleSaveInvoice}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md shadow-emerald-500/25 active:scale-95"
            >
              <Send className="w-4 h-4" />
              <span>Generar Documento</span>
            </button>
          </div>
        </div>

        {/* BLOQUE SUPERIOR CONTINUO: DATOS DEL DOCUMENTO */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" /> Datos del Documento
          </h3>
          
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tipo</label>
              <select 
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none"
                value={documentType}
                onChange={e => setDocumentType(e.target.value)}
              >
                <option>Emisión</option>
                <option>Nota de Débito</option>
                <option>Nota de Entrega</option>
              </select>
            </div>

            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">N° Tripplanners</label>
              <input autoComplete="new-password" 
                type="text" 
                placeholder="Ingrese N°"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Fecha de Emisión</label>
              <input autoComplete="new-password" 
                type="date" 
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>

            <div className="flex-[1.5] min-w-[180px]">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Moneda</label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {['USD', 'VES', 'EUR'].map(curr => (
                  <button
                    key={curr}
                    onClick={() => setCurrency(curr)}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                      currency === curr ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>

            {currency === 'VES' && (
              <div className="flex-1 min-w-[120px] animate-in fade-in slide-in-from-top-2">
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Tasa (Bs/USD)</label>
                <input autoComplete="new-password" 
                  type="number" 
                  step="0.01"
                  min="0"
                  value={tasaCambio}
                  onChange={e => setTasaCambio(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50 rounded-xl text-sm font-mono focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* BLOQUE INFERIOR DIVIDIDO: IZQUIERDA (CLIENTE/PAX) Y DERECHA (SERVICIOS) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LADO IZQUIERDO */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Card: Aliado / Cliente */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-emerald-600" /> Aliado / Cliente
                </h3>
                <button 
                  onClick={() => setIsClientModalOpen(true)}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md transition-colors"
                >
                  Buscar
                </button>
              </div>
              
              {clientRif ? (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="font-bold text-slate-800 text-sm">{clientName}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">RIF/CI: {clientRif}</div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 border-dashed text-center">
                  <p className="text-sm font-bold text-slate-500">Ningún aliado asignado</p>
                </div>
              )}

              {/* Sección Agente de Viajes Responsable */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Agente de Viajes *</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] font-semibold text-slate-600 hover:text-emerald-700">
                    <input
                      type="checkbox"
                      checked={emisionPropiaAliado}
                      onChange={(e) => {
                        const isPropia = e.target.checked;
                        setEmisionPropiaAliado(isPropia);
                        if (isPropia) setAgenteViajes('');
                      }}
                      className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                    />
                    <span>El aliado emite por sí mismo</span>
                  </label>
                </div>

                {emisionPropiaAliado ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-xs flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold block text-[11px]">Emisión Propia del Aliado (Sin Agente)</span>
                      <span className="text-[10px] text-amber-700">Autogestión directa del aliado sin intermediación de agente.</span>
                    </div>
                  </div>
                ) : (
                  <select
                    value={agenteViajes}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__EMISION_ALIADO__') {
                        setEmisionPropiaAliado(true);
                        setAgenteViajes('');
                      } else {
                        setEmisionPropiaAliado(false);
                        setAgenteViajes(val);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-emerald-600 outline-none cursor-pointer"
                  >
                    <option value="">-- Seleccionar Agente de Viajes --</option>
                    <option value="__EMISION_ALIADO__">🏢 Emisión Propia del Aliado (Sin Agente)</option>
                    {travelAgents.map(ag => (
                      <option key={ag.id} value={ag.name}>
                        {ag.name} {ag.taxId ? `(${ag.taxId})` : ''} {ag.terminalAgente ? `• GDS: ${ag.terminalAgente}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Card: Pasajeros (PAX) */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" /> Datos de Pasajeros (PAX)
                </h3>
                <button 
                  onClick={addPax}
                  className="text-[10px] uppercase tracking-wider text-white bg-slate-800 hover:bg-slate-900 px-2 py-1 rounded-md font-bold transition-colors shadow-sm"
                >
                  + Añadir
                </button>
              </div>
              
              <div className="space-y-4">
                {paxList.map((pax, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-2xl p-3 border border-slate-100 relative group">
                    <div className="absolute top-2 left-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {idx === 0 ? 'Pax Principal' : `Acompañante ${idx}`}
                      </span>
                    </div>
                    {paxList.length > 1 && (
                      <button 
                        onClick={() => removePax(idx)}
                        className="absolute top-2 right-2 p-0.5 text-slate-300 hover:text-rose-500 rounded hover:bg-rose-50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    
                    <div className="mt-5 space-y-2.5">
                      <div>
                        <input autoComplete="new-password" 
                          type="text"
                          placeholder="Nombre Completo"
                          value={pax.nombre}
                          onChange={(e) => updatePax(idx, 'nombre', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500 bg-white"
                        />
                      </div>
                      {idx === 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <input autoComplete="new-password" 
                              type="text"
                              placeholder="Cédula"
                              value={pax.cedula}
                              onChange={(e) => updatePax(idx, 'cedula', e.target.value)}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 bg-white"
                            />
                          </div>
                          <div>
                            <input autoComplete="new-password" 
                              type="tel"
                              placeholder="Teléfono (+58 414...)"
                              value={pax.telefono}
                              onChange={(e) => updatePax(idx, 'telefono', e.target.value)}
                              onBlur={(e) => {
                                if (pax.telefono) {
                                  updatePax(idx, 'telefono', formatPhoneNumber(pax.telefono));
                                }
                              }}
                              className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs outline-none focus:border-emerald-500 bg-white font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* LADO DERECHO: Detalle de Servicios */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs h-full flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-emerald-600" /> Detalle de Servicios (Líneas)
                </h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowCosto(!showCosto)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition-colors"
                  >
                    {showCosto ? 'Ocultar Costo' : 'Aplicar Costo'}
                  </button>
                  <button 
                    onClick={() => setIsItemModalOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Servicio
                  </button>
                </div>
              </div>

              <div className="flex-1 border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3 w-[45%]">Servicio / Concepto</th>
                      <th className="px-3 py-3 w-[25%] text-center">Fechas & Cantidad</th>
                      {showCosto && <th className="px-2 py-3 w-[15%] text-right">Costo</th>}
                      <th className="px-2 py-3 text-right">Precio</th>
                      <th className="py-3 pr-3 w-6 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={showCosto ? 5 : 4} className="py-12 text-center bg-white">
                          <Tag className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                          <p className="text-sm font-bold text-slate-400">Sin líneas de servicio</p>
                        </td>
                      </tr>
                    ) : (
                      items.map((item, index) => (
                        <tr key={index} className="bg-white hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 align-top">
                            <div className="font-bold text-slate-800 text-sm">{item.nombre}</div>
                            <div className="text-[10px] font-mono text-slate-400 mb-1.5">{item.codigo}</div>
                            
                            {/* Proveedor / Operador por Servicio (Búsqueda por Lupa) */}
                            <div className="mt-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between mb-0.5">
                                <span className="flex items-center gap-1 text-slate-700">
                                  <Building2 className="w-3 h-3 text-emerald-600" /> Proveedor / Operador *
                                </span>
                                {item.proveedorRif && (
                                  <span className="text-[9px] font-mono text-slate-400">RIF: {item.proveedorRif}</span>
                                )}
                              </label>
                              <div className="flex items-center gap-1 mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveItemIndexForProvider(index);
                                    setProviderSearchTerm('');
                                    setIsProviderModalOpen(true);
                                  }}
                                  className={`w-full px-2.5 py-1.5 text-xs border rounded-lg flex items-center justify-between text-left transition-colors cursor-pointer group ${
                                    item.proveedorNombre 
                                      ? 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 text-slate-800' 
                                      : 'border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-emerald-400 text-slate-400'
                                  }`}
                                  title="Buscar proveedor con la lupa"
                                >
                                  <div className="truncate pr-1">
                                    {item.proveedorNombre ? (
                                      <span className="font-bold text-slate-800 text-xs truncate block">
                                        {item.proveedorNombre}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-xs italic">Buscar proveedor...</span>
                                    )}
                                  </div>
                                  <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                                </button>
                                {item.proveedorNombre && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleItemChange(index, 'proveedorId', '');
                                      handleItemChange(index, 'proveedorNombre', '');
                                      handleItemChange(index, 'proveedorRif', '');
                                    }}
                                    className="p-1.5 border border-slate-200 hover:border-rose-300 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors shrink-0 cursor-pointer"
                                    title="Quitar proveedor asignado"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-col gap-1.5 max-w-[190px] mx-auto">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 w-8">DEL:</span>
                                <input autoComplete="new-password" 
                                  type="date" 
                                  value={item.fechaDesde}
                                  onChange={(e) => handleItemChange(index, 'fechaDesde', e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded outline-none focus:border-emerald-500 bg-white"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 w-8">AL:</span>
                                <input autoComplete="new-password" 
                                  type="date" 
                                  value={item.fechaHasta}
                                  onChange={(e) => handleItemChange(index, 'fechaHasta', e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded outline-none focus:border-emerald-500 bg-white"
                                />
                              </div>
                              <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-slate-100">
                                <span className="text-[10px] font-bold text-indigo-600">
                                  {getDurationText(item.fechaDesde, item.fechaHasta)}
                               </span>
                               <div className="flex items-center gap-1.5">
                                 <span className="text-[9px] font-bold text-slate-400">CANT/DÍAS:</span>
                                 <input autoComplete="new-password" 
                                   type="number" 
                                   min="1"
                                   value={item.dias}
                                   onChange={(e) => handleItemChange(index, 'dias', e.target.value)}
                                   className="w-12 px-1 py-0.5 text-center border border-slate-200 rounded text-xs outline-none focus:border-emerald-500 font-mono bg-white"
                                 />
                               </div>
                              </div>
                            </div>
                          </td>
                          {showCosto && (
                            <td className="px-2 py-3 align-top">
                              <div className="w-full max-w-[130px] ml-auto">
                                <input autoComplete="new-password" 
                                  type="text"
                                  value={item.costoFormatted !== undefined ? item.costoFormatted : formatNumberDisplay(item.costo)}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const { formatted, numeric } = formatLiveNumberInput(raw);
                                    handleItemChange(index, 'costoFormatted', formatted);
                                    handleItemChange(index, 'costo', numeric);
                                  }}
                                  onBlur={() => {
                                    if (item.costoFormatted !== undefined) {
                                      handleItemChange(index, 'costoFormatted', undefined);
                                    }
                                  }}
                                  placeholder="0,00"
                                  className="w-full px-2 py-1 text-right border border-slate-200 rounded text-sm outline-none focus:border-emerald-500 font-mono"
                                />
                              </div>
                            </td>
                          )}
                          <td className="px-2 py-3 align-top">
                            <div className="w-full max-w-[130px] ml-auto">
                              <input autoComplete="new-password" 
                                type="text"
                                value={item.precioFormatted !== undefined ? item.precioFormatted : formatNumberDisplay(item.precio)}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const { formatted, numeric } = formatLiveNumberInput(raw);
                                  handleItemChange(index, 'precioFormatted', formatted);
                                  handleItemChange(index, 'precio', numeric);
                                }}
                                onBlur={() => {
                                  if (item.precioFormatted !== undefined) {
                                    handleItemChange(index, 'precioFormatted', undefined);
                                  }
                                }}
                                placeholder="0,00"
                                className="w-full px-2 py-1 text-right border border-emerald-300 bg-emerald-50 rounded text-sm outline-none focus:border-emerald-500 font-mono text-emerald-900 font-bold"
                              />
                            </div>
                          </td>
                          
                          <td className="py-3 pr-3 align-top text-right pt-3">
                            <button 
                              onClick={() => handleRemoveItem(index)}
                              className="p-1 text-slate-300 hover:text-rose-500 rounded-md hover:bg-rose-50 transition-colors inline-flex items-center justify-center"
                              title="Eliminar línea"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals & Notes Box */}
              <div className="mt-5 border border-slate-200 rounded-2xl bg-slate-50 p-5 flex flex-col md:flex-row justify-between gap-6">
                <div className="flex-1 flex flex-col">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Observaciones</label>
                  <textarea 
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Ej: Habitación matrimonial, con desayunos incluidos..."
                    className="flex-1 w-full min-h-[80px] px-3 py-2 text-xs border border-slate-300 rounded-xl outline-none focus:border-emerald-500 resize-none bg-white placeholder-slate-400"
                  />
                </div>
                <div className="flex flex-col gap-2 w-full max-w-xs shrink-0">
                  <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formatMoney(totals.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                    <span>IVA ({taxType === 'G' ? '16%' : '8%'}):</span>
                    <span className="font-mono">{formatMoney(totals.iva)}</span>
                  </div>
                  {applyIGTF && currency === 'USD' && (
                    <div className="flex justify-between items-center text-sm font-medium text-amber-700">
                      <span>IGTF (3%):</span>
                      <span className="font-mono">{formatMoney(totals.igtf)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 my-2 pt-3 flex justify-between items-center">
                    <span className="text-lg font-black text-slate-800">Total {currency}:</span>
                    <span className="text-2xl font-black font-mono text-emerald-600">
                      {formatMoney(totals.total)}
                    </span>
                  </div>
                  {currency === 'VES' && (
                    <div className="flex justify-between items-center text-xs font-bold text-slate-400 mt-1">
                      <span>Equivalente USD Aprox:</span>
                      <span className="font-mono">
                        $ {((totals.total) / (tasaCambio || 1)).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SUB-MODALS (z-[60]) */}
      
      {/* Modal Seleccionar Proveedor */}
      {isProviderModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Seleccionar Proveedor / Operador</h3>
              <button onClick={() => setIsProviderModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input autoComplete="new-password" 
                  type="text" 
                  value={providerSearchTerm}
                  onChange={e => setProviderSearchTerm(e.target.value)}
                  placeholder="Buscar RIF o Nombre..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {filteredProviders.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">No se encontraron proveedores.</div>
              ) : (
                filteredProviders.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => handleSelectProvider(p)}
                    className="w-full text-left p-3 hover:bg-slate-50 rounded-xl flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-slate-800 text-sm group-hover:text-emerald-700">{p.name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{p.taxId}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Seleccionar Cliente */}
      {isClientModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Seleccionar Aliado / Cliente</h3>
              <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input autoComplete="new-password" 
                  type="text" 
                  value={clientSearchTerm}
                  onChange={e => setClientSearchTerm(e.target.value)}
                  placeholder="Buscar RIF o Nombre..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {filteredClients.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">No se encontraron clientes.</div>
              ) : (
                filteredClients.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => handleSelectClient(c)}
                    className="w-full text-left p-3 hover:bg-slate-50 rounded-xl flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-bold text-slate-800 text-sm group-hover:text-emerald-700">{c.name}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{c.taxId}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Seleccionar Artículo */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Seleccionar Servicio del Catálogo</h3>
              <button onClick={() => setIsItemModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input autoComplete="new-password" 
                  type="text" 
                  value={itemSearchTerm}
                  onChange={e => setItemSearchTerm(e.target.value)}
                  placeholder="Buscar por código o nombre..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {filteredArticulos.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">No se encontraron servicios.</div>
              ) : (
                filteredArticulos.map(a => (
                  <button 
                    key={a.id} 
                    onClick={() => handleSelectItem(a)}
                    className="w-full text-left p-3 hover:bg-slate-50 rounded-xl flex items-start gap-3 group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <Tag className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm group-hover:text-emerald-700">{a.nombre}</div>
                      <div className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 inline-block mt-1">{a.codigo}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
