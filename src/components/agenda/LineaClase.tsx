"use client";

import { CLASE_AGENDA, CLASES_CANCELADA } from '@/lib/estados';
import { claseVacia } from '@/lib/agenda';
import { cn } from '@/lib/utils';
import type { CeldaTPA } from '@/types';

interface LineaClaseProps {
  celda: CeldaTPA;
  onClick: () => void;
}

// Una clase de TPA en una sola línea: "10:30 TPA 3/4". Con lugares, en el
// teal de "Libre"; completa, gris; sin alumnos, atenuada; cancelada, tachada.
export function LineaClase({ celda, onClick }: LineaClaseProps) {
  const { lugares, cupo } = celda;
  const vacia = claseVacia(celda);
  const Icono = CLASE_AGENDA.icono;
  const detalle = lugares.cancelada
    ? 'cancelada'
    : vacia ? 'sin alumnos'
    : lugares.libres > 0 ? `${lugares.libres} ${lugares.libres === 1 ? 'lugar libre' : 'lugares libres'}`
    : 'completa';

  return (
    <button
      type="button"
      onClick={onClick}
      title={`TPA ${celda.hora} · ${lugares.ocupados}/${cupo} · ${detalle}`}
      className={cn(
        'w-full min-w-0 min-h-11 md:min-h-7 px-2 flex items-center gap-1.5 rounded-md border text-left text-sm md:text-xs',
        'transition-shadow duration-150 hover:shadow-sm',
        lugares.cancelada ? cn(CLASES_CANCELADA, 'line-through')
          : vacia ? CLASE_AGENDA.sinAlumnos
          : lugares.libres > 0 ? CLASE_AGENDA.conLugares
          : CLASE_AGENDA.completa,
      )}
    >
      <Icono size={12} className="shrink-0" aria-hidden="true" />
      <span className="shrink-0 font-semibold tabular-nums">{celda.hora}</span>
      <span className="truncate">{CLASE_AGENDA.label} {lugares.cancelada ? '' : `${lugares.ocupados}/${cupo}`}</span>
      <span className="sr-only">, {detalle}</span>
    </button>
  );
}
