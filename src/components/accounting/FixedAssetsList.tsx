import React, { useState } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, X } from 'lucide-react';

interface FixedAssetsListProps {
  activosFijos: any[];
  categoriasActivos: any[];
  proveedores: any[];
  cuentasContables: any[];
  configContable: any;
  onSave: (collection: string, data: any) => void;
  showToast: (msg: string, type: string) => void;
}

export default function FixedAssetsList({ activosFijos, categoriasActivos, proveedores, cuentasContables, configContable, onSave, showToast }: FixedAssetsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    id: '',
    codigo: '',
    categoriaId: '',
    descripcion: '',
    fechaAdquisicion: '',
    valorInicial: '',
    proveedorId: '',
    numeroFactura: ''
  });

  const handleEdit = (activo: any) => {
    setFormData({
      id: activo.id || '',
      codigo: activo.codigo || '',
      categoriaId: activo.categoriaId || '',
      descripcion: activo.descripcion || '',
      fechaAdquisicion: activo.fechaAdquisicion || '',
      valorInicial: activo.valorInicial ?? '',
      proveedorId: activo.proveedorId || '',
      numeroFactura: activo.numeroFactura || ''
    });
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    onSave('activosFijos', { id, _delete: true });
    setDeleteConfirm(null);
    showToast('Activo eliminado exitosamente', 'success');
  };

  const handleSave = () => {
    if (!formData.codigo || !formData.categoriaId || !formData.descripcion || !formData.fechaAdquisicion || !formData.valorInicial) {
      showToast('Por favor complete todos los campos obligatorios', 'error');
      return;
    }

    if (!formData.id) {
      if ((formData.proveedorId && !formData.numeroFactura) || (!formData.proveedorId && formData.numeroFactura)) {
        showToast('Para generar la cuenta por pagar, debe indicar tanto el proveedor como el número de factura', 'error');
        return;
      }
    }
    
    const categoria = categoriasActivos.find(c => c.id === formData.categoriaId);
    
    const dataToSave = {
      ...formData,
      id: formData.id || Date.now().toString(),
      categoriaNombre: categoria?.nombre || '',
      estado: 'Activo' 
    };
    
    onSave('activosFijos', dataToSave);

    // If it's a new asset and has supplier and invoice, create CxP and Asiento
    if (!formData.id && formData.proveedorId && formData.numeroFactura) {
      const proveedor = proveedores.find(p => p.id === formData.proveedorId);
      const valorNum = Number(formData.valorInicial);
      const timestamp = Date.now();
      
      // Create CxP
      const newCxp = {
        id: timestamp.toString(),
        categoria: 'proveedores',
        proveedor: proveedor?.name || '',
        proveedor_id: proveedor?.taxId || '',
        factura_id: `FAC-${formData.numeroFactura}`,
        fecha: formData.fechaAdquisicion,
        vencimiento: formData.fechaAdquisicion,
        descripcion: `Compra de Activo Fijo: ${formData.descripcion}`,
        tipo: 'factura',
        total: valorNum,
        saldo: valorNum,
        retencionIva: 0,
        retencionIslr: 0,
        baseImponible: valorNum,
        iva: 0
      };
      onSave('cxp', newCxp);

      // Create Asiento Contable
      const cuentaActivo = categoria?.cuentaActivo;
      const cuentaCxp = proveedor?.creditAccount || configContable?.cuentaCxp || '2.1.01.01.001'; // Default to generic CxP if not set

      if (cuentaActivo) {
        const asiento = {
          id: `asiento-${timestamp}`,
          numero: `ACT-${formData.codigo}`,
          comprobante: `ACT-${formData.codigo}`,
          fecha: formData.fechaAdquisicion,
          tipo: 'Diario',
          referencia: formData.numeroFactura ? `FAC-${formData.numeroFactura}` : `ACT-${formData.codigo}`,
          descripcion: `Compra de Activo Fijo: ${formData.descripcion} (Fac: ${formData.numeroFactura})`,
          total: valorNum,
          estado: 'Contabilizado',
          lineas: [
            {
              id: `l1-${timestamp}`,
              cuentaId: cuentaActivo,
              descripcion: `Activo Fijo: ${formData.descripcion}`,
              debe: valorNum,
              haber: 0
            },
            {
              id: `l2-${timestamp}`,
              cuentaId: cuentaCxp,
              descripcion: `Cuentas por Pagar: ${proveedor?.name || ''}`,
              debe: 0,
              haber: valorNum
            }
          ]
        };
        onSave('comprobantes', asiento);
      }
    }
    
    setShowModal(false);
    showToast(formData.id ? 'Activo actualizado exitosamente' : 'Activo guardado exitosamente', 'success');
    setFormData({
      id: '',
      codigo: '',
      categoriaId: '',
      descripcion: '',
      fechaAdquisicion: '',
      valorInicial: '',
      proveedorId: '',
      numeroFactura: ''
    });
  };

  const filteredAssets = activosFijos.filter(activo => 
    activo.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activo.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Activos Fijos</h2>
          <p className="text-slate-500 text-sm">Gestión del inventario de activos fijos de la empresa</p>
        </div>
        <button 
          onClick={() => {
            setFormData({
              id: '',
              codigo: '',
              categoriaId: '',
              descripcion: '',
              fechaAdquisicion: '',
              valorInicial: '',
              proveedorId: '',
              numeroFactura: ''
            });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Nuevo Activo</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar activo por código o nombre..."
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
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Código</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Descripción</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Categoría</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Fecha Adquisición</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-right">Valor Inicial</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-center">Estado</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.map((activo) => (
                <tr key={activo.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-700">{activo.codigo}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{activo.descripcion}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{activo.categoriaNombre}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{activo.fechaAdquisicion}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 text-right">${Number(activo.valorInicial).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                      {activo.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => handleEdit(activo)}
                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors tooltip" 
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm(activo.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors tooltip" 
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No hay activos fijos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Activo */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50">
              <h2 className="text-xl font-bold text-slate-800">
                {formData.id ? 'Editar Activo Fijo' : 'Registrar Nuevo Activo'}
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
                    placeholder="ACT-001" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Categoría *</label>
                  <select 
                    value={formData.categoriaId}
                    onChange={(e) => setFormData({...formData, categoriaId: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">Seleccione una categoría</option>
                    {categoriasActivos.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Descripción *</label>
                  <input 
                    type="text" 
                    value={formData.descripcion}
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="Ej. Laptop Dell XPS 15" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Adquisición *</label>
                  <input 
                    type="date" 
                    value={formData.fechaAdquisicion}
                    onChange={(e) => setFormData({...formData, fechaAdquisicion: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Valor Inicial *</label>
                  <input 
                    type="number" 
                    value={formData.valorInicial}
                    onChange={(e) => setFormData({...formData, valorInicial: e.target.value})}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="0.00" 
                  />
                </div>
                {!formData.id && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor (Opcional)</label>
                      <select 
                        value={formData.proveedorId}
                        onChange={(e) => setFormData({...formData, proveedorId: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="">Seleccione un proveedor</option>
                        {proveedores.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Número de Factura (Opcional)</label>
                      <input 
                        type="text" 
                        value={formData.numeroFactura}
                        onChange={(e) => setFormData({...formData, numeroFactura: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                        placeholder="Ej. 001-001-000000123" 
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors">
                Guardar Activo
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal Confirmar Eliminación */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-rose-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">¿Eliminar Activo Fijo?</h3>
              <p className="text-slate-600 mb-6">
                Esta acción no se puede deshacer. ¿Está seguro que desea eliminar este activo fijo?
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
