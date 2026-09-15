import React, { useState } from 'react';
import { Calculator, Search, Filter, Play, X, Eye, Trash2, FileText } from 'lucide-react';
import VoucherPreviewModal from '../common/VoucherPreviewModal';
import { useCompany } from '../../context/CompanyContext';

interface DepreciationsProps {
  depreciaciones: any[];
  activosFijos: any[];
  categoriasActivos: any[];
  cuentasContables?: any[];
  comprobantes?: any[];
  onSave: (collection: string, data: any) => void;
  showToast: (msg: string, type: string) => void;
}

export default function Depreciations({ 
  depreciaciones, 
  activosFijos, 
  categoriasActivos, 
  cuentasContables = [], 
  comprobantes = [],
  onSave, 
  showToast 
}: DepreciationsProps) {
  const { activeCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedDepreciacion, setSelectedDepreciacion] = useState<any | null>(null);
  const [mes, setMes] = useState('1');
  const [anio, setAnio] = useState(new Date().getFullYear().toString());

  // States for Voucher Preview Modal
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [pendingVoucher, setPendingVoucher] = useState<any>(null);
  const [pendingDeprecData, setPendingDeprecData] = useState<any>(null);
  const [isViewingExistingVoucher, setIsViewingExistingVoucher] = useState(false);

  const handleDeleteDepreciacion = (dep: any) => {
    onSave('depreciaciones', { id: dep.id, _delete: true });

    // Anular o eliminar comprobante contable asociado
    const relatedComps = (comprobantes || []).filter(c => 
      (dep.comprobante_id && String(c.id) === String(dep.comprobante_id)) ||
      c.numero === dep.comprobante ||
      c.referencia === dep.comprobante ||
      c.id === `asiento-dep-${dep.id}` ||
      (c.descripcion && c.descripcion.includes('Depreciación') && c.descripcion.includes(dep.periodo))
    );
    for (const comp of relatedComps) {
      onSave('comprobantes', { id: comp.id, _delete: true });
    }

    // Revertir la depreciación acumulada en los activos fijos
    if (dep.detalles && Array.isArray(dep.detalles)) {
      for (const det of dep.detalles) {
        const asset = activosFijos.find(a => String(a.id) === String(det.activoId) || a.codigo === det.codigo);
        if (asset) {
          const reverted = Math.max(0, (Number(asset.depreciacionAcumulada) || 0) - Number(det.depreciacionMensual || 0));
          onSave('activosFijos', {
            ...asset,
            depreciacionAcumulada: Math.round(reverted * 100) / 100
          });
        }
      }
    }

    showToast(`Registro de depreciación ${dep.periodo} y su asiento contable fueron eliminados`, 'success');
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
    const assetUpdates: any[] = [];
    
    // Maps to group debits (Gastos de Depreciación) and credits (Depreciación Acumulada)
    const gastoTotals: Record<string, { cuentaId: string, nombreCuenta: string, descripcion: string, monto: number }> = {};
    const acumTotals: Record<string, { cuentaId: string, nombreCuenta: string, descripcion: string, monto: number }> = {};

    activosFijos.forEach(activo => {
      const categoria = categoriasActivos.find(c => 
        String(c.id) === String(activo.categoriaId) || 
        (c.nombre && (c.nombre.toLowerCase() === (activo.categoriaNombre || activo.categoria || '').toLowerCase())) ||
        (c.codigo && (c.codigo.toLowerCase() === (activo.categoriaId || '').toLowerCase()))
      );

      const catName = (categoria?.nombre || activo.categoriaNombre || activo.categoria || '').trim().toLowerCase();
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

        // 1. CUENTA GASTO DE DEPRECIACIÓN (DEBE)
        const cuentaGastoCodeOrId = categoria?.cuentaGastoDeprec || categoria?.cuentaGasto;
        let cuentaGastoObj = cuentasContables.find(c => 
          c.id === cuentaGastoCodeOrId || c.codigo === cuentaGastoCodeOrId
        );
        if (!cuentaGastoObj && catName) {
          cuentaGastoObj = cuentasContables.find(c => 
            (c.codigo?.startsWith('6.1') || c.codigo?.startsWith('5.1')) && 
            c.nombre?.toLowerCase().includes('deprec') && 
            c.nombre?.toLowerCase().includes(catName)
          );
        }
        if (!cuentaGastoObj) {
          cuentaGastoObj = cuentasContables.find(c => c.codigo === '6.1.01.29') ||
            cuentasContables.find(c => (c.codigo?.startsWith('6.') || c.codigo?.startsWith('5.')) && c.nombre?.toLowerCase().includes('deprec')) ||
            cuentasContables[0];
        }

        // 2. CUENTA DEPRECIACIÓN ACUMULADA (HABER)
        const cuentaAcumCodeOrId = categoria?.cuentaDeprecAcumulada || categoria?.cuentaDepreciacion;
        let cuentaAcumObj = cuentasContables.find(c => 
          c.id === cuentaAcumCodeOrId || c.codigo === cuentaAcumCodeOrId
        );
        if (!cuentaAcumObj && catName) {
          cuentaAcumObj = cuentasContables.find(c => 
            c.codigo?.startsWith('1.2.02') && 
            c.nombre?.toLowerCase().includes(catName)
          );
        }
        if (!cuentaAcumObj) {
          cuentaAcumObj = cuentasContables.find(c => c.codigo === '1.2.02') ||
            cuentasContables.find(c => c.codigo?.startsWith('1.2.02') && !cuentasContables.some(sub => sub.padre_id === c.id)) ||
            cuentasContables.find(c => c.codigo?.startsWith('1.2.02')) ||
            cuentasContables[1] || cuentasContables[0];
        }

        // Agrupar en Débitos (Gasto)
        const gastoKey = cuentaGastoObj?.id || cuentaGastoCodeOrId || 'gasto-default';
        if (!gastoTotals[gastoKey]) {
          gastoTotals[gastoKey] = {
            cuentaId: cuentaGastoObj?.id || cuentaGastoCodeOrId,
            nombreCuenta: cuentaGastoObj ? `${cuentaGastoObj.codigo} - ${cuentaGastoObj.nombre}` : 'Gasto de Depreciación',
            descripcion: `Gasto Depreciación ${periodo} - ${categoria?.nombre || activo.categoriaNombre || 'Activos Fijos'}`,
            monto: 0
          };
        }
        gastoTotals[gastoKey].monto += depreciacionMensual;

        // Agrupar en Créditos (Acumulada)
        const acumKey = cuentaAcumObj?.id || cuentaAcumCodeOrId || 'acum-default';
        if (!acumTotals[acumKey]) {
          acumTotals[acumKey] = {
            cuentaId: cuentaAcumObj?.id || cuentaAcumCodeOrId,
            nombreCuenta: cuentaAcumObj ? `${cuentaAcumObj.codigo} - ${cuentaAcumObj.nombre}` : 'Depreciación Acumulada',
            descripcion: `Deprec. Acumulada ${periodo} - ${categoria?.nombre || activo.categoriaNombre || 'Activos Fijos'}`,
            monto: 0
          };
        }
        acumTotals[acumKey].monto += depreciacionMensual;

        // Preparar actualización de activo fijo
        const nuevaDeprecAcum = (Number(activo.depreciacionAcumulada) || 0) + depreciacionMensual;
        assetUpdates.push({
          ...activo,
          depreciacionAcumulada: Math.round(nuevaDeprecAcum * 100) / 100
        });
      }
    });

    totalDepreciado = Math.round(totalDepreciado * 100) / 100;
    const comprobanteRef = `DEP-${anio}${mes.padStart(2, '0')}`;
    const voucherId = crypto.randomUUID();

    // Construir líneas de partida doble: Débitos primero, luego Créditos
    const lineasAsiento = [
      ...Object.values(gastoTotals).map((g) => ({
        id: crypto.randomUUID(),
        cuentaId: g.cuentaId,
        nombreCuenta: g.nombreCuenta,
        descripcion: g.descripcion,
        debe: Math.round(g.monto * 100) / 100,
        haber: 0
      })),
      ...Object.values(acumTotals).map((a) => ({
        id: crypto.randomUUID(),
        cuentaId: a.cuentaId,
        nombreCuenta: a.nombreCuenta,
        descripcion: a.descripcion,
        debe: 0,
        haber: Math.round(a.monto * 100) / 100
      }))
    ];

    const proposedVoucher = {
      id: voucherId,
      empresa_id: activeCompanyId,
      numero: comprobanteRef,
      comprobante: comprobanteRef,
      referencia: comprobanteRef,
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'Diario',
      modulo: 'Depreciaciones',
      descripcion: `Depreciación Mensual de Activos Fijos - Período ${periodo}`,
      total: totalDepreciado,
      estado: 'Contabilizado',
      lineas: lineasAsiento
    };

    setPendingDeprecData({
      id: crypto.randomUUID(),
      empresa_id: activeCompanyId,
      periodo,
      fechaEjecucion: new Date().toISOString().split('T')[0],
      totalDepreciado,
      comprobante: comprobanteRef,
      estado: 'Procesado',
      detalles,
      assetUpdates
    });

    setPendingVoucher(proposedVoucher);
    setIsViewingExistingVoucher(false);
    setShowModal(false);
    setShowVoucherModal(true);
  };

  const handleConfirmVoucher = async (finalComprobante: any) => {
    if (isViewingExistingVoucher) {
      onSave('comprobantes', { ...finalComprobante, empresa_id: finalComprobante.empresa_id || activeCompanyId });
      setShowVoucherModal(false);
      setPendingVoucher(null);
      setPendingDeprecData(null);
      showToast('Asiento de depreciación actualizado exitosamente', 'success');
      return;
    }

    if (!pendingDeprecData) return;

    // 1. Guardar Comprobante Contable confirmado por el usuario
    const voucherToSave = {
      ...finalComprobante,
      id: finalComprobante.id || crypto.randomUUID(),
      empresa_id: activeCompanyId
    };
    onSave('comprobantes', voucherToSave);

    // 2. Guardar registro de Depreciación
    onSave('depreciaciones', {
      id: pendingDeprecData.id,
      empresa_id: activeCompanyId,
      periodo: pendingDeprecData.periodo,
      fechaEjecucion: pendingDeprecData.fechaEjecucion,
      totalDepreciado: pendingDeprecData.totalDepreciado,
      comprobante: voucherToSave.numero || pendingDeprecData.comprobante,
      comprobante_id: voucherToSave.id,
      estado: 'Procesado',
      detalles: pendingDeprecData.detalles
    });

    // 3. Actualizar la depreciación acumulada de cada activo fijo
    if (pendingDeprecData.assetUpdates && Array.isArray(pendingDeprecData.assetUpdates)) {
      for (const update of pendingDeprecData.assetUpdates) {
        onSave('activosFijos', { ...update, empresa_id: update.empresa_id || activeCompanyId });
      }
    }

    setShowVoucherModal(false);
    setPendingDeprecData(null);
    setPendingVoucher(null);
    showToast(`Depreciación del período ${pendingDeprecData.periodo} por $${pendingDeprecData.totalDepreciado.toLocaleString('es-VE', { minimumFractionDigits: 2 })} y su asiento contable fueron contabilizados exitosamente`, 'success');
  };

  const handleViewVoucher = (dep: any) => {
    // Buscar si ya existe el comprobante en la colección
    const existing = (comprobantes || []).find(c => 
      (dep.comprobante_id && String(c.id) === String(dep.comprobante_id)) ||
      c.numero === dep.comprobante ||
      c.comprobante === dep.comprobante ||
      c.referencia === dep.comprobante ||
      c.id === `asiento-dep-${dep.id}` ||
      (c.descripcion && c.descripcion.includes('Depreciación') && c.descripcion.includes(dep.periodo))
    );

    if (existing) {
      setPendingVoucher(existing);
      setIsViewingExistingVoucher(true);
      setShowVoucherModal(true);
    } else {
      // Reconstruir borrador si no se encuentra el asiento
      const timestamp = Date.now();
      const voucherId = crypto.randomUUID();
      const comprobanteRef = dep.comprobante || `DEP-${dep.periodo.replace('/', '')}`;
      const totalNum = Number(dep.totalDepreciado) || 0;

      const defaultGasto = cuentasContables.find(c => c.codigo === '6.1.01.29') ||
        cuentasContables.find(c => c.codigo?.startsWith('6.') && c.nombre?.toLowerCase().includes('deprec')) ||
        cuentasContables[0];

      const defaultAcum = cuentasContables.find(c => c.codigo === '1.2.02') ||
        cuentasContables.find(c => c.codigo?.startsWith('1.2.02')) ||
        cuentasContables[1] || cuentasContables[0];

      const draftVoucher = {
        id: voucherId,
        numero: comprobanteRef,
        comprobante: comprobanteRef,
        referencia: comprobanteRef,
        fecha: dep.fechaEjecucion || new Date().toISOString().split('T')[0],
        tipo: 'Diario',
        modulo: 'Depreciaciones',
        descripcion: `Depreciación Mensual de Activos Fijos - Período ${dep.periodo}`,
        total: totalNum,
        estado: 'Contabilizado',
        lineas: [
          {
            id: `line-deb-1-${timestamp}`,
            cuentaId: defaultGasto?.id || '',
            nombreCuenta: defaultGasto ? `${defaultGasto.codigo} - ${defaultGasto.nombre}` : 'Gasto de Depreciación',
            descripcion: `Gasto Depreciación ${dep.periodo}`,
            debe: totalNum,
            haber: 0
          },
          {
            id: `line-cred-1-${timestamp}`,
            cuentaId: defaultAcum?.id || '',
            nombreCuenta: defaultAcum ? `${defaultAcum.codigo} - ${defaultAcum.nombre}` : 'Depreciación Acumulada',
            descripcion: `Deprec. Acumulada ${dep.periodo}`,
            debe: 0,
            haber: totalNum
          }
        ]
      };

      setPendingVoucher(draftVoucher);
      setIsViewingExistingVoucher(true);
      setShowVoucherModal(true);
    }
  };

  const filteredDepreciaciones = (depreciaciones || []).filter(dep => {
    if (!dep) return false;
    const periodo = String(dep.periodo || '');
    const comprobante = String(dep.comprobante || '');
    const query = (searchTerm || '').toLowerCase();
    return periodo.toLowerCase().includes(query) || comprobante.toLowerCase().includes(query);
  });

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
                <tr key={dep.id || Math.random()} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{dep.periodo || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{dep.fechaEjecucion || dep.fecha || ''}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-right">${Number(dep.totalDepreciado || dep.monto || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span 
                      onClick={() => handleViewVoucher(dep)} 
                      className="text-indigo-600 hover:underline cursor-pointer font-medium font-mono text-xs"
                      title="Click para ver asiento contable"
                    >
                      {dep.comprobante || (dep.comprobante_id ? `DEP-${String(dep.comprobante_id).slice(-6)}` : 'Ver Asiento')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                      {dep.estado || 'Procesado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <div className="flex justify-center gap-1.5">
                      <button 
                        onClick={() => handleViewVoucher(dep)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer tooltip" 
                        title="Ver Asiento Contable"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setSelectedDepreciacion(dep)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer tooltip" 
                        title="Ver Detalle de Cálculo"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteDepreciacion(dep)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer tooltip" 
                        title="Eliminar Depreciación y Asiento"
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
                  Período: {selectedDepreciacion.periodo || 'N/A'} | Comprobante: {selectedDepreciacion.comprobante || 'N/A'}
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

      {/* Modal Previsualización de Asiento Contable */}
      {showVoucherModal && pendingVoucher && (
        <VoucherPreviewModal
          isOpen={showVoucherModal}
          onClose={() => {
            setShowVoucherModal(false);
            setPendingVoucher(null);
            setPendingDeprecData(null);
          }}
          initialComprobante={pendingVoucher}
          cuentasContables={cuentasContables}
          onConfirm={handleConfirmVoucher}
          showToast={showToast}
          title="Asiento Contable - Depreciación de Activos Fijos"
          subtitle="Gasto de Depreciación (Debe) contra Depreciación Acumulada (Haber) configuradas en las categorías."
        />
      )}
    </div>
  );
}
