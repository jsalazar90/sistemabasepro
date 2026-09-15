import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  Filter, 
  FileText, 
  Clock, 
  User, 
  Database, 
  ChevronDown, 
  ChevronUp,
  ArrowRight,
  Info
} from 'lucide-react';
import { dbFetchAuditoriaLogs, AuditoriaLogEntry } from '../../services/db';

interface AuditLogsViewerProps {
  companyId: string;
}

export const AuditLogsViewer: React.FC<AuditLogsViewerProps> = ({ companyId }) => {
  const [logs, setLogs] = useState<AuditoriaLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string>('all');
  const [selectedOp, setSelectedOp] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await dbFetchAuditoriaLogs(companyId, 150);
      setLogs(data || []);
    } catch (err) {
      console.error('Error cargando bitácora de auditoría:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      loadLogs();
    }
  }, [companyId]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.usuario_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.tabla || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.detalles || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.registro_id || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTable = selectedTable === 'all' || log.tabla === selectedTable;
    const matchesOp = selectedOp === 'all' || log.operacion === selectedOp;

    return matchesSearch && matchesTable && matchesOp;
  });

  const getOpBadge = (op: string) => {
    switch (op) {
      case 'INSERT':
        return (
          <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
            INSERT
          </span>
        );
      case 'UPDATE':
        return (
          <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-blue-50 text-blue-700 border border-blue-200">
            UPDATE
          </span>
        );
      case 'DELETE':
        return (
          <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-rose-50 text-rose-700 border border-rose-200">
            DELETE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-slate-100 text-slate-700 border border-slate-200">
            {op}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-xl relative overflow-hidden border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-black">
              <ShieldAlert size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-white">
                  Pista de Auditoría Forense (Audit Trail)
                </h2>
                <span className="px-2 py-0.5 text-[9px] font-black tracking-wider uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-md">
                  Inmutable
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Trazabilidad criptográfica y registro estricto de eventos DML (creación, edición y eliminación) con disparadores en PostgreSQL.
              </p>
            </div>
          </div>

          <button
            onClick={loadLogs}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Actualizar Registros</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por usuario, ID, tabla o detalle..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="relative">
          <Filter size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={selectedTable}
            onChange={e => setSelectedTable(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
          >
            <option value="all">Todas las Tablas Auditadas</option>
            <option value="facturas_venta">Facturas de Venta</option>
            <option value="cuentas_cobrar_cxc">Cuentas por Cobrar (CxC)</option>
            <option value="cuentas_pagar_cxp">Cuentas por Pagar (CxP)</option>
            <option value="comprobantes_diario">Comprobantes Contables</option>
            <option value="productos">Catálogo de Productos</option>
            <option value="configuracion_contable">Configuración Fiscal / Contable</option>
          </select>
        </div>

        <div className="relative">
          <Database size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={selectedOp}
            onChange={e => setSelectedOp(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
          >
            <option value="all">Todas las Operaciones (DML)</option>
            <option value="INSERT">Solo Inserciones (INSERT)</option>
            <option value="UPDATE">Solo Modificaciones (UPDATE)</option>
            <option value="DELETE">Solo Eliminaciones (DELETE)</option>
          </select>
        </div>
      </div>

      {/* Audit Logs List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw size={28} className="animate-spin mx-auto mb-2 text-indigo-500" />
            <p className="text-xs font-bold">Consultando registros forenses en la base de datos...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Info size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">Sin eventos de auditoría registrados</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Las operaciones DML en facturas, CxC, CxP, comprobantes contables y catálogo de productos generarán bitácoras forenses de forma automática.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map(log => {
              const isExpanded = expandedLogId === log.id;
              const dateStr = new Date(log.created_at).toLocaleString('es-VE', {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });

              return (
                <div key={log.id} className="p-4 hover:bg-slate-50/80 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {getOpBadge(log.operacion)}
                      <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {log.tabla}
                      </span>
                      <span className="text-xs font-medium text-slate-600 truncate max-w-xs sm:max-w-md">
                        {log.detalles || 'Evento de auditoría registrado'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-slate-400 text-xs shrink-0">
                      <div className="flex items-center gap-1.5 font-medium text-slate-500">
                        <User size={13} />
                        <span>{log.usuario_email || 'Sistema'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Clock size={13} />
                        <span>{dateStr}</span>
                      </div>
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer"
                        title={isExpanded ? 'Ocultar detalles' : 'Ver payload JSON'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded JSON Inspector */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-200">
                      <div className="bg-slate-900 text-slate-100 p-3 rounded-xl text-[11px] font-mono overflow-x-auto">
                        <span className="text-rose-400 font-bold block mb-1">
                          Valores Anteriores (OLD):
                        </span>
                        {log.valores_anteriores ? (
                          <pre>{JSON.stringify(log.valores_anteriores, null, 2)}</pre>
                        ) : (
                          <span className="text-slate-500 italic">Ninguno (Registro Nuevo)</span>
                        )}
                      </div>

                      <div className="bg-slate-900 text-slate-100 p-3 rounded-xl text-[11px] font-mono overflow-x-auto">
                        <span className="text-emerald-400 font-bold block mb-1">
                          Valores Nuevos (NEW):
                        </span>
                        {log.valores_nuevos ? (
                          <pre>{JSON.stringify(log.valores_nuevos, null, 2)}</pre>
                        ) : (
                          <span className="text-slate-500 italic">Ninguno (Registro Eliminado)</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
