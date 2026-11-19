"use client";

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight, Plus } from 'lucide-react';
import type { SemanaAgenda } from '@/lib/agenda';
import { cn } from '@/lib/utils';
import type { AccionesAgenda } from './acciones';
import { LineaEvento } from './LineaEvento';

interface AgendaSemanaListaProps {
  semana: SemanaAgenda;
  hoy: string;
  acciones: AccionesAgenda;
}

// Semana en el celular: los 7 días en lista, cada uno con "+ Turno" y sus
// turnos y clases en una línea. Las clases sin alumnos no se muestran (se ven
// en la vista Día). Un día sin nada ocupa una sola línea.
export function AgendaSemanaLista({ semana, hoy, acciones }: AgendaSemanaListaProps) {
  return (
    <div className="space-y-3">
      {semana.dias.map(({ fecha, eventos }) => {
        const visibles = eventos.filter((e) => e.tipo === 'turno' || !e.vacia);
        const fechaLarga = format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es });
        return (
          <section key={fecha} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => acciones.onAbrirDia(fecha)}
                className={cn(
                  'min-h-11 min-w-0 flex items-center gap-1 text-sm font-semibold capitalize text-left',
                  fecha === hoy ? 'text-teal-700' : visibles.length > 0 ? 'text-stone-900' : 'text-stone-500',
                )}
              >
                <span className="truncate">{fechaLarga}</span>
                {fecha === hoy && <span className="text-xs font-medium normal-case">(hoy)</span>}
                <ChevronRight size={16} className="shrink-0 text-stone-400" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => acciones.onNuevoTurno(fecha)}
                aria-label={`Nuevo turno el ${fechaLarga}`}
                className="h-11 px-3 shrink-0 flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 rounded-lg transition-colors duration-150"
              >
                <Plus size={16} /> Turno
              </button>
            </div>
            {visibles.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {visibles.map((e) => <LineaEvento key={e.clave} evento={e} acciones={acciones} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
