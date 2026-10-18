"use client";

import { addDays, format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SemanaNav } from '@/components/ui/SemanaNav';
import type { SesionRPG } from '@/types';
import { TurnoCard } from './TurnoCard';

interface RpgSemanaListaProps {
  inicioSemana: Date;
  sesiones: SesionRPG[];
  onAnterior: () => void;
  onHoy: () => void;
  onSiguiente: () => void;
  onNuevoTurno: (dia?: Date) => void;
  onEditarTurno: (turno: SesionRPG) => void;
  onAbrirPaciente: (pacienteId: string) => void;
}

const MARTES = 1;
const JUEVES = 3;

// Vista de celular: la semana como lista por día. Siempre martes y jueves;
// otro día aparece solo si tiene turnos cargados.
export function RpgSemanaLista({
  inicioSemana, sesiones, onAnterior, onHoy, onSiguiente, onNuevoTurno, onEditarTurno, onAbrirPaciente,
}: RpgSemanaListaProps) {
  const dias = Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i)).filter((dia, i) => {
    const tieneTurnos = sesiones.some((s) => s.fecha === format(dia, 'yyyy-MM-dd'));
    return i === MARTES || i === JUEVES || tieneTurnos;
  });

  const etiqueta = `${format(inicioSemana, 'd MMM', { locale: es })} – ${format(addDays(inicioSemana, 6), 'd MMM', { locale: es })}`;

  return (
    <div className="space-y-4">
      <SemanaNav etiqueta={etiqueta} onAnterior={onAnterior} onHoy={onHoy} onSiguiente={onSiguiente} />

      {dias.map((dia) => {
        const fecha = format(dia, 'yyyy-MM-dd');
        const turnos = sesiones.filter((s) => s.fecha === fecha);
        return (
          <section key={fecha} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className={cn('text-sm font-semibold capitalize', isToday(dia) ? 'text-teal-700' : 'text-stone-900')}>
                {format(dia, "EEEE d 'de' MMMM", { locale: es })}
                {isToday(dia) && <span className="ml-2 text-xs font-medium normal-case">(hoy)</span>}
              </h2>
              <button
                type="button"
                onClick={() => onNuevoTurno(dia)}
                className="h-11 px-3 flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 rounded-lg transition-colors duration-150"
              >
                <Plus size={16} /> Turno
              </button>
            </div>
            {turnos.length === 0 ? (
              <p className="text-sm text-stone-500 bg-white border border-dashed border-stone-200 rounded-xl px-4 py-3">
                Sin turnos.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {turnos.map((turno) => (
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
      })}
    </div>
  );
}
