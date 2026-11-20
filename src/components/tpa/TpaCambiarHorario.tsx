"use client";

import { useCallback, useMemo } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { Info } from 'lucide-react';
import { cargarDatosCambio } from '@/lib/queries';
import { conflictoFechaCambio, destinosParaCambiar, textoHorario, type DestinoCambio } from '@/lib/horarios';
import { diaYMes } from '@/lib/pagos';
import { CUPO_TPA, DIAS_TPA, HORARIOS_TPA } from '@/lib/tpa';
import type { HorarioTPA } from '@/types';
import { useDatos } from '@/hooks/useDatos';
import { EstadoCarga } from '@/components/ui/EstadoCarga';

export interface ValorCambio {
  desde: string;
  /** 'lunes|18:00'; vacío = sin elegir. */
  destino: string;
}

export const leerDestino = (clave: string): DestinoCambio | null => {
  const [dia, hora] = clave.split('|');
  return DIAS_TPA.some((d) => d.id === dia) && hora ? { dia: dia as DestinoCambio['dia'], hora } : null;
};

interface TpaCambiarHorarioProps {
  horario: HorarioTPA;
  valor: ValorCambio;
  /** `listo` = la fecha sirve y el horario nuevo tiene lugar desde esa fecha. */
  onCambiar: (valor: ValorCambio, listo: boolean) => void;
}

const CAMPO = 'h-11 w-full bg-white border border-stone-200 text-stone-900 text-base md:text-sm px-3 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

// "Cambiar de horario": desde qué fecha y a qué horario (solo los que tienen
// lugar desde esa fecha; los demás, con el motivo, en "¿Y los otros?").
// Reglas en src/lib/horarios.ts; la base las vuelve a controlar al guardar.
export function TpaCambiarHorario({ horario, valor, onCambiar }: TpaCambiarHorarioProps) {
  const cargar = useCallback(() => cargarDatosCambio(horario.paciente_id), [horario.paciente_id]);
  const { datos, cargando, error, recargar } = useDatos(`cambio_${horario.id}`, cargar, 'No se pudieron revisar los horarios.');

  const revisar = useCallback((v: ValorCambio) => {
    if (!datos) return { fecha: null, opciones: [] };
    const fecha = conflictoFechaCambio(horario, v.desde, datos);
    return { fecha, opciones: fecha ? [] : destinosParaCambiar(horario, v.desde, datos, CUPO_TPA) };
  }, [datos, horario]);
  const { fecha: problemaFecha, opciones } = useMemo(() => revisar(valor), [revisar, valor]);
  const libres = opciones.filter((o) => !o.conflicto);
  const sinLugar = opciones.filter((o) => o.conflicto);

  const cambiar = (v: ValorCambio) => {
    const r = revisar(v);
    const libre = r.opciones.some((o) => !o.conflicto && `${o.dia}|${o.hora}` === v.destino);
    const limpio = libre ? v : { ...v, destino: '' };
    onCambiar(limpio, !r.fecha && libre);
  };

  if (!datos) return <EstadoCarga cargando={cargando} error={error} onReintentar={recargar} />;

  const destino = leerDestino(valor.destino);
  const etiquetaDia = (dia: string) => DIAS_TPA.find((d) => d.id === dia)?.label ?? dia;
  const fuera = (o: DestinoCambio) => !HORARIOS_TPA[o.dia].includes(o.hora);

  return (
    <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-stone-500">
          Desde qué fecha
          <input type="date" value={valor.desde} min={horario.fecha_alta} required className={CAMPO}
            onChange={(e) => cambiar({ ...valor, desde: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-500">
          Horario nuevo
          <select value={valor.destino} disabled={Boolean(problemaFecha) || libres.length === 0} className={CAMPO}
            onChange={(e) => cambiar({ ...valor, destino: e.target.value })}>
            <option value="">{libres.length === 0 ? 'Ninguno con lugar' : 'Elegir horario…'}</option>
            {DIAS_TPA.map((d) => {
              const delDia = libres.filter((o) => o.dia === d.id);
              return delDia.length === 0 ? null : (
                <optgroup key={d.id} label={d.label}>
                  {delDia.map((o) => (
                    <option key={o.hora} value={`${o.dia}|${o.hora}`}>{d.label} {o.hora}{fuera(o) ? ' (fuera de horario)' : ''}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
      </div>

      {problemaFecha && (
        <p className="flex items-start gap-1.5 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Info size={16} className="shrink-0 mt-0.5" aria-hidden="true" /> <span>{problemaFecha}</span>
        </p>
      )}
      {!problemaFecha && libres.length === 0 && (
        <p className="text-sm text-amber-800">Ningún horario tiene lugar desde esa fecha. Probá con otra fecha.</p>
      )}
      {destino && !problemaFecha && (
        <p className="text-sm text-stone-700">
          Hasta el {diaYMes(format(subDays(parseISO(valor.desde), 1), 'yyyy-MM-dd'))} sigue {textoHorario(horario)};
          desde el {diaYMes(valor.desde)}, {textoHorario({ dia_semana: destino.dia, hora: destino.hora })}.
          Lo ya registrado queda donde está y no cambia la cuota del mes.
        </p>
      )}
      {sinLugar.length > 0 && (
        <details className="text-sm text-stone-600">
          <summary className="cursor-pointer select-none text-stone-500">¿Y los otros horarios? ({sinLugar.length} sin lugar desde esa fecha)</summary>
          <ul className="mt-2 space-y-1">
            {sinLugar.map((o) => (
              <li key={`${o.dia}|${o.hora}`}><span className="font-medium">{etiquetaDia(o.dia)} {o.hora}:</span> {o.conflicto}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
