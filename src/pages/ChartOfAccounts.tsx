import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Filter,
  MoreVertical,
  Hash,
  AlignLeft,
  Layers,
  Edit2,
  Trash2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import BackButton from "../components/common/BackButton";

const ITEMS_PER_PAGE = 15;

export const AREAS_FLUJO = [
  { id: "cobranzas", nombre: "1. Ingresos por Cobranzas (+)" },
  { id: "recibidos", nombre: "2. Ingresos por Préstamos Recibidos (+)" },
  { id: "gastos_er", nombre: "3. Gastos Pagados (Estado de Resultado) (-)" },
  { id: "proveedores_real", nombre: "4. Pagos a Proveedores / Cuentas por Pagar (Cuentas Reales) (-)" },
  { id: "prestamos_ot", nombre: "5. Préstamos Otorgados (-)" },
  { id: "seniat", nombre: "6. Pagos Realizados Cajas SENIAT / Tributos (-)" },
  { id: "directivos", nombre: "7. Pagos a Directivos / Socios (-)" },
  { id: "traspasos", nombre: "8. Traspasos Internos (+/-)" },
];

export default function ChartOfAccounts({
  cuentasContables = [],
  onSave,
  showToast,
}: {
  cuentasContables?: any[];
  onSave?: any;
  showToast?: any;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    tipo: "Movimiento",
    naturaleza: "Deudora",
    grupo: "Activo",
    areaFlujoCaja: "",
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType]);

  const filteredAccounts = cuentasContables
    .filter((cuenta) => {
      const matchesSearch =
        (cuenta.codigo || "")
          .toLowerCase()
          .includes((searchQuery || "").toLowerCase()) ||
        (cuenta.nombre || "")
          .toLowerCase()
          .includes((searchQuery || "").toLowerCase());

      const matchesFilter = filterType === "all" || cuenta.tipo === filterType;

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => (a.codigo || "").localeCompare(b.codigo || ""));

  const totalPages = Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE);
  const paginatedAccounts = filteredAccounts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handleOpenModal = (cuenta?: any) => {
    if (cuenta) {
      setEditingId(cuenta.id);
      setForm({
        codigo: cuenta.codigo || "",
        nombre: cuenta.nombre || "",
        tipo: cuenta.tipo || "Movimiento",
        naturaleza: cuenta.naturaleza || "Deudora",
        grupo: cuenta.grupo || "Activo",
        areaFlujoCaja: cuenta.areaFlujoCaja || "",
      });
    } else {
      setEditingId(null);
      setForm({
        codigo: "",
        nombre: "",
        tipo: "Movimiento",
        naturaleza: "Deudora",
        grupo: "Activo",
        areaFlujoCaja: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.codigo || !form.nombre) {
      showToast?.("Por favor completa los campos requeridos", "error");
      return;
    }

    const newAccount = {
      id: editingId || `acc-${Date.now()}`,
      ...form,
    };

    try {
      if (onSave) {
        await onSave("cuentasContables", newAccount);
      }
      showToast?.(
        `Cuenta ${editingId ? "actualizada" : "creada"} exitosamente`,
        "success",
      );
      handleCloseModal();
    } catch (error: any) {
      console.error(error);
      if (typeof window !== "undefined") {
        window.alert(`Error UI: ${error.message || "Error desconocido en guardar"}`);
      }
    }
  };

  return (
    <div className="px-3 sm:px-6 pt-1 pb-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-3.5">
        <div className="mb-2.5">
          <BackButton to="/accounting" label="Volver a Contabilidad" />
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Cuentas Contables
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gestiona el plan de cuentas de tu empresa
            </p>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Nueva Cuenta
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterType("all")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex-1 sm:flex-none whitespace-nowrap ${filterType === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilterType("Título General")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex-1 sm:flex-none whitespace-nowrap ${filterType === "Título General" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Títulos Generales
          </button>
          <button
            onClick={() => setFilterType("Título de Cuenta Movimiento")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex-1 sm:flex-none whitespace-nowrap ${filterType === "Título de Cuenta Movimiento" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Títulos Movimiento
          </button>
          <button
            onClick={() => setFilterType("Movimiento")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex-1 sm:flex-none whitespace-nowrap ${filterType === "Movimiento" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            De Movimiento
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por código o nombre..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Accounts List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider select-none">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nombre de la Cuenta</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Naturaleza</th>
                <th className="px-4 py-3">Mapeo Flujo de Caja</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedAccounts.map((cuenta) => (
                <tr
                  key={cuenta.id}
                  className="hover:bg-indigo-50/30 transition-colors group"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono font-bold text-slate-700 text-xs">
                        {cuenta.codigo}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`font-semibold ${cuenta.tipo === "Título General" ? "text-slate-900 font-black text-sm" : cuenta.tipo === "Título de Cuenta Movimiento" ? "text-slate-800 font-bold text-xs pl-3" : "text-slate-600 text-xs pl-6"}`}
                    >
                      {cuenta.nombre}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                        cuenta.tipo === "Título General"
                          ? "bg-amber-50 text-amber-800 border border-amber-200"
                          : cuenta.tipo === "Título de Cuenta Movimiento"
                            ? "bg-blue-50 text-blue-800 border border-blue-200"
                            : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {cuenta.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs font-medium">
                    {cuenta.naturaleza || "Deudora"}
                  </td>
                  <td className="px-4 py-2.5">
                    {cuenta.areaFlujoCaja ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {AREAS_FLUJO.find(a => a.id === cuenta.areaFlujoCaja)?.nombre || cuenta.areaFlujoCaja}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Automático</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenModal(cuenta)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar cuenta"
                      >
                        <Edit2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedAccounts.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    <Layers className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-lg font-medium text-slate-900 mb-1">
                      No se encontraron cuentas
                    </p>
                    <p>Ajusta los filtros o intenta con otra búsqueda.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <span className="text-sm text-slate-500">
                Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} a{" "}
                {Math.min(
                  currentPage * ITEMS_PER_PAGE,
                  filteredAccounts.length,
                )}{" "}
                de {filteredAccounts.length} cuentas
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-slate-200 bg-white rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center p-1"
                  title="Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1 mx-2">
                  <span className="text-sm font-medium text-slate-700">
                    Página {currentPage}
                  </span>
                  <span className="text-sm text-slate-500">
                    de {totalPages}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-slate-200 bg-white rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center p-1"
                  title="Siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nueva/Editar Cuenta */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? "Editar Cuenta" : "Nueva Cuenta Contable"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <MoreVertical size={20} className="rotate-90" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Código de Cuenta *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Ej. 1101.01"
                    value={form.codigo}
                    onChange={(e) =>
                      setForm({ ...form, codigo: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Nombre de la Cuenta *
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    placeholder="Ej. Banco Nacional"
                    value={form.nombre}
                    onChange={(e) =>
                      setForm({ ...form, nombre: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Tipo
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      value={form.tipo}
                      onChange={(e) =>
                        setForm({ ...form, tipo: e.target.value })
                      }
                    >
                      <option value="Título General">Título General</option>
                      <option value="Título de Cuenta Movimiento">
                        Título de Cuenta Movimiento
                      </option>
                      <option value="Movimiento">Cuenta de Movimiento</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Naturaleza
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      value={form.naturaleza}
                      onChange={(e) =>
                        setForm({ ...form, naturaleza: e.target.value })
                      }
                    >
                      <option value="Deudora">Deudora</option>
                      <option value="Acreedora">Acreedora</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Grupo
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={form.grupo}
                    onChange={(e) =>
                      setForm({ ...form, grupo: e.target.value })
                    }
                  >
                    <option value="Activo">Activo</option>
                    <option value="Pasivo">Pasivo</option>
                    <option value="Patrimonio">Patrimonio</option>
                    <option value="Ingresos">Ingresos</option>
                    <option value="Egresos">Egresos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Área del Flujo de Caja (Mapeo Manual)
                  </label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    value={form.areaFlujoCaja}
                    onChange={(e) =>
                      setForm({ ...form, areaFlujoCaja: e.target.value })
                    }
                  >
                    <option value="">-- Automático (Clasificación por Código) --</option>
                    {AREAS_FLUJO.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Selecciona un área específica para anular la detección automática y forzar este movimiento al rubro indicado del Flujo de Caja.
                  </p>
                </div>
              </div>

              <div className="pt-4 mt-6 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
                >
                  {editingId ? "Guardar Cambios" : "Crear Cuenta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
