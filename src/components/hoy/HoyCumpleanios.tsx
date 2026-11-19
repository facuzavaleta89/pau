"use client";

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Cake } from 'lucide-react';
import { cumpleaniosProximos, type Cumpleanios } from '@/lib/pacientes';
import type { Paciente } from '@/types';

interface HoyCumpleaniosProps {
  pacientes: Paciente[];
  hoy: string;
  onAbrirPaciente: (pacienteId: string) => void;
}

function cuando(c: Cumpleanios): string {
  return c.dias === 1 ? 'mañana' : format(parseISO(c.fecha), 'EEE d/M', { locale: es });
}

// Quién cumple años hoy (bien a la vista) y en los próximos 7 días (más chico).
export function HoyCumpleanios({ pacientes, hoy, onAbrirPaciente }: HoyCumpleaniosProps) {
  const lista = cumpleaniosProximos(pacientes, hoy);
  const deHoy = lista.filter((c) => c.dias === 0);
  const proximos = lista.filter((c) => c.dias > 0);
  const hayFechas = pacientes.some((p) => p.fecha_nacimiento);

  return (
    <section className="space-y-3" aria-labelledby="hoy-cumpleanios">
      <h2 id="hoy-cumpleanios" className="text-base font-semibold text-stone-900">Cumpleaños</h2>

      {deHoy.length > 0 ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {deHoy.map((c) => (
            <li key={c.pacienteId}>
              <button
                type="button"
                onClick={() => onAbrirPaciente(c.pacienteId)}
                className="w-full min-h-11 flex items-center gap-3 p-3 text-left bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors duration-150"
              >
                <Cake size={20} className="shrink-0 text-teal-600" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-stone-900 truncate">{c.nombre}</span>
                  <span className="block text-xs text-teal-700">Hoy cumple {c.cumple} {c.cumple === 1 ? 'año' : 'años'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-500 bg-white border border-dashed border-stone-200 rounded-xl px-4 py-3">
          {hayFechas ? 'Hoy nadie cumple años.' : 'Cuando cargues la fecha de nacimiento en la ficha, los cumpleaños aparecen acá.'}
        </p>
      )}

      {proximos.length > 0 && (
        <p className="text-sm text-stone-600 flex flex-wrap items-center gap-x-1 gap-y-1">
          <span className="font-medium">Próximos 7 días:</span>
          {proximos.map((c, i) => (
            <span key={`${c.pacienteId}_${c.fecha}`}>
              <button type="button" onClick={() => onAbrirPaciente(c.pacienteId)} className="min-h-11 md:min-h-0 font-medium text-stone-800 hover:text-teal-700">
                {c.nombre}
              </button>
              {' '}({cuando(c)}, {c.cumple}){i < proximos.length - 1 ? ' ·' : ''}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
