"use client";

import { AlertTriangle } from 'lucide-react';
import { TpaHorarioCard } from '@/components/tpa/TpaHorarioCard';
import type { AlertaFaltas } from '@/lib/alertas';
import { claseSinRegistrar } from '@/lib/tpa';
import type { CeldaTPA } from '@/types';

interface HoyClasesProps {
  clases: CeldaTPA[];
  ahora: Date;
  onAbrir: (celda: CeldaTPA) => void;
  onOcupar: (celda: CeldaTPA) => void;
  onAbrirPaciente: (pacienteId: string) => void;
  alertaDe: (pacienteId: string) => AlertaFaltas | null;
}

// Clases de TPA de hoy: la misma card de la semana, con su ocupación y
// "Registrar asistencia". Las que ya terminaron sin asistencia, destacadas.
export function HoyClases({ clases, ahora, onAbrir, onOcupar, onAbrirPaciente, alertaDe }: HoyClasesProps) {
  const libres = clases.reduce((n, c) => n + c.lugares.libres, 0);

  return (
    <section className="space-y-3" aria-labelledby="hoy-clases">
      <h2 id="hoy-clases" className="text-base font-semibold text-stone-900">
        Clases de TPA
        {clases.length > 0 && (
          <span className="ml-2 text-sm font-normal text-stone-500">
            {clases.length} {clases.length === 1 ? 'clase' : 'clases'} · {libres} {libres === 1 ? 'lugar libre' : 'lugares libres'}
          </span>
        )}
      </h2>

      {clases.length === 0 ? (
        <p className="text-sm text-stone-500 bg-white border border-dashed border-stone-200 rounded-xl px-4 py-3">
          Hoy no hay clases de TPA.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4 items-start">
          {clases.map((celda) => (
            <div key={celda.clave} className="space-y-1.5">
              {claseSinRegistrar(celda, ahora) && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                  <AlertTriangle size={14} aria-hidden="true" /> Ya terminó: falta registrar la asistencia
                </p>
              )}
              <TpaHorarioCard
                celda={celda}
                onAbrir={onAbrir}
                onOcupar={onOcupar}
                onAbrirPaciente={onAbrirPaciente}
                alertaDe={alertaDe}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
