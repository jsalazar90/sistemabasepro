import { useEffect } from 'react';

export interface ErpShortcutOptions {
  onSave?: () => void;
  onSearch?: () => void;
  onEscape?: () => void;
  enabled?: boolean;
}

/**
 * Hook global para atajos de teclado estándar en aplicaciones administrativas tipo ERP:
 * - Escape: Cierra modales activos
 * - F2: Acción rápida o búsqueda principal
 * - Ctrl+S / Cmd+S: Guardar formulario actual evitando el guardado nativo del navegador
 */
export function useErpShortcuts({
  onSave,
  onSearch,
  onEscape,
  enabled = true
}: ErpShortcutOptions = {}) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Escape
      if (e.key === 'Escape') {
        if (onEscape) {
          onEscape();
        } else {
          // Despachar evento para cerrar cualquier modal abierto
          window.dispatchEvent(new CustomEvent('erp-close-modal'));
        }
      }

      // 2. F2: Búsqueda o foco rápido
      if (e.key === 'F2') {
        e.preventDefault();
        if (onSearch) {
          onSearch();
        } else {
          // Intentar enfocar el input de búsqueda principal si existe
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="Buscar"], input[placeholder*="buscar"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }
      }

      // 3. Ctrl+S o Cmd+S: Guardar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (onSave) {
          onSave();
        } else {
          // Intentar disparar submit del formulario activo
          const activeForm = document.querySelector('form') as HTMLFormElement;
          if (activeForm) {
            activeForm.requestSubmit();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onSearch, onEscape, enabled]);
}
