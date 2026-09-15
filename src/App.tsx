/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { CompanyProvider, useCompany } from "./context/CompanyContext";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Contacts from "./pages/Contacts";
import ContactsMenu from "./pages/ContactsMenu";
import Banks from "./pages/Banks";
import BanksMenu from "./pages/BanksMenu";
import Receivables from "./pages/Receivables";
import ReceivablesMenu from "./pages/ReceivablesMenu";
import Payables from "./pages/Payables";
import PayablesMenu from "./pages/PayablesMenu";
import Settings from "./pages/Settings";
import Accounting from "./pages/Accounting";

import Purchases from "./pages/Purchases";
import PurchasesMenu from "./pages/PurchasesMenu";
import PurchaseForm from "./pages/PurchaseForm";
import Inventory from "./pages/Inventory";
import Invoicing from "./pages/Invoicing";
import InvoiceForm from "./pages/InvoiceForm";

import ChartOfAccounts from "./pages/ChartOfAccounts";
import AccountingEntries from "./pages/AccountingEntries";
import FiscalModule from "./pages/FiscalModule";
import AccountingConfig from "./pages/AccountingConfig";
import FixedAssetsModule from "./pages/FixedAssetsModule";
import ComprobanteMovimientoBanco from "./pages/ComprobanteMovimientoBanco";
import Login from "./pages/Login";
import CompanySelector from "./components/CompanySelector";
import Reports from "./pages/Reports";
import PosLotes from "./pages/PosLotes";

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
    setAvailableCompanies 
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
    if (!activeCompanyId) {
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

    async function loadCompanyDataFromSupabase() {
      try {
        // Lote 1: Entidades maestras contables y bancarias
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

        // Lote 2: Cuentas por cobrar y pagar, cobranzas y pagos
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

        // Lote 3: Inventario, almacenes y servicios
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

        // Lote 4: Facturación y Activos Fijos
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

        setContactos(dbContacts || []);
        setCuentasContables(dbAccounts || []);
        setBancos(dbBanksList || []);
        setMovimientosBancos(dbBankTx || []);
        setConfigContable(dbConfig || { ...initialConfiguracionContable, empresaId: activeCompanyId });
        setCxc(dbCxcList || []);
        setCxp(dbCxpList || []);
        setCobranzas(dbCobranzasList || []);
        setPagosRealizados(dbPagosList || []);
        setComprobantes(dbComprobantesList || []);
        setServicios(dbServiciosList || []);
        setCategoriasActivos(dbCategoriasActivos || []);
        setActivosFijos(dbActivosFijosList || []);
        setDepreciaciones(dbDepreciacionesList || []);
        setProducts(dbProductsList || []);
        setCategoriasProducto(dbCategoriasList || []);
        setAlmacenes(dbAlmacenesList || []);
        setMovimientosInventario(dbMovimientosInvList || []);
        setFacturasVenta(dbFacturasVentaList || []);
        setFacturasCompra(dbFacturasCompraList || []);
      } catch (err) {
        console.warn("Error cargando datos de Supabase:", err);
      }
    }

    loadCompanyDataFromSupabase();
  }, [activeCompanyId]);

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

    switch (collectionName) {
      case "contactos":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setContactos([]);
            await dbClearContactos(cid);
          } else {
            mergeArrayCollection(setContactos, data);
            for (const item of data) await dbSaveContacto(item, cid);
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
            for (const b of data) await dbSaveBanco(b, cid);
          }
        } else {
          updateCollection(setBancos, data);
          if (data._delete) await dbDeleteBanco(data.id);
          else await dbSaveBanco(data, cid);
        }
        break;
      case "movimientosBancos":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setMovimientosBancos([]);
            await dbClearMovimientosBancos(cid);
          } else {
            mergeArrayCollection(setMovimientosBancos, data);
            for (const m of data) await dbSaveMovimientoBanco(m, cid);
          }
        } else {
          updateCollection(setMovimientosBancos, data);
          if (data._delete) await dbDeleteMovimientoBanco(data.id);
          else await dbSaveMovimientoBanco(data, cid);
        }
        break;
      case "cxc":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setCxc([]);
            await dbClearCxc(cid);
          } else {
            mergeArrayCollection(setCxc, data);
            for (const item of data) await dbSaveCxc(item, cid);
          }
        } else {
          updateCollection(setCxc, data);
          if (data._delete) await dbDeleteCxc(data.id);
          else await dbSaveCxc(data, cid);
        }
        break;
      case "cxp":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setCxp([]);
            await dbClearCxp(cid);
          } else {
            mergeArrayCollection(setCxp, data);
            for (const item of data) await dbSaveCxp(item, cid);
          }
        } else {
          updateCollection(setCxp, data);
          if (data._delete) await dbDeleteCxp(data.id);
          else await dbSaveCxp(data, cid);
        }
        break;
      case "cobranzas":
        if (Array.isArray(data)) {
          mergeArrayCollection(setCobranzas, data);
          for (const item of data) await dbSaveCobranza(item, cid);
        } else {
          updateCollection(setCobranzas, data);
          if (data._delete) await dbDeleteCobranza(data.id);
          else await dbSaveCobranza(data, cid);
        }
        break;
      case "pagos-realizados":
        if (Array.isArray(data)) {
          mergeArrayCollection(setPagosRealizados, data);
          for (const item of data) await dbSavePagoRealizado(item, cid);
        } else {
          updateCollection(setPagosRealizados, data);
          if (data._delete) await dbDeletePagoRealizado(data.id);
          else await dbSavePagoRealizado(data, cid);
        }
        break;
      case "cuentasContables":
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
            for (const c of data) await dbSaveCuentaContable(c, cid);
          }
        } else {
          updateCollection(setCuentasContables, data);
          if (data._delete) await dbDeleteCuentaContable(data.id);
          else await dbSaveCuentaContable(data, cid);
        }
        break;
      case "comprobantes":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setComprobantes([]);
            await dbClearComprobantes(cid);
          } else {
            mergeArrayCollection(setComprobantes, data);
            for (const item of data) await dbSaveComprobante(item, cid);
          }
        } else {
          updateCollection(setComprobantes, data);
          if (data._delete) await dbDeleteComprobante(data.id);
          else await dbSaveComprobante(data, cid);
        }
        break;
      case "servicios":
        if (Array.isArray(data)) {
          if (data.length === 0) {
            setServicios([]);
            await dbClearServicios(cid);
          } else {
            mergeArrayCollection(setServicios, data);
            for (const s of data) await dbSaveServicio(s, cid);
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
            for (const p of data) await dbSaveProduct(p, cid);
          }
        } else {
          updateCollection(setProducts, data);
          if (data._delete) await dbDeleteProduct(data.id, cid);
          else await dbSaveProduct(data, cid);
        }
        break;
      case "categoriasProducto":
      case "categorias_producto":
        if (Array.isArray(data)) {
          setCategoriasProducto(data);
          for (const c of data) await dbSaveCategoriaProducto(c, cid);
        } else {
          updateCollection(setCategoriasProducto, data);
          if (data._delete) await dbDeleteCategoriaProducto(data.id, cid);
          else await dbSaveCategoriaProducto(data, cid);
        }
        break;
      case "almacenes":
        if (Array.isArray(data)) {
          setAlmacenes(data);
          for (const a of data) await dbSaveAlmacen(a, cid);
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
          for (const m of data) await dbSaveMovimientoInventario(m, cid);
        } else {
          updateCollection(setMovimientosInventario, data);
          await dbSaveMovimientoInventario(data, cid);
        }
        break;
      case "facturasVenta":
      case "facturas_venta":
        if (Array.isArray(data)) {
          setFacturasVenta(data);
          for (const f of data) await dbSaveFacturaVenta(f, cid);
        } else {
          updateCollection(setFacturasVenta, data);
          if (data._delete) await dbDeleteFacturaVenta(data.id, cid);
          else await dbSaveFacturaVenta(data, cid);
        }
        break;
      case "facturasCompra":
      case "facturas_compra":
        if (Array.isArray(data)) {
          setFacturasCompra(data);
          for (const f of data) await dbSaveFacturaCompra(f, cid);
        } else {
          updateCollection(setFacturasCompra, data);
          if (data._delete) await dbDeleteFacturaCompra(data.id, cid);
          else await dbSaveFacturaCompra(data, cid);
        }
        break;
      case "lotesPos":
      case "lotes_pos":
        if (data._delete) await dbDeleteLotePos(data.id, cid);
        else await dbSaveLotePos(data, cid);
        break;
      case "terminalesPos":
      case "terminales_pos":
        if (data._delete) await dbDeleteTerminalPos(data.id, cid);
        else await dbSaveTerminalPos(data, cid);
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
            id: activeCompanyId || (empresa as any).id || `comp_${Date.now()}`,
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
            className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 text-white font-medium ${
              toast.type === "error" ? "bg-red-500" : "bg-emerald-500"
            }`}
          >
            {toast.msg}
          </div>
        )}
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
          <Route
            path="/inventory"
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
      </Layout>
    </Router>
  );
}
