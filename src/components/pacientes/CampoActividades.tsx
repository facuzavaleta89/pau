"use client";

import { Check } from 'lucide-react';
import { ACTIVIDADES, ORDEN_ACTIVIDADES } from '@/lib/estados';
import { cn } from '@/lib/utils';
import type { Actividad } from '@/types';

interface CampoActividadesProps {
  valor: Actividad[];
  onCambiar: (actividades: Actividad[]) => void;
}

// Casillas de la ficha: RPG · TPA · Domicilio (una o más).
export function CampoActividades({ valor, onCambiar }: CampoActividadesProps) {
  const alternar = (actividad: Actividad) => onCambiar(
    ORDEN_ACTIVIDADES.filter((a) => (a === actividad ? !valor.includes(a) : valor.includes(a))),
  );

  return (
    <fieldset className="space-y-1.5 sm:col-span-2">
      <legend className="text-xs font-medium text-stone-600">Actividad (una o más)</legend>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {ORDEN_ACTIVIDADES.map((actividad) => {
          const { label, detalle, clases, icono: Icono } = ACTIVIDADES[actividad];
          const marcada = valor.includes(actividad);
          return (
            <label
              key={actividad}
              className={cn(
                'min-h-11 px-3 flex items-center gap-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors duration-150',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-500/40',
                marcada ? clases : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300',
              )}
            >
              <input type="checkbox" checked={marcada} onChange={() => alternar(actividad)} className="sr-only" />
              <span className={cn('w-4 h-4 shrink-0 rounded border flex items-center justify-center', marcada ? 'border-current' : 'border-stone-300')}>
                {marcada && <Check size={12} strokeWidth={3} aria-hidden="true" />}
              </span>
              <Icono size={16} className="shrink-0" aria-hidden="true" />
              <span>{label}{detalle && <span className="font-normal opacity-75"> ({detalle})</span>}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
