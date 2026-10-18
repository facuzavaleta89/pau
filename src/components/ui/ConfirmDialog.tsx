"use client";

import { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  abierto: boolean;
  titulo: string;
  mensaje: React.ReactNode;
  textoConfirmar: string;
  /** Acción irreversible: botón rojo sólido. */
  peligroso?: boolean;
  cargando?: boolean;
  error?: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
}

// Reemplaza a confirm(). En celular se muestra como bottom sheet.
export function ConfirmDialog({
  abierto,
  titulo,
  mensaje,
  textoConfirmar,
  peligroso = false,
  cargando = false,
  error = null,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  const cancelarRef = useRef<HTMLButtonElement>(null);

  // El foco arranca en Cancelar (solo al abrir) para que un Enter apurado no confirme.
  useEffect(() => {
    if (abierto) cancelarRef.current?.focus();
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cargando) onCancelar();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [abierto, cargando, onCancelar]);

  if (!abierto) return null;

  const claseConfirmar = peligroso
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-teal-600 hover:bg-teal-700 text-white';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-stone-900/50 backdrop-blur-sm md:p-4"
      onClick={() => !cargando && onCancelar()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-titulo"
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-md bg-white border border-stone-200 rounded-t-2xl md:rounded-2xl shadow-xl p-6 space-y-4"
      >
        <div className="flex items-start gap-3">
          {peligroso && (
            <span className="shrink-0 h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </span>
          )}
          <div className="space-y-2">
            <h2 id="confirm-titulo" className="text-base font-semibold text-stone-900">{titulo}</h2>
            <div className="text-sm text-stone-700 space-y-2">{mensaje}</div>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse md:flex-row md:justify-end gap-3 pt-2">
          <button
            ref={cancelarRef}
            type="button"
            onClick={onCancelar}
            disabled={cargando}
            className="h-11 px-4 bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium rounded-lg border border-stone-200 hover:border-stone-300 transition-colors duration-150 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={cargando}
            className={`h-11 px-4 flex items-center justify-center gap-2 text-sm font-medium rounded-lg transition-colors duration-150 disabled:opacity-50 ${claseConfirmar}`}
          >
            {cargando && <Loader2 size={16} className="animate-spin" />}
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
