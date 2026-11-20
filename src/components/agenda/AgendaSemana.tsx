"use client";

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import type { DiaSemanaAgenda } from '@/lib/agenda';
import { cn } from '@/lib/utils';
import { TurnoCard } from '@/components/rpg/TurnoCard';
import type { AccionesAgenda } from './acciones';
import { AgendaSemanaLista } from './AgendaSemanaLista';

interface AgendaSemanaProps {
  dias: DiaSemanaAgenda[];
  hoy: string;
  acciones: AccionesAgenda;
}

// Vista Semana: solo turnos individuales (Pau, 20/11/2026: con TPA "se le
// mezcla"; las clases están en Día y en TPA). Compu: una columna por día, de
// lunes a domingo, con las tarjetas de siempre (TurnoCard) en orden de hora,
// como el calendario de turnos de antes. Celular: lista por día.
export function AgendaSemana({ dias, hoy, acciones }: AgendaSemanaProps) {
  return (
    <>
      <div className="md:hidden">
        <AgendaSemanaLista dias={dias} hoy={hoy} acciones={acciones} />
      </div>

      <div className="hidden md:grid grid-cols-7 gap-px bg-stone-200 border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        {dias.map(({ fecha, turnos }) => (
          <div key={fecha} className="bg-stone-50 px-1.5 py-2 flex items-center justify-between gap-1 min-w-0">
            <button
              type="button"
              onClick={() => acciones.onAbrirDia(fecha)}
              className={cn(
                'min-w-0 h-8 px-1.5 rounded-md text-sm font-semibold capitalize truncate hover:bg-white',
                fecha === hoy ? 'text-teal-700' : turnos.length > 0 ? 'text-stone-700' : 'text-stone-500',
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
        {dias.map(({ fecha, turnos }) => (
          <div key={fecha} className={cn('min-w-0 min-h-40 p-1.5 flex flex-col gap-1.5', fecha === hoy ? 'bg-teal-50/40' : 'bg-white')}>
            {turnos.map((t) => (
              <TurnoCard
                key={t.id}
                turno={t}
                onClick={() => acciones.onEditarTurno(t)}
                onPacienteClick={() => acciones.onAbrirPaciente(t.paciente_id)}
              />
            ))}
          </div>
        ))}
      </div>
      {dias.every((d) => d.turnos.length === 0) && (
        <p className="hidden md:block mt-3 text-sm text-stone-500 text-center">
          Esta semana no hay turnos individuales. Las clases de TPA se ven en Día y en la pantalla TPA.
        </p>
      )}
    </>
  );
}
