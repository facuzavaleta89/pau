"use client";

import { CornerDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ESTADOS_ASISTENCIA, ORDEN_ESTADOS_FIJO, ORDEN_ESTADOS_OCUPANTE, TIPOS_OCUPANTE,
  esEstadoAsistenciaConocido, estadoAsistencia, etiquetaAsistencia,
} from "@/lib/estados";
import type { SugerenciaAviso } from "@/lib/avisos";
import type { AlumnoCeldaTPA, EstadoAsistenciaTPA } from "@/types";

interface TpaAsistenciaFilaProps {
  alumno: AlumnoCeldaTPA;
  actual: EstadoAsistenciaTPA;
  /** La clase todavía no empezó: solo se cargan avisos. */
  claseFutura: boolean;
  /** Con tiempo / sin tiempo sugerido (solo en clases futuras). */
  sugerencia: SugerenciaAviso | null;
  onCambiar: (estado: EstadoAsistenciaTPA) => void;
}

// En una clase futura no se sabe si vino: Presente y No avisó se habilitan al empezar la clase.
const SOLO_CON_LA_CLASE_EMPEZADA: EstadoAsistenciaTPA[] = ['presente', 'falto_sin_avisar'];

// Una persona en el registro rápido: nombre, qué es y sus estados como chips de un toque.
export function TpaAsistenciaFila({ alumno, actual, claseFutura, sugerencia, onCambiar }: TpaAsistenciaFilaProps) {
  const esFijo = alumno.tipo === 'fijo';
  const ocupante = alumno.tipo === 'fijo' ? null : TIPOS_OCUPANTE[alumno.tipo];
  const opciones = esFijo ? ORDEN_ESTADOS_FIJO : ORDEN_ESTADOS_OCUPANTE;
  const enLugarDeUnFijo = Boolean(alumno.asistencia?.ocupa_lugar_de);

  return (
    <li
      className={cn(
        "p-3 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2.5",
        enLugarDeUnFijo && "ml-4 md:ml-6"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0 font-semibold text-stone-900">
          {enLugarDeUnFijo && <CornerDownRight size={16} className="shrink-0 text-stone-400" aria-label="En el lugar del fijo de arriba" />}
          <span className="truncate">{alumno.nombre}</span>
        </span>
        <span className="shrink-0 text-xs text-stone-500">
          {ocupante && `${ocupante.label} · `}
          {esFijo && !alumno.esFijo && 'No es fijo · '}
          {/* Estado de una versión más nueva de la app: se muestra, aunque no tenga chip. */}
          {!esEstadoAsistenciaConocido(actual) && `${estadoAsistencia(actual).label} · `}
          {actual !== alumno.estado ? 'Sin guardar' : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {opciones.map((valor) => {
          const estado = ESTADOS_ASISTENCIA[valor];
          const seleccionado = actual === valor;
          const deshabilitado = claseFutura && SOLO_CON_LA_CLASE_EMPEZADA.includes(valor);
          const sugerido = esFijo && sugerencia?.estado === valor;
          return (
            <button
              key={valor}
              type="button"
              onClick={() => onCambiar(valor)}
              disabled={deshabilitado}
              aria-pressed={seleccionado}
              title={deshabilitado ? 'La clase todavía no empezó: solo se cargan avisos.' : undefined}
              className={cn(
                "min-h-11 px-3 rounded-lg text-sm font-medium border transition-colors duration-150",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                seleccionado
                  ? cn(estado.clases, "ring-2 ring-teal-500/30 font-semibold")
                  : "bg-white text-stone-600 border-stone-200 enabled:hover:bg-stone-50 enabled:hover:text-stone-900",
                sugerido && !seleccionado && "border-amber-300"
              )}
            >
              {etiquetaAsistencia(valor, alumno.tipo)}
              {sugerido && <span className="ml-1 text-xs font-normal">(sugerido)</span>}
            </button>
          );
        })}
      </div>
    </li>
  );
}
