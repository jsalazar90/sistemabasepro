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

import PurchaseForm from "./pages/PurchaseForm";

import ChartOfAccounts from "./pages/ChartOfAccounts";
import AccountingEntries from "./pages/AccountingEntries";
import AccountingConfig from "./pages/AccountingConfig";
import FixedAssetsModule from "./pages/FixedAssetsModule";
import ComprobanteMovimientoBanco from "./pages/ComprobanteMovimientoBanco";
import Login from "./pages/Login";
import CompanySelector from "./components/CompanySelector";
import Reports from "./pages/Reports";

import {
  dbFetchContactos,
  dbSaveContacto,
  dbDeleteContacto,
  dbSaveEmpresa,
  dbFetchCuentasContables,
  dbSaveCuentaContable,
  dbDeleteCuentaContable,
  dbFetchBancos,
  dbSaveBanco,
  dbDeleteBanco,
  dbFetchMovimientosBancos,
  dbSaveMovimientoBanco,
  dbDeleteMovimientoBanco,
  dbFetchConfiguracionContable,
  dbSaveConfiguracionContable,
  dbFetchCxc,
  dbSaveCxc,
  dbDeleteCxc,
  dbFetchCxp,
  dbSaveCxp,
  dbDeleteCxp,
  dbFetchCobranzas,
  dbSaveCobranza,
  dbDeleteCobranza,
  dbFetchPagosRealizados,
  dbSavePagoRealizado,
  dbDeletePagoRealizado,
  dbFetchComprobantes,
  dbSaveComprobante,
  dbDeleteComprobante,
  dbFetchServicios,
  dbSaveServicio,
  dbDeleteServicio,
  dbSaveSolicitudBanco,
  dbDeleteSolicitudBanco,
  dbFetchCategoriasActivos,
  dbSaveCategoriaActivo,
  dbDeleteCategoriaActivo,
  dbSaveCategoriasActivos,
  dbFetchActivosFijos,
  dbSaveActivoFijo,
  dbDeleteActivoFijo,
  dbFetchDepreciaciones,
  dbSaveDepreciacion,
  dbSaveDepreciaciones,
  SAMPLE_FULL_BALANCE_CUENTAS
} from "./services/db";

// Plan de Cuentas NIIF Estándar Completo (59+ cuentas balanceadas)
const initialCuentasContables = SAMPLE_FULL_BALANCE_CUENTAS;

const initialConfiguracionContable = {
  cuentaCxc: "1.1.4",
  cuentaCxp: "2.1.1",
  cuentaCaja: "1.1.2",
  cuentaBancos: "1.1.3",
  cuentaAnticipoRecibido: "2.1.1",
  cuentaAnticipoOtorgado: "1.1.4",
  cuentaDebitoFiscal: "2.1.2",
  cuentaCreditoFiscal: "2.1.2",
  cuentaIvaRetenidoVentas: "1.1.4",
  cuentaIslrRetenidoVentas: "1.1.4",
  cuentaIvaRetenidoCompras: "2.1.1",
  cuentaIslrRetenidoCompras: "2.1.1",
  cuentaGananciaDiferencialCambiario: "4.1.1",
  cuentaPerdidaDiferencialCambiario: "5.2.1",
  prefijoFactura: "FAC-",
  correlativoFactura: "00001",
  prefijoCotizacion: "COT-",
  correlativoCotizacion: "00001",
  prefijoNotaEntrega: "NOT-",
  correlativoNotaEntrega: "00001",
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
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const [empresa, setEmpresa] = useState({
    nombre: "Empresa",
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
  });

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
      return;
    }

    // Sincronizar datos de la empresa activa
    const found = availableCompanies.find((c) => c.id === activeCompanyId);
    if (found) {
      setEmpresa({
        id: found.id,
        nombre: found.name || (found as any).nombre || 'Empresa',
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
      });
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

    async function loadCompanyDataFromSupabase() {
      try {
        const [
          dbContacts,
          dbAccounts,
          dbBanksList,
          dbBankTx,
          dbConfig,
          dbCxcList,
          dbCxpList,
          dbCobranzasList,
          dbPagosList,
          dbComprobantesList,
          dbServiciosList,
          dbCategoriasActivos,
          dbActivosFijosList,
          dbDepreciacionesList
        ] = await Promise.all([
          dbFetchContactos(activeCompanyId!),
          dbFetchCuentasContables(activeCompanyId!),
          dbFetchBancos(activeCompanyId!),
          dbFetchMovimientosBancos(activeCompanyId!),
          dbFetchConfiguracionContable(activeCompanyId!),
          dbFetchCxc(activeCompanyId!),
          dbFetchCxp(activeCompanyId!),
          dbFetchCobranzas(activeCompanyId!),
          dbFetchPagosRealizados(activeCompanyId!),
          dbFetchComprobantes(activeCompanyId!),
          dbFetchServicios(activeCompanyId!),
          dbFetchCategoriasActivos(activeCompanyId!),
          dbFetchActivosFijos(activeCompanyId!),
          dbFetchDepreciaciones(activeCompanyId!)
        ]);

        setContactos(dbContacts || []);
        setCuentasContables((dbAccounts && dbAccounts.length >= 25) ? dbAccounts : SAMPLE_FULL_BALANCE_CUENTAS);
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
      } catch (err) {
        console.warn("Error cargando datos de Supabase:", err);
      }
    }

    loadCompanyDataFromSupabase();
  }, [activeCompanyId, availableCompanies]);

  const clientes = contactos.filter((c) => c.type === "customer" || c.type === "both");
  const proveedores = contactos.filter((c) => c.type === "supplier" || c.type === "both");

  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Filtros por año de trabajo
  const filteredCxc = useMemo(() => {
    return cxc.filter((item) => {
      const d = item.fecha || item.date;
      if (!d || typeof d !== "string") return true;
      return d.substring(0, 4) === workingYear;
    });
  }, [cxc, workingYear]);

  const filteredCxp = useMemo(() => {
    return cxp.filter((item) => {
      const d = item.fecha || item.date;
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

    switch (collectionName) {
      case "contactos":
        if (Array.isArray(data)) {
          setContactos(data);
          for (const item of data) await dbSaveContacto(item, cid);
        } else {
          updateCollection(setContactos, data);
          if (data._delete) await dbDeleteContacto(data.id);
          else await dbSaveContacto(data, cid);
        }
        break;
      case "bancos":
        if (Array.isArray(data)) {
          setBancos(data);
          for (const b of data) await dbSaveBanco(b, cid);
        } else {
          updateCollection(setBancos, data);
          if (data._delete) await dbDeleteBanco(data.id);
          else await dbSaveBanco(data, cid);
        }
        break;
      case "movimientosBancos":
        if (Array.isArray(data)) {
          setMovimientosBancos(data);
          for (const m of data) await dbSaveMovimientoBanco(m, cid);
        } else {
          updateCollection(setMovimientosBancos, data);
          if (data._delete) await dbDeleteMovimientoBanco(data.id);
          else await dbSaveMovimientoBanco(data, cid);
        }
        break;
      case "cxc":
        if (Array.isArray(data)) {
          setCxc(data);
          for (const item of data) await dbSaveCxc(item, cid);
        } else {
          updateCollection(setCxc, data);
          if (data._delete) await dbDeleteCxc(data.id);
          else await dbSaveCxc(data, cid);
        }
        break;
      case "cxp":
        if (Array.isArray(data)) {
          setCxp(data);
          for (const item of data) await dbSaveCxp(item, cid);
        } else {
          updateCollection(setCxp, data);
          if (data._delete) await dbDeleteCxp(data.id);
          else await dbSaveCxp(data, cid);
        }
        break;
      case "cobranzas":
        if (Array.isArray(data)) {
          setCobranzas(data);
          for (const item of data) await dbSaveCobranza(item, cid);
        } else {
          updateCollection(setCobranzas, data);
          if (data._delete) await dbDeleteCobranza(data.id);
          else await dbSaveCobranza(data, cid);
        }
        break;
      case "pagos-realizados":
        if (Array.isArray(data)) {
          setPagosRealizados(data);
          for (const item of data) await dbSavePagoRealizado(item, cid);
        } else {
          updateCollection(setPagosRealizados, data);
          if (data._delete) await dbDeletePagoRealizado(data.id);
          else await dbSavePagoRealizado(data, cid);
        }
        break;
      case "cuentasContables":
        if (Array.isArray(data)) {
          setCuentasContables(data);
          for (const c of data) await dbSaveCuentaContable(c, cid);
        } else {
          updateCollection(setCuentasContables, data);
          if (data._delete) await dbDeleteCuentaContable(data.id);
          else await dbSaveCuentaContable(data, cid);
        }
        break;
      case "comprobantes":
        if (Array.isArray(data)) {
          setComprobantes(data);
          for (const item of data) await dbSaveComprobante(item, cid);
        } else {
          updateCollection(setComprobantes, data);
          if (data._delete) await dbDeleteComprobante(data.id);
          else await dbSaveComprobante(data, cid);
        }
        break;
      case "servicios":
        if (Array.isArray(data)) {
          setServicios(data);
          for (const s of data) await dbSaveServicio(s, cid);
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
        if (Array.isArray(data)) setProducts(data);
        else updateCollection(setProducts, data);
        break;
      case "pedidos":
        if (Array.isArray(data)) setPedidos(data);
        else updateCollection(setPedidos, data);
      case "activosFijos":
        if (Array.isArray(data)) {
          setActivosFijos(data);
          for (const af of data) await dbSaveActivoFijo(af, cid);
        } else {
          updateCollection(setActivosFijos, data);
          if (data._delete) {
            await dbDeleteActivoFijo(data.id);
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
          await dbSaveDepreciacion(data, cid);
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
          <Route
            path="/purchases/new"
            element={
              <PurchaseForm
                contactos={contactos}
                cuentasContables={cuentasContables}
                onSave={handleSave}
                showToast={showToast}
                configContable={configContable}
                workingYear={workingYear}
              />
            }
          />
          <Route path="/purchases" element={<PayablesMenu />} />
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
            path="/accounting/fixed-assets"
            element={
              <FixedAssetsModule
                activosFijos={activosFijos}
                categoriasActivos={categoriasActivos}
                depreciaciones={depreciaciones}
                cuentasContables={cuentasContables}
                proveedores={proveedores}
                configContable={configContable}
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
              />
            }
          />
          <Route
            path="*"
            element={<div className="text-slate-500 p-6">Módulo en construcción...</div>}
          />
        </Routes>
      </Layout>
    </Router>
  );
}
