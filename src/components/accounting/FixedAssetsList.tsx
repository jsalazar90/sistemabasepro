import React, { useState } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, X, FileText, AlertTriangle } from 'lucide-react';
import VoucherPreviewModal from '../common/VoucherPreviewModal';

interface FixedAssetsListProps {
  activosFijos: any[];
  categoriasActivos: any[];
  proveedores: any[];
  cuentasContables: any[];
  configContable: any;
  comprobantes?: any[];
  cxp?: any[];
  cxc?: any[];
  depreciaciones?: any[];
  onSave: (collection: string, data: any) => void;
  showToast: (msg: string, type: string) => void;
}

export default function FixedAssetsList({ 
  activosFijos, 
  categoriasActivos, 
  proveedores, 
  cuentasContables = [], 
  configContable, 
  comprobantes = [],
  cxp = [],
  cxc = [],
  depreciaciones = [],
  onSave, 
  showToast 
}: FixedAssetsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // States for Voucher Preview Modal
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [pendingVoucher, setPendingVoucher] = useState<any>(null);
  const [pendingAssetData, setPendingAssetData] = useState<any>(null);
  const [isViewingExistingVoucher, setIsViewingExistingVoucher] = useState(false);

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

  const resetForm = () => {
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
    const asset = activosFijos.find(a => String(a.id) === String(id));
    if (asset) {
      // 1. Cascade delete associated comprobantes contables
      const relatedComprobantes = (comprobantes || []).filter(c => {
        if (asset.comprobante_id && String(c.id) === String(asset.comprobante_id)) return true;
        if (c.numero === `ACT-${asset.codigo}` || c.comprobante === `ACT-${asset.codigo}`) return true;
        if (c.referencia === `ACT-${asset.codigo}`) return true;
        if (asset.numeroFactura && (c.referencia === `FAC-${asset.numeroFactura}` || c.numero === `FAC-${asset.numeroFactura}`)) return true;
        if (c.descripcion && c.descripcion.includes(asset.codigo)) return true;
        if (c.numero === `DEP-${asset.codigo}` || (c.descripcion && c.descripcion.includes('Depreciación') && c.descripcion.includes(asset.codigo))) return true;
        return false;
      });
      for (const comp of relatedComprobantes) {
        onSave('comprobantes', { id: comp.id, _delete: true });
      }

      // 2. Cascade delete associated CxP (cuentas por pagar)
      const relatedCxp = (cxp || []).filter(item => {
        if (item.activo_fijo_id && String(item.activo_fijo_id) === String(asset.id)) return true;
        if (asset.comprobante_id && item.comprobante_id === asset.comprobante_id) return true;
        if (asset.numeroFactura && (item.factura_id === `FAC-${asset.numeroFactura}` || item.factura_id === asset.numeroFactura)) return true;
        if (item.factura_id === `ACT-${asset.codigo}`) return true;
        if (item.descripcion && item.descripcion.includes(asset.codigo)) return true;
        return false;
      });
      for (const p of relatedCxp) {
        onSave('cxp', { id: p.id, _delete: true });
      }

      // 3. Cascade delete associated CxC (cuentas por cobrar)
      const relatedCxc = (cxc || []).filter(item => {
        if (item.activo_fijo_id && String(item.activo_fijo_id) === String(asset.id)) return true;
        if (item.factura_id === `ACT-${asset.codigo}`) return true;
        if (asset.numeroFactura && (item.factura_id === `FAC-${asset.numeroFactura}` || item.factura_id === asset.numeroFactura)) return true;
        if (item.descripcion && item.descripcion.includes(asset.codigo)) return true;
        return false;
      });
      for (const c of relatedCxc) {
        onSave('cxc', { id: c.id, _delete: true });
      }

      // 4. Cascade delete associated depreciaciones
      const relatedDeps = (depreciaciones || []).filter(d => {
        return String(d.activoFijoId) === String(asset.id) || String(d.activo_id) === String(asset.id) || String(d.activoId) === String(asset.id);
      });
      for (const dep of relatedDeps) {
        onSave('depreciaciones', { id: dep.id, _delete: true });
      }

      // 5. Delete the Activo Fijo itself
      onSave('activosFijos', { id: asset.id, _delete: true });
    } else {
      onSave('activosFijos', { id, _delete: true });
    }

    setDeleteConfirm(null);
    showToast('Activo fijo y todos sus registros asociados (asiento contable, CxP/CxC y depreciaciones) fueron eliminados exitosamente', 'success');
  };

  const handleSave = () => {
    if (!formData.codigo || !formData.categoriaId || !formData.descripcion || !formData.fechaAdquisicion || !formData.valorInicial) {
      showToast('Por favor complete todos los campos obligatorios', 'error');
      return;
    }

    const categoria = categoriasActivos.find(c => c.id === formData.categoriaId);

    // If editing existing asset
    if (formData.id) {
      const dataToSave = {
        ...formData,
        categoriaNombre: categoria?.nombre || '',
        estado: 'Activo'
      };
      onSave('activosFijos', dataToSave);
      setShowModal(false);
      resetForm();
      showToast('Activo actualizado exitosamente', 'success');
      return;
    }

    // Creating NEW asset -> Generate UUID and construct proposed Asiento Contable
    if ((formData.proveedorId && !formData.numeroFactura) || (!formData.proveedorId && formData.numeroFactura)) {
      showToast('Para generar la cuenta por pagar, debe indicar tanto el proveedor como el número de factura', 'error');
      return;
    }

    const assetId = crypto.randomUUID();
    const proveedor = proveedores.find(p => p.id === formData.proveedorId);
    const valorNum = Number(formData.valorInicial) || 0;
    const timestamp = Date.now();
    const voucherId = crypto.randomUUID();
    const voucherNum = `ACT-${formData.codigo}`;

    // Resolve Account for Asset (DEBE)
    let cuentaActivoObj = cuentasContables.find(
      c => c.id === categoria?.cuentaActivo || c.codigo === categoria?.cuentaActivo
    );
    if (!cuentaActivoObj) {
      // Find leaf account under 1.2 (Propiedad, Planta y Equipo)
      cuentaActivoObj = cuentasContables.find(c => 
        (c.codigo?.startsWith('1.2') || c.nombre?.toLowerCase().includes('activo fijo') || c.nombre?.toLowerCase().includes('equipo')) &&
        !cuentasContables.some(sub => sub.padre_id === c.id || sub.codigo?.startsWith(c.codigo + '.'))
      ) || cuentasContables.find(c => c.codigo?.startsWith('1.2')) || cuentasContables[0];
    }

    // Resolve Account for Credit (HABER)
    const provCreditCode = proveedor?.creditAccount || configContable?.cuentaCxp || '2.1.01.01.001';
    let cuentaCreditoObj = cuentasContables.find(
      c => c.id === provCreditCode || c.codigo === provCreditCode
    );
    if (!cuentaCreditoObj) {
      // Find leaf account under 2.1 (Pasivo corriente / CxP)
      cuentaCreditoObj = cuentasContables.find(c => 
        (c.codigo?.startsWith('2.1.01') || c.nombre?.toLowerCase().includes('proveedor') || c.nombre?.toLowerCase().includes('cuentas por pagar')) &&
        !cuentasContables.some(sub => sub.padre_id === c.id || sub.codigo?.startsWith(c.codigo + '.'))
      ) || cuentasContables.find(c => c.codigo?.startsWith('2.1')) || cuentasContables[1] || cuentasContables[0];
    }

    const proposedVoucher = {
      id: voucherId,
      numero: voucherNum,
      comprobante: voucherNum,
      fecha: formData.fechaAdquisicion || new Date().toISOString().split('T')[0],
      tipo: 'Diario',
      modulo: 'Activos Fijos',
      referencia: formData.numeroFactura ? `FAC-${formData.numeroFactura}` : voucherNum,
      descripcion: `Compra de Activo Fijo: ${formData.descripcion}${formData.numeroFactura ? ` (Fac: ${formData.numeroFactura})` : ''}`,
      total: valorNum,
      estado: 'Contabilizado',
      lineas: [
        {
          id: `l1-${timestamp}`,
          cuentaId: cuentaActivoObj ? cuentaActivoObj.id : (categoria?.cuentaActivo || ''),
          nombreCuenta: cuentaActivoObj ? `${cuentaActivoObj.codigo} - ${cuentaActivoObj.nombre}` : 'Activo Fijo',
          descripcion: `Activo Fijo: ${formData.descripcion}`,
          debe: valorNum,
          haber: 0
        },
        {
          id: `l2-${timestamp}`,
          cuentaId: cuentaCreditoObj ? cuentaCreditoObj.id : provCreditCode,
          nombreCuenta: cuentaCreditoObj ? `${cuentaCreditoObj.codigo} - ${cuentaCreditoObj.nombre}` : 'Cuentas por Pagar Proveedores',
          descripcion: `Cuentas por Pagar: ${proveedor?.name || 'Proveedor'}`,
          debe: 0,
          haber: valorNum
        }
      ]
    };

    const newAssetData = {
      ...formData,
      id: assetId,
      categoriaNombre: categoria?.nombre || '',
      cuentaActivo: cuentaActivoObj?.id || categoria?.cuentaActivo || '',
      cuentaGastoDeprec: categoria?.cuentaGastoDeprec || '',
      comprobante_id: voucherId,
      estado: 'Activo'
    };

    setPendingAssetData(newAssetData);
    setPendingVoucher(proposedVoucher);
    setIsViewingExistingVoucher(false);
    setShowVoucherModal(true);
  };

  const handleConfirmVoucher = async (finalComprobante: any) => {
    if (isViewingExistingVoucher) {
      onSave('comprobantes', finalComprobante);
      setShowVoucherModal(false);
      setPendingVoucher(null);
      setPendingAssetData(null);
      showToast('Asiento contable actualizado exitosamente', 'success');
      return;
    }

    if (!pendingAssetData) return;

    // 1. Guardar Asiento Contable confirmado por el usuario
    const voucherToSave = {
      ...finalComprobante,
      id: finalComprobante.id || crypto.randomUUID()
    };
    onSave('comprobantes', voucherToSave);

    // 2. Guardar Activo Fijo con el ID del comprobante
    const assetToSave = {
      ...pendingAssetData,
      comprobante_id: voucherToSave.id
    };
    onSave('activosFijos', assetToSave);

    // 3. Crear CxP si se indicó proveedor y factura
    if (pendingAssetData.proveedorId && pendingAssetData.numeroFactura) {
      const proveedor = proveedores.find(p => p.id === pendingAssetData.proveedorId);
      const valorNum = Number(pendingAssetData.valorInicial) || 0;
      const newCxp = {
        id: crypto.randomUUID(),
        categoria: 'proveedores',
        proveedor: proveedor?.name || '',
        proveedor_id: proveedor?.taxId || '',
        factura_id: `FAC-${pendingAssetData.numeroFactura}`,
        activo_fijo_id: assetToSave.id,
        comprobante_id: voucherToSave.id,
        fecha: pendingAssetData.fechaAdquisicion,
        vencimiento: pendingAssetData.fechaAdquisicion,
        descripcion: `Compra de Activo Fijo: ${pendingAssetData.descripcion} (${pendingAssetData.codigo})`,
        tipo: 'factura',
        total: valorNum,
        saldo: valorNum,
        retencionIva: 0,
        retencionIslr: 0,
        baseImponible: valorNum,
        iva: 0
      };
      onSave('cxp', newCxp);
    }

    setShowVoucherModal(false);
    setShowModal(false);
    setPendingAssetData(null);
    setPendingVoucher(null);
    resetForm();
    showToast('Activo fijo y asiento contable registrados exitosamente', 'success');
  };

  const handleOpenVoucher = (activo: any) => {
    // Buscar si ya existe un comprobante registrado para este activo
    const existing = (comprobantes || []).find(c => 
      (activo.comprobante_id && String(c.id) === String(activo.comprobante_id)) ||
      c.numero === `ACT-${activo.codigo}` ||
      c.comprobante === `ACT-${activo.codigo}` ||
      c.referencia === `ACT-${activo.codigo}` ||
      (activo.numeroFactura && (c.referencia === `FAC-${activo.numeroFactura}` || c.numero === `FAC-${activo.numeroFactura}`)) ||
      (c.descripcion && c.descripcion.includes(activo.codigo))
    );

    if (existing) {
      setPendingVoucher(existing);
      setIsViewingExistingVoucher(true);
      setPendingAssetData(activo);
      setShowVoucherModal(true);
    } else {
      // Generar borrador para que el usuario pueda crearlo y registrarlo
      const categoria = categoriasActivos.find(c => c.id === activo.categoriaId || c.nombre === activo.categoriaNombre);
      const proveedor = proveedores.find(p => p.id === activo.proveedorId);
      const valorNum = Number(activo.valorInicial) || 0;
      const voucherId = crypto.randomUUID();
      const voucherNum = `ACT-${activo.codigo}`;

      let cuentaActivoObj = cuentasContables.find(
        c => c.id === categoria?.cuentaActivo || c.codigo === categoria?.cuentaActivo
      );
      if (!cuentaActivoObj) {
        cuentaActivoObj = cuentasContables.find(c => 
          (c.codigo?.startsWith('1.2') || c.nombre?.toLowerCase().includes('activo fijo') || c.nombre?.toLowerCase().includes('equipo')) &&
          !cuentasContables.some(sub => sub.padre_id === c.id || sub.codigo?.startsWith(c.codigo + '.'))
        ) || cuentasContables[0];
      }

      const provCreditCode = proveedor?.creditAccount || configContable?.cuentaCxp || '2.1.01.01.001';
      let cuentaCreditoObj = cuentasContables.find(
        c => c.id === provCreditCode || c.codigo === provCreditCode
      );
      if (!cuentaCreditoObj) {
        cuentaCreditoObj = cuentasContables.find(c => 
          (c.codigo?.startsWith('2.1.01') || c.nombre?.toLowerCase().includes('proveedor') || c.nombre?.toLowerCase().includes('cuentas por pagar')) &&
          !cuentasContables.some(sub => sub.padre_id === c.id || sub.codigo?.startsWith(c.codigo + '.'))
        ) || cuentasContables[1] || cuentasContables[0];
      }

      const draftVoucher = {
        id: voucherId,
        numero: voucherNum,
        comprobante: voucherNum,
        fecha: activo.fechaAdquisicion || new Date().toISOString().split('T')[0],
        tipo: 'Diario',
        modulo: 'Activos Fijos',
        referencia: activo.numeroFactura ? `FAC-${activo.numeroFactura}` : voucherNum,
        descripcion: `Compra de Activo Fijo: ${activo.descripcion}${activo.numeroFactura ? ` (Fac: ${activo.numeroFactura})` : ''}`,
        total: valorNum,
        estado: 'Contabilizado',
        lineas: [
          {
            id: `l1-${Date.now()}`,
            cuentaId: cuentaActivoObj ? cuentaActivoObj.id : (categoria?.cuentaActivo || ''),
            nombreCuenta: cuentaActivoObj ? `${cuentaActivoObj.codigo} - ${cuentaActivoObj.nombre}` : 'Activo Fijo',
            descripcion: `Activo Fijo: ${activo.descripcion}`,
            debe: valorNum,
            haber: 0
          },
          {
            id: `l2-${Date.now()}`,
            cuentaId: cuentaCreditoObj ? cuentaCreditoObj.id : provCreditCode,
            nombreCuenta: cuentaCreditoObj ? `${cuentaCreditoObj.codigo} - ${cuentaCreditoObj.nombre}` : 'Cuentas por Pagar Proveedores',
            descripcion: `Cuentas por Pagar: ${proveedor?.name || 'Proveedor'}`,
            debe: 0,
            haber: valorNum
          }
        ]
      };

      setPendingVoucher(draftVoucher);
      setIsViewingExistingVoucher(false);
      setPendingAssetData(activo);
      setShowVoucherModal(true);
    }
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
                    <div className="flex justify-center gap-1.5">
                      <button 
                        onClick={() => handleOpenVoucher(activo)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors tooltip" 
                        title="Ver / Generar Asiento Contable"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEdit(activo)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors tooltip" 
                        title="Editar Activo"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirm(activo.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors tooltip" 
                        title="Eliminar Activo y Registros Vinculados"
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
              <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm">
                {formData.id ? 'Actualizar Activo' : 'Continuar al Asiento Contable'}
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
            setPendingAssetData(null);
          }}
          initialComprobante={pendingVoucher}
          cuentasContables={cuentasContables}
          onConfirm={handleConfirmVoucher}
          showToast={showToast}
          title="Asiento Contable - Adquisición de Activo Fijo"
          subtitle="Verifique o edite las cuentas contables, glosas y cuadre de partida doble antes de registrar el activo."
        />
      )}

      {/* Modal Confirmar Eliminación Cascada */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-rose-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">¿Eliminar Activo Fijo?</h3>
              <p className="text-slate-600 mb-4 text-sm">
                Esta acción es irreversible y eliminará permanentemente el activo fijo y <strong>todos los registros relacionados</strong>:
              </p>
              
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-6 text-left text-xs text-rose-800 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                  <span>Se eliminarán en cascada:</span>
                </div>
                <ul className="list-disc list-inside pl-1 space-y-0.5 text-slate-700">
                  <li>El comprobante y asiento contable registrado</li>
                  <li>Las cuentas por pagar (CxP) o por cobrar (CxC) vinculadas</li>
                  <li>Los registros de depreciación acumulada generados</li>
                </ul>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 font-medium transition-colors shadow-sm"
                >
                  Sí, eliminar todo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
