import React, { useState } from 'react';
import { Lock, Unlock, AlertCircle, Shield, LogOut } from 'lucide-react';
import { useCompany } from '../../context/CompanyContext';
import { dbVerifyMasterClaveOperaciones } from '../../services/db';
import { APP_NAME, APP_VERSION } from '../../config/version';

interface ScreenLockModalProps {
  isOpen: boolean;
  onUnlock: () => void;
  onLogout: () => void;
}

export const ScreenLockModal: React.FC<ScreenLockModalProps> = ({
  isOpen,
  onUnlock,
  onLogout
}) => {
  const { currentUser, login } = useCompany();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Ingrese su contraseña o clave autorizada');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // 1. Verificar con login si es la contraseña del usuario
      if (currentUser?.email) {
        const res = await login(currentUser.email, password);
        if (res.success) {
          setPassword('');
          onUnlock();
          return;
        }
      }

      // 2. O verificar si coincide con la clave de operaciones del usuario o master
      if (currentUser?.role === 'Master') {
        const claveRes = await dbVerifyMasterClaveOperaciones(password.trim());
        if (claveRes.success) {
          setPassword('');
          onUnlock();
          return;
        }
        if (claveRes.error) {
          setError(claveRes.error);
          return;
        }
      }

      setError('Contraseña o clave de operaciones incorrecta');
    } catch (err: any) {
      setError('Error validando credenciales: ' + (err?.message || 'Intente nuevamente'));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-95">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-4 shadow-lg">
            <Lock size={26} />
          </div>

          <h3 className="text-lg font-black text-white tracking-tight">
            Pantalla Bloqueada
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Por seguridad, la sesión se ha suspendido por inactividad.
          </p>

          <div className="my-5 p-3 bg-slate-800/80 border border-slate-700/60 rounded-2xl flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0">
              {(currentUser?.name || currentUser?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white truncate">
                {currentUser?.name || 'Usuario del Sistema'}
              </p>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {currentUser?.email}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl flex items-center gap-2 text-rose-300 text-xs font-medium text-left">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              placeholder="Contraseña o Clave de Operaciones"
              value={password}
              autoFocus
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center font-mono"
            />

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              {isVerifying ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Unlock size={14} />
                  <span>Desbloquear Sesión</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={onLogout}
              className="text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1.5 cursor-pointer font-semibold"
            >
              <LogOut size={13} />
              <span>Cerrar Sesión</span>
            </button>

            <span className="text-[10px] text-slate-500 font-mono">
              {APP_NAME} v{APP_VERSION}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
