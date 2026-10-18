"use client";

import { useEffect } from 'react';
import { CircleAlert, CircleCheck, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TipoToast = 'exito' | 'error' | 'aviso';

export interface Toast {
  id: number;
  tipo: TipoToast;
  mensaje: string;
}

interface ToastItemProps {
  toast: Toast;
  onCerrar: (id: number) => void;
}

const CONFIG: Record<TipoToast, { borde: string; icono: typeof CircleCheck; colorIcono: string }> = {
  exito: { borde: 'border-emerald-200', icono: CircleCheck, colorIcono: 'text-emerald-600' },
  error: { borde: 'border-red-200', icono: CircleAlert, colorIcono: 'text-red-600' },
  aviso: { borde: 'border-amber-200', icono: TriangleAlert, colorIcono: 'text-amber-600' },
};

const DURACION_EXITO_MS = 3000;

export function ToastItem({ toast, onCerrar }: ToastItemProps) {
  const { borde, icono: Icono, colorIcono } = CONFIG[toast.tipo];

  // Solo los de éxito se van solos; error y aviso quedan hasta que se cierran.
  useEffect(() => {
    if (toast.tipo !== 'exito') return;
    const timer = setTimeout(() => onCerrar(toast.id), DURACION_EXITO_MS);
    return () => clearTimeout(timer);
  }, [toast.id, toast.tipo, onCerrar]);

  return (
    <div
      role={toast.tipo === 'exito' ? 'status' : 'alert'}
      className={cn(
        'pointer-events-auto w-full bg-white border rounded-xl shadow-md pl-4 text-sm flex items-center gap-3',
        borde
      )}
    >
      <Icono size={20} className={cn('shrink-0', colorIcono)} />
      <p className="flex-1 py-3 text-stone-700">{toast.mensaje}</p>
      <button
        type="button"
        onClick={() => onCerrar(toast.id)}
        aria-label="Cerrar aviso"
        className="shrink-0 h-11 w-11 flex items-center justify-center text-stone-400 hover:text-stone-700 transition-colors duration-150"
      >
        <X size={16} />
      </button>
    </div>
  );
}
