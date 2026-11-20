"use client";

import { useCallback, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { getHorariosDeUnHorario } from '@/lib/queries';
import { bajasRecientes } from '@/lib/horarios';
import { diaYMes, hoyArgentina } from '@/lib/pagos';
import type { DiaSemana, HorarioTPA } from '@/types';
import { useDatos } from '@/hooks/useDatos';
import { TpaCorregirFijoDialog } from './TpaCorregirFijoDialog';

interface TpaBajasRecientesProps {
  dia: DiaSemana;
  hora: string;
  /** Cambia cuando se inscribe o desinscribe a alguien: vuelve a leer las bajas. */
  version: number;
  onCambio: () => void;
}

// En "Alumnos fijos": quienes se dieron de baja de este horario desde el mes
// anterior, con "Corregir" (deshacer la baja o borrarlo si se cargó por error).
export function TpaBajasRecientes({ dia, hora, version, onCambio }: TpaBajasRecientesProps) {
  const [hoy] = useState(() => hoyArgentina(new Date()));
  const [corrigiendo, setCorrigiendo] = useState<HorarioTPA | null>(null);
  const cargar = useCallback(() => getHorariosDeUnHorario(dia, hora), [dia, hora]);
  const { datos, recargar } = useDatos(`bajas_${dia}_${hora}_${version}`, cargar, 'No se pudieron cargar las bajas de este horario.');
  const bajas = useMemo(() => (datos ? bajasRecientes(datos, hoy) : []), [datos, hoy]);

  if (bajas.length === 0) return null;

  return (
    <section className="space-y-2 border-t border-stone-200 pt-5">
      <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Dados de baja hace poco</h3>
      <ul className="space-y-2">
        {bajas.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-2 pl-3 rounded-lg border border-dashed border-stone-200 bg-stone-50">
            <span className="flex items-center gap-2 min-w-0 text-sm text-stone-700">
              <History size={16} className="text-stone-400 shrink-0" aria-hidden="true" />
              <span className="truncate">{h.pacientes?.nombre}</span>
              <span className="shrink-0 text-xs text-stone-500">
                baja {diaYMes(h.fecha_baja ?? '')}{h.pacientes?.activo === false ? ' · paciente dado de baja' : ''}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setCorrigiendo(h)}
              className="h-11 md:h-9 px-3 shrink-0 text-sm font-medium text-teal-700 hover:bg-teal-50 rounded-lg transition-colors duration-150"
            >
              Corregir
            </button>
          </li>
        ))}
      </ul>
      {corrigiendo && (
        <TpaCorregirFijoDialog
          horario={corrigiendo}
          onCerrar={() => setCorrigiendo(null)}
          onHecho={() => { recargar(); onCambio(); }}
        />
      )}
    </section>
  );
}
