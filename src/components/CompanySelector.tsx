import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext';
import { dbSaveEmpresa, dbFetchEmpresas, dbSaveConfiguracionContable } from '../services/db';
import { Building2, Plus, ArrowRight, LogOut, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

export default function CompanySelector({ dbError, onLogout }: { dbError?: string | null, onLogout?: () => void }) {
  const navigate = useNavigate();
  const { currentUser, setActiveCompanyId, availableCompanies, setAvailableCompanies, setWorkingYear, refreshCompanies } = useCompany();
  const [isCreating, setIsCreating] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyTaxId, setNewCompanyTaxId] = useState('');
  const currentYear = new Date().getFullYear();
  const [newCompanyYear, setNewCompanyYear] = useState(String(currentYear));
  const [isLoading, setIsLoading] = useState(true);
  const [copyPlanCuentas, setCopyPlanCuentas] = useState(false);
  const [copyContactos, setCopyContactos] = useState(false);
  const [sourceCompanyId, setSourceCompanyId] = useState('');
  const isMasterSubscriber = currentUser?.role === 'Master';

  const yearOptions = Array.from({ length: 6 }, (_, i) => String(currentYear - 3 + i));

  useEffect(() => {
    loadUserCompanies();
  }, [currentUser?.id]);

  const loadUserCompanies = async () => {
    setIsLoading(true);
    try {
      if (refreshCompanies) {
        await refreshCompanies();
      }
    } catch (e: any) {
      console.error("Error loading companies:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName || !newCompanyTaxId) return;
    
    setIsLoading(true);
    try {
      const newId = `empresa-${Date.now()}`;
      const newCompanyObj = {
        id: newId,
        name: newCompanyName.trim(),
        taxId: newCompanyTaxId.trim(),
        nombre: newCompanyName.trim(),
        rif: newCompanyTaxId.trim(),
        anoInicio: newCompanyYear,
        workingYear: newCompanyYear,
        createdAt: new Date().toISOString(),
        habilitarVendedores: true,
        habilitarPedidos: true,
        monedaPrincipal: "USD",
        monedaSecundaria: "VES",
        tipoContribuyente: "ordinario",
        tipoEmpresa: "comercial"
      };

      await dbSaveEmpresa(newCompanyObj);
      await dbSaveConfiguracionContable({ workingYear: newCompanyYear }, newId);

      if (copyPlanCuentas && sourceCompanyId) {
        const { dbFetchCuentasContables, dbSaveCuentaContable } = await import('../services/db');
        const sourceAccounts = await dbFetchCuentasContables(sourceCompanyId);
        for (const acc of sourceAccounts) {
          await dbSaveCuentaContable({
            ...acc,
            id: `acc_${newId}_${acc.codigo.replace(/\./g, '_')}`,
            saldoActual: 0
          }, newId);
        }
      }

      if (copyContactos && sourceCompanyId) {
        const { dbFetchContactos, dbSaveContacto } = await import('../services/db');
        const sourceContacts = await dbFetchContactos(sourceCompanyId);
        for (const ct of sourceContacts) {
          await dbSaveContacto({
            ...ct,
            id: `ct_${newId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            saldo: 0,
            saldoCxp: 0
          }, newId);
        }
      }
      
      const updated = [...availableCompanies, newCompanyObj];
      setAvailableCompanies(updated);
      setWorkingYear(newCompanyYear);
      setActiveCompanyId(newId);

      // Redirigir directamente al Perfil de Empresa en Configuración
      navigate('/settings');
    } catch (e: any) {
      console.error("Error creating company:", e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-800">
            {availableCompanies.length > 0 && !isCreating ? 'Selecciona una Empresa' : 'Crea tu Empresa'}
          </h2>
          <p className="text-slate-500 text-sm mt-2">
            {availableCompanies.length > 0 && !isCreating 
              ? 'Elige el entorno de trabajo para continuar.' 
              : 'Configura el espacio inicial para tu organización.'}
          </p>
        </div>

        {dbError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {dbError}
          </div>
        )}

        {availableCompanies.length > 0 && !isCreating ? (
          <div className="space-y-4">
            {availableCompanies.map(comp => (
              <button
                key={comp.id}
                onClick={() => setActiveCompanyId(comp.id)}
                className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div>
                  <h3 className="font-bold text-slate-800">{comp.name}</h3>
                  <p className="text-xs text-slate-500">NIT/RIF: {comp.taxId}</p>
                </div>
                <ArrowRight size={18} className="text-slate-400 group-hover:text-indigo-600" />
              </button>
            ))}
            
            {isMasterSubscriber && (
              <button 
                onClick={() => setIsCreating(true)}
                className="w-full py-3 mt-4 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus size={16} /> Crear otra empresa
              </button>
            )}
          </div>
        ) : (
          !isMasterSubscriber ? (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm font-medium">
                No tienes acceso a ninguna empresa asignada actualmente. Por favor, solicita a un Administrador que active tu acceso en la pestaña de Usuarios.
              </div>
              {availableCompanies.length > 0 && (
                <button 
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-800 mt-4 cursor-pointer"
                >
                  Volver a la selección
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateCompany} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nombre de la Empresa</label>
              <input 
                required
                type="text" 
                value={newCompanyName}
                onChange={e => setNewCompanyName(e.target.value)}
                className="input-modern bg-slate-50"
                placeholder="Ej. Acme Corp"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">ID Fiscal (NIT/RIF)</label>
              <input 
                required
                type="text" 
                value={newCompanyTaxId}
                onChange={e => setNewCompanyTaxId(e.target.value)}
                className="input-modern bg-slate-50"
                placeholder="Ej. J-123456789"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar size={15} className="text-indigo-600" />
                Año / Ejercicio Fiscal de Inicio
              </label>
              <select
                value={newCompanyYear}
                onChange={e => setNewCompanyYear(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500 transition-all cursor-pointer"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>
                    Ejercicio Contable - Año {y} {y === String(currentYear) ? '(Año en Curso)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Define el año con el que iniciarán los registros contables y comprobantes de tu empresa.
              </p>
            </div>

            {availableCompanies.length > 0 && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Duplicar Configuración (Opcional)
                </p>
                
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input 
                    type="checkbox"
                    checked={copyPlanCuentas}
                    onChange={(e) => {
                      setCopyPlanCuentas(e.target.checked);
                      if (e.target.checked && !sourceCompanyId && availableCompanies.length > 0) {
                        setSourceCompanyId(availableCompanies[0].id);
                      }
                    }}
                    className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                  />
                  <span className="text-slate-700 text-xs font-semibold select-none group-hover:text-slate-900 transition-colors">
                    Copiar Plan de Cuentas de una empresa ya existente
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input 
                    type="checkbox"
                    checked={copyContactos}
                    onChange={(e) => {
                      setCopyContactos(e.target.checked);
                      if (e.target.checked && !sourceCompanyId && availableCompanies.length > 0) {
                        setSourceCompanyId(availableCompanies[0].id);
                      }
                    }}
                    className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                  />
                  <span className="text-slate-700 text-xs font-semibold select-none group-hover:text-slate-900 transition-colors">
                    Copiar Directorio Directorio completo de empresa a seleccionar
                  </span>
                </label>

                {(copyPlanCuentas || copyContactos) && (
                  <div className="pt-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                      Seleccione la Empresa de Origen
                    </label>
                    <select
                      value={sourceCompanyId}
                      onChange={(e) => setSourceCompanyId(e.target.value)}
                      required={copyPlanCuentas || copyContactos}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs text-slate-800"
                    >
                      {availableCompanies.map(comp => (
                        <option key={comp.id} value={comp.id}>
                          {comp.name} ({comp.taxId})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            
            <button
              type="submit"
              disabled={!newCompanyName || !newCompanyTaxId}
              className="w-full btn-primary py-3 flex justify-center mt-2 disabled:opacity-50"
            >
              Crear Empresa y Continuar
            </button>
            
            {availableCompanies.length > 0 && (
              <button 
                type="button"
                onClick={() => setIsCreating(false)}
                className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-800 mt-4"
              >
                Volver a la selección
              </button>
            )}
            </form>
          )
        )}
      </motion.div>
      
      {onLogout && (
        <button 
          onClick={onLogout}
          className="mt-6 flex items-center justify-center space-x-2 text-slate-500 hover:text-slate-700 transition-colors text-sm font-medium"
        >
          <LogOut size={16} />
          <span>Cerrar sesión</span>
        </button>
      )}
    </div>
  );
}
