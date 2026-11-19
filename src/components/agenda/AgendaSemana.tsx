"use client";

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import { bloqueDeHora, type SemanaAgenda } from '@/lib/agenda';
import { cn } from '@/lib/utils';
import type { AccionesAgenda } from './acciones';
import { AgendaSemanaLista } from './AgendaSemanaLista';
import { LineaEvento } from './LineaEvento';

interface AgendaSemanaProps {
  semana: SemanaAgenda;
  hoy: string;
  acciones: AccionesAgenda;
}

// Vista Semana. Compu: lunes a domingo × horas con algo (una línea por turno
// o clase; las clases sin alumnos, atenuadas). Celular: lista por día.
export function AgendaSemana({ semana, hoy, acciones }: AgendaSemanaProps) {
  return (
    <>
      <div className="md:hidden">
        <AgendaSemanaLista semana={semana} hoy={hoy} acciones={acciones} />
      </div>

      <div className="hidden md:grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        <div className="bg-stone-50 border-b border-stone-200" />
        {semana.dias.map(({ fecha }) => (
          <div key={fecha} className="bg-stone-50 border-b border-l border-stone-200 px-1.5 py-2 flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => acciones.onAbrirDia(fecha)}
              className={cn(
                'min-w-0 h-8 px-1.5 rounded-md text-sm font-semibold capitalize truncate hover:bg-white',
                fecha === hoy ? 'text-teal-700' : 'text-stone-700',
              )}
            >
              {format(parseISO(fecha), 'EEE d', { locale: es })}
            </button>
            <button
              type="button"
              onClick={() => acciones.onNuevoTurno(fecha)}
              aria-label={`Nuevo turno el ${format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es })}`}
              className="h-8 w-8 shrink-0 flex items-center justify-center text-stone-400 hover:text-teal-600 hover:bg-white rounded-full transition-colors duration-150"
            >
              <Plus size={16} />
            </button>
          </div>
        ))}

        {semana.horas.length === 0 && (
          <p className="col-span-8 px-4 py-6 text-sm text-stone-500 text-center">Esta semana no hay turnos ni clases.</p>
        )}
        {semana.horas.map((hora) => (
          <div key={hora} className="contents">
            <div className="border-t border-stone-100 px-2 py-1.5 text-right text-xs font-semibold text-stone-500 tabular-nums">{hora}:00</div>
            {semana.dias.map(({ fecha, eventos }) => (
              <div
                key={fecha}
                className={cn('group border-t border-l border-stone-100 p-1 flex flex-col gap-1 min-w-0', fecha === hoy && 'bg-teal-50/30')}
              >
                {eventos.filter((e) => bloqueDeHora(e.hora) === hora).map((e) => (
                  <LineaEvento key={e.clave} evento={e} acciones={acciones} />
                ))}
                <button
                  type="button"
                  onClick={() => acciones.onNuevoTurno(fecha, `${hora}:00`)}
                  aria-label={`Nuevo turno el ${format(parseISO(fecha), "EEEE d", { locale: es })} a las ${hora}:00`}
                  className="h-6 flex items-center justify-center rounded-md text-stone-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-teal-600 hover:bg-stone-50 transition-opacity duration-150"
                >
                  <Plus size={14} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
