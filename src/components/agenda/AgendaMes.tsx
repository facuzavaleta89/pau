"use client";

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import { DIAS_CORTOS, type DiaMes } from '@/lib/agenda';
import { cn } from '@/lib/utils';
import type { AccionesAgenda } from './acciones';
import { AgendaMesCelular } from './AgendaMesCelular';
import { LineaTurno } from './LineaTurno';

interface AgendaMesProps {
  semanas: DiaMes[][];
  hoy: string;
  acciones: AccionesAgenda;
}

// Vista Mes: solo turnos individuales (Pau, 20/11/2026: sin la línea de TPA).
// Compu: una celda por día con hasta 3 turnos en una línea y "+N más" (abre
// el Día). Cada semana mide lo que necesita: ninguna se estira por la más
// cargada. Celular: calendario con puntos.
export function AgendaMes({ semanas, hoy, acciones }: AgendaMesProps) {
  return (
    <>
      <div className="md:hidden">
        <AgendaMesCelular semanas={semanas} hoy={hoy} onAbrirDia={acciones.onAbrirDia} />
      </div>

      <div className="hidden md:block bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 bg-stone-50 border-b border-stone-200">
          {DIAS_CORTOS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-stone-400 uppercase tracking-wider">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-stone-200">
          {semanas.flat().map((dia) => (
            <div
              key={dia.fecha}
              className={cn('min-w-0 min-h-24 p-1.5 flex flex-col gap-1', dia.delMes ? 'bg-white' : 'bg-stone-50 text-stone-400')}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => acciones.onAbrirDia(dia.fecha)}
                  aria-label={`Ver el ${format(parseISO(dia.fecha), "EEEE d 'de' MMMM", { locale: es })}`}
                  className={cn(
                    'w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold transition-colors duration-150',
                    dia.fecha === hoy ? 'bg-teal-600 text-white' : dia.delMes ? 'text-stone-900 hover:bg-stone-100' : 'text-stone-400 hover:bg-stone-100',
                  )}
                >
                  {Number(dia.fecha.slice(8, 10))}
                </button>
                <button
                  type="button"
                  onClick={() => acciones.onNuevoTurno(dia.fecha)}
                  aria-label={`Nuevo turno el ${format(parseISO(dia.fecha), "d 'de' MMMM", { locale: es })}`}
                  className="h-7 w-7 flex items-center justify-center text-stone-400 hover:text-teal-600 hover:bg-stone-100 rounded-full transition-colors duration-150"
                >
                  <Plus size={14} />
                </button>
              </div>

              {dia.turnos.map((t) => <LineaTurno key={t.id} turno={t} onClick={() => acciones.onEditarTurno(t)} />)}
              {dia.masTurnos > 0 && (
                <button
                  type="button"
                  onClick={() => acciones.onAbrirDia(dia.fecha)}
                  className="h-6 px-2 self-start rounded-md text-xs font-semibold text-teal-700 hover:bg-teal-50"
                >
                  +{dia.masTurnos} más
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
