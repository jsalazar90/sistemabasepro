import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface SlideOverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  widthClass?: string;
}

export default function SlideOverDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footerActions,
  widthClass = 'max-w-md w-full'
}: SlideOverDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop sutil */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex pl-10">
        <aside 
          className={`${widthClass} bg-white border-l border-slate-200 shadow-2xl flex flex-col transform transition-all duration-200 ease-out animate-slide-left`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition"
              title="Cerrar panel (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
            {children}
          </div>

          {/* Sticky Footer */}
          {footerActions && (
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
              {footerActions}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
