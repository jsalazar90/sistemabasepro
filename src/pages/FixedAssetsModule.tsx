import React, { useState } from 'react';
import { ChevronLeft, ArrowLeft, Building2, Calculator, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import BackButton from '../components/common/BackButton';
import FixedAssetsList from '../components/accounting/FixedAssetsList';
import Depreciations from '../components/accounting/Depreciations';
import FixedAssetParameters from '../components/accounting/FixedAssetParameters';

type ViewState = 'menu' | 'activos_fijos' | 'depreciaciones' | 'parametros';

interface FixedAssetsModuleProps {
  activosFijos: any[];
  categoriasActivos: any[];
  depreciaciones: any[];
  cuentasContables: any[];
  proveedores: any[];
  configContable: any;
  onSave: (collection: string, data: any) => void;
  showToast: (msg: string, type: string) => void;
}

export default function FixedAssetsModule({ activosFijos, categoriasActivos, depreciaciones, cuentasContables, proveedores, configContable, onSave, showToast }: FixedAssetsModuleProps) {
  const [view, setView] = useState<ViewState>('menu');

  const renderContent = () => {
    switch (view) {
      case 'activos_fijos':
        return <FixedAssetsList activosFijos={activosFijos} categoriasActivos={categoriasActivos} proveedores={proveedores} cuentasContables={cuentasContables} configContable={configContable} onSave={onSave} showToast={showToast} />;
      case 'depreciaciones':
        return <Depreciations depreciaciones={depreciaciones} activosFijos={activosFijos} categoriasActivos={categoriasActivos} onSave={onSave} showToast={showToast} />;
      case 'parametros':
        return <FixedAssetParameters categoriasActivos={categoriasActivos} cuentasContables={cuentasContables} onSave={onSave} showToast={showToast} />;
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (view) {
      case 'activos_fijos': return 'Activos Fijos';
      case 'depreciaciones': return 'Depreciaciones';
      case 'parametros': return 'Parámetros de Activo Fijo';
      default: return '';
    }
  };

  return (
    <div className="px-3 sm:px-6 pt-1 pb-6 max-w-7xl mx-auto">
      {view === 'menu' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 mb-4">
            <BackButton to="/accounting" label="Volver a Contabilidad" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Módulo de Activos Fijos</h1>
              <p className="text-slate-500 mt-0.5 text-sm sm:text-base">Gestión, depreciación y configuración de activos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-4">
            <button 
              onClick={() => setView('activos_fijos')}
              className="group bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all text-left flex flex-col gap-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
              <div className="p-4 bg-blue-50 text-blue-600 rounded-xl w-fit group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <Building2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Activos Fijos</h3>
                <p className="text-slate-500 leading-relaxed text-sm">
                  Registro y control del inventario de activos fijos de la empresa.
                </p>
              </div>
            </button>

            <button 
              onClick={() => setView('depreciaciones')}
              className="group bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all text-left flex flex-col gap-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl w-fit group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                <Calculator className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Depreciaciones</h3>
                <p className="text-slate-500 leading-relaxed text-sm">
                  Cálculo, ejecución y registro contable de la depreciación.
                </p>
              </div>
            </button>

            <button 
              onClick={() => setView('parametros')}
              className="group bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left flex flex-col gap-6 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100/50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
              <div className="p-4 bg-slate-100 text-slate-600 rounded-xl w-fit group-hover:bg-slate-600 group-hover:text-white transition-colors duration-300">
                <Settings className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Parámetros de Activo Fijo</h3>
                <p className="text-slate-500 leading-relaxed text-sm">
                  Configuración de categorías, métodos y cuentas contables.
                </p>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs sticky top-2 z-10">
            <div className="flex items-center gap-4">
              <BackButton onClick={() => setView('menu')} label="Volver al Menú Activos" />
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-800">{getTitle()}</h2>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px] flex items-start justify-center">
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  );
}
