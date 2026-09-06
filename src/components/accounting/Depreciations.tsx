import React, { useState } from 'react';
import { Calculator, Search, Filter, Play, X, Eye, Trash2 } from 'lucide-react';

interface DepreciationsProps {
  depreciaciones: any[];
  activosFijos: any[];
  categoriasActivos: any[];
  onSave: (collection: string, data: any) => void;
  showToast: (msg: string, type: string) => void;
}

export default function Depreciations({ depreciaciones, activosFijos, categoriasActivos, onSave, showToast }: DepreciationsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedDepreciacion, setSelectedDepreciacion] = useState<any | null>(null);
  const [mes, setMes] = useState('1');
  const [anio, setAnio] = useState(new Date().getFullYear().toString());

  const handleDeleteDepreciacion = (dep: any) => {
    onSave('depreciaciones', { id: dep.id, _delete: true });
    // Anular o eliminar comprobante asociado
    if (dep.comprobante) {
      onSave('comprobantes', { id: `asiento-dep-${dep.id}`, _delete: true });
    }
    showToast(`Registro de depreciación ${dep.periodo} eliminado`, 'success');
  };

  const handleExecute = () => {
    if (activosFijos.length === 0) {
      showToast('No hay activos fijos para depreciar', 'error');
      setShowModal(false);
      return;
    }

    const periodo = `${mes.padStart(2, '0')}/${anio}`;
    
    // Check if already executed
    if (depreciaciones.some(d => d.periodo === periodo)) {
      showToast(`La depreciación para el período ${periodo} ya fue ejecutada`, 'error');
      return;
    }

    let totalDepreciado = 0;
    const detalles: any[] = [];
    const timestamp = Date.now();
    
    // Map to group depreciation by accounts
    const accountTotals: Record<string, { debe: number, haber: number, descripcion: string }> = {};

    activosFijos.forEach(activo => {
      const categoria = categoriasActivos.find(c => 
        String(c.id) === String(activo.categoriaId) || 
        (c.nombre && (c.nombre.toLowerCase() === (activo.categoriaNombre || activo.categoria || '').toLowerCase())) ||
        (c.codigo && (c.codigo.toLowerCase() === (activo.categoriaId || '').toLowerCase()))
      );

      const vidaUtilMeses = Number(categoria?.vidaUtil || activo.vidaUtilMeses || 60);
      const valorInicial = Number(activo.valorInicial || activo.valorCompra || 0);

      if (valorInicial > 0) {
        // Linea recta mensual (si vidaUtilMeses <= 10 se asume años y se multiplica por 12, sino meses)
        const meses = vidaUtilMeses <= 10 ? vidaUtilMeses * 12 : vidaUtilMeses;
        const depreciacionMensual = Math.round((valorInicial / (meses > 0 ? meses : 60)) * 100) / 100;
        totalDepreciado += depreciacionMensual;
        
        detalles.push({
          activoId: activo.id,
          codigo: activo.codigo,
          descripcion: activo.descripcion || activo.nombre,
          categoria: categoria?.nombre || activo.categoriaNombre || activo.categoria || 'General',
          valorInicial,
          depreciacionMensual
        });

        // Cuentas Contables NIIF: Gasto de Depreciación (Debe) y Depreciación Acumulada (Haber)
        const cuentaGasto = categoria?.cuentaGastoDeprec || categoria?.cuentaGasto || '5.1.05.01';
        const cuentaDeprecAcum = categoria?.cuentaDeprecAcumulada || categoria?.cuentaDepreciacion || '1.2.01.99';

        // Gasto de Depreciación (Debe)
        if (!accountTotals[cuentaGasto]) {
          accountTotals[cuentaGasto] = { 
            debe: 0, 
            haber: 0, 
            descripcion: `Gasto Depreciación ${periodo} - ${categoria?.nombre || activo.categoriaNombre || 'Activos Fijos'}` 
          };
        }
        accountTotals[cuentaGasto].debe += depreciacionMensual;

        // Depreciación Acumulada (Haber)
        if (!accountTotals[cuentaDeprecAcum]) {
          accountTotals[cuentaDeprecAcum] = { 
            debe: 0, 
            haber: 0, 
            descripcion: `Deprec. Acumulada ${periodo} - ${categoria?.nombre || activo.categoriaNombre || 'Activos Fijos'}` 
          };
        }
        accountTotals[cuentaDeprecAcum].haber += depreciacionMensual;

        // Actualizar depreciación acumulada en el activo fijo
        const nuevaDeprecAcum = (Number(activo.depreciacionAcumulada) || 0) + depreciacionMensual;
        onSave('activosFijos', {
          ...activo,
          depreciacionAcumulada: Math.round(nuevaDeprecAcum * 100) / 100
        });
      }
    });

    const comprobanteRef = `DEP-${anio}${mes.padStart(2, '0')}`;
    totalDepreciado = Math.round(totalDepreciado * 100) / 100;

    onSave('depreciaciones', {
      id: timestamp.toString(),
      periodo,
      fechaEjecucion: new Date().toISOString().split('T')[0],
      totalDepreciado,
      comprobante: comprobanteRef,
      estado: 'Procesado',
      detalles
    });

    // Crear Asiento Contable en Comprobantes de Diario
    const lineasAsiento = Object.entries(accountTotals).map(([cuentaId, totales], index) => ({
      id: `l${index + 1}-${timestamp}`,
      cuentaId,
      descripcion: totales.descripcion,
      debe: Math.round(totales.debe * 100) / 100,
      haber: Math.round(totales.haber * 100) / 100
    }));

    if (lineasAsiento.length > 0) {
      onSave('comprobantes', {
        id: `asiento-dep-${timestamp}`,
        numero: comprobanteRef,
        comprobante: comprobanteRef,
        referencia: comprobanteRef,
        fecha: new Date().toISOString().split('T')[0],
        tipo: 'Diario',
        descripcion: `Depreciación Mensual de Activos Fijos - Período ${periodo}`,
        total: totalDepreciado,
        estado: 'Contabilizado',
        lineas: lineasAsiento
      });
    }

    setShowModal(false);
    showToast(`Depreciación del período ${periodo} por $${totalDepreciado.toLocaleString('es-VE', { minimumFractionDigits: 2 })} contabilizada exitosamente`, 'success');
  };

  const filteredDepreciaciones = depreciaciones.filter(dep => 
    dep.periodo.includes(searchTerm) || dep.comprobante.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Depreciaciones</h2>
          <p className="text-slate-500 text-sm">Cálculo y registro de la depreciación de activos fijos</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Play className="w-4 h-4" />
          <span className="text-sm font-medium">Ejecutar Depreciación</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar histórico de depreciaciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors w-full md:w-auto justify-center">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium">Filtros</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Período</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Fecha Ejecución</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-right">Total Depreciado</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-center">Comprobante</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-center">Estado</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDepreciaciones.map((dep) => (
                <tr key={dep.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{dep.periodo}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{dep.fechaEjecucion}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-right">${Number(dep.totalDepreciado).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className="text-indigo-600 hover:underline cursor-pointer font-medium">{dep.comprobante}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                      {dep.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => setSelectedDepreciacion(dep)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer" 
                        title="Ver Detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteDepreciacion(dep)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" 
                        title="Eliminar Depreciación"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDepreciaciones.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No hay registros de depreciación.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ejecutar Depreciación */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">Ejecutar Depreciación</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Este proceso calculará la depreciación de todos los activos fijos activos para el período seleccionado y generará el comprobante contable correspondiente.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mes</label>
                  <select 
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
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
                    <option value="12">Diciembre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Año</label>
                  <input 
                    type="number" 
                    value={anio}
                    onChange={(e) => setAnio(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={handleExecute} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center gap-2">
                <Play className="w-4 h-4" /> Ejecutar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Detalle */}
      {selectedDepreciacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Detalle de Depreciación</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Período: {selectedDepreciacion.periodo} | Comprobante: {selectedDepreciacion.comprobante}
                </p>
              </div>
              <button onClick={() => setSelectedDepreciacion(null)} className="p-2 text-slate-400 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-0 flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Código</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Descripción</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Categoría</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-right">Valor Inicial</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-right">Depreciación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedDepreciacion.detalles?.map((detalle: any, index: number) => (
                    <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-700">{detalle.codigo}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{detalle.descripcion}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{detalle.categoria}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right">${Number(detalle.valorInicial).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 text-right font-medium text-indigo-600">${Number(detalle.depreciacionMensual).toFixed(2)}</td>
                    </tr>
                  ))}
                  {(!selectedDepreciacion.detalles || selectedDepreciacion.detalles.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No hay detalles disponibles para esta depreciación.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="sticky bottom-0 bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-bold text-slate-800 text-right">Total Depreciado:</td>
                    <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-right">${Number(selectedDepreciacion.totalDepreciado).toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button onClick={() => setSelectedDepreciacion(null)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium transition-colors">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
