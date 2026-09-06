import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Printer, ZoomIn, ZoomOut, FileText, 
  Layers, ChevronLeft, ChevronRight, Sparkles, 
  Sliders, Maximize2, Minimize2, Check, Download, 
  Eye, RefreshCw, Scale, ShieldCheck, Clock
} from 'lucide-react';
import { useCompany } from '../context/CompanyContext';

export interface PrintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  defaultOrientation?: 'portrait' | 'landscape';
  defaultPaperSize?: 'letter' | 'a4' | 'legal';
  defaultShowHeader?: boolean;
  defaultShowFooter?: boolean;
  defaultCompactSpacing?: boolean;
  defaultAutoFitOnePage?: boolean;
  hideDocumentTitle?: boolean;
  empresaData?: any;
  children: React.ReactNode;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
  isOpen,
  onClose,
  title,
  defaultOrientation = 'portrait',
  defaultPaperSize = 'letter',
  defaultShowHeader = true,
  defaultShowFooter = true,
  defaultCompactSpacing = false,
  defaultAutoFitOnePage = false,
  hideDocumentTitle = false,
  empresaData,
  children,
}) => {
  let companyCtx: any = {};
  try {
    companyCtx = useCompany() || {};
  } catch {
    companyCtx = {};
  }
  const availableCompanies = companyCtx.availableCompanies || [];
  const activeCompanyId = companyCtx.activeCompanyId || '';

  // Estados de configuración de papel y salida
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(defaultOrientation);
  const [paperSize, setPaperSize] = useState<'letter' | 'a4' | 'legal'>(defaultPaperSize);
  const [grayscale, setGrayscale] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(100);
  const [textSize, setTextSize] = useState<'xs' | 'sm' | 'base' | 'lg'>('sm');
  const [marginSize, setMarginSize] = useState<'compact' | 'normal' | 'wide'>('normal');
  const [showWatermark, setShowWatermark] = useState<boolean>(false);
  const [showOuterHeader, setShowOuterHeader] = useState<boolean>(defaultShowHeader);
  const [showOuterFooter, setShowOuterFooter] = useState<boolean>(defaultShowFooter);
  const [compactSpacing, setCompactSpacing] = useState<boolean>(defaultCompactSpacing);
  const [autoFitOnePage, setAutoFitOnePage] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'sheets' | 'continuous'>('sheets');
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(1);
  const [pageCount, setPageCount] = useState<number>(1);

  const printContainerRef = useRef<HTMLDivElement>(null);
  const contentMeasureRef = useRef<HTMLDivElement>(null);

  // Obtener datos de la empresa activa
  const activeCompany = useMemo(() => {
    if (empresaData) return empresaData;
    return availableCompanies?.find(c => c.id === activeCompanyId) || {
      nombre: 'Halley Insights C.A.',
      rif: 'J-12345678-9',
      direccion: 'Av. Principal, Centro Financiero, Caracas, Venezuela',
      telefono: '+58 212 555 0000',
      email: 'administracion@halleyinsights.com',
      logo: ''
    };
  }, [empresaData, availableCompanies, activeCompanyId]);

  // Dimensiones físicas del papel en milímetros y píxeles proporcionales a 96 DPI
  const paperDimensions = useMemo(() => {
    let widthMm = 215.9; // Letter
    let heightMm = 279.4;

    if (paperSize === 'a4') {
      widthMm = 210.0;
      heightMm = 297.0;
    } else if (paperSize === 'legal') {
      widthMm = 215.9;
      heightMm = 355.6;
    }

    if (orientation === 'landscape') {
      const temp = widthMm;
      widthMm = heightMm;
      heightMm = temp;
    }

    // Conversión a pixeles visuales base (96 DPI: 1 mm ~ 3.7795 px)
    const widthPx = Math.round(widthMm * 3.7795);
    const heightPx = Math.round(heightMm * 3.7795);

    return { widthMm, heightMm, widthPx, heightPx };
  }, [paperSize, orientation]);

  // Margen en milímetros y padding en clases
  const marginConfig = useMemo(() => {
    switch (marginSize) {
      case 'compact': return { mm: 10, padClass: 'p-5 sm:p-6' };
      case 'wide': return { mm: 20, padClass: 'p-10 sm:p-12' };
      case 'normal':
      default: return { mm: 15, padClass: 'p-7 sm:p-8' };
    }
  }, [marginSize]);

  // Cálculo dinámico de cantidad de hojas
  useEffect(() => {
    if (!isOpen) return;

    const calculatePages = () => {
      if (!contentMeasureRef.current) return;
      const contentHeight = contentMeasureRef.current.scrollHeight;
      const usablePageHeight = paperDimensions.heightPx - (marginConfig.mm * 2 * 3.7795) - 60; // 60px margen de seguridad
      
      const calculatedPages = Math.max(1, Math.ceil(contentHeight / usablePageHeight));
      setPageCount(calculatedPages);
    };

    const timer = setTimeout(calculatePages, 200);
    return () => clearTimeout(timer);
  }, [isOpen, paperDimensions, marginConfig, textSize, compactSpacing, autoFitOnePage, children]);

  // Reset y sincronización al abrir modal
  useEffect(() => {
    if (isOpen) {
      setOrientation(defaultOrientation);
      setPaperSize(defaultPaperSize);
      setShowOuterHeader(defaultShowHeader);
      setShowOuterFooter(defaultShowFooter);
      setCompactSpacing(defaultCompactSpacing || defaultAutoFitOnePage);
      setAutoFitOnePage(defaultAutoFitOnePage || defaultCompactSpacing);
      setActiveSheetIndex(1);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, defaultOrientation, defaultPaperSize, defaultShowHeader, defaultShowFooter, defaultCompactSpacing, defaultAutoFitOnePage]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  // Clases dinámicas de tamaño de texto
  const getTextSizeClass = () => {
    if (autoFitOnePage) return 'text-[11px] leading-tight';
    switch (textSize) {
      case 'xs': return 'text-[11px] leading-tight';
      case 'sm': return 'text-xs leading-normal';
      case 'base': return 'text-sm leading-relaxed';
      case 'lg': return 'text-base leading-relaxed';
    }
  };

  // Renderizado del Membrete Corporativo Oficial
  const renderCorporateHeader = () => (
    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6 select-none">
      <div className="flex items-start gap-4">
        {activeCompany.logo ? (
          <img 
            src={activeCompany.logo} 
            alt="Logo" 
            className="w-16 h-16 object-contain shrink-0" 
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-base shrink-0">
            {activeCompany.nombre?.substring(0, 2).toUpperCase() || 'ERP'}
          </div>
        )}
        <div>
          <h1 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            {activeCompany.nombre}
          </h1>
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight mt-0.5">
            R.I.F: {activeCompany.rif} • {activeCompany.tipoContribuyente?.toUpperCase() || 'CONTRIBUYENTE ORDINARIO'}
          </p>
          <p className="text-[9px] text-slate-500 font-medium max-w-md mt-0.5 leading-snug">
            {activeCompany.direccion}
          </p>
          {activeCompany.telefono && (
            <p className="text-[9px] text-slate-400 font-medium mt-0.5">
              Tel: {activeCompany.telefono} • {activeCompany.email}
            </p>
          )}
        </div>
      </div>

      <div className="text-right">
        <span className="inline-block px-2.5 py-0.5 font-black uppercase tracking-widest text-[9px] bg-slate-100 text-slate-800 border border-slate-300 rounded">
          Documento Oficial
        </span>
        <div className="mt-2 space-y-0.5 font-mono text-[9px] text-slate-500 font-bold">
          <p>EMISIÓN: {new Date().toLocaleDateString('es-VE', { year: 'numeric', month: '2-digit', day: '2-digit' })}</p>
          <p>HORA: {new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</p>
          <p className="text-indigo-600 font-extrabold">HOJA: {activeSheetIndex} DE {pageCount}</p>
        </div>
      </div>
    </div>
  );

  // Renderizado del Pie de Página Oficial
  const renderCorporateFooter = () => (
    <div className="mt-8 pt-4 border-t border-slate-300 select-none">
      <div className="grid grid-cols-3 text-[9px] text-slate-500 font-bold uppercase text-center mb-3">
        <div className="border-t border-dashed border-slate-300 pt-1 mx-2">Preparado por: Contabilidad</div>
        <div className="border-t border-dashed border-slate-300 pt-1 mx-2">Revisado por: Auditoría</div>
        <div className="border-t border-dashed border-slate-300 pt-1 mx-2">Aprobado por: Gerencia</div>
      </div>
      <div className="flex justify-between items-center text-[8px] text-slate-400 font-medium">
        <span>Generado electrónicamente por Sistema Administrativo ERP</span>
        <span className="font-mono">Página {activeSheetIndex} de {pageCount}</span>
        <span className="font-mono">HASH: {Math.random().toString(36).substring(2, 10).toUpperCase()}</span>
      </div>
    </div>
  );

  // Contenido central imprimible con reglas anti-corte
  const printableCore = (
    <div 
      className={`font-sans relative bg-white text-slate-900 flex flex-col ${marginConfig.padClass} print:p-0 ${getTextSizeClass()} ${grayscale ? 'filter grayscale contrast-125' : ''} ${compactSpacing ? 'print-compact-active' : ''}`}
      style={{
        width: `${paperDimensions.widthPx}px`,
        minHeight: `${paperDimensions.heightPx}px`,
        boxSizing: 'border-box'
      }}
    >
      {/* Estilos CSS Inyectados para Cero Cortes Inesperados */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: ${paperSize} ${orientation};
            margin: ${marginConfig.mm}mm !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body, html {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            height: 100% !important;
          }
          #reporte-imprimible-root {
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          /* Reglas Anti-Corte Estrictas */
          tr, td, th, .print-avoid-break, .break-inside-avoid, .card-modern, .odoo-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          h1, h2, h3, h4, h5, h6, .print-header {
            page-break-after: avoid !important;
            break-after: avoid !important;
            break-inside: avoid !important;
          }
          table {
            page-break-inside: auto !important;
            break-inside: auto !important;
            width: 100% !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
        }

        /* Reglas de Alta Densidad / Ajuste a 1 Página sin encoger fuentes */
        ${compactSpacing ? `
          .print-compact-active td, .print-compact-active th {
            padding-top: 0.35rem !important;
            padding-bottom: 0.35rem !important;
          }
          .print-compact-active .space-y-6, .print-compact-active .space-y-8 {
            margin-top: 0.75rem !important;
            margin-bottom: 0.75rem !important;
          }
        ` : ''}
      ` }} />

      {/* Membrete */}
      {showOuterHeader && renderCorporateHeader()}

      {/* Título del Reporte */}
      {title && !hideDocumentTitle && (
        <div className="text-center mb-5 border-b border-dashed border-slate-200 pb-2.5 select-none">
          <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-wide">
            {title}
          </h2>
        </div>
      )}

      {/* Contenido Dinámico del Reporte */}
      <div className="relative z-10 w-full">
        {children}
      </div>

      {/* Watermark Confidencial */}
      {showWatermark && (
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none z-0">
          <span className="text-8xl font-black tracking-widest rotate-45 text-slate-900">
            CONFIDENCIAL
          </span>
        </div>
      )}

      {/* Pie de Página */}
      {showOuterFooter && renderCorporateFooter()}
    </div>
  );

  return (
    <>
      {/* 1. ESTUDIO VISUAL EN PANTALLA (MODAL WYSIWYG) */}
      <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[300] flex flex-col overflow-hidden animate-in fade-in duration-200 no-print">
        {/* Barra Superior de Control */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/95 px-6 flex items-center justify-between shadow-lg shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-sm sm:text-base flex items-center gap-2">
                Estudio de Impresión WYSIWYG
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {pageCount === 1 ? '1 Hoja Calculada' : `${pageCount} Hojas Calculadas`}
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 font-medium truncate max-w-xs sm:max-w-md">
                {title} • {activeCompany.nombre}
              </p>
            </div>
          </div>

          {/* Controles Centrales de Papel & Ajuste */}
          <div className="hidden lg:flex items-center gap-3 px-4 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700/80">
            {/* Formato de Papel */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Papel:</span>
              <select
                value={paperSize}
                onChange={e => setPaperSize(e.target.value as any)}
                className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-slate-200 outline-none cursor-pointer"
              >
                <option value="letter">Carta (Letter)</option>
                <option value="a4">A4 Internacional</option>
                <option value="legal">Oficio (Legal)</option>
              </select>
            </div>

            {/* Orientación */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Orientación:</span>
              <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-700 text-xs">
                <button
                  onClick={() => setOrientation('portrait')}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${orientation === 'portrait' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                >
                  Vertical
                </button>
                <button
                  onClick={() => setOrientation('landscape')}
                  className={`px-2 py-0.5 rounded-md font-bold transition-all cursor-pointer ${orientation === 'landscape' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                >
                  Horizontal
                </button>
              </div>
            </div>

            {/* Botón Auto-Ajuste a 1 Página */}
            <button
              onClick={() => {
                setAutoFitOnePage(!autoFitOnePage);
                setCompactSpacing(!autoFitOnePage);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                autoFitOnePage 
                  ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-500/20' 
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-750 border border-slate-700'
              }`}
              title="Ajustar densidad para forzar en 1 sola hoja sin cortes"
            >
              <Sparkles size={13} className={autoFitOnePage ? 'text-amber-300' : 'text-slate-400'} />
              <span>{autoFitOnePage ? 'Ajustado a 1 Pág.' : 'Ajustar a 1 Pág.'}</span>
            </button>

            {/* Margen */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Margen:</span>
              <select
                value={marginSize}
                onChange={e => setMarginSize(e.target.value as any)}
                className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-slate-200 outline-none cursor-pointer"
              >
                <option value="compact">Compacto (10mm)</option>
                <option value="normal">Normal (15mm)</option>
                <option value="wide">Amplio (20mm)</option>
              </select>
            </div>

            {/* Grayscale */}
            <button
              onClick={() => setGrayscale(!grayscale)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                grayscale ? 'bg-slate-700 border-slate-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {grayscale ? '✓ Solo B/N' : 'Color'}
            </button>
          </div>

          {/* Acciones de Impresión & Zoom */}
          <div className="flex items-center gap-3">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 text-slate-300">
              <button
                onClick={() => setZoom(Math.max(40, zoom - 10))}
                className="p-1 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Alejar"
              >
                <ZoomOut size={15} />
              </button>
              <span className="text-xs font-mono font-bold w-12 text-center select-none">{zoom}%</span>
              <button
                onClick={() => setZoom(Math.min(160, zoom + 10))}
                className="p-1 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                title="Acercar"
              >
                <ZoomIn size={15} />
              </button>
            </div>

            {/* Botón Principal de Impresión */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
            >
              <Printer size={16} />
              <span>Imprimir Documento</span>
            </button>

            {/* Cerrar */}
            <button
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              title="Cerrar vista previa"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Barra de Navegación de Hojas (si hay más de 1 página) */}
        {pageCount > 1 && (
          <div className="bg-slate-900 border-b border-slate-800 py-2 px-6 flex items-center justify-between text-xs text-slate-300 select-none">
            <span className="text-[11px] font-bold text-slate-400">
              El documento se dividirá limpiamente en <strong className="text-white">{pageCount} hojas físicas</strong> sin cortar líneas por la mitad.
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSheetIndex(Math.max(1, activeSheetIndex - 1))}
                disabled={activeSheetIndex <= 1}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-mono font-bold text-indigo-400">
                Página {activeSheetIndex} de {pageCount}
              </span>
              <button
                onClick={() => setActiveSheetIndex(Math.min(pageCount, activeSheetIndex + 1))}
                disabled={activeSheetIndex >= pageCount}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Escenario de Previsualización en Tiempo Real */}
        <main className="flex-1 overflow-auto p-6 md:p-10 flex flex-col items-center justify-start bg-slate-950/60 pattern-grid">
          <div 
            className="transition-transform duration-200 ease-out origin-top flex flex-col items-center gap-8"
            style={{ 
              transform: `scale(${zoom / 100})`,
              marginBottom: `${Math.max(0, (zoom - 100) * 12)}px`
            }}
          >
            {/* Hoja Física Simulada */}
            <div 
              ref={printContainerRef}
              className="bg-white text-slate-900 border border-slate-300 rounded-sm relative overflow-hidden shadow-md"
              style={{
                width: `${paperDimensions.widthPx}px`,
                minHeight: `${paperDimensions.heightPx}px`
              }}
            >
              {/* Contenedor medidor */}
              <div ref={contentMeasureRef}>
                {printableCore}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 2. PORTAL DE AISLAMIENTO PURO PARA EL CONTROLADOR DE IMPRESIÓN DEL NAVEGADOR */}
      {createPortal(
        <div id="reporte-imprimible-root">
          {printableCore}
        </div>,
        document.body
      )}
    </>
  );
};
