"use client";

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Pestania<T extends string> {
  id: T;
  label: string;
  icono: LucideIcon;
  /** Número a la vista (por ejemplo, pendientes); 0 o sin número = no se muestra. */
  contador?: number;
}

interface PestaniasProps<T extends string> {
  pestanias: Pestania<T>[];
  activa: T;
  onCambiar: (id: T) => void;
  etiqueta: string;
}

// Vistas principales de una pantalla (DESIGN.md, "Pestañas de una pantalla"):
// control segmentado bien visible, con ícono y contador. En el celular ocupa
// todo el ancho (una columna por pestaña); en la compu, lo que necesita.
export function Pestanias<T extends string>({ pestanias, activa, onCambiar, etiqueta }: PestaniasProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      className="grid auto-cols-fr grid-flow-col md:inline-grid md:auto-cols-auto gap-1 p-1 bg-stone-100 border border-stone-200 rounded-xl"
    >
      {pestanias.map(({ id, label, icono: Icono, contador }) => {
        const seleccionada = id === activa;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={seleccionada}
            onClick={() => onCambiar(id)}
            className={cn(
              'h-11 px-3 md:px-5 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors duration-150',
              seleccionada
                ? 'bg-white text-teal-700 shadow-sm ring-1 ring-stone-200'
                : 'text-stone-600 hover:text-stone-900 hover:bg-white/60'
            )}
          >
            <Icono size={16} className={seleccionada ? 'text-teal-600' : 'text-stone-400'} aria-hidden="true" />
            <span className="truncate">{label}</span>
            {contador ? (
              <span className="min-w-6 h-6 px-1.5 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-semibold">
                {contador}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
