"use client";

import { Plus } from 'lucide-react';
import { TurnoCard } from '@/components/rpg/TurnoCard';
import type { SesionRPG } from '@/types';

interface HoyTurnosProps {
  sesiones: SesionRPG[];
  onNuevoTurno: () => void;
  onEditarTurno: (turno: SesionRPG) => void;
  onAbrirPaciente: (pacienteId: string) => void;
}

// Turnos individuales de hoy, por hora (los domicilios, en su color).
export function HoyTurnos({ sesiones, onNuevoTurno, onEditarTurno, onAbrirPaciente }: HoyTurnosProps) {
  return (
    <section className="space-y-3" aria-labelledby="hoy-turnos">
      <div className="flex items-center justify-between gap-3">
        <h2 id="hoy-turnos" className="text-base font-semibold text-stone-900">
          Turnos individuales
          <span className="ml-2 text-sm font-normal text-stone-500">
            {sesiones.length} {sesiones.length === 1 ? 'turno' : 'turnos'}
          </span>
        </h2>
        <button
          type="button"
          onClick={onNuevoTurno}
          className="h-11 md:h-9 px-3 shrink-0 flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 rounded-lg transition-colors duration-150"
        >
          <Plus size={16} /> Turno
        </button>
      </div>

      {sesiones.length === 0 ? (
        <p className="text-sm text-stone-500 bg-white border border-dashed border-stone-200 rounded-xl px-4 py-3">
          Hoy no hay turnos individuales.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {sesiones.map((turno) => (
            <TurnoCard
              key={turno.id}
              turno={turno}
              onClick={() => onEditarTurno(turno)}
              onPacienteClick={() => onAbrirPaciente(turno.paciente_id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
