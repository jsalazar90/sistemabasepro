import React, { useState } from 'react';
import { ShieldAlert, KeyRound, Lock, Eye, EyeOff, X, Check, AlertCircle } from 'lucide-react';
import { dbVerifyMasterClaveOperaciones } from '../../services/db';

interface MasterAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  actionName?: string;
  actionDetails?: string;
  onSuccess: () => void | Promise<void>;
}

export default function MasterAuthModal({
  isOpen,
  onClose,
  title = 'Autorización de Administrador Master',
  subtitle = 'Clave Especial de Operaciones Requerida',
  actionName = 'Eliminación / Anulación Crítica',
  actionDetails,
  onSuccess
}: MasterAuthModalProps) {
  const [clave, setClave] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clave.trim()) {
      setErrorMsg('Por favor ingrese la clave especial de operaciones.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      const result = await dbVerifyMasterClaveOperaciones(clave);
      if (result.success) {
        setClave('');
        setErrorMsg('');
        onClose();
        await onSuccess();
      } else {
        setErrorMsg('Clave especial de operaciones incorrecta. Acción denegada.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al verificar la clave de operaciones.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-rose-100 flex flex-col">
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-rose-50 via-white to-slate-50 border-b border-rose-100 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/20 shrink-0">
              <ShieldAlert size={26} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">{title}</h3>
              <p className="text-xs font-bold text-rose-600 flex items-center gap-1 mt-0.5">
                <Lock size={12} /> {subtitle}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Action details box */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
            <div className="flex items-center justify-between text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <span>Operación Solicitada:</span>
              <span className="text-rose-600 font-extrabold">{actionName}</span>
            </div>
            {actionDetails && (
              <p className="text-slate-800 font-bold font-mono text-[11px] pt-1 border-t border-slate-200/60 truncate" title={actionDetails}>
                {actionDetails}
              </p>
            )}
          </div>

          <div className="text-xs text-slate-600 leading-relaxed">
            Esta acción modificará saldos e impactará registros contables/bancarios. Solo un <strong>Administrador Master</strong> puede autorizarla ingresando su clave de operaciones.
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound size={13} className="text-indigo-600" />
                Clave Especial de Operaciones Master *
              </span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                placeholder="Ingrese clave especial..."
                value={clave}
                onChange={e => {
                  setClave(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-100 outline-none transition-all tracking-wider"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                title={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mt-2 bg-rose-50 border border-rose-200 p-2 rounded-lg animate-in fade-in">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isVerifying}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isVerifying || !clave.trim()}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <span>Verificando...</span>
              ) : (
                <>
                  <Check size={15} />
                  <span>Autorizar Operación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
