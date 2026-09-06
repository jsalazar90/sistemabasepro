import React, { useState } from "react";
import {
  UploadCloud,
  Download,
  FileText,
  Building2,
  UserCheck,
  Calculator,
  Loader2,
  Trash2
} from "lucide-react";
import { useCompany } from "../../context/CompanyContext";

interface BulkUploadConfigProps {
  contactos?: any[];
  servicios?: any[];
  cuentasContables?: any[];
  onSave: (collection: string, data: any) => void;
  showToast: (msg: string, type: string) => void;
}

const UPLOAD_TYPES = [
  {
    id: "consignatarios",
    title: "Clientes",
    description: "Directorio de clientes, RIF, datos de contacto y cuentas contables",
    collection: "contacts",
    extraData: { type: "customer", isCompany: true },
    headers: ["taxId", "name", "email", "phone", "address", "personaContacto", "debitAccount", "creditAccount"],
    sampleData: [
      [
        "J-12345678-0",
        "Distribuidora Industrial C.A.",
        "operaciones@distribuidora.com",
        "+58 212 5551122",
        "Caracas, Distrito Capital",
        "Carlos Morales",
        "1.1.4",
        "2.1.1"
      ],
      [
        "J-30982144-1",
        "Importaciones & Servicios C.A.",
        "contacto@importaciones.com",
        "+58 212 7773344",
        "Valencia, Estado Carabobo",
        "María Fernández",
        "1.1.4",
        "2.1.1"
      ],
    ],
  },
  {
    id: "proveedores",
    title: "Proveedores",
    description: "Directorio de proveedores, contratistas y cuentas contables",
    collection: "contacts",
    extraData: { type: "supplier", isCompany: true },
    headers: ["taxId", "name", "email", "phone", "address", "isCompany", "debitAccount", "creditAccount", "expenseAccount"],
    sampleData: [
      [
        "J-98765432-1",
        "Proveedor Global C.A.",
        "ventas@proveedor.com",
        "+58 212 2222222",
        "Zona Industrial, Valencia",
        "true",
        "",
        "2.1.1",
        "5.1.1"
      ],
    ],
  },
  {
    id: "cuentasContables",
    title: "Plan de Cuentas Contables",
    description: "Códigos, nombres, tipos y grupos contables NIIF",
    collection: "accounting-accounts",
    headers: ["codigo", "nombre", "tipo", "naturaleza", "grupo"],
    sampleData: [
      ["1.1.1", "Caja Chica", "Movimiento", "Deudora", "Activo"],
      [
        "4.1.1",
        "Ingresos por Ventas y Servicios",
        "Movimiento",
        "Acreedora",
        "Ingreso",
      ],
    ],
  },
  {
    id: "servicios",
    title: "Catálogo de Artículos y Servicios",
    description: "Catálogo de productos, ítems y servicios con precios y cuentas",
    collection: "services",
    headers: ["codigo", "nombre", "descripcion", "precioBase", "cuentaContableId"],
    sampleData: [
      ["SERV-001", "Servicio Administrativo y Consultoría", "Honorarios profesionales", "150.00", "4.1.1"],
      ["PROD-001", "Suministro Estándar", "Artículo de consumo", "85.00", "4.1.1"],
    ],
  }
];

export default function BulkUploadConfig({
  contactos = [],
  servicios = [],
  cuentasContables = [],
  onSave,
  showToast,
}: BulkUploadConfigProps) {
  const [dragActive, setDragActive] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [delimiter, setDelimiter] = useState<string>(",");
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

  const handleDownloadTemplate = (typeDef: (typeof UPLOAD_TYPES)[0]) => {
    const rows = [typeDef.headers, ...typeDef.sampleData];
    let actualDelimiter = delimiter === "\\t" || delimiter === "\t" ? "\t" : delimiter;
    const csvContent = rows.map((e) => e.join(actualDelimiter)).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const ext = actualDelimiter === "\t" ? "txt" : "csv";

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Plantilla_Ejemplo_${typeDef.id}.${ext}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Plantilla descargada: Plantilla_Ejemplo_${typeDef.id}.${ext}`, "success");
  };

  const handleDownloadCurrentData = async (typeDef: (typeof UPLOAD_TYPES)[0]) => {
    if (!activeCompanyId) {
      showToast("Seleccione una empresa primero.", "error");
      return;
    }

    setProcessing(typeDef.id + "_download");
    try {
      let itemsToExport = contactos || [];
      if (typeDef.id === "cuentasContables") itemsToExport = cuentasContables || [];
      else if (typeDef.id === "servicios") itemsToExport = servicios || [];

      if (itemsToExport.length === 0) {
        showToast("No hay datos cargados en el sistema para descargar.", "info");
        return;
      }

      const rows: string[][] = [typeDef.headers];
      let actualDelimiter = delimiter === "\\t" || delimiter === "\t" ? "\t" : delimiter;

      itemsToExport.forEach((data: any) => {
        const row = typeDef.headers.map((header) => {
          let val = data[header] ?? "";
          if (typeof val === "string") {
            if (
              val.includes(actualDelimiter) ||
              val.includes('"') ||
              val.includes("\n") ||
              val.includes("\r")
            ) {
              val = `"${val.replace(/"/g, '""')}"`;
            }
          }
          return String(val);
        });
        rows.push(row);
      });

      const csvContent = rows.map((e) => e.join(actualDelimiter)).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const ext = actualDelimiter === "\t" ? "txt" : "csv";

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Datos_${typeDef.id}.${ext}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast(`Datos descargados: Datos_${typeDef.id}.${ext}`, "success");
    } catch (e) {
      console.error(e);
      showToast("Error al descargar los datos.", "error");
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteAll = async (typeDef: (typeof UPLOAD_TYPES)[0]) => {
    if (
      !window.confirm(
        `¿Está seguro que desea eliminar TODOS los registros de ${typeDef.title}? Esta acción reseteará la colección.`,
      )
    ) {
      return;
    }

    setProcessing(typeDef.id);
    try {
      if (onSave) {
        onSave(typeDef.id, []);
      }
      showToast(`Se restableció la colección de ${typeDef.title} exitosamente.`, "success");
    } catch (error: any) {
      console.error(error);
      showToast(`Error al restablecer: ${error.message || 'Desconocido'}`, "error");
    } finally {
      setProcessing(null);
    }
  };

  const parseCSVLine = (line: string, delim: string = ",") => {
    const result = [];
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

  const handleFileUpload = async (
    typeDef: (typeof UPLOAD_TYPES)[0],
    file: File,
  ) => {
    setProcessing(typeDef.id);

    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file, "Windows-1252");
      });

      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

      if (lines.length <= 1) {
        showToast(
          "El archivo está vacío o solo contiene la cabecera.",
          "error",
        );
        setProcessing(null);
        return;
      }

      const firstLine = lines[0].replace(/^\uFEFF/, "");
      let activeDelimiter = delimiter;
      if (firstLine.includes("\t")) {
        activeDelimiter = "\t";
      } else if (firstLine.includes(";") && !firstLine.includes(",")) {
        activeDelimiter = ";";
      } else if (firstLine.includes(",") && !firstLine.includes(";")) {
        activeDelimiter = ",";
      }

      const headers = parseCSVLine(firstLine, activeDelimiter).map((h) =>
        h
          .replace(/[\r\n]/g, "")
          .trim()
          .toLowerCase(),
      );

      const ALIAS_MAP: Record<string, string[]> = {
        taxId: ["taxid", "rif", "cedula", "id", "identificacion", "documento", "cédula", "identificación"],
        name: ["name", "nombre", "razon social", "razón social", "cliente", "proveedor", "contacto"],
        email: ["email", "correo", "email", "contacto_email", "mail"],
        phone: ["phone", "telefono", "teléfono", "celular", "tlf"],
        address: ["address", "direccion", "dirección", "direccion fiscal", "dirección fiscal"],
        personaContacto: ["personacontacto", "persona_contacto", "contacto", "representante"],
        isCompany: ["iscompany", "escompany", "esempresa", "es_empresa", "empresa", "persona jurídica", "persona juridica", "juridico", "jurídico"],
        debitAccount: ["debitaccount", "cuentadebito", "cuenta_debito", "cuentaporcobrar", "cuenta_por_cobrar", "cxc", "cuenta debito", "cuenta cobro"],
        creditAccount: ["creditaccount", "cuentacredito", "cuenta_credito", "cuentaporpagar", "cuenta_por_pagar", "cxp", "cuenta credito", "cuenta pago"],
        expenseAccount: ["expenseaccount", "cuentagasto", "cuenta_gasto", "gasto"],
        codigo: ["codigo", "cod", "cuenta", "codigo_cuenta", "referencia"],
        tipo: ["tipo", "tipo_cuenta", "naturaleza_tipo"],
        naturaleza: ["naturaleza", "nat"],
        grupo: ["grupo", "clasificacion", "rubro"],
        descripcion: ["descripcion", "descripción", "detalle", "concepto"],
        precioBase: ["preciobase", "precio_base", "precio", "monto", "tarifa"],
        cuentaContableId: ["cuentacontableid", "cuenta_contable", "cuenta_ingreso", "cuenta"]
      };

      const headerMap: Record<string, number> = {};
      typeDef.headers.forEach((expectedHeader) => {
        const aliases = ALIAS_MAP[expectedHeader] || [expectedHeader.toLowerCase()];
        const index = headers.findIndex((h) => {
          const cleanH = h.replace(/[^a-z0-9_]/g, "");
          return aliases.some(alias => {
            const cleanAlias = alias.replace(/[^a-z0-9_]/g, "");
            return cleanH === cleanAlias || cleanH.includes(cleanAlias) || cleanAlias.includes(cleanH);
          });
        });
        if (index !== -1) {
          headerMap[expectedHeader] = index;
        }
      });

      if (Object.keys(headerMap).length === 0) {
        showToast(
          "Error: No se reconocieron las cabeceras del archivo. Asegúrese que coincidan con la plantilla.",
          "error",
        );
        setProcessing(null);
        return;
      }

      let importedCount = 0;
      const companyId = activeCompanyId || "default";

      let targetCollection = typeDef.collection || "contactos";
      if (typeDef.id === "cuentasContables") targetCollection = "cuentasContables";
      else if (typeDef.id === "servicios") targetCollection = "servicios";
      else if (typeDef.id === "consignatarios" || typeDef.id === "proveedores") targetCollection = "contactos";

      const validItems: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const values = parseCSVLine(line, activeDelimiter);
        const item: any = {};

        if (typeDef.extraData) {
          Object.assign(item, typeDef.extraData);
        }

        let hasData = false;
        typeDef.headers.forEach((header) => {
          const idx = headerMap[header];
          if (idx !== undefined && values[idx] !== undefined) {
            let val = values[idx].replace(/[\r\n]/g, "").trim();
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.substring(1, val.length - 1);
            }

            if (typeDef.collection === "accounting-accounts" && header === "tipo") {
              const lowerV = val.toLowerCase();
              if (lowerV.includes("movimiento")) val = "Movimiento";
              else val = "Título General";
            }

            if (["precioBase"].includes(header)) {
              item[header] = Number(val) || 0;
            } else {
              item[header] = val;
            }

            if (val !== undefined && val !== "") hasData = true;
          }
        });

        if (hasData) {
          item.companyId = companyId;
          item.empresa_id = companyId;
          item.createdAt = new Date().toISOString();
          if (item.activo === undefined) item.activo = true;
          if (!item.id) {
            item.id = item.codigo || item.taxId || `imp-${Date.now()}-${i}`;
          }
          validItems.push(item);
        }
      }

      const BATCH_SIZE = 25;
      const totalCount = validItems.length;
      setUploadProgress({
        typeId: typeDef.id,
        total: totalCount,
        current: 0,
        percent: 0,
        statusText: `Enviando ${totalCount} registros a Supabase...`
      });

      for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
        const chunk = validItems.slice(i, i + BATCH_SIZE);
        if (onSave) {
          await onSave(targetCollection, chunk);
        }
        importedCount += chunk.length;
        const currentCount = Math.min(i + BATCH_SIZE, totalCount);
        const percent = Math.round((currentCount / totalCount) * 100);

        setUploadProgress({
          typeId: typeDef.id,
          total: totalCount,
          current: currentCount,
          percent: percent,
          statusText: `Guardando registros ${currentCount} de ${totalCount} en Supabase (${percent}%)...`
        });
        await new Promise((res) => setTimeout(res, 50));
      }

      if (importedCount > 0) {
        showToast(
          `¡Carga masiva exitosa! Se procesaron ${importedCount} documentos/registros de ${typeDef.title}.`,
          "success",
        );
      } else {
        showToast("No se encontraron registros válidos para importar.", "info");
      }
    } catch (e: any) {
      console.error(e);
      showToast(
        e.message || `Error procesando archivo ${file.name}. Verifique el formato.`,
        "error",
      );
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
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(id);
    } else if (e.type === "dragleave") {
      setDragActive(null);
    }
  };

  const handleDrop = (
    e: React.DragEvent,
    typeDef: (typeof UPLOAD_TYPES)[0],
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(typeDef, e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <UploadCloud className="w-6 h-6 text-indigo-600" />
            Carga Masiva de Datos del Sistema Base
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Importación y exportación de clientes, proveedores, catálogo de artículos/servicios y plan de cuentas contable.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <label className="text-xs font-bold text-slate-600">Separador de Archivo:</label>
          <select
            value={delimiter}
            onChange={(e) => setDelimiter(e.target.value)}
            className="text-xs font-mono font-bold bg-white border border-slate-300 rounded px-2 py-1 outline-none"
          >
            <option value=",">Coma ( , )</option>
            <option value=";">Punto y Coma ( ; )</option>
            <option value="\t">Tabulación ( TAB )</option>
          </select>
        </div>
      </div>

      {/* Banner de Progreso Activo de Carga Masiva */}
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
              <span>{uploadProgress.current} de {uploadProgress.total} registros</span>
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

      {/* Rejilla de Módulos de Carga Masiva */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {UPLOAD_TYPES.map((typeDef) => (
          <div
            key={typeDef.id}
            className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between shadow-sm relative overflow-hidden ${
              dragActive === typeDef.id
                ? "border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/20"
                : "border-slate-200 hover:border-indigo-300 hover:shadow-md"
            }`}
            onDragEnter={(e) => handleDrag(e, typeDef.id)}
            onDragLeave={(e) => handleDrag(e, typeDef.id)}
            onDragOver={(e) => handleDrag(e, typeDef.id)}
            onDrop={(e) => handleDrop(e, typeDef)}
          >
            <div>
              <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                  {typeDef.id === 'consignatarios' && <UserCheck className="w-5 h-5" />}
                  {typeDef.id === 'cuentasContables' && <FileText className="w-5 h-5 text-emerald-600" />}
                  {typeDef.id === 'servicios' && <Calculator className="w-5 h-5 text-purple-600" />}
                  {typeDef.id === 'proveedores' && <Building2 className="w-5 h-5 text-amber-600" />}
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate(typeDef)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  title="Descargar plantilla de ejemplo"
                >
                  <Download className="w-3.5 h-3.5" />
                  Ejemplo CSV
                </button>
              </div>

              <h3 className="font-extrabold text-slate-800 text-sm">{typeDef.title}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{typeDef.description}</p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
              {/* Barra de Progreso Específica de Card */}
              {uploadProgress.typeId === typeDef.id && (
                <div className="p-3 bg-indigo-50/90 rounded-xl border border-indigo-200 space-y-2 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center text-xs font-bold text-indigo-950">
                    <span className="flex items-center gap-1.5 truncate">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
                      <span className="truncate text-[11px] font-mono">{uploadProgress.current} / {uploadProgress.total}</span>
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

              <label
                className={`w-full py-3 px-4 rounded-xl border border-dashed text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  processing === typeDef.id
                    ? "bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed"
                    : "bg-slate-50 hover:bg-white border-slate-300 hover:border-indigo-500 text-slate-700 hover:text-indigo-600 shadow-sm"
                }`}
              >
                {processing === typeDef.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                <span>{processing === typeDef.id ? `Cargando (${uploadProgress.percent}%)...` : "Subir Archivo"}</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  disabled={processing === typeDef.id}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(typeDef, e.target.files[0]);
                    }
                  }}
                />
              </label>

              <div className="flex justify-between items-center text-[11px] pt-1 text-slate-400 font-medium">
                <button
                  type="button"
                  onClick={() => handleDownloadCurrentData(typeDef)}
                  className="hover:text-slate-700 flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Exportar Existentes
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteAll(typeDef)}
                  className="hover:text-rose-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Limpiar Todo
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
