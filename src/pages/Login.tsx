import React, { useState } from 'react';
import { 
  Mail, Lock, ArrowRight, ShieldCheck, 
  Eye, EyeOff, AlertCircle, Sparkles, Building2
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';

export default function Login() {
  const { login } = useCompany();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Por favor complete todos los campos de acceso.');
      return;
    }

    setIsLoading(true);

    setTimeout(async () => {
      try {
        const result = await login(email, password);
        if (!result.success) {
          setError(result.error || 'Credenciales inválidas');
          setIsLoading(false);
        }
      } catch (err: any) {
        setError(err?.message || 'Error al procesar el inicio de sesión');
        setIsLoading(false);
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden select-none font-sans">
      {/* Background Ambient Mesh */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" 
      />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-2.5 mb-3 shadow-2xl overflow-hidden group">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain drop-shadow-md"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">
              HALLEY<span className="text-indigo-400 font-extrabold">ERP</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              v2.0
            </span>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Sistema Administrativo, Financiero & Contable NIIF
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-7 sm:p-9 shadow-[0_20px_60px_rgba(0,0,0,0.3)] space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Iniciar Sesión</h2>
              <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                En línea
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Ingresa tus credenciales autorizadas
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 animate-in shake duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-rose-700 leading-relaxed">
                {error}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label-modern text-slate-700">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  placeholder="jhoansg@gmail.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="form-label-modern text-slate-700">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3.5 text-sm shadow-md hover:shadow-lg mt-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Nota de Seguridad */}
          <div className="pt-1 text-center">
            <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              Sesión cifrada con control de acceso por roles (RBAC)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
