"use client";

import { ClipboardCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { estadoAsistencia } from '@/lib/estados';
import type { CeldaTPA } from '@/types';

interface TpaHorarioCardProps {
  celda: CeldaTPA;
  onAbrir: (celda: CeldaTPA) => void;
  onAbrirPaciente: (pacienteId: string) => void;
}

// Un horario de TPA en una fecha: hora, cupo y alumnos coloreados por estado.
// La usan la grilla de la compu y la lista del celular.
export function TpaHorarioCard({ celda, onAbrir, onAbrirPaciente }: TpaHorarioCardProps) {
  const ocupados = celda.alumnos.length;
  const completo = ocupados >= celda.cupo;

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md hover:border-stone-300 transition-all duration-150 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
          <Clock size={16} className="text-stone-400" />
          {celda.hora}
          {!celda.enHorarioHabitual && (
            <span className="text-xs font-medium text-stone-500">(fuera de horario)</span>
          )}
        </span>
        <span
          className={cn(
            'text-xs font-semibold px-2 py-0.5 rounded-full border',
            completo ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-stone-50 text-stone-600 border-stone-200'
          )}
          aria-label={`${ocupados} de ${celda.cupo} lugares ocupados`}
        >
          {ocupados}/{celda.cupo}
        </span>
      </div>

      {celda.alumnos.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {celda.alumnos.map((alumno) => {
            const estado = estadoAsistencia(alumno.estado);
            const Icono = estado.icono;
            return (
              <li key={alumno.pacienteId}>
                <button
                  type="button"
                  onClick={() => onAbrirPaciente(alumno.pacienteId)}
                  title={`${alumno.nombre}: ${estado.label}`}
                  className={cn(
                    'w-full min-h-11 md:min-h-9 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm md:text-xs font-medium text-left transition-shadow duration-150 hover:shadow-sm',
                    estado.clases
                  )}
                >
                  <Icono size={14} className="shrink-0" aria-hidden="true" />
                  <span className="truncate flex-1">{alumno.nombre}</span>
                  {!alumno.esFijo && <span className="shrink-0 text-xs opacity-80">{estado.label}</span>}
                  <span className="sr-only">{estado.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm md:text-xs text-stone-500 border border-dashed border-stone-200 rounded-lg px-3 py-2 text-center">
          Sin alumnos
        </p>
      )}

      <button
        type="button"
        onClick={() => onAbrir(celda)}
        className="h-11 md:h-9 flex items-center justify-center gap-2 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors duration-150"
      >
        <ClipboardCheck size={16} />
        {celda.clase ? 'Ver asistencia' : 'Registrar asistencia'}
      </button>
    </div>
  );
}
