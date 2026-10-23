"use client";

import { DIAS_TPA } from '@/lib/tpa';
import type { SemanaTPA } from '@/types';
import { TpaHorarioCard } from './TpaHorarioCard';
import { TpaAccionesDia, type AccionesSemanaTPA } from './TpaAccionesDia';

interface TpaGrillaSemanaProps {
  semana: SemanaTPA;
  acciones: AccionesSemanaTPA;
}

// Vista de compu: 3 columnas (lunes, miércoles, viernes) × horarios.
export function TpaGrillaSemana({ semana, acciones }: TpaGrillaSemanaProps) {
  const horas = [...new Set(DIAS_TPA.flatMap((d) => semana[d.id].map((c) => c.hora)))].sort();

  return (
    <div className="grid grid-cols-[4rem_repeat(3,minmax(0,1fr))] gap-3 lg:gap-4">
      <div />
      {DIAS_TPA.map((d) => (
        <div key={d.id} className="text-center pb-1 border-b-2 border-stone-200 text-xs font-semibold text-stone-400 uppercase tracking-wider">
          {d.label} {semana[d.id][0] && <span className="normal-case">{semana[d.id][0].fecha.slice(8, 10)}/{semana[d.id][0].fecha.slice(5, 7)}</span>}
          <TpaAccionesDia celdas={semana[d.id]} acciones={acciones} className="mt-1" />
        </div>
      ))}

      {horas.map((hora) => (
        <div key={hora} className="contents">
          <div className="pt-4 text-right text-sm font-semibold text-stone-400">{hora}</div>
          {DIAS_TPA.map((d) => {
            const celda = semana[d.id].find((c) => c.hora === hora);
            return celda ? (
              <TpaHorarioCard key={d.id} celda={celda} onAbrir={acciones.onAbrir} onOcupar={acciones.onOcupar} onAbrirPaciente={acciones.onAbrirPaciente} />
            ) : (
              <div key={d.id} className="rounded-xl border border-dashed border-stone-200 flex items-center justify-center text-xs text-stone-400 min-h-24">
                Sin clase
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
