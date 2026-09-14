import React, { useState, useMemo } from "react";
import {
  UploadCloud,
  Download,
  FileText,
  Building2,
  UserCheck,
  Calculator,
  Loader2,
  Trash2,
  Landmark,
  Layers,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Package,
  CreditCard,
  Receipt,
  Boxes,
  HelpCircle
} from "lucide-react";
import * as XLSX from "xlsx";
import { useCompany } from "../../context/CompanyContext";
import {
  dbClearCuentasContables,
  dbClearContactos,
  dbClearServicios,
  dbClearBancos,
  dbClearMovimientosBancos,
  dbClearCxc,
  dbClearCxp,
  dbClearComprobantes,
  dbClearProducts,
  dbClearActivosFijos
} from "../../services/db";

interface BulkUploadConfigProps {
  contactos?: any[];
  servicios?: any[];
  cuentasContables?: any[];
  comprobantes?: any[];
  bancos?: any[];
  movimientosBancos?: any[];
  cxc?: any[];
  cxp?: any[];
  products?: any[];
  activosFijos?: any[];
  onSave: (collection: string, data: any) => Promise<void> | void;
  showToast: (msg: string, type: string) => void;
}

interface UploadTypeDefinition {
  id: string;
  category: "contabilidad" | "tesoreria" | "cxc_cxp" | "inventario";
  title: string;
  description: string;
  collection: string;
  icon: React.ElementType;
  badgeColor: string;
  headers: string[];
  sampleData: string[][];
  extraData?: Record<string, any>;
}

const UPLOAD_TYPES: UploadTypeDefinition[] = [
  // 1. Clientes
  {
    id: "consignatarios",
    category: "cxc_cxp",
    title: "Clientes",
    description: "Directorio de clientes comerciales, RIF/Cédula, dirección y cuentas contables asociadas.",
    collection: "contactos",
    icon: UserCheck,
    badgeColor: "bg-blue-50 text-blue-600 border-blue-200",
    extraData: { type: "customer", isCompany: true },
    headers: ["taxId", "name", "email", "phone", "address", "personaContacto", "debitAccount", "creditAccount"],
    sampleData: [
      [
        "J-12345678-0",
        "Distribuidora Industrial C.A.",
        "operaciones@distribuidora.com",
        "+58 212 5551122",
        "Av. Francisco de Miranda, Caracas",
        "Carlos Morales",
        "1.1.2.01",
        "2.1.1.01"
      ],
      [
        "J-30982144-1",
        "Inversiones & Logística Los Llanos C.A.",
        "contacto@losllanos.com",
        "+58 241 8889900",
        "Zona Industrial II, Valencia",
        "María Fernández",
        "1.1.2.01",
        "2.1.1.01"
      ],
    ],
  },
  // 2. Proveedores
  {
    id: "proveedores",
    category: "cxc_cxp",
    title: "Proveedores",
    description: "Padrón de proveedores, suministradores, contratistas y cuentas contables de gasto y CxP.",
    collection: "contactos",
    icon: Building2,
    badgeColor: "bg-amber-50 text-amber-600 border-amber-200",
    extraData: { type: "supplier", isCompany: true },
    headers: ["taxId", "name", "email", "phone", "address", "isCompany", "debitAccount", "creditAccount", "expenseAccount"],
    sampleData: [
      [
        "J-98765432-1",
        "Proveedor Global C.A.",
        "ventas@proveedorglobal.com",
        "+58 212 2223344",
        "Parque Empresarial, Boleíta Norte",
        "true",
        "1.1.2.01",
        "2.1.1.01",
        "6.1.1.01"
      ],
      [
        "J-40192837-5",
        "Suministros Técnicos y Repuestos S.A.",
        "admin@suministrostec.com",
        "+58 251 7123456",
        "Carrera 19, Barquisimeto",
        "true",
        "1.1.2.01",
        "2.1.1.01",
        "6.1.1.02"
      ],
    ],
  },
  // 3. Plan de Cuentas Contables
  {
    id: "cuentasContables",
    category: "contabilidad",
    title: "Plan de Cuentas (NIIF)",
    description: "Catálogo maestro de cuentas contables, niveles, naturalezas y grupos patrimoniales.",
    collection: "cuentasContables",
    icon: FileText,
    badgeColor: "bg-emerald-50 text-emerald-600 border-emerald-200",
    headers: ["codigo", "nombre", "tipo", "naturaleza", "grupo"],
    sampleData: [
      ["1.1.1.01", "Caja Moneda Nacional", "Movimiento", "Deudora", "Activo"],
      ["1.1.1.02", "Caja Moneda Extranjera (USD)", "Movimiento", "Deudora", "Activo"],
      ["1.1.2.01", "Cuentas por Cobrar Comerciales", "Movimiento", "Deudora", "Activo"],
      ["2.1.1.01", "Cuentas por Pagar Proveedores", "Movimiento", "Acreedora", "Pasivo"],
      ["4.1.1.01", "Ventas de Mercancías Generales", "Movimiento", "Acreedora", "Ingreso"],
      ["6.1.1.01", "Gastos de Administración y Oficina", "Movimiento", "Deudora", "Egreso"]
    ],
  },
  // 4. Comprobantes y Asientos Contables
  {
    id: "comprobantes",
    category: "contabilidad",
    title: "Comprobantes y Asientos Contables",
    description: "Asientos contables de diario, ajustes o apertura con balance cuadrado Debe / Haber.",
    collection: "comprobantes",
    icon: Layers,
    badgeColor: "bg-indigo-50 text-indigo-600 border-indigo-200",
    headers: ["numero", "fecha", "tipo", "descripcion", "referencia", "cuentaCodigo", "lineaDescripcion", "debe", "haber"],
    sampleData: [
      ["CD-0001", "2026-01-15", "Diario", "Asiento de Apertura de Ejercicio", "APERTURA-2026", "1.1.1.02", "Fondos en Banco", "5000.00", "0.00"],
      ["CD-0001", "2026-01-15", "Diario", "Asiento de Apertura de Ejercicio", "APERTURA-2026", "3.1.1.01", "Capital Social Suscrito", "0.00", "5000.00"],
      ["CD-0002", "2026-01-20", "Egreso", "Pago de Gastos de Operación", "PAG-089", "6.1.1.01", "Servicio Técnico", "250.00", "0.00"],
      ["CD-0002", "2026-01-20", "Egreso", "Pago de Gastos de Operación", "PAG-089", "1.1.1.02", "Salida Banco USD", "0.00", "250.00"]
    ],
  },
  // 5. Cuentas por Cobrar (CxC)
  {
    id: "cxc",
    category: "cxc_cxp",
    title: "Cuentas por Cobrar (CxC)",
    description: "Saldos pendientes y facturas de clientes por cobrar con fechas de vencimiento.",
    collection: "cxc",
    icon: Receipt,
    badgeColor: "bg-cyan-50 text-cyan-600 border-cyan-200",
    headers: ["factura", "clienteNombre", "clienteRif", "fechaEmision", "fechaVencimiento", "montoTotal", "saldoPendiente", "moneda", "cuentaContableCodigo", "estado"],
    sampleData: [
      ["FAC-00104", "Distribuidora Industrial C.A.", "J-12345678-0", "2026-01-10", "2026-02-10", "1200.00", "1200.00", "USD", "1.1.2.01", "pendiente"],
      ["FAC-00105", "Inversiones & Logística Los Llanos C.A.", "J-30982144-1", "2026-01-18", "2026-02-18", "850.50", "400.00", "USD", "1.1.2.01", "pendiente"]
    ],
  },
  // 6. Cuentas por Pagar (CxP)
  {
    id: "cxp",
    category: "cxc_cxp",
    title: "Cuentas por Pagar (CxP)",
    description: "Obligaciones pendientes con proveedores, facturas por pagar y fechas límite.",
    collection: "cxp",
    icon: CreditCard,
    badgeColor: "bg-rose-50 text-rose-600 border-rose-200",
    headers: ["factura", "proveedorNombre", "proveedorRif", "fechaEmision", "fechaVencimiento", "montoTotal", "saldoPendiente", "moneda", "cuentaContableCodigo", "estado"],
    sampleData: [
      ["PROV-7781", "Proveedor Global C.A.", "J-98765432-1", "2026-01-05", "2026-02-05", "3500.00", "3500.00", "USD", "2.1.1.01", "pendiente"],
      ["PROV-8820", "Suministros Técnicos y Repuestos S.A.", "J-40192837-5", "2026-01-12", "2026-02-12", "620.00", "620.00", "USD", "2.1.1.01", "pendiente"]
    ],
  },
  // 7. Bancos y Cuentas Bancarias
  {
    id: "bancos",
    category: "tesoreria",
    title: "Bancos y Cuentas Bancarias",
    description: "Cuentas corrientes, de ahorro, cajas y billeteras en moneda local y divisas.",
    collection: "bancos",
    icon: Landmark,
    badgeColor: "bg-teal-50 text-teal-600 border-teal-200",
    headers: ["nombre", "tipo", "numeroCuenta", "moneda", "saldoInicial", "cuentaContableCodigo", "activo"],
    sampleData: [
      ["Banesco Banco Universal", "Corriente", "0134-0001-22-1234567890", "VES", "15000.00", "1.1.1.01", "true"],
      ["Banesco Panamá (USD)", "Corriente", "0134-8888-99-9876543210", "USD", "10000.00", "1.1.1.02", "true"],
      ["Mercantil Banco", "Corriente", "0105-0023-45-1122334455", "VES", "8500.00", "1.1.1.01", "true"]
    ],
  },
  // 8. Movimientos Bancarios
  {
    id: "movimientosBancos",
    category: "tesoreria",
    title: "Movimientos Bancarios (Extractos)",
    description: "Depósitos, transferencias, notas de débito/crédito e historial de extracto bancario.",
    collection: "movimientosBancos",
    icon: FileSpreadsheet,
    badgeColor: "bg-sky-50 text-sky-600 border-sky-200",
    headers: ["bancoNombre", "fecha", "tipo", "monto", "descripcion", "referencia", "cuentaContableCodigo", "conciliado"],
    sampleData: [
      ["Banesco Panamá (USD)", "2026-01-16", "Deposito", "5000.00", "Abono de Cliente FAC-00104", "TRF-9901", "1.1.1.02", "true"],
      ["Banesco Panamá (USD)", "2026-01-22", "Retiro", "250.00", "Pago de Servicios Oficina", "DEB-4411", "6.1.1.01", "true"]
    ],
  },
  // 9. Artículos y Servicios
  {
    id: "servicios",
    category: "inventario",
    title: "Artículos y Servicios",
    description: "Catálogo de servicios profesionales, honorarios y conceptos de facturación.",
    collection: "servicios",
    icon: Calculator,
    badgeColor: "bg-purple-50 text-purple-600 border-purple-200",
    headers: ["codigo", "nombre", "descripcion", "precioBase", "cuentaContableId"],
    sampleData: [
      ["SERV-001", "Consultoría y Asesoría Financiera", "Honorarios profesionales de auditoría", "150.00", "4.1.1.01"],
      ["SERV-002", "Mantenimiento Técnico Especializado", "Soporte y soporte técnico mensual", "85.00", "4.1.1.01"],
      ["SERV-003", "Transporte y Logística Local", "Servicio de flete y entrega directa", "45.00", "4.1.1.01"]
    ],
  },
  // 10. Productos e Inventario
  {
    id: "products",
    category: "inventario",
    title: "Catálogo de Productos e Inventario",
    description: "Fichas de productos, existencias, precios de costo/venta, categoría y unidad de medida.",
    collection: "products",
    icon: Package,
    badgeColor: "bg-orange-50 text-orange-600 border-orange-200",
    headers: ["code", "name", "category", "price", "cost", "stock", "minStock", "unit", "cuentaContableId"],
    sampleData: [
      ["PROD-001", "Laptop ThinkPad L14 Gen 4", "Equipos", "850.00", "650.00", "15", "3", "UND", "1.1.3.01"],
      ["PROD-002", "Monitor Dell 24 Pulgadas IPS", "Periféricos", "180.00", "120.00", "28", "5", "UND", "1.1.3.01"],
      ["PROD-003", "Teclado Mecánico Inalámbrico", "Accesorios", "45.00", "28.00", "50", "10", "UND", "1.1.3.01"]
    ],
  },
  // 11. Activos Fijos
  {
    id: "activosFijos",
    category: "inventario",
    title: "Catálogo de Activos Fijos",
    description: "Bienes de uso, maquinarias, vehículos, equipos y sus cuentas de depreciación.",
    collection: "activosFijos",
    icon: Boxes,
    badgeColor: "bg-violet-50 text-violet-600 border-violet-200",
    headers: ["codigo", "nombre", "categoria", "fechaAdquisicion", "costoAdquisicion", "valorResidual", "vidaUtilAnos", "metodoDepreciacion", "cuentaActivo", "cuentaDepreciacionAcumulada", "cuentaGastoDepreciacion"],
    sampleData: [
      ["AF-001", "Camioneta Hilux 4x4", "Vehículos", "2024-03-10", "32000.00", "5000.00", "5", "Linea Recta", "1.2.1.01", "1.2.2.01", "6.1.2.01"],
      ["AF-002", "Servidor Dell PowerEdge R740", "Equipos de Computación", "2024-06-15", "6500.00", "800.00", "3", "Linea Recta", "1.2.1.02", "1.2.2.02", "6.1.2.02"]
    ],
  }
];

export default function BulkUploadConfig({
  contactos = [],
  servicios = [],
  cuentasContables = [],
  comprobantes = [],
  bancos = [],
  movimientosBancos = [],
  cxc = [],
  cxp = [],
  products = [],
  activosFijos = [],
  onSave,
  showToast,
}: BulkUploadConfigProps) {
  const [dragActive, setDragActive] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [delimiter, setDelimiter] = useState<string>(",");
  const [selectedCategory, setSelectedCategory] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [templateFormat, setTemplateFormat] = useState<"xlsx" | "csv">("xlsx");
  const [uploadProgress, setUploadProgress] = useState<{
    typeId: string | null;
    total: number;
    current: number;
    percent: number;
    statusText: string;
  }>({
    typeId: null,
    total: 0,
    current: 0,
    percent: 0,
    statusText: "",
  });

  const { activeCompanyId } = useCompany();

  // Helper de conteo por tipo
  const getRecordCount = (id: string): number => {
    switch (id) {
      case "consignatarios":
        return contactos.filter((c: any) => c.type === "customer" || c.type === "both").length;
      case "proveedores":
        return contactos.filter((c: any) => c.type === "supplier" || c.type === "both").length;
      case "cuentasContables":
        return cuentasContables.length;
      case "comprobantes":
        return comprobantes.length;
      case "cxc":
        return cxc.length;
      case "cxp":
        return cxp.length;
      case "bancos":
        return bancos.length;
      case "movimientosBancos":
        return movimientosBancos.length;
      case "servicios":
        return servicios.length;
      case "products":
        return products.length;
      case "activosFijos":
        return activosFijos.length;
      default:
        return 0;
    }
  };

  // Filtrado de módulos
  const filteredModules = useMemo(() => {
    return UPLOAD_TYPES.filter((mod) => {
      const matchCategory = selectedCategory === "todos" || mod.category === selectedCategory;
      const matchSearch =
        searchTerm === "" ||
        mod.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mod.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mod.headers.some((h) => h.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchTerm]);

  // Descarga de Plantilla de Ejemplo (Excel o CSV)
  const handleDownloadTemplate = (typeDef: UploadTypeDefinition, format: "xlsx" | "csv" = templateFormat) => {
    const rows = [typeDef.headers, ...typeDef.sampleData];

    if (format === "xlsx") {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      // Auto-ancho de columnas
      const colWidths = typeDef.headers.map((h, i) => {
        const maxLen = Math.max(
          h.length,
          ...typeDef.sampleData.map((r) => (r[i] ? String(r[i]).length : 0))
        );
        return { wch: Math.min(Math.max(maxLen + 4, 14), 40) };
      });
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
      XLSX.writeFile(wb, `Plantilla_${typeDef.id}.xlsx`);
      showToast(`Plantilla Excel descargada: Plantilla_${typeDef.id}.xlsx`, "success");
    } else {
      const actualDelimiter = delimiter === "\\t" || delimiter === "\t" ? "\t" : delimiter;
      const csvContent = rows
        .map((r) =>
          r
            .map((val) => {
              const str = String(val);
              if (str.includes(actualDelimiter) || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            })
            .join(actualDelimiter)
        )
        .join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const ext = actualDelimiter === "\t" ? "txt" : "csv";
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Plantilla_${typeDef.id}.${ext}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`Plantilla CSV descargada: Plantilla_${typeDef.id}.${ext}`, "success");
    }
  };

  // Exportar Datos Existentes
  const handleDownloadCurrentData = async (typeDef: UploadTypeDefinition, format: "xlsx" | "csv" = templateFormat) => {
    if (!activeCompanyId) {
      showToast("Seleccione una empresa primero.", "error");
      return;
    }

    setProcessing(typeDef.id + "_download");
    try {
      let rows: any[][] = [typeDef.headers];

      // Construir filas según el módulo
      switch (typeDef.id) {
        case "consignatarios": {
          const items = contactos.filter((c: any) => c.type === "customer" || c.type === "both");
          if (items.length === 0) {
            showToast("No hay clientes registrados para exportar.", "info");
            return;
          }
          items.forEach((c: any) => {
            rows.push([
              c.taxId || c.tax_id || "",
              c.name || "",
              c.email || "",
              c.phone || "",
              c.address || "",
              c.personaContacto || c.persona_contacto || "",
              c.debitAccount || c.debit_account || "",
              c.creditAccount || c.credit_account || ""
            ]);
          });
          break;
        }
        case "proveedores": {
          const items = contactos.filter((c: any) => c.type === "supplier" || c.type === "both");
          if (items.length === 0) {
            showToast("No hay proveedores registrados para exportar.", "info");
            return;
          }
          items.forEach((c: any) => {
            rows.push([
              c.taxId || c.tax_id || "",
              c.name || "",
              c.email || "",
              c.phone || "",
              c.address || "",
              String(c.isCompany ?? c.is_company ?? true),
              c.debitAccount || c.debit_account || "",
              c.creditAccount || c.credit_account || "",
              c.expenseAccount || c.expense_account || ""
            ]);
          });
          break;
        }
        case "cuentasContables": {
          if (cuentasContables.length === 0) {
            showToast("No hay cuentas contables registradas para exportar.", "info");
            return;
          }
          cuentasContables.forEach((a: any) => {
            rows.push([a.codigo || "", a.nombre || "", a.tipo || "Movimiento", a.naturaleza || "Deudora", a.grupo || "Activo"]);
          });
          break;
        }
        case "comprobantes": {
          if (comprobantes.length === 0) {
            showToast("No hay comprobantes contables registrados para exportar.", "info");
            return;
          }
          comprobantes.forEach((comp: any) => {
            const lineas = comp.lineas || [];
            if (lineas.length === 0) {
              rows.push([
                comp.numero || "",
                comp.fecha || "",
                comp.tipo || "Diario",
                comp.descripcion || "",
                comp.referencia || "",
                "",
                "",
                0,
                0
              ]);
            } else {
              lineas.forEach((l: any) => {
                const cuentaCode = l.cuenta?.codigo || l.cuentaCodigo || l.cuenta_codigo || l.cuentaId || "";
                rows.push([
                  comp.numero || "",
                  comp.fecha || "",
                  comp.tipo || "Diario",
                  comp.descripcion || "",
                  comp.referencia || "",
                  cuentaCode,
                  l.descripcion || comp.descripcion || "",
                  Number(l.debe) || 0,
                  Number(l.haber) || 0
                ]);
              });
            }
          });
          break;
        }
        case "cxc": {
          if (cxc.length === 0) {
            showToast("No hay cuentas por cobrar registradas para exportar.", "info");
            return;
          }
          cxc.forEach((item: any) => {
            rows.push([
              item.factura || item.numero || item.factura_id || "",
              item.cliente || item.cliente_nombre || item.clienteNombre || "",
              item.cliente_rif || item.taxId || "",
              item.fecha || item.fecha_emision || item.fechaEmision || "",
              item.vencimiento || item.fecha_vencimiento || item.fechaVencimiento || "",
              Number(item.total || item.monto_total) || 0,
              Number(item.saldo || item.saldo_pendiente) || 0,
              item.moneda || "USD",
              item.cuentaContableCodigo || item.cuenta_contable_codigo || "1.1.2.01",
              item.estado || "pendiente"
            ]);
          });
          break;
        }
        case "cxp": {
          if (cxp.length === 0) {
            showToast("No hay cuentas por pagar registradas para exportar.", "info");
            return;
          }
          cxp.forEach((item: any) => {
            rows.push([
              item.factura || item.numero || item.factura_id || "",
              item.proveedor || item.proveedor_nombre || item.proveedorNombre || "",
              item.proveedor_rif || item.taxId || "",
              item.fecha || item.fecha_emision || item.fechaEmision || "",
              item.vencimiento || item.fecha_vencimiento || item.fechaVencimiento || "",
              Number(item.total || item.monto_total) || 0,
              Number(item.saldo || item.saldo_pendiente) || 0,
              item.moneda || "USD",
              item.cuentaContableCodigo || item.cuenta_contable_codigo || "2.1.1.01",
              item.estado || "pendiente"
            ]);
          });
          break;
        }
        case "bancos": {
          if (bancos.length === 0) {
            showToast("No hay cuentas bancarias registradas para exportar.", "info");
            return;
          }
          bancos.forEach((b: any) => {
            rows.push([
              b.banco || b.nombre || "",
              b.tipo || "Corriente",
              b.numeroCuenta || b.numero_cuenta || b.cuenta || "",
              b.moneda || "USD",
              Number(b.saldo) || 0,
              b.cuentaContableId || b.cuenta_contable_id || "1.1.1.01",
              String(b.activo ?? true)
            ]);
          });
          break;
        }
        case "movimientosBancos": {
          if (movimientosBancos.length === 0) {
            showToast("No hay movimientos bancarios registrados para exportar.", "info");
            return;
          }
          movimientosBancos.forEach((m: any) => {
            const bancoItem = bancos.find((b: any) => b.id === m.banco_id || b.id === m.bancoId);
            const bancoName = bancoItem ? (bancoItem.banco || bancoItem.nombre) : (m.bancoNombre || "");
            rows.push([
              bancoName,
              m.fecha || "",
              m.tipo || "Deposito",
              Number(m.monto) || 0,
              m.descripcion || "",
              m.ref || m.referencia || "",
              m.cuentaContableCodigo || "",
              String(m.conciliado ?? false)
            ]);
          });
          break;
        }
        case "servicios": {
          if (servicios.length === 0) {
            showToast("No hay artículos o servicios registrados para exportar.", "info");
            return;
          }
          servicios.forEach((s: any) => {
            rows.push([
              s.codigo || "",
              s.nombre || "",
              s.descripcion || "",
              Number(s.precioBase ?? s.precio) || 0,
              s.cuentaContableId || s.cuenta_contable_id || ""
            ]);
          });
          break;
        }
        case "products": {
          if (products.length === 0) {
            showToast("No hay productos en inventario para exportar.", "info");
            return;
          }
          products.forEach((p: any) => {
            rows.push([
              p.codigo || p.code || "",
              p.nombre || p.name || "",
              p.categoria || p.category || "General",
              Number(p.precio || p.price) || 0,
              Number(p.costo || p.cost) || 0,
              Number(p.stock) || 0,
              Number(p.stockMinimo || p.minStock) || 0,
              p.unidadMedida || p.unit || "UND",
              p.cuentaContableId || p.cuenta_contable_id || ""
            ]);
          });
          break;
        }
        case "activosFijos": {
          if (activosFijos.length === 0) {
            showToast("No hay activos fijos registrados para exportar.", "info");
            return;
          }
          activosFijos.forEach((af: any) => {
            rows.push([
              af.codigo || "",
              af.nombre || af.descripcion || "",
              af.categoria || af.categoriaNombre || "General",
              af.fechaAdquisicion || af.fecha_adquisicion || "",
              Number(af.costoAdquisicion || af.valorCompra || af.valor_compra) || 0,
              Number(af.valorResidual || af.valor_residual) || 0,
              Number(af.vidaUtilAnos || af.vida_util_anos || 5) || 5,
              af.metodoDepreciacion || af.metodo || "Linea Recta",
              af.cuentaActivo || af.cuenta_activo_id || "",
              af.cuentaDepreciacionAcumulada || af.depreciacion_acumulada_id || "",
              af.cuentaGastoDepreciacion || af.cuenta_gasto_deprec_id || ""
            ]);
          });
          break;
        }
      }

      if (rows.length <= 1) {
        showToast("No se encontraron registros para exportar.", "info");
        return;
      }

      if (format === "xlsx") {
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const colWidths = typeDef.headers.map((h, i) => {
          const maxLen = Math.max(h.length, ...rows.slice(1).map((r) => (r[i] ? String(r[i]).length : 0)));
          return { wch: Math.min(Math.max(maxLen + 4, 14), 45) };
        });
        ws["!cols"] = colWidths;
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Datos");
        XLSX.writeFile(wb, `Datos_${typeDef.id}_${new Date().toISOString().split("T")[0]}.xlsx`);
        showToast(`Datos descargados en formato Excel: Datos_${typeDef.id}.xlsx`, "success");
      } else {
        const actualDelimiter = delimiter === "\\t" || delimiter === "\t" ? "\t" : delimiter;
        const csvContent = rows
          .map((r) =>
            r
              .map((val) => {
                const str = String(val ?? "");
                if (str.includes(actualDelimiter) || str.includes('"') || str.includes("\n")) {
                  return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
              })
              .join(actualDelimiter)
          )
          .join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const ext = actualDelimiter === "\t" ? "txt" : "csv";
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Datos_${typeDef.id}_${new Date().toISOString().split("T")[0]}.${ext}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast(`Datos descargados en formato CSV: Datos_${typeDef.id}.${ext}`, "success");
      }
    } catch (e) {
      console.error(e);
      showToast("Error al exportar los datos.", "error");
    } finally {
      setProcessing(null);
    }
  };

  // Limpiar/Eliminar registros de un módulo
  const handleDeleteAll = async (typeDef: UploadTypeDefinition) => {
    const currentCount = getRecordCount(typeDef.id);
    if (
      !window.confirm(
        `¿Está seguro que desea eliminar TODOS los registros (${currentCount}) de ${typeDef.title}?\n\nEsta acción eliminará permanentemente la información en la Base de Datos Supabase y en la sesión actual.`
      )
    ) {
      return;
    }

    setProcessing(typeDef.id);
    try {
      const companyId = activeCompanyId || "default";

      switch (typeDef.id) {
        case "cuentasContables":
          await dbClearCuentasContables(companyId);
          if (onSave) await onSave("cuentasContables", []);
          break;
        case "consignatarios":
          await dbClearContactos(companyId, "customer");
          if (onSave) await onSave("consignatarios", []);
          break;
        case "proveedores":
          await dbClearContactos(companyId, "supplier");
          if (onSave) await onSave("proveedores", []);
          break;
        case "servicios":
          await dbClearServicios(companyId);
          if (onSave) await onSave("servicios", []);
          break;
        case "comprobantes":
          await dbClearComprobantes(companyId);
          if (onSave) await onSave("comprobantes", []);
          break;
        case "cxc":
          await dbClearCxc(companyId);
          if (onSave) await onSave("cxc", []);
          break;
        case "cxp":
          await dbClearCxp(companyId);
          if (onSave) await onSave("cxp", []);
          break;
        case "bancos":
          await dbClearBancos(companyId);
          if (onSave) await onSave("bancos", []);
          break;
        case "movimientosBancos":
          await dbClearMovimientosBancos(companyId);
          if (onSave) await onSave("movimientosBancos", []);
          break;
        case "products":
          await dbClearProducts(companyId);
          if (onSave) await onSave("products", []);
          break;
        case "activosFijos":
          await dbClearActivosFijos(companyId);
          if (onSave) await onSave("activosFijos", []);
          break;
      }

      showToast(`Se eliminaron todos los registros de ${typeDef.title} en la base de datos exitosamente.`, "success");
    } catch (error: any) {
      console.error(error);
      showToast(`Error al eliminar registros: ${error.message || "Desconocido"}`, "error");
    } finally {
      setProcessing(null);
    }
  };

  // Parser manual para CSV / TXT
  const parseCSVLine = (line: string, delim: string = ","): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delim && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Mapa exhaustivo de alias para cabeceras
  const ALIAS_MAP: Record<string, string[]> = {
    taxId: ["taxid", "rif", "cedula", "cédula", "identificacion", "identificación", "documento", "nit", "id", "cliente_rif", "proveedor_rif"],
    name: ["name", "nombre", "razon social", "razón social", "cliente", "proveedor", "contacto", "banco", "descripcion"],
    email: ["email", "correo", "mail", "contacto_email"],
    phone: ["phone", "telefono", "teléfono", "celular", "tlf"],
    address: ["address", "direccion", "dirección", "domicilio", "direccion fiscal"],
    personaContacto: ["personacontacto", "persona_contacto", "contacto", "representante"],
    isCompany: ["iscompany", "esempresa", "empresa", "juridico", "persona_juridica", "es_empresa"],
    debitAccount: ["debitaccount", "cuentadebito", "cuenta_debito", "cxc", "cuenta_por_cobrar", "cuentaporcobrar"],
    creditAccount: ["creditaccount", "cuentacredito", "cuenta_credito", "cxp", "cuenta_por_pagar", "cuentaporpagar"],
    expenseAccount: ["expenseaccount", "cuentagasto", "cuenta_gasto", "gasto"],
    codigo: ["codigo", "código", "cod", "cuenta", "sku", "item_code", "ref"],
    tipo: ["tipo", "tipo_cuenta", "tipo_movimiento", "type"],
    naturaleza: ["naturaleza", "nat"],
    grupo: ["grupo", "rubro", "clasificacion", "categoría", "categoria"],
    descripcion: ["descripcion", "descripción", "detalle", "concepto", "memo"],
    precioBase: ["preciobase", "precio_base", "precio", "price", "monto", "tarifa"],
    cuentaContableId: ["cuentacontableid", "cuenta_contable", "cuenta_id", "cuenta", "cuenta_ingreso", "cuenta_gasto"],
    numero: ["numero", "número", "comprobante", "num_asiento", "asiento", "voucher", "factura"],
    fecha: ["fecha", "date", "fecha_emision", "fecha_comprobante"],
    referencia: ["referencia", "ref", "nro_referencia", "doc_ref"],
    cuentaCodigo: ["cuentacodigo", "cuenta_codigo", "codigo_cuenta", "cuenta", "cod_cuenta", "cuenta_id"],
    lineaDescripcion: ["lineadescripcion", "linea_descripcion", "detalle_linea", "concepto_linea", "glosa"],
    debe: ["debe", "debito", "débito", "debit"],
    haber: ["haber", "credito", "crédito", "credit"],
    factura: ["factura", "nro_factura", "numero_factura", "doc", "documento", "numero"],
    clienteNombre: ["clientenombre", "cliente_nombre", "cliente", "nombre_cliente", "nombre"],
    clienteRif: ["clienterif", "cliente_rif", "rif_cliente", "rif", "taxid"],
    proveedorNombre: ["proveedornombre", "proveedor_nombre", "proveedor", "nombre_proveedor", "nombre"],
    proveedorRif: ["proveedorrif", "proveedor_rif", "rif_proveedor", "rif", "taxid"],
    fechaEmision: ["fechaemision", "fecha_emision", "fecha", "emision", "emisión"],
    fechaVencimiento: ["fechavencimiento", "fecha_vencimiento", "vencimiento", "due_date"],
    montoTotal: ["montototal", "monto_total", "total", "monto", "importe"],
    saldoPendiente: ["saldopendiente", "saldo_pendiente", "saldo", "balance", "pendiente"],
    moneda: ["moneda", "currency", "divisa"],
    cuentaContableCodigo: ["cuentacontablecodigo", "cuenta_contable_codigo", "cuenta_codigo", "cuenta_contable", "cuenta"],
    estado: ["estado", "status", "estatus"],
    bancoNombre: ["banconombre", "banco_nombre", "banco", "nombre_banco", "bank"],
    numeroCuenta: ["numerocuenta", "numero_cuenta", "cuenta", "nro_cuenta", "account_number"],
    saldoInicial: ["saldoinicial", "saldo_inicial", "saldo", "monto_inicial"],
    activo: ["activo", "active", "estatus", "habilitado"],
    monto: ["monto", "importe", "amount", "valor"],
    conciliado: ["conciliado", "conciled", "reconciled"],
    code: ["code", "codigo", "código", "sku", "referencia"],
    price: ["price", "precio", "precio_venta", "pvp"],
    cost: ["cost", "costo", "costo_unitario", "cost_price"],
    stock: ["stock", "existencia", "cantidad", "qty", "inventario"],
    minStock: ["minstock", "stock_minimo", "stock_mínimo", "min_stock"],
    unit: ["unit", "unidad", "unidad_medida", "udm"],
    categoria: ["categoria", "categoría", "category", "rubro"],
    fechaAdquisicion: ["fechaadquisicion", "fecha_adquisicion", "fecha_compra", "fecha"],
    costoAdquisicion: ["costoadquisicion", "costo_adquisicion", "costo_compra", "valor_compra", "costo"],
    valorResidual: ["valorresidual", "valor_residual", "salvamento", "valor_rescate"],
    vidaUtilAnos: ["vidautilanos", "vida_util_anos", "vida_util_años", "vida_util", "años"],
    metodoDepreciacion: ["metododepreciacion", "metodo_depreciacion", "metodo", "método"],
    cuentaActivo: ["cuentaactivo", "cuenta_activo", "cuenta_activo_id"],
    cuentaDepreciacionAcumulada: ["cuentadepreciacionacumulada", "cuenta_depreciacion_acumulada", "depreciacion_acumulada_id"],
    cuentaGastoDepreciacion: ["cuentagastodepreciacion", "cuenta_gasto_depreciacion", "cuenta_gasto_deprec_id"]
  };

  // Procesamiento Unificado de Carga de Archivo (Excel o CSV)
  const handleFileUpload = async (typeDef: UploadTypeDefinition, file: File) => {
    setProcessing(typeDef.id);

    try {
      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      const buffer = await file.arrayBuffer();

      let headers: string[] = [];
      let dataRows: any[][] = [];

      if (isExcel) {
        // Parsear con XLSX
        const wb = XLSX.read(buffer, { type: "array" });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

        if (rawJson.length <= 1) {
          showToast("El archivo Excel está vacío o solo contiene la cabecera.", "error");
          setProcessing(null);
          return;
        }

        headers = (rawJson[0] || []).map((h: any) =>
          String(h || "")
            .replace(/[\r\n]/g, "")
            .trim()
            .toLowerCase()
        );
        dataRows = rawJson.slice(1).filter((r) => r.some((cell) => String(cell).trim() !== ""));
      } else {
        // Parsear como CSV o TXT
        let text = "";
        try {
          const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
          text = utf8Decoder.decode(buffer);
        } catch {
          const winDecoder = new TextDecoder("windows-1252");
          text = winDecoder.decode(buffer);
        }

        const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
        if (lines.length <= 1) {
          showToast("El archivo CSV/TXT está vacío o solo contiene la cabecera.", "error");
          setProcessing(null);
          return;
        }

        const firstLine = lines[0].replace(/^\uFEFF/, "");
        let activeDelimiter = delimiter;
        if (firstLine.includes("\t")) activeDelimiter = "\t";
        else if (firstLine.includes(";") && !firstLine.includes(",")) activeDelimiter = ";";
        else if (firstLine.includes(",") && !firstLine.includes(";")) activeDelimiter = ",";

        headers = parseCSVLine(firstLine, activeDelimiter).map((h) =>
          h
            .replace(/[\r\n]/g, "")
            .trim()
            .toLowerCase()
        );

        dataRows = lines
          .slice(1)
          .map((l) => parseCSVLine(l, activeDelimiter))
          .filter((r) => r.some((cell) => cell.trim() !== ""));
      }

      // Mapear cabeceras esperadas
      const headerMap: Record<string, number> = {};
      typeDef.headers.forEach((expectedHeader) => {
        const aliases = ALIAS_MAP[expectedHeader] || [expectedHeader.toLowerCase()];
        const index = headers.findIndex((h) => {
          const cleanH = h.replace(/[^a-z0-9_]/g, "");
          return aliases.some((alias) => {
            const cleanAlias = alias.replace(/[^a-z0-9_]/g, "");
            return cleanH === cleanAlias || cleanH.includes(cleanAlias) || cleanAlias.includes(cleanH);
          });
        });
        if (index !== -1) {
          headerMap[expectedHeader] = index;
        }
      });

      if (Object.keys(headerMap).length === 0) {
        showToast("Error: No se reconocieron las cabeceras del archivo. Verifique la plantilla.", "error");
        setProcessing(null);
        return;
      }

      const companyId = activeCompanyId || "default";

      // ========================================================================
      // TRATAMIENTO ESPECIAL: Comprobantes de Diario (Agrupación multilínea)
      // ========================================================================
      if (typeDef.id === "comprobantes") {
        const voucherMap = new Map<string, any>();

        for (let i = 0; i < dataRows.length; i++) {
          const rowValues = dataRows[i];
          const getVal = (headerName: string) => {
            const idx = headerMap[headerName];
            return idx !== undefined && rowValues[idx] !== undefined ? String(rowValues[idx]).trim() : "";
          };

          const num = getVal("numero") || `CD-${i + 1}`;
          const fecha = getVal("fecha") || new Date().toISOString().split("T")[0];
          const tipo = getVal("tipo") || "Diario";
          const desc = getVal("descripcion") || `Asiento Contable ${num}`;
          const ref = getVal("referencia") || "";

          if (!voucherMap.has(num)) {
            voucherMap.set(num, {
              id: `voucher-${Date.now()}-${num.replace(/[^a-zA-Z0-9]/g, "-")}`,
              numero: num,
              fecha,
              tipo,
              descripcion: desc,
              referencia: ref,
              moneda: "USD",
              tasaCambio: 1,
              estado: "Contabilizado",
              lineas: [],
              companyId,
              empresa_id: companyId,
              createdAt: new Date().toISOString(),
            });
          }

          const voucher = voucherMap.get(num);
          const cuentaCodigo = getVal("cuentaCodigo");
          const lineaDesc = getVal("lineaDescripcion") || desc;
          const debe = parseFloat(getVal("debe").replace(/[^0-9.-]/g, "")) || 0;
          const haber = parseFloat(getVal("haber").replace(/[^0-9.-]/g, "")) || 0;

          if (cuentaCodigo || debe > 0 || haber > 0) {
            voucher.lineas.push({
              id: crypto.randomUUID(),
              cuentaCodigo,
              cuentaId: cuentaCodigo,
              descripcion: lineaDesc,
              debe,
              haber,
              orden: voucher.lineas.length + 1,
            });
          }
        }

        const validVouchers = Array.from(voucherMap.values()).map((v) => {
          const totalDebe = v.lineas.reduce((acc: number, l: any) => acc + (l.debe || 0), 0);
          return {
            ...v,
            total: totalDebe,
          };
        });

        if (validVouchers.length === 0) {
          showToast("No se encontraron asientos contables válidos en el archivo.", "error");
          setProcessing(null);
          return;
        }

        const BATCH_SIZE = 10;
        const totalCount = validVouchers.length;
        setUploadProgress({
          typeId: typeDef.id,
          total: totalCount,
          current: 0,
          percent: 0,
          statusText: `Enviando ${totalCount} asientos contables a Supabase...`,
        });

        let savedCount = 0;
        for (let i = 0; i < validVouchers.length; i += BATCH_SIZE) {
          const chunk = validVouchers.slice(i, i + BATCH_SIZE);
          if (onSave) {
            await onSave("comprobantes", chunk);
          }
          savedCount += chunk.length;
          const percent = Math.round((savedCount / totalCount) * 100);
          setUploadProgress({
            typeId: typeDef.id,
            total: totalCount,
            current: savedCount,
            percent,
            statusText: `Guardando asientos ${savedCount} de ${totalCount} (${percent}%)...`,
          });
          await new Promise((res) => setTimeout(res, 60));
        }

        showToast(`¡Carga exitosa! Se procesaron ${savedCount} comprobantes contables con sus líneas.`, "success");
        setProcessing(null);
        setTimeout(() => {
          setUploadProgress({ typeId: null, total: 0, current: 0, percent: 0, statusText: "" });
        }, 2000);
        return;
      }

      // ========================================================================
      // TRATAMIENTO GENERAL PARA EL RESTO DE MÓDULOS
      // ========================================================================
      const validItems: any[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const values = dataRows[i];
        const item: any = {};

        if (typeDef.extraData) {
          Object.assign(item, typeDef.extraData);
        }

        let hasData = false;
        typeDef.headers.forEach((header) => {
          const idx = headerMap[header];
          if (idx !== undefined && values[idx] !== undefined) {
            let val = String(values[idx]).replace(/[\r\n]/g, "").trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.substring(1, val.length - 1);
            }

            // Normalización para Cuentas Contables
            if (typeDef.id === "cuentasContables" && header === "tipo") {
              const norm = val.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
              if (norm.includes("titulo") && norm.includes("movimiento")) {
                val = "Título de Cuenta Movimiento";
              } else if (norm.includes("general") || norm.includes("grupo") || norm.includes("totalizadora") || norm.includes("titulo")) {
                val = "Título General";
              } else {
                val = "Movimiento";
              }
            }

            // Normalización numérica
            if (
              [
                "precioBase",
                "montoTotal",
                "saldoPendiente",
                "saldoInicial",
                "monto",
                "price",
                "cost",
                "stock",
                "minStock",
                "costoAdquisicion",
                "valorResidual",
                "vidaUtilAnos",
                "debe",
                "haber"
              ].includes(header)
            ) {
              const cleanNum = val.replace(/[^0-9.-]/g, "");
              item[header] = parseFloat(cleanNum) || 0;
            } else if (["isCompany", "activo", "conciliado"].includes(header)) {
              item[header] = val.toLowerCase() === "true" || val === "1" || val.toLowerCase() === "si" || val.toLowerCase() === "sí";
            } else {
              item[header] = val;
            }

            if (val !== undefined && val !== "") hasData = true;
          }
        });

        if (hasData) {
          // Valores por defecto específicos
          if (typeDef.id === "cuentasContables") {
            if (!item.tipo || item.tipo === "") {
              const parts = (item.codigo || "").split(".");
              if (parts.length <= 2) item.tipo = "Título General";
              else if (parts.length === 3) item.tipo = "Título de Cuenta Movimiento";
              else item.tipo = "Movimiento";
            }
          } else if (typeDef.id === "consignatarios") {
            item.type = "customer";
            item.isCompany = item.isCompany ?? true;
          } else if (typeDef.id === "proveedores") {
            item.type = "supplier";
            item.isCompany = item.isCompany ?? true;
          } else if (typeDef.id === "cxc") {
            item.tipo = "factura";
            item.total = item.montoTotal || item.total || 0;
            item.saldo = item.saldoPendiente !== undefined ? item.saldoPendiente : item.total;
            item.fecha = item.fechaEmision || item.fecha || new Date().toISOString().split("T")[0];
            item.vencimiento = item.fechaVencimiento || item.vencimiento || item.fecha;
          } else if (typeDef.id === "cxp") {
            item.tipo = "factura";
            item.total = item.montoTotal || item.total || 0;
            item.saldo = item.saldoPendiente !== undefined ? item.saldoPendiente : item.total;
            item.fecha = item.fechaEmision || item.fecha || new Date().toISOString().split("T")[0];
            item.vencimiento = item.fechaVencimiento || item.vencimiento || item.fecha;
          } else if (typeDef.id === "bancos") {
            item.banco = item.nombre || item.banco;
            item.saldo = item.saldoInicial || item.saldo || 0;
          } else if (typeDef.id === "products") {
            item.codigo = item.code || item.codigo;
            item.nombre = item.name || item.nombre;
            item.precio = item.price || item.precio || 0;
            item.costo = item.cost || item.costo || 0;
          } else if (typeDef.id === "activosFijos") {
            item.valorCompra = item.costoAdquisicion || item.valorCompra || 0;
            item.vidaUtil = item.vidaUtilAnos || item.vidaUtil || 5;
          }

          item.companyId = companyId;
          item.empresa_id = companyId;
          item.createdAt = new Date().toISOString();
          if (item.activo === undefined) item.activo = true;
          if (!item.id) {
            item.id = item.codigo || item.code || item.taxId || `imp-${Date.now()}-${i}`;
          }
          validItems.push(item);
        }
      }

      if (validItems.length === 0) {
        showToast("No se encontraron registros válidos para importar en el archivo.", "error");
        setProcessing(null);
        return;
      }

      const BATCH_SIZE = 25;
      const totalCount = validItems.length;
      let importedCount = 0;

      setUploadProgress({
        typeId: typeDef.id,
        total: totalCount,
        current: 0,
        percent: 0,
        statusText: `Enviando ${totalCount} registros de ${typeDef.title} a Supabase...`,
      });

      for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
        const chunk = validItems.slice(i, i + BATCH_SIZE);
        if (onSave) {
          await onSave(typeDef.collection, chunk);
        }
        importedCount += chunk.length;
        const currentCount = Math.min(i + BATCH_SIZE, totalCount);
        const percent = Math.round((currentCount / totalCount) * 100);

        setUploadProgress({
          typeId: typeDef.id,
          total: totalCount,
          current: currentCount,
          percent,
          statusText: `Guardando registros ${currentCount} de ${totalCount} (${percent}%)...`,
        });
        await new Promise((res) => setTimeout(res, 50));
      }

      showToast(`¡Carga masiva exitosa! Se procesaron ${importedCount} registros de ${typeDef.title}.`, "success");
    } catch (e: any) {
      console.error(e);
      showToast(e.message || `Error al procesar archivo ${file.name}. Verifique el formato.`, "error");
    } finally {
      setProcessing(null);
      setTimeout(() => {
        setUploadProgress({ typeId: null, total: 0, current: 0, percent: 0, statusText: "" });
      }, 2000);
    }
  };

  const handleDrag = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(id);
    else if (e.type === "dragleave") setDragActive(null);
  };

  const handleDrop = (e: React.DragEvent, typeDef: UploadTypeDefinition) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(typeDef, e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Encabezado y Barra de Herramientas Superior */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Centro de Carga y Migración Masiva</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Importación y exportación masiva en <strong>Excel (.xlsx)</strong> y <strong>CSV</strong> para los 11 módulos principales del sistema.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Selector de Formato de Plantilla */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setTemplateFormat("xlsx")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                templateFormat === "xlsx"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => setTemplateFormat("csv")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                templateFormat === "csv"
                  ? "bg-white text-indigo-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600" />
              CSV (.csv)
            </button>
          </div>

          {/* Separador CSV */}
          {templateFormat === "csv" && (
            <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 px-2.5 rounded-xl border border-slate-200">
              <label className="text-[11px] font-bold text-slate-600">Separador:</label>
              <select
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value)}
                className="text-xs font-mono font-bold bg-white border border-slate-300 rounded px-1.5 py-0.5 outline-none"
              >
                <option value=",">Coma ( , )</option>
                <option value=";">Punto y Coma ( ; )</option>
                <option value="\t">Tabulación ( TAB )</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Barra de Progreso Global Activa */}
      {uploadProgress.typeId && uploadProgress.total > 0 && (
        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                Carga Masiva en Progreso...
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30 font-mono font-bold">
                  {uploadProgress.percent}%
                </span>
              </h4>
              <p className="text-xs text-slate-300 mt-1 font-medium">{uploadProgress.statusText}</p>
            </div>
          </div>

          <div className="w-full md:w-80 space-y-1.5 shrink-0">
            <div className="flex justify-between text-xs font-mono text-slate-300 font-bold">
              <span>
                {uploadProgress.current} de {uploadProgress.total} procesados
              </span>
              <span className="text-indigo-400">{uploadProgress.percent}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700 p-0.5">
              <div
                className="bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Pestañas de Filtro de Módulos y Barra de Búsqueda */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: "todos", label: "Todos los Módulos" },
            { id: "contabilidad", label: "Contabilidad" },
            { id: "tesoreria", label: "Tesorería & Bancos" },
            { id: "cxc_cxp", label: "CxC & CxP" },
            { id: "inventario", label: "Inventario & Activos" }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === tab.id
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar módulo o cabecera..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
      </div>

      {/* Rejilla de Tarjetas de Carga Masiva */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredModules.map((typeDef) => {
          const IconComp = typeDef.icon;
          const currentCount = getRecordCount(typeDef.id);

          return (
            <div
              key={typeDef.id}
              className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between shadow-sm relative overflow-hidden ${
                dragActive === typeDef.id
                  ? "border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/20 shadow-lg"
                  : "border-slate-200 hover:border-indigo-300 hover:shadow-md"
              }`}
              onDragEnter={(e) => handleDrag(e, typeDef.id)}
              onDragLeave={(e) => handleDrag(e, typeDef.id)}
              onDragOver={(e) => handleDrag(e, typeDef.id)}
              onDrop={(e) => handleDrop(e, typeDef)}
            >
              <div>
                {/* Cabecera de la Tarjeta */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2.5 rounded-xl border ${typeDef.badgeColor}`}>
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-sm leading-tight">{typeDef.title}</h3>
                      <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {currentCount} {currentCount === 1 ? "registro activo" : "registros activos"}
                      </span>
                    </div>
                  </div>

                  {/* Botón Descargar Plantilla */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDownloadTemplate(typeDef, templateFormat)}
                      className="text-[11px] font-extrabold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors border border-indigo-100"
                      title={`Descargar plantilla de ejemplo en formato ${templateFormat.toUpperCase()}`}
                    >
                      <Download className="w-3 h-3 text-indigo-600" />
                      Plantilla {templateFormat.toUpperCase()}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-2 leading-relaxed min-h-[36px]">{typeDef.description}</p>

                {/* Columnas aceptadas (Pills informativas) */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {typeDef.headers.slice(0, 5).map((h) => (
                    <span
                      key={h}
                      className="text-[10px] font-mono font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200"
                    >
                      {h}
                    </span>
                  ))}
                  {typeDef.headers.length > 5 && (
                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                      +{typeDef.headers.length - 5} col
                    </span>
                  )}
                </div>
              </div>

              {/* Pie de la Tarjeta: Zona de Carga y Acciones */}
              <div className="mt-5 pt-4 border-t border-slate-100 space-y-2.5">
                {/* Barra de Progreso Específica de Card */}
                {uploadProgress.typeId === typeDef.id && (
                  <div className="p-3 bg-indigo-50/90 rounded-xl border border-indigo-200 space-y-2 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center text-xs font-bold text-indigo-950">
                      <span className="flex items-center gap-1.5 truncate">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
                        <span className="truncate text-[11px] font-mono">
                          {uploadProgress.current} / {uploadProgress.total}
                        </span>
                      </span>
                      <span className="font-mono text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-200 text-[11px] shrink-0 font-extrabold">
                        {uploadProgress.percent}%
                      </span>
                    </div>
                    <div className="w-full bg-indigo-200/60 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-600 to-cyan-500 h-full rounded-full transition-all duration-200"
                        style={{ width: `${uploadProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Input File Drag & Drop */}
                <label
                  className={`w-full py-3 px-4 rounded-xl border border-dashed text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    processing === typeDef.id
                      ? "bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed"
                      : "bg-slate-50 hover:bg-indigo-50/50 border-slate-300 hover:border-indigo-500 text-slate-700 hover:text-indigo-700 shadow-sm"
                  }`}
                >
                  {processing === typeDef.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  ) : (
                    <UploadCloud className="w-4 h-4 text-indigo-600" />
                  )}
                  <span>
                    {processing === typeDef.id ? `Cargando (${uploadProgress.percent}%)...` : "Subir Excel o CSV"}
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    className="hidden"
                    disabled={processing === typeDef.id}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(typeDef, e.target.files[0]);
                      }
                    }}
                  />
                </label>

                {/* Botones de Exportar Existentes y Limpiar */}
                <div className="flex justify-between items-center text-[11px] pt-1 text-slate-500 font-bold">
                  <button
                    type="button"
                    onClick={() => handleDownloadCurrentData(typeDef, templateFormat)}
                    disabled={processing === typeDef.id + "_download"}
                    className="hover:text-indigo-600 flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    {processing === typeDef.id + "_download" ? (
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    Exportar Existentes
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteAll(typeDef)}
                    disabled={processing === typeDef.id}
                    className="hover:text-rose-600 flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    Limpiar Módulo
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredModules.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-2">
          <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-black text-slate-700">No se encontraron módulos</h3>
          <p className="text-xs text-slate-400">
            No hay ningún módulo que coincida con el criterio de búsqueda "{searchTerm}".
          </p>
        </div>
      )}
    </div>
  );
}
