"use client";

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { DIAS_TPA } from '@/lib/tpa';
import type { DiaSemana, SemanaTPA } from '@/types';
import { TpaHorarioCard } from './TpaHorarioCard';
import { TpaAccionesDia, type AccionesSemanaTPA } from './TpaAccionesDia';

interface TpaListaDiaProps {
  semana: SemanaTPA;
  dia: DiaSemana;
  onCambiarDia: (dia: DiaSemana) => void;
  acciones: AccionesSemanaTPA;
}

// Vista de celular: selector Lun / Mié / Vie y la lista de horarios de ese día.
export function TpaListaDia({ semana, dia, onCambiarDia, acciones }: TpaListaDiaProps) {
  const celdas = semana[dia];
  const fecha = celdas[0]?.fecha;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Día" className="grid grid-cols-3 gap-2">
        {DIAS_TPA.map((d) => {
          const activo = d.id === dia;
          const fechaDia = semana[d.id][0]?.fecha;
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => onCambiarDia(d.id)}
              className={cn(
                'h-12 rounded-lg border text-sm font-semibold flex flex-col items-center justify-center leading-tight transition-colors duration-150',
                activo ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
              )}
            >
              {d.corto}
              {fechaDia && <span className={cn('text-xs font-medium', activo ? 'text-teal-50' : 'text-stone-400')}>{fechaDia.slice(8, 10)}/{fechaDia.slice(5, 7)}</span>}
            </button>
          );
        })}
      </div>

      {fecha && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
            {format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es })}
          </h2>
          <TpaAccionesDia celdas={celdas} acciones={acciones} className="justify-end" />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {celdas.map((celda) => (
          <TpaHorarioCard key={celda.clave} celda={celda} onAbrir={acciones.onAbrir} onOcupar={acciones.onOcupar} onAbrirPaciente={acciones.onAbrirPaciente} />
        ))}
      </div>
    </div>
  );
}
