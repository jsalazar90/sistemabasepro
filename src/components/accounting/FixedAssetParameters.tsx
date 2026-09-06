import React, { useState } from 'react';
import { Settings, Plus, Edit2, Trash2, X, Search } from 'lucide-react';
import CuentaContableModal from '../common/CuentaContableModal';

interface FixedAssetParametersProps {
  categoriasActivos: any[];
  cuentasContables: any[];
  onSave: (collection: string, data: any) => void;
  showToast: (msg: string, type: string) => void;
}

export default function FixedAssetParameters({ categoriasActivos, cuentasContables, onSave, showToast }: FixedAssetParametersProps) {
  const [showModal, setShowModal] = useState(false);
  const [showAccountSelector, setShowAccountSelector] = useState<{show: boolean, field: string}>({show: false, field: ''});
  const [accountSearch, setAccountSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    id: '',
    codigo: '',
    nombre: '',
    vidaUtil: '',
    metodo: 'Línea Recta',
    cuentaActivo: '',
    cuentaDeprecAcumulada: '',
    cuentaGastoDeprec: ''
  });

  const handleEdit = (cat: any) => {
    setFormData({
      id: cat.id || '',
      codigo: cat.codigo || '',
      nombre: cat.nombre || '',
      vidaUtil: cat.vidaUtil ?? '',
      metodo: cat.metodo || 'Línea Recta',
      cuentaActivo: cat.cuentaActivo || '',
      cuentaDeprecAcumulada: cat.cuentaDeprecAcumulada || '',
      cuentaGastoDeprec: cat.cuentaGastoDeprec || ''
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    onSave('categoriasActivos', { id, _delete: true });
    setDeleteConfirm(null);
    showToast('Categoría eliminada exitosamente', 'success');
  };

  const handleSave = () => {
    if (!formData.codigo || !formData.nombre || !formData.vidaUtil) {
      showToast('Por favor complete los campos obligatorios', 'error');
      return;
    }
    
    const dataToSave = {
      ...formData,
      id: formData.id || Date.now().toString()
    };
    
    onSave('categoriasActivos', dataToSave);
    setShowModal(false);
    showToast(formData.id ? 'Categoría actualizada exitosamente' : 'Categoría guardada exitosamente', 'success');
    setFormData({
      id: '',
      codigo: '',
      nombre: '',
      vidaUtil: '',
      metodo: 'Línea Recta',
      cuentaActivo: '',
      cuentaDeprecAcumulada: '',
      cuentaGastoDeprec: ''
    });
  };

  const openAccountSelector = (field: string) => {
    setShowAccountSelector({ show: true, field });
  };

  const selectAccount = (cuenta: any) => {
    if (showAccountSelector.field && cuenta) {
      setFormData({ ...formData, [showAccountSelector.field]: cuenta.codigo });
    }
    setShowAccountSelector({ show: false, field: '' });
  };

  return (
    <div className="p-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Parámetros de Activo Fijo</h2>
          <p className="text-slate-500 text-sm">Configuración de categorías, métodos y cuentas contables</p>
        </div>
        <button 
          onClick={() => {
            setFormData({
              id: '',
              codigo: '',
              nombre: '',
              vidaUtil: '',
              metodo: 'Línea Recta',
              cuentaActivo: '',
              cuentaDeprecAcumulada: '',
              cuentaGastoDeprec: ''
            });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Nueva Categoría</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Código</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Categoría</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Vida Útil (Meses)</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Método Depreciación</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Cuenta Activo</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Cuenta Deprec. Acumulada</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Cuenta Gasto Deprec.</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categoriasActivos.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-700">{cat.codigo}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{cat.nombre}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{cat.vidaUtil}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{cat.metodo}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{cat.cuentaActivo}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{cat.cuentaDeprecAcumulada}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{cat.cuentaGastoDeprec}</td>
                  <td className="px-4 py-3 text-sm text-center">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => handleEdit(cat)}
                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors tooltip" 
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm(cat.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors tooltip" 
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categoriasActivos.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No hay categorías registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nueva Categoría */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">
                {formData.id ? 'Editar Categoría de Activo' : 'Nueva Categoría de Activo'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Código *</label>
                  <input 
                    type="text" 
                    value={formData.codigo}
                    onChange={(e) => setFormData({...formData, codigo: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="CAT-003" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de Categoría *</label>
                  <input 
                    type="text" 
                    value={formData.nombre}
                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="Ej. Vehículos" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vida Útil (Meses) *</label>
                  <input 
                    type="number" 
                    value={formData.vidaUtil}
                    onChange={(e) => setFormData({...formData, vidaUtil: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="60" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Método de Depreciación</label>
                  <select 
                    value={formData.metodo}
                    onChange={(e) => setFormData({...formData, metodo: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option>Línea Recta</option>
                    <option>Saldos Decrecientes</option>
                    <option>Unidades de Producción</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta de Activo</label>
                  <input 
                    type="text" 
                    value={formData.cuentaActivo}
                    readOnly
                    onClick={() => openAccountSelector('cuentaActivo')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" 
                    placeholder="Seleccione una cuenta..." 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta Deprec. Acumulada</label>
                  <input 
                    type="text" 
                    value={formData.cuentaDeprecAcumulada}
                    readOnly
                    onClick={() => openAccountSelector('cuentaDeprecAcumulada')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" 
                    placeholder="Seleccione una cuenta..." 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cuenta Gasto Deprec.</label>
                  <input 
                    type="text" 
                    value={formData.cuentaGastoDeprec}
                    readOnly
                    onClick={() => openAccountSelector('cuentaGastoDeprec')}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" 
                    placeholder="Seleccione una cuenta..." 
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors">
                Guardar Categoría
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Selector de Cuentas */}
      <CuentaContableModal
        isOpen={showAccountSelector.show}
        onClose={() => setShowAccountSelector({ show: false, field: '' })}
        onSelect={selectAccount}
        cuentasContables={cuentasContables}
        selectedCuentaId={showAccountSelector.field ? (formData as any)[showAccountSelector.field] : ''}
        title="Seleccionar Cuenta Contable"
        subtitle="Catálogo oficial de cuentas NIIF para parámetros de activos fijos"
      />
      {/* Modal Confirmar Eliminación */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-rose-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">¿Eliminar Categoría?</h3>
              <p className="text-slate-600 mb-6">
                Esta acción no se puede deshacer. ¿Está seguro que desea eliminar esta categoría de activo fijo?
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
