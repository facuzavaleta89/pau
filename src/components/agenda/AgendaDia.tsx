"use client";

import { Plus } from 'lucide-react';
import { bloqueDeHora, horasDelDia, type EventoAgenda } from '@/lib/agenda';
import { TurnoCard } from '@/components/rpg/TurnoCard';
import { TpaHorarioCard } from '@/components/tpa/TpaHorarioCard';
import type { AccionesAgenda } from './acciones';
import { LineaClase } from './LineaClase';

interface AgendaDiaProps {
  fecha: string;
  eventos: EventoAgenda[];
  acciones: AccionesAgenda;
}

// Vista Día: una fila por hora (8 a 20, más las que tengan algo fuera de ese
// rango) con los turnos (TurnoCard) y las clases (TpaHorarioCard). Las clases
// sin alumnos van en una línea atenuada. "+" en cada hora da un turno a esa hora.
export function AgendaDia({ fecha, eventos, acciones }: AgendaDiaProps) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm divide-y divide-stone-100">
      {horasDelDia(eventos).map((hora) => {
        const enLaHora = eventos.filter((e) => bloqueDeHora(e.hora) === hora);
        return (
          <div key={hora} className="grid grid-cols-[3rem_minmax(0,1fr)] md:grid-cols-[4rem_minmax(0,1fr)] gap-2 md:gap-3 px-3 md:px-4 py-2">
            <div className="pt-2.5 text-sm font-semibold text-stone-500 tabular-nums">{hora}:00</div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3 items-start">
              {enLaHora.map((e) => (e.tipo === 'turno' ? (
                <TurnoCard
                  key={e.clave}
                  turno={e.turno}
                  onClick={() => acciones.onEditarTurno(e.turno)}
                  onPacienteClick={() => acciones.onAbrirPaciente(e.turno.paciente_id)}
                />
              ) : e.vacia ? (
                <LineaClase key={e.clave} celda={e.celda} onClick={() => acciones.onAbrirClase(e.celda)} />
              ) : (
                <TpaHorarioCard
                  key={e.clave}
                  celda={e.celda}
                  onAbrir={(c) => acciones.onAbrirClase(c)}
                  onOcupar={(c) => acciones.onAbrirClase(c, true)}
                  onAbrirPaciente={acciones.onAbrirPaciente}
                  alertaDe={acciones.alertaDe}
                />
              )))}
              <button
                type="button"
                onClick={() => acciones.onNuevoTurno(fecha, `${hora}:00`)}
                aria-label={`Nuevo turno a las ${hora}:00`}
                className="h-11 md:h-9 px-3 justify-self-start flex items-center gap-1.5 text-sm font-medium text-stone-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors duration-150"
              >
                <Plus size={16} aria-hidden="true" /> Turno
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
