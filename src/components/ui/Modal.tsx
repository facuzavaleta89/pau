"use client";

import { useEffect, useId } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  onCerrar: () => void;
  children: React.ReactNode;
  /** Botones fijos al pie (el principal, a la derecha / abajo del pulgar). */
  pie?: React.ReactNode;
  /** Contenido fijo debajo del título (por ejemplo, pestañas). */
  debajoDelTitulo?: React.ReactNode;
  /** Ancho máximo en la compu. */
  ancho?: 'md' | 'lg' | '2xl' | '4xl';
  /** En celular: pantalla completa (formularios largos) u hoja desde abajo. */
  pantallaCompleta?: boolean;
  /** z-index: 50 por defecto; 60 para un modal que se abre encima de otro. */
  capa?: 50 | 60;
}

const ANCHOS = { md: 'md:max-w-md', lg: 'md:max-w-lg', '2xl': 'md:max-w-2xl', '4xl': 'md:max-w-4xl' };

// Modal base (DESIGN.md): en celular, hoja desde abajo o pantalla completa con
// el pie fijo; en la compu, centrado. Se renderiza solo mientras está abierto.
export function Modal({
  titulo, subtitulo, onCerrar, children, pie, debajoDelTitulo,
  ancho = 'lg', pantallaCompleta = false, capa = 50,
}: ModalProps) {
  const idTitulo = useId();

  useEffect(() => {
    // Que no se desplace la página de fondo mientras el modal está abierto.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflowPrevio; };
  }, []);

  return (
    <div
      className={cn(
        'fixed inset-0 flex items-end md:items-center justify-center bg-stone-900/50 backdrop-blur-sm md:p-4',
        capa === 60 ? 'z-[60]' : 'z-50'
      )}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={cn(
          'w-full bg-white shadow-xl flex flex-col overflow-hidden md:rounded-2xl md:border md:border-stone-200 md:max-h-[90vh]',
          ANCHOS[ancho],
          pantallaCompleta ? 'h-[100dvh] md:h-auto' : 'max-h-[92dvh] rounded-t-2xl'
        )}
      >
        <div
          className={cn(
            'shrink-0 flex items-start justify-between gap-3 px-4 md:px-6 py-3 md:py-4 border-b border-stone-200',
            pantallaCompleta && 'pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-4'
          )}
        >
          <div className="min-w-0">
            <h2 id={idTitulo} className="text-lg font-semibold text-stone-900 truncate">{titulo}</h2>
            {subtitulo && <div className="text-sm text-stone-600 mt-0.5">{subtitulo}</div>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 -mr-2 h-11 w-11 flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors duration-150"
          >
            <X size={20} />
          </button>
        </div>

        {debajoDelTitulo && <div className="shrink-0">{debajoDelTitulo}</div>}

        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>

        {pie && (
          <div className="shrink-0 flex gap-3 md:justify-end px-4 md:px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:py-4 border-t border-stone-200 bg-white">
            {pie}
          </div>
        )}
      </div>
    </div>
  );
}

/** Clases de los botones del pie: en celular ocupan todo el ancho (mitad y mitad). */
export const BOTON_PIE_SECUNDARIO =
  'flex-1 md:flex-none h-11 px-5 text-sm font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 hover:border-stone-300 rounded-lg transition-colors duration-150 disabled:opacity-50';
export const BOTON_PIE_PRIMARIO =
  'flex-1 md:flex-none h-11 px-5 flex items-center justify-center gap-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none';
