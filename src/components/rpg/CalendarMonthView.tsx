"use client";

import { useMemo } from 'react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isTuesday, isThursday,
  startOfWeek, endOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import type { SesionRPG } from '@/types';
import { cn } from '@/lib/utils';
import { SemanaNav } from '@/components/ui/SemanaNav';
import { TurnoCard } from './TurnoCard';

interface CalendarMonthViewProps {
  mes: Date;
  sesiones: SesionRPG[];
  cargando: boolean;
  onAnterior: () => void;
  onHoy: () => void;
  onSiguiente: () => void;
  onNuevoTurno: (dia?: Date) => void;
  onEditarTurno: (turno: SesionRPG) => void;
  onAbrirPaciente: (pacienteId: string) => void;
}

// Vista de compu: calendario mensual (lunes a domingo, martes y jueves resaltados).
export function CalendarMonthView({
  mes, sesiones, cargando, onAnterior, onHoy, onSiguiente, onNuevoTurno, onEditarTurno, onAbrirPaciente,
}: CalendarMonthViewProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(mes), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(mes), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [mes]);

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-4 border-b border-stone-200">
        <div className="w-full max-w-sm">
          <SemanaNav
            etiqueta={format(mes, 'MMMM yyyy', { locale: es })}
            onAnterior={onAnterior}
            onHoy={onHoy}
            onSiguiente={onSiguiente}
            textoAnterior="Mes anterior"
            textoSiguiente="Mes siguiente"
          />
        </div>
        <button
          type="button"
          onClick={() => onNuevoTurno()}
          className="h-11 shrink-0 bg-teal-600 hover:bg-teal-700 text-white px-4 rounded-lg text-sm font-medium transition-colors duration-150 flex items-center gap-2"
        >
          <Plus size={16} /> Nuevo turno
        </button>
      </div>

      <div className={cn('transition-opacity duration-150', cargando && 'opacity-60')} aria-busy={cargando}>
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
            <div key={day} className="py-3 text-center text-xs font-semibold text-stone-400 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr bg-stone-200 gap-px">
          {days.map((day) => {
            const isCurrentMonth = isSameMonth(day, mes);
            const isActiveDay = isTuesday(day) || isThursday(day);
            const daySesiones = sesiones.filter(s => s.fecha === format(day, 'yyyy-MM-dd'));

            return (
              <div
                key={day.toString()}
                className={cn(
                  "min-h-[120px] min-w-0 p-2 flex flex-col gap-2",
                  !isCurrentMonth && "bg-stone-50/40 text-stone-400",
                  isCurrentMonth && isActiveDay && "bg-white",
                  isCurrentMonth && !isActiveDay && "bg-stone-50/60"
                )}
              >
                <div className="flex justify-between items-center">
                  <span className={cn(
                    "w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold",
                    isToday(day) ? "bg-teal-600 text-white" : (!isCurrentMonth ? "text-stone-400" : "text-stone-900")
                  )}>
                    {format(day, 'd')}
                  </span>
                  {isActiveDay && (
                    <button
                      type="button"
                      onClick={() => onNuevoTurno(day)}
                      aria-label={`Nuevo turno el ${format(day, "d 'de' MMMM", { locale: es })}`}
                      className="h-8 w-8 flex items-center justify-center text-stone-400 hover:text-teal-600 hover:bg-stone-100 rounded-full transition-colors duration-150"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
                {daySesiones.map(turno => (
                  <TurnoCard
                    key={turno.id}
                    turno={turno}
                    onClick={() => onEditarTurno(turno)}
                    onPacienteClick={() => onAbrirPaciente(turno.paciente_id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
