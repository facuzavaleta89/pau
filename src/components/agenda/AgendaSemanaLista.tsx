"use client";

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight, Plus } from 'lucide-react';
import type { DiaSemanaAgenda } from '@/lib/agenda';
import { cn } from '@/lib/utils';
import { TurnoCard } from '@/components/rpg/TurnoCard';
import type { AccionesAgenda } from './acciones';

interface AgendaSemanaListaProps {
  dias: DiaSemanaAgenda[];
  hoy: string;
  acciones: AccionesAgenda;
}

// Semana en el celular (como la lista de turnos de antes): los 7 días, cada
// uno con "+ Turno" y sus turnos individuales en tarjetas. Sin TPA (se ve en
// Día). Un día sin turnos ocupa una sola línea.
export function AgendaSemanaLista({ dias, hoy, acciones }: AgendaSemanaListaProps) {
  return (
    <div className="space-y-3">
      {dias.map(({ fecha, turnos }) => {
        const fechaLarga = format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es });
        return (
          <section key={fecha} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => acciones.onAbrirDia(fecha)}
                className={cn(
                  'min-h-11 min-w-0 flex items-center gap-1 text-sm font-semibold capitalize text-left',
                  fecha === hoy ? 'text-teal-700' : turnos.length > 0 ? 'text-stone-900' : 'text-stone-500',
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
            {turnos.length > 0 && (
              <div className="flex flex-col gap-2">
                {turnos.map((t) => (
                  <TurnoCard
                    key={t.id}
                    turno={t}
                    onClick={() => acciones.onEditarTurno(t)}
                    onPacienteClick={() => acciones.onAbrirPaciente(t.paciente_id)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
