/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { CompanyProvider, useCompany } from "./context/CompanyContext";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import CompanySelector from "./components/CompanySelector";
import PageLoadingFallback from "./components/common/PageLoadingFallback";

// Lazy-loaded routes for high-performance bundle code splitting
const Contacts = lazy(() => import("./pages/Contacts"));
const ContactsMenu = lazy(() => import("./pages/ContactsMenu"));
const Banks = lazy(() => import("./pages/Banks"));
const BanksMenu = lazy(() => import("./pages/BanksMenu"));
const Receivables = lazy(() => import("./pages/Receivables"));
const ReceivablesMenu = lazy(() => import("./pages/ReceivablesMenu"));
const Payables = lazy(() => import("./pages/Payables"));
const PayablesMenu = lazy(() => import("./pages/PayablesMenu"));
const Settings = lazy(() => import("./pages/Settings"));
const Accounting = lazy(() => import("./pages/Accounting"));
const Purchases = lazy(() => import("./pages/Purchases"));
const PurchasesMenu = lazy(() => import("./pages/PurchasesMenu"));
const PurchaseForm = lazy(() => import("./pages/PurchaseForm"));
const Inventory = lazy(() => import("./pages/Inventory"));
const InventoryMenu = lazy(() => import("./pages/InventoryMenu"));
const Invoicing = lazy(() => import("./pages/Invoicing"));
const InvoiceForm = lazy(() => import("./pages/InvoiceForm"));
const ChartOfAccounts = lazy(() => import("./pages/ChartOfAccounts"));
const AccountingEntries = lazy(() => import("./pages/AccountingEntries"));
const FiscalModule = lazy(() => import("./pages/FiscalModule"));
const AccountingConfig = lazy(() => import("./pages/AccountingConfig"));
const FixedAssetsModule = lazy(() => import("./pages/FixedAssetsModule"));
const ComprobanteMovimientoBanco = lazy(() => import("./pages/ComprobanteMovimientoBanco"));
const Reports = lazy(() => import("./pages/Reports"));
const PosLotes = lazy(() => import("./pages/PosLotes"));

import {
  isUUID,
  dbFetchContactos,
  dbSaveContacto,
  dbDeleteContacto,
  dbClearContactos,
  dbSaveEmpresa,
  dbFetchCuentasContables,
  dbSaveCuentaContable,
  dbDeleteCuentaContable,
  dbClearCuentasContables,
  dbFetchBancos,
  dbSaveBanco,
  dbDeleteBanco,
  dbClearBancos,
  dbFetchMovimientosBancos,
  dbSaveMovimientoBanco,
  dbDeleteMovimientoBanco,
  dbClearMovimientosBancos,
  dbFetchConfiguracionContable,
  dbSaveConfiguracionContable,
  dbFetchCxc,
  dbSaveCxc,
  dbDeleteCxc,
  dbClearCxc,
  dbFetchCxp,
  dbSaveCxp,
  dbDeleteCxp,
  dbClearCxp,
  dbFetchCobranzas,
  dbSaveCobranza,
  dbDeleteCobranza,
  dbFetchPagosRealizados,
  dbSavePagoRealizado,
  dbDeletePagoRealizado,
  dbFetchComprobantes,
  dbSaveComprobante,
  dbDeleteComprobante,
  dbClearComprobantes,
  dbFetchServicios,
  dbSaveServicio,
  dbDeleteServicio,
  dbClearServicios,
  dbSaveSolicitudBanco,
  dbDeleteSolicitudBanco,
  dbFetchCategoriasActivos,
  dbSaveCategoriaActivo,
  dbDeleteCategoriaActivo,
  dbSaveCategoriasActivos,
  dbFetchActivosFijos,
  dbSaveActivoFijo,
  dbDeleteActivoFijo,
  dbClearActivosFijos,
  dbFetchDepreciaciones,
  dbSaveDepreciacion,
  dbDeleteDepreciacion,
  dbSaveDepreciaciones,
  dbFetchProducts,
  dbSaveProduct,
  dbDeleteProduct,
  dbClearProducts,
  dbFetchCategoriasProducto,
  dbSaveCategoriaProducto,
  dbDeleteCategoriaProducto,
  dbFetchMovimientosInventario,
  dbSaveMovimientoInventario,
  dbFetchFacturasVenta,
  dbSaveFacturaVenta,
  dbDeleteFacturaVenta,
  dbFetchFacturasCompra,
  dbSaveFacturaCompra,
  dbDeleteFacturaCompra,
  dbSaveLotePos,
  dbDeleteLotePos,
  dbSaveTerminalPos,
  dbDeleteTerminalPos,
  dbFetchAlmacenes,
  dbSaveAlmacen,
  dbDeleteAlmacen
} from "./services/db";
import { supabase, isSupabaseConfigured } from "./lib/supabase";

const initialConfiguracionContable = {
  cuentaCxc: "",
  cuentaCxp: "",
  cuentaCaja: "",
  cuentaBancos: "",
  cuentaAnticipoRecibido: "",
  cuentaAnticipoOtorgado: "",
  cuentaDebitoFiscal: "",
  cuentaCreditoFiscal: "",
  cuentaIvaRetenidoVentas: "",
  cuentaIslrRetenidoVentas: "",
  cuentaIvaRetenidoCompras: "",
  cuentaIslrRetenidoCompras: "",
  cuentaGananciaDiferencialCambiario: "",
  cuentaPerdidaDiferencialCambiario: "",
  prefijoFactura: "",
  correlativoFactura: "000001",
  prefijoCotizacion: "",
  correlativoCotizacion: "000001",
  prefijoNotaEntrega: "",
  correlativoNotaEntrega: "000001",
  prefijoRecibo: "REC-",
  correlativoRecibo: "000001",
  diasVencimientoDefault: 15,
  notasDefault: "Los pagos en bolívares se calcularán a la tasa del BCV del día del pago.",
  usaMaquinaFiscal: false,
  marcaMaquinaFiscal: "bixolon",
  puertoMaquinaFiscal: "COM1",
  formatoImpresion: "estandar",
  textoFacturadoA: "Facturado a:",
  textoTotalPagar: "Total a Pagar",
  textoMensajeAgradecimiento: "Gracias por su preferencia",
  textoTerminosCondiciones: "Términos y Condiciones estándar.",
  cuentaIngresos: "4.1",
  retencionIvaPorcentaje: 75,
  retencionIslrPorcentaje: 2
};

export default function App() {
  return (
    <CompanyProvider>
      <AppContent />
    </CompanyProvider>
  );
}

function AppContent() {
  const { 
    workingYear, 
    currentUser, 
    logout, 
    activeCompanyId, 
    availableCompanies, 
    setAvailableCompanies,
    syncVersion
  } = useCompany();

  // Estados locales en memoria alimentados por Supabase para la empresa activa
  const [bancos, setBancos] = useState<any[]>([]);
  const [movimientosBancos, setMovimientosBancos] = useState<any[]>([]);
  const [cxc, setCxc] = useState<any[]>([]);
  const [cxp, setCxp] = useState<any[]>([]);
  const [cobranzas, setCobranzas] = useState<any[]>([]);
  const [pagosRealizados, setPagosRealizados] = useState<any[]>([]);
  const [cuentasContables, setCuentasContables] = useState<any[]>([]);
  const [comprobantes, setComprobantes] = useState<any[]>([]);
  const [configContable, setConfigContable] = useState<any>(initialConfiguracionContable);
  const [servicios, setServicios] = useState<any[]>([]);
  const [categoriasActivos, setCategoriasActivos] = useState<any[]>([]);
  const [activosFijos, setActivosFijos] = useState<any[]>([]);
  const [depreciaciones, setDepreciaciones] = useState<any[]>([]);
  const [contactos, setContactos] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categoriasProducto, setCategoriasProducto] = useState<any[]>([]);
  const [almacenes, setAlmacenes] = useState<any[]>([]);
  const [movimientosInventario, setMovimientosInventario] = useState<any[]>([]);
  const [facturasVenta, setFacturasVenta] = useState<any[]>([]);
  const [facturasCompra, setFacturasCompra] = useState<any[]>([]);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const [empresa, setEmpresa] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("erp_cached_active_company");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.name || parsed.nombre)) {
          return {
            id: parsed.id,
            nombre: parsed.name || parsed.nombre,
            rif: parsed.taxId || parsed.rif || 'J-00000000-0',
            direccion: parsed.direccion || '',
            telefono: parsed.telefono || '',
            email: parsed.email || '',
            logo: parsed.logo || '',
            monedaPrincipal: parsed.monedaPrincipal || parsed.moneda_principal || 'USD',
            monedaSecundaria: parsed.monedaSecundaria || parsed.moneda_secundaria || 'VES',
            tipoContribuyente: parsed.tipoContribuyente || parsed.tipo_contribuyente || 'ordinario',
            tipoEmpresa: parsed.tipoEmpresa || parsed.tipo_empresa || 'comercial',
            habilitarPOS: parsed.habilitarPOS ?? parsed.habilitar_pos ?? true,
            habilitarVendedores: parsed.habilitarVendedores ?? parsed.habilitar_vendedores ?? true,
            habilitarPedidos: parsed.habilitarPedidos ?? parsed.habilitar_pedidos ?? true,
            habilitarTasaReferencial: parsed.habilitarTasaReferencial ?? parsed.habilitar_tasa_referencial ?? false,
            ...parsed,
          };
        }
      }
    } catch {}
    return {
      nombre: "Halley ERP",
      rif: "J-00000000-0",
      direccion: "",
      telefono: "",
      email: "",
      monedaPrincipal: "USD",
      monedaSecundaria: "VES",
      tipoContribuyente: "ordinario",
      tipoEmpresa: "comercial",
      habilitarPOS: true,
      habilitarVendedores: true,
      habilitarPedidos: true,
    };
  });

  // Mantener sincronizado empresa con availableCompanies y activeCompanyId en todo momento
  useEffect(() => {
    if (!activeCompanyId || availableCompanies.length === 0) return;
    const found = availableCompanies.find((c) => c.id === activeCompanyId);
    if (found) {
      const synched = {
        id: found.id,
        nombre: found.name || (found as any).nombre || 'Halley ERP',
        rif: found.taxId || (found as any).rif || 'J-00000000-0',
        direccion: (found as any).direccion || '',
        telefono: (found as any).telefono || '',
        email: (found as any).email || '',
        logo: (found as any).logo || '',
        monedaPrincipal: (found as any).monedaPrincipal || (found as any).moneda_principal || 'USD',
        monedaSecundaria: (found as any).monedaSecundaria || (found as any).moneda_secundaria || 'VES',
        tipoContribuyente: (found as any).tipoContribuyente || (found as any).tipo_contribuyente || 'ordinario',
        tipoEmpresa: (found as any).tipoEmpresa || (found as any).tipo_empresa || 'comercial',
        habilitarPOS: (found as any).habilitarPOS ?? (found as any).habilitar_pos ?? true,
        habilitarVendedores: (found as any).habilitarVendedores ?? (found as any).habilitar_vendedores ?? true,
        habilitarPedidos: (found as any).habilitarPedidos ?? (found as any).habilitar_pedidos ?? true,
        habilitarTasaReferencial: (found as any).habilitarTasaReferencial ?? (found as any).habilitar_tasa_referencial ?? false,
        ...(found as any),
      };
      setEmpresa(synched);
      try {
        localStorage.setItem("erp_cached_active_company", JSON.stringify(synched));
      } catch {}
    }
  }, [availableCompanies, activeCompanyId]);

  // Cargar datos operativos de la empresa activa desde Supabase
  useEffect(() => {
    if (!currentUser || !activeCompanyId) {
      setContactos([]);
      setCuentasContables([]);
      setBancos([]);
      setMovimientosBancos([]);
      setCxc([]);
      setCxp([]);
      setCobranzas([]);
      setPagosRealizados([]);
      setComprobantes([]);
      setServicios([]);
      setCategoriasActivos([]);
      setActivosFijos([]);
      setDepreciaciones([]);
      setProducts([]);
      setAlmacenes([]);
      setMovimientosInventario([]);
      setFacturasVenta([]);
      setFacturasCompra([]);
      return;
    }

    // Resetear inmediatamente estados para evitar contaminación de la empresa previa
    setContactos([]);
    setCuentasContables([]);
    setBancos([]);
    setMovimientosBancos([]);
    setCxc([]);
    setCxp([]);
    setCobranzas([]);
    setPagosRealizados([]);
    setComprobantes([]);
    setServicios([]);
    setCategoriasActivos([]);
    setActivosFijos([]);
    setDepreciaciones([]);
    setProducts([]);
    setCategoriasProducto([]);
    setMovimientosInventario([]);
    setFacturasVenta([]);

    let isCurrent = true;

    async function loadCompanyDataFromSupabase() {
      try {
        // Lote 1: Entidades maestras contables y bancarias (Inmediato)
        const [
          dbContacts,
          dbAccounts,
          dbBanksList,
          dbBankTx,
          dbConfig
        ] = await Promise.all([
          dbFetchContactos(activeCompanyId!),
          dbFetchCuentasContables(activeCompanyId!),
          dbFetchBancos(activeCompanyId!),
          dbFetchMovimientosBancos(activeCompanyId!),
          dbFetchConfiguracionContable(activeCompanyId!)
        ]);

        if (!isCurrent) return;
        setContactos(dbContacts || []);
        setCuentasContables(dbAccounts || []);
        setBancos(dbBanksList || []);
        setMovimientosBancos(dbBankTx || []);
        setConfigContable(dbConfig || { ...initialConfiguracionContable, empresaId: activeCompanyId });

        // Lote 2: Cuentas por cobrar y pagar, cobranzas y pagos (Progresivo)
        const [
          dbCxcList,
          dbCxpList,
          dbCobranzasList,
          dbPagosList,
          dbComprobantesList
        ] = await Promise.all([
          dbFetchCxc(activeCompanyId!),
          dbFetchCxp(activeCompanyId!),
          dbFetchCobranzas(activeCompanyId!),
          dbFetchPagosRealizados(activeCompanyId!),
          dbFetchComprobantes(activeCompanyId!)
        ]);

        if (!isCurrent) return;
        setCxc(dbCxcList || []);
        setCxp(dbCxpList || []);
        setCobranzas(dbCobranzasList || []);
        setPagosRealizados(dbPagosList || []);
        setComprobantes(dbComprobantesList || []);

        // Lote 3: Inventario, almacenes y servicios (Progresivo)
        const [
          dbCategoriasList,
          dbProductsList,
          dbMovimientosInvList,
          dbServiciosList,
          dbAlmacenesList
        ] = await Promise.all([
          dbFetchCategoriasProducto(activeCompanyId!),
          dbFetchProducts(activeCompanyId!),
          dbFetchMovimientosInventario(activeCompanyId!),
          dbFetchServicios(activeCompanyId!),
          dbFetchAlmacenes(activeCompanyId!)
        ]);

        if (!isCurrent) return;
        setCategoriasProducto(dbCategoriasList || []);
        setProducts(dbProductsList || []);
        setMovimientosInventario(dbMovimientosInvList || []);
        setServicios(dbServiciosList || []);
        setAlmacenes(dbAlmacenesList || []);

        // Lote 4: Facturación y Activos Fijos (Progresivo)
        const [
          dbFacturasVentaList,
          dbFacturasCompraList,
          dbCategoriasActivos,
          dbActivosFijosList,
          dbDepreciacionesList
        ] = await Promise.all([
          dbFetchFacturasVenta(activeCompanyId!),
          dbFetchFacturasCompra(activeCompanyId!),
          dbFetchCategoriasActivos(activeCompanyId!),
          dbFetchActivosFijos(activeCompanyId!),
          dbFetchDepreciaciones(activeCompanyId!)
        ]);

        if (!isCurrent) return;
        setFacturasVenta(dbFacturasVentaList || []);
        setFacturasCompra(dbFacturasCompraList || []);
        setCategoriasActivos(dbCategoriasActivos || []);
        setActivosFijos(dbActivosFijosList || []);
        setDepreciaciones(dbDepreciacionesList || []);
      } catch (err) {
        console.warn("Error cargando datos de Supabase:", err);
      }
    }

    loadCompanyDataFromSupabase();
    return () => {
      isCurrent = false;
    };
  }, [activeCompanyId, currentUser?.id, syncVersion]);

  // Sincronización en Tiempo Real (Supabase Realtime) para evitar desincronización entre múltiples usuarios
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !activeCompanyId || !isUUID(activeCompanyId) || !currentUser) {
      return;
    }

    const channelName = `realtime-sync-${activeCompanyId}`;
    const channel = supabase.channel(channelName);

    // 1. Cambios en Productos (Stock, Costos, Precios)
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'productos',
        filter: `empresa_id=eq.${activeCompanyId}`
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setProducts((prev) => {
            if (prev.some((p) => p.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          setProducts((prev) =>
            prev.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p))
          );
        } else if (payload.eventType === 'DELETE') {
          setProducts((prev) => prev.filter((p) => p.id !== (payload.old as any).id));
        }
      }
    );

    // 2. Cambios en Facturas de Venta
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'facturas_venta',
        filter: `empresa_id=eq.${activeCompanyId}`
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setFacturasVenta((prev) => {
            if (prev.some((f) => f.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          setFacturasVenta((prev) =>
            prev.map((f) => (f.id === payload.new.id ? { ...f, ...payload.new } : f))
          );
        } else if (payload.eventType === 'DELETE') {
          setFacturasVenta((prev) => prev.filter((f) => f.id !== (payload.old as any).id));
        }
      }
    );

    // 3. Cambios en Cuentas por Cobrar (Saldos y Abonos)
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'cuentas_cobrar_cxc',
        filter: `empresa_id=eq.${activeCompanyId}`
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setCxc((prev) => {
            if (prev.some((c) => c.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          setCxc((prev) =>
            prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
          );
        } else if (payload.eventType === 'DELETE') {
          setCxc((prev) => prev.filter((c) => c.id !== (payload.old as any).id));
        }
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCompanyId, currentUser?.id]);

  const clientes = contactos.filter((c) => c.type === "customer" || c.type === "both");
  const proveedores = contactos.filter((c) => c.type === "supplier" || c.type === "both");

  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Filtros por año de trabajo
  const filteredCxc = useMemo(() => {
    return cxc.filter((item) => {
      const d = item.fecha || item.fecha_emision || item.date;
      if (!d || typeof d !== "string") return true;
      return d.substring(0, 4) === workingYear;
    });
  }, [cxc, workingYear]);

  const filteredCxp = useMemo(() => {
    return cxp.filter((item) => {
      const d = item.fecha || item.fecha_emision || item.date;
      if (!d || typeof d !== "string") return true;
      return d.substring(0, 4) === workingYear;
    });
  }, [cxp, workingYear]);

  const filteredCobranzas = useMemo(() => {
    return cobranzas.filter((item) => {
      const d = item.fecha || item.date;
      if (!d || typeof d !== "string") return true;
      return d.substring(0, 4) === workingYear;
    });
  }, [cobranzas, workingYear]);

  const filteredPagosRealizados = useMemo(() => {
    return pagosRealizados.filter((item) => {
      const d = item.fecha || item.date;
      if (!d || typeof d !== "string") return true;
      return d.substring(0, 4) === workingYear;
    });
  }, [pagosRealizados, workingYear]);

  const filteredComprobantes = useMemo(() => {
    return comprobantes.filter((item) => {
      const d = item.fecha || item.date;
      if (!d || typeof d !== "string") return true;
      return d.substring(0, 4) === workingYear;
    });
  }, [comprobantes, workingYear]);

  const filteredMovimientosBancos = useMemo(() => {
    return movimientosBancos.filter((item) => {
      const d = item.fecha || item.date;
      if (!d || typeof d !== "string") return true;
      return d.substring(0, 4) === workingYear;
    });
  }, [movimientosBancos, workingYear]);

  // Manejador central para guardar o actualizar entidades en Supabase
  const handleSave = async (collectionName: string, data: any) => {
    const cid = activeCompanyId || "default";
    const updateCollection = (setter: React.Dispatch<React.SetStateAction<any[]>>, itemData: any) => {
      setter((prev) => {
        if (!itemData) return prev;
        if (itemData._delete) {
          return prev.filter((i) => String(i.id) !== String(itemData.id));
        }
        const index = prev.findIndex((i) => String(i.id) === String(itemData.id));
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], ...itemData };
          return updated;
        }
        return [...prev, itemData];
      });
    };

    const mergeArrayCollection = (setter: React.Dispatch<React.SetStateAction<any[]>>, items: any[], keyField = 'id') => {
      setter((prev) => {
        const map = new Map<string, any>(prev.map((i: any) => [String(i[keyField] || i.id), i]));
        for (const item of items) {
          const key = String(item[keyField] || item.id);
          map.set(key, { ...(map.get(key) || {}), ...item });
        }
        return Array.from(map.values());
      });
    };

    // Helper de concurrencia controlada para evitar cascada secuencial O(N)
    const batchSave = async <T,>(items: T[], fn: (item: T) => Promise<any>, batchSize = 10) => {
      for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        await Promise.all(chunk.map(fn));
      }
    };

    switch (collectionName) {
      case "contactos":
      case "contacts":
      case "clientes":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setContactos([]);
            await dbClearContactos(cid);
          } else {
            mergeArrayCollection(setContactos, data);
            await batchSave(data, (item) => dbSaveContacto(item, cid));
          }
        } else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          updateCollection(setContactos, itemWithId);
          if (data._delete) await dbDeleteContacto(data.id, cid);
          else await dbSaveContacto(itemWithId, cid);
        }
        break;
      case "consignatarios":
        await dbClearContactos(cid, "customer");
        setContactos((prev) => prev.filter((c: any) => c.type !== "customer" && c.type !== "both"));
        break;
      case "proveedores":
        await dbClearContactos(cid, "supplier");
        setContactos((prev) => prev.filter((c: any) => c.type !== "supplier" && c.type !== "both"));
        break;
      case "bancos":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setBancos([]);
            await dbClearBancos(cid);
          } else {
            mergeArrayCollection(setBancos, data);
            await batchSave(data, (b) => dbSaveBanco(b, cid));
          }
        } else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          updateCollection(setBancos, itemWithId);
          if (data._delete) await dbDeleteBanco(data.id);
          else await dbSaveBanco(itemWithId, cid);
        }
        break;
      case "movimientosBancos":
      case "movimientos_bancos":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setMovimientosBancos([]);
            await dbClearMovimientosBancos(cid);
          } else {
            mergeArrayCollection(setMovimientosBancos, data);
            await batchSave(data, (m) => dbSaveMovimientoBanco(m, cid));
          }
        } else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          updateCollection(setMovimientosBancos, itemWithId);
          if (data._delete) await dbDeleteMovimientoBanco(data.id);
          else if (!data._localOnly) await dbSaveMovimientoBanco(itemWithId, cid);
        }
        break;
      case "cxc":
      case "cuentas_cobrar_cxc":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setCxc([]);
            await dbClearCxc(cid);
          } else {
            mergeArrayCollection(setCxc, data);
            await batchSave(data, (item) => dbSaveCxc(item, cid));
          }
        } else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          updateCollection(setCxc, itemWithId);
          if (data._delete) await dbDeleteCxc(data.id);
          else if (!data._localOnly) await dbSaveCxc(itemWithId, cid);
        }
        break;
      case "cxp":
      case "cuentas_pagar_cxp":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setCxp([]);
            await dbClearCxp(cid);
          } else {
            mergeArrayCollection(setCxp, data);
            await batchSave(data, (item) => dbSaveCxp(item, cid));
          }
        } else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          updateCollection(setCxp, itemWithId);
          if (data._delete) await dbDeleteCxp(data.id);
          else if (!data._localOnly) await dbSaveCxp(itemWithId, cid);
        }
        break;
      case "cobranzas":
      case "cobranza":
        if (Array.isArray(data)) {
          mergeArrayCollection(setCobranzas, data);
          await batchSave(data, (item) => dbSaveCobranza(item, cid));
        } else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          updateCollection(setCobranzas, itemWithId);
          if (data._delete) await dbDeleteCobranza(data.id);
          else if (!data._localOnly) await dbSaveCobranza(itemWithId, cid);
        }
        break;
      case "pagos-realizados":
      case "pagosRealizados":
      case "pagos_realizados":
        if (Array.isArray(data)) {
          mergeArrayCollection(setPagosRealizados, data);
          await batchSave(data, (item) => dbSavePagoRealizado(item, cid));
        } else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          updateCollection(setPagosRealizados, itemWithId);
          if (data._delete) await dbDeletePagoRealizado(data.id);
          else if (!data._localOnly) await dbSavePagoRealizado(itemWithId, cid);
        }
        break;
      case "cuentasContables":
      case "cuentas_contables":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setCuentasContables([]);
            await dbClearCuentasContables(cid);
          } else {
            setCuentasContables((prev: any[]) => {
              const map = new Map<string, any>(prev.map((c: any) => [c.codigo || c.id, c]));
              for (const item of data) {
                const key = item.codigo || item.id;
                map.set(key, {
                  ...(map.get(key) || {}),
                  ...item,
                });
              }
              return Array.from(map.values()).sort((a: any, b: any) =>
                (a.codigo || "").localeCompare(b.codigo || ""),
              );
            });
            await batchSave(data, (c) => dbSaveCuentaContable(c, cid));
          }
        } else {
          updateCollection(setCuentasContables, data);
          if (data._delete) await dbDeleteCuentaContable(data.id);
          else await dbSaveCuentaContable(data, cid);
        }
        break;
      case "comprobantes":
      case "comprobantes_diario":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setComprobantes([]);
            await dbClearComprobantes(cid);
          } else {
            mergeArrayCollection(setComprobantes, data);
            await batchSave(data, (item) => dbSaveComprobante(item, cid));
          }
        } else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          updateCollection(setComprobantes, itemWithId);
          if (data._delete) await dbDeleteComprobante(data.id);
          else await dbSaveComprobante(itemWithId, cid);
        }
        break;
      case "servicios":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setServicios([]);
            await dbClearServicios(cid);
          } else {
            mergeArrayCollection(setServicios, data);
            await batchSave(data, (s) => dbSaveServicio(s, cid));
          }
        } else {
          updateCollection(setServicios, data);
          if (data._delete) await dbDeleteServicio(data.id);
          else await dbSaveServicio(data, cid);
        }
        break;
      case "solicitudesBanco":
      case "solicitudes_banco":
        if (data._delete) await dbDeleteSolicitudBanco(data.id, cid);
        else await dbSaveSolicitudBanco(data, cid);
        break;
      case "products":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setProducts([]);
            await dbClearProducts(cid);
          } else {
            mergeArrayCollection(setProducts, data);
            await batchSave(data, (p) => dbSaveProduct(p, cid));
          }
        } else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          updateCollection(setProducts, itemWithId);
          if (data._delete) await dbDeleteProduct(data.id, cid);
          else if (!data._localOnly) await dbSaveProduct(itemWithId, cid);
        }
        break;
      case "categoriasProducto":
      case "categorias_producto":
        if (Array.isArray(data)) {
          setCategoriasProducto(data);
          await batchSave(data, (c) => dbSaveCategoriaProducto(c, cid));
        } else {
          updateCollection(setCategoriasProducto, data);
          if (data._delete) await dbDeleteCategoriaProducto(data.id, cid);
          else await dbSaveCategoriaProducto(data, cid);
        }
        break;
      case "almacenes":
        if (Array.isArray(data)) {
          setAlmacenes(data);
          await batchSave(data, (a) => dbSaveAlmacen(a, cid));
        } else {
          updateCollection(setAlmacenes, data);
          if (data._delete) await dbDeleteAlmacen(data.id, cid);
          else await dbSaveAlmacen(data, cid);
        }
        break;
      case "movimientosInventario":
      case "movimientos_inventario":
        if (Array.isArray(data)) {
          setMovimientosInventario(data);
          await batchSave(data, (m) => dbSaveMovimientoInventario(m, cid));
        } else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          updateCollection(setMovimientosInventario, itemWithId);
          await dbSaveMovimientoInventario(itemWithId, cid);
        }
        break;
      case "facturasVenta":
      case "facturas_venta":
        if (Array.isArray(data)) {
          setFacturasVenta(data);
          if (!data[0]?._localOnly && !(data as any)._localOnly) {
            await batchSave(data, (f) => dbSaveFacturaVenta(f, cid));
          }
        } else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          updateCollection(setFacturasVenta, itemWithId);
          if (data._delete) await dbDeleteFacturaVenta(data.id, cid);
          else if (!data._localOnly) await dbSaveFacturaVenta(itemWithId, cid);
        }
        break;
      case "facturasCompra":
      case "facturas_compra":
        if (Array.isArray(data)) {
          setFacturasCompra(data);
          await batchSave(data, (f) => dbSaveFacturaCompra(f, cid));
        } else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          updateCollection(setFacturasCompra, itemWithId);
          if (data._delete) await dbDeleteFacturaCompra(data.id, cid);
          else if (!data._localOnly) await dbSaveFacturaCompra(itemWithId, cid);
        }
        break;
      case "lotesPos":
      case "lotes_pos":
        if (data._delete) await dbDeleteLotePos(data.id, cid);
        else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          if (!data._localOnly) await dbSaveLotePos(itemWithId, cid);
        }
        break;
      case "terminalesPos":
      case "terminales_pos":
        if (data._delete) await dbDeleteTerminalPos(data.id, cid);
        else {
          const itemWithId = {
            ...data,
            id: (data.id && isUUID(data.id)) ? data.id : crypto.randomUUID()
          };
          await dbSaveTerminalPos(itemWithId, cid);
        }
        break;
      case "pedidos":
        if (Array.isArray(data)) setPedidos(data);
        else updateCollection(setPedidos, data);
        break;
      case "activosFijos":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setActivosFijos([]);
            await dbClearActivosFijos(cid);
          } else {
            mergeArrayCollection(setActivosFijos, data);
            for (const af of data) await dbSaveActivoFijo(af, cid);
          }
        } else {
          updateCollection(setActivosFijos, data);
          if (data._delete) {
            await dbDeleteActivoFijo(data.id, cid);
          } else {
            await dbSaveActivoFijo(data, cid);
          }
        }
        break;
      case "categoriasActivos":
        if (Array.isArray(data)) {
          setCategoriasActivos(data);
          await dbSaveCategoriasActivos(data, cid);
        } else {
          updateCollection(setCategoriasActivos, data);
          if (data._delete) {
            await dbDeleteCategoriaActivo(data.id, cid);
          } else {
            await dbSaveCategoriaActivo(data, cid);
          }
        }
        break;
      case "depreciaciones":
        if (Array.isArray(data)) {
          setDepreciaciones(data);
          await dbSaveDepreciaciones(data, cid);
        } else {
          updateCollection(setDepreciaciones, data);
          if (data._delete) {
            await dbDeleteDepreciacion(data.id, cid);
          } else {
            await dbSaveDepreciacion(data, cid);
          }
        }
        break;
      case "call-logs":
        if (Array.isArray(data)) setCallLogs(data);
        else updateCollection(setCallLogs, data);
        break;
      case "accounting-config":
      case "configContable":
      case "configuracionContable":
      case "configuracion_contable":
        const mergedConfig = { ...configContable, ...data };
        setConfigContable(mergedConfig);
        if (activeCompanyId) {
          try {
            await dbSaveConfiguracionContable(mergedConfig, activeCompanyId);
          } catch (e) {
            console.error("Error guardando configuracion contable en Supabase:", e);
          }
        }
        break;
      case "settings":
      case "empresa":
        if (data?.empresa) {
          const updatedEmpresa = { ...empresa, ...data.empresa };
          setEmpresa(updatedEmpresa);
          const compPayload = {
            id: (activeCompanyId && isUUID(activeCompanyId)) ? activeCompanyId : ((empresa as any).id && isUUID((empresa as any).id) ? (empresa as any).id : crypto.randomUUID()),
            ...updatedEmpresa,
          };
          try {
            const res = await dbSaveEmpresa(compPayload);
            if (res && !res.success) {
              console.warn("Aviso al guardar empresa en Supabase:", res.error);
              if (data.callback) data.callback(new Error(res.error));
            } else {
              const updatedList = availableCompanies.map((c) =>
                c.id === compPayload.id
                  ? { ...c, name: compPayload.nombre, taxId: compPayload.rif, ...compPayload }
                  : c
              );
              setAvailableCompanies(updatedList);
              if (data.callback) data.callback(null);
            }
          } catch (e: any) {
            console.error("Error guardando empresa:", e);
            if (data.callback) data.callback(e);
          }
        }
        break;
      default:
        console.log("handleSave UI:", collectionName, data);
    }
  };

  const handleLogout = () => {
    logout();
    showToast("Sesión finalizada correctamente", "info");
  };

  if (!currentUser) {
    return <Login />;
  }

  if (availableCompanies.length === 0 || !activeCompanyId) {
    return (
      <Router>
        <CompanySelector onLogout={handleLogout} />
      </Router>
    );
  }

  return (
    <Router>
      <Layout empresa={empresa} tipoEmpresa={empresa.tipoEmpresa} onLogout={handleLogout}>
        {toast && (
          <div
            className={`fixed bottom-5 right-5 max-w-md flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl z-50 text-white font-medium border backdrop-blur-md transition-all animate-slide-up ${
              toast.type === "error"
                ? "bg-slate-900/95 border-rose-500/40 text-rose-50 shadow-rose-950/20"
                : toast.type === "info"
                ? "bg-slate-900/95 border-indigo-500/40 text-indigo-50 shadow-indigo-950/20"
                : "bg-slate-900/95 border-emerald-500/40 text-emerald-50 shadow-emerald-950/20"
            }`}
          >
            <div className="shrink-0">
              {toast.type === "error" ? (
                <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center text-xs font-bold">
                  !
                </div>
              ) : toast.type === "info" ? (
                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">
                  i
                </div>
              ) : (
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                  ✓
                </div>
              )}
            </div>
            <div className="flex-1 text-xs sm:text-sm font-semibold tracking-tight text-slate-100">
              {toast.msg}
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded-md transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Home tipoEmpresa={empresa.tipoEmpresa} />} />
          <Route path="/clientes" element={<Navigate to="/contacts/customer" replace />} />
          
          {/* Módulo de Facturación */}
          <Route
            path="/invoicing"
            element={
              <Invoicing
                facturas={facturasVenta}
                cxc={filteredCxc}
                comprobantes={filteredComprobantes}
                movimientosBancos={filteredMovimientosBancos}
                cobranzas={filteredCobranzas}
                products={products}
                contactos={contactos}
                cuentasContables={cuentasContables}
                bancos={bancos}
                configContable={configContable}
                workingYear={workingYear}
                empresa={empresa}
                onSave={handleSave}
                showToast={showToast}
              />
            }
          />
          <Route
            path="/invoicing/new"
            element={
              <InvoiceForm
                contactos={contactos}
                products={products}
                cuentasContables={cuentasContables}
                bancos={bancos}
                configContable={configContable}
                onSave={handleSave}
                showToast={showToast}
                workingYear={workingYear}
                empresa={empresa}
              />
            }
          />

          {/* Módulo de Inventario de Mercancía */}
          <Route path="/inventory" element={<InventoryMenu />} />
          <Route
            path="/inventory/:submodule"
            element={
              <Inventory
                products={products}
                movimientosInventario={movimientosInventario}
                cuentasContables={cuentasContables}
                categoriasProducto={categoriasProducto}
                almacenes={almacenes}
                onSave={handleSave}
                showToast={showToast}
              />
            }
          />
          {/* Módulo de Compras y Servicios */}
          <Route path="/purchases" element={<PurchasesMenu />} />
          <Route
            path="/purchases/new"
            element={
              <PurchaseForm
                contactos={contactos}
                products={products}
                almacenes={almacenes}
                cuentasContables={cuentasContables}
                bancos={bancos}
                configContable={configContable}
                onSave={handleSave}
                showToast={showToast}
                workingYear={workingYear}
                empresa={empresa}
              />
            }
          />
          <Route
            path="/purchases/:submodule"
            element={
              <Purchases
                facturasCompra={facturasCompra}
                cxp={filteredCxp}
                comprobantes={filteredComprobantes}
                movimientosInventario={movimientosInventario}
                movimientosBancos={filteredMovimientosBancos}
                pagosRealizados={filteredPagosRealizados}
                products={products}
                contactos={contactos}
                cuentasContables={cuentasContables}
                categoriasProducto={categoriasProducto}
                bancos={bancos}
                configContable={configContable}
                workingYear={workingYear}
                empresa={empresa}
                onSave={handleSave}
                showToast={showToast}
              />
            }
          />
          <Route path="/receivables" element={<ReceivablesMenu />} />
          <Route
            path="/receivables/:category"
            element={
              <Receivables
                cxc={filteredCxc}
                cobranzas={filteredCobranzas}
                comprobantes={filteredComprobantes}
                bancos={bancos}
                movimientosBancos={filteredMovimientosBancos}
                clientes={clientes}
                contactos={contactos}
                cuentasContables={cuentasContables}
                configContable={configContable}
                onSave={handleSave}
                showToast={showToast}
                workingYear={workingYear}
                facturas={facturasVenta}
              />
            }
          />
          <Route path="/payables" element={<PayablesMenu />} />
          <Route
            path="/payables/:category"
            element={
              <Payables
                cxc={filteredCxc}
                cxp={filteredCxp}
                facturasCompra={facturasCompra}
                pagosRealizados={filteredPagosRealizados}
                comprobantes={filteredComprobantes}
                bancos={bancos}
                movimientosBancos={filteredMovimientosBancos}
                proveedores={proveedores}
                contactos={contactos}
                cuentasContables={cuentasContables}
                configContable={configContable}
                onSave={handleSave}
                showToast={showToast}
                workingYear={workingYear}
              />
            }
          />
          <Route path="/contacts" element={<ContactsMenu />} />
          <Route
            path="/contacts/:type"
            element={
              <Contacts
                contactos={contactos}
                cuentasContables={cuentasContables}
                onSave={handleSave}
                showToast={showToast}
              />
            }
          />
          <Route path="/banks" element={<BanksMenu />} />
          <Route
            path="/banks/pos-lotes"
            element={
              <PosLotes
                bancos={bancos}
                cuentasContables={cuentasContables}
                configContable={configContable}
                comprobantes={comprobantes}
                onSave={handleSave}
                showToast={showToast}
                workingYear={workingYear}
              />
            }
          />
          <Route
            path="/banks/:submodule"
            element={
              <Banks
                bancos={bancos}
                movimientosBancos={filteredMovimientosBancos}
                cxc={filteredCxc}
                cxp={filteredCxp}
                cobranzas={filteredCobranzas}
                pagos={filteredPagosRealizados}
                clientes={clientes}
                contactos={contactos}
                cuentasContables={cuentasContables}
                configContable={configContable}
                onSave={handleSave}
                showToast={showToast}
                workingYear={workingYear}
                comprobantes={filteredComprobantes}
              />
            }
          />
          <Route path="/accounting" element={<Accounting />} />
          <Route
            path="/accounting/accounts"
            element={
              <ChartOfAccounts
                cuentasContables={cuentasContables}
                onSave={handleSave}
                showToast={showToast}
              />
            }
          />
          <Route
            path="/accounting/entries"
            element={
              <AccountingEntries
                comprobantes={filteredComprobantes}
                cuentasContables={cuentasContables}
                onSave={handleSave}
                showToast={showToast}
                workingYear={workingYear}
              />
            }
          />
          <Route
            path="/accounting/fiscal"
            element={
              <FiscalModule
                facturasCompra={facturasCompra}
                facturasVenta={facturasVenta}
                comprobantes={filteredComprobantes}
                cuentasContables={cuentasContables}
                empresa={empresa}
                configContable={configContable}
                workingYear={workingYear}
                onSave={handleSave}
                showToast={showToast}
              />
            }
          />
          <Route
            path="/accounting/fixed-assets"
            element={
              <FixedAssetsModule
                activosFijos={activosFijos}
                categoriasActivos={categoriasActivos}
                depreciaciones={depreciaciones}
                cuentasContables={cuentasContables}
                proveedores={proveedores}
                configContable={configContable}
                comprobantes={comprobantes}
                cxp={filteredCxp}
                cxc={filteredCxc}
                onSave={handleSave}
                showToast={showToast}
              />
            }
          />
          <Route
            path="/accounting/closing"
            element={
              <AccountingConfig
                configContable={configContable}
                cuentasContables={cuentasContables}
                comprobantes={filteredComprobantes}
                onSave={handleSave}
                showToast={showToast}
              />
            }
          />
          <Route
            path="/accounting/config"
            element={
              <AccountingConfig
                configContable={configContable}
                cuentasContables={cuentasContables}
                comprobantes={filteredComprobantes}
                onSave={handleSave}
                showToast={showToast}
              />
            }
          />
          <Route
            path="/reports/comprobante-movimiento-banco"
            element={
              <ComprobanteMovimientoBanco
                bancos={bancos}
                movimientosBancos={filteredMovimientosBancos}
                cuentasContables={cuentasContables}
                empresa={empresa}
                configContable={configContable}
                comprobantes={filteredComprobantes}
              />
            }
          />
          <Route
            path="/reports"
            element={
              <Reports
                facturasServicio={[]}
                comprobantes={filteredComprobantes}
                cuentasContables={cuentasContables}
                cxc={filteredCxc}
                cxp={filteredCxp}
                bancos={bancos}
                movimientosBancos={filteredMovimientosBancos}
                servicios={servicios}
                contactos={contactos}
                products={products}
                configContable={configContable}
                empresa={empresa}
                cobranzas={filteredCobranzas}
                onSave={handleSave}
                showToast={showToast}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <Settings
                cuentasContables={cuentasContables}
                configContable={configContable}
                onSave={handleSave}
                showToast={showToast}
                empresa={empresa}
                setEmpresa={setEmpresa}
                contactos={contactos}
                servicios={servicios}
                comprobantes={filteredComprobantes}
                bancos={bancos}
                movimientosBancos={filteredMovimientosBancos}
                cxc={filteredCxc}
                cxp={filteredCxp}
                products={products}
                activosFijos={activosFijos}
              />
            }
          />
          {/* Rutas de Diagnóstico eliminadas - Redirigir a Home */}
          <Route path="/diagnostico" element={<Navigate to="/" replace />} />
          <Route path="/system-health" element={<Navigate to="/" replace />} />
          <Route path="/health" element={<Navigate to="/" replace />} />
          <Route
            path="*"
            element={<div className="text-slate-500 p-6">Módulo en construcción...</div>}
          />
        </Routes>
      </Suspense>
      </Layout>
    </Router>
  );
}
