import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, FileSpreadsheet, Receipt, Percent, Save, Upload, Settings as SettingsIcon, 
  Database, UploadCloud, Download, FileJson, FileText, CheckCircle2, Users, Plus, 
  Key, X, Search, Trash2, Shield, Filter, UserCheck, UserX, Hash, ArrowLeft, 
  ChevronRight, Coins, HelpCircle, Info, Layers, Scale, Briefcase, 
  ShieldAlert, AlertTriangle, Check, BookOpen, Sparkles, Globe, RefreshCw,
  Lock, Eye, EyeOff, KeyRound, MapPin, Truck, FolderArchive, Calendar, ShieldCheck
} from 'lucide-react';
import BulkUploadConfig from '../components/settings/BulkUploadConfig';
import { useCompany } from '../context/CompanyContext';
import CuentaContableModal from '../components/common/CuentaContableModal';
import BackButton from '../components/common/BackButton';
import { AuditLogsViewer } from '../components/settings/AuditLogsViewer';
import { formatCorrelativo, formatDocumentNumber } from '../utils/numberFormat';
import { 
  APP_VERSION, 
  APP_NAME, 
  APP_EDITION, 
  APP_CODENAME, 
  APP_BUILD_DATE, 
  APP_BUILD_NUMBER, 
  getFullVersionString 
} from '../config/version';
import { 
  dbSaveEmpresa, 
  dbDeleteEmpresa,
  dbFetchUsuarios,
  dbSaveUsuario,
  dbDeleteUsuario,
  dbFetchUsuarioEmpresas,
  dbSaveUsuarioEmpresa,
  dbDeleteUsuarioEmpresa,
  dbSaveConfiguracionContable,
  dbGetMasterClaveOperaciones,
  dbSaveMasterClaveOperaciones
} from '../services/db';

interface SettingsProps {
  cuentasContables?: any[];
  onSave?: any;
  showToast?: any;
  empresa?: any;
  setEmpresa?: any;
  configContable?: any;
  contactos?: any[];
  servicios?: any[];
  comprobantes?: any[];
  bancos?: any[];
  movimientosBancos?: any[];
  cxc?: any[];
  cxp?: any[];
  products?: any[];
  activosFijos?: any[];
}

export default function Settings({ 
  cuentasContables = [], 
  onSave, 
  showToast, 
  empresa, 
  setEmpresa, 
  configContable, 
  contactos = [],
  servicios = [],
  comprobantes = [],
  bancos = [],
  movimientosBancos = [],
  cxc = [],
  cxp = [],
  products = [],
  activosFijos = []
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState('empresa');
  const { activeCompanyId, setActiveCompanyId, availableCompanies, setAvailableCompanies, workingYear, setWorkingYear, userRole, currentUser } = useCompany();
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingCompany, setIsDeletingCompany] = useState(false);

  const vendedoresContacts = useMemo(() => {
    return contactos.filter(c => c.type === 'employee' && c.employeeType === 'vendedor');
  }, [contactos]);

  // States for Company Settings
  const currentYear = new Date().getFullYear();
  const [localEmpresa, setLocalEmpresa] = useState({
    nombre: empresa?.nombre || 'Halley Insights C.A.',
    rif: empresa?.rif || 'J-12345678-9',
    anoInicio: (empresa as any)?.anoInicio || workingYear || String(currentYear),
    workingYear: workingYear || String(currentYear),
    direccion: empresa?.direccion || 'Av. Principal, Edif. Centro, Piso 4, Caracas',
    telefono: empresa?.telefono || '+58 212 555 0000',
    email: empresa?.email || 'contacto@halleyinsights.com',
    logo: empresa?.logo || '',
    monedaPrincipal: empresa?.monedaPrincipal || 'USD',
    monedaSecundaria: empresa?.monedaSecundaria || 'VES',
    tipoContribuyente: empresa?.tipoContribuyente || 'ordinario',
    tipoEmpresa: empresa?.tipoEmpresa || 'comercial',
    habilitarPOS: empresa?.habilitarPOS ?? true,
    habilitarVendedores: empresa?.habilitarVendedores ?? true,
    habilitarPedidos: empresa?.habilitarPedidos ?? true
  });

  const lastLoadedCompanyIdRef = useRef<string | null>(null);
  const lastLoadedEmpresaCompanyIdRef = useRef<string | null>(null);
  const lastLoadedConfigIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeCompanyId) {
      const activeComp = availableCompanies.find(c => c.id === activeCompanyId);
      if (activeComp) {
        setLocalEmpresa(prev => ({
          ...prev,
          nombre: activeComp.name || (activeComp as any).nombre || prev.nombre || '',
          rif: (activeComp as any).taxId || (activeComp as any).rif || prev.rif || '',
          ...(empresa || {})
        }));
      }
      lastLoadedEmpresaCompanyIdRef.current = activeCompanyId;
    }
  }, [activeCompanyId, availableCompanies, empresa]);

  // States for Accounting Integration (NIIF / VEN-NIF)
  const [contabilidad, setContabilidad] = useState({
    cuentaInventario: configContable?.cuentaInventario || '',
    cuentaCostoVentas: configContable?.cuentaCostoVentas || '',
    cuentaVentas: configContable?.cuentaVentas || '',
    cuentaGastos: configContable?.cuentaGastos || '',
    cuentaAnticipoRecibido: configContable?.cuentaAnticipoRecibido || '',
    cuentaAnticipoOtorgado: configContable?.cuentaAnticipoOtorgado || '',
    cuentaCxc: configContable?.cuentaCxc || '',
    cuentaCxp: configContable?.cuentaCxp || '',
    cuentaDebitoFiscal: configContable?.cuentaDebitoFiscal || '',
    cuentaCreditoFiscal: configContable?.cuentaCreditoFiscal || '',
    cuentaIvaRetenidoVentas: configContable?.cuentaIvaRetenidoVentas || '',
    cuentaIvaRetenidoCompras: configContable?.cuentaIvaRetenidoCompras || '',
    cuentaIslrRetenidoVentas: configContable?.cuentaIslrRetenidoVentas || '',
    cuentaIslrRetenidoCompras: configContable?.cuentaIslrRetenidoCompras || '',
    cuentaGananciaDiferencialCambiario: configContable?.cuentaGananciaDiferencialCambiario || '',
    cuentaPerdidaDiferencialCambiario: configContable?.cuentaPerdidaDiferencialCambiario || '',
    cuentaUtilidadAnteriores: configContable?.cuentaUtilidadAnteriores || '',
    cuentaBancoDefault: configContable?.cuentaBancoDefault || '',
    mesCierre: configContable?.mesCierre || '12'
  });

  // States for Billing & POS
  const [facturacion, setFacturacion] = useState({
    prefijoFactura: configContable?.prefijoFactura ?? '',
    correlativoFactura: formatCorrelativo(configContable?.correlativoFactura, 6),
    prefijoCotizacion: configContable?.prefijoCotizacion ?? '',
    correlativoCotizacion: formatCorrelativo(configContable?.correlativoCotizacion, 6),
    prefijoNotaEntrega: configContable?.prefijoNotaEntrega ?? '',
    correlativoNotaEntrega: formatCorrelativo(configContable?.correlativoNotaEntrega, 6),
    prefijoRecibo: configContable?.prefijoRecibo ?? 'REC-',
    correlativoRecibo: formatCorrelativo(configContable?.correlativoRecibo, 6),
    diasVencimientoDefault: configContable?.diasVencimientoDefault ?? 15,
    notasDefault: configContable?.notasDefault ?? 'Los pagos en bolívares se calcularán a la tasa del BCV del día del pago.',
    usaMaquinaFiscal: configContable?.usaMaquinaFiscal ?? false,
    marcaMaquinaFiscal: configContable?.marcaMaquinaFiscal ?? 'bixolon',
    puertoMaquinaFiscal: configContable?.puertoMaquinaFiscal ?? 'COM1',
    formatoImpresion: configContable?.formatoImpresion ?? 'estandar',
    textoFacturadoA: configContable?.textoFacturadoA ?? 'Facturado a:',
    textoTotalPagar: configContable?.textoTotalPagar ?? 'Total a Pagar',
    textoMensajeAgradecimiento: configContable?.textoMensajeAgradecimiento ?? 'Gracias por su compra',
    textoTerminosCondiciones: configContable?.textoTerminosCondiciones ?? 'Términos y Condiciones: Estos son los términos estándar de la factura.',
    comisionMode: configContable?.comisionMode ?? 'emitidas',
    activeServiceTemplate: configContable?.activeServiceTemplate ?? 'Estándar',
    activeInventoryTemplate: configContable?.activeInventoryTemplate ?? 'Estándar',
    habilitarTasaReferencialCobranza: configContable?.habilitarTasaReferencialCobranza ?? false
  });

  // States for Taxes & SENIAT
  const [impuestos, setImpuestos] = useState({
    iva: configContable?.iva ?? 16,
    igtf: configContable?.igtf ?? 3,
    retencionIva: configContable?.retencionIva ?? 75,
    retencionIslr: configContable?.retencionIslr ?? 2
  });

  // States for Importation
  const [importacion, setImportacion] = useState({
    autoContabilizar: true,
    cuentaDefaultIngresos: '',
    cuentaDefaultGastos: '',
    separadorCsv: ',',
    formatoFecha: 'DD/MM/YYYY'
  });

  // Sync state from configContable
  useEffect(() => {
    if (configContable && activeCompanyId) {
      const isNewCompany = lastLoadedCompanyIdRef.current !== activeCompanyId;
      const configIdOrHash = configContable.id || JSON.stringify(configContable);
      const isConfigLoadedFromDb = lastLoadedConfigIdRef.current !== configIdOrHash;
      
      if (isNewCompany || isConfigLoadedFromDb) {
        setContabilidad({
          cuentaInventario: configContable.cuentaInventario || '',
          cuentaCostoVentas: configContable.cuentaCostoVentas || '',
          cuentaVentas: configContable.cuentaVentas || '',
          cuentaGastos: configContable.cuentaGastos || '',
          cuentaAnticipoRecibido: configContable.cuentaAnticipoRecibido || '',
          cuentaAnticipoOtorgado: configContable.cuentaAnticipoOtorgado || '',
          cuentaCxc: configContable.cuentaCxc || '',
          cuentaCxp: configContable.cuentaCxp || '',
          cuentaDebitoFiscal: configContable.cuentaDebitoFiscal || '',
          cuentaCreditoFiscal: configContable.cuentaCreditoFiscal || '',
          cuentaIvaRetenidoVentas: configContable.cuentaIvaRetenidoVentas || '',
          cuentaIvaRetenidoCompras: configContable.cuentaIvaRetenidoCompras || '',
          cuentaIslrRetenidoVentas: configContable.cuentaIslrRetenidoVentas || '',
          cuentaIslrRetenidoCompras: configContable.cuentaIslrRetenidoCompras || '',
          cuentaGananciaDiferencialCambiario: configContable.cuentaGananciaDiferencialCambiario || '',
          cuentaPerdidaDiferencialCambiario: configContable.cuentaPerdidaDiferencialCambiario || '',
          cuentaUtilidadAnteriores: configContable.cuentaUtilidadAnteriores || '',
          cuentaBancoDefault: configContable.cuentaBancoDefault || '',
          mesCierre: configContable.mesCierre || '12'
        });

        setFacturacion(prev => ({
          ...prev,
          prefijoFactura: configContable.prefijoFactura ?? prev.prefijoFactura,
          correlativoFactura: configContable.correlativoFactura !== undefined ? formatCorrelativo(configContable.correlativoFactura, 6) : prev.correlativoFactura,
          prefijoCotizacion: configContable.prefijoCotizacion ?? prev.prefijoCotizacion,
          correlativoCotizacion: configContable.correlativoCotizacion !== undefined ? formatCorrelativo(configContable.correlativoCotizacion, 6) : prev.correlativoCotizacion,
          prefijoNotaEntrega: configContable.prefijoNotaEntrega ?? prev.prefijoNotaEntrega,
          correlativoNotaEntrega: configContable.correlativoNotaEntrega !== undefined ? formatCorrelativo(configContable.correlativoNotaEntrega, 6) : prev.correlativoNotaEntrega,
          prefijoRecibo: configContable.prefijoRecibo ?? prev.prefijoRecibo,
          correlativoRecibo: configContable.correlativoRecibo !== undefined ? formatCorrelativo(configContable.correlativoRecibo, 6) : prev.correlativoRecibo,
          diasVencimientoDefault: configContable.diasVencimientoDefault ?? prev.diasVencimientoDefault,
          notasDefault: configContable.notasDefault ?? prev.notasDefault,
          usaMaquinaFiscal: configContable.usaMaquinaFiscal ?? prev.usaMaquinaFiscal,
          marcaMaquinaFiscal: configContable.marcaMaquinaFiscal ?? prev.marcaMaquinaFiscal,
          puertoMaquinaFiscal: configContable.puertoMaquinaFiscal ?? prev.puertoMaquinaFiscal,
          formatoImpresion: configContable.formatoImpresion ?? prev.formatoImpresion,
          comisionMode: configContable.comisionMode ?? prev.comisionMode,
          activeServiceTemplate: configContable.activeServiceTemplate ?? prev.activeServiceTemplate,
          activeInventoryTemplate: configContable.activeInventoryTemplate ?? prev.activeInventoryTemplate,
          habilitarTasaReferencialCobranza: configContable.habilitarTasaReferencialCobranza ?? prev.habilitarTasaReferencialCobranza
        }));

        setImpuestos(prev => ({
          ...prev,
          iva: configContable.iva ?? prev.iva,
          igtf: configContable.igtf ?? prev.igtf,
          retencionIva: configContable.retencionIva ?? prev.retencionIva,
          retencionIslr: configContable.retencionIslr ?? prev.retencionIslr
        }));

        lastLoadedCompanyIdRef.current = activeCompanyId;
        lastLoadedConfigIdRef.current = configIdOrHash;
      }
    }
  }, [configContable, activeCompanyId]);

  // Modal de Crear Empresa desde Settings
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [newCompTaxId, setNewCompTaxId] = useState('');
  const [newCompYear, setNewCompYear] = useState<string>(String(currentYear));
  const [copyPlanFromComp, setCopyPlanFromComp] = useState(false);
  const [copyContactsFromComp, setCopyContactsFromComp] = useState(false);
  const [selectedSourceComp, setSelectedSourceComp] = useState('');

  // States for Users & RBAC
  const [users, setUsers] = useState<any[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userToChangePassword, setUserToChangePassword] = useState<any>(null);
  const [newPasswordForUser, setNewPasswordForUser] = useState('');
  const [newClaveOperacionesForUser, setNewClaveOperacionesForUser] = useState('');
  const [globalMasterClave, setGlobalMasterClave] = useState('19072828');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [showNewUserClaveOperaciones, setShowNewUserClaveOperaciones] = useState(false);
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [showModalClaveOperaciones, setShowModalClaveOperaciones] = useState(false);
  const [newUser, setNewUser] = useState<{
    email: string;
    password: string;
    claveOperaciones: string;
    role: string;
    vendedorId: string;
    vendedorNombre: string;
    companies: string[];
  }>({
    email: '',
    password: '',
    claveOperaciones: '',
    role: 'Operador',
    vendedorId: '',
    vendedorNombre: '',
    companies: []
  });
  const [userCompaniesAccess, setUserCompaniesAccess] = useState<Record<string, string>>({});
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);
  const [permissionCompanyId, setPermissionCompanyId] = useState("");
  const [searchUserTerm, setSearchUserTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  // Modal de Cuentas Contables NIIF
  const [showCuentaModal, setShowCuentaModal] = useState(false);
  const [activeConfigKey, setActiveConfigKey] = useState<string | null>(null);
  const [searchCuentaTerm, setSearchCuentaTerm] = useState('');
  const [filterAccountGroup, setFilterAccountGroup] = useState('todos');

  const SYSTEM_MODULES = [
    { id: 'contactos', label: 'Contactos & Directorio', icon: Users },
    { id: 'facturacion', label: 'Ventas & Facturación', icon: Receipt },
    { id: 'cuentasCobrar', label: 'Cuentas por Cobrar (CxC)', icon: Coins },
    { id: 'cuentasPagar', label: 'Cuentas por Pagar (CxP)', icon: Briefcase },
    { id: 'bancos', label: 'Tesorería & Bancos', icon: Building2 },
    { id: 'contabilidad', label: 'Contabilidad NIIF', icon: BookOpen },
    { id: 'inventario', label: 'Inventario & Catálogo', icon: Layers },
    { id: 'nomina', label: 'Nómina & Liquidación', icon: Users },
    { id: 'transporte', label: 'Transporte & Flota', icon: Truck },
    { id: 'expedientes', label: 'Expedientes & Documentos', icon: FolderArchive },
    { id: 'rutas', label: 'Rutas & Logística', icon: MapPin },
    { id: 'informes', label: 'Informes Financieros', icon: FileSpreadsheet },
    { id: 'disenador', label: 'Diseñador de Plantillas', icon: FileText },
    { id: 'vendedores', label: 'Fuerza de Ventas', icon: Sparkles },
    { id: 'configuracion', label: 'Configuración del Sistema', icon: SettingsIcon }
  ];

  useEffect(() => {
    if (activeTab === 'usuarios') {
      fetchUsers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedUser?.email) {
      fetchUserAccesses(selectedUser.email);
    } else {
      setUserCompaniesAccess({});
    }
  }, [selectedUser?.email]);

  const fetchUserAccesses = async (email: string) => {
    setIsLoadingAccess(true);
    try {
      const configs: Record<string, any> = {};
      const defaultPerms = SYSTEM_MODULES.reduce((acc, mod) => {
        acc[mod.id] = { view: true, create: true, delete: true };
        return acc;
      }, {} as any);

      const foundUser = users.find(u => u.email === email);
      const userEmpresas = foundUser ? await dbFetchUsuarioEmpresas(foundUser.id) : [];

      availableCompanies.forEach((comp: any) => {
        const found = userEmpresas.find((item: any) => item.empresa_id === comp.id);

        if (found) {
          configs[comp.id] = {
            enabled: true,
            role: found.role || 'Operador',
            vendedorId: found.vendedor_id || '',
            vendedorNombre: found.vendedor_nombre || '',
            permissions: found.permissions || defaultPerms,
            activo: found.activo !== false
          };
        } else {
          configs[comp.id] = {
            enabled: false,
            role: 'Operador',
            vendedorId: '',
            vendedorNombre: '',
            permissions: defaultPerms,
            activo: true
          };
        }
      });
      
      setSelectedUser((prev: any) => prev ? { ...prev, companyConfigs: configs } : null);
      
      if (activeCompanyId && configs[activeCompanyId]?.enabled) {
        setPermissionCompanyId(activeCompanyId);
      } else {
        const firstEnabled = Object.keys(configs).find(cid => configs[cid].enabled);
        setPermissionCompanyId(firstEnabled || activeCompanyId || "");
      }
    } catch (e: any) {
      console.error("Error fetching user companies access", e);
    } finally {
      setIsLoadingAccess(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const [dbList, masterClave] = await Promise.all([
        dbFetchUsuarios(),
        dbGetMasterClaveOperaciones()
      ]);
      setGlobalMasterClave(masterClave || '19072828');
      const defaultUsers = [
        {
          id: "u-admin",
          email: "administrador@empresa.com",
          name: "Administrador Principal",
          role: "Master",
          claveOperaciones: masterClave || '19072828',
          activo: true,
          companyRoles: { [activeCompanyId || "default"]: "Master" },
          companyPermissions: {}
        }
      ];
      setUsers(dbList && dbList.length > 0 ? dbList : defaultUsers);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.email) return;
    try {
      const cleanEmail = newUser.email.trim().toLowerCase();
      const selectedCompanyIds = newUser.companies && newUser.companies.length > 0 
        ? newUser.companies 
        : (activeCompanyId ? [activeCompanyId] : []);

      const chosenClave = newUser.role === 'Master' ? (newUser.claveOperaciones ? newUser.claveOperaciones.trim() : globalMasterClave) : undefined;

      const userObj = {
        id: crypto.randomUUID(),
        email: cleanEmail,
        name: cleanEmail.split('@')[0],
        password: newUser.password ? newUser.password.trim() : '123456',
        claveOperaciones: chosenClave,
        role: newUser.role,
        vendedorId: newUser.vendedorId,
        vendedorNombre: newUser.vendedorNombre,
        activo: true,
        companyRoles: selectedCompanyIds.reduce((acc: any, cId: string) => {
          acc[cId] = newUser.role;
          return acc;
        }, {}),
        companyConfigs: {}
      };

      await dbSaveUsuario(userObj);

      // Auto-aprovisionar en Supabase Auth si está configurado
      try {
        const { supabase, isSupabaseConfigured } = await import('../lib/supabase');
        if (isSupabaseConfigured && supabase) {
          await supabase.auth.signUp({
            email: cleanEmail,
            password: userObj.password
          });
        }
      } catch (authErr) {
        console.warn('Aviso al aprovisionar usuario en Supabase Auth:', authErr);
      }

      if (newUser.role === 'Master' && newUser.claveOperaciones.trim()) {
        await dbSaveMasterClaveOperaciones(newUser.claveOperaciones.trim());
        setGlobalMasterClave(newUser.claveOperaciones.trim());
      }

      // Guardar accesos explícitos para las empresas seleccionadas
      const defaultPerms = SYSTEM_MODULES.reduce((acc, mod) => {
        acc[mod.id] = { view: true, create: true, delete: true };
        return acc;
      }, {} as any);

      for (const cId of selectedCompanyIds) {
        await dbSaveUsuarioEmpresa({
          usuario_id: userObj.id,
          empresa_id: cId,
          role: newUser.role || 'Operador',
          vendedor_id: newUser.vendedorId || null,
          vendedor_nombre: newUser.vendedorNombre || null,
          permissions: defaultPerms,
          activo: true
        });
      }

      const updated = [...users.filter(u => u.email !== cleanEmail), userObj];
      setUsers(updated);

      setIsAddingUser(false);
      setNewUser({ email: '', password: '', claveOperaciones: '', role: 'Operador', vendedorId: '', vendedorNombre: '', companies: [] });
      if (showToast) showToast('Usuario creado con acceso a las empresas seleccionadas', 'success');
    } catch (e: any) {
      console.error(e);
      if (showToast) showToast('Error al crear usuario: ' + (e.message || ''), 'error');
    }
  };

  const handleSaveNewPassword = async () => {
    if (!userToChangePassword) return;
    const pwd = newPasswordForUser.trim();
    const claveOp = newClaveOperacionesForUser.trim();

    if (!pwd && !claveOp) {
      if (showToast) showToast('Por favor ingrese al menos una clave o contraseña para actualizar', 'error');
      return;
    }

    try {
      // 1. Si el usuario es Master y configuró clave de operaciones, persistir como clave global de operaciones
      if ((userToChangePassword.role === 'Master' || userToChangePassword.role === 'SuperAdmin') && claveOp) {
        await dbSaveMasterClaveOperaciones(claveOp);
        setGlobalMasterClave(claveOp);
      }

      // 2. Preparar el objeto de usuario actualizado
      const updatedUser = { 
        ...userToChangePassword, 
        ...(pwd ? { password: pwd, password_hash: pwd } : {}),
        ...(claveOp ? { claveOperaciones: claveOp, clave_operaciones: claveOp } : {})
      };
      
      await dbSaveUsuario(updatedUser);

      // 3. Sincronizar en memoria y lista de usuarios
      const updatedUsers = users.map(u => {
        if (u.email.toLowerCase() === userToChangePassword.email.toLowerCase()) {
          return updatedUser;
        }
        return u;
      });

      setUsers(updatedUsers);
      if (showToast) showToast(`Claves actualizadas exitosamente para ${userToChangePassword.email}`, 'success');
      setUserToChangePassword(null);
      setNewPasswordForUser('');
      setNewClaveOperacionesForUser('');
    } catch (e: any) {
      console.error(e);
      if (showToast) showToast('Error al actualizar credenciales: ' + (e.message || ''), 'error');
    }
  };

  const handleTogglePermission = (modId: string, type: 'view' | 'create' | 'delete') => {
    if (!selectedUser || !permissionCompanyId) return;
    setSelectedUser((prev: any) => {
      if (!prev) return prev;
      const currentConfig = prev.companyConfigs?.[permissionCompanyId] || {};
      const currentPermissions = currentConfig.permissions || {};
      const currentModPerms = currentPermissions[modId] || { view: false, create: false, delete: false };
      
      const updatedModPerms = {
        ...currentModPerms,
        [type]: !currentModPerms[type]
      };

      return {
        ...prev,
        companyConfigs: {
          ...prev.companyConfigs,
          [permissionCompanyId]: {
            ...currentConfig,
            permissions: {
              ...currentPermissions,
              [modId]: updatedModPerms
            }
          }
        }
      };
    });
  };

  const handleSaveUserAccesses = async () => {
    if (!selectedUser?.email || !selectedUser.companyConfigs) return;
    try {
      for (const compId of Object.keys(selectedUser.companyConfigs)) {
        const config = selectedUser.companyConfigs[compId];
        if (config.enabled) {
          await dbSaveUsuarioEmpresa({
            usuario_id: selectedUser.id,
            empresa_id: compId,
            role: config.role || 'Operador',
            vendedor_id: config.vendedorId || null,
            vendedor_nombre: config.vendedorNombre || null,
            permissions: config.permissions,
            activo: config.activo !== false
          });
        } else {
          // Si la empresa no está tildada/habilitada, eliminamos el permiso de acceso
          await dbDeleteUsuarioEmpresa(selectedUser.id, compId);
        }
      }

      if (showToast) showToast('Permisos de acceso por empresa actualizados exitosamente', 'success');
      setSelectedUser(null);
    } catch (e: any) {
      console.error(e);
      if (showToast) showToast('Error al guardar permisos: ' + (e.message || ''), 'error');
    }
  };

  const handleDeleteUser = async (email: string) => {
    try {
      await dbDeleteUsuario(email);
      const updated = users.filter(u => u.email !== email);
      setUsers(updated);

      setShowDeleteUserConfirm(false);
      setUserToDelete(null);
      if (showToast) showToast('Usuario eliminado de la base de datos', 'success');
    } catch (e) {
      if (showToast) showToast('Error al eliminar usuario', 'error');
    }
  };

  // Centralized Save Handler
  const handleSave = async () => {
    if (setEmpresa) {
      setEmpresa(localEmpresa);
    }
    
    const updatedConfig = {
      ...configContable,
      ...contabilidad,
      ...facturacion,
      ...impuestos,
      ...importacion,
      workingYear: localEmpresa.anoInicio || workingYear || String(currentYear)
    };

    if (onSave) {
      try {
        await onSave('settings', { empresa: localEmpresa });
        await onSave('accounting-config', updatedConfig);
        if (showToast) {
          showToast('Configuración del sistema guardada exitosamente.', 'success');
        }
      } catch (err: any) {
        console.error('Error al guardar configuración:', err);
        if (showToast) {
          showToast('Error al guardar configuración: ' + (err?.message || 'Error desconocido'), 'error');
        }
      }
    } else {
      if (showToast) {
        showToast('Configuraciones guardadas exitosamente.', 'success');
      }
    }
  };

  // Respaldo JSON & SQL
  const handleDownloadJSON = async () => {
    if (!activeCompanyId) return;
    try {
      setIsExporting(true);
      if (showToast) showToast('Generando respaldo JSON...', 'info');

      const backupData: Record<string, any[]> = {
        companyInfo: [empresa || {}],
        cuentasContables: cuentasContables || [],
        contactos: contactos || [],
        configContable: [configContable || {}]
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `respaldo-${empresa?.nombre?.replace(/\s+/g, '_') || 'empresa'}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      if (showToast) showToast('Respaldo JSON descargado con éxito.', 'success');
    } catch (error) {
      if (showToast) showToast('Error al generar respaldo JSON', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSQL = async () => {
    if (!activeCompanyId) return;
    try {
      setIsExporting(true);
      if (showToast) showToast('Generando volcado SQL...', 'info');

      let sqlString = `-- Respaldo SQL Generado por Halley ERP\n-- Empresa: ${empresa?.nombre || 'Empresa'}\n-- Fecha: ${new Date().toISOString()}\n\n`;
      sqlString += `-- Tabla: Empresa\n`;
      if (empresa) {
        const keys = Object.keys(empresa).map(k => `"${k}"`).join(", ");
        const values = Object.values(empresa).map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v).join(", ");
        sqlString += `INSERT INTO "empresa" (${keys}) VALUES (${values});\n\n`;
      }

      const blob = new Blob([sqlString], { type: 'text/sql' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dump-${empresa?.nombre?.replace(/\s+/g, '_') || 'empresa'}-${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      if (showToast) showToast('Volcado SQL descargado con éxito.', 'success');
    } catch (error) {
      if (showToast) showToast('Error al generar volcado SQL', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteCompany = async () => {
    if (!activeCompanyId) return;
    const expectedWord = (empresa?.nombre || '').trim();
    if (deleteConfirmText.trim() !== expectedWord) {
      if (showToast) showToast('Por favor ingrese el nombre exacto de la empresa para confirmar', 'error');
      return;
    }

    try {
      setIsDeletingCompany(true);
      await dbDeleteEmpresa(activeCompanyId);
      const updatedList = availableCompanies.filter(c => c.id !== activeCompanyId);
      setAvailableCompanies(updatedList);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setActiveCompanyId(null);
      if (showToast) showToast('La empresa ha sido eliminada exitosamente', 'success');
    } catch (error: any) {
      if (showToast) showToast('Error al eliminar la empresa: ' + (error?.message || ''), 'error');
    } finally {
      setIsDeletingCompany(false);
    }
  };

  // Helper para renderizar selector de cuenta contable NIIF
  const renderSelectCuenta = (label: string, key: string, description: string) => {
    const value = contabilidad[key as keyof typeof contabilidad] as string;
    const selectedCuenta = value 
      ? cuentasContables.find(c => String(c.id) === String(value) || String(c.codigo) === String(value))
      : undefined;

    return (
      <div className="flex flex-col">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
          <span>{label}</span>
          {selectedCuenta?.codigo && (
            <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.2">
              {selectedCuenta.codigo}
            </span>
          )}
        </label>
        <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">{description}</p>
        <div 
          onClick={() => {
            setActiveConfigKey(key);
            setSearchCuentaTerm('');
            setShowCuentaModal(true);
          }}
          className={`w-full p-3 border rounded-xl cursor-pointer transition-all flex items-center justify-between group ${
            selectedCuenta 
               ? 'border-slate-200 bg-white hover:border-indigo-400 hover:shadow-xs' 
               : 'border-dashed border-slate-300 bg-slate-50 hover:bg-white hover:border-indigo-400'
          }`}
        >
          {selectedCuenta ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-black text-slate-800 truncate block">
                  {selectedCuenta.nombre}
                </span>
                <span className="text-[10px] font-medium text-slate-400">
                  {selectedCuenta.tipo || 'Movimiento'} • Grupo: {selectedCuenta.grupo || 'General'}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-slate-400" />
              Seleccionar cuenta NIIF...
            </span>
          )}
          <Search className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0 ml-2" />
        </div>
      </div>
    );
  };

  // Master permission check
  const isMaster = currentUser?.role === 'Master' || userRole === 'Master';

  // Nav Groups & Tabs
  const NAV_SECTIONS = [
    {
      group: 'ORGANIZACIÓN',
      tabs: [
        { id: 'empresa', label: 'Perfil de Empresa', icon: Building2, desc: 'Razón social, RIF, monedas y logo' }
      ]
    },
    {
      group: 'FINANZAS & CONTABILIDAD',
      tabs: [
        { id: 'contabilidad', label: 'Mapeo Contable NIIF', icon: BookOpen, desc: 'Cuentas maestras y enlaces automáticos' },
        { id: 'impuestos', label: 'Régimen Fiscal & Tasas', icon: Percent, desc: 'IVA, IGTF, retenciones SENIAT' },
        { id: 'correlativos', label: 'Series & Correlativos', icon: Hash, desc: 'Numeración y prefijos de documentos' }
      ]
    },
    {
      group: 'GOBERNANZA & SEGURIDAD',
      tabs: [
        ...(isMaster ? [{ id: 'usuarios', label: 'Usuarios & Permisos (RBAC)', icon: Users, desc: 'Control exclusivo Master: altas, roles y accesos' }] : []),
        { id: 'importacion', label: 'Carga Masiva de Datos', icon: UploadCloud, desc: 'Importación estructurada de catálogos' },
        ...(isMaster ? [{ id: 'respaldos', label: 'Copias de Seguridad & BD', icon: Database, desc: 'Snapshots JSON/SQL y gobernanza' }] : []),
        ...(isMaster ? [{ id: 'auditoria', label: 'Pista de Auditoría Forense', icon: ShieldAlert, desc: 'Bitácora inmutable de eventos DML en tiempo real' }] : []),
        { id: 'acerca', label: 'Acerca del ERP & Release', icon: ShieldCheck, desc: 'Especificaciones de versión y entorno' }
      ]
    }
  ];

  // ==========================================
  // SUB-VIEW RENDERS
  // ==========================================

  // 0. Acerca del ERP & Release
  const renderAcerca = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="p-6 bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl shadow-xl shadow-indigo-950/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <ShieldCheck size={180} />
        </div>
        <div className="relative z-10">
          <span className="px-3 py-1 bg-white/15 backdrop-blur-md rounded-full text-[10px] font-black tracking-wider uppercase inline-block mb-3 border border-white/20">
            {APP_EDITION}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
            {APP_NAME} <span className="text-indigo-400">v{APP_VERSION}</span>
          </h2>
          <p className="text-indigo-200 text-xs sm:text-sm max-w-xl font-medium leading-relaxed">
            Plataforma Integral de Gestión Comercial, Administrativa y Contabilidad NIIF Multimoneda con Motor de Seguridad Row-Level Security (RLS).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Versión del Sistema</span>
          <span className="text-sm font-black text-slate-800 font-mono">v{APP_VERSION}</span>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Nombre Código (Codename)</span>
          <span className="text-sm font-black text-slate-800">{APP_CODENAME}</span>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Build / Compilación</span>
          <span className="text-sm font-black text-slate-800 font-mono">#{APP_BUILD_NUMBER} ({APP_BUILD_DATE})</span>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Base de Datos & Seguridad</span>
          <span className="text-sm font-black text-emerald-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Supabase PostgreSQL (RLS Blindado)
          </span>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Normativa Contable</span>
          <span className="text-sm font-black text-slate-800">VEN-NIIF / SENIAT</span>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Aislamiento de Inquilinos</span>
          <span className="text-sm font-black text-indigo-600">Multi-Tenant Estricto por Empresa</span>
        </div>
      </div>
    </div>
  );

  // 1. Perfil de Empresa
  const renderEmpresa = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Banner de Entornos Multi-Empresa con Botón de Creación Rápida */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-slate-50 rounded-2xl border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-slate-900">Entorno Multi-Empresa</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700">
                {availableCompanies.length} {availableCompanies.length === 1 ? 'Empresa' : 'Empresas'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Empresa activa: <strong className="text-indigo-900">{availableCompanies.find(c => c.id === activeCompanyId)?.name || localEmpresa.nombre}</strong>
            </p>
          </div>
        </div>

        {isMaster && (
          <button
            type="button"
            onClick={() => {
              setSelectedSourceComp(activeCompanyId || availableCompanies[0]?.id || '');
              setShowCreateCompanyModal(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus size={15} /> + Crear Nueva Empresa
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 bg-slate-50/80 rounded-2xl border border-slate-200/80">
        <div className="relative w-24 h-24 bg-white rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-indigo-400 transition-all cursor-pointer overflow-hidden shadow-xs shrink-0 group">
          {localEmpresa.logo ? (
            <img src={localEmpresa.logo} alt="Logo" className="w-full h-full object-contain p-2" />
          ) : (
            <>
              <Upload className="w-6 h-6 mb-1 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Logo</span>
            </>
          )}
          <input 
            type="file" 
            accept="image/*" 
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const originalBase64 = reader.result as string;
                  const img = new Image();
                  img.src = originalBase64;
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const max_size = 600;
                    if (width > height) {
                      if (width > max_size) {
                        height = Math.round((height * max_size) / width);
                        width = max_size;
                      }
                    } else {
                      if (height > max_size) {
                        width = Math.round((width * max_size) / height);
                        height = max_size;
                      }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.drawImage(img, 0, 0, width, height);
                      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
                      setLocalEmpresa({...localEmpresa, logo: compressedBase64});
                    }
                  };
                };
                reader.readAsDataURL(file);
              }
            }}
          />
        </div>
        <div>
          <h3 className="text-base font-black text-slate-900">Identidad Visual & Logotipo Oficial</h3>
          <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
            Este logotipo se incrustará automáticamente en todas las facturas digitales, notas de entrega, cotizaciones y reportes contables emitidos.
          </p>
          {localEmpresa.logo && (
            <button 
              onClick={() => setLocalEmpresa({...localEmpresa, logo: ''})}
              className="mt-2 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
            >
              Eliminar logotipo actual
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flex flex-col">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Nombre o Razón Social</label>
          <input 
            type="text" 
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            value={localEmpresa.nombre}
            onChange={e => setLocalEmpresa({...localEmpresa, nombre: e.target.value})}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">RIF / NIF / Identificación Fiscal</label>
          <input 
            type="text" 
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            value={localEmpresa.rif}
            onChange={e => setLocalEmpresa({...localEmpresa, rif: e.target.value})}
          />
        </div>

        <div className="flex flex-col md:col-span-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Domicilio Fiscal Oficial</label>
          <input 
            type="text" 
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            value={localEmpresa.direccion}
            onChange={e => setLocalEmpresa({...localEmpresa, direccion: e.target.value})}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Teléfono Corporativo</label>
          <input 
            type="text" 
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            value={localEmpresa.telefono}
            onChange={e => setLocalEmpresa({...localEmpresa, telefono: e.target.value})}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Correo Electrónico Oficial</label>
          <input 
            type="email" 
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            value={localEmpresa.email}
            onChange={e => setLocalEmpresa({...localEmpresa, email: e.target.value})}
          />
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Tipo de Contribuyente (SENIAT)</label>
          <select 
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
            value={localEmpresa.tipoContribuyente}
            onChange={e => setLocalEmpresa({...localEmpresa, tipoContribuyente: e.target.value})}
          >
            <option value="ordinario">Contribuyente Ordinario</option>
            <option value="especial">Contribuyente Especial (Sujeto a Retenciones)</option>
            <option value="formal">Contribuyente Formal</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Sector / Tipo de Empresa</label>
          <select 
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
            value={localEmpresa.tipoEmpresa}
            onChange={e => setLocalEmpresa({...localEmpresa, tipoEmpresa: e.target.value})}
          >
            <option value="comercial">Empresa Comercial (Venta de Productos)</option>
            <option value="servicios">Empresa de Servicios</option>
            <option value="manufacturera">Empresa Manufacturera / Producción</option>
            <option value="mixta">Empresa Mixta (Bienes y Servicios)</option>
          </select>
        </div>

        {/* Monedas */}
        <div className="flex flex-col">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Moneda Funcional (Base)</label>
          <select 
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
            value={localEmpresa.monedaPrincipal}
            onChange={e => setLocalEmpresa({...localEmpresa, monedaPrincipal: e.target.value})}
          >
            <option value="USD">Dólar Estadounidense (USD - $)</option>
            <option value="VES">Bolívar Soberano (VES - Bs.)</option>
            <option value="EUR">Euro (EUR - €)</option>
            <option value="COP">Peso Colombiano (COP - $)</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Calendar size={14} className="text-indigo-600" />
            Ejercicio Fiscal de Trabajo Habilitado
          </label>
          <select 
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
            value={workingYear || localEmpresa.anoInicio || String(currentYear)}
            onChange={e => {
              setLocalEmpresa({...localEmpresa, workingYear: e.target.value});
              setWorkingYear(e.target.value);
            }}
          >
            {(() => {
              const startY = parseInt(localEmpresa.anoInicio) || currentYear;
              const workY = parseInt(workingYear) || startY;
              const maxY = Math.max(startY, workY);
              const list: string[] = [];
              for (let y = startY; y <= maxY; y++) list.push(String(y));
              return list.map(y => (
                <option key={y} value={y}>Año {y} {y === String(currentYear) ? '(Actual)' : ''}</option>
              ));
            })()}
          </select>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">
            * Para habilitar el siguiente año fiscal, realice el proceso formal en Contabilidad &gt; Cierre de Ejercicio Fiscal.
          </p>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Moneda Secundaria (Presentación)</label>
          <select 
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
            value={localEmpresa.monedaSecundaria}
            onChange={e => setLocalEmpresa({...localEmpresa, monedaSecundaria: e.target.value})}
          >
            <option value="VES">Bolívar Soberano (VES - Bs.)</option>
            <option value="USD">Dólar Estadounidense (USD - $)</option>
            <option value="EUR">Euro (EUR - €)</option>
            <option value="COP">Peso Colombiano (COP - $)</option>
          </select>
        </div>
      </div>
    </div>
  );

  // 2. Mapeo Contable NIIF
  const renderContabilidad = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-950 font-medium leading-relaxed">
            <span className="font-bold">Mapeo Automático de Asientos:</span> Las cuentas seleccionadas aquí se sincronizan automáticamente con el catálogo NIIF para facturas, cobros, pagos y asientos contables. Cada selección se guarda al instante.
          </div>
        </div>
        <button
          onClick={handleSave}
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 cursor-pointer active:scale-95 transition-all"
        >
          <Save size={14} />
          <span>Guardar Mapeo</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cartera Comercial */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h4 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-600" /> Cartera Comercial (CxC / CxP)
          </h4>
          {renderSelectCuenta('Cuentas por Cobrar (Clientes)', 'cuentaCxc', 'Activo donde se controlan saldos pendientes por cobrar.')}
          {renderSelectCuenta('Cuentas por Pagar (Proveedores)', 'cuentaCxp', 'Pasivo donde se controlan obligaciones pendientes.')}
        </div>

        {/* Anticipos & Saldos a Favor */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h4 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Coins className="w-4 h-4 text-emerald-600" /> Anticipos & Saldos a Favor
          </h4>
          {renderSelectCuenta('Anticipos Recibidos de Clientes', 'cuentaAnticipoRecibido', 'Pasivo corriente para saldos a favor o anticipos entregados por clientes.')}
          {renderSelectCuenta('Anticipos Otorgados a Proveedores', 'cuentaAnticipoOtorgado', 'Activo exigible para pagos anticipados o saldos a favor entregados a proveedores.')}
        </div>

        {/* Inventarios & Costos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h4 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-600" /> Inventario & Costos
          </h4>
          {renderSelectCuenta('Inventario de Mercancía', 'cuentaInventario', 'Activo corriente donde se registra el inventario de bienes disponibles para la venta.')}
          {renderSelectCuenta('Costo de Ventas', 'cuentaCostoVentas', 'Costo de adquisición o producción imputado a las ventas realizadas.')}
        </div>

        {/* Ventas & Gastos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h4 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" /> Ingresos & Egresos Operativos
          </h4>
          {renderSelectCuenta('Ingresos por Ventas / Servicios', 'cuentaVentas', 'Cuenta nominal de ingresos donde se registran las ventas.')}
          {renderSelectCuenta('Gastos Operativos / Generales', 'cuentaGastos', 'Cuenta nominal de egresos por defecto para compras y gastos.')}
        </div>

        {/* Impuestos en Ventas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h4 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Percent className="w-4 h-4 text-indigo-600" /> Impuestos Fiscales en Ventas
          </h4>
          {renderSelectCuenta('Débito Fiscal (IVA Ventas)', 'cuentaDebitoFiscal', 'Pasivo corriente para el IVA facturado a clientes.')}
          {renderSelectCuenta('IVA Retenido por Clientes', 'cuentaIvaRetenidoVentas', 'Activo exigible para comprobantes de retención IVA recibidos.')}
          {renderSelectCuenta('ISLR Retenido por Clientes', 'cuentaIslrRetenidoVentas', 'Activo por anticipos de impuesto sobre la renta.')}
        </div>

        {/* Impuestos en Compras */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h4 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Percent className="w-4 h-4 text-indigo-600" /> Impuestos Fiscales en Compras
          </h4>
          {renderSelectCuenta('Crédito Fiscal (IVA Compras)', 'cuentaCreditoFiscal', 'Activo para el IVA pagado y deducible en compras.')}
          {renderSelectCuenta('IVA Retenido a Proveedores', 'cuentaIvaRetenidoCompras', 'Pasivo por retenciones practicadas pendientes de enterar.')}
          {renderSelectCuenta('ISLR Retenido a Proveedores', 'cuentaIslrRetenidoCompras', 'Pasivo por retenciones ISLR pendientes de enterar.')}
        </div>

        {/* Diferencial Cambiario (SAPS) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h4 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-indigo-600" /> Diferencial Cambiario (SAPS FX)
          </h4>
          {renderSelectCuenta('Ganancia por Diferencial Cambiario', 'cuentaGananciaDiferencialCambiario', 'Ingreso financiero por revalorización en tasa de cambio.')}
          {renderSelectCuenta('Pérdida por Diferencial Cambiario', 'cuentaPerdidaDiferencialCambiario', 'Gasto financiero por devaluación de saldos en moneda local.')}
        </div>

        {/* Cierre Contable & Banco */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <h4 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Cierre Anual & Ejercicio Fiscal
          </h4>
          {renderSelectCuenta('Utilidad / Pérdida de Ejercicios Anteriores', 'cuentaUtilidadAnteriores', 'Patrimonio para asentar el resultado acumulado en el cierre anual.')}
          <div className="flex flex-col">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Mes de Cierre Fiscal</label>
            <select 
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
              value={contabilidad.mesCierre}
              onChange={e => setContabilidad({...contabilidad, mesCierre: e.target.value})}
            >
              <option value="1">Enero</option>
              <option value="2">Febrero</option>
              <option value="3">Marzo</option>
              <option value="4">Abril</option>
              <option value="5">Mayo</option>
              <option value="6">Junio</option>
              <option value="7">Julio</option>
              <option value="8">Agosto</option>
              <option value="9">Septiembre</option>
              <option value="10">Octubre</option>
              <option value="11">Noviembre</option>
              <option value="12">Diciembre (Estándar)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Botón inferior de confirmación de mapeo */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Configuración de enlaces contables lista para producción</span>
        </div>
        <button
          onClick={handleSave}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
        >
          <Save size={15} />
          <span>Guardar Mapeo NIIF</span>
        </button>
      </div>
    </div>
  );

  // 4. Régimen Fiscal & Tasas
  const renderImpuestos = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="mb-4">
        <h3 className="text-base font-black text-slate-900">Alícuotas Tributarias & Retenciones</h3>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Porcentajes oficiales vigentes aplicados a facturación y compras.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Tasa de IVA General</label>
          <p className="text-[11px] text-slate-400 mb-2">Alícuota impositiva estándar en ventas nacionales (16%).</p>
          <div className="relative">
            <input 
              type="number" 
              step="0.01" 
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:border-indigo-500 outline-none transition-all"
              value={impuestos.iva}
              onChange={e => setImpuestos({...impuestos, iva: Number(e.target.value)})}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Tasa IGTF (Divisas / Moneda Extranjera)</label>
          <p className="text-[11px] text-slate-400 mb-2">Impuesto a Grandes Transacciones Financieras (3%).</p>
          <div className="relative">
            <input 
              type="number" 
              step="0.01" 
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:border-indigo-500 outline-none transition-all"
              value={impuestos.igtf}
              onChange={e => setImpuestos({...impuestos, igtf: Number(e.target.value)})}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Porcentaje Retención IVA</label>
          <p className="text-[11px] text-slate-400 mb-2">Porcentaje de retención para Contribuyentes Especiales (75% o 100%).</p>
          <div className="relative">
            <input 
              type="number" 
              step="0.01" 
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:border-indigo-500 outline-none transition-all"
              value={impuestos.retencionIva}
              onChange={e => setImpuestos({...impuestos, retencionIva: Number(e.target.value)})}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 block">Porcentaje Retención ISLR (Servicios)</label>
          <p className="text-[11px] text-slate-400 mb-2">Porcentaje base de retención de Impuesto Sobre la Renta (2%).</p>
          <div className="relative">
            <input 
              type="number" 
              step="0.01" 
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:border-indigo-500 outline-none transition-all"
              value={impuestos.retencionIslr}
              onChange={e => setImpuestos({...impuestos, retencionIslr: Number(e.target.value)})}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
          </div>
        </div>
      </div>
    </div>
  );

  // 5. Control de Correlativos
  const renderCorrelativos = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="mb-4">
        <h3 className="text-base font-black text-slate-900">Control de Correlativos y Series</h3>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Configura prefijos y próximos números de emisión. Se auto-incrementan con cada documento.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Facturas */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 font-black text-xs flex items-center justify-center">
                FAC
              </div>
              <h4 className="text-sm font-black text-slate-900">Facturas de Venta</h4>
            </div>
            <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              {formatDocumentNumber(facturacion.prefijoFactura, facturacion.correlativoFactura, 6)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">Prefijo</label>
              <input 
                type="text" 
                placeholder="Ej. FAC"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all font-mono"
                value={facturacion.prefijoFactura || ''}
                onChange={e => setFacturacion({...facturacion, prefijoFactura: e.target.value})}
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">Próximo Número</label>
              <input 
                type="text" 
                placeholder="000001"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all font-mono"
                value={facturacion.correlativoFactura || ''}
                onChange={e => setFacturacion({...facturacion, correlativoFactura: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* Notas de Entrega */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 font-black text-xs flex items-center justify-center">
                NE
              </div>
              <h4 className="text-sm font-black text-slate-900">Notas de Entrega / Despacho</h4>
            </div>
            <span className="font-mono text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              {formatDocumentNumber(facturacion.prefijoNotaEntrega, facturacion.correlativoNotaEntrega, 6)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">Prefijo</label>
              <input 
                type="text" 
                placeholder="Ej. NE"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all font-mono"
                value={facturacion.prefijoNotaEntrega || ''}
                onChange={e => setFacturacion({...facturacion, prefijoNotaEntrega: e.target.value})}
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">Próximo Número</label>
              <input 
                type="text" 
                placeholder="000001"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all font-mono"
                value={facturacion.correlativoNotaEntrega || ''}
                onChange={e => setFacturacion({...facturacion, correlativoNotaEntrega: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* Cotizaciones */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 font-black text-xs flex items-center justify-center">
                COT
              </div>
              <h4 className="text-sm font-black text-slate-900">Cotizaciones / Presupuestos</h4>
            </div>
            <span className="font-mono text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              {formatDocumentNumber(facturacion.prefijoCotizacion, facturacion.correlativoCotizacion, 6)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">Prefijo</label>
              <input 
                type="text" 
                placeholder="Ej. COT"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all font-mono"
                value={facturacion.prefijoCotizacion || ''}
                onChange={e => setFacturacion({...facturacion, prefijoCotizacion: e.target.value})}
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">Próximo Número</label>
              <input 
                type="text" 
                placeholder="000001"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all font-mono"
                value={facturacion.correlativoCotizacion || ''}
                onChange={e => setFacturacion({...facturacion, correlativoCotizacion: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* Recibos de Cobro */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 font-black text-xs flex items-center justify-center">
                REC
              </div>
              <h4 className="text-sm font-black text-slate-900">Recibos de Cobranza</h4>
            </div>
            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {formatDocumentNumber(facturacion.prefijoRecibo, facturacion.correlativoRecibo, 6)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">Prefijo</label>
              <input 
                type="text" 
                placeholder="REC-"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all font-mono"
                value={facturacion.prefijoRecibo || ''}
                onChange={e => setFacturacion({...facturacion, prefijoRecibo: e.target.value})}
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">Próximo Número</label>
              <input 
                type="text" 
                placeholder="000001"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-none transition-all font-mono"
                value={facturacion.correlativoRecibo || ''}
                onChange={e => setFacturacion({...facturacion, correlativoRecibo: e.target.value})}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 8. Usuarios & RBAC
  const renderUsuarios = () => {
    if (!isMaster) {
      return (
        <div className="p-12 text-center bg-slate-50/80 rounded-2xl border border-slate-200 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} />
          </div>
          <h3 className="text-base font-black text-slate-800">Acceso Exclusivo para Usuario Master</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-2">
            La creación de usuarios, gestión de contraseñas y asignación de empresas y permisos en el sistema está reservada exclusivamente para el Usuario Master.
          </p>
        </div>
      );
    }

    const filtered = users.filter(u => {
      const matchSearch = !searchUserTerm || (u.email || '').toLowerCase().includes(searchUserTerm.toLowerCase()) || (u.name || '').toLowerCase().includes(searchUserTerm.toLowerCase());
      const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      const matchStatus = userStatusFilter === 'all' || (userStatusFilter === 'active' && u.activo !== false) || (userStatusFilter === 'inactive' && u.activo === false);
      return matchSearch && matchRole && matchStatus;
    });

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900">Usuarios & Control de Acceso RBAC</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Gestión de cuentas autorizadas y permisos granulares por módulo.</p>
          </div>
          <button 
            onClick={() => { setIsAddingUser(true); setSelectedUser(null); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus size={15} /> + Nuevo Usuario
          </button>
        </div>

        {/* Modal / Formulario de Nuevo Usuario */}
        {isAddingUser && (
          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 animate-in fade-in duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="text-sm font-black text-slate-900">Registrar Nuevo Usuario con Contraseña</h4>
              <button onClick={() => setIsAddingUser(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${newUser.role === 'Master' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4`}>
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">Correo Electrónico</label>
                <input 
                  type="email" 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                  placeholder="usuario@empresa.com"
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">Contraseña Inicial</label>
                <div className="relative">
                  <input 
                    type={showNewUserPassword ? 'text' : 'password'}
                    className="w-full px-3 py-2 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    placeholder="Clave de acceso..."
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showNewUserPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 block">Rol Predeterminado</label>
                <select 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="Operador">Operador / Facturador</option>
                  <option value="Contador">Contador</option>
                  <option value="Vendedor">Vendedor</option>
                  <option value="SuperAdmin">Administrador</option>
                  <option value="Master">Master</option>
                </select>
              </div>
              {newUser.role === 'Master' && (
                <div>
                  <label className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider mb-1 block">Clave Operaciones Master</label>
                  <div className="relative">
                    <input 
                      type={showNewUserClaveOperaciones ? 'text' : 'password'}
                      className="w-full px-3 py-2 pr-8 bg-rose-50/50 border border-rose-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-rose-500"
                      placeholder="Ej. 19072828"
                      value={newUser.claveOperaciones}
                      onChange={e => setNewUser({...newUser, claveOperaciones: e.target.value})}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewUserClaveOperaciones(!showNewUserClaveOperaciones)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNewUserClaveOperaciones ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-end">
                <button 
                  onClick={handleCreateUser}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Confirmar Alta
                </button>
              </div>
            </div>

            {/* Checkboxes para tildar las empresas a las que tendrá acceso */}
            <div className="pt-2 border-t border-slate-200">
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Building2 size={13} className="text-indigo-600" />
                Empresas Autorizadas (Tildar las empresas donde puede entrar):
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
                {availableCompanies.map(c => {
                  const isChecked = newUser.companies.includes(c.id);
                  return (
                    <label 
                      key={c.id} 
                      className={`flex items-center gap-2.5 p-2 rounded-lg border transition-all cursor-pointer select-none ${
                        isChecked ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600 font-medium'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUser({ ...newUser, companies: [...newUser.companies, c.id] });
                          } else {
                            setNewUser({ ...newUser, companies: newUser.companies.filter(id => id !== c.id) });
                          }
                        }}
                        className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                      />
                      <span className="text-xs truncate">{c.nombre} ({c.rif || c.taxId || 'Sin RIF'})</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                Solo las empresas tildadas estarán visibles para el usuario en el selector de empresas.
              </p>
            </div>
          </div>
        )}

        {/* Modal de Permisos y Matriz Modular */}
        {selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-600" /> Permisos Modulares y Acceso a Empresas: {selectedUser.email}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Define en qué empresas puede entrar el usuario y sus permisos específicos.</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* Selector de Empresa para Permisos */}
              <div className="p-4 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 mr-2">Configurar para empresa:</span>
                {availableCompanies.map(comp => {
                  const isEnabled = selectedUser.companyConfigs?.[comp.id]?.enabled;
                  return (
                    <button 
                      key={comp.id}
                      onClick={() => setPermissionCompanyId(comp.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        permissionCompanyId === comp.id 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <span>{comp.nombre}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                        isEnabled 
                          ? (permissionCompanyId === comp.id ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-100 text-emerald-700')
                          : (permissionCompanyId === comp.id ? 'bg-slate-500 text-slate-200' : 'bg-slate-100 text-slate-500')
                      }`}>
                        {isEnabled ? '✓ Habilitada' : '✗ Bloqueada'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Contenido de Permisos de la Empresa Seleccionada */}
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {(() => {
                  const currentCompConfig = selectedUser.companyConfigs?.[permissionCompanyId] || { enabled: false, role: 'Operador', permissions: {} };
                  const selectedCompData = availableCompanies.find(c => c.id === permissionCompanyId);

                  return (
                    <>
                      {/* Banner de Control de Acceso (Tildar / Destildar empresa) */}
                      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                        currentCompConfig.enabled ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-100/90 border-slate-200'
                      }`}>
                        <label className="flex items-start sm:items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(currentCompConfig.enabled)}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setSelectedUser((prev: any) => {
                                if (!prev) return prev;
                                const currentConfig = prev.companyConfigs?.[permissionCompanyId] || {};
                                return {
                                  ...prev,
                                  companyConfigs: {
                                    ...prev.companyConfigs,
                                    [permissionCompanyId]: {
                                      ...currentConfig,
                                      enabled: isChecked
                                    }
                                  }
                                };
                              });
                            }}
                            className="w-5 h-5 mt-0.5 sm:mt-0 text-indigo-600 rounded cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-black text-slate-900 block">
                              {currentCompConfig.enabled ? 'Acceso Autorizado a esta Empresa (Tildada)' : 'Acceso Denegado (No tildada)'}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {currentCompConfig.enabled 
                                ? `El usuario puede ver y entrar a "${selectedCompData?.nombre || 'esta empresa'}".` 
                                : `El usuario NO podrá ver ni ingresar a "${selectedCompData?.nombre || 'esta empresa'}".`}
                            </span>
                          </div>
                        </label>

                        {currentCompConfig.enabled && (
                          <div className="flex items-center gap-2 pl-8 sm:pl-0">
                            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">Rol asignado:</label>
                            <select
                              value={currentCompConfig.role || 'Operador'}
                              onChange={(e) => {
                                const newRole = e.target.value;
                                setSelectedUser((prev: any) => {
                                  if (!prev) return prev;
                                  const currentConfig = prev.companyConfigs?.[permissionCompanyId] || {};
                                  return {
                                    ...prev,
                                    companyConfigs: {
                                      ...prev.companyConfigs,
                                      [permissionCompanyId]: {
                                        ...currentConfig,
                                        role: newRole
                                      }
                                    }
                                  };
                                });
                              }}
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
                            >
                              <option value="Operador">Operador / Facturador</option>
                              <option value="Contador">Contador</option>
                              <option value="Vendedor">Vendedor</option>
                              <option value="SuperAdmin">Administrador</option>
                              <option value="Master">Master</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Si la empresa NO está habilitada, mostrar aviso de bloqueo */}
                      {!currentCompConfig.enabled ? (
                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 my-4">
                          <ShieldAlert size={36} className="mx-auto text-slate-400 mb-2" />
                          <h4 className="text-sm font-bold text-slate-700">Acceso Bloqueado</h4>
                          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                            Esta empresa está destildada para este usuario. El usuario no podrá verla ni ingresar en ella. Para concederle acceso, active la casilla superior de autorización.
                          </p>
                        </div>
                      ) : (
                        /* Matriz de Permisos Modulares cuando la empresa está tildada */
                        <div>
                          <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                            Permisos por Módulo en {selectedCompData?.nombre}:
                          </p>
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="border-b border-slate-200 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                                <th className="pb-3">Módulo del Sistema</th>
                                <th className="pb-3 text-center w-24">Visualizar</th>
                                <th className="pb-3 text-center w-24">Crear / Editar</th>
                                <th className="pb-3 text-center w-24">Eliminar</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {SYSTEM_MODULES.map(mod => {
                                const Icon = mod.icon;
                                const userPerms = currentCompConfig.permissions?.[mod.id] || { view: true, create: true, delete: true };

                                return (
                                  <tr key={mod.id} className="hover:bg-slate-50/70">
                                    <td className="py-3 flex items-center gap-2.5 font-bold text-slate-800">
                                      <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                                        <Icon size={14} />
                                      </div>
                                      {mod.label}
                                    </td>
                                    <td className="py-3 text-center">
                                      <input 
                                        type="checkbox" 
                                        checked={userPerms.view}
                                        onChange={() => handleTogglePermission(mod.id, 'view')}
                                        className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                                      />
                                    </td>
                                    <td className="py-3 text-center">
                                      <input 
                                        type="checkbox" 
                                        checked={userPerms.create}
                                        onChange={() => handleTogglePermission(mod.id, 'create')}
                                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                                      />
                                    </td>
                                    <td className="py-3 text-center">
                                      <input 
                                        type="checkbox" 
                                        checked={userPerms.delete}
                                        onChange={() => handleTogglePermission(mod.id, 'delete')}
                                        className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setSelectedUser(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer">
                  Cancelar
                </button>
                <button onClick={handleSaveUserAccesses} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer">
                  Guardar Permisos
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabla de Usuarios */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-5">Usuario</th>
                <th className="py-3.5 px-4">Rol Asignado</th>
                <th className="py-3.5 px-4">Estado</th>
                <th className="py-3.5 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u, i) => (
                <tr key={u.id || i} className="hover:bg-indigo-50/20 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                        {(u.email || 'US').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-black text-slate-900 text-xs block">{u.email}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{u.name || 'Sin nombre'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {u.role || 'Operador'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.activo !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.activo !== false ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {u.activo !== false ? 'Activo' : 'Suspendido'}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Botón de Cambiar Contraseña Exclusivo para Rol Master */}
                      {(userRole === 'Master' || currentUser?.role === 'Master') && (
                        <button 
                          onClick={() => { 
                            setUserToChangePassword(u); 
                            setNewPasswordForUser(''); 
                            setNewClaveOperacionesForUser(u.claveOperaciones || u.clave_operaciones || (u.role === 'Master' ? globalMasterClave : '') || '');
                          }}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="Gestionar Contraseña de Acceso y Clave de Operaciones"
                        >
                          <KeyRound size={12} /> Clave
                        </button>
                      )}

                      <button 
                        onClick={() => setSelectedUser(u)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <SettingsIcon size={12} /> Permisos
                      </button>
                      {u.role !== 'Master' && (
                        <button 
                          onClick={() => handleDeleteUser(u.email)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar usuario"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Modal para Cambiar Contraseña y Clave de Operaciones */}
        {userToChangePassword && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 border border-slate-100">
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-600" /> Reasignar Contraseñas del Usuario
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-600 font-bold">{userToChangePassword.email}</span>
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-200 text-slate-700">
                      {userToChangePassword.role || 'Operador'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setUserToChangePassword(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-900 text-xs font-medium leading-relaxed">
                  Como usuario <strong>Master</strong>, tienes la autorización de seguridad exclusiva para registrar o actualizar las contraseñas de acceso y de operaciones de este usuario.
                </div>

                {/* 1. Contraseña de Acceso al Sistema */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Nueva Contraseña de Acceso (Inicio de Sesión)
                  </label>
                  <div className="relative">
                    <input
                      type={showModalPassword ? 'text' : 'password'}
                      placeholder="Ingrese nueva clave de inicio de sesión..."
                      className="w-full px-3.5 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                      value={newPasswordForUser}
                      onChange={e => setNewPasswordForUser(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPassword(!showModalPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showModalPassword ? 'Ocultar' : 'Mostrar'}
                    >
                      {showModalPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Dejar en blanco para mantener la contraseña de acceso actual.
                  </p>
                </div>

                {/* 2. Clave Especial de Operaciones Master */}
                {(userToChangePassword.role === 'Master' || userToChangePassword.role === 'SuperAdmin') && (
                  <div>
                    <label className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Clave Especial de Operaciones Master</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Seguridad Crítica</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showModalClaveOperaciones ? 'text' : 'password'}
                        placeholder="Ej. 1709 o 19072828"
                        className="w-full px-3.5 py-2.5 pr-10 bg-rose-50/50 border border-rose-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-rose-500 transition-all font-mono"
                        value={newClaveOperacionesForUser}
                        onChange={e => setNewClaveOperacionesForUser(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowModalClaveOperaciones(!showModalClaveOperaciones)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showModalClaveOperaciones ? 'Ocultar' : 'Mostrar'}
                      >
                        {showModalClaveOperaciones ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {userToChangePassword.claveOperaciones || globalMasterClave ? (
                        <>Clave de operaciones actual: <strong className="text-slate-800 font-mono font-bold">{userToChangePassword.claveOperaciones || globalMasterClave}</strong></>
                      ) : (
                        'Dejar en blanco para conservar la clave de operaciones actual (19072828).'
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
                <button onClick={() => setUserToChangePassword(null)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer">
                  Cancelar
                </button>
                <button onClick={handleSaveNewPassword} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer">
                  Guardar Claves
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 9. Carga Masiva
  const renderImportacion = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <BulkUploadConfig 
        contactos={contactos}
        servicios={servicios}
        cuentasContables={cuentasContables}
        comprobantes={comprobantes}
        bancos={bancos}
        movimientosBancos={movimientosBancos}
        cxc={cxc}
        cxp={cxp}
        products={products}
        activosFijos={activosFijos}
        onSave={onSave} 
        showToast={showToast} 
      />
    </div>
  );

  // 10. Respaldos & Gobernanza BD
  const renderRespaldos = () => (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="mb-4">
        <h3 className="text-base font-black text-slate-900">Gobernanza de Base de Datos & Snapshots</h3>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Genera y descarga copias de seguridad portables de toda la información contable y comercial.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Exportación JSON */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">Respaldo en JSON Estructurado</h4>
              <p className="text-xs text-slate-400 font-medium">Portable para restauración o migración de servidor.</p>
            </div>
          </div>
          <button 
            onClick={handleDownloadJSON}
            disabled={isExporting}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
          >
            <Download size={14} /> Descargar Snapshot JSON
          </button>
        </div>

        {/* Exportación SQL */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">Volcado SQL Relacional</h4>
              <p className="text-xs text-slate-400 font-medium">Script SQL estándar con comandos INSERT.</p>
            </div>
          </div>
          <button 
            onClick={handleDownloadSQL}
            disabled={isExporting}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
          >
            <Download size={14} /> Descargar Dump SQL
          </button>
        </div>
      </div>

      {/* Zona de Peligro */}
      <div className="mt-8 p-6 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-4">
        <div className="flex items-center gap-3 text-rose-700">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <h4 className="text-sm font-black text-rose-900">Zona de Peligro: Eliminación de Empresa</h4>
            <p className="text-xs text-rose-700 font-medium mt-0.5">Esta acción eliminará de forma irreversible la entidad actual y todos sus registros asociados.</p>
          </div>
        </div>

        {!showDeleteConfirm ? (
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            Eliminar esta Empresa...
          </button>
        ) : (
          <div className="p-4 bg-white rounded-xl border border-rose-200 space-y-3 animate-in fade-in">
            <p className="text-xs text-slate-600 font-medium">
              Escriba el nombre exacto de la empresa: <span className="font-bold font-mono text-rose-600">{empresa?.nombre}</span> para confirmar.
            </p>
            <input 
              type="text" 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              placeholder="Nombre exacto de la empresa"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer">
                Cancelar
              </button>
              <button 
                onClick={handleDeleteCompany}
                disabled={deleteConfirmText.trim() !== (empresa?.nombre || '').trim() || isDeletingCompany}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                Confirmar Eliminación Definitiva
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
  const renderModalCuenta = () => {
    return (
      <CuentaContableModal
        isOpen={showCuentaModal}
        onClose={() => {
          setShowCuentaModal(false);
          setActiveConfigKey(null);
        }}
        onSelect={async (c) => {
          if (activeConfigKey) {
            const nextContabilidad = { ...contabilidad, [activeConfigKey]: c.id };
            setContabilidad(nextContabilidad);
            if (onSave) {
              const updatedConfig = {
                ...configContable,
                ...nextContabilidad,
                ...facturacion,
                ...impuestos,
                ...importacion,
                workingYear: localEmpresa.anoInicio || workingYear || String(currentYear)
              };
              try {
                await onSave('accounting-config', updatedConfig);
                if (showToast) {
                  showToast(`Cuenta ${c.codigo} - ${c.nombre} enlazada y guardada`, 'success');
                }
              } catch (e) {
                console.error("Error al guardar cuenta contable:", e);
              }
            }
          }
          setShowCuentaModal(false);
          setActiveConfigKey(null);
        }}
        cuentasContables={cuentasContables}
        selectedCuentaId={activeConfigKey ? (contabilidad as any)[activeConfigKey] : ''}
      />
    );
  };

  return (
    <div className="px-3 sm:px-6 pt-1 pb-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Top Breadcrumb & Status */}
      <div className="mb-3 flex items-center justify-between">
        <BackButton to="/" label="Volver al Inicio" />
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200/80">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>ERP Multiempresa • Activo</span>
        </span>
      </div>

      {/* Main Header Toolbar */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <SettingsIcon className="w-5 h-5" />
            </div>
            Configuración del Sistema
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Gobernanza corporativa, mapeo NIIF, parámetros fiscales, usuarios y correlativos
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave}
            className="inline-flex items-center justify-center gap-2 rounded-xl text-xs font-bold transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 h-10 px-5 cursor-pointer active:scale-95"
          >
            <Save size={16} /> 
            <span>Guardar Configuración</span>
          </button>
        </div>
      </div>

      {/* Control Center Layout (Categorized Sidebar + Content) */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Sidebar Nav */}
        <aside className="w-full lg:w-72 shrink-0 space-y-6">
          {NAV_SECTIONS.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1.5">
              <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3">
                {section.group}
              </h5>
              <div className="space-y-1">
                {section.tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
                        isActive 
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-bold' 
                          : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 group-hover:text-indigo-600'
                        }`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className={`text-xs block truncate ${isActive ? 'font-black text-white' : 'font-bold text-slate-800'}`}>
                            {tab.label}
                          </span>
                          <span className={`text-[10px] block truncate ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                            {tab.desc}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={14} className={`shrink-0 transition-transform ${isActive ? 'translate-x-0.5 text-white' : 'text-slate-400 group-hover:translate-x-0.5'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* Content Stage */}
        <main className="flex-1 w-full bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 md:p-8">
          {activeTab === 'empresa' && renderEmpresa()}
          {activeTab === 'contabilidad' && renderContabilidad()}
          {activeTab === 'impuestos' && renderImpuestos()}
          {activeTab === 'correlativos' && renderCorrelativos()}
          {activeTab === 'usuarios' && renderUsuarios()}
          {activeTab === 'importacion' && renderImportacion()}
          {activeTab === 'respaldos' && renderRespaldos()}
          {activeTab === 'auditoria' && <AuditLogsViewer companyId={activeCompanyId || ''} />}
          {activeTab === 'acerca' && renderAcerca()}
        </main>
      </div>

      {renderModalCuenta()}

      {/* Modal de Crear Nueva Empresa */}
      {showCreateCompanyModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 border border-slate-100">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Registrar Nueva Empresa</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Crea un nuevo entorno fiscal y contable independiente.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateCompanyModal(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 block">
                  Nombre o Razón Social <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Distribuidora Los Andes C.A."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                  value={newCompName}
                  onChange={e => setNewCompName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 block">
                  RIF / Identificación Fiscal
                </label>
                <input
                  type="text"
                  placeholder="Ej. J-12345678-9"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                  value={newCompTaxId}
                  onChange={e => setNewCompTaxId(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Calendar size={13} className="text-indigo-600" />
                  Año / Ejercicio Fiscal de Inicio
                </label>
                <select
                  value={newCompYear}
                  onChange={e => setNewCompYear(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-500 transition-all cursor-pointer"
                >
                  {Array.from({ length: 6 }, (_, i) => String(currentYear - 3 + i)).map(y => (
                    <option key={y} value={y}>
                      Ejercicio Contable - Año {y} {y === String(currentYear) ? '(Año en Curso)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {availableCompanies.length > 0 && (
                <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-2.5">
                  <p className="text-[10px] font-black text-indigo-900 uppercase tracking-wider">
                    Duplicar Estructura (Opcional)
                  </p>
                  
                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 hover:text-indigo-900">
                    <input
                      type="checkbox"
                      checked={copyPlanFromComp}
                      onChange={e => setCopyPlanFromComp(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span>Copiar Plan de Cuentas NIIF de otra empresa</span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 hover:text-indigo-900">
                    <input
                      type="checkbox"
                      checked={copyContactsFromComp}
                      onChange={e => setCopyContactsFromComp(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span>Copiar Directorio de Contactos (Clientes y Proveedores)</span>
                  </label>

                  {(copyPlanFromComp || copyContactsFromComp) && (
                    <div className="pt-2 animate-in fade-in">
                      <label className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mb-1 block">
                        Empresa de Origen para Copiar
                      </label>
                      <select
                        value={selectedSourceComp}
                        onChange={e => setSelectedSourceComp(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                      >
                        {availableCompanies.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.taxId || 'Sin RIF'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button 
                onClick={() => setShowCreateCompanyModal(false)} 
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  if (!newCompName.trim()) {
                    if (showToast) showToast('Ingrese el nombre de la empresa', 'error');
                    return;
                  }
                  const docId = crypto.randomUUID();
                  const newCompanyObj = {
                    id: docId,
                    name: newCompName.trim(),
                    taxId: newCompTaxId.trim() || 'J-00000000-0',
                    nombre: newCompName.trim(),
                    rif: newCompTaxId.trim() || 'J-00000000-0',
                    anoInicio: newCompYear,
                    workingYear: newCompYear,
                    direccion: '',
                    telefono: '',
                    email: '',
                    monedaPrincipal: 'USD',
                    monedaSecundaria: 'VES',
                    tipoContribuyente: 'ordinario',
                    tipoEmpresa: 'comercial',
                    habilitarPOS: true,
                    habilitarVendedores: true,
                    habilitarPedidos: true,
                    habilitarTasaReferencial: false
                  };
                  const res = await dbSaveEmpresa(newCompanyObj);
                  await dbSaveConfiguracionContable({ workingYear: newCompYear }, docId);

                  if (copyPlanFromComp && selectedSourceComp) {
                    const { dbFetchCuentasContables, dbSaveCuentaContable } = await import('../services/db');
                    const sourceAccounts = await dbFetchCuentasContables(selectedSourceComp);
                    for (const acc of sourceAccounts) {
                      await dbSaveCuentaContable({
                        ...acc,
                        id: crypto.randomUUID(),
                        saldoActual: 0
                      }, docId);
                    }
                  }

                  if (copyContactsFromComp && selectedSourceComp) {
                    const { dbFetchContactos, dbSaveContacto } = await import('../services/db');
                    const sourceContacts = await dbFetchContactos(selectedSourceComp);
                    for (const ct of sourceContacts) {
                      await dbSaveContacto({
                        ...ct,
                        id: crypto.randomUUID(),
                        saldo: 0,
                        saldoCxp: 0
                      }, docId);
                    }
                  }

                  if (res && !res.success) {
                    if (showToast) showToast(`Advertencia de BD: ${res.error}`, 'error');
                  }
                  const updated = [...availableCompanies, newCompanyObj];
                  setAvailableCompanies(updated);
                  setWorkingYear(newCompYear);
                  setActiveCompanyId(docId);
                  setShowCreateCompanyModal(false);
                  setNewCompName('');
                  setNewCompTaxId('');
                  setNewCompYear(String(currentYear));
                  setCopyPlanFromComp(false);
                  setCopyContactsFromComp(false);
                  if (showToast) showToast(`Empresa "${newCompanyObj.name}" creada y sincronizada`, 'success');
                }} 
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Crear Empresa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
