"use client";

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { DIAS_CORTOS, type DiaMes } from '@/lib/agenda';
import { TIPOS_TURNO, tipoTurno } from '@/lib/estados';
import { cn } from '@/lib/utils';

interface AgendaMesCelularProps {
  semanas: DiaMes[][];
  hoy: string;
  onAbrirDia: (fecha: string) => void;
}

const PUNTO = 'w-1.5 h-1.5 rounded-full shrink-0';

// Mes en el celular: calendario de 7 columnas con un punto por turno (hasta 3,
// violeta si es a domicilio) y "+" si hay más. Solo turnos individuales (sin
// TPA, Pau 20/11/2026). Tocar un día abre la vista Día.
export function AgendaMesCelular({ semanas, hoy, onAbrirDia }: AgendaMesCelularProps) {
  return (
    <div className="space-y-2">
      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-stone-50 border-b border-stone-200">
          {DIAS_CORTOS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-stone-400">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {semanas.flat().map((dia) => {
            const cantidad = dia.turnos.length + dia.masTurnos;
            const descripcion = [
              format(parseISO(dia.fecha), "EEEE d 'de' MMMM", { locale: es }),
              cantidad > 0 && `${cantidad} ${cantidad === 1 ? 'turno' : 'turnos'}`,
            ].filter(Boolean).join(', ');
            return (
              <button
                key={dia.fecha}
                type="button"
                onClick={() => onAbrirDia(dia.fecha)}
                aria-label={descripcion}
                className={cn('min-w-0 h-14 flex flex-col items-center justify-start gap-1 pt-1.5 border-t border-stone-100', !dia.delMes && 'bg-stone-50')}
              >
                <span className={cn(
                  'w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold',
                  dia.fecha === hoy ? 'bg-teal-600 text-white' : dia.delMes ? 'text-stone-900' : 'text-stone-400',
                )}>
                  {Number(dia.fecha.slice(8, 10))}
                </span>
                <span className="flex items-center gap-0.5 h-2" aria-hidden="true">
                  {dia.turnos.map((t) => <span key={t.id} className={cn(PUNTO, tipoTurno(t.tipo_sesion).punto)} />)}
                  {dia.masTurnos > 0 && <span className="text-[10px] leading-none font-bold text-stone-500">+</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500" aria-hidden="true">
        <span className="flex items-center gap-1"><span className={cn(PUNTO, TIPOS_TURNO.RPG.punto)} /> Turno</span>
        <span className="flex items-center gap-1"><span className={cn(PUNTO, TIPOS_TURNO['Clase domicilio'].punto)} /> Domicilio</span>
      </p>
    </div>
  );
}
