"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ESTADOS_ASISTENCIA, ORDEN_ESTADOS_ASISTENCIA, esEstadoAsistenciaConocido, estadoAsistencia,
} from "@/lib/estados";
import type { AlumnoCeldaTPA, EstadoAsistenciaTPA } from "@/types";

interface TpaAsistenciaListaProps {
  alumnos: AlumnoCeldaTPA[];
  estadoActual: (alumno: AlumnoCeldaTPA) => EstadoAsistenciaTPA;
  onCambiar: (pacienteId: string, estado: EstadoAsistenciaTPA) => void;
  onIrAInscripcion: () => void;
}

// Registro rápido: un alumno por fila, estados como chips de un toque.
export function TpaAsistenciaLista({ alumnos, estadoActual, onCambiar, onIrAInscripcion }: TpaAsistenciaListaProps) {
  if (alumnos.length === 0) {
    return (
      <div className="m-4 md:m-6 text-center py-10 px-4 text-sm text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-200">
        No hay alumnos en este horario.
        <button
          type="button"
          onClick={onIrAInscripcion}
          className="mt-3 mx-auto h-11 px-4 flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:bg-teal-50 rounded-lg"
        >
          <Plus size={16} /> Inscribir un alumno fijo
        </button>
      </div>
    );
  }

  return (
    <ul className="p-4 md:p-6 space-y-3">
      {alumnos.map((alumno) => {
        const actual = estadoActual(alumno);
        const editado = actual !== alumno.estado;
        return (
          <li key={alumno.pacienteId} className="p-3 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-stone-900 truncate">{alumno.nombre}</span>
              <span className="shrink-0 text-xs text-stone-500">
                {!alumno.esFijo && 'No es fijo · '}
                {/* Estado de una versión más nueva de la app: se muestra, aunque no tenga chip. */}
                {!esEstadoAsistenciaConocido(actual) && `${estadoAsistencia(actual).label} · `}
                {editado ? 'Sin guardar' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ORDEN_ESTADOS_ASISTENCIA.map((valor) => {
                const estado = ESTADOS_ASISTENCIA[valor];
                const seleccionado = actual === valor;
                return (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => onCambiar(alumno.pacienteId, valor)}
                    aria-pressed={seleccionado}
                    className={cn(
                      "min-h-11 px-3 rounded-lg text-sm font-medium border transition-colors duration-150",
                      seleccionado
                        ? cn(estado.clases, "ring-2 ring-teal-500/30 font-semibold")
                        : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:text-stone-900"
                    )}
                  >
                    {estado.label}
                  </button>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
