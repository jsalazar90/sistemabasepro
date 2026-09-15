import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Search, Plus, Building2, User, Users, Mail, Phone, MapPin, 
  Edit2, X, BookOpen, Briefcase, ShieldCheck, Truck, Trash2,
  LayoutGrid, List, CheckCircle2, AlertTriangle
} from 'lucide-react';
import CuentaContableModal from '../components/common/CuentaContableModal';
import CuentaSelectorTrigger from '../components/common/CuentaSelectorTrigger';
import BackButton from '../components/common/BackButton';
import { useCompany } from '../context/CompanyContext';

export type ContactType = 
  | 'customer' 
  | 'supplier' 
  | 'employee' 
  | 'empleados' 
  | 'intercompany' 
  | 'shareholder' 
  | 'both' 
  | 'aliados' 
  | 'freelance';

export interface Contact {
  id: string;
  empresa_id?: string;
  name: string;
  type: ContactType;
  taxId: string;
  email?: string;
  phone?: string;
  address?: string;
  isCompany?: boolean;
  personaContacto?: string;
  cargo?: string;
  debitAccount?: string;
  creditAccount?: string;
  expenseAccount?: string;
  vendedor?: string;
  employeeType?: string;
  comisionPorcentaje?: number;
}

export default function Contacts({ 
  contactos = [], 
  cuentasContables = [], 
  onSave, 
  showToast 
}: { 
  contactos?: Contact[]; 
  cuentasContables?: any[]; 
  onSave?: (collection: string, data: any) => void; 
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void; 
}) {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { activeCompanyId } = useCompany();

  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [natureFilter, setNatureFilter] = useState<'all' | 'companies' | 'individuals'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Estado del modal de crear / editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'info' | 'contabilidad'>('info');

  // Selector de cuentas contables
  const [showCuentaModal, setShowCuentaModal] = useState(false);
  const [activeAccountKey, setActiveAccountKey] = useState<'debitAccount' | 'creditAccount' | null>(null);
  const [accountValidationError, setAccountValidationError] = useState<string | null>(null);

  // Formulario de registro unificado
  const [contactForm, setContactForm] = useState({
    type: 'customer',
    isCompany: true,
    name: '',
    taxIdPrefix: 'J',
    taxIdNumber: '',
    taxId: '',
    email: '',
    phone: '',
    address: '',
    personaContacto: '',
    cargo: '',
    debitAccount: '',
    creditAccount: ''
  });

  // Helper para resolver el código y la descripción de la cuenta contable
  const getAccountDetail = (idOrCode?: string) => {
    if (!idOrCode) return null;
    const cleanId = String(idOrCode).trim();
    const found = cuentasContables.find(
      c => String(c.id).trim() === cleanId || String(c.codigo).trim() === cleanId
    );
    if (found) {
      return {
        codigo: found.codigo || '',
        nombre: found.nombre || found.descripcion || '',
        fullDisplay: `${found.codigo ? found.codigo + ' - ' : ''}${found.nombre || found.descripcion || ''}`
      };
    }
    return {
      codigo: cleanId.length > 15 ? cleanId.substring(0, 8) + '...' : cleanId,
      nombre: cleanId.length > 20 ? cleanId.substring(0, 18) + '...' : cleanId,
      fullDisplay: cleanId
    };
  };

  // Detectar la categoría activa a partir de la URL
  useEffect(() => {
    if (type) {
      if (type === 'customer' || type === 'clientes' || type === 'aliados' || type === 'freelance') {
        setActiveFilter('customer');
      } else if (type === 'supplier') {
        setActiveFilter('supplier');
      } else if (type === 'empleados' || type === 'employee') {
        setActiveFilter('empleados');
      } else if (type === 'intercompany') {
        setActiveFilter('intercompany');
      } else if (type === 'shareholder') {
        setActiveFilter('shareholder');
      } else {
        setActiveFilter('all');
      }
    } else {
      setActiveFilter('all');
    }
  }, [type]);

  // Configuración de texto, tema e iconos según el submódulo activo
  const moduleConfig = useMemo(() => {
    switch (activeFilter) {
      case 'customer':
        return {
          title: 'Directorio de Clientes',
          singular: 'Cliente',
          subtitle: 'Gestión integral de clientes comerciales, personas jurídicas y naturales',
          icon: Users,
          gradient: 'from-blue-600 to-indigo-700',
          shadow: 'shadow-blue-500/20',
          badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
          debitLabel: 'Cuenta por Cobrar (Débito)',
          creditLabel: 'Cuenta de Anticipo / Ingreso (Crédito)',
          accountHelp: 'Asocia las cuentas contables automáticas para la facturación y cobranzas de este cliente.'
        };
      case 'supplier':
        return {
          title: 'Directorio de Proveedores',
          singular: 'Proveedor',
          subtitle: 'Gestión de proveedores comerciales, compras de insumos y servicios generales',
          icon: Truck,
          gradient: 'from-rose-500 to-orange-500',
          shadow: 'shadow-rose-500/20',
          badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
          debitLabel: 'Cuenta de Gasto / Compras (Débito)',
          creditLabel: 'Cuenta por Pagar (Crédito)',
          accountHelp: 'Asocia las cuentas contables automáticas para el registro de facturas de compras y pagos.'
        };
      case 'empleados':
        return {
          title: 'Directorio de Empleados',
          singular: 'Empleado',
          subtitle: 'Personal administrativo, nómina y colaboradores generales',
          icon: Briefcase,
          gradient: 'from-teal-500 to-emerald-600',
          shadow: 'shadow-teal-500/20',
          badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
          debitLabel: 'Cuenta de Anticipos / Préstamos (Débito)',
          creditLabel: 'Cuenta por Pagar Nómina / Sueldos (Crédito)',
          accountHelp: 'Asocia las cuentas contables para anticipos, deducciones y pagos de nómina del empleado.'
        };
      case 'intercompany':
        return {
          title: 'Directorio de Intercompañías',
          singular: 'Intercompañía',
          subtitle: 'Control de empresas filiales, sucursales y operaciones corporativas internas',
          icon: Building2,
          gradient: 'from-amber-500 to-orange-500',
          shadow: 'shadow-amber-500/20',
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
          debitLabel: 'Cuenta por Cobrar Intercompañía (Débito)',
          creditLabel: 'Cuenta por Pagar Intercompañía (Crédito)',
          accountHelp: 'Asocia las cuentas contables para movimientos bilaterales entre filiales y sucursales.'
        };
      case 'shareholder':
        return {
          title: 'Directorio de Accionistas',
          singular: 'Accionista',
          subtitle: 'Control de socios, aportes de capital, directivos y cuentas patrimoniales',
          icon: ShieldCheck,
          gradient: 'from-emerald-500 to-teal-600',
          shadow: 'shadow-emerald-500/20',
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          debitLabel: 'Cuenta de Retiros / Préstamos a Socios (Débito)',
          creditLabel: 'Cuenta por Pagar a Accionistas / Aportes (Crédito)',
          accountHelp: 'Asocia las cuentas contables para aportes de capital, dividendos o préstamos de socios.'
        };
      default:
        return {
          title: 'Directorio de Contactos',
          singular: 'Contacto',
          subtitle: 'Directorio empresarial centralizado de cuentas y contrapartes',
          icon: Users,
          gradient: 'from-slate-700 to-slate-900',
          shadow: 'shadow-slate-500/20',
          badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
          debitLabel: 'Cuenta de Débito (Activo / Gasto)',
          creditLabel: 'Cuenta de Crédito (Pasivo / Ingreso)',
          accountHelp: 'Asocia cuentas contables específicas para la contabilización automática de este contacto.'
        };
    }
  }, [activeFilter]);

  // Filtrado de contactos según el módulo activo y filtros secundarios
  const filteredContacts = useMemo(() => {
    return contactos.filter(contact => {
      // 1. Filtro por tipo de submódulo
      let matchesType = true;
      if (activeFilter === 'customer') {
        matchesType = contact.type === 'customer' || contact.type === 'both' || contact.type === 'aliados' || contact.type === 'freelance';
      } else if (activeFilter === 'supplier') {
        matchesType = contact.type === 'supplier' || contact.type === 'both';
      } else if (activeFilter === 'empleados') {
        matchesType = contact.type === 'empleados' || contact.type === 'employee';
      } else if (activeFilter === 'intercompany') {
        matchesType = contact.type === 'intercompany';
      } else if (activeFilter === 'shareholder') {
        matchesType = contact.type === 'shareholder';
      }

      if (!matchesType) return false;

      // 2. Filtro de naturaleza (Empresa vs Persona Natural)
      if (natureFilter === 'companies' && contact.isCompany === false) return false;
      if (natureFilter === 'individuals' && contact.isCompany !== false) return false;

      // 3. Filtro de búsqueda
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        (contact.name || '').toLowerCase().includes(q) ||
        (contact.taxId || '').toLowerCase().includes(q) ||
        (contact.email || '').toLowerCase().includes(q) ||
        (contact.phone || '').toLowerCase().includes(q) ||
        (contact.personaContacto || '').toLowerCase().includes(q) ||
        (contact.address || '').toLowerCase().includes(q)
      );
    });
  }, [contactos, activeFilter, natureFilter, searchQuery]);

  // Apertura del modal para crear un nuevo contacto
  const handleOpenCreateModal = () => {
    setEditingContactId(null);
    const defaultType = activeFilter === 'all' ? 'customer' : activeFilter;
    const isEmployee = defaultType === 'empleados' || defaultType === 'employee';

    setContactForm({
      type: defaultType,
      isCompany: isEmployee ? false : true,
      name: '',
      taxIdPrefix: isEmployee ? 'V' : 'J',
      taxIdNumber: '',
      taxId: '',
      email: '',
      phone: '',
      address: '',
      personaContacto: '',
      cargo: '',
      debitAccount: '',
      creditAccount: ''
    });
    setActiveModalTab('info');
    setAccountValidationError(null);
    setIsModalOpen(true);
  };

  // Apertura del modal para editar un contacto existente
  const handleOpenEditModal = (contact: Contact) => {
    setEditingContactId(contact.id);

    // Separar prefijo y número de RIF / Cédula
    let prefix = 'J';
    let number = contact.taxId || '';
    if (number.includes('-')) {
      const parts = number.split('-');
      prefix = parts[0];
      number = parts.slice(1).join('-');
    } else if (/^[JVGEPCjvgepc]/.test(number)) {
      prefix = number.charAt(0).toUpperCase();
      number = number.slice(1);
    }

    setContactForm({
      type: contact.type,
      isCompany: contact.isCompany !== false,
      name: contact.name || '',
      taxIdPrefix: prefix,
      taxIdNumber: number,
      taxId: contact.taxId || '',
      email: contact.email || '',
      phone: contact.phone || '',
      address: contact.address || '',
      personaContacto: contact.personaContacto || '',
      cargo: contact.cargo || '',
      debitAccount: contact.debitAccount || '',
      creditAccount: contact.creditAccount || ''
    });
    setActiveModalTab('info');
    setAccountValidationError(null);
    setIsModalOpen(true);
  };

  // Guardar contacto (Crear o Actualizar)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim()) {
      showToast?.('El nombre o razón social es obligatorio', 'error');
      return;
    }

    // Validación obligatoria de cuentas contables vinculadas manualmente
    if (!contactForm.debitAccount?.trim() || !contactForm.creditAccount?.trim()) {
      setActiveModalTab('contabilidad');
      const msg = !contactForm.debitAccount?.trim() && !contactForm.creditAccount?.trim()
        ? 'Debe vincular las cuentas contables de forma manual antes de registrar el contacto'
        : !contactForm.debitAccount?.trim()
          ? `Debe vincular la ${moduleConfig.debitLabel} de forma manual`
          : `Debe vincular la ${moduleConfig.creditLabel} de forma manual`;
      setAccountValidationError(msg);
      showToast?.(msg, 'error');
      return;
    }

    const fullTaxId = contactForm.taxIdNumber.trim()
      ? `${contactForm.taxIdPrefix}-${contactForm.taxIdNumber.trim().toUpperCase()}`
      : contactForm.taxId.trim();

    const contactData: Contact = {
      id: editingContactId || crypto.randomUUID(),
      empresa_id: activeCompanyId,
      name: contactForm.name.trim(),
      type: (contactForm.type === 'clientes' ? 'customer' : contactForm.type) as ContactType,
      taxId: fullTaxId,
      email: contactForm.email.trim(),
      phone: contactForm.phone.trim(),
      address: contactForm.address.trim(),
      isCompany: contactForm.isCompany,
      personaContacto: contactForm.personaContacto.trim(),
      cargo: contactForm.cargo.trim(),
      debitAccount: contactForm.debitAccount,
      creditAccount: contactForm.creditAccount
    };

    if (onSave) {
      onSave('contactos', contactData);
      showToast?.(
        editingContactId ? 'Registro actualizado exitosamente' : 'Registro creado exitosamente',
        'success'
      );
    }

    setIsModalOpen(false);
  };

  // Eliminar contacto
  const handleDeleteContact = (contact: Contact) => {
    if (window.confirm(`¿Está seguro de que desea eliminar el registro de "${contact.name}"?`)) {
      if (onSave) {
        onSave('contactos', { id: contact.id, _delete: true });
        showToast?.('Registro eliminado del directorio', 'info');
      }
    }
  };

  // Selector de cuentas contables
  const handleOpenCuentaModal = (key: 'debitAccount' | 'creditAccount') => {
    setActiveAccountKey(key);
    setShowCuentaModal(true);
  };

  const handleSelectCuenta = (cuenta: any) => {
    if (activeAccountKey && cuenta) {
      setContactForm(prev => ({ ...prev, [activeAccountKey]: cuenta.id }));
      setAccountValidationError(null);
    }
    setShowCuentaModal(false);
    setActiveAccountKey(null);
  };

  const HeaderIcon = moduleConfig.icon;

  return (
    <div className="px-3 sm:px-6 pt-1 pb-10 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Botón Volver al Menú de Contactos */}
      <div className="mb-3">
        <BackButton to="/contacts" label="Volver al Directorio" />
      </div>

      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${moduleConfig.gradient} shadow-md ${moduleConfig.shadow} flex items-center justify-center text-white shrink-0`}>
            <HeaderIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              {moduleConfig.title}
            </h1>
            <p className="text-slate-500 mt-0.5 text-xs sm:text-sm font-medium">
              {moduleConfig.subtitle}
            </p>
          </div>
        </div>

        <button 
          onClick={handleOpenCreateModal}
          className="btn-primary text-xs sm:text-sm py-2.5 px-4 shadow-sm hover:shadow-md cursor-pointer flex items-center gap-2"
        >
          <Plus size={16} />
          <span>Nuevo {moduleConfig.singular}</span>
        </button>
      </div>

      {/* Barra de Control: Búsqueda + Filtro Naturaleza + Contador + Modo de Vista */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs mb-6 flex flex-col md:flex-row justify-between items-center gap-3">
        {/* Input Buscador */}
        <div className="relative w-full md:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, RIF, teléfono, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filtros de Naturaleza */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            type="button"
            onClick={() => setNatureFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              natureFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setNatureFilter('companies')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              natureFilter === 'companies'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Empresas (Jurídicas)
          </button>
          <button
            type="button"
            onClick={() => setNatureFilter('individuals')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              natureFilter === 'individuals'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Personas Naturales
          </button>
        </div>

        {/* Contador y View Mode Toggle */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl whitespace-nowrap">
            {filteredContacts.length} {filteredContacts.length === 1 ? 'registro' : 'registros'}
          </span>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista de Tarjetas"
            >
              <LayoutGrid size={14} />
              <span>Tarjetas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista de Tabla"
            >
              <List size={14} />
              <span>Tabla</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      {filteredContacts.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-3xl border border-dashed border-slate-200 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
            <HeaderIcon size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">
            No se encontraron registros en {moduleConfig.title}
          </h3>
          <p className="text-slate-500 text-xs max-w-sm mx-auto mb-4">
            {searchQuery
              ? 'No hay registros que coincidan con la búsqueda realizada.'
              : `Aún no hay ${moduleConfig.singular.toLowerCase()}s registrados en esta empresa.`}
          </p>
          <button 
            onClick={handleOpenCreateModal}
            className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} />
            <span>Crear Primer {moduleConfig.singular}</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ============================================================== */
        /* VISTA DE TARJETAS (GRID) */
        /* ============================================================== */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredContacts.map(contact => {
            return (
              <div 
                key={contact.id} 
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 transition-all p-4.5 group flex flex-col justify-between"
              >
                <div>
                  {/* Top Header Card */}
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                        contact.isCompany !== false
                          ? 'bg-blue-50 text-blue-600 border border-blue-200'
                          : 'bg-teal-50 text-teal-600 border border-teal-200'
                      }`}>
                        {contact.isCompany !== false ? <Building2 size={19} /> : <User size={19} />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-indigo-600 transition-colors" title={contact.name}>
                          {contact.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {contact.taxId || 'S/R'}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {contact.isCompany !== false ? 'Jurídico' : 'Natural'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Acciones Rápidas */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => handleOpenEditModal(contact)}
                        className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteContact(contact)}
                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Datos de Contacto */}
                  <div className="space-y-1.5 my-3 text-xs text-slate-600 bg-slate-50/60 p-2.5 rounded-xl border border-slate-100">
                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate">{contact.phone}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={13} className="text-slate-400 shrink-0" />
                        <span className="truncate text-slate-500">{contact.email}</span>
                      </div>
                    )}
                    {contact.personaContacto && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <User size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate font-medium">
                          {contact.personaContacto} {contact.cargo ? `(${contact.cargo})` : ''}
                        </span>
                      </div>
                    )}
                    {contact.address && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{contact.address}</span>
                      </div>
                    )}
                    {!contact.phone && !contact.email && !contact.address && (
                      <p className="text-[11px] text-slate-400 italic">Sin datos de contacto adicionales</p>
                    )}
                  </div>
                </div>

                {/* Footer de Tarjeta con Mapeo Contable */}
                <div className="pt-2.5 border-t border-slate-100 text-[11px]">
                  {contact.debitAccount || contact.creditAccount ? (
                    <div className="space-y-1">
                      {contact.debitAccount && (() => {
                        const acc = getAccountDetail(contact.debitAccount);
                        return acc ? (
                          <div className="flex items-center gap-1.5 truncate" title={acc.fullDisplay}>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 shrink-0">D</span>
                            <span className="font-mono font-bold text-[10px] text-slate-800 shrink-0">{acc.codigo}</span>
                            <span className="text-[10px] text-slate-500 truncate font-medium">{acc.nombre}</span>
                          </div>
                        ) : null;
                      })()}
                      {contact.creditAccount && (() => {
                        const acc = getAccountDetail(contact.creditAccount);
                        return acc ? (
                          <div className="flex items-center gap-1.5 truncate" title={acc.fullDisplay}>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 shrink-0">C</span>
                            <span className="font-mono font-bold text-[10px] text-slate-800 shrink-0">{acc.codigo}</span>
                            <span className="text-[10px] text-slate-500 truncate font-medium">{acc.nombre}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic text-[10px]">Cuenta general predeterminada</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ============================================================== */
        /* VISTA DE TABLA (LIST) */
        /* ============================================================== */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-5 py-3.5">Nombre / Razón Social</th>
                  <th className="px-4 py-3.5">RIF / Identificación</th>
                  <th className="px-4 py-3.5">Naturaleza</th>
                  <th className="px-4 py-3.5">Contacto / Teléfono</th>
                  <th className="px-4 py-3.5">Enlace Contable</th>
                  <th className="px-4 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredContacts.map(contact => {
                  return (
                    <tr key={contact.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                            contact.isCompany !== false ? 'bg-blue-50 text-blue-600' : 'bg-teal-50 text-teal-600'
                          }`}>
                            {contact.isCompany !== false ? <Building2 size={15} /> : <User size={15} />}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{contact.name}</div>
                            {contact.address && <div className="text-[11px] text-slate-400 truncate max-w-xs">{contact.address}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-slate-700">
                        {contact.taxId || 'S/R'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {contact.isCompany !== false ? 'Persona Jurídica' : 'Persona Natural'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">{contact.personaContacto || contact.email || '—'}</div>
                        <div className="text-slate-500 font-mono text-[11px]">{contact.phone || '—'}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        {contact.debitAccount || contact.creditAccount ? (
                          <div className="space-y-1 max-w-[280px]">
                            {contact.debitAccount && (() => {
                              const acc = getAccountDetail(contact.debitAccount);
                              return acc ? (
                                <div className="flex items-center gap-1.5 text-[11px] truncate" title={acc.fullDisplay}>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 shrink-0">D</span>
                                  <span className="font-mono font-bold text-slate-800 shrink-0">{acc.codigo}</span>
                                  <span className="text-slate-600 truncate font-medium">{acc.nombre}</span>
                                </div>
                              ) : null;
                            })()}
                            {contact.creditAccount && (() => {
                              const acc = getAccountDetail(contact.creditAccount);
                              return acc ? (
                                <div className="flex items-center gap-1.5 text-[11px] truncate" title={acc.fullDisplay}>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 shrink-0">C</span>
                                  <span className="font-mono font-bold text-slate-800 shrink-0">{acc.codigo}</span>
                                  <span className="text-slate-600 truncate font-medium">{acc.nombre}</span>
                                </div>
                              ) : null;
                            })()}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Automática</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(contact)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(contact)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL UNIFICADO: CREAR / EDITAR CONTACTO */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            {/* Header Modal */}
            <div className={`px-6 py-4 border-b border-white/10 flex justify-between items-center bg-gradient-to-r ${moduleConfig.gradient} text-white`}>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white shadow-2xs">
                  <HeaderIcon size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black">
                    {editingContactId ? `Editar ${moduleConfig.singular}` : `Registrar Nuevo ${moduleConfig.singular}`}
                  </h2>
                  <p className="text-white/80 text-xs">Datos generales y configuración contable</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Pestañas del Formulario */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveModalTab('info')}
                className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                  activeModalTab === 'info'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <User size={14} />
                <span>1. Información General</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('contabilidad')}
                className={`pb-2.5 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
                  activeModalTab === 'contabilidad'
                    ? 'border-indigo-600 text-indigo-600 bg-white rounded-t-xl shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <BookOpen size={14} />
                <span>2. Enlace Contable</span>
                {(!contactForm.debitAccount || !contactForm.creditAccount) && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                    Requerido
                  </span>
                )}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 flex flex-col justify-between">
              <div className="p-6 space-y-4 flex-1">
                {/* PESTAÑA 1: INFORMACIÓN GENERAL */}
                {activeModalTab === 'info' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Selector de Naturaleza Jurídica */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Naturaleza Jurídica
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setContactForm(prev => ({ ...prev, isCompany: true, taxIdPrefix: 'J' }))}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                            contactForm.isCompany
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Building2 size={16} />
                          <span>Persona Jurídica (Empresa)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setContactForm(prev => ({ ...prev, isCompany: false, taxIdPrefix: 'V', personaContacto: '', cargo: '' }))}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition ${
                            !contactForm.isCompany
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
                          contactForm.isCompany 
                            ? 'Ej: Inversiones Globales C.A.' 
                            : 'Ej: Juan Alberto Pérez'
                        }
                        value={contactForm.name}
                        onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
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
                          value={contactForm.taxIdPrefix}
                          onChange={(e) => setContactForm(prev => ({ ...prev, taxIdPrefix: e.target.value }))}
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
                          value={contactForm.taxIdNumber}
                          onChange={(e) => setContactForm(prev => ({ ...prev, taxIdNumber: e.target.value }))}
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
                            value={contactForm.email}
                            onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
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
                            value={contactForm.phone}
                            onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none" 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Persona de Contacto & Cargo (Solo visible para Persona Jurídica / Empresa) */}
                    {contactForm.isCompany && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Persona de Contacto</label>
                          <input 
                            type="text" 
                            placeholder="Nombre del responsable"
                            value={contactForm.personaContacto}
                            onChange={(e) => setContactForm(prev => ({ ...prev, personaContacto: e.target.value }))}
                            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none" 
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">Cargo o Departamento</label>
                          <input 
                            type="text" 
                            placeholder="Ej: Gerente de Compras / Administración"
                            value={contactForm.cargo}
                            onChange={(e) => setContactForm(prev => ({ ...prev, cargo: e.target.value }))}
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
                        value={contactForm.address}
                        onChange={(e) => setContactForm(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-indigo-600 outline-none resize-none h-16" 
                      />
                    </div>
                  </div>
                )}

                {/* PESTAÑA 2: ENLACE CONTABLE */}
                {activeModalTab === 'contabilidad' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Aviso si faltan vincular cuentas contables */}
                    {accountValidationError && (
                      <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-bold animate-in fade-in duration-200">
                        <AlertTriangle size={18} className="shrink-0 text-rose-600" />
                        <span>{accountValidationError}</span>
                      </div>
                    )}

                    <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200/80">
                      <div className="flex items-start gap-2.5 text-amber-900">
                        <AlertTriangle size={17} className="shrink-0 mt-0.5 text-amber-600" />
                        <div>
                          <p className="text-xs font-bold text-amber-950">Vinculación Contable Obligatoria *</p>
                          <p className="text-[11px] text-amber-800/90 font-medium mt-0.5 leading-relaxed">
                            {moduleConfig.accountHelp} Debe vincular manualmente las cuentas contables de <b>{moduleConfig.debitLabel}</b> y <b>{moduleConfig.creditLabel}</b> para registrar el contacto.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className={!contactForm.debitAccount ? 'ring-2 ring-amber-400 rounded-2xl p-0.5' : ''}>
                        <CuentaSelectorTrigger
                          label={`${moduleConfig.debitLabel} *`}
                          value={contactForm.debitAccount}
                          cuentasContables={cuentasContables}
                          onClick={() => handleOpenCuentaModal('debitAccount')}
                        />
                      </div>

                      <div className={!contactForm.creditAccount ? 'ring-2 ring-amber-400 rounded-2xl p-0.5' : ''}>
                        <CuentaSelectorTrigger
                          label={`${moduleConfig.creditLabel} *`}
                          value={contactForm.creditAccount}
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
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-primary text-xs py-2 px-5 shadow-sm cursor-pointer"
                >
                  {editingContactId ? 'Guardar Cambios' : `Registrar ${moduleConfig.singular}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Selector de Cuentas Contables */}
      {showCuentaModal && (
        <CuentaContableModal
          isOpen={showCuentaModal}
          onClose={() => setShowCuentaModal(false)}
          onSelect={handleSelectCuenta}
          cuentasContables={cuentasContables}
          title={activeAccountKey === 'debitAccount' ? moduleConfig.debitLabel : moduleConfig.creditLabel}
        />
      )}
    </div>
  );
}
