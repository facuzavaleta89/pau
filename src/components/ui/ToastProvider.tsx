"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ToastItem, type Toast, type TipoToast } from './ToastItem';

// Reemplaza a alert(). Uso:
//   const toast = useToast();
//   toast.exito('Turno guardado');
//   toast.error(mensajeError(error));

interface ToastApi {
  exito: (mensaje: string) => void;
  error: (mensaje: string) => void;
  aviso: (mensaje: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const MAXIMO_VISIBLES = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const siguienteId = useRef(0);

  const cerrar = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const mostrar = useCallback((tipo: TipoToast, mensaje: string) => {
    siguienteId.current += 1;
    const nuevo: Toast = { id: siguienteId.current, tipo, mensaje };
    // El más nuevo arriba; como mucho 3 a la vez.
    setToasts((prev) => [nuevo, ...prev].slice(0, MAXIMO_VISIBLES));
  }, []);

  const api = useMemo<ToastApi>(() => ({
    exito: (mensaje) => mostrar('exito', mensaje),
    error: (mensaje) => mostrar('error', mensaje),
    aviso: (mensaje) => mostrar('aviso', mensaje),
  }), [mostrar]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Celular: arriba al centro (no tapa la barra inferior). Desktop: abajo a la derecha. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed z-[70] top-4 inset-x-4 flex flex-col gap-2 md:top-auto md:inset-x-auto md:bottom-6 md:right-6 md:w-full md:max-w-sm"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onCerrar={cerrar} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const contexto = useContext(ToastContext);
  if (!contexto) throw new Error('useToast tiene que usarse dentro de <ToastProvider>');
  return contexto;
}
