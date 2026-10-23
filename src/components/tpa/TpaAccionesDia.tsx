"use client";

import { Ban, RotateCcw } from 'lucide-react';
import type { CeldaTPA } from '@/types';
import { cn } from '@/lib/utils';

/** Lo que se puede hacer desde la grilla o la lista de la semana. */
export interface AccionesSemanaTPA {
  onAbrir: (celda: CeldaTPA) => void;
  onOcupar: (celda: CeldaTPA) => void;
  onAbrirPaciente: (pacienteId: string) => void;
  /** Cancelar las clases del día que no están canceladas (crea las que falten). */
  onCancelarDia: (celdas: CeldaTPA[]) => void;
  /** Reactivar las clases canceladas del día. */
  onReactivarDia: (celdas: CeldaTPA[]) => void;
}

interface TpaAccionesDiaProps {
  celdas: CeldaTPA[];
  acciones: AccionesSemanaTPA;
  className?: string;
}

const BOTON = 'min-h-11 md:min-h-8 px-2 flex items-center gap-1 text-xs font-medium rounded-lg transition-colors duration-150 normal-case tracking-normal';

// "Cancelar el día" (feriados) y "Reactivar el día", en el encabezado de cada día.
export function TpaAccionesDia({ celdas, acciones, className }: TpaAccionesDiaProps) {
  const activas = celdas.filter((c) => !c.lugares.cancelada);
  const canceladas = celdas.filter((c) => c.lugares.cancelada);
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-1', className)}>
      {activas.length > 0 && (
        <button type="button" onClick={() => acciones.onCancelarDia(activas)} className={cn(BOTON, 'text-stone-500 hover:text-red-600 hover:bg-red-50')}>
          <Ban size={14} /> Cancelar el día
        </button>
      )}
      {canceladas.length > 0 && (
        <button type="button" onClick={() => acciones.onReactivarDia(canceladas)} className={cn(BOTON, 'text-stone-500 hover:text-teal-700 hover:bg-teal-50')}>
          <RotateCcw size={14} /> Reactivar el día
        </button>
      )}
    </div>
  );
}
