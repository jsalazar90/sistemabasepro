import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Filter, MoreVertical, FileText, ArrowLeft, Edit2, Trash2, CheckCircle2, XCircle, AlertCircle, X, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import CuentaContableModal from '../components/common/CuentaContableModal';
import BackButton from '../components/common/BackButton';
import { getTodayLocalDate, toInputDateFormat } from '../utils/dateUtils';

export default function AccountingEntries({ comprobantes = [], cuentasContables = [], onSave, showToast, workingYear }: { comprobantes?: any[], cuentasContables?: any[], onSave?: any, showToast?: any, workingYear?: string }) {
  const { activeCompanyId } = useCompany();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const defaultYear = workingYear || String(new Date().getFullYear());
  const [dateFilters, setDateFilters] = useState({
    tipo: 'mes',
    mes: String(new Date().getMonth() + 1).padStart(2, '0'),
    ano: defaultYear,
    desde: '',
    hasta: ''
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  const [form, setForm] = useState({
    fecha: getTodayLocalDate(),
    numero: '',
    tipo: 'Diario',
    descripcion: '',
    referencia: ''
  });

  const [lines, setLines] = useState<any[]>([
    { id: crypto.randomUUID(), cuentaId: '', descripcion: '', debe: 0, haber: 0 },
    { id: crypto.randomUUID(), cuentaId: '', descripcion: '', debe: 0, haber: 0 }
  ]);

  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [searchCuentaTerm, setSearchCuentaTerm] = useState('');
  const cuentasMovimiento = cuentasContables.filter(c => c.tipo === 'Movimiento').sort((a,b) => (a.codigo||'').localeCompare(b.codigo||''));

  const formatoES = (num: number | string) => {
    const n = Number(num);
    if (isNaN(n) || num === null) return "0,00";
    let str = n.toFixed(2);
    let parts = str.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.join(',');
  };

  const sortedEntries = useMemo(() => {
    const getDayString = (dateStr: string) => {
      if (!dateStr) return '1970-01-01';
      const cleanStr = String(dateStr).trim();
      
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;
      
      if (cleanStr.includes('/')) {
        const parts = cleanStr.split('/');
        if (parts.length === 3) {
          let day = parts[0];
          let month = parts[1];
          let year = parts[2];
          if (day.length === 1) day = '0' + day;
          if (month.length === 1) month = '0' + month;
          if (year.length === 4) {
            return `${year}-${month}-${day}`;
          }
        }
      }

      try {
        const d = new Date(cleanStr);
        if (!isNaN(d.getTime())) {
          return toInputDateFormat(d);
        }
      } catch (e) {}
      return cleanStr;
    };

    let fIni: string | null = null;
    let fFin: string | null = null;
    if (dateFilters.tipo === 'mes') {
      fIni = `${dateFilters.ano}-${dateFilters.mes}-01`;
      fFin = `${dateFilters.ano}-${dateFilters.mes}-${new Date(Number(dateFilters.ano), parseInt(dateFilters.mes), 0).getDate()}`;
    } else if (dateFilters.tipo === 'ano') {
      fIni = `${dateFilters.ano}-01-01`;
      fFin = `${dateFilters.ano}-12-31`;
    } else if (dateFilters.tipo === 'rango') {
      fIni = dateFilters.desde;
      fFin = dateFilters.hasta;
    }

    const list = comprobantes.filter(comp => {
      const matchesSearch = 
        (comp.numero || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
        (comp.descripcion || '').toLowerCase().includes((searchQuery || '').toLowerCase());
      
      const matchesFilter = filterType === 'all' || comp.tipo === filterType;
      
      let inPeriod = true;
      if (dateFilters.tipo !== 'todo') {
        const compDate = getDayString(comp.fecha);
        if (fIni && compDate < fIni) inPeriod = false;
        if (fFin && compDate > fFin) inPeriod = false;
      }
      
      return matchesSearch && matchesFilter && inPeriod;
    });

    const getTimestamp = (comp: any) => {
      const rawCreated = comp.created_at || comp.createdAt;
      if (rawCreated) {
        const ts = new Date(rawCreated).getTime();
        if (!isNaN(ts) && ts > 0) return ts;
      }
      const strId = String(comp.id || '');
      const match = strId.match(/comp-(\d+)/);
      if (match) {
        return parseInt(match[1], 10);
      }
      const timestampMatch = strId.match(/\d{13}/);
      if (timestampMatch) {
         return parseInt(timestampMatch[0], 10);
      }
      const parsedId = Number(comp.id);
      if (!isNaN(parsedId) && parsedId > 1000000000000) {
        return parsedId;
      }
      return 0;
    };

    return list.sort((a, b) => {
      const dayA = getDayString(a.fecha);
      const dayB = getDayString(b.fecha);
      
      // Orden por fecha ascendente (los primeros días van de primero)
      if (dayA !== dayB) {
        return dayA.localeCompare(dayB);
      }

      // Priorizar asientos de Apertura de primero para la misma fecha
      const isAperA = a.referencia === 'APER' || (a.descripcion || '').toLowerCase().includes('apertura');
      const isAperB = b.referencia === 'APER' || (b.descripcion || '').toLowerCase().includes('apertura');
      if (isAperA && !isAperB) return -1;
      if (isAperB && !isAperA) return 1;

      // Asientos de Cierre o Ajustes Automáticos al final para la misma fecha
      const isCierreA = a.tipo === 'Cierre' || (a.referencia || '').includes('CIERRE') || a.referencia === 'AUTO-FX';
      const isCierreB = b.tipo === 'Cierre' || (b.referencia || '').includes('CIERRE') || b.referencia === 'AUTO-FX';
      if (isCierreA && !isCierreB) return 1;
      if (isCierreB && !isCierreA) return -1;

      // Orden por registro / creación ascendente (los primeros registros van de primero)
      const tsA = getTimestamp(a);
      const tsB = getTimestamp(b);
      if (tsA !== tsB && tsA > 0 && tsB > 0) {
        return tsA - tsB;
      }

      return String(a.numero || a.id || '').localeCompare(String(b.numero || b.id || ''));
    });
  }, [comprobantes, searchQuery, filterType, dateFilters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, dateFilters]);

  const totalItems = sortedEntries.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedEntries = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return sortedEntries.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedEntries, safeCurrentPage, itemsPerPage]);

  const totalDebe = lines.reduce((acc, line) => acc + (Number(line.debe) || 0), 0);
  const totalHaber = lines.reduce((acc, line) => acc + (Number(line.haber) || 0), 0);
  const diferencia = Math.abs(totalDebe - totalHaber);
  const isBalanced = diferencia === 0 && totalDebe > 0;
  const invalidLines = lines.some(l => !l.cuentaId || (Number(l.debe) === 0 && Number(l.haber) === 0));
  const isDescuadrado = !isBalanced || invalidLines;

  const handleOpenModal = (comp?: any) => {
    if (comp) {
      setEditingId(comp.id);
      setForm({
        fecha: comp.fecha,
        numero: comp.numero,
        tipo: comp.tipo,
        descripcion: comp.descripcion || comp.concepto || '',
        referencia: comp.referencia || ''
      });
      const rawLines = (comp.lineas && comp.lineas.length > 0) 
        ? comp.lineas 
        : ((comp.asientos && comp.asientos.length > 0) ? comp.asientos.map((a: any) => ({
            id: a.id || crypto.randomUUID(),
            cuentaId: a.cuentaId || a.cuenta_id || a.cuenta_codigo || a.cuentaCodigo,
            descripcion: a.descripcion || comp.descripcion || comp.concepto || '',
            debe: Number(a.debe) || 0,
            haber: Number(a.haber) || 0
          })) : []);
      setLines(rawLines);
    } else {
      setEditingId(null);
      setForm({
        fecha: getTodayLocalDate(),
        numero: `CMP-${Date.now().toString().slice(-6)}`,
        tipo: 'Diario',
        descripcion: '',
        referencia: ''
      });
      setLines([
        { id: crypto.randomUUID(), cuentaId: '', descripcion: '', debe: 0, haber: 0 },
        { id: crypto.randomUUID(), cuentaId: '', descripcion: '', debe: 0, haber: 0 }
      ]);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleConceptoChange = (newDesc: string) => {
    const oldDesc = form.descripcion;
    setForm(prev => ({ ...prev, descripcion: newDesc }));
    setLines(prevLines => prevLines.map(l => {
      if (!l.descripcion || l.descripcion === oldDesc) {
        return { ...l, descripcion: newDesc };
      }
      return l;
    }));
  };

  const handleAddLine = () => {
    setLines([...lines, { id: crypto.randomUUID(), cuentaId: '', descripcion: form.descripcion || '', debe: 0, haber: 0 }]);
  };

  const handleRemoveLine = (id: string) => {
    if (lines.length > 2) {
      setLines(lines.filter(l => l.id !== id));
    } else {
      showToast?.('Debe haber al menos dos líneas en el comprobante', 'error');
    }
  };

  const handleLineChange = (id: string, field: string, value: any) => {
    setLines(lines.map(l => {
      if (l.id === id) {
        const newLine = { ...l, [field]: value };
        // Si se llena el debe, se vacía el haber y viceversa
        if (field === 'debe' && Number(value) > 0) newLine.haber = 0;
        if (field === 'haber' && Number(value) > 0) newLine.debe = 0;
        return newLine;
      }
      return l;
    }));
  };

  const handleDeleteEntry = async (comp: any) => {
    if (!window.confirm(`¿Está seguro de que desea ELIMINAR permanentemente el comprobante contable ${comp.numero}?`)) {
      return;
    }
    try {
      if (onSave) {
        await onSave('comprobantes', { id: comp.id, _delete: true });
        showToast?.('Comprobante eliminado permanentemente.', 'success');
      }
    } catch (e) {
      showToast?.('Error al eliminar el comprobante contable.', 'error');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (workingYear && form.fecha) {
      const year = form.fecha.substring(0, 4);
      if (year !== workingYear) {
        showToast?.(`No se puede registrar este comprobante porque el año de la fecha (${year}) no coincide con el período contable seleccionado (${workingYear}).`, 'error');
        return;
      }
    }

    if (!form.fecha || !form.numero || !form.descripcion) {
      showToast?.('Por favor completa los campos requeridos', 'error');
      return;
    }

    const finalLines = lines.map(l => ({
      ...l,
      descripcion: (l.descripcion && l.descripcion.trim()) ? l.descripcion.trim() : form.descripcion.trim()
    }));

    const newEntry = {
      id: editingId || crypto.randomUUID(),
      empresa_id: activeCompanyId,
      ...form,
      total: totalDebe,
      estado: isDescuadrado ? 'Descuadrado' : 'Contabilizado',
      lineas: finalLines
    };

    onSave?.('comprobantes', newEntry);
    showToast?.(`Comprobante ${editingId ? 'actualizado' : 'creado'} exitosamente${isDescuadrado ? ' (Guardado como Descuadrado)' : ''}`, 'success');
    handleCloseModal();
  };

  const formatSafeDate = (d?: string) => {
    if (!d) return '';
    const parts = d.includes('T') ? d.split('T')[0].split('-') : d.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
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
            <h1 className="text-2xl font-bold text-slate-800">Comprobantes Contables</h1>
            <p className="text-sm text-slate-500 mt-1">Gestiona los asientos de diario, ingresos y egresos</p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Nuevo Comprobante
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto w-full md:w-auto">
            <button 
              onClick={() => setFilterType('all')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors flex-1 md:flex-none whitespace-nowrap ${filterType === 'all' ? 'bg-white text-slate-800 shadow-xs border border-slate-200/55' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setFilterType('Diario')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors flex-1 md:flex-none whitespace-nowrap ${filterType === 'Diario' ? 'bg-white text-slate-800 shadow-xs border border-slate-200/55' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Diario
            </button>
            <button 
              onClick={() => setFilterType('Ingreso')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors flex-1 md:flex-none whitespace-nowrap ${filterType === 'Ingreso' ? 'bg-white text-slate-800 shadow-xs border border-slate-200/55' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Ingreso
            </button>
            <button 
              onClick={() => setFilterType('Egreso')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors flex-1 md:flex-none whitespace-nowrap ${filterType === 'Egreso' ? 'bg-white text-slate-800 shadow-xs border border-slate-200/55' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Egreso
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar comprobante..." 
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Date / Period Filters */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Período de Fecha</label>
            <select 
              className="h-9 w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/10 cursor-pointer" 
              value={dateFilters.tipo} 
              onChange={e => setDateFilters({ ...dateFilters, tipo: e.target.value })}
            >
              <option value="todo">Historial Completo</option>
              <option value="mes">Mes Específico</option>
              <option value="ano">Año Completo</option>
              <option value="rango">Rango de Fechas</option>
            </select>
          </div>

          {dateFilters.tipo === 'mes' && (
            <>
              <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-200">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Mes</label>
                <select 
                  className="h-9 w-[130px] rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/10 cursor-pointer" 
                  value={dateFilters.mes} 
                  onChange={e => setDateFilters({ ...dateFilters, mes: e.target.value })}
                >
                  {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => (
                    <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-200">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Año</label>
                <select 
                  className="h-9 w-[110px] rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/10 cursor-pointer" 
                  value={dateFilters.ano} 
                  onChange={e => setDateFilters({ ...dateFilters, ano: e.target.value })}
                >
                  {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {dateFilters.tipo === 'ano' && (
            <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-200">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Año</label>
              <select 
                className="h-9 w-[110px] rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/10 cursor-pointer" 
                value={dateFilters.ano} 
                onChange={e => setDateFilters({ ...dateFilters, ano: e.target.value })}
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          {dateFilters.tipo === 'rango' && (
            <>
              <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-200">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Fecha Desde</label>
                <input 
                  type="date" 
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/10 cursor-pointer" 
                  value={dateFilters.desde} 
                  onChange={e => setDateFilters({ ...dateFilters, desde: e.target.value })}
                />
              </div>

              <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-200">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Fecha Hasta</label>
                <input 
                  type="date" 
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/10 cursor-pointer" 
                  value={dateFilters.hasta} 
                  onChange={e => setDateFilters({ ...dateFilters, hasta: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Entries List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider select-none">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedEntries.map((comp) => (
                <tr key={comp.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-4 py-2.5 text-slate-600 text-xs font-medium">
                    {formatSafeDate(comp.fecha)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="font-bold text-slate-800 text-xs">{comp.numero}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                      comp.tipo === 'Ingreso' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                      comp.tipo === 'Egreso' ? 'bg-rose-50 text-rose-800 border border-rose-200' :
                      'bg-indigo-50 text-indigo-800 border border-indigo-200'
                    }`}>
                      {comp.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs max-w-xs truncate font-medium">
                    {comp.descripcion}
                  </td>
                  <td className="px-4 py-2.5 text-right font-black text-slate-800 text-xs sm:text-sm font-mono">
                    ${formatoES(Number(comp.total) || (Array.isArray(comp.lineas) ? comp.lineas.reduce((acc: number, l: any) => acc + (Number(l.debe) || 0), 0) : 0))}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${comp.estado === 'Descuadrado' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {comp.estado === 'Descuadrado' ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
                      {comp.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(comp)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Ver / Editar"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button 
                        onClick={() => handleDeleteEntry(comp)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar Comprobante"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedEntries.length === 0 && (
                <tr>
                   <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-lg font-medium text-slate-900 mb-1">No se encontraron comprobantes</p>
                    <p>Crea un nuevo comprobante o ajusta los filtros de búsqueda.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {sortedEntries.length > 0 && (
          <div className="bg-white border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-semibold text-slate-500">
            <div>
              Mostrando <span className="font-bold text-slate-800">{Math.min(totalItems, (safeCurrentPage - 1) * itemsPerPage + 1)}</span> a{' '}
              <span className="font-bold text-slate-800">{Math.min(totalItems, safeCurrentPage * itemsPerPage)}</span> de{' '}
              <span className="font-bold text-slate-800">{totalItems}</span> comprobantes
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={safeCurrentPage === 1}
                className={`px-3 py-1.5 rounded-lg border border-slate-200 transition-all duration-200 cursor-pointer ${
                  safeCurrentPage === 1 
                    ? 'bg-slate-50 text-slate-300 cursor-not-allowed opacity-60' 
                    : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
                }`}
              >
                Anterior
              </button>
              
              {(() => {
                const pages: number[] = [];
                const windowSize = 2;
                for (let i = 1; i <= totalPages; i++) {
                  if (
                    i === 1 || 
                    i === totalPages || 
                    (i >= safeCurrentPage - windowSize && i <= safeCurrentPage + windowSize)
                  ) {
                    pages.push(i);
                  } else if (pages[pages.length - 1] !== -1) {
                    pages.push(-1); // ellipsis
                  }
                }
                
                return pages.map((page, index) => {
                  if (page === -1) {
                    return (
                      <span key={`ellipsis-${index}`} className="px-2 text-slate-400 select-none">
                        ...
                      </span>
                    );
                  }
                  
                  return (
                    <button
                      key={`page-${page}`}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 cursor-pointer ${
                        safeCurrentPage === page 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                          : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200 hover:text-slate-800'
                      }`}
                    >
                      {page}
                    </button>
                  );
                });
              })()}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={safeCurrentPage === totalPages}
                className={`px-3 py-1.5 rounded-lg border border-slate-200 transition-all duration-200 cursor-pointer ${
                  safeCurrentPage === totalPages 
                    ? 'bg-slate-50 text-slate-300 cursor-not-allowed opacity-60' 
                    : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
                }`}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nuevo/Editar Comprobante */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <h2 className="text-lg font-bold text-slate-800">
                {editingId ? 'Editar Comprobante' : 'Nuevo Comprobante'}
              </h2>
              <button 
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form id="entry-form" onSubmit={handleSubmit} className="space-y-6">
                {/* Header Fields */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Fecha *
                    </label>
                    <input 
                      type="date" 
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      value={form.fecha}
                      onChange={e => setForm({...form, fecha: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Número *
                    </label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      value={form.numero}
                      onChange={e => setForm({...form, numero: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Tipo
                    </label>
                    <select 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      value={form.tipo}
                      onChange={e => setForm({...form, tipo: e.target.value})}
                    >
                      <option value="Diario">Diario</option>
                      <option value="Ingreso">Ingreso</option>
                      <option value="Egreso">Egreso</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Referencia
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="Ej. CHQ-1234"
                      value={form.referencia}
                      onChange={e => setForm({...form, referencia: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Concepto / Descripción *
                    </label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      placeholder="Concepto general del comprobante..."
                      value={form.descripcion}
                      onChange={e => handleConceptoChange(e.target.value)}
                    />
                  </div>
                </div>

                {/* Lines */}
                <div className="mt-8">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Detalle del Asiento</h3>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100/50 border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium w-1/3">Cuenta Contable</th>
                          <th className="px-4 py-3 font-medium w-1/3">
                            <div className="flex items-center justify-between">
                              <span>Descripción (Opcional)</span>
                              {form.descripcion?.trim() && (
                                <button
                                  type="button"
                                  onClick={() => setLines(prev => prev.map(l => ({ ...l, descripcion: form.descripcion.trim() })))}
                                  className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors"
                                  title="Copiar el concepto / descripción general a todas las líneas"
                                >
                                  Igual al concepto
                                </button>
                              )}
                            </div>
                          </th>
                          <th className="px-4 py-3 font-medium text-right w-32">Debe</th>
                          <th className="px-4 py-3 font-medium text-right w-32">Haber</th>
                          <th className="px-4 py-3 w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {lines.map((line, index) => (
                          <tr key={line.id} className="bg-white">
                            <td className="px-4 py-2 relative">
                              <div 
                                onClick={() => setActiveLineId(line.id)}
                                className="w-full px-2 py-1.5 border border-transparent hover:border-slate-200 rounded cursor-pointer flex justify-between items-center group transition-all"
                              >
                                {(line.cuentaId || line.cuenta_id || line.cuentaCodigo) ? (() => {
                                  const c = cuentasContables.find(x => 
                                    x.id === line.cuentaId || 
                                    x.codigo === line.cuentaId || 
                                    (line.cuenta_id && (x.id === line.cuenta_id || x.codigo === line.cuenta_id)) ||
                                    (line.cuentaCodigo && (x.codigo === line.cuentaCodigo || x.id === line.cuentaCodigo))
                                  );
                                  return c ? (
                                    <div className="flex flex-col">
                                      <span className="text-[10px] font-mono font-bold text-indigo-600 leading-none mb-0.5">{c.codigo}</span>
                                      <span className="text-sm text-slate-800 leading-tight truncate">{c.nombre}</span>
                                    </div>
                                  ) : <span className="text-sm text-slate-400">Seleccionar cuenta...</span>;
                                })() : (
                                  <span className="text-sm text-slate-400">Seleccionar cuenta...</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="text" 
                                className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                placeholder={form.descripcion || "Descripción de la línea..."}
                                value={line.descripcion}
                                onChange={e => handleLineChange(line.id, 'descripcion', e.target.value)}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="number" 
                                min="0" step="0.01"
                                className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                placeholder="0.00"
                                value={line.debe || ''}
                                onChange={e => handleLineChange(line.id, 'debe', e.target.value)}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="number" 
                                min="0" step="0.01"
                                className="w-full px-2 py-1.5 bg-transparent border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                placeholder="0.00"
                                value={line.haber || ''}
                                onChange={e => handleLineChange(line.id, 'haber', e.target.value)}
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button 
                                type="button"
                                onClick={() => handleRemoveLine(line.id)}
                                className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="p-3 border-t border-slate-200 bg-white">
                      <button 
                        type="button"
                        onClick={handleAddLine}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <Plus size={16} />
                        Agregar Línea
                      </button>
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end mt-6">
                  <div className="w-full max-w-md bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex justify-between items-center mb-2 text-sm">
                      <span className="text-slate-500 font-medium">Total Debe:</span>
                      <span className="font-mono font-medium text-slate-800">${formatoES(totalDebe)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-3 text-sm">
                      <span className="text-slate-500 font-medium">Total Haber:</span>
                      <span className="font-mono font-medium text-slate-800">${formatoES(totalHaber)}</span>
                    </div>
                    <div className={`flex justify-between items-center pt-3 border-t ${isBalanced ? 'border-emerald-200' : 'border-rose-200'}`}>
                      <span className={`font-bold ${isBalanced ? 'text-emerald-700' : 'text-rose-600'}`}>Diferencia:</span>
                      <span className={`font-mono font-bold ${isBalanced ? 'text-emerald-700' : 'text-rose-600'}`}>
                        ${formatoES(diferencia)}
                      </span>
                    </div>
                    {isDescuadrado && (
                      <div className="mt-3 flex items-start gap-2 text-xs text-rose-600 bg-rose-50 p-2 rounded-lg">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <p>
                          {!isBalanced && "El comprobante está descuadrado. "}
                          {invalidLines && "Faltan cuentas contables por seleccionar o hay líneas en cero. "}
                          Se guardará en estado "Descuadrado".
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 shrink-0">
              <button 
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                form="entry-form"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
              >
                {editingId ? 'Guardar Cambios' : 'Contabilizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para seleccionar cuenta contable */}
      <CuentaContableModal
        isOpen={!!activeLineId}
        onClose={() => setActiveLineId(null)}
        onSelect={(cuenta) => {
          if (activeLineId) {
            handleLineChange(activeLineId, 'cuentaId', cuenta.id);
          }
          setActiveLineId(null);
        }}
        cuentasContables={cuentasContables}
        selectedCuentaId={activeLineId ? lines.find(l => l.id === activeLineId)?.cuentaId : ''}
      />
    </div>
  );
}
