"use client";

import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Opcion<T extends string> {
  id: T;
  titulo: string;
  /** Qué pasa si se elige. */
  detalle: string;
  /** Por qué no se puede (vacío = se puede). */
  noSePuede: string[];
  /** No tiene vuelta atrás (borrar). */
  peligroso?: boolean;
}

interface OpcionCorregirProps<T extends string> {
  opcion: Opcion<T>;
  elegida: boolean;
  onElegir: () => void;
}

// Una opción grande con su consecuencia a la vista (como TpaCancelarDialog).
// Si no se puede, queda deshabilitada y dice por qué.
export function OpcionCorregir<T extends string>({ opcion, elegida, onElegir }: OpcionCorregirProps<T>) {
  const deshabilitada = opcion.noSePuede.length > 0;
  return (
    <label
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border transition-colors duration-150',
        deshabilitada ? 'bg-stone-50 border-stone-200 cursor-not-allowed'
          : elegida ? 'bg-teal-50 border-teal-500 cursor-pointer' : 'bg-white border-stone-200 hover:bg-stone-50 hover:border-stone-300 cursor-pointer',
      )}
    >
      <input
        type="radio"
        name="opcion-corregir"
        checked={elegida}
        disabled={deshabilitada}
        onChange={onElegir}
        className="mt-1 h-4 w-4 shrink-0 accent-teal-600"
      />
      <span className="flex-1 min-w-0">
        <span className={cn('block text-sm font-semibold', deshabilitada ? 'text-stone-500' : 'text-stone-900')}>{opcion.titulo}</span>
        <span className={cn('block text-sm mt-0.5', deshabilitada ? 'text-stone-400' : 'text-stone-600')}>{opcion.detalle}</span>
        {opcion.peligroso && !deshabilitada && elegida && (
          <span className="block text-sm font-semibold text-red-700 mt-1">No se puede deshacer.</span>
        )}
        {deshabilitada && (
          <span className="mt-2 flex items-start gap-1.5 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Info size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              No se puede: {opcion.noSePuede.join(' ')}
            </span>
          </span>
        )}
      </span>
    </label>
  );
}
